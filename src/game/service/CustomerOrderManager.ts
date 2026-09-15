/**
 * CUSTOMER_ORDER_MANAGER — pure lifecycle logic for a CustomerOrder
 * (brief §40/§42/§45), mirroring organizationManager.ts's own style:
 * every function takes a value and returns a new one, no I/O, no React.
 *
 *   OrderGenerator picks a RecipeDefinition
 *        ↓ createCustomerOrder
 *   CustomerOrder (PENDING)
 *        ↓ activateOrder / beginPreparing (orderStateTypes.ts's chain)
 *        ↓ RecipeValidator.isRecipeReady(session) === true
 *        ↓ markReady → serveOrder → payOrder (§45 — exactly once)
 *   COMPLETED
 */
import type { CustomerOrder } from "../customers/customerTypes";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { nextStatus, isPayableTransition, type OrderStatus } from "./orderStateTypes";

let orderSequence = 0;

export function createCustomerOrder(
  customerId: string,
  recipe: RecipeDefinition,
  now: number = Date.now(),
): CustomerOrder {
  orderSequence += 1;
  return {
    id: `order-${now}-${orderSequence}`,
    customerId,
    recipeId: recipe.id,
    status: "PENDING",
    basePayment: recipe.basePayment,
    chefInstruction: recipe.chefInstruction,
    createdAt: now,
  };
}

/** Advances one step along the fixed chain (§42) — a no-op (returns the same order) once COMPLETED, never throws. */
export function advanceOrder(order: CustomerOrder): CustomerOrder {
  const next = nextStatus(order.status);
  return next ? { ...order, status: next } : order;
}

/**
 * §45/§7 — pays exactly once: returns the coin amount only on the
 * genuine SERVED → PAID transition, 0 on any other call (already paid,
 * or not yet served). The caller is expected to credit this return
 * value; this function never touches SaveData itself.
 */
export function payOrder(order: CustomerOrder): { order: CustomerOrder; coinsAwarded: number } {
  const next = nextStatus(order.status);
  if (!next || !isPayableTransition(order.status, next)) {
    return { order, coinsAwarded: 0 };
  }
  return { order: { ...order, status: next }, coinsAwarded: order.basePayment };
}

export function isOrderStatus(order: CustomerOrder, status: OrderStatus): boolean {
  return order.status === status;
}
