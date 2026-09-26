/**
 * BUSINESS_MENU_MANAGER — Economy V3 Phase 5. The one action that sets a
 * Business Mode menu price, mirroring purchaseIngredient/
 * purchaseRefrigerator's own shape: a pure function taking a `SaveData`
 * snapshot and returning either a new save or a typed failure reason.
 *
 * Never a wallet/ledger event — setting a price moves no credits, so
 * this never calls `appendLedgerEntry` and App.tsx's own wrapper doesn't
 * either (brief: "Every wallet mutation enters EconomyLedger" — this
 * isn't one, exactly like ending the business day isn't).
 */
import type { SaveData } from "../SaveManager";
import { CAMPAIGN_RECIPES } from "../recipes/campaignRecipes";

export type SetMenuPriceResult =
  | { ok: true; save: SaveData; recipeId: string; price: number }
  | { ok: false; reason: "unknownRecipe" | "invalidPrice" };

/**
 * Atomic and validated (brief: "Integer-safe", "Non-negative"): an
 * unknown recipe id or a non-integer/negative price changes nothing at
 * all. A valid price of 0 IS allowed (a free promotional item is a
 * legitimate business choice, not an error) — only a negative or
 * non-integer value is rejected.
 */
export function setMenuPrice(save: SaveData, recipeId: string, price: number): SetMenuPriceResult {
  const recipe = CAMPAIGN_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, reason: "unknownRecipe" };
  if (!Number.isInteger(price) || price < 0) return { ok: false, reason: "invalidPrice" };
  return {
    ok: true,
    save: {
      ...save,
      business: { ...save.business, menu: { ...save.business.menu, [recipeId]: price } },
    },
    recipeId,
    price,
  };
}
