import { PAL } from "./palette";
import {
  boundsOf,
  fillPoly,
  groundShadow,
  noise,
  place,
  polarShape,
  shrinkToward,
  softHighlight,
  strokePoly,
} from "./shapeUtils";
import type { IngredientVisualDefinition, Pt } from "./types";

const TOP = -62;
const BOTTOM = 72;
const MAX_HW = 78;
const LOBES = 3;

/** Wide shoulders, tapering body, three hanging lobes at the base. */
function halfWidth(v: number): number {
  const shoulder = Math.sin(Math.PI * (0.3 + 0.44 * v));
  const taper = 1 - 0.24 * Math.pow(v, 2.2);
  return MAX_HW * shoulder * taper + 1.4 * noise(v * 4, 7);
}

function bottomCurve(x: number): number {
  const u = (x + MAX_HW) / (2 * MAX_HW);
  let lift = 0;
  for (let i = 1; i < LOBES; i++) {
    const c = i / LOBES;
    lift = Math.max(lift, Math.exp(-Math.pow((u - c) / 0.11, 2)));
  }
  const dome = Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.5) / 0.5, 2)));
  return BOTTOM * (0.62 + 0.38 * dome) - 20 * lift;
}

function silhouette(): Pt[] {
  const right: Pt[] = [];
  const left: Pt[] = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const v = i / steps;
    const y = TOP + (BOTTOM * 0.62 - TOP) * v;
    right.push({ x: halfWidth(v), y });
    left.push({ x: -halfWidth(v) + 1.2 * noise(v * 3, 11), y });
  }
  const bottom: Pt[] = [];
  const bSteps = 64;
  const endX = right[right.length - 1]!.x;
  for (let i = 0; i <= bSteps; i++) {
    const t = i / bSteps;
    const x = endX - 2 * endX * t;
    bottom.push({ x, y: Math.max(bottomCurve(x), right[right.length - 1]!.y) });
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

const SIL = silhouette();

export const bellPepperVisual: IngredientVisualDefinition = {
  id: "bell-pepper",
  label: "Bell Pepper",
  width: 2 * MAX_HW,
  height: BOTTOM - TOP,

  drawWhole(g, x, y, s) {
    groundShadow(g, x, y + BOTTOM * s, MAX_HW * 0.78 * s, 12 * s);

    fillPoly(g, place(SIL, x, y, s), PAL.pepper);
    // shadowed right-lower flank
    fillPoly(g, place(shrinkToward(SIL, 52, 40, 0.08), x, y, s), PAL.pepperDark, 0.28);
    // sunlit upper-left mass
    fillPoly(g, place(shrinkToward(SIL, -40, -34, 0.34), x, y, s), PAL.pepperLight, 0.42);
    strokePoly(g, place(SIL, x, y, s), PAL.pepperDark, 2.4 * s, 0.55);

    // vertical lobe creases
    for (const cx of [-38, 10, 46]) {
      const seg: Pt[] = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const yy = TOP + 10 + (BOTTOM - TOP - 26) * t;
        seg.push({ x: cx * (0.55 + 0.6 * Math.sin(Math.PI * (0.25 + 0.6 * t))), y: yy });
      }
      strokePoly(g, place(seg, x, y, s), PAL.pepperDark, 2.6 * s, 0.3, false);
      strokePoly(
        g,
        place(
          seg.map((p) => ({ x: p.x + 5, y: p.y })),
          x,
          y,
          s,
        ),
        PAL.pepperLight,
        2 * s,
        0.22,
        false,
      );
    }

    softHighlight(g, x - 34 * s, y - 18 * s, 34 * s, 62 * s, 0xfaf5e2, 0.6, -0.22);
    softHighlight(g, x + 40 * s, y + 18 * s, 12 * s, 40 * s, 0xdff0b8, 0.3, 0.12);

    // stem cavity + stem
    g.fillStyle(PAL.pepperDark, 0.5);
    g.fillEllipse(x, y + (TOP + 8) * s, 44 * s, 16 * s);
    fillPoly(
      g,
      place(
        [
          { x: -9, y: TOP + 6 },
          { x: 9, y: TOP + 6 },
          { x: 7, y: TOP - 22 },
          { x: 12, y: TOP - 30 },
          { x: 1, y: TOP - 34 },
          { x: -6, y: TOP - 24 },
        ],
        x,
        y,
        s,
      ),
      PAL.pepperStem,
    );
    strokePoly(
      g,
      place(
        [
          { x: -2, y: TOP - 30 },
          { x: -1, y: TOP - 2 },
        ],
        x,
        y,
        s,
      ),
      0x2f5522,
      1.6 * s,
      0.4,
      false,
    );
  },

  drawCrossSection(g, x, y, s) {
    // horizontal cut: hollow, lobed ring
    const outer = polarShape(120, (a) => 74 * (1 + 0.05 * Math.cos(4 * a + 0.4)));
    const inner = polarShape(120, (a) => 60 * (1 + 0.07 * Math.cos(4 * a + 0.4)));
    fillPoly(g, place(outer, x, y, s), PAL.pepper);
    strokePoly(g, place(outer, x, y, s), PAL.pepperDark, 2.4 * s, 0.6);
    fillPoly(g, place(inner, x, y, s), PAL.pepperFlesh);
    // hollow cavity
    fillPoly(g, place(shrinkToward(inner, 0, 0, 0.16), x, y, s), PAL.pepperCavity, 0.85);
    g.fillStyle(0x8fae72, 0.35);
    g.fillEllipse(x, y, 96 * s, 96 * s);
    // placenta ribs + seeds
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const rib: Pt[] = [
        { x: 0, y: 0 },
        { x: Math.cos(a) * 34, y: Math.sin(a) * 34 },
        { x: Math.cos(a + 0.22) * 52, y: Math.sin(a + 0.22) * 52 },
        { x: Math.cos(a - 0.22) * 52, y: Math.sin(a - 0.22) * 52 },
      ];
      fillPoly(g, place(rib, x, y, s), PAL.pepperFlesh, 0.95);
      for (let k = 0; k < 5; k++) {
        const rr = 22 + k * 6;
        const aa = a + (k % 2 ? 0.16 : -0.16);
        g.fillStyle(PAL.pepperSeed, 0.95);
        g.fillEllipse(x + Math.cos(aa) * rr * s, y + Math.sin(aa) * rr * s, 7 * s, 5.5 * s);
      }
    }
    softHighlight(g, x - 30 * s, y - 30 * s, 40 * s, 26 * s, 0xffffff, 0.35, -0.5);
  },

  getSilhouette() {
    return { outline: SIL };
  },

  getVisualBounds() {
    return boundsOf(SIL);
  },
};
