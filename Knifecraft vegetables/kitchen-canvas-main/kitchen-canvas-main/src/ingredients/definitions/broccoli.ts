import { cluster } from "../cluster";
import { bezierSpine, capsule, centroid, tube } from "../primitives";
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
  stalk: "#b7cf7e",
  stalkDeep: "#8fae5c",
  stalkPale: "#e2ecc0",
  stem: "#7fa447",
  stemDark: "#5b7a2f",
  floret: "#3c6b2c",
  floretDark: "#24451c",
  floretLight: "#5f9440",
  floretCore: "#cfe0a0",
};

export const broccoli: IngredientDefinition = {
  id: "broccoli",
  name: "Broccoli",
  category: "Vegetable",
  seed: 6631,
  scale: 0.96,
  separateOnCut: true,
  colors,
  seamColors: { edge: "#4b7a34", inner: "#dcebb4" },
  techniques: ["Chop", "Slice", "Halve", "Rock Mince"],
  geometry: (seed) => {
    const rnd = makeRng(seed);
    const parts: GeometryPart[] = [];

    // Thick tapered stalk, visibly distinct from the crown.
    const stalkSpine = bezierSpine(
      { x: 0.02, y: 0.9 },
      { x: -0.02, y: 0.6 },
      { x: 0.0, y: 0.35 },
      { x: -0.02, y: 0.05 },
      18,
    );
    parts.push({
      id: "stalk",
      kind: "stem",
      poly: tube(stalkSpine, (t) => 0.2 - 0.05 * t, 26),
      z: 0,
    });

    // Branching stems fanning out of the stalk top.
    const fork = { x: -0.02, y: 0.12 };
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.42 + (rnd() - 0.5) * 0.12;
      const len = 0.3 + rnd() * 0.16;
      parts.push({
        id: `branch-${i}`,
        kind: "stem",
        poly: capsule(
          fork,
          { x: fork.x + Math.cos(a) * len, y: fork.y + Math.sin(a) * len },
          0.055 + rnd() * 0.022,
          12,
        ),
        z: 1,
      });
    }

    // Crown: cluster distributed along an arc, with connecting stems.
    const crownArc = bezierSpine(
      { x: -0.72, y: -0.1 },
      { x: -0.45, y: -0.75 },
      { x: 0.45, y: -0.78 },
      { x: 0.72, y: -0.08 },
      20,
    );
    parts.push(
      ...cluster({
        count: 13,
        minR: 0.15,
        maxR: 0.27,
        rnd,
        spine: crownArc,
        jitter: 0.06,
        wobble: 0.1,
        lobes: 6,
        attachStems: true,
        stemOrigin: fork,
        stemWidth: 0.038,
        kind: "floret",
        idPrefix: "floret",
      }),
    );
    // A few smaller florets filling the inner crown so there are no bald gaps.
    parts.push(
      ...cluster({
        count: 9,
        minR: 0.11,
        maxR: 0.18,
        rnd,
        center: { x: 0, y: -0.32 },
        spreadX: 0.42,
        spreadY: 0.26,
        wobble: 0.12,
        lobes: 6,
        kind: "floret",
        idPrefix: "inner",
      }),
    );

    return { longAxis: Math.PI / 2, cluster: true, parts };
  },
  paint: ({ ctx, geometry, rnd }) => {
    const ordered = geometry.parts.slice().sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

    for (const part of ordered) {
      if (part.kind === "stem") {
        const isStalk = part.id === "stalk";
        fillPoly(
          ctx,
          part.poly,
          linear(ctx, { x: -0.25, y: 0 }, { x: 0.25, y: 0 }, [
            [0, colors.stalkPale],
            [0.5, isStalk ? colors.stalk : colors.stem],
            [1, isStalk ? colors.stalkDeep : colors.stemDark],
          ]),
        );
        if (isStalk) {
          withClip(ctx, part.poly, () => {
            ctx.strokeStyle = "rgba(120,150,70,0.35)";
            ctx.lineWidth = 0.008;
            for (let i = 0; i < 9; i++) {
              const x = -0.16 + i * 0.04;
              ctx.beginPath();
              ctx.moveTo(x, 0.06);
              ctx.quadraticCurveTo(x * 1.1, 0.5, x * 0.9, 0.92);
              ctx.stroke();
            }
          });
          speckle(ctx, part.poly, rnd, 40, colors.stalkPale, 0.004, 0.01, 0.25);
        }
        strokePoly(ctx, part.poly, "rgba(70,95,35,0.35)", 0.01);
      }
    }

    for (const part of ordered) {
      if (part.kind !== "floret") continue;
      const c = centroid(part.poly);
      // Pale floret core: a chopped floret exposes light green inside.
      fillPoly(ctx, part.poly, colors.floretCore);
      fillBand(
        ctx,
        part.poly,
        0.075,
        radial(
          ctx,
          c,
          0.02,
          0.3,
          [
            [0, colors.floretLight],
            [0.55, colors.floret],
            [1, colors.floretDark],
          ],
          { x: c.x - 0.05, y: c.y - 0.05 },
        ),
      );
      // Bumpy bud texture, only over the floret head.
      withClip(ctx, part.poly, () => {
        for (let i = 0; i < 55; i++) {
          const a = rnd() * Math.PI * 2;
          const rr = Math.sqrt(rnd());
          let maxR = 0;
          for (const p of part.poly) maxR = Math.max(maxR, Math.hypot(p.x - c.x, p.y - c.y));
          const x = c.x + Math.cos(a) * rr * maxR * 0.95;
          const y = c.y + Math.sin(a) * rr * maxR * 0.95;
          const r = 0.012 + rnd() * 0.016;
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = rnd() > 0.45 ? colors.floretDark : colors.floretLight;
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * (0.7 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      });
      // Brighter for florets in the upper crown so the whole crown reads
      // with a lighter top and a darker underside, not flat all over.
      const upperBoost = c.y < -0.35 ? 0.16 : 0;
      highlight(
        ctx,
        part.poly,
        { x: c.x - 0.06, y: c.y - 0.07 },
        0.16,
        "rgba(205,232,155,0.6)",
        0.42 + upperBoost,
      );
      strokePoly(ctx, part.poly, "rgba(24,50,18,0.28)", 0.008);
    }
  },
};
