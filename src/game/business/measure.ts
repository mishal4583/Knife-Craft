/**
 * MEASURE — the player's unit for weighed ingredients, pounds or kilograms
 * (developer 2026-10-08: "in the settings let the user select kg or lb …
 * when kg is selected it should display the price for ingredients in 1 kg").
 *
 * Stock is always KEPT in the purchase unit (businessPricing.purchaseUnitFor:
 * lb for weighed goods, the piece for a loaf, a baguette or a herb bunch);
 * this module only converts at the edges:
 *  - the Market sells whole MARKET UNITS — a lb, a kg, or a piece — and
 *    `lbPerMarketUnit` says how much stock one is (2.20462 lb in a kg);
 *  - every quantity shown goes through `formatStockAmount` ("0.3 lb",
 *    "0.14 kg", "0.25 loaf") and `itemCountText` ("≈ 3 tomatoes").
 * Piece goods are sold by the piece whatever the setting.
 *
 * The preference is the optional `settings.measure` (absent = "lb", the
 * game's U.S. default). Pure.
 */
import type { IngredientId } from "../definitions";
import type { SaveData } from "../SaveManager";
import { purchaseUnitFor } from "./businessPricing";
import { normalizeQuantity } from "./businessInventory";
import { measureFor } from "./ingredientMeasures";

export type Measure = "lb" | "kg";

export const MEASURES: readonly Measure[] = ["lb", "kg"];

/** Pounds in one kilogram (exact to 5 decimals). */
export const LB_PER_KG = 2.20462;

export function measureOf(save: Pick<SaveData, "settings">): Measure {
  return save.settings.measure === "kg" ? "kg" : "lb";
}

/** True for an ingredient sold by weight (lb in stock), false for one sold by the piece. */
export function isWeighed(ingredientId: IngredientId): boolean {
  return purchaseUnitFor(ingredientId) === "lb";
}

/** Stock (lb, or pieces) in ONE Market unit of `ingredientId` in this measure. */
export function lbPerMarketUnit(ingredientId: IngredientId, measure: Measure): number {
  return measure === "kg" && isWeighed(ingredientId) ? LB_PER_KG : 1;
}

/** The stock `units` whole Market units add (3-decimal precision, like all stock). */
export function stockForMarketUnits(
  ingredientId: IngredientId,
  units: number,
  measure: Measure,
): number {
  return normalizeQuantity(units * lbPerMarketUnit(ingredientId, measure));
}

/** The fewest whole Market units that cover `stock` (0 for none). */
export function marketUnitsCovering(
  ingredientId: IngredientId,
  stock: number,
  measure: Measure,
): number {
  if (!(stock > 0)) return 0;
  return Math.ceil(stock / lbPerMarketUnit(ingredientId, measure) - 1e-9);
}

/** What a Market unit is called: "lb" / "kg", or the piece ("loaf", "bunch", "baguette"). */
export function marketUnitLabel(ingredientId: IngredientId, measure: Measure, units = 1): string {
  if (isWeighed(ingredientId)) return measure;
  const m = measureFor(ingredientId);
  return units === 1 ? m.noun : m.plural;
}

/** A number for the player: at most `decimals` places, trailing zeros trimmed. */
function trimmed(value: number, decimals: number): string {
  const s = value.toFixed(decimals);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

/** A stock quantity in the player's measure: "0.3 lb", "0.14 kg", "1 loaf", "0.25 bunch". */
export function formatStockAmount(
  ingredientId: IngredientId,
  stock: number,
  measure: Measure,
): string {
  const q = normalizeQuantity(stock);
  if (!isWeighed(ingredientId)) {
    const m = measureFor(ingredientId);
    return `${trimmed(q, 2)} ${q === 1 ? m.noun : m.plural}`;
  }
  const v = measure === "kg" ? q / LB_PER_KG : q;
  return `${trimmed(v, v >= 10 ? 1 : 2)} ${measure}`;
}

/**
 * Roughly how many whole items a stock quantity is, for a weighed
 * ingredient: "≈ 3 tomatoes", "≈ ½ pumpkin". Null for piece goods (their
 * amount already counts pieces) and for no stock.
 */
export function itemCountText(ingredientId: IngredientId, stock: number): string | null {
  if (!isWeighed(ingredientId) || !(stock > 0)) return null;
  const m = measureFor(ingredientId);
  const n = stock / m.pieceLb;
  if (n >= 0.95) {
    const whole = Math.max(1, Math.round(n));
    return `≈ ${whole} ${whole === 1 ? m.noun : m.plural}`;
  }
  const part = n < 0.375 ? "¼" : n < 0.625 ? "½" : "¾";
  return `${n < 0.125 ? "under " : "≈ "}${part} ${m.noun}`;
}

/** "1 lb ≈ 3 tomatoes" / "1 kg ≈ 7 tomatoes" — what one Market unit holds; null for piece goods. */
export function marketUnitCountText(ingredientId: IngredientId, measure: Measure): string | null {
  const count = itemCountText(ingredientId, lbPerMarketUnit(ingredientId, measure));
  return count ? `1 ${measure} ${count}` : null;
}

/** How many whole items a stock quantity is (weighed: ÷ one item's weight; piece goods: the pieces). */
export function itemCount(ingredientId: IngredientId, stock: number): number {
  if (!(stock > 0)) return 0;
  return isWeighed(ingredientId) ? stock / measureFor(ingredientId).pieceLb : stock;
}

/** A stock quantity as a number in the player's measure (kg for a weighed good in kg, else unchanged). */
export function inMeasure(ingredientId: IngredientId, stock: number, measure: Measure): number {
  return stock / lbPerMarketUnit(ingredientId, measure);
}

/** A price per purchase unit (per lb / per piece) as the price per Market unit in this measure, whole cents. */
export function pricePerMarketUnit(
  ingredientId: IngredientId,
  centsPerStockUnit: number,
  measure: Measure,
): number {
  const k = lbPerMarketUnit(ingredientId, measure);
  return k === 1 ? centsPerStockUnit : Math.round(centsPerStockUnit * k);
}

/**
 * The measure the screens show right now. App sets it from the save on
 * every render (restaurant build: the Settings choice; classic: lb), so
 * deep display helpers (the fridge's crate tags, Inventory's cards, the
 * Business screens) follow the setting without threading it through every
 * component. Display only — every purchase and quote reads `measureOf(save)`.
 */
let currentDisplayMeasure: Measure = "lb";

export function setDisplayMeasure(measure: Measure): void {
  currentDisplayMeasure = measure;
}

export function displayMeasure(): Measure {
  return currentDisplayMeasure;
}
