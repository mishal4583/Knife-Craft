import { qualityFor } from "../CutEvaluator";

/**
 * CUSTOMER_TIPS — Phase 2 (C3, developer decision 2026-10-21), widened on the
 * developer's request 2026-10-26 ("let them leave some tips along with
 * payment"): every paid customer leaves a tip that follows the dish.
 *
 * The rule, all from TIPS below — no random numbers anywhere:
 * - only a campaign order being PAID FOR THE FIRST TIME (the same
 *   `isReplay` / `mayPayOrder` gate as the order's own settlement), so a
 *   replay can never tip, and no order can tip twice;
 * - the share follows the dish's grade (CutEvaluator's own grade — the very
 *   score the settlement is computed from): Masterful 15 %, Clean 10 %,
 *   Honest 5 %, a weaker dish none;
 * - in whole dollars, at least MIN_CENTS; an order that paid nothing never tips.
 * (Until 2026-10-26 only a Masterful dish tipped, on one order in three —
 * `isTippingOrder` is kept for that history and its test.)
 *
 * Money: a tip is real, extra money on top of the frozen campaign economy
 * (like the ad bonuses), credited by App in the SAME save write as the
 * order's settlement, as its own `customer-tip` ledger entry — the order's
 * pay is never changed. Worst case (every paid order Masterful) is bounded
 * by MAX_SHARE_OF_INCOME, checked over the real campaign by
 * scripts/phase2-qa.mts.
 */
export const TIPS = {
  EVERY_NTH: 3,
  /** The tip's share of the order's pay, by the dish's grade (absent: no tip). */
  PCT_BY_GRADE: { Masterful: 0.15, Clean: 0.1, Honest: 0.05 } as Readonly<
    Partial<Record<string, number>>
  >,
  /** The old single rate (Masterful, one order in three), kept for `tipAmount`'s callers. */
  PCT: 0.1,
  MIN_CENTS: 100,
  /** Whole dollars. */
  ROUND_TO_CENTS: 100,
  MAX_SHARE_OF_INCOME: 0.1,
} as const;

/** FNV-1a: a fixed, platform-independent hash of the order's identity. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * murmur3's 32-bit finalizer. FNV-1a alone mixes its low bits poorly for
 * near-identical keys ("level-7|camp-x|0", "…|1"), and `% 3` reads exactly
 * those bits: over the real 150-level campaign it picked 98 of 242 orders
 * (40.5%), well outside chance for one in three. Finalized, it picks 71
 * (29.3%), inside the expected 80.7 ± 2σ — checked by phase2-qa C8.
 */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** True for the one-in-EVERY_NTH orders whose customer tips a Masterful dish. Fixed per order, forever. */
export function isTippingOrder(levelId: string, recipeId: string, orderIndex: number): boolean {
  return fmix32(fnv1a(`${levelId}|${recipeId}|${orderIndex}`)) % TIPS.EVERY_NTH === 0;
}

/** The tip for a pay of `payCents` at `pct` (default PCT): in whole dollars, at least MIN_CENTS. */
export function tipAmount(payCents: number, pct: number = TIPS.PCT): number {
  const amount = Math.round((payCents * pct) / TIPS.ROUND_TO_CENTS) * TIPS.ROUND_TO_CENTS;
  return Math.max(TIPS.MIN_CENTS, amount);
}

/**
 * The tip (cents) this serve earns, or 0. `firstPayment` is the order's own
 * "this pays" decision (not a replay, still owed). `levelId`, `recipeId` and
 * `orderIndex` identify the order (kept for callers; the share no longer
 * depends on them).
 */
export function tipFor(input: {
  firstPayment: boolean;
  levelId: string;
  recipeId: string;
  orderIndex: number;
  score: number;
  payCents: number;
}): number {
  if (!input.firstPayment || !(input.payCents > 0)) return 0;
  const pct = TIPS.PCT_BY_GRADE[qualityFor(input.score)];
  if (!pct) return 0;
  return tipAmount(input.payCents, pct);
}

/**
 * A tip scaled by the hygiene share (1 = unchanged; < 1 a dirty restaurant, > 1 a spotless one; see
 * cleanliness.tipHygieneShare), still whole dollars, never below the minimum, never negative.
 */
export function tipAfterHygiene(tipCents: number, share: number): number {
  if (!(tipCents > 0) || share === 1) return tipCents;
  const scaled =
    Math.round((tipCents * Math.max(0, share)) / TIPS.ROUND_TO_CENTS) * TIPS.ROUND_TO_CENTS;
  return Math.max(TIPS.MIN_CENTS, scaled);
}
