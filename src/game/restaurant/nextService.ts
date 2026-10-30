/**
 * THE SERVICE LOOP (Phase 1, developer 2026-10-30): the player never picks a level.
 *
 *  - The Kitchen's one button, "Open for service", starts the NEXT service: the first unlocked
 *    level not completed yet (`nextServiceLevel`). Replays live on the Order Board only.
 *  - After a story card (or a reload) the player is back on the Kitchen and taps it again;
 *    nothing starts by itself.
 *  - Unlocks name how many services are left, never a level number (`servicesLeft`,
 *    `opensInText`, `lockBadge`): a feature that opens at level N is open once the furthest
 *    level reached (`restaurantLevelOf`) is N, so N − reached first services are still to play.
 *
 * Pure; reads only the level list and `levelProgress`. The wording lives in servicesToGo.ts (no
 * imports, so any game module can use it).
 */
import { getLevels, isCompleted, isUnlocked, type LevelProgress } from "@/game/levels/LevelManager";
import type { LevelDefinition } from "@/game/levels/levelTypes";

/** The next service's level, or null once every level is completed (the Endless Restaurant runs on). */
export function nextServiceLevel(progress: LevelProgress): LevelDefinition | null {
  return getLevels().find((l) => isUnlocked(l, progress) && !isCompleted(l.id, progress)) ?? null;
}

export { lockBadge, opensInText, servicesLeft } from "./servicesToGo";
