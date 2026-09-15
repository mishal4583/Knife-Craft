/**
 * ORDER_GENERATOR — controlled randomness over the unlocked recipe pool
 * (brief §22/§54). Never pure Math.random() selection: recently-served
 * recipes and recently-served cuisines are down-weighted so the board
 * doesn't repeat itself, while still allowing a deliberate repeat when
 * every alternative is equally recent (there's always a valid result
 * as long as `unlockedRecipes` is non-empty — §22 "do not allow
 * impossible orders").
 *
 * `rand` is injectable (defaults to Math.random) so this stays a pure,
 * unit-testable function — never hidden platform randomness (§54's
 * "deterministic enough to feel designed").
 */
import type { RecipeDefinition } from "../recipes/recipeTypes";
import type { CuisineId } from "../cuisines/cuisineTypes";

export type OrderGeneratorInput = {
  unlockedRecipes: RecipeDefinition[];
  /** Most-recently-served last. Only the tail matters; callers may pass the full history. */
  recentRecipeIds: string[];
  recentCuisineIds: (CuisineId | null)[];
};

const RECENT_RECIPE_LOOKBACK = 3;
const RECENT_CUISINE_LOOKBACK = 2;
const RECENT_RECIPE_PENALTY = 0.2;
const RECENT_CUISINE_PENALTY = 0.6;

/** Never throws/returns undefined for a non-empty pool; returns null only when there is truly nothing to order from (§22 — the caller, not this function, decides what that means for the board). */
export function generateOrder(
  input: OrderGeneratorInput,
  rand: () => number = Math.random,
): RecipeDefinition | null {
  const pool = input.unlockedRecipes;
  if (pool.length === 0) return null;

  const recentRecipes = new Set(input.recentRecipeIds.slice(-RECENT_RECIPE_LOOKBACK));
  const recentCuisines = new Set(input.recentCuisineIds.slice(-RECENT_CUISINE_LOOKBACK));

  const weighted = pool.map((recipe) => {
    let weight = 1;
    if (recentRecipes.has(recipe.id)) weight *= RECENT_RECIPE_PENALTY;
    if (recipe.cuisineId && recentCuisines.has(recipe.cuisineId)) weight *= RECENT_CUISINE_PENALTY;
    return { recipe, weight };
  });

  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = rand() * total;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.recipe;
  }
  return weighted[weighted.length - 1]!.recipe;
}
