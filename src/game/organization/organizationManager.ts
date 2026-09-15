/**
 * ORGANIZATION_MANAGER — pure logic over Mise en Place sessions, mirroring
 * KnifeManager.ts/BoardManager.ts's own style: every function takes an
 * `OrganizationSession` snapshot and returns a new one (or a derived
 * read-only value) — never mutates in place, no I/O, no React, no Phaser.
 *
 *   PreparationScene (existing cutting engine, untouched)
 *        ↓ (a future caller, not this phase — see phase report)
 *   createPreparedOutput
 *        ↓
 *   OrganizationSession.outputs
 *        ↓
 *   assignOutput → Destination requirements
 *        ↓
 *   isDestinationComplete / areAllDestinationsComplete
 *        ↓
 *   existing recipe completion / plating / RECIPE_COMPLETED (untouched)
 */
import type {
  Destination,
  DestinationRequirementState,
  DestinationState,
  OrganizationSession,
  PreparedOutput,
} from "./organizationTypes";
import type { IngredientId } from "../definitions";
import type { QualityLabel } from "@/types/game";

/** A fresh session for a given set of destinations (a level's future destination list) — the starting point every preparation session begins from. */
export function createOrganizationSession(destinations: Destination[] = []): OrganizationSession {
  return { outputs: [], destinations };
}

/** Clears every temporary prepared output — the destinations themselves stay (they're the level's own data, not session progress). Nothing here touches SaveData; this is runtime-only state (§18). */
export function resetOrganization(session: OrganizationSession): OrganizationSession {
  return { ...session, outputs: [] };
}

export type CreatePreparedOutputInput = {
  ingredientId: IngredientId;
  preparationState: string;
  quality?: QualityLabel;
  sourceStepId?: string;
};

/**
 * Records "this ingredient has been prepared to this state" as a
 * standalone, shareable batch. Never requires or reads a piece count
 * (§4/§5) — a fully prepared ingredient IS the output, regardless of how
 * many pieces the cutting engine happened to produce.
 */
export function createPreparedOutput(
  session: OrganizationSession,
  input: CreatePreparedOutputInput,
): { session: OrganizationSession; output: PreparedOutput } {
  const output: PreparedOutput = {
    id: `output-${session.outputs.length}-${input.ingredientId}-${input.preparationState}`,
    ingredientId: input.ingredientId,
    preparationState: input.preparationState,
    ...(input.quality !== undefined ? { quality: input.quality } : {}),
    ...(input.sourceStepId !== undefined ? { sourceStepId: input.sourceStepId } : {}),
    assignedTo: [],
  };
  return { session: { ...session, outputs: [...session.outputs, output] }, output };
}

/**
 * Assigns an output to a destination — additive, not exclusive. Assigning
 * the SAME output to a second destination never removes it from the
 * first (§10 "one ingredient, multiple destinations"); idempotent if
 * already assigned there. Unknown output/destination ids are a silent
 * no-op — never a thrown error (§3 "no failure state").
 */
export function assignOutput(
  session: OrganizationSession,
  outputId: string,
  destinationId: string,
): OrganizationSession {
  return {
    ...session,
    outputs: session.outputs.map((o) =>
      o.id === outputId && !o.assignedTo.includes(destinationId)
        ? { ...o, assignedTo: [...o.assignedTo, destinationId] }
        : o,
    ),
  };
}

/** Removes one destination's claim on an output — the output itself stays (§32 "reassign output" stays possible; unassigning never deletes the prepared batch). */
export function unassignOutput(
  session: OrganizationSession,
  outputId: string,
  destinationId: string,
): OrganizationSession {
  return {
    ...session,
    outputs: session.outputs.map((o) =>
      o.id === outputId
        ? { ...o, assignedTo: o.assignedTo.filter((id) => id !== destinationId) }
        : o,
    ),
  };
}

/** Surplus — outputs not yet assigned to anything. Never deleted, never punished (§11); simply what's left in the batch. */
export function getAvailableOutputs(session: OrganizationSession): PreparedOutput[] {
  return session.outputs.filter((o) => o.assignedTo.length === 0);
}

function requirementSatisfied(
  session: OrganizationSession,
  destinationId: string,
  ingredientId: IngredientId,
  preparationState: string,
): string | null {
  const match = session.outputs.find(
    (o) =>
      o.ingredientId === ingredientId &&
      o.preparationState === preparationState &&
      o.assignedTo.includes(destinationId),
  );
  return match?.id ?? null;
}

/** The live state of one destination's requirements — never throws for a missing destination; returns an empty/incomplete state instead (§3 "no failure state"). */
export function getDestinationState(
  session: OrganizationSession,
  destinationId: string,
): DestinationState {
  const destination = session.destinations.find((d) => d.id === destinationId);
  const requirements: DestinationRequirementState[] = (destination?.requiredIngredients ?? []).map(
    (req) => {
      const satisfiedBy = requirementSatisfied(
        session,
        destinationId,
        req.ingredientId,
        req.preparationState,
      );
      return { ...req, satisfied: satisfiedBy !== null, satisfiedBy };
    },
  );
  return {
    destinationId,
    requirements,
    complete: requirements.length > 0 && requirements.every((r) => r.satisfied),
  };
}

export function isDestinationComplete(
  session: OrganizationSession,
  destinationId: string,
): boolean {
  return getDestinationState(session, destinationId).complete;
}

/** True only once every destination in the session is complete — an EMPTY destination list is deliberately NOT "all complete" (there's nothing to organize yet). */
export function areAllDestinationsComplete(session: OrganizationSession): boolean {
  return (
    session.destinations.length > 0 &&
    session.destinations.every((d) => isDestinationComplete(session, d.id))
  );
}
