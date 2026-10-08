/**
 * LEVEL PAY PREVIEW (audit 2026-10-08) — what a campaign level will pay, for
 * the Kitchen's Today's Order card and the Order Board. They used to show the
 * completion reward alone ("+$83.00"), while Level 12 really paid $391: its
 * order earned $280 + a $28 quality bonus on top of the $83.
 *
 *  - orders: each order the level still owes (its rolled tickets after the
 *    paid ones) at its recipe price (`recipePay`, what the settlement's
 *    revenue is) — the quality bonus comes on top, so it's a floor ("about");
 *  - completion: the level's completion reward (`paidLevelReward`).
 *
 * Null for a level already completed (a replay pays nothing). Pure; reads the
 * same functions the serve uses. Nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import type { LevelDefinition } from "../levels/levelTypes";
import { isCompleted } from "../levels/LevelManager";
import { paidOrdersFor } from "../levels/paidOrders";
import { paidLevelReward } from "../levels/levelRewards";
import { recipePay } from "../recipes/recipePay";
import { dollars } from "../money";
import { ticketsFor } from "./serviceTickets";

export type LevelPayPreview = { orders: number; completion: number; total: number };

export function levelPayPreview(save: SaveData, level: LevelDefinition): LevelPayPreview | null {
  if (isCompleted(level.id, save.levelProgress)) return null;
  const { tickets, progress } = ticketsFor(save.levelProgress, level);
  const owed = tickets.slice(paidOrdersFor(progress, level.id).length);
  const orders = owed.reduce((t, r) => t + dollars(recipePay(r, level.chapter)), 0);
  const completion = paidLevelReward(level);
  return { orders, completion, total: orders + completion };
}
