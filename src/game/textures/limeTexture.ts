/**
 * LIME_TEXTURE — the lemon verbatim, palette moved to citrus green (see
 * lemonTexture.ts's own doc for the shared rind/pith/wedge/membrane/
 * vesicle scaffold and why it was reworked for realism — proportional
 * bands instead of fixed-px insets, real filled wedges instead of a flat
 * disc with lines over it). Genuinely its own ingredient/geometry
 * (LIME_GEOMETRY in definitions.ts), never an alias — this file only
 * imports the shared paint function, Lemon's own file is untouched.
 */
import { paintCitrusTexture } from "./lemonTexture";

export function limeTextureSize(rx: number, ry: number, margin: number): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintLimeTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
): void {
  paintCitrusTexture(ctx, rx, ry, margin, {
    rindStops: [
      [0, "#A8C94A"],
      [0.58, "#7FAE31"],
      [1, "#537D1C"],
    ],
    poreColor: "rgba(58,84,14,0.22)",
    pithColor: "#F4F6E2",
    fleshStops: [
      [0, "#EAF4BE"],
      [0.7, "#D8EA95"],
      [1, "#C4DB78"],
    ],
    fleshAlt: "rgba(196,219,120,0.32)",
    membrane: "rgba(246,250,226,0.95)",
    vesicle: "rgba(255,255,255,0.45)",
    coreColor: "#F2F7DC",
    highlight: "#FBFFEA",
    rimStroke: "rgba(240,250,210,0.55)",
    salt: 29,
  });
}
