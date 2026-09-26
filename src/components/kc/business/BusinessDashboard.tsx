import { useMemo, useState } from "react";
import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import type { ServiceSession } from "@/game/service/ServiceManager";
import { KButton, Panel, ScreenHeader, Divider } from "../common/primitives";
import { BottomNav } from "../Kitchen";
import { BusinessCash } from "./BusinessCash";
import { dayOfWeekFor, businessWeekFor } from "@/game/business/businessCalendar";
import { inventoryValue, formatQuantity } from "@/game/business/businessInventory";
import { getRefrigerator } from "@/game/business/refrigeratorDefinitions";
import {
  getInventoryUsedCapacity,
  getAvailableStorageCapacity,
} from "@/game/business/RefrigeratorManager";
import { BUSINESS_DISH_CATALOG } from "@/game/business/businessDishCatalog";
import { getSupplier } from "@/game/economy/supplierDefinitions";
import { isContractActive } from "@/game/business/businessSupplierContract";
import { getAllStaffDefinitions, dailyPayroll } from "@/game/business/businessStaff";
import { conditionBandFor } from "@/game/business/businessEquipmentCondition";
import type { InspectionReport } from "@/game/business/businessInspection";
import type { InspectionFineResult } from "@/game/business/businessInspectionFines";
import type { PerformMaintenanceResult } from "@/game/business/businessMaintenance";
import { formatUsd } from "@/game/business/businessCurrency";
import type { DailyPnL } from "@/game/business/BusinessFinanceManager";
import type { PopularityDayBreakdown } from "@/game/business/PopularityManager";
import { businessDishForRecipeId } from "@/game/business/businessServiceCatalog";
import {
  BASE_CUSTOMERS_PER_DAY,
  businessCustomerPayment,
  businessCustomersToday,
  businessOrderAvailability,
} from "@/game/business/BusinessServiceManager";
import { activeBusinessDishes } from "@/game/business/businessMenuActivation";
import { INGREDIENTS } from "@/game/definitions";
import {
  businessAlertsFor,
  previewBusinessDayClose,
  type BusinessAlert,
  type BusinessAlertSeverity,
} from "@/game/business/businessAlerts";

export type AdvanceDayResult = {
  spoiledQuantity: number;
  spoiledValue: number;
  spoiledIngredientIds: string[];
  popularityDelta: number;
  popularityScore: number;
  popularityBreakdown: PopularityDayBreakdown;
  expiredSupplierId: string | null;
  payrollPaid: number;
  staffLaidOff: string[];
  inspectionReport: InspectionReport;
  inspectionFine: InspectionFineResult;
  dailyPnL: DailyPnL;
};

const SEVERITY_ICON: Record<BusinessAlertSeverity, string> = {
  critical: "⛔",
  warning: "⚠️",
  info: "ℹ️",
  ok: "✓",
};

const SEVERITY_TEXT: Record<BusinessAlertSeverity, string> = {
  critical: "text-copper",
  warning: "text-copper",
  info: "text-walnut-dark",
  ok: "text-olive",
};

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
}

/** D2 (Economy V3 Phase 16): the day's popularity terms, straight from endBusinessDay's own breakdown — never recomputed here. */
function popularityBreakdownText(b: PopularityDayBreakdown): string {
  return `service ${signed(b.service)} · pull toward 50 ${signed(b.pull)} · inspection ${signed(b.inspection)} · menu/staff/fridge ${signed(b.operations)}`;
}

function signedUsd(cents: number): string {
  return formatUsd(cents);
}

function SectionLabel({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <p
      className={`font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] ${dark ? "text-gold" : "text-copper"}`}
    >
      {children}
    </p>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="font-hand text-[14px] text-walnut/70">{label}</span>
      <span
        className={`font-ui text-[13px] tabular-nums ${strong ? "font-extrabold text-walnut-dark" : "font-bold text-walnut"}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * BUSINESS_DASHBOARD — the Business Mode command center (Economy V3
 * Phase 1, rebuilt in the pre-V3-16 Operations/Feedback checkpoint).
 *
 * Top-down: BUSINESS STATUS → TODAY'S OPERATIONS (every alert from
 * `businessAlertsFor`, most urgent first, each with its real action) →
 * TODAY'S ORDERS → END BUSINESS DAY (consequence preview from the SAME
 * pure `endBusinessDay` the button runs) → the day summary (the real
 * `AdvanceDayResult` right after closing, the persisted `lastDailyPnL`
 * afterwards) → the management screens. Nothing here computes a second
 * number — every figure is read from an existing manager/state field.
 */
export function BusinessDashboard({
  go,
  save,
  onAdvanceDay,
  businessServiceSession,
  onRepairRefrigerator,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  onAdvanceDay: () => AdvanceDayResult;
  businessServiceSession: ServiceSession | null;
  onRepairRefrigerator: () => PerformMaintenanceResult;
}) {
  const [dayResult, setDayResult] = useState<AdvanceDayResult | null>(null);
  const [repairMessage, setRepairMessage] = useState<string | null>(null);
  const { businessDay } = save.business.calendar;
  const popularityScore = save.business.popularity.score;
  // Order frequency — today's customer allowance (derived from start-of-day popularity).
  const customers = businessCustomersToday(save);
  const today = save.business.finance.dailyAccumulator;
  const cashMovedToday =
    today.revenue -
    today.inventoryPurchaseCost -
    today.maintenanceCost -
    today.supplierCost -
    today.capitalExpenditure;

  const order = businessServiceSession?.current;
  const currentDish = order ? businessDishForRecipeId(order.recipe.id) : undefined;
  const currentOrderRef = order ? { orderId: order.order.id, recipeId: order.recipe.id } : null;
  const alerts = useMemo(
    () => businessAlertsFor(save, currentOrderRef),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentOrderRef is rebuilt every render; its identity is fully described by these two fields
    [save, currentOrderRef?.orderId, currentOrderRef?.recipeId],
  );
  const preview = useMemo(() => previewBusinessDayClose(save), [save]);
  const actionable = alerts.filter((a) => a.severity !== "ok");
  const allClear = alerts.filter((a) => a.severity === "ok");

  function runAlertAction(alert: BusinessAlert) {
    if (!alert.action) return;
    if (alert.action.kind === "navigate") {
      go(alert.action.screen);
      return;
    }
    const result = onRepairRefrigerator();
    setRepairMessage(
      result.ok
        ? `Refrigerator repaired for ${formatUsd(result.cost)} — back to 100/100.`
        : result.reason === "insufficientFunds"
          ? "Not enough cash for the repair yet."
          : "The refrigerator doesn't need a repair.",
    );
  }

  function handleAdvanceDay() {
    setRepairMessage(null);
    setDayResult(onAdvanceDay());
  }

  const lastPnL = save.business.finance.lastDailyPnL;
  const lastInspection = save.business.inspectionFines.lastInspectionResult;

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(216,168,78,0.28),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Business"
          subtitle="run the restaurant, your way"
          onBack={() => go("kitchen")}
          right={<BusinessCash cents={save.credits} />}
        />

        {/* BUSINESS STATUS */}
        <div className="px-4">
          <Panel tone="dark" className="relative overflow-hidden p-4">
            <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_50%_0%,rgba(216,168,78,0.28),transparent_65%)]" />
            <div className="relative">
              <div className="flex items-baseline justify-between">
                <SectionLabel dark>Business Status</SectionLabel>
                <p className="font-ui text-[11px] font-bold uppercase tracking-[0.14em] text-ivory/60">
                  Week {businessWeekFor(businessDay)}
                </p>
              </div>
              <p className="mt-1 font-display text-[28px] font-black leading-none text-ivory">
                Day {businessDay}{" "}
                <span className="font-hand text-[18px] font-normal text-ivory/75">
                  {dayOfWeekFor(businessDay)}
                </span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="font-ui text-[9px] font-extrabold uppercase tracking-[0.18em] text-ivory/50">
                    Cash
                  </p>
                  <p className="font-display text-[18px] font-black text-ivory">
                    {formatUsd(save.credits)}
                  </p>
                </div>
                <div>
                  <p className="font-ui text-[9px] font-extrabold uppercase tracking-[0.18em] text-ivory/50">
                    Popularity
                  </p>
                  <p className="font-display text-[18px] font-black text-ivory">
                    {popularityScore}
                    <span className="font-hand text-[13px] font-normal text-ivory/60">
                      /100 reputation
                    </span>
                  </p>
                </div>
                <div>
                  <p className="font-ui text-[9px] font-extrabold uppercase tracking-[0.18em] text-ivory/50">
                    Revenue today
                  </p>
                  <p className="font-display text-[18px] font-black text-ivory">
                    {formatUsd(today.revenue)}
                  </p>
                </div>
                <div>
                  <p className="font-ui text-[9px] font-extrabold uppercase tracking-[0.18em] text-ivory/50">
                    Cash moved today
                  </p>
                  <p className="font-display text-[18px] font-black text-ivory">
                    {signedUsd(cashMovedToday)}
                  </p>
                </div>
              </div>
              <p className="mt-2 font-hand text-[12px] leading-snug text-ivory/55">
                Gross profit so far {signedUsd(today.revenue - today.cogs)} (revenue − food cost).
                Payroll and any fine settle at End Business Day.
              </p>
            </div>
          </Panel>
        </div>

        {/* TODAY'S OPERATIONS */}
        <div className="px-4 pt-4">
          <Panel className="p-4">
            <SectionLabel>Today's Operations</SectionLabel>
            {repairMessage ? (
              <p className="mt-2 font-hand text-[14px] text-olive">{repairMessage}</p>
            ) : null}
            {actionable.length === 0 ? (
              <p className="mt-1.5 font-hand text-[15px] leading-snug text-olive">
                ✓ Nothing needs your attention right now.
              </p>
            ) : null}
            <div className="mt-1">
              {actionable.map((alert) => (
                <div key={alert.key} className="border-b border-walnut/10 py-2.5 last:border-b-0">
                  <p
                    className={`font-ui text-[13px] font-extrabold ${SEVERITY_TEXT[alert.severity]}`}
                  >
                    {SEVERITY_ICON[alert.severity]} {alert.title}
                  </p>
                  <p className="mt-0.5 font-hand text-[14px] leading-snug text-walnut/70">
                    {alert.detail}
                  </p>
                  {alert.action ? (
                    <KButton
                      size="sm"
                      variant={alert.action.kind === "repair-refrigerator" ? "copper" : "cream"}
                      className="mt-2"
                      onClick={() => runAlertAction(alert)}
                    >
                      {alert.action.label}
                      {alert.action.kind === "navigate" ? " →" : ""}
                    </KButton>
                  ) : null}
                </div>
              ))}
            </div>
            {allClear.length > 0 ? (
              <>
                <Divider />
                {allClear.map((alert) => (
                  <button
                    key={alert.key}
                    type="button"
                    className="block w-full py-1 text-left"
                    onClick={() => runAlertAction(alert)}
                  >
                    <span className="font-ui text-[12px] font-extrabold text-olive">
                      ✓ {alert.title}
                    </span>{" "}
                    <span className="font-hand text-[14px] text-walnut/65">{alert.detail}</span>
                  </button>
                ))}
              </>
            ) : null}
          </Panel>
        </div>

        {/* TODAY'S ORDERS */}
        <div className="px-4 pt-4">
          <Panel className="p-4">
            <SectionLabel>Today's Orders</SectionLabel>
            <div className="mt-1.5 flex items-center justify-between">
              <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.14em] text-walnut/60">
                Customers Today
              </p>
              <p className="font-display text-[16px] font-black text-walnut-dark">
                {customers.served} / {customers.target} served
              </p>
            </div>
            <p className="font-hand text-[13px] leading-snug text-walnut/60">
              {customers.remaining} remaining. Today's target: popularity {customers.popularity}/100
              × {customers.multiplier.toFixed(2)} of {BASE_CUSTOMERS_PER_DAY} base customers ={" "}
              {customers.target}. Popularity at close sets tomorrow's target.
            </p>
            {customers.complete ? (
              <p className="mt-1.5 font-hand text-[15px] leading-snug text-walnut/75">
                Today's customers are complete. No more customers will arrive today — End the
                Business Day below.
              </p>
            ) : order && currentDish ? (
              (() => {
                const availability = businessOrderAvailability(save, currentDish);
                const payment = businessCustomerPayment(save, currentDish);
                return (
                  <>
                    <p className="mt-1.5 font-hand text-[15px] leading-snug text-walnut/75">
                      {order.customer.avatarEmoji} {order.customer.name} is waiting for{" "}
                      <b>{currentDish.name}</b> — pays {formatUsd(payment.customerPays)} (menu{" "}
                      {formatUsd(payment.menuPrice)} × {payment.multiplier.toFixed(2)}).
                    </p>
                    <p
                      className={`mt-1 font-hand text-[13px] ${availability.available ? "text-olive" : "text-copper"}`}
                    >
                      {availability.available
                        ? "✓ All ingredients in stock."
                        : `Missing ${availability.missing.map((id) => INGREDIENTS[id]?.name ?? id).join(", ")} — restock to accept it.`}
                    </p>
                  </>
                );
              })()
            ) : (
              <p className="mt-1.5 font-hand text-[15px] leading-snug text-walnut/70">
                The counter is closed. Open it to take real orders — customers pay your menu price ×
                a popularity modifier.
              </p>
            )}
            <p className="mt-1 font-hand text-[12px] text-walnut/50">
              Order → ingredients → preparation → serve → payment. A day with service earns +3
              popularity at close.
            </p>
            <Divider />
            <KButton full onClick={() => go("business-service")}>
              {order ? "Go to Service →" : "Open Service →"}
            </KButton>
          </Panel>
        </div>

        {/* END BUSINESS DAY */}
        <div className="px-4 pt-4">
          <Panel className="p-4">
            <SectionLabel>End Business Day</SectionLabel>
            <p className="mt-1 font-hand text-[13px] leading-snug text-walnut/55">
              If you close now:
            </p>
            <div className="mt-1">
              <Row
                label="Payroll"
                value={
                  preview.staffLaidOff.length > 0
                    ? "can't be paid — staff let go"
                    : preview.payrollPaid > 0
                      ? `−${formatUsd(preview.payrollPaid)}`
                      : "none (no staff)"
                }
              />
              <Row
                label="Spoilage"
                value={
                  preview.spoiledQuantity > 0
                    ? `${formatQuantity(preview.spoiledQuantity)} unit${preview.spoiledQuantity === 1 ? "" : "s"} (${formatUsd(preview.spoiledValue)})`
                    : "nothing spoils"
                }
              />
              <Row
                label="Inspection"
                value={
                  preview.inspectionReport.overall +
                  (preview.inspectionFine.fineAmount > 0
                    ? ` · fine ${formatUsd(preview.inspectionFine.fineAmount)}`
                    : " · no fine")
                }
              />
              <Row
                label="Popularity"
                value={`${preview.popularityDelta > 0 ? "+" : ""}${preview.popularityDelta} → ${preview.popularityScore}`}
              />
              <p className="-mt-0.5 pb-0.5 text-right font-hand text-[12px] leading-snug text-walnut/50">
                {popularityBreakdownText(preview.popularityBreakdown)}
              </p>
              <Row
                label="Day's operating profit"
                value={signedUsd(preview.dailyPnL.operatingProfit)}
              />
              <Row label="Closing cash" value={formatUsd(preview.dailyPnL.closingCash)} strong />
            </div>
            {preview.expiredSupplierId ? (
              <p className="mt-1 font-hand text-[13px] text-walnut/60">
                Your {getSupplier(preview.expiredSupplierId)?.name ?? preview.expiredSupplierId}{" "}
                contract ends tonight.
              </p>
            ) : null}
            <Divider />
            <KButton full onClick={handleAdvanceDay}>
              End Business Day →
            </KButton>
          </Panel>
        </div>

        {/* DAY SUMMARY — the real result right after closing, the persisted P&L afterwards. */}
        {dayResult ? (
          <DaySummary
            title={`Day ${businessDay - 1} Summary`}
            pnl={dayResult.dailyPnL}
            inspection={dayResult.inspectionReport.overall}
            finePaid={dayResult.inspectionFine.finePaid}
            fineRule={
              dayResult.inspectionFine.finePaid > 0
                ? dayResult.inspectionFine.severity === "LARGE"
                  ? "failed inspection"
                  : "repeated non-passing inspection"
                : null
            }
            spoiledQuantity={dayResult.spoiledQuantity}
            popularityDelta={dayResult.popularityDelta}
            popularityBreakdown={dayResult.popularityBreakdown}
            popularityScore={dayResult.popularityScore}
            notes={[
              dayResult.staffLaidOff.length > 0
                ? "Payroll couldn't be covered — the whole staff was let go."
                : null,
              dayResult.expiredSupplierId
                ? `Your contract with ${getSupplier(dayResult.expiredSupplierId)?.name ?? dayResult.expiredSupplierId} ended.`
                : null,
            ]}
            onOpenFinance={() => go("business-finance")}
          />
        ) : lastPnL ? (
          <DaySummary
            title="Last Business Day"
            pnl={lastPnL}
            inspection={lastInspection}
            finePaid={lastPnL.inspectionFines}
            fineRule={null}
            spoiledQuantity={null}
            popularityDelta={null}
            popularityScore={popularityScore}
            notes={[]}
            onOpenFinance={() => go("business-finance")}
          />
        ) : null}

        {/* MANAGE */}
        <div className="px-4 pt-4">
          <Panel className="p-4">
            <SectionLabel>Manage the Restaurant</SectionLabel>
            <ManagementLinks save={save} go={go} />
          </Panel>
        </div>

        <p className="px-8 pb-2 pt-5 text-center font-hand text-[14px] text-walnut/45">
          The business runs on its own clock and its own USD cash view — nothing here changes your
          campaign levels, and nothing in the campaign changes this.
        </p>
      </div>
      <BottomNav active="business" go={go} />
    </div>
  );
}

function DaySummary({
  title,
  pnl,
  inspection,
  finePaid,
  fineRule,
  spoiledQuantity,
  popularityDelta,
  popularityScore,
  popularityBreakdown,
  notes,
  onOpenFinance,
}: {
  title: string;
  pnl: DailyPnL;
  inspection: string | null;
  finePaid: number;
  fineRule: string | null;
  spoiledQuantity: number | null;
  popularityDelta: number | null;
  popularityScore: number;
  popularityBreakdown?: PopularityDayBreakdown;
  notes: (string | null)[];
  onOpenFinance: () => void;
}) {
  return (
    <div className="px-4 pt-4">
      <Panel tone="cream" className="p-4">
        <SectionLabel>{title}</SectionLabel>
        <div className="mt-1">
          <Row label="Revenue" value={formatUsd(pnl.revenue)} />
          <Row label="Food cost (COGS)" value={`−${formatUsd(pnl.cogs)}`} />
          <Row label="Labor" value={`−${formatUsd(pnl.staffCost)}`} />
          <Row
            label="Operating costs"
            value={`−${formatUsd(pnl.maintenanceCost + pnl.supplierCost + pnl.otherOperatingCost)}`}
          />
          <Row
            label={`Inspection${inspection ? ` (${inspection})` : ""}`}
            value={
              finePaid > 0
                ? `−${formatUsd(finePaid)}${fineRule ? ` · ${fineRule}` : ""}`
                : "no fine"
            }
          />
          <Row
            label="Spoilage (non-cash)"
            value={
              spoiledQuantity === null
                ? formatUsd(pnl.spoilageValue)
                : spoiledQuantity > 0
                  ? `${formatQuantity(spoiledQuantity)} unit${spoiledQuantity === 1 ? "" : "s"} · ${formatUsd(pnl.spoilageValue)}`
                  : "nothing spoiled"
            }
          />
          <Row
            label="Popularity"
            value={
              popularityDelta === null
                ? `${popularityScore}/100`
                : `${popularityDelta > 0 ? "+" : ""}${popularityDelta} → ${popularityScore}`
            }
          />
          {popularityBreakdown ? (
            <p className="-mt-0.5 pb-0.5 text-right font-hand text-[12px] leading-snug text-walnut/50">
              {popularityBreakdownText(popularityBreakdown)}
            </p>
          ) : null}
          <Divider />
          <Row label="Daily P&L (operating profit)" value={signedUsd(pnl.operatingProfit)} strong />
          {pnl.inventoryPurchaseCost !== pnl.cogs || pnl.capitalExpenditure > 0 ? (
            // Bridges operating profit to cash (exact identity): cash also paid for stock still
            // on the shelf (bought − used) and for equipment — neither is an expense in the P&L.
            <Row
              label={`Stock kept (bought ${formatUsd(pnl.inventoryPurchaseCost)} − used ${formatUsd(pnl.cogs)})${pnl.capitalExpenditure > 0 ? " + equipment" : ""}`}
              value={signedUsd(pnl.cogs - pnl.inventoryPurchaseCost - pnl.capitalExpenditure)}
            />
          ) : null}
          <Row label="Net cash change" value={signedUsd(pnl.netCashChange)} />
          <Row label="Closing cash" value={formatUsd(pnl.closingCash)} strong />
        </div>
        {notes
          .filter((n): n is string => !!n)
          .map((n) => (
            <p key={n} className="mt-1 font-hand text-[13px] text-copper">
              {n}
            </p>
          ))}
        <KButton full size="sm" variant="ghost" className="mt-3" onClick={onOpenFinance}>
          Full P&amp;L in Finance →
        </KButton>
      </Panel>
    </div>
  );
}

function ManagementLinks({ save, go }: { save: SaveData; go: (s: ScreenId) => void }) {
  const { businessDay } = save.business.calendar;
  const refrigerator = getRefrigerator(save.business.refrigerator.refrigeratorId);
  const used = getInventoryUsedCapacity(save.business.inventory);
  const available = getAvailableStorageCapacity(
    save.business.inventory,
    save.business.refrigerator.refrigeratorId,
  );
  const inventoryCount = Object.values(save.business.inventory).filter((e) => !!e).length;
  const contract = save.business.supplierContract;
  const hiredRoles = save.business.staff.hiredRoles;
  const pricedCount = Object.keys(save.business.menu).length;
  const condition = save.business.equipmentCondition.refrigeratorCondition;
  const links: { screen: ScreenId; label: string; status: string }[] = [
    {
      screen: "business-inventory",
      label: "Inventory",
      status:
        inventoryCount === 0
          ? "nothing in stock"
          : `${inventoryCount} items · ${formatUsd(inventoryValue(save.business.inventory))}`,
    },
    {
      screen: "business-refrigerator",
      label: "Refrigerator",
      status: `${refrigerator?.name ?? "Refrigerator"} · ${formatQuantity(used)}/${formatQuantity(used + available)} used · ${condition}/100 ${conditionBandFor(condition).toLowerCase()}`,
    },
    {
      screen: "business-menu",
      label: "Menu",
      status: `${activeBusinessDishes(save.business.menuActivation).length} of ${BUSINESS_DISH_CATALOG.length} on the menu · ${pricedCount === 0 ? "suggested prices" : `${pricedCount} custom-priced`}`,
    },
    {
      screen: "business-suppliers",
      label: "Suppliers",
      status:
        contract && isContractActive(contract, businessDay)
          ? `contract: ${getSupplier(contract.supplierId)?.name ?? contract.supplierId}`
          : "no contract",
    },
    {
      screen: "business-staff",
      label: "Staff",
      status:
        hiredRoles.length === 0
          ? `nobody hired · ${getAllStaffDefinitions().length} roles`
          : `${hiredRoles.length} hired · ${formatUsd(dailyPayroll(hiredRoles))}/day`,
    },
    {
      screen: "business-inspections",
      label: "Inspections",
      status: `last: ${save.business.inspectionFines.lastInspectionResult ?? "none yet"}`,
    },
    { screen: "business-finance", label: "Finance", status: "P&L, cash flow, lifetime" },
    { screen: "business-shop", label: "Market", status: "equipment, fridges, staff, suppliers" },
  ];
  return (
    <div className="mt-1">
      {links.map((l) => (
        <button
          key={l.screen}
          type="button"
          onClick={() => go(l.screen)}
          className="flex w-full items-center justify-between gap-3 border-b border-walnut/10 py-2.5 text-left last:border-b-0"
        >
          <span>
            <span className="block font-ui text-[13px] font-extrabold text-walnut-dark">
              {l.label}
            </span>
            <span className="block font-hand text-[13px] text-walnut/60">{l.status}</span>
          </span>
          <span className="font-ui text-[14px] font-extrabold text-copper">→</span>
        </button>
      ))}
    </div>
  );
}
