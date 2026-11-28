/**
 * THE BURGER FESTIVAL: the first of the fifteen menus (menus.ts), played on the shared kitchen (menu.ts). The menu grows with the pace, so a harder
 * round also has more on the counter; Event 1's five customers are scripted to teach one new thing at a time. These are its own names for the shared
 * rules.
 */
import {
  JOINS,
  POINTS,
  ROLES,
  dishesOf,
  firstOrders,
  menuKitchen,
  menuOrders,
  menuRound,
} from "./menu";
import { BURGER_MENU } from "./menus";
import type { FoodId, KitchenConfig, OrderSpec, Pace, RoundConfig } from "./types";

export { DOUBLE_FROM_TIER, MAX_TOPPINGS, sortParts } from "./menu";

const dishes = dishesOf(BURGER_MENU);
const byFood = <T>(of: (role: (typeof ROLES)[number]) => T, skip: readonly string[] = []) =>
  Object.fromEntries(
    ROLES.filter((r) => !skip.includes(r)).map((r) => [dishes[r].id, of(r)]),
  ) as Partial<Record<FoodId, T>>;

/** Cooking times at the first event, in milliseconds (every one is multiplied by the pace's cookSpeed). */
export const BURGER_COOK_MS: Partial<Record<FoodId, number>> = Object.fromEntries(
  ROLES.filter((r) => dishes[r].ms !== undefined).map((r) => [dishes[r].id, dishes[r].ms!]),
);
/** The tier each part of the menu joins at (the bun is always there). */
export const BURGER_JOINS: Partial<Record<FoodId, number>> = byFood((r) => JOINS[r], ["base"]);
export const BURGER_POINTS: Partial<Record<FoodId, number>> = byFood((r) => POINTS[r]);
/** The drink machines, left to right: a tap for each, the shake blender last. */
export const DRINKS: readonly FoodId[] = BURGER_MENU.drinks.map((f) => f.id);
/** The order the parts are listed and stacked in, bottom to top. */
export const STACK_ORDER: readonly FoodId[] = [BURGER_MENU.base.id, ...BURGER_MENU.layers];

export const FIRST_ORDERS: readonly OrderSpec[] = firstOrders(BURGER_MENU);

export const burgerKitchen = (pace: Pace): KitchenConfig => menuKitchen(BURGER_MENU, pace);
export const burgerOrders = (pace: Pace, seed: number): OrderSpec[] =>
  menuOrders(BURGER_MENU, pace, seed);
/** A Burger Festival round at a pace; the same pace and seed give the same round. */
export const burgerRound = (pace: Pace, seed: number): RoundConfig =>
  menuRound(BURGER_MENU, pace, seed);
