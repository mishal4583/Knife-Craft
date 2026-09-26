/**
 * BUSINESS_POPULARITY — Economy V3 Phase 6. The persisted 0-100
 * reputation score itself. Deliberately just the one number (mirrors
 * businessCalendar.ts's own "deliberately just the one counter" doc) —
 * everything derived FROM it (demand level, order-frequency multiplier,
 * willingness-to-pay multiplier) is a pure function in DemandManager.ts,
 * never a second stored value that could drift out of sync.
 *
 * Starts at 50 (neutral) — a brand-new restaurant has no reputation yet,
 * positive or negative, so it starts in the exact middle of the range
 * rather than defaulting to either extreme.
 */
export type BusinessPopularityState = {
  /** Always an integer in [0, 100] — see `clampScore`, the ONE place that range is enforced. */
  score: number;
};

export const DEFAULT_POPULARITY_STATE: BusinessPopularityState = { score: 50 };

/** The one clamp — every writer of `score` (PopularityManager.applyPopularityDelta, BusinessDayManager) calls this, so the range invariant can never be violated by a new call site forgetting to enforce it itself. */
export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
