/**
 * THE KITCHEN'S LIFE (developer 2026-11-26, from his Gemini clip of the Grand kitchen: steam curling off the copper pot, warm lamps, sun through the arched window, a glint on the
 * copper, a slow push-in). Pure data: where each painted kitchen (the six stages, tall and wide) has its pots, lamps, window and copper, in percent of the PICTURE. The screen
 * (`components/kc/KitchenAmbient.tsx`) lays CSS transform / opacity animation over those points; nothing here touches money or state.
 *
 * A point is `{ x, y }` in percent of the picture's width and height. Steam rises from `pots` (the rim of a pot on the stove), `lamps` glow and breathe (`r` is the glow's width in
 * percent of the picture's width), the `window` throws a slow beam with a few dust motes, `glints` are the copper pans and the pans' rims that catch the light. `origin` is where
 * the slow push-in grows from (the stove).
 */
import type { KitchenSkinId } from "./kitchenUpgradeTypes";

/**
 * How many painted steam wisps (`public/kitchen-fx/steam-1..N.webp`, the Codex sheet FX-1) exist. 0 = none yet: the steam is drawn with CSS plumes. When the sheet is cut, set this
 * to the number of files and the plumes become the painted wisps (same motion); `kitchen-ambient-qa` fails if a counted file is missing.
 */
export const KITCHEN_STEAM_SPRITES = 6;

export type AmbientPoint = { x: number; y: number };
export type AmbientLamp = AmbientPoint & { r: number };
export type AmbientWindow = { x: number; y: number; w: number; h: number };
export type KitchenAmbientSpec = {
  pots: readonly AmbientPoint[];
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
      { x: 58.6, y: 50.5 },
      { x: 68.6, y: 49.5 },
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
      { x: 45, y: 53 },
      { x: 58.6, y: 52 },
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
      { x: 46.4, y: 52 },
      { x: 54.3, y: 54 },
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
      { x: 58.3, y: 56 },
      { x: 64.3, y: 57.5 },
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
      { x: 58.6, y: 56.5 },
      { x: 66, y: 59 },
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
      { x: 47.4, y: 55.5 },
      { x: 55.9, y: 57.5 },
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
      { x: 78.2, y: 46.5 },
      { x: 94, y: 46 },
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
      { x: 77.3, y: 49 },
      { x: 94.5, y: 48 },
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
      { x: 80.3, y: 47.5 },
      { x: 94, y: 48.5 },
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
      { x: 74.2, y: 47 },
      { x: 93, y: 48 },
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
    pots: [{ x: 87.9, y: 49 }],
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
    pots: [{ x: 69.7, y: 50.5 }],
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

/** The animation points of a kitchen stage in a layout (tall = the phone's portrait skin, wide = the landscape painting). */
export function kitchenAmbientFor(skin: KitchenSkinId, layout: AmbientLayout): KitchenAmbientSpec {
  return (layout === "wide" ? WIDE : TALL)[skin];
}

/** The size of the picture (width, height) a layout paints, to follow `object-cover`. */
export function ambientPictureSize(layout: AmbientLayout): { w: number; h: number } {
  return layout === "wide" ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 };
}

/**
 * Where a picture of `pic` lands in a box of `box` under `object-fit: cover` (centred): the rectangle the layer must follow so a point of the picture stays on the same pixel of the
 * painting whatever the window's shape. Pure; also used by the QA.
 */
export function coverRect(
  box: { w: number; h: number },
  pic: { w: number; h: number },
): { left: number; top: number; width: number; height: number } {
  const k = Math.max(box.w / pic.w, box.h / pic.h);
  const width = pic.w * k;
  const height = pic.h * k;
  return { left: (box.w - width) / 2, top: (box.h - height) / 2, width, height };
}
