import { useState } from "react";
import { Badge, KButton, Panel } from "../common/primitives";
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
  type SupplySection,
} from "@/game/business/businessSupplies";
import {
  isLowSupply,
  supplySectionSummary,
  supplyUnits,
} from "@/game/business/BusinessSuppliesManager";
import { businessCustomersToday } from "@/game/business/BusinessServiceManager";
import { openMarketSupplies } from "../marketFocus";

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[16px] border border-walnut/12 bg-ivory/70 px-3 py-2">
      <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.12em] text-walnut/60">
        {label}
      </p>
      <p className="font-display text-[18px] font-black leading-tight text-walnut-dark">{value}</p>
      <p className="font-hand text-[12px] leading-tight text-walnut/55">{note}</p>
    </div>
  );
}

/**
 * BUSINESS · SUPPLIES — monitoring only (no purchase controls, like
 * Business → Inventory): what's on the shelf, what it cost, what was spent
 * and how much that saved against retail. Every figure is read from
 * `save.business.supplies` (BusinessSuppliesManager.supplySectionSummary);
 * restocking navigates to the Market.
 */
export function BusinessSupplies({ go, save }: { go: (s: ScreenId) => void; save: SaveData }) {
  const [section, setSection] = useState<SupplySection>("culinary");
  const [group, setGroup] = useState("All");
  const supplies = save.business.supplies;
  const meta = SUPPLY_SECTIONS[section];
  const summary = supplySectionSummary(supplies, section);
  const customers = businessCustomersToday(save).target;
  const sectionItems = SUPPLY_CATALOG.filter((item) => item.section === section);
  const items = sectionItems.filter((item) => group === "All" || item.group === group);
  const low = sectionItems.filter((item) => isLowSupply(supplies, item, customers));
  const consumable = section === "packaging";

  return (
    <div className="space-y-3" data-testid="business-supplies">
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

      <Panel className="p-3">
        <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
          {meta.kicker}
        </p>
        <p className="font-display text-[17px] font-black leading-tight text-walnut-dark">
          {meta.title}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2" data-testid="supplies-analytics">
          <Stat
            label="On hand"
            value={summary.unitsOnHand.toLocaleString("en-US")}
            note={`units · ${summary.linesStocked} of ${summary.lines} lines stocked`}
          />
          <Stat
            label="Stock value"
            value={formatUsd(summary.stockValue)}
            note="what you paid for it"
          />
          <Stat
            label="Spent"
            value={formatUsd(summary.spent)}
            note={`${summary.purchases} Market order${summary.purchases === 1 ? "" : "s"}, all time`}
          />
          <Stat
            label="Saved vs retail"
            value={formatUsd(summary.savedVsRetail)}
            note="wholesale discount, not cash"
          />
          {consumable ? (
            <Stat
              label="Used by orders"
              value={summary.unitsUsed.toLocaleString("en-US")}
              note={`units · ${formatUsd(summary.usedCost)} of cost, all time`}
            />
          ) : null}
        </div>
        <p className="mt-2 font-hand text-[13px] leading-snug text-walnut/60">
          {consumable
            ? "Every served Business order uses one container and one bag. Their cost counts as the order's cost when used."
            : "Equipment lasts. It's bought once and counts as an investment in your restaurant, not a daily cost."}
        </p>
      </Panel>

      {consumable ? (
        <Panel tone="cream" className="flex items-center gap-3 p-3">
          <span className="text-[20px]" aria-hidden>
            {low.length ? "⚠️" : "✓"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-ui text-[13px] font-extrabold text-walnut-dark">
              {low.length
                ? `${low.length} line${low.length === 1 ? "" : "s"} below today's ${customers} customers`
                : "Enough packaging for today's customers"}
            </p>
            {low.length ? (
              <p className="font-hand text-[13px] leading-tight text-walnut/60">
                {low
                  .slice(0, 3)
                  .map((item) => `${item.name} · ${supplyUnits(supplies, item.id)} left`)
                  .join(" / ")}
              </p>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <div
        className="-mx-4 flex gap-2 overflow-x-auto no-scrollbar px-4"
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

      <div className="space-y-2">
        {items.map((item) => {
          const units = supplyUnits(supplies, item.id);
          const isLow = isLowSupply(supplies, item, customers);
          // The bar shows stock against two packs (a full shelf).
          const pct = Math.min(100, Math.round((units / (item.packSize * 2)) * 100));
          return (
            <article
              key={item.id}
              data-supply-row={item.id}
              className="flex items-center gap-3 rounded-[18px] border border-walnut/12 bg-ivory/70 px-3 py-2"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center text-[24px]" aria-hidden>
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
                    className={cn("h-full rounded-full", isLow ? "bg-copper" : "bg-sage")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-[16px] font-black leading-none text-walnut-dark">
                  {units.toLocaleString("en-US")}
                </p>
                <Badge tone={isLow ? "copper" : units > 0 ? "sage" : "cream"}>
                  {isLow
                    ? "Restock"
                    : units > 0
                      ? isConsumableSupply(item)
                        ? "In stock"
                        : "Owned"
                      : "None"}
                </Badge>
              </div>
            </article>
          );
        })}
      </div>

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
