import type { SaveData } from "@/game/SaveManager";
import type { ScreenId } from "../data";
import { Panel, Badge, KButton } from "../common/primitives";
import { InfoTip } from "../common/InfoTip";
import { Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import {
  inspectBusiness,
  type CategoryInspectionResult,
  type InspectionCategory,
} from "@/game/business/businessInspection";
import type { InspectionResult } from "@/game/business/PopularityManager";
import { formatUsd } from "@/game/business/businessCurrency";
import { maintenanceCostFor } from "@/game/business/businessMaintenance";
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

/** The big line at the top of the screen, by the overall grade. */
const GRADE_HEAD: Record<InspectionResult, { icon: string; title: string; line: string }> = {
  PASS: { icon: "✅", title: "Inspection ready", line: "Every check passes right now." },
  WARNING: {
    icon: "⚠️",
    title: "Inspection warning",
    line: "Fix the checks below before closing.",
  },
  FAIL: {
    icon: "⛔",
    title: "Inspection would fail",
    line: "Fix the failing checks before closing.",
  },
};

const HERO_TONE: Record<InspectionResult, string> = {
  PASS: "border-olive/35 bg-sage/15",
  WARNING: "border-copper/45 bg-gold/20",
  FAIL: "border-tomato/50 bg-tomato/15",
};

function Icons({ report }: { report: ReturnType<typeof inspectBusiness> }) {
  return (
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
              c.result === "PASS" ? "bg-olive" : c.result === "WARNING" ? "bg-copper" : "bg-tomato",
            )}
            aria-hidden
          >
            {c.result === "PASS" ? "✓" : "!"}
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * BUSINESS · OPERATIONS → the short Inspection card (Economy V3 Phases 12–13). The full screen is `InspectionScreen`, opened by the card's
 * button and by the "View Inspection" alert above it (developer 2026-11-22: the alert changed nothing, because the panel it meant sat far
 * down this same page). Reads only `inspectBusiness(save)` (live).
 */
export function InspectionSummary({
  save,
  go,
}: {
  save: SaveData;
  go: (screen: ScreenId) => void;
}) {
  const report = inspectBusiness(save);
  const passed = report.categories.filter((c) => c.result === "PASS").length;
  return (
    <Panel className="p-4" data-testid="inspection-summary">
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
      <Icons report={report} />
      <KButton
        full
        variant={report.overall === "PASS" ? "cream" : "copper"}
        className="mt-3"
        data-testid="inspection-open"
        onClick={() => go("business-inspection")}
      >
        View Inspection →
      </KButton>
    </Panel>
  );
}

type Fix = { label: string; to: ScreenId } | { repair: number } | { hint: string };

/** What the player can do about one failing check, from the same facts the check itself used. */
function fixFor(c: CategoryInspectionResult, save: SaveData, repairShown: boolean): Fix | null {
  if (c.result === "PASS") return null;
  const condition = save.business.equipmentCondition.refrigeratorCondition;
  const repairCost = maintenanceCostFor(condition);
  switch (c.category) {
    case "FOOD_STORAGE":
      return { label: "Bigger fridge →", to: "business-refrigerator" };
    case "INGREDIENT_EXPIRY":
      return { label: "Check stock →", to: "inventory" };
    case "REFRIGERATOR_CONDITION":
      return repairCost != null ? { repair: repairCost } : null;
    case "EQUIPMENT_CONDITION":
      return repairShown ? { hint: "Fixed by the refrigerator repair above." } : null;
    case "KITCHEN_CLEANLINESS":
      return { label: "Open Cleanliness →", to: "business-cleanliness" };
    case "FOOD_SAFETY":
      return inspectBusiness(save).categories.find((k) => k.category === "INGREDIENT_EXPIRY")
        ?.result !== "PASS"
        ? { label: "Check stock →", to: "inventory" }
        : repairShown
          ? { hint: "Fixed by the refrigerator repair above." }
          : null;
    case "STAFF_COMPLIANCE":
      return { label: "Open Staff →", to: "business-staff" };
  }
}

/**
 * The Inspection screen (developer 2026-11-22: "inspection is not built properly and not visible when view inspection is clicked"). One
 * screen with its own header: the grade, every check with why it is that grade and the button that fixes it (the refrigerator repair is
 * done right here), tonight's official inspection and the two fines. The numbers are the live `inspectBusiness` and the same pure day-close
 * preview End Business Day runs; fine amounts come from businessAlerts' own accessors, never literals.
 */
export function InspectionScreen({
  save,
  go,
  onRepair,
  repairMessage,
}: {
  save: SaveData;
  go: (screen: ScreenId) => void;
  onRepair: () => void;
  repairMessage: string | null;
}) {
  const report = inspectBusiness(save);
  const atClose = previewBusinessDayClose(save);
  const lastResult = save.business.inspectionFines.lastInspectionResult;
  const passed = report.categories.filter((c) => c.result === "PASS").length;
  const head = GRADE_HEAD[report.overall];
  const failing = report.categories.filter((c) => c.result !== "PASS");
  // The repair button shows once, on the refrigerator's row; the rows that share its cause point at it.
  const repairShown = failing.some((c) => c.category === "REFRIGERATOR_CONDITION");
  const fine = atClose.inspectionFine.fineAmount;

  return (
    <div className="space-y-3" data-testid="inspection-screen">
      <div
        className={cn("rounded-[22px] border p-4 shadow-soft", HERO_TONE[report.overall])}
        data-testid="inspection-grade"
        data-grade={report.overall}
      >
        <div className="flex items-center gap-3">
          <span className="text-[34px] leading-none" aria-hidden>
            {head.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[20px] font-black leading-tight text-walnut-dark">
              {head.title}
            </p>
            <p className="font-ui text-[13px] font-bold leading-tight text-walnut/75">
              {passed} / {report.categories.length} checks pass · {head.line}
            </p>
          </div>
          <Badge tone={RESULT_BADGE_TONE[report.overall]}>{report.overall}</Badge>
        </div>
        <Icons report={report} />
      </div>

      {repairMessage ? (
        <p
          className="px-1 font-hand text-[15px] text-olive"
          data-testid="inspection-repair-message"
        >
          {repairMessage}
        </p>
      ) : null}

      <Panel className="p-4">
        <Eyebrow>📋 The checks</Eyebrow>
        <div className="mt-2 space-y-2">
          {report.categories.map((c) => {
            const fix = fixFor(c, save, repairShown);
            const ok = c.result === "PASS";
            return (
              <div
                key={c.category}
                data-inspection-check={c.category}
                data-result={c.result}
                className={cn(
                  "rounded-[16px] border px-3 py-2.5",
                  ok
                    ? "border-olive/25 bg-sage/10"
                    : c.result === "WARNING"
                      ? "border-copper/40 bg-gold/10"
                      : "border-tomato/45 bg-tomato/10",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[20px]" aria-hidden>
                    {INSPECTION_CATEGORY_ICON[c.category]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-ui text-[14px] font-extrabold leading-tight text-walnut-dark">
                      {CATEGORY_LABEL[c.category]}
                    </p>
                    <p className="font-ui text-[12.5px] font-bold leading-tight text-walnut/70">
                      {c.glance}
                    </p>
                  </div>
                  <Badge tone={RESULT_BADGE_TONE[c.result]}>{RESULT_TEXT[c.result]}</Badge>
                  <InfoTip label={`About ${CATEGORY_LABEL[c.category]}`}>{c.reason}</InfoTip>
                </div>
                {fix && "label" in fix ? (
                  <KButton
                    full
                    size="sm"
                    variant="cream"
                    className="mt-2"
                    data-testid={`inspection-fix-${c.category}`}
                    onClick={() => go(fix.to)}
                  >
                    {fix.label}
                  </KButton>
                ) : null}
                {fix && "repair" in fix ? (
                  <KButton
                    full
                    size="sm"
                    variant="copper"
                    className="mt-2"
                    disabled={save.credits < fix.repair}
                    data-testid="inspection-fix-repair"
                    onClick={onRepair}
                  >
                    {save.credits < fix.repair
                      ? `Repair · ${formatUsd(fix.repair)} · not enough cash`
                      : `Repair · ${formatUsd(fix.repair)}`}
                  </KButton>
                ) : null}
                {fix && "hint" in fix ? (
                  <p className="mt-1.5 font-hand text-[14px] leading-snug text-walnut/60">
                    {fix.hint}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="p-4" data-testid="inspection-tonight">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow>🌙 Tonight's official inspection</Eyebrow>
          <Badge tone={RESULT_BADGE_TONE[atClose.inspectionReport.overall]}>
            {atClose.inspectionReport.overall}
          </Badge>
        </div>
        <p
          className={cn(
            "mt-1.5 font-display text-[18px] font-black",
            fine > 0 ? "text-copper" : "text-olive",
          )}
        >
          {fine > 0
            ? `💸 Fine ${formatUsd(fine)}${atClose.inspectionFine.finePaid === 0 ? " · not collected (no debt)" : ""}`
            : "No fine"}
        </p>
        <p className="mt-0.5 font-hand text-[14.5px] leading-snug text-walnut/60">
          🕵️ Last: {lastResult ?? "none yet"}
          {atClose.inspectionReport.overall === "WARNING"
            ? lastResult === "WARNING" || lastResult === "FAIL"
              ? " · ⚠️ 2nd in a row → fined"
              : " · ⚠️ 1st warning is free"
            : ""}
        </p>
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
    </div>
  );
}
