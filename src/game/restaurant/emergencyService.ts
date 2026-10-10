/**
 * EMERGENCY SERVICE — retired (developer 2026-10-10). It marked a service
 * that ran on Grandma's pantry or spares, and such a service earned no
 * quality bonus. Grandma no longer lends from Level 10 — a short service is
 * covered by a rewarded ad or supplier credit (serviceCover.ts) and earns
 * its full pay — so nothing sets the mark any more.
 *
 * Older saves may still carry `levelProgress.emergency`; it is ignored, and
 * dropped from a level when that level completes (LevelManager), so it
 * fades away by itself. Pure; nothing reads RESTAURANT_MODE.
 */
import type { LevelProgress } from "../levels/LevelManager";

export function withoutEmergency(progress: LevelProgress, levelId: string): LevelProgress {
  if (!progress.emergency || !(levelId in progress.emergency)) return progress;
  const rest = { ...progress.emergency };
  delete rest[levelId];
  return { ...progress, emergency: rest };
}
