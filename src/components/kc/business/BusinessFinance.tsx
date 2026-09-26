import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import { Panel, ScreenHeader, Divider, Badge } from "../common/primitives";
import { BusinessCash } from "./BusinessCash";
import { formatUsd } from "@/game/business/businessCurrency";
import { BottomNav } from "../Kitchen";
import { lifetimeSummary } from "@/game/business/BusinessFinanceManager";
import type { DailyPnL } from "@/game/business/BusinessFinanceManager";

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex items-center justify-between font-ui text-[13px] font-black text-walnut-dark"
          : "flex items-center justify-between font-ui text-[12px] font-bold text-walnut/70"
      }
    >
      <span className={muted ? "text-walnut/45" : undefined}>{label}</span>
      <span className={muted ? "text-walnut/45" : undefined}>{value}</span>
    </div>
  );
}

/**
 * BUSINESS_FINANCE — Economy V3 Phase 15. The Business Mode P&L screen —
 * every number here is either read live from `save.business.finance`
 * (the running accumulator, lifetime COGS and — Economy V3 Phase 16 —
 * the running `lifetime` totals BusinessFinanceManager.ts maintains,
 * which no longer depend on the 200-entry ledger window) — never a
 * second, invented financial model. TODAY's revenue/COGS/capital figures accrue live as
 * the player serves orders/buys equipment; labor and inspection fines
 * are honestly labeled "settles at End Business Day" rather than
 * showing a fabricated estimate, since that IS when this game actually
 * charges them (BusinessDayManager.endBusinessDay). The Most Recent Day
 * section shows the last fully-closed day's complete, reconciled P&L —
 * persisted (`business.finance.lastDailyPnL`), so it survives reload.
 */
export function BusinessFinance({ go, save }: { go: (s: ScreenId) => void; save: SaveData }) {
  const { dailyAccumulator, lastDailyPnL } = save.business.finance;
  const todayGrossProfit = dailyAccumulator.revenue - dailyAccumulator.cogs;
  const todayOperatingExpensesSoFar =
    dailyAccumulator.maintenanceCost + dailyAccumulator.supplierCost;
  const todayOperatingProfitSoFar = todayGrossProfit - todayOperatingExpensesSoFar;
  const todayNetCashChangeSoFar =
    dailyAccumulator.revenue -
    dailyAccumulator.inventoryPurchaseCost -
    dailyAccumulator.maintenanceCost -
    dailyAccumulator.supplierCost -
    dailyAccumulator.capitalExpenditure;
  const lifetime = lifetimeSummary(save);

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(216,168,78,0.28),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Finance"
          subtitle="how the business is really doing"
          onBack={() => go("business")}
          right={<BusinessCash cents={save.credits} />}
        />

        {/* ===== Cash balance hero ===== */}
        <div className="px-4 pt-2">
          <Panel tone="dark" className="p-4 text-center">
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold">
              Business Cash
            </p>
            <p className="mt-1 font-display text-[32px] font-black text-ivory">
              {formatUsd(save.credits)}
            </p>
          </Panel>
        </div>

        {/* ===== Today (live, in-progress) ===== */}
        <div className="px-4 pt-4">
          <p className="mb-2 font-display text-[16px] font-black text-walnut-dark">
            Today (so far)
          </p>
          <Panel tone="cream" className="p-3">
            <Row label="Revenue" value={formatUsd(dailyAccumulator.revenue)} />
            <Row label="Food Cost / COGS" value={`-${formatUsd(dailyAccumulator.cogs)}`} />
            <Divider />
            <Row label="Gross Profit" value={formatUsd(todayGrossProfit)} strong />
            <div className="mt-1.5" />
            <Row label="Labor" value="settles at End Business Day" muted />
            <Row
              label="Operating Expenses (maintenance + supplier fees)"
              value={`-${formatUsd(todayOperatingExpensesSoFar)}`}
            />
            <Row label="Inspection Fines" value="settles at End Business Day" muted />
            <Divider />
            <Row
              label="Operating Profit (excl. labor/fines, not yet charged)"
              value={formatUsd(todayOperatingProfitSoFar)}
              strong
            />
            <div className="mt-1.5" />
            <Row
              label="Capital Investment"
              value={formatUsd(dailyAccumulator.capitalExpenditure)}
            />
            <Row
              label="Inventory Purchased (asset, not a food-cost expense)"
              value={formatUsd(dailyAccumulator.inventoryPurchaseCost)}
            />
            <Divider />
            <Row
              label="Net Cash Change (so far, excl. labor/fines)"
              value={formatUsd(todayNetCashChangeSoFar)}
              strong
            />
          </Panel>
        </div>

        {/* ===== Most recent completed day ===== */}
        <div className="px-4 pt-4">
          <p className="mb-2 font-display text-[16px] font-black text-walnut-dark">
            Most Recent Business Day
          </p>
          {lastDailyPnL ? (
            <MostRecentDayPanel pnl={lastDailyPnL} />
          ) : (
            <Panel tone="cream" className="p-3">
              <p className="font-hand text-[13px] text-walnut/60">
                No Business Day has ended yet — end one from the Dashboard to see its full P&L here.
              </p>
            </Panel>
          )}
        </div>

        {/* ===== Lifetime summary ===== */}
        <div className="px-4 pt-4">
          <p className="mb-2 font-display text-[16px] font-black text-walnut-dark">
            {lifetime.coverage === "complete"
              ? "Lifetime (all Business Days)"
              : "Lifetime (since this save's earliest kept record)"}
          </p>
          <Panel tone="cream" className="p-3">
            {lifetime.coverage === "partial" ? (
              <p className="mb-2 font-hand text-[12px] leading-snug text-copper">
                This save was started before full lifetime tracking existed, and some of its oldest
                Business history wasn't kept. These totals begin at the earliest record the save
                still had, and are exact from then on.
              </p>
            ) : null}
            <Row label="Revenue" value={formatUsd(lifetime.cumulativeRevenue)} />
            <Row label="Food Cost / COGS" value={`-${formatUsd(lifetime.cumulativeCogs)}`} />
            <Row label="Gross Profit" value={formatUsd(lifetime.cumulativeGrossProfit)} />
            <Row label="Labor" value={`-${formatUsd(lifetime.cumulativeLabor)}`} />
            <Row
              label="Operating Costs (maintenance + supplier fees + fines)"
              value={`-${formatUsd(lifetime.cumulativeOperatingCosts)}`}
            />
            <Divider />
            <Row
              label="Operating Profit"
              value={formatUsd(lifetime.cumulativeOperatingProfit)}
              strong
            />
            <div className="mt-1.5" />
            <Row
              label="Capital Expenditure (not in operating profit)"
              value={formatUsd(lifetime.cumulativeCapitalExpenditure)}
            />
            <Row
              label="All Cash Spent (incl. ingredients + capital)"
              value={`-${formatUsd(lifetime.cumulativeCashExpenses)}`}
            />
            <div className="mt-1.5" />
            <div className="flex items-center justify-between">
              <p className="font-ui text-[12px] font-bold text-walnut/70">Orders Served</p>
              <Badge tone="sage">{lifetime.orderCount}</Badge>
            </div>
            <Row
              label="Average Revenue / Order"
              value={lifetime.orderCount > 0 ? formatUsd(lifetime.averageRevenuePerOrder) : "—"}
            />
            <Row
              label="Food Cost %"
              value={lifetime.cumulativeRevenue > 0 ? `${lifetime.foodCostPercent}%` : "—"}
            />
          </Panel>
        </div>

        <p className="px-8 pb-2 pt-4 text-center font-hand text-[12px] text-walnut/40">
          Every figure here comes from real Business Mode transactions — generated or cancelled
          orders, and configured-but-unsold menu prices, are never counted as revenue.
        </p>
      </div>
      <BottomNav active="business" go={go} />
    </div>
  );
}

function MostRecentDayPanel({ pnl }: { pnl: DailyPnL }) {
  return (
    <Panel tone="cream" className="p-3">
      <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.16em] text-copper">
        P&amp;L
      </p>
      <Row label="Opening Cash" value={formatUsd(pnl.openingCash)} />
      <Row label="Revenue" value={formatUsd(pnl.revenue)} />
      <Row label="Food Cost / COGS" value={`-${formatUsd(pnl.cogs)}`} />
      <Divider />
      <Row label="Gross Profit" value={formatUsd(pnl.grossProfit)} strong />
      <div className="mt-1.5" />
      <Row label="Labor" value={`-${formatUsd(pnl.staffCost)}`} />
      <Row label="Maintenance" value={`-${formatUsd(pnl.maintenanceCost)}`} />
      <Row label="Supplier Cost" value={`-${formatUsd(pnl.supplierCost)}`} />
      <Row label="Other Operating Cost" value={`-${formatUsd(pnl.otherOperatingCost)}`} muted />
      <Row label="Inspection Fines" value={`-${formatUsd(pnl.inspectionFines)}`} />
      <Divider />
      <Row label="Operating Profit" value={formatUsd(pnl.operatingProfit)} strong />
      <p className="mt-1 font-hand text-[11px] text-walnut/45">
        Spoilage (non-cash, not in Operating Profit): {formatUsd(pnl.spoilageValue)}
      </p>

      <Divider />
      <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.16em] text-copper">
        Cash Flow
      </p>
      <Row
        label="Inventory Purchased (asset, not food cost)"
        value={`-${formatUsd(pnl.inventoryPurchaseCost)}`}
      />
      <Row label="Operating Cash Flow" value={formatUsd(pnl.operatingCashFlow)} strong />
      <Row label="Capital Expenditure" value={`-${formatUsd(pnl.capitalExpenditure)}`} />
      <Divider />
      <Row label="Net Cash Change" value={formatUsd(pnl.netCashChange)} strong />
      <Row label="Closing Cash" value={formatUsd(pnl.closingCash)} strong />
    </Panel>
  );
}
