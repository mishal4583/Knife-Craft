/**
 * RESTAURANT_ECONOMY — the Unified Restaurant economy pass (docs/ECONOMY_TODO.md).
 *
 * P0 — no double food cost. The campaign settlement (EconomySettlement)
 * deducts a built-in food cost (COGS) from every order, while in the
 * restaurant the player has already paid for the real ingredients in the
 * Market (and the order consumed them from stock). In the restaurant an
 * order therefore pays its RECIPE EARNINGS + QUALITY BONUS; its food cost
 * is the real stock, recorded when it was bought ("inventory-purchase").
 * The chain the developer set: level revenue → real ingredient consumption
 * → supplies → actual profit.
 *
 * The settlement is computed by the unchanged EconomySettlement (the
 * release build and the frozen Economy V2 baseline are untouched); this
 * only re-reads its result for the restaurant: food-cost lines become 0, no
 * INGREDIENT_COGS transaction. The quality bonus — and every boost knives,
 * boards and kitchen helpers give it — stays.
 *
 * Measured by scripts/restaurant-economy-pass.mts: a completionist who buys
 * everything ends Level 250 with ~$129k (target $100k–$150k, Economy V2.5);
 * with the double charge it was ~$95k.
 *
 * ITEM EFFECTS ON REAL STOCK (developer 2026-10-05: "Move to real stock").
 * The percentages that lowered the built-in food cost now act on the real
 * ingredients — the values are unchanged and logged in docs/ECONOMY_TODO.md:
 *  - knife + board specialisation (equipmentSpecialization.ts), the Prep
 *    Assistant / Kitchen Assistant (staff.ts) and a dull knife's penalty
 *    (sharpness.ts) scale the stock an order USES (`stockUseFor`);
 *  - the Campaign Supplier's modifier (supplier.ts: Wholesale −10%,
 *    Premium +10%) scales Market INGREDIENT PRICES (`restaurantQuote`).
 * Quality effects stay quality-bonus boosts in the settlement.
 *
 * Pure; nothing reads RESTAURANT_MODE (App and the Market apply it in the
 * restaurant build; the restaurant's own modules always use it).
 */
import { lbPerMarketUnit, measureOf } from "../business/measure";
import type { SettlementResult } from "../economy/economyTypes";
import type { SaveData } from "../SaveManager";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import type { IngredientId } from "../definitions";
import { getEquipmentModifier } from "../economy/equipmentSpecialization";
import { getKnifeSharpness, getSharpnessModifier } from "../economy/sharpness";
import { getStaffModifier } from "../economy/staff";
import { getSupplierModifier } from "../economy/supplier";
import { purchaseQuote, type PurchaseQuote } from "../business/BusinessInventoryManager";
import { ingredientBulkDiscount } from "./bulkBuying";
import { restaurantQuality } from "./restaurantInvestments";

/**
 * The restaurant's view of an order's settlement: earnings + quality bonus,
 * food cost from stock. `supplierQualityBonusPct` is the restaurant's extra
 * quality share (`restaurantQualityBonusPct`: the Premium supplier, the
 * kitchen tiers and the equipment owned), a share of the order's earnings
 * added to its quality bonus; 0 = none. (The Emergency Service penalty is
 * gone — developer 2026-10-10: a service covered by an ad or supplier credit
 * earns its full pay.)
 */
export function restaurantSettlement(
  settlement: SettlementResult,
  supplierQualityBonusPct = 0,
): SettlementResult {
  const extra =
    supplierQualityBonusPct > 0 ? Math.round(settlement.revenue * supplierQualityBonusPct) : 0;
  const qualityBonus = settlement.qualityBonus + extra;
  let transactions = settlement.transactions.filter((t) => t.type !== "INGREDIENT_COGS");
  if (extra > 0) {
    const bonus = transactions.find((t) => t.type === "QUALITY_BONUS");
    const revenueLine = transactions.find((t) => t.type === "RECIPE_REVENUE");
    transactions = bonus
      ? transactions.map((t) => (t === bonus ? { ...t, amount: t.amount + extra } : t))
      : revenueLine
        ? [
            ...transactions,
            {
              ...revenueLine,
              id: `${revenueLine.id}-supplier`,
              type: "QUALITY_BONUS",
              amount: extra,
              context: "supplier",
            },
          ]
        : transactions;
  }
  return {
    ...settlement,
    finalCOGS: 0,
    supplierCOGSAdjustment: 0,
    equipmentCOGSSavings: 0,
    sharpnessCOGSPenalty: 0,
    staffCOGSSavings: 0,
    yieldSavings: 0,
    qualityBonus,
    netResult: settlement.revenue + qualityBonus,
    transactions,
  };
}

/**
 * The ingredient supplier's effects beyond price in the restaurant
 * (developer 2026-10-06: keep Premium; it costs ~+10% and gives longer
 * freshness and a small quality benefit). PROVISIONAL values — the exact
 * numbers are for the final economy pass (docs/ECONOMY_TODO.md):
 *  - freshnessBonusDays: stock bought from this supplier starts ageing that
 *    many days later (it is recorded as bought that many days on — age is
 *    clamped at 0 — so expiry, spoilage, "days left" and the Market all read
 *    it through the existing perishability rules);
 *  - qualityBonusPct: a share of each campaign order's earnings added to its
 *    quality bonus.
 * Local Market is the balanced baseline, Wholesale the cheapest (no extras).
 */
export const SUPPLIER_EFFECTS: Record<
  string,
  { freshnessBonusDays: number; qualityBonusPct: number }
> = {
  "local-market": { freshnessBonusDays: 0, qualityBonusPct: 0 },
  "wholesale-supplier": { freshnessBonusDays: 0, qualityBonusPct: 0 },
  "premium-supplier": { freshnessBonusDays: 1, qualityBonusPct: 0.02 },
};

/** The current ingredient supplier's freshness and quality effects (zeros for an unknown id). */
export function supplierEffects(save: SaveData): {
  freshnessBonusDays: number;
  qualityBonusPct: number;
} {
  return SUPPLIER_EFFECTS[save.selectedSupplierId] ?? { freshnessBonusDays: 0, qualityBonusPct: 0 };
}

/** True for a settlement whose food came from the restaurant's own stock (no built-in food cost). */
export function foodFromStock(settlement: SettlementResult): boolean {
  return !settlement.transactions.some((t) => t.type === "INGREDIENT_COGS");
}

/**
 * How much of an order's recipe stock is really used, as a factor of the
 * recipe's portion (1 = as written):
 *  - `factor`: knife/board and kitchen-helper savings × the dull-knife
 *    penalty at today's sharpness — what the Pre-Service Check plans with;
 *  - `floor`: the same without the sharpness penalty. Sharpness only drops
 *    during a service, so a later order may need a little more than planned;
 *    a serve then takes the extra only from stock that is there and never
 *    blocks while the floor is covered (the check guarantees at least it).
 */
export function stockUseFor(
  save: SaveData,
  recipe: RecipeDefinition,
): { factor: number; floor: number } {
  const equipment = getEquipmentModifier(save.equippedKnifeId, save.equippedBoardId, recipe);
  const helpers = getStaffModifier(save.ownedStaffIds, recipe);
  const floor = (1 - equipment.cogsReductionPct) * (1 - helpers.cogsReductionPct);
  const dull = getSharpnessModifier(getKnifeSharpness(save, save.equippedKnifeId));
  return { factor: floor * (1 + dull), floor };
}

/** The Campaign Supplier's effect on Market ingredient prices (1 + its modifier). */
export function supplierPriceFactor(save: SaveData): number {
  return 1 + getSupplierModifier(save.selectedSupplierId);
}

/**
 * The restaurant's price for buying `quantity` whole Market units of an
 * ingredient — lb or kg as the player chose in Settings (business/measure.ts;
 * a piece for loaves and bunches): the Market's own quote with the supplier
 * factor and the bulk discount. The Market card, the purchase, the
 * Pre-Service Check and Inventory all use it, so every shown price is what
 * the tap charges.
 */
export function restaurantQuote(
  save: SaveData,
  ingredientId: IngredientId,
  quantity: number,
): PurchaseQuote {
  return purchaseQuote(
    save,
    ingredientId,
    quantity,
    ingredientBulkDiscount(ingredientId, quantity, measureOf(save)),
    supplierPriceFactor(save),
    lbPerMarketUnit(ingredientId, measureOf(save)),
  );
}

/**
 * The extra quality share a campaign order earns in the restaurant: the
 * ingredient supplier's (Premium) + the kitchen tiers built + the equipment
 * owned (restaurantInvestments.ts). Never applied to anything but the
 * campaign order's settlement.
 */
export function restaurantQualityBonusPct(save: SaveData): number {
  return supplierEffects(save).qualityBonusPct + restaurantQuality(save).total;
}
