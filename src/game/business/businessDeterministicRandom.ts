/**
 * BUSINESS_DETERMINISTIC_RANDOM — Economy V3 Phase 14, Checkpoint 3.
 * CLAUDE.md's own determinism rule (§13): "If a random-like event is
 * genuinely required, use an explicit deterministic/seeded mechanism
 * and document it." Order generation (ServiceManager.createServiceSession
 * -> OrderGenerator.generateOrder, and the customer/reaction pickers
 * inside it) is written to accept an INJECTABLE `rand: () => number`
 * (defaulting to `Math.random`) — Business Mode reuses those EXACT
 * functions unmodified, just supplying a seeded generator here instead
 * of `Math.random`, exactly the "seed/replace/abstract the existing
 * system" path the phase brief asks for, never a second order engine.
 *
 * A standard mulberry32 PRNG — small, fast, well-known, and fully
 * deterministic: the same seed always produces the same sequence. Used
 * for the WHOLE Business service session (recipe selection, customer
 * selection, serve-reaction line) rather than seeding some calls and
 * leaving others on `Math.random` — recipe selection is the one piece
 * that actually determines an economic outcome (which dish, hence
 * which price, gets ordered), but making the purely cosmetic parts
 * (customer identity, reaction flavor text) ALSO deterministic is a
 * harmless, simpler, more testable choice, never a second inconsistent
 * randomness policy.
 */
export function makeSeededRand(seed: number): () => number {
  let state = seed >>> 0;
  return function seededRand(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The one seed Business Mode ever uses: the current business day — a fresh session (created whenever none exists yet, or right after End Business Day resets it) reseeds from the day it started on, so "same day, same sequence of actions" always reproduces the same orders. */
export function businessServiceSeedFor(businessDay: number): number {
  return businessDay;
}
