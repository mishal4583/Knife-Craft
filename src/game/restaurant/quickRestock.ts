/**
 * QUICK RESTOCK (developer 2026-10-08) — from the Pre-Service Check, buy
 * EXACTLY what this service is missing without going to the Market, at a
 * higher price. "Only the required amount, but without going to the market
 * (show the cost is high as a warning) — or else go to the Market and buy
 * the stock beforehand."
 *
 *  - Amount: each missing ingredient's exact shortfall (to 0.001 of a lb /
 *    piece) — never a whole unit more.
 *  - Price: today's Market price for that ingredient (supplier event,
 *    contract, Prep Cook and the Campaign Supplier's factor — no bulk
 *    discount) plus the same `RUSH_RESTOCK_FEE` (+25 %) Business Rush
 *    Restock charges, rounded to the cent per line. The plan also says what
 *    the same stock costs in the Market, so the sheet can warn how much more
 *    this is.
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
import { purchaseQuote } from "../business/BusinessInventoryManager";
import { RUSH_RESTOCK_FEE, rushUnitCost } from "../business/businessRushRestock";
import { canStoreQuantity, getAvailableStorageCapacity } from "../business/RefrigeratorManager";
import { applyStockingWear } from "../business/businessEquipmentCondition";
import type { ServiceStockCheck } from "./campaignStock";
import { supplierPriceFactor } from "./restaurantEconomy";

export const QUICK_RESTOCK_FEE = RUSH_RESTOCK_FEE;

export type QuickRestockLine = {
  ingredientId: IngredientId;
  /** The exact shortfall, in the purchase unit (lb or pieces). */
  quantity: number;
  /** Today's Market price of one purchase unit (no bulk discount). */
  marketUnitCost: number;
  /** One purchase unit with the quick-restock fee. */
  unitCost: number;
  /** What this line costs (whole cents). */
  cost: number;
  /** The same stock at the Market price (whole cents). */
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
  const factor = supplierPriceFactor(save);
  const lines: QuickRestockLine[] = [];
  for (const row of check.missingRows) {
    const quantity = normalizeQuantity(row.missing);
    if (!(quantity > 0)) continue;
    const quote = purchaseQuote(save, row.ingredientId, quantity, 0, factor);
    if (quote.verdict === "exceedsShortageLimit") return null;
    const marketUnitCost = quote.unitCost;
    const unitCost = rushUnitCost(marketUnitCost);
    lines.push({
      ingredientId: row.ingredientId,
      quantity,
      marketUnitCost,
      unitCost,
      cost: Math.round(quantity * unitCost),
      marketCost: Math.round(quantity * marketUnitCost),
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
  const day = save.business.calendar.businessDay;
  let inventory = save.business.inventory;
  for (const line of plan.lines)
    inventory = addStock(inventory, line.ingredientId, line.quantity, line.unitCost, day);
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
