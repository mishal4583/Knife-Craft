import type { ReactNode } from "react";
import type { SaveData } from "@/game/SaveManager";
import { Panel } from "../common/primitives";
import { Eyebrow } from "../common/Meters";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { purchaseUnitFor } from "@/game/business/businessPricing";
import { formatUsd } from "@/game/business/businessCurrency";
import { formatQuantity } from "@/game/business/businessInventory";
import type { DailyPnL } from "@/game/business/BusinessFinanceManager";
import {
  dishSales,
  ingredientConsumption,
  purchasingStats,
} from "@/game/business/inventoryAnalytics";

/** How many ranked rows the Best sellers / Ingredients used lists show. */
const TOP_ROWS = 5;

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: string | undefined;
}) {
  return (
    <div className="min-w-0 rounded-[14px] border border-walnut/10 bg-ivory/60 px-2.5 py-2">
      <p className="truncate font-ui text-[10px] font-extrabold uppercase tracking-[0.06em] text-walnut/60">
        {label}
      </p>
      <p className="truncate font-display text-[16px] font-black leading-tight text-walnut-dark tabular-nums">
        {value}
      </p>
      {sub ? (
        <p className="truncate font-hand text-[12px] leading-tight text-walnut/60">{sub}</p>
      ) : null}
    </div>
  );
}

/**
 * BUSINESS · OVERVIEW — today at a glance: orders served, average dish
 * revenue and profit margin, from today's live P&L (the same
 * previewBusinessDayClose figures the KPI cards use) and the finance
 * accumulator's order count. Display only; no new figure is stored.
 */
export function TodayAtAGlance({ save, today }: { save: SaveData; today: DailyPnL }) {
  const orders = save.business.finance.dailyAccumulator.ordersServed;
  const average = orders > 0 ? Math.round(today.revenue / orders) : null;
  const margin =
    today.revenue > 0 ? Math.round((today.operatingProfit / today.revenue) * 100) : null;
  return (
    <Panel className="p-4">
      <Eyebrow>🧮 Today at a glance</Eyebrow>
      <div className="mt-2 grid grid-cols-3 gap-2" data-testid="today-at-a-glance">
        <Stat label="Orders" value={orders} sub="served today" />
        <Stat
          label="Per dish"
          value={average === null ? "—" : formatUsd(average)}
          sub="average revenue"
        />
        <Stat label="Margin" value={margin === null ? "—" : `${margin}%`} sub="profit ÷ revenue" />
      </div>
    </Panel>
  );
}

/**
 * BUSINESS · OPERATIONS — ingredient purchasing, what served orders used
 * and the best-selling dishes. Moved here from the old Business →
 * Inventory tab: they describe how the restaurant runs, not what it has.
 * Every figure comes from inventoryAnalytics.ts over the finance
 * accumulator and the one ledger.
 */
export function OperationsAnalytics({ save }: { save: SaveData }) {
  const purchasing = purchasingStats(save);
  const consumption = ingredientConsumption(save);
  const sales = dishSales(save);
  const name = (id: IngredientId) => INGREDIENTS[id].name;
  return (
    <>
      <Panel className="p-4">
        <Eyebrow>🏅 Best-selling dishes</Eyebrow>
        {sales.dishes.length > 0 ? (
          <>
            <div className="mt-1" data-testid="best-sellers">
              {sales.dishes.slice(0, TOP_ROWS).map((d) => (
                <div
                  key={d.id}
                  data-dish={d.id}
                  className="flex items-center justify-between gap-2 border-b border-walnut/10 py-1.5 font-ui text-[12px] last:border-b-0"
                >
                  <span className="min-w-0 truncate font-extrabold text-walnut-dark">{d.name}</span>
                  <span className="shrink-0 font-bold text-walnut/65 tabular-nums">
                    {plural(d.orders, "order")} · {formatUsd(d.revenue)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-1 font-hand text-[12px] text-walnut/55">
              From your last {plural(sales.orders, "paid order")}.
            </p>
          </>
        ) : (
          <p className="mt-1 font-hand text-[13px] text-walnut/60">
            Nothing served yet — serve Business orders to see your best sellers.
          </p>
        )}
      </Panel>

      <Panel className="p-4">
        <Eyebrow>💰 Ingredient purchasing</Eyebrow>
        <div className="mt-2 grid grid-cols-2 gap-2" data-testid="purchasing">
          <Stat
            label="This Business Day"
            value={formatUsd(purchasing.businessDaySpent)}
            sub={
              purchasing.businessDayPurchases === null
                ? undefined
                : plural(purchasing.businessDayPurchases, "purchase")
            }
          />
          <Stat
            label="Average purchase"
            value={
              purchasing.averagePurchase === null ? "—" : formatUsd(purchasing.averagePurchase)
            }
          />
          <Stat
            label="Spent today"
            value={formatUsd(purchasing.todaySpent)}
            sub={plural(purchasing.todayPurchases, "purchase")}
          />
          <Stat
            label="All time"
            value={formatUsd(purchasing.lifetimeSpent)}
            sub={
              purchasing.lastBusinessDaySpent === null
                ? undefined
                : `Last day ${formatUsd(purchasing.lastBusinessDaySpent)}`
            }
          />
        </div>
      </Panel>

      <Panel className="p-4">
        <Eyebrow>🔥 Ingredients used</Eyebrow>
        {consumption.items.length > 0 ? (
          <>
            <div className="mt-1" data-testid="most-used">
              {consumption.items.slice(0, TOP_ROWS).map((item) => (
                <div
                  key={item.id}
                  data-ingredient={item.id}
                  className="flex items-center justify-between gap-2 border-b border-walnut/10 py-1.5 font-ui text-[12px] last:border-b-0"
                >
                  <span className="min-w-0 truncate font-extrabold text-walnut-dark">
                    {INGREDIENT_EMOJI[item.id]} {name(item.id)}
                  </span>
                  <span className="shrink-0 font-bold text-walnut/65">
                    {formatQuantity(item.quantity)} {purchaseUnitFor(item.id)} ·{" "}
                    {plural(item.orders, "order")}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-1 font-hand text-[12px] text-walnut/55">
              From your last {plural(consumption.orders, "paid order")}.
            </p>
          </>
        ) : (
          <p className="mt-1 font-hand text-[13px] text-walnut/60">
            Nothing served yet — serve Business orders to see what your kitchen uses most.
          </p>
        )}
      </Panel>
    </>
  );
}
