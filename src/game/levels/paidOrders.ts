/**
 * PAID_ORDERS — the orders already served AND paid in a campaign level the
 * player hasn't finished yet (developer decision #5).
 *
 * A `requiredOrders: 2` level (or a batch group) pays each order when it is
 * served, but the level only completes once all of them are. Leaving after
 * the first order used to throw that progress away: the retry was still a
 * first play, so the first order paid again. Now each paid order is saved
 * in `levelProgress.paidOrders[levelId]` (its recipe id) in the SAME
 * persist as its payment, and:
 *
 *   - a retry carries on from there: a service level starts with those
 *     orders already counted; a batch group starts with those customers
 *     already served;
 *   - an order is only paid while the level still owes one (`mayPayOrder`),
 *     so no level ever pays more orders than it requires;
 *   - completing the level (LevelManager.completeLevel) clears the entry —
 *     a replay never pays anyway.
 *
 * Honest play is untouched: the same orders pay the same amounts once. An
 * old save has no `paidOrders` (nothing recorded) and behaves as before.
 * Pure — every function returns new objects.
 */
import type { LevelDefinition } from "./levelTypes";
import type { LevelProgress } from "./LevelManager";

/** Recipe ids of the orders already paid in this unfinished level, oldest first. */
export function paidOrdersFor(progress: LevelProgress, levelId: string): readonly string[] {
  const list = progress.paidOrders?.[levelId];
  return Array.isArray(list) ? list.filter((id) => typeof id === "string") : [];
}

/** How many orders the level needs (a batch group: one per recipe). */
export function ordersRequired(level: LevelDefinition): number {
  if (level.batchGroupRecipeIds?.length) return level.batchGroupRecipeIds.length;
  return Math.max(1, level.requiredOrders ?? 1);
}

/**
 * Whether serving `recipeId` now may pay: never on a completed level, never
 * once the level's required orders are all paid, and in a batch group never
 * for a customer whose order was already paid.
 */
export function mayPayOrder(
  progress: LevelProgress,
  level: LevelDefinition,
  recipeId: string,
): boolean {
  if (progress.completedLevelIds.includes(level.id)) return false;
  const paid = paidOrdersFor(progress, level.id);
  if (paid.length >= ordersRequired(level)) return false;
  if (level.batchGroupRecipeIds?.length) return !paid.includes(recipeId);
  return true;
}

/** Records one more paid order (call in the same save as the payment). */
export function withPaidOrder(
  progress: LevelProgress,
  levelId: string,
  recipeId: string,
): LevelProgress {
  return {
    ...progress,
    paidOrders: {
      ...(progress.paidOrders ?? {}),
      [levelId]: [...paidOrdersFor(progress, levelId), recipeId],
    },
  };
}

/** Drops the level's entry (it is complete). Leaves the shape alone when there is none. */
export function withoutPaidOrders(progress: LevelProgress, levelId: string): LevelProgress {
  if (!progress.paidOrders || !(levelId in progress.paidOrders)) return progress;
  const rest = { ...progress.paidOrders };
  delete rest[levelId];
  return { ...progress, paidOrders: rest };
}
