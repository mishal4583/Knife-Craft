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
import { KITCHEN_UPGRADE_CATALOG } from "../kitchen/kitchenUpgradeDefinitions";
import { LEVELS, CHAPTER_TITLES } from "./levelDefinitions";

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
 * level-ordered timeline. Deliberately reads the real catalogs directly
 * (knives/boards/café milestones/kitchen backgrounds) rather than only
 * the levels that happen to carry a literal `unlockReward` — a level with
 * no `unlockReward` of its own can still truthfully preview "here's
 * what's coming" by looking ahead on this same timeline. Every level
 * comes straight from its catalog's own `unlockLevel`/`levelRequired`;
 * nothing here invents one. The six kitchen backgrounds ARE the kitchen
 * progression (the separate Kitchen Investment purchases were retired
 * into them), so they appear here as real "look forward to" rewards.
 *
 * A name that already appears earlier on the timeline is not repeated:
 * two background tiers share a title with an earlier café milestone
 * ("Growing Kitchen", "Neighborhood Café"), and showing the same name
 * twice a few levels apart would read like a duplicate reward.
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
    ...KITCHEN_UPGRADE_CATALOG.filter((u) => u.unlockLevel > 1).map((u) => ({
      atLevel: u.unlockLevel,
      name: u.name,
      icon: "🏠",
    })),
  ];
  // Late game: every knife, board, café rank and kitchen stage is reached by
  // the last entry above (Lv 120), but the campaign keeps going — each new
  // cuisine chapter after that point is real new content, and Level 250 is
  // the campaign's finale. Both come straight from the level data.
  const lastCatalogReward = Math.max(...entries.map((e) => e.atLevel));
  const chapterStarts = new Map<number, number>();
  for (const l of LEVELS)
    if (!chapterStarts.has(l.chapter)) chapterStarts.set(l.chapter, levelNumber(l.id));
  for (const [chapter, first] of chapterStarts) {
    if (first > lastCatalogReward && CHAPTER_TITLES[chapter]) {
      entries.push({
        atLevel: first,
        name: `Chapter ${chapter} · ${CHAPTER_TITLES[chapter]}`,
        icon: "📖",
      });
    }
  }
  entries.push({ atLevel: LEVELS.length, name: "Campaign Finale", icon: "🏁" });
  // Stable sort keeps catalog order for same-level ties.
  const seen = new Set<string>();
  return entries
    .sort((a, b) => a.atLevel - b.atLevel)
    .filter((r) => (seen.has(r.name) ? false : (seen.add(r.name), true)));
}

let cachedTimeline: RewardPreview[] | null = null;
function rewardTimeline(): RewardPreview[] {
  if (!cachedTimeline) cachedTimeline = buildRewardTimeline();
  return cachedTimeline;
}

/** The whole merged timeline, level-ordered (read-only copy — for QA and any screen that lists it). */
export function getRewardTimeline(): readonly RewardPreview[] {
  return [...rewardTimeline()];
}

/** The next real reward strictly ahead of `levelNumber` — through the last cuisine chapter to the Campaign Finale (Level 250); null only once the campaign is finished. */
export function getNextRewardPreview(levelNumber: number): RewardPreview | null {
  return rewardTimeline().find((r) => r.atLevel > levelNumber) ?? null;
}

/**
 * The next timeline reward after `levelNumber` when — and only when — it is
 * a kitchen background (matched on the catalog's own name AND level, so a
 * café rank that merely shares a background's name never counts). Lets an
 * Order Board row whose hint is taken by the level's OWN reward still
 * announce the kitchen stage right behind it: Lv 40's Cleaver → Established
 * Kitchen (Lv 41), Lv 70's Pasta Kitchen → Flourishing Café (Lv 71), Lv 90's
 * Obsidian Knife → Grand Kitchen (Lv 91).
 */
export function getNextKitchenStagePreview(levelNumber: number): RewardPreview | null {
  const next = getNextRewardPreview(levelNumber);
  if (!next) return null;
  return KITCHEN_UPGRADE_CATALOG.some((u) => u.name === next.name && u.unlockLevel === next.atLevel)
    ? next
    : null;
}
