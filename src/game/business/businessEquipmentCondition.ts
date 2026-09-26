/**
 * BUSINESS_EQUIPMENT_CONDITION — Economy V3 Phase 10. Business-Mode-only
 * equipment condition — deliberately a SEPARATE mechanic from Economy
 * V2's own Campaign knife sharpness (`sharpness.ts`'s `knifeSharpness`,
 * a top-level SaveData field) and equipment specialization
 * (`equipmentSpecialization.ts`), which this file never reads, writes,
 * or duplicates (master spec §12: "Existing sharpness and equipment
 * specialization remain separate"). Those two stay exactly as they are:
 * Campaign-only, frozen, driven by completed recipes.
 *
 * What IS reused is the ARCHITECTURE — sharpness.ts's own shape almost
 * exactly: a 0-100 integer condition, decaying by a small deterministic
 * amount per real usage event (never a timer, never Math.random()),
 * with its own display banding. The banding here uses the MASTER SPEC'S
 * OWN THRESHOLDS (100-80 GOOD / 79-60 WORN / 59-40 POOR / 39-20 CRITICAL
 * / 19-0 BROKEN) — deliberately different numbers from sharpness.ts's
 * own bands, since the two systems are independent by design.
 *
 * Business Mode currently owns exactly ONE piece of real equipment — the
 * refrigerator (refrigeratorDefinitions.ts/RefrigeratorManager.ts,
 * Phase 3). Condition tracks that one asset; inventing a second,
 * not-yet-requested equipment catalog (ovens, prep stations, etc.) would
 * be exactly the "arbitrary" scope CLAUDE.md warns against, so this
 * phase is deliberately scoped to what Business Mode actually owns
 * today. The shape (`refrigeratorCondition` as its own field, not a
 * per-id record) reflects that there is only ever one owned refrigerator
 * at a time (Phase 3's own "one owned at a time" rule) — no fake keying
 * for a singleton.
 *
 * "Declines through actual usage" (brief) is read literally: condition
 * only decays when REAL stock is loaded into the refrigerator
 * (BusinessInventoryManager.purchaseIngredient), scaled by how much was
 * loaded — never on the mere passage of a Business Day, which would be
 * a timer in disguise.
 *
 * Economy V3 Phase 16 (P2 remediation): wear is now strictly per UNIT
 * stocked — 1 point per DECAY_DIVISOR (10) units, the same rate the old
 * rule's own round(quantity / 10) was built on — with the sub-point
 * remainder carried in `wearCarryUnits`. The old rule charged per purchase
 * TRANSACTION with a 1-point floor and a 3-point ceiling, so wear tracked
 * how many times the player tapped "Buy", not how much the fridge was
 * used: 25 units bought as five lots cost 5 points, in one lot 3, and
 * 1,000 units in one lot still only 3. The V3-16 simulation showed the
 * consequence — just-in-time buying (lot 1, near-zero spoilage) needed a
 * $150 repair every ~2 days and went broke by day 83. Per-unit carry is
 * split-invariant (the same units always cost the same wear, however
 * they are bought) and closes the bulk-buy under-wear. The rate itself
 * is unchanged. Buying (or upgrading to) a refrigerator resets
 * its condition to 100 — a new unit starts in perfect condition,
 * mirroring `sharpenKnife`'s own "restore to full" precedent.
 *
 * Per the master spec's own "may affect: waste, quality consistency,
 * efficiency" — this phase wires exactly two of those into
 * ALREADY-EXISTING Business Mode mechanisms (never a third invented
 * pipeline): "waste" -> a real multiplier on SpoilageManager's own
 * recorded spoiled value (composes with, and is independent of, Phase
 * 9's Cleaner reduction); "quality consistency" -> a real term in
 * PopularityManager.dailyPopularityDelta. Repair/maintenance/condition
 * RESTORATION is explicitly Phase 11's job (master spec §13) — this
 * phase only ever decreases condition; there is no repair action here.
 * A fully BROKEN fridge never blocks storage/purchases outright (never
 * a fail state, mirroring sharpness.ts's own "never a fail state" law)
 * — only the two small penalties above ever apply.
 */

export type ConditionBand = "GOOD" | "WORN" | "POOR" | "CRITICAL" | "BROKEN";

export type BusinessEquipmentConditionState = {
  /** Always an integer in [0, 100] — see `clampCondition`, the ONE place that range is enforced. */
  refrigeratorCondition: number;
  /** Economy V3 Phase 16 — units stocked since the last whole wear point, always in [0, DECAY_DIVISOR). Absent (older saves) means 0. */
  wearCarryUnits?: number;
};

export const DEFAULT_EQUIPMENT_CONDITION_STATE: BusinessEquipmentConditionState = {
  refrigeratorCondition: 100,
};

/** The one clamp — every writer of `refrigeratorCondition` calls this, so the range invariant can never be violated by a new call site forgetting to enforce it itself. */
export function clampCondition(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** The master spec's own exact thresholds (§12) — deliberately distinct from sharpness.ts's own SharpnessLabel bands. */
export function conditionBandFor(condition: number): ConditionBand {
  const c = clampCondition(condition);
  if (c >= 80) return "GOOD";
  if (c >= 60) return "WORN";
  if (c >= 40) return "POOR";
  if (c >= 20) return "CRITICAL";
  return "BROKEN";
}

/** Units of stock per 1 point of refrigerator wear. */
export const DECAY_DIVISOR = 10;

/**
 * Deterministic, split-invariant wear for loading `quantity` units of
 * stock (Economy V3 Phase 16 — see file header). Whole units only (the
 * purchase gate is integer). Pure: returns the new condition and the new
 * carry; the exact same state + quantity always gives the exact same
 * result, and N units cost the same total wear whether bought at once or
 * in pieces.
 */
export function applyStockingWear(
  state: BusinessEquipmentConditionState,
  quantity: number,
): BusinessEquipmentConditionState {
  const units = (state.wearCarryUnits ?? 0) + Math.max(0, Math.floor(quantity));
  const points = Math.floor(units / DECAY_DIVISOR);
  return {
    refrigeratorCondition: clampCondition(state.refrigeratorCondition - points),
    wearCarryUnits: units % DECAY_DIVISOR,
  };
}

const SPOILAGE_PENALTY_BY_BAND: Record<ConditionBand, number> = {
  GOOD: 1,
  WORN: 1,
  POOR: 1.1,
  CRITICAL: 1.25,
  BROKEN: 1.5,
};

/** "Waste" (master spec) — a real multiplier on the RECORDED spoiled value, applied by BusinessDayManager alongside (and independently of) Phase 9's Cleaner reduction. 1.0 (no penalty) at GOOD/WORN condition. */
export function refrigeratorSpoilagePenaltyMultiplier(condition: number): number {
  return SPOILAGE_PENALTY_BY_BAND[conditionBandFor(condition)];
}

const POPULARITY_DELTA_BY_BAND: Record<ConditionBand, number> = {
  GOOD: 0,
  WORN: 0,
  POOR: -1,
  CRITICAL: -2,
  BROKEN: -3,
};

/** "Quality consistency" (master spec) — composes directly into PopularityManager.dailyPopularityDelta. 0 at GOOD/WORN condition. */
export function refrigeratorPopularityDelta(condition: number): number {
  return POPULARITY_DELTA_BY_BAND[conditionBandFor(condition)];
}
