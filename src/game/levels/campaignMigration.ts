/** One-time progress migration from the original 250-level catalog. */
import type { LevelProgress } from "./LevelManager";
import {
  CAMPAIGN_150_OLD_TO_NEW_LEVEL,
  CAMPAIGN_150_SOURCE_LEVELS,
  LEGACY_CAMPAIGN_LEVELS,
  LEVELS,
} from "./levelDefinitions";
import { CAMPAIGN_150_SOURCE_LEVEL_NUMBERS } from "./campaignSelection";

export const CAMPAIGN_PROGRESS_VERSION = 2;

function sourceRecipeIds(level: (typeof LEGACY_CAMPAIGN_LEVELS)[number]): string[] {
  return [...(level.batchGroupRecipeIds ?? level.recipePoolIds ?? [level.recipeId])].sort();
}

function contentKey(level: (typeof LEGACY_CAMPAIGN_LEVELS)[number]): string {
  return JSON.stringify({
    recipes: sourceRecipeIds(level),
    orders: level.requiredOrders ?? 1,
    batch: Boolean(level.batchGroupRecipeIds),
  });
}

const selectedByContent = new Map<string, number[]>();
for (let index = 0; index < CAMPAIGN_150_SOURCE_LEVELS.length; index += 1) {
  const key = contentKey(CAMPAIGN_150_SOURCE_LEVELS[index]!);
  const levels = selectedByContent.get(key) ?? [];
  levels.push(index + 1);
  selectedByContent.set(key, levels);
}

function oldNumber(id: string): number | null {
  const match = /^level-(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

/** Exact same recipe pool and service shape can map; merely similar ingredients cannot. */
function newLevelForOldId(id: string): number | null {
  const number = oldNumber(id);
  if (!number || number < 1 || number > LEGACY_CAMPAIGN_LEVELS.length) return null;
  const direct = CAMPAIGN_150_OLD_TO_NEW_LEVEL[number];
  if (direct) return direct;
  const matches = selectedByContent.get(contentKey(LEGACY_CAMPAIGN_LEVELS[number - 1]!));
  if (!matches?.length) return null;
  return matches.reduce((best, candidate) =>
    Math.abs(CAMPAIGN_150_SOURCE_LEVEL_NUMBERS[candidate - 1]! - number) <
    Math.abs(CAMPAIGN_150_SOURCE_LEVEL_NUMBERS[best - 1]! - number)
      ? candidate
      : best,
  );
}

function mapKeyed<T>(value: Record<string, T> | undefined): Record<string, T> | undefined {
  if (!value) return undefined;
  const mapped: Record<string, T> = {};
  for (const [oldId, entry] of Object.entries(value)) {
    const next = newLevelForOldId(oldId);
    if (next) mapped[`level-${next}`] = entry;
  }
  return mapped;
}

/**
 * The migration never pays money or changes unrelated save fields. Completion
 * history transfers only for a retained level or an exact recipe-pool match.
 * An old Level 250 completion means the old campaign was fully complete, so
 * every new level is marked complete to retain the ending and Endless access.
 */
export function migrateCampaignProgress(progress: LevelProgress): LevelProgress {
  if ((progress.campaignVersion ?? 0) >= CAMPAIGN_PROGRESS_VERSION) return progress;

  const completed = new Set<string>();
  for (const oldId of progress.completedLevelIds ?? []) {
    const next = newLevelForOldId(oldId);
    if (next) completed.add(`level-${next}`);
  }

  if ((progress.completedLevelIds ?? []).includes("level-250")) {
    for (const level of LEVELS) completed.add(level.id);
  }

  const completedLevelIds = LEVELS.filter((level) => completed.has(level.id)).map((level) => level.id);
  const completedPrefix = (() => {
    let count = 0;
    while (count < LEVELS.length && completed.has(`level-${count + 1}`)) count += 1;
    return count;
  })();
  const nextUnlocked = Math.min(completedPrefix + 1, LEVELS.length);
  const oldCurrent = progress.currentLevelId ? newLevelForOldId(progress.currentLevelId) : null;
  const currentLevelId = oldCurrent ? `level-${oldCurrent}` : `level-${nextUnlocked}`;
  const oldHighest = progress.highestUnlockedLevelId
    ? newLevelForOldId(progress.highestUnlockedLevelId)
    : null;
  const highestLevel = Math.min(LEVELS.length, Math.max(oldHighest ?? nextUnlocked, nextUnlocked));

  return {
    ...progress,
    currentLevelId,
    highestUnlockedLevelId: `level-${highestLevel}`,
    completedLevelIds,
    paidOrders: mapKeyed(progress.paidOrders),
    tickets: mapKeyed(progress.tickets),
    menuGuests: mapKeyed(progress.menuGuests),
    emergency: mapKeyed(progress.emergency),
    campaignVersion: CAMPAIGN_PROGRESS_VERSION,
  };
}
