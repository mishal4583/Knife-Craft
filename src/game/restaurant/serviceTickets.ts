/**
 * SERVICE_TICKETS — a campaign level's orders, rolled BEFORE service.
 *
 * An order-pool level used to pick each next order at random as the
 * previous one was served, so nobody could know what a service needed. In
 * the restaurant the Pre-Service Check lists exactly what today's orders
 * use, so the orders are rolled up front:
 *
 *   - order-pool level: `requiredOrders` picks from the level's own pool
 *     with the existing OrderGenerator (same weights, same "not the same
 *     dish/cuisine twice in a row" rule), from a seeded generator, so the
 *     same level gives the same orders (deterministic, fair, testable);
 *   - batch group: its fixed recipes, in order.
 *
 * They are saved in `levelProgress.tickets[levelId]` (recipe ids) until the
 * level completes (LevelManager.completeLevel drops them, like
 * `paidOrders`), so leaving and coming back never re-rolls a service (no
 * shopping around for easier orders) and a retry carries on with the same
 * tickets after the orders already paid.
 *
 * Pure. Level data is not changed.
 */
import type { LevelDefinition } from "../levels/levelTypes";
import type { LevelProgress } from "../levels/LevelManager";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { getCampaignRecipe } from "../recipes/campaignRecipes";
import { generateOrder } from "../service/OrderGenerator";
import { makeSeededRand } from "../business/businessDeterministicRandom";
import { levelNumber } from "../levels/levelMastery";

const resolve = (ids: readonly string[]): RecipeDefinition[] =>
  ids.map((id) => getCampaignRecipe(id)).filter((r): r is RecipeDefinition => !!r);

/** The fixed seed a level's tickets are rolled from (its number; the same for every player). */
export function ticketSeedFor(level: LevelDefinition): number {
  return levelNumber(level.id) * 7919;
}

/** Rolls the level's tickets (pure; does not save them). Empty when the level has no orders. */
export function rollServiceTickets(level: LevelDefinition): RecipeDefinition[] {
  if (level.batchGroupRecipeIds?.length) return resolve(level.batchGroupRecipeIds);
  const pool = resolve(level.recipePoolIds ?? []);
  if (pool.length === 0) return [];
  const rand = makeSeededRand(ticketSeedFor(level));
  const count = Math.max(1, level.requiredOrders ?? 1);
  const tickets: RecipeDefinition[] = [];
  for (let i = 0; i < count; i++) {
    const pick = generateOrder(
      {
        unlockedRecipes: pool,
        recentRecipeIds: tickets.map((r) => r.id),
        recentCuisineIds: tickets.map((r) => r.cuisineId),
      },
      rand,
    );
    if (!pick) break;
    tickets.push(pick);
  }
  return tickets;
}

/** The level's saved tickets, or null when none were rolled yet (or one no longer resolves). */
export function savedTicketsFor(
  progress: LevelProgress,
  level: LevelDefinition,
): RecipeDefinition[] | null {
  const ids = progress.tickets?.[level.id];
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const recipes = resolve(ids);
  return recipes.length === ids.length ? recipes : null;
}

/** The saved tickets, or freshly rolled ones plus the progress that saves them. */
export function ticketsFor(
  progress: LevelProgress,
  level: LevelDefinition,
): { tickets: RecipeDefinition[]; progress: LevelProgress } {
  const saved = savedTicketsFor(progress, level);
  if (saved) return { tickets: saved, progress };
  const tickets = rollServiceTickets(level);
  return {
    tickets,
    progress: {
      ...progress,
      tickets: { ...(progress.tickets ?? {}), [level.id]: tickets.map((r) => r.id) },
    },
  };
}

/** Drops the level's tickets (it is complete). Leaves the shape alone when there are none. */
export function withoutServiceTickets(progress: LevelProgress, levelId: string): LevelProgress {
  if (!progress.tickets || !(levelId in progress.tickets)) return progress;
  const rest = { ...progress.tickets };
  delete rest[levelId];
  return { ...progress, tickets: rest };
}
