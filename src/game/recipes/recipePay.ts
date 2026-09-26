/**
 * RECIPE_PAY — KnifeCraft_Level_System_v2.docx §3.4's pay formula, the
 * single place campaign pay is computed. Before this, `RecipeDefinition.
 * basePayment` was a flat, hand-authored number per recipe — v2 §2.2
 * explicitly diagnoses why that's wrong: a reused recipe carried its
 * FIRST chapter's pay into every later chapter it's served in ("Chicken
 * & Carrot Plate paid 480c inside L246 where every other recipe paid
 * ~2700c"). Pay is a property of the (recipe, chapter served) pair, not
 * the recipe alone.
 *
 * recipeBase(recipe)    = 8 * stepCount + 3.5 * sum(effort of each step)
 * chapterMultiplier(ch) = 1.0 + (ch - 1) * 0.125
 * recipePay(recipe,ch)  = round5( max(recipeBase, 45) * chapterMultiplier(ch) )
 *
 * The two tuning constants are EFFORT_WEIGHT (3.5) and CHAPTER_RAMP
 * (0.125) — to retune the whole economy, change only these two and
 * recompute; no other file should hand-author a pay number.
 *
 * `RecipeDefinition.basePayment` itself is UNCHANGED as a field (still
 * present, still a number) — campaignRecipes.ts now stores it as a
 * SNAPSHOT (this formula evaluated at the recipe's own `unlockLevel`
 * chapter) for any non-campaign reader, but CustomerOrderManager.
 * createCustomerOrder ignores it and calls `recipePay` directly whenever
 * a chapter is known (every real campaign session), so a reused recipe
 * is never underpaid or overpaid in a later chapter.
 */
import type { RecipeDefinition } from "./recipeTypes";
import type { TechniqueId } from "../definitions";

/** v2 §3.2's own effort weights — "the pay weight... a 6-cut dice is not half the work of a 12-cut slice." Never edited per-recipe; a recipe that needs a different cut count states it on the recipe's own step count instead. */
const TECHNIQUE_EFFORT: Record<TechniqueId, number> = {
  slice: 12,
  chop: 12,
  dice: 12,
  julienne: 12,
  chiffonade: 10,
  radial: 8,
  rings: 8,
  rockMince: 12,
  peel: 6,
  halve: 4,
  smash: 4,
};

const EFFORT_WEIGHT = 3.5;
const CHAPTER_RAMP = 0.125;
const MIN_BASE = 45;

function round5(value: number): number {
  return Math.round(value / 5) * 5;
}

export function chapterMultiplier(chapter: number): number {
  return 1.0 + (chapter - 1) * CHAPTER_RAMP;
}

export function recipeBase(recipe: RecipeDefinition): number {
  const effortSum = recipe.components.reduce((sum, c) => sum + TECHNIQUE_EFFORT[c.technique], 0);
  return 8 * recipe.components.length + EFFORT_WEIGHT * effortSum;
}

/** The one function every real pay site should call — recipeBase and chapterMultiplier are exported only for the QA script's own formula validation. */
export function recipePay(recipe: RecipeDefinition, chapter: number): number {
  return round5(Math.max(recipeBase(recipe), MIN_BASE) * chapterMultiplier(chapter));
}
