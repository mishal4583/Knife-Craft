import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, ScreenHeader, Divider, Badge } from "../common/primitives";
import { BusinessCash } from "./BusinessCash";
import { BottomNav } from "../Kitchen";
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
 * BUSINESS_INSPECTIONS — Economy V3 Phase 12. Deliberately reads
 * NOTHING but `businessInspection.ts`'s own `inspectBusiness(save)` —
 * there is no separate inspection state to fetch, so this screen is
 * always exactly as current as the save itself, live, on every render.
 * The SAME report (computed fresh, never read from here) also runs once
 * automatically each "End Business Day" — see BusinessDayManager.ts's
 * own doc for why. The "At End Business Day" panel (Operations
 * checkpoint) shows the V3-13 fine via the pure day-close preview — the
 * same calculation the button runs, never a second fine rule.
 */
export function BusinessInspections({ go, save }: { go: (s: ScreenId) => void; save: SaveData }) {
  const report = inspectBusiness(save);
  // Operations checkpoint — the exact day-close result (pure preview), so
  // the fine shown here is the one End Business Day will actually assess.
  const atClose = previewBusinessDayClose(save);
  const lastResult = save.business.inspectionFines.lastInspectionResult;

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(125,146,112,0.24),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Inspections"
          subtitle="how the restaurant would score right now"
          onBack={() => go("business")}
          right={<BusinessCash cents={save.credits} />}
        />

        <div className="px-4">
          <Panel tone="dark" className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold">
                Overall
              </p>
              <Badge tone={RESULT_BADGE_TONE[report.overall]}>{report.overall}</Badge>
            </div>
            <p className="mt-1.5 font-hand text-[14px] text-ivory/70">{report.overallReason}</p>
            <Divider />
            <p className="font-hand text-[12px] text-ivory/50">
              Run automatically once every business day — this view just shows what today's
              inspection would find right now.
            </p>
          </Panel>
        </div>

        <div className="px-4 pt-4">
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
                At End Business Day
              </p>
              <Badge tone={RESULT_BADGE_TONE[atClose.inspectionReport.overall]}>
                {atClose.inspectionReport.overall}
              </Badge>
            </div>
            <p className="mt-1.5 font-hand text-[14px] leading-snug text-walnut/70">
              {atClose.inspectionReport.overall === report.overall
                ? "The official inspection runs after tonight's spoilage sweep and payroll — it would find the same result."
                : `The official inspection runs after tonight's spoilage sweep and payroll, so it would find ${atClose.inspectionReport.overall} (${atClose.inspectionReport.overallReason})`}
            </p>
            <p
              className={`mt-1.5 font-ui text-[13px] font-extrabold ${atClose.inspectionFine.fineAmount > 0 ? "text-copper" : "text-olive"}`}
            >
              {atClose.inspectionFine.fineAmount > 0
                ? `Fine: ${formatUsd(atClose.inspectionFine.fineAmount)}${atClose.inspectionFine.finePaid === 0 ? " — more than your cash after payroll, so it can't be collected (never debt)" : ""}`
                : "No fine."}
            </p>
            <p className="mt-1 font-hand text-[13px] leading-snug text-walnut/60">
              Last official inspection: {lastResult ?? "none yet"}.{" "}
              {atClose.inspectionReport.overall === "WARNING"
                ? lastResult === "WARNING" || lastResult === "FAIL"
                  ? "Because it was also non-passing, this WARNING counts as a repeated violation."
                  : "A first WARNING is only a warning — but if tomorrow is non-passing too, it's fined."
                : ""}
            </p>
            <Divider />
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.16em] text-walnut/55">
              Fine rules
            </p>
            <ul className="mt-1 font-hand text-[13px] leading-snug text-walnut/65">
              <li>PASS — no fine.</li>
              <li>First WARNING (after a PASS or no inspection) — no fine.</li>
              <li>
                WARNING after a WARNING or FAIL — {formatUsd(repeatedWarningFineAmount())} repeated
                violation.
              </li>
              <li>Any FAIL — {formatUsd(failFineAmount())}.</li>
              <li>A fine is collected in full or not at all — it never creates debt.</li>
            </ul>
            <p className="mt-1.5 font-hand text-[12px] leading-snug text-walnut/55">
              What causes a WARNING: holding stock near the end of its shelf life, a refrigerator
              below 60 condition, a refrigerator 75%+ full, 15+ units spoiling in one day without a
              Cleaner, or payroll you can't cover. Expired stock, a broken refrigerator, a 95%+ full
              refrigerator or 50+ units spoiling in a day is a FAIL.
            </p>
          </Panel>
        </div>

        <div className="px-4 pt-4">
          <p className="mb-2 px-1 font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
            Right now, by category
          </p>
          <div className="flex flex-col gap-2">
            {report.categories.map((c) => (
              <Panel key={c.category} tone="cream" className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-[14px] font-black leading-tight text-walnut-dark">
                    {CATEGORY_LABEL[c.category]}
                  </p>
                  <Badge tone={RESULT_BADGE_TONE[c.result]}>{c.result}</Badge>
                </div>
                <p className="mt-1 font-hand text-[13px] leading-tight text-walnut/60">
                  {c.reason}
                </p>
              </Panel>
            ))}
          </div>
        </div>

        <Divider />

        <p className="px-8 pb-2 pt-3 text-center font-hand text-[15px] text-walnut/50">
          keep every category in the clear to protect your reputation.
        </p>
        <p className="px-8 pb-2 text-center font-hand text-[12px] text-walnut/40">
          Fine amounts are modeled on real 2026 U.S. municipal food-safety fine schedules (e.g.
          Chicago's) — not a claim about the laws in your own city.
        </p>
      </div>
      <BottomNav active="business" go={go} />
    </div>
  );
}
