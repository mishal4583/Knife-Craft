/**
 * SAUCE COLOUR MATH (developer 2026-11-08, Sauce Station; plan docs/planning/SAUCE-STATION-MINIGAME-PLAN-2026-11-08.md §5.1). Pure: no state, no I/O.
 *
 * A mix is the TINT-WEIGHTED average of its parts in LINEAR light (far more natural than averaging sRGB bytes: yellow and blue do not make mud), turned
 * back into sRGB. How close two colours look is the CIE76 distance (ΔE) between them in CIELAB.
 */

export type Rgb = { r: number; g: number; b: number };
export type Lab = { l: number; a: number; b: number };

/** "#RRGGBB" to 0-255 channels. */
export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export const rgbToHex = ({ r, g, b }: Rgb): string =>
  "#" +
  [r, g, b]
    .map((v) =>
      Math.min(255, Math.max(0, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase();

/** sRGB channel (0-255) to linear light (0-1), and back. */
export const srgbToLinear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
export const linearToSrgb = (v: number): number => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, c * 255));
};

/** sRGB to CIELAB (D65). */
export function rgbToLab({ r, g, b }: Rgb): Lab {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** The CIE76 colour distance: 0 = the same; about 2 is the least a person can tell; 10-20 is clearly another colour. */
export function deltaE76(p: Lab, q: Lab): number {
  return Math.hypot(p.l - q.l, p.a - q.a, p.b - q.b);
}
export const deltaE = (a: Rgb, b: Rgb): number => deltaE76(rgbToLab(a), rgbToLab(b));

export type ColorPart = {
  color: Rgb;
  /** How much of it (units). */
  volume: number;
  /** How strongly it colours a mix (0 = clear like water or oil, 1 = a pure dye like turmeric). */
  tint: number;
};

/** The colour of a mix: the tint-weighted average in linear light. An empty mix is clear water. */
export function mixColors(parts: readonly ColorPart[]): Rgb {
  let w = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of parts) {
    const k = p.volume * p.tint;
    if (!(k > 0)) continue;
    w += k;
    r += k * srgbToLinear(p.color.r);
    g += k * srgbToLinear(p.color.g);
    b += k * srgbToLinear(p.color.b);
  }
  if (w <= 0) return { r: 215, g: 235, b: 240 };
  return { r: linearToSrgb(r / w), g: linearToSrgb(g / w), b: linearToSrgb(b / w) };
}

/** Matching in percent: 100 = the same colour, 0 = far apart (ΔE of 45 or more). */
export const matchPercent = (de: number): number =>
  Math.min(100, Math.max(0, Math.round(100 - 2.2 * de)));

export type Hint = { warmer: boolean; cooler: boolean; lighter: boolean; darker: boolean };

/**
 * Which way to go (so colour is never the only clue): a short hint from the Lab difference of the target minus the mix. "Warmer" = more red / yellow,
 * "cooler" = more green / blue, "lighter" / "darker" from the lightness. Small differences give no hint.
 */
export function colorHint(mix: Rgb, target: Rgb): Hint {
  const m = rgbToLab(mix);
  const t = rgbToLab(target);
  const dl = t.l - m.l;
  const warm = t.a + t.b * 0.6 - (m.a + m.b * 0.6);
  return { lighter: dl > 4, darker: dl < -4, warmer: warm > 4, cooler: warm < -4 };
}
