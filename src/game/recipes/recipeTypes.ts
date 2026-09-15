/**
 * RECIPE_TYPES — the reusable recipe data model (brief §8). A recipe is
 * NOT a level (§3 "Level ≠ Order... Recipe ≠ Level"): the same recipe
 * may be served by different customers, in different levels, as part
 * of a batch, or as one branch of a larger service. Levels grant
 * ACCESS to recipes (via `unlockLevel`); the order generator decides
 * which unlocked recipe an incoming customer actually orders.
 *
 * `components` is the same {ingredient, technique, resultingState}
 * vocabulary levelTypes.ts's PreparationStep already uses — a recipe
 * doesn't reinvent how preparation is expressed, it just names a
 * reusable bundle of it. `destinations` is >1 only for a genuine
 * branching/shared-ingredient recipe (§20/§21/§44); RecipeValidator
 * turns this straight into an organizationManager.ts Destination list
 * rather than a second validation concept (§53).
 */
import type { IngredientId, TechniqueId } from "../definitions";
import type { CuisineId } from "../cuisines/cuisineTypes";

/**
 * §9 — authenticity tiers. "A": authentic enough for the ingredients
 * KnifeCraft actually has. "B": explicitly KnifeCraft-inspired, not a
 * claim of authenticity. "C": expansion-ready — not yet complete enough
 * to call authentic. Never mislabel a simplified dish as "A".
 */
export type AuthenticityTier = "A" | "B" | "C";

export type RecipeComponent = {
  ingredientId: IngredientId;
  technique: TechniqueId;
  resultingState: string;
  /** Which of this recipe's `destinations` this component belongs to. Every recipe has at least one destination ("plate" for a simple recipe), so this is never optional. */
  destinationId: string;
};

export type RecipeDestination = {
  id: string;
  /** Display name — "Plate", "Salad", "Bowl", a named table for a multi-customer service, etc. (§21). */
  name: string;
};

export type RecipeDefinition = {
  id: string;
  name: string;
  /** null only for Chapter 1's pre-cuisine fundamentals (§3 of Chapter 1) and for recipes derived from pre-restaurant-service campaign levels that haven't yet been re-authored into a cuisine arc (see recipeDefinitions.ts's deriveRecipeFromLevel). */
  cuisineId: CuisineId | null;
  authenticity: AuthenticityTier;
  components: RecipeComponent[];
  destinations: RecipeDestination[];
  /** §19 — can this recipe's components be usefully prepared as a shared batch across more than one active order (e.g. two customers both wanting Tomato Dice). Informational for the order generator/UI; RecipeValidator doesn't need it to validate a single order. */
  batchable: boolean;
  /** §41 — short, actionable line for the in-session chef-instruction HUD. */
  chefInstruction: string;
  /** §6 — dish-specific flavor line shown when a customer places this order. */
  customerDialogue: string;
  /** §7 — flat, deterministic coin reward for a correct completion. Never scaled by time/quality. */
  basePayment: number;
  /** Campaign level number at which this recipe enters the active order-generation pool. */
  unlockLevel: number;
  /** Traceability only (§77-style provenance) — set when this recipe was mechanically derived from an existing LevelDefinition rather than freshly authored. */
  sourceLevelId?: string;
};
