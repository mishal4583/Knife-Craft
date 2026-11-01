/**
 * GUEST DEMAND (Phase 8A, developer 2026-11-01: "demand that scales with capacity"): how many guests a
 * campaign service WANTS, how many the room and the team can SERVE, and how many are turned away.
 *
 *   DEMAND   = the timetable (`menuGuestsPerService`, the floor: it never drops) + the kitchen's seats
 *              + PULL, 0..PULL_MAX, from four things the player owns:
 *                reputation  the popularity score (60+: 1, 75+: 2)
 *                menu        cookable dishes on the active menu (a dish nobody can cook pulls nobody)
 *                hour        a lunch or dinner rush (+1); the other meals are quiet
 *                spotless    the last service ended spotless (+1)
 *   CAPACITY = the team (`menuGuestCapacity`, unchanged)
 *   SERVED   = min(DEMAND, CAPACITY): both ends move, the smaller one rules.
 *
 * Rules (the plan, docs/planning/PHASE8-CUSTOMERS-PLAN-2026-11-01.md):
 *  - Extra guests only ever ADD: the timetable stays the floor, so the lessons and every level's own
 *    orders are untouched. Nothing pulls before the Server's level (dine-in): the early game is gentle.
 *  - Nothing is hidden: every part of the pull is listed here and shown on the Pace card.
 *  - No new money: a pulled guest pays the dish's menu price through the existing payment rule.
 *  - Pure and seeded by the save: the same save, the same guests. No randomness, no stored field.
 *
 * The staff requirements still read the timetable alone, so the pull never makes a hire "required".
 */
import type { SaveData } from "../SaveManager";
import { activeMenuRecipes } from "./restaurantMenu";
import { restaurantDayOf } from "./restaurantDay";
import { restaurantRecordOf } from "./serviceReport";
import {
  cuisineFor,
  isSystemLive,
  menuGuestsPerService,
  servicesForDayAt,
} from "./restaurantProgression";
import { kitchenGuestSeats } from "./restaurantInvestments";

export const GUEST_PULL_RULES = {
  /** The most the four parts can add together. */
  max: 4,
  /** Popularity score at which reputation adds 1 / 2 guests. */
  reputation: [60, 75] as const,
  /** Cookable active dishes at which the menu adds 1 guest. */
  menuDishes: 10,
  /** The meals that bring a rush. */
  rushServices: ["Lunch", "Dinner"] as readonly string[],
} as const;

export type GuestPull = {
  reputation: number;
  menu: number;
  hour: number;
  spotless: number;
  /** The sum, capped at GUEST_PULL_RULES.max. */
  total: number;
};

export type GuestDemand = {
  /** The timetable (the floor). */
  base: number;
  /** The seats the kitchen tiers built. */
  seats: number;
  pull: GuestPull;
  /** base + seats + pull. */
  wanted: number;
  /** What the team can serve. */
  capacity: number;
  /** min(wanted, capacity). */
  served: number;
  /** wanted − served: guests the team could not take. */
  turnedAway: number;
  /** The meal this service is ("Lunch", …), or null. */
  service: string | null;
};

const NO_PULL: GuestPull = { reputation: 0, menu: 0, hour: 0, spotless: 0, total: 0 };

/** The meal of service `n` in the restaurant's current day (the day's first service when it is not open yet). */
export function serviceNameAt(save: SaveData, n: number): string | null {
  const d = restaurantDayOf(save);
  const start = d.opened && d.openingLevel !== null && n >= d.openingLevel ? d.openingLevel : n;
  const names = servicesForDayAt(start);
  return names[Math.min(Math.max(0, n - start), names.length - 1)] ?? null;
}

/** Active dishes of service `n` the team can cook (a specialist cuisine only with its chef hired). */
function cookableDishCount(save: SaveData, n: number): number {
  const chefs = new Set(save.business.restaurantStaff?.specialists ?? []);
  return activeMenuRecipes(save.business.menuActivation, n).filter((r) => {
    const specialist = cuisineFor(r.cuisineId).specialist;
    return !specialist || chefs.has(specialist.id);
  }).length;
}

/** The four parts of the pull for service `n` (all 0 before the Server's level, dine-in). */
export function guestPullFor(save: SaveData, n: number): GuestPull {
  if (menuGuestsPerService(n) <= 0 || !isSystemLive("dine-in", n)) return NO_PULL;
  const R = GUEST_PULL_RULES;
  const score = save.business.popularity?.score ?? 50;
  const reputation = score >= R.reputation[1] ? 2 : score >= R.reputation[0] ? 1 : 0;
  const menu = cookableDishCount(save, n) >= R.menuDishes ? 1 : 0;
  const service = serviceNameAt(save, n);
  const hour = service && R.rushServices.includes(service) ? 1 : 0;
  const spotless = restaurantRecordOf(save).streak >= 1 ? 1 : 0;
  return {
    reputation,
    menu,
    hour,
    spotless,
    total: Math.min(R.max, reputation + menu + hour + spotless),
  };
}

/** The pieces of service `n`'s guest demand, for the order engine and for what the player reads. */
export function guestDemandFor(save: SaveData, n: number, capacity: number): GuestDemand {
  const base = menuGuestsPerService(n);
  const pull = guestPullFor(save, n);
  const seats = base > 0 ? kitchenGuestSeats(save) : 0;
  const wanted = base > 0 ? base + seats + pull.total : 0;
  const served = Math.min(wanted, capacity);
  return {
    base,
    seats,
    pull,
    wanted,
    capacity,
    served,
    turnedAway: wanted - served,
    service: serviceNameAt(save, n),
  };
}
