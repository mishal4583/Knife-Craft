/**
 * QUICK RESTOCK (developer 2026-10-08) — from the Pre-Service Check, buy
 * EXACTLY what this service is missing without going to the Market, at a
 * higher price. "Only the required amount, but without going to the market
 * (show the cost is high as a warning) — or else go to the Market and buy
 * the stock beforehand."
 *
 *  - Amount: what the Market would sell for each missing ingredient — the
 *    check's own Restock amount (the shortfall rounded up to the Market's
 *    smallest step: ¼ lb / ¼ kg, or a whole piece).
 *  - Price: exactly what the Market charges for that amount
 *    (`restaurantQuote`: today's price, supplier, bulk) plus the same
 *    `RUSH_RESTOCK_FEE` (+25 %) Business Rush Restock charges, rounded to
 *    the cent per line — so it is ALWAYS dearer than going to the Market
 *    (audit 2026-10-08: it used to buy the exact shortfall at +25 % and came
 *    out cheaper than the Market's whole pounds). The plan says how much
 *    more, for the sheet's warning.
 *  - All-or-nothing, like a Market purchase: the wallet must cover it and
 *    the fridge must hold it, else nothing changes. The caller (App) records
 *    one "inventory-purchase" ledger entry per ingredient, exactly like
 *    `persistIngredientPurchases` does for the Market and Rush Restock.
 *
 * Pure; nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import { addStock, normalizeQuantity } from "../business/businessInventory";
import { RUSH_RESTOCK_FEE, rushUnitCost } from "../business/businessRushRestock";
import { canStoreQuantity, getAvailableStorageCapacity } from "../business/RefrigeratorManager";
import { applyStockingWear } from "../business/businessEquipmentCondition";
import type { ServiceStockCheck } from "./campaignStock";
import { supplierEffects } from "./restaurantEconomy";

export const QUICK_RESTOCK_FEE = RUSH_RESTOCK_FEE;

export type QuickRestockLine = {
  ingredientId: IngredientId;
  /** Stock added, in the purchase unit (lb or pieces) — the Market amount below. */
  quantity: number;
  /** Market units (lb / kg / pieces, in ¼ steps for weighed goods) — what Restock would buy. */
  marketUnits: number;
  /** What this line costs (whole cents): the Market's price + the fee. */
  cost: number;
  /** The same amount in the Market (whole cents). */
  marketCost: number;
};

export type QuickRestockPlan = {
  lines: QuickRestockLine[];
  totalCost: number;
  marketCost: number;
  /** totalCost − marketCost: what going to the Market first would save. */
  extraCost: number;
  /** Fridge units the stock takes, and free now. */
  storageNeeded: number;
  storageFree: number;
  fits: boolean;
  affordable: boolean;
};

/** The quick restock for a check's missing stock; null when nothing is missing or today's shortage limit blocks a line. */
export function quickRestockPlan(
  save: SaveData,
  check: ServiceStockCheck,
): QuickRestockPlan | null {
  if (!check.applies || check.missingRows.length === 0) return null;
  const lines: QuickRestockLine[] = [];
  for (const row of check.missingRows) {
    if (!(row.buyUnits > 0) || !row.quote) continue;
    if (row.quote.verdict === "exceedsShortageLimit") return null;
    lines.push({
      ingredientId: row.ingredientId,
      quantity: row.quote.stockQuantity,
      marketUnits: row.buyUnits,
      cost: rushUnitCost(row.quote.totalCost),
      marketCost: row.quote.totalCost,
    });
  }
  if (lines.length === 0) return null;
  const totalCost = lines.reduce((t, l) => t + l.cost, 0);
  const marketCost = lines.reduce((t, l) => t + l.marketCost, 0);
  const storageNeeded = normalizeQuantity(lines.reduce((t, l) => t + l.quantity, 0));
  const refrigeratorId = save.business.refrigerator.refrigeratorId;
  return {
    lines,
    totalCost,
    marketCost,
    extraCost: Math.max(0, totalCost - marketCost),
    storageNeeded,
    storageFree: getAvailableStorageCapacity(save.business.inventory, refrigeratorId),
    fits: canStoreQuantity(save.business.inventory, refrigeratorId, storageNeeded),
    affordable: save.credits >= totalCost,
  };
}

export type QuickRestockResult =
  | { ok: true; save: SaveData; lines: QuickRestockLine[]; totalCost: number }
  | { ok: false; reason: "nothingMissing" | "insufficientFunds" | "insufficientStorage" };

/**
 * Stocks the plan's lines and takes their cost from the wallet — or changes
 * nothing. The stock is recorded at the price paid (fee included), so its
 * food cost later reports what the player really spent.
 */
export function quickRestock(save: SaveData, check: ServiceStockCheck): QuickRestockResult {
  const plan = quickRestockPlan(save, check);
  if (!plan) return { ok: false, reason: "nothingMissing" };
  if (!plan.affordable) return { ok: false, reason: "insufficientFunds" };
  if (!plan.fits) return { ok: false, reason: "insufficientStorage" };
  // Dated like a Market purchase: a Premium supplier's stock starts ageing later.
  const day = save.business.calendar.businessDay + supplierEffects(save).freshnessBonusDays;
  let inventory = save.business.inventory;
  for (const line of plan.lines)
    inventory = addStock(
      inventory,
      line.ingredientId,
      line.quantity,
      Math.round(line.cost / line.quantity),
      day,
    );
  return {
    ok: true,
    save: {
      ...save,
      credits: save.credits - plan.totalCost,
      business: {
        ...save.business,
        inventory,
        equipmentCondition: applyStockingWear(save.business.equipmentCondition, plan.storageNeeded),
      },
    },
    lines: plan.lines,
    totalCost: plan.totalCost,
  };
}
