/**
 * ENDLESS_SERVICE_MANAGER — pure logic, mirroring DailyOrderManager.ts's
 * own convention. Endless Service is NOT a new content system either: it
 * cycles through the campaign's own SERVICE-type levels (the ones
 * already designed as multi-order/multi-destination climax levels —
 * Levels 91-100 and 117-120), in their normal campaign order, looping
 * back to the start once the player reaches the end. No new recipes, no
 * new techniques, no timer (Law 5 — no countdown/timer failure mode
 * exists or will be added, see levelTypes.ts's own doc), no new
 * grading — every session is an ordinary Preparation run.
 *
 * THE ECONOMY RULE this file exists to enforce: a daily coin CAP.
 * Before the cap, each completion pays that level's own paid reward
 * (levelRewards.ts `paidLevelReward` — the SAME reward curve every
 * campaign level uses, never a new number invented for this mode).
 * Economy V2.5: it unlocks after Level 250 (`isEndlessUnlocked`). Once the
 * running daily total would meet or exceed the cap, coin payouts stop
 * entirely for the rest of that calendar day — never negative, never
 * partial-then-more, just 0. The mode itself never stops: a completion
 * past the cap still updates `recipeProgress` (a real Cookbook
 * "Prepared" stamp), it simply pays no coins. No second currency was
 * invented for this — there is nothing else in production for it to pay
 * out in once coins are capped, and the brief is explicit that inventing
 * one is out of scope.
 */
import { getLevels, isCompleted, isUnlocked } from "../levels/LevelManager";
import type { LevelProgress } from "../levels/LevelManager";
import type { LevelDefinition } from "../levels/levelTypes";
import type { EndlessProgress } from "../SaveManager";
import { dailyKeyFor } from "./DailyOrderManager";
import { dollars } from "../money";

/**
 * The daily cap itself ($600) — roughly one late-campaign chapter's worth
 * of income (Chapter 12's own per-level rewards run $360-$650), enough for a
 * real, satisfying session without becoming an unbounded faucet on top
 * of the already-generous 120-level campaign income (see the phase
 * report's economy audit).
 */
export const ENDLESS_DAILY_COIN_CAP = dollars(600);

/**
 * Economy V2.5 — Endless Service is the post-campaign earning mode: it
 * unlocks once all 250 campaign levels are complete, so it can never be
 * used to fund the campaign itself.
 */
export function isEndlessUnlocked(progress: LevelProgress): boolean {
  return getLevels().every((l) => isCompleted(l.id, progress));
}

/** Every SERVICE-type level, in campaign order — the pool Endless Service draws from once the campaign is complete (empty before; the UI then explains that it unlocks after Level 250). Payouts rise through the rotation, since later service levels pay more. */
export function endlessPool(progress: LevelProgress): LevelDefinition[] {
  if (!isEndlessUnlocked(progress)) return [];
  return getLevels().filter((l) => l.type === "SERVICE" && isUnlocked(l, progress));
}

/** The level at `index` in the pool, wrapping around once the pool is exhausted — "progressively harder" within one pass, then loops rather than dead-ending. */
export function pickEndlessLevel(progress: LevelProgress, index: number): LevelDefinition | null {
  const pool = endlessPool(progress);
  if (pool.length === 0) return null;
  return pool[((index % pool.length) + pool.length) % pool.length]!;
}

/** Coins already earned from Endless Service today (0 if `endless.date` isn't today — a new day always starts back at 0 without needing a write until something is actually earned). */
export function coinsEarnedToday(endless: EndlessProgress, date: Date): number {
  return endless.date === dailyKeyFor(date) ? endless.coinsEarnedToday : 0;
}

export function capRemainingToday(endless: EndlessProgress, date: Date): number {
  return Math.max(0, ENDLESS_DAILY_COIN_CAP - coinsEarnedToday(endless, date));
}

/**
 * How many coins THIS completion actually earns (clamped to whatever
 * headroom remains under today's cap — never negative, never more than
 * the level's own normal reward) and the EndlessProgress to persist
 * alongside it. Pure — the caller (App.tsx) applies both to the save.
 */
export function applyEndlessEarn(
  endless: EndlessProgress,
  levelCoins: number,
  date: Date,
): { earned: number; endless: EndlessProgress } {
  const today = dailyKeyFor(date);
  const already = coinsEarnedToday(endless, date);
  const earned = Math.max(0, Math.min(levelCoins, ENDLESS_DAILY_COIN_CAP - already));
  return { earned, endless: { date: today, coinsEarnedToday: already + earned } };
}
