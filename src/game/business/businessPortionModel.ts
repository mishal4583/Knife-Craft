/**
 * BUSINESS_PORTION_MODEL — Economy V3 Phase 14, Checkpoint 4. Fixes a
 * real unit-mismatch the Checkpoint 4 pricing audit exposed:
 * `businessMenu.ts`'s `recipeCostBasis` charged ONE FULL PURCHASE UNIT
 * (a whole pound, at real 2026 wholesale produce rates — see
 * businessPricing.ts / master spec §24) per recipe COMPONENT INSTANCE
 * — i.e., per individual knife-technique step. That is the right model
 * for an ingredient a real recipe genuinely uses close to a full
 * purchase unit per serving (a salmon fillet, a loaf of bread — see
 * "why unscaled" below), but it is NOT realistic for an ingredient a
 * real recipe uses in a small fraction of that unit per step — most
 * severely Aromatics (garlic/ginger), where a "peel" + "smash"/"mince"
 * pair of technique steps represents a few cloves or a knob of ginger
 * (a few grams), never two separate pounds. Left uncorrected, a dish
 * using an Aromatic across two components (very common in
 * businessDishCatalog.ts) was charged a full $7.00 of aromatic alone,
 * pushing ordinary dishes like Pumpkin Coconut Curry to $38.67 and
 * Thai Basil Chicken to $53.67 — nowhere near their real $12-22
 * restaurant-menu range, even though the recipe/ingredient DATA itself
 * was never wrong (Checkpoint 4's own audit; see its report).
 *
 * THE FIX — a Business-Mode-only "recipe portion fraction" per
 * ingredient category: how much of ONE real purchase unit (lb — see
 * businessPricing.ts's `purchaseUnitFor`) a single recipe-component
 * instance realistically represents in ONE served portion, applied
 * ONLY to `recipeCostBasis` (menu/food-cost pricing). This never
 * touches `CAMPAIGN_RECIPES`, `baselineCOGSFor`, or any Campaign
 * COGS/pay path — `recipeCostBasis` was already a Business-Mode-only
 * function (confirmed: never imported by any Campaign file), so this
 * is a Business-layer-only correction, exactly as the checkpoint's own
 * "create it explicitly in the Business Dish layer without modifying
 * Campaign recipes" instruction asks for.
 *
 * INVENTORY DRAW-DOWN (Economy V3 Phase 16 final audit, P1 fix) — at
 * Checkpoint 4 real inventory consumption still deducted ONE WHOLE
 * purchase unit per component, a documented scope boundary. The V3-16
 * audit measured its consequence: 17 of 35 dishes had real COGS above
 * their menu food cost (up to 7x), and 4 lost money on every serve at
 * their suggested price — contradicting master spec §16 (menu price
 * derived from actual ingredient cost AND portion size; COGS =
 * inventory consumed). `businessDishRequirements` now draws down this
 * SAME fraction, so pricing, food cost, COGS and the stockroom agree.
 * Purchases stay whole units (BusinessInventoryManager's own integer
 * gate); stock may hold a 3-decimal fraction once portions are served
 * (businessInventory.ts `normalizeQuantity`).
 *
 * METHODOLOGY (per-category, each documented — these are RECIPE-
 * PORTION/yield facts, not fetched market prices, so they cite
 * standard, widely-published culinary measurement conventions rather
 * than BLS/FRED, exactly the way an ingredient's cooking yield/waste
 * percentage would be sourced in any real recipe-costing worksheet):
 *
 * - Aromatic (garlic, ginger) -> 0.025 lb/instance. A single recipe
 *   step ("peel"/"smash"/"mince"/"chop" on garlic or ginger)
 *   realistically represents 2-3 cloves of garlic (~3-5g each — USDA
 *   FoodData Central average clove weight is ~3g) or an equivalent
 *   small knob of ginger (~10-15g): roughly 10-15g (0.022-0.033 lb),
 *   midpoint 0.025 lb (~11g). Why it applies: every Aromatic use in
 *   the 35-dish catalog is a garnish/base-flavoring quantity — no dish
 *   in the catalog is "an entree of garlic," so pricing it as a bulk
 *   lb-quantity ingredient the way protein or produce genuinely is
 *   used was the actual defect, not the dish's real-world premium-ness.
 * - Every other category (Protein, Dairy, Bakery, Fruit, Vegetable,
 *   Herb) -> 1.0 (unscaled). Individually audited against real
 *   restaurant portion/menu-price ranges in Checkpoint 4's own dish-
 *   by-dish audit (see its report) and found to already land in a
 *   realistic range once Aromatic alone is corrected. Protein in
 *   particular is deliberately NOT scaled down despite averaging a
 *   full pound per component: a real single-component protein dish
 *   (e.g. Salmon Sashimi) needs its "1 unit" to represent a genuine
 *   restaurant portion (a full pound of salmon plates 2-3 realistic
 *   6-8oz servings, i.e. mildly generous but not absurd) for its price
 *   to land anywhere near a real menu ($14-22); scaling it down to a
 *   single 5-6oz portion would instead price it at ~$6-7, well below
 *   any real sashimi plate.
 */
import type { IngredientId } from "../definitions";
import { INGREDIENTS } from "../definitions";

const RECIPE_PORTION_FRACTION: Record<string, number> = {
  Aromatic: 0.025,
};

const DEFAULT_RECIPE_PORTION_FRACTION = 1;

/** How much of ONE real purchase unit (see businessPricing.ts's purchaseUnitFor) a single recipe-component instance of this ingredient realistically represents in one served portion — see this file's own header for the full per-category methodology. */
export function recipePortionFractionFor(ingredientId: IngredientId): number {
  const category = INGREDIENTS[ingredientId].category;
  return RECIPE_PORTION_FRACTION[category] ?? DEFAULT_RECIPE_PORTION_FRACTION;
}
