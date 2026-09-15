import { roundedRect } from "../primitives";
import {
  fillBand,
  fillPoly,
  highlight,
  linear,
  speckle,
  strokePoly,
  withClip,
} from "../paintUtils";
import { makeRng } from "../rng";
import type { IngredientDefinition } from "../types";

const colors = {
  cheese: "#e8942f",
  cheeseDeep: "#c9711b",
  cheesePale: "#f6c05e",
  cutFace: "#fbd27c",
  rind: "#b25e14",
  rindEdge: "#7a3f0f",
  crumb: "#fde3ac",
};

export const cheddar: IngredientDefinition = {
  id: "cheddar",
  name: "Cheddar",
  category: "Dairy",
  seed: 4423,
  scale: 0.9,
  colors,
  seamColors: { edge: "#c9761f", inner: "#fbd88c" },
  techniques: ["Slice", "Dice", "Julienne", "Chop"],
  geometry: (seed) => {
    const rnd = makeRng(seed);
    // Dense block: rounded rect with hand-cut irregular edges.
    const body = roundedRect(0, 0.02, 1.52, 0.98, 1, 0.05, rnd);
    return {
      longAxis: 0,
      parts: [{ id: "body", kind: "body", poly: body, z: 0 }],
    };
  },
  paint: ({ ctx, geometry, rnd }) => {
    const body = geometry.parts.find((p) => p.id === "body")!.poly;

    fillPoly(
      ctx,
      body,
      linear(ctx, { x: -0.7, y: -0.5 }, { x: 0.7, y: 0.55 }, [
        [0, colors.cutFace],
        [0.4, colors.cheese],
        [1, colors.cheeseDeep],
      ]),
    );

    withClip(ctx, body, () => {
      // Lighter, matte cut face across the upper plane of the block.
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = linear(ctx, { x: 0, y: -0.5 }, { x: 0, y: 0.1 }, [
        [0, colors.cutFace],
        [1, "rgba(251,210,124,0)"],
      ]);
      ctx.fillRect(-0.9, -0.6, 1.8, 0.8);
      ctx.globalAlpha = 1;
      // Subtle pressed-curd striations.
      ctx.strokeStyle = "rgba(180,95,20,0.16)";
      ctx.lineWidth = 0.008;
      for (let i = 0; i < 22; i++) {
        const y = -0.5 + i * 0.05;
        ctx.beginPath();
        ctx.moveTo(-0.8, y + (rnd() - 0.5) * 0.02);
        ctx.lineTo(0.8, y + (rnd() - 0.5) * 0.02);
        ctx.stroke();
      }
      // A handful of clearly-visible, irregular (never perfectly round) eyes —
      // this is what reads as "cheese" at a glance, not forty faint specks.
      for (let i = 0; i < 9; i++) {
        const x = (rnd() - 0.5) * 1.3;
        const y = (rnd() - 0.5) * 0.75;
        const r = 0.022 + rnd() * 0.036;
        const squash = 0.55 + rnd() * 0.35;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rnd() * Math.PI);
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = colors.cheeseDeep;
        ctx.beginPath();
        ctx.ellipse(0.003, 0.004, r, r * squash, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = colors.crumb;
        ctx.beginPath();
        ctx.ellipse(-r * 0.2, -r * 0.25, r * 0.72, r * squash * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // One edge still carries the waxed rind of the wheel this wedge was cut
      // from — a small detail that reads as "cheddar", not "orange block".
      // (Body spans roughly [-0.76, 0.76]; these rects start just inside its
      // left edge so withClip's body-shaped clip doesn't crop them away.)
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(-0.76, -0.6, 0.14, 1.2);
      ctx.fillStyle = colors.rindEdge;
      ctx.fillRect(-0.76, -0.6, 0.09, 1.2);
      ctx.fillStyle = "rgba(255,240,200,0.25)";
      ctx.fillRect(-0.68, -0.6, 0.014, 1.2);
    });

    speckle(ctx, body, rnd, 150, colors.cheesePale, 0.004, 0.01, 0.18);
    fillBand(ctx, body, 0.03, "rgba(201,113,27,0.35)");
    fillBand(ctx, body, 0.012, colors.rind);
    // Soft contact shadow along the lower edge for a believable block thickness.
    fillBand(
      ctx,
      body,
      0.09,
      linear(ctx, { x: 0, y: 0.25 }, { x: 0, y: 0.5 }, [
        [0, "rgba(90,45,10,0)"],
        [1, "rgba(90,45,10,0.3)"],
      ]),
    );
    highlight(ctx, body, { x: -0.3, y: -0.34 }, 0.46, "rgba(255,244,208,0.7)", 0.45);
    strokePoly(ctx, body, "rgba(140,68,10,0.45)", 0.012);
  },
};
