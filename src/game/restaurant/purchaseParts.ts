/**
 * PURCHASE PARTS (deep check 2026-11-12). On a "Temporary Shortage" day the supplier sells at most 10 units in ONE purchase
 * (businessSupplierEvents.ts; the number is not changed here). Since the prep batch (prepBatch.ts) a plan row can need 11-70 units, so the Market
 * plan's "Buy all" skipped those rows and a row's own button answered "not available today" (measured: 73 of the 89 stock levels on such a day).
 * The player could only buy them on the ingredient's card, 10 at a time.
 *
 * The plan's buttons now do what the player would: the same amount as several ordinary Market purchases, each within today's limit. Every part is
 * a real purchase (its own price, its own ledger entry). The ingredient's own card still sells one purchase at a time and says the limit.
 *
 * Pure: reads the day and the player's measure only.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import { eventForDay, maxPurchaseQuantityFor } from "../business/businessSupplierEvents";
import { lbPerMarketUnit, marketStep, measureOf } from "../business/measure";
import { restaurantQuote } from "./restaurantEconomy";

/**
 * `units` Market units (lb / kg / pieces) as the purchases today's supplier allows: `[units]` on a day with no limit or when it fits, else parts
 * each within the limit (the last one is the rest). Empty when even the smallest amount is over the limit (nothing can be bought).
 */
export function purchaseParts(
  save: Pick<SaveData, "business" | "settings">,
  ingredientId: IngredientId,
  units: number,
): number[] {
  if (!(units > 0)) return [];
  const max = maxPurchaseQuantityFor(eventForDay(save.business.calendar.businessDay));
  const perUnit = lbPerMarketUnit(ingredientId, measureOf(save));
  if (max === undefined || units * perUnit <= max + 1e-9) return [units];
  const step = marketStep(ingredientId);
  // The most Market units one purchase may be today, on the Market's own step (a quarter for weighed goods, a whole item otherwise).
  const most = Math.floor(max / perUnit / step + 1e-9) * step;
  if (!(most > 0)) return [];
  const parts: number[] = [];
  let left = units;
  while (left > 1e-9) {
    const part = Math.min(left, most);
    parts.push(Math.round(part / step) * step);
    left -= part;
  }
  return parts;
}

/**
 * What `units` really cost today when bought as `purchaseParts` buys them: each part at its own Market price (a smaller purchase can have a
 * smaller bulk discount). On a day with no limit this is the one quote. The Market plan's prices and the Pre-Service Check's "missing" total
 * read this, so the price on a button is the price its tap charges.
 */
export function partsCost(save: SaveData, ingredientId: IngredientId, units: number): number {
  return purchaseParts(save, ingredientId, units).reduce(
    (total, part) => total + restaurantQuote(save, ingredientId, part).totalCost,
    0,
  );
}
