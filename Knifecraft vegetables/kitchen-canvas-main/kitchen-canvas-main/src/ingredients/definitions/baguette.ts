import { bezierSpine, tube } from "../primitives";
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
  crust: "#c07b34",
  crustDark: "#8e5219",
  crustLight: "#e0a45c",
  bake: "#6d3c11",
  crumb: "#f6e6c2",
  crumbDeep: "#e6d0a4",
  crumbHole: "#d8bd8e",
};

export const baguette: IngredientDefinition = {
  id: "baguette",
  name: "Baguette",
  category: "Bakery",
  seed: 5527,
  scale: 1.0,
  colors,
  seamColors: { edge: "#a4652a", inner: "#f7e8c6" },
  techniques: ["Slice", "Halve", "Chop"],
  geometry: (seed) => {
    const rnd = makeRng(seed);
    const spine = bezierSpine(
      { x: -0.92, y: 0.16 },
      { x: -0.3, y: -0.1 },
      { x: 0.3, y: -0.06 },
      { x: 0.92, y: 0.14 },
      28,
    );
    const body = tube(
      spine,
      (t) => {
        const ends = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) ** 0.45;
        return (0.1 + 0.19 * ends) * (1 + (rnd() - 0.5) * 0.03);
      },
      50,
    );
    return {
      longAxis: 0,
      parts: [{ id: "body", kind: "body", poly: body, z: 0 }],
    };
  },
  paint: ({ ctx, geometry, rnd }) => {
    const body = geometry.parts.find((p) => p.id === "body")!.poly;

    // Crumb region fills the whole loaf so a slice's cut face is pale crumb.
    fillPoly(
      ctx,
      body,
      linear(ctx, { x: 0, y: -0.3 }, { x: 0, y: 0.35 }, [
        [0, colors.crumb],
        [1, colors.crumbDeep],
      ]),
    );
    withClip(ctx, body, () => {
      for (let i = 0; i < 180; i++) {
        const x = (rnd() - 0.5) * 1.9;
        const y = (rnd() - 0.5) * 0.6;
        const r = 0.006 + rnd() * 0.018;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = colors.crumbHole;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.6 + rnd() * 0.8), rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#fffaf0";
        ctx.beginPath();
        ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    // Crust as a distinct outer region.
    fillBand(
      ctx,
      body,
      0.085,
      linear(ctx, { x: 0, y: -0.35 }, { x: 0, y: 0.35 }, [
        [0, colors.crustLight],
        [0.5, colors.crust],
        [1, colors.crustDark],
      ]),
    );
    fillBand(ctx, body, 0.018, "rgba(246,230,194,0.45)");

    withClip(ctx, body, () => {
      // Scored top: diagonal slashes with baked edges and a light crumb split.
      for (let i = 0; i < 5; i++) {
        const cx = -0.66 + i * 0.34 + (rnd() - 0.5) * 0.03;
        ctx.save();
        ctx.translate(cx, -0.14);
        ctx.rotate(-0.5);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = colors.bake;
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.035, 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colors.crustLight;
        ctx.beginPath();
        ctx.ellipse(-0.012, -0.005, 0.02, 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = colors.crumb;
        ctx.beginPath();
        ctx.ellipse(-0.016, -0.01, 0.009, 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      // Baked flour dusting + darker underside.
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = colors.bake;
      ctx.fillRect(-1, 0.16, 2, 0.4);
      ctx.globalAlpha = 1;
    });

    speckle(ctx, body, rnd, 120, "#f7dfae", 0.004, 0.009, 0.18);
    highlight(ctx, body, { x: -0.3, y: -0.2 }, 0.4, "rgba(255,236,196,0.55)", 0.4);
    strokePoly(ctx, body, "rgba(110,60,17,0.45)", 0.012);
  },
};
