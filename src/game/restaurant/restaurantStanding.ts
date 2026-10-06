/**
 * RESTAURANT_STANDING — the restaurant's long-term standing at a glance
 * (developer 2026-10-06), prepared for the Restaurant Progress screen; NOT a
 * currency and never touches the wallet. Built only from existing data:
 *
 *  - RANK: the café rank the campaign already awards (cafe/CAFE_MILESTONES,
 *    Humble Kitchen … Grand Service, via CafeProgressionManager);
 *  - STAGE: the restaurant stage of the latest system the restaurant runs
 *    (restaurantProgression.RESTAURANT_SYSTEMS: Apprentice Restaurant …
 *    Grand Service), with the next stage and its level;
 *  - RESTAURANT COMPLETE: every campaign level done (Level 250 included —
 *    isEndlessUnlocked, the existing rule). It unlocks the Endless
 *    Restaurant as a CONTINUATION: nothing is reset;
 *  - ENDLESS STARS: status earned by Endless Restaurant days
 *    (ENDLESS_STAR_RULES, provisional). Stars are progression only — no
 *    function here returns money, and nothing can spend them.
 *
 * Pure; nothing reads RESTAURANT_MODE. Not yet shown on screen (the next
 * gameplay phase wires it into Restaurant Progress).
 */
import type { SaveData } from "../SaveManager";
import type { LevelProgress } from "../levels/LevelManager";
import { getCafeProgress, getCurrentCafeMilestone } from "../cafe/CafeProgressionManager";
import { isEndlessUnlocked } from "../daily/EndlessServiceManager";
import type { BusinessDayRecord } from "../business/businessDayHistory";
import { LAST_CAMPAIGN_LEVEL, RESTAURANT_SYSTEMS } from "./restaurantProgression";
import { restaurantLevelOf } from "./restaurantMenu";

export type RestaurantStanding = {
  /** The café rank (title) and how far towards the next one, 0–1. */
  rank: string;
  rankProgress: number;
  /** The current restaurant stage and its number (1-based) of all stages. */
  stage: string;
  stageNumber: number;
  stageCount: number;
  /** The next stage and the level it opens at, or null at the last stage. */
  nextStage: { stage: string; level: number } | null;
  /** All campaign levels done (Level 250 included): the restaurant is complete. */
  complete: boolean;
  /** The Endless Restaurant is open (the same rule: the campaign is complete). */
  endlessUnlocked: boolean;
  /** The reached campaign level (1–250). */
  level: number;
};

/** The current stage for a reached level: the last system whose first level has been reached. */
function stageAt(level: number) {
  let index = 0;
  RESTAURANT_SYSTEMS.forEach((s, i) => {
    if (level >= s.firstLevel) index = i;
  });
  return index;
}

/** The restaurant's standing from its level progress. */
export function restaurantStanding(progress: LevelProgress): RestaurantStanding {
  const level = Math.min(restaurantLevelOf(progress), LAST_CAMPAIGN_LEVEL);
  const index = stageAt(level);
  const next = RESTAURANT_SYSTEMS[index + 1];
  const complete = isEndlessUnlocked(progress);
  return {
    rank: getCurrentCafeMilestone(progress).title,
    rankProgress: getCafeProgress(progress).progressFraction,
    stage: complete ? "Restaurant Complete" : RESTAURANT_SYSTEMS[index]!.stage,
    stageNumber: complete ? RESTAURANT_SYSTEMS.length + 1 : index + 1,
    stageCount: RESTAURANT_SYSTEMS.length + 1,
    nextStage: complete
      ? null
      : next
        ? { stage: next.stage, level: next.firstLevel }
        : { stage: "Restaurant Complete", level: LAST_CAMPAIGN_LEVEL },
    complete,
    endlessUnlocked: complete,
    level,
  };
}

/** True once the whole campaign (Level 250 included) is done. */
export function isRestaurantComplete(save: SaveData): boolean {
  return isEndlessUnlocked(save.levelProgress);
}

/**
 * ENDLESS STARS — up to three per completed Endless Restaurant day, from
 * that day's own record (businessDayHistory). PROVISIONAL thresholds, tuned
 * in the final economy pass:
 *  ★ a profitable day;
 *  ★ a busy day: at least `busyOrders` orders served;
 *  ★ a clean day: no waste (nothing spoiled or thrown out).
 */
export const ENDLESS_STAR_RULES = {
  busyOrders: 40,
  maxPerDay: 3,
} as const;

export type DayStars = {
  stars: number;
  profitable: boolean;
  busy: boolean;
  clean: boolean;
};

/** The stars a completed day earns (status only; never money). */
export function starsForDay(record: BusinessDayRecord): DayStars {
  const profitable = record.profit > 0;
  const busy = record.ordersServed >= ENDLESS_STAR_RULES.busyOrders;
  const clean = record.waste === 0 && record.ordersServed > 0;
  const stars = [profitable, busy, clean].filter(Boolean).length;
  return { stars: Math.min(stars, ENDLESS_STAR_RULES.maxPerDay), profitable, busy, clean };
}

/** The Endless stars a run of days earns, and the best day (status only). */
export function starsForDays(records: readonly BusinessDayRecord[]): {
  total: number;
  best: number;
} {
  let total = 0;
  let best = 0;
  for (const r of records) {
    const s = starsForDay(r).stars;
    total += s;
    best = Math.max(best, s);
  }
  return { total, best };
}
