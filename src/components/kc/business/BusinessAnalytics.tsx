import type { ReactNode } from "react";
import type { SaveData } from "@/game/SaveManager";
import { Panel } from "../common/primitives";
import { InfoTip } from "../common/InfoTip";
import { Eyebrow } from "../common/Meters";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { purchaseUnitFor } from "@/game/business/businessPricing";
import { formatUsd } from "@/game/business/businessCurrency";
import { formatQuantity } from "@/game/business/businessInventory";
import { displayMeasure, formatStockAmount } from "@/game/business/measure";
import type { DailyPnL } from "@/game/business/BusinessFinanceManager";
import { SUPPLY_SECTIONS, SUPPLY_SECTION_ORDER } from "@/game/business/businessSupplies";
import { supplySectionSummary } from "@/game/business/BusinessSuppliesManager";
import {
  dishSales,
  ingredientConsumption,
  purchasingStats,
} from "@/game/business/inventoryAnalytics";
import { IngredientIcon } from "@/components/kc/common/IngredientIcon";
import { BUSINESS_DISH_CATALOG } from "@/game/business/businessDishCatalog";
import { dishArtUrl } from "@/game/dishArt";
import { Art, PIcon, ProgressCard, ValuePill } from "../progress/ProgressKit";

/** How many ranked rows the Best sellers / Ingredients used lists show. */
const TOP_ROWS = 5;

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: string | undefined;
  /** A painted icon at the left (the purchasing tiles). */
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[14px] border border-[#ebd2a0] bg-[linear-gradient(180deg,#fffaf0,#fcefd6)] px-2.5 py-2">
      {icon ? <span className="grid w-10 shrink-0 place-items-center">{icon}</span> : null}
      <span className="min-w-0">
        <span className="block truncate font-ui text-[12px] font-extrabold text-walnut/70">
          {label}
        </span>
        <span className="block truncate font-display text-[19px] font-black leading-tight text-walnut-dark tabular-nums">
          {value}
        </span>
        {sub ? (
          <span className="block truncate font-hand text-[14px] italic leading-tight text-walnut/60">
            {sub}
          </span>
        ) : null}
      </span>
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
 * BUSINESS · OPERATIONS — what sells, what is bought, what is used. Every figure comes from inventoryAnalytics.ts over the finance
 * accumulator and the one ledger.
 *
 * Painted (developer 2026-11-25, Business UI design pictures 10 and 11): walnut-ribbon cards with a decoration each; the best sellers show their dish's own
 * plate (public/dishes, small), the purchasing figures are four icon tiles, the supplies three icon rows.
 */
export function OperationsAnalytics({ save }: { save: SaveData }) {
  const purchasing = purchasingStats(save);
  const consumption = ingredientConsumption(save);
  const sales = dishSales(save);
  const name = (id: IngredientId) => INGREDIENTS[id].name;
  const recipeOf = (dishId: string) =>
    BUSINESS_DISH_CATALOG.find((d) => d.id === dishId)?.sourceRecipeId ?? dishId;
  return (
    <>
      <ProgressCard
        dark
        title="Best-selling dishes"
        icon={<PIcon name="icons-a/trophy" fallback="🏅" size={30} />}
        className="pt-10"
        data-testid="best-sellers-card"
      >
        <Art
          name="biz:decor-b/cloche-laurel"
          className="pointer-events-none absolute right-3 top-1 hidden h-16 w-auto @min-[620px]:block"
        />
        {sales.dishes.length > 0 ? (
          <>
            <div data-testid="best-sellers">
              {sales.dishes.slice(0, TOP_ROWS).map((d) => {
                const art = dishArtUrl(recipeOf(d.id));
                return (
                  <div
                    key={d.id}
                    data-dish={d.id}
                    className="flex min-h-12 items-center justify-between gap-2 border-b border-walnut/10 py-1.5 font-ui text-[13px] last:border-b-0"
                  >
                    <span className="flex min-w-0 items-center gap-2.5 font-extrabold text-walnut-dark">
                      {art ? (
                        <img
                          src={art}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          className="h-10 w-10 shrink-0 select-none object-contain"
                        />
                      ) : null}
                      <span className="min-w-0 truncate">{d.name}</span>
                    </span>
                    <span className="shrink-0 font-bold text-walnut/65 tabular-nums">
                      {plural(d.orders, "order")} · {formatUsd(d.revenue)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-1 font-hand text-[13px] text-walnut/55">
              From your last {plural(sales.orders, "paid order")}.
            </p>
          </>
        ) : (
          <NothingYet />
        )}
      </ProgressCard>

      <ProgressCard
        dark
        title="Ingredient purchasing"
        icon={<PIcon name="biz:icons-b/grain-sack" fallback="💰" size={30} />}
        className="pt-10"
      >
        <Art
          name="biz:decor-b/purchasing-cluster"
          className="pointer-events-none absolute bottom-3 right-3 hidden h-auto w-[270px] @min-[900px]:block"
        />
        <div
          className="grid grid-cols-1 gap-2 @min-[480px]:grid-cols-2 @min-[900px]:mr-[290px]"
          data-testid="purchasing"
        >
          <Stat
            icon={<PIcon name="icons-c/calendar" fallback="📅" size={36} />}
            label="This Business Day"
            value={formatUsd(purchasing.businessDaySpent)}
            sub={
              purchasing.businessDayPurchases === null
                ? undefined
                : plural(purchasing.businessDayPurchases, "purchase")
            }
          />
          <Stat
            icon={<PIcon name="biz:icons-a/cart" fallback="🛒" size={36} />}
            label="Average purchase"
            value={
              purchasing.averagePurchase === null ? "—" : formatUsd(purchasing.averagePurchase)
            }
          />
          <Stat
            icon={<PIcon name="biz:icons-b/cubes" fallback="📦" size={36} />}
            label="Spent today"
            value={formatUsd(purchasing.todaySpent)}
            sub={plural(purchasing.todayPurchases, "purchase")}
          />
          <Stat
            icon={<PIcon name="icons-a/bars" fallback="📊" size={36} />}
            label="All time"
            value={formatUsd(purchasing.lifetimeSpent)}
            sub={
              purchasing.lastBusinessDaySpent === null
                ? undefined
                : `Last day ${formatUsd(purchasing.lastBusinessDaySpent)}`
            }
          />
        </div>
      </ProgressCard>

      <SupplyPurchasing save={save} />

      <ProgressCard
        dark
        title="Ingredients used"
        icon={<PIcon name="biz:icons-b/veg-basket" fallback="🔥" size={30} />}
        className="pt-10"
      >
        <Art
          name="biz:decor-b/used-cluster"
          className="pointer-events-none absolute right-3 top-1 hidden h-16 w-auto @min-[620px]:block"
        />
        {consumption.items.length > 0 ? (
          <>
            <div data-testid="most-used">
              {consumption.items.slice(0, TOP_ROWS).map((item) => (
                <div
                  key={item.id}
                  data-ingredient={item.id}
                  className="flex min-h-11 items-center justify-between gap-2 border-b border-walnut/10 py-1.5 font-ui text-[13px] last:border-b-0"
                >
                  <span className="min-w-0 truncate font-extrabold text-walnut-dark">
                    <IngredientIcon id={item.id} fallback={INGREDIENT_EMOJI[item.id]} />{" "}
                    {name(item.id)}
                  </span>
                  <span className="shrink-0 font-bold text-walnut/65">
                    {formatStockAmount(item.id, item.quantity, displayMeasure())} ·{" "}
                    {plural(item.orders, "order")}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-1 font-hand text-[13px] text-walnut/55">
              From your last {plural(consumption.orders, "paid order")}.
            </p>
          </>
        ) : (
          <NothingYet />
        )}
      </ProgressCard>
    </>
  );
}

/** The empty state of a list: a plate icon and "Nothing served yet". */
function NothingYet() {
  return (
    <p className="flex items-center gap-2.5 rounded-2xl bg-white/50 px-3 py-2.5 font-hand text-[16px] italic text-walnut/65">
      <PIcon name="biz:icons-a/plate-cutlery" fallback="🍽️" size={30} />
      Nothing served yet
    </p>
  );
}

/** The painted picture of each supply section (RB-icons-b). */
const SUPPLY_ART: Record<string, string> = {
  culinary: "biz:icons-b/smallwares",
  service: "biz:icons-b/tableware",
  packaging: "biz:icons-b/takeaway-box",
};

/**
 * BUSINESS · OPERATIONS — what was spent on supplies (moved here from the
 * old Business → Supplies tab; the stock itself is on Inventory → Supplies):
 * per section, all time — spent, Market orders, and saved vs retail (a
 * display metric, never money); packaging also shows what served orders
 * used. All from `business.supplies.lifetime` (supplySectionSummary).
 */
function SupplyPurchasing({ save }: { save: SaveData }) {
  const rows = SUPPLY_SECTION_ORDER.map((section) => ({
    section,
    meta: SUPPLY_SECTIONS[section],
    summary: supplySectionSummary(save.business.supplies, section),
  }));
  const packaging = rows.find((r) => r.section === "packaging")!.summary;
  return (
    <ProgressCard
      dark
      title="Supply purchasing"
      icon={<PIcon name="biz:icons-a/wholesale-truck" fallback="🧰" size={30} />}
      className="pt-10"
    >
      <Art
        name="biz:decor-b/bag-cluster"
        className="pointer-events-none absolute bottom-3 right-3 hidden h-auto w-[280px] @min-[900px]:block"
      />
      <div data-testid="supplies-analytics" className="@min-[900px]:mr-[300px]">
        {rows.map(({ section, meta, summary }) => (
          <div
            key={section}
            data-supply-section={section}
            className="flex items-center gap-3 border-b border-walnut/10 py-2 last:border-b-0"
          >
            <PIcon
              name={SUPPLY_ART[section] ?? "biz:icons-b/cubes"}
              fallback={meta.emoji}
              size={40}
            />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[16.5px] font-black text-walnut-dark">{meta.short}</p>
              <p className="font-hand text-[14px] leading-tight text-walnut/60">
                {plural(summary.purchases, "Market order")}, all time · saved{" "}
                {formatUsd(summary.savedVsRetail)} vs retail
              </p>
            </div>
            <ValuePill className="shrink-0 text-[14.5px] tabular-nums">
              {formatUsd(summary.spent)}
            </ValuePill>
          </div>
        ))}
      </div>
      <p className="mt-2 flex items-center gap-1.5 font-hand text-[14px] leading-snug text-walnut/60">
        <ValuePill className="min-h-8 text-[13px]">
          <PIcon name="biz:icons-a/price-tag" fallback="🏷️" size={22} />
          {packaging.unitsUsed.toLocaleString("en-US")} packaging used ·{" "}
          {formatUsd(packaging.usedCost)}
          <InfoTip label="About packaging and savings">
            Packaging cost is counted in each order's COGS. Saved vs retail is a wholesale discount,
            not cash.
          </InfoTip>
        </ValuePill>
      </p>
    </ProgressCard>
  );
}
