/**
 * LEVEL_MANAGER — pure logic over level progression. No I/O of its own:
 * SaveManager remains the ONLY thing that touches storage (§15 — "do not
 * create LevelStorage/LevelSave... extend SaveManager"). This module just
 * answers questions about LEVELS + a LevelProgress snapshot, and computes
 * the next LevelProgress after a completion; the caller (App.tsx) is the
 * one that actually persists it, exactly like recipeProgress already
 * works today.
 *
 *   LevelManager
 *        ↓
 *   LevelDefinition (levelDefinitions.ts)
 *        ↓
 *   Objectives / Unlocks (levelTypes.ts)
 *        ↓
 *   existing Preparation flow (GameBridge / PreparationScene — untouched)
 *        ↓
 *   Recipe completion (RECIPE_COMPLETED)
 *        ↓
 *   existing Plating / chef hands (untouched)
 *        ↓
 *   Level completion (this module)
 *        ↓
 *   SaveManager (persistence)
 */
import { LEVELS } from "./levelDefinitions";
import { paidLevelReward } from "./levelRewards";
import type { LevelDefinition, UnlockRequirement } from "./levelTypes";
import { withoutPaidOrders } from "./paidOrders";
import { withoutServiceTickets } from "../restaurant/serviceTickets";
import { withoutMenuGuests } from "../restaurant/menuGuests";
import { withoutEmergency } from "../restaurant/emergencyService";

export type LevelProgress = {
  /** The level the player last selected/played — a UI convenience, not an unlock gate. */
  currentLevelId: string;
  /** The furthest-along level currently unlocked, in LEVELS array order — for progress-bar-style UI. */
  highestUnlockedLevelId: string;
  completedLevelIds: string[];
  /**
   * Orders already served and paid in a level not finished yet: recipe ids
   * per level id (levels/paidOrders.ts). Absent on older saves (nothing
   * recorded); a level's entry is dropped when it completes.
   */
  paidOrders?: Record<string, string[]>;
  /**
   * Unified Restaurant: a level's orders rolled before service (recipe ids
   * per level id, restaurant/serviceTickets.ts). Absent on older saves; a
   * level's entry is dropped when it completes.
   */
  tickets?: Record<string, string[]>;
  /** Unified Restaurant: menu guests already served in a level not finished yet (restaurant/menuGuests.ts). */
  menuGuests?: Record<string, number>;
  /**
   * Legacy (retired 2026-10-10, restaurant/emergencyService.ts): levels whose
   * service ran on Grandma's emergency goods. Ignored; dropped when the level
   * completes.
   * Absent on older saves; a level's entry is dropped when it completes.
   */
  emergency?: Record<string, true>;
};

export const DEFAULT_LEVEL_PROGRESS: LevelProgress = {
  currentLevelId: LEVELS[0]!.id,
  highestUnlockedLevelId: LEVELS[0]!.id,
  completedLevelIds: [],
};

export function getLevels(): LevelDefinition[] {
  return LEVELS;
}

export function getLevel(id: string): LevelDefinition | undefined {
  return LEVELS.find((l) => l.id === id);
}

function requirementMet(req: UnlockRequirement, progress: LevelProgress): boolean {
  switch (req.type) {
    case "always":
      return true;
    case "levelCompleted":
      return progress.completedLevelIds.includes(req.levelId);
    case "chapterCompleted":
      return isChapterComplete(req.chapter, progress);
    case "and":
      return req.requirements.every((r) => requirementMet(r, progress));
    case "or":
      return req.requirements.some((r) => requirementMet(r, progress));
  }
}

export function isUnlocked(level: LevelDefinition, progress: LevelProgress): boolean {
  return requirementMet(level.unlockRequirements, progress);
}

export function isCompleted(levelId: string, progress: LevelProgress): boolean {
  return progress.completedLevelIds.includes(levelId);
}

/**
 * True once every level belonging to `chapter` is in `completedLevelIds`
 * — extracted from the "chapterCompleted" unlock-requirement case above
 * (same computation, now shared instead of duplicated) so App.tsx's
 * chapter-boundary detection (Economy V2 Phase 4 — Kitchen Investment
 * upkeep) can reuse this exact, already-authoritative definition of
 * "chapter complete" rather than reimplementing it. Monotonic: once
 * true for a given progress, stays true for any later (more-completed)
 * progress — so a caller that only checks this on a level's OWN
 * first-time completion (completeLevel's `isFirstCompletion`) sees the
 * false→true transition at most once per chapter, ever.
 */
export function isChapterComplete(chapter: number, progress: LevelProgress): boolean {
  const chapterLevels = LEVELS.filter((l) => l.chapter === chapter);
  return chapterLevels.length > 0 && chapterLevels.every((l) => isCompleted(l.id, progress));
}

export type CompleteLevelResult = {
  progress: LevelProgress;
  /** True only the first time this levelId is completed — Law 2's gate. */
  isFirstCompletion: boolean;
  /** The level's paid completion reward in wallet cents (levelRewards.ts `paidLevelReward`) on first completion, 0 on replay (Law 2 — "replay does not pay"). */
  rewardCoins: number;
  /** Levels that became unlocked as a direct result of this completion (for a "New level unlocked!" toast, unused by Phase 4 UI but computed for future use). */
  newlyUnlockedLevelIds: string[];
};

/**
 * Called once a level's underlying recipe has actually completed (i.e.
 * after RECIPE_COMPLETED has already flowed through the existing
 * cutting/plating/chef-hands sequence — this function never runs
 * gameplay, only reacts to its result, §25).
 */
export function completeLevel(levelId: string, progress: LevelProgress): CompleteLevelResult {
  const level = getLevel(levelId);
  if (!level) {
    return { progress, isFirstCompletion: false, rewardCoins: 0, newlyUnlockedLevelIds: [] };
  }

  const alreadyCompleted = isCompleted(levelId, progress);
  const isFirstCompletion = !alreadyCompleted;
  const completedLevelIds = alreadyCompleted
    ? progress.completedLevelIds
    : [...progress.completedLevelIds, levelId];

  const wasUnlocked = new Set(LEVELS.filter((l) => isUnlocked(l, progress)).map((l) => l.id));
  const progressAfter: LevelProgress = { ...progress, completedLevelIds, currentLevelId: levelId };
  const nowUnlockedLevels = LEVELS.filter((l) => isUnlocked(l, progressAfter));
  const newlyUnlockedLevelIds = nowUnlockedLevels
    .filter((l) => !wasUnlocked.has(l.id))
    .map((l) => l.id);

  const highestUnlockedLevelId = nowUnlockedLevels.length
    ? nowUnlockedLevels[nowUnlockedLevels.length - 1]!.id
    : progress.highestUnlockedLevelId;

  return {
    progress: withoutEmergency(
      withoutMenuGuests(
        withoutServiceTickets(
          withoutPaidOrders({ ...progressAfter, highestUnlockedLevelId }, levelId),
          levelId,
        ),
        levelId,
      ),
      levelId,
    ),
    isFirstCompletion,
    rewardCoins: isFirstCompletion ? paidLevelReward(level) : 0,
    newlyUnlockedLevelIds,
  };
}

/** Selecting a level from a menu doesn't complete or unlock anything — just moves the "current" cursor (§15 "selected level if necessary"). */
export function selectLevel(levelId: string, progress: LevelProgress): LevelProgress {
  return { ...progress, currentLevelId: levelId };
}
