import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { PreparationScene } from "./scenes/PreparationScene";
import { PauseManager } from "./PauseManager";
import {
  CMD,
  EVT,
  type CutCompletedPayload,
  type RecipeCompletedPayload,
  type StartPreparationConfig,
  type StepStartedPayload,
  type CoachPayload,
} from "./events";
import type { KnifeDefinition } from "./knives/knifeTypes";
import type { BoardDefinition } from "./boards/boardTypes";

/**
 * GAME_BRIDGE — the only door between React and Phaser (§5). React never
 * imports `phaser`, never holds a `Phaser.Game`, and never reaches into
 * a scene. It creates one GameBridge, mounts it into a DOM node, calls
 * these methods, and listens for these events. Swapping the entire
 * Phaser implementation later only has to keep this surface intact.
 */
export type GameBridgeEvent =
  | { type: "SCENE_READY" }
  | { type: "CUT_STARTED" }
  | { type: "CUT_COMPLETED"; payload: CutCompletedPayload }
  | { type: "STEP_STARTED"; payload: StepStartedPayload }
  | { type: "PLATING_STARTED" }
  | { type: "PLATING_COMPLETED" }
  | { type: "CHEF_TAKE_STARTED" }
  | { type: "CHEF_TAKE_COMPLETED" }
  | { type: "RECIPE_COMPLETED"; payload: RecipeCompletedPayload }
  | { type: "COACH"; payload: CoachPayload };

type Listener = (event: GameBridgeEvent) => void;

export class GameBridge {
  private game: Phaser.Game | null = null;
  private bus = new Phaser.Events.EventEmitter();
  private listeners = new Set<Listener>();
  private pendingStart: StartPreparationConfig | null = null;
  // Whether PreparationScene.create() has actually finished and registered
  // its CMD.START listener — NOT the same as `this.game` existing.
  // `new Phaser.Game()` returns synchronously, but scene boot is
  // asynchronous (at least one requestAnimationFrame away); React's own
  // effects (GameViewport's mount() then Preparation's startPreparation())
  // can both run inside that same synchronous window. Gating on `!this.game`
  // here used to work by accident — PreloadScene's old asset load gave the
  // boot enough real delay to always win the race — and started silently
  // dropping CMD.START once that load was removed. Gate on scene-readiness
  // instead, so the race can't come back.
  private sceneReady = false;
  // Set by destroy(), cleared by mount() or once the deferred teardown
  // runs — see destroy() for why the teardown is deferred by a microtask.
  private teardownScheduled = false;

  mount(container: HTMLDivElement): void {
    // React StrictMode (dev) runs every effect mount → cleanup → mount in
    // one synchronous commit. The cleanup called destroy(), which only
    // *scheduled* this instance's teardown; this second mount re-claims
    // it before that microtask runs, so no Phaser.Game (and no WebGL
    // context) is ever thrown away for the StrictMode probe.
    this.teardownScheduled = false;
    if (this.game) return;

    this.bus.on(EVT.CUT_STARTED, () => this.publish({ type: "CUT_STARTED" }));
    this.bus.on(EVT.CUT_COMPLETED, (payload: CutCompletedPayload) =>
      this.publish({ type: "CUT_COMPLETED", payload }),
    );
    this.bus.on(EVT.COACH, (payload: CoachPayload) => this.publish({ type: "COACH", payload }));
    this.bus.on(EVT.STEP_STARTED, (payload: StepStartedPayload) =>
      this.publish({ type: "STEP_STARTED", payload }),
    );
    this.bus.on(EVT.PLATING_STARTED, () => this.publish({ type: "PLATING_STARTED" }));
    this.bus.on(EVT.PLATING_COMPLETED, () => this.publish({ type: "PLATING_COMPLETED" }));
    this.bus.on(EVT.CHEF_TAKE_STARTED, () => this.publish({ type: "CHEF_TAKE_STARTED" }));
    this.bus.on(EVT.CHEF_TAKE_COMPLETED, () => this.publish({ type: "CHEF_TAKE_COMPLETED" }));
    this.bus.on(EVT.RECIPE_COMPLETED, (payload: RecipeCompletedPayload) =>
      this.publish({ type: "RECIPE_COMPLETED", payload }),
    );
    this.bus.once(EVT.SCENE_READY, () => {
      this.sceneReady = true;
      if (this.pendingStart) {
        this.bus.emit(CMD.START, this.pendingStart);
        this.pendingStart = null;
      }
      // The scene has finished create() and registered its input
      // handlers — this, not "the save file loaded", is the actual
      // "game is interactive" signal §22 wants the platform's game_ready
      // tied to.
      this.publish({ type: "SCENE_READY" });
    });

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      transparent: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: container.clientWidth || 1,
        height: container.clientHeight || 1,
        // RESIZE mode mirrors the parent element's box every frame. When
        // that box transiently collapses to 0 (a route/screen transition,
        // a new level or order remounting <Preparation>, an orientation
        // flip), Phaser would otherwise hand a 0x0 size straight to the
        // WebGL renderer — RenderTarget.resize(0,0) rebuilds its
        // framebuffer and the completeness check throws
        // "Framebuffer status: Incomplete Attachment" — and to
        // CanvasTexture, whose getImageData(0,0,0,0) throws IndexSizeError.
        // A 1px floor keeps every downstream size positive (a 1x1 GL
        // texture/framebuffer is complete); the next real resize, always
        // emitted when the box comes back, restores the true size.
        min: { width: 1, height: 1 },
      },
      // Pointer Events under the hood — Phaser's input manager listens to
      // pointerdown/pointermove/pointerup natively, covering mouse and
      // touch with the same code path (§9).
      input: { activePointers: 1 },
      fps: { target: 60 },
      scene: [BootScene, PreloadScene, PreparationScene],
      callbacks: {
        preBoot: (game) => {
          // Scenes read this out of the registry (not scene init data) so
          // it survives scene restarts triggered from anywhere.
          game.registry.set("bus", this.bus);
        },
      },
    });

    // Phaser wires its own document.hidden/visibilitychange/blur/focus
    // handlers on construction (Game#onHidden calls this.loop.pause(),
    // no config flag disables it in this version) — a second, competing
    // pause system. Detach those specific listeners immediately so
    // PauseManager (fed only by the in-game button and
    // the Bridge's pause state) is the sole authority, per §23.
    // The underlying DOM listeners stay installed and harmless; nothing
    // is subscribed to react to them anymore.
    // (removeAllListeners is safe here — nothing else in this codebase
    // subscribes to these four event names.)
    const { HIDDEN, VISIBLE, BLUR, FOCUS } = Phaser.Core.Events;
    this.game.events.removeAllListeners(HIDDEN);
    this.game.events.removeAllListeners(VISIBLE);
    this.game.events.removeAllListeners(BLUR);
    this.game.events.removeAllListeners(FOCUS);
  }

  destroy(): void {
    if (!this.game || this.teardownScheduled) return;
    // Defer the teardown by ONE microtask. React StrictMode (dev) drives
    // every effect through mount → cleanup → mount inside a single
    // synchronous commit; without the defer, this cleanup's teardown
    // would throw away a Phaser.Game (and its WebGL context) that the
    // very next mount() re-claims. queueMicrotask runs after that whole
    // synchronous commit — so if mount() cleared `teardownScheduled`
    // meanwhile, the instance simply lives on. A real unmount (leaving
    // Preparation, or a new level re-keying <Preparation>) has no
    // following mount() on THIS bridge, so the teardown proceeds — still
    // within the same task, long before the next frame. This is not a
    // timing hack for a render race: it is the standard way to coalesce
    // StrictMode's synchronous teardown/re-setup probe.
    this.teardownScheduled = true;
    queueMicrotask(() => {
      if (!this.teardownScheduled) return;
      this.teardownScheduled = false;
      this.runTeardown();
    });
  }

  private runTeardown(): void {
    const game = this.game;
    this.game = null;
    this.sceneReady = false;
    this.pendingStart = null;
    this.listeners.clear();
    if (!game) return;

    // Phaser's `Game.destroy()` is asynchronous: it only sets
    // `pendingDestroy` and waits for the NEXT game-loop step to run
    // `runDestroy()`, which is what actually destroys the renderer/scenes,
    // removes the canvas and lets the WebGL context be reclaimed.
    //
    // Every new level/order remounts <Preparation> — a whole new Phaser.Game,
    // its own WebGL context — on every ingredient / technique / reset
    // change. Left to each outgoing game's own loop step, under RAF
    // starvation those steps run far too late: the pending-destroy games
    // keep their WebGL contexts alive, Chrome hits its hard per-page
    // context cap and force-loses the oldest ("Too many active WebGL
    // contexts" / "WebGL Context lost. Renderer disabled").
    //
    // A game the player has been looking at has finished booting
    // (`isRunning`), so its scene list is fully populated and calling
    // `runDestroy()` right now does exactly what Phaser's own loop step
    // would — synchronously, so the context is released before React's
    // replacement has rendered a frame and the count never climbs. A game
    // that never got to run (its microtask fired before the async texture
    // decode that starts the loop) is left to the deferred path:
    // `runDestroy()` now would throw walking a scene list `bootQueue` has
    // not filled, and `step()` checks `pendingDestroy` before it renders
    // anything, so it is gone on its own first frame regardless.
    game.destroy(true);
    const internal = game as Phaser.Game & {
      pendingDestroy?: boolean;
      runDestroy?: () => void;
    };
    if (game.isRunning && typeof internal.runDestroy === "function") {
      internal.runDestroy();
    }
  }

  startPreparation(config: StartPreparationConfig): void {
    if (!this.sceneReady) {
      this.pendingStart = config;
      return;
    }
    this.bus.emit(CMD.START, config);
  }

  pauseGame(): void {
    PauseManager.pause();
  }

  resumeGame(): void {
    PauseManager.resume();
  }

  restartPreparation(): void {
    this.bus.emit(CMD.RESTART);
  }

  /** Tears down the mounted Phaser instance; React unmounts <GameViewport/> around this. */
  exitPreparation(): void {
    this.destroy();
  }

  setKnife(knife: KnifeDefinition): void {
    this.bus.emit(CMD.SET_KNIFE, knife);
  }

  setBoard(board: BoardDefinition): void {
    this.bus.emit(CMD.SET_BOARD, board);
  }

  getGameplayState(): { isPaused: boolean } {
    return { isPaused: PauseManager.isPaused() };
  }

  /** Returns an unsubscribe function. */
  subscribeToGameEvents(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish(event: GameBridgeEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
