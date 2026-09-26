/**
 * ECONOMY_SETTLEMENT — Economy V2 Phase 2-4 (COGS, Yield Bonus, Quality
 * Bonus). `computeSettlement()` is the one function that turns a
 * recipe + chapter + preparation score into the full, transparent
 * breakdown the design spec's settlement pipeline (§31) describes —
 * built as a pure function around the EXISTING recipePay/qualityFor
 * primitives, never replacing them.
 *
 * Wired into the real per-order payout boundaries (App.tsx's
 * recordPreparationResult/serveCampaignOrder/serveBatchGroupViewedOrder
 * — see the payout-wiring phase's final report). serveActiveServiceOrder
 * (standalone Restaurant Service) is the one deliberate exception, left
 * on its original raw basePayment for now (no real campaign chapter
 * input, same repeatable/non-campaign category as Endless).
 *
 * Never touches organizationManager.ts/organizationTypes.ts/
 * PreparationScene.ts/campaignRecipes.ts/levelDefinitions.ts — the only
 * inputs are a RecipeDefinition (already-existing shape) and a chapter
 * number/score (already computed elsewhere, e.g. App.tsx's
 * recordPreparationResult already receives `score`).
 */
import type { RecipeDefinition } from "../recipes/recipeTypes";
import type { IngredientId } from "../definitions";
import { recipeBase, recipePay, chapterMultiplier } from "../recipes/recipePay";
import { qualityFor } from "../CutEvaluator";
import type { QualityLabel } from "@/types/game";
import { ingredientBaselineCost } from "./ingredientCostRegistry";
import { roundCurrency, clampNonNegative } from "./currency";
import type { SettlementResult, EconomyTransaction, EconomyTransactionType } from "./economyTypes";
import { getEquipmentModifier } from "./equipmentSpecialization";
import { getSharpnessModifier, DEFAULT_SHARPNESS } from "./sharpness";
import { getStaffModifier } from "./staff";
import { getSupplierModifier } from "./supplier";
import { dollars } from "../money";

/**
 * Grade-driven waste multiplier (design spec §9/§13: "Rustic = highest
 * waste ... Masterful = lowest waste"), applied on top of
 * baselineCOGS*chapterMultiplier. 1.0 = "Honest" is the NEUTRAL
 * baseline the registry's own calibration already assumes (the 22-28%
 * corpus-wide target in ingredientCostRegistry.ts was computed WITHOUT
 * any waste adjustment, i.e. as if every recipe settled at exactly this
 * baseline) — Masterful/Clean pull COGS below that baseline, Rustic/
 * Learning push it above, but the CENTER of the whole system stays
 * anchored to the calibrated corpus average. `qualityFor`'s 5 real
 * grades (CutEvaluator.ts) are all covered; "Learning" (score < 50) is
 * one notch worse than "Rustic", never a missing case.
 */
const WASTE_FACTOR_BY_GRADE: Record<QualityLabel, number> = {
  Masterful: 0.85,
  Clean: 0.92,
  Honest: 1.0,
  Rustic: 1.1,
  Learning: 1.2,
};

/**
 * Grade-driven revenue bonus rate (design spec §10/§14 calibration
 * candidates) — applied to `revenue` (recipePay), never to COGS, and
 * always additive on top of the untouched base formula, never a
 * replacement for it (design spec §3/§6/§49).
 */
const QUALITY_BONUS_RATE_BY_GRADE: Record<QualityLabel, number> = {
  Masterful: 0.1,
  Clean: 0.06,
  Honest: 0.02,
  Rustic: 0,
  Learning: 0,
};

let transactionSeq = 0;
function nextTransactionId(): string {
  transactionSeq += 1;
  return `econtx-${transactionSeq}`;
}

function makeTransaction(
  type: EconomyTransactionType,
  amount: number,
  source: string,
  context?: string,
): EconomyTransaction {
  return {
    id: nextTransactionId(),
    timestamp: Date.now(),
    type,
    amount,
    source,
    ...(context ? { context } : {}),
  };
}

/**
 * One entry per PHYSICAL INGREDIENT INSTANCE in a recipe — the single
 * authoritative grouping every COGS-related calculation (baselineCOGSFor
 * below, and any future economy diagnostic) must use, so the concept is
 * defined exactly once rather than risk drifting between callers.
 *
 * The instance boundary is never "new ingredientId" alone — it is the
 * EXACT SAME rule the real cutting engine already uses to decide
 * whether a step continues an existing physical instance or starts a
 * fresh one (`src/game/scenes/PreparationScene.ts`'s `beginStep()`):
 *   isChain = prevComponent.ingredientId === component.ingredientId && !component.chainBreak
 * A component starts a NEW instance unless it immediately follows a
 * component with the SAME ingredientId AND doesn't set `chainBreak:
 * true` (RecipeComponent's own doc, recipeTypes.ts — chainBreak is
 * authored explicitly whenever a recipe genuinely means "a second,
 * independent unit of this ingredient", e.g. every `*-branch`/`*-grand`
 * recipe that serves two chicken portions prepared two different ways).
 * Proven against all 221 campaign recipes by
 * scripts/economy-v2-cogs-instance-audit.mts — zero ambiguous cases,
 * and every chainBreak-marked (genuinely multi-instance) recipe is
 * provably unaffected by this rule.
 *
 * Deliberately NEVER a `new Set(components.map(c => c.ingredientId))`
 * dedup — that would incorrectly collapse two truly independent same-
 * ingredient portions (e.g. two separately-authored chicken portions
 * without an intervening different ingredient) down to one. Adjacency +
 * `chainBreak` decide it, never ingredientId alone.
 */
export function ingredientInstancesFor(
  recipe: RecipeDefinition,
): { ingredientId: IngredientId; componentIndices: number[] }[] {
  const instances: { ingredientId: IngredientId; componentIndices: number[] }[] = [];
  for (let i = 0; i < recipe.components.length; i++) {
    const component = recipe.components[i]!;
    const prev = i > 0 ? recipe.components[i - 1]! : null;
    const isSameInstance =
      prev !== null && prev.ingredientId === component.ingredientId && !component.chainBreak;
    if (isSameInstance) {
      instances[instances.length - 1]!.componentIndices.push(i);
    } else {
      instances.push({ ingredientId: component.ingredientId, componentIndices: [i] });
    }
  }
  return instances;
}

/**
 * `recipe.components`, not the runtime PreparedOutput/OrganizationSession
 * (design spec §7/§8/§10/§27 — that runtime state is never saved and
 * organizationManager.ts must stay untouched). Charges COGS once per
 * PHYSICAL INGREDIENT INSTANCE (see `ingredientInstancesFor` above), not
 * once per component — a piece of julienned-into-10-strips carrot is
 * still the same ONE carrot a single slice would be (one component, one
 * instance, unaffected by piece count), AND a chicken breast that's
 * halved then sliced is likewise still the same ONE chicken (two
 * components, but the SAME instance).
 *
 * Technique effort already has its own economic role (driving `revenue`
 * via recipePay's own TECHNIQUE_EFFORT table) — conflating it into COGS
 * too would double-count the same signal on both sides of the ledger.
 */
export function baselineCOGSFor(recipe: RecipeDefinition): number {
  return ingredientInstancesFor(recipe).reduce(
    (sum, instance) => sum + ingredientBaselineCost(instance.ingredientId),
    0,
  );
}

/**
 * The one settlement function every future payout call site should
 * call once wired in (design spec §31's 12-step pipeline, steps 1-8;
 * steps 9-12 — persisting credits/ledger/stats/UI — stay the caller's
 * job, exactly like `recipePay` itself never touches SaveData).
 *
 * Accounting identity (design spec §35 — Yield Bonus is a COGS
 * reduction, never a second revenue line):
 *   netResult = max(0, revenue - finalCOGS + qualityBonus)
 * `yieldSavings` is informational only, already reflected inside
 * `finalCOGS` — a caller must never add it again.
 *
 * `equippedKnifeId`/`equippedBoardId` (Economy V2 Phase 5) — optional,
 * defaulting to undefined, which `getEquipmentModifier` (
 * equipmentSpecialization.ts) always resolves to a zero modifier. Every
 * pre-Phase-5 caller (every existing QA script, and any future caller
 * that doesn't pass these) is therefore completely unaffected — same
 * finalCOGS, same qualityBonus, same netResult as before this phase.
 * Applied strictly AFTER physical-instance accounting (baselineCOGSFor
 * above) and AFTER the quality-grade waste factor — equipment only ever
 * scales the already-computed numbers, never re-touches component
 * counting.
 *
 * `knifeSharpness` (Economy V2 Phase 6) — optional, defaulting to
 * undefined, which `getSharpnessModifier` (sharpness.ts) treats as full
 * (100) sharpness, i.e. a zero penalty. Applied as its own, separate
 * multiplicative step AFTER the equipment modifier — the two move in
 * opposite directions (equipment only ever reduces cost, sharpness only
 * ever adds a small penalty below 100) and are never allowed to combine
 * into an unbounded stack; each keeps its own independent cap.
 *
 * `ownedStaffIds` (Economy V2 Phase 7) — optional, defaulting to
 * undefined, which `getStaffModifier` (staff.ts) treats as "no staff",
 * i.e. a zero modifier. Applied as the LAST multiplicative COGS step,
 * after equipment and sharpness — Staff's own combined effect carries
 * its own independent 6% cap (staff.ts's MAX_STAFF_COGS_REDUCTION),
 * never combined with Phase 5's equipment cap.
 *
 * `selectedSupplierId` (Economy V2 Phase 8) — optional, defaulting to
 * undefined, which `getSupplierModifier` (supplier.ts) resolves to
 * Local Market's own 0 modifier. Applied FIRST, directly to the
 * chapter-scaled physical-instance baseline — BEFORE the quality waste
 * factor and every downstream modifier — since a supplier changes what
 * the ingredients themselves cost to source, never how well they're
 * used (that's quality/equipment/sharpness/staff's job). Every
 * pre-Phase-8 caller that doesn't pass this is therefore completely
 * unaffected.
 */
/*
 * USD: every step below works in whole dollars, exactly as the Economy V2
 * design always has (recipePay, the ingredient cost registry and
 * roundCurrency all speak whole dollars). The money fields of the returned
 * SettlementResult — and its transactions — are converted ONCE, at the
 * end, to the wallet's integer-cent unit (money.ts), so a $61 payout
 * reaches the wallet as 6100 and the whole Campaign is exactly its old
 * figures read as dollars.
 */
export function computeSettlement(
  recipe: RecipeDefinition,
  chapter: number,
  score: number,
  equippedKnifeId?: string,
  equippedBoardId?: string,
  knifeSharpness?: number,
  ownedStaffIds?: readonly string[],
  selectedSupplierId?: string,
): SettlementResult {
  const grade = qualityFor(score);
  const revenue = recipePay(recipe, chapter);

  const baselineCOGS = baselineCOGSFor(recipe);
  const chapterScaledBaseline = baselineCOGS * chapterMultiplier(chapter);

  const supplierModifier = getSupplierModifier(selectedSupplierId);
  const supplierAdjustedBaseline = chapterScaledBaseline * (1 + supplierModifier);
  // Signed, mirroring yieldSavings' own convention: positive = the
  // supplier LOWERED cost (Wholesale), negative = the supplier RAISED
  // cost (Premium), 0 for Local Market or when unspecified.
  const supplierCOGSAdjustment = roundCurrency(chapterScaledBaseline - supplierAdjustedBaseline);

  const wasteFactor = WASTE_FACTOR_BY_GRADE[grade];
  const qualityAdjustedCOGS = roundCurrency(supplierAdjustedBaseline * wasteFactor);
  // Positive = this grade wasted LESS than the Honest(1.0) baseline (a
  // real saving); negative = it wasted MORE (Rustic/Learning) — signed
  // on purpose so a future UI can show either "Yield Savings +6" or a
  // small negative line without a separate "waste penalty" concept.
  // Computed against the SUPPLIER-adjusted baseline (the actual cost
  // basis quality is applied to), before any equipment/sharpness/staff
  // modifier — its own meaning stays "what did this grade change versus
  // the neutral-quality assumption at the cost you're actually paying",
  // unaffected by which supplier was chosen.
  const yieldSavings = roundCurrency(supplierAdjustedBaseline - qualityAdjustedCOGS);

  const equipment = getEquipmentModifier(equippedKnifeId, equippedBoardId, recipe);
  const equipmentAdjustedCOGS = roundCurrency(
    qualityAdjustedCOGS * (1 - equipment.cogsReductionPct),
  );
  const equipmentCOGSSavings = qualityAdjustedCOGS - equipmentAdjustedCOGS;

  const sharpnessModifier = getSharpnessModifier(knifeSharpness ?? DEFAULT_SHARPNESS);
  const sharpnessAdjustedCOGS = roundCurrency(equipmentAdjustedCOGS * (1 + sharpnessModifier));
  const sharpnessCOGSPenalty = sharpnessAdjustedCOGS - equipmentAdjustedCOGS;

  const staff = getStaffModifier(ownedStaffIds, recipe);
  const finalCOGS = roundCurrency(sharpnessAdjustedCOGS * (1 - staff.cogsReductionPct));
  const staffCOGSSavings = sharpnessAdjustedCOGS - finalCOGS;

  const qualityBonusRate =
    QUALITY_BONUS_RATE_BY_GRADE[grade] + equipment.qualityBonusBoost + staff.qualityBonusBoost;
  const qualityBonus = roundCurrency(revenue * qualityBonusRate);

  const netResult = clampNonNegative(revenue - finalCOGS + qualityBonus);

  const transactions: EconomyTransaction[] = [
    makeTransaction("RECIPE_REVENUE", dollars(revenue), recipe.id),
    makeTransaction("INGREDIENT_COGS", -dollars(finalCOGS), recipe.id),
  ];
  if (qualityBonus > 0)
    transactions.push(makeTransaction("QUALITY_BONUS", dollars(qualityBonus), recipe.id, grade));

  return {
    recipeId: recipe.id,
    chapter,
    score,
    grade,
    revenue: dollars(revenue),
    baselineCOGS: dollars(baselineCOGS),
    wasteFactor,
    finalCOGS: dollars(finalCOGS),
    yieldSavings: dollars(yieldSavings),
    supplierCOGSAdjustment: dollars(supplierCOGSAdjustment),
    equipmentCOGSSavings: dollars(equipmentCOGSSavings),
    sharpnessCOGSPenalty: dollars(sharpnessCOGSPenalty),
    staffCOGSSavings: dollars(staffCOGSSavings),
    qualityBonusRate,
    qualityBonus: dollars(qualityBonus),
    netResult: dollars(netResult),
    transactions,
  };
}

// Re-exported so a caller never needs a second import just to show the
// recipe's own unmodified base revenue alongside the settlement.
export { recipeBase };
