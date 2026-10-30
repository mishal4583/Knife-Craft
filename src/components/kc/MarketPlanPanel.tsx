import { PointerHand } from "./common/PointerHand";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { useEffect, useMemo, useRef, useState } from "react";
import { KButton, Panel } from "./common/primitives";
import { cn } from "@/lib/utils";
import { InfoTip, StatChip } from "./common/InfoTip";
import type { SaveData } from "@/game/SaveManager";
import { INGREDIENTS } from "@/game/definitions";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { formatUsd } from "@/game/money";
import { formatQuantity } from "@/game/business/businessInventory";
import {
  formatStockAmount,
  itemCountText,
  marketUnitLabel,
  measureOf,
} from "@/game/business/measure";
import { MARKET_PLAN_DAYS, marketPlanFor, type MarketPlanRow } from "@/game/restaurant/marketPlan";
import type { PurchaseIngredientResult } from "@/game/business/BusinessInventoryManager";

/** Rows shown before "Show all". */
const FIRST_ROWS = 6;

const DAY_LABEL = ["Today", "Tomorrow", "Day after"];

/**
 * MARKET · PLAN AHEAD (restaurant build; developer 2026-10-08): what the
 * next 1–3 restaurant days need that the fridge doesn't have, today's menu
 * first and only as much as the fridge holds (restaurant/marketPlan.ts).
 * Each row buys its line with the ordinary Market purchase; "Buy all" buys
 * every line the same way.
 */
export function MarketPlanPanel({
  save,
  purchaseIngredient,
  purchaseIngredients,
  setNotice,
  focused = false,
}: {
  save: SaveData;
  purchaseIngredient: (ingredientId: string, quantity: number) => PurchaseIngredientResult;
  purchaseIngredients?: (lines: ReadonlyArray<{ ingredientId: string; quantity: number }>) => {
    bought: number;
    skipped: number;
    totalCost: number;
  };
  setNotice: (text: string) => void;
  /** Opened from the Pre-Service Check: start on Today and scroll here. */
  focused?: boolean;
}) {
  // The very first shopping (developer 2026-10-30): before any level is done the plan starts on
  // Today, and a hand shows what to buy for Level 1 with the player's own money.
  const firstRun = RESTAURANT_MODE && save.levelProgress.completedLevelIds.length === 0;
  const [days, setDays] = useState<number>(focused || firstRun ? 1 : 2);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "start" });
  }, [focused]);
  const [showAll, setShowAll] = useState(false);
  const measure = measureOf(save);
  const plan = useMemo(() => marketPlanFor(save, days), [save, days]);
  const rows = showAll ? plan.rows : plan.rows.slice(0, FIRST_ROWS);
  const affordable = save.credits >= plan.totalCost;

  function buy(row: MarketPlanRow) {
    const r = purchaseIngredient(row.ingredientId, row.buyUnits);
    const name = INGREDIENTS[row.ingredientId].name;
    setNotice(
      r.ok
        ? `✓ ${row.buyUnits} ${marketUnitLabel(row.ingredientId, measure, row.buyUnits)} ${name} · ${formatUsd(r.totalCost)}`
        : `✗ ${name} · ${r.reason === "insufficientFunds" ? "💸 not enough money" : r.reason === "insufficientStorage" ? "❄️ no fridge space" : "🚚 not available today"}`,
    );
  }

  function buyAll() {
    if (!purchaseIngredients) return;
    const r = purchaseIngredients(
      plan.rows.map((row) => ({ ingredientId: row.ingredientId, quantity: row.buyUnits })),
    );
    setNotice(
      r.bought > 0
        ? `✓ Stocked ${r.bought} · ${days === 1 ? "today" : `${days} days`} · ${formatUsd(r.totalCost)}${r.skipped > 0 ? ` · ${r.skipped} skipped` : ""}`
        : "✗ Nothing bought · check 💸 money and ❄️ space",
    );
  }

  return (
    <div data-testid="market-plan" ref={ref}>
      <Panel tone="cream" className="p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.12em] text-copper">
            🗓️ Plan ahead
          </p>
          <InfoTip label="About Plan ahead">
            What your next services need that the fridge doesn't have — today's menu first, only as
            much as fits.
          </InfoTip>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <StatChip icon="🍽️">Today first</StatChip>
          <StatChip icon="❄️" tone="sage">
            {formatQuantity(plan.storageFree)} free
          </StatChip>
        </div>
        {focused ? (
          <p
            className="mt-1 font-ui text-[12.5px] font-extrabold text-copper"
            data-testid="market-plan-hint"
          >
            👉 Tap Buy all, then ↩ Back to the Pre-Service Check.
          </p>
        ) : null}
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Plan ahead for">
          {MARKET_PLAN_DAYS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={days === d}
              onClick={() => {
                setDays(d);
                setShowAll(false);
              }}
              className={cn(
                "press h-12 rounded-2xl border font-ui text-[12.5px] font-extrabold",
                days === d
                  ? "wood border-walnut-dark/50 text-ivory"
                  : "card-warm border-walnut/15 text-walnut-dark",
              )}
            >
              {d === 1 ? "Today" : `${d} days`}
            </button>
          ))}
        </div>

        {plan.rows.length === 0 ? (
          <p
            className="mt-2 font-ui text-[12.5px] font-bold text-olive"
            data-testid="market-plan-empty"
          >
            {plan.noRoom.length > 0
              ? "❄️ Fridge full · use what you have first"
              : `✓ You're stocked for ${days === 1 ? "today" : `the next ${days} days`}.`}
          </p>
        ) : (
          <>
            {firstRun ? (
              <p
                data-testid="first-shopping-hint"
                className="mt-2 flex items-center gap-2 rounded-xl bg-gold/20 px-3 py-2 font-hand text-[16px] leading-snug text-walnut-dark"
              >
                <span>👋 Tap Buy on these, then go back to the Kitchen.</span>
                <InfoTip label="About your first order">
                  Your first order needs these ingredients, bought with your own money. Your chef
                  knife and walnut board are already yours — better ones are in the Market later.
                </InfoTip>
              </p>
            ) : null}
            <ul className="mt-2 divide-y divide-walnut/10">
              {rows.map((row) => {
                const count = itemCountText(row.ingredientId, row.stock);
                return (
                  <li
                    key={row.ingredientId}
                    className="flex min-h-12 items-center gap-2 py-1.5"
                    data-plan-ingredient={row.ingredientId}
                    data-plan-day={row.firstDay}
                  >
                    <span className="text-[20px]" aria-hidden>
                      {INGREDIENT_EMOJI[row.ingredientId]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-ui text-[13.5px] font-extrabold leading-tight text-walnut-dark">
                        {INGREDIENTS[row.ingredientId].name}
                        <span
                          className={cn(
                            "ml-1.5 inline-block whitespace-nowrap rounded-full px-1.5 py-[1px] align-middle font-ui text-[11px] font-extrabold uppercase tracking-wide",
                            row.forToday
                              ? "bg-copper/20 text-copper"
                              : "bg-walnut/10 text-walnut/60",
                          )}
                        >
                          {row.forToday
                            ? "Today"
                            : (DAY_LABEL[row.firstDay] ?? `Day ${row.firstDay + 1}`)}
                        </span>
                      </p>
                      <p className="font-ui text-[12px] font-bold text-walnut/60">
                        Need {formatStockAmount(row.ingredientId, row.stock, measure)}
                        {count ? ` (${count})` : ""}
                      </p>
                    </div>
                    <div className="relative shrink-0">
                      <KButton
                        size="sm"
                        variant="ghost"
                        className="h-auto min-h-12 shrink-0 px-3 py-1 leading-tight"
                        onClick={() => buy(row)}
                      >
                        <span className="block">
                          Buy {row.buyUnits}{" "}
                          {marketUnitLabel(row.ingredientId, measure, row.buyUnits)}
                        </span>
                        <span className="block text-copper">{formatUsd(row.cost)}</span>
                      </KButton>
                      {firstRun && row === rows[0] ? (
                        <span
                          data-testid="first-shopping-hand"
                          className="pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2"
                        >
                          <PointerHand size={38} />
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            {plan.rows.length > FIRST_ROWS ? (
              <KButton
                size="sm"
                variant="ghost"
                full
                className="mt-1 min-h-12"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Show fewer" : `Show all ${plan.rows.length}`}
              </KButton>
            ) : null}
            {purchaseIngredients ? (
              <KButton
                full
                variant={affordable ? "copper" : "ghost"}
                className="mt-2 min-h-12"
                onClick={buyAll}
              >
                Buy all · {formatUsd(plan.totalCost)}
              </KButton>
            ) : null}
            {!affordable ? (
              <p className="mt-1 text-center font-ui text-[12px] font-bold text-copper">
                You have {formatUsd(save.credits)} — buy today's first.
              </p>
            ) : null}
          </>
        )}
        {plan.noRoomToday.length > 0 ? (
          <p
            className="mt-1 font-ui text-[12px] font-bold text-copper"
            data-testid="market-plan-no-room-today"
          >
            ⚠️ No fridge room: {plan.noRoomToday.map((id) => INGREDIENTS[id].name).join(", ")}{" "}
            <InfoTip label="How to make room">
              Use or throw out stock in Inventory, or upgrade the fridge.
            </InfoTip>
          </p>
        ) : null}
        {plan.noRoom.length > plan.noRoomToday.length && plan.rows.length > 0 ? (
          <p className="mt-1 font-ui text-[12px] font-bold text-walnut/60">
            ⏳ Later, no room:{" "}
            {/* Emoji, the names on hover (developer 2026-10-23: no long lists). */}
            {plan.noRoom
              .filter((id) => !plan.noRoomToday.includes(id))
              .map((id) => (
                <span key={id} title={INGREDIENTS[id].name} aria-label={INGREDIENTS[id].name}>
                  {INGREDIENT_EMOJI[id] ?? "🥬"}{" "}
                </span>
              ))}
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
