/**
 * PAIGE, THE PERSONAL ASSISTANT (developer 2026-11-06/07: "a beautiful, friendly assistant, hired at Level 1, who teaches the whole game
 * with pop-up speech bubbles"; plan: docs/planning/ASSISTANT-PAIGE-PLAN-2026-11-06.md).
 *
 * She is ONE VOICE on top of the guidance the game already has (the first-run hand, the Restaurant Guide card, Grandma's section pointer,
 * the mini-games' how-to tours); she adds no system and moves no money. Her hire is FREE and has no wage and no ledger entry (a flag in
 * `business.assistant`, decision D2); the game's economy and its frozen baselines are untouched.
 *
 * A BEAT is one short tip: one or two lines (at most 90 characters each, English, at most one emoji), a pose, an optional ring on a real
 * button and an optional "Take me there". Every beat is tied to a rule the game already has (a level, an unlock, a finished first
 * service), is shown AT MOST ONCE (`seen`), and only on the calm home screens (the Kitchen and the Restaurant map), never more than one
 * per screen visit: that part is the host's (components/kc/assistant/AssistantHost.tsx). "Tips: Off" stops every beat except her
 * introduction; the notebook keeps every tip she has given, to read again.
 *
 * Pure and deterministic: no Math.random, no clock, nothing saved except `business.assistant`.
 */
import type { SaveData } from "../SaveManager";
import { CLEANING_FROM_LEVEL } from "../config/cleaningStart";
import { FRIDGE_SORT_FIRST_LEVEL } from "../business/fridgeSort";
import { STOCKROOM_FIRST_LEVEL } from "../business/stockroomSort";
import { SAUCE_FIRST_LEVEL } from "../business/sauceStation";
import { marketPlanFor } from "./marketPlan";
import { SECOND_FLOOR_RESERVE_CENTS, SECOND_FLOOR_FROM_LEVEL } from "../config/earlyLevels";
import { STATIONS, secondFloorOf } from "./secondFloor";
import {
  LAST_CAMPAIGN_LEVEL,
  RESTAURANT_SYSTEMS,
  restaurantSystem,
  type RestaurantSystemId,
} from "./restaurantProgression";
import { restaurantLevelOf } from "./restaurantMenu";

export const ASSISTANT_NAME = "Paige";

/** The poses cut from the generated sheets (public/business/assistant/pose-<pose>.webp). */
export type PaigePose =
  | "wave"
  | "explain"
  | "point"
  | "tip"
  | "cheer"
  | "thumbs"
  | "oops"
  | "surprised"
  | "think"
  | "sorry"
  | "clap"
  | "clipboard";
export const PAIGE_POSES: readonly PaigePose[] = [
  "wave",
  "explain",
  "point",
  "tip",
  "cheer",
  "thumbs",
  "oops",
  "surprised",
  "think",
  "sorry",
  "clap",
  "clipboard",
];

/** The longest a bubble line may be (the copy rule: a few words). assistant-qa fails any longer line. */
export const MAX_LINE_CHARS = 90;
/** A system's or a mini-game's tip is given in the levels from its unlock to this many levels after it. */
export const BEAT_WINDOW_LEVELS = 3;
/** The notebook keeps this many tips. */
export const SEEN_KEPT = 120;

export type AssistantState = {
  hired: boolean;
  /** Beat ids she has already given, oldest first. */
  seen: string[];
  /** "Tips: Off": no bubble pops up by itself (her introduction aside); the notebook stays. */
  tipsOff?: boolean;
};

export type AssistantLine = { text: string; pose: PaigePose };

export type AssistantBeat = {
  id: string;
  /** One or two bubbles, each at most MAX_LINE_CHARS. */
  lines: readonly AssistantLine[];
  /** A ring (and arrow) on a real button: a CSS selector of a `data-nav` on the bottom bar. Missing on screen = the bubble shows without it. */
  target?: string;
  /** "Take me there": the screen it opens (a ScreenId; the app maps "shop" to the Market's Ingredients tab). */
  go?: string;
  /** The introduction: its button is "Hire Paige" (free). */
  hire?: boolean;
  /** The bubble's painted frame: plain, a celebration (green leaf) or a heads-up (red ribbon). Default "normal". */
  tone?: "normal" | "success" | "warning";
  /** Higher first when several apply at once. */
  priority: number;
  when: (save: SaveData, level: number) => boolean;
};

const MARKET_TAB = '[data-nav="shop"]';

const within = (level: number, from: number) => level >= from && level < from + BEAT_WINDOW_LEVELS;

const completed = (save: SaveData) => save.levelProgress.completedLevelIds.length;

/** A system's id → (what Paige says, where she sends the player). One line each; they match what the unlock card and the guide teach. */
const SYSTEM_TIPS: Partial<
  Record<RestaurantSystemId, { text: string; pose: PaigePose; go?: string }>
> = {
  menu: {
    text: "Your menu is open! Pick what guests can order.",
    pose: "explain",
    go: "business-menu",
  },
  "fridge-freshness": {
    text: "Food goes off now. Don't buy more than you can use.",
    pose: "tip",
    go: "business-refrigerator",
  },
  "dine-in": {
    text: "Guests eat at tables now! Keep plates stocked and wash up.",
    pose: "explain",
    go: "inventory-supplies",
  },
  staff: {
    text: "You can hire a team now. They do the routine work for you.",
    pose: "thumbs",
    go: "business-staff",
  },
  cuisines: {
    text: "New cuisines! Each one needs its own chef.",
    pose: "surprised",
    go: "business-staff",
  },
  takeaway: {
    text: "Takeaway orders are open. A Cashier packs the bags.",
    pose: "explain",
    go: "business-staff",
  },
  "full-operation": {
    text: "Your restaurant is bigger now. Keep it clean and well stocked.",
    pose: "clipboard",
    go: "business-cleanliness",
  },
  expansion: {
    text: "Time to grow! Upgrade your kitchen for more room.",
    pose: "cheer",
    go: "business-kitchen-upgrades",
  },
  established: {
    text: "An established restaurant! Aim to be No. 1 in the city.",
    pose: "cheer",
    go: "rack",
  },
  master: { text: "Master level. Keep your standards high!", pose: "thumbs" },
  "grand-service": { text: "Grand Service. The last stretch. You've got this!", pose: "clap" },
};

const systemBeats = (): AssistantBeat[] =>
  RESTAURANT_SYSTEMS.flatMap((s) => {
    const tip = SYSTEM_TIPS[s.id];
    if (!tip) return [];
    const from = s.firstLevel;
    return [
      {
        id: `system:${s.id}`,
        lines: [{ text: tip.text, pose: tip.pose }],
        ...(tip.go ? { go: tip.go } : {}),
        priority: 50,
        when: (_save, level) => within(level, from),
      } satisfies AssistantBeat,
    ];
  });

/** A cheer every ten services (the restaurant build counts services), tied to what is next. */
const milestoneBeats = (): AssistantBeat[] => {
  const out: AssistantBeat[] = [];
  for (let n = 10; n < LAST_CAMPAIGN_LEVEL - 1; n += 10) {
    out.push({
      id: `milestone:${n}`,
      lines: [{ text: `Service ${n} done! You're becoming a real chef.`, pose: "cheer" }],
      tone: "success",
      priority: 20,
      when: (_save, level) => level >= n && level < n + 2,
    });
  }
  return out;
};

export const ASSISTANT_BEATS: readonly AssistantBeat[] = [
  {
    id: "meet",
    hire: true,
    lines: [
      { text: "Hi, I'm Paige, your assistant!", pose: "wave" },
      { text: "I'll show you around, step by step. I'm free to hire!", pose: "explain" },
    ],
    priority: 100,
    when: (save) => completed(save) === 0,
  },
  {
    // A player who is already past the first service meets her too (a catch-up introduction, decision D3).
    id: "meet-late",
    hire: true,
    lines: [
      { text: "Hi, I'm Paige! I can guide you from here.", pose: "wave" },
      { text: "I'm free to hire, and I won't nag. Promise!", pose: "thumbs" },
    ],
    priority: 100,
    when: (save) => completed(save) > 0,
  },
  {
    id: "first-pay",
    lines: [
      { text: "You earned your first cash! Well done!", pose: "cheer" },
      { text: "Cash buys more food. Visit the Market.", pose: "point" },
    ],
    target: MARKET_TAB,
    go: "shop",
    tone: "success",
    priority: 80,
    when: (save) => completed(save) === 1,
  },
  {
    // Level 2 on: the next service needs food the fridge does not have.
    id: "restock",
    lines: [{ text: "Running low on food? The Market has what you need.", pose: "point" }],
    target: MARKET_TAB,
    go: "shop",
    tone: "warning",
    priority: 70,
    when: (save, level) =>
      level >= 2 && completed(save) >= 1 && marketPlanFor(save, 1).rows.length > 0,
  },
  {
    id: "fridge-sort",
    lines: [
      {
        text: "Your order arrived! Check it, then play Fridge Sort.",
        pose: "tip",
      },
      {
        text: "Check for damaged food, then put it in the fridge. Both come before service.",
        pose: "explain",
      },
    ],
    go: "inventory",
    priority: 55,
    when: (_save, level) => within(level, FRIDGE_SORT_FIRST_LEVEL),
  },
  {
    // Developer 2026-11-08: the Second Floor is introduced only when the player can pay the first machine and still has money to carry on.
    id: "second-floor",
    lines: [
      { text: "The Second Floor is open! Machines earn while you rest.", pose: "cheer" },
      { text: "You can afford your first machine. Take a look!", pose: "point" },
    ],
    go: "second-floor",
    tone: "success",
    priority: 56,
    when: (save, level) =>
      level >= SECOND_FLOOR_FROM_LEVEL &&
      Object.keys(secondFloorOf(save).stations).length === 0 &&
      save.credits >= STATIONS[0]!.price + SECOND_FLOOR_RESERVE_CENTS,
  },
  {
    // Developer 2026-11-08: a small moment at the first steak and the first fish; it only points at the Market (no discount, no money).
    id: "steak-knife",
    lines: [{ text: "Steak is tough! A better knife in the Market helps.", pose: "tip" }],
    go: "shop",
    priority: 45,
    when: (_save, level) => within(level, 15),
  },
  {
    id: "fish-board",
    lines: [{ text: "Fish is delicate. Look at the Market's boards.", pose: "tip" }],
    go: "shop",
    priority: 45,
    when: (_save, level) => within(level, 16),
  },
  {
    id: "cleaning",
    lines: [{ text: "A clean kitchen keeps guests happy. Check Cleanliness.", pose: "clipboard" }],
    go: "business-cleanliness",
    priority: 54,
    when: (_save, level) => within(level, CLEANING_FROM_LEVEL),
  },
  {
    id: "stockroom-sort",
    lines: [
      {
        text: "Put the new supplies on the shelves before service. It's a quick game!",
        pose: "tip",
      },
    ],
    go: "inventory-supplies",
    priority: 53,
    when: (_save, level) => within(level, STOCKROOM_FIRST_LEVEL),
  },
  {
    // Developer 2026-11-10: the Sauce Station opens at Level 7 (the Simple Garden Salad), before Level 20.
    id: "sauce-station",
    lines: [
      { text: "Make a salad dressing! Mix it, whisk it, bottle it.", pose: "cheer" },
      { text: "It's in Inventory. Stars give you Hype!", pose: "tip" },
    ],
    go: "inventory",
    priority: 51,
    when: (_save, level) => within(level, SAUCE_FIRST_LEVEL),
  },
  {
    id: "fridge-check",
    lines: [
      { text: "Before closing, check the fridge for spoiled food.", pose: "think" },
      { text: "You can practise it in Inventory any time.", pose: "tip" },
    ],
    go: "inventory",
    tone: "warning",
    priority: 52,
    when: (_save, level) => within(level, restaurantSystem("fridge-freshness").firstLevel),
  },
  {
    id: "ads-optional",
    lines: [
      { text: "Some bonuses come with a short ad.", pose: "explain" },
      { text: "They're always optional. You never need one.", pose: "thumbs" },
    ],
    priority: 30,
    when: (_save, level) => level >= 6 && level < 9,
  },
  ...systemBeats(),
  ...milestoneBeats(),
  {
    id: "finale",
    lines: [
      { text: "You did it! What a restaurant you built.", pose: "clap" },
      { text: "Thank you for cooking with me. I'm so proud!", pose: "cheer" },
    ],
    tone: "success",
    priority: 90,
    when: (_save, level) => level >= LAST_CAMPAIGN_LEVEL - 1,
  },
];

export const beatById = (id: string): AssistantBeat | undefined =>
  ASSISTANT_BEATS.find((b) => b.id === id);

// ── State ────────────────────────────────────────────────────────────────────

/** The saved state: an old save (no field) is "not hired, nothing seen"; bad values are dropped. */
export function assistantOf(save: SaveData): AssistantState {
  const raw = save.business.assistant;
  const seen = Array.isArray(raw?.seen)
    ? [...new Set(raw.seen.filter((s): s is string => typeof s === "string"))].slice(-SEEN_KEPT)
    : [];
  return {
    hired: raw?.hired === true,
    seen,
    ...(raw?.tipsOff === true ? { tipsOff: true } : {}),
  };
}

export const assistantHired = (save: SaveData): boolean => assistantOf(save).hired;

function withAssistant(save: SaveData, next: AssistantState): SaveData {
  return { ...save, business: { ...save.business, assistant: next } };
}

/** Hires Paige: free, no wage, NO ledger entry and no wallet movement (a flag, not a purchase). Hiring again changes nothing. */
export function hireAssistant(save: SaveData): SaveData {
  const s = assistantOf(save);
  if (s.hired) return save;
  return withAssistant(save, { ...s, hired: true });
}

/** Marks a beat as given (the same save back when it already was). */
export function markAssistantSeen(save: SaveData, id: string): SaveData {
  const s = assistantOf(save);
  if (s.seen.includes(id)) return save;
  return withAssistant(save, { ...s, seen: [...s.seen, id].slice(-SEEN_KEPT) });
}

/** "Tips: On / Off". */
export function setAssistantTips(save: SaveData, on: boolean): SaveData {
  const s = assistantOf(save);
  if ((s.tipsOff !== true) === on) return save;
  const { tipsOff: _drop, ...rest } = s;
  void _drop;
  return withAssistant(save, on ? rest : { ...rest, tipsOff: true });
}

/** Which introduction she needs (not hired yet), or null. */
export function introBeatFor(save: SaveData): AssistantBeat | null {
  if (assistantHired(save)) return null;
  return beatById(completed(save) === 0 ? "meet" : "meet-late") ?? null;
}

/**
 * The tip to give now, or null. Not hired: only her introduction. Hired: the highest-priority beat whose rule applies and that was not
 * given yet, unless the player turned tips off. `level` is the player's level (restaurantLevelOf).
 */
export function assistantBeatFor(save: SaveData): AssistantBeat | null {
  const s = assistantOf(save);
  if (!s.hired) return introBeatFor(save);
  if (s.tipsOff) return null;
  const level = restaurantLevelOf(save.levelProgress);
  let best: AssistantBeat | null = null;
  for (const beat of ASSISTANT_BEATS) {
    if (beat.hire || s.seen.includes(beat.id) || !beat.when(save, level)) continue;
    if (!best || beat.priority > best.priority) best = beat;
  }
  return best;
}

/** Every tip she has given, for the notebook (oldest first), each with its first line. */
export function notebookEntries(
  save: SaveData,
): { id: string; text: string; beat: AssistantBeat }[] {
  return assistantOf(save)
    .seen.map((id) => beatById(id))
    .filter((b): b is AssistantBeat => !!b && !b.hire)
    .map((beat) => ({ id: beat.id, text: beat.lines[0]!.text, beat }));
}
