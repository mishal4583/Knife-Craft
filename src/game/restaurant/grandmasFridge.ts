/**
 * Legacy save compatibility for the retired Grandma's ingredients feature.
 * New games never receive free ingredients; every service stock check starts
 * at Level 3 and missing ingredients are bought in the Market.
 *
 * These types and read-only helpers remain so older saves and maintenance
 * tooling can still inspect the legacy field. The former grant and tutorial
 * APIs are deliberate no-ops.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import type { LevelDefinition } from "../levels/levelTypes";

export type LeftoverLine = { ingredientId: IngredientId; quantity: number };

/** Stored only in older saves; it is never created by current game logic. */
export type GrandmasFridgeState = {
  atLevel: number;
  lines: LeftoverLine[];
};

export type FridgeRow = {
  ingredientId: IngredientId;
  need: number;
  usable: number;
  missing: number;
  buyUnits: number;
  cost: number;
};

/** Legacy tutorial shape; current progression no longer creates this note. */
export type GrandmasFridgeNote = {
  stage: "low" | "top-up" | "preview";
  levels: number[];
  rows: FridgeRow[];
  shortRows: FridgeRow[];
  topUpCost: number;
  affordable: boolean;
  spare: { ingredientId: IngredientId; usable: number }[];
};

/** Return the legacy record when an older save contains it. */
export function grandmasFridgeOf(save: SaveData): GrandmasFridgeState | null {
  return save.business.grandmasFridge ?? null;
}

/** There are no free ingredient leftovers in the current progression. */
export function leftoversFor(_save: SaveData): LeftoverLine[] {
  return [];
}

/** Legacy API retained as a no-op; ingredients must be purchased by the player. */
export function giveGrandmasLeftovers(save: SaveData): SaveData {
  return save;
}

/** The old Level 12–14 fridge tutorial has been retired. */
export function grandmasFridgeNoteFor(
  _save: SaveData,
  _level: LevelDefinition,
  _n: number,
): GrandmasFridgeNote | null {
  return null;
}
