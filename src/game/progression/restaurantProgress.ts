/**
 * RESTAURANT_PROGRESS — the read-only view model behind the Restaurant
 * Progress screen. Every value is DERIVED from systems that already exist
 * (level progress, café ranks, kitchen upgrades, knife/board ownership,
 * Blacksmith levels, Business popularity + lifetime finance, the wallet)
 * — no save field, no currency, no second progression system, and no
 * writes: nothing here returns a SaveData.
 *
 * The only non-derived data is CITY_BENCHMARK: fictional, fixed game-world
 * restaurants used purely as context for the player's real popularity.
 */
import type { SaveData } from "../SaveManager";
import { getLevels, isCompleted, isUnlocked } from "../levels/LevelManager";
import { CHAPTER_TITLES } from "../levels/levelDefinitions";
import { getNextRewardPreview, levelNumber, type RewardPreview } from "../levels/levelMastery";
import { CAFE_MILESTONES } from "../cafe/cafeDefinitions";
import { getCafeProgress } from "../cafe/CafeProgressionManager";
import {
  KITCHEN_UPGRADE_CATALOG,
  kitchenUpgradeOrDefault,
} from "../kitchen/kitchenUpgradeDefinitions";
import { KNIFE_CATALOG } from "../knives/knifeDefinitions";
import { BOARD_CATALOG } from "../boards/boardDefinitions";
import {
  BLACKSMITH_STATS,
  MAX_UPGRADE_LEVEL,
  MIN_UPGRADE_LEVEL,
  getKnifeUpgrades,
  knifeLevel,
} from "../knives/blacksmith";
import { STAFF_CATALOG } from "../economy/staffDefinitions";
import { dollars } from "../money";

/** Upgrade steps one knife can take: 3 stats × (5 − 1) levels. */
export const UPGRADE_STEPS_PER_KNIFE =
  BLACKSMITH_STATS.length * (MAX_UPGRADE_LEVEL - MIN_UPGRADE_LEVEL);

/** Fictional game-world benchmark restaurants — fixed values, never real players, never online. */
export const CITY_BENCHMARK: ReadonlyArray<{ name: string; popularity: number }> = [
  { name: "Golden Spoon", popularity: 96 },
  { name: "Hearth & Herb", popularity: 91 },
  { name: "The Green Table", popularity: 86 },
  { name: "Cozy Cravings", popularity: 78 },
  { name: "Copper Pot Bistro", popularity: 70 },
  { name: "Corner Crumb", popularity: 58 },
];

export const PLAYER_RESTAURANT_NAME = "Your Restaurant";

export type BenchmarkRow = { rank: number; name: string; popularity: number; isPlayer: boolean };

/** The player slots in by real popularity; an exact tie ranks the benchmark first (the player must beat it to pass it). Deterministic. */
export function cityBenchmark(playerPopularity: number): BenchmarkRow[] {
  const rows = CITY_BENCHMARK.map((r) => ({ ...r, isPlayer: false }));
  const at = rows.findIndex((r) => playerPopularity > r.popularity);
  rows.splice(at === -1 ? rows.length : at, 0, {
    name: PLAYER_RESTAURANT_NAME,
    popularity: playerPopularity,
    isPlayer: true,
  });
  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

export type Milestone = { label: string; done: boolean; atLevel?: number };

/** Popularity 0–100 as a 0–5 star rating (display only, rounded to the nearest star). */
export function popularityStars(popularity: number): number {
  return Math.max(0, Math.min(5, Math.round(popularity / 20)));
}

/** A short, honest line for the player's current Business popularity band. */
export function popularityMood(popularity: number): string {
  if (popularity >= 85) return "The whole city is talking about your restaurant.";
  if (popularity >= 65) return "Your restaurant is a local favourite.";
  if (popularity >= 45) return "Your restaurant is becoming more popular.";
  if (popularity >= 25) return "Word is slowly getting around — keep guests happy.";
  return "Few people know your restaurant yet — good service will change that.";
}

export type RestaurantProgress = ReturnType<typeof restaurantProgress>;

export function restaurantProgress(save: SaveData) {
  const progress = save.levelProgress;
  const levels = getLevels();
  const totalLevels = levels.length;
  const completed = levels.filter((l) => isCompleted(l.id, progress));
  const completedCount = completed.length;
  const campaignComplete = completedCount === totalLevels;
  // The level the player is on: the first unlocked, not-yet-completed one (the Kitchen's own "Today's Order" rule).
  const current =
    levels.find((l) => isUnlocked(l, progress) && !isCompleted(l.id, progress)) ??
    [...levels].reverse().find((l) => isUnlocked(l, progress)) ??
    levels[0]!;
  const reachedLevel = levelNumber(progress.highestUnlockedLevelId);
  const totalChapters = Math.max(...levels.map((l) => l.chapter));
  const chaptersCompleted = Array.from({ length: totalChapters }, (_, i) => i + 1).filter((c) =>
    levels.filter((l) => l.chapter === c).every((l) => isCompleted(l.id, progress)),
  ).length;
  const finalChapterStart = Math.min(
    ...levels.filter((l) => l.chapter === totalChapters).map((l) => levelNumber(l.id)),
  );

  // Recipes: every recipe a level serves (its own recipeId + any service pool), counted once.
  const recipesOf = (l: (typeof levels)[number]) => [l.recipeId, ...(l.recipePoolIds ?? [])];
  const allRecipes = new Set(levels.flatMap(recipesOf));
  const recipesCooked = new Set(completed.flatMap(recipesOf));

  // Café rank (existing CAFE_MILESTONES + CafeProgressionManager)
  const cafe = getCafeProgress(progress);
  const rank = CAFE_MILESTONES.find((m) => m.id === cafe.current) ?? CAFE_MILESTONES[0]!;
  const nextRank = cafe.next ? (CAFE_MILESTONES.find((m) => m.id === cafe.next) ?? null) : null;

  // Kitchen stages (existing kitchen upgrades; permanent, follow progress)
  const currentKitchen = kitchenUpgradeOrDefault(save.equippedKitchenUpgradeId);
  const kitchenStages = KITCHEN_UPGRADE_CATALOG.map((u) => ({
    id: u.id,
    name: u.name,
    unlockLevel: u.unlockLevel,
    asset: u.asset,
    reached: save.ownedKitchenUpgradeIds.includes(u.id),
    current: u.id === currentKitchen.id,
  }));

  // Knives + Blacksmith (existing ownership + knifeUpgrades)
  const knives = KNIFE_CATALOG.map((k) => {
    const owned = save.ownedKnifeIds.includes(k.id);
    const levelsFor = getKnifeUpgrades(save, k.id);
    return {
      knife: k,
      owned,
      equipped: save.equippedKnifeId === k.id,
      unlocked: reachedLevel >= k.unlockLevel,
      blacksmithLevel: owned ? knifeLevel(levelsFor) : null,
      upgradeSteps: owned ? knifeLevel(levelsFor) - 1 : 0,
    };
  });
  const ownedKnives = knives.filter((k) => k.owned);
  const upgradeSteps = ownedKnives.reduce((s, k) => s + k.upgradeSteps, 0);

  // Boards (existing ownership)
  const boards = BOARD_CATALOG.map((b) => ({
    board: b,
    owned: save.ownedBoardIds.includes(b.id),
    equipped: save.equippedBoardId === b.id,
    unlocked: reachedLevel >= b.unlockLevel,
  }));

  // Money — only figures the game can state exactly.
  //  • Level rewards: every completed level paid its own fixed reward exactly
  //    once (replays pay nothing), so this lifetime total is exact.
  //  • Business revenue: Business Mode's own lifetime total (not limited by
  //    the 200-entry ledger window).
  const levelRewards = completed.reduce((s, l) => s + dollars(l.reward.coins), 0);
  const businessRevenue = save.business.finance.lifetime.revenue;
  const rewardCurve = completed
    .map((l) => ({ level: levelNumber(l.id), reward: dollars(l.reward.coins) }))
    .sort((a, b) => a.level - b.level)
    .reduce<Array<{ level: number; cumulative: number }>>((acc, p) => {
      acc.push({ level: p.level, cumulative: (acc[acc.length - 1]?.cumulative ?? 0) + p.reward });
      return acc;
    }, []);

  const popularity = save.business.popularity.score;
  // Business calendar starts on Day 1; each ended day advances it by one.
  const businessDay = save.business.calendar.businessDay;
  const businessDaysRun = Math.max(0, businessDay - 1);

  // Next goal — the existing reward timeline; nothing after the campaign ends.
  const nextGoal: RewardPreview | null = campaignComplete
    ? null
    : getNextRewardPreview(reachedLevel);

  // Milestones — each one is a real game event read straight from the save
  // (completion, ownership, Blacksmith levels, the Business calendar); no
  // stored achievements. `atLevel` is shown on campaign-gated ones still ahead.
  const halfway = Math.ceil(totalLevels / 2);
  const firstKitchenUpgrade = KITCHEN_UPGRADE_CATALOG.find((u) => u.unlockLevel > 1);
  const milestones: Milestone[] = [
    { label: "First dish served", done: completedCount >= 1, atLevel: 1 },
    ...[10, 25, 50].map((n) => ({
      label: `Completed ${n} levels`,
      done: completedCount >= n,
      atLevel: n,
    })),
    ...(firstKitchenUpgrade
      ? [
          {
            label: `First kitchen upgrade — ${firstKitchenUpgrade.name}`,
            done: kitchenStages.some((s) => s.reached && s.unlockLevel > 1),
            atLevel: firstKitchenUpgrade.unlockLevel,
          },
        ]
      : []),
    { label: "First Blacksmith upgrade", done: upgradeSteps >= 1 },
    { label: "First Business day completed", done: businessDaysRun >= 1 },
    { label: "First staff member hired", done: save.ownedStaffIds.length >= 1 },
    ...KNIFE_CATALOG.filter((k) => k.unlockLevel > 1).map((k) => ({
      label: `${k.name} in your kit`,
      done: save.ownedKnifeIds.includes(k.id),
      atLevel: k.unlockLevel,
    })),
    {
      label: "Completed 100 levels",
      done: completedCount >= 100,
      atLevel: 100,
    },
    { label: "Halfway through the campaign", done: completedCount >= halfway, atLevel: halfway },
    ...[150, 200].map((n) => ({
      label: `Completed ${n} levels`,
      done: completedCount >= n,
      atLevel: n,
    })),
    {
      label: "Every kitchen stage reached",
      done: kitchenStages.every((s) => s.reached),
      atLevel: Math.max(...kitchenStages.map((s) => s.unlockLevel)),
    },
    {
      label: `Final chapter reached (Chapter ${totalChapters})`,
      done: reachedLevel >= finalChapterStart,
      atLevel: finalChapterStart,
    },
    {
      label: `Campaign complete (${totalLevels} levels)`,
      done: campaignComplete,
      atLevel: totalLevels,
    },
  ];

  return {
    restaurantName: PLAYER_RESTAURANT_NAME,
    level: {
      current: levelNumber(current.id),
      completed: completedCount,
      total: totalLevels,
      reached: reachedLevel,
    },
    chapter: {
      number: current.chapter,
      title: CHAPTER_TITLES[current.chapter] ?? "",
      total: totalChapters,
      completed: chaptersCompleted,
    },
    recipes: { cooked: recipesCooked.size, total: allRecipes.size },
    staff: { hired: save.ownedStaffIds.length, total: STAFF_CATALOG.length },
    business: { day: businessDay, daysRun: businessDaysRun },
    popularityStars: popularityStars(popularity),
    popularityMood: popularityMood(popularity),
    campaignComplete,
    rank: { title: rank.title, levelRequired: rank.levelRequired, fraction: cafe.progressFraction },
    nextRank: nextRank ? { title: nextRank.title, levelRequired: nextRank.levelRequired } : null,
    popularity,
    kitchen: { current: currentKitchen.name, stages: kitchenStages },
    knives,
    knivesOwned: ownedKnives.length,
    boards,
    boardsOwned: boards.filter((b) => b.owned).length,
    blacksmith: {
      upgradeSteps,
      maxForOwned: ownedKnives.length * UPGRADE_STEPS_PER_KNIFE,
      maxAll: KNIFE_CATALOG.length * UPGRADE_STEPS_PER_KNIFE,
    },
    money: {
      balance: save.credits,
      levelRewards,
      businessRevenue,
      businessCoverage: save.business.finance.lifetime.coverage,
      rewardCurve,
    },
    nextGoal,
    milestones,
    benchmark: cityBenchmark(popularity),
  };
}
