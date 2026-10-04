/**
 * MENU_GUESTS — customers who order from the restaurant's ACTIVE MENU inside
 * a campaign service (Unified Restaurant phase D, spec §4: "customer orders
 * must come from dishes actually available on the player's menu").
 *
 * A level's own orders stay exactly as designed (deterministic, they teach).
 * Once they are served, the service can take up to `menuGuestsPerService`
 * extra guests, one at a time and optional (Finish Level stays available):
 *
 *  - each guest orders a dish from the active menu at the level being
 *    played (`activeMenuRecipes`: unlocked AND switched on; a locked or
 *    switched-off dish never appears), picked by the existing OrderGenerator
 *    (no dish twice in a row) from a seeded generator, so the same level
 *    always brings the same guests (deterministic, testable);
 *  - the guest is cooked with the existing cutting engine as an extra ticket
 *    of the same service, pays the dish's menu price through the existing
 *    Business payment rule (`businessCustomerPayment`), uses real stock from
 *    Level 11 like any order, and is recorded as restaurant revenue
 *    ("business-revenue", the day's P&L) — prices are not changed here
 *    (Economy TODO #13, #20);
 *  - guests served are saved per level (`levelProgress.menuGuests`), so
 *    leaving and coming back never re-offers a guest already paid;
 *    completing the level drops the entry. Replays have no guests.
 *
 * Batch-group levels (customers already seated together) take no menu
 * guests in this phase. Pure; nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import type { LevelDefinition } from "../levels/levelTypes";
import type { LevelProgress } from "../levels/LevelManager";
import { isCompleted } from "../levels/LevelManager";
import { levelNumber } from "../levels/levelMastery";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { generateOrder } from "../service/OrderGenerator";
import { makeSeededRand } from "../business/businessDeterministicRandom";
import { businessDishForRecipeId } from "../business/businessServiceCatalog";
import type { BusinessDish } from "../business/businessDishCatalog";
import { businessCustomerPayment } from "../business/BusinessServiceManager";
import { activeMenuRecipes } from "./restaurantMenu";
import { menuGuestsPerService } from "./restaurantProgression";
import { serviceStockCheck } from "./campaignStock";

/** The guests a service of `level` brings, in order (pure; same every time for the same menu). */
export function menuGuestQueue(save: SaveData, level: LevelDefinition): RecipeDefinition[] {
  if (level.batchGroupRecipeIds?.length) return [];
  const n = levelNumber(level.id);
  const count = menuGuestsPerService(n);
  const pool = activeMenuRecipes(save.business.menuActivation, n);
  if (count === 0 || pool.length === 0) return [];
  const rand = makeSeededRand(n * 104729 + 17);
  const guests: RecipeDefinition[] = [];
  for (let i = 0; i < count; i++) {
    const pick = generateOrder(
      {
        unlockedRecipes: pool,
        recentRecipeIds: guests.map((r) => r.id),
        recentCuisineIds: guests.map((r) => r.cuisineId),
      },
      rand,
    );
    if (!pick) break;
    guests.push(pick);
  }
  return guests;
}

export function menuGuestsServed(progress: LevelProgress, levelId: string): number {
  const n = progress.menuGuests?.[levelId];
  return typeof n === "number" && n > 0 ? Math.floor(n) : 0;
}

export function withMenuGuestServed(progress: LevelProgress, levelId: string): LevelProgress {
  return {
    ...progress,
    menuGuests: {
      ...(progress.menuGuests ?? {}),
      [levelId]: menuGuestsServed(progress, levelId) + 1,
    },
  };
}

export function withoutMenuGuests(progress: LevelProgress, levelId: string): LevelProgress {
  if (!progress.menuGuests || !(levelId in progress.menuGuests)) return progress;
  const rest = { ...progress.menuGuests };
  delete rest[levelId];
  return { ...progress, menuGuests: rest };
}

export type MenuGuest = {
  recipe: RecipeDefinition;
  dish: BusinessDish;
  /** 1-based number of this guest in the service, and the service's total. */
  number: number;
  total: number;
  /** What the guest pays (the dish's menu price through the Business payment rule). */
  pays: number;
  /** The stock for this dish is on hand (always true before Level 11). */
  inStock: boolean;
};

/** The next menu guest for a first play of `level`, or null (none left, replay, none at this level). */
export function nextMenuGuest(save: SaveData, level: LevelDefinition): MenuGuest | null {
  if (isCompleted(level.id, save.levelProgress)) return null;
  const queue = menuGuestQueue(save, level);
  const served = menuGuestsServed(save.levelProgress, level.id);
  const recipe = queue[served];
  if (!recipe) return null;
  const dish = businessDishForRecipeId(recipe.id);
  if (!dish) return null;
  const check = serviceStockCheck(save, levelNumber(level.id), [recipe]);
  return {
    recipe,
    dish,
    number: served + 1,
    total: queue.length,
    pays: businessCustomerPayment(save, dish).customerPays,
    inStock: !check.applies || check.ready,
  };
}
