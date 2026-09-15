/**
 * APPLE_SHAPE — the apple's silhouette, ported faithfully from a
 * reference art batch as an explicit vertex polygon (two upper lobes
 * with a central stem depression, a calyx dimple at the base). See
 * mushroomShape.ts's own doc for the "polygon" IngredientShape.
 */
export type Pt = { x: number; y: number };

const TOP = -68;
const BOTTOM = 74;
const MAX_HW = 78;

function noise(t: number, seed = 1): number {
  return (
    0.6 * Math.sin(t * 2.7 + seed * 12.9898) +
    0.3 * Math.sin(t * 5.3 + seed * 78.233) +
    0.1 * Math.sin(t * 11.1 + seed * 39.425)
  );
}

export function appleHalfWidth(v: number): number {
  const body = Math.sin(Math.PI * (0.26 + 0.6 * v));
  const round = Math.pow(1 - Math.pow(v, 7), 0.34);
  return MAX_HW * body * round * (1 - 0.1 * v) + 1.4 * noise(v * 3.4, 13);
}

function appleSilhouette(): Pt[] {
  const right: Pt[] = [];
  const left: Pt[] = [];
  const steps = 46;
  for (let i = 0; i <= steps; i++) {
    const v = i / steps;
    const y = TOP + (BOTTOM - TOP) * v;
    const hw = Math.max(0, appleHalfWidth(v));
    right.push({ x: hw + 1.5 * Math.sin(v * 2.4), y });
    left.push({ x: -hw * 1.03 + 1.5 * Math.sin(v * 2.4), y });
  }
  // two upper lobes with a central stem depression
  const top: Pt[] = [];
  const tSteps = 34;
  const w0 = right[0]!.x;
  for (let i = 0; i <= tSteps; i++) {
    const t = i / tSteps;
    const x = -w0 + 2 * w0 * t;
    const dome = -18 * Math.sin(Math.PI * t);
    const dip = 17 * Math.exp(-Math.pow((t - 0.5) / 0.15, 2));
    top.push({ x, y: TOP + dome + dip + 1.2 * noise(t * 4, 17) });
  }
  // calyx dimple at the base
  const bottom: Pt[] = [];
  const bSteps = 26;
  const wN = right[right.length - 1]!.x;
  for (let i = 0; i <= bSteps; i++) {
    const t = i / bSteps;
    const x = wN - 2 * wN * t;
    bottom.push({
      x,
      y: BOTTOM + 9 * Math.sin(Math.PI * t) - 5 * Math.exp(-Math.pow((t - 0.5) / 0.14, 2)),
    });
  }
  return [...top, ...right.slice(1, -1), ...bottom, ...left.slice(1, -1).reverse()];
}

export const APPLE_SIL: Pt[] = appleSilhouette();
export const APPLE_TOP = TOP;
export const APPLE_BOTTOM = BOTTOM;
export const APPLE_MAX_HW = MAX_HW;
export const APPLE_WIDTH = 2 * MAX_HW;
export const APPLE_HEIGHT = BOTTOM - TOP;
export { noise as appleNoise };
