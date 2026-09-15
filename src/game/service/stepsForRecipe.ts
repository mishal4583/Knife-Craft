/**
 * STEPS_FOR_RECIPE — turns a RecipeDefinition's components into the exact
 * `PreparationStep[]` shape a real LevelDefinition already carries
 * (levelTypes.ts) — brief §30/§15: the cutting engine is touched
 * minimally, it just gets fed from a Recipe instead of always a Level's
 * own `preparationSteps`. Preparation.tsx derives its `PrepStep[]` (the
 * GameBridge/PreparationScene contract) from this exact shape either
 * way, so the cutting engine never needs to know whether a session came
 * from a campaign level or a service recipe.
 *
 * `destination` (singular display string) is derived by joining every
 * destination NAME a component satisfies — the common case is one name;
 * a genuine shared-output component (destinationIds.length > 1) shows
 * both, e.g. "Maya's Plate & Daniel's Plate" (§21/§24).
 */
import type { PreparationStep } from "../levels/levelTypes";
import type { RecipeDefinition } from "../recipes/recipeTypes";

function destinationNames(recipe: RecipeDefinition, destinationIds: string[]): string {
  const byId = new Map(recipe.destinations.map((d) => [d.id, d.name]));
  return destinationIds.map((id) => byId.get(id) ?? id).join(" & ");
}

/** For Preparation.tsx's existing "Step X of Y · for <Destination>" label and its steps->PrepStep mapping — mirrors a real LevelDefinition's own preparationSteps shape exactly, so no new mapping code is needed on the consuming side. */
export function preparationStepsForRecipe(recipe: RecipeDefinition): PreparationStep[] {
  return recipe.components.map((c) => ({
    ingredient: c.ingredientId,
    startingState: "whole",
    technique: c.technique,
    resultingState: c.resultingState,
    destination: destinationNames(recipe, c.destinationIds),
    optional: false,
    ...(c.chainBreak ? { chainBreak: true } : {}),
  }));
}
