/**
 * RECIPE_VALIDATOR — the single authoritative "is this recipe correct"
 * layer (brief §53). Deliberately built ON TOP of the existing Mise en
 * Place foundation (organizationManager.ts / organizationTypes.ts,
 * Phase 11) rather than a second parallel validation concept: that
 * module already implements exactly PREPARE → ORGANIZE → DISTRIBUTE →
 * COMPLETE with the correct "no piece counts, no failure state,
 * existence-based satisfaction" semantics (§4/§5/§32 of its own doc),
 * it was simply never wired to anything yet. This file is that wiring.
 *
 *   RecipeDefinition (recipeTypes.ts)
 *        ↓ destinationsForRecipe
 *   organizationTypes.Destination[]
 *        ↓ createOrganizationSession
 *   OrganizationSession (organizationManager.ts, untouched)
 *        ↓ createPreparedOutput / assignOutput (called as the player cuts)
 *        ↓ isRecipeReady
 *   ready to serve (§45)
 */
import type { RecipeDefinition } from "../recipes/recipeTypes";
import type { Destination, OrganizationSession } from "../organization/organizationTypes";
import {
  createOrganizationSession,
  areAllDestinationsComplete,
} from "../organization/organizationManager";

/** Builds the Destination list a recipe implies — the one place recipe → destination mapping happens (§53: no duplicating this across UI/scene/order code). */
export function destinationsForRecipe(recipe: RecipeDefinition): Destination[] {
  return recipe.destinations.map((d) => ({
    id: d.id,
    recipeId: recipe.id,
    name: d.name,
    requiredIngredients: recipe.components
      .filter((c) => c.destinationId === d.id)
      .map((c) => ({ ingredientId: c.ingredientId, preparationState: c.resultingState })),
  }));
}

/** A fresh Mise en Place session scoped to one recipe — the starting point for a service session's validation. */
export function sessionForRecipe(recipe: RecipeDefinition): OrganizationSession {
  return createOrganizationSession(destinationsForRecipe(recipe));
}

/** §45 — "is every required component ready", the single gate before serving/payment can happen. */
export function isRecipeReady(session: OrganizationSession): boolean {
  return areAllDestinationsComplete(session);
}
