/**
 * BUSINESS_INSPECTION_FINES — Economy V3 Phase 13. Business-Mode-only
 * FINANCIAL CONSEQUENCE of an inspection result — this file owns the
 * fine amount/formula and the atomic wallet mutation only. It NEVER
 * evaluates inspection criteria itself: every category and the overall
 * PASS/WARNING/FAIL come from Phase 12's own `inspectBusiness` (called
 * exactly once per day by `BusinessDayManager.endBusinessDay`, which
 * passes this file's `determineInspectionFine` the SAME
 * `inspectionReport.overall` value popularity already reacts to — never
 * a second, independently re-evaluated result).
 *
 * Master spec §15's own severity ladder — "Minor -> warning",
 * "Repeated -> small fine", "Major -> larger fine", "Critical ->
 * temporary restriction or explicitly designed consequence" — is
 * mapped onto the ONLY result values Phase 12 actually produces
 * (PASS/WARNING/FAIL; there is no fourth "Critical" result to trigger
 * a distinct restriction mechanic):
 *
 *   PASS    -> nothing wrong; no fine.
 *   WARNING -> "Minor" the FIRST time it happens (yesterday was PASS,
 *              or there is no prior recorded day yet) — just the
 *              warning itself, no fine, matching "Minor -> warning"
 *              literally. If a WARNING (or worse) ALSO happened
 *              yesterday, today's WARNING is "Repeated" -> a small
 *              fine. This is the ONE piece of genuinely new state this
 *              phase needs — "repeated" is an inherently historical
 *              fact that cannot be derived from a single day's
 *              instantaneous state the way every Phase 12 category
 *              could be, so `BusinessState.inspectionFines` stores
 *              exactly the previous day's own `InspectionResult` and
 *              nothing else.
 *   FAIL    -> "Major" — always fines the larger amount, every time,
 *              regardless of yesterday's result (already serious
 *              enough on its own, unlike a first WARNING).
 *
 * "Critical -> temporary restriction or explicitly designed
 * consequence" is deliberately NOT implemented: the spec gives no
 * concrete mechanic or numeric definition for it, Phase 12's own result
 * type has no fourth tier to drive it, and CLAUDE.md's "do not invent
 * unsupported inspection rules" / this phase's own brief ("do not
 * invent a new fine formula if the specification already defines one")
 * both counsel against inventing a restriction mechanic the spec itself
 * only gestures at. This is a documented scope boundary, not a missed
 * requirement.
 *
 * Fine amounts, Economy V3 Phase 14 REAL-WORLD RECALIBRATION: SMALL =
 * $275 (27,500c), LARGE = $525 (52,500c) — directly sourced from the
 * City of Chicago's own 2026 food-establishment fine schedule ($275 per
 * priority foundation violation, $525 per priority violation, effective
 * January 1, 2026 — docs/ECONOMY_V3_MASTER_SPEC.md §24), used as the
 * clearly-labeled U.S. benchmark abstraction the master spec calls for.
 * Comfortably below the cost of a full refrigerator repair ($150-$400,
 * businessMaintenance.ts) or replacement ($2,000+, refrigeratorDefinitions.ts)
 * so a fine reads as a real, government-grounded, but proportionate
 * consequence — never a bankruptcy trap.
 *
 * Economy V2.5 SCALE: those schedule amounts assume a full restaurant
 * (~100 covers a day); a KnifeCraft Business day is one service of 4–12
 * guests, and at full size fines alone cost more per day ($47–58) than a
 * well-run restaurant earned (365-day simulation, business-final-audit-qa
 * §21). Fines are now the Chicago schedule scaled to one fifth — the same
 * SMALL:LARGE ratio — $55 and $105: still the largest routine penalty, far
 * less than a day's revenue.
 *
 * Economic safety (CLAUDE.md, and this phase's own brief): every real
 * financial mutation elsewhere in this codebase is strictly ALL-OR-
 * NOTHING on insufficient funds — a purchase is rejected outright, and
 * Phase 9's own payroll pays the full amount or nothing (never a
 * partial charge, never debt). A fine follows the SAME documented rule:
 * if the full fine is affordable, the FULL amount is charged; if not,
 * NOTHING is charged that day (`finePaid: 0`) rather than a partial/
 * capped amount, which would be an invented THIRD insolvency strategy
 * this codebase has never used. Credits can never go negative as a
 * result. There is no "repossession"-style side effect the way an
 * unaffordable payroll lays off staff — an inspection fine has no
 * analogous asset to seize, so it is simply, honestly waived.
 */
import type { InspectionResult } from "./PopularityManager";

export type BusinessInspectionFineState = {
  /** Yesterday's own overall inspection result — null only on a save that has never ended a business day yet. The ONE piece of state this phase adds; nothing else is persisted here. */
  lastInspectionResult: InspectionResult | null;
};

export const DEFAULT_INSPECTION_FINE_STATE: BusinessInspectionFineState = {
  lastInspectionResult: null,
};

export type FineSeverity = "NONE" | "SMALL" | "LARGE";

const SMALL_FINE = 5_500;
const LARGE_FINE = 10_500;

const FINE_AMOUNT_BY_SEVERITY: Record<FineSeverity, number> = {
  NONE: 0,
  SMALL: SMALL_FINE,
  LARGE: LARGE_FINE,
};

/** Pure, deterministic — see file header for the exact Minor/Repeated/Major mapping. Never reads credits; affordability is a separate concern (`determineInspectionFine`). */
export function fineSeverityFor(
  todayResult: InspectionResult,
  lastResult: InspectionResult | null,
): FineSeverity {
  if (todayResult === "PASS") return "NONE";
  if (todayResult === "FAIL") return "LARGE";
  // todayResult === "WARNING"
  const wasAlreadyNonPassing = lastResult === "WARNING" || lastResult === "FAIL";
  return wasAlreadyNonPassing ? "SMALL" : "NONE";
}

export type InspectionFineResult = {
  severity: FineSeverity;
  /** The full documented fine for this severity — 0 for NONE. */
  fineAmount: number;
  /** What was ACTUALLY deducted — always either 0 or exactly `fineAmount`, never a partial value (see file header: all-or-nothing, never debt). */
  finePaid: number;
};

/**
 * The one function BusinessDayManager calls each day, right after
 * Phase 12's own `inspectBusiness` — `availableCredits` is the day's
 * own post-payroll credits (fines are assessed after Staff Cost, per
 * the master spec's own Business Day Flow ordering), so a fine can
 * never be double-counted against pre-payroll cash that's already
 * spoken for. Pure — never mutates anything; the caller applies
 * `finePaid` to credits and records the ledger entry itself, exactly
 * like every other real Business Mode expense.
 */
export function determineInspectionFine(
  todayResult: InspectionResult,
  lastResult: InspectionResult | null,
  availableCredits: number,
): InspectionFineResult {
  const severity = fineSeverityFor(todayResult, lastResult);
  const fineAmount = FINE_AMOUNT_BY_SEVERITY[severity];
  const finePaid = availableCredits >= fineAmount ? fineAmount : 0;
  return { severity, fineAmount, finePaid };
}
