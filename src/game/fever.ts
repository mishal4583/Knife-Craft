import { COMBO } from "./definitions";

/**
 * FEVER — Phase 3 (A, developer 2026-10-21): a short burst of heightened
 * cutting feel, earned by a long clean run.
 *
 * The rule — the existing combo, no second counter:
 * - it lights when the scene's own combo (cuts landed on the current step,
 *   COMBO in definitions.ts) reaches AT_COMBO, the existing x10 milestone.
 *   Over the real campaign (243 orders, 716 cut steps) a step long enough to
 *   reach x10 exists in 95% of orders and x15 in none, so x10 is earned by
 *   keeping a run going through a long step, not handed out (x5 would light
 *   at the start of every order);
 * - once per order: a second x10 later in the same order does not relight
 *   it, and nothing extends it while it is on (no stacking timers);
 * - it lasts MS on the SCENE clock, which stops while the game is paused
 *   (PauseManager pauses the scene), and ends early when plating starts or
 *   the order restarts; each order is a fresh scene, so it can never leak
 *   into the next one.
 *
 * Presentation only: a knife glow and trail, stronger flecks, more board
 * give and piece parting, a slightly brighter cut sound, a warm vignette and
 * a countdown bar. Cut detection, perfect cuts, the combo, the grade and
 * every payout are exactly as without it.
 */
export const FEVER = {
  AT_COMBO: 10,
  MS: 6000,
  /** Board give along the blade while it lasts (× CUT_DRAG). */
  DRAG_MULT: 1.6,
  /** Piece parting while it lasts (× PIECE_SETTLE's offset). */
  SETTLE_MULT: 1.4,
  /** Cut sound pitch while it lasts (× the usual). */
  PITCH_MULT: 1.04,
  /** Extra gold flecks per cut. */
  FLECKS: 3,
  /** The knife trail: this many recent points, each fading over TRAIL_MS. */
  TRAIL_POINTS: 10,
  TRAIL_MS: 220,
} as const;

/** True when this combo lights Fever: the x10 milestone, once per order, never while it is already on. */
export function feverLights(combo: number, usedThisOrder: boolean, active: boolean): boolean {
  return !usedThisOrder && !active && combo >= FEVER.AT_COMBO;
}

/** Fever must sit on one of the existing combo milestones (checked by phase3-qa). */
export const FEVER_ON_A_MILESTONE = COMBO.MILESTONES.includes(FEVER.AT_COMBO);
