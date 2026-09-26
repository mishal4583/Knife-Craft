import { useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import { Panel, Badge } from "../common/primitives";
import { Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/business/businessCurrency";
import { getCampaignRecipe } from "@/game/recipes/campaignRecipes";
import { BUSINESS_DISH_CATALOG, businessDishMargin } from "@/game/business/businessDishCatalog";
import type { SetMenuPriceResult } from "@/game/business/BusinessMenuManager";
import {
  isDishActive,
  activeBusinessDishes,
  type SetDishActiveResult,
} from "@/game/business/businessMenuActivation";
import { businessDishRequirements } from "@/game/business/businessServiceCatalog";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
import { formatQuantity, normalizeQuantity } from "@/game/business/businessInventory";
import { purchaseUnitFor } from "@/game/business/businessPricing";
import {
  businessCustomerPayment,
  businessOrderAvailability,
} from "@/game/business/BusinessServiceManager";
import { defaultMenuPrice } from "@/game/business/businessMenu";
import { getRefrigeratorCapacity } from "@/game/business/RefrigeratorManager";

/** A quarter-dollar step — sensible for real USD menu pricing. */
const PRICE_STEP = 25;

/**
 * BUSINESS · MENU tab (Economy V3 Phases 5/14). The dish list is
 * `BUSINESS_DISH_CATALOG`; price, food cost and margin come only from
 * `businessDishMargin` (businessMenu.ts's `marginFor`), the suggested price
 * from `defaultMenuPrice`, and what a customer actually pays from
 * `businessCustomerPayment` (menu price × popularity modifier) — the same
 * functions serving uses. Price changes persist immediately; they move no
 * money.
 */
export function BusinessMenu({
  save,
  setMenuPrice,
  setBusinessDishActive,
}: {
  save: SaveData;
  setMenuPrice: (recipeId: string, price: number) => SetMenuPriceResult;
  setBusinessDishActive: (dishId: string, active: boolean) => SetDishActiveResult;
}) {
  const [messages, setMessages] = useState<Partial<Record<string, string>>>({});
  const [category, setCategory] = useState<string>("All");
  const activation = save.business.menuActivation;
  const activeDishes = activeBusinessDishes(activation);
  const fridgeCapacity = getRefrigeratorCapacity(save.business.refrigerator.refrigeratorId);
  const activeIngredientIds = [
    ...new Set(activeDishes.flatMap((d) => businessDishRequirements(d).map((r) => r.ingredientId))),
  ];
  const categories = ["All", ...new Set(BUSINESS_DISH_CATALOG.map((d) => d.category))];
  const shown = BUSINESS_DISH_CATALOG.filter((d) => category === "All" || d.category === category);

  function toggleDish(dishId: string, active: boolean) {
    const result = setBusinessDishActive(dishId, active);
    setMessages((m) => ({
      ...m,
      [dishId]: result.ok
        ? undefined
        : result.reason === "lastActiveDish"
          ? "Keep at least one dish on the menu."
          : "That dish couldn't be changed.",
    }));
  }

  function adjustPrice(dishId: string, recipeId: string, currentPrice: number, delta: number) {
    const result = setMenuPrice(recipeId, Math.max(0, currentPrice + delta));
    if (!result.ok) setMessages((m) => ({ ...m, [dishId]: "That price couldn't be set." }));
  }

  return (
    <div className="space-y-3">
      <Panel tone="cream" className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow>🍽️ On the menu</Eyebrow>
          <span className="font-ui text-[12px] font-extrabold text-walnut-dark">
            {activeDishes.length} / {BUSINESS_DISH_CATALOG.length} dishes
          </span>
        </div>
        <p className="mt-1 font-hand text-[14px] leading-snug text-walnut/70">
          Customers only order dishes that are on. They pay your price × today's popularity
          modifier. Your menu needs {activeIngredientIds.length} ingredient
          {activeIngredientIds.length === 1 ? "" : "s"} in stock; the fridge holds {fridgeCapacity}{" "}
          units — a smaller menu means less stock to keep fresh.
        </p>
      </Panel>

      <div
        className="-mx-4 flex gap-2 overflow-x-auto no-scrollbar px-4"
        aria-label="Dish categories"
      >
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={cn(
              "press h-12 min-w-12 shrink-0 rounded-full border px-3.5 font-ui text-[12px] font-extrabold",
              category === c
                ? "wood border-walnut-dark/50 text-ivory"
                : "card-warm border-walnut/15 text-walnut-dark",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {shown.map((dish) => {
          const { price, cost, margin, foodCostPercent, grossMarginPercent } = businessDishMargin(
            save.business.menu,
            dish,
          );
          const payment = businessCustomerPayment(save, dish);
          const recipeId = dish.sourceRecipeId;
          const recipe = getCampaignRecipe(recipeId);
          const suggested = recipe ? defaultMenuPrice(recipe) : price;
          const message = messages[dish.id];
          const onMenu = isDishActive(activation, dish.id);
          const needTotals = new Map<IngredientId, number>();
          for (const r of businessDishRequirements(dish)) {
            needTotals.set(
              r.ingredientId,
              normalizeQuantity((needTotals.get(r.ingredientId) ?? 0) + r.quantity),
            );
          }
          const canMake = businessOrderAvailability(save, dish).available;
          return (
            <article
              key={dish.id}
              className={cn(
                "product-card rounded-[20px] border p-3 card-warm",
                onMenu ? "border-olive/40" : "border-walnut/15",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn("text-[34px] leading-none", !onMenu && "opacity-50 grayscale")}
                  aria-hidden
                >
                  {recipe?.emoji ?? "🍽️"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-black leading-tight text-walnut-dark">
                    {dish.name}
                  </p>
                  <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.14em] text-copper">
                    {dish.category}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 font-ui text-[11px] font-bold leading-snug",
                      canMake ? "text-olive" : "text-walnut/55",
                    )}
                  >
                    {canMake ? "✓ In stock · " : "Needs "}
                    {[...needTotals]
                      .map(
                        ([id, q]) =>
                          `${formatQuantity(q)} ${purchaseUnitFor(id)} ${INGREDIENTS[id]?.name ?? id}`,
                      )
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleDish(dish.id, !onMenu)}
                  aria-pressed={onMenu}
                  aria-label={`${onMenu ? "Take" : "Put"} ${dish.name} ${onMenu ? "off" : "on"} the menu`}
                  className={cn(
                    "press h-12 w-[64px] shrink-0 rounded-full border font-ui text-[12px] font-extrabold",
                    onMenu
                      ? "border-olive/60 bg-[linear-gradient(170deg,var(--color-sage),var(--color-olive))] text-ivory"
                      : "border-walnut/25 bg-ivory/70 text-walnut/60",
                  )}
                >
                  {onMenu ? "ON" : "OFF"}
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => adjustPrice(dish.id, recipeId, price, -PRICE_STEP)}
                  className="press grid h-12 w-12 place-items-center rounded-full border border-walnut/20 bg-ivory font-ui text-[18px] font-black text-walnut-dark"
                  aria-label={`Decrease price for ${dish.name}`}
                >
                  −
                </button>
                <div className="text-center">
                  <p className="font-display text-[22px] font-black leading-none text-walnut-dark">
                    {formatUsd(price)}
                  </p>
                  <p className="font-ui text-[10px] font-bold text-walnut/55">
                    {price === suggested ? "suggested price" : `suggested ${formatUsd(suggested)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => adjustPrice(dish.id, recipeId, price, PRICE_STEP)}
                  className="press grid h-12 w-12 place-items-center rounded-full border border-walnut/20 bg-ivory font-ui text-[18px] font-black text-walnut-dark"
                  aria-label={`Increase price for ${dish.name}`}
                >
                  +
                </button>
              </div>

              {message ? (
                <p className="mt-1 text-center font-hand text-[13px] text-copper">{message}</p>
              ) : null}

              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-[12px] bg-cream/70 px-1 py-1.5">
                  <p className="font-ui text-[10px] font-bold text-walnut/55">Customer pays</p>
                  <p className="font-ui text-[12px] font-extrabold text-walnut-dark">
                    {formatUsd(payment.customerPays)}
                  </p>
                </div>
                <div className="rounded-[12px] bg-cream/70 px-1 py-1.5">
                  <p className="font-ui text-[10px] font-bold text-walnut/55">Food cost</p>
                  <p className="font-ui text-[12px] font-extrabold text-walnut-dark">
                    {formatUsd(cost)}
                  </p>
                </div>
                <div className="rounded-[12px] bg-cream/70 px-1 py-1.5">
                  <p className="font-ui text-[10px] font-bold text-walnut/55">Kept per plate</p>
                  <p
                    className={cn(
                      "font-ui text-[12px] font-extrabold",
                      margin >= 0 ? "text-olive" : "text-copper",
                    )}
                  >
                    {margin >= 0 ? "+" : ""}
                    {formatUsd(margin)}
                  </p>
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <p className="font-ui text-[10px] font-bold text-walnut/50">
                  × {payment.multiplier.toFixed(2)} at popularity {payment.popularity}/100 ·{" "}
                  {grossMarginPercent}% kept
                </p>
                <Badge tone={margin >= 0 ? "sage" : "copper"}>{foodCostPercent}% food cost</Badge>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
