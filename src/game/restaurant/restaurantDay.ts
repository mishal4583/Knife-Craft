/**
 * RESTAURANT_DAY — the restaurant's day clock (Unified Restaurant phase 5;
 * developer: "only certain levels for 1 day and then closing time and
 * cleaning and all those stuffs, then day 2 opening time").
 *
 * A day is a set number of services, each one a campaign level played for
 * the first time (DAY_SCHEDULE: Lunch + Dinner, Breakfast added at L51):
 *
 *   OPENING TIME   the day's first level opens the restaurant (the
 *                  Pre-Service Check shows "Day N · Opening time" and the
 *                  day's services); the cash on hand is noted;
 *   SERVICES       each first completion counts one service;
 *   CLOSING TIME   after the last service the restaurant must close before
 *                  the next level: the chores (wash up, wipe down, throw out
 *                  spoiled food, set the dining room — by level), the day's
 *                  count (cash at opening → now), then "Close for the night";
 *   NEXT DAY       Day N+1, opening again with the next level.
 *
 * What closing does:
 *  - before the fridge & freshness stage (L21) only the day number moves:
 *    food does not age yet, so nothing bought in the pantry stage can spoil
 *    before freshness is taught;
 *  - from L21 the freshness clock (`business.calendar.businessDay`, the one
 *    Business uses) advances one day and stock that expired is thrown out,
 *    recorded as waste with End Business Day's own multipliers; no money;
 *  - from full operation (L91) closing IS End Business Day (payroll,
 *    inspection, popularity, the day's P&L), the existing function;
 *  - from dine-in (L31) the wipe-down uses cleaning liquid
 *    (serviceSupplies.ts; none left is a warning, never a block).
 *
 * Replays, Today's Special and Endless never count services. State lives in
 * `business.restaurantDay` (old saves get the default: Day 1, not open).
 * Pure; nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import { advanceBusinessDay } from "../business/businessCalendar";
import { clearExpiredStock } from "../business/SpoilageManager";
import { normalizeQuantity } from "../business/businessInventory";
import { endBusinessDay } from "../business/BusinessDayManager";
import { wasteValueFor } from "../business/discardExpired";
import { CLOSING_CHORES, isSystemLive, servicesForDayAt } from "./restaurantProgression";
import { bottleView, closingWipeDown, type BottleView } from "./serviceSupplies";

export type RestaurantDayState = {
  /** The restaurant's day number, from 1. */
  day: number;
  /** The day has opened (its first service started). */
  opened: boolean;
  /** Services (first-play levels) completed today. */
  servicesDone: number;
  /** Services this day holds (fixed when it opens). */
  servicesPlanned: number;
  /** Every service is done: the restaurant must close before the next level. */
  closingDue: boolean;
  /** Cash when the day opened (null when it opened implicitly, e.g. the first launch). */
  openingCredits: number | null;
  /** The level the day opened with. */
  openingLevel: number | null;
};

export const DEFAULT_RESTAURANT_DAY_STATE: RestaurantDayState = {
  day: 1,
  opened: false,
  servicesDone: 0,
  servicesPlanned: 0,
  closingDue: false,
  openingCredits: null,
  openingLevel: null,
};

/** A save's day state, defaulted for saves that predate it. */
export function restaurantDayOf(save: SaveData): RestaurantDayState {
  return { ...DEFAULT_RESTAURANT_DAY_STATE, ...(save.business.restaurantDay ?? {}) };
}

const withDay = (save: SaveData, day: RestaurantDayState): SaveData => ({
  ...save,
  business: { ...save.business, restaurantDay: day },
});

export type DayService = { name: string; levelNumber: number; done: boolean };

/** Today's services by name and level, for the opening card (a day not open yet starts at `levelNumber`). */
export function todaysServices(save: SaveData, levelNumber: number): DayService[] {
  const d = restaurantDayOf(save);
  const start = d.opened && d.openingLevel !== null ? d.openingLevel : levelNumber;
  const names =
    d.opened && d.servicesPlanned > 0
      ? servicesForDayAt(start).slice(0, d.servicesPlanned)
      : servicesForDayAt(start);
  return names.map((name, i) => ({ name, levelNumber: start + i, done: i < d.servicesDone }));
}

/** True when starting `levelNumber` opens a new day (the opening card shows). */
export function opensNewDay(save: SaveData): boolean {
  const d = restaurantDayOf(save);
  return !d.opened && !d.closingDue;
}

/** Opens the day with `levelNumber` as its first service. */
export function openDay(save: SaveData, levelNumber: number): SaveData {
  const d = restaurantDayOf(save);
  if (d.opened || d.closingDue) return save;
  return withDay(save, {
    ...d,
    opened: true,
    servicesDone: 0,
    servicesPlanned: servicesForDayAt(levelNumber).length,
    openingCredits: save.credits,
    openingLevel: levelNumber,
  });
}

/** Counts one finished service (a first completion). Opens the day implicitly if it wasn't. */
export function recordService(save: SaveData, levelNumber: number): SaveData {
  const opened = openDay(save, levelNumber);
  const d = restaurantDayOf(opened);
  if (!d.opened || d.closingDue) return opened;
  const servicesDone = d.servicesDone + 1;
  return withDay(opened, {
    ...d,
    openingCredits: d.openingCredits,
    servicesDone,
    closingDue: servicesDone >= d.servicesPlanned,
  });
}

export type ClosingPreview = {
  day: number;
  services: DayService[];
  chores: { id: string; label: string }[];
  cashAtOpening: number | null;
  cashNow: number;
  /** What closing will throw out (expired by tomorrow), only once freshness is live. */
  spoiled: { quantity: number; value: number; ingredientIds: IngredientId[] } | null;
  /** Closing runs the full End Business Day (payroll, inspection, P&L). */
  fullDayEnd: boolean;
  /** The wipe-down's cleaning liquid (from dine-in, L31); null before. */
  cleaner: BottleView | null;
};

/** What the Closing Time screen shows for the day that's ending (read-only). */
export function closingPreview(save: SaveData, levelNumber: number): ClosingPreview {
  const d = restaurantDayOf(save);
  const freshness = isSystemLive("fridge-freshness", levelNumber);
  let spoiled: ClosingPreview["spoiled"] = null;
  if (freshness) {
    const tomorrow = advanceBusinessDay(save.business.calendar).businessDay;
    const swept = clearExpiredStock(save.business.inventory, tomorrow);
    spoiled = {
      quantity: swept.spoiledQuantity,
      value: wasteValueFor(save, swept.spoiledValue),
      ingredientIds: swept.spoiledIngredientIds,
    };
  }
  return {
    day: d.day,
    services: todaysServices(save, levelNumber),
    chores: CLOSING_CHORES.filter((c) => levelNumber >= c.fromLevel).map(({ id, label }) => ({
      id,
      label,
    })),
    cashAtOpening: d.openingCredits,
    cashNow: save.credits,
    spoiled,
    fullDayEnd: isSystemLive("full-operation", levelNumber),
    cleaner: isSystemLive("dine-in", levelNumber) ? bottleView(save, "cleaning-liquid") : null,
  };
}

/**
 * Closes the restaurant for the night and starts the next day (not open
 * yet). Only when closing is due. `levelNumber` is the restaurant's level
 * (which closing stage applies). No money moves before full operation.
 */
export function closeDay(save: SaveData, levelNumber: number): SaveData {
  const d = restaurantDayOf(save);
  if (!d.closingDue) return save;
  let next = save;
  if (isSystemLive("full-operation", levelNumber)) {
    next = endBusinessDay(save).save;
  } else if (isSystemLive("fridge-freshness", levelNumber)) {
    const calendar = advanceBusinessDay(save.business.calendar);
    const swept = clearExpiredStock(save.business.inventory, calendar.businessDay);
    const value = wasteValueFor(save, swept.spoiledValue);
    const acc = save.business.finance.dailyAccumulator;
    next = {
      ...save,
      business: {
        ...save.business,
        calendar,
        inventory: swept.inventory,
        spoilage: {
          totalSpoiledQuantity: normalizeQuantity(
            save.business.spoilage.totalSpoiledQuantity + swept.spoiledQuantity,
          ),
          totalSpoiledValue: save.business.spoilage.totalSpoiledValue + value,
        },
        // Today's thrown-out food is in the lifetime totals already; a new day starts at 0.
        finance: {
          ...save.business.finance,
          dailyAccumulator: { ...acc, discardedQuantity: 0, discardedValue: 0 },
        },
      },
    };
  }
  next = closingWipeDown(next, levelNumber).save;
  return withDay(next, { ...DEFAULT_RESTAURANT_DAY_STATE, day: d.day + 1 });
}
