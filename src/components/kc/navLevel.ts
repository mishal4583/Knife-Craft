import { createContext } from "react";

/**
 * The player's reached level for the bottom bar's locks (restaurant build,
 * game/restaurant/firstLevels.ts). ScreensRouter provides it from the save;
 * null (no provider) leaves every section open.
 */
export const NavLevelContext = createContext<number | null>(null);
