import { ellipse, irregularOval, capsule, wedge, centroid } from "../primitives";
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
  peel: "#f4c53c",
  peelDark: "#d99f21",
  peelLight: "#fbe07a",
  rind: "rgba(255,250,225,0.9)",
  flesh: "#fdeeae",
  fleshDeep: "#f7dc85",
  pith: "#fffaea",
  segment: "#fbe59a",
};

export const lemon: IngredientDefinition = {
  id: "lemon",
  name: "Lemon",
  category: "Fruit",
  seed: 1077,
  scale: 0.82,
  colors,
  seamColors: { edge: "#d9a72a", inner: "#fff3c4" },
  techniques: ["Slice", "Radial", "Halve", "Peel"],
  geometry: (seed) => {
    const rnd = makeRng(seed);
    const body = irregularOval(0, 0, 0.6, 0.76, rnd, 0.035, 4, 0, 64);
    // Citrus nubs: tiny geometry tips, not painted decoration.
    const top = capsule({ x: 0.0, y: -0.74 }, { x: 0.02, y: -0.86 }, 0.075, 12);
    const bottom = capsule({ x: -0.01, y: 0.74 }, { x: -0.02, y: 0.84 }, 0.08, 12);
    return {
      longAxis: Math.PI / 2,
      parts: [
        { id: "nub-top", kind: "body", poly: top, z: 0 },
        { id: "nub-bottom", kind: "body", poly: bottom, z: 0 },
        { id: "body", kind: "body", poly: body, z: 1 },
      ],
    };
  },
  paint: ({ ctx, geometry, rnd }) => {
    const body = geometry.parts.find((p) => p.id === "body")!.poly;
    const nubs = geometry.parts.filter((p) => p.kind === "body" && p.id !== "body");

    for (const n of nubs) fillPoly(ctx, n.poly, colors.peelDark);

    // Interior first: pale flesh + citrus segments + pith core.
    fillPoly(
      ctx,
      body,
      radial(ctx, { x: 0, y: 0 }, 0.05, 0.8, [
        [0, colors.pith],
        [0.35, colors.flesh],
        [1, colors.fleshDeep],
      ]),
    );

    withClip(ctx, body, () => {
      const segments = 9;
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2 + 0.12;
        const a1 = ((i + 1) / segments) * Math.PI * 2 - 0.06;
        const w = wedge(0, 0, 0.72, a0, a1, 14);
        ctx.globalAlpha = 0.85;
        fillPoly(ctx, w, i % 2 ? colors.segment : colors.flesh);
        ctx.globalAlpha = 1;
        // Juice-vesicle striations inside each segment.
        ctx.strokeStyle = "rgba(214,167,44,0.16)";
        ctx.lineWidth = 0.006;
        for (let k = 0; k < 5; k++) {
          const a = a0 + ((a1 - a0) * (k + 0.5)) / 5;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 0.12, Math.sin(a) * 0.12);
          ctx.lineTo(Math.cos(a) * 0.66, Math.sin(a) * 0.66);
          ctx.stroke();
        }
        // Pith walls between segments.
        strokePoly(ctx, w, "rgba(255,253,240,0.85)", 0.016);
      }
      fillPoly(ctx, ellipse(0, 0, 0.11, 0.1, 0, 24), colors.pith);
      strokePoly(ctx, ellipse(0, 0, 0.11, 0.1, 0, 24), "rgba(217,167,42,0.25)", 0.008);
    });

    // Peel band on top of the interior — cuts through it expose the flesh.
    fillBand(
      ctx,
      body,
      0.085,
      radial(ctx, { x: -0.15, y: -0.2 }, 0.1, 1.0, [
        [0, colors.peelLight],
        [0.6, colors.peel],
        [1, colors.peelDark],
      ]),
    );
    fillBand(ctx, body, 0.022, colors.rind);
    fillBand(ctx, body, 0.012, colors.peelDark);

    // Pores only in the peel band.
    withClip(ctx, body, () => {
      const c = centroid(body);
      ctx.save();
      ctx.beginPath();
      for (const p of body) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.clip();
      for (let i = 0; i < 220; i++) {
        const a = rnd() * Math.PI * 2;
        const rr = 0.93 + rnd() * 0.06;
        const x = c.x + Math.cos(a) * 0.6 * rr;
        const y = c.y + Math.sin(a) * 0.76 * rr;
        ctx.globalAlpha = 0.16 + rnd() * 0.16;
        ctx.fillStyle = i % 3 ? colors.peelDark : "#fff6d2";
        ctx.beginPath();
        ctx.ellipse(x, y, 0.008 + rnd() * 0.006, 0.006 + rnd() * 0.005, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    speckle(ctx, body, rnd, 60, "#ffffff", 0.004, 0.01, 0.12);
    highlight(ctx, body, { x: -0.22, y: -0.34 }, 0.34, "rgba(255,255,255,0.75)", 0.5);
    strokePoly(ctx, body, "rgba(168,116,16,0.35)", 0.012);
  },
};
