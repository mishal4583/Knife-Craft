/**
 * EQUIPMENT_SPECIALIZATION — Economy V2 Phase 5. Small, situational
 * economic modifiers for the EXISTING 8 knives / 8 boards (never a new
 * catalog, never a price/unlock change — see knifeDefinitions.ts/
 * boardDefinitions.ts, both untouched by this module).
 *
 * Design law (mirrors knifeTypes.ts's own "nothing here is allowed to
 * become an RPG stat" doc): every effect here is either a small COGS
 * reduction (Yield-Bonus-shaped — see EconomySettlement.ts's own
 * `yieldSavings` precedent) or a small addition to the existing quality-
 * bonus RATE (never a new grade system, never touching `qualityFor()`
 * or the Rustic/Honest/Masterful thresholds). Nothing here can reject a
 * technique, block a recipe, or change what's required to complete a
 * level — PreparationScene/organizationManager/RecipeValidator are
 * completely untouched; every knife/board can still cut everything.
 *
 * Reuses EXISTING metadata only: `INGREDIENTS[id].category` (the same
 * 7-category taxonomy ingredientCostRegistry.ts's CATEGORY_WEIGHT
 * already uses) and `RecipeComponent.batchable` (already used by real
 * batching, ServiceManager.ts). No second ingredient taxonomy, no new
 * per-ingredient field, no hardcoded recipe-id list — the two
 * ingredient-specific targets below (chicken/steak for Butcher Block,
 * salmon for Seafood Slate) use existing IngredientIds directly, since
 * there is no separate "seafood" category to reuse (salmon is the
 * corpus's only fish, already under "Protein").
 *
 * Applied strictly AFTER physical-instance accounting
 * (EconomySettlement.ingredientInstancesFor/baselineCOGSFor) — this
 * module only ever multiplies the ALREADY-computed finalCOGS by a small
 * factor and adds a small increment to qualityBonusRate; it never
 * touches component counting, so the 106 DISTINCT_INSTANCES / 115
 * SAME_INSTANCE_CHAIN / 0 ambiguous classification from
 * scripts/economy-v2-cogs-instance-audit.mts is completely unaffected.
 */
import { INGREDIENTS, type IngredientId } from "../definitions";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import type { KnifeId } from "../knives/knifeTypes";
import type { BoardId } from "../boards/boardTypes";

export type EquipmentModifier = {
  /** 0..1 — multiplies the already quality-adjusted finalCOGS down by this fraction. Always >= 0 (equipment never INCREASES cost). */
  cogsReductionPct: number;
  /** Added directly to QUALITY_BONUS_RATE_BY_GRADE's existing rate — never a second grade system, never touching qualityFor(). */
  qualityBonusBoost: number;
};

const NEUTRAL: EquipmentModifier = { cogsReductionPct: 0, qualityBonusBoost: 0 };

/** Hard ceilings — defensive, so no combination of knife+board (even ones matching the same recipe twice over) can ever "dominate the economy" (Phase 5 brief). Comfortably above any single configured value below, but far below anything that would meaningfully distort the locked 22-28% COGS band. */
const MAX_TOTAL_COGS_REDUCTION = 0.08;
const MAX_TOTAL_QUALITY_BOOST = 0.03;

function recipeHasCategory(recipe: RecipeDefinition, category: string): boolean {
  return recipe.components.some((c) => INGREDIENTS[c.ingredientId]?.category === category);
}

function recipeHasIngredient(recipe: RecipeDefinition, ids: readonly IngredientId[]): boolean {
  return recipe.components.some((c) => ids.includes(c.ingredientId));
}

function recipeHasBatchableComponent(recipe: RecipeDefinition): boolean {
  return recipe.components.some((c) => c.batchable);
}

/**
 * Knife specializations (Phase 5 brief). `chef` is the explicit neutral
 * baseline — every multiplier here stays small enough that chef+walnut
 * remains fully able to complete the entire campaign (Design Rule 1).
 */
const KNIFE_MODIFIER: Record<KnifeId, (recipe: RecipeDefinition) => EquipmentModifier> = {
  chef: () => NEUTRAL,
  santoku: (r) =>
    recipeHasCategory(r, "Vegetable") ? { cogsReductionPct: 0.04, qualityBonusBoost: 0 } : NEUTRAL,
  paring: (r) =>
    recipeHasCategory(r, "Fruit") ? { cogsReductionPct: 0.04, qualityBonusBoost: 0 } : NEUTRAL,
  nakiri: (r) =>
    recipeHasCategory(r, "Vegetable") ? { cogsReductionPct: 0, qualityBonusBoost: 0.01 } : NEUTRAL,
  bread: (r) =>
    recipeHasCategory(r, "Bakery") ? { cogsReductionPct: 0.04, qualityBonusBoost: 0 } : NEUTRAL,
  cleaver: (r) =>
    recipeHasBatchableComponent(r) ? { cogsReductionPct: 0.04, qualityBonusBoost: 0 } : NEUTRAL,
  damascus: () => ({ cogsReductionPct: 0, qualityBonusBoost: 0.01 }),
  obsidian: (r) =>
    recipeHasCategory(r, "Protein") ? { cogsReductionPct: 0.03, qualityBonusBoost: 0 } : NEUTRAL,
};

const LAND_PROTEIN_IDS = ["chicken", "steak"] as const;
const SEAFOOD_IDS = ["salmon"] as const;

/**
 * Board specializations (Phase 5 brief). `walnut` is the explicit
 * neutral baseline, mirroring `chef` above.
 */
const BOARD_MODIFIER: Record<BoardId, (recipe: RecipeDefinition) => EquipmentModifier> = {
  walnut: () => NEUTRAL,
  maple: () => ({ cogsReductionPct: 0, qualityBonusBoost: 0.005 }),
  herb: (r) =>
    recipeHasCategory(r, "Herb") ? { cogsReductionPct: 0.04, qualityBonusBoost: 0 } : NEUTRAL,
  marble: (r) =>
    recipeHasCategory(r, "Fruit") ? { cogsReductionPct: 0.04, qualityBonusBoost: 0 } : NEUTRAL,
  darkoak: (r) =>
    recipeHasCategory(r, "Aromatic") ? { cogsReductionPct: 0.04, qualityBonusBoost: 0 } : NEUTRAL,
  copper: (r) =>
    recipeHasCategory(r, "Vegetable") ? { cogsReductionPct: 0.04, qualityBonusBoost: 0 } : NEUTRAL,
  butcherblock: (r) =>
    recipeHasIngredient(r, LAND_PROTEIN_IDS)
      ? { cogsReductionPct: 0.03, qualityBonusBoost: 0 }
      : NEUTRAL,
  seafoodslate: (r) =>
    recipeHasIngredient(r, SEAFOOD_IDS)
      ? { cogsReductionPct: 0.03, qualityBonusBoost: 0 }
      : NEUTRAL,
};

/** Shop-facing one-line specialization descriptions (Phase 5 brief §UI — "the player should understand the specialization from the shop"). Never rendered as a numeric stat, matching knifeTypes.ts's own "nothing here is allowed to become an RPG stat" law. */
export const KNIFE_SPECIALIZATION_LABEL: Record<KnifeId, string> = {
  chef: "General-Purpose Baseline",
  santoku: "Vegetable Efficiency",
  paring: "Fruit Precision",
  nakiri: "Vegetable Precision",
  bread: "Bakery Yield",
  cleaver: "Batch Efficiency",
  damascus: "Quality Consistency",
  obsidian: "Protein Precision",
};

export const BOARD_SPECIALIZATION_LABEL: Record<BoardId, string> = {
  walnut: "General-Purpose Baseline",
  maple: "Preparation Consistency",
  herb: "Herb Yield",
  marble: "Fruit Precision",
  darkoak: "Aromatic Stability",
  copper: "Vegetable Efficiency",
  butcherblock: "Meat Yield",
  seafoodslate: "Seafood Yield",
};

function isKnifeId(id: string | undefined): id is KnifeId {
  return !!id && id in KNIFE_MODIFIER;
}
function isBoardId(id: string | undefined): id is BoardId {
  return !!id && id in BOARD_MODIFIER;
}

/**
 * The one entry point EconomySettlement.computeSettlement calls —
 * combines the equipped knife's and board's own modifiers for THIS
 * recipe, clamped to the hard ceilings above. An unrecognized/undefined
 * id (including "chef"/"walnut" themselves) always resolves to NEUTRAL,
 * so every existing caller that doesn't pass equipment at all continues
 * to get exactly zero modifier — no behavior change, no drift.
 */
export function getEquipmentModifier(
  knifeId: string | undefined,
  boardId: string | undefined,
  recipe: RecipeDefinition,
): EquipmentModifier {
  const knife = isKnifeId(knifeId) ? KNIFE_MODIFIER[knifeId](recipe) : NEUTRAL;
  const board = isBoardId(boardId) ? BOARD_MODIFIER[boardId](recipe) : NEUTRAL;
  return {
    cogsReductionPct: Math.min(
      knife.cogsReductionPct + board.cogsReductionPct,
      MAX_TOTAL_COGS_REDUCTION,
    ),
    qualityBonusBoost: Math.min(
      knife.qualityBonusBoost + board.qualityBonusBoost,
      MAX_TOTAL_QUALITY_BOOST,
    ),
  };
}
