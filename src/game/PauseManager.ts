/**
 * PAUSE_MANAGER — the single source of truth for "is the game paused".
 *
 * Both the in-game Pause button and `ytgame.system.onPause/onResume`
 * call the same `pause()` / `resume()` here. Nothing downstream (the
 * Phaser scene, AudioManager) can tell which one triggered it, and
 * nothing keeps a second, competing pause flag. Explicitly NOT wired to
 * `document.visibilitychange` / Page Visibility API — YouTube's SDK is
 * the authoritative lifecycle source per the Playables requirements.
 */
import { onPlatformPause, onPlatformResume } from "./PlayablesSDK";

type Listener = (paused: boolean) => void;

class PauseManagerImpl {
  private paused = false;
  private listeners = new Set<Listener>();
  private wiredToPlatform = false;

  /** Registers the ytgame.system.onPause/onResume listeners exactly once. */
  wireToPlatform(): void {
    if (this.wiredToPlatform) return;
    this.wiredToPlatform = true;
    onPlatformPause(() => this.pause());
    onPlatformResume(() => this.resume());
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.notify();
  }

  resume(): void {
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
