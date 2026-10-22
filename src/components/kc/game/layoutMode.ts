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
 * A phone on its side: clearly wider than tall and short. Tablets and desktop
 * windows (taller than 640) keep the framed portrait game.
 */
export function isPhoneLandscape(width: number, height: number): boolean {
  return height > 0 && width / height >= 1.3 && height < 640;
}

/** The shortest height the landscape UI is laid out for; shorter screens scale it down. */
export const LAND_MIN_H = 320;

export const LayoutContext = createContext<LayoutMode>("portrait");

export const useLayoutMode = () => useContext(LayoutContext);
export const useLandscape = () => useContext(LayoutContext) === "landscape";
