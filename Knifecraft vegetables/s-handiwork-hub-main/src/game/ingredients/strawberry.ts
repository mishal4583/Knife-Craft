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

const TOP = -58;
const BOTTOM = 86;
const MAX_HW = 62;

function halfWidth(v: number): number {
  return (
    MAX_HW * Math.sin(Math.PI * (0.3 + 0.6 * v)) * (1 - Math.pow(v, 2.6)) + 1.2 * noise(v * 4, 5)
  );
}

function silhouette(): Pt[] {
  const right: Pt[] = [];
  const left: Pt[] = [];
  const steps = 46;
  for (let i = 0; i <= steps; i++) {
    const v = i / steps;
    const y = TOP + (BOTTOM - TOP) * v;
    const hw = Math.max(0, halfWidth(v));
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

const SIL = silhouette();

/** Seeds spiral along the fruit's curvature, never a grid. */
function seedPositions(): { x: number; y: number; a: number }[] {
  const out: { x: number; y: number; a: number }[] = [];
  const rows = 9;
  for (let r = 0; r < rows; r++) {
    const v = 0.08 + (r / (rows - 1)) * 0.84;
    const hw = halfWidth(v);
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

const SEEDS = seedPositions();

export const strawberryVisual: IngredientVisualDefinition = {
  id: "strawberry",
  label: "Strawberry",
  width: 2 * MAX_HW,
  height: BOTTOM - TOP,

  drawWhole(g, x, y, s) {
    groundShadow(g, x, y + BOTTOM * s * 0.96, MAX_HW * 0.6 * s, 10 * s);

    fillPoly(g, place(SIL, x, y, s), PAL.strawberry);
    fillPoly(g, place(shrinkToward(SIL, 40, 46, 0.08), x, y, s), PAL.strawberryDark, 0.32);
    fillPoly(g, place(shrinkToward(SIL, -30, -26, 0.36), x, y, s), PAL.strawberryLight, 0.4);
    strokePoly(g, place(SIL, x, y, s), PAL.strawberryDark, 2.2 * s, 0.5);

    // seeds sit in shallow dimples
    for (const sd of SEEDS) {
      g.fillStyle(PAL.strawberryDark, 0.4);
      g.fillEllipse(x + (sd.x + 1) * s, y + (sd.y + 1.6) * s, 8 * s, 6 * s);
      g.save();
      g.translateCanvas(x + sd.x * s, y + sd.y * s);
      g.rotateCanvas(sd.a);
      g.fillStyle(PAL.strawberrySeed, 0.95);
      g.fillEllipse(0, 0, 4.6 * s, 3.2 * s);
      g.restore();
    }

    softHighlight(g, x - 24 * s, y - 22 * s, 26 * s, 40 * s, 0xfff2e6, 0.5, -0.35);
    softHighlight(g, x + 18 * s, y + 34 * s, 10 * s, 22 * s, 0xffd8cc, 0.25, 0.3);

    // leafy crown
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.46;
      const len = 40 + 8 * noise(i, 8);
      const leaf: Pt[] = [
        { x: 0, y: TOP - 2 },
        { x: Math.cos(a - 0.16) * len * 0.6, y: TOP + Math.sin(a - 0.16) * len * 0.6 },
        { x: Math.cos(a) * len, y: TOP + Math.sin(a) * len },
        { x: Math.cos(a + 0.16) * len * 0.6, y: TOP + Math.sin(a + 0.16) * len * 0.6 },
      ];
      fillPoly(g, place(leaf, x, y, s), i % 2 ? PAL.leafDark : PAL.leaf);
    }
    fillPoly(
      g,
      place(
        [
          { x: -3, y: TOP - 20 },
          { x: 3, y: TOP - 20 },
          { x: 2, y: TOP - 40 },
          { x: -3, y: TOP - 38 },
        ],
        x,
        y,
        s,
      ),
      PAL.leafDark,
    );
    g.fillStyle(PAL.leaf, 0.9);
    g.fillEllipse(x, y + (TOP - 4) * s, 22 * s, 12 * s);
  },

  drawCrossSection(g, x, y, s) {
    fillPoly(g, place(SIL, x, y, s), PAL.strawberryFlesh);
    strokePoly(g, place(SIL, x, y, s), PAL.strawberry, 5 * s, 0.95);
    // pale fibrous core
    const core: Pt[] = [];
    for (let i = 0; i <= 20; i++) {
      const v = i / 20;
      core.push({
        x: 12 * Math.sin(Math.PI * v) * (1 - v * 0.7),
        y: TOP + 10 + (BOTTOM - TOP - 16) * v,
      });
    }
    for (let i = 20; i >= 0; i--) {
      const v = i / 20;
      core.push({
        x: -12 * Math.sin(Math.PI * v) * (1 - v * 0.7),
        y: TOP + 10 + (BOTTOM - TOP - 16) * v,
      });
    }
    fillPoly(g, place(core, x, y, s), PAL.strawberryCore, 0.9);
    // radiating flesh fibres
    for (let i = 0; i < 16; i++) {
      const v = 0.1 + 0.8 * (i / 15);
      const hw = halfWidth(v);
      const yy = TOP + (BOTTOM - TOP) * v;
      const dir = i % 2 ? 1 : -1;
      strokePoly(
        g,
        place(
          [
            { x: dir * 6, y: yy },
            { x: dir * hw * 0.85, y: yy - 4 },
          ],
          x,
          y,
          s,
        ),
        PAL.strawberry,
        1.2 * s,
        0.28,
        false,
      );
    }
    // surface dimples showing at the rim
    for (const sd of SEEDS) {
      const hw = Math.max(1, halfWidth((sd.y - TOP) / (BOTTOM - TOP)));
      if (Math.abs(sd.x) < hw * 0.62) continue;
      g.fillStyle(PAL.strawberrySeed, 0.6);
      g.fillEllipse(x + sd.x * 0.98 * s, y + sd.y * s, 3.4 * s, 2.6 * s);
    }
  },

  getSilhouette() {
    return { outline: SIL };
  },

  getVisualBounds() {
    return boundsOf(SIL);
  },
};
