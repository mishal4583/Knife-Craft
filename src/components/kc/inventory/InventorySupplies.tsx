import { useState } from "react";
import { Badge, KButton, Panel } from "../common/primitives";
import { Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import type { ScreenId } from "../data";
import { formatUsd } from "@/game/money";
import {
  SUPPLY_CATALOG,
  SUPPLY_SECTIONS,
  SUPPLY_SECTION_ORDER,
  isConsumableSupply,
  supplyPackPrice,
  unitLabel,
  type SupplyItem,
  type SupplySection,
} from "@/game/business/businessSupplies";
import {
  ORDER_BAG_PRIORITY,
  ORDER_CONTAINER_PRIORITY,
  isLowSupply,
  packagingOrdersCovered,
  supplySectionSummary,
  supplyUnits,
} from "@/game/business/BusinessSuppliesManager";
import { businessCustomersToday } from "@/game/business/BusinessServiceManager";
import { openMarketSupplies } from "../marketFocus";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import {
  bottleView,
  cleanSettings,
  restaurantSuppliesOf,
  settingsOwned,
} from "@/game/restaurant/serviceSupplies";
import { SupplyBottle } from "../restaurant/SupplyBottle";

type SupplyStatus = "low" | "in-stock" | "owned" | "none";

const STATUS: Record<
  SupplyStatus,
  { label: string; marker: string; tone: "copper" | "sage" | "cream" }
> = {
  low: { label: "Low", marker: "🟡", tone: "copper" },
  "in-stock": { label: "In stock", marker: "🟢", tone: "sage" },
  owned: { label: "Owned", marker: "🟢", tone: "sage" },
  none: { label: "None", marker: "⚪", tone: "cream" },
};

function statusOf(save: SaveData, item: SupplyItem, customers: number): SupplyStatus {
  const supplies = save.business.supplies;
  if (isLowSupply(supplies, item, customers)) return "low";
  if (supplyUnits(supplies, item.id) <= 0) return "none";
  return isConsumableSupply(item) ? "in-stock" : "owned";
}

function Card({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="min-h-[84px] rounded-[20px] border border-walnut/15 p-3 card-warm">
      <p className="font-ui text-[11px] font-extrabold text-walnut/65">
        <span aria-hidden>{icon}</span> {label}
      </p>
      <p className="mt-0.5 font-display text-[19px] font-black leading-tight text-walnut-dark tabular-nums">
        {value}
      </p>
      <p className="font-hand text-[13px] leading-tight text-walnut/60">{sub}</p>
    </div>
  );
}

/**
 * INVENTORY · SUPPLIES — every non-food thing the restaurant owns:
 * smallwares, tableware & cutlery, takeaway parcels. Monitoring only (like
 * the Ingredients view): stock on hand, what it cost, what's low against
 * today's customers and how many takeaway orders the packaging still
 * covers. Every figure is read from `save.business.supplies` through
 * BusinessSuppliesManager; restocking opens the Market's supply section.
 * Spending history (spent, saved vs retail, used by orders) lives in
 * Business → Operations.
 */
export function InventorySupplies({ go, save }: { go: (s: ScreenId) => void; save: SaveData }) {
  const [section, setSection] = useState<SupplySection>("culinary");
  const [group, setGroup] = useState("All");
  const [allLow, setAllLow] = useState(false);
  const supplies = save.business.supplies;
  const customers = businessCustomersToday(save).target;
  const meta = SUPPLY_SECTIONS[section];
  const summaries = SUPPLY_SECTION_ORDER.map((s) => supplySectionSummary(supplies, s));
  const unitsOnHand = summaries.reduce((n, s) => n + s.unitsOnHand, 0);
  const stockValue = summaries.reduce((n, s) => n + s.stockValue, 0);
  const linesStocked = summaries.reduce((n, s) => n + s.linesStocked, 0);
  // Running low = a packaging line you stock that won't last today's customers (isLowSupply).
  // A line you've never bought isn't "low"; the coverage alert below covers having none.
  const lowAll = SUPPLY_CATALOG.filter(
    (item) => supplyUnits(supplies, item.id) > 0 && isLowSupply(supplies, item, customers),
  );
  const { containers, bags, orders: ordersCovered } = packagingOrdersCovered(supplies);
  const sectionItems = SUPPLY_CATALOG.filter((item) => item.section === section);
  const items = sectionItems.filter((item) => group === "All" || item.group === group);
  const consumable = section === "packaging";

  return (
    <div className="space-y-3" data-testid="inventory-supplies">
      <div className="grid grid-cols-2 gap-3" data-testid="supplies-summary">
        <Card
          icon="🧰"
          label="Supplies on hand"
          value={`${unitsOnHand.toLocaleString("en-US")} units`}
          sub={`${linesStocked} of ${SUPPLY_CATALOG.length} lines stocked`}
        />
        <Card
          icon="💲"
          label="Stock value"
          value={formatUsd(stockValue)}
          sub="what you paid for it"
        />
        <Card
          icon="⚠️"
          label="Running low"
          value={`${lowAll.length} line${lowAll.length === 1 ? "" : "s"}`}
          sub={`packaging below today's ${customers} customers`}
        />
        <Card
          icon="🥡"
          label="Takeaway orders covered"
          value={`${ordersCovered.toLocaleString("en-US")}`}
          sub={`${containers} containers · ${bags} bags`}
        />
      </div>

      {RESTAURANT_MODE ? (
        // Unified Restaurant (phase G): what a service uses up — read-only.
        <div data-testid="supplies-restaurant">
          <Panel className="p-4">
            <Eyebrow>🍽️ For service</Eyebrow>
            <p className="mt-1 font-ui text-[14px] font-bold text-walnut-dark">
              Place settings: {cleanSettings(save)} clean
              {restaurantSuppliesOf(save).washing > 0
                ? ` · ${Math.min(restaurantSuppliesOf(save).washing, settingsOwned(save))} waiting to be washed`
                : ""}
            </p>
            <p className="font-ui text-[12px] text-walnut/60">
              A plate, a fork and a knife per dine-in guest; washed after each service.
            </p>
            <div className="mt-1 divide-y divide-walnut/10">
              <SupplyBottle
                bottle={bottleView(save, "dish-soap")}
                per="service"
                onRestock={() => openMarketSupplies(go, "packaging", "dish-soap")}
              />
              <SupplyBottle
                bottle={bottleView(save, "cleaning-liquid")}
                per="closing"
                onRestock={() => openMarketSupplies(go, "packaging", "cleaning-liquid")}
              />
            </div>
          </Panel>
        </div>
      ) : null}

      <Panel className="p-4">
        <div data-testid="supplies-attention">
          <Eyebrow>⚠️ Needs Attention</Eyebrow>
          {ordersCovered < customers ? (
            <div
              data-supply-attention="packaging-coverage"
              className="mt-1 flex items-center gap-2 border-b border-walnut/10 py-2"
            >
              <span className="text-[22px]" aria-hidden>
                🥡
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-ui text-[13px] font-extrabold text-walnut-dark">
                  🟠 Packaging covers {ordersCovered} of today's {customers} orders
                </span>
                <span className="block font-hand text-[13px] leading-tight text-walnut/70">
                  Each served order uses one container and one bag · {containers} containers ·{" "}
                  {bags} bags on hand
                </span>
              </span>
              <KButton
                size="sm"
                variant="copper"
                className="h-12 shrink-0 px-3 text-[12px]"
                onClick={() =>
                  // Jump to whichever runs out first: the top container line or the top bag line.
                  openMarketSupplies(
                    go,
                    "packaging",
                    containers <= bags ? ORDER_CONTAINER_PRIORITY[0] : ORDER_BAG_PRIORITY[0],
                  )
                }
              >
                Restock →
              </KButton>
            </div>
          ) : null}
          {(allLow ? lowAll : lowAll.slice(0, 3)).map((item) => (
            <div
              key={item.id}
              data-supply-attention={item.id}
              className="flex items-center gap-2 border-b border-walnut/10 py-2 last:border-b-0"
            >
              <span className="text-[22px]" aria-hidden>
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-ui text-[13px] font-extrabold text-walnut-dark">
                  {item.name}
                </span>
                <span className="block font-hand text-[13px] leading-tight text-walnut/70">
                  🟡 Low · {supplyUnits(supplies, item.id)} left for today's {customers} customers
                </span>
              </span>
              <KButton
                size="sm"
                variant="copper"
                className="h-12 shrink-0 px-3 text-[12px]"
                onClick={() => openMarketSupplies(go, item.section, item.id)}
              >
                Restock →
              </KButton>
            </div>
          ))}
          {lowAll.length > 3 ? (
            <button
              type="button"
              onClick={() => setAllLow((v) => !v)}
              className="press mt-1 h-12 w-full rounded-[12px] font-ui text-[12px] font-extrabold text-copper"
            >
              {allLow ? "Show fewer" : `View all ${lowAll.length} →`}
            </button>
          ) : null}
          {ordersCovered >= customers && lowAll.length === 0 ? (
            <p className="mt-1 font-hand text-[15px] leading-snug text-olive">
              ✓ Enough packaging for today's customers.
            </p>
          ) : null}
        </div>
      </Panel>

      <div className="grid grid-cols-3 gap-2" aria-label="Supply sections">
        {SUPPLY_SECTION_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={section === s}
            onClick={() => {
              setSection(s);
              setGroup("All");
            }}
            className={cn(
              "press flex h-[60px] flex-col items-center justify-center rounded-[18px] border px-1",
              section === s
                ? "wood border-walnut-dark/50 text-ivory shadow-soft"
                : "card-warm border-walnut/15 text-walnut-dark",
            )}
          >
            <span className="text-[18px] leading-none" aria-hidden>
              {SUPPLY_SECTIONS[s].emoji}
            </span>
            <span className="font-ui text-[11px] font-extrabold leading-tight">
              {SUPPLY_SECTIONS[s].short}
            </span>
            <span className="font-ui text-[9px] font-bold leading-tight opacity-75">
              {SUPPLY_SECTIONS[s].kicker}
            </span>
          </button>
        ))}
      </div>

      <Panel className="p-4">
        <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
          {meta.kicker}
        </p>
        <p className="font-display text-[17px] font-black leading-tight text-walnut-dark">
          {meta.title}
        </p>
        <p className="mt-1 font-hand text-[13px] leading-snug text-walnut/60">
          {consumable
            ? "Every served Business order uses one container and one bag."
            : "Equipment lasts: it's bought once and never used up."}
        </p>

        <div
          className="-mx-4 mt-2 flex gap-2 overflow-x-auto no-scrollbar px-4"
          aria-label="Filter supplies"
        >
          {["All", ...meta.groups].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              aria-pressed={group === g}
              className={cn(
                "press h-12 min-w-12 shrink-0 rounded-full border px-3.5 font-ui text-[12px] font-extrabold",
                group === g
                  ? "wood border-walnut-dark/50 text-ivory"
                  : "card-warm border-walnut/15 text-walnut-dark",
              )}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="mt-2 space-y-2">
          {items.map((item) => {
            const units = supplyUnits(supplies, item.id);
            const status = statusOf(save, item, customers);
            // The bar shows stock against two packs (a full shelf).
            const pct = Math.min(100, Math.round((units / (item.packSize * 2)) * 100));
            return (
              <article
                key={item.id}
                data-supply-row={item.id}
                data-status={status}
                className="flex items-center gap-3 rounded-[18px] border border-walnut/12 bg-ivory/70 px-3 py-2"
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center text-[24px]"
                  aria-hidden
                >
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-ui text-[13px] font-extrabold text-walnut-dark">
                    {item.name}
                  </p>
                  <p className="font-ui text-[11px] font-bold text-walnut/60">
                    {item.group} · {formatUsd(supplyPackPrice(item))} /{" "}
                    {item.packSize === 1 ? unitLabel(item, 1) : `pack of ${item.packSize}`}
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-walnut/10">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        status === "low" ? "bg-copper" : "bg-sage",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-[16px] font-black leading-none text-walnut-dark tabular-nums">
                    {units.toLocaleString("en-US")}
                  </p>
                  <Badge tone={STATUS[status].tone}>
                    {STATUS[status].marker} {STATUS[status].label}
                  </Badge>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>

      <KButton
        full
        variant="copper"
        className="h-12"
        onClick={() => openMarketSupplies(go, section)}
      >
        Restock {meta.short} in the Market →
      </KButton>
    </div>
  );
}
