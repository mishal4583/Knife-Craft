/**
 * BUSINESS_MENU_ACTIVATION — Economy V3 Phase 16 (final audit, P0 fix).
 * Master spec §16: Business orders are generated from the ACTIVE MENU
 * ("menu activation" is in the V3-14 QA list). Before this, every order
 * was drawn from all 35 catalog dishes, so no restaurant could choose
 * what it sells; the V3-16 §21 simulation showed every UI-realistic
 * strategy going broke in ~30-60 days as a direct result (stock spread
 * over ~35 ingredients in a 40-unit refrigerator).
 *
 * ONE source of truth for on/off: the set of dishes the player has taken
 * OFF the menu. Stored as `business.menuActivation.inactiveDishIds`
 * (BusinessDish ids) — deliberately NOT inside `business.menu`, whose
 * keys are the player-set PRICES and are counted by PopularityManager's
 * `pricingDelta`/`menuVarietyDelta`; putting flags there would silently
 * change popularity. An empty list means every dish is on, so a save
 * written before this field existed migrates to "all on" through the
 * existing SaveManager shallow merge with no special-casing.
 *
 * Never a wallet/ledger event — toggling a dish moves no credits.
 */
import type { SaveData } from "../SaveManager";
import { BUSINESS_DISH_CATALOG, getBusinessDish, type BusinessDish } from "./businessDishCatalog";

export type BusinessMenuActivationState = {
  /** BusinessDish ids currently OFF the menu. Never contains every dish (see `setDishActive`). */
  inactiveDishIds: string[];
};

export const DEFAULT_MENU_ACTIVATION_STATE: BusinessMenuActivationState = {
  inactiveDishIds: [],
};

export function isDishActive(state: BusinessMenuActivationState, dishId: string): boolean {
  return !state.inactiveDishIds.includes(dishId);
}

/**
 * The on-menu dishes, in catalog order. Defensive: if a corrupted save
 * somehow lists every dish as inactive, the full catalog is returned
 * rather than an empty menu (an empty order pool would soft-lock
 * Service) — the same "never crash on bad saves" rule the rest of
 * BusinessState follows.
 */
export function activeBusinessDishes(state: BusinessMenuActivationState): BusinessDish[] {
  const active = BUSINESS_DISH_CATALOG.filter((d) => isDishActive(state, d.id));
  return active.length > 0 ? active : BUSINESS_DISH_CATALOG;
}

export type SetDishActiveResult =
  | { ok: true; save: SaveData; dishId: string; active: boolean }
  | { ok: false; reason: "unknownDish" | "lastActiveDish" };

/** The one menu on/off action. Refuses to take the final active dish off the menu. Idempotent. */
export function setDishActive(
  save: SaveData,
  dishId: string,
  active: boolean,
): SetDishActiveResult {
  if (!getBusinessDish(dishId)) return { ok: false, reason: "unknownDish" };
  const state = save.business.menuActivation;
  const inactive = new Set(state.inactiveDishIds);
  if (active) {
    inactive.delete(dishId);
  } else {
    const activeCount = BUSINESS_DISH_CATALOG.filter((d) => !inactive.has(d.id)).length;
    if (!inactive.has(dishId) && activeCount <= 1) return { ok: false, reason: "lastActiveDish" };
    inactive.add(dishId);
  }
  // Catalog order keeps the stored list deterministic regardless of toggle order.
  const inactiveDishIds = BUSINESS_DISH_CATALOG.map((d) => d.id).filter((id) => inactive.has(id));
  return {
    ok: true,
    save: { ...save, business: { ...save.business, menuActivation: { inactiveDishIds } } },
    dishId,
    active,
  };
}
