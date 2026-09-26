/**
 * DEMAND_MANAGER — Economy V3 Phase 6. Customer demand/order-frequency/
 * willingness-to-pay, every one a PURE function of the persisted
 * popularity score — never a second stored value (mirrors
 * businessCalendar.ts's `dayOfWeekFor`/`businessWeekFor`, both derived
 * from `businessDay` rather than cached alongside it).
 *
 * Economy V3 Phase 16 — both multipliers are live in Business Mode only,
 * each applied at exactly one point in BusinessServiceManager.ts:
 * `willingnessToPayMultiplierFor` sets what a customer pays
 * (`businessCustomerPayment`), `orderFrequencyMultiplierFor` sets how many
 * customers a Business Day brings (`businessCustomersToday`).
 */
export type DemandLevel = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";

/** Deterministic thresholds — no Math.random() anywhere. */
export function demandLevelFor(score: number): DemandLevel {
  if (score < 25) return "LOW";
  if (score < 50) return "MODERATE";
  if (score < 75) return "HIGH";
  return "VERY_HIGH";
}

/** Range [0.5, 1.5] — Business Mode's customers per day = BASE_CUSTOMERS_PER_DAY × this multiplier at the day's popularity (Economy V3 Phase 16; applied only in BusinessServiceManager.businessCustomersToday). */
export function orderFrequencyMultiplierFor(score: number): number {
  return Math.round((0.5 + score / 100) * 100) / 100;
}

/** Range [0.9, 1.2] — the customer's willingness to pay: Business Mode charges menu price × this multiplier at the current popularity (Economy V3 Phase 16; applied only in BusinessServiceManager.businessCustomerPayment). */
export function willingnessToPayMultiplierFor(score: number): number {
  return Math.round((0.9 + (score / 100) * 0.3) * 100) / 100;
}
