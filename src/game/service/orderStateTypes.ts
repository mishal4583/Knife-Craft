/**
 * ORDER_STATE_TYPES — the customer-order state machine (brief §42).
 * Deliberately a single linear chain, no scattered booleans: an order
 * is in exactly one of these states at a time, and only ever moves
 * forward (§45 — payment happens exactly once, never twice, never out
 * of order).
 *
 * WAITING_FOR_ALLOCATION / WAITING_FOR_BRANCH (§42) are represented as
 * PREPARING with an incomplete OrganizationSession rather than two more
 * enum values — RecipeValidator (not this module) is the single source
 * of truth for "is it actually ready", so the state machine itself
 * never needs to know WHY an order is still preparing.
 */
export type OrderStatus =
  "PENDING" | "ACTIVE" | "PREPARING" | "READY" | "SERVED" | "PAID" | "COMPLETED";

const NEXT: Record<OrderStatus, OrderStatus | null> = {
  PENDING: "ACTIVE",
  ACTIVE: "PREPARING",
  PREPARING: "READY",
  READY: "SERVED",
  SERVED: "PAID",
  PAID: "COMPLETED",
  COMPLETED: null,
};

/** The only legal next state, or null once COMPLETED (a terminal state — nothing follows it). */
export function nextStatus(current: OrderStatus): OrderStatus | null {
  return NEXT[current];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from] === to;
}

/** §45 — an order may be paid exactly once: true only the instant it first reaches PAID from SERVED. */
export function isPayableTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from === "SERVED" && to === "PAID";
}
