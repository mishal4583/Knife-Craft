import { qualityFor } from "../CutEvaluator";

/**
 * CUSTOMER_TIPS — Phase 2 (C3, developer decision 2026-10-21): an
 * occasional generous tip for an exceptional dish.
 *
 * The rule, all from TIPS below — no random numbers anywhere:
 * - only a campaign order being PAID FOR THE FIRST TIME (the same
 *   `isReplay` / `mayPayOrder` gate as the order's own settlement), so a
 *   replay can never tip, and no order can tip twice;
 * - only a dish graded Masterful (CutEvaluator's own grade, 95+ — the very
 *   score the settlement is computed from);
 * - only every EVERY_NTH such order, picked by a fixed hash of the level, the
 *   recipe and the order's place in the level: the same order always tips
 *   or never does, so it is a surprise to the player but never a gamble;
 * - the tip is PCT of that order's own pay, in whole dollars, at least
 *   MIN_CENTS; an order that paid nothing never tips.
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
  PCT: 0.1,
  MIN_CENTS: 500,
  /** Whole dollars. */
  ROUND_TO_CENTS: 100,
  MAX_SHARE_OF_INCOME: 0.05,
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

/** The tip for a pay of `payCents`: PCT of it in whole dollars, at least MIN_CENTS. */
export function tipAmount(payCents: number): number {
  const pct = Math.round((payCents * TIPS.PCT) / TIPS.ROUND_TO_CENTS) * TIPS.ROUND_TO_CENTS;
  return Math.max(TIPS.MIN_CENTS, pct);
}

/**
 * The tip (cents) this serve earns, or 0. `firstPayment` is the order's own
 * "this pays" decision (not a replay, still owed); `orderIndex` is how many
 * of the level's orders were paid before this one.
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
  if (qualityFor(input.score) !== "Masterful") return 0;
  if (!isTippingOrder(input.levelId, input.recipeId, input.orderIndex)) return 0;
  return tipAmount(input.payCents);
}
