import type { ReactNode } from "react";
import type { SaveData } from "@/game/SaveManager";
import { Panel, Divider, Badge } from "../common/primitives";
import { Eyebrow } from "../common/Meters";
import { formatUsd } from "@/game/business/businessCurrency";
import { lifetimeSummary } from "@/game/business/BusinessFinanceManager";
import type { DailyPnL } from "@/game/business/BusinessFinanceManager";

function Line({ label, value, strong }: { label: ReactNode; value: string; strong?: boolean }) {
  return (
    <div
      className={
        strong
          ? "flex items-baseline justify-between gap-3 py-0.5 font-ui text-[14.5px] font-black text-walnut-dark"
          : "flex items-baseline justify-between gap-3 py-0.5 font-ui text-[13.5px] font-bold text-walnut/70"
      }
    >
      <span>{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

/**
 * BUSINESS · OPERATIONS → Finance (Economy V3 Phases 15–16). Every figure is
 * read from `save.business.finance` (today's running totals, the last closed
 * day's persisted P&L) or `lifetimeSummary` — never a second model. Full
 * statements sit behind "details" so the tab stays readable at a glance.
 */
export function BusinessFinance({ save }: { save: SaveData }) {
  const { dailyAccumulator, lastDailyPnL } = save.business.finance;
  const todayFoodMargin = dailyAccumulator.revenue - dailyAccumulator.cogs;
  const todayRunningCosts = dailyAccumulator.maintenanceCost + dailyAccumulator.supplierCost;
  const todayNetCash =
    dailyAccumulator.revenue -
    dailyAccumulator.inventoryPurchaseCost -
    (dailyAccumulator.packagingPurchaseCost ?? 0) -
    dailyAccumulator.maintenanceCost -
    dailyAccumulator.supplierCost -
    dailyAccumulator.capitalExpenditure;
  const lifetime = lifetimeSummary(save);

  return (
    <Panel className="p-4">
      <Eyebrow>💰 Finance</Eyebrow>

      <p className="mt-2 font-display text-[16.5px] font-black text-walnut-dark">Today so far</p>
      <Line label="Revenue" value={formatUsd(dailyAccumulator.revenue)} />
      <Line label="Ingredients & packaging used" value={`−${formatUsd(dailyAccumulator.cogs)}`} />
      <Line label="Repairs & supplier fees" value={`−${formatUsd(todayRunningCosts)}`} />
      <Line
        label="Profit so far (before tonight's pay & fines)"
        value={formatUsd(todayFoodMargin - todayRunningCosts)}
        strong
      />
      <Line label="Cash moved today" value={formatUsd(todayNetCash)} />
      <p className="font-hand text-[14px] leading-snug text-walnut/50">
        Stock bought ({formatUsd(dailyAccumulator.inventoryPurchaseCost)}), packaging (
        {formatUsd(dailyAccumulator.packagingPurchaseCost ?? 0)}) and equipment (
        {formatUsd(dailyAccumulator.capitalExpenditure)}) move cash but aren't costs until used.
      </p>

      <Divider />
      <p className="font-display text-[16.5px] font-black text-walnut-dark">Last business day</p>
      {lastDailyPnL ? (
        <LastDay pnl={lastDailyPnL} />
      ) : (
        <p className="font-hand text-[16px] text-walnut/60">
          No business day has ended yet — its results appear here.
        </p>
      )}

      <Divider />
      <p className="font-display text-[16.5px] font-black text-walnut-dark">
        {lifetime.coverage === "complete"
          ? "All time"
          : "All time (since the earliest kept record)"}
      </p>
      <Line label="Revenue" value={formatUsd(lifetime.cumulativeRevenue)} />
      <Line
        label="Costs (ingredients, staff, repairs, fees, fines)"
        value={`−${formatUsd(lifetime.cumulativeRevenue - lifetime.cumulativeOperatingProfit)}`}
      />
      <Line label="Profit" value={formatUsd(lifetime.cumulativeOperatingProfit)} strong />
      <div className="mt-1 flex items-center justify-between font-ui text-[13.5px] font-bold text-walnut/70">
        <span>Orders served</span>
        <Badge tone="sage">{lifetime.orderCount}</Badge>
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer py-2 font-ui text-[13.5px] font-extrabold text-copper">
          Full all-time breakdown ▾
        </summary>
        <Line
          label="Ingredients used (food cost)"
          value={`−${formatUsd(lifetime.cumulativeCogs)}`}
        />
        <Line label="Revenue after ingredients" value={formatUsd(lifetime.cumulativeGrossProfit)} />
        <Line label="Staff pay" value={`−${formatUsd(lifetime.cumulativeLabor)}`} />
        <Line
          label="Repairs, supplier fees & fines"
          value={`−${formatUsd(lifetime.cumulativeOperatingCosts)}`}
        />
        <Line label="Equipment bought" value={formatUsd(lifetime.cumulativeCapitalExpenditure)} />
        <Line label="All cash spent" value={`−${formatUsd(lifetime.cumulativeCashExpenses)}`} />
        <Line
          label="Average per order"
          value={lifetime.orderCount > 0 ? formatUsd(lifetime.averageRevenuePerOrder) : "—"}
        />
        <Line
          label="Food cost %"
          value={lifetime.cumulativeRevenue > 0 ? `${lifetime.foodCostPercent}%` : "—"}
        />
      </details>
    </Panel>
  );
}

function LastDay({ pnl }: { pnl: DailyPnL }) {
  const costs = pnl.revenue - pnl.operatingProfit;
  return (
    <>
      <Line label="Revenue" value={formatUsd(pnl.revenue)} />
      <Line label="Costs" value={`−${formatUsd(costs)}`} />
      <Line label="Profit" value={formatUsd(pnl.operatingProfit)} strong />
      <details>
        <summary className="cursor-pointer py-2 font-ui text-[13.5px] font-extrabold text-copper">
          Full day breakdown ▾
        </summary>
        <Line label="Opening cash" value={formatUsd(pnl.openingCash)} />
        <Line label="Ingredients & packaging used" value={`−${formatUsd(pnl.cogs)}`} />
        <Line label="Staff pay" value={`−${formatUsd(pnl.staffCost)}`} />
        <Line label="Repairs" value={`−${formatUsd(pnl.maintenanceCost)}`} />
        <Line label="Supplier fees" value={`−${formatUsd(pnl.supplierCost)}`} />
        <Line label="Other" value={`−${formatUsd(pnl.otherOperatingCost)}`} />
        <Line label="Inspection fines" value={`−${formatUsd(pnl.inspectionFines)}`} />
        <Line label="Spoilage (not cash)" value={formatUsd(pnl.spoilageValue)} />
        <Line label="Stock bought" value={`−${formatUsd(pnl.inventoryPurchaseCost)}`} />
        <Line label="Packaging bought" value={`−${formatUsd(pnl.packagingPurchaseCost ?? 0)}`} />
        <Line label="Equipment bought" value={`−${formatUsd(pnl.capitalExpenditure)}`} />
        <Line label="Net cash change" value={formatUsd(pnl.netCashChange)} strong />
        <Line label="Closing cash" value={formatUsd(pnl.closingCash)} strong />
      </details>
    </>
  );
}
