/**
 * The chef's-knife silhouette in its own local space — the ONE geometry the
 * real knife (PreparationScene.drawKnife) and the coaching ghost
 * (coachGhost.ts) are both drawn from. Local x runs heel → tip; local y = 0
 * is the cutting edge (what rides the seam), the blade body is above it
 * (negative y) and the handle sits behind the heel (x < heel).
 */
import type { KnifeBladeShape } from "../knives/knifeTypes";

export type Pt = { x: number; y: number };

/** A short quadratic-bezier polyline — Phaser Graphics has no native curveTo, so the blade's curved edge is sampled. */
export function quadraticPoints(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  steps: number,
): Pt[] {
  const pts: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
      y: mt * mt * y0 + 2 * mt * t * cy + t * t * y1,
    });
  }
  return pts;
}

export type KnifeProfile = {
  bladeLen: number;
  bladeH: number;
  handleLen: number;
  heel: number;
  spineBend: number;
  spineControlX: number;
  tip: number;
  bellyControlX: number;
  /** Half the blade height: the shift that puts the cutting edge on local y = 0. */
  edge: number;
  /** Closed blade outline: heel → straight spine → curve to the tip → curved edge back to the heel. */
  outline: Pt[];
  /** The cutting edge alone, heel → tip. */
  cuttingEdge: Pt[];
};

/** `width` = the scene width the blade fractions are measured against. */
export function knifeProfile(shape: KnifeBladeShape, width: number): KnifeProfile {
  const bladeLen = shape.bladeLenFrac * width;
  const bladeH = shape.bladeHFrac * width;
  const handleLen = shape.handleLenFrac * width;
  const heel = shape.heelAt * bladeLen;
  const spineBend = shape.spineBendFrac * bladeLen;
  const spineControlX = shape.spineControlXFrac * bladeLen;
  const tip = shape.tipFrac * bladeLen;
  const bellyControlX = shape.bellyControlXFrac * bladeLen;
  const edge = bladeH * 0.5;
  const tipY = bladeH * shape.tipRiseFrac - edge;
  const spine = quadraticPoints(
    spineBend,
    -bladeH * 0.4 - edge,
    spineControlX,
    -bladeH * 0.4 - edge,
    tip,
    tipY,
    6,
  );
  const belly = quadraticPoints(
    tip,
    tipY,
    bellyControlX,
    bladeH * shape.bellyFrac - edge,
    heel,
    bladeH * 0.5 - edge,
    6,
  );
  return {
    bladeLen,
    bladeH,
    handleLen,
    heel,
    spineBend,
    spineControlX,
    tip,
    bellyControlX,
    edge,
    outline: [
      { x: heel, y: -bladeH * 0.5 - edge },
      { x: spineBend, y: -bladeH * 0.5 - edge },
      ...spine,
      ...belly,
    ],
    cuttingEdge: [{ x: tip, y: tipY }, ...belly].reverse(),
  };
}
