/**
 * ENDLESS_RESTAURANT — the restaurant after the campaign (developer
 * 2026-10-05 §3): before Level 250 there is ONE restaurant, the campaign —
 * menu orders, stock, supplies, staff, fridge and suppliers all run inside
 * its services, and there is no separate Business Day to start. Once Level
 * 250 is complete (`isEndlessUnlocked`, the existing rule) the restaurant
 * carries on indefinitely as the ENDLESS RESTAURANT: the existing Business
 * engine (open, serve menu orders, end the day — payroll, inspection,
 * popularity, the P&L), with everything the campaign built.
 *
 * Pure; it never reads RESTAURANT_MODE — callers pass it (the classic game
 * keeps its Business Day at any level).
 */
import type { LevelProgress } from "../levels/LevelManager";
import { isEndlessUnlocked } from "../daily/EndlessServiceManager";

/** True when a Business Day (the Endless Restaurant in the restaurant build) may be opened. */
export function businessDayAllowed(restaurantMode: boolean, progress: LevelProgress): boolean {
  return !restaurantMode || isEndlessUnlocked(progress);
}

/** The name the restaurant build gives the open-ended Business Day. */
export const ENDLESS_RESTAURANT_NAME = "Endless Restaurant";
