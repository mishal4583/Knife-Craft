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
import { rampOf } from "./difficultyRamp";
import type { SaveData } from "../SaveManager";
import { INGREDIENTS, type IngredientId } from "../definitions";
import { addHype } from "../restaurant/secondFloor";
import { FRIDGE_ZONES, fridgeView, fridgeZoneFor, type FridgeZoneId } from "./fridgeView";
import { itemCount } from "./measure";

// ── When it opens ────────────────────────────────────────────────────────────

/**
 * The level the game opens (Level 3, developer 2026-11-05: it used to open at Level 14, which was too late). The Market opens at Level 1 and
 * the first service that uses bought food is Level 3 (firstRestock.ts), so the first baskets are small and the first levels teach the fridge.
 */
export const FRIDGE_SORT_FIRST_LEVEL = 4;
/**
 * Delivery Inspection opens at Level 3 and Fridge Sort one level later (developer 2026-11-11: "if the check is at Level 3, the sorting should be at
 * Level 4"): never two new games in one level. The crate itself (the delivery waiting to be checked and unpacked) exists from Level 3, so the first
 * check has real food to look over; the sorting game (`isFridgeSortOpen`, `roundFor`) opens at FRIDGE_SORT_FIRST_LEVEL.
 */
export const FRIDGE_SORT_CRATE_LEVEL = 3;
export const isCrateOpen = (reachedLevel: number): boolean =>
  FRIDGE_SORT_TEST_UNLOCK || reachedLevel >= FRIDGE_SORT_CRATE_LEVEL;

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

/**
 * Up to `count` ingredients that belong to a target, for the pictures on its shelf: the ones in `prefer` first (the basket's own), then the
 * target's usual members in the registry's order. The screen shows them faded on an empty shelf so a beginner can see what goes where.
 */
export function zoneExamples(
  target: TargetId,
  prefer: readonly IngredientId[] = [],
  count = 3,
): IngredientId[] {
  const out: IngredientId[] = [];
  for (const id of prefer) if (targetOf(id) === target && !out.includes(id)) out.push(id);
  for (const id of Object.keys(INGREDIENTS) as IngredientId[]) {
    if (out.length >= count) break;
    if (targetOf(id) === target && !out.includes(id)) out.push(id);
  }
  return out.slice(0, count);
}

// ── Difficulty by level ──────────────────────────────────────────────────────

export type Difficulty = {
  /** From this level. */
  from: number;
  /** The most PIECES one basket holds (a longer shopping list queues as the next basket). */
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

/**
 * More to sort (developer 2026-11-12, player reviews: "the mini-games are too easy, increase the count of ingredients"): the basket holds 12 pieces
 * at the first level (was 8) and 22 at the top (was 16), more shelves are on screen, and the clock is tighter. The restaurant now buys several times
 * more (restaurant/prepBatch.ts), so there is the food to fill them; a longer delivery still queues as the next basket.
 */
export const DIFFICULTY: readonly Difficulty[] = [
  { from: 3, maxTokens: 12, minTargets: 4, hint: "always", timeFactor: 1.5, expiryBonus: false },
  { from: 14, maxTokens: 15, minTargets: 6, hint: "always", timeFactor: 1.25, expiryBonus: false },
  {
    from: 27,
    maxTokens: 18,
    minTargets: 7,
    hint: "after-miss",
    timeFactor: 1.12,
    expiryBonus: false,
  },
  { from: 44, maxTokens: 20, minTargets: 9, hint: "never", timeFactor: 1.08, expiryBonus: false },
  { from: 74, maxTokens: 22, minTargets: 10, hint: "never", timeFactor: 1.05, expiryBonus: true },
];

export function difficultyAt(level: number): Difficulty {
  let d = DIFFICULTY[0]!;
  for (const x of DIFFICULTY) if (level >= x.from) d = x;
  // The basket grows smoothly toward the next tier's size (difficultyRamp.ts); on a tier's first level it is exactly the tier's own.
  return {
    ...d,
    maxTokens: rampOf(DIFFICULTY, level, (t) => t.maxTokens),
    minTargets: rampOf(DIFFICULTY, level, (t) => t.minTargets),
  };
}

// ── State ────────────────────────────────────────────────────────────────────

export type FridgeTier = "basic" | "commercial" | "professional";

export type FridgeSortState = {
  /** The ingredients waiting to be put away (one entry per different ingredient; the order they were bought). */
  crate?: IngredientId[];
  /** How many loose pieces of each crate ingredient were bought (1 lb of tomato is about 3 tomatoes); absent = what one pound holds. */
  counts?: Partial<Record<IngredientId, number>>;
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
  /** Baskets of the CURRENT delivery already put away with at least one star (0 = none; a 0-star basket starts it over). */
  chain?: number;
};

export const MAX_CRATE_QUEUE = 24;
/**
 * The most baskets ONE waiting delivery makes (deep check 2026-11-12). Since the prep batch a two-day "Buy all" was 60-300 loose pieces: up to 15
 * baskets, each to be checked AND unpacked before the restaurant may open (about half an hour at Level 50). The baskets are full size (that is
 * the harder game the players asked for); what is over three of them the delivery driver carries to the fridge (the food itself is in the
 * fridge from the moment it is bought: the basket is only the game).
 */
export const MAX_BASKETS_WAITING = 3;
/** The most pieces of ONE ingredient that go in the basket at the start (a 10 lb sack of potatoes is not 30 pieces to sort); `piecesCapAt` raises it with the level. */
export const MAX_PIECES_PER_INGREDIENT = 5;
/** The cap by level (developer 2026-11-12: the restaurant buys a batch now, so one ingredient can be more pieces): 6 at the first level, 12 at Level 44. */
const PIECES_CAP_TIERS: readonly { from: number; cap: number }[] = [
  { from: 3, cap: 6 },
  { from: 14, cap: 8 },
  { from: 27, cap: 10 },
  { from: 44, cap: 12 },
];
export const MAX_PIECES_HARD = 12;
export const piecesCapAt = (level: number): number =>
  level < PIECES_CAP_TIERS[0]!.from
    ? MAX_PIECES_PER_INGREDIENT
    : rampOf(PIECES_CAP_TIERS, level, (t) => t.cap);
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
  const counts: Partial<Record<IngredientId, number>> = {};
  for (const id of crate) {
    const n = whole(raw?.counts?.[id], MAX_PIECES_HARD);
    if (n > 0) counts[id] = n;
  }
  return {
    ...(crate.length > 0 ? { crate } : {}),
    ...(Object.keys(counts).length > 0 ? { counts } : {}),
    seed: whole(raw?.seed),
    best,
    stars: whole(raw?.stars),
    perfect: whole(raw?.perfect),
    rounds: whole(raw?.rounds),
    ...(whole(raw?.chain, 50) > 0 ? { chain: whole(raw?.chain, 50) } : {}),
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

/** Pieces in the basket for `stock` of an ingredient (lb or pieces): 1 lb of tomato ≈ 3 tomatoes. At least 1, at most MAX_PIECES_PER_INGREDIENT. */
export const piecesFor = (
  id: IngredientId,
  stock: number,
  cap: number = MAX_PIECES_PER_INGREDIENT,
): number => Math.min(cap, Math.max(1, Math.round(itemCount(id, stock))));

/** The pieces of `id` waiting: what was bought, or what one pound holds when no amount was recorded (an old save). */
export const piecesOf = (state: FridgeSortState, id: IngredientId): number =>
  state.counts?.[id] ?? piecesFor(id, 1);

/** Every loose piece waiting in the crate (what the "Put it away" chip counts). */
export const piecesWaiting = (save: SaveData): number => {
  const state = fridgeSortOf(save);
  return (state.crate ?? []).reduce((n, id) => n + piecesOf(state, id), 0);
};

/**
 * Puts what was just bought in the basket (the ONE place that fills it is the ingredient purchase commit and the morning delivery).
 * `stock` = how much of each ingredient arrived (lb, or pieces): the basket holds that many loose pieces. Only from the game's level;
 * an ingredient already waiting gets more pieces (up to the cap); more than a basket waits as the next baskets, up to
 * MAX_BASKETS_WAITING of them (the driver carries the rest in).
 */
export function addToCrate(
  save: SaveData,
  bought: readonly string[],
  reachedLevel: number,
  stock?: Readonly<Record<string, number>>,
): SaveData {
  if (!isCrateOpen(reachedLevel)) return save;
  const state = fridgeSortOf(save);
  let crate = [...(state.crate ?? [])];
  const counts = { ...(state.counts ?? {}) };
  const had = crate.length;
  const before = crateKey(crate, counts);
  for (const raw of new Set(bought)) {
    if (!KNOWN.has(raw)) continue;
    const id = raw as IngredientId;
    const cap = piecesCapAt(reachedLevel);
    const add = piecesFor(id, stock?.[id] ?? 1, cap);
    if (crate.includes(id)) {
      counts[id] = Math.min(cap, (counts[id] ?? piecesFor(id, 1)) + add);
      continue;
    }
    if (crate.length >= MAX_CRATE_QUEUE) continue;
    crate.push(id);
    counts[id] = add;
  }
  crate = trimToBaskets(crate, counts, difficultyAt(reachedLevel).maxTokens);
  if (crateKey(crate, counts) === before) return save;
  // A new basket (the old one was empty) gets a new seed, so its order is new and never repeats by accident.
  return withState(save, {
    ...state,
    crate,
    counts,
    seed: had === 0 ? state.seed! + 1 : state.seed!,
  });
}

const crateKey = (
  crate: readonly IngredientId[],
  counts: Partial<Record<IngredientId, number>>,
): string => crate.map((id) => `${id}:${counts[id] ?? piecesFor(id, 1)}`).join();

/**
 * Keeps a waiting delivery within MAX_BASKETS_WAITING baskets of `max` pieces: the ingredient with the most pieces loses one at a time (so every
 * ingredient bought stays in the game); when every ingredient is down to one piece, the last one bought leaves. `counts` is changed in place;
 * the crate that fits is returned. Deterministic.
 */
function trimToBaskets(
  crate: IngredientId[],
  counts: Partial<Record<IngredientId, number>>,
  max: number,
): IngredientId[] {
  let rest = crate;
  for (const id of rest) counts[id] = counts[id] ?? piecesFor(id, 1);
  while (basketsOf({ counts }, rest, max) > MAX_BASKETS_WAITING) {
    let big = rest.length - 1;
    for (let i = rest.length - 1; i >= 0; i--) if (counts[rest[i]!]! > counts[rest[big]!]!) big = i;
    const id = rest[big]!;
    if (counts[id]! > 1) counts[id] = counts[id]! - 1;
    else {
      delete counts[id];
      rest = rest.filter((x) => x !== id);
    }
  }
  return rest;
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
  /** The pieces of this round (an ingredient appears once per piece), mixed, in the order they lie in the basket. */
  tokens: IngredientId[];
  /** The different ingredients in the basket. */
  ingredients: IngredientId[];
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
  Math.round((15 + 2.8 * tokens) * difficultyAt(level).timeFactor) * 1000;

/** One basket: whole ingredients, in the order bought, while their pieces fit; the first always goes in (cut to the basket's size). */
function packBasket(
  state: FridgeSortState,
  crate: readonly IngredientId[],
  max: number,
): { ingredients: IngredientId[]; pieces: IngredientId[] } {
  const ingredients: IngredientId[] = [];
  const pieces: IngredientId[] = [];
  for (const id of crate) {
    const n = piecesOf(state, id);
    if (ingredients.length > 0 && pieces.length + n > max) break;
    ingredients.push(id);
    for (let i = 0; i < Math.min(n, max); i++) pieces.push(id);
  }
  return { ingredients, pieces };
}

/** How many baskets the waiting crate makes at this level (0 = nothing waits, or the game is not open). */
export function basketsLeft(save: SaveData, reachedLevel: number): number {
  if (!isCrateOpen(reachedLevel)) return 0;
  const state = fridgeSortOf(save);
  return basketsOf(state, state.crate ?? [], difficultyAt(reachedLevel).maxTokens);
}

/** The baskets `crate` makes when each holds at most `max` pieces (the same packing the rounds use). */
function basketsOf(state: FridgeSortState, crate: readonly IngredientId[], max: number): number {
  let rest = [...crate];
  let n = 0;
  while (rest.length > 0) {
    const { ingredients } = packBasket(state, rest, max);
    rest = rest.slice(ingredients.length);
    n++;
  }
  return n;
}

/** About how many baskets `extraPieces` more loose pieces would add to what already waits (the Market plan's hint). */
export function basketsFor(save: SaveData, reachedLevel: number, extraPieces: number): number {
  if (!isFridgeSortOpen(reachedLevel)) return 0;
  const total = piecesWaiting(save) + Math.max(0, Math.floor(extraPieces));
  return Math.min(MAX_BASKETS_WAITING, Math.ceil(total / difficultyAt(reachedLevel).maxTokens));
}

/** The round the crate offers now, or null when nothing waits or the game is not open yet. */
export function roundFor(save: SaveData, reachedLevel: number): Round | null {
  if (!isFridgeSortOpen(reachedLevel)) return null;
  const state = fridgeSortOf(save);
  const crate = state.crate ?? [];
  if (crate.length === 0) return null;
  const d = difficultyAt(reachedLevel);
  const { ingredients, pieces } = packBasket(state, crate, d.maxTokens);
  const tokens = shuffled(pieces, state.seed!);
  return {
    tokens,
    ingredients,
    queued: Math.max(0, crate.length - ingredients.length),
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
export const STAR_AT: readonly [number, number, number] = [0.5, 0.74, 0.92];

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

/**
 * Extra days of freshness the food put away well keeps (developer 2026-11-05: "a real effect"): two stars +1 day, three stars +2. It moves
 * the stock's purchase day forward (the age clamps at 0, so a fresh item simply starts ageing later), never past 2 days ahead of today, and
 * never touches quantity, credits or the ledger. Only ingredients the player actually has in stock.
 */
export const FRESH_DAYS_BY_STARS: readonly [number, number, number, number] = [0, 0, 1, 2];
export const MAX_FRESH_DAYS_AHEAD = 2;

/**
 * A "big delivery" (developer 2026-11-05: buy for several days, sort it all): when the LAST basket of a delivery of two or more baskets
 * is put away and every basket earned a star, the Second Floor's Hype gets +10 for each basket after the first, at most +20.
 * It was +5 a basket (the +20 needed five baskets); a delivery is at most three baskets since 2026-11-12, so the full bonus is reached with
 * three (developer 2026-11-13, "do whatever is best for the game": the biggest delivery keeps its biggest reward).
 */
export const BIG_DELIVERY_HYPE_PER_BASKET = 10;
export const BIG_DELIVERY_HYPE_MAX = 20;
export const bigDeliveryHype = (baskets: number): number =>
  baskets >= 2 ? Math.min(BIG_DELIVERY_HYPE_MAX, BIG_DELIVERY_HYPE_PER_BASKET * (baskets - 1)) : 0;

export function freshenStock(
  save: SaveData,
  ids: readonly IngredientId[],
  days: number,
): { save: SaveData; freshened: IngredientId[] } {
  if (days <= 0) return { save, freshened: [] };
  const today = save.business.calendar.businessDay;
  const inventory = { ...save.business.inventory };
  const freshened: IngredientId[] = [];
  for (const id of new Set(ids)) {
    const entry = inventory[id];
    if (!entry || !(entry.quantity > 0)) continue;
    const next = Math.min(entry.purchaseDay + days, today + MAX_FRESH_DAYS_AHEAD);
    if (next <= entry.purchaseDay) continue;
    inventory[id] = { ...entry, purchaseDay: next };
    freshened.push(id);
  }
  if (freshened.length === 0) return { save, freshened };
  return { save: { ...save, business: { ...save.business, inventory } }, freshened };
}

export type RoundOutcome = {
  stars: 0 | 1 | 2 | 3;
  score: number;
  /** The pieces of the round (the whole shown basket is put away when the round ends, placed or not). */
  tokens: readonly IngredientId[];
  /** "Again" rounds score and show stars but give nothing and keep nothing. */
  practice?: boolean;
};

export type RoundEffects = {
  hype: number;
  magnet: boolean;
  newBest: boolean;
  /** The ingredients that now keep fresh longer, and by how many days (0 = none). */
  freshened?: readonly IngredientId[];
  freshDays?: number;
  /** The big-delivery Hype on top of `hype` (0 = none), and how many baskets the delivery had. */
  bigHype?: number;
  baskets?: number;
};

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
  const taken = new Set(o.tokens);
  const left = (state.crate ?? []).filter((id) => !taken.has(id));
  const tier = fridgeTierOf(save);
  const best = state.best ?? {};
  const newBest = o.score > (best[tier] ?? 0);
  const perfect = state.perfect! + (o.stars === 3 ? 1 : 0);
  const magnet =
    Math.min(MAX_MAGNETS, Math.floor(perfect / PERFECTS_PER_MAGNET)) >
    Math.min(MAX_MAGNETS, Math.floor(state.perfect! / PERFECTS_PER_MAGNET));
  const counts = { ...(state.counts ?? {}) };
  for (const id of taken) delete counts[id];
  // A delivery is a run of baskets: each needs a star to keep the run; a 0-star basket starts it over.
  const chain = o.stars > 0 ? (state.chain ?? 0) + 1 : 0;
  const bigHype = left.length === 0 ? bigDeliveryHype(chain) : 0;
  const next: FridgeSortState = {
    ...state,
    ...(left.length > 0 ? { crate: left, counts } : {}),
    best: newBest ? { ...best, [tier]: o.score } : best,
    stars: state.stars! + o.stars,
    perfect,
    rounds: state.rounds! + 1,
  };
  if (left.length === 0) {
    delete next.crate;
    delete next.counts;
    delete next.chain;
  } else if (chain > 0) next.chain = chain;
  else delete next.chain;
  const hype = HYPE_BY_STARS[o.stars];
  let out = withState(save, next);
  if (hype + bigHype > 0) out = addHype(out, hype + bigHype);
  const fresh = freshenStock(out, [...taken], FRESH_DAYS_BY_STARS[o.stars]);
  out = fresh.save;
  return {
    save: out,
    effects: {
      hype,
      magnet,
      newBest,
      freshened: fresh.freshened,
      freshDays: fresh.freshened.length > 0 ? FRESH_DAYS_BY_STARS[o.stars] : 0,
      bigHype,
      baskets: chain,
    },
  };
}

/** The Prep Cook puts the crate away on its own: no stars, no reward, no Hype. */
export function autoPutAway(save: SaveData): SaveData {
  const state = fridgeSortOf(save);
  if (!state.crate || state.crate.length === 0) return save;
  const next = { ...state };
  delete next.crate;
  delete next.counts;
  delete next.chain;
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
