import { bezierSpine, ellipse, tube } from "../primitives";
import {
  fillBand,
  fillPoly,
  highlight,
  radial,
  speckle,
  strokePoly,
  withClip,
} from "../paintUtils";
import { makeRng } from "../rng";
import type { IngredientDefinition } from "../types";

const colors = {
  skin: "#2f4a24",
  skinDark: "#1f331a",
  skinLight: "#4a6b32",
  fleshOuter: "#a8c25a",
  flesh: "#cfdc84",
  fleshPale: "#e6ecb4",
  pit: "#a9743f",
  pitDark: "#7d4f27",
  pitLight: "#c99a63",
};

export const avocado: IngredientDefinition = {
  id: "avocado",
  name: "Avocado",
  category: "Fruit",
  seed: 2213,
  scale: 0.88,
  colors,
  seamColors: { edge: "#5d7a33", inner: "#e9efbe" },
  techniques: ["Halve", "Slice", "Dice", "Peel"],
  geometry: (seed) => {
    const rnd = makeRng(seed);
    const lean = (rnd() - 0.5) * 0.1;
    // Pear body: narrow neck at top, heavy asymmetric bulb at the bottom.
    const spine = bezierSpine(
      { x: lean, y: -0.86 },
      { x: lean + 0.1, y: -0.4 },
      { x: -0.04, y: 0.2 },
      { x: 0.02, y: 0.82 },
      26,
    );
    const body = tube(
      spine,
      (t) => {
        const neck = 0.19 + 0.16 * Math.sin(Math.min(1, t * 1.5) * Math.PI * 0.5);
        const bulb = 0.52 * Math.sin(Math.min(1, Math.max(0, (t - 0.25) / 0.75)) * Math.PI * 0.95);
        return Math.max(0.14, Math.max(neck, bulb) * (1 + (rnd() - 0.5) * 0.02));
      },
      44,
    );
    // The pit is real geometry, so halving splits it into visible pit halves.
    const pit = ellipse(0.0, 0.36, 0.24, 0.23, 0.2, 34);
    return {
      longAxis: Math.PI / 2,
      parts: [
        { id: "body", kind: "body", poly: body, z: 0 },
        { id: "pit", kind: "pit", poly: pit, z: 2 },
      ],
    };
  },
  paint: ({ ctx, geometry, rnd }) => {
    const body = geometry.parts.find((p) => p.id === "body")!.poly;
    const pit = geometry.parts.find((p) => p.id === "pit")!.poly;

    // Flesh interior across the whole body.
    fillPoly(
      ctx,
      body,
      radial(ctx, { x: 0, y: 0.22 }, 0.05, 0.95, [
        [0, colors.fleshPale],
        [0.55, colors.flesh],
        [1, colors.fleshOuter],
      ]),
    );
    withClip(ctx, body, () => {
      ctx.strokeStyle = "rgba(140,170,70,0.22)";
      ctx.lineWidth = 0.01;
      for (let i = 0; i < 26; i++) {
        const a = rnd() * Math.PI * 2;
        const r = 0.25 + rnd() * 0.55;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 0.2, 0.3 + Math.sin(a) * 0.2);
        ctx.quadraticCurveTo(
          Math.cos(a) * r * 0.7,
          0.3 + Math.sin(a) * r * 0.7,
          Math.cos(a) * r,
          0.3 + Math.sin(a) * r,
        );
        ctx.stroke();
      }
    });
    speckle(ctx, body, rnd, 120, "#f2f6cf", 0.005, 0.014, 0.3);

    // Pit body.
    fillPoly(
      ctx,
      pit,
      radial(ctx, { x: -0.05, y: 0.3 }, 0.02, 0.32, [
        [0, colors.pitLight],
        [0.6, colors.pit],
        [1, colors.pitDark],
      ]),
    );
    speckle(ctx, pit, rnd, 60, colors.pitDark, 0.004, 0.012, 0.25);
    highlight(ctx, pit, { x: -0.08, y: 0.26 }, 0.14, "rgba(255,240,215,0.8)", 0.45);
    strokePoly(ctx, pit, "rgba(90,58,28,0.55)", 0.014);
    // Pale halo of flesh right around the pit.
    strokePoly(ctx, pit, "rgba(238,243,190,0.5)", 0.05);

    // Dark skin band last so any cut exposes flesh, never a painted-on face.
    fillBand(
      ctx,
      body,
      0.075,
      radial(ctx, { x: -0.2, y: -0.2 }, 0.1, 1.1, [
        [0, colors.skinLight],
        [0.6, colors.skin],
        [1, colors.skinDark],
      ]),
    );
    withClip(ctx, body, () => {
      for (let i = 0; i < 260; i++) {
        const a = rnd() * Math.PI * 2;
        const x = Math.cos(a) * 0.62;
        const y = Math.sin(a) * 0.9;
        ctx.globalAlpha = 0.2 + rnd() * 0.2;
        ctx.fillStyle = rnd() > 0.5 ? colors.skinDark : colors.skinLight;
        ctx.beginPath();
        ctx.ellipse(x, y, 0.01 + rnd() * 0.008, 0.008 + rnd() * 0.007, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
    fillBand(ctx, body, 0.018, "rgba(232,240,180,0.55)");
    highlight(ctx, body, { x: -0.18, y: -0.42 }, 0.3, "rgba(220,240,180,0.5)", 0.4);
    strokePoly(ctx, body, "rgba(22,36,18,0.5)", 0.012);
  },
};
