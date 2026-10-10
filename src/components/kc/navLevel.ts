import { createContext, useContext } from "react";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { isTabOpen, type LockableTab } from "@/game/restaurant/firstLevels";

/**
 * The player's reached level for the bottom bar's locks (restaurant build,
 * game/restaurant/firstLevels.ts). ScreensRouter provides it from the save;
 * null (no provider) leaves every section open.
 */
export const NavLevelContext = createContext<number | null>(null);

/** True when a bottom-bar section is open for the player (always in the classic build). */
export function useTabOpen(id: string): boolean {
  const reached = useContext(NavLevelContext);
  return !RESTAURANT_MODE || reached === null || isTabOpen(id, reached);
}

/**
 * Grandma's pointer at a section that just opened (firstLevels.ts
 * `sectionToPoint`): which tab, and how the player answers it. App provides
 * it only on the Kitchen with nothing else on screen; null = no pointer.
 */
export type NavGuide = { tab: LockableTab; dismiss: () => void } | null;
export const NavGuideContext = createContext<NavGuide>(null);
