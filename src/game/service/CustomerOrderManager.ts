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
import { recipePay } from "../recipes/recipePay";
import { dollars } from "../money";
import { nextStatus, isPayableTransition, type OrderStatus } from "./orderStateTypes";

let orderSequence = 0;

/**
 * `chapter` — KnifeCraft_Level_System_v2.docx §3.4: pay is a property of
 * the (recipe, chapter served) pair, computed live via `recipePay`, never
 * `recipe.basePayment` directly. Left `undefined` for the one caller with
 * no chapter concept — the standalone Phase 2 Restaurant Service harness
 * (testRecipePool.ts's mock recipes, entered via App.tsx's `startService`,
 * `levelId: "service"`) — which keeps its exact old behavior (the static
 * field) unchanged. Every real campaign call site (ServiceManager.ts's
 * `buildServiceOrder`/`createBatchGroupSession`) always passes a real
 * chapter number.
 */
export function createCustomerOrder(
  customerId: string,
  recipe: RecipeDefinition,
  chapter?: number,
  now: number = Date.now(),
): CustomerOrder {
  orderSequence += 1;
  return {
    id: `order-${now}-${orderSequence}`,
    customerId,
    recipeId: recipe.id,
    status: "PENDING",
    // recipePay / recipe.basePayment are whole dollars; an order's payment is wallet cents.
    basePayment: dollars(chapter !== undefined ? recipePay(recipe, chapter) : recipe.basePayment),
    preparationScore: null,
    chefInstruction: recipe.chefInstruction,
    createdAt: now,
  };
}

/** Economy V2 payout wiring — stamps this order's 0-100 preparation score once its components are recorded, so it survives from "prep completes" (recordAllComponents/recordBatchGroupComponents) to "order is served" (payOrder's caller), where CustomerOrderManager itself never computes a settlement. */
export function recordPreparationScore(order: CustomerOrder, score: number): CustomerOrder {
  return { ...order, preparationScore: score };
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
 *
 * `amountOverride` — Economy V2 payout wiring: when the caller has
 * already computed a real settlement (EconomySettlement.computeSettlement's
 * netResult, or 0 for a campaign replay), it passes that number here so
 * the ACTUAL amount paid can reflect COGS/quality/replay rules while
 * this function keeps owning the one "exactly once" guard every payout
 * path shares — never a second, duplicate guard. Omitted, this falls
 * back to `order.basePayment` exactly as before (unwired callers, e.g.
 * a future/test caller, keep their old behavior unchanged).
 */
export function payOrder(
  order: CustomerOrder,
  amountOverride?: number,
): { order: CustomerOrder; coinsAwarded: number } {
  const next = nextStatus(order.status);
  if (!next || !isPayableTransition(order.status, next)) {
    return { order, coinsAwarded: 0 };
  }
  return {
    order: { ...order, status: next },
    coinsAwarded: amountOverride ?? order.basePayment,
  };
}

export function isOrderStatus(order: CustomerOrder, status: OrderStatus): boolean {
  return order.status === status;
}
