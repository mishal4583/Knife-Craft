/**
 * THE CASH LYING ON THE TABLES (developer 2026-10-31): served customers leave their pay and tip
 * on the tables, it piles up like an idle game, and the player collects it whenever they like
 * (one tap on the pile, in the dining room or on the restaurant map) — but it must be in the till
 * before the night is counted and closed (ClosingTime).
 *
 * Presentation only, and pure: how many bundles to draw for an amount and where they lie. The
 * money itself is `economy/pendingCash.ts`.
 */
import type { KitchenMapArtStage } from "../kitchen/kitchenMapArt";
import { FLOOR_SEATS, type FloorPoint } from "./serviceFloor";

/** The most bundles one table shows. */
export const MAX_BUNDLES = 5;

/** Bundles for the whole pile: a bigger pile looks bigger (1 for any cash, up to two tables' worth). */
export function bundleCount(cents: number): number {
  if (!(cents > 0)) return 0;
  const tiers = [2_000, 5_000, 10_000, 20_000, 40_000, 80_000, 150_000, 300_000];
  return 1 + tiers.filter((t) => cents >= t).length;
}

export type TablePile = {
  /** Where the pile lies, in map percent (0–100 of the painting). */
  at: FloorPoint;
  bundles: number;
};

/**
 * The piles for `cents` on this kitchen stage's two front tables: `first` (default the left one)
 * fills first (up to MAX_BUNDLES), the rest goes to the other. The dining room passes the table
 * nobody is sitting at first, so the pile never hides a guest's order. Nothing owed: no piles.
 */
export function tablePiles(
  stage: KitchenMapArtStage,
  cents: number,
  first: 0 | 1 = 0,
): TablePile[] {
  const total = Math.min(bundleCount(cents), MAX_BUNDLES * 2);
  if (total <= 0) return [];
  const seats = FLOOR_SEATS[stage];
  const a = seats[first];
  const b = seats[first === 0 ? 1 : 0];
  const onFirst = Math.min(total, MAX_BUNDLES);
  const piles: TablePile[] = [{ at: { x: a.table.x + 3.2, y: a.table.y }, bundles: onFirst }];
  if (total > onFirst)
    piles.push({ at: { x: b.table.x + 3.2, y: b.table.y }, bundles: total - onFirst });
  return piles;
}
