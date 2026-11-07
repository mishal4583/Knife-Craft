/**
 * KITCHEN DIRT — the pots, pans and utensils a cooked order dirties (developer
 * 2026-11-07: "make sure all the pots, pans, forks, plates, glass and all other
 * items are used and washed according to the orders").
 *
 * Tableware was already counted per guest (`coverPiecesFor`); the kitchen's own
 * smallware (the stock pot, pans, sheet pans, ladles, tongs, whisks…) stayed
 * clean for ever. Now every cooked order uses what its dish needs — read from
 * the SAME rules the Pre-Service Check buys tools by (`TOOL_RULES`, so the two
 * can never disagree) — and a piece is dirty after `usesPerWash` orders. You own
 * a few of each, so the sink never holds more than you own.
 *
 * The table's salt & pepper and water jugs get used by the guests at the table
 * (a pair of shakers per guest, a jug per table), washed with the rest.
 *
 * Pure; nothing reads RESTAURANT_MODE; no Math.random.
 */
import type { RecipeDefinition } from "../recipes/recipeTypes";
import type { SupplyId } from "../business/businessSupplies";
import { dishServiceFor } from "./dishService";
import { TOOL_RULES } from "./kitchenTools";

/**
 * Orders one piece of this smallware serves before it needs washing. Not listed
 * (peelers, mitts, thermometers, scales, storage containers) = not washed in
 * the sink game.
 */
export const KITCHEN_USES_PER_WASH: Readonly<Partial<Record<SupplyId, number>>> = {
  "stock-pot": 4,
  saucepans: 3,
  "frying-pans": 3,
  "saute-pans": 3,
  "sheet-pans": 4,
  "mixing-bowls": 2,
  ladles: 4,
  tongs: 3,
  spatulas: 3,
  skimmers: 4,
  whisks: 3,
  graters: 4,
  "measuring-cups": 4,
};

/** The washable smallware `recipe` is cooked with at `levelNumber` (the tool rules' own reading). */
export function kitchenPiecesFor(
  recipe: RecipeDefinition | null | undefined,
  levelNumber: number,
): SupplyId[] {
  if (!recipe) return [];
  const d = dishServiceFor(recipe);
  return TOOL_RULES.filter(
    (rule) =>
      levelNumber >= rule.fromLevel &&
      rule.when !== "always" &&
      KITCHEN_USES_PER_WASH[rule.id] !== undefined &&
      rule.when(d, recipe),
  ).map((rule) => rule.id);
}

/** Pieces of `id` dirty after `uses` uses, never more than `owned` (a few of each). */
export function dirtyAfterUses(uses: number, perWash: number, owned: number): number {
  if (uses <= 0 || perWash <= 0 || owned <= 0) return 0;
  return Math.min(owned, Math.ceil(uses / perWash));
}
