/**
 * RECIPE_REQUIREMENTS — the real stock ONE serving of any recipe uses, for
 * all 221 campaign recipes (and the Business-only one), not just the 48
 * Business dishes.
 *
 * It is the rule Business orders already draw stock with
 * (`businessDishRequirements`, which now calls this): one requirement per
 * recipe component, each `recipePortionFractionFor` of a purchase unit
 * (0.025 for an Aromatic step, one whole unit for anything else). One rule,
 * so a campaign Caprese and a Business Caprese use the same stock.
 *
 * Pure. `consumeUsableIngredients` / `hasUsableIngredients` sum repeated
 * ingredients themselves; `sumRequirements` does it for display.
 */
import type { RecipeDefinition } from "../recipes/recipeTypes";
import type { IngredientId } from "../definitions";
import type { IngredientRequirement } from "../business/businessInventory";
import { normalizeQuantity } from "../business/businessInventory";
import { recipePortionFractionFor } from "../business/businessPortionModel";

/** One serving's stock, one entry per component (not summed). */
export function recipeRequirements(recipe: RecipeDefinition): IngredientRequirement[] {
  return recipe.components.map((c) => ({
    ingredientId: c.ingredientId,
    quantity: recipePortionFractionFor(c.ingredientId),
  }));
}

/** The same requirements summed per ingredient, in first-use order (for lists and checks). */
export function sumRequirements(
  requirements: readonly IngredientRequirement[],
): IngredientRequirement[] {
  const totals = new Map<IngredientId, number>();
  for (const r of requirements) {
    totals.set(r.ingredientId, (totals.get(r.ingredientId) ?? 0) + r.quantity);
  }
  return [...totals].map(([ingredientId, quantity]) => ({
    ingredientId,
    quantity: normalizeQuantity(quantity),
  }));
}

/** Several servings (a level's tickets), summed per ingredient. */
export function requirementsForRecipes(
  recipes: readonly RecipeDefinition[],
): IngredientRequirement[] {
  return sumRequirements(recipes.flatMap(recipeRequirements));
}
