/**
 * RECIPE_DEFINITIONS — Phase 1 of the restaurant-service architecture
 * (brief §68). This does NOT yet author the 150-180 cuisine-authentic
 * recipes §35 targets — that's Phases 3-7 content work, chapter by
 * chapter, alongside the real 250-level campaign.
 *
 * What this phase DOES do: give every one of the current 120 campaign
 * levels a real, honestly-derived RecipeDefinition (`deriveRecipeFromLevel`),
 * so the new Recipe/RecipeValidator/OrderGenerator layer has real data
 * to run against today, end to end, with ZERO invented content (§66 —
 * no "Dish 101" placeholders). `cuisineId` is deliberately left `null`
 * for every derived recipe: these levels were authored before cuisine
 * identity existed, and it would be dishonest to retroactively label
 * them Italian/French/etc. just because a later chapter number now
 * maps to that cuisine (§66 "do not claim cuisine identity if recipes
 * are generic"). Re-authoring existing chapters into real cuisine
 * dishes is explicit future-phase work, not done here.
 *
 * `id` reuses the level's own `recipeId` (already the SaveData.
 * recipeProgress key — see levelTypes.ts's own doc) so nothing about
 * existing mastery tracking changes.
 */
import { LEVELS } from "../levels/levelDefinitions";
import type { LevelDefinition } from "../levels/levelTypes";
import { INGREDIENTS, TECHNIQUES } from "../definitions";
import type { RecipeComponent, RecipeDefinition, RecipeDestination } from "./recipeTypes";

const DEFAULT_DESTINATION: RecipeDestination = { id: "plate", name: "Plate" };

function destinationsFor(level: LevelDefinition): RecipeDestination[] {
  const named = new Set(
    level.preparationSteps.map((s) => s.destination).filter((d): d is string => Boolean(d)),
  );
  if (named.size === 0) return [DEFAULT_DESTINATION];
  return [...named].map((name) => ({ id: name, name }));
}

function componentsFor(
  level: LevelDefinition,
  destinations: RecipeDestination[],
): RecipeComponent[] {
  const fallbackDestination = destinations[0]!.id;
  return level.preparationSteps.map((s) => ({
    ingredientId: s.ingredient,
    technique: s.technique,
    resultingState: s.resultingState,
    // Every existing level's own `destination` is a single name (never a
    // shared/multi-destination one) — one-element array preserves that
    // exactly (see recipeTypes.ts's own doc on why the field is plural).
    destinationIds: [s.destination ?? fallbackDestination],
    ...(s.chainBreak ? { chainBreak: true } : {}),
  }));
}

function chefInstructionFor(level: LevelDefinition): string {
  // §41 — short and actionable, built straight from the level's own
  // preparation steps rather than a second hand-authored instruction
  // set (one source of truth for "what does this recipe require").
  const lines = level.preparationSteps.map(
    (s) => `${TECHNIQUES[s.technique].name} the ${INGREDIENTS[s.ingredient].name.toLowerCase()}.`,
  );
  return lines.join(" ");
}

export function deriveRecipeFromLevel(level: LevelDefinition): RecipeDefinition {
  const destinations = destinationsFor(level);
  return {
    id: level.recipeId,
    name: level.title,
    emoji: level.emoji,
    cuisineId: null,
    authenticity: "B",
    components: componentsFor(level, destinations),
    destinations,
    batchable: level.preparationSteps.length > 1,
    chefInstruction: chefInstructionFor(level),
    customerDialogue: level.description,
    basePayment: level.reward.coins,
    unlockLevel: Number(level.id.match(/-(\d+)$/)?.[1] ?? 0),
    sourceLevelId: level.id,
  };
}

/** Every current campaign level, expressed as a real recipe (§8) — the Phase-1 recipe pool. */
export const RECIPES: Record<string, RecipeDefinition> = Object.fromEntries(
  LEVELS.map((level) => [level.recipeId, deriveRecipeFromLevel(level)]),
);

export const RECIPE_LIST: RecipeDefinition[] = Object.values(RECIPES);

export function getRecipe(id: string): RecipeDefinition | undefined {
  return RECIPES[id];
}

/** Recipes whose unlockLevel is already reached (§23 — order generation must never offer a locked recipe). */
export function recipesUnlockedByLevel(highestLevel: number): RecipeDefinition[] {
  return RECIPE_LIST.filter((r) => r.unlockLevel <= highestLevel);
}
