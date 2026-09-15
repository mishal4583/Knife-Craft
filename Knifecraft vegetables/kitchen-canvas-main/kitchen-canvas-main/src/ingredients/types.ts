/**
 * Core types for the procedural ingredient system.
 *
 * Separation of concerns (do not blur these):
 *   GEOMETRY -> gameplay silhouette (polygons, used for cutting/clipping)
 *   PAINT    -> purely visual, rendered once into a cached canvas
 *   CUTTING  -> clips the cached paint using geometry-derived pieces
 *
 * All geometry lives in "unit space": a [-1, 1] x [-1, 1] box, y down.
 * The renderer maps unit space onto a cached, supersampled canvas, and the
 * board maps unit space onto screen pixels. Nothing is baked into pixels.
 */

export type Vec = { x: number; y: number };

/** A closed polygon in unit space. */
export type Poly = Vec[];

export type PartKind = "body" | "stem" | "floret" | "pit" | "crust" | "detail" | "leaf";

/** One disconnected (or overlapping) piece of the silhouette. */
export type GeometryPart = {
  id: string;
  kind: PartKind;
  poly: Poly;
  /** Painting order / stacking. Higher paints later. */
  z?: number;
};

export type Geometry = {
  parts: GeometryPart[];
  /** Direction of the ingredient's long axis, radians. Drives slice/julienne. */
  longAxis: number;
  /** true for multi-lobe cluster ingredients (basil, parsley, broccoli). */
  cluster?: boolean;
};

export type Technique =
  | "Slice"
  | "Dice"
  | "Julienne"
  | "Chop"
  | "Halve"
  | "Peel"
  | "Smash"
  | "Rings"
  | "Radial"
  | "Rock Mince"
  | "Chiffonade";

export type IngredientCategory = "Fruit" | "Vegetable" | "Herb" | "Dairy" | "Bakery";

export type SeamColors = {
  /** Colour of the freshly exposed cut edge line. */
  edge: string;
  /** Soft inner glow just behind the cut edge. */
  inner: string;
};

export type PaintCtx = {
  ctx: CanvasRenderingContext2D;
  geometry: Geometry;
  /** Deterministic random in [0,1). */
  rnd: () => number;
  /** One unit-space unit in device px (for hairline widths). */
  unit: number;
};

export type IngredientDefinition = {
  id: string;
  name: string;
  category: IngredientCategory;
  /** Seeded so the same ingredient always looks the same. */
  geometry: (seed: number) => Geometry;
  /** Paints the *whole* ingredient, interior included, into the cache. */
  paint: (p: PaintCtx) => void;
  techniques: Technique[];
  colors: Record<string, string>;
  seamColors: SeamColors;
  seed: number;
  /** Cluster ingredients explode into individual lobes when cut. */
  separateOnCut?: boolean;
  /** Relative on-board size (1 = fills the standard ingredient box). */
  scale?: number;
};
