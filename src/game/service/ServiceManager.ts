/**
 * SERVICE_MANAGER — Phase 2: the restaurant-service session state that
 * makes the loop player-visible (brief §33/§34). Pure logic only,
 * mirroring LevelManager.ts/organizationManager.ts's own style: every
 * function takes a snapshot and returns a new one, no I/O, no React, no
 * Phaser. This is deliberately NOT a second event bus (§5/§41) — React
 * (App.tsx) calls these functions directly in response to real events
 * it already receives (GameBridge's RECIPE_COMPLETED, a Serve button
 * click), the same way it already calls LevelManager.completeLevel.
 *
 *   OrderGenerator picks 2 RecipeDefinitions (current + next)
 *        ↓
 *   ServiceSession { current, next, recent }   (this module)
 *        ↓ recordAllComponents (on RECIPE_COMPLETED)
 *   RecipeValidator + organizationManager (existing Mise en Place layer)
 *        ↓ current.order.status reaches READY
 *   serveCurrentOrder                           (SERVED -> PAID -> COMPLETED,
 *        ↓                                       exactly once — §18/§45)
 *   advanceServiceSession                       (current -> recent,
 *                                                 next -> current, new next)
 */
import type { CustomerOrder } from "../customers/customerTypes";
import { CUSTOMER_REACTIONS, type CustomerDefinition } from "../customers/customerTypes";
import { randomCustomer } from "../customers/customerDefinitions";
import type { CuisineId } from "../cuisines/cuisineTypes";
import type { IngredientId, TechniqueId } from "../definitions";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import type { OrganizationSession } from "../organization/organizationTypes";
import { createPreparedOutput, assignOutput } from "../organization/organizationManager";
import { INGREDIENTS, TECHNIQUES } from "../definitions";
import { sessionForRecipe, isRecipeReady } from "./RecipeValidator";
import { generateOrder } from "./OrderGenerator";
import { createCustomerOrder, advanceOrder, payOrder } from "./CustomerOrderManager";

export type ServiceOrder = {
  order: CustomerOrder;
  customer: CustomerDefinition;
  recipe: RecipeDefinition;
  session: OrganizationSession;
};

export type ServiceSession = {
  /** Anchors this service session to a campaign entry point (§32's compatibility layer) — informational only, never looked up by this module. */
  levelId: string;
  current: ServiceOrder | null;
  next: ServiceOrder | null;
  /** The most recently COMPLETED order, or null before the first one — §9 "recent order should show a simple completed state". */
  recent: ServiceOrder | null;
  /** Most-recently-served last — fed straight into OrderGenerator (§54). */
  recentRecipeIds: string[];
  recentCuisineIds: (CuisineId | null)[];
  /**
   * Phase 3 — how many orders this session has fully SERVED and PAID so
   * far (incremented once per advanceServiceSession call, i.e. once per
   * genuinely completed order — never per component, never per level).
   * Campaign levels compare this against their own `requiredOrders`
   * (levelTypes.ts) to know when the level itself is done (§35/§36 —
   * level completion is a separate, campaign-progression concept from
   * "an order got served"). The Phase 2 standalone Restaurant Service
   * harness ignores this field entirely — it has no required count.
   */
  completedCount: number;
};

const HISTORY_LOOKBACK = 4;

/** Filters an arbitrary recipe pool (e.g. testRecipePool.ts's TEST_RECIPE_POOL) down to what's genuinely reachable at the player's current campaign progress — the same "never offer a locked recipe" rule recipeDefinitions.ts's own recipesUnlockedByLevel enforces for the derived campaign pool (§22/§23). */
export function poolUnlockedByLevel(
  pool: RecipeDefinition[],
  highestLevel: number,
): RecipeDefinition[] {
  return pool.filter((r) => r.unlockLevel <= highestLevel);
}

function buildServiceOrder(recipe: RecipeDefinition, rand: () => number): ServiceOrder {
  const customer = randomCustomer(rand);
  return {
    order: createCustomerOrder(customer.id, recipe),
    customer,
    recipe,
    session: sessionForRecipe(recipe),
  };
}

function activate(serviceOrder: ServiceOrder): ServiceOrder {
  return { ...serviceOrder, order: advanceOrder(serviceOrder.order) }; // PENDING -> ACTIVE
}

function pickNextRecipe(
  pool: RecipeDefinition[],
  recentRecipeIds: string[],
  recentCuisineIds: (CuisineId | null)[],
  rand: () => number,
): RecipeDefinition | null {
  return generateOrder({ unlockedRecipes: pool, recentRecipeIds, recentCuisineIds }, rand);
}

/** Starts a fresh session with both CURRENT (already active) and NEXT (still pending — §8) filled in, or an empty session if the pool has nothing unlocked yet. */
export function createServiceSession(
  levelId: string,
  pool: RecipeDefinition[],
  rand: () => number = Math.random,
): ServiceSession {
  const firstRecipe = pickNextRecipe(pool, [], [], rand);
  if (!firstRecipe) {
    return {
      levelId,
      current: null,
      next: null,
      recent: null,
      recentRecipeIds: [],
      recentCuisineIds: [],
      completedCount: 0,
    };
  }
  const current = activate(buildServiceOrder(firstRecipe, rand));
  const secondRecipe = pickNextRecipe(pool, [firstRecipe.id], [firstRecipe.cuisineId], rand);
  const next = secondRecipe ? buildServiceOrder(secondRecipe, rand) : null;
  return {
    levelId,
    current,
    next,
    recent: null,
    recentRecipeIds: [firstRecipe.id],
    recentCuisineIds: [firstRecipe.cuisineId],
    completedCount: 0,
  };
}

/** Advances CURRENT's own status one step along the fixed chain the instant it has justification to (§34) — never skips a state, never regresses. */
function syncCurrentStatus(serviceOrder: ServiceOrder): ServiceOrder {
  let order = serviceOrder.order;
  if (order.status === "ACTIVE" && serviceOrder.session.outputs.length > 0) {
    order = advanceOrder(order); // ACTIVE -> PREPARING
  }
  if (order.status === "PREPARING" && isRecipeReady(serviceOrder.session)) {
    order = advanceOrder(order); // PREPARING -> READY
  }
  return { ...serviceOrder, order };
}

/**
 * Called once per RECIPE_COMPLETED (§13/§30 — the cutting engine still
 * only fires one completion event per session; this records every one
 * of the recipe's components as prepared+assigned in a single pass,
 * which is correct because completing every one of `preparationSteps`
 * IS completing every one of the recipe's components). No-op if there
 * is no current order.
 */
export function recordAllComponents(session: ServiceSession): ServiceSession {
  if (!session.current) return session;
  let orgSession = session.current.session;
  for (const component of session.current.recipe.components) {
    const created = createPreparedOutput(orgSession, {
      ingredientId: component.ingredientId,
      preparationState: component.resultingState,
    });
    orgSession = created.session;
    for (const destinationId of component.destinationIds) {
      orgSession = assignOutput(orgSession, created.output.id, destinationId);
    }
  }
  return { ...session, current: syncCurrentStatus({ ...session.current, session: orgSession }) };
}

/**
 * §17/§18/§45 — the Serve action. Returns null (nothing happens — no
 * state change, no payment) unless the current order is genuinely
 * READY; this is what makes duplicate-serve and pay-before-ready
 * structurally impossible rather than merely disallowed by convention.
 * Bundles SERVED -> PAID -> COMPLETED as one transaction (§34 —
 * acceptable when payment is tied directly to serving).
 */
export function serveCurrentOrder(
  session: ServiceSession,
  rand: () => number = Math.random,
): { session: ServiceSession; coinsAwarded: number; reaction: string } | null {
  if (!session.current || session.current.order.status !== "READY") return null;
  const served = advanceOrder(session.current.order); // READY -> SERVED
  const paid = payOrder(served); // SERVED -> PAID (exactly once — CustomerOrderManager's own guard)
  const completedOrder = advanceOrder(paid.order); // PAID -> COMPLETED
  const reaction =
    CUSTOMER_REACTIONS[Math.floor(rand() * CUSTOMER_REACTIONS.length)] ?? CUSTOMER_REACTIONS[0]!;
  return {
    session: { ...session, current: { ...session.current, order: completedOrder } },
    coinsAwarded: paid.coinsAwarded,
    reaction,
  };
}

/**
 * §20 — CURRENT (already COMPLETED by serveCurrentOrder) moves to
 * RECENT, NEXT is activated into CURRENT, and a brand-new NEXT is
 * generated. A no-op (returns the same session) if CURRENT hasn't
 * actually been served yet — guards against calling this out of order.
 */
export function advanceServiceSession(
  session: ServiceSession,
  pool: RecipeDefinition[],
  rand: () => number = Math.random,
): ServiceSession {
  if (!session.current || session.current.order.status !== "COMPLETED") return session;

  const recentRecipeIds = [...session.recentRecipeIds, session.current.recipe.id].slice(
    -HISTORY_LOOKBACK,
  );
  const recentCuisineIds = [...session.recentCuisineIds, session.current.recipe.cuisineId].slice(
    -HISTORY_LOOKBACK,
  );

  const newCurrent = session.next ? activate(session.next) : null;
  const newNextRecipe = pickNextRecipe(pool, recentRecipeIds, recentCuisineIds, rand);
  const newNext = newNextRecipe ? buildServiceOrder(newNextRecipe, rand) : null;

  return {
    ...session,
    current: newCurrent,
    next: newNext,
    recent: session.current,
    recentRecipeIds,
    recentCuisineIds,
    completedCount: session.completedCount + 1,
  };
}

/**
 * §19/§25 — batching detection. Returns the shared {ingredientId,
 * technique} when CURRENT and NEXT both need it, or null. Informational
 * only (drives a UI hint); never changes gameplay state or validation.
 */
export function sharesComponentWithNext(
  session: ServiceSession,
): { ingredientId: IngredientId; technique: TechniqueId } | null {
  if (!session.current || !session.next) return null;
  // A pool with only one unlocked recipe forces `next` to repeat
  // `current` (OrderGenerator has nothing else to offer) — that's the
  // exact same dish, not a genuine second order sharing a component, so
  // it must never read as a batching opportunity (live-testing Level 1
  // found this: a single-recipe level otherwise always "shared" itself
  // with itself).
  if (session.current.recipe.id === session.next.recipe.id) return null;
  for (const a of session.current.recipe.components) {
    for (const b of session.next.recipe.components) {
      if (a.ingredientId === b.ingredientId && a.technique === b.technique) {
        return { ingredientId: a.ingredientId, technique: a.technique };
      }
    }
  }
  return null;
}

/**
 * §16/§17 — the small, readable batching hint (a sentence, never an
 * overlay/score) shown during prep when the CURRENT and NEXT order
 * genuinely share a component. Pure presentation text derived straight
 * from sharesComponentWithNext's own authoritative answer — this
 * function never re-decides "is this batchable", only how to phrase it.
 */
export function batchHintFor(session: ServiceSession): string | null {
  const shared = sharesComponentWithNext(session);
  if (!shared || !session.next) return null;
  const ingredientName = INGREDIENTS[shared.ingredientId].name;
  const techniqueName = TECHNIQUES[shared.technique].name;
  return `Batch tip: ${session.next.customer.name}'s order also needs ${ingredientName} ${techniqueName} — prepare a little extra.`;
}
