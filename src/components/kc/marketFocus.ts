import type { IngredientId } from "@/game/definitions";
import type { ScreenId } from "./data";

/**
 * Business → Market deep link. `go` only takes a screen id, so the
 * ingredient to preselect is handed over here: the Market's Ingredients
 * tab reads it when it opens (peekMarketFocus, then clearMarketFocus) and scrolls to that
 * card. Navigation state only — never saved.
 */
let pending: IngredientId | null = null;

export function openMarketIngredients(go: (s: ScreenId) => void, ingredientId?: IngredientId) {
  pending = ingredientId ?? null;
  go("shop-ingredients");
}

/** The ingredient to preselect (read during render — pure, so StrictMode's double render sees it too). */
export function peekMarketFocus(): IngredientId | null {
  return pending;
}

/** Called once the Market has opened, so a later plain visit starts unfocused. */
export function clearMarketFocus() {
  pending = null;
}
