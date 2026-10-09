/**
 * INVENTORY_ANALYTICS — read-only selectors for the Inventory screen (the
 * monitoring dashboard) and Market → Ingredients (procurement). Every
 * figure is DERIVED from state that already exists — `business.inventory`,
 * the refrigerator, perishability, the active menu, the finance
 * accumulator, `business.spoilage` and the one EconomyLedger — never a
 * second store, price table, counter or database:
 *
 *   ingredients / categories  INGREDIENTS (the registry)
 *   prices                    BusinessInventoryManager.todaysUnitCost / purchaseQuote
 *   quantities, stock value   business.inventory (inventoryValue)
 *   fridge                    RefrigeratorManager
 *   freshness                 perishability.ts
 *   dishes, needs             activeBusinessDishes + businessDishRequirements
 *   purchases                 finance.dailyAccumulator + lifetime, "inventory-purchase" ledger entries
 *   consumption               "business-revenue" ledger entries (description = dish id)
 *   waste                     business.spoilage + lastDailyPnL.spoilageValue
 */
import type { SaveData } from "../SaveManager";
import { INGREDIENTS, type IngredientId } from "../definitions";
import { inventoryValue, normalizeQuantity } from "./businessInventory";
import { getRefrigerator } from "./refrigeratorDefinitions";
import { getInventoryUsedCapacity, getAvailableStorageCapacity } from "./RefrigeratorManager";
import {
  ageInDays,
  perishabilityStateFor,
  shelfLifeForIngredient,
  usableQuantity,
  type PerishabilityState,
} from "./perishability";
import { activeBusinessDishes } from "./businessMenuActivation";
import { businessDishRequirements } from "./businessServiceCatalog";
import { getBusinessDish, type BusinessDish } from "./businessDishCatalog";
import { businessCustomersToday, businessOrderAvailability } from "./BusinessServiceManager";

/** The registry's own ingredient categories, in Market order, with player-facing names. */
export const INGREDIENT_GROUPS: ReadonlyArray<{ category: string; label: string; emoji: string }> =
  [
    { category: "Vegetable", label: "Vegetables", emoji: "🥕" },
    { category: "Fruit", label: "Fruit", emoji: "🍎" },
    { category: "Herb", label: "Herbs", emoji: "🌿" },
    { category: "Aromatic", label: "Aromatics", emoji: "🧄" },
    { category: "Bakery", label: "Bakery", emoji: "🥖" },
    { category: "Dairy", label: "Dairy & Tofu", emoji: "🧀" },
    { category: "Protein", label: "Protein", emoji: "🍗" },
  ];

export const ALL_INGREDIENT_IDS = Object.keys(INGREDIENTS) as IngredientId[];

/** Days of shelf life left at or below which stock counts as "expiring soon". */
export const EXPIRING_SOON_DAYS = 2;

/** Summed need per ingredient of one serve of `dish` (its requirements, pre-summed). */
function dishNeeds(dish: BusinessDish): Map<IngredientId, number> {
  const needs = new Map<IngredientId, number>();
  for (const r of businessDishRequirements(dish)) {
    needs.set(r.ingredientId, normalizeQuantity((needs.get(r.ingredientId) ?? 0) + r.quantity));
  }
  return needs;
}

/**
 * The menu the selectors below measure against: the Business menu's active
 * dishes, unless the caller passes the menu in effect (the restaurant build
 * passes its campaign menu, restaurantMenu.activeMenuDishes, which is empty
 * before the menu opens). Only WHICH dishes count changes, never a formula.
 */
export type MenuInEffect = readonly BusinessDish[];
const menuOf = (save: SaveData, menu?: MenuInEffect): readonly BusinessDish[] =>
  menu ?? activeBusinessDishes(save.business.menuActivation);

/** The active menu's dishes that use `id` — the "Used in" list. */
export function activeDishesUsing(
  save: SaveData,
  id: IngredientId,
  menu?: MenuInEffect,
): BusinessDish[] {
  return menuOf(save, menu).filter((d) => dishNeeds(d).has(id));
}

export type FridgeStatus = {
  name: string;
  capacity: number;
  used: number;
  available: number;
  /** used / capacity, 0–1. */
  usage: number;
  stockValue: number;
};

export function fridgeStatus(save: SaveData): FridgeStatus {
  const fridgeId = save.business.refrigerator.refrigeratorId;
  const capacity = getRefrigerator(fridgeId)?.capacity ?? 0;
  const used = getInventoryUsedCapacity(save.business.inventory);
  return {
    name: getRefrigerator(fridgeId)?.name ?? "Refrigerator",
    capacity,
    used,
    available: getAvailableStorageCapacity(save.business.inventory, fridgeId),
    usage: capacity > 0 ? Math.min(1, used / capacity) : 0,
    stockValue: inventoryValue(save.business.inventory),
  };
}

export type OnHandItem = {
  id: IngredientId;
  quantity: number;
  /** quantity × the weighted-average price paid, whole cents. */
  value: number;
  state: PerishabilityState;
  shelfLife: number;
  /** Business Days until it expires: 1 = spoils at End Business Day tonight, 0 = already expired. */
  daysLeft: number;
  spoilsTonight: boolean;
  usedIn: BusinessDish[];
};

/** Everything in the fridge, soonest to spoil first. */
export function onHandItems(save: SaveData, menu?: MenuInEffect): OnHandItem[] {
  const day = save.business.calendar.businessDay;
  return Object.values(save.business.inventory)
    .filter((e): e is NonNullable<typeof e> => !!e && e.quantity > 0)
    .map((e) => {
      const shelfLife = shelfLifeForIngredient(e.ingredientId);
      const daysLeft = Math.max(0, shelfLife - ageInDays(e.purchaseDay, day));
      return {
        id: e.ingredientId,
        quantity: e.quantity,
        value: Math.round(e.quantity * e.unitCost),
        state: perishabilityStateFor(e.ingredientId, e.purchaseDay, day),
        shelfLife,
        daysLeft,
        spoilsTonight: daysLeft === 1,
        usedIn: activeDishesUsing(save, e.ingredientId, menu),
      };
    })
    .sort(
      (a, b) =>
        a.daysLeft - b.daysLeft || INGREDIENTS[a.id].name.localeCompare(INGREDIENTS[b.id].name),
    );
}

/** On-hand stock that expires within EXPIRING_SOON_DAYS (tonight first). Informational only. */
export function expiringSoon(save: SaveData): OnHandItem[] {
  return onHandItems(save).filter((i) => i.daysLeft <= EXPIRING_SOON_DAYS);
}

export type IngredientDemand = {
  /** Average need per order among the active dishes that use it. */
  perOrder: number;
  /** Expected need over today's customers: target × (Σ need over active dishes) ÷ active dishes — orders spread over the menu. */
  perDay: number;
  dishCount: number;
};

/** What today's menu is expected to draw of each ingredient it uses. */
export function menuDemand(
  save: SaveData,
  menu?: MenuInEffect,
): Map<IngredientId, IngredientDemand> {
  const active = menuOf(save, menu);
  const target = businessCustomersToday(save).target;
  const totals = new Map<IngredientId, { need: number; dishes: number }>();
  for (const dish of active) {
    for (const [id, qty] of dishNeeds(dish)) {
      const t = totals.get(id) ?? { need: 0, dishes: 0 };
      totals.set(id, { need: t.need + qty, dishes: t.dishes + 1 });
    }
  }
  const demand = new Map<IngredientId, IngredientDemand>();
  for (const [id, t] of totals) {
    demand.set(id, {
      perOrder: t.need / t.dishes,
      perDay: active.length > 0 ? (target * t.need) / active.length : 0,
      dishCount: t.dishes,
    });
  }
  return demand;
}

export type LowStockItem = {
  id: IngredientId;
  usable: number;
  /** The low-stock line: what today's customers are expected to use (menuDemand.perDay). */
  threshold: number;
  /** Orders the usable stock still covers, at the menu's average need per order. */
  dishesLeft: number;
};

/**
 * Menu ingredients whose usable stock is below what today's customers are
 * expected to use — the threshold follows the active menu, today's
 * customer target and each dish's real need, never a fixed number.
 * Ingredients with no usable stock at all are not "low", they are missing
 * (menuReadiness.mostNeeded).
 */
export function lowStockItems(save: SaveData, menu?: MenuInEffect): LowStockItem[] {
  const day = save.business.calendar.businessDay;
  const items: LowStockItem[] = [];
  for (const [id, d] of menuDemand(save, menu)) {
    const usable = usableQuantity(save.business.inventory, id, day);
    if (usable <= 0 || usable >= d.perDay) continue;
    items.push({
      id,
      usable,
      threshold: d.perDay,
      dishesLeft: Math.floor(normalizeQuantity(usable / d.perOrder)),
    });
  }
  return items.sort(
    (a, b) => a.dishesLeft - b.dishesLeft || a.usable / a.threshold - b.usable / b.threshold,
  );
}

export type MenuReadiness = {
  ready: number;
  total: number;
  /** Missing ingredients, ranked by how many active dishes each one blocks. */
  mostNeeded: Array<{ id: IngredientId; blocks: number }>;
};

export function menuReadiness(save: SaveData, menu?: MenuInEffect): MenuReadiness {
  const active = menuOf(save, menu);
  const blocks = new Map<IngredientId, number>();
  let ready = 0;
  for (const dish of active) {
    const availability = businessOrderAvailability(save, dish);
    if (availability.available) {
      ready++;
      continue;
    }
    for (const id of availability.missing) blocks.set(id, (blocks.get(id) ?? 0) + 1);
  }
  const mostNeeded = [...blocks]
    .map(([id, n]) => ({ id, blocks: n }))
    .sort(
      (a, b) => b.blocks - a.blocks || INGREDIENTS[a.id].name.localeCompare(INGREDIENTS[b.id].name),
    );
  return { ready, total: active.length, mostNeeded };
}

export type InventorySummary = {
  stockValue: number;
  stocked: number;
  ingredientCount: number;
  /** Fridge used / capacity, 0–1. */
  fridgeUsage: number;
  /** Lifetime spoiled stock (business.spoilage) — real sweeps at End Business Day only. */
  wasteValue: number;
  wasteQuantity: number;
  /** Spoilage of the last completed Business Day, or null before the first one. */
  lastDayWasteValue: number | null;
};

export function inventorySummary(save: SaveData): InventorySummary {
  const fridge = fridgeStatus(save);
  return {
    stockValue: fridge.stockValue,
    stocked: onHandItems(save).length,
    ingredientCount: ALL_INGREDIENT_IDS.length,
    fridgeUsage: fridge.usage,
    wasteValue: save.business.spoilage.totalSpoiledValue,
    wasteQuantity: save.business.spoilage.totalSpoiledQuantity,
    lastDayWasteValue: save.business.finance.lastDailyPnL?.spoilageValue ?? null,
  };
}

export type PurchasingStats = {
  /** Spent on ingredients this Business Day (finance accumulator). */
  businessDaySpent: number;
  /** Ingredient purchases this Business Day — null when a save from before the count existed has spending but no count. */
  businessDayPurchases: number | null;
  /** businessDaySpent ÷ businessDayPurchases, whole cents; null with no purchases. */
  averagePurchase: number | null;
  /** Spent on ingredients today (the device's calendar date), from the ledger's "inventory-purchase" entries. */
  todaySpent: number;
  todayPurchases: number;
  /** The last completed Business Day's ingredient spend, or null before the first one. */
  lastBusinessDaySpent: number | null;
  lifetimeSpent: number;
};

function sameLocalDate(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

export function purchasingStats(save: SaveData, now: number = Date.now()): PurchasingStats {
  const acc = save.business.finance.dailyAccumulator;
  const spent = acc.inventoryPurchaseCost;
  const count = acc.inventoryPurchases ?? 0;
  const today = save.economyLedger.filter(
    (e) => e.category === "inventory-purchase" && sameLocalDate(e.timestamp, now),
  );
  return {
    businessDaySpent: spent,
    businessDayPurchases: count === 0 && spent > 0 ? null : count,
    averagePurchase: count > 0 ? Math.round(spent / count) : null,
    todaySpent: today.reduce((sum, e) => sum - e.amount, 0),
    todayPurchases: today.length,
    lastBusinessDaySpent: save.business.finance.lastDailyPnL?.inventoryPurchaseCost ?? null,
    lifetimeSpent: save.business.finance.lifetime.inventoryPurchaseCost,
  };
}

export type IngredientConsumption = {
  /** Paid Business orders the ledger still holds (a $0 dish writes no entry; the ledger keeps its most recent entries). */
  orders: number;
  /** Stock those orders drew, per ingredient, most used first. */
  items: Array<{ id: IngredientId; quantity: number; orders: number }>;
};

/**
 * What served Business orders consumed, derived from the ledger: each
 * "business-revenue" entry names the dish served, and a serve draws
 * exactly `businessDishRequirements(dish)` from stock. No second record.
 */
export function ingredientConsumption(save: SaveData): IngredientConsumption {
  const used = new Map<IngredientId, { quantity: number; orders: number }>();
  let orders = 0;
  for (const entry of save.economyLedger) {
    if (entry.category !== "business-revenue" || !entry.description) continue;
    const dish = getBusinessDish(entry.description);
    if (!dish) continue;
    orders++;
    for (const [id, qty] of dishNeeds(dish)) {
      const u = used.get(id) ?? { quantity: 0, orders: 0 };
      used.set(id, { quantity: normalizeQuantity(u.quantity + qty), orders: u.orders + 1 });
    }
  }
  const items = [...used]
    .map(([id, u]) => ({ id, ...u }))
    .sort(
      (a, b) =>
        b.orders - a.orders ||
        b.quantity - a.quantity ||
        INGREDIENTS[a.id].name.localeCompare(INGREDIENTS[b.id].name),
    );
  return { orders, items };
}

export type DishSales = {
  /** Paid Business orders the ledger still holds (the ledger keeps its most recent entries). */
  orders: number;
  /** Served dishes, best-selling first: orders and the revenue they brought, whole cents. */
  dishes: Array<{ id: string; name: string; orders: number; revenue: number }>;
};

/**
 * Best-selling dishes, from the same "business-revenue" ledger entries
 * ingredientConsumption reads (each names the dish served and its price).
 * No second record.
 */
export function dishSales(save: SaveData): DishSales {
  const sold = new Map<string, { name: string; orders: number; revenue: number }>();
  let orders = 0;
  for (const entry of save.economyLedger) {
    if (entry.category !== "business-revenue" || !entry.description) continue;
    const dish = getBusinessDish(entry.description);
    if (!dish) continue;
    orders++;
    const s = sold.get(dish.id) ?? { name: dish.name, orders: 0, revenue: 0 };
    sold.set(dish.id, { ...s, orders: s.orders + 1, revenue: s.revenue + entry.amount });
  }
  const dishes = [...sold]
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue || a.name.localeCompare(b.name));
  return { orders, dishes };
}
