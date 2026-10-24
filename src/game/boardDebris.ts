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
 * Deterministic: piece n of the session lands the same way every time (a
 * seeded generator keyed by the session's piece count), so screenshots and
 * tests are reproducible. Solid pieces sit in the board's far and near
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
  /** The board counts as clean once this share of the mess is gone (the rest is polished off). */
  CLEAN_DONE: 0.92,
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

/** The juicy ingredients: their juice colour and how much they spill per cut (0–1). */
export const JUICE: Partial<Record<IngredientId, { color: number; amount: number }>> = {
  tomato: { color: 0xc4301e, amount: 0.95 },
  strawberry: { color: 0xc0182f, amount: 0.8 },
  watermelon: { color: 0xe23048, amount: 1 },
  orange: { color: 0xf09418, amount: 0.95 },
  lemon: { color: 0xf0d034, amount: 0.9 },
  lime: { color: 0xa8c838, amount: 0.85 },
  pineapple: { color: 0xf2c63a, amount: 0.95 },
  mango: { color: 0xf0a020, amount: 0.9 },
  peach: { color: 0xeea060, amount: 0.8 },
  kiwi: { color: 0x9cbc30, amount: 0.75 },
  pomegranate: { color: 0x9c0f2c, amount: 0.9 },
  grapes: { color: 0x9a4a78, amount: 0.6 },
  pear: { color: 0xe6dc98, amount: 0.6 },
  apple: { color: 0xe8d88e, amount: 0.4 },
  cucumber: { color: 0xc6dc9a, amount: 0.55 },
  pepper: { color: 0xd84a2a, amount: 0.35 },
  chilli: { color: 0x7aa83a, amount: 0.3 },
  beetroot: { color: 0x6e0f34, amount: 0.9 },
  coconut: { color: 0xf2eee2, amount: 0.5 },
  steak: { color: 0x7e1a1a, amount: 0.55 },
  chicken: { color: 0xe6b8a4, amount: 0.35 },
  salmon: { color: 0xee8a6a, amount: 0.35 },
  zucchini: { color: 0xd8e4b0, amount: 0.3 },
  avocado: { color: 0xb8cc6a, amount: 0.25 },
};

type Look = readonly (readonly [DebrisKind, number])[];

/** What each ingredient leaves behind — kind and colour pairs, picked in turn. */
const LOOKS: Partial<Record<IngredientId, Look>> = {
  tomato: [
    ["cube", 0xd9412c],
    ["seed", 0xead27a],
    ["cube", 0xe8573c],
    ["seed", 0xf0dc8c],
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
  ],
  ginger: [
    ["skin", 0xb8925e],
    ["scrap", 0xf0d898],
  ],
  potato: [
    ["skin", 0xa47a4c],
    ["cube", 0xf1dfa8],
  ],
  carrot: [
    ["cube", 0xe8862f],
    ["skin", 0xd06f22],
    ["scrap", 0xf0a050],
  ],
  basil: [["leaf", 0x4f8a3a]],
  parsley: [["leaf", 0x5a9a3c]],
  cilantro: [
    ["leaf", 0x5a9e3a],
    ["leaf", 0x76b04a],
  ],
  springonion: [
    ["scrap", 0x6aa83e],
    ["scrap", 0xe8eccc],
  ],
  mushroom: [
    ["scrap", 0xcbb59a],
    ["crumb", 0x8a6a4a],
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
  apple: [
    ["seed", 0x5b3a22],
    ["cube", 0xf2e6c2],
    ["skin", 0xc0302a],
  ],
  beetroot: [
    ["cube", 0x7a1438],
    ["skin", 0x5a2a2a],
  ],
  bread: [["crumb", 0xd9a85c]],
  baguette: [
    ["crumb", 0xd9a85c],
    ["crumb", 0xb07a3a],
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

let pieces: DebrisPiece[] = [];
/** Pieces ever added this session — the seed of the next one. */
let made = 0;

/** The debris on the board now (read-only). */
export function boardDebris(): readonly DebrisPiece[] {
  return pieces;
}

/** True when the board is due a scrape (checked at the start of an order). */
export function cleanupDue(): boolean {
  return pieces.filter((p) => !isWet(p.kind)).length >= DEBRIS.CLEAN_AT;
}

/** The mess left for the cloth, wet pieces counting half. */
function messWeight(list: readonly DebrisPiece[]): number {
  return list.reduce((t, p) => t + (isWet(p.kind) ? 0.5 : 1) * (1 - p.wear), 0);
}

/** The scrape: the board is clean again. */
export function clearDebris(): void {
  pieces = [];
  wipeStart = 0;
}

/** Tests only: a brand-new session. */
export function resetDebrisForTests(): void {
  pieces = [];
  made = 0;
  wipeStart = 0;
}

/**
 * Adds up to `count` pieces for `ingredientId` near `u` (where on the board,
 * 0–1 across, the action happened) and returns how many were added — fewer
 * than asked, or 0, once the board holds DEBRIS.MAX.
 */
export function addDebris(
  ingredientId: IngredientId,
  category: string,
  u: number,
  count: number,
  /** Where down the board face the cut was (0–1): a juicy ingredient spills there. */
  v?: number,
): number {
  const look = debrisLookFor(ingredientId, category);
  const solid = () => pieces.filter((p) => !isWet(p.kind)).length;
  let added = 0;
  while (added < count && solid() < DEBRIS.MAX) {
    const r = seeded(0x9e3779b9 ^ ++made);
    const [kind, color] = look[Math.floor(r() * look.length)] ?? FALLBACK[0]!;
    const near = r() < 0.5;
    const size =
      kind === "juice"
        ? 0.022 + r() * 0.016
        : kind === "skin"
          ? 0.016 + r() * 0.012
          : kind === "seed"
            ? 0.005 + r() * 0.003
            : kind === "cube"
              ? 0.011 + r() * 0.007
              : kind === "leaf"
                ? 0.012 + r() * 0.008
                : kind === "crumb"
                  ? 0.004 + r() * 0.004
                  : 0.009 + r() * 0.007;
    pieces = [
      ...pieces,
      {
        u: clamp01(u + (r() - 0.5) * 0.22, 0.06, 0.94),
        // The far (top) and near (bottom) margins of the face — clear of the food.
        v: near ? 0.85 + r() * 0.1 : 0.05 + r() * 0.1,
        kind,
        color,
        size,
        rot: r() * Math.PI,
        seed: Math.floor(r() * 1e9),
        wear: 0,
        smearU: 0,
        smearV: 0,
      },
    ];
    added++;
  }
  if (v !== undefined) spill(ingredientId, u, v);
  return added;
}

/**
 * A juicy cut spills: one puddle that runs out from under the cut (bigger
 * the juicier), and a droplet or two splashed a little further. Seeded like
 * the rest; bounded by DEBRIS.MAX_WET.
 */
function spill(ingredientId: IngredientId, u: number, v: number): void {
  const juice = JUICE[ingredientId];
  if (!juice) return;
  const wet = () => pieces.filter((p) => isWet(p.kind)).length;
  const r = seeded(0x51ed270b ^ ++made);
  if (r() > juice.amount) return;
  const place = (kind: DebrisKind, size: number, du: number, dv: number) => {
    if (wet() >= DEBRIS.MAX_WET) return;
    pieces = [
      ...pieces,
      {
        u: clamp01(u + du, 0.05, 0.95),
        v: clamp01(v + dv, 0.06, 0.94),
        kind,
        color: juice.color,
        size,
        rot: r() * Math.PI,
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
    (0.036 + r() * 0.03) * (0.6 + juice.amount * 0.6),
    (r() - 0.5) * 0.08,
    0.04 + r() * 0.12,
  );
  const drops = 1 + Math.floor(r() * (1 + juice.amount * 2));
  for (let i = 0; i < drops; i++) {
    const a = r() * Math.PI * 2;
    const d = 0.06 + r() * 0.12;
    place("drop", 0.003 + r() * 0.004, Math.cos(a) * d, Math.sin(a) * d * 1.6);
  }
}

/** The mess when the cloth first touched the board (the progress bar's 0). */
let wipeStart = 0;

/** How much of the mess the cloth has taken away, 0–1 (1 with nothing left). */
export function cleanProgress(): number {
  const left = messWeight(pieces);
  if (left <= 0) return 1;
  const start = Math.max(wipeStart, left);
  return Math.max(0, Math.min(1, 1 - left / start));
}

export type WipeResult = {
  /** Pieces the cloth picked up / wiped away on this rub. */
  cleared: number;
  /** Pieces it touched (worn, dragged or smeared). */
  touched: number;
};

/**
 * One rub of the cloth from (u0, v0) to (u1, v1) on the board face
 * (fractions): every piece under the cloth wears by the distance rubbed over
 * its toughness; solids are dragged along (more the fresher they are), juice
 * smears along the stroke; a piece worn through is gone.
 */
export function wipeDebris(u0: number, v0: number, u1: number, v1: number): WipeResult {
  if (wipeStart === 0) wipeStart = messWeight(pieces);
  const du = u1 - u0;
  const dv = v1 - v0;
  const len = Math.hypot(du, dv * 0.6);
  if (len <= 0) return { cleared: 0, touched: 0 };
  let cleared = 0;
  let touched = 0;
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
  return { cleared, touched };
}

/** The cloth was put away (skipped): the next clean-up measures its progress afresh. */
export function endWipe(): void {
  wipeStart = 0;
}
