import type { VariantId } from "./specialVariants";

/**
 * SIGNATURE_DISHES — Phase 4 (A, developer 2026-10-21): the Signature Dish
 * Collection — the recipe book's pages as a family collection, each dish
 * at one of three presentation tiers.
 *
 * WHAT IT READS. Only `recipeProgress[recipeId] = { best, done }`, which the
 * save has always held: `done` is set on every completion and `best` is
 * `max(previous best, this run's Knife Report score)` (App.tsx's
 * recordPreparationResult / the service recorders — replays included, as
 * replay is for personal mastery). So:
 * - the best result is the existing 0–100 Knife Report score; a worse run
 *   can never lower it (max), a tie changes nothing, and nothing here
 *   writes it;
 * - the tier is derived from it, so it is persistent with NO new save field;
 * - a level that can serve several recipes (an order pool, a batch group)
 *   shows its best recipe (max over its ids; ties: the same value).
 *
 * TIERS — the existing Knife Report grade thresholds (CutEvaluator's
 * GRADE_THRESHOLDS), nothing new to learn and no hidden luck:
 * - Homemade: prepared at least once;
 * - Chef's Special: a Clean plate or better (best ≥ 85);
 * - Grandma's Signature: a Masterful plate (best ≥ 95).
 * A tier never moves the score, a payout or a reward — it is a label.
 *
 * WHAT IS NOT SAVED (no approved field exists): the best combo on a recipe
 * and which special variant a recipe was made with are kept for this page
 * session only (`sessionDish`), and labelled as such in the book. A
 * persistent record of either needs a new save field — not added here;
 * proposed in the Phase 4 report for approval.
 *
 * The cookbook's existing rule — "no numeric readout of any kind" in the
 * Recipe Book (the plate is the score) — is kept: the book shows tiers and
 * grade words, never the score digits.
 */
export type PresentationTier = "homemade" | "chefs-special" | "grandmas-signature";

export const TIERS = {
  /** = the Knife Report's "Clean" grade. */
  CHEFS_SPECIAL_AT: 85,
  /** = the Knife Report's "Masterful" grade. */
  SIGNATURE_AT: 95,
} as const;

export const TIER_ORDER: readonly PresentationTier[] = [
  "homemade",
  "chefs-special",
  "grandmas-signature",
];

export const TIER_INFO: Record<
  PresentationTier,
  { name: string; icon: string; how: string; grade: string }
> = {
  homemade: {
    name: "Homemade",
    icon: "🏠",
    how: "Prepare the dish once — every family recipe starts here.",
    grade: "any grade",
  },
  "chefs-special": {
    name: "Chef's Special",
    icon: "⭐",
    how: "Serve it Clean or better on the Knife Report.",
    grade: "Clean",
  },
  "grandmas-signature": {
    name: "Grandma's Signature",
    icon: "👵",
    how: "Serve it Masterful on the Knife Report.",
    grade: "Masterful",
  },
};

/** The tier a recipe's saved best has reached; null when it has never been prepared. */
export function tierFor(best: number | null | undefined, done: boolean): PresentationTier | null {
  if (!done) return null;
  const b = best ?? 0;
  if (b >= TIERS.SIGNATURE_AT) return "grandmas-signature";
  if (b >= TIERS.CHEFS_SPECIAL_AT) return "chefs-special";
  return "homemade";
}

/** The next tier up and what it takes, or null at the top. */
export function nextTier(tier: PresentationTier | null): PresentationTier | null {
  if (tier === null) return "homemade";
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[i + 1] ?? null;
}

type Progress = Record<string, { best: number | null; done: boolean }>;

/** A level's record over the recipes it can serve: the best of them (deterministic: max; a tie is the same value). */
export function bestOfRecipes(
  progress: Progress,
  recipeIds: readonly string[],
): { best: number | null; done: boolean } {
  let best: number | null = null;
  let done = false;
  for (const id of recipeIds) {
    const p = progress[id];
    if (!p) continue;
    if (p.done) done = true;
    if (typeof p.best === "number" && (best === null || p.best > best)) best = p.best;
  }
  return { best, done };
}

/**
 * The milestone a finished run reaches, from the saved record BEFORE it and
 * this run's score — exactly what the save will hold after it (best = max).
 * Because `done` and `best` only ever grow, each milestone can happen once
 * per recipe, forever: a replay at the same or a lower level reveals
 * nothing. Returns the HIGHEST new tier reached (a first plate that is
 * already Masterful is a Signature, not three reveals).
 */
export function tierMilestone(
  before: { best: number | null; done: boolean } | undefined,
  score: number,
): PresentationTier | null {
  const prevTier = tierFor(before?.best ?? null, before?.done ?? false);
  const nextBest = Math.max(before?.best ?? 0, score);
  const newTier = tierFor(nextBest, true);
  if (newTier === null) return null;
  if (prevTier === null) return newTier;
  return TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(prevTier) ? newTier : null;
}

/** Collection totals for the book's header. */
export function collectionSummary(
  tiers: readonly (PresentationTier | null)[],
): Record<PresentationTier, number> & { prepared: number } {
  const out = { homemade: 0, "chefs-special": 0, "grandmas-signature": 0, prepared: 0 };
  for (const t of tiers) {
    if (!t) continue;
    out.prepared += 1;
    out[t] += 1;
  }
  return out;
}

// ── family memories ─────────────────────────────────────────────────────
// Short lines in the restaurant's own voice (the story's inherited restaurant and
// Grandma's notes on the first levels). One per tier, picked for the recipe
// by a fixed hash so a page always shows the same memory.
const MEMORIES: Record<PresentationTier, readonly string[]> = {
  homemade: [
    "A new page in the old recipe book — in your handwriting this time.",
    "Grandma kept every first attempt. “Nobody's first one is pretty,” she wrote.",
    "The ink is fresh, but the recipe is older than the restaurant.",
  ],
  "chefs-special": [
    "Grandma underlined the dishes she was proudest of. This one gets a line.",
    "“Good enough for the chalkboard,” Grandma would have said.",
    "Regulars used to ask for this one by name.",
  ],
  "grandmas-signature": [
    "Grandma's note in the margin: “Exactly like this.”",
    "This is how it tasted the night the restaurant first opened.",
    "A gold star in the old book — the kind she only gave on Sundays.",
  ],
};

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

/** The memory on `recipeId`'s page at `tier` (always the same one). */
export function memoryFor(recipeId: string, tier: PresentationTier): string {
  const lines = MEMORIES[tier];
  return lines[hash(`${recipeId}:${tier}`) % lines.length]!;
}

/** A special variant's own memory (shown when a dish is made with one). */
export const VARIANT_MEMORIES: Record<VariantId, string> = {
  "golden-tomato": "Grandma saved the golden tomatoes for Sunday lunch.",
  "giant-cucumber": "Grandma grew one this big once and showed the whole street.",
  "rainbow-carrot": "The rainbow carrots came from the neighbour's allotment, every autumn.",
  "frosted-onion": "First frost — Grandma said it made the onions sweeter.",
  "heirloom-pepper": "Grandma's heirloom peppers: the seeds came over in her coat pocket.",
};

// ── this page session only (no save field) ──────────────────────────────
type SessionDish = { bestCombo: number; variants: VariantId[] };
const session = new Map<string, SessionDish>();

/** Records a finished run's combo and variant for `recipeId` (memory only; a reload clears it). */
export function recordSessionDish(
  recipeId: string,
  combo: number,
  variant: VariantId | null,
): void {
  const prev = session.get(recipeId) ?? { bestCombo: 0, variants: [] };
  session.set(recipeId, {
    bestCombo: Math.max(prev.bestCombo, combo),
    variants:
      variant && !prev.variants.includes(variant) ? [...prev.variants, variant] : prev.variants,
  });
}

export function sessionDish(recipeIds: readonly string[]): SessionDish | null {
  const found = recipeIds.flatMap((id) => {
    const d = session.get(id);
    return d ? [d] : [];
  });
  if (found.length === 0) return null;
  return {
    bestCombo: Math.max(...found.map((d) => d.bestCombo)),
    variants: [...new Set(found.flatMap((d) => d.variants))],
  };
}

/** Test hook: a fresh page session. */
export function resetSessionDishesForTests(): void {
  session.clear();
}
