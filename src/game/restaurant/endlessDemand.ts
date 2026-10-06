/**
 * ENDLESS_DEMAND — how many customers a day the Endless Restaurant gets
 * (developer 2026-10-05: "Scale demand"). After Level 250 the restaurant
 * runs open-ended days on the Business engine; its customers grow with what
 * the player built, so a developed, well-staffed restaurant earns its keep
 * while a poorly run one makes little or loses money. Costs are unchanged:
 * real ingredients, packaging, wages (specialists included), fines,
 * maintenance — nothing is free and no profit is guaranteed.
 *
 *   DEMAND   = the classic daily customers (8 × the popularity multiplier,
 *              0.5–1.5) × the MENU's pull: 1 + COOKABLE dishes ÷ dishesPerBase,
 *              where a dish of a specialist cuisine (Indian, Mediterranean,
 *              Mexican, the Asian chapters) counts only while its specialist
 *              chef is on staff — no one comes for a dish nobody can cook.
 *   CAPACITY = what the team can serve in a day: the chef alone
 *              CHEF_CAPACITY, + each hired role's ROLE_CAPACITY, + each
 *              specialist chef's SPECIALIST_CAPACITY.
 *   CUSTOMERS = min(DEMAND, CAPACITY).
 *
 * So a big menu without the team to cook it, or a big team without a menu
 * that draws guests, both earn little; payroll is charged either way.
 * Tuned with scripts/restaurant-endless-qa.mts across five restaurants
 * (minimum viable, medium, fully upgraded, fully staffed, overstaffed),
 * 30 days each from the L250 completionist save: ~$78 / $135 / $276 /
 * $452 / −$262 a day (target: fully staffed $300–$600, poor setups little
 * or a loss). The fully staffed restaurant is demand-bound (~69 customers
 * against a capacity of 88), so popularity and the menu still matter.
 *
 * It applies only to a save that has moved into the unified restaurant
 * (`business.restaurantMigration`, which only the restaurant build writes);
 * the classic Business Day keeps its own demand. Pure; nothing reads
 * RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import type { BusinessStaffRole } from "../business/businessStaff";
import { activeMenuDishes } from "./restaurantMenu";
import { LAST_CAMPAIGN_LEVEL, cuisineFor } from "./restaurantProgression";

export const ENDLESS_DEMAND_RULES = {
  /** Every this many cookable dishes add one classic day of customers. */
  dishesPerBase: 8,
  /** Customers the chef serves alone in a day. */
  chefCapacity: 10,
  /** Customers each hired role adds to the day's capacity. */
  roleCapacity: {
    "prep-cook": 10,
    "line-cook": 13,
    "head-chef": 10,
    server: 13,
    cleaner: 3,
    manager: 5,
  } as Record<BusinessStaffRole, number>,
  /** Customers each specialist chef adds. */
  specialistCapacity: 6,
} as const;

/** True for a save the Endless Restaurant's demand applies to. */
export function usesRestaurantDemand(save: SaveData): boolean {
  return !!save.business.restaurantMigration;
}

export type EndlessDemand = {
  /** Active dishes the team can cook (specialist cuisines need their chef). */
  cookableDishes: number;
  demand: number;
  capacity: number;
  customers: number;
};

/** The active menu's dishes the team can cook (a specialist cuisine only with its chef hired). */
export function cookableMenuDishes(save: SaveData) {
  const chefs = new Set(save.business.restaurantStaff?.specialists ?? []);
  return activeMenuDishes(save.business.menuActivation, LAST_CAMPAIGN_LEVEL).filter((d) => {
    const specialist = cuisineFor(d.cuisineId).specialist;
    return !specialist || chefs.has(specialist.id);
  });
}

/** Today's demand, capacity and customers for a restaurant save (`classicCustomers` = 8 × popularity). */
export function endlessDemandFor(save: SaveData, classicCustomers: number): EndlessDemand {
  const R = ENDLESS_DEMAND_RULES;
  const dishes = cookableMenuDishes(save).length;
  const demand = Math.round(classicCustomers * (1 + dishes / R.dishesPerBase));
  const roles = save.business.staff.hiredRoles;
  const specialists = save.business.restaurantStaff?.specialists?.length ?? 0;
  const capacity =
    R.chefCapacity +
    roles.reduce((n, role) => n + (R.roleCapacity[role] ?? 0), 0) +
    specialists * R.specialistCapacity;
  return { cookableDishes: dishes, demand, capacity, customers: Math.min(demand, capacity) };
}
