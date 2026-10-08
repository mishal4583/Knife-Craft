import { useEffect, useRef, useState } from "react";
import { KButton, Panel } from "./common/primitives";
import { cn } from "@/lib/utils";
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
  const [days, setDays] = useState<number>(focused ? 1 : 2);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "start" });
  }, [focused]);
  const [showAll, setShowAll] = useState(false);
  const measure = measureOf(save);
  const plan = marketPlanFor(save, days);
  const rows = showAll ? plan.rows : plan.rows.slice(0, FIRST_ROWS);
  const affordable = save.credits >= plan.totalCost;

  function buy(row: MarketPlanRow) {
    const r = purchaseIngredient(row.ingredientId, row.buyUnits);
    const name = INGREDIENTS[row.ingredientId].name;
    setNotice(
      r.ok
        ? `Bought ${row.buyUnits} ${marketUnitLabel(row.ingredientId, measure, row.buyUnits)} ${name} · ${formatUsd(r.totalCost)}.`
        : `Couldn't buy ${name} — ${r.reason === "insufficientFunds" ? "not enough money" : r.reason === "insufficientStorage" ? "no fridge space" : "not available today"}.`,
    );
  }

  function buyAll() {
    if (!purchaseIngredients) return;
    const r = purchaseIngredients(
      plan.rows.map((row) => ({ ingredientId: row.ingredientId, quantity: row.buyUnits })),
    );
    setNotice(
      r.bought > 0
        ? `Stocked ${r.bought} ingredient${r.bought === 1 ? "" : "s"} for the next ${days === 1 ? "day" : `${days} days`} · ${formatUsd(r.totalCost)}${r.skipped > 0 ? ` (${r.skipped} couldn't be bought)` : ""}.`
        : "Nothing could be bought — check your money and fridge space.",
    );
  }

  return (
    <div data-testid="market-plan" ref={ref}>
      <Panel tone="cream" className="p-3">
        <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.12em] text-copper">
          🗓️ Plan ahead
        </p>
        <p className="font-hand text-[14px] leading-snug text-walnut/70">
          What your next services need that the fridge doesn't have — today's menu first, only as
          much as fits ({formatQuantity(plan.storageFree)} units free).
        </p>
        {focused ? (
          <p
            className="mt-1 font-ui text-[12px] font-extrabold text-copper"
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
                "press h-12 rounded-2xl border font-ui text-[12px] font-extrabold",
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
            className="mt-2 font-ui text-[12px] font-bold text-olive"
            data-testid="market-plan-empty"
          >
            {plan.noRoom.length > 0
              ? "Your fridge is full — use what you have first."
              : `✓ You're stocked for ${days === 1 ? "today" : `the next ${days} days`}.`}
          </p>
        ) : (
          <>
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
                      <p className="font-ui text-[13px] font-extrabold leading-tight text-walnut-dark">
                        {INGREDIENTS[row.ingredientId].name}
                        <span
                          className={cn(
                            "ml-1.5 rounded-full px-1.5 py-[1px] font-ui text-[10px] font-extrabold uppercase tracking-wide",
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
                      <p className="font-ui text-[11px] font-bold text-walnut/60">
                        Need {formatStockAmount(row.ingredientId, row.stock, measure)}
                        {count ? ` (${count})` : ""}
                      </p>
                    </div>
                    <KButton
                      size="sm"
                      variant="ghost"
                      className="min-h-12 px-3"
                      onClick={() => buy(row)}
                    >
                      Buy {row.buyUnits} {marketUnitLabel(row.ingredientId, measure, row.buyUnits)}{" "}
                      · {formatUsd(row.cost)}
                    </KButton>
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
              <p className="mt-1 text-center font-ui text-[11px] font-bold text-copper">
                You have {formatUsd(save.credits)} — buy today's first.
              </p>
            ) : null}
          </>
        )}
        {plan.noRoom.length > 0 && plan.rows.length > 0 ? (
          <p className="mt-1 font-ui text-[11px] font-bold text-walnut/60">
            No fridge room yet for: {plan.noRoom.map((id) => INGREDIENTS[id].name).join(", ")} — buy
            them after today's service.
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
