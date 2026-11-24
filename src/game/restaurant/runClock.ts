/**
 * THE PLATE'S CLOCK (Chef Pride audit remediation, Batch 3, F6, developer 2026-11-23): how long a plate took, for Speed Demon and the fastest-plate record.
 *
 * The rule: the time is the chef's WORKING time. It starts at the first gameplay interaction (the first touch of the board, `CUT_STARTED`), NOT when the screen opens, so reading
 * the order, watching a demonstration, wiping the board, waiting for the customer to sit or simply thinking before the first cut is never counted. From then it runs on real
 * time until the last cut (the plating begins), minus every moment the game was paused. A retry starts a new clock; a plate nobody cut by hand (the Prep Cook's) never starts it,
 * so it reads 0 and is never a "fastest plate".
 *
 * Pure and deterministic: the caller passes `now` (performance.now()); nothing here reads a clock, touches the wallet, the ledger or a save. A bad time (NaN, infinite, going
 * backwards) adds nothing, and one stretch longer than `MAX_STRETCH_MS` is not believed (a device that slept without telling the game): it adds only that much. The result is
 * always a whole number of ms, never negative, never NaN.
 */

export type RunClock = {
  /** The first interaction has happened. */
  started: boolean;
  /** Counting now (started, not paused, not stopped). */
  running: boolean;
  /** When the current counting stretch began (the caller's `now`). */
  since: number;
  /** Working time banked so far, ms. */
  ms: number;
};

/** The longest single stretch believed between two moments the game reported (a timer that was frozen is not working time). */
export const MAX_STRETCH_MS = 10 * 60 * 1000;

export const newClock = (): RunClock => ({ started: false, running: false, since: 0, ms: 0 });

/** A usable moment: a finite, non-negative number (performance.now() is never negative). */
const ok = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

/** The working time between two moments: whole ms, never negative, never invalid, never more than MAX_STRETCH_MS. */
function stretch(from: number, to: number): number {
  if (!ok(from) || !ok(to) || to <= from) return 0;
  return Math.min(MAX_STRETCH_MS, Math.floor(to - from));
}

/** The first interaction: starts the clock. Idempotent (a second touch never restarts it). An invalid `now` starts nothing. */
export function clockStart(c: RunClock, now: number): RunClock {
  if (c.started || !ok(now)) return c;
  return { started: true, running: true, since: now, ms: 0 };
}

/** The game was paused: the time worked so far is banked and the clock stops counting. */
export function clockPause(c: RunClock, now: number): RunClock {
  if (!c.running) return c;
  return { ...c, running: false, ms: c.ms + stretch(c.since, now) };
}

/** The game resumed: counting again from now. Nothing happens if the clock never started or is already counting. */
export function clockResume(c: RunClock, now: number): RunClock {
  if (!c.started || c.running || !ok(now)) return c;
  return { ...c, running: true, since: now };
}

/** The last cut was made: the time is final (the same as a pause: later reads do not grow). */
export const clockStop = clockPause;

/** The working time so far, ms (whole, never negative). */
export function clockMs(c: RunClock, now: number): number {
  const live = c.running ? stretch(c.since, now) : 0;
  const total = c.ms + live;
  return ok(total) && total > 0 ? Math.floor(total) : 0;
}
