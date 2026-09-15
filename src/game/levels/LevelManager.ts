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
import type { LevelDefinition, UnlockRequirement } from "./levelTypes";

export type LevelProgress = {
  /** The level the player last selected/played — a UI convenience, not an unlock gate. */
  currentLevelId: string;
  /** The furthest-along level currently unlocked, in LEVELS array order — for progress-bar-style UI. */
  highestUnlockedLevelId: string;
  completedLevelIds: string[];
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
    case "chapterCompleted": {
      const chapterLevels = LEVELS.filter((l) => l.chapter === req.chapter);
      return (
        chapterLevels.length > 0 &&
        chapterLevels.every((l) => progress.completedLevelIds.includes(l.id))
      );
    }
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

export type CompleteLevelResult = {
  progress: LevelProgress;
  /** True only the first time this levelId is completed — Law 2's gate. */
  isFirstCompletion: boolean;
  /** level.reward.coins on first completion, 0 on replay (Law 2 — "replay does not pay"). */
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
    progress: { ...progressAfter, highestUnlockedLevelId },
    isFirstCompletion,
    rewardCoins: isFirstCompletion ? level.reward.coins : 0,
    newlyUnlockedLevelIds,
  };
}

/** Selecting a level from a menu doesn't complete or unlock anything — just moves the "current" cursor (§15 "selected level if necessary"). */
export function selectLevel(levelId: string, progress: LevelProgress): LevelProgress {
  return { ...progress, currentLevelId: levelId };
}
