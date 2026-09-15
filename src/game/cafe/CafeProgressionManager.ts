/**
 * CAFE_PROGRESSION_MANAGER — pure logic answering "what stage of the café
 * has the player reached", mirroring LevelManager.ts's own style: every
 * function takes a `LevelProgress` snapshot (the SAME one LevelManager
 * already owns via SaveData.levelProgress) and derives an answer. No I/O,
 * no React, no Phaser, no new SaveData field — café progression is fully
 * derivable from the campaign progression that already exists.
 *
 *   LevelManager (LevelProgress)
 *        ↓
 *   CafeProgressionManager (this module)
 *        ↓
 *   CafeMilestoneDefinition (cafeDefinitions.ts)
 *        ↓
 *   unlocked café features
 *        ↓
 *   future Kitchen visual layer (NOT this phase)
 */
import type { LevelProgress } from "../levels/LevelManager";
import { CAFE_MILESTONES } from "./cafeDefinitions";
import type { CafeMilestoneDefinition, CafeUnlock, CafeUnlockType } from "./cafeTypes";

/** Level ids are formatted "level-N" — the same parsing KnifeManager/BoardManager already use for their own level-gated unlocks, kept consistent rather than inventing a second "café level" concept. */
function highestReachedLevelNumber(progress: LevelProgress): number {
  const match = /-(\d+)$/.exec(progress.highestUnlockedLevelId);
  return match ? Number(match[1]) : 1;
}

/** Milestones at or below the reached level, in ascending order — CAFE_MILESTONES is already sorted, this just filters it. */
function reachedMilestones(progress: LevelProgress): CafeMilestoneDefinition[] {
  const reached = highestReachedLevelNumber(progress);
  return CAFE_MILESTONES.filter((m) => m.levelRequired <= reached);
}

/** The most advanced milestone the player has reached. Always returns a value — Level 1's "Humble Kitchen" is the floor every save starts at. */
export function getCurrentCafeMilestone(progress: LevelProgress): CafeMilestoneDefinition {
  const reached = reachedMilestones(progress);
  return reached[reached.length - 1] ?? CAFE_MILESTONES[0]!;
}

/** The milestone immediately before the current one, if any (e.g. for a "you were at X, now Y" transition). */
export function getPreviousCafeMilestone(progress: LevelProgress): CafeMilestoneDefinition | null {
  const reached = reachedMilestones(progress);
  return reached.length > 1 ? reached[reached.length - 2]! : null;
}

/** The next milestone still ahead, or null once every defined milestone (currently up to Level 120) has been reached. */
export function getNextCafeMilestone(progress: LevelProgress): CafeMilestoneDefinition | null {
  const reached = highestReachedLevelNumber(progress);
  return CAFE_MILESTONES.find((m) => m.levelRequired > reached) ?? null;
}

/** Every café feature unlocked so far, flattened across every reached milestone. */
export function getUnlockedCafeFeatures(progress: LevelProgress): CafeUnlock[] {
  return reachedMilestones(progress).flatMap((m) => m.unlocks);
}

export function isCafeFeatureUnlocked(type: CafeUnlockType, progress: LevelProgress): boolean {
  return getUnlockedCafeFeatures(progress).some((u) => u.type === type);
}

export type CafeProgressSummary = {
  current: string;
  previous: string | null;
  next: string | null;
  nextLevel: number | null;
  unlockedFeatures: CafeUnlock[];
  /** 0..1 — how far between the current milestone and the next one the player's reached level sits. 1 once every defined milestone is reached (next is null). Derived, not stored, so a Kitchen-style progress bar has a ready number without needing its own level-id parsing. */
  progressFraction: number;
};

/** A single convenience snapshot for the future UI layer — everything getCurrentCafeMilestone/getNextCafeMilestone/getUnlockedCafeFeatures already compute, bundled together rather than duplicated. */
export function getCafeProgress(progress: LevelProgress): CafeProgressSummary {
  const current = getCurrentCafeMilestone(progress);
  const previous = getPreviousCafeMilestone(progress);
  const next = getNextCafeMilestone(progress);
  const reached = highestReachedLevelNumber(progress);
  const progressFraction = next
    ? Math.min(
        1,
        Math.max(
          0,
          (reached - current.levelRequired) / (next.levelRequired - current.levelRequired),
        ),
      )
    : 1;
  return {
    current: current.id,
    previous: previous?.id ?? null,
    next: next?.id ?? null,
    nextLevel: next?.levelRequired ?? null,
    unlockedFeatures: getUnlockedCafeFeatures(progress),
    progressFraction,
  };
}

// getKitchenSkinForLevel/getKitchenSkinForProgress (the previous phase's
// "level -> automatic background" mapping) are REMOVED — Phase 12B turned
// kitchen backgrounds into a real owned/equipped collection (see
// src/game/kitchen/), same architecture as knives/boards. Which
// background is DISPLAYED now depends on `SaveData.equippedKitchenUpgradeId`
// (KitchenUpgradeManager.getEquippedKitchenUpgrade), not directly on level
// progress. Level progress still determines which upgrades are OWNED
// (KitchenUpgradeDefinition.unlockLevel, granted automatically —
// KitchenUpgradeManager.syncKitchenUpgradeOwnership, Phase 14 removed the
// Café Coin purchase step), reusing the exact same
// highestReachedLevelNumber-from-"level-N" derivation this file's own
// milestone functions already use.
