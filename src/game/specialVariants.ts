import type { IngredientId } from "./definitions";

/**
 * SPECIAL_VARIANTS — Phase 3 (D, developer 2026-10-21): now and then an
 * ingredient arrives as a special version of itself — a Golden Tomato, a
 * Giant Cucumber, a Rainbow Carrot, a Frosted Onion or Grandma's Heirloom
 * Pepper. A variant is the SAME ingredient (same id, technique, cuts,
 * scoring, stock and price) drawn differently: a recolour painted over the
 * ingredient's own texture and clipped to its silhouette, so the pieces
 * and the plate carry it (pieces are cut from that texture), plus coloured
 * flecks on each cut, and the Giant Cucumber is drawn bigger. Nothing is
 * saved, unlocked, paid or collected.
 *
 * WHEN: counted per browser session over orders that could have one — an
 * order (not one teaching a technique) containing one of the five base ingredients.
 * Every EVERY-th such order gets the variant of its FIRST base ingredient
 * (in step order). Deterministic: the same play gives the same variants.
 */
export type VariantId =
  "golden-tomato" | "giant-cucumber" | "rainbow-carrot" | "frosted-onion" | "heirloom-pepper";

export const VARIANTS: Record<
  VariantId,
  { base: IngredientId; name: string; emoji: string; sizeScale: number; fleck: number }
> = {
  "golden-tomato": {
    base: "tomato",
    name: "Golden Tomato",
    emoji: "🍅",
    sizeScale: 1,
    fleck: 0xf6c84a,
  },
  "giant-cucumber": {
    base: "cucumber",
    name: "Giant Cucumber",
    emoji: "🥒",
    sizeScale: 1.3,
    fleck: 0x9ccf6a,
  },
  "rainbow-carrot": {
    base: "carrot",
    name: "Rainbow Carrot",
    emoji: "🥕",
    sizeScale: 1,
    fleck: 0xb36ad8,
  },
  "frosted-onion": {
    base: "onion",
    name: "Frosted Onion",
    emoji: "🧅",
    sizeScale: 1,
    fleck: 0xcfe6ff,
  },
  "heirloom-pepper": {
    base: "pepper",
    name: "Grandma's Heirloom Pepper",
    emoji: "🫑",
    sizeScale: 1,
    fleck: 0x8a1f3d,
  },
};

export const VARIANT_CADENCE = { EVERY: 3 } as const;

const BY_BASE = new Map<IngredientId, VariantId>(
  (Object.keys(VARIANTS) as VariantId[]).map((id) => [VARIANTS[id].base, id]),
);

export function variantOf(ingredientId: IngredientId): VariantId | null {
  return BY_BASE.get(ingredientId) ?? null;
}

let ordersWithBase = 0;
let forced: VariantId | null = null;

/** Decides this order's variant (or none) and advances the session's counter. Call once per order. */
export function variantForOrder(
  eligible: boolean,
  ingredientIds: readonly IngredientId[],
): VariantId | null {
  if (!eligible) return null;
  if (forced) {
    // Development hook only (kitchenChaos.ts): the counter stays as it is.
    const id = forced;
    forced = null;
    return ingredientIds.includes(VARIANTS[id].base) ? id : null;
  }
  const first = ingredientIds.map(variantOf).find((v) => v !== null) ?? null;
  if (!first) return null;
  ordersWithBase += 1;
  return ordersWithBase % VARIANT_CADENCE.EVERY === 0 ? first : null;
}

/** Test hook: a fresh session. */
export function resetVariantsForTests(): void {
  ordersWithBase = 0;
  forced = null;
}

/** Makes the next eligible order with `id`'s base ingredient get it (null clears it). For the browser tests' development hook. */
export function forceNextVariant(id: VariantId | null): void {
  forced = id;
}

/** "a Golden Tomato" / "an …" for the Knife Report's line. */
export function withArticle(name: string): string {
  return (/^[AEIOU]/.test(name) ? "an " : "a ") + name;
}

// ── painting ────────────────────────────────────────────────────────────
// A variant keeps everything the painter drew — shape, shading, highlights,
// a tomato's green calyx, a carrot's leafy top — and moves only the
// ingredient's own skin colour to the variant's: a per-pixel hue map over
// the pixels whose hue says "skin". Then a few marks (sparkles, frost,
// stripes) inside the silhouette only.

type Hsl = [h: number, s: number, l: number];

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Hue inside [from, to] (degrees, wrapping through 0 when from > to). */
const hueIn = (h: number, from: number, to: number) =>
  from <= to ? h >= from && h <= to : h >= from || h <= to;

/**
 * Re-colours the skin pixels: every pixel that is visible, coloured enough
 * (saturation ≥ 0.18) and inside the hue band goes through `map`
 * (which also gets the pixel's x as a 0–1 fraction, for a gradient).
 */
function remapSkin(
  ctx: CanvasRenderingContext2D,
  band: [from: number, to: number],
  map: (hsl: Hsl, fx: number) => Hsl,
): void {
  const { width: w, height: h } = ctx.canvas;
  if (!(w > 0 && h > 0)) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 8) continue;
    const hsl = rgbToHsl(d[i]!, d[i + 1]!, d[i + 2]!);
    if (hsl[1] < 0.18 || !hueIn(hsl[0], band[0], band[1])) continue;
    const [nh, ns, nl] = map(hsl, ((i / 4) % w) / w);
    const [r, g, b] = hslToRgb(nh, clamp01(ns), clamp01(nl));
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
}

/** Small marks drawn on top, inside the silhouette only (source-atop). Positions come from a fixed seed. */
function speckle(
  ctx: CanvasRenderingContext2D,
  count: number,
  seed: number,
  draw: (c: CanvasRenderingContext2D, x: number, y: number, r: number) => void,
): void {
  const { width: w, height: h } = ctx.canvas;
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  for (let i = 0; i < count; i++)
    draw(
      ctx,
      w * (0.15 + rand() * 0.7),
      h * (0.15 + rand() * 0.7),
      (0.008 + rand() * 0.014) * Math.max(w, h),
    );
  ctx.restore();
}

/** Rainbow carrot: purple at the crown, through red and orange, to gold at the tip. */
const RAINBOW: [at: number, hue: number][] = [
  [0, 275],
  [0.35, 345],
  [0.7, 25],
  [1, 48],
];
function rainbowHue(fx: number): number {
  for (let i = 1; i < RAINBOW.length; i++) {
    const [a, ha] = RAINBOW[i - 1]!;
    const [b, hb] = RAINBOW[i]!;
    if (fx <= b) {
      const t = (fx - a) / (b - a);
      const d = ((hb - ha + 540) % 360) - 180; // the short way round the wheel
      return ha + d * t;
    }
  }
  return RAINBOW[RAINBOW.length - 1]![1];
}

/** Paints `id`'s look over the ingredient texture already on `ctx`. */
export function paintVariantOverlay(ctx: CanvasRenderingContext2D, id: VariantId): void {
  switch (id) {
    case "golden-tomato":
      // reds -> warm gold (the green calyx keeps its colour)
      remapSkin(ctx, [330, 30], ([, s, l]) => [43, s * 1.1, l * 1.03]);
      speckle(ctx, 8, 0x601d, (c, x, y, r) => {
        c.fillStyle = "rgba(255,250,220,0.9)";
        c.beginPath();
        c.moveTo(x, y - r * 1.6);
        c.lineTo(x + r * 0.4, y);
        c.lineTo(x, y + r * 1.6);
        c.lineTo(x - r * 0.4, y);
        c.closePath();
        c.fill();
      });
      break;
    case "giant-cucumber":
      // the same green, deeper, with pale warts — its size is the point (sizeScale)
      remapSkin(ctx, [60, 170], ([h, s, l]) => [h, s * 1.05, l * 0.9]);
      speckle(ctx, 14, 0xc0c, (c, x, y, r) => {
        c.fillStyle = "rgba(225,242,196,0.6)";
        c.beginPath();
        c.arc(x, y, r * 0.6, 0, Math.PI * 2);
        c.fill();
      });
      break;
    case "rainbow-carrot":
      // oranges -> purple, red, orange and gold along its length (the leafy top stays green)
      remapSkin(ctx, [0, 50], ([, s, l], fx) => [rainbowHue(fx), s * 0.9, l * (0.78 + 0.22 * fx)]);
      break;
    case "frosted-onion":
      // the papery skin -> frosted lilac-blue, with rime
      remapSkin(ctx, [290, 60], ([, s, l]) => [212, Math.max(s * 0.6, 0.38), l * 0.78 + 0.2]);
      speckle(ctx, 40, 0xf205, (c, x, y, r) => {
        c.fillStyle = "rgba(255,255,255,0.75)";
        c.beginPath();
        c.arc(x, y, r * 0.55, 0, Math.PI * 2);
        c.fill();
      });
      break;
    case "heirloom-pepper":
      // red -> deep heirloom burgundy, with darker ribs
      remapSkin(ctx, [330, 40], ([, s, l]) => [342, s * 0.9, l * 0.78]);
      speckle(ctx, 6, 0x4e1, (c, x, _y, r) => {
        c.fillStyle = "rgba(60,10,30,0.22)";
        c.fillRect(x - r * 0.8, 0, r * 1.6, c.canvas.height);
      });
      break;
  }
}
