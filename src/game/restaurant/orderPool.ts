/**
 * ORDER POOL (Phase 2, developer 2026-10-30, docs/planning/PHASE2-PLAN-2026-10-30.md §4): what a menu
 * guest may order — unlocked, switched on AND in stock — and how the pick is weighted.
 *
 *  - The service's guest list is still forecast at the start (menuGuests.ts `menuGuestQueue`), so the
 *    Pre-Service Check and the Market plan know what to buy. A dish new on the menu in the last
 *    `NEW_DISH_SERVICES` services is favoured there (`NEW_DISH_WEIGHT`, decision Q6).
 *  - When the guest arrives, the forecast dish is ordered if it can be made beside the reserve (the
 *    next level's own orders, the walk-in rule). Otherwise the guest picks another dish that can,
 *    weighted: new dishes ×1.5, and by how many portions are in stock (more stock sells first; the
 *    last portion is ordered less). The menu price never weighs.
 *  - Nothing can be made: no dish (the caller shows the guest as out of stock, as before).
 *  - Where stock is not used (`serviceUsesStock`; today it is used from Level 1) every active menu
 *    dish counts as in stock.
 *
 * Pure and seeded: the same save and guest give the same pick. No wallet, no ledger.
 */
import type { SaveData } from "../SaveManager";
import type { LevelDefinition } from "../levels/levelTypes";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { levelNumber } from "../levels/levelMastery";
import { generateOrder } from "../service/OrderGenerator";
import { makeSeededRand } from "../business/businessDeterministicRandom";
import { businessDishForRecipeId } from "../business/businessServiceCatalog";
import { activeMenuRecipes } from "./restaurantMenu";
import { dishesUnlockedAt } from "./restaurantProgression";
import { serviceStockCheck, serviceUsesStock } from "./campaignStock";

/** A dish counts as new for this many services after it joins the menu. */
export const NEW_DISH_SERVICES = 5;
/** How much more often a new dish is ordered. */
export const NEW_DISH_WEIGHT = 1.5;
/** Portions counted for the stock weight (more than this weighs the same). */
export const STOCK_PORTIONS_COUNTED = 3;

/** Dish ids (business dish ids) new on the menu at service `n`. */
export function newDishIds(n: number): Set<string> {
  const ids = new Set<string>();
  for (let l = Math.max(1, n - NEW_DISH_SERVICES + 1); l <= n; l++)
    for (const id of dishesUnlockedAt(l)) ids.add(id);
  return ids;
}

/** ×1.5 for a dish new on the menu (decision Q6), else 1. */
export function newDishWeight(recipe: RecipeDefinition, n: number): number {
  const dish = businessDishForRecipeId(recipe.id);
  return dish && newDishIds(n).has(dish.id) ? NEW_DISH_WEIGHT : 1;
}

/** Whole portions of `recipe` that fit beside `reserve` (0..STOCK_PORTIONS_COUNTED); stock not used yet: the max. */
export function portionsInStock(
  save: SaveData,
  n: number,
  recipe: RecipeDefinition,
  reserve: readonly RecipeDefinition[],
): number {
  if (!serviceUsesStock(n)) return STOCK_PORTIONS_COUNTED;
  const fits = (k: number) => {
    const check = serviceStockCheck(save, n, [
      ...Array<RecipeDefinition>(k).fill(recipe),
      ...reserve,
    ]);
    return !check.applies || check.ready;
  };
  let k = 0;
  while (k < STOCK_PORTIONS_COUNTED && fits(k + 1)) k++;
  return k;
}

export type PoolEntry = { recipe: RecipeDefinition; portions: number; weight: number };

/** The active menu's dishes that can be made now beside `reserve`, with their weight. */
export function orderPool(
  save: SaveData,
  level: LevelDefinition,
  reserve: readonly RecipeDefinition[],
): PoolEntry[] {
  const n = levelNumber(level.id);
  return activeMenuRecipes(save.business.menuActivation, n)
    .map((recipe) => ({ recipe, portions: portionsInStock(save, n, recipe, reserve) }))
    .filter((e) => e.portions > 0)
    .map((e) => ({
      ...e,
      // ×0.5 for the last portion … ×1.5 for 3 or more.
      weight: newDishWeight(e.recipe, n) * (e.portions / 2),
    }));
}

/**
 * What an arriving guest orders: the forecast dish when it can be made beside `reserve`, else a
 * weighted pick from the pool (seeded by the service and the guest's place in it), else null.
 * A substitute only takes spare stock: `poolReserve` (default `reserve`) also keeps what the guests
 * still to come in this service were planned to order, so one guest never eats another's dish.
 */
export function pickGuestDish(
  save: SaveData,
  level: LevelDefinition,
  forecast: RecipeDefinition,
  reserve: readonly RecipeDefinition[],
  guestIndex: number,
  recent: readonly RecipeDefinition[] = [],
  poolReserve: readonly RecipeDefinition[] = reserve,
): RecipeDefinition | null {
  const n = levelNumber(level.id);
  if (portionsInStock(save, n, forecast, reserve) > 0) return forecast;
  const pool = orderPool(save, level, poolReserve);
  if (pool.length === 0) return null;
  const weights = new Map(pool.map((e) => [e.recipe.id, e.weight]));
  return generateOrder(
    {
      unlockedRecipes: pool.map((e) => e.recipe),
      recentRecipeIds: recent.map((r) => r.id),
      recentCuisineIds: recent.map((r) => r.cuisineId),
      weightOf: (r) => weights.get(r.id) ?? 0,
    },
    makeSeededRand(n * 6151 + guestIndex * 97 + 3),
  );
}
