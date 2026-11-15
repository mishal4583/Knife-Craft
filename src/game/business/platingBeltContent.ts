import type { SaveData } from "../SaveManager";
import { getCampaignRecipe } from "../recipes/campaignRecipes";
import { endlessEventsActive, todaysSpecialDish } from "../restaurant/restaurantEvents";
import { BUSINESS_DISH_CATALOG, type BusinessDish } from "./businessDishCatalog";
import { INGREDIENT_BELT_COLOR } from "./ingredientBeltColor";
import type { BeltIngredient } from "./platingBelt";

export type PlatingBeltDish = {
  dish: BusinessDish;
  ingredients: BeltIngredient[];
};

/**
 * The dish of the day (plan section 3): the Endless Restaurant's Today's Special
 * when it has one, otherwise a stable pick from the 48 catalogue dishes by
 * business day. It never depends on the player's menu, so activating a dish
 * cannot change the plate in the middle of a round. It names the plate only;
 * it never changes money or the menu.
 */
export function platingBeltDishOfTheDay(save: SaveData, day: number): BusinessDish {
  const special = endlessEventsActive(save) ? todaysSpecialDish(save, day) : null;
  // Fibonacci hashing: the HIGH bits of day x golden ratio spread consecutive days across the whole list.
  const index = Math.floor(
    ((Math.imul(day, 2654435761) >>> 0) / 4294967296) * BUSINESS_DISH_CATALOG.length,
  );
  return special ?? BUSINESS_DISH_CATALOG[index]!;
}

/** The dish's real ingredients, each with the game hue its picture was matched to. */
export function platingBeltIngredientsOf(dish: BusinessDish): BeltIngredient[] {
  const recipe = getCampaignRecipe(dish.sourceRecipeId);
  if (!recipe) throw new Error(`Plating Belt dish ${dish.id} has no source recipe`);
  const ids = [...new Set(recipe.components.map((component) => component.ingredientId))];
  return ids.map((id) => {
    const color = INGREDIENT_BELT_COLOR[id];
    if (color === undefined) throw new Error(`Plating Belt has no image-derived colour for ${id}`);
    return { id, color };
  });
}

export function platingBeltDishFor(
  save: SaveData,
  day = save.business.calendar.businessDay,
): PlatingBeltDish {
  const dish = platingBeltDishOfTheDay(save, day);
  return { dish, ingredients: platingBeltIngredientsOf(dish) };
}
