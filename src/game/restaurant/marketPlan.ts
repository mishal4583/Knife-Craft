/**
 * MARKET PLAN (developer 2026-10-08) — "In the Market show the ingredients
 * that will be needed in the next two or three days, according to the
 * current fridge capacity, with the highest priority for what today's menu
 * uses."
 *
 * For the next `days` restaurant days it lists what to buy now:
 *  - the services: today's still to come (or the day the next level opens),
 *    then each following day by the restaurant day's schedule (Lunch +
 *    Dinner, + Breakfast from L51 — `servicesForDayAt`); after Level 250,
 *    the Endless Restaurant's menu demand per day (`menuDemand`);
 *  - each service's real stock: its tickets (after the orders a try already
 *    paid) and its menu guests, through `orderRequirements` (the same stock
 *    the serve takes, knife and helper savings included);
 *  - stock already in the fridge covers the earliest needs first, and only
 *    while it is still fresh on that day;
 *  - something is planned for day d only if it is still fresh then
 *    (d < its shelf life), so nothing is bought to spoil;
 *  - TODAY FIRST: day 0's needs are planned before day 1's, and day 1's
 *    before day 2's; once the fridge's free space can't take a line (in
 *    whole Market units), that line waits — it is listed as "no room".
 *
 * Pure and read-only: it suggests, the Market buys (one purchase per line,
 * the ordinary Market purchase). Nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import type { LevelDefinition } from "../levels/levelTypes";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { getLevel, isCompleted } from "../levels/LevelManager";
import { levelNumber } from "../levels/levelMastery";
import { paidOrdersFor } from "../levels/paidOrders";
import { normalizeQuantity } from "../business/businessInventory";
import { ageInDays, shelfLifeForIngredient } from "../business/perishability";
import { getAvailableStorageCapacity } from "../business/RefrigeratorManager";
import { menuDemand } from "../business/inventoryAnalytics";
import { isEndlessUnlocked } from "../daily/EndlessServiceManager";
import { marketUnitsCovering, measureOf, stockForMarketUnits } from "../business/measure";
import { ticketsFor } from "./serviceTickets";
import { menuGuestQueue, remainingMenuGuests } from "./menuGuests";
import { orderRequirements, serviceUsesStock } from "./campaignStock";
import { restaurantDayOf, todaysServices } from "./restaurantDay";
import { LAST_CAMPAIGN_LEVEL, servicesForDayAt } from "./restaurantProgression";
import { restaurantQuote } from "./restaurantEconomy";

export const MARKET_PLAN_DAYS = [1, 2, 3] as const;

export type MarketPlanRow = {
  ingredientId: IngredientId;
  /** Stock to add, exactly (lb or pieces). */
  stock: number;
  /** Whole Market units (lb / kg / pieces) that cover it. */
  buyUnits: number;
  /** The Market's price for `buyUnits` now. */
  cost: number;
  /** The first day (0 = today) this stock is for. */
  firstDay: number;
  /** Used by today's menu (a service or guest today). */
  forToday: boolean;
};

export type MarketPlan = {
  days: number;
  /** The levels each day covers (empty for an Endless day). */
  dayLevels: number[][];
  rows: MarketPlanRow[];
  /** Ingredients a later day needs that didn't fit in the fridge. */
  noRoom: IngredientId[];
  totalCost: number;
  /** Fridge space the plan takes, and free now. */
  storageNeeded: number;
  storageFree: number;
};

/** The recipes one campaign service still serves: its tickets after the paid orders, and its menu guests. */
function serviceRecipes(save: SaveData, level: LevelDefinition): RecipeDefinition[] {
  if (isCompleted(level.id, save.levelProgress)) return [];
  const { tickets, progress } = ticketsFor(save.levelProgress, level);
  const paid = paidOrdersFor(progress, level.id).length;
  const guests =
    level.id === save.levelProgress.highestUnlockedLevelId
      ? remainingMenuGuests(save, level)
      : menuGuestQueue(save, level);
  return [...tickets.slice(paid), ...guests];
}

/** The next `days` days of services: levels per day, starting with today's still to come. */
function upcomingDays(save: SaveData, days: number): number[][] {
  const next = levelNumber(save.levelProgress.highestUnlockedLevelId);
  const out: number[][] = [];
  const d = restaurantDayOf(save);
  let start = next;
  if (d.opened) {
    const today = todaysServices(save, next)
      .filter((s) => !s.done && s.levelNumber >= next)
      .map((s) => s.levelNumber);
    out.push(today);
    start = (today[today.length - 1] ?? next - 1) + 1;
  }
  while (out.length < days && start <= LAST_CAMPAIGN_LEVEL) {
    const count = servicesForDayAt(start).length;
    const levels: number[] = [];
    for (let i = 0; i < count && start + i <= LAST_CAMPAIGN_LEVEL; i++) levels.push(start + i);
    out.push(levels);
    start += count;
  }
  return out.slice(0, days);
}

/** Each day's need per ingredient (stock units). */
function dailyNeeds(
  save: SaveData,
  days: number,
): { levels: number[][]; needs: Map<IngredientId, number>[] } {
  if (isEndlessUnlocked(save.levelProgress)) {
    const perDay = new Map<IngredientId, number>();
    for (const [id, d] of menuDemand(save))
      if (d.perDay > 0) perDay.set(id, normalizeQuantity(d.perDay));
    return {
      levels: Array.from({ length: days }, () => []),
      needs: Array.from({ length: days }, () => new Map(perDay)),
    };
  }
  const levels = upcomingDays(save, days);
  const needs = levels.map((dayLevels) => {
    const need = new Map<IngredientId, number>();
    for (const n of dayLevels) {
      if (!serviceUsesStock(n)) continue;
      const level = getLevel(`level-${n}`);
      if (!level) continue;
      for (const recipe of serviceRecipes(save, level))
        for (const r of orderRequirements(save, recipe))
          need.set(r.ingredientId, normalizeQuantity((need.get(r.ingredientId) ?? 0) + r.quantity));
    }
    return need;
  });
  return { levels, needs };
}

export function marketPlanFor(save: SaveData, days: number): MarketPlan {
  const measure = measureOf(save);
  const today = save.business.calendar.businessDay;
  const inventory = save.business.inventory;
  const storageFree = getAvailableStorageCapacity(
    inventory,
    save.business.refrigerator.refrigeratorId,
  );
  const { levels, needs } = dailyNeeds(save, days);

  /** Stock in the fridge still fresh on day d (its merged entry's age then is below the shelf life). */
  const freshOn = (id: IngredientId, d: number) => {
    const e = inventory[id];
    if (!e || e.quantity <= 0) return 0;
    return ageInDays(e.purchaseDay, today) + d < shelfLifeForIngredient(id) ? e.quantity : 0;
  };

  const used = new Map<IngredientId, number>(); // existing stock already counted for earlier days
  const planned = new Map<IngredientId, number>(); // stock to buy (exact)
  const firstDay = new Map<IngredientId, number>();
  const noRoom = new Set<IngredientId>();
  let storageNeeded = 0;
  const unitsOf = (id: IngredientId, stock: number) => marketUnitsCovering(id, stock, measure);
  const roomFor = (id: IngredientId, stock: number) =>
    stockForMarketUnits(id, unitsOf(id, stock), measure);

  needs.forEach((need, d) => {
    // Today first; within a day, the biggest needs first.
    for (const [id, quantity] of [...need].sort((a, b) => b[1] - a[1])) {
      if (noRoom.has(id)) continue;
      const have = Math.max(0, freshOn(id, d) - (used.get(id) ?? 0));
      const fromStock = Math.min(have, quantity);
      used.set(id, normalizeQuantity((used.get(id) ?? 0) + fromStock));
      const short = normalizeQuantity(quantity - fromStock);
      if (short <= 0) continue;
      if (d >= shelfLifeForIngredient(id)) continue; // would spoil before that day
      const before = planned.get(id) ?? 0;
      const after = normalizeQuantity(before + short);
      const extraRoom = roomFor(id, after) - roomFor(id, before);
      if (storageNeeded + extraRoom > storageFree + 1e-9) {
        noRoom.add(id);
        continue;
      }
      storageNeeded = normalizeQuantity(storageNeeded + extraRoom);
      planned.set(id, after);
      if (!firstDay.has(id)) firstDay.set(id, d);
    }
  });

  const forToday = new Set(needs[0]?.keys() ?? []);
  const rows: MarketPlanRow[] = [...planned]
    .map(([ingredientId, stock]) => {
      const buyUnits = unitsOf(ingredientId, stock);
      return {
        ingredientId,
        stock,
        buyUnits,
        cost: restaurantQuote(save, ingredientId, buyUnits).totalCost,
        firstDay: firstDay.get(ingredientId) ?? 0,
        forToday: forToday.has(ingredientId),
      };
    })
    .sort(
      (a, b) =>
        Number(b.forToday) - Number(a.forToday) || a.firstDay - b.firstDay || b.cost - a.cost,
    );
  return {
    days,
    dayLevels: levels,
    rows,
    noRoom: [...noRoom],
    totalCost: rows.reduce((t, r) => t + r.cost, 0),
    storageNeeded,
    storageFree,
  };
}
