import { bezierSpine, capsule, tube } from "../primitives";
import {
  fillBand,
  fillPoly,
  highlight,
  linear,
  radial,
  speckle,
  strokePoly,
  withClip,
} from "../paintUtils";
import { makeRng } from "../rng";
import type { GeometryPart, IngredientDefinition } from "../types";

const colors = {
  skin: "#4a2258",
  skinDark: "#2c1136",
  skinLight: "#7a3f8c",
  gloss: "#c79ad6",
  flesh: "#f6efe0",
  fleshWarm: "#e8dcc4",
  seed: "#c9b184",
  calyx: "#5f7f34",
  calyxDark: "#3d5720",
  calyxLight: "#8aa84c",
};

export const eggplant: IngredientDefinition = {
  id: "eggplant",
  name: "Eggplant",
  category: "Vegetable",
  seed: 3319,
  scale: 0.94,
  colors,
  seamColors: { edge: "#6d3a7e", inner: "#f7f0e2" },
  techniques: ["Slice", "Dice", "Halve", "Chop", "Rings"],
  geometry: (seed) => {
    const rnd = makeRng(seed);
    // Curved, bottom-heavy teardrop spine — never a straight purple cylinder.
    const spine = bezierSpine(
      { x: -0.34, y: -0.72 },
      { x: -0.02, y: -0.5 },
      { x: 0.34, y: 0.06 },
      { x: 0.12, y: 0.78 },
      30,
    );
    const body = tube(
      spine,
      (t) => {
        const grow = Math.pow(t, 0.65);
        const taper = 1 - Math.pow(Math.max(0, t - 0.82) / 0.18, 2) * 0.45;
        return (0.1 + 0.33 * grow) * taper * (1 + (rnd() - 0.5) * 0.02);
      },
      48,
    );
    const parts: GeometryPart[] = [{ id: "body", kind: "body", poly: body, z: 1 }];
    // Green calyx: a few overlapping leaf capsules + stem.
    const base = { x: -0.34, y: -0.7 };
    parts.push({
      id: "stem",
      kind: "stem",
      poly: capsule(base, { x: -0.46, y: -0.92 }, 0.062, 12),
      z: 2,
    });
    for (let i = 0; i < 4; i++) {
      const a = -1.9 + i * 0.55 + (rnd() - 0.5) * 0.2;
      const len = 0.26 + rnd() * 0.14;
      parts.push({
        id: `calyx-${i}`,
        kind: "detail",
        poly: capsule(
          base,
          { x: base.x + Math.cos(a) * len, y: base.y + Math.sin(a) * len * 0.8 + 0.14 },
          0.055 + rnd() * 0.02,
          12,
        ),
        z: 3,
      });
    }
    return { longAxis: Math.atan2(0.78 - -0.72, 0.12 - -0.34), parts };
  },
  paint: ({ ctx, geometry, rnd }) => {
    const body = geometry.parts.find((p) => p.id === "body")!.poly;

    // Pale cream flesh fills the entire silhouette (cuts expose it for free).
    fillPoly(
      ctx,
      body,
      radial(ctx, { x: 0.05, y: 0.25 }, 0.05, 0.9, [
        [0, colors.flesh],
        [1, colors.fleshWarm],
      ]),
    );
    speckle(ctx, body, rnd, 90, colors.seed, 0.005, 0.011, 0.4);
    withClip(ctx, body, () => {
      ctx.strokeStyle = "rgba(200,180,140,0.3)";
      ctx.lineWidth = 0.008;
      for (let i = 0; i < 14; i++) {
        const y = -0.6 + i * 0.1;
        ctx.beginPath();
        ctx.moveTo(-0.5, y);
        ctx.quadraticCurveTo(0, y + 0.06, 0.5, y);
        ctx.stroke();
      }
    });

    // Deep purple skin band.
    fillBand(
      ctx,
      body,
      0.085,
      linear(ctx, { x: -0.6, y: -0.6 }, { x: 0.6, y: 0.8 }, [
        [0, colors.skinLight],
        [0.45, colors.skin],
        [1, colors.skinDark],
      ]),
    );
    fillBand(ctx, body, 0.016, "rgba(250,244,232,0.5)");

    withClip(ctx, body, () => {
      // Long glossy streak following the curve.
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = colors.gloss;
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(-0.3, -0.5);
      ctx.quadraticCurveTo(0.05, -0.05, 0.02, 0.5);
      ctx.stroke();
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 0.018;
      ctx.strokeStyle = "#efe0f6";
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    highlight(ctx, body, { x: -0.12, y: 0.2 }, 0.26, "rgba(230,200,245,0.5)", 0.35);
    strokePoly(ctx, body, "rgba(30,12,38,0.45)", 0.012);

    // Calyx and stem on top.
    for (const part of geometry.parts.filter((p) => p.id !== "body")) {
      fillPoly(
        ctx,
        part.poly,
        linear(ctx, { x: -0.6, y: -1 }, { x: -0.1, y: -0.4 }, [
          [0, colors.calyxLight],
          [1, part.kind === "stem" ? colors.calyxDark : colors.calyx],
        ]),
      );
      strokePoly(ctx, part.poly, "rgba(40,60,20,0.4)", 0.01);
      speckle(ctx, part.poly, rnd, 18, colors.calyxDark, 0.004, 0.009, 0.3);
    }
  },
};
