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
 * (from L11) AND, when this level opens a new restaurant day, the opening
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
};

export function servicePlanFor(save: SaveData, level: LevelDefinition): ServicePlan | null {
  if (isCompleted(level.id, save.levelProgress)) return null;
  const n = levelNumber(level.id);
  const { tickets, progress } = ticketsFor(save.levelProgress, level);
  const remaining = tickets.slice(paidOrdersFor(progress, level.id).length);
  return {
    level,
    levelNumber: n,
    tickets: remaining,
    check: serviceStockCheck(save, n, remaining),
    progress,
    day: restaurantDayOf(save).day,
    opening: opensNewDay(save) ? todaysServices(save, n) : null,
  };
}

/** The sheet shows when the day opens or the stock needs attention. */
export function servicePlanNeedsSheet(plan: ServicePlan | null): boolean {
  if (!plan) return false;
  if (plan.opening) return true;
  return plan.check.applies && (!plan.check.ready || plan.check.hasExpired);
}
