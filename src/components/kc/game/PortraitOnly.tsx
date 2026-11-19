import { useLayoutEffect } from "react";
import { countPortraitOnly } from "./portraitOnlyStore";

/**
 * PORTRAIT-ONLY SCREENS (developer 2026-11-19: "find all the areas that can't be converted to landscape because there are no landscape assets and make them
 * back to the original size"). A screen whose picture exists only as a portrait painting (a mini-game's room, the dishwashing sink) puts `<PortraitOnly />`
 * in its tree. While one is mounted, `GameShell` keeps the game at its original 9:16 size (a framed column with dark bars in a wide window) instead of
 * stretching, zooming or mirroring the painting to fill the window (`fitLayout(..., portraitOnly)` in layoutMode.ts). A screen that needs no picture, or has a
 * landscape one, never mounts it and fills the window as before. When a landscape painting is delivered for a screen, remove its `<PortraitOnly />`.
 */
export function PortraitOnly() {
  // layout effect: the shell is re-fitted before the first paint of the screen, so it never shows one frame stretched
  useLayoutEffect(() => {
    countPortraitOnly(1);
    return () => countPortraitOnly(-1);
  }, []);
  return null;
}
