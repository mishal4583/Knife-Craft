/**
 * EMERGENCY SERVICE (final economy pass, developer 2026-10-06): Grandma's
 * pantry and spares stay the safety net — a service can always start, the
 * wallet never goes below $0, nothing is owed. But a service that needed
 * them is an Emergency Service: its orders earn their recipe earnings with
 * NO quality bonus (restaurantEconomy.restaurantSettlement). Stocking
 * properly is better; running out is never game over.
 *
 * Recorded per level in the optional `levelProgress.emergency` (absent on
 * older saves = no emergency) and dropped when the level completes. Pure;
 * nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import type { LevelProgress } from "../levels/LevelManager";

export function isEmergencyService(progress: LevelProgress, levelId: string): boolean {
  return progress.emergency?.[levelId] === true;
}

/** Marks `levelId`'s service as an Emergency Service (idempotent). */
export function markEmergencyService(save: SaveData, levelId: string): SaveData {
  if (isEmergencyService(save.levelProgress, levelId)) return save;
  return {
    ...save,
    levelProgress: {
      ...save.levelProgress,
      emergency: { ...(save.levelProgress.emergency ?? {}), [levelId]: true },
    },
  };
}

export function withoutEmergency(progress: LevelProgress, levelId: string): LevelProgress {
  if (!progress.emergency || !(levelId in progress.emergency)) return progress;
  const rest = { ...progress.emergency };
  delete rest[levelId];
  return { ...progress, emergency: rest };
}
