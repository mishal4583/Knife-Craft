/**
 * RESTAURANT_BACK_OFFICE — Unified Restaurant phase 7: one back office over
 * the data sets that already exist (docs/RESTAURANT_INTEGRATION_AUDIT.md
 * §17 conflict 4: "one Staff screen and one Suppliers screen; both data sets
 * kept underneath; effects unchanged").
 *
 *  - SUPPLIERS: the Campaign Supplier (`SaveData.selectedSupplierId`, Local /
 *    Wholesale / Premium) now sets the restaurant's Market ingredient prices
 *    (economy pass, `supplierPriceFactor`), so it sits on Restaurant →
 *    Suppliers next to the contracts instead of in the Market. Choosing one
 *    stays free (`SupplierManager.selectSupplier`, no money, no ledger).
 *  - EQUIPMENT: restaurant development (the kitchen tiers,
 *    KitchenUpgradeManager) is shown on Restaurant → Equipment next to the
 *    fridge; it is still built on the Kitchen Upgrade screen.
 *  - STAFF was already one screen (waged team, kitchen helpers, specialists).
 *
 * Read-only view models; every figure comes from the existing systems.
 * Pure; nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import { SUPPLIER_CATALOG } from "../economy/supplierDefinitions";
import { getSelectedSupplierId } from "../economy/SupplierManager";
import { KITCHEN_UPGRADE_CATALOG } from "../kitchen/kitchenUpgradeDefinitions";
import { getKitchenUpgradeState, type KitchenUpgradeState } from "../kitchen/KitchenUpgradeManager";
import { SUPPLIER_EFFECTS, restaurantQuote } from "./restaurantEconomy";
import { kitchenTierPrice } from "./restaurantInvestments";

/** The ingredient each supplier card prices as its example. */
export const SUPPLIER_EXAMPLE_INGREDIENT: IngredientId = "tomato";

export type SupplierChoiceView = {
  id: string;
  name: string;
  description: string;
  /** Signed change to Market ingredient prices (−0.1 = 10% cheaper). */
  priceChange: number;
  /** One unit of the example ingredient in the Market with this supplier, in cents. */
  exampleUnitCost: number;
  /** Extra days its stock stays fresh, and its extra quality bonus (restaurantEconomy.SUPPLIER_EFFECTS, provisional). */
  freshnessBonusDays: number;
  qualityBonusPct: number;
  current: boolean;
};

/** The three ingredient suppliers as Restaurant → Suppliers shows them, priced by the Market's own quote. */
export function supplierChoices(save: SaveData): SupplierChoiceView[] {
  const selected = getSelectedSupplierId(save);
  return SUPPLIER_CATALOG.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    priceChange: s.cogsModifier,
    exampleUnitCost: restaurantQuote(
      { ...save, selectedSupplierId: s.id },
      SUPPLIER_EXAMPLE_INGREDIENT,
      1,
    ).unitCost,
    current: s.id === selected,
    freshnessBonusDays: SUPPLIER_EFFECTS[s.id]?.freshnessBonusDays ?? 0,
    qualityBonusPct: SUPPLIER_EFFECTS[s.id]?.qualityBonusPct ?? 0,
  }));
}

/** The current supplier's effect on Market prices, for one line in the Market (" · −10% on ingredients", or "" at standard prices). */
export function supplierPriceNote(save: SaveData): string {
  const change = supplierChoices(save).find((c) => c.current)?.priceChange ?? 0;
  const v = Math.round(change * 100);
  return v === 0 ? "" : ` · ${v > 0 ? "+" : "−"}${Math.abs(v)}% on ingredients`;
}

export type RestaurantDevelopmentView = {
  /** The restaurant's current tier (the highest built). */
  currentName: string;
  /** Tiers built after the starting kitchen, of those that can be built. */
  built: number;
  total: number;
  /** The next tier to build, or null when the restaurant is fully developed. */
  next: {
    name: string;
    price: number;
    unlockLevel: number;
    state: KitchenUpgradeState;
  } | null;
};

/** Restaurant development (the kitchen tiers) for Restaurant → Equipment. */
export function restaurantDevelopment(save: SaveData): RestaurantDevelopmentView {
  const tiers = KITCHEN_UPGRADE_CATALOG.slice(1);
  const states = KITCHEN_UPGRADE_CATALOG.map((u) => getKitchenUpgradeState(u.id, save));
  const currentIndex = Math.max(0, states.indexOf("current"));
  const built = tiers.filter((u) => save.ownedKitchenUpgradeIds.includes(u.id)).length;
  const nextDef = KITCHEN_UPGRADE_CATALOG.find(
    (u, i) => i > 0 && !save.ownedKitchenUpgradeIds.includes(u.id),
  );
  return {
    currentName: KITCHEN_UPGRADE_CATALOG[currentIndex]!.name,
    built,
    total: tiers.length,
    next: nextDef
      ? {
          name: nextDef.name,
          price: kitchenTierPrice(nextDef, save),
          unlockLevel: nextDef.unlockLevel,
          state: getKitchenUpgradeState(nextDef.id, save),
        }
      : null,
  };
}
