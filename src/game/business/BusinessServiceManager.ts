/**
 * BUSINESS_SERVICE_MANAGER — Economy V3 Phase 14, Checkpoint 3. The
 * Business Mode revenue/order-fulfillment pipeline — a THIN adapter over
 * the EXISTING `ServiceManager.ts` session machine (createServiceSession/
 * recordAllComponents/serveCurrentOrder/advanceServiceSession), never a
 * second order engine, never a second cooking/quality engine. Every real
 * gameplay mechanic (recipe components, cutting, organization, quality
 * scoring, the READY/SERVED/PAID/COMPLETED order state chain and its
 * "pays exactly once" guard) is the SAME code Restaurant Service and
 * campaign-service already use — this file only supplies Business
 * Mode's OWN pool (the curated dish catalog, via businessServiceCatalog.ts),
 * a deterministic seeded `rand` (never `Math.random`, per CLAUDE.md §13),
 * and the ONE genuinely new piece of logic Business Mode needs that
 * neither Campaign nor plain Restaurant Service has: a real Business
 * Inventory check/consumption gate around the payment itself.
 *
 * THE FLOW (matches the phase brief's own exact sequence):
 *   1. `createBusinessServiceSession` / `advanceBusinessServiceSession` —
 *      generate an order (a real Business Dish, via the pool above).
 *   2. `businessOrderIsAvailable` — the ACCEPT-time gate: can Business
 *      Inventory currently satisfy this dish's real requirements in
 *      usable (non-expired) quantity? Checked BEFORE the player is ever
 *      let into Preparation for this order — an unavailable order is
 *      never started, so inventory is never touched "merely because an
 *      order was generated."
 *   3. Existing Preparation gameplay runs (App.tsx/Preparation.tsx,
 *      completely unmodified in its own mechanics) — this file plays no
 *      part in it at all.
 *   4. `recordAllComponents` (existing, reused directly, no wrapper
 *      needed — it's already generic over any ServiceSession).
 *   5. `serveBusinessOrder` — the ONE atomic transaction: re-verifies
 *      availability, consumes inventory (`consumeUsableIngredients`,
 *      existing, atomic, rejects and changes nothing on failure), reads
 *      the Business Dish's CURRENT menu price (`businessDishPrice`,
 *      never Campaign `recipePay`, never Restaurant Service's own flat
 *      `basePayment`), applies the popularity willingness-to-pay
 *      multiplier (`businessCustomerPayment`), and calls the EXISTING
 *      `serveCurrentOrder` with that customer payment as its
 *      `amountOverride` — reusing `payOrder`'s own
 *      "pays exactly once, only on the genuine SERVED->PAID transition"
 *      guard for duplicate-payment safety, never a second guard.
 *      Popularity (Economy V3 Phase 16, model D2): a serve no longer
 *      moves popularity itself — it counts toward today's `ordersServed`,
 *      and End Business Day applies ONE bounded daily service score
 *      (orderCompletedDelta +3 for a day with service, orderFailedDelta
 *      -3 without) plus a pull toward 50. See PopularityManager.ts.
 *
 * QUALITY-TO-PAYMENT (documented gap, per the phase brief's own
 * explicit instruction to report rather than invent): the existing
 * Restaurant Service harness (App.tsx's `serveActiveServiceOrder`) ALSO
 * pays a fixed amount regardless of the player's preparation score —
 * `CustomerOrderManager.payOrder`'s own `amountOverride` is the ONLY
 * lever, and nothing in the current Business Mode master spec defines a
 * quality-to-price formula. This file mirrors that exact, already-
 * established behavior: `serveBusinessOrder`'s payment is never adjusted
 * by `result.score`/`qualityLabel`. Not an oversight — an honest gap,
 * reported in the Checkpoint 3 report, not silently invented here.
 *
 * WILLINGNESS-TO-PAY (wired, Economy V3 Phase 16): the customer pays the
 * menu price × DemandManager's existing `willingnessToPayMultiplierFor`
 * at the current popularity — see `businessCustomerPayment` below.
 *
 * ORDER FREQUENCY (wired, Economy V3 Phase 16): popularity sets how many
 * customers arrive per Business Day — `BASE_CUSTOMERS_PER_DAY` ×
 * DemandManager's existing `orderFrequencyMultiplierFor`; see
 * `businessCustomersToday` below.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import type { ServiceSession } from "../service/ServiceManager";
import {
  createServiceSession,
  recordAllComponents,
  serveCurrentOrder,
  advanceServiceSession,
} from "../service/ServiceManager";
import { hasUsableIngredients, consumeUsableIngredients, usableQuantity } from "./perishability";
import { realCogsFor, recordRevenueAndCogs } from "./BusinessFinanceManager";
import {
  businessServicePool,
  businessDishForRecipeId,
  businessDishRequirements,
} from "./businessServiceCatalog";
import { businessDishPrice } from "./businessDishCatalog";
import { orderFrequencyMultiplierFor, willingnessToPayMultiplierFor } from "./DemandManager";
import { clampScore, DEFAULT_POPULARITY_STATE } from "./businessPopularity";
import type { BusinessDish } from "./businessDishCatalog";
import {
  activeBusinessDishes,
  DEFAULT_MENU_ACTIVATION_STATE,
  type BusinessMenuActivationState,
} from "./businessMenuActivation";

const BUSINESS_SERVICE_LEVEL_ID = "business-service";

/** A fresh Business Mode session — the pool is the player's ACTIVE menu (Economy V3 Phase 16; the whole 35-dish catalog when `menuActivation` is omitted or every dish is on), never level-gated. `rand` must be a deterministic, session-scoped generator (see businessDeterministicRandom.ts) — never `Math.random` directly. */
export function createBusinessServiceSession(
  rand: () => number,
  menuActivation: BusinessMenuActivationState = DEFAULT_MENU_ACTIVATION_STATE,
): ServiceSession {
  return createServiceSession(
    BUSINESS_SERVICE_LEVEL_ID,
    businessServicePool(activeBusinessDishes(menuActivation)),
    rand,
  );
}

/** Advances current->recent, next->current, generates a new next — identical to Restaurant Service's own queue advance, against the CURRENT active menu. */
export function advanceBusinessServiceSession(
  session: ServiceSession,
  rand: () => number,
  menuActivation: BusinessMenuActivationState = DEFAULT_MENU_ACTIVATION_STATE,
): ServiceSession {
  return advanceServiceSession(
    session,
    businessServicePool(activeBusinessDishes(menuActivation)),
    rand,
  );
}

/** Records this run's cut components into the session's own organization/quality state — the EXISTING function, unwrapped, since it's already generic over any ServiceSession. Exported here only so callers never need to import ServiceManager.ts directly for Business Mode's own flow. */
export { recordAllComponents as recordBusinessServiceComponents };

export type BusinessOrderAvailability =
  { available: true } | { available: false; missing: IngredientId[] };

/**
 * The ACCEPT-time gate — "before an order can be accepted/started,
 * verify that Business Inventory contains the required ingredients in
 * usable, non-expired quantities." Read-only; never mutates inventory.
 */
export function businessOrderAvailability(
  save: SaveData,
  dish: BusinessDish,
): BusinessOrderAvailability {
  const requirements = businessDishRequirements(dish);
  const ok = hasUsableIngredients(
    save.business.inventory,
    requirements,
    save.business.calendar.businessDay,
  );
  if (ok) return { available: true };
  // Operations checkpoint fix: report only the ingredients that are
  // genuinely short (usable stock below the dish's pre-summed need) —
  // previously every ingredient in the dish was listed, including ones
  // already in stock. The available/unavailable verdict is unchanged.
  const day = save.business.calendar.businessDay;
  const needed = new Map<IngredientId, number>();
  for (const r of requirements) {
    needed.set(r.ingredientId, (needed.get(r.ingredientId) ?? 0) + r.quantity);
  }
  const missing = [...needed]
    .filter(([id, qty]) => usableQuantity(save.business.inventory, id, day) < qty)
    .map(([id]) => id);
  return { available: false, missing };
}

/**
 * Economy V3 Phase 16 (P2 correctness fix) — where "Next Customer" takes
 * the player: straight back into Preparation ONLY if the new current
 * order passes the same accept-time ingredient gate as "Start Preparing"
 * (`businessOrderAvailability`); otherwise to the Service screen, which
 * shows what's missing. One rule for every way an order can become the
 * current one.
 */
export function nextCustomerDestination(
  save: SaveData,
  session: ServiceSession,
): "preparation" | "service" {
  const dish = session.current ? businessDishForRecipeId(session.current.recipe.id) : undefined;
  return dish && businessOrderAvailability(save, dish).available ? "preparation" : "service";
}

/**
 * Economy V3 Phase 16 — willingness-to-pay (WTP). What the customer
 * actually pays for a Business Dish:
 *
 *   customerPays = roundToCents(menuPrice × willingnessToPayMultiplierFor(popularity))
 *
 * `menuPrice` is the restaurant's own price (`businessDishPrice`, never
 * changed by this); the multiplier is DemandManager's existing function,
 * never re-derived here. Business Mode only — the shared ServiceManager /
 * CustomerOrderManager payment path just receives the finished amount as
 * `serveCurrentOrder`'s existing `amountOverride`, exactly as before.
 *
 * Popularity is made safe at the point of use (`popularityForPayment`), so
 * a corrupted or out-of-range saved score can never produce an invalid
 * payment. Under popularity model D2 the score only moves at End Business
 * Day, so every order in a day pays the same multiplier.
 *
 * Rounding happens exactly once, to whole cents (half-up). The existing
 * multiplier already comes in hundredths (0.90 … 1.20), so it is read as an
 * exact integer number of hundredths first — plain `price × 1.15` in
 * floating point can land on x.4999… and round the wrong way.
 */
export type BusinessCustomerPayment = {
  menuPrice: number;
  popularity: number;
  multiplier: number;
  customerPays: number;
};

/**
 * The popularity score WTP reads: clamped to 0-100 (`clampScore`, the one
 * clamp); a non-numeric or NaN score falls back to the default starting
 * popularity — the same value a save with no popularity loads as.
 */
export function popularityForPayment(score: unknown): number {
  if (typeof score !== "number" || Number.isNaN(score)) return DEFAULT_POPULARITY_STATE.score;
  return clampScore(score);
}

export function businessCustomerPayment(
  save: SaveData,
  dish: BusinessDish,
): BusinessCustomerPayment {
  const menuPrice = businessDishPrice(save.business.menu, dish);
  const popularity = popularityForPayment(save.business.popularity?.score);
  const multiplier = willingnessToPayMultiplierFor(popularity);
  const hundredths = Math.round(multiplier * 100);
  return {
    menuPrice,
    popularity,
    multiplier,
    customerPays: Math.round((menuPrice * hundredths) / 100),
  };
}

/**
 * Economy V3 Phase 16 — order frequency. How many customers a Business Day
 * brings: the existing `orderFrequencyMultiplierFor` (0.50 at popularity 0
 * … 1.00 at 50 … 1.50 at 100) applied to `BASE_CUSTOMERS_PER_DAY`, rounded
 * to whole customers — 4 / 6 / 8 / 10 / 12 at popularity 0 / 25 / 50 / 75 /
 * 100. Business Mode only; Campaign and Restaurant Service never read it.
 *
 * Start-of-day popularity: under popularity model D2 the score is written
 * only by End Business Day (`BusinessDayManager.endBusinessDay`), so the
 * score read at any moment of a day IS that day's starting score, and the
 * target cannot move mid-day; a new score (and so a new target) takes
 * effect from the next day. Derived, never stored, so there is no second
 * copy to drift or migrate. Popularity is read through the same safe reader
 * WTP uses (`popularityForPayment`: clamped 0-100, NaN/non-number -> 50).
 *
 * The count is today's `ordersServed` (D2's daily counter): a customer is
 * "used" when served. Once `served >= target` the counter closes —
 * `businessServiceSessionForToday` returns no session and
 * `serveBusinessOrder` refuses — so no order can be prepared, paid for, or
 * consume stock beyond the day's customers.
 */
export const BASE_CUSTOMERS_PER_DAY = 8;

export type BusinessCustomersToday = {
  popularity: number;
  multiplier: number;
  target: number;
  served: number;
  remaining: number;
  complete: boolean;
};

export function businessCustomersToday(save: SaveData): BusinessCustomersToday {
  const popularity = popularityForPayment(save.business.popularity?.score);
  const multiplier = orderFrequencyMultiplierFor(popularity);
  const hundredths = Math.round(multiplier * 100);
  const target = Math.round((BASE_CUSTOMERS_PER_DAY * hundredths) / 100);
  const rawServed = save.business.finance.dailyAccumulator.ordersServed;
  const served = typeof rawServed === "number" && Number.isFinite(rawServed) ? rawServed : 0;
  return {
    popularity,
    multiplier,
    target,
    served,
    remaining: Math.max(0, target - served),
    complete: served >= target,
  };
}

/**
 * The Business counter's queue for today, or `null` once today's customers
 * are complete (never a placeholder order that could be cooked or served).
 * Deterministic: the day's seeded `rand` + the active menu. After a reload
 * mid-day (the queue itself lives only in memory) the positions already
 * served are skipped, so the player resumes at customer `served + 1` rather
 * than meeting the day's first customers again. Skipped positions are
 * never prepared, paid, or given stock — they only advance the queue.
 */
export function businessServiceSessionForToday(
  save: SaveData,
  rand: () => number,
): ServiceSession | null {
  const today = businessCustomersToday(save);
  if (today.complete) return null;
  let session = createBusinessServiceSession(rand, save.business.menuActivation);
  for (let i = 0; i < today.served && session.current; i++) {
    session = advanceBusinessServiceSession(
      {
        ...session,
        current: { ...session.current, order: { ...session.current.order, status: "COMPLETED" } },
      },
      rand,
      save.business.menuActivation,
    );
  }
  return session;
}

export type ServeBusinessOrderResult = {
  session: ServiceSession;
  save: SaveData;
  dish: BusinessDish;
  /** What the customer paid — `payment.customerPays`, the one amount credited, recorded as revenue and written to the ledger. */
  amountCharged: number;
  /** The menu price / popularity / multiplier behind `amountCharged` (WTP). */
  payment: BusinessCustomerPayment;
  reaction: string;
  /** Always 0 since popularity model D2 (Economy V3 Phase 16): a serve counts toward today's ordersServed; popularity moves once, at End Business Day. */
  popularityDelta: number;
  /** Economy V3 Phase 15 — the real ingredient cost this serve recognized (already folded into `save.business.finance`); exposed here so a caller (or QA) never needs to re-derive it from the save diff. */
  cogsCharged: number;
};

/**
 * The one atomic Business Mode transaction: inventory consumption,
 * revenue/COGS, and today's served-order count all happen together in ONE
 * returned save, or nothing happens at all. Returns `null` (mirroring
 * `serveCurrentOrder`'s OWN "not ready" convention exactly) whenever:
 * the current order isn't genuinely READY, its dish can't be resolved,
 * or Business Inventory can no longer satisfy it (re-checked here, not
 * just trusted from accept-time) — never a partial charge, never
 * partial inventory consumption, never a payment without a matching
 * ledger entry (the caller appends that ledger entry from this
 * function's own `amountCharged`, exactly mirroring how App.tsx's
 * existing `serveActiveServiceOrder` records "service-revenue" itself
 * rather than this layer touching `economyLedger` directly).
 */
export function serveBusinessOrder(
  session: ServiceSession,
  save: SaveData,
  rand: () => number,
): ServeBusinessOrderResult | null {
  if (!session.current || session.current.order.status !== "READY") return null;
  // Order frequency: no serve beyond today's customers (defense in depth — the counter already closes).
  if (businessCustomersToday(save).complete) return null;
  const dish = businessDishForRecipeId(session.current.recipe.id);
  if (!dish) return null;
  const requirements = businessDishRequirements(dish);
  const businessDay = save.business.calendar.businessDay;
  // Real COGS is read from the PRE-consumption inventory's own actual
  // weighted-average paid unitCost (Economy V3 Phase 15 — see
  // BusinessFinanceManager.ts's own doc for why this, never
  // recipeCostBasis, is the authoritative "what did this actually
  // cost" number) — computed before consumeUsableIngredients removes
  // the very stock it needs to read.
  const cogs = realCogsFor(save.business.inventory, requirements);
  const consumed = consumeUsableIngredients(save.business.inventory, requirements, businessDay);
  if (!consumed.ok) return null;
  const payment = businessCustomerPayment(save, dish);
  const served = serveCurrentOrder(session, rand, payment.customerPays);
  if (!served) return null;
  // Economy V3 Phase 16 (popularity model D2): a serve no longer changes
  // popularity directly — recordRevenueAndCogs counts it toward today's
  // `ordersServed`, and End Business Day turns that into ONE bounded daily
  // service score (+3 for a day with service, -3 without).
  const popularityDelta = 0;
  const nextSave = recordRevenueAndCogs(
    {
      ...save,
      credits: save.credits + served.coinsAwarded,
      business: { ...save.business, inventory: consumed.inventory },
    },
    served.coinsAwarded,
    cogs,
  );
  return {
    session: served.session,
    save: nextSave,
    dish,
    amountCharged: served.coinsAwarded,
    payment,
    reaction: served.reaction,
    popularityDelta,
    cogsCharged: cogs,
  };
}
