/**
 * SUPPLIER (settlement-facing) — Economy V2 Phase 8. The one function
 * EconomySettlement.computeSettlement calls to resolve a
 * `selectedSupplierId` into its deterministic COGS multiplier — mirrors
 * equipmentSpecialization.ts/staff.ts's own role/shape, but simpler: a
 * supplier's effect never depends on the recipe (unlike equipment/
 * staff's category/batchable gating), only on which of the 3 catalog
 * entries is selected.
 */
import { SUPPLIER_CATALOG, DEFAULT_SUPPLIER_ID } from "./supplierDefinitions";

/**
 * `selectedSupplierId` — optional, defaulting to undefined, which
 * resolves to Local Market's own 0 modifier (the same value
 * DEFAULT_SUPPLIER_ID's catalog entry has) — so every pre-Phase-8
 * caller of computeSettlement that doesn't pass this at all is
 * completely unaffected. An unrecognized id also resolves to 0,
 * never a thrown error.
 */
export function getSupplierModifier(selectedSupplierId: string | undefined): number {
  const id = selectedSupplierId ?? DEFAULT_SUPPLIER_ID;
  const supplier = SUPPLIER_CATALOG.find((s) => s.id === id);
  return supplier?.cogsModifier ?? 0;
}
