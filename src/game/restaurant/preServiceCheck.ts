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
