/**
 * BULK_BUYING — wholesale purchasing in the Market (developer 2026-10-05
 * §7): quantity presets and a bulk discount for ingredients and every
 * consumable supply (napkins, dish soap, cleaning liquid, takeaway
 * containers and bags, the rest of the packaging & hygiene section).
 * Durable tableware and smallwares are not consumables and get no bulk
 * discount.
 *
 * The discount is the LAST layer on the Market's own price (after
 * today's supplier event, contract and Prep Cook), applied by the existing
 * purchase functions through their optional `bulkDiscount` argument — the
 * quote the card shows and the purchase use the same number, and a
 * purchase still writes exactly one ledger entry.
 *
 * Every number here is PROVISIONAL and configurable: the economy pass sets
 * the real tiers (docs/ECONOMY_TODO.md #21). Pure; nothing reads
 * RESTAURANT_MODE (the Market and App pass a discount only in the
 * restaurant build).
 */

/** Quantity presets on a Market card (ingredient units; supply packs). */
export const BULK_PRESETS: readonly number[] = [5, 25, 50, 100];

/** From `minQuantity` on, `discount` (a fraction) comes off the price. Provisional. */
export const BULK_DISCOUNTS: readonly { minQuantity: number; discount: number }[] = [
  { minQuantity: 25, discount: 0.03 },
  { minQuantity: 50, discount: 0.05 },
  { minQuantity: 100, discount: 0.08 },
];

/** The most supply packs one restaurant purchase can buy (the largest preset). */
export const BULK_MAX_PACKS = 100;

/** The bulk discount for buying `quantity` (0 below the first tier). */
export function bulkDiscountFor(quantity: number): number {
  let d = 0;
  for (const tier of BULK_DISCOUNTS) if (quantity >= tier.minQuantity) d = tier.discount;
  return d;
}

/** A whole-cent unit price after a bulk discount (never below 0). */
export function discountedUnitCost(unitCost: number, discount: number): number {
  return Math.max(0, Math.round(unitCost * (1 - discount)));
}

/** The next tier above `quantity`, for "Buy N for X% off" hints; null at the top. */
export function nextBulkTier(quantity: number): { minQuantity: number; discount: number } | null {
  return BULK_DISCOUNTS.find((t) => t.minQuantity > quantity) ?? null;
}
