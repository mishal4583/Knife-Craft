/**
 * BUSINESS_SERVICE_CATALOG — Economy V3 Phase 14, Checkpoint 3. Bridges
 * `businessDishCatalog.ts`'s own curated 35-dish menu into the EXISTING
 * `ServiceManager`/`OrderGenerator`/`PreparationScene` pipeline, which
 * all operate on plain `RecipeDefinition` objects — never a second
 * order/preparation engine, never a change to `CAMPAIGN_RECIPES` itself.
 *
 * THE SHADOW-RECIPE TECHNIQUE (why, and why it's safe): every UI
 * downstream of a `ServiceOrder` (Preparation's own `view.title`,
 * `KnifeReport`'s `dishName`, `ServiceOrderComplete`'s `{recipe.name}`)
 * reads the display name straight off `serviceOrder.recipe.name` — a
 * plain field on a `RecipeDefinition` object, never a separate prop.
 * Rather than threading a `dishName` override through three components
 * that were never designed to need one (touching Campaign's own,
 * already-working Restaurant Service/campaign-service rendering to add
 * a prop only Business Mode uses), this file builds a `businessPool()`
 * of "shadow" `RecipeDefinition` VALUES — plain object copies of the
 * real, existing source recipe with `name`/`chefInstruction` swapped to
 * the Business Dish's own real culinary identity, using its OWN,
 * unchanged `id`, `components`, `destinations`, `emoji`, `cuisineId`,
 * `authenticity`, `batchable`, `unlockLevel`. This is NOT a mutation:
 * `getCampaignRecipe(id)` still returns the ORIGINAL, byte-identical
 * CAMPAIGN_RECIPES entry forever — the shadow copy is a fresh object
 * built on demand, read by the gameplay/UI layer for exactly one
 * Business order's lifetime, never written back anywhere. The ACTUAL
 * preparation gameplay (steps, techniques, ingredients, quality
 * scoring) is 100% the real recipe's own `components` — reused, never
 * duplicated — so "the player must actually perform the existing
 * KnifeCraft preparation gameplay" holds exactly.
 */
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { getCampaignRecipe } from "../recipes/campaignRecipes";
import { BUSINESS_DISH_CATALOG, type BusinessDish } from "./businessDishCatalog";
import type { IngredientRequirement } from "./businessInventory";
import { recipePortionFractionFor } from "./businessPortionModel";

/**
 * One shadow `RecipeDefinition` per Business Dish, keyed by the SAME id
 * as its real source recipe (never a new id scheme) — `recipeProgress`
 * mastery tracking therefore works exactly like Restaurant Service's
 * own harness already does: the same shared, existing field, keyed by
 * the same recipe id, regardless of which mode served it.
 */
function shadowRecipeFor(dish: BusinessDish): RecipeDefinition {
  const source = getCampaignRecipe(dish.sourceRecipeId);
  if (!source) {
    throw new Error(
      `businessServiceCatalog: BusinessDish ${dish.id} references unknown recipe ${dish.sourceRecipeId}`,
    );
  }
  return {
    ...source,
    name: dish.name,
    chefInstruction: dish.description,
  };
}

/** The Business Mode order pool — one shadow recipe per dish, in catalog order. Never level-gated (Business Mode has no unlock-level concept of its own). Economy V3 Phase 16: callers pass the ACTIVE menu (businessMenuActivation.ts `activeBusinessDishes`) so off-menu dishes never generate an order; the default is the whole catalog. */
export function businessServicePool(
  dishes: readonly BusinessDish[] = BUSINESS_DISH_CATALOG,
): RecipeDefinition[] {
  return dishes.map(shadowRecipeFor);
}

/** Maps a shadow recipe's id (== its BusinessDish's own sourceRecipeId) back to the real BusinessDish — the one place that reverse lookup happens. */
export function businessDishForRecipeId(recipeId: string): BusinessDish | undefined {
  return BUSINESS_DISH_CATALOG.find((d) => d.sourceRecipeId === recipeId);
}

/**
 * The real, quantity-aware ingredient requirements a Business order for
 * this dish needs — ONE requirement entry per component occurrence,
 * deliberately NOT deduped, mirroring businessMenu.ts's own
 * `recipeCostBasis` exactly (which already charges twice for an
 * ingredient used in two components): the inventory drawn down for a
 * serve must match the same real-usage counting the menu price was
 * already calibrated against, or the two would silently disagree.
 * `consumeUsableIngredients`/`hasUsableIngredients` (perishability.ts)
 * already pre-sum same-ingredient requirements internally — this
 * function never needs to dedupe/sum itself.
 */
export function businessDishRequirements(dish: BusinessDish): IngredientRequirement[] {
  const recipe = getCampaignRecipe(dish.sourceRecipeId);
  if (!recipe) {
    throw new Error(
      `businessServiceCatalog: BusinessDish ${dish.id} references unknown recipe ${dish.sourceRecipeId}`,
    );
  }
  // Economy V3 Phase 16 (final audit, P1 fix): each component draws down
  // the SAME documented portion fraction recipeCostBasis prices it at
  // (businessPortionModel.ts — 0.025 lb per Aromatic step, 1 whole unit
  // for every other category). Before this fix every component drew a
  // whole purchase unit, so an Aromatic dish's real COGS ran up to 7x
  // its menu food cost and 4 dishes lost money on every serve at their
  // suggested price — contradicting this function's own invariant above.
  return recipe.components.map((c) => ({
    ingredientId: c.ingredientId,
    quantity: recipePortionFractionFor(c.ingredientId),
  }));
}
