import { useState } from "react";
import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import { Panel, ScreenHeader, Divider, Badge } from "../common/primitives";
import { BusinessCash } from "./BusinessCash";
import { formatUsd } from "@/game/business/businessCurrency";
import { BottomNav } from "../Kitchen";
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
import { getRefrigeratorCapacity } from "@/game/business/RefrigeratorManager";

/** A quarter-dollar step — sensible for real USD menu pricing (Economy V3 Phase 14; the old 5-cent step was calibrated for the old prototype "coins" scale). */
const PRICE_STEP = 25;

/**
 * BUSINESS_MENU — Economy V3 Phase 5, recalibrated Phase 14. Business
 * Mode only; reuses `CAMPAIGN_RECIPES`/`RecipeDefinition` directly (no
 * second recipe list) and `businessMenu.ts`'s own `menuPriceFor`/
 * `marginFor` as the ONLY source of price/cost/margin numbers shown here
 * — never recomputed inline. Every price change persists immediately (no
 * separate "confirm" step, unlike a purchase — setting a price moves no
 * credits, so there's nothing to commit atomically against).
 *
 * Economy V3 Phase 14 — shows Menu Price / Food Cost / Food Cost % /
 * Gross Margin explicitly, per the phase brief's own accounting
 * requirement ("Do not label markup as margin"). Food Cost % (cost /
 * price) and Gross Margin (price - cost, and margin / price as a
 * percentage) are two DIFFERENT numbers, both shown — never one computed
 * and mislabeled as the other.
 *
 * Economy V3 Phase 14, Checkpoint 2 — the customer-facing list is now
 * `BUSINESS_DISH_CATALOG` (businessDishCatalog.ts's own curated, real-
 * dish-named catalog), never the raw 221-entry `CAMPAIGN_RECIPES` list —
 * a customer orders "Caprese Salad," never "Sliced Tomato Plate." Price
 * is still set/read keyed by the dish's own underlying `sourceRecipeId`
 * (via the existing `setMenuPrice`/`businessDishMargin`, which itself
 * delegates to businessMenu.ts's own `marginFor`) — the SAME single
 * pricing mechanism as before, never a second one.
 */
export function BusinessMenu({
  go,
  save,
  setMenuPrice,
  setBusinessDishActive,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  setMenuPrice: (recipeId: string, price: number) => SetMenuPriceResult;
  setBusinessDishActive: (dishId: string, active: boolean) => SetDishActiveResult;
}) {
  const [messages, setMessages] = useState<Partial<Record<string, string>>>({});
  const activation = save.business.menuActivation;
  const activeDishes = activeBusinessDishes(activation);
  const fridgeCapacity = getRefrigeratorCapacity(save.business.refrigerator.refrigeratorId);
  const activeIngredientIds = [
    ...new Set(activeDishes.flatMap((d) => businessDishRequirements(d).map((r) => r.ingredientId))),
  ];

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

  function adjustPrice(recipeId: string, currentPrice: number, delta: number) {
    const next = Math.max(0, currentPrice + delta);
    const result = setMenuPrice(recipeId, next);
    if (!result.ok) {
      setMessages((m) => ({ ...m, [recipeId]: "That price couldn't be set." }));
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(125,146,112,0.24),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Menu"
          subtitle="set what the restaurant charges"
          onBack={() => go("business")}
          right={<BusinessCash cents={save.credits} />}
        />

        <div className="px-4 pt-2">
          <p className="mb-2 font-hand text-[14px] leading-snug text-walnut/60">
            Choose what the restaurant sells and what it charges. Customers only order dishes that
            are on the menu. Food cost is what a plate's ingredients cost at standard supplier
            prices; gross margin is what's left over at your menu price. Customers actually pay your
            menu price × a popularity modifier — that payment is the revenue recorded.
          </p>
          <Panel tone="dark" className="mb-3 p-3">
            <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold">
              On the menu: {activeDishes.length} of {BUSINESS_DISH_CATALOG.length} dishes
            </p>
            <p className="mt-1 font-hand text-[13px] leading-snug text-ivory/70">
              Needs {activeIngredientIds.length} ingredient
              {activeIngredientIds.length === 1 ? "" : "s"} in stock:{" "}
              {activeIngredientIds.map((id) => INGREDIENTS[id]?.name ?? id).join(", ")}.
            </p>
            <p className="mt-1 font-hand text-[12px] leading-snug text-ivory/60">
              Your refrigerator holds {fridgeCapacity} units
              {activeIngredientIds.length > 0
                ? ` — about ${(Math.round((fridgeCapacity / activeIngredientIds.length) * 10) / 10).toString()} per ingredient on this menu`
                : ""}
              . Every order must be made from stock on hand, so a wide menu means small, frequent
              purchases; a smaller menu means less stock to keep fresh.
            </p>
          </Panel>
          <div className="flex flex-col gap-2">
            {BUSINESS_DISH_CATALOG.map((dish) => {
              const { price, cost, margin, foodCostPercent, grossMarginPercent } =
                businessDishMargin(save.business.menu, dish);
              const payment = businessCustomerPayment(save, dish);
              const recipeId = dish.sourceRecipeId;
              const emoji = getCampaignRecipe(recipeId)?.emoji ?? "🍽️";
              const message = messages[dish.id];
              const onMenu = isDishActive(activation, dish.id);
              const needTotals = new Map<IngredientId, number>();
              for (const r of businessDishRequirements(dish)) {
                needTotals.set(
                  r.ingredientId,
                  normalizeQuantity((needTotals.get(r.ingredientId) ?? 0) + r.quantity),
                );
              }
              const needs = [...needTotals];
              const canMake = businessOrderAvailability(save, dish).available;
              return (
                <Panel key={dish.id} tone="cream" className={`p-3 ${onMenu ? "" : "opacity-60"}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge tone={onMenu ? "sage" : "locked"}>
                      {onMenu ? "On menu" : "Off menu"}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => toggleDish(dish.id, !onMenu)}
                      className="press rounded-full border border-walnut/20 bg-ivory px-3 py-1 font-ui text-[11px] font-bold text-walnut-dark"
                      aria-label={`${onMenu ? "Take" : "Put"} ${dish.name} ${onMenu ? "off" : "on"} the menu`}
                    >
                      {onMenu ? "Take off menu" : "Put on menu"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-[14px] font-black leading-tight text-walnut-dark">
                        {emoji} {dish.name}
                      </p>
                      <p className="font-hand text-[12px] leading-tight text-walnut/50">
                        {dish.description}
                      </p>
                      <p className="font-hand text-[13px] leading-tight text-walnut/60">
                        Food Cost {formatUsd(cost)}
                      </p>
                      <p
                        className={`mt-0.5 font-ui text-[11px] font-bold leading-snug ${canMake ? "text-olive" : "text-walnut/55"}`}
                      >
                        {canMake ? "✓ " : ""}Needs{" "}
                        {needs
                          .map(
                            ([id, q]) =>
                              `${formatQuantity(q)} ${purchaseUnitFor(id)} ${INGREDIENTS[id]?.name ?? id}`,
                          )
                          .join(" · ")}
                        {canMake ? " — in stock now" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => adjustPrice(recipeId, price, -PRICE_STEP)}
                        className="press grid h-8 w-8 place-items-center rounded-full border border-walnut/20 bg-ivory font-ui font-black text-walnut-dark"
                        aria-label={`Decrease price for ${dish.name}`}
                      >
                        −
                      </button>
                      <span className="w-16 text-center font-ui text-[13px] font-bold text-walnut-dark">
                        {formatUsd(price)}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustPrice(recipeId, price, PRICE_STEP)}
                        className="press grid h-8 w-8 place-items-center rounded-full border border-walnut/20 bg-ivory font-ui font-black text-walnut-dark"
                        aria-label={`Increase price for ${dish.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <Divider />
                  {message ? (
                    <p className="mb-1.5 text-center font-hand text-[13px] text-copper">
                      {message}
                    </p>
                  ) : null}
                  <p className="mb-1 font-ui text-[11px] font-bold text-walnut/60">
                    Customers pay {formatUsd(payment.customerPays)} today (menu price ×
                    {payment.multiplier.toFixed(2)} at popularity {payment.popularity}/100)
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="font-ui text-[11px] font-bold text-walnut/60">
                      Gross Margin at menu price {margin >= 0 ? "+" : ""}
                      {formatUsd(margin)} ({grossMarginPercent}%)
                    </p>
                    <Badge tone={margin >= 0 ? "sage" : "copper"}>
                      {foodCostPercent}% food cost
                    </Badge>
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
      </div>
      <BottomNav active="business" go={go} />
    </div>
  );
}
