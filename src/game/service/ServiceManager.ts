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
import type { Destination, OrganizationSession } from "../organization/organizationTypes";
import {
  createOrganizationSession,
  createPreparedOutput,
  assignOutput,
  isDestinationComplete,
} from "../organization/organizationManager";
import { INGREDIENTS, TECHNIQUES } from "../definitions";
import { sessionForRecipe, destinationsForRecipe, isRecipeReady } from "./RecipeValidator";
import { generateOrder } from "./OrderGenerator";
import {
  createCustomerOrder,
  advanceOrder,
  payOrder,
  recordPreparationScore,
} from "./CustomerOrderManager";

export type ServiceOrder = {
  order: CustomerOrder;
  customer: CustomerDefinition;
  recipe: RecipeDefinition;
  session: OrganizationSession;
};

export type ServiceSession = {
  /** Anchors this service session to a campaign entry point (§32's compatibility layer) — informational only, never looked up by this module. */
  levelId: string;
  /** KnifeCraft_Level_System_v2.docx §3.4's pay-formula input — the chapter every order built by this session is served in. `undefined` for the standalone Phase 2 harness (`levelId: "service"`), which keeps CustomerOrderManager's old static-`basePayment` behavior; a real chapter number for every campaign session (see createServiceSession's own doc). */
  chapter?: number;
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
  /**
   * Economy V2 payout wiring / campaign replay safety — true when this
   * session was started for a campaign level ALREADY in
   * `levelProgress.completedLevelIds` (App.tsx's startCampaignLevel,
   * via LevelManager.isCompleted — the same existing source of truth
   * `completeLevel`'s own `isFirstCompletion` gate already uses, not a
   * second completion system). When true, every served order in this
   * session settles for 0 (App.tsx's serveCampaignOrder), matching Law
   * 2 ("replay does not pay") for the order-pool architecture exactly
   * the way it already holds for plain campaign levels. The player still
   * plays the level normally — only the payout is suppressed. Always
   * `false` for the standalone Phase 2 harness (`levelId: "service"`),
   * which has no campaign-completion concept at all.
   */
  isReplay: boolean;
};

const HISTORY_LOOKBACK = 4;

/** Filters an arbitrary recipe pool (e.g. testRecipePool.ts's TEST_RECIPE_POOL) down to what's genuinely reachable at the player's current campaign progress — the same "never offer a locked recipe" rule recipeDefinitions.ts's own recipesUnlockedByLevel enforces for the derived campaign pool (§22/§23). */
export function poolUnlockedByLevel(
  pool: RecipeDefinition[],
  highestLevel: number,
): RecipeDefinition[] {
  return pool.filter((r) => r.unlockLevel <= highestLevel);
}

function buildServiceOrder(
  recipe: RecipeDefinition,
  chapter: number | undefined,
  rand: () => number,
): ServiceOrder {
  const customer = randomCustomer(rand);
  return {
    order: createCustomerOrder(customer.id, recipe, chapter),
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

/** Starts a fresh session with both CURRENT (already active) and NEXT (still pending — §8) filled in, or an empty session if the pool has nothing unlocked yet. `chapter` — see ServiceSession's own doc; omit only for the standalone Phase 2 harness. `isReplay` — see ServiceSession's own doc; defaults to false (the standalone harness and every existing caller that hasn't been updated to pass it keep paying exactly as before). */
export function createServiceSession(
  levelId: string,
  pool: RecipeDefinition[],
  rand: () => number = Math.random,
  chapter?: number,
  isReplay: boolean = false,
): ServiceSession {
  const firstRecipe = pickNextRecipe(pool, [], [], rand);
  if (!firstRecipe) {
    return {
      levelId,
      ...(chapter !== undefined ? { chapter } : {}),
      current: null,
      next: null,
      recent: null,
      recentRecipeIds: [],
      recentCuisineIds: [],
      completedCount: 0,
      isReplay,
    };
  }
  const current = activate(buildServiceOrder(firstRecipe, chapter, rand));
  const secondRecipe = pickNextRecipe(pool, [firstRecipe.id], [firstRecipe.cuisineId], rand);
  const next = secondRecipe ? buildServiceOrder(secondRecipe, chapter, rand) : null;
  return {
    levelId,
    ...(chapter !== undefined ? { chapter } : {}),
    current,
    next,
    recent: null,
    recentRecipeIds: [firstRecipe.id],
    recentCuisineIds: [firstRecipe.cuisineId],
    completedCount: 0,
    isReplay,
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
 *
 * `score` — Economy V2 payout wiring: stamped onto the current order
 * (CustomerOrderManager.recordPreparationScore) here, the exact same
 * moment App.tsx's recordCampaignServiceResult already receives it for
 * recipeProgress bookkeeping — so it survives to serve time without a
 * second scoring system or a new call site. Optional/defaulted (rather
 * than required) purely so the existing phase1-7 QA scripts' calls
 * (which never assert on payment or score) keep compiling unchanged —
 * every real production caller (App.tsx) always passes the genuine score.
 */
export function recordAllComponents(session: ServiceSession, score: number = 0): ServiceSession {
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
  const updatedCurrent = {
    ...session.current,
    session: orgSession,
    order: recordPreparationScore(session.current.order, score),
  };
  return { ...session, current: syncCurrentStatus(updatedCurrent) };
}

/**
 * §17/§18/§45 — the Serve action. Returns null (nothing happens — no
 * state change, no payment) unless the current order is genuinely
 * READY; this is what makes duplicate-serve and pay-before-ready
 * structurally impossible rather than merely disallowed by convention.
 * Bundles SERVED -> PAID -> COMPLETED as one transaction (§34 —
 * acceptable when payment is tied directly to serving).
 *
 * `amountOverride` — Economy V2 payout wiring: forwarded straight to
 * CustomerOrderManager.payOrder's own override (see its doc) so the
 * caller's already-computed settlement (or 0, on a campaign replay)
 * becomes the actual `coinsAwarded`, without this function needing to
 * know anything about COGS/quality/chapter itself.
 */
export function serveCurrentOrder(
  session: ServiceSession,
  rand: () => number = Math.random,
  amountOverride?: number,
): { session: ServiceSession; coinsAwarded: number; reaction: string } | null {
  if (!session.current || session.current.order.status !== "READY") return null;
  const served = advanceOrder(session.current.order); // READY -> SERVED
  const paid = payOrder(served, amountOverride); // SERVED -> PAID (exactly once — CustomerOrderManager's own guard)
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
  const newNext = newNextRecipe ? buildServiceOrder(newNextRecipe, session.chapter, rand) : null;

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

/* ════════════════════════ Phase 4 — REAL batching ════════════════════════
 *
 * Phase 3's `sharesComponentWithNext`/`batchHintFor` only ever produced a
 * sentence — the player still cut every order's components separately.
 * Brief §3/§4: "a player performs ONE preparation action/output. That
 * output can satisfy MULTIPLE order requirements." — verified by
 * `assignedTo.length` on a SINGLE PreparedOutput, not two independently-
 * synthesized ones (§53's own TEST A literally checks this).
 *
 * BatchGroupSession is an ADDITIVE, separate orchestration structure
 * (not a second organizationManager — every primitive below is
 * createOrganizationSession/createPreparedOutput/assignOutput/
 * isDestinationComplete, the exact same functions ServiceSession already
 * uses) for the SPECIFIC levels that declare a real batch group
 * (levelTypes.ts's `batchGroupRecipeIds`) instead of an ordinary
 * `recipePoolIds` pool. Every other level (the vast majority) keeps using
 * ServiceSession/current/next/recordAllComponents completely unchanged —
 * this is new capacity, not a replacement.
 *
 * The mechanism: 2-3 orders that are meant to batch together are given
 * ONE shared OrganizationSession up front, with each order's own
 * destination ids NAMESPACED by its order id (so two orders both using
 * "plate" as a destination id never collide). When the player cuts one
 * order's `batchable: true` component, the resulting PreparedOutput is
 * assigned to that component's own destination AND to every other group
 * order's matching `batchable` component's destination — literally the
 * same output, `assignedTo` growing to include both/all — never two
 * separately-synthesized copies (brief §6/§9's own distinction).
 */

export type BatchGroupOrder = {
  order: CustomerOrder;
  customer: CustomerDefinition;
  recipe: RecipeDefinition;
};

export type BatchGroupSession = {
  levelId: string;
  /** 2 or 3 simultaneously-active orders, in the order they'll be served. Never all shown at once in the board UI (§18/§41) — see currentBatchOrder/nextBatchOrder below for what the board actually reads. */
  orders: BatchGroupOrder[];
  /** ONE OrganizationSession shared by every order above — destinations are namespaced `${order.id}::${destinationId}` precisely so a shared PreparedOutput's `assignedTo` can legitimately span more than one order. */
  session: OrganizationSession;
  /** KnifeCraft_Level_System_v2.docx §3.4's pay-formula input — mirrors ServiceSession's own `chapter` field, stored here too so Economy V2 settlement (App.tsx's serveBatchGroupViewedOrder) never needs a second level lookup at serve time. Always a real chapter number for a real batch-group level (every one is a campaign level — see createBatchGroupSession's own doc). */
  chapter?: number;
  /** Economy V2 payout wiring / campaign replay safety — mirrors ServiceSession's own `isReplay` field and doc exactly: true when this batch-group level was already in `levelProgress.completedLevelIds` when the session started. */
  isReplay: boolean;
};

function namespacedDestinations(order: BatchGroupOrder): Destination[] {
  return destinationsForRecipe(order.recipe).map((d) => ({
    ...d,
    id: `${order.order.id}::${d.id}`,
  }));
}

/** Builds a fresh batch group from 2-3 recipes (brief §10's "5 meaningful batching scenarios... at least one 3-customer" — this is what a level with `batchGroupRecipeIds` uses instead of createServiceSession). All orders start ACTIVE — a batch group's whole premise is "these customers are already seated together", not a current/next queue. `chapter` — see ServiceSession's own doc; every real batch-group level (always a campaign level) passes its own chapter. `isReplay` — see BatchGroupSession's own doc; defaults to false. */
export function createBatchGroupSession(
  levelId: string,
  recipes: RecipeDefinition[],
  rand: () => number = Math.random,
  chapter?: number,
  isReplay: boolean = false,
): BatchGroupSession {
  const orders: BatchGroupOrder[] = recipes.map((recipe) => {
    const customer = randomCustomer(rand);
    return {
      order: advanceOrder(createCustomerOrder(customer.id, recipe, chapter)),
      customer,
      recipe,
    };
  });
  const destinations = orders.flatMap(namespacedDestinations);
  return {
    levelId,
    orders,
    session: createOrganizationSession(destinations),
    ...(chapter !== undefined ? { chapter } : {}),
    isReplay,
  };
}

/** True once every one of `order`'s OWN (namespaced) destinations is satisfied — checked against the group's shared session, so a shared output counts exactly like a privately-prepared one would. */
function isBatchOrderReady(group: BatchGroupSession, order: BatchGroupOrder): boolean {
  const ownIds = destinationsForRecipe(order.recipe).map((d) => `${order.order.id}::${d.id}`);
  return ownIds.length > 0 && ownIds.every((id) => isDestinationComplete(group.session, id));
}

function syncBatchOrderStatus(group: BatchGroupSession, order: BatchGroupOrder): BatchGroupOrder {
  let next = order.order;
  const hasAnyOutputForOrder = group.session.outputs.some((o) =>
    o.assignedTo.some((a) => a.startsWith(`${order.order.id}::`)),
  );
  if (next.status === "ACTIVE" && hasAnyOutputForOrder) next = advanceOrder(next); // ACTIVE -> PREPARING
  if (next.status === "PREPARING" && isBatchOrderReady(group, order)) next = advanceOrder(next); // -> READY
  return { ...order, order: next };
}

/**
 * Called on RECIPE_COMPLETED for whichever group order the player just
 * cut (`activeOrderId`) — mirrors `recordAllComponents` exactly, plus
 * the real cross-order sharing brief §4 asks for: a `batchable`
 * component's output is ALSO assigned to every other group order's
 * matching `batchable` component (§6 — same ingredient + technique +
 * resultingState required, never assumed compatible just because the
 * ingredient matches).
 *
 * `score` — Economy V2 payout wiring, mirrors recordAllComponents's own
 * doc exactly (including why it's optional/defaulted): stamped only
 * onto the ACTIVE order (the one just cut), never onto its batching
 * partners, which each get their own score stamped when THEY are the
 * active order for their own RECIPE_COMPLETED.
 */
export function recordBatchGroupComponents(
  group: BatchGroupSession,
  activeOrderId: string,
  score: number = 0,
): BatchGroupSession {
  const activeIndex = group.orders.findIndex((o) => o.order.id === activeOrderId);
  if (activeIndex === -1) return group;
  const activeOrder = group.orders[activeIndex]!;
  let session = group.session;
  for (const component of activeOrder.recipe.components) {
    const created = createPreparedOutput(session, {
      ingredientId: component.ingredientId,
      preparationState: component.resultingState,
    });
    session = created.session;
    for (const destinationId of component.destinationIds) {
      session = assignOutput(
        session,
        created.output.id,
        `${activeOrder.order.id}::${destinationId}`,
      );
    }
    if (component.batchable) {
      for (const other of group.orders) {
        if (other.order.id === activeOrder.order.id) continue;
        for (const oc of other.recipe.components) {
          const matches =
            oc.batchable &&
            oc.ingredientId === component.ingredientId &&
            oc.technique === component.technique &&
            oc.resultingState === component.resultingState;
          if (!matches) continue;
          for (const destinationId of oc.destinationIds) {
            session = assignOutput(
              session,
              created.output.id,
              `${other.order.id}::${destinationId}`,
            );
          }
        }
      }
    }
  }
  const groupWithUpdatedSession = { ...group, session };
  const orders = group.orders.map((o, i) =>
    syncBatchOrderStatus(
      groupWithUpdatedSession,
      i === activeIndex ? { ...o, order: recordPreparationScore(o.order, score) } : o,
    ),
  );
  return { ...group, session, orders };
}

/**
 * Mirrors serveCurrentOrder exactly, for one specific order within the
 * group — refuses unless genuinely READY, pays exactly once
 * (CustomerOrderManager's own guard), never touches any other group
 * order's state. `amountOverride` — see serveCurrentOrder's own doc.
 */
export function serveBatchGroupOrder(
  group: BatchGroupSession,
  orderId: string,
  rand: () => number = Math.random,
  amountOverride?: number,
): { group: BatchGroupSession; coinsAwarded: number; reaction: string } | null {
  const index = group.orders.findIndex((o) => o.order.id === orderId);
  if (index === -1 || group.orders[index]!.order.status !== "READY") return null;
  const served = advanceOrder(group.orders[index]!.order); // READY -> SERVED
  const paid = payOrder(served, amountOverride); // SERVED -> PAID
  const completed = advanceOrder(paid.order); // PAID -> COMPLETED
  const reaction =
    CUSTOMER_REACTIONS[Math.floor(rand() * CUSTOMER_REACTIONS.length)] ?? CUSTOMER_REACTIONS[0]!;
  const orders = group.orders.map((o, i) => (i === index ? { ...o, order: completed } : o));
  return { group: { ...group, orders }, coinsAwarded: paid.coinsAwarded, reaction };
}

/**
 * A retry of an unfinished level (levels/paidOrders.ts): the orders already
 * served and paid count as done. A service session starts with them
 * counted; nothing is paid or re-served.
 */
export function withOrdersAlreadyServed(session: ServiceSession, count: number): ServiceSession {
  return { ...session, completedCount: Math.max(session.completedCount, Math.floor(count)) };
}

/** The batch-group form: each customer whose recipe was already paid starts COMPLETED (one per id). */
export function withBatchOrdersAlreadyServed(
  group: BatchGroupSession,
  paidRecipeIds: readonly string[],
): BatchGroupSession {
  const left = [...paidRecipeIds];
  const orders = group.orders.map((o) => {
    const i = left.indexOf(o.recipe.id);
    if (i === -1) return o;
    left.splice(i, 1);
    return { ...o, order: { ...o.order, status: "COMPLETED" as const } };
  });
  return { ...group, orders };
}

/** True once every order in the group has reached COMPLETED — the group-level equivalent of a campaign level's `requiredOrders` being satisfied. */
export function isBatchGroupComplete(group: BatchGroupSession): boolean {
  return group.orders.every((o) => o.order.status === "COMPLETED");
}

/** The board's CURRENT slot for a batch group (§18/§41 — still only current/next/recent are ever shown, never the whole group at once): the first order that isn't COMPLETED yet. */
export function currentBatchOrder(group: BatchGroupSession): BatchGroupOrder | null {
  return group.orders.find((o) => o.order.status !== "COMPLETED") ?? null;
}

/** The board's NEXT slot: the group order after the current one, whatever its status (it may already be READY from batching — §4's whole point). */
export function nextBatchOrder(group: BatchGroupSession): BatchGroupOrder | null {
  const current = currentBatchOrder(group);
  if (!current) return null;
  const index = group.orders.findIndex((o) => o.order.id === current.order.id);
  return group.orders[index + 1] ?? null;
}

/**
 * §8 — "THIS PREP SERVES N ORDERS", the real (not hinted) batching
 * indicator: names every OTHER still-active group order that shares a
 * genuine `batchable` component with the one being viewed right now.
 * Returns null when there's truly nothing to share (never shown
 * without a real opportunity — the same discipline Phase 3's
 * `sharesComponentWithNext` self-match fix established).
 */
export function batchHintForGroup(group: BatchGroupSession, viewedOrderId: string): string | null {
  const viewed = group.orders.find((o) => o.order.id === viewedOrderId);
  if (!viewed) return null;
  const partners = group.orders.filter(
    (other) =>
      other.order.id !== viewedOrderId &&
      other.order.status !== "COMPLETED" &&
      viewed.recipe.components.some(
        (c) =>
          c.batchable &&
          other.recipe.components.some(
            (oc) =>
              oc.batchable &&
              oc.ingredientId === c.ingredientId &&
              oc.technique === c.technique &&
              oc.resultingState === c.resultingState,
          ),
      ),
  );
  if (partners.length === 0) return null;
  const names = partners.map((p) => p.customer.name).join(" and ");
  const orderWord = partners.length > 1 ? "orders" : "order";
  return `This prep also serves ${names}'s ${orderWord} — one preparation, ${partners.length + 1} plates.`;
}
