/**
 * REFRIGERATOR_TYPES — Economy V3 Phase 3. The storage ASSET/RULE side
 * of Business Mode — deliberately separate from `businessInventory.ts`,
 * which stays the one source of truth for actual stock quantities. This
 * file only ever describes WHICH refrigerator the restaurant owns and
 * what it can hold; it never itself stores an ingredient quantity (see
 * this phase's own "single source of truth" rule — duplicating
 * `inventory.tomato.quantity` here would be exactly the sync-bug risk
 * the brief warns against).
 */

export type RefrigeratorDefinition = {
  id: string;
  name: string;
  description: string;
  /** Total stored ingredient quantity this refrigerator can hold — a plain integer sum across every ingredient (see RefrigeratorManager.getInventoryUsedCapacity), not a per-ingredient limit. */
  capacity: number;
  /** Whole US cents (Economy V3 Phase 14 — see refrigeratorDefinitions.ts's own doc for the real-world calibration source). 0 for the free starting tier — mirrors the Chef's Knife/Walnut Board convention (KNIFE_CATALOG/BOARD_CATALOG's own free first entries), not a new pattern. */
  price: number;
  /** Economy V3 Phase 14 — a real-world physical-size DISPLAY label only (derived from `capacity`, see refrigeratorDefinitions.ts's own doc) — never read by any capacity/storage calculation. */
  approxCubicFeet: number;
};

/** The one piece of Business Mode's own persisted state this phase adds: which refrigerator is currently owned/active. Never a collection (`ownedRefrigeratorIds`) — there is exactly one active refrigerator at a time, the same "free switchable selection" shape as `selectedSupplierId`, except here changing it costs credits (see RefrigeratorManager.purchaseRefrigerator). */
export type BusinessRefrigeratorState = {
  refrigeratorId: string;
};
