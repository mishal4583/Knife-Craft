/**
 * Which cooking clip (CookingClip) a finished dish gets: the fruit-cup film
 * for fruit dishes, the salad film for salads, the curry-pot film for
 * curries and pot dishes, the chef-cooking (stove) film for other cooked
 * dishes, and the plating film for everything that
 * is only cut and plated (Levels 1–9's plates and bowls, garnishes, salsas,
 * skewers, antipasti, prep bases).
 *
 * - Fruit: every ingredient of its recipe is a Fruit (the Ingredient
 *   Registry's own category — fruit cups, fruit plates, a lemon garnish),
 *   or the Business Mode dish made from the recipe is a Dessert (the fruit
 *   cups and plate).
 * - Salad: its name or its recipe's name says so ("Salad", "Slaw"), or the
 *   Business Mode dish made from its recipe is listed as a Salad or named
 *   one (businessDishCatalog) — e.g. Campaign's "Caprese Plate" is served
 *   in Business as Caprese Salad.
 * - Curry: a pot word in the dish's or recipe's name (curry, masala,
 *   chutney, minestrone, velouté, soup, French onion, dal, stew), or the
 *   Business dish is a Curry.
 * - Cooked: a Protein ingredient (chicken, steak, salmon), a cooking word
 *   in the dish's or recipe's name (stir-fry, wok, sauté,
 *   rings, gratin, bread, toast, bruschetta, …), or the Business dish is a
 *   Stir-Fry or Entree.
 * - Plated: everything else.
 *
 * Derived from the existing recipe, ingredient and dish data; nothing is stored.
 */
import { INGREDIENTS } from "../definitions";
import { BUSINESS_DISH_CATALOG } from "../business/businessDishCatalog";
import { getCampaignRecipe } from "./campaignRecipes";

export type DishKind = "fruit" | "salad" | "curry" | "cooked" | "plated";

const SALAD_NAME = /\b(salad|slaw)\b/i;

const SALAD_RECIPE_IDS: ReadonlySet<string> = new Set(
  BUSINESS_DISH_CATALOG.filter((d) => d.category === "Salad" || SALAD_NAME.test(d.name)).map(
    (d) => d.sourceRecipeId,
  ),
);

const COOKED_NAME =
  /stir|wok|saut|\bfr(y|ied)\b|rings|gratin|duxelles|hash|persillade|bread|toast|bruschetta|crostini|fajita/i;

const CURRY_NAME = /curry|masala|chutney|minestrone|velout|soup|french onion|\bdal\b|stew/i;

const CURRY_RECIPE_IDS: ReadonlySet<string> = new Set(
  BUSINESS_DISH_CATALOG.filter((d) => d.category === "Curry").map((d) => d.sourceRecipeId),
);

const COOKED_RECIPE_IDS: ReadonlySet<string> = new Set(
  BUSINESS_DISH_CATALOG.filter((d) => ["Stir-Fry", "Entree"].includes(d.category)).map(
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
  const names = `${dishName} ${recipe?.name ?? ""}`;
  if (SALAD_RECIPE_IDS.has(recipeId) || SALAD_NAME.test(names)) return "salad";
  if (CURRY_RECIPE_IDS.has(recipeId) || CURRY_NAME.test(names)) return "curry";
  const hasProtein = !!recipe?.components.some(
    (c) => INGREDIENTS[c.ingredientId]?.category === "Protein",
  );
  return hasProtein || COOKED_RECIPE_IDS.has(recipeId) || COOKED_NAME.test(names)
    ? "cooked"
    : "plated";
}
