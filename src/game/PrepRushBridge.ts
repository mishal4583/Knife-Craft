import Phaser from "phaser";
import { PauseManager } from "./PauseManager";
import { PrepRushScene, RUSH_CMD, RUSH_EVT, type RushStatsPayload } from "./scenes/PrepRushScene";

export type PrepRushEvent =
  | { type: "READY" }
  | { type: "STATS"; payload: RushStatsPayload }
  | { type: "ENDED"; payload: RushStatsPayload };

type Listener = (event: PrepRushEvent) => void;

/**
 * PREP_RUSH_BRIDGE — Phase 3 (B): the Prep Rush screen's door to its own
 * Phaser game, the same shape and the same safeguards as GameBridge (the
 * StrictMode-coalescing microtask teardown, the synchronous runDestroy so
 * WebGL contexts never pile up, Phaser's own focus/blur pause detached so
 * PauseManager is the only pause). It is a separate game, not a scene in
 * the main one: Prep Rush never shares state with the restaurant.
 */
export class PrepRushBridge {
  private game: Phaser.Game | null = null;
  private bus = new Phaser.Events.EventEmitter();
  private listeners = new Set<Listener>();
  private ready = false;
  private pendingStart = false;
  private teardownScheduled = false;

  mount(container: HTMLDivElement): void {
    this.teardownScheduled = false;
    if (this.game) return;
    this.bus.on(RUSH_EVT.STATS, (payload: RushStatsPayload) =>
      this.publish({ type: "STATS", payload }),
    );
    this.bus.on(RUSH_EVT.ENDED, (payload: RushStatsPayload) =>
      this.publish({ type: "ENDED", payload }),
    );
    this.bus.once(RUSH_EVT.READY, () => {
      this.ready = true;
      if (this.pendingStart) {
        this.pendingStart = false;
        this.bus.emit(RUSH_CMD.START);
      }
      this.publish({ type: "READY" });
    });
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      transparent: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: container.clientWidth || 1,
        height: container.clientHeight || 1,
        min: { width: 1, height: 1 },
      },
      input: { activePointers: 1 },
      fps: { target: 60 },
      scene: [PrepRushScene],
      callbacks: { preBoot: (game) => game.registry.set("rushBus", this.bus) },
    });
    const { HIDDEN, VISIBLE, BLUR, FOCUS } = Phaser.Core.Events;
    this.game.events.removeAllListeners(HIDDEN);
    this.game.events.removeAllListeners(VISIBLE);
    this.game.events.removeAllListeners(BLUR);
    this.game.events.removeAllListeners(FOCUS);
  }

  destroy(): void {
    if (!this.game || this.teardownScheduled) return;
    this.teardownScheduled = true;
    queueMicrotask(() => {
      if (!this.teardownScheduled) return;
      this.teardownScheduled = false;
      const game = this.game;
      this.game = null;
      this.ready = false;
      this.pendingStart = false;
      this.listeners.clear();
      this.bus.removeAllListeners();
      if (!game) return;
      game.destroy(true);
      const internal = game as Phaser.Game & { runDestroy?: () => void };
      if (game.isRunning && typeof internal.runDestroy === "function") internal.runDestroy();
    });
  }

  /** A fresh run — also Replay. Queued until the scene is ready. */
  start(): void {
    if (!this.ready) {
      this.pendingStart = true;
      return;
    }
    this.bus.emit(RUSH_CMD.START);
  }

  /** Ends a run in progress without results (leaving the screen mid-run). */
  stop(): void {
    this.pendingStart = false;
    if (this.ready) this.bus.emit(RUSH_CMD.STOP);
  }

  pause(): void {
    PauseManager.pause();
  }

  resume(): void {
    PauseManager.resume();
  }

  /** Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish(event: PrepRushEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
