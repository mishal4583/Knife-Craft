/**
 * THE RESTAURANT'S PRESTIGE (the "Chef Pride" plan, Phase 4, developer 2026-11-23: "look what I built").
 *
 * A long-term standing for the RESTAURANT itself (the chef's own titles are `progression/chefTitles.ts`). Five named tiers, from "Neighbourhood Spot" to "Living Legend",
 * worked out from five things the game already keeps, in prestige points:
 *   the kitchen stage       20 points a stage beyond the first
 *   the city ranking         3 points a place climbed
 *   popularity               2 points a point above the starting 50 (0 below it: a bad night never takes prestige away)
 *   spotless services        1 point each, up to 60
 *   Endless stars            1 point for every 2 stars, up to 50
 * Nothing here is bought, spent or paid: it is derived each time from the save, never stored, and moves no money. Which tier-ups were already announced is kept as short
 * markers in `chefRecord.seen` (`prestige:<tier>`), so each is announced once and a tier is never lost.
 *
 * The tier names, the weights and the thresholds are drafts for the developer to tune after real data (docs/planning/CHEF-PRIDE-MEASUREMENT-2026-11-23.md): change them here
 * only. Cosmetic rewards (a name plaque, Kitchen trophies) need painted art and are not part of this build: the tier name and its card are the reward for now.
 *
 * Pure and deterministic: no clock, no random, no wallet.
 */
import type { SaveData } from "../SaveManager";
import { chefRecordOf, hasSeen, markSeen } from "./chefRecord";
import { cityRanking } from "./cityRanking";
import { endlessStarsOf, restaurantStanding } from "./restaurantStanding";
import { restaurantRecordOf } from "./serviceReport";

/** The prestige card opens with this level (the first stages are the first lessons). */
export const PRESTIGE_FROM_LEVEL = 5;

export type PrestigeTier = {
  /** 0 for the starting tier. */
  index: number;
  name: string;
  /** One short line of how it feels. */
  feel: string;
  /** Points needed to be in this tier. */
  from: number;
};

export const PRESTIGE_TIERS: readonly PrestigeTier[] = [
  { index: 0, name: "Neighbourhood Spot", feel: "Where every restaurant starts.", from: 0 },
  { index: 1, name: "Local Favourite", feel: "The street knows you.", from: 90 },
  { index: 2, name: "City Landmark", feel: "People travel for your food.", from: 220 },
  { index: 3, name: "Culinary Destination", feel: "Critics write about you.", from: 380 },
  { index: 4, name: "Living Legend", feel: "The restaurant is a story.", from: 520 },
];

export const STAGE_POINTS = 20;
export const PLACE_POINTS = 3;
export const POPULARITY_POINTS = 2;
export const POPULARITY_START = 50;
export const SPOTLESS_POINTS_MAX = 60;
export const ENDLESS_POINTS_MAX = 50;

export type PrestigePart = {
  id: "stage" | "ranking" | "popularity" | "spotless" | "endless";
  label: string;
  value: string;
  points: number;
};

export type Prestige = {
  points: number;
  tier: PrestigeTier;
  /** The next tier, or null at the top. */
  next: PrestigeTier | null;
  /** 0-1 progress from this tier's threshold to the next (1 at the top). */
  fraction: number;
  /** Where the points came from, in a fixed order. */
  parts: PrestigePart[];
};

const whole = (n: number) => Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));

/** The restaurant's prestige, derived from the save. */
export function restaurantPrestige(save: SaveData): Prestige {
  const standing = restaurantStanding(save.levelProgress);
  const city = cityRanking(save);
  const popularity = whole(save.business.popularity?.score ?? POPULARITY_START);
  const spotless = whole(restaurantRecordOf(save).spotless);
  const stars = whole(endlessStarsOf(save).total);
  const climbed = whole(city.total - city.rank);
  const parts: PrestigePart[] = [
    {
      id: "stage",
      label: "Kitchen stage",
      value: `${standing.stageNumber} of ${standing.stageCount}`,
      points: whole(standing.stageNumber - 1) * STAGE_POINTS,
    },
    {
      id: "ranking",
      label: "City ranking",
      value: `#${city.rank}`,
      points: climbed * PLACE_POINTS,
    },
    {
      id: "popularity",
      label: "Popularity",
      value: String(popularity),
      points: whole(popularity - POPULARITY_START) * POPULARITY_POINTS,
    },
    {
      id: "spotless",
      label: "Spotless services",
      value: String(spotless),
      points: Math.min(spotless, SPOTLESS_POINTS_MAX),
    },
    {
      id: "endless",
      label: "Endless stars",
      value: String(stars),
      points: Math.min(Math.floor(stars / 2), ENDLESS_POINTS_MAX),
    },
  ];
  const points = parts.reduce((t, p) => t + p.points, 0);
  const tier = [...PRESTIGE_TIERS].reverse().find((t) => points >= t.from) ?? PRESTIGE_TIERS[0]!;
  const next = PRESTIGE_TIERS[tier.index + 1] ?? null;
  return {
    points,
    tier,
    next,
    fraction: next ? Math.min(1, Math.max(0, (points - tier.from) / (next.from - tier.from))) : 1,
    parts,
  };
}

/** The marker kept in `chefRecord.seen` once a tier was announced. */
export const prestigeSeenId = (tierIndex: number): string => `prestige:${tierIndex}`;

/**
 * Announces a tier reached: the save with every tier up to the current one marked as seen, and the tier to celebrate (the highest not announced yet), or null.
 * The starting tier is never announced; an old save that is already several tiers up is told about the highest one only, once.
 */
export function announcePrestige(save: SaveData): {
  save: SaveData;
  headline: PrestigeTier | null;
} {
  const now = restaurantPrestige(save).tier;
  let rec = chefRecordOf(save);
  let headline: PrestigeTier | null = null;
  for (const t of PRESTIGE_TIERS) {
    if (t.index === 0 || t.index > now.index) continue;
    if (!hasSeen(rec, prestigeSeenId(t.index))) {
      rec = markSeen(rec, prestigeSeenId(t.index));
      headline = t;
    }
  }
  if (!headline) return { save, headline: null };
  return { save: { ...save, business: { ...save.business, chefRecord: rec } }, headline };
}
