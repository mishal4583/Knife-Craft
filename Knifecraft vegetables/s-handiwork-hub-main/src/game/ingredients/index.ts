import { appleVisual } from "./apple";
import { bellPepperVisual } from "./bellPepper";
import { breadVisual } from "./bread";
import { mushroomVisual } from "./mushroom";
import { strawberryVisual } from "./strawberry";
import type { IngredientVisualDefinition } from "./types";

export * from "./types";
export * from "./shapeUtils";
export { PAL, LIGHT } from "./palette";
export { appleVisual, bellPepperVisual, breadVisual, mushroomVisual, strawberryVisual };

/** Batch 1 registry — the single lookup the Phaser renderer should use. */
export const INGREDIENT_VISUALS: Record<string, IngredientVisualDefinition> = {
  [mushroomVisual.id]: mushroomVisual,
  [bellPepperVisual.id]: bellPepperVisual,
  [strawberryVisual.id]: strawberryVisual,
  [appleVisual.id]: appleVisual,
  [breadVisual.id]: breadVisual,
};

export const BATCH_1: IngredientVisualDefinition[] = [
  mushroomVisual,
  bellPepperVisual,
  strawberryVisual,
  appleVisual,
  breadVisual,
];

export function getIngredientVisual(id: string): IngredientVisualDefinition | undefined {
  return INGREDIENT_VISUALS[id];
}
