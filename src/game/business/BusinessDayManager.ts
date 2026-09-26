/**
 * BUSINESS_DAY_MANAGER — Economy V3 Phase 4 (extended Phase 6, Phase 7,
 * Phase 9). The ONE place that composes "advance the calendar"
 * (businessCalendar.ts, Phase 1), "clear expired stock"
 * (SpoilageManager.ts, Phase 4), "apply today's popularity movement"
 * (PopularityManager.ts, Phase 6, now including staff), "expire a
 * finished supplier contract" (businessSupplierContract.ts, Phase 7),
 * and "pay today's staff payroll" (businessStaff.ts, Phase 9) into the
 * single "End Business Day" action — mirroring the Business Day Flow
 * diagram's own ordering (Serve → Consume Inventory → ... → Spoilage →
 * Popularity Update → Equipment Usage → Staff Cost → ... → Advance
 * Business Day). Each composed module stays pure and independent; this
 * is the only file that knows they run together.
 *
 * A contract that has simply run its course (never cancelled) expires
 * here with NO fee and NO ledger entry — only an explicit early
 * cancellation (BusinessSupplierManager.cancelContract) ever charges the
 * cancellationFee. This is never a silent loss: the returned
 * `expiredSupplierId` lets the Dashboard tell the player their contract
 * ended.
 *
 * Payroll (Phase 9): if the day's full payroll (after any Manager
 * discount) is affordable, it's deducted here and reported as
 * `payrollPaid` — App.tsx's wrapper records that through the ledger,
 * exactly like every other real Business Mode expense. If it is NOT
 * affordable, CLAUDE.md's own "never create debt" / "never allow
 * credits < 0" rules leave exactly one honest option: the ENTIRE staff
 * is let go for that day rather than a partial payment (there is no
 * objectively correct "who gets paid first" policy, so this never
 * invents one) — reported as `staffLaidOff`, never a silent loss.
 * Credits are NEVER reduced below what's actually affordable.
 *
 * Equipment condition (Phase 10): the refrigerator's own condition
 * penalizes the day's spoiled value ("waste") ON TOP OF — never instead
 * of — Phase 9's own Cleaner reduction; the two multipliers are
 * independent and simply multiply together. Condition itself only ever
 * changes on a real purchase (BusinessInventoryManager) or a real
 * refrigerator purchase (RefrigeratorManager) — never here, since
 * nothing about ending a day is itself refrigerator "usage".
 *
 * Inspection (Phase 12): runs exactly once per day, evaluated against
 * this SAME day's own post-mutation state (post-cleanup inventory,
 * post-payroll credits/staff) — matching the master spec's own Business
 * Day Flow ordering (Spoilage -> Supplier Events -> Inspection -> Daily
 * P&L). Its overall PASS/WARNING/FAIL composes into this day's
 * popularity movement via the EXISTING `inspectionDelta` forward hook
 * (defined back in Phase 6, never called until now) — never a new
 * popularity pipeline, and `dailyPopularityDelta(save)` itself is called
 * completely unchanged, so its own 4 already-wired terms are untouched;
 * only the inspection term is added on top here. The report itself is
 * never persisted (businessInspection.ts's own doc explains why) — only
 * returned for the caller to display for that one day, exactly like
 * `spoiledQuantity`/`expiredSupplierId` already are.
 *
 * Inspection fines (Phase 13): assessed right after the inspection
 * itself, against the SAME post-payroll credits Staff Compliance
 * already reads (the master spec's own flow puts Inspection right after
 * Staff Cost) — never re-evaluates inspection criteria itself, only
 * consumes `inspectionReport.overall`. `business.inspectionFines.
 * lastInspectionResult` is the one new stored fact this phase needs (to
 * detect a "repeated" violation) and is updated to TODAY's overall
 * result every time this function runs, so it can never be read or
 * charged twice for the same day — the ONLY caller of
 * `determineInspectionFine` is this function, itself called from
 * exactly one App.tsx wrapper behind exactly one "End Business Day"
 * button; opening/re-rendering/reloading the Inspections screen never
 * calls this function or touches credits.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import { advanceBusinessDay } from "./businessCalendar";
import { clearExpiredStock } from "./SpoilageManager";
import { normalizeQuantity } from "./businessInventory";
import { endOfDayPopularity, type PopularityDayBreakdown } from "./PopularityManager";
import { isContractActive } from "./businessSupplierContract";
import {
  dailyPayroll,
  staffSpoilageValueMultiplier,
  type BusinessStaffRole,
} from "./businessStaff";
import { refrigeratorSpoilagePenaltyMultiplier } from "./businessEquipmentCondition";
import { inspectBusiness, type InspectionReport } from "./businessInspection";
import { determineInspectionFine, type InspectionFineResult } from "./businessInspectionFines";
import { computeDailyPnL, closeBusinessDay, type DailyPnL } from "./BusinessFinanceManager";

export type EndBusinessDayResult = {
  save: SaveData;
  spoiledQuantity: number;
  spoiledValue: number;
  spoiledIngredientIds: IngredientId[];
  popularityDelta: number;
  popularityScore: number;
  /** Economy V3 Phase 16 (D2) — the day's popularity terms: operations (pricing/variety/staff/refrigerator), inspection, bounded service score, pull toward 50. */
  popularityBreakdown: PopularityDayBreakdown;
  expiredSupplierId: string | null;
  payrollPaid: number;
  staffLaidOff: BusinessStaffRole[];
  inspectionReport: InspectionReport;
  inspectionFine: InspectionFineResult;
  /** Economy V3 Phase 15 — the full financial summary for the Business Day that JUST ended (opening/closing cash are the real credits values this function itself reads/returns). */
  dailyPnL: DailyPnL;
};

/**
 * Atomic in the sense that matters here: the calendar advance, the
 * spoilage sweep, the popularity movement, the contract-expiry check,
 * and the payroll settlement are always applied together, against the
 * SAME new day, in one returned save — never a partial result. Never
 * touches Campaign's `levelProgress`.
 */
export function endBusinessDay(save: SaveData): EndBusinessDayResult {
  const nextCalendar = advanceBusinessDay(save.business.calendar);
  const {
    inventory,
    spoiledQuantity,
    spoiledIngredientIds,
    spoiledValue: rawSpoiledValue,
  } = clearExpiredStock(save.business.inventory, nextCalendar.businessDay);
  const spoiledValue = Math.round(
    rawSpoiledValue *
      staffSpoilageValueMultiplier(save.business.staff.hiredRoles) *
      refrigeratorSpoilagePenaltyMultiplier(save.business.equipmentCondition.refrigeratorCondition),
  );
  const currentContract = save.business.supplierContract;
  let supplierContract = currentContract;
  let expiredSupplierId: string | null = null;
  if (currentContract && !isContractActive(currentContract, nextCalendar.businessDay)) {
    expiredSupplierId = currentContract.supplierId;
    supplierContract = null;
  }
  const payroll = dailyPayroll(save.business.staff.hiredRoles);
  const canAffordPayroll = save.credits >= payroll;
  const payrollPaid = canAffordPayroll ? payroll : 0;
  const staffLaidOff = canAffordPayroll ? [] : [...save.business.staff.hiredRoles];
  const staff = canAffordPayroll ? save.business.staff : { hiredRoles: [] };
  const credits = save.credits - payrollPaid;
  const spoilage = {
    totalSpoiledQuantity: normalizeQuantity(
      save.business.spoilage.totalSpoiledQuantity + spoiledQuantity,
    ),
    totalSpoiledValue: save.business.spoilage.totalSpoiledValue + spoiledValue,
  };
  const postMutationSave: SaveData = {
    ...save,
    credits,
    business: {
      ...save.business,
      calendar: nextCalendar,
      inventory,
      spoilage,
      supplierContract,
      staff,
    },
  };
  // Economy V3 Phase 16: Kitchen Cleanliness judges THIS day's own sweep, never the lifetime total (see businessInspection.ts).
  const inspectionReport = inspectBusiness(postMutationSave, spoiledQuantity);
  const inspectionFine = determineInspectionFine(
    inspectionReport.overall,
    save.business.inspectionFines.lastInspectionResult,
    postMutationSave.credits,
  );
  // Economy V3 Phase 16 — popularity model D2 (PopularityManager.endOfDayPopularity):
  // the existing daily terms + inspection + ONE bounded service score for the
  // day + a pull toward 50 from the day's starting score. The End Business
  // Day preview runs this same pure function, so preview == actual close.
  const popularityDay = endOfDayPopularity(
    save,
    inspectionReport.overall,
    save.business.finance.dailyAccumulator.ordersServed ?? 0,
  );
  const popularityDelta = popularityDay.breakdown.total;
  const popularityScore = popularityDay.score;
  const closingCash = postMutationSave.credits - inspectionFine.finePaid;
  const dailyPnL = computeDailyPnL({
    cashBeforeSettlement: save.credits,
    closingCash,
    accumulator: save.business.finance.dailyAccumulator,
    staffCost: payrollPaid,
    inspectionFines: inspectionFine.finePaid,
    spoilageValue: spoiledValue,
  });
  return {
    save: closeBusinessDay(
      {
        ...postMutationSave,
        credits: closingCash,
        business: {
          ...postMutationSave.business,
          popularity: { score: popularityScore },
          inspectionFines: { lastInspectionResult: inspectionReport.overall },
        },
      },
      dailyPnL,
    ),
    spoiledQuantity,
    spoiledValue,
    spoiledIngredientIds,
    popularityDelta,
    popularityScore,
    popularityBreakdown: popularityDay.breakdown,
    expiredSupplierId,
    payrollPaid,
    staffLaidOff,
    inspectionReport,
    dailyPnL,
    inspectionFine,
  };
}
