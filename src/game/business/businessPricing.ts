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
 * an abstract unlabeled count. The unit is per CATEGORY; the price is per
 * INGREDIENT (see INGREDIENT_UNIT_COST_CENTS below).
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
 * Whole US cents per real unit (per lb, or per piece) — per INGREDIENT.
 *
 * Every price uses the same method as before (this file's header): an
 * approximate 2026 U.S. retail price for that ingredient, times the ~65%
 * restaurant/wholesale ratio, rounded to 10 cents. The first version used
 * one price per category (all vegetables $1.00/lb, all protein $4.50/lb), so
 * potatoes cost the same as asparagus and chicken the same as ribeye. The
 * category averages stay close to the old flat values, and menu prices
 * follow ingredient cost (businessMenu.ts: price = cost / 30% food cost),
 * so every dish keeps its margin percentage.
 *
 *   ingredient      retail ≈      → wholesale (cents)
 */
const INGREDIENT_UNIT_COST_CENTS: Record<IngredientId, number> = {
  // Vegetables (per lb)
  tomato: 100, // $1.55 retail (BLS field-grown tomato average)
  carrot: 80, // $1.20
  cucumber: 90, // $1.40
  onion: 70, // $1.10
  potato: 60, // $0.95
  mushroom: 260, // $4.00
  pepper: 160, // $2.45 (bell pepper)
  zucchini: 100, // $1.55
  eggplant: 110, // $1.70
  broccoli: 140, // $2.15
  corn: 70, // $1.10
  celery: 90, // $1.40
  lettuce: 110, // $1.70
  cabbage: 50, // $0.80
  cauliflower: 130, // $2.00
  spinach: 240, // $3.70
  asparagus: 260, // $4.00
  radish: 120, // $1.85
  beetroot: 90, // $1.40
  sweetpotato: 80, // $1.25
  greenbean: 140, // $2.15
  fennel: 160, // $2.45
  artichoke: 220, // $3.40
  peapod: 230, // $3.55
  pumpkin: 60, // $0.95
  turnip: 80, // $1.25
  chilli: 150, // $2.30
  springonion: 160, // $2.45
  // Fruit (per lb)
  strawberry: 200, // $3.10
  apple: 110, // $1.70
  orange: 90, // $1.40
  lemon: 120, // $1.85
  avocado: 160, // $2.45
  pear: 110, // $1.70
  peach: 120, // $1.85
  pineapple: 50, // $0.80
  watermelon: 40, // $0.60
  mango: 100, // $1.55
  kiwi: 160, // $2.45
  pomegranate: 160, // $2.45
  grapes: 170, // $2.60
  coconut: 100, // $1.55
  lime: 120, // $1.85
  // Herbs (per bunch)
  basil: 180, // $2.75
  parsley: 90, // $1.40
  cilantro: 80, // $1.25
  // Aromatics (per lb)
  garlic: 320, // $4.90
  ginger: 260, // $4.00
  // Bakery (per piece)
  bread: 220, // $3.40 loaf
  baguette: 190, // $2.90
  // Dairy & tofu (per lb)
  cheddar: 360, // $5.55
  mozzarella: 340, // $5.25
  butter: 300, // $4.60
  tofu: 160, // $2.45
  // Protein (per lb)
  chicken: 320, // $4.90 boneless breast
  steak: 950, // $14.60 ribeye
  salmon: 650, // $10.00 fillet
};

/** The deterministic base purchase cost, in whole US cents, for one real unit (see `purchaseUnitFor`) of `ingredientId` — the single source every purchase UI/action reads from, never a literal number typed inline. */
export function businessUnitCostFor(ingredientId: IngredientId): number {
  return INGREDIENT_UNIT_COST_CENTS[ingredientId];
}
