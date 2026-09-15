/**
 * STRAWBERRY_SHAPE — the strawberry's silhouette + seed layout, ported
 * faithfully from a reference art batch as an explicit vertex polygon
 * (a heart/conical taper with a scalloped leafy-crown notch at top).
 * See mushroomShape.ts's own doc for the "polygon" IngredientShape.
 */
export type Pt = { x: number; y: number };

const TOP = -58;
const BOTTOM = 86;
const MAX_HW = 62;

function noise(t: number, seed = 1): number {
  return (
    0.6 * Math.sin(t * 2.7 + seed * 12.9898) +
    0.3 * Math.sin(t * 5.3 + seed * 78.233) +
    0.1 * Math.sin(t * 11.1 + seed * 39.425)
  );
}

export function strawberryHalfWidth(v: number): number {
  return (
    MAX_HW * Math.sin(Math.PI * (0.3 + 0.6 * v)) * (1 - Math.pow(v, 2.6)) + 1.2 * noise(v * 4, 5)
  );
}

function strawberrySilhouette(): Pt[] {
  const right: Pt[] = [];
  const left: Pt[] = [];
  const steps = 46;
  for (let i = 0; i <= steps; i++) {
    const v = i / steps;
    const y = TOP + (BOTTOM - TOP) * v;
    const hw = Math.max(0, strawberryHalfWidth(v));
    const lean = 2.5 * Math.sin(v * 2.2);
    right.push({ x: lean + hw, y });
    left.push({ x: lean - hw * 1.02, y });
  }
  const top: Pt[] = [];
  const tSteps = 28;
  const w0 = right[0]!.x;
  for (let i = 0; i <= tSteps; i++) {
    const t = i / tSteps; // left -> right
    const x = -w0 + 2 * w0 * t;
    const dome = -14 * Math.sin(Math.PI * t);
    const dip = 8 * Math.exp(-Math.pow((t - 0.5) / 0.18, 2));
    top.push({ x, y: TOP + dome + dip });
  }
  return [...top, ...right.slice(1), ...left.slice(1).reverse()];
}

export const STRAWBERRY_SIL: Pt[] = strawberrySilhouette();

/** Seeds spiral along the fruit's curvature, never a grid. */
function strawberrySeedPositions(): { x: number; y: number; a: number }[] {
  const out: { x: number; y: number; a: number }[] = [];
  const rows = 9;
  for (let r = 0; r < rows; r++) {
    const v = 0.08 + (r / (rows - 1)) * 0.84;
    const hw = strawberryHalfWidth(v);
    const count = Math.max(2, Math.round(hw / 13));
    for (let c = 0; c < count; c++) {
      const off = (r % 2 ? 0.5 : 0) + c;
      const u = count === 1 ? 0.5 : off / count;
      const px = (u * 2 - 1) * hw * 0.78 + 2 * noise(r * 3 + c, 6);
      out.push({ x: px, y: TOP + (BOTTOM - TOP) * v, a: (px / Math.max(1, hw)) * 0.5 });
    }
  }
  return out;
}

export const STRAWBERRY_SEEDS = strawberrySeedPositions();
export const STRAWBERRY_TOP = TOP;
export const STRAWBERRY_BOTTOM = BOTTOM;
export const STRAWBERRY_MAX_HW = MAX_HW;
export const STRAWBERRY_WIDTH = 2 * MAX_HW;
export const STRAWBERRY_HEIGHT = BOTTOM - TOP;
export { noise as strawberryNoise };
