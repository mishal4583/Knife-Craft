import type { IngredientId } from "./definitions";

/**
 * BOARD_DEBRIS — Phase 2 (A1): the little mess cutting leaves on the board
 * (seeds, scraps, peel, a juice mark), and when the board is due a scrape.
 *
 * Presentation only. The debris is a module-level list that lives for the
 * browser session: it is never saved (no save field), never read by
 * cutting, grading, progression or the economy, and a reload starts with a
 * clean board. It outlives one order on purpose — each order remounts the
 * Preparation scene (a new Phaser.Game), and a real board gets messy over a
 * service, not within one dish — so the scene reads it on start and adds to
 * it as the player cuts.
 *
 * The rule (developer brief, Phase 2 A1/A2), all from DEBRIS below:
 * - pieces come from real actions only — PER_CUT per committed cut,
 *   PER_RING per onion ring, PER_SMASH per smash, PER_PEEL per finished
 *   peel; never per frame;
 * - never more than MAX on the board (one Graphics redraw, no per-piece
 *   objects, so a long session cannot grow anything);
 * - at the START of an order with CLEAN_AT or more pieces, the bench
 *   scraper is offered (roughly every 2–3 orders at one piece per cut) —
 *   never mid-dish, and always with a Skip;
 * - a drag across SWEEP_FRAC of the board's width counts as the scrape.
 *
 * Random per session, never the same twice (developer 2026-10-24: "make the
 * stains random, like cutting different tomatoes different stains"): a seeded
 * generator keyed by a fresh session seed and the piece count, and each new
 * ingredient its own juiciness and tone (`newIngredientBatch`). Tests fix the
 * seed (resetDebrisForTests), so they stay reproducible. Solid pieces sit in the board's far and near
 * margins, where the food doesn't, and are drawn under everything but the
 * board.
 *
 * Juice (developer 2026-10-24: "for juicy ingredients make it juicy and
 * realistic, let it spill while cutting"): a juicy ingredient (JUICE) spills
 * at the cut itself — a puddle that runs out from under the food, and a few
 * droplets — so a tomato leaves a red pool, a lemon a pale one, a beetroot a
 * deep stain. Juice doesn't change when the cloth comes (CLEAN_AT counts the
 * solid pieces); it does make the wipe longer (a pool counts half a piece).
 *
 * The cloth (developer 2026-10-24: "use a realistic cloth … make the cleaning
 * a little slow and satisfying"): `wipeDebris` rubs the pieces under the
 * cloth. Each has its own toughness (a juice pool takes a few passes, a seed
 * one); solids are dragged a little with the cloth before it picks them up,
 * juice smears along the stroke and fades. `cleanProgress` is how much of
 * the mess is gone; the scene calls it done at DEBRIS.CLEAN_DONE.
 */
export const DEBRIS = {
  MAX: 40,
  CLEAN_AT: 30,
  PER_CUT: 1,
  PER_RING: 1,
  PER_SMASH: 2,
  PER_PEEL: 3,
  SWEEP_FRAC: 0.45,
  /** Wet pieces (juice, drops) on top of MAX — a juicy dish can't crowd out the scraps. */
  MAX_WET: 24,
  /** The cloth: its reach on the board face (fractions of its width / height). */
  CLOTH_RU: 0.14,
  CLOTH_RV: 0.26,
  /** How much one full board-width of rubbing wears a toughness-1 piece. */
  WIPE_RATE: 2.6,
  /**
   * Done only at 1: every piece gone AND every patch of the board's film wiped
   * (developer 2026-10-24: "make the user wipe the board each and every
   * corner, don't make it too easy").
   */
  CLEAN_DONE: 1,
  /** The film of grime over the whole board: a grid of patches, each wiped on its own. */
  FILM_COLS: 8,
  FILM_ROWS: 5,
  /** A patch's dirt to start with (plus more where the mess is), and how hard it is to wipe. */
  FILM_BASE: 0.55,
  FILM_TOUGHNESS: 1.5,
  /** Below this a patch counts as clean. */
  FILM_CLEAN: 0.06,
} as const;

export type DebrisKind = "seed" | "scrap" | "skin" | "juice" | "drop" | "cube" | "leaf" | "crumb";

export type DebrisPiece = {
  /** Across the board face, 0 (left) to 1 (right). */
  u: number;
  /** Down the board face, 0 (far edge) to 1 (near edge). */
  v: number;
  kind: DebrisKind;
  color: number;
  /** Size as a fraction of the canvas width. */
  size: number;
  rot: number;
  /** Its own shape (a puddle's outline, a cube's facets) — fixed when it lands. */
  seed: number;
  /** How far the cloth has worn it, 0 (fresh) to 1 (gone). */
  wear: number;
  /** A juice pool smeared by the cloth: how far it has been dragged (board fractions). */
  smearU: number;
  smearV: number;
};

/** How hard each kind is to wipe (cloth passes, roughly). */
export const WIPE_TOUGHNESS: Record<DebrisKind, number> = {
  juice: 2.6,
  drop: 1.1,
  seed: 0.9,
  scrap: 1,
  cube: 1.2,
  skin: 1.3,
  leaf: 1,
  crumb: 0.8,
};

/** Juice and drops: wet pieces (half a piece of mess for the cloth; never counted for when it comes). */
export const isWet = (kind: DebrisKind) => kind === "juice" || kind === "drop";

/**
 * What runs out of each ingredient when it's cut: the liquid's colour and how
 * much it spills per cut (0–1). Watery veg leave a pale wet patch, starchy ones
 * a cloudy one, butter and salmon a greasy sheen, steak its red juice.
 * (Developer 2026-10-24: "optimise the stains for all ingredients".)
 */
export const JUICE: Partial<Record<IngredientId, { color: number; amount: number }>> = {
  tomato: { color: 0xc4301e, amount: 0.95 },
  strawberry: { color: 0xc0182f, amount: 0.8 },
  watermelon: { color: 0xe23048, amount: 1 },
  orange: { color: 0xf09418, amount: 0.95 },
  lemon: { color: 0xf0d034, amount: 0.9 },
  lime: { color: 0xa8c838, amount: 0.85 },
  pineapple: { color: 0xf2c63a, amount: 0.95 },
  mango: { color: 0xf0a020, amount: 0.9 },
  peach: { color: 0xeea060, amount: 0.85 },
  kiwi: { color: 0x9cbc30, amount: 0.75 },
  pomegranate: { color: 0x9c0f2c, amount: 0.95 },
  grapes: { color: 0x9a4a78, amount: 0.6 },
  pear: { color: 0xe6dc98, amount: 0.65 },
  apple: { color: 0xe8d88e, amount: 0.45 },
  cucumber: { color: 0xc6dc9a, amount: 0.6 },
  zucchini: { color: 0xd8e4b0, amount: 0.35 },
  pepper: { color: 0xd84a2a, amount: 0.4 },
  chilli: { color: 0x7aa83a, amount: 0.3 },
  beetroot: { color: 0x6e0f34, amount: 0.95 },
  radish: { color: 0xeccad2, amount: 0.35 },
  turnip: { color: 0xeee8d8, amount: 0.3 },
  celery: { color: 0xc8dc9a, amount: 0.4 },
  fennel: { color: 0xe0e8c0, amount: 0.35 },
  cabbage: { color: 0xd8e6b0, amount: 0.25 },
  lettuce: { color: 0xd6e8b0, amount: 0.3 },
  spinach: { color: 0x5a8a3a, amount: 0.25 },
  eggplant: { color: 0xe4d8a8, amount: 0.25 },
  corn: { color: 0xf2e6b0, amount: 0.35 },
  potato: { color: 0xe9e2c8, amount: 0.3 },
  sweetpotato: { color: 0xf0b070, amount: 0.3 },
  pumpkin: { color: 0xf0a040, amount: 0.35 },
  onion: { color: 0xf0ecdc, amount: 0.4 },
  garlic: { color: 0xf2ecd8, amount: 0.2 },
  ginger: { color: 0xe8d090, amount: 0.3 },
  mushroom: { color: 0x8a6a4a, amount: 0.2 },
  avocado: { color: 0xb8cc6a, amount: 0.3 },
  coconut: { color: 0xf2eee2, amount: 0.6 },
  tofu: { color: 0xf2eee0, amount: 0.55 },
  mozzarella: { color: 0xf6f2e6, amount: 0.55 },
  butter: { color: 0xf2d880, amount: 0.45 },
  steak: { color: 0x7e1a1a, amount: 0.65 },
  chicken: { color: 0xe6b8a4, amount: 0.4 },
  salmon: { color: 0xee8a6a, amount: 0.45 },
};

type Look = readonly (readonly [DebrisKind, number])[];

/** What each ingredient leaves behind — kind and colour pairs, one picked at random per piece. */
const LOOKS: Record<IngredientId, Look> = {
  tomato: [
    ["cube", 0xd9412c],
    ["seed", 0xead27a],
    ["cube", 0xe8573c],
    ["seed", 0xf0dc8c],
    ["skin", 0xc8321f],
  ],
  strawberry: [
    ["cube", 0xd42a3e],
    ["seed", 0xe9d48a],
    ["leaf", 0x4f8a2e],
  ],
  pepper: [
    ["seed", 0xf3eccd],
    ["cube", 0xd63c2c],
    ["skin", 0xc02e1e],
    ["scrap", 0xf3eccd],
  ],
  chilli: [
    ["seed", 0xf1e9c4],
    ["skin", 0x4f8f2e],
    ["seed", 0xf6efd0],
  ],
  cucumber: [
    ["cube", 0xcfe2a2],
    ["skin", 0x3f6f2a],
    ["seed", 0xdfe8c4],
  ],
  zucchini: [
    ["cube", 0xe2e8bc],
    ["skin", 0x3f6a26],
    ["seed", 0xe6e9c8],
  ],
  onion: [
    ["skin", 0xc9965a],
    ["skin", 0xe8d6b8],
    ["scrap", 0xf3ead9],
    ["scrap", 0xd7a8c8],
  ],
  garlic: [
    ["skin", 0xf0e6d6],
    ["scrap", 0xf7f0e2],
    ["skin", 0xe2c8c0],
  ],
  ginger: [
    ["skin", 0xb8925e],
    ["scrap", 0xf0d898],
    ["crumb", 0xe8c878],
  ],
  potato: [
    ["skin", 0xa47a4c],
    ["cube", 0xf1dfa8],
    ["crumb", 0xf3e6be],
  ],
  sweetpotato: [
    ["skin", 0x9a4a3a],
    ["cube", 0xf09a4a],
    ["crumb", 0xf4b070],
  ],
  carrot: [
    ["cube", 0xe8862f],
    ["skin", 0xd06f22],
    ["scrap", 0xf0a050],
  ],
  pumpkin: [
    ["cube", 0xf09a30],
    ["seed", 0xf2e8c8],
    ["skin", 0x6a8a3a],
    ["scrap", 0xe8a040],
  ],
  turnip: [
    ["skin", 0xa86aa8],
    ["cube", 0xf2eee0],
  ],
  radish: [
    ["skin", 0xd2324a],
    ["cube", 0xf6f0f0],
    ["leaf", 0x5a8a3a],
  ],
  beetroot: [
    ["cube", 0x7a1438],
    ["skin", 0x5a2a2a],
    ["crumb", 0x8a1a40],
  ],
  eggplant: [
    ["skin", 0x3a1e48],
    ["cube", 0xece2b8],
    ["seed", 0xc8b070],
  ],
  broccoli: [
    ["crumb", 0x4f7f2e],
    ["crumb", 0x6a9a3a],
    ["scrap", 0xa8c070],
  ],
  cauliflower: [
    ["crumb", 0xf2ecd8],
    ["crumb", 0xe8e0c4],
    ["leaf", 0x7a9a4a],
  ],
  cabbage: [
    ["leaf", 0xa8c878],
    ["scrap", 0xdde8b8],
    ["leaf", 0xc4d898],
  ],
  lettuce: [
    ["leaf", 0x8ab84a],
    ["leaf", 0xb8d878],
    ["scrap", 0xe2ecc0],
  ],
  spinach: [
    ["leaf", 0x3e6e2a],
    ["leaf", 0x4f7f32],
    ["scrap", 0x6a9a3e],
  ],
  celery: [
    ["scrap", 0xa8c870],
    ["skin", 0x8ab05a],
    ["leaf", 0x6a9a3a],
  ],
  fennel: [
    ["scrap", 0xe2ecc4],
    ["leaf", 0x7aa84a],
    ["skin", 0xc8d8a0],
  ],
  asparagus: [
    ["skin", 0x6a8a3a],
    ["scrap", 0xa8b870],
    ["crumb", 0x8aa050],
  ],
  greenbean: [
    ["scrap", 0x6aa040],
    ["seed", 0xe6eccc],
    ["skin", 0x5a8a32],
  ],
  peapod: [
    ["seed", 0x7ab04a],
    ["skin", 0x6aa040],
    ["seed", 0x8ac05a],
  ],
  corn: [
    ["seed", 0xf2d24a],
    ["seed", 0xf6e070],
    ["skin", 0xc8d090],
  ],
  artichoke: [
    ["leaf", 0x7a9a5a],
    ["skin", 0x8aa06a],
    ["crumb", 0xd8d4a0],
  ],
  mushroom: [
    ["scrap", 0xcbb59a],
    ["crumb", 0x8a6a4a],
    ["skin", 0xa88a6a],
  ],
  basil: [
    ["leaf", 0x4f8a3a],
    ["leaf", 0x3f7a2e],
  ],
  parsley: [
    ["leaf", 0x5a9a3c],
    ["crumb", 0x4f8a32],
  ],
  cilantro: [
    ["leaf", 0x5a9e3a],
    ["leaf", 0x76b04a],
    ["crumb", 0x4f8f32],
  ],
  springonion: [
    ["scrap", 0x6aa83e],
    ["scrap", 0xe8eccc],
    ["crumb", 0x5a9a32],
  ],
  orange: [
    ["cube", 0xf2a23a],
    ["skin", 0xe88a1c],
    ["seed", 0xf6efcf],
  ],
  lemon: [
    ["cube", 0xf4dc5a],
    ["seed", 0xf6efcf],
    ["skin", 0xe8c41c],
  ],
  lime: [
    ["cube", 0xb8d860],
    ["skin", 0x5e9a24],
    ["seed", 0xf2f0d0],
  ],
  pineapple: [
    ["cube", 0xf6d44a],
    ["skin", 0xa47a2a],
    ["scrap", 0xf2e08a],
  ],
  watermelon: [
    ["cube", 0xe8405a],
    ["seed", 0x2a1a14],
    ["skin", 0x4a7a32],
  ],
  mango: [
    ["cube", 0xf4b030],
    ["skin", 0x9cb43a],
    ["scrap", 0xf8c850],
  ],
  peach: [
    ["cube", 0xf4b878],
    ["skin", 0xd8604a],
    ["scrap", 0xf8d090],
  ],
  pear: [
    ["cube", 0xf2ecc4],
    ["skin", 0xc8c050],
    ["seed", 0x4a2a18],
  ],
  kiwi: [
    ["cube", 0x9cc23a],
    ["seed", 0x1e1a12],
    ["skin", 0x8a6a42],
  ],
  pomegranate: [
    ["seed", 0xb0142e],
    ["seed", 0xc8203a],
    ["skin", 0xd8c8a8],
  ],
  grapes: [
    ["skin", 0x6a2a5a],
    ["cube", 0xc8d890],
    ["seed", 0x8a6a3a],
  ],
  avocado: [
    ["cube", 0xc8d878],
    ["skin", 0x2e3e1e],
    ["scrap", 0xa8c060],
  ],
  coconut: [
    ["crumb", 0xf6f2e8],
    ["skin", 0x6a4a2e],
    ["scrap", 0xf2ece0],
  ],
  apple: [
    ["seed", 0x5b3a22],
    ["cube", 0xf2e6c2],
    ["skin", 0xc0302a],
  ],
  cheddar: [
    ["crumb", 0xf2b03a],
    ["cube", 0xf0a830],
    ["crumb", 0xf6c050],
  ],
  mozzarella: [
    ["scrap", 0xf8f4ea],
    ["crumb", 0xf2ecdc],
  ],
  butter: [
    ["scrap", 0xf6dc80],
    ["crumb", 0xf2d070],
  ],
  tofu: [
    ["cube", 0xf4f0e2],
    ["crumb", 0xeee8d6],
  ],
  bread: [
    ["crumb", 0xd9a85c],
    ["crumb", 0xa8743a],
  ],
  baguette: [
    ["crumb", 0xd9a85c],
    ["crumb", 0xb07a3a],
    ["skin", 0xa8743a],
  ],
  chicken: [
    ["scrap", 0xf0d0c0],
    ["skin", 0xe8c8a0],
    ["crumb", 0xf4e2d4],
  ],
  steak: [
    ["scrap", 0x9a2a2a],
    ["skin", 0xf2e4d0],
    ["crumb", 0x7e1a1a],
  ],
  salmon: [
    ["scrap", 0xf08a6a],
    ["skin", 0x8a8a90],
    ["crumb", 0xf6a888],
  ],
};

/** Everything else, by the ingredient's own `category`. */
const BY_CATEGORY: Record<string, Look> = {
  Vegetable: [
    ["scrap", 0x7da454],
    ["scrap", 0xc9b98a],
  ],
  Fruit: [
    ["juice", 0xe0a040],
    ["seed", 0x6b4a2c],
  ],
  Herb: [["leaf", 0x4f8a3a]],
  Aromatic: [["skin", 0xe7d7bd]],
  Bakery: [["crumb", 0xd9a85c]],
  Dairy: [["scrap", 0xf2e3b0]],
  Protein: [["juice", 0xc98a7a]],
};

const FALLBACK: Look = [["scrap", 0xc9b98a]];

/** What `ingredientId` leaves behind (its own look, else its category's). */
export function debrisLookFor(ingredientId: IngredientId, category: string): Look {
  return LOOKS[ingredientId] ?? BY_CATEGORY[category] ?? FALLBACK;
}

/** Every ingredient with its own look (tests: none falls back to its category). */
export const debrisLookIds = () => Object.keys(LOOKS) as IngredientId[];

/** mulberry32 — a tiny seeded generator, so piece n always lands the same way. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * A fresh seed per session (developer 2026-10-24: "make the stains random,
 * like cutting different tomatoes different stains"): every play leaves its
 * own mess. Not Math.random — the platform's crypto source, else the clock;
 * tests fix it with resetDebrisForTests(seed). Presentation only.
 */
function freshSeed(): number {
  try {
    const a = new Uint32Array(1);
    globalThis.crypto?.getRandomValues?.(a);
    if (a[0]) return a[0];
  } catch {
    // no crypto: the clock below
  }
  const t = typeof performance !== "undefined" ? performance.now() * 1000 : 0;
  return (Date.now() ^ (t | 0)) >>> 0 || 1;
}

let sessionSeed = freshSeed();
let pieces: DebrisPiece[] = [];
/** Pieces ever added this session — with the session seed, the seed of the next one. */
let made = 0;
/**
 * This ingredient's own character (newIngredientBatch): one tomato is riper
 * and juicier than the last — its juice and flesh a little darker, more of it.
 */
let batch = { juicy: 1, tone: 1 };

/** The next piece's generator. */
const nextRand = (salt: number) => seeded(sessionSeed ^ Math.imul(0x9e3779b1, ++made) ^ salt);

/** A colour nudged a little (brightness and warmth), so no two pieces match exactly. */
function vary(color: number, r: () => number, tone: number): number {
  const k = (0.88 + r() * 0.24) * tone;
  const warm = (r() - 0.5) * 18;
  const ch = (v: number, d: number) => Math.max(0, Math.min(255, Math.round(v * k + d)));
  return (
    (ch((color >> 16) & 255, warm) << 16) |
    (ch((color >> 8) & 255, warm * 0.3) << 8) |
    ch(color & 255, -warm * 0.5)
  );
}

/**
 * A new ingredient goes on the board (the scene calls this per fresh
 * ingredient): it gets its own juiciness (0.65–1.35 ×) and tone, so two
 * tomatoes never stain the board the same way.
 */
export function newIngredientBatch(): void {
  const r = nextRand(0x7f4a7c15);
  batch = { juicy: 0.65 + r() * 0.7, tone: 0.9 + r() * 0.18 };
}

/** The debris on the board now (read-only). */
export function boardDebris(): readonly DebrisPiece[] {
  return pieces;
}

/** True when the board is due a clean (checked at the start of an order). */
export function cleanupDue(): boolean {
  return pieces.filter((p) => !isWet(p.kind)).length >= DEBRIS.CLEAN_AT;
}

/** The mess left for the cloth, wet pieces counting half. */
function messWeight(list: readonly DebrisPiece[]): number {
  return list.reduce((t, p) => t + (isWet(p.kind) ? 0.5 : 1) * (1 - p.wear), 0);
}

/** The board is clean again (the cloth finished). */
export function clearDebris(): void {
  pieces = [];
  film = null;
  wipeStart = 0;
}

/** Tests only: a brand-new session with a fixed seed. */
export function resetDebrisForTests(seed = 1): void {
  sessionSeed = seed;
  pieces = [];
  made = 0;
  batch = { juicy: 1, tone: 1 };
  film = null;
  wipeStart = 0;
}

const SIZE: Record<DebrisKind, [number, number]> = {
  juice: [0.022, 0.016],
  drop: [0.003, 0.004],
  skin: [0.014, 0.014],
  seed: [0.004, 0.004],
  cube: [0.009, 0.009],
  leaf: [0.01, 0.01],
  crumb: [0.003, 0.005],
  scrap: [0.008, 0.009],
};

/**
 * Adds up to `count` pieces for `ingredientId` near `u` (where on the board,
 * 0–1 across, the action happened) and returns how many were added — fewer
 * than asked, or 0, once the board holds DEBRIS.MAX. Every piece is its own:
 * kind, size, colour, place and turn all drawn at random.
 */
export function addDebris(
  ingredientId: IngredientId,
  category: string,
  u: number,
  count: number,
  /** Where down the board face the cut was (0–1): a juicy ingredient spills there. */
  v?: number,
  /**
   * A special variant's colour (a Golden Tomato bleeds gold, not red —
   * developer 2026-10-24): the juice takes it and the scraps lean to it.
   */
  tint?: number,
): number {
  const look = debrisLookFor(ingredientId, category);
  const solid = () => pieces.filter((p) => !isWet(p.kind)).length;
  let added = 0;
  while (added < count && solid() < DEBRIS.MAX) {
    const r = nextRand(0);
    const [kind, color] = look[Math.floor(r() * look.length)] ?? FALLBACK[0]!;
    const near = r() < 0.5;
    const [s0, ds] = SIZE[kind];
    pieces = [
      ...pieces,
      {
        // Scraps fly further some cuts than others.
        u: clamp01(u + (r() - 0.5) * (0.16 + r() * 0.2), 0.04, 0.96),
        // The far (top) and near (bottom) margins of the face — clear of the food.
        v: near ? 0.84 + r() * 0.12 : 0.04 + r() * 0.12,
        kind,
        // Seeds keep their own colour; flesh and peel take a variant's.
        color: vary(
          tint !== undefined && kind !== "seed" ? mixColor(color, tint, 0.75) : color,
          r,
          batch.tone,
        ),
        size: s0 + r() * ds,
        rot: r() * Math.PI * 2,
        seed: Math.floor(r() * 1e9),
        wear: 0,
        smearU: 0,
        smearV: 0,
      },
    ];
    added++;
  }
  if (v !== undefined) spill(ingredientId, u, v, tint);
  return added;
}

/** `a` moved `k` of the way to `b`, channel by channel. */
export function mixColor(a: number, b: number, k: number): number {
  const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - k) + ((b >> sh) & 255) * k) & 255;
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * A juicy cut spills — differently every time: a pool that runs out from under
 * the cut (its size from this ingredient's juiciness and the cut), sometimes a
 * second smaller one, a few droplets, and now and then a squirt (a line of
 * drops flung out). Bounded by DEBRIS.MAX_WET.
 */
function spill(ingredientId: IngredientId, u: number, v: number, tint?: number): void {
  const base = JUICE[ingredientId];
  if (!base) return;
  // A variant bleeds its own colour, a shade deeper than its skin.
  const juice = tint === undefined ? base : { ...base, color: mixColor(tint, 0x6a3a10, 0.12) };
  const wet = () => pieces.filter((p) => isWet(p.kind)).length;
  const r = nextRand(0x51ed270b);
  const amount = Math.min(1, juice.amount * batch.juicy);
  if (r() > amount) return;
  const tone = batch.tone * (1.08 - batch.juicy * 0.1);
  const place = (kind: DebrisKind, size: number, du: number, dv: number) => {
    if (wet() >= DEBRIS.MAX_WET) return;
    pieces = [
      ...pieces,
      {
        u: clamp01(u + du, 0.04, 0.96),
        v: clamp01(v + dv, 0.05, 0.95),
        kind,
        color: vary(juice.color, r, tone),
        size,
        rot: r() * Math.PI * 2,
        seed: Math.floor(r() * 1e9),
        wear: 0,
        smearU: 0,
        smearV: 0,
      },
    ];
  };
  // The pool runs down and out from under the food (the board tilts towards the player).
  place(
    "juice",
    (0.026 + r() * 0.042) * (0.55 + amount * 0.65),
    (r() - 0.5) * 0.12,
    0.03 + r() * 0.15,
  );
  if (r() < amount * 0.35)
    place("juice", (0.018 + r() * 0.02) * amount, (r() - 0.5) * 0.22, (r() - 0.3) * 0.2);
  const drops = Math.floor(r() * (1 + amount * 3));
  for (let i = 0; i < drops; i++) {
    const a = r() * Math.PI * 2;
    const d = 0.05 + r() * 0.16;
    place("drop", 0.002 + r() * 0.005, Math.cos(a) * d, Math.sin(a) * d * 1.6);
  }
  if (r() < amount * 0.2) {
    const a = r() * Math.PI * 2;
    const n = 3 + Math.floor(r() * 3);
    for (let i = 1; i <= n; i++) {
      const d = 0.05 + i * (0.035 + r() * 0.02);
      place("drop", 0.0025 + r() * 0.003, Math.cos(a) * d, Math.sin(a) * d * 1.4);
    }
  }
}

// ── The film: the whole board needs a wipe ──────────────────────────────

/**
 * The grime over the whole board while the cloth is out (developer
 * 2026-10-24: "make the user wipe the board each and every corner"): a
 * FILM_COLS × FILM_ROWS grid of patches, each with its own dirt (0–1, more
 * where the mess is). The cloth must pass over every patch — corners and
 * edges too — before the board is clean. null when the cloth isn't out.
 */
let film: number[] | null = null;
let filmStart = 0;
/** The mess when the cloth first came out (the progress bar's 0). */
let wipeStart = 0;

/** The film's patches (read-only; empty when the cloth isn't out). */
export function boardFilm(): readonly number[] {
  return film ?? [];
}

/** A patch's centre on the board face. */
export function filmCell(i: number): { u: number; v: number } {
  const c = i % DEBRIS.FILM_COLS;
  const r = Math.floor(i / DEBRIS.FILM_COLS);
  return { u: (c + 0.5) / DEBRIS.FILM_COLS, v: (r + 0.5) / DEBRIS.FILM_ROWS };
}

/** The film's colour: the juice on the board, else the scraps' — a dull, greasy version of it. */
export function filmColor(): number {
  const src = pieces.find((p) => p.kind === "juice") ?? pieces[0];
  const c = src?.color ?? 0x8a6a4a;
  const mix = (v: number, w: number) => Math.round(v * 0.55 + w * 0.45);
  return (mix((c >> 16) & 255, 0x7a) << 16) | (mix((c >> 8) & 255, 0x5a) << 8) | mix(c & 255, 0x3a);
}

/**
 * The cloth comes out: the film is laid over the board — every patch some dirt
 * (FILM_BASE, a little random), more under the mess.
 */
export function startWipe(): void {
  const r = nextRand(0x2545f491);
  const n = DEBRIS.FILM_COLS * DEBRIS.FILM_ROWS;
  film = Array.from({ length: n }, (_, i) => {
    const { u, v } = filmCell(i);
    const near = pieces.filter(
      (p) =>
        Math.abs(p.u - u) < 0.5 / DEBRIS.FILM_COLS + 0.03 &&
        Math.abs(p.v - v) < 0.5 / DEBRIS.FILM_ROWS + 0.03,
    ).length;
    return Math.min(1, DEBRIS.FILM_BASE * (0.75 + r() * 0.5) + near * 0.06);
  });
  filmStart = film.reduce((t, d) => t + d, 0);
  wipeStart = messWeight(pieces);
}

/** The cloth was put away (skipped): the film goes with it; the next clean-up starts afresh. */
export function endWipe(): void {
  film = null;
  wipeStart = 0;
}

/** True once every piece is gone and every patch of the film is wiped. */
export function boardClean(): boolean {
  return pieces.length === 0 && (film ?? []).every((d) => d <= DEBRIS.FILM_CLEAN);
}

/**
 * How clean the board is, 0–1: half the pieces, half the film. Exactly 1 only
 * when boardClean() — a missed corner keeps it below.
 */
export function cleanProgress(): number {
  if (boardClean()) return 1;
  const left = messWeight(pieces);
  const start = Math.max(wipeStart, left);
  const mess = start > 0 ? 1 - left / start : 1;
  const filmLeft = (film ?? []).reduce((t, d) => t + (d > DEBRIS.FILM_CLEAN ? d : 0), 0);
  const filmPart = filmStart > 0 ? 1 - filmLeft / filmStart : 1;
  return Math.max(0, Math.min(0.99, mess * 0.5 + filmPart * 0.5));
}

/** The dirtiest patch still left (for a hint), or null. */
export function dirtiestPatch(): { u: number; v: number } | null {
  if (!film) return null;
  let best = -1;
  film.forEach((d, i) => {
    if (d > DEBRIS.FILM_CLEAN && (best < 0 || d > film![best]!)) best = i;
  });
  if (best >= 0) return filmCell(best);
  const p = pieces[0];
  return p ? { u: p.u + p.smearU, v: p.v + p.smearV } : null;
}

export type WipeResult = {
  /** Pieces the cloth picked up / wiped away on this rub. */
  cleared: number;
  /** Pieces it touched (worn, dragged or smeared). */
  touched: number;
  /** Patches of the film it finished on this rub. */
  patches: number;
};

/**
 * One rub of the cloth from (u0, v0) to (u1, v1) on the board face
 * (fractions): every piece under the cloth wears by the distance rubbed over
 * its toughness; solids are dragged along (more the fresher they are), juice
 * smears along the stroke; a piece worn through is gone. The film's patches
 * under the cloth wear the same way.
 */
export function wipeDebris(u0: number, v0: number, u1: number, v1: number): WipeResult {
  if (wipeStart === 0) wipeStart = messWeight(pieces);
  const du = u1 - u0;
  const dv = v1 - v0;
  const len = Math.hypot(du, dv * 0.6);
  if (len <= 0) return { cleared: 0, touched: 0, patches: 0 };
  let cleared = 0;
  let touched = 0;
  let patches = 0;
  pieces = pieces
    .map((p) => {
      const pu = p.u + p.smearU;
      const pv = p.v + p.smearV;
      const nx = (pu - u1) / DEBRIS.CLOTH_RU;
      const ny = (pv - v1) / DEBRIS.CLOTH_RV;
      const reach = nx * nx + ny * ny;
      if (reach > 1) return p;
      touched++;
      // The middle of the cloth presses hardest.
      const press = 1 - reach * 0.45;
      const wear = Math.min(1, p.wear + (len * DEBRIS.WIPE_RATE * press) / WIPE_TOUGHNESS[p.kind]);
      if (wear >= 1) {
        cleared++;
        return null;
      }
      const drag = isWet(p.kind) ? 0.35 : 0.55 * (1 - p.wear);
      return {
        ...p,
        wear,
        smearU: Math.max(-0.3, Math.min(0.3, p.smearU + du * drag)),
        smearV: Math.max(-0.3, Math.min(0.3, p.smearV + dv * drag)),
      };
    })
    .filter((p): p is DebrisPiece => p !== null);
  if (film)
    film = film.map((d, i) => {
      if (d <= DEBRIS.FILM_CLEAN) return d;
      const c = filmCell(i);
      const nx = (c.u - u1) / DEBRIS.CLOTH_RU;
      const ny = (c.v - v1) / DEBRIS.CLOTH_RV;
      const reach = nx * nx + ny * ny;
      if (reach > 1) return d;
      const left = d - (len * DEBRIS.WIPE_RATE * (1 - reach * 0.5)) / DEBRIS.FILM_TOUGHNESS;
      if (left <= DEBRIS.FILM_CLEAN) {
        patches++;
        return 0;
      }
      return left;
    });
  return { cleared, touched, patches };
}
