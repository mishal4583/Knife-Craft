/**
 * PAUSABLE_COUNTDOWN — a one-shot timer that stops while the game is
 * paused (PauseManager) and carries on with whatever time was left.
 *
 * Story beats and milestone banners auto-advance on a timer. A plain
 * setTimeout keeps running through a platform pause (an ad, a tab switch
 * the platform reports), so the player came back to a beat they never
 * saw. This keeps the remaining time instead.
 *
 * Pure apart from the clock, which is injectable for tests.
 */
export type CountdownClock = {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

const realClock: CountdownClock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export class PausableCountdown {
  private remaining: number;
  private startedAt = 0;
  private handle: unknown = null;
  private done = false;

  constructor(
    ms: number,
    private readonly onFire: () => void,
    private readonly clock: CountdownClock = realClock,
  ) {
    this.remaining = Math.max(0, ms);
  }

  /** Starts, or continues after a pause. No-op while running or once fired/cancelled. */
  resume(): void {
    if (this.done || this.handle !== null) return;
    this.startedAt = this.clock.now();
    this.handle = this.clock.setTimeout(() => {
      this.handle = null;
      this.done = true;
      this.onFire();
    }, this.remaining);
  }

  /** Stops the clock and keeps the time that was left. */
  pause(): void {
    if (this.done || this.handle === null) return;
    this.clock.clearTimeout(this.handle);
    this.handle = null;
    this.remaining = Math.max(0, this.remaining - (this.clock.now() - this.startedAt));
  }

  /** Stops for good; it never fires. */
  cancel(): void {
    this.pause();
    this.done = true;
  }

  /** Time left (ms) as of now. */
  remainingMs(): number {
    if (this.handle === null) return this.remaining;
    return Math.max(0, this.remaining - (this.clock.now() - this.startedAt));
  }

  isRunning(): boolean {
    return this.handle !== null;
  }
}
