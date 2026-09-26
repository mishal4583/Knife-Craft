/**
 * POPULARITY_MANAGER — Economy V3 Phase 6. Deterministic scoring for
 * every factor the master spec lists (§8), split into two honest
 * groups:
 *
 *  - REAL, WIRED factors — pricing and menu variety — computed from the
 *    actual Phase 5 `BusinessMenu` state and applied automatically every
 *    "End Business Day" (BusinessDayManager.ts), because Business Mode
 *    genuinely has that data today.
 *
 *  - FORWARD HOOKS — order outcomes (still no live order/serving
 *    pipeline) — pure, fully tested functions with NO real caller yet,
 *    exactly like Phase 4's `consumeUsableIngredients` was written and
 *    tested before any real "serve" action existed. A later phase
 *    composes onto this verified math instead of inventing its own.
 *    "Food quality"/"customer satisfaction"/"service consistency" are
 *    intentionally not split into separate functions — until a real
 *    serving pipeline exists to measure them independently,
 *    `orderCompletedDelta`'s `onTime` flag is the one honest proxy
 *    signal available; "recent performance" is the score's own
 *    persistence across days, not a separate windowed average over data
 *    that doesn't exist yet. `inspectionDelta` was ALSO written here as
 *    a forward hook back in Phase 6 and is no longer one — Phase 12's
 *    `businessInspection.ts` now calls it for real, once per day, from
 *    `BusinessDayManager.endBusinessDay` (never from inside this file's
 *    own `dailyPopularityDelta`, which stays exactly as it was so its
 *    own 4 terms remain independently testable and unchanged).
 *
 * No Math.random() anywhere — every delta is a deterministic function of
 * real, currently-known state.
 */
import type { SaveData } from "../SaveManager";
import type { BusinessMenu } from "./businessMenu";
import { menuPriceFor, defaultMenuPrice } from "./businessMenu";
import { CAMPAIGN_RECIPES } from "../recipes/campaignRecipes";
import { clampScore, DEFAULT_POPULARITY_STATE } from "./businessPopularity";
import { staffPopularityDelta } from "./businessStaff";
import { refrigeratorPopularityDelta } from "./businessEquipmentCondition";

/**
 * Deterministic, based on the ratio of set price to the suggested
 * default, averaged only across recipes the player has actually priced
 * (an untouched recipe always sits exactly at its own default, so it
 * never pulls this average away from neutral). Returns 0 on an
 * all-default menu — pricing can only move popularity once the player
 * has actually made a pricing choice.
 */
export function pricingDelta(menu: BusinessMenu): number {
  const pricedIds = Object.keys(menu);
  if (pricedIds.length === 0) return 0;
  const recipesById = new Map(CAMPAIGN_RECIPES.map((r) => [r.id, r]));
  let totalRatio = 0;
  let count = 0;
  for (const id of pricedIds) {
    const recipe = recipesById.get(id);
    if (!recipe) continue;
    totalRatio += menuPriceFor(menu, recipe) / defaultMenuPrice(recipe);
    count++;
  }
  if (count === 0) return 0;
  const avgRatio = totalRatio / count;
  if (avgRatio >= 1.5) return -3;
  if (avgRatio >= 1.2) return -1;
  if (avgRatio <= 0.5) return 1;
  if (avgRatio <= 0.8) return 2;
  return 0;
}

/** More of the menu actively curated/priced -> a small, capped popularity bump. Deterministic and data-driven off the real `CAMPAIGN_RECIPES`/`BusinessMenu` sizes — never a literal per-recipe number. */
export function menuVarietyDelta(menu: BusinessMenu): number {
  const pricedCount = Object.keys(menu).length;
  return Math.min(3, Math.floor(pricedCount / 25));
}

/** The one function BusinessDayManager calls each day — combines only the factors with a real, currently-wired data source. Economy V3 Phase 9 — also includes staffPopularityDelta for any hired Line Cook/Head Chef/Server. Economy V3 Phase 10 — also includes refrigeratorPopularityDelta ("quality consistency" suffering as the fridge's condition degrades). */
export function dailyPopularityDelta(save: SaveData): number {
  return (
    pricingDelta(save.business.menu) +
    menuVarietyDelta(save.business.menu) +
    staffPopularityDelta(save.business.staff.hiredRoles) +
    refrigeratorPopularityDelta(save.business.equipmentCondition.refrigeratorCondition)
  );
}

export type OrderOutcome = { onTime: boolean };

/** +3: the service score for a Business Day with at least one served order (popularity model D2 — applied once per day via dailyServiceDelta, no longer per serve). */
export function orderCompletedDelta(outcome: OrderOutcome): number {
  return outcome.onTime ? 3 : 2;
}

/** -3: the service score for a Business Day with no served order (popularity model D2, via dailyServiceDelta). */
export function orderFailedDelta(): number {
  return -3;
}

export type InspectionResult = "PASS" | "WARNING" | "FAIL";

/** Economy V3 Phase 12 — called for real by BusinessDayManager.endBusinessDay, once per day, with businessInspection.ts's own computed overall result. */
export function inspectionDelta(result: InspectionResult): number {
  if (result === "PASS") return 2;
  if (result === "WARNING") return -2;
  return -6;
}

/**
 * ECONOMY V3 PHASE 16 — POPULARITY MODEL D2 (bounded daily service + pull
 * to neutral). Before D2 every successful serve added +3 immediately, so 8
 * orders/day added +24 and popularity sat at 100 by day 2, drowning out
 * every other factor (V3-16 popularity audit). D2 changes only HOW service
 * enters popularity and adds one pull toward neutral; every existing daily
 * term above is unchanged:
 *
 *   P_end = clamp(P_start + dailyPopularityDelta + inspectionDelta
 *                 + dailyServiceDelta(ordersServed) + neutralPullDelta(P_start), 0, 100)
 *
 * Constants — none new in kind, each derived from the existing system:
 *  - NEUTRAL = DEFAULT_POPULARITY_STATE.score (50): the starting score and
 *    the point where DemandManager.orderFrequencyMultiplierFor is 1.0.
 *  - Service score = orderCompletedDelta (+3) for a day with at least one
 *    served order, orderFailedDelta (-3) for a day with none — the existing,
 *    tested "order outcome" constants, now applied once per day (bounded).
 *  - PULL_RATE = 0.32: maps the existing daily terms onto the existing
 *    0-100 scale. The best possible day (pricing +2, variety +3, staff +6,
 *    fridge 0, inspection +2, service +3 = +16) settles exactly at the cap:
 *    50 + 16 / 0.32 = 100. The worst (-3 -3 -6 -3 = -15) settles near, but
 *    never stuck at, 0: 50 - 15 / 0.32 = 3.1.
 */
export const POPULARITY_NEUTRAL = DEFAULT_POPULARITY_STATE.score;
export const POPULARITY_PULL_RATE = 0.32;

/** Bounded daily service score: +3 for a day with >= 1 served order (1, 10 or 100 alike), -3 for a day with none. */
export function dailyServiceDelta(ordersServed: number): number {
  return ordersServed > 0 ? orderCompletedDelta({ onTime: true }) : orderFailedDelta();
}

/** -round(0.32 x (P_start - 50)): pulls above-neutral popularity down and below-neutral up; exactly 0 at 50. Uses the day's STARTING score. */
export function neutralPullDelta(scoreAtDayStart: number): number {
  const pull = Math.round(POPULARITY_PULL_RATE * (scoreAtDayStart - POPULARITY_NEUTRAL));
  return pull === 0 ? 0 : -pull;
}

export type PopularityDayBreakdown = {
  /** pricing + variety + staff + refrigerator (dailyPopularityDelta). */
  operations: number;
  inspection: number;
  service: number;
  pull: number;
  total: number;
};

/** The one D2 end-of-day calculation — BusinessDayManager.endBusinessDay (and therefore the End Business Day preview, which runs that same pure function) is its only caller. */
export function endOfDayPopularity(
  save: SaveData,
  inspection: InspectionResult,
  ordersServed: number,
): { breakdown: PopularityDayBreakdown; score: number } {
  const startScore = save.business.popularity.score;
  const operations = dailyPopularityDelta(save);
  const inspectionTerm = inspectionDelta(inspection);
  const service = dailyServiceDelta(ordersServed);
  const pull = neutralPullDelta(startScore);
  const total = operations + inspectionTerm + service + pull;
  return {
    breakdown: { operations, inspection: inspectionTerm, service, pull, total },
    score: clampScore(startScore + total),
  };
}

/** The one place `business.popularity.score` is ever mutated — always clamped [0,100] via `clampScore`, atomic. Exposed for the forward-hook deltas above once a later phase has a real caller; BusinessDayManager applies `dailyPopularityDelta` directly inline since it already composes calendar/inventory/popularity together in one atomic save. */
export function applyPopularityDelta(save: SaveData, delta: number): SaveData {
  return {
    ...save,
    business: {
      ...save.business,
      popularity: { score: clampScore(save.business.popularity.score + delta) },
    },
  };
}
