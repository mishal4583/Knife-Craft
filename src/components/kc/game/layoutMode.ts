import { createContext, useContext } from "react";

/**
 * LAYOUT_MODE — portrait (the authored 540×960 look) or phone landscape
 * (developer 2026-10-22: "optimize the game for mobile landscape layout").
 * GameShell decides it from the viewport and sets <html data-orient>, which
 * drives the `land:` Tailwind variant (styles.css); components that need it
 * in code read `useLayoutMode()`.
 */
export type LayoutMode = "portrait" | "landscape";

/**
 * A phone on its side: clearly wider than tall and short. (Since 2026-11-19 every window clearly wider than tall gets the landscape layout, see `fitLayout`;
 * this stays the test for "a PHONE on its side", which the upright-only mini-games use for their "turn your phone" card.)
 */
export function isPhoneLandscape(width: number, height: number): boolean {
  return height > 0 && width / height >= 1.3 && height < 640;
}

/** The shortest height the landscape UI is laid out for; shorter screens scale it down. */
export const LAND_MIN_H = 320;
/** A landscape window taller than this is laid out at this height and scaled UP to fill the window (a 1080 px window: laid out at 720, scaled x1.5). */
export const LAND_TARGET_H = 720;
/** The aspect ratio (width / height) from which a window gets the landscape layout. */
export const LAND_ASPECT = 1.3;
/** A phone held upright (narrower than this and no wider than 3:4) gets the screen edge to edge at its own size. */
export const FILL_MAX_W = 640;
export const FILL_MAX_ASPECT = 0.75;
/** A portrait or square window is laid out at most this wide (and at least PORTRAIT_MIN_H tall) and scaled to fill the window. */
export const PORTRAIT_MAX_W = 768;
export const PORTRAIT_MIN_H = 600;
/** The narrowest width the portrait UI is laid out for (the smallest phone it is tested at). */
export const MIN_LAYOUT_W = 320;

/** Where the game sits when it is NOT the whole window: the largest 9:16 box that fits, centred, the rest left as dark bars (see `fitLayout`, `portraitOnly`). */
export type Frame = { x: number; y: number; w: number; h: number };
export type Fit = {
  landscape: boolean;
  lw: number;
  lh: number;
  scale: number;
  /** null: the game fills the window. Set: the game is a framed 9:16 column (a screen that has only portrait art). */
  frame: Frame | null;
};

/** The logical shape of the portrait game, the one every painted portrait stage is drawn for. */
export const PORTRAIT_W = 540;
export const PORTRAIT_H = 960;

/**
 * HOW THE GAME FILLS A WINDOW (developer 2026-11-19, Playgama 1.6.1 / 1.6.8 and YouTube Playables Design 1: "fills the available area ... in a square window
 * the game still fills the area, with no empty bars"). The game used to keep a framed 9:16 column in every window wider than an upright phone, with empty bars
 * round it. Now the window is ALWAYS filled edge to edge: the UI is laid out at a logical size (`lw` x `lh`, at least as big as the smallest layout it was drawn
 * for) and scaled by `scale` to cover the whole window, so nothing is stretched out of proportion and there are no bars.
 *  - an upright phone: the screen at its own size, scale 1 (below MIN_LAYOUT_W wide it is laid out at that width and scaled down);
 *  - wider than LAND_ASPECT (a phone on its side, a desktop, a tablet turned): the LANDSCAPE layout at a height of at most LAND_TARGET_H, scaled up to fill;
 *  - anything else (a tablet upright, a square window): the portrait layout at most PORTRAIT_MAX_W wide and at least PORTRAIT_MIN_H tall, scaled to fill.
 *
 * EXCEPTION (developer 2026-11-19: "find all the areas that can't be converted to landscape because there are no landscape assets and make them back to the
 * original size; only keep the areas that need no asset in landscape"): a screen whose picture exists only as a PORTRAIT painting (the mini-game stages, the
 * dishwashing sink, the service floor: `portraitOnly`) is NOT stretched, zoomed or mirrored to fill a wide window. It keeps its original size: the largest 9:16
 * box that fits, centred, with dark bars round it (`frame`). A phone held upright still gets the whole screen, and a phone on its side (`isPhoneLandscape`)
 * keeps the landscape layout those screens have always had (the upright-only mini-games cover it with their "turn your phone" card).
 */
export function fitLayout(width: number, height: number, portraitOnly = false): Fit {
  if (!(width > 0) || !(height > 0))
    return {
      landscape: false,
      lw: Math.max(0, width),
      lh: Math.max(0, height),
      scale: 1,
      frame: null,
    };
  const aspect = width / height;
  const uprightPhone = width < FILL_MAX_W && aspect <= FILL_MAX_ASPECT;
  if (portraitOnly && !uprightPhone && !isPhoneLandscape(width, height)) {
    const k = Math.min(width / PORTRAIT_W, height / PORTRAIT_H);
    const w = PORTRAIT_W * k;
    const h = PORTRAIT_H * k;
    // a frame narrower than the smallest layout is laid out at that width and scaled down, like an upright phone
    const scale = w < MIN_LAYOUT_W ? w / MIN_LAYOUT_W : 1;
    return {
      landscape: false,
      lw: w / scale,
      lh: h / scale,
      scale,
      frame: { x: (width - w) / 2, y: (height - h) / 2, w, h },
    };
  }
  if (aspect >= LAND_ASPECT) {
    let scale = Math.max(1, height / LAND_TARGET_H);
    if (height / scale < LAND_MIN_H) scale = height / LAND_MIN_H;
    return { landscape: true, lw: width / scale, lh: height / scale, scale, frame: null };
  }
  if (uprightPhone) {
    const scale = width < MIN_LAYOUT_W ? width / MIN_LAYOUT_W : 1;
    return { landscape: false, lw: width / scale, lh: height / scale, scale, frame: null };
  }
  let scale = Math.max(1, width / PORTRAIT_MAX_W);
  if (height / scale < PORTRAIT_MIN_H) scale = height / PORTRAIT_MIN_H;
  if (width / scale < MIN_LAYOUT_W) scale = width / MIN_LAYOUT_W;
  return { landscape: false, lw: width / scale, lh: height / scale, scale, frame: null };
}

export const LayoutContext = createContext<LayoutMode>("portrait");

export const useLayoutMode = () => useContext(LayoutContext);
export const useLandscape = () => useContext(LayoutContext) === "landscape";
