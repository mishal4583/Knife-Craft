/**
 * ORGANIZATION_TYPES — data schema for the Mise en Place foundation
 * (Phase 11). PREPARE → ORGANIZE → DISTRIBUTE → COMPLETE.
 *
 * This module implements what levelTypes.ts's old `PreparedOutput` field
 * only ever reserved as a schema-only placeholder (never referenced
 * anywhere in the codebase — confirmed by a repo-wide search before
 * writing this). That placeholder is now removed in favor of this real
 * type, so there's exactly one `PreparedOutput` shape, not two.
 *
 * CRITICAL DESIGN LAW (see the phase brief's §3/§4/§11/§12): the
 * fundamental resource is THE INGREDIENT'S PREPARATION STATE, never a
 * piece count. A destination requirement is satisfied by the EXISTENCE of
 * a matching PreparedOutput assigned to it — nothing here counts pieces,
 * nothing here can under/over-flow into a failure state, and nothing here
 * deletes surplus.
 */
import type { IngredientId } from "../definitions";
import type { QualityLabel } from "@/types/game";

/**
 * One prepared batch of an ingredient at a given preparation state.
 * `preparationState` is a free-form string — the SAME convention
 * `PreparationStep.resultingState` already uses (e.g. "sliced", "halved",
 * "peeled") — not a closed enum, so every existing/future chain state
 * (including ones this phase never enumerates) is valid without a schema
 * change.
 *
 * `assignedTo` is an ARRAY, not a single nullable id — deliberately, so
 * ONE prepared output can satisfy MULTIPLE destinations at once (§10
 * "shared ingredients") without ever being "consumed" or needing a
 * split-batch mechanic. Assigning to a second destination never removes
 * it from the first — there is no scarcity model here, matching §32's
 * "no hidden failure state" requirement by construction, not by careful
 * bookkeeping.
 */
export type PreparedOutput = {
  id: string;
  ingredientId: IngredientId;
  preparationState: string;
  quality?: QualityLabel;
  /** Opaque provenance only (e.g. a step index as a string) — never read by this module's own logic. */
  sourceStepId?: string;
  assignedTo: string[];
};

export type DestinationIngredientRequirement = {
  ingredientId: IngredientId;
  preparationState: string;
};

/** A gameplay target a prepared output can be assigned to — NOT a customer, NOT an order UI (see phase brief §7). */
export type Destination = {
  id: string;
  /** Optional link to the project's real recipe/order data — never a parallel catalog. */
  recipeId?: string;
  name: string;
  requiredIngredients: DestinationIngredientRequirement[];
};

export type DestinationRequirementState = DestinationIngredientRequirement & {
  satisfied: boolean;
  /** The output id currently covering this requirement, if any — informational only, since satisfaction is existence-based, not exclusive-claim-based. */
  satisfiedBy: string | null;
};

export type DestinationState = {
  destinationId: string;
  requirements: DestinationRequirementState[];
  complete: boolean;
};

/**
 * The whole runtime session. Deliberately NOT part of SaveData — this is
 * temporary preparation-session state (§18), gone the moment the player
 * leaves the session, same as `PreparationScene`'s own in-memory cut/piece
 * state already is.
 */
export type OrganizationSession = {
  outputs: PreparedOutput[];
  destinations: Destination[];
};
