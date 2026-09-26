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
import type { RecipeDefinition, RecipeComponent } from "../recipes/recipeTypes";
import type { Destination, OrganizationSession } from "../organization/organizationTypes";
import { INGREDIENTS } from "../definitions";
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
      .filter((c) => c.destinationIds.includes(d.id))
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

/**
 * PHASE 7.1 — prerequisite-state validation (brief §17/§21).
 *
 * PreparationScene.requiresPeelFirst() already gates ALL input for an
 * ingredient whose `techniques` includes "peel" and which does NOT set
 * `peelDecoupled` — see definitions.ts's own doc ("Onion/Potato/Garlic/
 * Pineapple/Watermelon/Coconut do NOT set this — Peel remains
 * mandatory-first for them"). stepsForRecipe.ts maps RecipeComponent[]
 * straight to PreparationStep[] with no automatic peel insertion, so a
 * recipe that asks for e.g. Garlic Rock Mince without an explicit
 * Peel-Garlic component first is a genuine dead end: `this.peeled` can
 * never become true because the player is never presented a Peel step
 * for that ingredient instance. This reuses that exact same authoritative
 * gating rule (INGREDIENTS[id].techniques/peelDecoupled) rather than a
 * second hardcoded ingredient list, so it can never drift out of sync
 * with the real in-game gate.
 */
function ingredientRequiresPeelFirst(ingredientId: RecipeComponent["ingredientId"]): boolean {
  const def = INGREDIENTS[ingredientId];
  return def.techniques.includes("peel") && !def.peelDecoupled;
}

/**
 * Splits a recipe's components into "runs" — one run per independently
 * prepared ingredient instance. A run continues across consecutive
 * components that share the same ingredientId with no `chainBreak`
 * (mirrors Preparation.tsx/PreparationScene's own `isChain` continuation
 * rule); a different ingredientId, or an explicit `chainBreak`, always
 * starts a fresh instance/run, since that's a fresh whole ingredient the
 * player peels (if required) independently of any earlier run.
 */
function componentRuns(recipe: RecipeDefinition): RecipeComponent[][] {
  const runs: RecipeComponent[][] = [];
  for (const c of recipe.components) {
    const current = runs[runs.length - 1];
    const continuesRun = current && current[0]!.ingredientId === c.ingredientId && !c.chainBreak;
    if (continuesRun) current!.push(c);
    else runs.push([c]);
  }
  return runs;
}

/**
 * One human-readable description per run that asks for a peel-mandatory
 * technique without a Peel step earlier in the same run. Empty array =
 * every ingredient instance in this recipe has a reachable path from its
 * initial ("whole") state to every technique it's asked to perform.
 */
export function recipePrerequisiteIssues(recipe: RecipeDefinition): string[] {
  const issues: string[] = [];
  for (const run of componentRuns(recipe)) {
    if (!ingredientRequiresPeelFirst(run[0]!.ingredientId)) continue;
    let peeledYet = false;
    for (const c of run) {
      if (c.technique === "peel") {
        peeledYet = true;
        continue;
      }
      if (!peeledYet) {
        issues.push(
          `${recipe.id}: ${c.ingredientId} requires Peel before ${c.technique} (no prior Peel step in this instance)`,
        );
        break;
      }
    }
  }
  return issues;
}

/** True only when `recipePrerequisiteIssues` finds nothing wrong. */
export function isRecipePlayable(recipe: RecipeDefinition): boolean {
  return recipePrerequisiteIssues(recipe).length === 0;
}
