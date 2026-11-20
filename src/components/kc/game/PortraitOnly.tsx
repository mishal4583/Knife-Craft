import { useLayoutEffect } from "react";
import { registerPortraitOnly } from "./portraitOnlyStore";

/**
 * PORTRAIT-ONLY SCREENS (developer 2026-11-19: "find all the areas that can't be converted to landscape because there are no landscape assets and make them
 * back to the original size"). A screen whose picture is a portrait stage (a mini-game's room, the dishwashing sink) puts `<PortraitOnly art={...} />` in its
 * tree. While one is mounted, `GameShell` keeps the game at its original 9:16 size (a framed column in a wide window) instead of stretching, zooming or mirroring
 * the painting to fill the window (`fitLayout(..., portraitOnly)` in layoutMode.ts). `art` is the landscape picture of that screen's room (developer 2026-11-20,
 * `landscapeArt.ts`): the shell paints it across the whole window behind the stage, so there are no empty bars. Without `art` (a screen whose picture has not
 * been painted) the bars stay dark. It shows only in a wide window, where the frame exists; a phone never loads it.
 * `wideOnly` (the Kitchen home and the maps, developer 2026-11-20): the 9:16 box is for a window wide enough for the landscape layout only; a tablet or a window
 * that is already portrait-shaped keeps filling the screen with the portrait layout, as those screens always did.
 */
export function PortraitOnly({
  art = null,
  wideOnly = false,
}: {
  art?: string | null;
  wideOnly?: boolean;
}) {
  // layout effect: the shell is re-fitted before the first paint of the screen, so it never shows one frame stretched
  useLayoutEffect(() => registerPortraitOnly(art, wideOnly), [art, wideOnly]);
  return null;
}
