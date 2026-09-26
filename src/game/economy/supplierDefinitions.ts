/**
 * SUPPLIER_DEFINITIONS — the single authoritative Supplier catalog
 * (Economy V2 Phase 8). A supplier is a SELECTION, not an owned/
 * purchased item (unlike Kitchen Investments/Staff) — free to pick,
 * free to switch, no inventory, no contract, no timer. Exactly 3
 * options, deterministic COGS-only modifiers.
 *
 * Premium Supplier is COGS-only (no separate quality mechanic) —
 * inspected against the existing quality system (qualityFor/
 * QUALITY_BONUS_RATE_BY_GRADE) and no clean, non-duplicative way to
 * attach a supplier-side quality benefit was found without either (a)
 * touching qualityFor()/grade thresholds (forbidden) or (b) creating a
 * second quality-bonus mechanism alongside Phase 5/7's existing
 * qualityBonusBoost pattern for no clear added benefit over just
 * widening that same pattern, which itself isn't justified by anything
 * "premium sourcing" conceptually implies. Per the Phase 8 brief's own
 * "do not invent complexity just to justify the higher price" — Premium
 * is documented plainly as a costlier sourcing option, full stop.
 */

export type SupplierDefinition = {
  id: string;
  name: string;
  description: string;
  /** Signed fraction applied to chapter-scaled baseline COGS, before the quality waste factor. 0 = neutral. Negative = cheaper (wholesale). Positive = costlier (premium). */
  cogsModifier: number;
};

export const DEFAULT_SUPPLIER_ID = "local-market";

export const SUPPLIER_CATALOG: SupplierDefinition[] = [
  {
    id: "local-market",
    name: "Local Market",
    description: "The everyday choice — balanced, no adjustment.",
    cogsModifier: 0,
  },
  {
    id: "wholesale-supplier",
    name: "Wholesale Supplier",
    description: "Buy in bulk from a wholesale source — lower ingredient cost.",
    cogsModifier: -0.1,
  },
  {
    id: "premium-supplier",
    name: "Premium Supplier",
    description: "Costlier, carefully-sourced ingredients.",
    cogsModifier: 0.1,
  },
];

export function getSupplier(id: string): SupplierDefinition | undefined {
  return SUPPLIER_CATALOG.find((s) => s.id === id);
}

export function getAllSuppliers(): SupplierDefinition[] {
  return SUPPLIER_CATALOG;
}
