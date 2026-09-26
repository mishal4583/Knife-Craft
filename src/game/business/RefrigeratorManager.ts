/**
 * REFRIGERATOR_MANAGER — Economy V3 Phase 3. Pure capacity math plus the
 * one refrigerator purchase/upgrade action, mirroring KnifeManager.ts's
 * own shape exactly (lookup helpers + one purchase function, no I/O).
 *
 * Inventory remains the ONE source of truth for quantities (brief's own
 * "single source of truth" rule) — every function here reads
 * `BusinessInventory` to derive used capacity, never stores a quantity
 * of its own.
 */
import type { SaveData } from "../SaveManager";
import { normalizeQuantity, type BusinessInventory } from "./businessInventory";
import { getRefrigerator } from "./refrigeratorDefinitions";
import { DEFAULT_EQUIPMENT_CONDITION_STATE } from "./businessEquipmentCondition";

/** sum(all inventory quantities) — the one place "how much is currently stored" is computed, so `getAvailableStorageCapacity`/`canStoreQuantity` never re-derive it differently. */
export function getInventoryUsedCapacity(inventory: BusinessInventory): number {
  let used = 0;
  for (const entry of Object.values(inventory)) {
    if (entry) used += entry.quantity;
  }
  return normalizeQuantity(used);
}

/** 0 for an unknown/corrupted refrigerator id — never `undefined`, and never throws, so a corrupted save's `available capacity` gracefully resolves to 0 (brief §"migration/corrupted state safety") rather than crashing. */
export function getRefrigeratorCapacity(refrigeratorId: string): number {
  return getRefrigerator(refrigeratorId)?.capacity ?? 0;
}

/**
 * Never negative (brief: "Never return a negative available capacity...
 * If current inventory somehow exceeds the new refrigerator capacity...
 * available capacity = 0"). This is the ONE place that clamp lives —
 * every caller (the purchase flow, both UI screens) reads this function,
 * never re-derives capacity math independently.
 */
export function getAvailableStorageCapacity(
  inventory: BusinessInventory,
  refrigeratorId: string,
): number {
  const capacity = getRefrigeratorCapacity(refrigeratorId);
  const used = getInventoryUsedCapacity(inventory);
  return Math.max(0, normalizeQuantity(capacity - used));
}

export function canStoreQuantity(
  inventory: BusinessInventory,
  refrigeratorId: string,
  additionalQuantity: number,
): boolean {
  return getAvailableStorageCapacity(inventory, refrigeratorId) >= additionalQuantity;
}

export type PurchaseRefrigeratorResult =
  | { ok: true; save: SaveData; refrigeratorId: string; price: number }
  | {
      ok: false;
      reason: "unknownRefrigerator" | "alreadyOwned" | "insufficientFunds" | "invalidDowngrade";
    };

/**
 * Atomic, mirroring buyKnife/purchaseIngredient exactly: either credits
 * drop by exactly the target refrigerator's price AND
 * `business.refrigerator` updates, or NOTHING changes at all. Never
 * touches `business.inventory` (brief: "a refrigerator upgrade must
 * NEVER delete inventory") — the only inventory interaction is the
 * `invalidDowngrade` guard, which REJECTS rather than shrinks anything.
 *
 * Economy V3 Phase 10 — a successful purchase also resets the
 * refrigerator's own condition to 100: a newly bought/upgraded unit is
 * brand new, mirroring sharpenKnife's own "restore to full" precedent.
 */
export function purchaseRefrigerator(
  save: SaveData,
  refrigeratorId: string,
): PurchaseRefrigeratorResult {
  const def = getRefrigerator(refrigeratorId);
  if (!def) return { ok: false, reason: "unknownRefrigerator" };
  if (save.business.refrigerator.refrigeratorId === refrigeratorId) {
    return { ok: false, reason: "alreadyOwned" };
  }
  if (save.credits < def.price) return { ok: false, reason: "insufficientFunds" };
  const used = getInventoryUsedCapacity(save.business.inventory);
  if (def.capacity < used) return { ok: false, reason: "invalidDowngrade" };
  return {
    ok: true,
    save: {
      ...save,
      credits: save.credits - def.price,
      business: {
        ...save.business,
        refrigerator: { refrigeratorId },
        equipmentCondition: { ...DEFAULT_EQUIPMENT_CONDITION_STATE },
      },
    },
    refrigeratorId,
    price: def.price,
  };
}
