/**
 * CURRENCY — Economy V2 Phase 1 (foundation). Integer-safe money helpers
 * (design spec §78: "avoid floating-point accumulation... integer
 * currency units, rounding performed at controlled boundaries").
 *
 * Deliberately does NOT rename/redefine SaveData.credits or introduce a
 * second currency (design spec §4/§53) — `credits` already IS an
 * integer (recipePay.round5's own output), and stays exactly that. This
 * module only centralizes the ROUNDING rule for the new economy
 * calculations (COGS/quality bonus) that Phase 2+ introduces, so every
 * caller rounds the same way instead of each computing `Math.round`
 * (or worse, leaving fractional cents) independently.
 */

/** The one rounding rule every new Economy V2 money calculation should use — plain integer rounding, not recipePay's own round5 (that 5-unit granularity is specifically top-line recipe pay's own convention; COGS/bonus lines are secondary breakdown figures and don't need to share it). */
export function roundCurrency(value: number): number {
  return Math.round(value);
}

/** The hard "cash never goes negative" floor (design spec §5/§8/§39/§54) — apply at the exact point a net economic result is about to be exposed/persisted, never rely on callers remembering to clamp. */
export function clampNonNegative(value: number): number {
  return Math.max(0, value);
}
