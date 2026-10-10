/**
 * BUSINESS_INSPECTION — Economy V3 Phase 12. Business-Mode-only
 * inspection EVALUATION — this file owns inspection CRITERIA and
 * RESULTS only, never a financial consequence (that is explicitly
 * Phase 13's job: "V3-13 will own inspection fines/financial
 * penalties"). Nothing here ever reads or writes `SaveData.credits` or
 * `SaveData.economyLedger`.
 *
 * Deliberately NO new persisted state: master spec §12 lists PASS/
 * WARNING/FAIL as `InspectionResult` — already defined and unit-tested
 * back in Phase 6 (`PopularityManager.ts`'s own forward hook,
 * `inspectionDelta`, written with no real caller until now) — and every
 * one of the spec's seven categories (§14) is fully computable from
 * Business Mode state that ALREADY persists (inventory, refrigerator
 * condition, staff roster, the day's own spoilage, calendar day).
 * CLAUDE.md's own instruction ("If it can be derived from existing
 * Business Mode state, prefer deriving it rather than duplicating
 * state") is followed literally: `inspectBusiness` is a pure function
 * of the save, re-evaluated fresh every time it's called — for the
 * live "Inspections" screen (always current, never stale) AND for the
 * one real automatic run each End Business Day
 * (`BusinessDayManager.endBusinessDay`, composing `inspectionDelta`
 * into that day's popularity movement exactly the way Phase 9's staff
 * effect and Phase 10's refrigerator effect already compose — never a
 * new popularity pipeline). No inspection state is EVER written to
 * `SaveData.business` — there is nothing to migrate, nothing that can
 * drift out of sync with the state it's derived from, and no second
 * copy of anything Phase 10/11 already owns.
 *
 * REFRIGERATOR_CONDITION and EQUIPMENT_CONDITION are, honestly, the
 * SAME underlying signal today: Business Mode currently owns exactly
 * one piece of real equipment (the refrigerator — see
 * businessEquipmentCondition.ts's own doc on why that file has only one
 * field). The master spec lists both as named categories, so both
 * appear in the report, but neither invents a second, fake condition
 * number — if a later phase ever adds a second piece of owned
 * equipment, EQUIPMENT_CONDITION is where that would generalize.
 *
 * Deterministic throughout — every category reads only real, already-
 * persisted numbers (inventory ages, refrigerator condition, hired
 * roles, the day's own spoilage, cash on hand); no Math.random() anywhere.
 */
import type { SaveData } from "../SaveManager";
import { getInventoryUsedCapacity, getRefrigeratorCapacity } from "./RefrigeratorManager";
import { perishabilityStateFor } from "./perishability";
import { conditionBandFor } from "./businessEquipmentCondition";
import { dailyPayroll } from "./businessStaff";
import { formatUsd } from "./businessCurrency";
import { normalizeQuantity, formatQuantity } from "./businessInventory";
import type { InspectionResult } from "./PopularityManager";
import { hygieneIssue } from "../restaurant/hygiene";

export type InspectionCategory =
  | "FOOD_STORAGE"
  | "INGREDIENT_EXPIRY"
  | "REFRIGERATOR_CONDITION"
  | "EQUIPMENT_CONDITION"
  | "KITCHEN_CLEANLINESS"
  | "FOOD_SAFETY"
  | "STAFF_COMPLIANCE";

export type CategoryInspectionResult = {
  category: InspectionCategory;
  result: InspectionResult;
  /** Master spec §14: "Every result must explain why." Always a concrete, state-derived sentence — never a generic placeholder. */
  reason: string;
};

export type InspectionReport = {
  /** The worst individual category result (FAIL > WARNING > PASS) — a standard "weakest link" inspection rule, not an arbitrary average. */
  overall: InspectionResult;
  overallReason: string;
  categories: CategoryInspectionResult[];
};

function worstOf(a: InspectionResult, b: InspectionResult): InspectionResult {
  const rank: Record<InspectionResult, number> = { PASS: 0, WARNING: 1, FAIL: 2 };
  return rank[b] > rank[a] ? b : a;
}

/** "Food Storage" — how full the refrigerator is. Overcrowded storage is a real food-storage concern; never a fake always-PASS check even though the atomic purchase/upgrade guards already prevent going OVER capacity. */
function inspectFoodStorage(save: SaveData): CategoryInspectionResult {
  const used = getInventoryUsedCapacity(save.business.inventory);
  const capacity = getRefrigeratorCapacity(save.business.refrigerator.refrigeratorId);
  const fraction = capacity > 0 ? used / capacity : 0;
  if (fraction >= 0.95) {
    return {
      category: "FOOD_STORAGE",
      result: "FAIL",
      reason: `Storage is critically overcrowded (${used}/${capacity} used).`,
    };
  }
  if (fraction >= 0.75) {
    return {
      category: "FOOD_STORAGE",
      result: "WARNING",
      reason: `Storage is nearly full (${used}/${capacity} used).`,
    };
  }
  return {
    category: "FOOD_STORAGE",
    result: "PASS",
    reason: `Storage has healthy headroom (${used}/${capacity} used).`,
  };
}

/** "Ingredient Expiry" — whether anything currently on hand is already near or past its shelf life. */
function inspectIngredientExpiry(save: SaveData): CategoryInspectionResult {
  const currentDay = save.business.calendar.businessDay;
  let expiredCount = 0;
  let nearExpiryCount = 0;
  for (const entry of Object.values(save.business.inventory)) {
    if (!entry) continue;
    const state = perishabilityStateFor(entry.ingredientId, entry.purchaseDay, currentDay);
    if (state === "EXPIRED") expiredCount++;
    else if (state === "NEAR_EXPIRY") nearExpiryCount++;
  }
  if (expiredCount > 0) {
    return {
      category: "INGREDIENT_EXPIRY",
      result: "FAIL",
      reason: `${expiredCount} ingredient${expiredCount === 1 ? "" : "s"} in storage ${expiredCount === 1 ? "is" : "are"} already expired.`,
    };
  }
  if (nearExpiryCount > 0) {
    return {
      category: "INGREDIENT_EXPIRY",
      result: "WARNING",
      reason: `${nearExpiryCount} ingredient${nearExpiryCount === 1 ? "" : "s"} ${nearExpiryCount === 1 ? "is" : "are"} nearing its shelf life.`,
    };
  }
  return {
    category: "INGREDIENT_EXPIRY",
    result: "PASS",
    reason: "Nothing in storage is close to expiring.",
  };
}

/** "Refrigerator Condition" — reuses Phase 10's own banding exactly; never a second, independently-tuned scale. */
function inspectRefrigeratorCondition(save: SaveData): CategoryInspectionResult {
  const condition = save.business.equipmentCondition.refrigeratorCondition;
  const band = conditionBandFor(condition);
  if (band === "BROKEN") {
    return {
      category: "REFRIGERATOR_CONDITION",
      result: "FAIL",
      reason: `The refrigerator is broken down (condition ${condition}/100).`,
    };
  }
  if (band === "POOR" || band === "CRITICAL") {
    return {
      category: "REFRIGERATOR_CONDITION",
      result: "WARNING",
      reason: `The refrigerator is due for service (condition ${condition}/100).`,
    };
  }
  return {
    category: "REFRIGERATOR_CONDITION",
    result: "PASS",
    reason: `The refrigerator is in good working order (condition ${condition}/100).`,
  };
}

/** "Equipment Condition" — see file header: the same real signal as REFRIGERATOR_CONDITION today, since that is the only equipment Business Mode owns. */
function inspectEquipmentCondition(save: SaveData): CategoryInspectionResult {
  const fridge = inspectRefrigeratorCondition(save);
  return {
    category: "EQUIPMENT_CONDITION",
    result: fridge.result,
    reason:
      fridge.result === "PASS"
        ? "All owned equipment (the refrigerator) is in good working order."
        : `The refrigerator, the only equipment currently owned, needs attention (condition ${save.business.equipmentCondition.refrigeratorCondition}/100).`,
  };
}

const CLEANLINESS_WARNING_SPOILAGE = 15;
const CLEANLINESS_FAIL_SPOILAGE = 50;

/**
 * "Kitchen Cleanliness" — a hired Cleaner (Phase 9) is a direct, real
 * proxy for sanitation staffing; otherwise the food spoiled on THIS
 * Business Day is the signal.
 *
 * Economy V3 Phase 16 (final audit, P0 fix): this used the LIFETIME
 * spoilage total, which never decreases — once 15 units had ever
 * spoiled, every later day was a WARNING (50: a FAIL) forever, fined
 * daily as a repeated violation, with no way back short of permanent
 * payroll. The §21 simulation showed that one-way ratchet on 290-360
 * days/year for every profile without a Cleaner. It now reads only the
 * day's own spoilage (`daySpoiledQuantity`, the units End Business Day's
 * sweep just removed), with the SAME 15/50 thresholds. The lifetime
 * total is still kept for the P&L/Dashboard; it just no longer decides
 * today's inspection.
 */
function inspectKitchenCleanliness(
  save: SaveData,
  daySpoiledQuantity: number,
): CategoryInspectionResult {
  const hasCleaner = save.business.staff.hiredRoles.includes("cleaner");
  if (hasCleaner) {
    return {
      category: "KITCHEN_CLEANLINESS",
      result: "PASS",
      reason: "A Cleaner is on staff keeping the kitchen sanitary.",
    };
  }
  const spoiledToday = normalizeQuantity(daySpoiledQuantity);
  // Supplies plan D: the restaurant's last service (soap, dirty pieces,
  // cleaning liquid) — only restaurant saves keep this record.
  const hygiene = hygieneIssue(save);
  if (hygiene && spoiledToday < CLEANLINESS_FAIL_SPOILAGE) {
    return {
      category: "KITCHEN_CLEANLINESS",
      result: "WARNING",
      reason: `No Cleaner on staff. ${hygiene}`,
    };
  }
  if (spoiledToday >= CLEANLINESS_FAIL_SPOILAGE) {
    return {
      category: "KITCHEN_CLEANLINESS",
      result: "FAIL",
      reason: `No Cleaner on staff, and ${formatQuantity(spoiledToday)} units of food spoiled today.`,
    };
  }
  if (spoiledToday >= CLEANLINESS_WARNING_SPOILAGE) {
    return {
      category: "KITCHEN_CLEANLINESS",
      result: "WARNING",
      reason: `No Cleaner on staff, and ${formatQuantity(spoiledToday)} units of food spoiled today.`,
    };
  }
  return {
    category: "KITCHEN_CLEANLINESS",
    result: "PASS",
    reason:
      spoiledToday > 0
        ? `No Cleaner on staff; ${formatQuantity(spoiledToday)} units spoiled today — under the ${CLEANLINESS_WARNING_SPOILAGE}-unit warning level.`
        : "No Cleaner on staff, but nothing has spoiled today.",
  };
}

/** "Food Safety" — the weakest of ingredient freshness and refrigeration, the two real signals that actually determine food safety in this simulation. Never a third, independently-invented metric. */
function inspectFoodSafety(save: SaveData): CategoryInspectionResult {
  const expiry = inspectIngredientExpiry(save);
  const fridge = inspectRefrigeratorCondition(save);
  const result = worstOf(expiry.result, fridge.result);
  const reason =
    result === "PASS"
      ? "Ingredients are fresh and refrigeration is working correctly."
      : `Food safety risk: ${result === expiry.result ? expiry.reason : fridge.reason}`;
  return { category: "FOOD_SAFETY", result, reason };
}

/** "Staff Compliance where applicable" — PASSes trivially with no staff (the category doesn't apply); once staff exist, whether today's cash on hand can actually cover their payroll is the real, always-available compliance signal (see businessStaff.ts's own dailyPayroll and BusinessDayManager's insolvency safety net). */
function inspectStaffCompliance(save: SaveData): CategoryInspectionResult {
  const hiredRoles = save.business.staff.hiredRoles;
  if (hiredRoles.length === 0) {
    return {
      category: "STAFF_COMPLIANCE",
      result: "PASS",
      reason: "Not applicable — no staff currently employed.",
    };
  }
  const payroll = dailyPayroll(hiredRoles);
  if (save.credits < payroll) {
    return {
      category: "STAFF_COMPLIANCE",
      result: "WARNING",
      reason: `Cash on hand (${formatUsd(save.credits)}) can't currently cover the ${formatUsd(payroll)} daily payroll.`,
    };
  }
  return {
    category: "STAFF_COMPLIANCE",
    result: "PASS",
    reason: "Staff payroll is fully covered by cash on hand.",
  };
}

/**
 * The one function that evaluates every category and combines them into
 * an overall PASS/WARNING/FAIL — pure, deterministic, callable at any
 * time on any save. `BusinessDayManager.endBusinessDay` calls this once
 * per day (on the save reflecting that day's post-spoilage-cleanup
 * inventory, per the master spec's own Business Day Flow ordering:
 * Spoilage -> Supplier Events -> Inspection -> Daily P&L); the
 * Inspections screen calls it fresh on every render for a live,
 * always-current view. Neither caller stores the result anywhere.
 */
export function inspectBusiness(
  save: SaveData,
  /** Units spoiled on the day being inspected — End Business Day passes its own sweep's `spoiledQuantity`. Omitted (0) for the live "right now" view: spoilage is only ever swept at End Business Day, so nothing has spoiled yet today until then. */
  daySpoiledQuantity = 0,
): InspectionReport {
  const categories: CategoryInspectionResult[] = [
    inspectFoodStorage(save),
    inspectIngredientExpiry(save),
    inspectRefrigeratorCondition(save),
    inspectEquipmentCondition(save),
    inspectKitchenCleanliness(save, daySpoiledQuantity),
    inspectFoodSafety(save),
    inspectStaffCompliance(save),
  ];
  let overall: InspectionResult = "PASS";
  for (const c of categories) overall = worstOf(overall, c.result);
  const failing = categories.filter((c) => c.result !== "PASS");
  const overallReason =
    failing.length === 0
      ? "All inspection categories passed."
      : failing.map((c) => c.reason).join(" ");
  return { overall, overallReason, categories };
}
