/**
 * DELIVERY INSPECTION — the rules of the "Spot the bad ones" mini-game (developer 2026-11-08; plan: docs/planning/DELIVERY-INSPECTION-MINIGAME-PLAN-2026-11-08.md).
 *
 * A delivery crate is tipped out on the receiving bench: 8-22 ingredients, a few of them NOT FRESH (mold, rot, wilt, bruises, later slime, pests
 * and shrivel), some hiding behind others, from the third tier next to harmless look-alikes (soil, a water drop, a scuff). The player taps what is
 * bad, drags things aside to look behind them, and beats a clock. Pure rules: no I/O, no unseeded randomness (a small seeded generator), and NEVER
 * any money, stock or ledger entry: flagging, missing or mis-flagging changes nothing in the game's economy (the same stance as Fridge Sort). The
 * only effects are the stars, Hype (`addHype`, the same table as the sorting games) and the "Sharp Eye" pins. Always optional.
 *
 * The ingredients drawn are the REAL ones of the delivery waiting in Fridge Sort's crate (`business.fridgeSort`), padded with other produce; the
 * defects are the game's own. State lives in `business.deliveryInspection` (optional; absent = nothing done yet) read through `deliveryInspectionOf`.
 *
 * FAIRNESS (tested): every defect can be found. Its spot is visible at the start, or (a "hidden" one) covered by exactly ONE other, sound ingredient
 * and visible once that one is moved. A defect is never behind another defect, and a decoy never sits on a defective ingredient.
 */
import type { IngredientId } from "../definitions";
import { INGREDIENTS } from "../definitions";
import type { SaveData } from "../SaveManager";
import { addHype } from "../restaurant/secondFloor";
import {
  DIFFICULTY,
  FRIDGE_SORT_FIRST_LEVEL,
  HYPE_BY_STARS,
  basketsLeft,
  fridgeSortOf,
} from "./fridgeSort";

// ── When it opens ────────────────────────────────────────────────────────────

/** The first level (the same as Fridge Sort: the first level whose food can arrive in a crate). */
export const INSPECTION_FIRST_LEVEL = FRIDGE_SORT_FIRST_LEVEL;
export const isInspectionOpen = (level: number): boolean => level >= INSPECTION_FIRST_LEVEL;
/** The reference's "Deliveries 2/5": at most this many rounds a day. */
export const MAX_ROUNDS_PER_DAY = 5;
export const MAX_PINS = 12;
export const PERFECTS_PER_PIN = 3;

// ── The marks ────────────────────────────────────────────────────────────────

export type DefectKind = "mold" | "rot" | "bruise" | "wilt" | "slime" | "pests" | "shrivel";
export type DecoyKind = "soil" | "drop" | "scuff" | "freckles" | "sun" | "speck";
export type MarkSize = "big" | "medium" | "small" | "tiny";

export const DEFECT_LABEL: Readonly<Record<DefectKind, string>> = {
  mold: "Moldy",
  rot: "Rotten",
  bruise: "Bruised",
  wilt: "Wilted",
  slime: "Slimy",
  pests: "Pests",
  shrivel: "Shriveled",
};
/** How big the mark is next to the ingredient picture. */
export const MARK_SCALE: Readonly<Record<MarkSize, number>> = {
  big: 0.92,
  medium: 0.7,
  small: 0.52,
  tiny: 0.36,
};

export type Mark =
  | { type: "defect"; kind: DefectKind; variant: number; size: MarkSize; dx: number; dy: number }
  | { type: "decoy"; kind: DecoyKind; variant: number; size: MarkSize; dx: number; dy: number };

/** Crate coordinates: x runs 0..CRATE_W, y runs 0..CRATE_H, in the same unit (so a circle stays round). */
export const CRATE_W = 100;
export const CRATE_H = 80;
/**
 * Where the painted crate sits in that area (the art is 1000 x 520: the back layer, and the front wall from y 220 of it): its top edge, its height,
 * and where the front wall starts. Anything lower than the wall's top is hidden behind it, so nothing that matters (a defect) is ever put there.
 */
export const CRATE_ART_TOP = 28;
export const CRATE_ART_H = 52;
export const WALL_TOP = CRATE_ART_TOP + (CRATE_ART_H * 220) / 520;
/** The lowest an item can sit (its centre). */
export const PILE_BOTTOM = WALL_TOP - 1;

export type CrateItem = {
  id: number;
  ingredient: IngredientId;
  /** Centre in crate units. */
  x: number;
  y: number;
  /** 0 = at the back, 2 = in front (drawn in this order, then by id). */
  layer: 0 | 1 | 2;
  /** Diameter in crate units (one unit = 1 % of the crate's width). */
  size: number;
  tilt: number;
  /** The defect or the harmless look-alike on it (none = a sound ingredient). `dx`, `dy` are -0.5..0.5 of the picture's box. */
  mark?: Mark;
  /** True when the item was put behind a cover on purpose (a "hidden" defect). */
  hidden?: boolean;
};

export const isDefective = (it: CrateItem): boolean => it.mark?.type === "defect";

// ── Difficulty by level (the same levels as Fridge Sort's DIFFICULTY) ────────

export type InspectionTier = {
  /** From this restaurant level. */
  from: number;
  items: readonly [number, number];
  defects: readonly [number, number];
  /** How many defects hide behind another ingredient, and how far off its middle the hider sits (0.12 = nearly all of it hidden, 0.5 = it peeks out). */
  hidden: number;
  peek: number;
  /** How many harmless look-alikes sit on sound ingredients. */
  decoys: number;
  /** The kinds of defect that can appear. */
  kinds: readonly DefectKind[];
  /** The sizes a defect can have. */
  sizes: readonly MarkSize[];
  /** How tightly the pile is packed (1 = loose, lower = more overlap). */
  crowd: number;
  /** Item diameter range, crate units. */
  diameter: readonly [number, number];
  timeMs: number;
  /** Seconds of the magnifier a round has (0 = none). */
  lensSec: number;
  /** After 12 s with nothing found the nearest defect pulses. */
  hint: boolean;
};

const KINDS_1: readonly DefectKind[] = ["mold", "rot", "wilt"];
const KINDS_2: readonly DefectKind[] = [...KINDS_1, "bruise"];
const KINDS_3: readonly DefectKind[] = [...KINDS_2, "slime"];
const KINDS_4: readonly DefectKind[] = [...KINDS_3, "pests", "shrivel"];

export const INSPECTION_TIERS: readonly InspectionTier[] = [
  {
    from: DIFFICULTY[0]!.from,
    items: [8, 9],
    defects: [2, 2],
    hidden: 0,
    peek: 0.12,
    decoys: 0,
    kinds: KINDS_1,
    sizes: ["big"],
    crowd: 0.9,
    diameter: [21, 23.5],
    timeMs: 60_000,
    lensSec: 0,
    hint: true,
  },
  {
    from: DIFFICULTY[1]!.from,
    items: [10, 10],
    defects: [3, 3],
    hidden: 1,
    peek: 0.5,
    decoys: 0,
    kinds: KINDS_2,
    sizes: ["big", "medium"],
    crowd: 0.82,
    diameter: [19.5, 21.5],
    timeMs: 55_000,
    lensSec: 0,
    hint: true,
  },
  {
    from: DIFFICULTY[2]!.from,
    items: [12, 12],
    defects: [3, 4],
    hidden: 1,
    peek: 0.12,
    decoys: 2,
    kinds: KINDS_3,
    sizes: ["medium", "small"],
    crowd: 0.74,
    diameter: [18, 20],
    timeMs: 50_000,
    lensSec: 10,
    hint: false,
  },
  {
    from: DIFFICULTY[3]!.from,
    items: [14, 14],
    defects: [4, 5],
    hidden: 2,
    peek: 0.12,
    decoys: 4,
    kinds: KINDS_4,
    sizes: ["medium", "small", "small"],
    crowd: 0.7,
    diameter: [16.5, 18.5],
    timeMs: 45_000,
    lensSec: 10,
    hint: false,
  },
  {
    from: DIFFICULTY[4]!.from,
    items: [17, 17],
    defects: [5, 6],
    hidden: 3,
    peek: 0.12,
    decoys: 6,
    kinds: KINDS_4,
    sizes: ["small", "small", "tiny"],
    crowd: 0.7,
    diameter: [15, 17],
    timeMs: 45_000,
    lensSec: 8,
    hint: false,
  },
];

export function tierAt(level: number): InspectionTier {
  let t = INSPECTION_TIERS[0]!;
  for (const x of INSPECTION_TIERS) if (level >= x.from) t = x;
  return t;
}
export const tierNumberAt = (level: number): number => INSPECTION_TIERS.indexOf(tierAt(level)) + 1;

// ── State ────────────────────────────────────────────────────────────────────

export type DeliveryInspectionState = {
  /** The crate (`fridgeSort.seed`) the inspections below belong to, and how many of its baskets were inspected. */
  seed?: number;
  inspected?: number;
  /** The business day of `today`, and the rounds finished that day (the daily limit). */
  day?: number;
  today?: number;
  best?: number;
  stars?: number;
  /** Three-star rounds (every 3 earn a pin). */
  perfect?: number;
  rounds?: number;
  /** Three-star rounds in a row (display only). */
  streak?: number;
  /** Bit 1: the how-to tour was seen. */
  howto?: number;
};

const whole = (v: unknown, max = Number.MAX_SAFE_INTEGER) =>
  Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

export function deliveryInspectionOf(save: SaveData): DeliveryInspectionState {
  const raw = save.business.deliveryInspection;
  return {
    seed: whole(raw?.seed),
    inspected: whole(raw?.inspected, 99),
    day: whole(raw?.day),
    today: whole(raw?.today, 99),
    best: whole(raw?.best),
    stars: whole(raw?.stars),
    perfect: whole(raw?.perfect),
    rounds: whole(raw?.rounds),
    streak: whole(raw?.streak, 999),
    howto: whole(raw?.howto, 1),
  };
}

function withState(save: SaveData, state: DeliveryInspectionState): SaveData {
  return { ...save, business: { ...save.business, deliveryInspection: state } };
}

export const howtoSeen = (save: SaveData): boolean => (deliveryInspectionOf(save).howto! & 1) !== 0;

/** Remembers that the tour was seen (the same save back when it already was). Never touches money or stock. */
export function withHowtoSeen(save: SaveData): SaveData {
  if (howtoSeen(save)) return save;
  return withState(save, {
    ...(save.business.deliveryInspection ?? {}),
    ...deliveryInspectionOf(save),
    howto: 1,
  });
}

/** How many Sharp Eye pins the player has earned: purely a trophy. */
export const pinsOf = (save: SaveData): number =>
  Math.min(MAX_PINS, Math.floor(deliveryInspectionOf(save).perfect! / PERFECTS_PER_PIN));

/** A hired Prep Cook can do an inspection for the player (a button in the game: no stars, no reward). The chip stays so the game is always playable. */
export const hasPrepCook = (save: SaveData): boolean =>
  save.business.staff?.hiredRoles?.includes("prep-cook") ?? false;

/** The Prep Cook inspects the basket on his own: it counts as inspected (it is not offered again), nothing else: no stars, Hype, pins or day count. */
export function autoInspect(save: SaveData): SaveData {
  const st = deliveryInspectionOf(save);
  const seed = fridgeSortOf(save).seed ?? 0;
  return withState(save, {
    ...(save.business.deliveryInspection ?? {}),
    ...st,
    seed,
    inspected: (st.seed === seed ? st.inspected! : 0) + 1,
  });
}

/** The inspections the player can do now (baskets waiting that were not inspected yet, within today's limit). */
export function roundsLeft(save: SaveData, level: number): number {
  if (!isInspectionOpen(level)) return 0;
  const st = deliveryInspectionOf(save);
  const day = save.business.calendar.businessDay;
  const doneToday = st.day === day ? st.today! : 0;
  const baskets = basketsLeft(save, level);
  const seen = st.seed === fridgeSortOf(save).seed ? st.inspected! : 0;
  return Math.max(0, Math.min(MAX_ROUNDS_PER_DAY - doneToday, baskets - seen));
}

/** Rounds done today and the most there can be (the "Deliveries 2/5" tag). */
export function deliveriesTag(save: SaveData, level: number): { done: number; total: number } {
  const st = deliveryInspectionOf(save);
  const day = save.business.calendar.businessDay;
  const done = st.day === day ? st.today! : 0;
  return { done, total: Math.min(MAX_ROUNDS_PER_DAY, done + roundsLeft(save, level)) };
}

// ── The seeded generator ─────────────────────────────────────────────────────

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rand: () => number, list: readonly T[]): T =>
  list[Math.floor(rand() * list.length)]!;

function shuffled<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let k = out.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1));
    [out[k], out[j]] = [out[j]!, out[k]!];
  }
  return out;
}

// ── What is in the crate ─────────────────────────────────────────────────────

/** Produce first (a defect can be drawn on any of it); bread and cheese from the third tier (mold). */
const SOUND_CATEGORIES = new Set(["Fruit", "Vegetable", "Aromatic", "Herb"]);
const MOLDY_OK = new Set<string>(["bread", "baguette", "cheddar", "mozzarella"]);
/** A stable, friendly default mix when the player owns little. */
const DEFAULT_MIX: readonly IngredientId[] = [
  "tomato",
  "lettuce",
  "carrot",
  "onion",
  "pepper",
  "potato",
  "cucumber",
  "mushroom",
  "garlic",
  "apple",
  "lemon",
  "parsley",
  "zucchini",
  "broccoli",
  "cabbage",
  "strawberry",
  "eggplant",
  "orange",
  "pear",
  "spinach",
  "avocado",
  "basil",
] as IngredientId[];
const LEAFY = new Set<string>([
  "lettuce",
  "spinach",
  "parsley",
  "basil",
  "cilantro",
  "cabbage",
  "celery",
]);

const inspectable = (id: IngredientId, tier: number): boolean => {
  const cat = INGREDIENTS[id]?.category;
  return !!cat && (SOUND_CATEGORIES.has(cat) || (tier >= 3 && MOLDY_OK.has(id)));
};

/** The ingredients of the crate's picture: the delivery's own first, then what the player holds, then the default mix; no repeats until used up. */
export function crateIngredients(save: SaveData, tier: number, count: number): IngredientId[] {
  const own = (fridgeSortOf(save).crate ?? []).filter((id) => inspectable(id, tier));
  const held = Object.entries(save.business.inventory ?? {})
    .filter(([, e]) => (e?.quantity ?? 0) > 0)
    .map(([id]) => id as IngredientId)
    .filter((id) => inspectable(id, tier) && !own.includes(id))
    .sort();
  const rest = DEFAULT_MIX.filter((id) => !own.includes(id) && !held.includes(id));
  const pool = [...own, ...held, ...rest];
  const out: IngredientId[] = [];
  for (let i = 0; i < count; i++) out.push(pool[i % pool.length]!);
  return out;
}

// ── Seeing: what covers what ─────────────────────────────────────────────────

/** Items are drawn back to front: by layer, then by id. */
const above = (a: CrateItem, b: CrateItem): boolean =>
  a.layer > b.layer || (a.layer === b.layer && a.id > b.id);
/** A picture covers a bit less than its disc (the corners are empty). */
const COVER_R = 0.44;

/** The items drawn over the point (px, py) of item `i`. */
export function coversAt(
  items: readonly CrateItem[],
  i: number,
  px: number,
  py: number,
): CrateItem[] {
  const me = items[i]!;
  return items.filter(
    (o) => o.id !== me.id && above(o, me) && Math.hypot(px - o.x, py - o.y) < o.size * COVER_R,
  );
}

/** The share of item `i`'s picture (sampled) that nothing covers. */
export function visibleShare(items: readonly CrateItem[], i: number): number {
  const me = items[i]!;
  let seen = 0;
  let all = 0;
  for (let gy = -3; gy <= 3; gy++)
    for (let gx = -3; gx <= 3; gx++) {
      const dx = (gx / 3) * me.size * 0.45;
      const dy = (gy / 3) * me.size * 0.45;
      if (Math.hypot(dx, dy) > me.size * 0.45) continue;
      all++;
      if (coversAt(items, i, me.x + dx, me.y + dy).length === 0) seen++;
    }
  return all === 0 ? 1 : seen / all;
}

/** Where on item `i` its mark sits, in crate units. */
export const markPoint = (it: CrateItem): { x: number; y: number } => ({
  x: it.x + (it.mark?.dx ?? 0) * it.size,
  y: it.y + (it.mark?.dy ?? 0) * it.size,
});

// ── Building a crate ─────────────────────────────────────────────────────────

export type Crate = {
  tier: number;
  items: CrateItem[];
  defects: number;
  timeMs: number;
  lensMs: number;
};

const CANDIDATES: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.18, -0.12],
  [-0.18, -0.12],
  [0.15, 0.15],
  [-0.15, 0.15],
  [0, -0.25],
  [0, 0.25],
  [0.28, 0],
  [-0.28, 0],
];

function build(
  tier: InspectionTier,
  ingredients: readonly IngredientId[],
  rand: () => number,
): CrateItem[] {
  const n = ingredients.length;
  const items: CrateItem[] = [];
  // Rows from the back of the crate to the front: more rows (a deeper pile) in the harder tiers.
  const rowCount = tier.crowd < 0.8 ? 4 : 3;
  const per: number[] = [];
  for (let r = 0; r < rowCount; r++)
    per.push(Math.round((n - per.reduce((s, x) => s + x, 0)) / (rowCount - r)));
  let id = 0;
  for (let r = 0; r < rowCount; r++) {
    const layer = Math.min(2, Math.floor((r * 3) / rowCount)) as 0 | 1 | 2;
    // The bottom row sits against the front wall (its lower part is hidden by it): the pile is IN the crate, heaped above the rim.
    const y = (rowCount === 4 ? 24 : 27) + ((rowCount === 4 ? 25 : 22) * r) / (rowCount - 1);
    const count = per[r]!;
    const spread = 76 * Math.max(0.7, tier.crowd);
    for (let k = 0; k < count; k++) {
      const t = count === 1 ? 0.5 : k / (count - 1);
      const size = tier.diameter[0] + rand() * (tier.diameter[1] - tier.diameter[0]);
      items.push({
        id: id++,
        ingredient: ingredients[(id - 1) % n]!,
        x:
          50 -
          spread / 2 +
          t * spread +
          (rand() - 0.5) * 6 +
          (r % 2 === 1 ? spread / (2 * Math.max(1, count)) : 0),
        y: y + (rand() - 0.5) * 3,
        layer,
        size,
        tilt: Math.round((rand() - 0.5) * 36),
      });
    }
  }
  // Keep everything inside the crate.
  for (const it of items) {
    it.x = Math.min(CRATE_W - 10 - it.size / 2 + 4, Math.max(10 + it.size / 2 - 4, it.x));
    it.y = Math.min(PILE_BOTTOM - it.size / 2 + 6, Math.max(6 + it.size / 2 - 4, it.y));
    it.x = Math.round(it.x * 10) / 10;
    it.y = Math.round(it.y * 10) / 10;
    it.size = Math.round(it.size * 10) / 10;
  }
  return items;
}

/** Marks the defects, the hidden ones and the decoys on a layout; null when a guarantee cannot be met (the caller tries another layout). */
function mark(
  items: CrateItem[],
  tier: InspectionTier,
  defects: number,
  rand: () => number,
): boolean {
  const order = shuffled(
    items.map((_, i) => i),
    rand,
  );
  const defective = order.slice(0, defects);
  const taken = new Set<number>(defective);
  const hiddenIdx = defective.slice(0, tier.hidden);
  const coverFor = new Map<number, number>();
  // Hidden ones: put the item behind a sound front item, mostly under it.
  for (const h of hiddenIdx) {
    const candidates = order.filter((c) => !taken.has(c) && items[c]!.layer >= 1);
    const c = candidates.find(
      (x) => !coverFor.has(x) && !Array.from(coverFor.values()).includes(x),
    );
    if (c === undefined) return false;
    const cover = items[c]!;
    const me = items[h]!;
    me.layer = 0;
    cover.layer = cover.layer === 0 ? 1 : cover.layer;
    const a = rand() * Math.PI * 2;
    // The mark sits at the item's centre, under the cover's middle.
    me.x = Math.round((cover.x + Math.cos(a) * cover.size * tier.peek) * 10) / 10;
    me.y = Math.round((cover.y + Math.sin(a) * cover.size * tier.peek) * 10) / 10;
    me.hidden = true;
    coverFor.set(c, h);
    taken.add(c);
  }
  // A tier-2 style "partly behind": no extra work, the spot below is chosen from what shows.
  const used = new Set<number>();
  for (const d of defective) {
    const it = items[d]!;
    const hidden = !!it.hidden;
    const spots = [...CANDIDATES];
    let chosen: readonly [number, number] | null = null;
    for (const [dx, dy] of shuffled(spots, rand)) {
      const px = it.x + dx * it.size;
      const py = it.y + dy * it.size;
      if (py > WALL_TOP - 2) continue;
      const covers = coversAt(items, d, px, py);
      if (hidden) {
        // Exactly one sound ingredient covers it (the one it was put behind).
        if (covers.length === 1 && !isDefective(covers[0]!) && coverFor.has(covers[0]!.id)) {
          chosen = [dx, dy];
          break;
        }
      } else if (covers.length === 0) {
        chosen = [dx, dy];
        break;
      }
    }
    if (!chosen && !hidden) {
      // Nothing of it shows: bring it to the front.
      it.layer = 2;
      for (const [dx, dy] of shuffled(spots, rand))
        if (
          it.y + dy * it.size <= WALL_TOP - 2 &&
          coversAt(items, d, it.x + dx * it.size, it.y + dy * it.size).length === 0
        ) {
          chosen = [dx, dy];
          break;
        }
    }
    if (!chosen) return false;
    const kind =
      LEAFY.has(it.ingredient) && tier.kinds.includes("wilt") && rand() < 0.6
        ? "wilt"
        : pick(rand, tier.kinds);
    it.mark = {
      type: "defect",
      kind,
      variant: Math.floor(rand() * 4),
      size: hidden ? pick(rand, ["medium", "small"] as const) : pick(rand, tier.sizes),
      dx: chosen[0],
      dy: chosen[1],
    };
    used.add(d);
  }
  // A defect is never behind a defective item (a cover must be sound).
  for (const d of defective) {
    const p = markPoint(items[d]!);
    if (coversAt(items, d, p.x, p.y).some(isDefective)) return false;
  }
  // Decoys on sound items that nothing else is on.
  const sound = order.filter((c) => !taken.has(c));
  for (let k = 0; k < tier.decoys && k < sound.length; k++) {
    const it = items[sound[k]!]!;
    const visible = shuffled(CANDIDATES, rand).find(
      ([dx, dy]) => coversAt(items, it.id, it.x + dx * it.size, it.y + dy * it.size).length === 0,
    );
    if (!visible) continue;
    it.mark = {
      type: "decoy",
      kind: pick(rand, ["soil", "drop", "scuff", "freckles", "sun", "speck"] as const),
      variant: Math.floor(rand() * 3),
      size: pick(rand, ["small", "medium"] as const),
      dx: visible[0],
      dy: visible[1],
    };
  }
  return true;
}

/** The fairness guarantees of a finished crate (the QA reads the same function). */
export function crateIssues(items: readonly CrateItem[]): string[] {
  const out: string[] = [];
  items.forEach((it, i) => {
    if (it.mark?.type === "decoy" && isDefective(it)) out.push(`decoy on defect ${it.id}`);
    if (!isDefective(it)) return;
    const p = markPoint(it);
    const covers = coversAt(items, i, p.x, p.y);
    if (p.y > WALL_TOP - 1) out.push(`defect ${it.id} is behind the front wall`);
    if (!it.hidden && covers.length > 0) out.push(`defect ${it.id} is covered at the start`);
    if (it.hidden && !(covers.length === 1 && !isDefective(covers[0]!)))
      out.push(`hidden defect ${it.id} is not under exactly one sound ingredient`);
    if (it.hidden) {
      // Without its one cover, it shows.
      const rest = items.filter((o) => o.id !== covers[0]?.id);
      const j = rest.findIndex((o) => o.id === it.id);
      if (j >= 0 && coversAt(rest, j, p.x, p.y).length > 0)
        out.push(`hidden defect ${it.id} stays covered after moving its cover`);
    }
  });
  return out;
}

/** The deterministic crate of this seed and tier. */
export function buildCrate(
  level: number,
  ingredientsOf: (n: number) => IngredientId[],
  seed: number,
): Crate {
  const tier = tierAt(level);
  const rand = rng(seed);
  const n = tier.items[0] + Math.floor(rand() * (tier.items[1] - tier.items[0] + 1));
  const defects = tier.defects[0] + Math.floor(rand() * (tier.defects[1] - tier.defects[0] + 1));
  const ingredients = ingredientsOf(n);
  for (let attempt = 0; attempt < 60; attempt++) {
    const items = build(tier, ingredients, rand);
    if (mark(items, tier, defects, rand) && crateIssues(items).length === 0)
      return {
        tier: tierNumberAt(level),
        items,
        defects,
        timeMs: tier.timeMs,
        lensMs: tier.lensSec * 1000,
      };
  }
  // The last resort: a spread-out crate with no overlap at all (always fair).
  const items = build({ ...tier, crowd: 1, hidden: 0 }, ingredients, rand);
  items.forEach((it, k) => {
    it.layer = 2;
    it.x = 14 + (k % 5) * 18;
    it.y = 12 + Math.floor(k / 5) * 14;
  });
  mark(items, { ...tier, hidden: 0 }, defects, rand);
  return {
    tier: tierNumberAt(level),
    items,
    defects,
    timeMs: tier.timeMs,
    lensMs: tier.lensSec * 1000,
  };
}

const hashOf = (...parts: number[]): number => {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h ^= p >>> 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/**
 * The crate of the next inspection (real ingredients of the waiting delivery), or null when nothing can be inspected now.
 * `practice` rounds ("Again") use `salt` for a different crate.
 */
export function roundCrate(save: SaveData, level: number, salt = 0): Crate | null {
  if (!isInspectionOpen(level)) return null;
  const st = deliveryInspectionOf(save);
  const crate = fridgeSortOf(save);
  const day = save.business.calendar.businessDay;
  const tier = tierNumberAt(level);
  const seed = hashOf(crate.seed ?? 0, st.inspected ?? 0, day, level, salt);
  return buildCrate(level, (n) => crateIngredients(save, tier, n), seed);
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export const POINTS_PER_FIND = 100;
export const COMBO_STEP = 0.25;
export const COMBO_MAX = 3;
export const TIME_BONUS_PER_SECOND = 20;
/** A wrong flag costs this much of the clock. */
export const WRONG_PENALTY_MS = 4000;
/** Three stars need this share of the clock still left. */
export const SPARE_TIME_SHARE = 0.25;

export const comboMultiplier = (streak: number): number =>
  Math.min(COMBO_MAX, 1 + COMBO_STEP * streak);
/** One find's points; `streak` = how many were found right before it without a wrong flag. */
export const findPoints = (streak: number): number =>
  Math.round(POINTS_PER_FIND * comboMultiplier(streak));

export type RoundResult = {
  found: number;
  total: number;
  wrongs: number;
  msLeft: number;
  timeMs: number;
};

/**
 * Stars: under half found = 0; some found = 1; every defect found = 2; every defect found, no wrong flag and a quarter of the clock left = 3.
 */
export function starsFor(r: RoundResult): 0 | 1 | 2 | 3 {
  if (r.total <= 0 || r.found < Math.ceil(r.total / 2)) return 0;
  if (r.found < r.total) return 1;
  return r.wrongs === 0 && r.msLeft >= r.timeMs * SPARE_TIME_SHARE ? 3 : 2;
}

/** The star bar's progress (marks at 0.4, 0.8 and 1): finding all fills 0.8, a clean and quick finish fills the rest. */
export function progressOf(r: RoundResult): number {
  if (r.total <= 0) return 0;
  const done = r.found >= r.total;
  return Math.min(1, 0.8 * (r.found / r.total) + (done && starsFor(r) === 3 ? 0.2 : 0));
}
export const STAR_MARKS = [0.4, 0.8, 1] as const;

/** The round's score: the finds with their combo, plus 20 a second left when everything was found. */
export function scoreRound(finds: readonly number[], r: RoundResult): number {
  const base = finds.reduce((s, streak) => s + findPoints(streak), 0);
  return (
    base +
    (r.found >= r.total ? Math.floor(Math.max(0, r.msLeft) / 1000) * TIME_BONUS_PER_SECOND : 0)
  );
}

// ── Finishing a round ────────────────────────────────────────────────────────

export type RoundOutcome = {
  stars: 0 | 1 | 2 | 3;
  score: number;
  found: number;
  total: number;
  /** "Again" rounds score and show stars but give nothing and keep nothing. */
  practice?: boolean;
};
export type RoundEffects = { hype: number; pin: boolean; newBest: boolean; streak: number };
export const NO_EFFECTS: RoundEffects = { hype: 0, pin: false, newBest: false, streak: 0 };

/**
 * Applies a finished round: counts one more inspected basket, the day's rounds, the best score, stars, perfect rounds and the streak, and adds
 * the Hype. A practice round changes nothing. NEVER touches credits, inventory or the ledger.
 */
export function finishRound(
  save: SaveData,
  o: RoundOutcome,
): { save: SaveData; effects: RoundEffects } {
  if (o.practice) return { save, effects: NO_EFFECTS };
  const st = deliveryInspectionOf(save);
  const day = save.business.calendar.businessDay;
  const seed = fridgeSortOf(save).seed ?? 0;
  const sameCrate = st.seed === seed;
  const perfect = st.perfect! + (o.stars === 3 ? 1 : 0);
  const pin =
    Math.min(MAX_PINS, Math.floor(perfect / PERFECTS_PER_PIN)) >
    Math.min(MAX_PINS, Math.floor(st.perfect! / PERFECTS_PER_PIN));
  const streak = o.stars === 3 ? st.streak! + 1 : 0;
  const newBest = o.score > st.best!;
  const next: DeliveryInspectionState = {
    ...(save.business.deliveryInspection ?? {}),
    seed,
    inspected: (sameCrate ? st.inspected! : 0) + 1,
    day,
    today: (st.day === day ? st.today! : 0) + 1,
    best: newBest ? o.score : st.best!,
    stars: st.stars! + o.stars,
    perfect,
    rounds: st.rounds! + 1,
    streak,
    howto: st.howto!,
  };
  const hype = HYPE_BY_STARS[o.stars];
  let out = withState(save, next);
  if (hype > 0) out = addHype(out, hype);
  return { save: out, effects: { hype, pin, newBest, streak } };
}

// ── What the screen asks of the app ──────────────────────────────────────────

export type DeliveryInspectionAction =
  | { kind: "finish"; outcome: RoundOutcome }
  /** Only for analytics: a round began (the clock started) / the player left an inspection. */
  | { kind: "start"; items: number; defects: number; practice: boolean }
  | { kind: "skip" }
  /** The Prep Cook did this inspection (no reward). */
  | { kind: "auto" }
  /** The how-to tour was closed for the first time. */
  | { kind: "howto" };

export type DeliveryInspectionResult = { ok: true; effects: RoundEffects } | { ok: false };
