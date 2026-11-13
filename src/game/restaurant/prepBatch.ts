/**
 * THE PREP BATCH (developer 2026-11-12, from player reviews: "the mini-games are too easy, increase the count of ingredients; the restaurant should
 * purchase a lot more, so raise the basic purchases and the requirement amount").
 *
 * Before: one order used ONE plate's portion (a tomato 0.3 lb, a bread quarter loaf), so a whole level bought $1-$16 of food, the delivery basket had
 * 6-10 pieces and the mini-games that work on what was bought (Unpack the delivery, Delivery Inspection, Fridge Check, Stock the shelves) had little
 * to chew on. Now a service preps a BATCH: every ingredient of an order is used `prepBatchAt(level)` times its plate portion (3x at Level 3 growing to
 * 8x by Level 70), so the Pre-Service Check asks for, and the Market sells, several times more. The same amount is taken from the fridge when the
 * order is served (the check and the serve read ONE function, `batchedQuantity`), so nothing is left over and the fridge's Keep / Bin / Use next
 * cards stay about real food.
 *
 * Why not more orders: orders pay, so more orders would move the frozen economy baseline; a batch costs only food ($610 for the whole campaign today,
 * a few thousand with the batch against about $299k earned), and the order's pay is unchanged.
 * Why a row cap: the fridge holds 40 units until the player buys the Commercial one (Level 23 for the completionist), so one ingredient of one order
 * never takes more than `rowCapAt(level)` units (a heavy fruit like a watermelon is not multiplied beyond it).
 *
 * Who is batched: a level's OWN orders (the service the player prepped for). Menu guests and walk-ins are extras that order from the menu one plate at a
 * time, so they use the plain plate (`asPlate` marks their recipe copy): their stock, their fridge room and their pay are as they were, and a late
 * service with a dozen guests does not need a dozen batches of food.
 *
 * Pure leaf module: no save, no money, no randomness.
 */
import { rampOf } from "../business/difficultyRamp";

export type PrepBatchTier = { from: number; times: number };

/** The batch by level: the first stock service is Level 3 (Levels 1-2 use no stock). Smooth between rows (difficultyRamp.ts). */
export const PREP_BATCH_TIERS: readonly PrepBatchTier[] = [
  { from: 3, times: 3 },
  { from: 8, times: 4 },
  { from: 14, times: 5 },
  { from: 23, times: 6 },
  { from: 40, times: 7 },
  { from: 70, times: 8 },
];

/** First level with stock use (campaignStock `serviceUsesStock`): below it the batch is 1 (nothing is bought). */
export const PREP_BATCH_FROM_LEVEL = PREP_BATCH_TIERS[0]!.from;

/** How many times a plate's portion one order of this level uses. 1 when no level is given (the plain plate). */
export function prepBatchAt(level?: number): number {
  if (level === undefined || !(level >= PREP_BATCH_FROM_LEVEL)) return 1;
  return rampOf(PREP_BATCH_TIERS, level, (t) => t.times);
}

/** The Basic fridge (40 units) is what the player has until about Level 23; after it the cap doubles with the bigger fridges. */
export const BASIC_FRIDGE_ERA_END_LEVEL = 23;
export const ROW_CAP_BASIC = 4;
export const ROW_CAP_BIG = 6;

/** The most units of ONE ingredient that ONE order of this level uses (a portion above it, such as a steak, is never cut). */
export const rowCapAt = (level?: number): number =>
  level !== undefined && level >= BASIC_FRIDGE_ERA_END_LEVEL ? ROW_CAP_BIG : ROW_CAP_BASIC;

/**
 * What one order of `level` uses of an ingredient whose plate portion is `serving`: the batch times the portion, but never more than the row cap
 * (and never less than the portion itself). Level 1-2 and an unknown level read the plain portion.
 */
export function batchedQuantity(serving: number, level?: number): number {
  const times = prepBatchAt(level);
  if (times <= 1) return serving;
  // Thousandths, the precision every stock quantity is kept to (businessInventory.normalizeQuantity).
  return Math.round(Math.min(serving * times, Math.max(serving, rowCapAt(level))) * 1000) / 1000;
}

/** Recipes (copies) that are ordered one plate at a time: menu guests and walk-ins. A registry, so the recipe's own shape never changes. */
const PLATE_ONLY = new WeakSet<object>();

/** A copy of `recipe` that uses the plain plate portion (a menu guest's or a walk-in's dish). Marking a copy twice is harmless. */
export function asPlate<T extends object>(recipe: T): T {
  if (PLATE_ONLY.has(recipe)) return recipe;
  const copy = { ...recipe } as T;
  PLATE_ONLY.add(copy);
  return copy;
}

/** True for a recipe marked by `asPlate`: its order uses the plain plate, never the batch. */
export const isPlate = (recipe: object): boolean => PLATE_ONLY.has(recipe);

/**
 * Recipes (copies) that belong to ANOTHER level than the one being checked: the next level's own orders that a walk-in must leave alone
 * (menuGuests `reservedTicketsFor`). They are batched at their own level, not at the level of the check that counts them (deep check 2026-11-12:
 * the reserve was a little too small where the batch or the row cap grows, so a walk-in could eat into the next service's stock).
 */
const OWN_LEVEL = new WeakMap<object, number>();

/** A copy of `recipe` whose order is batched at `level`, whatever level the check is for. */
export function atLevel<T extends object>(recipe: T, level: number): T {
  const copy = { ...recipe } as T;
  OWN_LEVEL.set(copy, level);
  return copy;
}

/** The level a recipe marked by `atLevel` is batched at (undefined: the level of the check). */
export const ownLevelOf = (recipe: object): number | undefined => OWN_LEVEL.get(recipe);
