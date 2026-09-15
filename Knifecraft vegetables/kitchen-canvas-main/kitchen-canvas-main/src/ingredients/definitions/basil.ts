import { capsule, leaf } from "../primitives";
import { fillPoly, linear, paintLeafBlade, strokePoly } from "../paintUtils";
import { cluster } from "../cluster";
import { makeRng } from "../rng";
import type { GeometryPart, IngredientDefinition } from "../types";

const colors = {
  leaf: "#4f8a3c",
  leafDark: "#2f5b26",
  leafLight: "#8ec06a",
  vein: "#e7f2c8",
  stem: "#6f9a4a",
  stemDark: "#4a7530",
};

// Basil grows in opposite pairs off a soft central stem — a small hub with
// leaves fanning outward reads far better than one scattered blob.
const HUB = { x: 0, y: 0.58 };

export const basil: IngredientDefinition = {
  id: "basil",
  name: "Basil",
  category: "Herb",
  seed: 7741,
  scale: 0.9,
  colors,
  seamColors: { edge: "#3c6b2e", inner: "#dcecb8" },
  techniques: ["Chiffonade", "Chop", "Rock Mince"],
  separateOnCut: true,
  geometry: (seed) => {
    const rnd = makeRng(seed);
    const parts: GeometryPart[] = [];

    parts.push({
      id: "stem",
      kind: "stem",
      poly: capsule({ x: 0, y: 0.94 }, HUB, 0.035, 10),
      z: 0,
    });

    parts.push(
      ...cluster({
        count: 7,
        minR: 0.13,
        maxR: 0.21,
        rnd,
        center: { x: 0, y: 0.08 },
        spreadX: 0.48,
        spreadY: 0.44,
        attachStems: true,
        stemOrigin: HUB,
        stemWidth: 0.02,
        faceFrom: HUB,
        rotJitter: 0.4,
        widthRatio: 0.52,
        kind: "leaf",
        idPrefix: "leaf",
        shape: (a) =>
          leaf(a.pos.x, a.pos.y, a.length, a.width, a.rot, a.rnd, {
            baseRound: 0.6,
            tipSharp: 1.9,
            serration: 0.02,
            serrFreq: 5,
            asym: 0.08,
            wobble: 0.025,
          }),
      }),
    );

    return { longAxis: Math.PI / 2, cluster: true, parts };
  },
  paint: ({ ctx, geometry, rnd }) => {
    const ordered = geometry.parts.slice().sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

    for (const part of ordered) {
      if (part.kind !== "stem") continue;
      fillPoly(
        ctx,
        part.poly,
        linear(ctx, { x: -0.1, y: 0.4 }, { x: 0.1, y: 0.95 }, [
          [0, colors.stem],
          [1, colors.stemDark],
        ]),
      );
      strokePoly(ctx, part.poly, "rgba(50,80,30,0.3)", 0.006);
    }

    for (const part of ordered) {
      if (part.kind !== "leaf") continue;
      // Slight per-leaf color drift so the cluster doesn't read as one flat tone.
      const drift = rnd();
      const base = drift > 0.66 ? colors.leafLight : drift < 0.2 ? colors.leafDark : colors.leaf;
      paintLeafBlade(ctx, part.poly, {
        fill: (axis) =>
          linear(ctx, axis.base, axis.tip, [
            [0, colors.leafDark],
            [0.4, base],
            [1, colors.leafLight],
          ]),
        edgeColor: "rgba(30,60,20,0.22)",
        edgeThickness: 0.012,
        veinColor: colors.vein,
        veinAlpha: 0.4,
        highlightColor: "rgba(230,245,190,0.6)",
        highlightAlpha: 0.35,
        strokeColor: "rgba(24,48,16,0.4)",
        strokeWidth: 0.008,
      });
    }
  },
};
