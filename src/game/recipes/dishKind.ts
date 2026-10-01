/**
 * Which cooking clip (CookingClip) a finished dish gets: the fruit-cup film
 * for fruit dishes, the salad film for salads, the chef-cooking film for
 * everything else.
 *
 * - Fruit: every ingredient of its recipe is a Fruit (the Ingredient
 *   Registry's own category — fruit cups, fruit plates, a lemon garnish),
 *   or the Business Mode dish made from the recipe is a Dessert (the fruit
 *   cups and plate).
 * - Salad: its name or its recipe's name says so ("Salad", "Slaw"), or the
 *   Business Mode dish made from its recipe is listed as a Salad or named
 *   one (businessDishCatalog) — e.g. Campaign's "Caprese Plate" is served
 *   in Business as Caprese Salad.
 *
 * Derived from the existing recipe, ingredient and dish data; nothing is stored.
 */
import { INGREDIENTS } from "../definitions";
import { BUSINESS_DISH_CATALOG } from "../business/businessDishCatalog";
import { getCampaignRecipe } from "./campaignRecipes";

export type DishKind = "fruit" | "salad" | "cooked";

const SALAD_NAME = /\b(salad|slaw)\b/i;

const SALAD_RECIPE_IDS: ReadonlySet<string> = new Set(
  BUSINESS_DISH_CATALOG.filter((d) => d.category === "Salad" || SALAD_NAME.test(d.name)).map(
    (d) => d.sourceRecipeId,
  ),
);

const DESSERT_RECIPE_IDS: ReadonlySet<string> = new Set(
  BUSINESS_DISH_CATALOG.filter((d) => d.category === "Dessert").map((d) => d.sourceRecipeId),
);

export function dishKindFor(recipeId: string, dishName: string): DishKind {
  const recipe = getCampaignRecipe(recipeId);
  const allFruit =
    !!recipe &&
    recipe.components.length > 0 &&
    recipe.components.every((c) => INGREDIENTS[c.ingredientId]?.category === "Fruit");
  if (allFruit || DESSERT_RECIPE_IDS.has(recipeId)) return "fruit";
  return SALAD_RECIPE_IDS.has(recipeId) ||
    SALAD_NAME.test(dishName) ||
    SALAD_NAME.test(recipe?.name ?? "")
    ? "salad"
    : "cooked";
}
