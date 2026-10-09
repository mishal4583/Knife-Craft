import type { SaveData } from "@/game/SaveManager";
import { Panel, Badge } from "../common/primitives";
import { Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { inspectBusiness, type InspectionCategory } from "@/game/business/businessInspection";
import type { InspectionResult } from "@/game/business/PopularityManager";
import { formatUsd } from "@/game/business/businessCurrency";
import {
  previewBusinessDayClose,
  repeatedWarningFineAmount,
  failFineAmount,
} from "@/game/business/businessAlerts";

const RESULT_BADGE_TONE: Record<InspectionResult, "sage" | "copper" | "locked"> = {
  PASS: "sage",
  WARNING: "copper",
  FAIL: "locked",
};

const RESULT_TEXT: Record<InspectionResult, string> = {
  PASS: "✓ Passed",
  WARNING: "⚠ Needs attention",
  FAIL: "✕ Failing",
};

const CATEGORY_LABEL: Record<InspectionCategory, string> = {
  FOOD_STORAGE: "Food Storage",
  INGREDIENT_EXPIRY: "Ingredient Expiry",
  REFRIGERATOR_CONDITION: "Refrigerator Condition",
  EQUIPMENT_CONDITION: "Equipment Condition",
  KITCHEN_CLEANLINESS: "Kitchen Cleanliness",
  FOOD_SAFETY: "Food Safety",
  STAFF_COMPLIANCE: "Staff Compliance",
};

/**
 * BUSINESS · OPERATIONS → Inspections (Economy V3 Phases 12–13). Reads only
 * `inspectBusiness(save)` (live) and the pure day-close preview for tonight's
 * fine — the same calculation End Business Day runs. Fine amounts come from
 * businessAlerts' own accessors, never literals.
 */
export function BusinessInspections({ save }: { save: SaveData }) {
  const report = inspectBusiness(save);
  const atClose = previewBusinessDayClose(save);
  const lastResult = save.business.inspectionFines.lastInspectionResult;
  const passed = report.categories.filter((c) => c.result === "PASS").length;

  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>🧾 Inspection · right now</Eyebrow>
        <Badge tone={RESULT_BADGE_TONE[report.overall]}>{report.overall}</Badge>
      </div>
      <p className="mt-1 font-display text-[18px] font-black text-walnut-dark">
        {passed} / {report.categories.length} checks passed
      </p>
      <p className="font-hand text-[15px] leading-snug text-walnut/65">{report.overallReason}</p>

      <div className="mt-2 space-y-1.5">
        {report.categories.map((c) => (
          <div
            key={c.category}
            className={cn(
              "rounded-[14px] border px-3 py-2",
              c.result === "PASS" ? "border-olive/25 bg-sage/10" : "border-copper/30 bg-gold/10",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-ui text-[13.5px] font-extrabold text-walnut-dark">
                {CATEGORY_LABEL[c.category]}
              </p>
              <span
                className={cn(
                  "shrink-0 font-ui text-[12px] font-extrabold",
                  c.result === "PASS" ? "text-olive" : "text-copper",
                )}
              >
                {RESULT_TEXT[c.result]}
              </span>
            </div>
            {c.result !== "PASS" ? (
              <p className="mt-0.5 font-hand text-[14px] leading-snug text-walnut/65">{c.reason}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-[14px] bg-cream/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-ui text-[12.5px] font-extrabold text-walnut-dark">
            Tonight's official inspection
          </p>
          <Badge tone={RESULT_BADGE_TONE[atClose.inspectionReport.overall]}>
            {atClose.inspectionReport.overall}
          </Badge>
        </div>
        <p
          className={cn(
            "mt-1 font-ui text-[13.5px] font-extrabold",
            atClose.inspectionFine.fineAmount > 0 ? "text-copper" : "text-olive",
          )}
        >
          {atClose.inspectionFine.fineAmount > 0
            ? `Fine ${formatUsd(atClose.inspectionFine.fineAmount)}${atClose.inspectionFine.finePaid === 0 ? " — more than your cash after pay, so it can't be collected (never debt)" : ""}`
            : "No fine"}
        </p>
        <p className="mt-0.5 font-hand text-[14px] leading-snug text-walnut/60">
          It runs after tonight's spoilage and pay. Last inspection: {lastResult ?? "none yet"}.
          {atClose.inspectionReport.overall === "WARNING"
            ? lastResult === "WARNING" || lastResult === "FAIL"
              ? " A second non-passing day in a row is fined."
              : " A first warning isn't fined — a second one in a row is."
            : ""}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-[14px] border border-walnut/10 bg-ivory/60 px-2 py-2">
          <p className="font-ui text-[11px] font-bold text-walnut/55">Small fine</p>
          <p className="font-display text-[16.5px] font-black text-walnut-dark">
            {formatUsd(repeatedWarningFineAmount())}
          </p>
          <p className="font-hand text-[13px] leading-tight text-walnut/55">
            warning after warning
          </p>
        </div>
        <div className="rounded-[14px] border border-walnut/10 bg-ivory/60 px-2 py-2">
          <p className="font-ui text-[11px] font-bold text-walnut/55">Large fine</p>
          <p className="font-display text-[16.5px] font-black text-walnut-dark">
            {formatUsd(failFineAmount())}
          </p>
          <p className="font-hand text-[13px] leading-tight text-walnut/55">
            any failed inspection
          </p>
        </div>
      </div>
      <p className="mt-2 font-hand text-[13px] leading-snug text-walnut/50">
        Warnings come from stock near its shelf life, a fridge below 60 condition or 75%+ full, 15+
        units spoiling in a day without a Cleaner, or pay you can't cover. Expired stock, a broken
        fridge, a 95%+ full fridge or 50+ units spoiling is a fail. Fines are paid in full or not at
        all — never debt.
      </p>
    </Panel>
  );
}
