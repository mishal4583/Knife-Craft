/**
 * INGREDIENT_COST_REGISTRY — Economy V2 Phase 2. The centralized
 * ingredient economic cost definition the design spec §7/§11 asks for
 * ("centralized... not scattered across recipe files"). Never modifies
 * campaignRecipes.ts/levelDefinitions.ts/definitions.ts — this reads
 * `INGREDIENTS`' existing `category` field (definitions.ts) as its only
 * input and adds nothing to that file.
 *
 * COST MODEL — why a category-tier weight, not 57 hand-picked prices:
 * the design spec (§11) explicitly warns "do not invent ingredient
 * prices solely because an ingredient exists" and (§36/§37/§68) demands
 * calibration against the real recipe corpus rather than arbitrary
 * numbers. So each ingredient gets a small, defensible RELATIVE cost
 * weight from its existing `category` (Protein costs more than Herb —
 * an uncontroversial real-world ordering), and ONE calibration constant
 * (`COGS_RATE_PER_WEIGHT_UNIT`) converts that relative weight into
 * actual currency, chosen so the corpus-wide average COGS/revenue ratio
 * lands inside the design spec's own 22-28% target band (§9/§66/§51).
 *
 * CALIBRATION (derived, not guessed) — computed once against all 221
 * production campaign recipes (scripts/_economy_calibration_scratch.mts,
 * run during this implementation, not committed — a throwaway
 * calculation script, not part of the shipped economy):
 *   Σ recipeBase(recipe) [floored at 45]   = 31,401
 *   Σ weightSum(recipe.components)         = 817.4
 *   RATE = 0.25 * 31401 / 817.4            ≈ 9.60
 * Resulting distribution of COGS/recipeBase across all 221 recipes
 * (chapter-invariant — see EconomySettlement.ts for why chapter cancels
 * out of this ratio): min 8.5%, p10 17.1%, p50 22.5%, mean 26.6%, p90
 * 43.0%, max 80.0% — mean sits at the design spec's own central target
 * (~25%), every recipe stays well under 100% (so netResult can never
 * legitimately go negative from COGS alone — see EconomySettlement.ts's
 * own clamp for the hard guarantee anyway), and there is real per-recipe
 * variation (a protein-heavy recipe costs meaningfully more than a
 * garnish), which is the actual design goal (§9: "ingredient efficiency
 * meaningful"), not a flat percentage everywhere.
 *
 * This constant is a Phase 2 calibration candidate, not an immutable
 * value (design spec §90) — a full Phase 13 session-level simulation
 * (which this implementation pass does not run — see the final report)
 * may adjust it.
 */
import type { IngredientId } from "../definitions";
import { INGREDIENTS } from "../definitions";

/** Relative cost weight by the ingredient's existing `category` field (definitions.ts) — never a new per-ingredient field, never scattered per-recipe. Ordering only, not literal currency: Protein > Dairy > Bakery > Fruit ≈ Vegetable > Aromatic > Herb, matching ordinary grocery cost intuition. */
const CATEGORY_WEIGHT: Record<string, number> = {
  Protein: 3.0,
  Dairy: 1.6,
  Bakery: 1.3,
  Fruit: 1.0,
  Vegetable: 0.9,
  Aromatic: 0.5,
  Herb: 0.4,
};

const DEFAULT_WEIGHT = 1.0;

/** Corpus-calibrated — see this file's own header doc for the exact derivation. */
export const COGS_RATE_PER_WEIGHT_UNIT = 9.6;

/** One ingredient's relative cost weight — the sole per-ingredient economic fact this registry exposes. Never a literal currency amount by itself; see `ingredientBaselineCost` for the actual currency conversion. */
export function ingredientCostWeight(ingredientId: IngredientId): number {
  const def = INGREDIENTS[ingredientId];
  return def ? (CATEGORY_WEIGHT[def.category] ?? DEFAULT_WEIGHT) : DEFAULT_WEIGHT;
}

/** One ingredient's chapter-independent baseline currency cost (mirrors recipeBase's own chapter-independence in recipePay.ts — chapter scaling is applied once, at the recipe level, in EconomySettlement.ts, never per-ingredient). */
export function ingredientBaselineCost(ingredientId: IngredientId): number {
  return ingredientCostWeight(ingredientId) * COGS_RATE_PER_WEIGHT_UNIT;
}
