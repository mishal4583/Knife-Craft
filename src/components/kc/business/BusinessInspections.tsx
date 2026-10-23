import type { SaveData } from "@/game/SaveManager";
import { Panel, Badge } from "../common/primitives";
import { InfoTip } from "../common/InfoTip";
import { Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { inspectBusiness, type InspectionCategory } from "@/game/business/businessInspection";
import type { InspectionResult } from "@/game/business/PopularityManager";
import { formatUsd } from "@/game/business/businessCurrency";
import {
  previewBusinessDayClose,
  repeatedWarningFineAmount,
  failFineAmount,
  INSPECTION_CATEGORY_ICON,
} from "@/game/business/businessAlerts";

const RESULT_BADGE_TONE: Record<InspectionResult, "sage" | "copper" | "locked"> = {
  PASS: "sage",
  WARNING: "copper",
  FAIL: "locked",
};

const RESULT_TEXT: Record<InspectionResult, string> = {
  PASS: "✓ Passed",
  WARNING: "⚠ Warning",
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
      <div className="mt-1 flex items-center gap-2">
        <p className="font-display text-[18px] font-black text-walnut-dark">
          {passed} / {report.categories.length} checks
        </p>
        <InfoTip label="Why">{report.overallReason}</InfoTip>
      </div>
      {/* Every check at a glance: its icon, green when it passes (developer 2026-10-23). */}
      <div className="mt-1.5 flex flex-wrap gap-1" data-testid="inspection-icons">
        {report.categories.map((c) => (
          <span
            key={c.category}
            title={`${CATEGORY_LABEL[c.category]}: ${RESULT_TEXT[c.result]}`}
            className={cn(
              "relative grid h-9 w-9 place-items-center rounded-full border text-[17px]",
              c.result === "PASS"
                ? "border-olive/30 bg-sage/15"
                : c.result === "WARNING"
                  ? "border-copper/50 bg-gold/20"
                  : "border-tomato/50 bg-tomato/15",
            )}
          >
            {INSPECTION_CATEGORY_ICON[c.category]}
            <span
              className={cn(
                "absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full font-ui text-[10px] font-black text-ivory",
                c.result === "PASS"
                  ? "bg-olive"
                  : c.result === "WARNING"
                    ? "bg-copper"
                    : "bg-tomato",
              )}
              aria-hidden
            >
              {c.result === "PASS" ? "✓" : "!"}
            </span>
          </span>
        ))}
      </div>

      <div className="mt-2 space-y-1.5">
        {report.categories
          .filter((c) => c.result !== "PASS")
          .map((c) => (
            <div
              key={c.category}
              data-inspection-check={c.category}
              className="flex items-center gap-2 rounded-[14px] border border-copper/30 bg-gold/10 px-3 py-2"
            >
              <span className="text-[18px]" aria-hidden>
                {INSPECTION_CATEGORY_ICON[c.category]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-ui text-[13.5px] font-extrabold leading-tight text-walnut-dark">
                  {CATEGORY_LABEL[c.category]}
                  <span className="ml-1.5 font-ui text-[12px] font-extrabold text-copper">
                    {RESULT_TEXT[c.result]}
                  </span>
                </p>
                <p className="font-ui text-[12.5px] font-bold leading-tight text-walnut/75">
                  {c.glance}
                </p>
              </div>
              <InfoTip label={`About ${CATEGORY_LABEL[c.category]}`}>{c.reason}</InfoTip>
            </div>
          ))}
        {passed > 0 ? (
          <p className="flex flex-wrap items-center gap-1 font-ui text-[12px] font-bold text-olive">
            ✓ Passed:
            {report.categories
              .filter((c) => c.result === "PASS")
              .map((c) => (
                <span
                  key={c.category}
                  className="rounded-full border border-olive/25 bg-sage/10 px-2 py-0.5 text-walnut-dark"
                >
                  {INSPECTION_CATEGORY_ICON[c.category]} {CATEGORY_LABEL[c.category]}
                </span>
              ))}
          </p>
        ) : null}
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
            ? `💸 Fine ${formatUsd(atClose.inspectionFine.fineAmount)}${atClose.inspectionFine.finePaid === 0 ? " · not collected (no debt)" : ""}`
            : "No fine"}
        </p>
        <p className="mt-0.5 font-hand text-[14px] leading-snug text-walnut/60">
          🕵️ Last: {lastResult ?? "none yet"}
          {atClose.inspectionReport.overall === "WARNING"
            ? lastResult === "WARNING" || lastResult === "FAIL"
              ? " · ⚠️ 2nd in a row → fined"
              : " · ⚠️ 1st warning is free"
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
      <p className="mt-2 flex items-center gap-1.5 font-hand text-[14px] leading-snug text-walnut/55">
        What the inspector checks
        <InfoTip label="What the inspector checks">
          Warnings come from stock near its shelf life, a fridge below 60 condition or 75%+ full,
          15+ units spoiling in a day without a Cleaner, or pay you can't cover. Expired stock, a
          broken fridge, a 95%+ full fridge or 50+ units spoiling is a fail. The check runs after
          tonight's spoilage and pay. Fines are paid in full or not at all — never debt.
        </InfoTip>
      </p>
    </Panel>
  );
}
