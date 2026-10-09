/**
 * LEVEL GOALS (developer 2026-10-09, "Levels 1–15 retention" pass 3).
 * Presentation only, read from data the game already has — no new recipe,
 * quality, dialogue or progression system, and no money:
 *
 *  - The goal comes from the dish's real steps (recipe components → the
 *    techniques the cutting scene grades).
 *  - Stars are the cutting engine's OWN grade ladder (CutEvaluator
 *    `qualityFor`: Masterful ≥ 95, Clean ≥ 85, Honest ≥ 70, Rustic ≥ 50,
 *    Learning) applied to the best score the save already keeps for the
 *    dish (`recipeProgress[recipeId].best`): ★ Honest, ★★ Clean,
 *    ★★★ Masterful. Never required to finish, never money, nothing new saved
 *    (old saves show the stars they have earned).
 *  - Honest limits: peel and smash steps are not graded by the engine
 *    (PreparationScene.finishRecipeNow gives an all-peel/smash dish a fixed
 *    90), so a dish made only of them (Level 7, Level 9) gets a completion
 *    goal and no stars rather than invented precision.
 *  - The customer line is the recipe's own authored `customerDialogue`.
 *  - The checklist is the dish's real steps, ticked by the scene's own step
 *    events (Preparation's active step), never a timer.
 *  - The ingredient list is the dish's own requirements (`orderRequirements`,
 *    the same planned use the fridge is drawn by) next to the fridge's
 *    usable stock — read-only.
 */
import type { SaveData } from "../SaveManager";
import type { QualityLabel } from "@/types/game";
import type { IngredientId, TechniqueId } from "../definitions";
export { checklistFor, starText, type ChecklistItem } from "./levelChecklist";
import type { LevelDefinition } from "../levels/levelTypes";
import { getCampaignRecipe } from "../recipes/campaignRecipes";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { qualityFor } from "../CutEvaluator";
import { usableQuantity } from "../business/perishability";
import { orderRequirements } from "./campaignStock";
import { savedTicketsFor } from "./serviceTickets";

/** The levels the goals, stars, customer lines and checklist are for. */
export const GOAL_LEVELS_TO = 15;
/** The level the dish's ingredient list opens at. */
export const INGREDIENT_LIST_FROM = 9;

export function hasLevelGoals(levelNumber: number): boolean {
  return levelNumber >= 1 && levelNumber <= GOAL_LEVELS_TO;
}

/** Steps the cutting engine does not grade (no cut geometry). */
const UNGRADED: ReadonlySet<TechniqueId> = new Set(["peel", "smash"]);

/** ★ per engine grade: the stars are its own ladder, not new thresholds. */
export const STARS_FOR_GRADE: Record<QualityLabel, 0 | 1 | 2 | 3> = {
  Learning: 0,
  Rustic: 0,
  Honest: 1,
  Clean: 2,
  Masterful: 3,
};

/** The grade each star needs, for the goal line ("★★★ Masterful"). */
export const STAR_GRADES: readonly { stars: 1 | 2 | 3; grade: QualityLabel }[] = [
  { stars: 1, grade: "Honest" },
  { stars: 2, grade: "Clean" },
  { stars: 3, grade: "Masterful" },
];

/** True when the engine grades at least one of the dish's steps. */
export function isGraded(recipe: RecipeDefinition): boolean {
  return recipe.components.some((c) => !UNGRADED.has(c.technique));
}

/** Stars for a score (the engine's grade). */
export function starsForScore(score: number): 0 | 1 | 2 | 3 {
  return STARS_FOR_GRADE[qualityFor(score)];
}

/** The recipes a level's order may be (its saved tickets once opened, else its pool). */
export function levelRecipes(
  save: Pick<SaveData, "levelProgress">,
  level: LevelDefinition,
): RecipeDefinition[] {
  const saved = savedTicketsFor(save.levelProgress, level);
  if (saved?.length) return saved;
  return (level.recipePoolIds ?? [])
    .map((id) => getCampaignRecipe(id))
    .filter((r): r is RecipeDefinition => !!r);
}

/**
 * The level's best stars from the save's own best scores: null when no
 * graded dish of the level has been cooked yet, or the dish isn't graded.
 */
export function levelStars(
  save: Pick<SaveData, "levelProgress" | "recipeProgress">,
  level: LevelDefinition,
): 0 | 1 | 2 | 3 | null {
  let best: number | null = null;
  for (const id of level.recipePoolIds ?? []) {
    const recipe = getCampaignRecipe(id);
    const score = save.recipeProgress[id]?.best;
    if (!recipe || !isGraded(recipe) || typeof score !== "number") continue;
    best = Math.max(best ?? 0, score);
  }
  return best === null ? null : starsForScore(best);
}

/** What a technique's goal reads as (what its grade measures). */
const GOAL_PHRASE: Partial<Record<TechniqueId, string>> = {
  slice: "even slices",
  chop: "short, even pieces",
  dice: "a neat, even grid",
  halve: "two even halves",
  rings: "even rings",
  julienne: "thin, even strips",
};

/**
 * The dish's goal: what the engine grades on it. A multi-step dish names
 * its step count; a dish of peel/smash only is a completion goal.
 */
export function goalFor(recipe: RecipeDefinition): string {
  const steps = recipe.components.length;
  if (!isGraded(recipe)) return steps > 1 ? `Finish all ${steps} steps` : "Finish the step cleanly";
  // A multi-step dish is graded on all its cut steps together (the scene
  // blends their segments), so its goal is about them all, not the first
  // one; its checklist lists the steps themselves.
  if (steps > 1) return "Clean, even cuts";
  const phrase = GOAL_PHRASE[recipe.components[0]!.technique] ?? "clean, even cuts";
  return phrase[0]!.toUpperCase() + phrase.slice(1);
}

/** The customer's own words for this dish (the recipe's authored line). */
export function customerLineFor(recipe: RecipeDefinition): string {
  return recipe.customerDialogue;
}

export type DishIngredients = {
  dish: string;
  rows: { ingredientId: IngredientId; need: number; have: number }[];
};

/**
 * The ingredients of the level's own dish (or each dish its pool may roll):
 * the planned use the fridge is drawn by, and the usable stock. Read-only.
 */
export function dishIngredientsFor(save: SaveData, level: LevelDefinition): DishIngredients[] {
  const day = save.business.calendar.businessDay;
  return levelRecipes(save, level).map((recipe) => ({
    dish: recipe.name,
    rows: orderRequirements(save, recipe).map((r) => ({
      ingredientId: r.ingredientId,
      need: r.quantity,
      have: usableQuantity(save.business.inventory, r.ingredientId, day),
    })),
  }));
}
