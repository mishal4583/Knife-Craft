/**
 * BUSINESS_MAINTENANCE — Economy V3 Phase 11. Business-Mode-only
 * maintenance/repair action for the refrigerator, built strictly ON TOP
 * OF Phase 10's own `businessEquipmentCondition.ts` — this file owns
 * MAINTENANCE ACTIONS, MAINTENANCE COSTS, and BREAKDOWN STATUS; it never
 * duplicates, re-derives independently, or moves Phase 10's own
 * condition/banding/decay/effect logic. `refrigeratorCondition` remains
 * the ONE persisted number (Phase 10's own field) — this phase adds NO
 * second condition field, no second wallet, no second ledger.
 *
 * The master spec's own states (§13): OPERATIONAL / NEEDS_SERVICE /
 * BROKEN / UNDER_REPAIR. Three of these — OPERATIONAL, NEEDS_SERVICE,
 * BROKEN — are a pure DERIVED status of the existing condition number
 * (`maintenanceStatusFor`, mirroring `conditionBandFor`'s own shape,
 * reusing its EXACT thresholds so there is only ever one banding scheme
 * to keep in sync, never a second one this file invents independently).
 * UNDER_REPAIR is the fourth state, and it is deliberately never a
 * PERSISTED status: every real action in this codebase (buyKnife,
 * sharpenKnife, purchaseRefrigerator, hireStaff, signContract) is an
 * atomic, instant, single-function-call transaction — there is no
 * multi-step/queued-action machinery anywhere in Business Mode for a
 * repair to meaningfully sit "in progress" between two different calls.
 * UNDER_REPAIR therefore appears as the maintenance TRANSACTION's own
 * transient, in-between label (`PerformMaintenanceResult.duringRepair`)
 * describing what happened during the atomic call — the persisted save
 * immediately reflects the real end state (`OPERATIONAL`) the instant
 * the transaction completes. This is a deliberate, documented reading of
 * the spec's own state list, not a missing feature: it also directly
 * satisfies "no permanent soft-lock" — there is never a tick where the
 * player is stuck waiting with an unusable fridge.
 *
 * "Breakdowns should be consequences of poor condition, not arbitrary
 * punishment" (spec's own words) is ALREADY true by construction:
 * Phase 10's own condition only ever falls through real, deterministic
 * ingredient-purchase usage (never Math.random()), and the BROKEN
 * maintenance status here is nothing more than a name for the exact same
 * band Phase 10 already penalizes (spoilage/popularity). Phase 11 adds
 * no new way to reach BROKEN and no random breakdown chance — it only
 * adds the missing RECOVERY action Phase 10's own doc explicitly
 * deferred ("No repair/maintenance action in V3-10... explicitly
 * deferred to V3-11").
 *
 * Data-driven cost (never a flat, arbitrary number): a real lookup table
 * keyed by maintenance status, mirroring Phase 10's own
 * `SPOILAGE_PENALTY_BY_BAND`/`POPULARITY_DELTA_BY_BAND` shape — a
 * NEEDS_SERVICE top-up costs less than a full BROKEN repair, and both
 * are far cheaper than replacing the refrigerator outright (150/400c vs
 * 4000/10000c — see refrigeratorDefinitions.ts), so repair is always the
 * economically sensible choice over premature replacement. A repair
 * always restores condition fully to 100, mirroring `sharpenKnife`'s and
 * `purchaseRefrigerator`'s own established "restore to full" precedent
 * — never a partial, newly-invented restoration curve.
 */
import type { SaveData } from "../SaveManager";
import {
  clampCondition,
  conditionBandFor,
  DEFAULT_EQUIPMENT_CONDITION_STATE,
} from "./businessEquipmentCondition";

export type MaintenanceStatus = "OPERATIONAL" | "NEEDS_SERVICE" | "BROKEN";

/**
 * Pure, deterministic — reuses `conditionBandFor`'s OWN thresholds
 * exactly (GOOD/WORN -> OPERATIONAL, POOR/CRITICAL -> NEEDS_SERVICE,
 * BROKEN -> BROKEN). Never a second, independently-tuned banding scheme.
 */
export function maintenanceStatusFor(condition: number): MaintenanceStatus {
  const band = conditionBandFor(condition);
  if (band === "GOOD" || band === "WORN") return "OPERATIONAL";
  if (band === "POOR" || band === "CRITICAL") return "NEEDS_SERVICE";
  return "BROKEN";
}

/**
 * Data-driven, not arbitrary — `null` for OPERATIONAL: nothing to repair,
 * so there is no cost to look up. Economy V3 Phase 14 — whole US cents,
 * calibrated as a labeled estimate against typical U.S. commercial
 * refrigeration service-call pricing (a minor service visit vs. a major
 * compressor-class repair) — see docs/ECONOMY_V3_MASTER_SPEC.md §24;
 * this specific figure is an industry-typical estimate, not individually
 * sourced from a single fetched citation, consistent with how §24 labels
 * every non-fetched figure. $150 for a minor service call, $400 for a
 * major repair — both comfortably below the cost of replacing the unit
 * outright (refrigeratorDefinitions.ts's own $2,000/$4,800 prices).
 */
const MAINTENANCE_COST_BY_STATUS: Record<MaintenanceStatus, number | null> = {
  OPERATIONAL: null,
  NEEDS_SERVICE: 15_000,
  BROKEN: 40_000,
};

/** `null` exactly when nothing needs repairing (OPERATIONAL) — the one place this table is read. */
export function maintenanceCostFor(condition: number): number | null {
  return MAINTENANCE_COST_BY_STATUS[maintenanceStatusFor(condition)];
}

export type PerformMaintenanceResult =
  | {
      ok: true;
      save: SaveData;
      cost: number;
      statusBefore: MaintenanceStatus;
      /** Always "UNDER_REPAIR" — the transaction's own transient label for the repair that just happened (see file header for why this is never a persisted status). */
      duringRepair: "UNDER_REPAIR";
      /** Always "OPERATIONAL" — a completed repair always fully restores condition, mirroring sharpenKnife/purchaseRefrigerator's own precedent. */
      statusAfter: "OPERATIONAL";
    }
  | { ok: false; reason: "alreadyOperational" | "insufficientFunds" };

/**
 * Atomic, mirroring sharpenKnife/purchaseRefrigerator exactly: either
 * credits drop by exactly the data-driven cost AND condition resets to
 * 100, or NOTHING changes at all. Never touches `business.inventory`,
 * `business.staff`, `business.popularity`, or any other Business Mode
 * field — repairing the refrigerator is its own isolated transaction,
 * exactly like every other purchase action in this codebase. Never
 * creates debt (CLAUDE.md's own "never allow credits < 0" rule) — an
 * unaffordable repair is rejected outright, leaving the save completely
 * untouched, the same as an unaffordable ingredient/refrigerator
 * purchase.
 */
export function performRefrigeratorMaintenance(save: SaveData): PerformMaintenanceResult {
  const condition = save.business.equipmentCondition.refrigeratorCondition;
  const statusBefore = maintenanceStatusFor(condition);
  if (statusBefore === "OPERATIONAL") return { ok: false, reason: "alreadyOperational" };
  const cost = MAINTENANCE_COST_BY_STATUS[statusBefore]!;
  if (save.credits < cost) return { ok: false, reason: "insufficientFunds" };
  return {
    ok: true,
    save: {
      ...save,
      credits: save.credits - cost,
      business: {
        ...save.business,
        equipmentCondition: {
          refrigeratorCondition: clampCondition(
            DEFAULT_EQUIPMENT_CONDITION_STATE.refrigeratorCondition,
          ),
        },
      },
    },
    cost,
    statusBefore,
    duringRepair: "UNDER_REPAIR",
    statusAfter: "OPERATIONAL",
  };
}
