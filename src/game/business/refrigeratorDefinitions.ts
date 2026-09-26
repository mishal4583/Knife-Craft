/**
 * REFRIGERATOR_DEFINITIONS — Economy V3 Phase 3, recalibrated Phase 14.
 * The single authoritative refrigerator catalog, mirroring
 * kitchenInvestmentDefinitions.ts's own shape/doc style exactly.
 * Centralized here so nothing else in the codebase hardcodes a capacity
 * or price.
 *
 * A SEPARATE, NEW system from KITCHEN_UPGRADE_CATALOG (the six free
 * cosmetic kitchen-background tiers in kitchenUpgradeDefinitions.ts) —
 * never merged, never priced together, never sharing ownership state.
 * This catalog's own "basic-refrigerator" being free (price 0) is a
 * coincidence of both being a player's free starting point, not a sign
 * the two systems are related.
 *
 * Economy V3 Phase 14 — REAL-WORLD RECALIBRATION.
 *
 * `price` is now whole US cents, calibrated against real 2026 U.S.
 * commercial reach-in refrigerator market pricing (docs/
 * ECONOMY_V3_MASTER_SPEC.md §24 — The Restaurant Warehouse / Wilprep
 * Kitchen commercial refrigerator buyer's guides, September 2026):
 * Commercial ($2,000, a single-door reach-in, ~17.6-22 cu ft real
 * market range $1,800-$2,500) and Professional ($4,800, a three-door
 * reach-in, ~54-68 cu ft real market range $4,500-$5,000).
 *
 * `capacity` (the abstract "how many real ingredient units fit"
 * number every prior V3-3/V3-7/V3-10/V3-11 test already exercises) is
 * DELIBERATELY left numerically unchanged — rearchitecting it into a
 * real, density-weighted cubic-foot accounting model (a lb of leafy
 * greens takes far more volume than a lb of meat) would be a much
 * larger, higher-risk change than this phase's own "smallest data-
 * driven change" rule allows, and would invalidate the storage-
 * capacity invariants three prior phases' QA already locks in. Per the
 * master spec's own "where feasible" qualifier, this phase instead adds
 * `approxCubicFeet` as an honest, clearly-derived REAL-WORLD DISPLAY
 * label only (capacity / 2, a documented rule-of-thumb ratio for mixed
 * refrigerated restaurant stock) — never read by any storage/capacity
 * logic, purely for the UI to show a believable physical size alongside
 * the existing abstract count.
 */
import type { RefrigeratorDefinition } from "./refrigeratorTypes";

export const DEFAULT_REFRIGERATOR_ID = "basic-refrigerator";

/** Rule-of-thumb only, for `approxCubicFeet` display — never used by any real capacity/storage calculation. */
const APPROX_LB_PER_CUBIC_FOOT = 2;

export const REFRIGERATOR_CATALOG: RefrigeratorDefinition[] = [
  {
    id: "basic-refrigerator",
    name: "Basic Refrigerator",
    description: "A single-door reach-in — enough to get the restaurant started.",
    capacity: 40,
    price: 0,
    approxCubicFeet: Math.round(40 / APPROX_LB_PER_CUBIC_FOOT),
  },
  {
    id: "commercial-refrigerator",
    name: "Commercial Refrigerator",
    description: "A two-door reach-in, built for a busier kitchen.",
    capacity: 80,
    price: 200_000,
    approxCubicFeet: Math.round(80 / APPROX_LB_PER_CUBIC_FOOT),
  },
  {
    id: "professional-refrigerator",
    name: "Professional Refrigerator",
    description: "A three-door reach-in for a restaurant running at scale.",
    capacity: 140,
    price: 480_000,
    approxCubicFeet: Math.round(140 / APPROX_LB_PER_CUBIC_FOOT),
  },
];

export function getRefrigerator(id: string): RefrigeratorDefinition | undefined {
  return REFRIGERATOR_CATALOG.find((r) => r.id === id);
}

export function getAllRefrigerators(): RefrigeratorDefinition[] {
  return REFRIGERATOR_CATALOG;
}
