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
import { INSPECTION_FIRST_LEVEL } from "../business/deliveryInspection";
import { flowSteps } from "../business/deliveryFlow";
import { STOCKROOM_FIRST_LEVEL } from "../business/stockroomSort";
import { SAUCE_FIRST_LEVEL, SAUCE_REQUIRED_FROM } from "../business/sauceStation";
import { marketPlanFor } from "./marketPlan";
import {
  EARLY_TWO_MACHINES_BY_LEVEL,
  SECOND_FLOOR_RESERVE_CENTS,
  SECOND_FLOOR_FROM_LEVEL,
} from "../config/earlyLevels";
import { FLOOR_ADVICE_KINDS, floorAdvice, type FloorAdviceKind } from "./floorAdvice";
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
  // Level 27: the Server and the Cashier have been on the team since Level 1-2, so "you can hire a team now" was wrong. What is true: the services get busy
  // and the Prep Cook is needed from Level 30 (staffRequirements.ts).
  staff: {
    text: "Services are getting busy. A Prep Cook will soon be needed. See Staff.",
    pose: "thumbs",
    go: "business-staff",
  },
  // Level 31: the Indian cuisine opens and needs its own Indian Chef (the French Bistro at Level 23 needs none); the next ones follow at 38, 40 and 47.
  cuisines: {
    text: "A new cuisine! Indian dishes need an Indian Chef. Hire one in Staff.",
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

/**
 * A cheer every ten services from the 30th (developer 2026-11-11: "at some level Paige says you became a chef": wrong. The line fired one level EARLY, on the level
 * about to be played, and "becoming a real chef" is not what happens at Service 80). It now fires once N services are really DONE (`completed`), and says what is true
 * at that point. Services 10 and 20 have their own chests and cards (milestoneChests.ts), so they are not repeated here.
 */
const MILESTONE_LINES: Readonly<Record<number, string>> = {
  30: "30 services done! This is a real restaurant now.",
  40: "40 services done! Your kitchen is busier every day.",
  50: "50 services done! Over halfway there. Look how far you have come!",
  60: "60 services done! Guests come back for your cooking.",
  70: "70 services done! Your restaurant runs like clockwork.",
  80: "80 services done! The finish line is in sight.",
};
const milestoneBeats = (): AssistantBeat[] =>
  Object.entries(MILESTONE_LINES)
    .filter(([n]) => Number(n) < LAST_CAMPAIGN_LEVEL - 1)
    .map(([n, text]) => ({
      id: `milestone:${n}`,
      lines: [{ text, pose: "cheer" }],
      tone: "success",
      priority: 20,
      when: (save: SaveData) => completed(save) >= Number(n) && completed(save) < Number(n) + 2,
    }));

/**
 * THE SECOND FLOOR REMINDERS (developer 2026-11-11; restaurant/floorAdvice.ts decides when): "Paige reminds the player to visit the Second Floor and buy machines when
 * there is more than enough money". One beat per level and kind, so the same tip can come again on a later level; at most one every level (never two in a row), and
 * only one every three levels once the player owns two machines or is past Level 20 (the first two machines are pushed harder). They are not kept in the notebook.
 */
export const FLOOR_NUDGE_PREFIX = "floor-nudge:";
const NUDGE_TEXT: Record<FloorAdviceKind, { lines: readonly AssistantLine[]; from: number }> = {
  "first-machine": {
    from: SECOND_FLOOR_FROM_LEVEL + 3,
    lines: [
      {
        text: "Your Second Floor is waiting! A machine earns money while you cook.",
        pose: "point",
      },
      { text: "You have enough for your first machine. Go and take a look!", pose: "cheer" },
    ],
  },
  "second-machine": {
    from: SECOND_FLOOR_FROM_LEVEL + 1,
    lines: [
      { text: "Add a second machine! Two machines earn much more than one.", pose: "cheer" },
      { text: "You have enough for another cheap machine. Visit the Second Floor!", pose: "point" },
    ],
  },
  "new-machine": {
    from: SECOND_FLOOR_FROM_LEVEL + 3,
    lines: [
      { text: "You have cash to spare! Buy a new machine and polish it.", pose: "cheer" },
      { text: "The Second Floor earns while you cook. Go upstairs!", pose: "point" },
    ],
  },
  polish: {
    from: SECOND_FLOOR_FROM_LEVEL + 3,
    lines: [
      { text: "Cash to spare! Polish your machines for more income.", pose: "tip" },
      { text: "Each polish step makes a machine earn more. Go upstairs!", pose: "point" },
    ],
  },
};

/** The level a nudge was given at (the number at the end of its id), or 0. */
const nudgeLevel = (id: string): number =>
  id.startsWith(FLOOR_NUDGE_PREFIX) ? Number(id.slice(id.lastIndexOf(":") + 1)) || 0 : 0;

const floorNudgeBeats = (): AssistantBeat[] => {
  const out: AssistantBeat[] = [];
  for (const kind of FLOOR_ADVICE_KINDS) {
    const { lines, from } = NUDGE_TEXT[kind];
    for (let n = from; n <= LAST_CAMPAIGN_LEVEL; n++)
      out.push({
        id: `${FLOOR_NUDGE_PREFIX}${kind}:${n}`,
        lines,
        go: "second-floor",
        tone: "success",
        priority: 48,
        when: (save, level) => {
          if (level !== n) return false;
          const advice = floorAdvice(save, level);
          if (!advice || advice.kind !== kind) return false;
          const given = assistantOf(save)
            .seen.map(nudgeLevel)
            .filter((l) => l > 0);
          const last = given.length ? Math.max(...given) : 0;
          // Never two levels in a row; one every three levels after the first two machines (or after Level 20).
          const pushHard =
            Object.keys(secondFloorOf(save).stations).length < 2 &&
            level < EARLY_TWO_MACHINES_BY_LEVEL;
          return level - last >= (pushHard ? 2 : 3);
        },
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
    // Developer 2026-11-11: the delivery check opens at Level 3 and the sorting one level later; each tip comes only while its step really waits
    // (a tip that sent the player to an Inventory with nothing to do was a bug).
    id: "check-delivery",
    lines: [
      { text: "Your order arrived! Look it over for bad food.", pose: "tip" },
      {
        text: "Tap anything that looks off. Move the big ones to look behind them!",
        pose: "explain",
      },
    ],
    go: "inventory",
    priority: 55,
    when: (save, level) =>
      within(level, INSPECTION_FIRST_LEVEL) &&
      flowSteps(save, level).some((x) => x.id === "inspect"),
  },
  {
    id: "fridge-sort",
    lines: [
      { text: "Checked food goes into the fridge. Sort it onto the right shelves!", pose: "tip" },
      { text: "Drop each piece where it belongs. Do it before service.", pose: "explain" },
    ],
    go: "inventory",
    priority: 55,
    when: (save, level) =>
      within(level, FRIDGE_SORT_FIRST_LEVEL) &&
      flowSteps(save, level).some((x) => x.id === "unpack" && !x.lockedBy),
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
    // Developer 2026-11-11: from Level 10 one Sauce Station round a day is part of the routine before service (deliveryFlow.ts).
    id: "sauce-daily",
    lines: [
      { text: "From now on, make a sauce each day before you open.", pose: "explain" },
      {
        text: "It is the last step of 'Before you open'. Your Prep Cook can do it too.",
        pose: "tip",
      },
    ],
    go: "inventory",
    priority: 51,
    when: (save, level) =>
      within(level, SAUCE_REQUIRED_FROM) && flowSteps(save, level).some((x) => x.id === "sauce"),
  },
  {
    id: "fridge-check",
    lines: [
      { text: "Before you close, check the fridge. Bin the spoiled food!", pose: "think" },
      { text: "Food that is almost old goes 'Use next'. Fresh food stays.", pose: "tip" },
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
  ...floorNudgeBeats(),
  {
    id: "finale",
    lines: [
      { text: "You did it! What a restaurant you built.", pose: "clap" },
      { text: "Thank you for cooking with me. I'm so proud!", pose: "cheer" },
    ],
    tone: "success",
    priority: 90,
    // Only once the LAST level is finished (it used to fire two levels early, on Level 90, before the end).
    when: (save) => completed(save) >= LAST_CAMPAIGN_LEVEL,
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
  let seen = [...s.seen, id];
  // Over the limit: the oldest Second Floor reminders go first, so a one-off tip she already gave can never come back.
  while (seen.length > SEEN_KEPT) {
    const old = seen.findIndex((x) => x.startsWith(FLOOR_NUDGE_PREFIX));
    seen = old >= 0 && old < seen.length - 1 ? seen.filter((_, i) => i !== old) : seen.slice(1);
  }
  return withAssistant(save, { ...s, seen });
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
    .seen.filter((id) => !id.startsWith(FLOOR_NUDGE_PREFIX))
    .map((id) => beatById(id))
    .filter((b): b is AssistantBeat => !!b && !b.hire)
    .map((beat) => ({ id: beat.id, text: beat.lines[0]!.text, beat }));
}
