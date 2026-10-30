import { createContext, useContext } from "react";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { isTabOpen, type LockableTab } from "@/game/restaurant/firstLevels";
import type { AttentionBadges } from "@/game/restaurant/attentionBadges";
import { lockBadge, opensInText } from "@/game/restaurant/servicesToGo";
import { LAST_CAMPAIGN_LEVEL } from "@/game/restaurant/restaurantProgression";

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
 * Unlock copy (Phase 1, developer 2026-10-30): the restaurant build never names a level — it
 * says how many services are left (restaurant/nextService.ts). The classic build keeps its
 * level numbers, word for word.
 *  - `when(n)` follows "opens" / "unlocks": "in 3 services" (classic "at Level 3");
 *  - `badge(n)`: "🔒 3 services" (classic "🔒 Lv 3"); `lv(n)` / `level(n)`: "in 3 services"
 *    (classic "Lv 3" / "Level 3");
 *  - `final`: "after the final service" (classic "after Level 148"); `noun`: "Service" / "Level".
 */
export function useUnlockText() {
  const reached = useContext(NavLevelContext);
  return unlockText(RESTAURANT_MODE && reached !== null ? reached : null);
}

/** `useUnlockText` outside a provider: `reached` = the save's reached level, null = classic wording. */
export function unlockText(reached: number | null) {
  const live = reached !== null;
  const soon = (n: number) => opensInText(n, reached ?? 0);
  return {
    live,
    when: (n: number) => (live ? soon(n) : `at Level ${n}`),
    badge: (n: number) => (live ? lockBadge(n, reached) : `🔒 Lv ${n}`),
    lv: (n: number) => (live ? soon(n) : `Lv ${n}`),
    level: (n: number) => (live ? soon(n) : `Level ${n}`),
    final: live ? "after the final service" : `after Level ${LAST_CAMPAIGN_LEVEL}`,
    noun: live ? "Service" : "Level",
  };
}

/**
 * Grandma's pointer at a section that just opened (firstLevels.ts
 * `sectionToPoint`): which tab, and how the player answers it. App provides
 * it only on the Kitchen with nothing else on screen; null = no pointer.
 */
export type NavGuide = { tab: LockableTab; dismiss: () => void } | null;
export const NavGuideContext = createContext<NavGuide>(null);

/** Current live attention counts for the shared bottom navigation and restaurant map. */
export const NavAttentionContext = createContext<AttentionBadges>({ nav: {}, map: {}, mapSymbols: {} });
