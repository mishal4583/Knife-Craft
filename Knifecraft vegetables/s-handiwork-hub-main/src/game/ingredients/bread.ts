import { PAL } from "./palette";
import {
  boundsOf,
  fillPoly,
  groundShadow,
  noise,
  place,
  shrinkToward,
  softHighlight,
  strokePoly,
} from "./shapeUtils";
import type { IngredientVisualDefinition, Pt } from "./types";

const TOP = -76;
const BOTTOM = 68;
const MAX_HW = 78;

/** Classic pain-de-mie slice: domed top, straight-ish flanks, flat base. */
function silhouette(): Pt[] {
  const pts: Pt[] = [];
  const arch: Pt[] = [];
  const aSteps = 60;
  for (let i = 0; i <= aSteps; i++) {
    const t = i / aSteps; // left -> right
    const x = -MAX_HW + 2 * MAX_HW * t;
    const u = Math.abs(x) / MAX_HW;
    // dome plus two soft oven-spring bumps
    const dome = -Math.pow(Math.max(0, 1 - Math.pow(u, 2.4)), 0.55) * 42;
    const bumps =
      -5 * Math.exp(-Math.pow((t - 0.32) / 0.13, 2)) -
      4 * Math.exp(-Math.pow((t - 0.68) / 0.14, 2));
    arch.push({ x, y: -28 + dome + bumps + 1.4 * noise(t * 5, 23) });
  }
  const rightSide: Pt[] = [];
  for (let i = 0; i <= 18; i++) {
    const v = i / 18;
    const y = -28 + (BOTTOM - 14 - -28) * v;
    rightSide.push({ x: MAX_HW * (1 + 0.03 * Math.sin(Math.PI * v)) - 1.5 * v * v * 6, y });
  }
  const bottom: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = rightSide[rightSide.length - 1]!.x - 2 * rightSide[rightSide.length - 1]!.x * t;
    const u = Math.abs(x) / MAX_HW;
    const corner = u > 0.84 ? (1 - Math.pow((u - 0.84) / 0.16, 2)) * 14 : 14;
    bottom.push({ x, y: BOTTOM - 14 + corner + 1.2 * noise(t * 4, 31) });
  }
  const leftSide: Pt[] = [];
  for (let i = 18; i >= 0; i--) {
    const v = i / 18;
    const y = -28 + (BOTTOM - 14 - -28) * v;
    leftSide.push({ x: -MAX_HW * (1 + 0.03 * Math.sin(Math.PI * v)) + 1.5 * v * v * 6, y });
  }
  pts.push(...arch, ...rightSide, ...bottom, ...leftSide);
  return pts;
}

const SIL = silhouette();
const CRUMB = shrinkToward(SIL, 0, 6, 0.13);

const HOLES = Array.from({ length: 26 }, (_, i) => ({
  x: noise(i * 1.7, 41) * 58,
  y: noise(i * 2.3, 47) * 46 + 4,
  r: 2.2 + Math.abs(noise(i, 53)) * 4.4,
}));

export const breadVisual: IngredientVisualDefinition = {
  id: "bread",
  label: "Bread",
  width: 2 * MAX_HW,
  height: BOTTOM - TOP,

  drawWhole(g, x, y, s) {
    groundShadow(g, x, y + BOTTOM * s, MAX_HW * 0.8 * s, 10 * s);

    // crust
    fillPoly(g, place(SIL, x, y, s), PAL.crust);
    fillPoly(g, place(shrinkToward(SIL, 40, 40, 0.05), x, y, s), PAL.crustDark, 0.3);
    fillPoly(g, place(shrinkToward(SIL, -40, -40, 0.06), x, y, s), PAL.crustLight, 0.4);
    strokePoly(g, place(SIL, x, y, s), PAL.crustDark, 2.6 * s, 0.6);

    // crumb face
    fillPoly(g, place(CRUMB, x, y, s), PAL.crumb);
    fillPoly(g, place(shrinkToward(CRUMB, -30, -30, 0.3), x, y, s), PAL.crumbLight, 0.55);
    fillPoly(g, place(shrinkToward(CRUMB, 40, 44, 0.12), x, y, s), PAL.crumbHole, 0.2);
    strokePoly(g, place(CRUMB, x, y, s), PAL.crustLight, 2 * s, 0.5);

    // porous crumb
    for (const h of HOLES) {
      g.fillStyle(PAL.crumbHole, 0.55);
      g.fillEllipse(x + h.x * s, y + h.y * s, h.r * 2 * s, h.r * 1.7 * s);
      g.fillStyle(PAL.crumbLight, 0.5);
      g.fillEllipse(x + (h.x - h.r * 0.3) * s, y + (h.y - h.r * 0.4) * s, h.r * s, h.r * 0.8 * s);
    }

    // baked spots on the crust dome
    for (let i = 0; i < 8; i++) {
      const t = 0.12 + 0.76 * (i / 7);
      const px = -MAX_HW * 0.92 + 2 * MAX_HW * 0.92 * t;
      const u = Math.abs(px) / MAX_HW;
      const py = -28 - Math.pow(Math.max(0, 1 - Math.pow(u, 2.4)), 0.55) * 42 + 7;
      g.fillStyle(PAL.crustDark, 0.22);
      g.fillEllipse(x + px * s, y + py * s, 14 * s, 6 * s);
    }

    softHighlight(g, x - 34 * s, y - 52 * s, 34 * s, 14 * s, 0xfff3d8, 0.5, -0.28);
  },

  drawCrossSection(g, x, y, s) {
    fillPoly(g, place(SIL, x, y, s), PAL.crust);
    strokePoly(g, place(SIL, x, y, s), PAL.crustDark, 3 * s, 0.7);
    fillPoly(g, place(shrinkToward(SIL, 0, 6, 0.09), x, y, s), PAL.crumbLight);
    fillPoly(g, place(shrinkToward(SIL, 42, 42, 0.16), x, y, s), PAL.crumb, 0.5);
    for (const h of HOLES) {
      g.fillStyle(PAL.crumbHole, 0.7);
      g.fillEllipse(x + h.x * 1.02 * s, y + h.y * s, h.r * 2.3 * s, h.r * 2 * s);
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle(PAL.crumbHole, 0.35);
      g.fillEllipse(
        x + noise(i * 3.1, 61) * 62 * s,
        y + (noise(i * 1.3, 67) * 48 + 6) * s,
        3 * s,
        2.4 * s,
      );
    }
    softHighlight(g, x - 30 * s, y - 34 * s, 34 * s, 20 * s, 0xffffff, 0.3, -0.3);
  },

  getSilhouette() {
    return { outline: SIL };
  },

  getVisualBounds() {
    return boundsOf(SIL);
  },
};
