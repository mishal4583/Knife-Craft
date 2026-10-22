import Phaser from "phaser";
import { AudioManager } from "../AudioManager";
import { PauseManager } from "../PauseManager";
import { ONION_GEOMETRY, ORANGE_GEOMETRY, POTATO_GEOMETRY, TOMATO_GEOMETRY } from "../definitions";
import { paintTomatoTexture } from "../textures/tomatoTexture";
import { paintOnionTexture } from "../textures/onionTexture";
import { paintOrangeTexture } from "../textures/orangeTexture";
import { paintPotatoTexture } from "../textures/potatoTexture";
import {
  EMPTY_STATS,
  PREP_RUSH,
  intervalAt,
  isCleanCut,
  rushOver,
  rushSequence,
  segmentNear,
  scoreCut,
  scoreMiss,
  speedAt,
  type RushKind,
  type RushStats,
} from "../prepRush";

/** Scene → bridge events and bridge → scene commands (the bus in the registry, like the Preparation scene's). */
export const RUSH_EVT = { READY: "rush:ready", STATS: "rush:stats", ENDED: "rush:ended" } as const;
export const RUSH_CMD = { START: "rush:start", STOP: "rush:stop" } as const;
export type RushStatsPayload = { stats: RushStats; msLeft: number; onBelt: number };

type Item = {
  img: Phaser.GameObjects.Image;
  kind: RushKind;
  x: number;
  r: number;
  /** "belt" until it is scored — exactly once — as cut or missed; "free" when back in the pool. */
  state: "belt" | "done" | "free";
};

const GEOMETRY: Record<RushKind, { RX_FRAC: number; RY_FRAC: number }> = {
  tomato: TOMATO_GEOMETRY,
  onion: ONION_GEOMETRY,
  orange: ORANGE_GEOMETRY,
  potato: POTATO_GEOMETRY,
};

const PAINT: Record<
  RushKind,
  (ctx: CanvasRenderingContext2D, rx: number, ry: number, m: number) => void
> = {
  tomato: (ctx, rx, ry, m) => paintTomatoTexture(ctx, rx, ry, m),
  onion: (ctx, rx, ry, m) => paintOnionTexture(ctx, rx, ry, m, false),
  orange: (ctx, rx, ry, m) => paintOrangeTexture(ctx, rx, ry, m),
  potato: (ctx, rx, ry, m) => paintPotatoTexture(ctx, rx, ry, m, false),
};

const FONT = '"Nunito", ui-rounded, system-ui, sans-serif';

/**
 * PREP_RUSH_SCENE — Phase 3 (B): the conveyor challenge (rules in
 * prepRush.ts). Everything it makes is bounded and owned here: at most
 * MAX_ON_BELT ingredient images (pooled), two short-lived halves per cut,
 * one Graphics for the belt and one for the bins. A run ends on time or
 * misses; START resets every piece of state for a replay; the scene dies
 * with its game when the screen unmounts. It obeys PauseManager like the
 * Preparation scene (a pause stops its clock, belt and tweens).
 */
export class PrepRushScene extends Phaser.Scene {
  private bus!: Phaser.Events.EventEmitter;
  private beltGfx!: Phaser.GameObjects.Graphics;
  private binGfx!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private items: Item[] = [];
  private stats: RushStats = EMPTY_STATS;
  private running = false;
  private playedMs = 0;
  private sinceSpawn = 0;
  private sinceStats = 0;
  private slatOffset = 0;
  private next: () => RushKind = rushSequence();
  private swipe: {
    start: { x: number; y: number };
    last: { x: number; y: number };
    moved: number;
  } | null = null;
  private unsubscribePause?: () => void;

  constructor() {
    super("PrepRush");
  }

  create(): void {
    this.bus = this.registry.get("rushBus") as Phaser.Events.EventEmitter;
    this.beltGfx = this.add.graphics().setDepth(1);
    this.binGfx = this.add.graphics().setDepth(2);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.unsubscribePause = PauseManager.subscribe((paused) => {
      if (paused) {
        this.tweens.pauseAll();
        this.scene.pause();
      } else {
        this.scene.resume();
        this.tweens.resumeAll();
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribePause?.());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.unsubscribePause?.());
    this.bus.on(RUSH_CMD.START, this.start, this);
    this.bus.on(RUSH_CMD.STOP, () => this.end(false));
    this.layout();
    this.bus.emit(RUSH_EVT.READY);
  }

  // ── geometry ──────────────────────────────────────────────────────────
  private get w(): number {
    return this.scale.width;
  }
  private get h(): number {
    return this.scale.height;
  }
  /**
   * The size unit: the width on a portrait canvas (exactly as before), the height on a
   * landscape one, so a phone on its side keeps the food, belt and bins in proportion
   * instead of scaling them by the long side (developer 2026-10-22, landscape).
   */
  private get u(): number {
    return Math.min(this.w, this.h);
  }
  private beltY(): number {
    return this.h * 0.42;
  }
  private beltH(): number {
    return Math.max(56, this.h * 0.17, this.u * 0.24);
  }
  private beltStart(): number {
    return this.w * 0.04;
  }
  private beltEnd(): number {
    return this.w * 0.78;
  }
  private bowl(): { x: number; y: number } {
    return { x: this.w * 0.36, y: this.h * 0.8 };
  }
  private bin(): { x: number; y: number } {
    return { x: this.w * 0.88, y: this.h * 0.7 };
  }
  private radiusOf(kind: RushKind): number {
    return GEOMETRY[kind].RX_FRAC * this.u * PREP_RUSH.SIZE_FRAC;
  }

  /** (Re)paints the ingredient textures at this size and redraws the belt and bins. */
  private layout(): void {
    if (this.w <= 1 || this.h <= 1) return;
    for (const kind of PREP_RUSH.KINDS) {
      const rx = this.radiusOf(kind);
      const ry = GEOMETRY[kind].RY_FRAC * this.u * PREP_RUSH.SIZE_FRAC;
      const m = Math.ceil(rx * 0.12);
      const key = `rush-${kind}`;
      if (this.textures.exists(key)) this.textures.remove(key);
      const tex = this.textures.createCanvas(key, Math.ceil(2 * (rx + m)), Math.ceil(2 * (ry + m)));
      if (!tex) continue;
      PAINT[kind](tex.context, rx, ry, m);
      tex.refresh();
    }
    for (const it of this.items) {
      if (it.state === "free") continue;
      it.r = this.radiusOf(it.kind);
      it.img.setTexture(`rush-${it.kind}`).setY(this.beltY());
    }
    this.drawBelt();
    this.drawBins();
  }

  private drawBelt(): void {
    const g = this.beltGfx;
    g.clear();
    const y = this.beltY();
    const bh = this.beltH();
    const x0 = this.beltStart() - 14;
    const x1 = this.beltEnd() + 14;
    g.fillStyle(0x2f2a26, 1);
    g.fillRoundedRect(x0, y - bh / 2, x1 - x0, bh, bh / 2);
    g.lineStyle(2, 0x524a43, 1);
    const gap = 26;
    for (let x = x0 + bh / 2 + (this.slatOffset % gap); x < x1 - bh / 2; x += gap)
      g.lineBetween(x, y - bh / 2 + 5, x, y + bh / 2 - 5);
    for (const rx of [x0 + bh / 2, x1 - bh / 2]) {
      g.fillStyle(0x4a423b, 1);
      g.fillCircle(rx, y, bh * 0.3);
      g.fillStyle(0x6d645b, 1);
      g.fillCircle(rx, y, bh * 0.12);
    }
  }

  private drawBins(): void {
    const g = this.binGfx;
    g.clear();
    for (const t of this.labels) t.destroy();
    this.labels = [];
    const bw = this.u * 0.24;
    const bowl = this.bowl();
    g.fillStyle(0xf3ead9, 1);
    g.fillEllipse(bowl.x, bowl.y, bw * 1.25, bw * 0.42);
    g.lineStyle(3, 0xb88b5a, 1);
    g.strokeEllipse(bowl.x, bowl.y, bw * 1.25, bw * 0.42);
    const bin = this.bin();
    g.fillStyle(0x6f5a43, 1);
    g.fillRoundedRect(bin.x - bw * 0.32, bin.y - bw * 0.25, bw * 0.64, bw * 0.55, 8);
    g.fillStyle(0x4e3f30, 1);
    g.fillRect(bin.x - bw * 0.34, bin.y - bw * 0.27, bw * 0.68, 6);
    const style = {
      fontFamily: FONT,
      fontStyle: "800",
      fontSize: `${Math.max(12, this.u * 0.032)}px`,
      color: "#6b4a2f",
    };
    this.labels.push(
      this.add
        .text(bowl.x, bowl.y + bw * 0.3, "PREPARED", style)
        .setOrigin(0.5, 0)
        .setDepth(3),
      this.add
        .text(bin.x, bin.y + bw * 0.34, "MISSED", style)
        .setOrigin(0.5, 0)
        .setDepth(3),
    );
  }

  // ── run lifecycle ─────────────────────────────────────────────────────
  /** A fresh run (also Replay): every item, half and number back to the start. */
  private start(): void {
    for (const it of this.items) {
      this.tweens.killTweensOf(it.img);
      it.img.destroy();
    }
    this.items = [];
    this.stats = EMPTY_STATS;
    this.playedMs = 0;
    this.sinceSpawn = intervalAt(0) * 0.6;
    this.sinceStats = 0;
    this.next = rushSequence();
    this.swipe = null;
    this.running = true;
    this.emitStats();
  }

  /** Ends the run once: belt cleared, final stats out. `natural` is a real finish (time or misses), not the screen leaving. */
  private end(natural: boolean): void {
    if (!this.running) return;
    this.running = false;
    for (const it of this.items) {
      this.tweens.killTweensOf(it.img);
      it.img.destroy();
    }
    this.items = [];
    if (natural) {
      AudioManager.playChime();
      this.bus.emit(RUSH_EVT.ENDED, {
        stats: this.stats,
        msLeft: 0,
        onBelt: 0,
      } satisfies RushStatsPayload);
    }
  }

  override update(_time: number, delta: number): void {
    if (!this.running) return;
    const dt = Math.min(delta, 100); // a long frame (tab switch) can't teleport the belt
    this.playedMs += dt;
    const speedPx = speedAt(this.playedMs) * (this.beltEnd() - this.beltStart());
    const step = (speedPx * dt) / 1000;
    this.slatOffset += step;
    this.drawBelt();
    for (const it of this.items) {
      if (it.state !== "belt") continue;
      it.x += step;
      it.img.setX(it.x);
      if (it.x - it.r > this.beltEnd()) this.miss(it);
    }
    this.sinceSpawn += dt;
    const onBelt = this.items.filter((i) => i.state === "belt").length;
    if (this.sinceSpawn >= intervalAt(this.playedMs) && onBelt < PREP_RUSH.MAX_ON_BELT) {
      this.sinceSpawn = 0;
      this.spawn();
    }
    this.sinceStats += dt;
    if (this.sinceStats >= 250) {
      this.sinceStats = 0;
      this.emitStats();
    }
    if (rushOver(this.playedMs, this.stats)) this.end(true);
  }

  private spawn(): void {
    const kind = this.next();
    const r = this.radiusOf(kind);
    const x = this.beltStart() - r;
    const free = this.items.find((i) => i.state === "free");
    if (free) {
      free.kind = kind;
      free.r = r;
      free.x = x;
      free.state = "belt";
      free.img
        .setTexture(`rush-${kind}`)
        .setPosition(x, this.beltY())
        .setAlpha(1)
        .setScale(1)
        .setAngle(0)
        .setVisible(true);
      return;
    }
    const img = this.add.image(x, this.beltY(), `rush-${kind}`).setDepth(5);
    this.items.push({ img, kind, x, r, state: "belt" });
  }

  private emitStats(): void {
    this.bus.emit(RUSH_EVT.STATS, {
      stats: this.stats,
      msLeft: Math.max(0, PREP_RUSH.DURATION_MS - this.playedMs),
      onBelt: this.items.filter((i) => i.state === "belt").length,
    } satisfies RushStatsPayload);
  }

  private reduced(): boolean {
    return (
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("kc-reduced-motion")
    );
  }

  // ── scoring: exactly once per item ───────────────────────────────────
  private cut(it: Item, clean: boolean, angle: number): void {
    if (it.state !== "belt") return;
    it.state = "done";
    const before = this.stats.combo;
    this.stats = scoreCut(this.stats, clean);
    AudioManager.playIngredientSlice(it.kind, clean ? 0.9 : 0.5, 90);
    if (this.stats.combo > before && this.stats.combo % PREP_RUSH.POINTS.COMBO_EVERY === 0)
      AudioManager.playComboMilestone(
        Math.min(4, this.stats.combo / PREP_RUSH.POINTS.COMBO_EVERY - 1),
      );
    this.splitIntoBowl(it, angle, clean);
    this.emitStats();
  }

  private miss(it: Item): void {
    if (it.state !== "belt") return;
    it.state = "done";
    this.stats = scoreMiss(this.stats);
    AudioManager.playSfx("plate");
    const bin = this.bin();
    this.tweens.add({
      targets: it.img,
      x: bin.x,
      y: bin.y,
      alpha: 0.2,
      scale: 0.6,
      duration: this.reduced() ? 120 : 420,
      ease: Phaser.Math.Easing.Quadratic.In,
      onComplete: () => this.release(it),
    });
    this.emitStats();
  }

  /** The two halves (crops of the item's own texture, split along the cut) hop into the bowl. */
  private splitIntoBowl(it: Item, angle: number, clean: boolean): void {
    const key = `rush-${it.kind}`;
    const src = this.textures.get(key).getSourceImage() as HTMLCanvasElement;
    const tw = src.width;
    const th = src.height;
    const rot = angle - Math.PI / 2;
    const bowl = this.bowl();
    const nx = Math.cos(rot);
    const ny = Math.sin(rot);
    [0, 1].forEach((side) => {
      const half = this.add.image(it.x, this.beltY(), key).setDepth(6).setRotation(rot);
      half.setCrop(side === 0 ? 0 : tw / 2, 0, tw / 2, th);
      const dir = side === 0 ? -1 : 1;
      if (this.reduced()) {
        this.tweens.add({
          targets: half,
          alpha: 0,
          duration: 200,
          onComplete: () => half.destroy(),
        });
        return;
      }
      this.tweens.add({
        targets: half,
        x: { from: it.x, to: bowl.x + dir * it.r * 0.5 },
        y: { from: this.beltY(), to: bowl.y - it.r * 0.2 },
        rotation: rot + dir * 0.6,
        scale: 0.8,
        alpha: { from: 1, to: 0.85 },
        duration: 520,
        ease: Phaser.Math.Easing.Back.In,
        onStart: () => half.setPosition(it.x + nx * dir * 6, this.beltY() + ny * dir * 6),
        onComplete: () =>
          this.tweens.add({
            targets: half,
            alpha: 0,
            duration: 260,
            onComplete: () => half.destroy(),
          }),
      });
    });
    if (clean && !this.reduced()) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const dot = this.add.circle(it.x, this.beltY(), 2.4, 0xd8a03d, 1).setDepth(7);
        this.tweens.add({
          targets: dot,
          x: it.x + Math.cos(a) * it.r * 0.9,
          y: this.beltY() + Math.sin(a) * it.r * 0.9,
          alpha: 0,
          duration: 360,
          onComplete: () => dot.destroy(),
        });
      }
    }
    this.release(it);
  }

  /** Back to the pool, hidden until the next spawn. */
  private release(it: Item): void {
    it.state = "free";
    this.tweens.killTweensOf(it.img);
    it.img.setVisible(false);
  }

  // ── input: one swipe (or tap) cuts what it crosses ───────────────────
  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.running) return;
    this.swipe = { start: { x: p.x, y: p.y }, last: { x: p.x, y: p.y }, moved: 0 };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const s = this.swipe;
    if (!this.running || !s || !p.isDown) return;
    const now = { x: p.x, y: p.y };
    s.moved += Math.hypot(now.x - s.last.x, now.y - s.last.y);
    if (s.moved > 12) {
      for (const it of this.items) {
        if (it.state !== "belt") continue;
        if (segmentNear(s.last, now, it.x, this.beltY(), it.r)) {
          const clean = isCleanCut(s.start, now, it.x, this.beltY(), it.r);
          this.cut(it, clean, Math.atan2(now.y - s.start.y, now.x - s.start.x));
        }
      }
    }
    s.last = now;
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const s = this.swipe;
    this.swipe = null;
    if (!this.running || !s || s.moved > 12) return;
    // A tap: cuts the ingredient under the finger (never a clean cut — tap is the relaxed way).
    const hit = this.items.find(
      (it) => it.state === "belt" && Math.hypot(p.x - it.x, p.y - this.beltY()) <= it.r,
    );
    if (hit) this.cut(hit, false, Math.PI / 2);
  }
}
