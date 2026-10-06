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
 *  - ENDLESS STARS: status earned by Endless Restaurant days (starsForDay,
 *    from the day's own profit, customer target and inspection), kept for
 *    life in `business.endlessStars`. Stars are progression only — no
 *    function here returns money, and nothing can spend them.
 *
 * Pure; nothing reads RESTAURANT_MODE. Shown on Restaurant Progress and
 * awarded by App.advanceBusinessDay (restaurant build, Endless days only).
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
 * ENDLESS STARS — up to three per completed Endless Restaurant day, read
 * from results the day already produces (no new threshold, no new economy):
 *  ★ PROFITABLE — the day's profit (its settlement's operating profit,
 *    specialist wages included) is above 0;
 *  ★ BUSY — no guest was turned away: every guest who wanted to eat that
 *    day (the demand BEFORE the team's capacity caps it — final economy
 *    pass; a capped target let a one-chef restaurant earn it every day)
 *    was served;
 *  ★ CLEAN — the day's inspection passed (End Business Day's existing
 *    inspection, which judges cleanliness from the day's own waste).
 * Stars are STATUS ONLY: nothing here reads or writes the wallet or the
 * ledger, and they can't be spent.
 */
export const ENDLESS_STARS_PER_DAY = 3;

export type DayStarInputs = {
  profit: number;
  ordersServed: number;
  /** The guests who wanted to eat that day, before the team's capacity (businessCustomersToday().demand). */
  customersWanted: number;
  /** The day's inspection result passed (End Business Day's own report). */
  inspectionPassed: boolean;
};

export type DayStars = {
  stars: number;
  profitable: boolean;
  busy: boolean;
  clean: boolean;
};

/** The stars a completed day earns (status only; never money). */
export function starsForDay(day: DayStarInputs): DayStars {
  const profitable = day.profit > 0;
  const busy = day.customersWanted > 0 && day.ordersServed >= day.customersWanted;
  const clean = day.inspectionPassed && day.ordersServed > 0;
  const stars = [profitable, busy, clean].filter(Boolean).length;
  return { stars: Math.min(stars, ENDLESS_STARS_PER_DAY), profitable, busy, clean };
}

/** Lifetime Endless stars, kept in `business.endlessStars` (never rolled off with the 30-day history). */
export type EndlessStarsState = {
  /** All stars earned. */
  total: number;
  /** Endless days completed. */
  days: number;
  /** The best single day (0–3). */
  bestDay: number;
};

const ZERO_STARS: EndlessStarsState = { total: 0, days: 0, bestDay: 0 };

const whole = (n: unknown, max = Number.MAX_SAFE_INTEGER) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0;

/** The lifetime stars of a save — zeros when it has none (an older save) or the value is damaged. */
export function endlessStarsOf(save: SaveData): EndlessStarsState {
  const raw = save.business.endlessStars;
  if (!raw || typeof raw !== "object") return { ...ZERO_STARS };
  return {
    total: whole(raw.total),
    days: whole(raw.days),
    bestDay: whole(raw.bestDay, ENDLESS_STARS_PER_DAY),
  };
}

/**
 * Records one completed Endless day's stars: adds them to the lifetime total
 * (and the day count / best day), and notes them on that day's record in the
 * 30-day history (its latest entry). Touches nothing else — no money, no
 * ledger, no stock.
 */
export function recordEndlessDayStars(save: SaveData, day: DayStars): SaveData {
  const life = endlessStarsOf(save);
  const history = save.business.finance.history;
  const latest = history?.[history.length - 1];
  return {
    ...save,
    business: {
      ...save.business,
      endlessStars: {
        total: life.total + day.stars,
        days: life.days + 1,
        bestDay: Math.max(life.bestDay, day.stars),
      },
      ...(history && latest
        ? {
            finance: {
              ...save.business.finance,
              history: [...history.slice(0, -1), { ...latest, stars: day.stars }],
            },
          }
        : {}),
    },
  };
}
