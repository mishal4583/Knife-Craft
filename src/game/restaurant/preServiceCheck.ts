/**
 * PRE_SERVICE_CHECK — what the Pre-Service Check shows for a level, from
 * the save alone (spec §6, §24–25). Null when the level has no check: a
 * replay (free practice), or a level whose service uses no stock yet
 * (Levels 1–10).
 *
 * The tickets still to serve are the level's rolled tickets after the
 * orders a previous try already paid; `progress` saves the tickets when
 * they were rolled just now. Pure; nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import type { LevelDefinition } from "../levels/levelTypes";
import type { LevelProgress } from "../levels/LevelManager";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { isCompleted } from "../levels/LevelManager";
import { levelNumber } from "../levels/levelMastery";
import { paidOrdersFor } from "../levels/paidOrders";
import { ticketsFor } from "./serviceTickets";
import { serviceStockCheck, serviceUsesStock, type ServiceStockCheck } from "./campaignStock";
import { opensNewDay, restaurantDayOf, todaysServices, type DayService } from "./restaurantDay";
import { hasNewsToShow, restaurantNewsAt, type RestaurantNews } from "./restaurantNews";
import { unseenStarterCrate, type KitLine } from "./restaurantMigration";
import { remainingMenuGuests } from "./menuGuests";
import { purchaseQuote } from "../business/BusinessInventoryManager";
import type { IngredientId } from "../definitions";
import { serviceShape, staffRequirementsFor, type StaffRequirement } from "./staffRequirements";
import {
  orderServiceFor,
  serviceSuppliesCheck,
  suppliesNeedAttention,
  type OrderService,
  type ServiceSuppliesCheck,
} from "./serviceSupplies";

export type PendingService = {
  level: LevelDefinition;
  levelNumber: number;
  /** Orders still to serve this service, in order. */
  tickets: RecipeDefinition[];
  check: Extract<ServiceStockCheck, { applies: true }>;
  /** The level progress with these tickets saved (same object when they already were). */
  progress: LevelProgress;
};

export function serviceCheckFor(save: SaveData, level: LevelDefinition): PendingService | null {
  if (isCompleted(level.id, save.levelProgress)) return null;
  const n = levelNumber(level.id);
  if (!serviceUsesStock(n)) return null;
  const { tickets, progress } = ticketsFor(save.levelProgress, level);
  const remaining = tickets.slice(paidOrdersFor(progress, level.id).length);
  const check = serviceStockCheck(save, n, remaining);
  if (!check.applies) return null;
  return { level, levelNumber: n, tickets: remaining, check, progress };
}

/** True when the check must be shown before the service starts. */
export function serviceNeedsAttention(pending: PendingService | null): boolean {
  return !!pending && (!pending.check.ready || pending.check.hasExpired);
}

/**
 * The whole pre-service sheet for a first play of `level`: the stock check
 * (from L15) AND, when this level opens a new restaurant day, the opening
 * card (Day N and its services). Null for a replay.
 */
export type ServicePlan = {
  level: LevelDefinition;
  levelNumber: number;
  tickets: RecipeDefinition[];
  check: ServiceStockCheck;
  progress: LevelProgress;
  day: number;
  /** Today's services when this level opens the day; null mid-day. */
  opening: DayService[] | null;
  /** Each remaining ticket's dine-in / takeaway (null before L31: no supplies). */
  services: (OrderService | null)[];
  /** Place settings, napkins, packaging, dish soap, cleaning liquid (phase G). */
  supplies: ServiceSuppliesCheck;
  /** What's new at this level and what's coming (restaurantNews.ts). */
  news: RestaurantNews;
  /** The staff this service needs (staffRequirements.ts); an unmet one blocks START. */
  staff: StaffRequirement[];
  /** Phase M: the starter crate an existing save received, until the player has seen it. */
  welcome: KitLine[] | null;
  /** Today's menu guests and the extra stock their dishes need (optional — never blocks). */
  guests: GuestStock;
};

/** One ingredient the menu guests need beyond the level's own orders: whole Market units. */
export type GuestStockRow = { ingredientId: IngredientId; buyUnits: number; cost: number };

export type GuestStock = {
  /** The guests still to come (recipe names, in order). */
  dishes: string[];
  /** What to buy so every guest can be served (empty when stocked or before stock, L15). */
  rows: GuestStockRow[];
};

/**
 * Phase N: the menu guests' stock, as optional rows. The need of the level's
 * own orders AND its guests together, minus the own orders' need, so buying
 * these rows never double-counts. Priced at the Market's own price.
 */
export function guestStockFor(
  save: SaveData,
  level: LevelDefinition,
  n: number,
  tickets: readonly RecipeDefinition[],
): GuestStock {
  const guests = remainingMenuGuests(save, level);
  const dishes = guests.map((r) => r.name);
  const all = serviceStockCheck(save, n, [...tickets, ...guests]);
  const own = serviceStockCheck(save, n, tickets);
  if (!all.applies || !own.applies || guests.length === 0) return { dishes, rows: [] };
  const ownBuy = new Map(own.missingRows.map((r) => [r.ingredientId, r.buyUnits]));
  const rows: GuestStockRow[] = [];
  for (const r of all.missingRows) {
    const extra = r.buyUnits - (ownBuy.get(r.ingredientId) ?? 0);
    if (extra <= 0) continue;
    rows.push({
      ingredientId: r.ingredientId,
      buyUnits: extra,
      cost: purchaseQuote(save, r.ingredientId, extra).totalCost,
    });
  }
  return { dishes, rows };
}

export function servicePlanFor(save: SaveData, level: LevelDefinition): ServicePlan | null {
  if (isCompleted(level.id, save.levelProgress)) return null;
  const n = levelNumber(level.id);
  const { tickets, progress } = ticketsFor(save.levelProgress, level);
  const paid = paidOrdersFor(progress, level.id).length;
  const remaining = tickets.slice(paid);
  const services = remaining.map((_, i) => orderServiceFor(n, paid + i));
  return {
    level,
    levelNumber: n,
    tickets: remaining,
    check: serviceStockCheck(save, n, remaining),
    progress,
    day: restaurantDayOf(save).day,
    opening: opensNewDay(save) ? todaysServices(save, n) : null,
    services,
    supplies: serviceSuppliesCheck(save, n, services),
    news: restaurantNewsAt(n),
    staff: staffRequirementsFor(save, n, serviceShape(save, n, remaining, services)),
    welcome: unseenStarterCrate(save),
    guests: guestStockFor(save, level, n, remaining),
  };
}

/** True when every staff requirement of the plan is met. */
export function staffReady(plan: ServicePlan): boolean {
  return plan.staff.every((r) => r.met);
}

/** The sheet shows when the day opens, something new arrives, or stock, staff or supplies need attention. */
export function servicePlanNeedsSheet(plan: ServicePlan | null): boolean {
  if (!plan) return false;
  if (plan.opening) return true;
  if (hasNewsToShow(plan.news)) return true;
  if (plan.welcome) return true;
  if (!staffReady(plan)) return true;
  if (suppliesNeedAttention(plan.supplies)) return true;
  return plan.check.applies && (!plan.check.ready || plan.check.hasExpired);
}
