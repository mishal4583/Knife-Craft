/**
 * RESTAURANT_EVENTS — the Endless Restaurant's events (developer
 * 2026-10-06): DATA + pure functions, connected to the Endless Restaurant
 * day (2026-10-06, integration phase) — only for a save in the unified
 * restaurant whose campaign is complete (`endlessEventsActive`), so campaign
 * services and the classic Business Day never see them:
 *  - demand: BusinessServiceManager.businessCustomersToday applies
 *    `demandWithEvents` to the Endless demand (capacity still caps it);
 *  - Today's Special: the day's order pool carries the featured dish more
 *    often (`featuredPool`; ~17% of orders after the generator's variety
 *    rule); serving it (`withTodaysSpecialServed`) earns, at End Business
 *    Day, 15 % of the day's restaurant revenue capped at the EXISTING
 *    once-per-calendar-day $50 (`todaysSpecialBonus`; App, the same claim as
 *    the classic Today's Special: never twice a day).
 * Values are unchanged and provisional until the final economy pass.
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
import { isEndlessUnlocked } from "../daily/EndlessServiceManager";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { cookableMenuDishes, usesRestaurantDemand, type EndlessDemand } from "./endlessDemand";

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
    /**
     * The featured dish's weight in the day's order pool (PROVISIONAL). The
     * existing order generator's variety rule (a recipe ordered in the last 3
     * weighs ×0.2) trims what guests actually order: measured ~17% of a day's
     * orders, vs ~2% for any other dish (restaurant-endgame-qa D3).
     */
    featuredShare: 0.25,
    /**
     * The existing once-a-day Today's Special bonus — the same one, never a
     * second — is its CAP. Read when used (a getter): in the bundle this
     * module can load before DailyOrderManager, so copying the constant here
     * gave NaN.
     */
    get dailyBonus(): number {
      return DAILY_ORDER_BONUS_COINS;
    },
    /**
     * Final economy pass: the bonus is this share of the day's restaurant
     * revenue, capped at `dailyBonus`, paid at End Business Day when the
     * featured dish was served that day (a flat $50 was 36 % of a tiny
     * restaurant's day; the bigger ones still reach the cap).
     */
    bonusShare: 0.15,
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
      dailyBonus: DAILY_ORDER_BONUS_COINS,
    });
  return events;
}

/**
 * A day's demand with its events applied: Dinner Rush multiplies demand,
 * a Large Group adds its guests; the team's capacity still caps the
 * customers, so an event only pays if the restaurant can serve it. Never
 * below the plain demand, never negative.
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

/** True when the day's events apply: a unified-restaurant save past Level 250 (the Endless Restaurant). */
export function endlessEventsActive(save: SaveData): boolean {
  return usesRestaurantDemand(save) && isEndlessUnlocked(save.levelProgress);
}

/**
 * The day's order pool with the featured dish drawn ~`share` of the time:
 * extra copies of its recipe are added (the order picker draws each pool
 * entry with equal weight). The pool is returned unchanged when the dish
 * isn't on it, the share is 0, or there is only one dish.
 */
export function featuredPool(
  pool: readonly RecipeDefinition[],
  recipeId: string,
  share: number,
): RecipeDefinition[] {
  const featured = pool.find((r) => r.id === recipeId);
  if (!featured || !(share > 0 && share < 1) || pool.length < 2) return [...pool];
  const copies = Math.max(0, Math.round((share * (pool.length - 1)) / (1 - share)) - 1);
  return [...pool, ...Array.from({ length: copies }, () => featured)];
}

/** The Today's Special bonus for a day's restaurant revenue: its share, capped at the existing $50. */
export function todaysSpecialBonus(revenue: number): number {
  const R = RESTAURANT_EVENT_RULES["todays-special"];
  return Math.max(0, Math.min(R.dailyBonus, Math.round(Math.max(0, revenue) * R.bonusShare)));
}

/**
 * Notes that today's featured dish was served (the bonus is paid at End
 * Business Day). Only on an Endless day, only for the featured dish; any
 * other serve returns the save unchanged. Moves no money.
 */
export function withTodaysSpecialServed(save: SaveData, dishId: string): SaveData {
  const day = save.business.calendar.businessDay;
  if (!endlessEventsActive(save) || todaysSpecialDish(save, day)?.id !== dishId) return save;
  if (save.business.todaysSpecialServedDay === day) return save;
  return { ...save, business: { ...save.business, todaysSpecialServedDay: day } };
}
