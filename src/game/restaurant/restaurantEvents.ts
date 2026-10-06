/**
 * RESTAURANT_EVENTS — the Endless Restaurant's events (developer
 * 2026-10-06), prepared as DATA + pure functions; NOT yet wired into a day.
 * The Endless Restaurant's approved provisional economy (endlessDemand.ts:
 * ~$452/day fully staffed) is untouched until events are switched on in the
 * next gameplay phase and tuned in the final economy pass.
 *
 *  - DINNER RUSH: more customers that day (tests stock and staff capacity);
 *  - LARGE GROUP: a party arriving together (tests prep and service
 *    capacity);
 *  - TODAY'S SPECIAL: one featured dish from the active, cookable menu that
 *    draws extra orders. It is the restaurant's form of the existing Today's
 *    Special (daily/DailyOrderManager.ts, $50 once a day): the bonus is that
 *    SAME once-a-day bonus, never a second one (no double counting).
 *
 * Every number below is PROVISIONAL ("Do not invent final reward values
 * yet") and lives in RESTAURANT_EVENT_RULES only. Events are deterministic
 * per Business Day (the seeded generator, like every Business roll), so a
 * reload never re-rolls a day. Campaign levels never read this module.
 * Pure; nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import { makeSeededRand } from "../business/businessDeterministicRandom";
import type { BusinessDish } from "../business/businessDishCatalog";
import { DAILY_ORDER_BONUS_COINS } from "../daily/DailyOrderManager";
import { cookableMenuDishes, type EndlessDemand } from "./endlessDemand";

export type RestaurantEventId = "dinner-rush" | "large-group" | "todays-special";

export const RESTAURANT_EVENT_RULES = {
  "dinner-rush": {
    title: "Dinner Rush",
    line: "A busy evening — more guests than usual.",
    /** Chance a given day has one (PROVISIONAL). */
    chance: 0.2,
    /** Today's demand × this (PROVISIONAL). Capacity still caps the customers. */
    demandMultiplier: 1.3,
  },
  "large-group": {
    title: "Large Group",
    line: "A party is booked — they arrive together.",
    chance: 0.15,
    /** Extra guests arriving as one group (PROVISIONAL). */
    groupSize: 6,
  },
  "todays-special": {
    title: "Today's Special",
    line: "One dish is featured today — guests ask for it.",
    /** Every day has one while the menu has a cookable dish. */
    chance: 1,
    /** Share of the day's orders that ask for the featured dish (PROVISIONAL). */
    featuredShare: 0.25,
    /** The existing once-a-day Today's Special bonus — the same one, never a second. */
    dailyBonus: DAILY_ORDER_BONUS_COINS,
  },
} as const;

export type RestaurantEvent =
  | { id: "dinner-rush"; demandMultiplier: number }
  | { id: "large-group"; groupSize: number }
  | { id: "todays-special"; dishId: string; featuredShare: number; dailyBonus: number };

/** A seed per Business Day that never collides with the order seed (businessServiceSeedFor = the day). */
export function eventSeedFor(businessDay: number): number {
  return (Math.imul(businessDay, 2654435761) ^ 0x5eed_e7e5) >>> 0;
}

/** The featured dish for a day: one of the active menu's cookable dishes, picked by the day's seed (null with an empty menu). */
export function todaysSpecialDish(save: SaveData, businessDay: number): BusinessDish | null {
  const dishes = cookableMenuDishes(save);
  if (dishes.length === 0) return null;
  const rand = makeSeededRand(eventSeedFor(businessDay) ^ 0x51ec1a1);
  return dishes[Math.floor(rand() * dishes.length)] ?? null;
}

/** The events of one Business Day, deterministic (Dinner Rush and Large Group by chance; Today's Special whenever a dish can be featured). */
export function eventsForDay(save: SaveData, businessDay: number): RestaurantEvent[] {
  const R = RESTAURANT_EVENT_RULES;
  const rand = makeSeededRand(eventSeedFor(businessDay));
  const events: RestaurantEvent[] = [];
  if (rand() < R["dinner-rush"].chance)
    events.push({ id: "dinner-rush", demandMultiplier: R["dinner-rush"].demandMultiplier });
  if (rand() < R["large-group"].chance)
    events.push({ id: "large-group", groupSize: R["large-group"].groupSize });
  const special = todaysSpecialDish(save, businessDay);
  if (special)
    events.push({
      id: "todays-special",
      dishId: special.id,
      featuredShare: R["todays-special"].featuredShare,
      dailyBonus: R["todays-special"].dailyBonus,
    });
  return events;
}

/**
 * A day's demand with its events applied: Dinner Rush multiplies demand,
 * a Large Group adds its guests; the team's capacity still caps the
 * customers, so an event only pays if the restaurant can serve it. Never
 * below the plain demand, never negative. (Not wired yet — see the header.)
 */
export function demandWithEvents(
  base: EndlessDemand,
  events: readonly RestaurantEvent[],
): EndlessDemand {
  let demand = base.demand;
  for (const e of events) {
    if (e.id === "dinner-rush") demand = Math.round(demand * e.demandMultiplier);
    if (e.id === "large-group") demand += e.groupSize;
  }
  demand = Math.max(base.demand, demand, 0);
  return { ...base, demand, customers: Math.min(demand, base.capacity) };
}
