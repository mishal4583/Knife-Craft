/**
 * PAUSE_MANAGER — the single source of truth for "is the game paused".
 *
 * Both the in-game Pause button and the Bridge's PAUSE_STATE_CHANGED
 * call the same `pause()` / `resume()` here. Nothing downstream (the
 * Phaser scene, AudioManager) can tell which one triggered it, and
 * nothing keeps a second, competing pause flag. Explicitly NOT wired to
 * `document.visibilitychange` / Page Visibility API — the platform SDK is
 * the authoritative lifecycle source per the Playables requirements.
 */
import { isAdActive, onAdActiveChange, onPlatformPause, onPlatformResume } from "./PlayablesSDK";

type Listener = (paused: boolean) => void;

class PauseManagerImpl {
  private paused = false;
  private listeners = new Set<Listener>();
  private wiredToPlatform = false;
  /** The platform paused the game while an ad was on screen (and it wasn't already paused). */
  private pausedForAd = false;
  /** The pause in force is the platform's own: it paused a running game. Only that pause is lifted by the platform's resume. */
  private pausedByPlatform = false;

  /** Registers the platform pause/resume listeners exactly once. */
  wireToPlatform(): void {
    if (this.wiredToPlatform) return;
    this.wiredToPlatform = true;
    onPlatformPause(() => {
      // already paused (by the player, or by an earlier platform pause): nothing changes hands
      if (this.paused) return;
      this.pause();
      this.pausedByPlatform = true;
      if (isAdActive()) this.pausedForAd = true;
    });
    // (deep check 2026-11-28) a player who paused and then switched away must come back to a paused game
    onPlatformResume(() => {
      if (this.pausedByPlatform) this.resume();
    });
    // A platform may send the pause when an ad starts but not always the
    // resume when it ends — which would leave the game paused and silent.
    // When an ad stops blocking the screen (answered, or released by the
    // dead-request guard), wake the game — but only if it was the platform's
    // ad-time pause; a player's own pause is never undone.
    onAdActiveChange((active) => {
      if (!active && this.pausedForAd) this.resume();
    });
  }

  pause(): void {
    if (this.paused) return;
    this.pausedByPlatform = false;
    this.pausedForAd = false;
    this.paused = true;
    this.notify();
  }

  resume(): void {
    this.pausedByPlatform = false;
    this.pausedForAd = false;
    if (!this.paused) return;
    this.paused = false;
    this.notify();
  }

  toggle(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Returns an unsubscribe function. Fires immediately with current state. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.paused);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.paused);
  }
}

/** Single shared instance — import this, never instantiate the class yourself. */
export const PauseManager = new PauseManagerImpl();
