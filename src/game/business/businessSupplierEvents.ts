/**
 * BUSINESS_SUPPLIER_EVENTS — Economy V3 Phase 8. Deterministic, purely
 * DERIVED events — no new persisted state at all (mirrors
 * businessCalendar.ts's own `dayOfWeekFor`/`businessWeekFor`, both pure
 * functions of `businessDay` rather than a stored value). "Which event
 * is active" is a pure function of the existing `business.calendar.
 * businessDay` — the SAME day always produces the SAME event (brief:
 * "deterministic... visible and reproducible"), so there is nothing here
 * that needs saving or that could ever drift out of sync with itself.
 *
 * No Math.random() anywhere — the schedule is a fixed, documented
 * 9-day cycle: the 6 event types below, in order, followed by 3 quiet
 * days with no event, then it repeats. This is calibration data, exactly
 * like businessPricing.ts's own category table — retuning the cadence
 * means changing this one cycle, nothing else.
 */

export type SupplierEventType =
  | "supplier-delay"
  | "price-increase"
  | "bulk-discount"
  | "fresh-catch"
  | "temporary-shortage"
  | "premium-stock";

export type SupplierEventDefinition = {
  id: SupplierEventType;
  name: string;
  description: string;
  /** Signed fraction applied to the category base price for every purchase made while this event is active — positive = costlier, negative = cheaper. 0 for an event whose effect isn't a direct price change. */
  priceModifier: number;
  /** True only for "Supplier Delay" — an active supplier contract's own discount does not apply on a day this event is active (the delay is with the contracted supplier specifically). */
  suspendsContractDiscount: boolean;
  /** Set only for "Temporary Shortage" — the maximum quantity a SINGLE purchase may be while this event is active. undefined = no cap. */
  maxPurchaseQuantity?: number;
};

/** Fixed order — see file header for how this maps to the 9-day cycle. */
const EVENT_TYPE_ORDER: readonly SupplierEventType[] = [
  "supplier-delay",
  "price-increase",
  "bulk-discount",
  "fresh-catch",
  "temporary-shortage",
  "premium-stock",
];

/** 6 real event days + 3 quiet days = a 9-day cycle. */
export const EVENT_CYCLE_LENGTH = EVENT_TYPE_ORDER.length + 3;

export const SUPPLIER_EVENT_CATALOG: Record<SupplierEventType, SupplierEventDefinition> = {
  "supplier-delay": {
    id: "supplier-delay",
    name: "Supplier Delay",
    description: "A delivery running late — today, your active contract's discount doesn't apply.",
    priceModifier: 0,
    suspendsContractDiscount: true,
  },
  "price-increase": {
    id: "price-increase",
    name: "Price Increase",
    description: "Rates are up across the board today.",
    priceModifier: 0.15,
    suspendsContractDiscount: false,
  },
  "bulk-discount": {
    id: "bulk-discount",
    name: "Bulk Discount",
    description: "A one-day markdown on everything in stock.",
    priceModifier: -0.15,
    suspendsContractDiscount: false,
  },
  "fresh-catch": {
    id: "fresh-catch",
    name: "Fresh Catch",
    description: "An especially good haul came in today — a modest discount.",
    priceModifier: -0.1,
    suspendsContractDiscount: false,
  },
  "temporary-shortage": {
    id: "temporary-shortage",
    name: "Temporary Shortage",
    description: "Supply is tight — purchases are capped and cost a bit more today.",
    priceModifier: 0.1,
    suspendsContractDiscount: false,
    maxPurchaseQuantity: 10,
  },
  "premium-stock": {
    id: "premium-stock",
    name: "Premium Stock",
    description: "Unusually good ingredients came in today, at a premium.",
    priceModifier: 0.05,
    suspendsContractDiscount: false,
  },
};

/** The one place "what's today's event" is decided. `null` on a quiet day. Deterministic: the same `businessDay` always returns the same result. */
export function eventForDay(businessDay: number): SupplierEventDefinition | null {
  const cyclePosition = (businessDay - 1) % EVENT_CYCLE_LENGTH;
  const type = EVENT_TYPE_ORDER[cyclePosition];
  return type ? SUPPLIER_EVENT_CATALOG[type] : null;
}

/** Applies an active event's price modifier to a base unit cost — never negative. `null` (no event) leaves the price unchanged. */
export function eventAdjustedUnitCost(
  baseUnitCost: number,
  event: SupplierEventDefinition | null,
): number {
  if (!event) return baseUnitCost;
  return Math.max(0, Math.round(baseUnitCost * (1 + event.priceModifier)));
}

/** `undefined` (no cap) whenever no event is active or the active event doesn't cap quantity. */
export function maxPurchaseQuantityFor(event: SupplierEventDefinition | null): number | undefined {
  return event?.maxPurchaseQuantity;
}
