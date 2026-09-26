/**
 * BUSINESS_PURCHASE_QUANTITY — Economy V3 Phase 16 (P2 remediation). The
 * Inventory screen's quantity stepper, as pure data + one function so it
 * can be tested. The smallest purchase is ONE purchase unit (1 lb / 1
 * piece — businessPricing.ts's own units; BusinessInventoryManager has
 * always accepted any whole unit >= 1). The old screen-only minimum of 5
 * (no master-spec basis) forced e.g. 5 lb of garlic (~100 portions) onto
 * a 12-day shelf life. Steps are 1 up to 5, then 5 at a time, so
 * contract-sized orders (25+) stay quick. Pricing, supplier discounts
 * (still gated on the contract's own minimum order), shortage caps and
 * storage checks are unchanged.
 */
export const MIN_PURCHASE_QUANTITY = 1;
export const DEFAULT_PURCHASE_QUANTITY = 5;
const SMALL_STEP_LIMIT = 5;
const LARGE_STEP = 5;

export function stepPurchaseQuantity(current: number, direction: 1 | -1): number {
  if (direction === 1) return current < SMALL_STEP_LIMIT ? current + 1 : current + LARGE_STEP;
  return current <= SMALL_STEP_LIMIT
    ? Math.max(MIN_PURCHASE_QUANTITY, current - 1)
    : current - LARGE_STEP;
}
