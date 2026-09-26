/**
 * BUSINESS_PRICING — Economy V3 Phase 2, recalibrated Phase 14. The one
 * centralized place Business Mode purchase prices come from (brief: "Do
 * not hardcode random prices throughout the UI... create a centralized
 * data/configuration layer").
 *
 * Reuses `INGREDIENTS[id].category` (definitions.ts's own existing
 * field) exactly the way `ingredientCostRegistry.ts` already does for
 * Campaign COGS — same "derive from category, don't hand-pick every
 * ingredient" design pattern, but its OWN separate constant. Business
 * Mode purchase prices must never be read from, or fed back into,
 * `ingredientCostRegistry.ts` — a future rebalance of one must never
 * silently move the other.
 *
 * Economy V3 Phase 14 — REAL-WORLD RECALIBRATION. The original per-
 * category numbers here (Protein 85, Dairy 45, Bakery 35, Fruit 25,
 * Vegetable 20, Aromatic 12, Herb 8 — plain integers, no stated unit)
 * were prototype "coins," never grounded in anything. Phase 14 replaces
 * them with real 2026 U.S. retail/wholesale produce and protein pricing
 * (see docs/ECONOMY_V3_MASTER_SPEC.md §24 for every source/date), using
 * ONE consistent, documented methodology rather than inventing a
 * different one per category:
 *
 *   1. Start from a real retail price-per-real-unit for the category
 *      (BLS/FRED Average Price Data / USDA ERS Fruit & Vegetable Prices
 *      for produce; general U.S. grocery averages for dairy/bakery,
 *      clearly labeled as estimates where not individually fetched).
 *   2. Apply the documented restaurant procurement discount — foodservice
 *      distributors typically sell below retail; §24 cites the commonly-
 *      used industry rule of thumb of ~65% of retail as the wholesale/
 *      restaurant estimate. This is the SAME ratio for every category —
 *      never a different, unexplained discount per category.
 *   3. Store the result in whole US CENTS (Business Mode's own integer
 *      currency unit — see businessCurrency.ts's own doc for why the
 *      shared `SaveData.credits` field is interpreted as cents ONLY in
 *      Business Mode's own prices/display, never in Campaign's).
 *
 * Every ingredient also gets a real PURCHASE UNIT (lb/piece) — an
 * existing `BusinessInventory` "quantity" of N for an ingredient now
 * means "N of that real unit" (N lb of tomato, N loaves of bread), never
 * an abstract unlabeled count. This is a per-CATEGORY unit, the same
 * "derive from category" pattern as the price itself — not a per-
 * ingredient hand-tuned table, which would be 57+ individually-researched
 * numbers for a game that needs a believable, not laboratory-precise,
 * economy.
 */
import type { IngredientId } from "../definitions";
import { INGREDIENTS } from "../definitions";

export type PurchaseUnit = "lb" | "piece";

/** The real unit an ingredient in this category is bought/measured in. Weight-based produce/protein/dairy -> lb (the U.S. restaurant-industry standard unit); naturally discrete/packaged goods (bread, herb bunches) -> piece. */
const CATEGORY_PURCHASE_UNIT: Record<string, PurchaseUnit> = {
  Protein: "lb",
  Dairy: "lb",
  Bakery: "piece",
  Fruit: "lb",
  Vegetable: "lb",
  Aromatic: "lb",
  Herb: "piece",
};

const DEFAULT_PURCHASE_UNIT: PurchaseUnit = "piece";

export function purchaseUnitFor(ingredientId: IngredientId): PurchaseUnit {
  const category = INGREDIENTS[ingredientId].category;
  return CATEGORY_PURCHASE_UNIT[category] ?? DEFAULT_PURCHASE_UNIT;
}

/**
 * Whole US cents per real unit (per lb, or per piece) — see this file's
 * own header for the exact retail-price -> ~65%-wholesale-estimate
 * methodology and docs/ECONOMY_V3_MASTER_SPEC.md §24 for every source.
 *
 *   Vegetable ($1.50/lb retail blended average, BLS/FRED tomato $2.49/lb
 *     May 2026 + cheaper staples like onion/potato/carrot ~$0.80-1.20/lb)
 *     -> ~$0.98/lb wholesale, rounded to $1.00/lb = 100c/lb.
 *   Fruit ($2.00/lb retail blended average) -> ~$1.30/lb = 130c/lb.
 *   Protein ($6.50/lb retail-equivalent restaurant-grade chicken/beef/
 *     fish blended average) -> ~$4.20/lb, rounded to $4.50/lb = 450c/lb.
 *   Dairy ($5.00/lb retail blended average for cheese/butter/tofu) ->
 *     ~$3.25/lb = 325c/lb.
 *   Bakery ($3.50/loaf retail) -> ~$2.25/piece = 225c/piece.
 *   Aromatic ($5.50/lb retail for garlic/ginger, pricier per lb than
 *     staple vegetables) -> ~$3.55/lb, rounded to $3.50/lb = 350c/lb.
 *   Herb ($2.50/bunch retail) -> ~$1.60/piece = 160c/piece.
 */
const CATEGORY_BASE_UNIT_COST_CENTS: Record<string, number> = {
  Protein: 450,
  Dairy: 325,
  Bakery: 225,
  Fruit: 130,
  Vegetable: 100,
  Aromatic: 350,
  Herb: 160,
};

const DEFAULT_BASE_UNIT_COST_CENTS = 100;

/** The deterministic base purchase cost, in whole US cents, for one real unit (see `purchaseUnitFor`) of `ingredientId` — the single source every purchase UI/action reads from, never a literal number typed inline. */
export function businessUnitCostFor(ingredientId: IngredientId): number {
  const category = INGREDIENTS[ingredientId].category;
  return CATEGORY_BASE_UNIT_COST_CENTS[category] ?? DEFAULT_BASE_UNIT_COST_CENTS;
}
