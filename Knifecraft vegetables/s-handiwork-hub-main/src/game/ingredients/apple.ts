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

const TOP = -68;
const BOTTOM = 74;
const MAX_HW = 78;

function halfWidth(v: number): number {
  const body = Math.sin(Math.PI * (0.26 + 0.6 * v));
  const round = Math.pow(1 - Math.pow(v, 7), 0.34);
  return MAX_HW * body * round * (1 - 0.1 * v) + 1.4 * noise(v * 3.4, 13);
}

function silhouette(): Pt[] {
  const right: Pt[] = [];
  const left: Pt[] = [];
  const steps = 46;
  for (let i = 0; i <= steps; i++) {
    const v = i / steps;
    const y = TOP + (BOTTOM - TOP) * v;
    const hw = Math.max(0, halfWidth(v));
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

const SIL = silhouette();

export const appleVisual: IngredientVisualDefinition = {
  id: "apple",
  label: "Apple",
  width: 2 * MAX_HW,
  height: BOTTOM - TOP,

  drawWhole(g, x, y, s) {
    groundShadow(g, x, y + BOTTOM * s, MAX_HW * 0.74 * s, 12 * s);

    fillPoly(g, place(SIL, x, y, s), PAL.apple);
    fillPoly(g, place(shrinkToward(SIL, 48, 44, 0.07), x, y, s), PAL.appleDark, 0.34);
    fillPoly(g, place(shrinkToward(SIL, -34, -28, 0.3), x, y, s), PAL.appleLight, 0.38);
    fillPoly(g, place(shrinkToward(SIL, -22, 30, 0.55), x, y, s), PAL.appleBlush, 0.18);
    strokePoly(g, place(SIL, x, y, s), PAL.appleDark, 2.2 * s, 0.5);

    // vertical tonal streaks
    for (let i = -3; i <= 3; i++) {
      const seg: Pt[] = [];
      for (let k = 0; k <= 12; k++) {
        const v = 0.12 + 0.74 * (k / 12);
        seg.push({ x: i * 15 * (0.4 + 0.9 * Math.sin(Math.PI * v)), y: TOP + (BOTTOM - TOP) * v });
      }
      strokePoly(
        g,
        place(seg, x, y, s),
        i < 0 ? PAL.appleLight : PAL.appleDark,
        3 * s,
        0.14,
        false,
      );
    }
    // skin speckles
    for (let i = 0; i < 22; i++) {
      const v = 0.12 + 0.76 * ((i * 0.37) % 1);
      const hw = halfWidth(v);
      const px = ((noise(i, 21) + 1) / 2) * 1.7 * hw - hw * 0.85;
      g.fillStyle(PAL.appleBlush, 0.3);
      g.fillEllipse(x + px * s, y + (TOP + (BOTTOM - TOP) * v) * s, 2.4 * s, 2.4 * s);
    }

    softHighlight(g, x - 30 * s, y - 26 * s, 34 * s, 40 * s, 0xfff4e2, 0.6, -0.4);

    // stem cavity + stem
    g.fillStyle(PAL.appleDark, 0.4);
    g.fillEllipse(x - 1 * s, y + (TOP + 12) * s, 34 * s, 12 * s);
    strokePoly(
      g,
      place(
        [
          { x: 0, y: TOP + 12 },
          { x: 3, y: TOP - 4 },
          { x: 1, y: TOP - 22 },
        ],
        x,
        y,
        s,
      ),
      PAL.stemWood,
      5 * s,
      1,
      false,
    );
  },

  drawCrossSection(g, x, y, s) {
    fillPoly(g, place(SIL, x, y, s), PAL.appleFlesh);
    strokePoly(g, place(SIL, x, y, s), PAL.apple, 6 * s, 0.95);
    strokePoly(g, place(shrinkToward(SIL, 0, 0, 0.06), x, y, s), PAL.appleCore, 2 * s, 0.5);

    // core: the classic apple hourglass
    const core: Pt[] = [];
    for (let i = 0; i <= 24; i++) {
      const v = i / 24;
      const w = 6 + 20 * Math.pow(Math.sin(Math.PI * v), 2.2);
      core.push({ x: w, y: TOP + 14 + (BOTTOM - TOP - 26) * v });
    }
    for (let i = 24; i >= 0; i--) {
      const v = i / 24;
      const w = 6 + 20 * Math.pow(Math.sin(Math.PI * v), 2.2);
      core.push({ x: -w, y: TOP + 14 + (BOTTOM - TOP - 26) * v });
    }
    fillPoly(g, place(core, x, y, s), PAL.appleCore, 0.75);
    strokePoly(g, place(core, x, y, s), 0xc9b184, 1.6 * s, 0.7);

    // seed pockets
    for (const [sx, sy, rot] of [
      [-13, 4, -0.5],
      [13, 4, 0.5],
      [0, 22, 0],
    ] as const) {
      g.save();
      g.translateCanvas(x + sx * s, y + sy * s);
      g.rotateCanvas(rot);
      g.fillStyle(PAL.appleSeed, 1);
      g.fillEllipse(0, 0, 9 * s, 13 * s);
      g.fillStyle(0x8a5b36, 0.6);
      g.fillEllipse(-1.5 * s, -2 * s, 4 * s, 6 * s);
      g.restore();
    }

    // flesh grain
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      strokePoly(
        g,
        place(
          [
            { x: Math.cos(a) * 30, y: 6 + Math.sin(a) * 26 },
            { x: Math.cos(a) * 62, y: 6 + Math.sin(a) * 54 },
          ],
          x,
          y,
          s,
        ),
        PAL.appleCore,
        1.4 * s,
        0.35,
        false,
      );
    }
    strokePoly(
      g,
      place(
        [
          { x: 0, y: TOP + 14 },
          { x: 2, y: TOP - 16 },
        ],
        x,
        y,
        s,
      ),
      PAL.stemWood,
      4 * s,
      1,
      false,
    );
  },

  getSilhouette() {
    return { outline: SIL };
  },

  getVisualBounds() {
    return boundsOf(SIL);
  },
};
