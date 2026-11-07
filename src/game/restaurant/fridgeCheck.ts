/**
 * FRIDGE CHECK — the rules of the closing-night inspection (developer 2026-11-06; plan: docs/planning/FRIDGE-CHECK-MINIGAME-PLAN-2026-11-06.md).
 *
 * The two night chores "Throw out spoiled food" (`spoiled-out`) and "Wrap and label what's left in the fridge" (`wrap-fridge`) become one
 * optional game on the walk-in fridge:
 *   - STAGE 1 "sort": a card for every ingredient really in stock. Swipe it Keep, Bin or (from the second tier) Use first. The right answer
 *     is the game's own freshness rule read for TOMORROW, exactly what Closing Time will throw out (`closingPreview`).
 *   - STAGE 2 "wrap": the food that stays is wrapped and labelled, soonest use-by first.
 * Pure rules: no I/O, no unseeded randomness (a small seeded generator), and NEVER any money, stock or ledger entry. A wrong swipe costs
 * points only: binning fresh food does not remove it and keeping spoiled food does not save it; Closing Time's sweep is the only thing that
 * moves stock. The effects are the stars, Hype (`addHype`, the same table as the sorting games) and the freshness pins.
 *
 * The chore itself is completed by the existing cleanliness action (`applyCleanlinessAction` kind "check" -> `cleanTask`), so the
 * cleanliness effect is exactly what the one tap gave. State lives in `business.fridgeCheck` (optional; absent = nothing earned yet).
 */
import type { IngredientId } from "../definitions";
import { INGREDIENTS } from "../definitions";
import type { SaveData } from "../SaveManager";
import { advanceBusinessDay } from "../business/businessCalendar";
import {
  ageInDays,
  perishabilityStateFor,
  shelfLifeForIngredient,
} from "../business/perishability";
import type { PerishabilityState } from "../business/perishability";
import { HYPE_BY_STARS } from "../business/fridgeSort";
import { POINTS_PER_SET, TIME_BONUS_PER_SECOND, pointsFor } from "../business/stockroomSort";
import { addHype } from "./secondFloor";
import { isSystemLive, restaurantSystem } from "./restaurantProgression";

// ── Which chore, and when it opens ───────────────────────────────────────────

export type CheckStage = "sort" | "wrap";
/** The cleanliness task each stage completes (and only that one). */
export const CHECK_TASK = { sort: "spoiled-out", wrap: "wrap-fridge" } as const;
export type CheckTask = (typeof CHECK_TASK)[CheckStage];

/** The stage a chore opens, or null for any other task. */
export const stageOfTask = (task: string): CheckStage | null =>
  task === CHECK_TASK.sort ? "sort" : task === CHECK_TASK.wrap ? "wrap" : null;

/** Dev test: `?fridgeCheck` in the address shows the game before the freshness stage (stock still has to be judgeable). */
export const FRIDGE_CHECK_TEST_UNLOCK: boolean =
  typeof location !== "undefined" && /[?&]fridgeCheck\b/.test(location.search);

/** The fewest cards a night needs to be worth a game (fewer = the chore stays one tap). */
export const MIN_CARDS = 3;
/** The fewest different use-by days a wrap night needs (all alike = nothing to order). */
export const MIN_WRAP_ITEMS = 3;

// ── Difficulty by level (plan §5): offsets from the freshness stage, the last tier is full operation ─────

export type CheckTier = {
  /** From this restaurant level. */
  from: number;
  /** The most cards a night shows. */
  maxCards: number;
  /** 2 = Keep / Bin; 3 = Keep / Bin / Use first. */
  piles: 2 | 3;
  /** The cues printed on the card. */
  cues: { icon: boolean; days: boolean };
  /** Clock multiplier (the player is learning in the first tiers). */
  timeFactor: number;
  /** The most items on the wrap shelf. */
  maxWrap: number;
  /** Whether the wrap stage has a clock. */
  wrapClock: boolean;
};

const fresh = () => restaurantSystem("fridge-freshness").firstLevel;
const full = () => restaurantSystem("full-operation").firstLevel;

/** The five tiers (built on demand so they follow `restaurantProgression`). */
export function checkTiers(): readonly CheckTier[] {
  const f = fresh();
  return [
    {
      from: f,
      maxCards: 6,
      piles: 2,
      cues: { icon: true, days: true },
      timeFactor: 2.0,
      maxWrap: 4,
      wrapClock: false,
    },
    {
      from: f + 10,
      maxCards: 8,
      piles: 3,
      cues: { icon: true, days: true },
      timeFactor: 1.6,
      maxWrap: 5,
      wrapClock: false,
    },
    {
      from: f + 20,
      maxCards: 10,
      piles: 3,
      cues: { icon: false, days: true },
      timeFactor: 1.3,
      maxWrap: 6,
      wrapClock: true,
    },
    {
      from: f + 30,
      maxCards: 12,
      piles: 3,
      cues: { icon: false, days: false },
      timeFactor: 1.1,
      maxWrap: 7,
      wrapClock: true,
    },
    {
      from: Math.max(f + 31, full()),
      maxCards: 12,
      piles: 3,
      cues: { icon: false, days: false },
      timeFactor: 1.0,
      maxWrap: 8,
      wrapClock: true,
    },
  ];
}

export function checkTierAt(level: number): CheckTier {
  const tiers = checkTiers();
  let t = tiers[0]!;
  for (const x of tiers) if (level >= x.from) t = x;
  return t;
}

/** 1..5, for analytics and the how-to card. */
export const tierNumberAt = (level: number): number =>
  checkTiers().filter((t) => level >= t.from).length || 1;

// ── State ────────────────────────────────────────────────────────────────────

export type FridgeCheckState = {
  /** Best sort score and best wrap score. */
  best?: number;
  bestWrap?: number;
  /** Stars won in all rewarded stages. */
  stars?: number;
  /** Rewarded stages finished with three stars (every 3 earn a freshness pin). */
  perfect?: number;
  /** Rewarded stages finished. */
  rounds?: number;
  /** Perfect sort nights in a row, and the night the last one was. */
  streak?: number;
  streakDay?: number;
  /** The last business day each stage paid Hype (once a night per stage). */
  hypeSortDay?: number;
  hypeWrapDay?: number;
  /** Which how-to tours the player has seen (bit 1 = Sort, bit 2 = Wrap): shown once, then only from the "?" button. */
  howto?: number;
};

export const MAX_PINS = 12;
export const PERFECTS_PER_PIN = 3;
const whole = (v: unknown, max = Number.MAX_SAFE_INTEGER) =>
  Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

/** The saved state (absent on older saves = nothing earned); bad numbers are dropped. */
export function fridgeCheckOf(save: SaveData): FridgeCheckState {
  const raw = save.business.fridgeCheck;
  return {
    best: whole(raw?.best),
    bestWrap: whole(raw?.bestWrap),
    stars: whole(raw?.stars),
    perfect: whole(raw?.perfect),
    rounds: whole(raw?.rounds),
    streak: whole(raw?.streak, 999),
    streakDay: whole(raw?.streakDay),
    hypeSortDay: whole(raw?.hypeSortDay),
    hypeWrapDay: whole(raw?.hypeWrapDay),
    howto: whole(raw?.howto, 3),
  };
}

const HOWTO_BIT: Record<CheckStage, number> = { sort: 1, wrap: 2 };

/** The how-to tour of this stage has been seen (it shows by itself once, to every player, whatever they played before). */
export const howtoSeen = (save: SaveData, stage: CheckStage): boolean =>
  (fridgeCheckOf(save).howto! & HOWTO_BIT[stage]) !== 0;

/** Remembers that the tour was seen (the same save back when it already was). Never touches money or stock. */
export function withHowtoSeen(save: SaveData, stage: CheckStage): SaveData {
  if (howtoSeen(save, stage)) return save;
  const state = fridgeCheckOf(save);
  return withState(save, {
    ...(save.business.fridgeCheck ?? {}),
    ...state,
    howto: state.howto! | HOWTO_BIT[stage],
  });
}

/** How many freshness pins the player has earned (shown beside the fridge magnets): purely a trophy. */
export const pinsOf = (save: SaveData): number =>
  Math.min(MAX_PINS, Math.floor(fridgeCheckOf(save).perfect! / PERFECTS_PER_PIN));

function withState(save: SaveData, state: FridgeCheckState): SaveData {
  return { ...save, business: { ...save.business, fridgeCheck: state } };
}

// ── The cards ────────────────────────────────────────────────────────────────

export type Verdict = "keep" | "use-first" | "bin";

export type CheckCard = {
  id: IngredientId;
  name: string;
  /** The real stock, whole entry. */
  quantity: number;
  /** Whole days since it was bought, as of tonight. */
  age: number;
  /** The shelf life of its category, in days. */
  shelfLife: number;
  /** The freshness tomorrow (what closing sees). */
  state: PerishabilityState;
  verdict: Verdict;
  /** The sort key for wrapping: the day it expires (earlier = use first). */
  expires: number;
  /** Whole days it still lasts, counting tomorrow (0 = closing throws it out tonight). */
  daysLeft: number;
  category: string;
};

/** Deterministic random numbers (a small seeded generator): the same night always gives the same deck. */
function rng(seed: number): () => number {
  let s = (Math.imul(seed >>> 0, 2654435761) ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function shuffled<T>(items: readonly T[], rnd: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Tomorrow's business day: the day closing judges freshness by (the same one `closingPreview` reads). */
export const tomorrowOf = (save: SaveData): number =>
  advanceBusinessDay(save.business.calendar).businessDay;

/** The right answer for a stock line, by the tier's piles (tier 1 has no "Use first": near-expiry food is kept). */
export function verdictOf(state: PerishabilityState, piles: 2 | 3): Verdict {
  if (state === "EXPIRED") return "bin";
  if (state === "NEAR_EXPIRY" && piles === 3) return "use-first";
  return "keep";
}

/** Every stock line as a card, judged for tomorrow (unordered; the real stock). */
export function allCards(save: SaveData, level: number): CheckCard[] {
  const tier = checkTierAt(level);
  const today = save.business.calendar.businessDay;
  const tomorrow = tomorrowOf(save);
  const out: CheckCard[] = [];
  for (const entry of Object.values(save.business.inventory)) {
    if (!entry || !(entry.quantity > 0)) continue;
    const id = entry.ingredientId;
    const def = INGREDIENTS[id];
    if (!def) continue;
    const shelfLife = shelfLifeForIngredient(id);
    const state = perishabilityStateFor(id, entry.purchaseDay, tomorrow);
    const expires = entry.purchaseDay + shelfLife;
    out.push({
      id,
      name: def.name,
      quantity: entry.quantity,
      age: Math.floor(ageInDays(entry.purchaseDay, today)),
      shelfLife,
      state,
      verdict: verdictOf(state, tier.piles),
      expires,
      daysLeft: Math.max(0, Math.ceil(expires - tomorrow)),
      category: def.category,
    });
  }
  // A stable base order (by id), so the seeded shuffle is the only thing that varies.
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The seed of a night's deck: the business day and the level (never `Math.random`). */
const seedOf = (save: SaveData, level: number, stage: CheckStage): number =>
  save.business.calendar.businessDay * 7919 + level * 104729 + (stage === "wrap" ? 13 : 1);

/**
 * The night's SORT deck: up to the tier's card count; every card that needs a verdict other than Keep comes first (a night never hides the
 * spoiled ones), the rest are company; then the whole deck is shuffled by the day's seed.
 */
export function checkCards(save: SaveData, level: number): CheckCard[] {
  const tier = checkTierAt(level);
  const rnd = rng(seedOf(save, level, "sort"));
  const all = allCards(save, level);
  const tricky = shuffled(
    all.filter((c) => c.verdict !== "keep"),
    rnd,
  );
  const calm = shuffled(
    all.filter((c) => c.verdict === "keep"),
    rnd,
  );
  return shuffled([...tricky, ...calm].slice(0, tier.maxCards), rnd);
}

/** Whether the sort game has something to judge tonight (freshness live, enough cards, at least one Bin / Use first). */
export function isSortOpen(save: SaveData, level: number): boolean {
  if (!FRIDGE_CHECK_TEST_UNLOCK && !isSystemLive("fridge-freshness", level)) return false;
  const cards = allCards(save, level);
  return cards.length >= MIN_CARDS && cards.some((c) => c.verdict !== "keep");
}

/** Free practice from the Inventory fridge (no chore, no reward): freshness is live and there are enough cards for a deck. */
export function isPracticeOpen(save: SaveData, level: number): boolean {
  if (!FRIDGE_CHECK_TEST_UNLOCK && !isSystemLive("fridge-freshness", level)) return false;
  return allCards(save, level).length >= MIN_CARDS;
}

/** The food that stays in the fridge tonight (not binned), in a seeded order, up to the tier's wrap count. */
export function wrapItems(save: SaveData, level: number): CheckCard[] {
  const tier = checkTierAt(level);
  const rnd = rng(seedOf(save, level, "wrap"));
  const stays = allCards(save, level).filter((c) => c.state !== "EXPIRED");
  return shuffled(stays, rnd).slice(0, tier.maxWrap);
}

/** Whether the wrap game has something to order (enough items with at least two different use-by days). */
export function isWrapOpen(save: SaveData, level: number): boolean {
  if (!FRIDGE_CHECK_TEST_UNLOCK && !isSystemLive("fridge-freshness", level)) return false;
  const items = wrapItems(save, level);
  return (
    items.length >= MIN_WRAP_ITEMS && new Set(items.map((c) => Math.ceil(c.expires))).size >= 2
  );
}

/** Whether the game replaces the one tap for `task` tonight (the ONE branch `useCleaningGame` asks). */
export function isFridgeCheckOpen(save: SaveData, level: number, task: string): boolean {
  const stage = stageOfTask(task);
  if (stage === "sort") return isSortOpen(save, level);
  if (stage === "wrap") return isWrapOpen(save, level);
  return false;
}

// ── Wrapping order ───────────────────────────────────────────────────────────

/** True when `pick` may go next: no remaining item expires earlier (ties are any order). */
export function isNextToWrap(remaining: readonly CheckCard[], pick: CheckCard): boolean {
  const day = (c: CheckCard) => Math.ceil(c.expires);
  return remaining.every((c) => day(c) >= day(pick));
}

/** The sticker's words: how long the food still lasts, counting tomorrow. */
export const stickerText = (card: CheckCard): string =>
  card.daysLeft <= 0 ? "Today" : card.daysLeft === 1 ? "1 day left" : `${card.daysLeft} days left`;

// ── Why (the line shown after every card) ────────────────────────────────────

/** One short line: the shelf life, the age and what happens tonight. */
export function reasonOf(card: CheckCard, tier: CheckTier): string {
  const life = `${card.shelfLife}-day shelf life`;
  const bought =
    card.age === 0
      ? "bought today"
      : card.age === 1
        ? "bought 1 day ago"
        : `bought ${card.age} days ago`;
  const verdict =
    card.verdict === "bin"
      ? "spoils tonight"
      : card.verdict === "use-first"
        ? "use it first"
        : card.state === "NEAR_EXPIRY"
          ? "still fine, use it soon"
          : "still fresh";
  void tier;
  return `${card.name}: ${life}, ${bought}: ${verdict}`;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

/** Seconds of the sort clock: 8 s plus 2.2 s a card, times the tier factor (never under 20 s). */
export const sortTimeMs = (cards: number, level: number): number =>
  Math.max(20, Math.round((8 + 2.2 * cards) * checkTierAt(level).timeFactor)) * 1000;

/** Seconds of the wrap clock: 8 s plus 2.5 s an item, times the tier factor (never under 15 s). */
export const wrapTimeMs = (items: number, level: number): number =>
  Math.max(15, Math.round((8 + 2.5 * items) * checkTierAt(level).timeFactor)) * 1000;

export const ACCURACY_STARS: readonly [number, number] = [0.6, 0.85];
export const WRAP_STARS: readonly [number, number] = [0.5, 0.75];

/**
 * Stars for the sort stage. `wrong` = cards answered wrong, `spoiledKept` = how many of those were spoiled food kept or put first (the costly
 * mistake in a real kitchen: it counts twice). 3 stars need every card right with the clock not run out.
 */
export function sortStars(
  total: number,
  wrong: number,
  spoiledKept: number,
  timedOut: boolean,
): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  if (wrong === 0 && !timedOut) return 3;
  const accuracy = Math.max(0, 1 - (wrong + spoiledKept) / total);
  return accuracy >= ACCURACY_STARS[1] ? 2 : accuracy >= ACCURACY_STARS[0] ? 1 : 0;
}

/** Stars for the wrap stage: the share of items wrapped right at the first tap. */
export function wrapStars(total: number, firstTry: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const f = firstTry / total;
  return f >= 1 ? 3 : f >= WRAP_STARS[1] ? 2 : f >= WRAP_STARS[0] ? 1 : 0;
}

/** Points so far: 100 a right card with the combo (`rights` in a row), and 20 a second left when the whole deck was answered. */
export function scoreCheck(
  rightStreaks: readonly number[],
  finished: boolean,
  msLeft: number,
): number {
  let score = rightStreaks.reduce((n, s) => n + pointsFor(s), 0);
  if (finished) score += TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, msLeft) / 1000);
  return score;
}

export { POINTS_PER_SET };

// ── Finishing a stage ────────────────────────────────────────────────────────

export type CheckOutcome = {
  stage: CheckStage;
  stars: 0 | 1 | 2 | 3;
  score: number;
  right: number;
  total: number;
  /** A free-play round scores and shows stars but gives nothing and keeps nothing. */
  practice?: boolean;
};

export type CheckEffects = {
  hype: number;
  pin: boolean;
  newBest: boolean;
  /** Perfect sort nights in a row after this one (0 = none). */
  streak: number;
};

/**
 * Applies a finished stage: the best score, stars and perfect count are kept, Hype is added (once a night per stage) and the streak of
 * perfect sort nights moves. NEVER touches credits, inventory or the ledger; the chore is completed separately by `cleanTask`.
 */
export function finishCheck(
  save: SaveData,
  o: CheckOutcome,
): { save: SaveData; effects: CheckEffects } {
  const none: CheckEffects = { hype: 0, pin: false, newBest: false, streak: 0 };
  if (o.practice) return { save, effects: none };
  const state = fridgeCheckOf(save);
  const day = save.business.calendar.businessDay;
  const perfect = state.perfect! + (o.stars === 3 ? 1 : 0);
  const pin = Math.min(MAX_PINS, Math.floor(perfect / PERFECTS_PER_PIN)) > pinsOf(save);
  const next: FridgeCheckState = {
    ...state,
    stars: state.stars! + o.stars,
    perfect,
    rounds: state.rounds! + 1,
  };
  let newBest = false;
  if (o.stage === "sort") {
    newBest = o.score > state.best!;
    if (newBest) next.best = o.score;
  } else {
    newBest = o.score > state.bestWrap!;
    if (newBest) next.bestWrap = o.score;
  }
  let streak = 0;
  if (o.stage === "sort") {
    streak = o.stars === 3 ? (state.streakDay === day - 1 ? state.streak! + 1 : 1) : 0;
    next.streak = streak;
    next.streakDay = o.stars === 3 ? day : state.streakDay!;
  }
  const paidDay = o.stage === "sort" ? state.hypeSortDay! : state.hypeWrapDay!;
  const hype = paidDay === day ? 0 : HYPE_BY_STARS[o.stars];
  if (hype > 0 || o.stars > 0) {
    if (o.stage === "sort") next.hypeSortDay = day;
    else next.hypeWrapDay = day;
  }
  let out = withState(save, next);
  if (hype > 0) out = addHype(out, hype);
  return { save: out, effects: { hype, pin, newBest, streak } };
}

// ── What the screen asks of the app ──────────────────────────────────────────

/** Analytics-only events the screen sends (the finish goes through the cleanliness action "check"). */
export type FridgeCheckEvent =
  | { kind: "start"; stage: CheckStage; cards: number; tier: number }
  | { kind: "skip"; stage: CheckStage };
