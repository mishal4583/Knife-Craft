/**
 * MUSHROOM_SHAPE — the mushroom's silhouette + named sub-curves, ported
 * faithfully from a reference art batch (an explicit vertex polygon: a
 * broad domed cap, a flattened underside sweeping in, a genuinely
 * narrower and gently-bent stem) instead of derived from a single-center
 * radius function — see ingredientShapes.ts's `makePolygonSilhouette`,
 * the generic "polygon" IngredientShape's first consumer. Kept as close
 * to the reference's own math as possible (same constants, same
 * formulas) rather than reinterpreted, per the correction brief this was
 * built against.
 */
export type Pt = { x: number; y: number };

const CAP_W = 84; // half width
const CAP_TOP = -70;
const CAP_BOTTOM = -4;
const STEM_TOP_W = 26;
const STEM_BOT_W = 34;
const STEM_BOTTOM = 68;

/** Deterministic 1D value noise — same silhouette every run, no Math.random. */
function noise(t: number, seed = 1): number {
  return (
    0.6 * Math.sin(t * 2.7 + seed * 12.9898) +
    0.3 * Math.sin(t * 5.3 + seed * 78.233) +
    0.1 * Math.sin(t * 11.1 + seed * 39.425)
  );
}

/** Cap dome: broad, domed, gently asymmetric, soft shoulders. */
export function mushroomCapTop(): Pt[] {
  const pts: Pt[] = [];
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = -CAP_W + 2 * CAP_W * t;
    const dome = Math.pow(Math.sin(Math.PI * t), 0.62);
    const wobble = 1.6 * noise(t * 3.1, 4) * Math.sin(Math.PI * t);
    // slight lean: right shoulder a touch fuller than the left
    const lean = 3 * Math.sin(Math.PI * t) * (t - 0.5);
    pts.push({ x: x + lean, y: CAP_BOTTOM + (CAP_TOP - CAP_BOTTOM) * dome + wobble });
  }
  return pts;
}

/** Flattened underside of the cap, sweeping in toward the stem. */
export function mushroomCapUnderside(): Pt[] {
  const pts: Pt[] = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // right edge -> left edge
    const x = CAP_W - 2 * CAP_W * t;
    const y = CAP_BOTTOM + 12 * Math.sin(Math.PI * t) + 1.2 * noise(t * 4, 9);
    pts.push({ x, y });
  }
  return pts;
}

export function mushroomStemOutline(): Pt[] {
  const pts: Pt[] = [];
  const steps = 26;
  const bend = (v: number) => 4 * Math.sin(v * 1.4) - 1.5; // organic curvature
  const hw = (v: number) =>
    STEM_TOP_W + (STEM_BOT_W - STEM_TOP_W) * Math.pow(v, 1.7) + noise(v * 5, 2);
  const right: Pt[] = [];
  const left: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const v = i / steps;
    const y = CAP_BOTTOM + 4 + (STEM_BOTTOM - CAP_BOTTOM - 4) * v;
    // round off the foot of the stem
    const round = v > 0.86 ? Math.sqrt(Math.max(0, 1 - Math.pow((v - 0.86) / 0.14, 2))) : 1;
    right.push({ x: bend(v) + hw(v) * round, y });
    left.push({ x: bend(v) - hw(v) * round, y });
  }
  pts.push(...right, ...left.reverse());
  return pts;
}

function mushroomSilhouette(): Pt[] {
  const cap = mushroomCapTop();
  const stem = mushroomStemOutline();
  const half = stem.length / 2;
  const stemRight = stem.slice(0, half);
  const stemLeft = stem.slice(half);
  const under = mushroomCapUnderside();
  const underRight = under.slice(0, Math.floor(under.length * 0.42));
  const underLeft = under.slice(Math.ceil(under.length * 0.58));
  return [...cap, ...underRight, ...stemRight, ...stemLeft, ...underLeft];
}

export const MUSHROOM_SIL: Pt[] = mushroomSilhouette();
export const MUSHROOM_CAP_REGION: Pt[] = [...mushroomCapTop(), ...mushroomCapUnderside()];
export const MUSHROOM_STEM_REGION: Pt[] = mushroomStemOutline();
export const MUSHROOM_CAP_W = CAP_W;
export const MUSHROOM_CAP_TOP = CAP_TOP;
export const MUSHROOM_CAP_BOTTOM = CAP_BOTTOM;
export const MUSHROOM_STEM_TOP_W = STEM_TOP_W;
export const MUSHROOM_STEM_BOT_W = STEM_BOT_W;
export const MUSHROOM_STEM_BOTTOM = STEM_BOTTOM;
export const MUSHROOM_WIDTH = 2 * CAP_W;
export const MUSHROOM_HEIGHT = STEM_BOTTOM - CAP_TOP;
export { noise as mushroomNoise };
