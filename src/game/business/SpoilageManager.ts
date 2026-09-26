/**
 * SPOILAGE_MANAGER — Economy V3 Phase 4. The one place expired inventory
 * is actually cleared out of `BusinessInventory`, and the one place a
 * running lifetime spoilage total (for the V3-14 P&L) accumulates.
 *
 * Spoilage is never a wallet/ledger event — no credits ever changed
 * hands, so `clearExpiredStock` never touches `SaveData.credits` or
 * `SaveData.economyLedger` (brief: "Every wallet mutation enters
 * EconomyLedger" — this isn't one). It IS recorded, though (brief: "No
 * silent inventory deletion" / "Spoilage recorded for P&L later") via
 * the returned `spoiledQuantity`/`spoiledValue` and the running
 * `BusinessSpoilageState` total the caller persists.
 */
import type { IngredientId } from "../definitions";
import { normalizeQuantity, type BusinessInventory } from "./businessInventory";
import { perishabilityStateFor } from "./perishability";

export type BusinessSpoilageState = {
  /** Lifetime total units removed for being EXPIRED — never decreases. */
  totalSpoiledQuantity: number;
  /** Lifetime total `quantity * unitCost` lost to spoilage — never decreases; feeds the V3-14 Daily/Weekly P&L "Spoilage" line. */
  totalSpoiledValue: number;
};

export const DEFAULT_SPOILAGE_STATE: BusinessSpoilageState = {
  totalSpoiledQuantity: 0,
  totalSpoiledValue: 0,
};

export type ClearExpiredStockResult = {
  inventory: BusinessInventory;
  spoiledQuantity: number;
  spoiledValue: number;
  spoiledIngredientIds: IngredientId[];
};

/**
 * Removes ONLY fully-EXPIRED entries — the aggregate model (see
 * businessInventory.ts) means an entry is either wholly usable or wholly
 * expired, so this never partially deletes a still-usable entry, and
 * never touches an entry that's merely AGING/NEAR_EXPIRY. Pure — the
 * caller (BusinessDayManager.endBusinessDay) persists the result and
 * accumulates the returned totals into `business.spoilage` itself.
 */
export function clearExpiredStock(
  inventory: BusinessInventory,
  currentBusinessDay: number,
): ClearExpiredStockResult {
  let next = inventory;
  let spoiledQuantity = 0;
  let spoiledValue = 0;
  const spoiledIngredientIds: IngredientId[] = [];
  for (const entry of Object.values(inventory)) {
    if (!entry) continue;
    const state = perishabilityStateFor(entry.ingredientId, entry.purchaseDay, currentBusinessDay);
    if (state !== "EXPIRED") continue;
    spoiledQuantity += entry.quantity;
    spoiledValue += entry.quantity * entry.unitCost;
    spoiledIngredientIds.push(entry.ingredientId);
    const { [entry.ingredientId]: _removed, ...rest } = next;
    next = rest;
  }
  // A partly-served entry can hold a fractional quantity (see
  // businessInventory.ts normalizeQuantity) — keep quantity at 3 decimals
  // and value in whole cents.
  return {
    inventory: next,
    spoiledQuantity: normalizeQuantity(spoiledQuantity),
    spoiledValue: Math.round(spoiledValue),
    spoiledIngredientIds,
  };
}
