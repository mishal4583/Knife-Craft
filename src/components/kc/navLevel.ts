import { createContext, useContext } from "react";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { isTabOpen } from "@/game/restaurant/firstLevels";

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
