/**
 * RESTAURANT_ECONOMY — the Unified Restaurant economy pass (docs/ECONOMY_TODO.md).
 *
 * P0 — no double food cost. The campaign settlement (EconomySettlement)
 * deducts a built-in food cost (COGS) from every order, while in the
 * restaurant the player has already paid for the real ingredients in the
 * Market (and the order consumed them from stock). In the restaurant an
 * order therefore pays its RECIPE EARNINGS + QUALITY BONUS; its food cost
 * is the real stock, recorded when it was bought ("inventory-purchase").
 * The chain the developer set: level revenue → real ingredient consumption
 * → supplies → actual profit.
 *
 * The settlement is computed by the unchanged EconomySettlement (the
 * release build and the frozen Economy V2 baseline are untouched); this
 * only re-reads its result for the restaurant: food-cost lines become 0, no
 * INGREDIENT_COGS transaction. The quality bonus — and every boost knives,
 * boards and kitchen helpers give it — stays.
 *
 * Measured by scripts/restaurant-economy-pass.mts: a completionist who buys
 * everything ends Level 250 with ~$129k (target $100k–$150k, Economy V2.5);
 * with the double charge it was ~$95k.
 *
 * Pure; nothing reads RESTAURANT_MODE (App applies it in the restaurant build).
 */
import type { SettlementResult } from "../economy/economyTypes";

/** The restaurant's view of an order's settlement: earnings + quality bonus, food cost from stock. */
export function restaurantSettlement(settlement: SettlementResult): SettlementResult {
  return {
    ...settlement,
    finalCOGS: 0,
    supplierCOGSAdjustment: 0,
    equipmentCOGSSavings: 0,
    sharpnessCOGSPenalty: 0,
    staffCOGSSavings: 0,
    yieldSavings: 0,
    netResult: settlement.revenue + settlement.qualityBonus,
    transactions: settlement.transactions.filter((t) => t.type !== "INGREDIENT_COGS"),
  };
}

/** True for a settlement whose food came from the restaurant's own stock (no built-in food cost). */
export function foodFromStock(settlement: SettlementResult): boolean {
  return !settlement.transactions.some((t) => t.type === "INGREDIENT_COGS");
}
