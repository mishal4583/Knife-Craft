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
  RESTAURANT_SUPPLY_SECTION_ORDER,
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
import { ItemPic, ItemTile, type TileTone } from "./ItemTile";

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

/** An icon stat tile: big picture, big number, a short label; the sentence in its title. */
function Card({
  icon,
  label,
  value,
  title,
}: {
  icon: string;
  label: string;
  value: string;
  title: string;
}) {
  return (
    <div
      className="flex min-h-[64px] min-w-0 items-center gap-2 rounded-[18px] border border-walnut/15 px-2.5 py-2 card-warm"
      title={title}
    >
      <span className="shrink-0 text-[26px] leading-none" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-[18px] font-black leading-tight text-walnut-dark tabular-nums">
          {value}
        </span>
        <span className="block truncate font-ui text-[12px] font-extrabold leading-tight text-walnut/65">
          {label}
        </span>
        <span className="sr-only">{title}</span>
      </span>
    </div>
  );
}

/** A supply's name without its size ("Dinner plates · 10½ in" → "Dinner plates"). */
const shortName = (item: SupplyItem) => item.name.split(" · ")[0]!;

const STATUS_TONE: Record<SupplyStatus, TileTone> = {
  low: "low",
  "in-stock": "ok",
  owned: "ok",
  none: "none",
};

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
  // The restaurant build has a 4th section: Cleaning (the Cleanliness screen's supplies).
  const sections = RESTAURANT_MODE ? RESTAURANT_SUPPLY_SECTION_ORDER : SUPPLY_SECTION_ORDER;
  const summaries = sections.map((s) => supplySectionSummary(supplies, s));
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
  const consumable = section === "packaging" || section === "cleaning";
  const servingState = restaurantSuppliesOf(save);
  const dirtyPieces = Object.values(servingState.dirty).reduce((t, n) => t + (n ?? 0), 0);
  const brokenSoFar = servingState.brokenTotal;

  return (
    <div className="space-y-3" data-testid="inventory-supplies">
      <div className="grid grid-cols-2 gap-2" data-testid="supplies-summary">
        <Card
          icon="🧰"
          label="units on hand"
          value={unitsOnHand.toLocaleString("en-US")}
          title={`Supplies on hand: ${linesStocked} of ${SUPPLY_CATALOG.length} lines stocked`}
        />
        <Card
          icon="💰"
          label="stock value"
          value={formatUsd(stockValue)}
          title="Stock value: what you paid for it"
        />
        <Card
          icon="⚠️"
          label="running low"
          value={String(lowAll.length)}
          title={`Running low: ${lowAll.length} packaging line${lowAll.length === 1 ? "" : "s"} below today's ${customers} customers`}
        />
        <Card
          icon="🥡"
          label="orders covered"
          value={ordersCovered.toLocaleString("en-US")}
          title={`Takeaway orders covered: ${containers} containers · ${bags} bags`}
        />
      </div>

      {RESTAURANT_MODE ? (
        // Unified Restaurant (phase G): what a service uses up — read-only.
        <div data-testid="supplies-restaurant">
          <Panel className="p-4">
            <Eyebrow>🍽️ For service</Eyebrow>
            <p className="mt-1 font-ui text-[14.5px] font-bold text-walnut-dark">
              Place settings: {cleanSettings(save)} clean
              {dirtyPieces > 0 ? ` · 🫧 ${dirtyPieces} to wash` : ""}
            </p>
            <p
              className="font-ui text-[12.5px] font-bold text-walnut/60"
              title="Per guest: plate or bowl, cutlery and a glass, washed after each service"
            >
              👤 🍽️ 🍴 🥛 per guest · 🫧 each service
              {brokenSoFar > 0 ? ` · 💥 ${brokenSoFar} broken` : ""}
            </p>
            <div className="mt-1 divide-y divide-walnut/10">
              <SupplyBottle
                bottle={bottleView(save, "dish-soap")}
                per="wash"
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
          {/* Pictures of what's short (developer 2026-10-23); tap a tile to restock. */}
          {ordersCovered < customers || lowAll.length > 0 ? (
            <ul className="mt-2 grid grid-cols-3 gap-2">
              {ordersCovered < customers ? (
                <li className="min-w-0" data-supply-attention="packaging-coverage">
                  <ItemTile
                    icon="🥡"
                    name="Packaging"
                    amount={`${ordersCovered} / ${customers}`}
                    tone="low"
                    badge="🟠"
                    action="Restock ›"
                    label={`Packaging covers ${ordersCovered} of today's ${customers} orders: 1 container + 1 bag per order, ${containers} containers, ${bags} bags. Restock`}
                    onClick={() =>
                      // Jump to whichever runs out first: the top container line or the top bag line.
                      openMarketSupplies(
                        go,
                        "packaging",
                        containers <= bags ? ORDER_CONTAINER_PRIORITY[0] : ORDER_BAG_PRIORITY[0],
                      )
                    }
                  />
                </li>
              ) : null}
              {(allLow ? lowAll : lowAll.slice(0, 3)).map((item) => (
                <li key={item.id} className="min-w-0" data-supply-attention={item.id}>
                  <ItemTile
                    icon={item.icon}
                    name={shortName(item)}
                    amount={`${supplyUnits(supplies, item.id)} left`}
                    tone="low"
                    badge="🟡"
                    action="Restock ›"
                    label={`${item.name}: low, ${supplyUnits(supplies, item.id)} left for today's ${customers} customers. Restock`}
                    onClick={() => openMarketSupplies(go, item.section, item.id)}
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {lowAll.length > 3 ? (
            <button
              type="button"
              onClick={() => setAllLow((v) => !v)}
              className="press mt-1 h-12 w-full rounded-[12px] font-ui text-[12.5px] font-extrabold text-copper"
            >
              {allLow ? "Show fewer" : `View all ${lowAll.length} →`}
            </button>
          ) : null}
          {ordersCovered >= customers && lowAll.length === 0 ? (
            <p className="mt-1 font-hand text-[16px] leading-snug text-olive">
              ✓ Enough packaging for today's customers.
            </p>
          ) : null}
        </div>
      </Panel>

      <div
        className={cn("grid gap-2", sections.length === 4 ? "grid-cols-4" : "grid-cols-3")}
        aria-label="Supply sections"
      >
        {sections.map((s) => (
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
            <span className="font-ui text-[12px] font-extrabold leading-tight">
              {SUPPLY_SECTIONS[s].short}
            </span>
            <span className="font-ui text-[10px] font-bold leading-tight opacity-75">
              {SUPPLY_SECTIONS[s].kicker}
            </span>
          </button>
        ))}
      </div>

      <Panel className="p-4">
        <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.2em] text-copper">
          {meta.kicker}
        </p>
        <p className="font-display text-[17.5px] font-black leading-tight text-walnut-dark">
          {meta.title}
        </p>
        <p className="mt-1 font-hand text-[14px] leading-snug text-walnut/60">
          {consumable
            ? RESTAURANT_MODE
              ? "📦 Used each service · 📋 the Pre-Service Check says what's short"
              : "🥡 1 container + 1 bag per order"
            : RESTAURANT_MODE && section === "culinary"
              ? "🔁 Bought once · 📋 asked for when a dish needs it"
              : "🔁 Bought once · never used up"}
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
                "press h-12 min-w-12 shrink-0 rounded-full border px-3.5 font-ui text-[12.5px] font-extrabold",
                group === g
                  ? "wood border-walnut-dark/50 text-ivory"
                  : "card-warm border-walnut/15 text-walnut-dark",
              )}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {items.map((item) => {
            const units = supplyUnits(supplies, item.id);
            const status = statusOf(save, item, customers);
            // The bar shows stock against two packs (a full shelf).
            const pct = Math.min(100, Math.round((units / (item.packSize * 2)) * 100));
            const price = `${formatUsd(supplyPackPrice(item))} / ${item.packSize === 1 ? unitLabel(item, 1) : `pack of ${item.packSize}`}`;
            return (
              <article
                key={item.id}
                data-supply-row={item.id}
                data-status={status}
                title={`${item.name} · ${item.group} · ${price}`}
                className="flex min-w-0 flex-col items-center gap-1 rounded-[16px] border border-walnut/12 bg-ivory/80 px-1.5 pb-2 pt-2 text-center"
              >
                <ItemPic
                  icon={item.icon}
                  tone={STATUS_TONE[status]}
                  badge={status === "low" ? "🟡" : undefined}
                  size={48}
                />
                <p className="line-clamp-2 w-full font-ui text-[12px] font-extrabold leading-tight text-walnut-dark">
                  {shortName(item)}
                </p>
                <span className="sr-only">
                  {item.name}, {item.group}, {price}
                </span>
                <p className="font-display text-[16px] font-black leading-none text-walnut-dark tabular-nums">
                  {units.toLocaleString("en-US")}
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-walnut/10">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      status === "low" ? "bg-copper" : "bg-sage",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <Badge tone={STATUS[status].tone}>
                  {STATUS[status].marker} {STATUS[status].label}
                </Badge>
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
