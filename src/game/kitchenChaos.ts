import { forceNextVariant, type VariantId } from "./specialVariants";
import { forceNextPersonality, type PersonalityId } from "./customers/personalities";

/**
 * KITCHEN_CHAOS — Phase 3 (C, developer 2026-10-21): the Kitchen Chaos
 * Director. Now and then an order comes with a twist — a giant
 * ingredient, a vegetable avalanche, a rush hour, Grandma's challenge, a
 * plating judge or a friendly inspection. Presentation and play only:
 * no event changes a score, a payout, a ledger entry, stock or progress,
 * and none is saved (the brief's "no new save fields").
 *
 * WHEN (all from CHAOS below, counted in this browser session only):
 * - Only ELIGIBLE orders count: never while the order teaches a technique
 *   (the coach's ghost, coaching.ts), never a campaign level at or below
 *   CHAOS.MIN_LEVEL (the gentle opening), and the order is decided once,
 *   when its board is set (a restart keeps it).
 * - The FIRST_AT-th eligible order is the first with an event, then every
 *   EVERY-th after it. A due event waits for the next order when the board
 *   is about to be scraped (the scraper and an event never share a start).
 * - WHICH: a fixed rotation (ORDER). An event that can't happen on this
 *   order (Grandma's ×8 needs a step with at least 8 cuts; the inspection
 *   needs a restaurant; Giant needs a cutting first step) is passed over for
 *   the next one in the rotation, so the same seed of play always gives the
 *   same events — deterministic, testable, never random.
 */
export type ChaosEventId =
  "giant" | "avalanche" | "rush-hour" | "grandma" | "perfect-plating" | "inspection";

export const CHAOS = {
  FIRST_AT: 4,
  EVERY: 4,
  /** Campaign levels up to and including this one never get an event. */
  MIN_LEVEL: 10,
  ORDER: [
    "giant",
    "avalanche",
    "rush-hour",
    "grandma",
    "perfect-plating",
    "inspection",
  ] as const satisfies readonly ChaosEventId[],
  /** Giant Ingredient: the first ingredient is drawn this much bigger — clamped so it always fits the board. */
  GIANT_SCALE: 1.35,
  /** The largest share of the board's half-width / half-height a scaled ingredient may take. */
  MAX_BOARD_FRAC: 0.86,
  /** Vegetable Avalanche: how many little vegetables tumble onto the board before the order. */
  AVALANCHE_COUNT: 8,
  /** Rush Hour: the pass is busy — plating, the hand-off and the cooking film run this much faster. */
  RUSH_PACE: 1.6,
  RUSH_CLIP_RATE: 1.5,
  /** Grandma's Challenge: reach Clean ×this on one ingredient. */
  GRANDMA_COMBO: 8,
  /** Perfect Plating: the plating judge's stamp needs this Evenness on the Knife Report. */
  PERFECT_PLATING_EVENNESS: 90,
} as const;

export type ChaosContext = {
  /** Not an early campaign level (App) and no technique being taught (the scene). */
  eligible: boolean;
  /** The board is due a scrape at this start (boardDebris.ts). */
  cleanupDue: boolean;
  /** A restaurant save exists to inspect. */
  restaurant: boolean;
  /** The most cuts any one step of this order asks for. */
  longestStepCuts: number;
  /** The first step is a cut (not a peel, smash or rings) — Giant's condition. */
  giantOk: boolean;
};

export function chaosEventFits(id: ChaosEventId, ctx: ChaosContext): boolean {
  switch (id) {
    case "giant":
      return ctx.giantOk;
    case "grandma":
      return ctx.longestStepCuts >= CHAOS.GRANDMA_COMBO;
    case "inspection":
      return ctx.restaurant;
    default:
      return true;
  }
}

let state = { eligibleOrders: 0, pending: false, rotation: 0 };
let forced: ChaosEventId | null = null;

/** Whether the n-th eligible order (1-based) is an event slot. */
export function isChaosSlot(n: number): boolean {
  return n >= CHAOS.FIRST_AT && (n - CHAOS.FIRST_AT) % CHAOS.EVERY === 0;
}

/** Decides this order's event (or none) and advances the session's counter. Call once per order. */
export function chaosForOrder(ctx: ChaosContext): ChaosEventId | null {
  if (!ctx.eligible) return null;
  if (forced) {
    // Development hook only (see the end of this file): the next eligible
    // order gets this event, if it can; the session's counters stay as they are.
    const id = forced;
    forced = null;
    return chaosEventFits(id, ctx) ? id : null;
  }
  state.eligibleOrders += 1;
  if (isChaosSlot(state.eligibleOrders)) state.pending = true;
  if (!state.pending || ctx.cleanupDue) return null;
  const n = CHAOS.ORDER.length;
  for (let i = 0; i < n; i++) {
    const id = CHAOS.ORDER[(state.rotation + i) % n]!;
    if (chaosEventFits(id, ctx)) {
      state.rotation = (state.rotation + i + 1) % n;
      state.pending = false;
      return id;
    }
  }
  return null;
}

/** Test hook: a fresh session. */
export function resetChaosForTests(): void {
  state = { eligibleOrders: 0, pending: false, rotation: 0 };
  forced = null;
}

/** Makes the next eligible order get `id` (null clears it). For the browser tests' development hook. */
export function forceNextChaos(id: ChaosEventId | null): void {
  forced = id;
}

// Development builds only — `window.__kcSpecials` lets the browser tests
// (tools/e2e/phase3.mjs, run against `npm run dev`) put a given event or
// variant on the next order instead of playing four orders to reach one.
// Production builds inline DEV as false, so it never exists there.
if (typeof import.meta.env !== "undefined" && import.meta.env.DEV && typeof window !== "undefined")
  (window as unknown as { __kcSpecials: unknown }).__kcSpecials = {
    chaos: (id: ChaosEventId | null) => forceNextChaos(id),
    variant: (id: VariantId | null) => forceNextVariant(id),
    // Phase 4: the next eligible service order's special customer.
    customer: (id: PersonalityId | null) => forceNextPersonality(id),
  };

/** The player-facing card for each event: its title and the one line under it. */
export const CHAOS_COPY: Record<ChaosEventId, { icon: string; title: string; line: string }> = {
  giant: {
    icon: "🍅",
    title: "Giant Ingredient!",
    line: "A whopper came in — same cuts, bigger target.",
  },
  avalanche: {
    icon: "🥕",
    title: "Vegetable Avalanche!",
    line: "The crate tipped over — swipe them off the board.",
  },
  "rush-hour": { icon: "⏱️", title: "Rush Hour!", line: "The pass is busy — plates go out fast." },
  grandma: {
    icon: "👵",
    title: "Grandma's Challenge",
    line: `Reach Clean ×${CHAOS.GRANDMA_COMBO} on one ingredient.`,
  },
  "perfect-plating": {
    icon: "🍽️",
    title: "Perfect Plating",
    line: `The plating judge wants Evenness ${CHAOS.PERFECT_PLATING_EVENNESS}+.`,
  },
  inspection: {
    icon: "📋",
    title: "Kitchen Inspection",
    line: "A friendly inspector is watching — no fines today.",
  },
};
