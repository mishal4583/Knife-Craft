import type Phaser from "phaser";
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

const CAP_W = 84; // half width
const CAP_TOP = -70;
const CAP_BOTTOM = -4;
const STEM_TOP_W = 26;
const STEM_BOT_W = 34;
const STEM_BOTTOM = 68;

/** Cap dome: broad, domed, gently asymmetric, soft shoulders. */
function capTop(): Pt[] {
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
function capUnderside(): Pt[] {
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

function stemOutline(): Pt[] {
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

function silhouette(): Pt[] {
  const cap = capTop();
  const stem = stemOutline();
  const half = stem.length / 2;
  const stemRight = stem.slice(0, half);
  const stemLeft = stem.slice(half);
  const under = capUnderside();
  const underRight = under.slice(0, Math.floor(under.length * 0.42));
  const underLeft = under.slice(Math.ceil(under.length * 0.58));
  return [...cap, ...underRight, ...stemRight, ...stemLeft, ...underLeft];
}

const SIL = silhouette();
const CAP_REGION = [...capTop(), ...capUnderside()];
const STEM_REGION = stemOutline();

function drawGills(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number) {
  const count = 17;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const px = -CAP_W * 0.94 + 2 * CAP_W * 0.94 * t;
    const edgeY = CAP_BOTTOM + 11.5 * Math.sin(Math.PI * t);
    const innerY = CAP_BOTTOM + 2 + 2 * Math.sin(Math.PI * t);
    const inner = { x: px * 0.36, y: innerY };
    const seg: Pt[] = [];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      seg.push({
        x: inner.x + (px - inner.x) * u,
        y: inner.y + (edgeY - inner.y) * Math.pow(u, 0.7),
      });
    }
    strokePoly(g, place(seg, x, y, s), PAL.mushroomGillDark, 1.5 * s, 0.5, false);
  }
}

export const mushroomVisual: IngredientVisualDefinition = {
  id: "mushroom",
  label: "Mushroom",
  width: 2 * CAP_W,
  height: STEM_BOTTOM - CAP_TOP,

  drawWhole(g, x, y, s) {
    groundShadow(g, x, y + STEM_BOTTOM * s, CAP_W * 0.8 * s, 12 * s);

    // stem
    fillPoly(g, place(STEM_REGION, x, y, s), PAL.mushroomStem);
    fillPoly(
      g,
      place(shrinkToward(STEM_REGION, 30, 30, 0.12), x, y, s),
      PAL.mushroomStemShade,
      0.55,
    );
    fillPoly(g, place(shrinkToward(STEM_REGION, -26, 10, 0.3), x, y, s), 0xfff7e8, 0.28);
    strokePoly(g, place(STEM_REGION, x, y, s), PAL.mushroomGillDark, 1.6 * s, 0.35);

    // underside + gills (drawn before the cap so the cap edge overlaps them)
    fillPoly(
      g,
      place([...capUnderside(), ...capTop().slice().reverse()], x, y, s),
      PAL.mushroomGill,
    );
    drawGills(g, x, y, s);
    fillPoly(
      g,
      place(
        [
          ...capTop().map((p) => ({ x: p.x, y: p.y })),
          ...capTop()
            .slice()
            .reverse()
            .map((p) => ({ x: p.x, y: p.y + 4 })),
        ],
        x,
        y,
        s,
      ),
      PAL.mushroomGillDark,
      0.35,
    );

    // cap
    fillPoly(g, place(CAP_REGION.slice(0, capTop().length + 2), x, y, s), PAL.mushroomCap);
    fillPoly(g, place(capTop(), x, y, s), PAL.mushroomCap);
    // darker perimeter
    strokePoly(g, place(capTop(), x, y, s), PAL.mushroomCapDark, 5 * s, 0.5, false);
    // directional shading (lower-right heavier)
    fillPoly(g, place(shrinkToward(capTop(), 48, -10, 0.1), x, y, s), PAL.mushroomCapDark, 0.2);
    // sunlit crown
    fillPoly(g, place(shrinkToward(capTop(), -26, -34, 0.42), x, y, s), PAL.mushroomCapLight, 0.55);
    softHighlight(g, x - 30 * s, y - 44 * s, 42 * s, 20 * s, 0xfff7e8, 0.55, -0.42);

    // organic surface variation
    for (let i = 0; i < 7; i++) {
      const t = 0.12 + 0.76 * (i / 6);
      const px = (-CAP_W + 2 * CAP_W * t) * 0.9;
      const py = CAP_BOTTOM + (CAP_TOP - CAP_BOTTOM) * Math.pow(Math.sin(Math.PI * t), 0.62) * 0.55;
      g.fillStyle(PAL.mushroomCapDark, 0.12);
      g.fillEllipse(x + px * s, y + (py + 6 * noise(t * 6, 3)) * s, 16 * s, 7 * s);
    }
  },

  drawCrossSection(g, x, y, s) {
    const outline = place(SIL, x, y, s);
    fillPoly(g, outline, PAL.mushroomFlesh);
    // cap skin
    strokePoly(g, place(capTop(), x, y, s), PAL.mushroomCap, 6 * s, 0.9, false);
    strokePoly(g, outline, PAL.mushroomStemShade, 2 * s, 0.6);
    // gill band under the cap
    const band: Pt[] = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      band.push({ x: -CAP_W * 0.92 + 2 * CAP_W * 0.92 * t, y: CAP_BOTTOM - 8 });
    }
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      band.push({ x: -CAP_W * 0.92 + 2 * CAP_W * 0.92 * t, y: CAP_BOTTOM + 1 });
    }
    fillPoly(g, place(band, x, y, s), PAL.mushroomGill, 0.85);
    for (let i = 0; i < 14; i++) {
      const t = (i + 0.5) / 14;
      const px = -CAP_W * 0.9 + 2 * CAP_W * 0.9 * t;
      strokePoly(
        g,
        place(
          [
            { x: px, y: CAP_BOTTOM - 7 },
            { x: px, y: CAP_BOTTOM + 0.5 },
          ],
          x,
          y,
          s,
        ),
        PAL.mushroomGillDark,
        1.2 * s,
        0.5,
        false,
      );
    }
    // stem fibres
    for (let i = -2; i <= 2; i++) {
      strokePoly(
        g,
        place(
          [
            { x: i * 9, y: CAP_BOTTOM + 8 },
            { x: i * 11, y: STEM_BOTTOM - 8 },
          ],
          x,
          y,
          s,
        ),
        PAL.mushroomStemShade,
        1.4 * s,
        0.5,
        false,
      );
    }
  },

  getSilhouette() {
    return {
      outline: SIL,
      regions: [
        { id: "cap", outline: CAP_REGION },
        { id: "stem", outline: STEM_REGION },
      ],
    };
  },

  getVisualBounds() {
    return boundsOf(SIL);
  },
};
