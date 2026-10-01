import type { ReactNode } from "react";
import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, Badge } from "../common/primitives";
import { Bar, Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { purchaseUnitFor } from "@/game/business/businessPricing";
import { formatUsd } from "@/game/business/businessCurrency";
import { formatQuantity } from "@/game/business/businessInventory";
import type { PerishabilityState } from "@/game/business/perishability";
import { eventForDay } from "@/game/business/businessSupplierEvents";
import { isContractActive } from "@/game/business/businessSupplierContract";
import { supplierEventSummary } from "@/game/business/businessAlerts";
import {
  expiringSoon,
  fridgeStatus,
  ingredientConsumption,
  inventorySummary,
  lowStockItems,
  menuReadiness,
  onHandItems,
  purchasingStats,
  type OnHandItem,
} from "@/game/business/inventoryAnalytics";
import { openMarketIngredients } from "../marketFocus";

const PERISHABILITY_BADGE_TONE: Record<PerishabilityState, "cream" | "sage" | "copper" | "locked"> =
  {
    FRESH: "sage",
    AGING: "cream",
    NEAR_EXPIRY: "copper",
    EXPIRED: "locked",
  };

/** How many ranked rows the Most needed / Most used lists show. */
const TOP_ROWS = 5;

function name(id: IngredientId): string {
  return INGREDIENTS[id].name;
}

function qty(id: IngredientId, quantity: number): string {
  return `${formatQuantity(quantity)} ${purchaseUnitFor(id)}`;
}

function daysLeftText(item: OnHandItem): string {
  if (item.daysLeft === 0) return "Expired";
  if (item.daysLeft === 1) return "Spoils tonight";
  return `${item.daysLeft} days left`;
}

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
      <p className="truncate font-display text-[16px] font-black leading-tight text-walnut-dark">
        {value}
      </p>
      {sub ? (
        <p className="truncate font-hand text-[12px] leading-tight text-walnut/60">{sub}</p>
      ) : null}
    </div>
  );
}

/** The one purchase-related control Business has: navigation to the Market. */
function MarketLink({
  go,
  id,
  label,
  className,
}: {
  go: (s: ScreenId) => void;
  id?: IngredientId;
  label: string;
  className?: string;
}) {
  return (
    <KButton
      size="sm"
      variant="ghost"
      className={cn("h-12 shrink-0 px-3 text-[12px]", className)}
      onClick={() => openMarketIngredients(go, id)}
    >
      {label}
    </KButton>
  );
}

/**
 * BUSINESS · INVENTORY — what's in the restaurant fridge and what it means
 * for service: freshness, low stock against today's menu demand, menu
 * readiness, waste, purchasing and consumption. Monitoring only — stock is
 * bought in the Market (Market → Ingredients); the only purchase-related
 * controls here navigate there. Every figure comes from
 * inventoryAnalytics.ts over existing state; nothing is stored or invented.
 */
export function BusinessInventory({ go, save }: { go: (s: ScreenId) => void; save: SaveData }) {
  const fridge = fridgeStatus(save);
  const onHand = onHandItems(save);
  const readiness = menuReadiness(save);
  const low = lowStockItems(save);
  const expiring = expiringSoon(save);
  const summary = inventorySummary(save);
  const purchasing = purchasingStats(save);
  const consumption = ingredientConsumption(save);
  const spoilingTonight = onHand.filter((i) => i.spoilsTonight);
  const day = save.business.calendar.businessDay;
  const event = eventForDay(day);

  return (
    <div className="space-y-3">
      <p className="font-hand text-[15px] leading-snug text-walnut/70">
        Track your stock, freshness and restaurant supply needs.
      </p>

      {/* Fridge status */}
      <Panel className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow>❄️ {fridge.name}</Eyebrow>
          <span className="font-ui text-[12px] font-extrabold text-walnut-dark">
            {formatQuantity(fridge.used)} / {fridge.capacity}
          </span>
        </div>
        <div className="mt-2">
          <Bar fraction={fridge.usage} tone="sage" />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2" data-testid="fridge-status">
          <Stat label="Value" value={formatUsd(fridge.stockValue)} sub="in stock" />
          <Stat label="Space" value={formatQuantity(fridge.available)} sub="left" />
          <Stat label="Ready" value={`${readiness.ready} / ${readiness.total}`} sub="dishes" />
        </div>
        {spoilingTonight.length > 0 ? (
          <p className="mt-2 font-ui text-[12px] font-extrabold text-copper">
            ⚠{" "}
            {spoilingTonight.length === 1
              ? `${name(spoilingTonight[0]!.id)} spoils tonight`
              : `${spoilingTonight.length} ingredients spoil tonight`}
          </p>
        ) : null}
        <KButton
          full
          size="sm"
          variant="ghost"
          className="mt-2 h-12"
          onClick={() => go("business-refrigerator")}
        >
          Upgrade or repair the fridge →
        </KButton>
      </Panel>

      {/* On hand */}
      {onHand.length > 0 ? (
        <Panel className="p-4">
          <Eyebrow>🧺 On hand</Eyebrow>
          <div className="mt-1" data-testid="on-hand">
            {onHand.map((item) => (
              <div
                key={item.id}
                data-ingredient={item.id}
                className="border-b border-walnut/10 py-2 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[20px]" aria-hidden>
                    {INGREDIENT_EMOJI[item.id]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-ui text-[13px] font-extrabold text-walnut-dark">
                      {name(item.id)}
                    </span>
                    <span className="block font-hand text-[13px] text-walnut/60">
                      {qty(item.id, item.quantity)} · {formatUsd(item.value)}
                    </span>
                  </span>
                  <Badge tone={PERISHABILITY_BADGE_TONE[item.state]}>
                    {item.state.replace("_", " ")}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2 pl-7">
                  <span className="w-20 shrink-0">
                    <Bar
                      fraction={item.daysLeft / item.shelfLife}
                      tone={item.daysLeft <= 1 ? "copper" : "sage"}
                    />
                  </span>
                  <span
                    className={cn(
                      "font-ui text-[11px] font-bold",
                      item.daysLeft <= 1 ? "text-copper" : "text-walnut/65",
                    )}
                  >
                    {item.spoilsTonight ? "⚠ " : ""}
                    {daysLeftText(item)}
                  </span>
                </div>
                <p className="truncate pl-7 font-hand text-[12px] leading-tight text-walnut/60">
                  {item.usedIn.length > 0
                    ? `Used in: ${item.usedIn
                        .slice(0, 2)
                        .map((d) => d.name)
                        .join(
                          ", ",
                        )}${item.usedIn.length > 2 ? ` +${item.usedIn.length - 2} more` : ""}`
                    : "Not used by today's menu"}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel className="p-4 text-center">
          <p className="font-hand text-[15px] leading-snug text-walnut/65">
            Your fridge is empty. Buy ingredients from the Market to start serving Business orders.
          </p>
          <MarketLink go={go} label="Go to Market →" className="mt-2 w-full" />
        </Panel>
      )}

      {/* Low stock */}
      {low.length > 0 ? (
        <Panel className="p-4">
          <Eyebrow>⚠️ Low stock</Eyebrow>
          <p className="font-hand text-[13px] leading-snug text-walnut/60">
            Less than today's customers are expected to use.
          </p>
          <div className="mt-1" data-testid="low-stock">
            {low.map((item) => (
              <div
                key={item.id}
                data-ingredient={item.id}
                className="flex items-center gap-2 border-b border-walnut/10 py-2 last:border-b-0"
              >
                <span className="text-[20px]" aria-hidden>
                  {INGREDIENT_EMOJI[item.id]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-ui text-[13px] font-extrabold text-walnut-dark">
                    {name(item.id)} · {qty(item.id, item.usable)}
                  </span>
                  <span className="block font-hand text-[12px] leading-tight text-walnut/60">
                    Estimated {plural(item.dishesLeft, "dish", "dishes")} remaining
                  </span>
                </span>
                <MarketLink go={go} id={item.id} label="Buy in Market →" />
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {/* Menu readiness */}
      <Panel className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow>🍳 Menu readiness</Eyebrow>
          <span
            className="font-ui text-[12px] font-extrabold text-walnut-dark"
            data-testid="menu-ready"
          >
            {readiness.ready} / {readiness.total} dishes ready
          </span>
        </div>
        <div className="mt-2">
          <Bar fraction={readiness.total > 0 ? readiness.ready / readiness.total : 0} />
        </div>
        {readiness.mostNeeded.length > 0 ? (
          <>
            <p className="mt-2 font-ui text-[11px] font-extrabold uppercase tracking-[0.08em] text-walnut/60">
              Most needed ingredients
            </p>
            <div className="mt-1 flex flex-wrap gap-2" data-testid="most-needed">
              {readiness.mostNeeded.slice(0, TOP_ROWS).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  data-ingredient={n.id}
                  onClick={() => openMarketIngredients(go, n.id)}
                  className="press flex h-12 items-center gap-1.5 rounded-full border border-walnut/15 px-3 font-ui text-[12px] font-extrabold text-walnut-dark card-warm"
                  aria-label={`${name(n.id)}: needed by ${plural(n.blocks, "dish", "dishes")}. Buy in Market`}
                >
                  <span aria-hidden>{INGREDIENT_EMOJI[n.id]}</span>
                  {name(n.id)}
                  <span className="text-walnut/55">· {n.blocks}</span>
                </button>
              ))}
            </div>
            <p className="mt-1 font-hand text-[12px] text-walnut/55">
              The number is how many menu dishes are waiting for it. Tap to buy it in the Market.
            </p>
          </>
        ) : readiness.total > 0 ? (
          <p className="mt-2 font-hand text-[13px] text-walnut/65">
            Every dish on your menu can be made from stock.
          </p>
        ) : null}
      </Panel>

      {/* Expiring soon */}
      {expiring.length > 0 ? (
        <Panel className="p-4">
          <Eyebrow>⏳ Expiring soon</Eyebrow>
          <div className="mt-1" data-testid="expiring-soon">
            {expiring.map((item) => (
              <div
                key={item.id}
                data-ingredient={item.id}
                className="flex items-center justify-between gap-2 border-b border-walnut/10 py-1.5 font-ui text-[12px] last:border-b-0"
              >
                <span className="min-w-0 truncate font-extrabold text-walnut-dark">
                  {INGREDIENT_EMOJI[item.id]} {name(item.id)} · {qty(item.id, item.quantity)}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-bold",
                    item.daysLeft <= 1 ? "text-copper" : "text-walnut/65",
                  )}
                >
                  {daysLeftText(item)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1 font-hand text-[12px] text-walnut/55">
            Serve dishes that use these first — spoiled stock is thrown out at End Business Day.
          </p>
        </Panel>
      ) : null}

      {/* Inventory analytics */}
      <Panel className="p-4">
        <Eyebrow>📊 Inventory analytics</Eyebrow>
        <div className="mt-2 grid grid-cols-2 gap-2" data-testid="inventory-analytics">
          <Stat label="Stock value" value={formatUsd(summary.stockValue)} />
          <Stat
            label="Ingredients stocked"
            value={`${summary.stocked} / ${summary.ingredientCount}`}
          />
          <Stat label="Fridge usage" value={`${Math.round(summary.fridgeUsage * 100)}%`} />
          <Stat
            label="Waste (all time)"
            value={formatUsd(summary.wasteValue)}
            sub={
              summary.lastDayWasteValue === null
                ? `${formatQuantity(summary.wasteQuantity)} units spoiled`
                : `Last day ${formatUsd(summary.lastDayWasteValue)}`
            }
          />
        </div>
      </Panel>

      {/* Purchasing */}
      <Panel className="p-4">
        <Eyebrow>💰 Purchasing</Eyebrow>
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

      {/* Most used */}
      <Panel className="p-4">
        <Eyebrow>🔥 Most used</Eyebrow>
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
                    {qty(item.id, item.quantity)} · {plural(item.orders, "order")}
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

      {/* Supplier today */}
      <Panel tone="cream" className="p-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Eyebrow>🚚 {event ? `Today · ${event.name}` : "Suppliers · quiet day"}</Eyebrow>
            <p className="font-hand text-[13px] leading-snug text-walnut/65">
              {event
                ? supplierEventSummary(event, isContractActive(save.business.supplierContract, day))
                : "Regular prices today."}
            </p>
          </div>
          <MarketLink go={go} label="Shop Market →" />
        </div>
      </Panel>
    </div>
  );
}
