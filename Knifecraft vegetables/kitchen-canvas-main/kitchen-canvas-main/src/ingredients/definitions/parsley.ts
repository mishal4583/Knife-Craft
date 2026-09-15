import { capsule, leaf } from "../primitives";
import { fillPoly, linear, paintLeafBlade, strokePoly } from "../paintUtils";
import { cluster } from "../cluster";
import { makeRng } from "../rng";
import type { GeometryPart, IngredientDefinition } from "../types";

const colors = {
  leaf: "#3d7a52",
  leafDark: "#204d34",
  leafLight: "#74b389",
  vein: "#d8ecc0",
  stem: "#4f7a3f",
  stemDark: "#325026",
};

// Parsley reads differently from basil by using several thin stalks, each
// carrying a small irregular knot of ruffled leaflets — not one broad fan.
const STEM_BASES = [
  { x: -0.3, y: 0.93 },
  { x: 0.04, y: 0.96 },
  { x: 0.33, y: 0.91 },
];

export const parsley: IngredientDefinition = {
  id: "parsley",
  name: "Parsley",
  category: "Herb",
  seed: 8853,
  scale: 0.84,
  colors,
  seamColors: { edge: "#2e5c3e", inner: "#dcecc4" },
  techniques: ["Chop", "Chiffonade", "Rock Mince"],
  separateOnCut: true,
  geometry: (seed) => {
    const rnd = makeRng(seed);
    const parts: GeometryPart[] = [];

    STEM_BASES.forEach((base, i) => {
      const hub = { x: base.x * 0.62, y: 0.4 + (i % 2 === 0 ? 0.05 : -0.05) };
      parts.push({
        id: `stem-${i}`,
        kind: "stem",
        poly: capsule(base, hub, 0.02, 8),
        z: 0,
      });
      parts.push(
        ...cluster({
          count: 4 + Math.floor(rnd() * 2),
          minR: 0.07,
          maxR: 0.12,
          rnd,
          center: hub,
          spreadX: 0.24,
          spreadY: 0.24,
          attachStems: true,
          stemOrigin: hub,
          stemWidth: 0.012,
          faceFrom: hub,
          rotJitter: 0.65,
          widthRatio: 0.66,
          kind: "leaf",
          idPrefix: `leaflet-${i}`,
          shape: (a) =>
            leaf(a.pos.x, a.pos.y, a.length, a.width, a.rot, a.rnd, {
              baseRound: 0.5,
              tipSharp: 1.1,
              serration: 0.18,
              serrFreq: 12,
              asym: 0.12,
              wobble: 0.05,
            }),
        }),
      );
    });

    return { longAxis: Math.PI / 2, cluster: true, parts };
  },
  paint: ({ ctx, geometry, rnd }) => {
    const ordered = geometry.parts.slice().sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

    for (const part of ordered) {
      if (part.kind !== "stem") continue;
      fillPoly(
        ctx,
        part.poly,
        linear(ctx, { x: -0.1, y: 0.35 }, { x: 0.1, y: 0.96 }, [
          [0, colors.stem],
          [1, colors.stemDark],
        ]),
      );
      strokePoly(ctx, part.poly, "rgba(30,55,20,0.3)", 0.005);
    }

    for (const part of ordered) {
      if (part.kind !== "leaf") continue;
      const drift = rnd();
      const base = drift > 0.66 ? colors.leafLight : drift < 0.2 ? colors.leafDark : colors.leaf;
      paintLeafBlade(ctx, part.poly, {
        fill: (axis) =>
          linear(ctx, axis.base, axis.tip, [
            [0, colors.leafDark],
            [0.45, base],
            [1, colors.leafLight],
          ]),
        edgeColor: "rgba(18,40,20,0.24)",
        edgeThickness: 0.009,
        veinColor: colors.vein,
        veinAlpha: 0.32,
        highlightColor: "rgba(220,240,190,0.5)",
        highlightAlpha: 0.3,
        strokeColor: "rgba(16,36,16,0.42)",
        strokeWidth: 0.006,
      });
    }
  },
};
