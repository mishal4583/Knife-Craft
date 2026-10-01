/**
 * Which cooking clip (CookingClip) a finished dish gets: the salad film
 * for salads, the chef-cooking film for everything else.
 *
 * A dish is a salad when its name or its recipe's name says so ("Salad", "Slaw") or when
 * the Business Mode dish made from its recipe is listed as a Salad or
 * named one (businessDishCatalog) — e.g. Campaign's "Caprese Plate" is
 * served in Business as Caprese Salad. Derived from the existing recipe
 * and dish data; nothing is stored.
 */
import { BUSINESS_DISH_CATALOG } from "../business/businessDishCatalog";
import { getCampaignRecipe } from "./campaignRecipes";

export type DishKind = "salad" | "cooked";

const SALAD_NAME = /\b(salad|slaw)\b/i;

const SALAD_RECIPE_IDS: ReadonlySet<string> = new Set(
  BUSINESS_DISH_CATALOG.filter((d) => d.category === "Salad" || SALAD_NAME.test(d.name)).map(
    (d) => d.sourceRecipeId,
  ),
);

export function dishKindFor(recipeId: string, dishName: string): DishKind {
  const recipeName = getCampaignRecipe(recipeId)?.name ?? "";
  return SALAD_RECIPE_IDS.has(recipeId) || SALAD_NAME.test(dishName) || SALAD_NAME.test(recipeName)
    ? "salad"
    : "cooked";
}
