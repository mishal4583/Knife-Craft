/**
 * RESTAURANT_MENU — the restaurant's menu at the player's point in the
 * campaign (Unified Restaurant, spec §2–4). One menu: the existing
 * BUSINESS_DISH_CATALOG dishes and the existing on/off state
 * (`business.menuActivation`, a list of dishes switched OFF, so a newly
 * unlocked dish arrives switched on).
 *
 *  - unlocked: the dishes `restaurantProgression.MENU_UNLOCKS` has added by
 *    the restaurant's level; locked: the rest, with the level they join;
 *  - active (what customers can order): before MENU_CHOICE_LEVEL every
 *    unlocked dish (the menu runs itself); from it, the unlocked dishes the
 *    player has switched on. Never empty: if every unlocked dish is off, all
 *    unlocked dishes count as on (an empty menu would stop the restaurant);
 *  - a locked dish is never active, whatever the saved state says.
 *
 * The restaurant's level is the furthest campaign level it has reached
 * (the highest unlocked level; 250+ once the campaign is complete).
 * Pure; nothing reads RESTAURANT_MODE.
 */
import type { LevelProgress } from "../levels/LevelManager";
import { levelNumber } from "../levels/levelMastery";
import type { BusinessMenuActivationState } from "../business/businessMenuActivation";
import { isDishActive } from "../business/businessMenuActivation";
import {
  BUSINESS_DISH_CATALOG,
  getBusinessDish,
  type BusinessDish,
} from "../business/businessDishCatalog";
import { getCampaignRecipe } from "../recipes/campaignRecipes";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import {
  MENU_CHOICE_LEVEL,
  cuisineFor,
  dishUnlockLevel,
  menuDishIdsAt,
} from "./restaurantProgression";

/** The furthest campaign level the restaurant has reached. */
export function restaurantLevelOf(progress: LevelProgress): number {
  return levelNumber(progress.highestUnlockedLevelId);
}

/** The unlocked dishes at `level`, in unlock order. */
export function unlockedMenuDishes(level: number): BusinessDish[] {
  return menuDishIdsAt(level)
    .map((id) => getBusinessDish(id))
    .filter((d): d is BusinessDish => !!d);
}

export type LockedDish = { dish: BusinessDish; unlockLevel: number; cuisine: string };

/** The dishes still locked at `level`, soonest first. */
export function lockedMenuDishes(level: number): LockedDish[] {
  const unlocked = new Set(menuDishIdsAt(level));
  return BUSINESS_DISH_CATALOG.filter((d) => !unlocked.has(d.id))
    .map((dish) => ({
      dish,
      unlockLevel: dishUnlockLevel(dish.id) ?? Infinity,
      cuisine: cuisineFor(dish.cuisineId).name,
    }))
    .sort((a, b) => a.unlockLevel - b.unlockLevel);
}

/** True once the player chooses which unlocked dishes are on. */
export function playerChoosesMenu(level: number): boolean {
  return level >= MENU_CHOICE_LEVEL;
}

/** What customers can order at `level` (never empty while any dish is unlocked). */
export function activeMenuDishes(
  activation: BusinessMenuActivationState,
  level: number,
): BusinessDish[] {
  const unlocked = unlockedMenuDishes(level);
  if (!playerChoosesMenu(level)) return unlocked;
  const on = unlocked.filter((d) => isDishActive(activation, d.id));
  return on.length > 0 ? on : unlocked;
}

/** True when a customer may order `dishId` at `level` (unlocked AND active). */
export function canOrderDish(
  activation: BusinessMenuActivationState,
  level: number,
  dishId: string,
): boolean {
  return activeMenuDishes(activation, level).some((d) => d.id === dishId);
}

/** The recipes behind the active menu: the pool menu orders are drawn from (phase D). */
export function activeMenuRecipes(
  activation: BusinessMenuActivationState,
  level: number,
): RecipeDefinition[] {
  return activeMenuDishes(activation, level)
    .map((d) => getCampaignRecipe(d.sourceRecipeId))
    .filter((r): r is RecipeDefinition => !!r);
}
