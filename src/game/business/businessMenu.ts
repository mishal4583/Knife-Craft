/**
 * BUSINESS_MENU — Economy V3 Phase 5. Business Mode menu prices, layered
 * on top of the EXISTING recipe system (`CAMPAIGN_RECIPES`/
 * `RecipeDefinition`) — no second recipe registry, no menu-specific
 * dish list. Every "menu item" IS an existing recipe id; this file only
 * adds a player-controlled PRICE on top of it.
 *
 * Campaign's own pay (`recipePay.ts`, chapter-scaled `basePayment`) is
 * completely untouched — Business Mode pricing is deliberately its own,
 * separate number, the same way `businessPricing.ts`'s ingredient
 * purchase costs never read from/write to Campaign's
 * `ingredientCostRegistry.ts`.
 *
 * `BusinessMenu` is sparse (`Partial<Record<recipeId, number>>`) — a
 * recipe the player has never touched simply has no entry and falls back
 * to `defaultMenuPrice`, exactly like `BusinessInventory` never stores a
 * zero-value placeholder for an unstocked ingredient.
 */
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { businessUnitCostFor } from "./businessPricing";
import { recipePortionFractionFor } from "./businessPortionModel";
import { recipeRequirements } from "../restaurant/recipeRequirements";

/** Keyed by `RecipeDefinition.id`. Only recipes the player has explicitly priced are present. */
export type BusinessMenu = Partial<Record<string, number>>;

export const DEFAULT_BUSINESS_MENU: BusinessMenu = {};

/**
 * Economy V3 Phase 14 — real-world recalibration. A target FOOD COST
 * PERCENTAGE (cost / price), not an arbitrary markup — 30% sits inside
 * the documented 2026 full-service-restaurant benchmark band of 28%-32%
 * (docs/ECONOMY_V3_MASTER_SPEC.md §24, sourced from National Restaurant
 * Association / industry aggregation). The old `DEFAULT_MARKUP_MULTIPLIER
 * = 2.5` (a 40% food-cost ratio, never sourced from anything) is replaced
 * by deriving the multiplier FROM the target percentage — `1 /
 * TARGET_FOOD_COST_PERCENT` — so the one real, cited number is the
 * percentage itself, not a derived multiplier nobody could trace back to
 * a benchmark.
 */
const TARGET_FOOD_COST_PERCENT = 0.3;

/**
 * The MENU PRICE BASIS (Economy V3 Phase 14, Checkpoint 4): sum of
 * businessUnitCostFor(component) * recipePortionFractionFor(component) across
 * EVERY component, rounded to the cent per component. It is what Business
 * menu prices were calibrated on (real U.S. menu prices, $12–22 a plate at
 * a 30% target), and it stays the basis of `defaultMenuPrice` so every
 * dish keeps the price it has always had.
 *
 * Since the realistic portions (developer 2026-10-08) it is NOT the food a
 * plate uses: that is `recipeCostBasis` below (a Caprese uses a 0.3 lb
 * tomato and 4 oz of mozzarella, not a pound of each). Re-deriving prices
 * from those smaller plates would sell a Caprese for about $4, so prices
 * keep this basis and the restaurant's real food cost is simply lower.
 */
export function menuPriceBasis(recipe: RecipeDefinition): number {
  return recipe.components.reduce(
    (sum, c) =>
      sum +
      Math.round(businessUnitCostFor(c.ingredientId) * recipePortionFractionFor(c.ingredientId)),
    0,
  );
}

/**
 * The real food cost of one plate, in whole US cents: every item the recipe
 * prepares (restaurant/recipeRequirements.ts — one serving per physical
 * item) at the Market's base unit price, rounded to the cent per item. This
 * is exactly what serving the dish takes out of stock at those prices, so
 * the Menu's food cost and margin are what the P&L will really see.
 */
export function recipeCostBasis(recipe: RecipeDefinition): number {
  return recipeRequirements(recipe).reduce(
    (sum, r) => sum + Math.round(businessUnitCostFor(r.ingredientId) * r.quantity),
    0,
  );
}

/** A deterministic, data-driven suggested price (whole US cents) — never player-facing as "the" price, just the fallback until the player sets their own. Always >= 1 (brief: "Non-negative", and a free menu item is never a useful default). Derived from the real, cited TARGET_FOOD_COST_PERCENT on the menu price basis, not an unsourced multiplier. */
export function defaultMenuPrice(recipe: RecipeDefinition): number {
  return Math.max(1, Math.round(menuPriceBasis(recipe) / TARGET_FOOD_COST_PERCENT));
}

/** The one place "what does this recipe currently sell for" is resolved — every UI reads this, never `menu[id]` directly, so a missing entry can't silently render as `undefined`/`NaN`. */
export function menuPriceFor(menu: BusinessMenu, recipe: RecipeDefinition): number {
  return menu[recipe.id] ?? defaultMenuPrice(recipe);
}

export type MenuMargin = {
  price: number;
  cost: number;
  /** price - cost. Can be negative — the brief never requires a price to be profitable, only non-negative and integer-safe; a player is free to price at a loss (e.g. a loss-leader), and the UI surfaces that rather than silently forbidding it. */
  margin: number;
  /**
   * Economy V3 Phase 14 — cost / price, as a percentage. Replaces the
   * old, mislabeled `marginPercent` (which was actually MARKUP —
   * margin / cost — computed correctly but named and displayed as if it
   * were margin; the phase brief is explicit: "Do not label markup as
   * margin"). 0 when price is 0 (never NaN/Infinity).
   */
  foodCostPercent: number;
  /** Economy V3 Phase 14 — the ACTUAL gross margin percentage: margin / price (equivalently 100 - foodCostPercent). This is what "margin" correctly means; the UI shows this, never foodCostPercent's own complement computed a different way. */
  grossMarginPercent: number;
};

export function marginFor(menu: BusinessMenu, recipe: RecipeDefinition): MenuMargin {
  const price = menuPriceFor(menu, recipe);
  const cost = recipeCostBasis(recipe);
  const margin = price - cost;
  const foodCostPercent = price > 0 ? Math.round((cost / price) * 1000) / 10 : 0;
  const grossMarginPercent = price > 0 ? Math.round((margin / price) * 1000) / 10 : 0;
  return { price, cost, margin, foodCostPercent, grossMarginPercent };
}
