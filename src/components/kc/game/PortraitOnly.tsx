import { useLayoutEffect } from "react";
import { registerPortraitOnly } from "./portraitOnlyStore";

/**
 * PORTRAIT-ONLY SCREENS (developer 2026-11-19: "find all the areas that can't be converted to landscape because there are no landscape assets and make them
 * back to the original size"). A screen whose picture is a portrait stage (a mini-game's room, the dishwashing sink) puts `<PortraitOnly art={...} />` in its
 * tree. While one is mounted, `GameShell` keeps the game at its original 9:16 size (a framed column in a wide window) instead of stretching, zooming or mirroring
 * the painting to fill the window (`fitLayout(..., portraitOnly)` in layoutMode.ts). `art` is the landscape picture of that screen's room (developer 2026-11-20,
 * `landscapeArt.ts`): the shell paints it across the whole window behind the stage, so there are no empty bars. Without `art` (a screen whose picture has not
 * been painted) the bars stay dark. It shows only in a wide window, where the frame exists; a phone never loads it.
 */
export function PortraitOnly({ art = null }: { art?: string | null }) {
  // layout effect: the shell is re-fitted before the first paint of the screen, so it never shows one frame stretched
  useLayoutEffect(() => registerPortraitOnly(art), [art]);
  return null;
}
