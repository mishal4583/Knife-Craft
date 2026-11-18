import type { SaveData } from "../SaveManager";

/**
 * THE DAY THE MINI-GAMES COUNT BY (audit 2026-11-18). `business.calendar.businessDay` only advances from the level where the fridge starts to matter
 * (restaurantDay.ts closeDay: Level 10), so before that it stays at 1 for ever and every "N rounds a day" counter that read it never reset: the Sauce
 * Station (opens at Level 7) gave 3 rounds for the whole stretch up to Level 10, and the delivery check, the Car Park's lot and the skip counter
 * behaved the same. `restaurantDay.day` advances at every closing from the very first. The larger of the two is the day: unchanged from Level 10 on
 * (both advance together after the one-time jump), and a real day from the first services.
 *
 * Food freshness (purchaseDay, expiry) is NOT counted by this: it keeps its own calendar.
 */
export const playDayOf = (save: SaveData): number =>
  Math.max(
    Math.floor(Number(save.business.calendar.businessDay)) || 1,
    Math.floor(Number(save.business.restaurantDay?.day)) || 1,
  );
