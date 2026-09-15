/**
 * INGREDIENT_LAB — Phase 18A. A dev/QA-only helper that lets the
 * Ingredient Lab screen (src/components/kc/IngredientLab.tsx) drive the
 * REAL Preparation flow (GameBridge → PreparationScene → CutGeometry/
 * CutEvaluator → the real texture/paint pipeline) for an arbitrary
 * {ingredient, technique} pair, without any of it belonging to the real
 * campaign.
 *
 * `buildLabLevel` synthesizes the smallest valid `LevelDefinition` for one
 * ingredient+technique — Preparation.tsx only ever reads `preparationSteps`
 * (handed straight to GameBridge as `steps`, see its own doc), `recipeId`/
 * `title`/`emoji`/`subtitle`/`reward.coins` (cosmetic HUD/order-card text),
 * so every other field here is a schema-valid placeholder, never read by
 * the running session. This is NOT a second level list: it's generated on
 * the fly from the same `INGREDIENTS`/`TECHNIQUES` records the real
 * campaign reads, one object at a time, never stored or registered
 * anywhere `LevelManager` looks.
 *
 * Crucially, nothing here ever calls `completeLevel`/`persist`/
 * `SaveManager` — the Lab passes its own `onComplete: () => 0` into
 * Preparation (see IngredientLab.tsx), so a lab session cannot touch
 * player progression, coins, recipe mastery, or level unlocks even though
 * it runs the exact same PreparationScene a real level would.
 */
import { INGREDIENTS, TECHNIQUES, type IngredientId, type TechniqueId } from "./definitions";
import type { LevelDefinition } from "./levels/levelTypes";

export function buildLabLevel(
  ingredientId: IngredientId,
  techniqueId: TechniqueId,
): LevelDefinition {
  const ingredient = INGREDIENTS[ingredientId];
  const technique = TECHNIQUES[techniqueId];
  const recipeId = `lab-${ingredientId}-${techniqueId}`;
  return {
    id: recipeId,
    chapter: 0,
    chapterId: "ingredient-lab",
    type: "RELAX",
    title: `${ingredient.name} · ${technique.name}`,
    subtitle: "Ingredient Lab — QA test, not a real order",
    description: "Dev-only ingredient/technique preview. Not part of the campaign.",
    emoji: "🔬",
    recipeId,
    objectives: [{ type: "completeRecipe", recipeId }],
    preparationSteps: [
      {
        ingredient: ingredientId,
        startingState: "whole",
        technique: techniqueId,
        resultingState: "prepared",
        optional: false,
      },
    ],
    destinations: [],
    unlockRequirements: { type: "always" },
    reward: { coins: 0 },
  };
}

/** The full ingredient roster, in the registry's own authored order — the same order used everywhere else in this file's own Object.keys(INGREDIENTS) reads, so Prev/Next cycles in a stable, predictable sequence. */
export function ingredientLabRoster(): IngredientId[] {
  return Object.keys(INGREDIENTS) as IngredientId[];
}
