/** One-time progress migration from the original 250-level catalog. */
import type { LevelProgress } from "./LevelManager";
import {
  CAMPAIGN_150_OLD_TO_NEW_LEVEL,
  CAMPAIGN_150_SOURCE_LEVELS,
  LEGACY_CAMPAIGN_LEVELS,
  LEVELS,
} from "./levelDefinitions";
import { CAMPAIGN_150_SOURCE_LEVEL_NUMBERS } from "./campaignSelection";

export const CAMPAIGN_PROGRESS_VERSION = 3;

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

  // Version 2 already used the curated sequential numbering. The opening
  // tomato and cucumber tutorials have now been removed, so shift retained
  // progress down by two and let Garden Prep become the new Level 1.
  if ((progress.campaignVersion ?? 0) === 2) {
    const shiftId = (id: string | undefined): string | null => {
      const number = id ? oldNumber(id) : null;
      if (number === null) return null;
      return `level-${number <= 2 ? 1 : Math.min(LEVELS.length, number - 2)}`;
    };
    const shiftKeys = <T>(value: Record<string, T> | undefined): Record<string, T> | undefined => {
      if (!value) return undefined;
      const mapped: Record<string, T> = {};
      for (const [id, entry] of Object.entries(value)) {
        const number = oldNumber(id);
        if (number !== null && number >= 3 && number - 2 <= LEVELS.length)
          mapped[`level-${number - 2}`] = entry;
      }
      return mapped;
    };
    const completed = new Set<string>();
    for (const id of progress.completedLevelIds ?? []) {
      const number = oldNumber(id);
      if (number !== null && number >= 3 && number - 2 <= LEVELS.length)
        completed.add(`level-${number - 2}`);
    }
    if ((progress.completedLevelIds ?? []).includes("level-150"))
      for (const level of LEVELS) completed.add(level.id);
    const completedLevelIds = LEVELS.filter((level) => completed.has(level.id)).map((level) => level.id);
    let completedPrefix = 0;
    while (completed.has(`level-${completedPrefix + 1}`)) completedPrefix += 1;
    const nextUnlocked = Math.min(completedPrefix + 1, LEVELS.length);
    const currentLevelId = shiftId(progress.currentLevelId) ?? `level-${nextUnlocked}`;
    const oldHighest = oldNumber(progress.highestUnlockedLevelId ?? "") ?? 1;
    const highestLevel = Math.min(LEVELS.length, Math.max(oldHighest <= 2 ? 1 : oldHighest - 2, nextUnlocked));
    const next: LevelProgress = {
      ...progress,
      currentLevelId,
      highestUnlockedLevelId: `level-${highestLevel}`,
      completedLevelIds,
      campaignVersion: CAMPAIGN_PROGRESS_VERSION,
    };
    const paidOrders = shiftKeys(progress.paidOrders);
    const tickets = shiftKeys(progress.tickets);
    const menuGuests = shiftKeys(progress.menuGuests);
    const emergency = shiftKeys(progress.emergency);
    if (paidOrders) next.paidOrders = paidOrders;
    if (tickets) next.tickets = tickets;
    if (menuGuests) next.menuGuests = menuGuests;
    if (emergency) next.emergency = emergency;
    return next;
  }

  const completed = new Set<string>();
  for (const oldId of progress.completedLevelIds ?? []) {
    const next = newLevelForOldId(oldId);
    if (next) completed.add(`level-${next}`);
  }

  if ((progress.completedLevelIds ?? []).includes("level-250")) {
    for (const level of LEVELS) completed.add(level.id);
  }

  const completedLevelIds = LEVELS.filter((level) => completed.has(level.id)).map(
    (level) => level.id,
  );
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

  const next: LevelProgress = {
    ...progress,
    currentLevelId,
    highestUnlockedLevelId: `level-${highestLevel}`,
    completedLevelIds,
    campaignVersion: CAMPAIGN_PROGRESS_VERSION,
  };
  const paidOrders = mapKeyed(progress.paidOrders);
  const tickets = mapKeyed(progress.tickets);
  const menuGuests = mapKeyed(progress.menuGuests);
  const emergency = mapKeyed(progress.emergency);
  if (paidOrders) next.paidOrders = paidOrders;
  if (tickets) next.tickets = tickets;
  if (menuGuests) next.menuGuests = menuGuests;
  if (emergency) next.emergency = emergency;
  return next;
}
