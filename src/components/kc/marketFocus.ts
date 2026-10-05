import type { IngredientId } from "@/game/definitions";
import type { SupplyId, SupplySection } from "@/game/business/businessSupplies";
import type { ScreenId } from "./data";

/**
 * Business → Market deep link. `go` only takes a screen id, so the
 * ingredient to preselect is handed over here: the Market's Ingredients
 * tab reads it when it opens (peekMarketFocus, then clearMarketFocus) and scrolls to that
 * card. Navigation state only — never saved.
 */
let pending: IngredientId | null = null;
let pendingQuantity: number | null = null;

/** `quantity` (whole units) presets that card's quantity, e.g. exactly what a Pre-Service Check is missing. */
export function openMarketIngredients(
  go: (s: ScreenId) => void,
  ingredientId?: IngredientId,
  quantity?: number,
) {
  pending = ingredientId ?? null;
  pendingQuantity = ingredientId && quantity && quantity > 0 ? Math.ceil(quantity) : null;
  go("shop-ingredients");
}

/** The preset quantity for the focused ingredient, if one was asked for. */
export function peekMarketQuantity(): number | null {
  return pendingQuantity;
}

/** The ingredient to preselect (read during render — pure, so StrictMode's double render sees it too). */
export function peekMarketFocus(): IngredientId | null {
  return pending;
}

/** Called once the Market has opened, so a later plain visit starts unfocused. */
export function clearMarketFocus() {
  pending = null;
  pendingQuantity = null;
}

/**
 * Inventory → Supplies → Market deep link: which supply section the
 * Market opens on and, optionally, the supply line to preselect (its group
 * opens and the card scrolls into view, like ingredients). Navigation
 * state only, never saved.
 */
let pendingSupplySection: SupplySection = "culinary";
let pendingSupplyId: SupplyId | null = null;

export function openMarketSupplies(
  go: (s: ScreenId) => void,
  section: SupplySection,
  supplyId?: SupplyId,
) {
  pendingSupplySection = section;
  pendingSupplyId = supplyId ?? null;
  go("shop-supplies");
}

/** The supply line to preselect (read during render, like peekMarketFocus). */
export function peekSupplyFocus(): SupplyId | null {
  return pendingSupplyId;
}

export function clearSupplyFocus() {
  pendingSupplyId = null;
}

export function peekSupplySection(): SupplySection {
  return pendingSupplySection;
}
