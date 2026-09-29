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
  upgradeCost,
} from "../knives/blacksmith";
import { STAFF_CATALOG } from "../economy/staffDefinitions";
import { paidLevelReward } from "../levels/levelRewards";
import { FAMILY_LEGACY_ID, FAMILY_LEGACY_REWARD, milestoneStatuses } from "./milestoneRewards";
import { lifetimeTotal } from "../economy/economyState";
import type { LedgerCategory } from "../economy/ledgerTypes";

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

export type Milestone = {
  id: string;
  label: string;
  done: boolean;
  atLevel?: number;
  /** One-time reward in wallet cents (Economy V2.5). */
  reward: number;
  /** True once the ledger shows the reward paid. */
  paid: boolean;
  /** Reached under the old economy (before rewards existed) — settled without payment. */
  waived: boolean;
};

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

  // Money — Economy V2.5: HISTORICAL figures are what actually happened,
  // read from the save's exact lifetime ledger totals (economy/
  // economyState.ts — updated by every ledger write, never trimmed; for a
  // save migrated from before V2.5 they were reconstructed from its own
  // progress, see economyMigration.ts). They are never recalculated with
  // today's reward rates. Business figures are Business Mode's own
  // lifetime totals.
  const total = (c: LedgerCategory) => lifetimeTotal(save.economy, c);
  const levelRewards = total("completion-reward");
  const lifetime = save.business.finance.lifetime;
  const businessRevenue = lifetime.revenue;
  const businessCosts =
    lifetime.inventoryPurchaseCost +
    lifetime.staffCost +
    lifetime.maintenanceCost +
    lifetime.supplierCost +
    lifetime.inspectionFines;
  const restaurantInvestment = -(
    total("knife-purchase") +
    total("board-purchase") +
    total("staff-purchase") +
    total("blacksmith-upgrade") +
    total("kitchen-investment-purchase") +
    total("refrigerator-purchase")
  );
  const finale = milestoneStatuses(save).find((m) => m.id === FAMILY_LEGACY_ID)!;
  // CURRENT-RATE figure (clearly labelled on screen): each completed level's
  // reward at today's rates (levelRewards.ts) — a chart of the reward curve,
  // not of historical payouts.
  const rewardCurve = completed
    .map((l) => ({ level: levelNumber(l.id), reward: paidLevelReward(l) }))
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

  // Milestones — Economy V2.5: each is a real game event read straight from
  // the save, with the one-time reward it pays (milestoneRewards.ts).
  const milestones: Milestone[] = milestoneStatuses(save).map((m) => ({
    id: m.id,
    label: m.label,
    done: m.reached,
    ...(m.atLevel !== undefined ? { atLevel: m.atLevel } : {}),
    reward: m.reward,
    paid: m.paid,
    waived: m.waived,
  }));

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
      businessCosts,
      businessCoverage: save.business.finance.lifetime.coverage,
      milestoneRewards: total("milestone-reward"),
      familyLegacy: total("family-legacy"),
      restaurantInvestment,
      totalSpent: restaurantInvestment + businessCosts,
      rewardCurve,
    },
    familyLegacy: {
      reward: FAMILY_LEGACY_REWARD,
      paid: finale.paid,
      /** The campaign was finished before the Final Reward existed (old save) — never paid. */
      waived: finale.waived,
    },
    /** "migration" — the historical totals were reconstructed when this save moved to Economy V2.5. */
    historySince: save.economy?.lifetimeSince ?? "start",
    nextGoal,
    milestones,
    benchmark: cityBenchmark(popularity),
  };
}
