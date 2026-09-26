/**
 * BUSINESS_CALENDAR — Economy V3 Phase 1. The one deterministic clock
 * every later Business Mode phase (inventory ageing, staff salary,
 * supplier deliveries/events, equipment usage, maintenance, inspections)
 * schedules itself against. Completely independent from the Campaign's
 * own progression (`SaveData.levelProgress`, `LEVELS`) — advancing the
 * business day never touches campaign state, and completing/replaying a
 * campaign level never touches this calendar. The two systems share a
 * save file, never a clock.
 *
 * Deliberately NOT tied to real-world dates (Date.now(), the daily/
 * endless "YYYY-MM-DD" key, etc.) — those model real calendar days for
 * daily-cap/streak purposes; this models an in-game business day that
 * only advances when the player explicitly ends one (brief: "Do not add
 * a forced countdown timer"). No Math.random() anywhere in this module —
 * `businessDay` is a plain incrementing counter, so every later phase
 * that reads "what day is it" gets a fully reproducible answer.
 */

export type DayOfWeek =
  "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

/** Day 1 is always Monday — the fixed epoch every later phase's own day-of-week-dependent logic (e.g. a weekend-only supplier event) can rely on without re-deriving it. */
export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * Deliberately just the one counter. `dayOfWeek`/`businessWeek` are pure
 * functions of `businessDay` (below) — never stored redundantly, mirroring
 * EconomyLedger.ledgerTotals's own "derive, don't duplicate" precedent.
 */
export type BusinessCalendar = {
  /** 1-based — Day 1 is the restaurant's first business day, never Day 0. */
  businessDay: number;
};

export const DEFAULT_BUSINESS_CALENDAR: BusinessCalendar = {
  businessDay: 1,
};

/** businessDay 1/8/15/... -> Monday, 2/9/16/... -> Tuesday, etc. */
export function dayOfWeekFor(businessDay: number): DayOfWeek {
  const index = (businessDay - 1) % 7;
  return DAYS_OF_WEEK[index]!;
}

/** businessDay 1-7 -> Week 1, 8-14 -> Week 2, and so on. */
export function businessWeekFor(businessDay: number): number {
  return Math.floor((businessDay - 1) / 7) + 1;
}

/** Pure — the caller (App.tsx) persists the result, exactly like every other economy manager (KnifeManager.buyKnife, SupplierManager.selectSupplier, ...) never touches SaveData itself. */
export function advanceBusinessDay(calendar: BusinessCalendar): BusinessCalendar {
  return { businessDay: calendar.businessDay + 1 };
}
