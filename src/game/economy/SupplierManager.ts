/**
 * SUPPLIER_MANAGER — pure logic over Supplier SELECTION (Economy V2
 * Phase 8). No I/O of its own: SaveManager remains the only thing that
 * touches storage. Deliberately much smaller than KnifeManager/
 * KitchenInvestmentManager/StaffManager — a supplier is a free,
 * always-available selection, never owned/purchased, so there is no
 * "locked"/"insufficientFunds"/"alreadyOwned" state at all.
 */
import type { SaveData } from "../SaveManager";
import { getSupplier, DEFAULT_SUPPLIER_ID } from "./supplierDefinitions";

export function getSelectedSupplierId(save: SaveData): string {
  return getSupplier(save.selectedSupplierId) ? save.selectedSupplierId : DEFAULT_SUPPLIER_ID;
}

export type SelectSupplierResult =
  { ok: true; save: SaveData } | { ok: false; reason: "unknownSupplier" };

/** Free, always-available, deterministic — no cost, no unlock level, no ownership check. Never mutates `save`. */
export function selectSupplier(save: SaveData, id: string): SelectSupplierResult {
  if (!getSupplier(id)) return { ok: false, reason: "unknownSupplier" };
  return { ok: true, save: { ...save, selectedSupplierId: id } };
}
