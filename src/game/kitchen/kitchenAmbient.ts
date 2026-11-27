/**
 * THE KITCHEN'S LIFE (developer 2026-11-26, from his Gemini clip of the Grand kitchen: steam curling off the copper pot, warm lamps, sun through the arched window, a glint on the
 * copper, a slow push-in). Pure data: where each painted kitchen (the six stages, tall and wide) has its pots, lamps, window and copper, in percent of the PICTURE. The screen
 * (`components/kc/KitchenAmbient.tsx`) lays CSS transform / opacity animation over those points; nothing here touches money or state.
 *
 * A point is `{ x, y }` in percent of the picture's width and height. Steam pours off the LIDS of the `pots` (developer 2026-11-27: "the steam is not coming from side of the lid or on
 * top", then, with a reference picture of soft billowing steam, "make it exactly like this"): a simulated film of steam rising off the whole lid, rim to rim (`steamPlume`,
 * `STEAM_PLUME`). `lamps` glow and breathe (`r` is the glow's width in
 * percent of the picture's width), the `window` throws a slow beam with a few dust motes, `glints` are the copper pans and the pans' rims that catch the light. `origin` is where
 * the slow push-in grows from (the stove).
 */
import type { KitchenSkinId } from "./kitchenUpgradeTypes";

export type AmbientPoint = { x: number; y: number };
/**
 * A pot on the stove, measured on its painting. `x` is the middle of the lid and `y` the line where the lid sits on the pot (the rim the steam pours from); `top` is the lid's own
 * top surface (under its knob); `w` the lid's width; `base` the pot's foot on the burner. x and w are percent of the picture's WIDTH; y, top and base percent of its HEIGHT.
 * `open` is a pan with no lid: the steam rises off the food in it.
 */
export type AmbientPot = AmbientPoint & { top: number; w: number; base: number; open?: boolean };
export type AmbientLamp = AmbientPoint & { r: number };
export type AmbientWindow = { x: number; y: number; w: number; h: number };
export type KitchenAmbientSpec = {
  pots: readonly AmbientPot[];
  lamps: readonly AmbientLamp[];
  window: AmbientWindow;
  glints: readonly AmbientPoint[];
  origin: AmbientPoint;
};
export type AmbientLayout = "tall" | "wide";

const SKINS: readonly KitchenSkinId[] = [
  "skin-01",
  "skin-02",
  "skin-03",
  "skin-04",
  "skin-05",
  "skin-06",
];
export const KITCHEN_AMBIENT_SKINS = SKINS;

/** The wide (1920 x 1080) paintings. */
const WIDE: Record<KitchenSkinId, KitchenAmbientSpec> = {
  "skin-01": {
    pots: [
      { x: 58.97, y: 52.65, top: 51.8, w: 6.4, base: 58.5 },
      { x: 68.55, y: 50.55, top: 49.75, w: 6.5, base: 58.7 },
    ],
    lamps: [],
    window: { x: 1, y: 0, w: 13, h: 58 },
    glints: [
      { x: 57.3, y: 35.5 },
      { x: 62.7, y: 36.6 },
    ],
    origin: { x: 63, y: 52 },
  },
  "skin-02": {
    pots: [
      { x: 45.56, y: 54.5, top: 53.7, w: 6.64, base: 59.9 },
      { x: 58.45, y: 53.1, top: 52.4, w: 5.9, base: 59.6 },
    ],
    lamps: [],
    window: { x: 1, y: 0, w: 13, h: 58 },
    glints: [
      { x: 44, y: 38 },
      { x: 50.5, y: 38 },
      { x: 63, y: 37.5 },
    ],
    origin: { x: 54, y: 54 },
  },
  "skin-03": {
    pots: [
      { x: 47.0, y: 54.0, top: 53.1, w: 6.5, base: 59.4 },
      { x: 54.4, y: 56.7, top: 56.0, w: 4.4, base: 60.1 },
    ],
    lamps: [],
    window: { x: 2, y: 0, w: 14, h: 62 },
    glints: [
      { x: 42, y: 37 },
      { x: 46, y: 36 },
      { x: 50, y: 34.5 },
    ],
    origin: { x: 50, y: 55 },
  },
  "skin-04": {
    pots: [
      { x: 57.05, y: 56.95, top: 56.1, w: 5.8, base: 62.0 },
      { x: 64.8, y: 59.7, top: 59.1, w: 4.2, base: 62.6 },
    ],
    lamps: [
      { x: 57.9, y: 32, r: 9 },
      { x: 80.3, y: 32.5, r: 9 },
    ],
    window: { x: 2, y: 0, w: 14, h: 62 },
    glints: [
      { x: 43.6, y: 42 },
      { x: 47.1, y: 40 },
    ],
    origin: { x: 61, y: 58 },
  },
  "skin-05": {
    pots: [
      { x: 58.9, y: 57.55, top: 57.05, w: 6.3, base: 62.5 },
      { x: 66.2, y: 61.4, top: 61.4, w: 6.4, base: 63.5, open: true },
    ],
    lamps: [
      { x: 54, y: 30.5, r: 9 },
      { x: 69, y: 31.7, r: 9 },
      { x: 16.9, y: 24.6, r: 6 },
    ],
    window: { x: 0, y: 0, w: 17, h: 66 },
    glints: [
      { x: 44.3, y: 38 },
      { x: 47.9, y: 34.8 },
    ],
    origin: { x: 62, y: 58 },
  },
  "skin-06": {
    pots: [
      { x: 47.9, y: 57.0, top: 56.65, w: 5.65, base: 61.8 },
      { x: 55.4, y: 59.1, top: 58.55, w: 3.95, base: 61.8 },
    ],
    lamps: [
      { x: 49.7, y: 38, r: 9 },
      { x: 59.3, y: 39.3, r: 9 },
      { x: 18.6, y: 31, r: 6 },
      { x: 96.9, y: 23.4, r: 6 },
      { x: 74.3, y: 53.8, r: 6 },
    ],
    window: { x: 0, y: 0, w: 18, h: 68 },
    glints: [
      { x: 50, y: 32 },
      { x: 56, y: 30 },
      { x: 62, y: 31.5 },
    ],
    origin: { x: 47, y: 58 },
  },
};

/** The tall (1080 x 1920) paintings: a phone. */
const TALL: Record<KitchenSkinId, KitchenAmbientSpec> = {
  "skin-01": {
    pots: [
      { x: 78.25, y: 47.35, top: 46.75, w: 12.9, base: 51.4 },
      { x: 96.3, y: 46.1, top: 45.5, w: 14.0, base: 51.4 },
    ],
    lamps: [],
    window: { x: 0, y: 0, w: 18, h: 52 },
    glints: [
      { x: 72, y: 30 },
      { x: 85, y: 31 },
    ],
    origin: { x: 85, y: 48 },
  },
  "skin-02": {
    pots: [
      { x: 77.5, y: 50.0, top: 49.4, w: 12.5, base: 53.9 },
      { x: 91.9, y: 52.1, top: 51.7, w: 9.1, base: 54.8 },
    ],
    lamps: [],
    window: { x: 0, y: 0, w: 20, h: 52 },
    glints: [
      { x: 70, y: 31 },
      { x: 78, y: 32 },
    ],
    origin: { x: 85, y: 50 },
  },
  "skin-03": {
    pots: [
      { x: 79.8, y: 48.3, top: 47.7, w: 12.85, base: 52.7 },
      { x: 93.15, y: 50.65, top: 50.2, w: 8.35, base: 53.6 },
    ],
    lamps: [],
    window: { x: 0, y: 0, w: 22, h: 54 },
    glints: [
      { x: 66, y: 32 },
      { x: 76, y: 31 },
    ],
    origin: { x: 86, y: 50 },
  },
  "skin-04": {
    pots: [
      { x: 80.1, y: 47.75, top: 47.1, w: 12.25, base: 52.2 },
      { x: 92.7, y: 50.2, top: 49.7, w: 7.4, base: 53.0 },
    ],
    lamps: [
      { x: 80.3, y: 25.6, r: 14 },
      { x: 18, y: 26, r: 9 },
    ],
    window: { x: 0, y: 0, w: 22, h: 54 },
    glints: [
      { x: 62, y: 32 },
      { x: 72, y: 31 },
    ],
    origin: { x: 84, y: 50 },
  },
  "skin-05": {
    pots: [{ x: 91.15, y: 50.3, top: 50.05, w: 13.0, base: 55.0 }],
    lamps: [
      { x: 81.8, y: 26.8, r: 14 },
      { x: 95.5, y: 30.7, r: 12 },
      { x: 18, y: 27.3, r: 9 },
    ],
    window: { x: 0, y: 0, w: 22, h: 56 },
    glints: [
      { x: 64, y: 31 },
      { x: 74, y: 30 },
    ],
    origin: { x: 88, y: 50 },
  },
  "skin-06": {
    pots: [
      { x: 70.7, y: 51.2, top: 50.9, w: 12.35, base: 55.2 },
      { x: 84.0, y: 52.8, top: 52.5, w: 8.5, base: 55.4 },
    ],
    lamps: [
      { x: 78.8, y: 35.8, r: 14 },
      { x: 95.5, y: 36.7, r: 12 },
      { x: 18, y: 32.4, r: 9 },
    ],
    window: { x: 0, y: 0, w: 22, h: 58 },
    glints: [
      { x: 62, y: 28 },
      { x: 76, y: 27 },
    ],
    origin: { x: 72, y: 52 },
  },
};

/**
 * THE STEAM IS A FILM (developer 2026-11-27, a reference picture: "make it exactly like this"): `public/kitchen-fx/plume.webp`, `cols` x `rows` frames of soft billowing steam that loop
 * seamlessly, made by a fluid simulation (`scripts/make-steam-plume.py`). In every frame the middle of the lid's rim line is at (`rimX`, `rimY`) and the lid is `lidW` of the frame wide
 * (fractions of the frame); nothing hangs below it. `kitchen-ambient-qa` checks these numbers against the script; `kitchenambient.mjs` K6 checks the picture.
 */
export const STEAM_PLUME = {
  file: "kitchen-fx/plume.webp",
  cols: 10,
  rows: 6,
  frameW: 160,
  frameH: 260,
  rimX: 0.5,
  rimY: 0.91,
  lidW: 0.56,
  /** One loop, in seconds: 125 ms a frame, exact in the browser's clock, so the picture's columns and rows never slip apart. */
  seconds: 7.5,
} as const;

export type SteamPlume = {
  /** The point of the painting the middle of the lid's rim sits on (percent of the width, percent of the height). */
  x: number;
  y: number;
  /** The film frame's width, in percent of the painting's width: sized by the pot's own lid. */
  width: number;
  /** How full it is: the pots further along the stove steam a little less, as in the reference. */
  strength: number;
  /** How far into the loop it starts, in seconds (whole frames), so two pots never puff together. */
  offset: number;
};

const STRENGTH = [1, 0.86, 0.74] as const;
/** Frames between one pot's loop and the next one's. */
const APART = 21;

/** The steam of one pot (the `index`-th on its stove). */
export function steamPlume(pot: AmbientPot, index: number): SteamPlume {
  const frame = STEAM_PLUME.seconds / (STEAM_PLUME.cols * STEAM_PLUME.rows);
  return {
    x: pot.x,
    y: pot.y,
    width: Math.round((pot.w / STEAM_PLUME.lidW) * 1000) / 1000,
    strength: STRENGTH[index] ?? STRENGTH[STRENGTH.length - 1]!,
    offset: ((index * APART) % (STEAM_PLUME.cols * STEAM_PLUME.rows)) * frame,
  };
}

/**
 * How the painting sits when the window cuts its sides: 0.5 centred, 1 kept to its right edge. A tall phone cuts about a tenth off each side of the portrait painting; kept to the RIGHT,
 * the stove stays on screen and the main lid clears the Kitchen's column of round buttons (the left side lies under the info cards anyway).
 */
export const ambientAlignX = (layout: AmbientLayout): number => (layout === "wide" ? 0.5 : 1);
/** A wide window shorter than this is a phone on its side. */
export const SHORT_WIDE_BOX = 520;
/**
 * The same, up and down: 0.5 centred, 1 kept to its bottom edge. A phone on its side cuts the top and bottom of the wide painting, and the day strip and the order card lie over its lower
 * half; kept to the BOTTOM there, the stove rises, so the lids stay above the strip (what is cut then is the top shelf, under the info cards).
 */
export const ambientAlignY = (layout: AmbientLayout, boxHeight: number): number =>
  layout === "wide" && boxHeight < SHORT_WIDE_BOX ? 1 : 0.5;

/** The animation points of a kitchen stage in a layout (tall = the phone's portrait skin, wide = the landscape painting). */
export function kitchenAmbientFor(skin: KitchenSkinId, layout: AmbientLayout): KitchenAmbientSpec {
  return (layout === "wide" ? WIDE : TALL)[skin];
}

/** The size of the picture (width, height) a layout paints, to follow `object-cover`. */
export function ambientPictureSize(layout: AmbientLayout): { w: number; h: number } {
  return layout === "wide" ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 };
}

/**
 * Where a picture of `pic` lands in a box of `box` under `object-fit: cover` (`alignX` 0.5: centred; 1: kept to its right edge, as `object-position`):
 * the rectangle the layer must follow so a point of the picture stays on the same pixel of the
 * painting whatever the window's shape. Pure; also used by the QA.
 */
export function coverRect(
  box: { w: number; h: number },
  pic: { w: number; h: number },
  alignX = 0.5,
  alignY = 0.5,
): { left: number; top: number; width: number; height: number } {
  const k = Math.max(box.w / pic.w, box.h / pic.h);
  const width = pic.w * k;
  const height = pic.h * k;
  return { left: (box.w - width) * alignX, top: (box.h - height) * alignY, width, height };
}
