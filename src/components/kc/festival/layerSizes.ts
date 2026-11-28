import type { Look, Shape } from "./foodLooks";

/**
 * How tall a drawn layer is in the plate's 400-wide square, and how far it raises what is stacked on it (the painted layers' sizes are
 * festivalArt.ts LAYERS).
 */
const BASES: Partial<Record<Shape, { height: number; thick: number }>> = {
  flat: { height: 196, thick: 22 },
  slice: { height: 196, thick: 38 },
  plate: { height: 196, thick: 20 },
  bowl: { height: 224, thick: 52 },
  board: { height: 170, thick: 18 },
};
const FLAT: ReadonlySet<Shape> = new Set<Shape>([
  "rounds",
  "rings",
  "leaves",
  "shreds",
  "beads",
  "crumbs",
  "bottle",
]);

export const isBaseShape = (shape: Shape) => shape in BASES;

export const layerSize = (look: Look): { height: number; thick: number } =>
  BASES[look.shape] ??
  (FLAT.has(look.shape) ? { height: 150, thick: 15 } : { height: 160, thick: 34 });
