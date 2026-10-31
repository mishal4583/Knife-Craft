/**
 * PREP COOK AT THE BOARD (developer 2026-10-30): a hired Prep Cook can do an order's cutting
 * for the player, and "Auto" lets the whole service run on its own.
 *
 * Rules (all here, nothing else decides them):
 *  - Only a hired Prep Cook cuts; hiring and its wage are the existing staff rules
 *    (`staffRequirements.ts`, `businessStaff.ts`), so the player chooses to hire when the
 *    chopping starts to be too much.
 *  - From `PREP_COOK_CUTS_FROM`: by then the player has met every cut, and chopping the same
 *    dishes again is the chore a helper is for. Before it the board is the player's.
 *  - The Prep Cook cuts the WHOLE order (every step, every shared plate) in one go.
 *  - The result is always the same plain "Honest" plate (`PREP_COOK_SCORE`): it pays the
 *    neutral settlement, earns the small Honest tip and no better. Cutting by hand can still
 *    reach Clean or Masterful, so the player's own skill stays worth more.
 *  - No coaching/teaching runs are handed over: the first play of a level that teaches a
 *    technique is always the player's.
 *  - Auto only repeats what the player does by hand (cut, Serve, Next Customer); it never buys
 *    stock, never collects the cash on the tables (that piles up for the player, developer
 *    2026-10-31) and stops at the Pre-Service Check, so it can't spend money.
 *
 * Pure; no Math.random, no wallet, no ledger.
 */
import type { QualityLabel } from "@/types/game";
import type { BusinessStaffRole } from "../business/businessStaff";

/**
 * The first level a Prep Cook can be hired and may cut (developer 2026-10-30: "after certain levels";
 * moved from 20 to 30 on 2026-10-31: "unlock prepcook only after level 30").
 */
export const PREP_COOK_CUTS_FROM = 30;

/** The score every Prep Cook plate gets (`CutEvaluator`: 70+ is Honest). */
export const PREP_COOK_SCORE = 75;
export const PREP_COOK_GRADE: QualityLabel = "Honest";

/** How long the Prep Cook "cuts" on screen (ms), before the plate is ready. */
export const PREP_COOK_MS = 1600;
/** The beats Auto waits between its own taps (ms): long enough to see each moment. */
export const AUTO_SERVE_MS = 900;
/** How long a paid card stays up before Auto moves on (the pay and tip are readable). */
export const AUTO_COLLECT_MS = 2600;
export const AUTO_NEXT_MS = 700;

/**
 * Who prepared an order. Hand-cut and Prep Cook orders are ONE order state: the same READY result
 * (`onComplete(score, portions)`), the same serve, pay, tip and ledger. The only difference is the
 * score the cutting produced; this tag just says whose hands made it (shown on the served card).
 */
export type PreparedBy = "player" | "prep-cook";

export type PrepCookContext = {
  hiredRoles: readonly BusinessStaffRole[];
  /** The campaign level being served. */
  level: number;
  /** The first play of a level that teaches a technique: always by hand. */
  teaching: boolean;
};

/** True when the Prep Cook may cut this order for the player. */
export function prepCookCanCut(ctx: PrepCookContext): boolean {
  return ctx.hiredRoles.includes("prep-cook") && ctx.level >= PREP_COOK_CUTS_FROM && !ctx.teaching;
}
