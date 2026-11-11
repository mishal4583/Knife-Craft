/**
 * WHERE THE LIQUID IS in a vessel (pure numbers; the picture is SauceParts.tsx `Vessel`).
 */
/**
 * The OPENING of each vessel as an ellipse, a share of its 540 x 312 picture (measured on the built masks, which are ellipses): centre and radii.
 * The liquid is this ellipse moved DOWN by how deep the surface is, seen through the opening (the mask): that is exactly what the eye sees in a round
 * pot from the front and above: the surface is an ellipse, its back edge meets the back wall, and the front rim hides the rest (developer 2026-11-11: "the
 * liquid inside the pot is not fitting correctly and it looks unrealistic": it was a flat horizontal slab cut by the mask).
 */
const OPENING = {
  bowl: { cx: 0.5, cy: 0.3654, rx: 0.461, ry: 0.218 },
  pan: { cx: 0.41, cy: 0.383, rx: 0.349, ry: 0.155 },
} as const;
/** How far the surface sits below the rim when full, and how far down the pot's floor is (in opening heights, 2 * ry). */
const FULL_DROP = 0.08;
const FLOOR_DROP = 0.78;
/** The walls narrow toward the floor: the surface ellipse is this much narrower when nearly empty. */
const TAPER = 0.1;

/** Where the liquid's surface ellipse is for a fill `level` (0..1): its box, and the part of the opening it shows (for chunks), all as shares of the picture. */
export function surfaceOf(kind: "bowl" | "pan", level: number) {
  const o = OPENING[kind];
  const l = Math.min(1, Math.max(0, level));
  const drop = (FULL_DROP + (1 - l) * (FLOOR_DROP - FULL_DROP)) * 2 * o.ry;
  const w = o.rx * (1 - TAPER * (1 - l));
  const top = o.cy - o.ry + drop;
  const visTop = Math.max(top, o.cy - o.ry);
  const visBottom = o.cy + o.ry * 0.85;
  return { left: o.cx - w, top, width: 2 * w, height: 2 * o.ry, visTop, visBottom };
}
