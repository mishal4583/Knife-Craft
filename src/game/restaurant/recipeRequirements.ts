/**
 * RECIPE_REQUIREMENTS — the real stock ONE serving of any recipe uses, for
 * all 221 campaign recipes (and the Business-only one), not just the 48
 * Business dishes.
 *
 * It is the rule Business orders draw stock with too
 * (`businessDishRequirements` calls this), so a campaign Caprese and a
 * Business Caprese use the same stock.
 *
 * Realistic portions (developer 2026-10-08): one requirement per PHYSICAL
 * item prepared — consecutive steps on the same ingredient are the same
 * item unless the recipe marks a `chainBreak` (EconomySettlement's
 * `ingredientInstancesFor`, the cutting scene's own rule) — and each item
 * uses its plate serving (`ingredientMeasures.servingFor`: a tomato 0.3 lb,
 * 2–3 garlic cloves 0.025 lb, a quarter loaf of bread). It used to be one
 * whole purchase unit per technique step (an onion peeled, halved and
 * sliced took 3 lb).
 *
 * Pure. `consumeUsableIngredients` / `hasUsableIngredients` sum repeated
 * ingredients themselves; `sumRequirements` does it for display.
 */
import type { RecipeDefinition } from "../recipes/recipeTypes";
import type { IngredientId } from "../definitions";
import type { IngredientRequirement } from "../business/businessInventory";
import { normalizeQuantity } from "../business/businessInventory";
import { servingFor } from "../business/ingredientMeasures";
import { ingredientInstancesFor } from "../economy/EconomySettlement";

/** One serving's stock, one entry per physical item prepared (not summed). */
export function recipeRequirements(recipe: RecipeDefinition): IngredientRequirement[] {
  return ingredientInstancesFor(recipe).map((item) => ({
    ingredientId: item.ingredientId,
    quantity: servingFor(item.ingredientId),
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
