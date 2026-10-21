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
 * tests are reproducible. Pieces sit in the board's far and near margins,
 * where the food doesn't, and are drawn under everything but the board.
 */
export const DEBRIS = {
  MAX: 40,
  CLEAN_AT: 30,
  PER_CUT: 1,
  PER_RING: 1,
  PER_SMASH: 2,
  PER_PEEL: 3,
  SWEEP_FRAC: 0.45,
} as const;

export type DebrisKind = "seed" | "scrap" | "skin" | "juice";

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
};

type Look = readonly (readonly [DebrisKind, number])[];

/** What each ingredient leaves behind — kind and colour pairs, picked in turn. */
const LOOKS: Partial<Record<IngredientId, Look>> = {
  tomato: [
    ["seed", 0xead27a],
    ["juice", 0xd9533e],
    ["seed", 0xf0dc8c],
  ],
  strawberry: [
    ["seed", 0xe9d48a],
    ["juice", 0xd23a48],
  ],
  pepper: [
    ["seed", 0xf3eccd],
    ["scrap", 0xd63c2c],
  ],
  cucumber: [
    ["scrap", 0x5f8f3e],
    ["seed", 0xdfe8c4],
    ["scrap", 0x8fb563],
  ],
  zucchini: [
    ["scrap", 0x4f7d32],
    ["seed", 0xe6e9c8],
  ],
  onion: [
    ["skin", 0xc9965a],
    ["skin", 0xe8d6b8],
    ["scrap", 0xf1e7d8],
  ],
  garlic: [
    ["skin", 0xf0e6d6],
    ["scrap", 0xf7f0e2],
  ],
  potato: [
    ["skin", 0xa47a4c],
    ["scrap", 0xf1dfa8],
  ],
  carrot: [
    ["scrap", 0xe8862f],
    ["skin", 0xd06f22],
  ],
  basil: [["scrap", 0x4f8a3a]],
  parsley: [["scrap", 0x5a9a3c]],
  mushroom: [["scrap", 0xcbb59a]],
  orange: [
    ["juice", 0xf0a030],
    ["skin", 0xe88a1c],
  ],
  lemon: [
    ["juice", 0xf3dc4a],
    ["seed", 0xf6efcf],
  ],
  apple: [
    ["seed", 0x5b3a22],
    ["scrap", 0xf2e6c2],
  ],
  bread: [["scrap", 0xd9a85c]],
  baguette: [["scrap", 0xd9a85c]],
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
  Herb: [["scrap", 0x4f8a3a]],
  Aromatic: [["skin", 0xe7d7bd]],
  Bakery: [["scrap", 0xd9a85c]],
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
  return pieces.length >= DEBRIS.CLEAN_AT;
}

/** The scrape: the board is clean again. */
export function clearDebris(): void {
  pieces = [];
}

/** Tests only: a brand-new session. */
export function resetDebrisForTests(): void {
  pieces = [];
  made = 0;
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
): number {
  const look = debrisLookFor(ingredientId, category);
  let added = 0;
  while (added < count && pieces.length < DEBRIS.MAX) {
    const r = seeded(0x9e3779b9 ^ ++made);
    const [kind, color] = look[Math.floor(r() * look.length)] ?? FALLBACK[0]!;
    const near = r() < 0.5;
    const size =
      kind === "juice"
        ? 0.022 + r() * 0.016
        : kind === "skin"
          ? 0.018 + r() * 0.012
          : kind === "seed"
            ? 0.006 + r() * 0.004
            : 0.01 + r() * 0.008;
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
      },
    ];
    added++;
  }
  return added;
}
