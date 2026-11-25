import type { ReactNode } from "react";
import type { SaveData } from "@/game/SaveManager";
import { InfoTip } from "../common/InfoTip";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/business/businessCurrency";
import { lifetimeSummary } from "@/game/business/BusinessFinanceManager";
import type { DailyPnL } from "@/game/business/BusinessFinanceManager";
import { PIcon, ProgressCard, ValuePill } from "../progress/ProgressKit";

/** One figure of a statement: an optional painted icon, the words, the amount. `strong` = a gold-tinted total row. */
function Line({
  label,
  value,
  strong,
  icon,
}: {
  label: ReactNode;
  value: string;
  strong?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-9 items-center gap-2.5 rounded-xl px-2 py-0.5 font-ui",
        strong
          ? "bz-hot text-[14px] font-black text-walnut-dark"
          : "text-[13px] font-bold text-walnut/75",
      )}
    >
      {icon ? <span className="grid w-7 shrink-0 place-items-center">{icon}</span> : null}
      <span className="min-w-0 flex-1">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

/** A statement block: a heading row with a painted icon, then its lines, on a pale tile. */
function Block({
  icon,
  title,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[18px] border border-[#ebd2a0] bg-white/45 p-2.5", className)}>
      <p className="mb-1 flex items-center gap-2 rounded-xl bg-[#f7e6c4]/70 px-2 py-1.5 font-display text-[17px] font-black text-walnut-dark">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

const ico = (name: string, fallback: string) => <PIcon name={name} fallback={fallback} size={26} />;

/**
 * BUSINESS · OPERATIONS → Finance (Economy V3 Phases 15–16). Every figure is
 * read from `save.business.finance` (today's running totals, the last closed
 * day's persisted P&L) or `lifetimeSummary` — never a second model. Full
 * statements sit behind "details" so the tab stays readable at a glance.
 *
 * Painted (developer 2026-11-25, Business UI design picture 09): a walnut-ribbon card, Today so far and Last business day side by side in a wide window,
 * All time under them; the figures and the "details" are the same.
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
    <ProgressCard
      dark
      title="Finance"
      icon={ico("icons-a/coins", "💰")}
      className="pt-10"
      data-testid="finance-card"
    >
      <div className="grid gap-3 @min-[720px]:grid-cols-2">
        <Block icon={ico("icons-c/calendar", "📅")} title="Today so far">
          <Line
            icon={ico("icons-a/coins", "💰")}
            label="Revenue"
            value={formatUsd(dailyAccumulator.revenue)}
          />
          <Line
            icon={ico("icons-b/box", "📦")}
            label="Ingredients & packaging used"
            value={`−${formatUsd(dailyAccumulator.cogs)}`}
          />
          <Line
            icon={ico("biz:icons-a/wrench", "🔧")}
            label="Repairs & supplier fees"
            value={`−${formatUsd(todayRunningCosts)}`}
          />
          <Line
            icon={ico("icons-a/bars", "📊")}
            label="Profit so far · before pay & fines"
            value={formatUsd(todayFoodMargin - todayRunningCosts)}
            strong
          />
          <Line
            icon={ico("icons-a/cash", "💵")}
            label="Cash moved today"
            value={formatUsd(todayNetCash)}
          />
          <p className="flex items-center gap-1.5 px-2 pt-1 font-hand text-[14px] leading-snug text-walnut/55">
            Cash vs costs
            <InfoTip label="Cash vs costs">
              Stock bought ({formatUsd(dailyAccumulator.inventoryPurchaseCost)}), packaging (
              {formatUsd(dailyAccumulator.packagingPurchaseCost ?? 0)}) and equipment (
              {formatUsd(dailyAccumulator.capitalExpenditure)}) move cash but aren't costs until
              used.
            </InfoTip>
          </p>
        </Block>

        <Block icon={ico("icons-c/calendar", "📅")} title="Last business day">
          {lastDailyPnL ? (
            <LastDay pnl={lastDailyPnL} />
          ) : (
            <p className="px-2 py-2 font-hand text-[15px] text-walnut/60">📅 No day closed yet</p>
          )}
        </Block>

        <Block
          icon={ico("icons-a/trophy", "🏆")}
          title={
            lifetime.coverage === "complete"
              ? "All time"
              : "All time (since the earliest kept record)"
          }
          className="@min-[720px]:col-span-2"
        >
          <Line
            icon={ico("icons-a/coins", "💰")}
            label="Revenue"
            value={formatUsd(lifetime.cumulativeRevenue)}
          />
          <Line
            icon={ico("biz:icons-b/crossed-cutlery", "🍴")}
            label="Costs (ingredients, staff, repairs, fees, fines)"
            value={`−${formatUsd(lifetime.cumulativeRevenue - lifetime.cumulativeOperatingProfit)}`}
          />
          <Line
            icon={ico("icons-a/bars", "📊")}
            label="Profit"
            value={formatUsd(lifetime.cumulativeOperatingProfit)}
            strong
          />
          <div className="flex min-h-9 items-center gap-2.5 px-2 font-ui text-[13px] font-bold text-walnut/75">
            <span className="grid w-7 shrink-0 place-items-center">
              {ico("icons-c/cloche", "🔔")}
            </span>
            <span className="flex-1">Orders served</span>
            <ValuePill tone="green" className="min-h-7 px-3 text-[13px]">
              {lifetime.orderCount}
            </ValuePill>
          </div>
          <details className="mt-1">
            <summary className="cursor-pointer px-2 py-2 font-ui text-[12.5px] font-extrabold text-copper">
              Full all-time breakdown ▾
            </summary>
            <Line
              label="Ingredients used (food cost)"
              value={`−${formatUsd(lifetime.cumulativeCogs)}`}
            />
            <Line
              label="Revenue after ingredients"
              value={formatUsd(lifetime.cumulativeGrossProfit)}
            />
            <Line label="Staff pay" value={`−${formatUsd(lifetime.cumulativeLabor)}`} />
            <Line
              label="Repairs, supplier fees & fines"
              value={`−${formatUsd(lifetime.cumulativeOperatingCosts)}`}
            />
            <Line
              label="Equipment bought"
              value={formatUsd(lifetime.cumulativeCapitalExpenditure)}
            />
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
        </Block>
      </div>
    </ProgressCard>
  );
}

function LastDay({ pnl }: { pnl: DailyPnL }) {
  const costs = pnl.revenue - pnl.operatingProfit;
  return (
    <>
      <Line icon={ico("icons-a/coins", "💰")} label="Revenue" value={formatUsd(pnl.revenue)} />
      <Line icon={ico("icons-b/box", "📦")} label="Costs" value={`−${formatUsd(costs)}`} />
      <Line
        icon={ico("icons-a/bars", "📊")}
        label="Profit"
        value={formatUsd(pnl.operatingProfit)}
        strong
      />
      <details>
        <summary className="cursor-pointer px-2 py-2 font-ui text-[12.5px] font-extrabold text-copper">
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
