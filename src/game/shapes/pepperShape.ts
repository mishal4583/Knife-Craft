/**
 * PEPPER_SHAPE — the bell pepper's silhouette, ported faithfully from a
 * reference art batch (wide shoulders, a tapering body, three hanging
 * lobes at the base) as an explicit vertex polygon. See mushroomShape.ts's
 * own doc for why this is a "polygon" IngredientShape, not the earlier
 * angular-radius-profile "organic" shape.
 */
export type Pt = { x: number; y: number };

const TOP = -62;
const BOTTOM = 72;
const MAX_HW = 78;
const LOBES = 3;

function noise(t: number, seed = 1): number {
  return (
    0.6 * Math.sin(t * 2.7 + seed * 12.9898) +
    0.3 * Math.sin(t * 5.3 + seed * 78.233) +
    0.1 * Math.sin(t * 11.1 + seed * 39.425)
  );
}

/** Wide shoulders, tapering body, three hanging lobes at the base. */
export function pepperHalfWidth(v: number): number {
  const shoulder = Math.sin(Math.PI * (0.3 + 0.44 * v));
  const taper = 1 - 0.24 * Math.pow(v, 2.2);
  return MAX_HW * shoulder * taper + 1.4 * noise(v * 4, 7);
}

function pepperBottomCurve(x: number): number {
  const u = (x + MAX_HW) / (2 * MAX_HW);
  let lift = 0;
  for (let i = 1; i < LOBES; i++) {
    const c = i / LOBES;
    lift = Math.max(lift, Math.exp(-Math.pow((u - c) / 0.11, 2)));
  }
  const dome = Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.5) / 0.5, 2)));
  return BOTTOM * (0.62 + 0.38 * dome) - 20 * lift;
}

function pepperSilhouette(): Pt[] {
  const right: Pt[] = [];
  const left: Pt[] = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const v = i / steps;
    const y = TOP + (BOTTOM * 0.62 - TOP) * v;
    right.push({ x: pepperHalfWidth(v), y });
    left.push({ x: -pepperHalfWidth(v) + 1.2 * noise(v * 3, 11), y });
  }
  const bottom: Pt[] = [];
  const bSteps = 64;
  const endX = right[right.length - 1]!.x;
  for (let i = 0; i <= bSteps; i++) {
    const t = i / bSteps;
    const x = endX - 2 * endX * t;
    bottom.push({ x, y: Math.max(pepperBottomCurve(x), right[right.length - 1]!.y) });
  }
  // top shoulders dipping into the stem cavity
  const top: Pt[] = [];
  const tSteps = 26;
  for (let i = 0; i <= tSteps; i++) {
    const t = i / tSteps; // left -> right
    const x = -right[0]!.x + 2 * right[0]!.x * t;
    const u = Math.abs(x) / right[0]!.x;
    top.push({ x, y: TOP - 12 * (1 - Math.pow(1 - u, 1.6)) + 14 * Math.exp(-Math.pow(x / 20, 2)) });
  }
  return [...top, ...right.slice(1), ...bottom, ...left.slice(1).reverse()];
}

export const PEPPER_SIL: Pt[] = pepperSilhouette();
export const PEPPER_TOP = TOP;
export const PEPPER_BOTTOM = BOTTOM;
export const PEPPER_MAX_HW = MAX_HW;
export const PEPPER_WIDTH = 2 * MAX_HW;
export const PEPPER_HEIGHT = BOTTOM - TOP;
export { noise as pepperNoise };
