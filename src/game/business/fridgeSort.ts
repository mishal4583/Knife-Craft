/**
 * FRIDGE SORT — the rules of the "Put it away" mini-game (developer 2026-11-03; plan: docs/planning/FRIDGE-SORT-MINIGAME-PLAN-2026-11-03.md).
 *
 * After the player buys food, a crate of what arrived waits. The player sorts each ingredient into the fridge's own zones (the Inventory
 * fridge's `FRIDGE_ZONES` / `fridgeZoneFor`) before a short timer ends. Pure rules: no I/O, no randomness except the seeded order, and
 * NEVER any money: the game reads which ingredients arrived and adds no stock, no ledger entry and no credits. Its only effects are the
 * stars, a Hype top-up (the Second Floor's Rush meter, `addHype`) and the fridge magnets. It is always optional.
 *
 * State lives in `business.fridgeSort` (optional; absent = nothing waiting), read through `fridgeSortOf` which drops bad values.
 *
 * The Vegetables shelf holds 25 of the 57 ingredients (9 of the 14 a player owns at Level 14), so a plain sort would be "drop everything
 * on Vegetables". The game splits it into four game-only BINS (decision D1 of the plan); the fridge screen and `fridgeZoneFor` do not change.
 */
import type { SaveData } from "../SaveManager";
import { INGREDIENTS, type IngredientId } from "../definitions";
import { RESTAURANT_SYSTEMS } from "../restaurant/restaurantProgression";
import { addHype } from "../restaurant/secondFloor";
import { FRIDGE_ZONES, fridgeView, fridgeZoneFor, type FridgeZoneId } from "./fridgeView";

// ── When it opens ────────────────────────────────────────────────────────────

/** The first level of the "Fridge & Freshness" stage (Level 14): food starts to spoil, so there is something to put away. */
export const FRIDGE_SORT_FIRST_LEVEL: number = RESTAURANT_SYSTEMS.find(
  (s) => s.id === "fridge-freshness",
)!.firstLevel;

/** Dev test: `?fridgeSort` in the address shows the game below its level (the same pattern as `?floor2`). */
export const FRIDGE_SORT_TEST_UNLOCK: boolean =
  typeof location !== "undefined" && /[?&]fridgeSort\b/.test(location.search);

export const isFridgeSortOpen = (reachedLevel: number): boolean =>
  FRIDGE_SORT_TEST_UNLOCK || reachedLevel >= FRIDGE_SORT_FIRST_LEVEL;

// ── Targets: the fridge's zones, with the Vegetables shelf split into bins ───

export type VegBin = "roots" | "salad" | "stems" | "pods";
export type TargetId = Exclude<FridgeZoneId, "vegetables"> | `veg-${VegBin}`;

export const VEG_BINS: Readonly<
  Record<VegBin, { label: string; icon: string; ids: readonly IngredientId[] }>
> = {
  roots: {
    label: "Roots & bulbs",
    icon: "🥔",
    ids: ["potato", "onion", "carrot", "turnip", "beetroot", "radish", "sweetpotato", "pumpkin"],
  },
  salad: {
    label: "Salad & fruiting",
    icon: "🍅",
    ids: ["tomato", "cucumber", "pepper", "zucchini", "eggplant", "corn"],
  },
  stems: {
    label: "Cabbages & stems",
    icon: "🥦",
    ids: [
      "broccoli",
      "cauliflower",
      "cabbage",
      "celery",
      "asparagus",
      "fennel",
      "artichoke",
      "springonion",
    ],
  },
  pods: { label: "Pods & fungi", icon: "🍄", ids: ["greenbean", "peapod", "mushroom"] },
};

/** Every target, top to bottom as they sit in the fridge (the order the screen draws them). */
export const TARGETS: ReadonlyArray<{ id: TargetId; label: string; icon: string }> = [
  ...FRIDGE_ZONES.filter((z) => z.id === "dairy").map((z) => ({
    id: z.id as TargetId,
    label: z.label,
    icon: z.icon,
  })),
  ...(Object.keys(VEG_BINS) as VegBin[]).map((b) => ({
    id: `veg-${b}` as TargetId,
    label: VEG_BINS[b].label,
    icon: VEG_BINS[b].icon,
  })),
  ...FRIDGE_ZONES.filter((z) => z.id !== "dairy" && z.id !== "vegetables").map((z) => ({
    id: z.id as TargetId,
    label: z.label,
    icon: z.icon,
  })),
];

const BIN_OF: ReadonlyMap<string, VegBin> = new Map(
  (Object.keys(VEG_BINS) as VegBin[]).flatMap((b) => VEG_BINS[b].ids.map((id) => [id, b] as const)),
);

/** Where an ingredient goes: its fridge zone, and for a vegetable its bin. */
export function targetOf(id: IngredientId): TargetId {
  const zone = fridgeZoneFor(id);
  if (zone !== "vegetables") return zone;
  // A vegetable the bins do not list (a new one added later) goes to the largest bin, never out of the game.
  return `veg-${BIN_OF.get(id) ?? "salad"}`;
}

// ── Difficulty by level ──────────────────────────────────────────────────────

export type Difficulty = {
  /** From this level. */
  from: number;
  /** The most tokens one crate holds (a longer shopping list queues as the next crate). */
  maxTokens: number;
  /** At least this many targets are on screen (the crate's own targets always are; the rest are decoys in fridge order). */
  minTargets: number;
  /** The right shelf glows when a token is lifted. */
  hint: "always" | "after-miss" | "never";
  /** Time multiplier (the player is learning in the first stage). */
  timeFactor: number;
  /** An ⏳ token (it expires tomorrow) is worth double. */
  expiryBonus: boolean;
};

export const DIFFICULTY: readonly Difficulty[] = [
  { from: 14, maxTokens: 6, minTargets: 5, hint: "always", timeFactor: 1.3, expiryBonus: false },
  { from: 27, maxTokens: 8, minTargets: 6, hint: "after-miss", timeFactor: 1, expiryBonus: false },
  { from: 44, maxTokens: 10, minTargets: 8, hint: "never", timeFactor: 1, expiryBonus: false },
  { from: 74, maxTokens: 12, minTargets: 10, hint: "never", timeFactor: 1, expiryBonus: true },
];

export function difficultyAt(level: number): Difficulty {
  let d = DIFFICULTY[0]!;
  for (const x of DIFFICULTY) if (level >= x.from) d = x;
  return d;
}

// ── State ────────────────────────────────────────────────────────────────────

export type FridgeTier = "basic" | "commercial" | "professional";

export type FridgeSortState = {
  /** The ingredients waiting to be put away (one entry per different ingredient; the order they were bought). */
  crate?: IngredientId[];
  /** Raises each time a new crate starts: the seed of its token order. */
  seed?: number;
  /** The best score per fridge tier. */
  best?: Partial<Record<FridgeTier, number>>;
  /** Stars won in all rewarded rounds. */
  stars?: number;
  /** Rewarded rounds finished with three stars (every 3 earn a magnet). */
  perfect?: number;
  /** Rewarded rounds finished. */
  rounds?: number;
};

export const MAX_CRATE_QUEUE = 24;
export const MAX_MAGNETS = 12;
export const PERFECTS_PER_MAGNET = 3;
const KNOWN = new Set<string>(Object.keys(INGREDIENTS));
const whole = (v: unknown, max = Number.MAX_SAFE_INTEGER) =>
  Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

/** The saved state (absent on older saves = nothing waiting); unknown ingredients, duplicates and bad numbers are dropped. */
export function fridgeSortOf(save: SaveData): FridgeSortState {
  const raw = save.business.fridgeSort;
  const seen = new Set<string>();
  const crate: IngredientId[] = [];
  for (const id of Array.isArray(raw?.crate) ? raw.crate : []) {
    if (typeof id !== "string" || !KNOWN.has(id) || seen.has(id)) continue;
    seen.add(id);
    crate.push(id as IngredientId);
    if (crate.length >= MAX_CRATE_QUEUE) break;
  }
  const best: Partial<Record<FridgeTier, number>> = {};
  for (const t of ["basic", "commercial", "professional"] as const) {
    const v = whole(raw?.best?.[t]);
    if (v > 0) best[t] = v;
  }
  return {
    ...(crate.length > 0 ? { crate } : {}),
    seed: whole(raw?.seed),
    best,
    stars: whole(raw?.stars),
    perfect: whole(raw?.perfect),
    rounds: whole(raw?.rounds),
  };
}

function withState(save: SaveData, state: FridgeSortState): SaveData {
  return { ...save, business: { ...save.business, fridgeSort: state } };
}

/** The fridge tier the player owns (an unknown or missing id reads as Basic). */
export function fridgeTierOf(save: SaveData): FridgeTier {
  const id = save.business.refrigerator?.refrigeratorId ?? "";
  return id.startsWith("professional")
    ? "professional"
    : id.startsWith("commercial")
      ? "commercial"
      : "basic";
}

/** How many fridge magnets the player has earned (shown on the fridge door). */
export const magnetsOf = (save: SaveData): number =>
  Math.min(MAX_MAGNETS, Math.floor(fridgeSortOf(save).perfect! / PERFECTS_PER_MAGNET));

// ── The crate ────────────────────────────────────────────────────────────────

/**
 * Puts what was just bought on the crate (the ONE place that fills it is the ingredient purchase commit and the morning delivery).
 * Only from the game's level; ingredients already waiting are not added twice; nothing is lost if more than a crate waits.
 */
export function addToCrate(
  save: SaveData,
  bought: readonly string[],
  reachedLevel: number,
): SaveData {
  if (!isFridgeSortOpen(reachedLevel)) return save;
  const state = fridgeSortOf(save);
  const crate = [...(state.crate ?? [])];
  const had = crate.length;
  for (const id of bought) {
    if (!KNOWN.has(id) || crate.includes(id as IngredientId) || crate.length >= MAX_CRATE_QUEUE)
      continue;
    crate.push(id as IngredientId);
  }
  if (crate.length === had) return save;
  // A new crate (the old one was empty) gets a new seed, so its token order is new and never repeats by accident.
  return withState(save, { ...state, crate, seed: had === 0 ? state.seed! + 1 : state.seed! });
}

/** Deterministic shuffle (a small seeded generator): the same crate and seed always give the same order. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  let s = (Math.imul(seed >>> 0, 2654435761) ^ 0x9e3779b9) >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export type Round = {
  /** The tokens of this round, in the order they lie in the crate. */
  tokens: IngredientId[];
  /** How many more are waiting for the next round. */
  queued: number;
  /** The targets drawn on the screen, top to bottom. */
  targets: TargetId[];
  timeMs: number;
  difficulty: Difficulty;
};

/** Targets shown: every one the tokens need, plus decoys (in fridge order) up to the level's minimum. */
export function targetsFor(tokens: readonly IngredientId[], level: number): TargetId[] {
  const need = new Set(tokens.map(targetOf));
  const min = difficultyAt(level).minTargets;
  const ordered = TARGETS.map((t) => t.id);
  const shown = new Set(need);
  for (const id of ordered) {
    if (shown.size >= min) break;
    shown.add(id);
  }
  return ordered.filter((id) => shown.has(id));
}

export const timeLimitMs = (tokens: number, level: number): number =>
  Math.round((20 + 2.5 * tokens) * difficultyAt(level).timeFactor) * 1000;

/** The round the crate offers now, or null when nothing waits or the game is not open yet. */
export function roundFor(save: SaveData, reachedLevel: number): Round | null {
  if (!isFridgeSortOpen(reachedLevel)) return null;
  const state = fridgeSortOf(save);
  const crate = state.crate ?? [];
  if (crate.length === 0) return null;
  const d = difficultyAt(reachedLevel);
  const tokens = shuffled(crate.slice(0, d.maxTokens), state.seed!);
  return {
    tokens,
    queued: Math.max(0, crate.length - tokens.length),
    targets: targetsFor(tokens, reachedLevel),
    timeMs: timeLimitMs(tokens.length, reachedLevel),
    difficulty: d,
  };
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export const POINTS_PER_TOKEN = 100;
export const COMBO_STEP = 0.25;
export const COMBO_MAX = 3;
export const TIME_BONUS_PER_SECOND = 20;
/** The pace the "best possible score" assumes: a perfect, fast player sorts one token a second. */
export const REFERENCE_MS_PER_TOKEN = 1000;
/**
 * Score (as a share of the best possible) for one, two and three stars. Tuned with simulated players (fridge-sort-qa H): three stars
 * = no mistakes at about two seconds a token or faster; one mistake or a slower pace = two; finishing slowly = one.
 */
export const STAR_AT: readonly [number, number, number] = [0.5, 0.75, 0.92];

export const comboMultiplier = (streak: number): number =>
  Math.min(COMBO_MAX, 1 + COMBO_STEP * streak);

/** One placement's points; `streak` = how many were right in a row just before it; an expiring token (⏳) counts double. */
export const pointsFor = (streak: number, doubled = false): number =>
  Math.round(POINTS_PER_TOKEN * comboMultiplier(streak)) * (doubled ? 2 : 1);

export type RoundResult = {
  /** One entry per drop, in order: true = the right target. */
  drops: readonly boolean[];
  /** Tokens placed right (the round has `tokens` of them). */
  tokens: number;
  /** Milliseconds left on the clock when the round ended (0 when time ran out). */
  msLeft: number;
};

export function scoreRound(r: RoundResult, doubledRight: ReadonlySet<number> = new Set()): number {
  let streak = 0;
  let right = 0;
  let score = 0;
  for (const ok of r.drops) {
    if (ok) {
      score += pointsFor(streak, doubledRight.has(right));
      streak += 1;
      right += 1;
    } else streak = 0;
  }
  if (right >= r.tokens) score += TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, r.msLeft) / 1000);
  return score;
}

/**
 * The score of a flawless round at the reference pace (what the stars are measured against). `doubles` = how many ⏳ tokens the crate has:
 * the best round counts them at the end of the streak (where a token is worth most), so a crate with expiring food is not easier to ace.
 */
export function bestPossible(tokens: number, level: number, doubles = 0): number {
  const left = Math.max(0, timeLimitMs(tokens, level) - REFERENCE_MS_PER_TOKEN * tokens);
  const n = Math.min(Math.max(0, Math.floor(doubles)), tokens);
  const doubled = new Set(Array.from({ length: n }, (_, i) => tokens - 1 - i));
  return scoreRound(
    { drops: Array.from({ length: tokens }, () => true), tokens, msLeft: left },
    doubled,
  );
}

export function starsFor(score: number, tokens: number, level: number, doubles = 0): 0 | 1 | 2 | 3 {
  const share = score / Math.max(1, bestPossible(tokens, level, doubles));
  return share >= STAR_AT[2] ? 3 : share >= STAR_AT[1] ? 2 : share >= STAR_AT[0] ? 1 : 0;
}

// ── Expiring food (Level 74 and up) ──────────────────────────────────────────

/** At most this many ⏳ tokens a crate shows, so the stars stay fair. */
export const MAX_EXPIRING_TOKENS = 2;

/**
 * The ⏳ tokens of a round: the crate's ingredients whose stock in the fridge spoils tonight or soon, the soonest first, at most
 * MAX_EXPIRING_TOKENS. Empty below the level that turns the bonus on. Read-only: it never touches the stock.
 */
export function expiringTokens(
  save: SaveData,
  tokens: readonly IngredientId[],
  reachedLevel: number,
): Set<IngredientId> {
  if (!difficultyAt(reachedLevel).expiryBonus) return new Set();
  const inCrate = new Set<IngredientId>(tokens);
  const soon: { id: IngredientId; daysLeft: number }[] = [];
  for (const z of fridgeView(save).zones)
    for (const item of z.items)
      if (
        inCrate.has(item.id) &&
        (item.attention === "spoils-tonight" || item.attention === "expiring")
      )
        soon.push({ id: item.id, daysLeft: item.daysLeft });
  soon.sort((a, b) => a.daysLeft - b.daysLeft || (a.id < b.id ? -1 : 1));
  return new Set(soon.slice(0, MAX_EXPIRING_TOKENS).map((x) => x.id));
}

/** A ⏳ token counts double only while more than a third of the clock is left. */
export const expiryDoubleActive = (msLeft: number, timeMs: number): boolean => msLeft > timeMs / 3;

// ── Finishing a round ────────────────────────────────────────────────────────

/** Hype for 0, 1, 2 and 3 stars (once per crate). */
export const HYPE_BY_STARS: readonly [number, number, number, number] = [0, 5, 10, 15];

export type RoundOutcome = {
  stars: 0 | 1 | 2 | 3;
  score: number;
  /** The ingredients of the round (the whole shown crate is put away when the round ends, placed or not). */
  tokens: readonly IngredientId[];
  /** "Again" rounds score and show stars but give nothing and keep nothing. */
  practice?: boolean;
};

export type RoundEffects = { hype: number; magnet: boolean; newBest: boolean };

/**
 * Applies a finished round: the shown tokens leave the crate, the best score, stars and perfect count are kept, and Hype is added.
 * A practice round changes nothing. NEVER touches credits, inventory or the ledger.
 */
export function finishRound(
  save: SaveData,
  o: RoundOutcome,
): { save: SaveData; effects: RoundEffects } {
  if (o.practice) return { save, effects: { hype: 0, magnet: false, newBest: false } };
  const state = fridgeSortOf(save);
  const left = (state.crate ?? []).filter((id) => !o.tokens.includes(id));
  const tier = fridgeTierOf(save);
  const best = state.best ?? {};
  const newBest = o.score > (best[tier] ?? 0);
  const perfect = state.perfect! + (o.stars === 3 ? 1 : 0);
  const magnet =
    Math.min(MAX_MAGNETS, Math.floor(perfect / PERFECTS_PER_MAGNET)) >
    Math.min(MAX_MAGNETS, Math.floor(state.perfect! / PERFECTS_PER_MAGNET));
  const next: FridgeSortState = {
    ...state,
    ...(left.length > 0 ? { crate: left } : {}),
    best: newBest ? { ...best, [tier]: o.score } : best,
    stars: state.stars! + o.stars,
    perfect,
    rounds: state.rounds! + 1,
  };
  if (left.length === 0) delete next.crate;
  const hype = HYPE_BY_STARS[o.stars];
  let out = withState(save, next);
  if (hype > 0) out = addHype(out, hype);
  return { save: out, effects: { hype, magnet, newBest } };
}

/** The Prep Cook puts the crate away on its own: no stars, no reward, no Hype. */
export function autoPutAway(save: SaveData): SaveData {
  const state = fridgeSortOf(save);
  if (!state.crate || state.crate.length === 0) return save;
  const next = { ...state };
  delete next.crate;
  return withState(save, next);
}

// ── What the screen asks of the app ──────────────────────────────────────────

/** The one action the game screen sends: a round ended (the app applies it to the LATEST save). */
export type FridgeSortAction =
  | { kind: "finish"; outcome: RoundOutcome }
  | { kind: "auto" }
  /** Only for analytics: a round began (the clock started) / the player left a crate without sorting it. */
  | { kind: "start"; tokens: number; targets: number; practice: boolean }
  | { kind: "skip" };

export type FridgeSortResult = { ok: true; effects: RoundEffects } | { ok: false };
