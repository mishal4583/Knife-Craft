/**
 * LEVEL_MASTERY — progression-pass addition, corrected. Pure derivations
 * only, no new save state: every function here reads data that already
 * exists (SaveData.recipeProgress, the knife/board catalogs,
 * CAFE_MILESTONES) and computes a display-ready answer, exactly like
 * CafeProgressionManager.ts already does for café milestones. Nothing
 * here mutates a save or invents a second progression system.
 *
 * CORRECTIVE PASS — the star/percentage mastery system this file
 * originally added (`starsForScore`, `MASTERY_LABEL`) is REMOVED. Design
 * doc Law 4 ("the plate is the score" — no stars, no visible percentage
 * as a level-success readout) was never actually superseded; it's
 * reinstated as written. What's left:
 *  - `isPrepared` — a plain boolean "has this recipe ever been
 *    completed" read straight off `recipeProgress[id].done`, which
 *    ALREADY existed before this progression pass (Phase 5) — the
 *    Cookbook's "Prepared" stamp needs no new persistence at all.
 *  - `describeDifficulty` — a pre-play-only, WORD-based effort label
 *    (never a number, never a star, never derived from any score), kept
 *    because "why should I play the next level" is still a legitimate
 *    question; it just isn't answered with a star row.
 */
import type { LevelDefinition } from "./levelTypes";
import { KNIFE_CATALOG } from "../knives/knifeDefinitions";
import { BOARD_CATALOG } from "../boards/boardDefinitions";
import { CAFE_MILESTONES } from "../cafe/cafeDefinitions";

/**
 * The Cookbook's "Prepared" stamp — a plain, permanent, binary fact (has
 * this recipe ever been completed), never a graded/numeric rating. Reads
 * `recipeProgress[recipeId].done`, a field SaveManager has persisted
 * since before this progression pass existed (App.tsx's
 * recordPreparationResult sets it `true` on every completion, replay
 * included) — no new save field.
 */
export function isPrepared(
  recipeProgress: Record<string, { best: number | null; done: boolean }>,
  recipeId: string,
): boolean {
  return recipeProgress[recipeId]?.done ?? false;
}

/**
 * Phase 3 — the Cookbook-correct version of `isPrepared` for a whole
 * LEVEL rather than one fixed recipe id. A "Level ≠ Recipe" level
 * (levelTypes.ts's `recipePoolIds`, brief §3/§40/§41) can be completed
 * via any recipe the order generator actually drew from its pool —
 * checking only the level's own compat `recipeId` would understate
 * "Prepared" (that field is a stable bookkeeping id, not necessarily
 * the recipe that was actually played). Checks every pool id instead;
 * falls back to the plain `recipeId` check for every level this phase
 * doesn't touch (41-120), which have no `recipePoolIds` at all.
 */
export function isLevelPrepared(
  recipeProgress: Record<string, { best: number | null; done: boolean }>,
  level: LevelDefinition,
): boolean {
  if (level.recipePoolIds?.length) {
    return level.recipePoolIds.some((id) => isPrepared(recipeProgress, id));
  }
  return isPrepared(recipeProgress, level.recipeId);
}

/**
 * A level-select-only, pre-play effort label — plain words, never a
 * number, never a star, never derived from `recipeProgress`/any score
 * (that would be a mastery rating, which Law 4 rules out). Cheap
 * heuristic over data the level already has (step count, whether it
 * juggles multiple destinations, how deep into the campaign it sits) so
 * it stays correct automatically if a level's own step count ever
 * changes — not new hand-authored per-level data.
 */
export function describeDifficulty(
  level: LevelDefinition,
): "Quick" | "Standard" | "Involved" | "Ambitious" {
  const steps = level.preparationSteps.length;
  const branching = level.destinations.length > 1 ? 1 : 0;
  const chapterFactor = Math.min(2, Math.floor((level.chapter - 1) / 5));
  const raw = Math.round(steps / 2.5) + branching + chapterFactor;
  const tier = Math.max(1, Math.min(4, raw));
  return (["Quick", "Standard", "Involved", "Ambitious"] as const)[tier - 1]!;
}

/** Level ids are formatted "level-N" — same parsing convention Board/Knife/KitchenUpgradeManager already each keep their own copy of; this is the one the new level-select UI reaches for instead of adding a fifth copy. */
export function levelNumber(levelId: string): number {
  const match = /-(\d+)$/.exec(levelId);
  return match ? Number(match[1]) : 1;
}

/** One entry in the merged "what unlocks next" timeline — see getNextRewardPreview. */
export type RewardPreview = {
  atLevel: number;
  name: string;
  icon: string;
};

/**
 * Every real, catalog-backed reward in the game, merged into one
 * level-ordered timeline. Deliberately reads the THREE real catalogs
 * directly (knives/boards/café milestones) rather than only the levels
 * that happen to carry a literal `unlockReward` — a level with no
 * `unlockReward` of its own can still truthfully preview "here's what's
 * coming" by looking ahead on this same timeline. Kitchen upgrades are
 * excluded on purpose: every tier is granted silently/automatically
 * (KitchenUpgradeManager.syncKitchenUpgradeOwnership) with no equivalent
 * "look, a new thing" moment in any existing screen, so surfacing them
 * here would be a new kind of announcement this pass didn't ask for.
 */
function buildRewardTimeline(): RewardPreview[] {
  const entries: RewardPreview[] = [
    ...KNIFE_CATALOG.filter((k) => k.unlockLevel > 1).map((k) => ({
      atLevel: k.unlockLevel,
      name: k.name,
      icon: "🔪",
    })),
    ...BOARD_CATALOG.filter((b) => b.unlockLevel > 1).map((b) => ({
      atLevel: b.unlockLevel,
      name: b.name,
      icon: "🪵",
    })),
    ...CAFE_MILESTONES.filter((m) => m.levelRequired > 1).map((m) => ({
      atLevel: m.levelRequired,
      name: m.title,
      icon: "🏆",
    })),
  ];
  return entries.sort((a, b) => a.atLevel - b.atLevel);
}

let cachedTimeline: RewardPreview[] | null = null;
function rewardTimeline(): RewardPreview[] {
  if (!cachedTimeline) cachedTimeline = buildRewardTimeline();
  return cachedTimeline;
}

/** The next real reward strictly ahead of `levelNumber`, or null once every catalog reward has been reached (past Level 120). */
export function getNextRewardPreview(levelNumber: number): RewardPreview | null {
  return rewardTimeline().find((r) => r.atLevel > levelNumber) ?? null;
}
