/**
 * BUSINESS_SUPPLIER_CONTRACT — Economy V3 Phase 7. Extends the EXISTING
 * supplier catalog (`supplierDefinitions.ts`'s own `SUPPLIER_CATALOG`,
 * Economy V2 Phase 8) with a Business-Mode-only CONTRACT layer — no
 * second supplier registry, no new supplier identities. Campaign's own
 * `save.selectedSupplierId`/`getSupplierModifier`/COGS are completely
 * untouched by anything here.
 *
 * One fixed, data-driven contract OFFER per existing supplier (mirrors
 * `refrigeratorDefinitions.ts`'s own small fixed catalog) rather than
 * letting the player type in arbitrary discount/fee numbers, which
 * wouldn't make sense for a real contract's terms. At most ONE contract
 * can be active at a time (mirrors the refrigerator's "one owned at a
 * time" pattern) — `null` means no contract, never a degenerate
 * "inactive" object.
 *
 * `deliveryTime`/`deliveryDays` and `qualityModifier` are intentionally
 * NOT wired into any real mechanic yet — Business Mode has no delivery-
 * timing system or serving-quality system (that arrives with a later
 * phase). `qualityModifierFor` is a tested FORWARD HOOK, exactly like
 * Phase 6's `orderCompletedDelta`/`inspectionDelta`. `discount` and
 * `minimumOrder`, by contrast, ARE real and wired — see
 * `BusinessInventoryManager.purchaseIngredient`.
 */
export type SupplierContractTerms = {
  /** Business Days the contract runs for once signed. */
  contractLength: number;
  /** Fraction off `businessUnitCostFor` while the contract is active AND the single purchase meets `minimumOrder` — e.g. 0.15 = 15% off. */
  discount: number;
  /** The minimum quantity a SINGLE ingredient purchase must be to receive the contract's discount. */
  minimumOrder: number;
  /** Informational only (see file header) — Business Days a real delivery would realistically take. */
  deliveryTime: number;
  /** FORWARD HOOK (see file header) — signed fraction a future serving-quality system could apply while this contract is active. */
  qualityModifier: number;
  /** Whole US cents charged if the contract is cancelled before `contractEndDay` (Economy V3 Phase 14 — see this file's own doc). 0 = no penalty. */
  cancellationFee: number;
};

/**
 * Keyed by the EXISTING `SupplierDefinition.id` — one fixed offer per real
 * supplier, never a player-invented number. `discount`/`minimumOrder` are
 * fractions/unit-counts, unaffected by Phase 14's currency recalibration;
 * `cancellationFee` is now whole US cents, sized proportionately to each
 * contract's own commitment (the longer, deeper-discount Wholesale
 * contract costs more to break than the lighter Premium one), never an
 * unsourced flat number.
 */
export const SUPPLIER_CONTRACT_CATALOG: Record<string, SupplierContractTerms> = {
  "local-market": {
    contractLength: 10,
    discount: 0.05,
    minimumOrder: 5,
    deliveryTime: 0,
    qualityModifier: 0,
    cancellationFee: 0,
  },
  "wholesale-supplier": {
    contractLength: 21,
    discount: 0.2,
    minimumOrder: 25,
    deliveryTime: 1,
    qualityModifier: -0.05,
    cancellationFee: 12_000,
  },
  "premium-supplier": {
    contractLength: 14,
    discount: 0.05,
    minimumOrder: 5,
    deliveryTime: 0,
    qualityModifier: 0.15,
    cancellationFee: 6_000,
  },
};

export function getContractTerms(supplierId: string): SupplierContractTerms | undefined {
  return SUPPLIER_CONTRACT_CATALOG[supplierId];
}

export function getAllContractOffers(): Array<{
  supplierId: string;
  terms: SupplierContractTerms;
}> {
  return Object.entries(SUPPLIER_CONTRACT_CATALOG).map(([supplierId, terms]) => ({
    supplierId,
    terms,
  }));
}

export type ActiveSupplierContract = SupplierContractTerms & {
  supplierId: string;
  contractStartDay: number;
  contractEndDay: number;
};

/** `null` = no contract signed (or a previous one already ended). Never a second "inactive" shape. */
export type BusinessSupplierContractState = ActiveSupplierContract | null;

export const DEFAULT_SUPPLIER_CONTRACT_STATE: BusinessSupplierContractState = null;

/**
 * The one place "is a contract currently in effect" is decided —
 * `currentBusinessDay >= contractEndDay` means it has run its course,
 * even if the stored object hasn't been cleared out yet
 * (BusinessDayManager does that on the next day advance). Deliberately a
 * plain `boolean`, NOT a `contract is ActiveSupplierContract` type
 * predicate — a real `ActiveSupplierContract` object can still make this
 * return `false` once its own `contractEndDay` has passed, so a
 * predicate here would misrepresent the type system (every call site
 * that also needs `contract`'s fields narrows with its own `contract &&`
 * check instead).
 */
export function isContractActive(
  contract: BusinessSupplierContractState,
  currentBusinessDay: number,
): boolean {
  return !!contract && currentBusinessDay < contract.contractEndDay;
}

/** The one place a purchase's real, wired discount is computed — never re-derived inline by a caller. Returns `baseUnitCost` unchanged whenever no contract is active or the purchase doesn't meet the contract's own minimum order size. */
export function effectiveUnitCost(
  baseUnitCost: number,
  contract: BusinessSupplierContractState,
  currentBusinessDay: number,
  quantity: number,
): number {
  if (!contract || !isContractActive(contract, currentBusinessDay)) return baseUnitCost;
  if (quantity < contract.minimumOrder) return baseUnitCost;
  return Math.max(0, Math.round(baseUnitCost * (1 - contract.discount)));
}

/** FORWARD HOOK — not yet consumed by any real caller (see file header). 0 whenever no contract is active. */
export function qualityModifierFor(
  contract: BusinessSupplierContractState,
  currentBusinessDay: number,
): number {
  return contract && isContractActive(contract, currentBusinessDay) ? contract.qualityModifier : 0;
}
