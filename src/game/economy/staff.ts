/**
 * STAFF (settlement-facing) — Economy V2 Phase 7. The one function
 * EconomySettlement.computeSettlement calls to fold every OWNED staff
 * member's small, deterministic economic effect into a settlement —
 * mirrors equipmentSpecialization.ts's own role/shape exactly, but for
 * a LIST of simultaneously-owned ids rather than one equipped id (Staff
 * are not mutually exclusive — see StaffManager.ts's own doc).
 *
 * Three roles, three mechanisms, deliberately not overlapping:
 *   - Prep Assistant: universal COGS reduction (every recipe).
 *   - Quality Chef: universal quality-bonus-rate boost (every recipe).
 *   - Kitchen Assistant: COGS reduction, ONLY for recipes with >=1
 *     `batchable: true` component — the SAME existing metadata Phase 5's
 *     Cleaver knife already reuses (recipeTypes.ts's RecipeComponent;
 *     never OrganizationManager/organizationTypes/PreparationScene, and
 *     never a hardcoded recipe-id list).
 *
 * Applied strictly AFTER physical-instance accounting AND after Phase
 * 5's equipment modifier AND Phase 6's sharpness modifier (see
 * EconomySettlement.ts's own pipeline doc) — Staff never re-touches
 * component counting, never re-derives baselineCOGSFor.
 */
import type { RecipeDefinition } from "../recipes/recipeTypes";

export type StaffModifier = {
  /** 0..1 — combined, already-capped COGS reduction from every applicable owned staff member. */
  cogsReductionPct: number;
  /** Added directly to the existing quality-bonus rate — never a second grade system. */
  qualityBonusBoost: number;
};

const NEUTRAL: StaffModifier = { cogsReductionPct: 0, qualityBonusBoost: 0 };

const PREP_ASSISTANT_COGS_REDUCTION = 0.03;
const QUALITY_CHEF_BONUS_BOOST = 0.01;
const KITCHEN_ASSISTANT_COGS_REDUCTION = 0.04;

/** Hard ceiling on Staff's OWN combined COGS effect (Phase 7 brief §11 — "maximum combined Staff COGS reduction = 6%"), independent of and never combined with Phase 5's own equipment cap. Prep Assistant (3%) + Kitchen Assistant (4%) on a qualifying batch recipe would otherwise total 7% — this clamp is what actually bites in that one case. */
const MAX_STAFF_COGS_REDUCTION = 0.06;

function recipeHasBatchableComponent(recipe: RecipeDefinition): boolean {
  return recipe.components.some((c) => c.batchable);
}

/**
 * `ownedStaffIds` — optional, defaulting to an empty array (no staff, a
 * fully neutral modifier). Every pre-Phase-7 caller of computeSettlement
 * that doesn't pass this at all is therefore completely unaffected.
 */
export function getStaffModifier(
  ownedStaffIds: readonly string[] | undefined,
  recipe: RecipeDefinition,
): StaffModifier {
  const owned = new Set(ownedStaffIds ?? []);
  if (owned.size === 0) return NEUTRAL;

  let cogsReductionPct = 0;
  let qualityBonusBoost = 0;

  if (owned.has("prep-assistant")) cogsReductionPct += PREP_ASSISTANT_COGS_REDUCTION;
  if (owned.has("quality-chef")) qualityBonusBoost += QUALITY_CHEF_BONUS_BOOST;
  if (owned.has("kitchen-assistant") && recipeHasBatchableComponent(recipe)) {
    cogsReductionPct += KITCHEN_ASSISTANT_COGS_REDUCTION;
  }

  return {
    cogsReductionPct: Math.min(cogsReductionPct, MAX_STAFF_COGS_REDUCTION),
    qualityBonusBoost,
  };
}
