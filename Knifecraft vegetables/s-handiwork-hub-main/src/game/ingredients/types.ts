import type Phaser from "phaser";

/** A point in the ingredient's local design space (origin = ingredient centre). */
export type Pt = { x: number; y: number };

export type Bounds = { x: number; y: number; width: number; height: number };

/**
 * The cuttable outline of an ingredient.
 * `outline` is a dense, closed, clockwise polygon in local design space —
 * this is the shape CutGeometry should clip against, so the visible art and
 * the cuttable body are always the same silhouette.
 */
export type IngredientSilhouette = {
  /** Closed polygon, local space, centred on (0,0). */
  outline: Pt[];
  /** Optional sub-regions (e.g. mushroom cap vs stem) for smarter piece rules. */
  regions?: { id: string; outline: Pt[] }[];
};

/**
 * One source of truth for how an ingredient looks.
 * Purely visual + geometric: no gameplay, no scoring, no scene knowledge.
 */
export interface IngredientVisualDefinition {
  id: string;
  label: string;
  /** Nominal design size in px at scale = 1. */
  width: number;
  height: number;
  /** Whole, uncut ingredient. */
  drawWhole(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number): void;
  /** Interior face revealed by a cut. */
  drawCrossSection?(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number): void;
  /** Cutting geometry — must match the drawn silhouette. */
  getSilhouette(): IngredientSilhouette;
  getVisualBounds(): Bounds;
}
