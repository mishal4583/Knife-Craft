import Phaser from "phaser";
import { KNIFE_FX, type BladeTier, type CutMoment } from "../knifeFeel";
import type { KnifeProfile, Pt } from "./knifeProfile";

/**
 * The knife's own effects while cutting (knifeFeel.ts says when; this draws
 * them; developer 2026-10-24 reference board: motion trail, impact splash,
 * edge glint, juice beads, combo glow, tip spark, perfect/last flash). Two
 * Graphics ride on the knife's own transform — one additive (the glint, the
 * glowing blade, the flash), one plain (juice beads on the blade) — and one
 * more in world space (the motion trail and the edge's afterimage). The
 * splash, stars, embers and flicked juice are short-lived objects.
 * Presentation only; it never moves the knife itself (docs/KNIFE_RULES.md).
 */

type Wet = { at: number; up: number; from: number; color: number; r: number; t: number };
type Afterimage = { pts: Pt[]; t: number; color: number };

/** A point `k` (0–1) of the way along a polyline, by length. */
function along(pts: readonly Pt[], k: number): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  let total = 0;
  for (let i = 1; i < pts.length; i++)
    total += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  let want = Math.max(0, Math.min(1, k)) * total;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (want <= d || i === pts.length - 1) {
      const f = d > 0 ? Math.min(1, want / d) : 0;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    want -= d;
  }
  return pts[pts.length - 1]!;
}

/** The part of a polyline between k0 and k1 (0–1), sampled. */
function slice(pts: readonly Pt[], k0: number, k1: number, n = 8): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push(along(pts, k0 + ((k1 - k0) * i) / n));
  return out;
}

const TIER_EDGE: Record<
  BladeTier,
  { color: number; alpha: number; glow: number; aura: number; ember: number }
> = {
  0: { color: 0xffffff, alpha: 0, glow: 0, aura: 0, ember: 0 },
  1: { color: 0xffd98a, alpha: 0.5, glow: 0.16, aura: 0.07, ember: 0 },
  2: { color: 0xffb830, alpha: 0.75, glow: 0.26, aura: 0.13, ember: 140 },
  3: { color: 0xffe9a0, alpha: 0.95, glow: 0.36, aura: 0.2, ember: 70 },
};

/** The motion trail: edge snapshots kept this long, at most this many. */
const TRAIL_MS = 150;
const TRAIL_MAX = 7;

export class KnifeFx {
  private glow: Phaser.GameObjects.Graphics;
  private wetGfx: Phaser.GameObjects.Graphics;
  private world: Phaser.GameObjects.Graphics;
  private glints: { t: number; power: number }[] = [];
  private flashT = -Infinity;
  private tier: BladeTier = 0;
  private wet: Wet[] = [];
  private ghosts: Afterimage[] = [];
  private trail: { pts: Pt[]; t: number }[] = [];
  private lastEmberAt = 0;
  private last: { g: Phaser.GameObjects.Graphics; p: KnifeProfile } | null = null;
  private lastSparkAt = 0;

  constructor(
    private scene: Phaser.Scene,
    private reduced: () => boolean,
  ) {
    this.glow = scene.add.graphics().setDepth(31).setBlendMode(Phaser.BlendModes.ADD);
    this.wetGfx = scene.add.graphics().setDepth(30.5);
    this.world = scene.add.graphics().setDepth(24).setBlendMode(Phaser.BlendModes.ADD);
  }

  /** A local blade point in world space, through the knife's own transform. */
  private toWorld(g: Phaser.GameObjects.Graphics, q: Pt): Pt {
    const c = Math.cos(g.rotation);
    const s = Math.sin(g.rotation);
    const x = q.x * g.scaleX;
    return { x: g.x + c * x - s * q.y, y: g.y + s * x + c * q.y };
  }

  /** The ingredient changed or the order restarted: the blade cools and dries. */
  reset(): void {
    this.tier = 0;
    this.wet = [];
    this.glints = [];
    this.ghosts = [];
    this.trail = [];
    this.flashT = -Infinity;
  }

  /**
   * One cut landed: what it gets comes from knifeFeel.cutMoment. `juice` = the
   * ingredient's juice colour (juicy ones splash and bead the blade), `at` =
   * where the blade went through, `seed` / `fleck` = its seeds' and flesh's
   * colours for the splash.
   */
  onCut(
    m: CutMoment,
    juice: number | null,
    at?: Pt,
    colours: { seed?: number | null; fleck?: number } = {},
  ): void {
    const now = this.scene.time.now;
    this.tier = m.tier;
    const still = this.reduced();
    if (!still) {
      this.glints.push({ t: now, power: m.glint });
      if (m.echo) this.glints.push({ t: now + KNIFE_FX.GLINT_ECHO_MS, power: m.glint });
    }
    if (m.flash) this.flashT = now;
    if (this.last && !still) {
      const { g, p } = this.last;
      this.ghosts.push({
        pts: p.cuttingEdge.map((q) => this.toWorld(g, q)),
        t: now,
        color: m.tier >= 2 ? 0xffd36a : 0xffffff,
      });
      if (m.star)
        this.star(
          this.toWorld(g, p.cuttingEdge[p.cuttingEdge.length - 1]!),
          m.tier,
          m.flash || m.shing,
        );
    }
    if (at && !still) this.splash(at, juice, colours.seed ?? null, colours.fleck ?? 0xf2e6c8);
    if (juice !== null && !still) {
      const r = () => Phaser.Math.FloatBetween(0, 1);
      const n = 2 + (r() < 0.6 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const up = 0.3 + r() * 0.55;
        this.wet.push({
          at: 0.15 + r() * 0.75,
          up,
          from: up,
          color: juice,
          r: 0.7 + r() * 0.8,
          t: now,
        });
      }
      this.wet = this.wet.slice(-KNIFE_FX.WET_MAX);
    }
    if (m.flick) this.flick();
    if (m.haptic > 0 && typeof navigator !== "undefined" && "vibrate" in navigator)
      navigator.vibrate?.(m.haptic);
  }

  /**
   * The impact: juice droplets (teardrops stretched along their flight) and a
   * few seeds burst out of the cut and arc down onto the board, with a soft
   * wet mist; a dry ingredient throws a few flecks of itself instead.
   */
  private splash(at: Pt, juice: number | null, seed: number | null, fleck: number): void {
    const s = this.scene;
    const w = s.scale.width;
    const R = (a: number, b: number) => Phaser.Math.FloatBetween(a, b);
    const fly = (
      obj: Phaser.GameObjects.Shape | Phaser.GameObjects.Graphics,
      a: number,
      d: number,
      ms: number,
    ) => {
      const x1 = at.x + Math.cos(a) * d;
      const y1 = at.y + Math.sin(a) * d;
      s.tweens.add({
        targets: obj,
        x: x1,
        y: y1,
        duration: ms * 0.55,
        ease: Phaser.Math.Easing.Cubic.Out,
        onComplete: () =>
          s.tweens.add({
            targets: obj,
            y: y1 + d * 0.35,
            alpha: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: ms * 0.45,
            ease: Phaser.Math.Easing.Quadratic.In,
            onComplete: () => obj.destroy(),
          }),
      });
    };
    if (juice !== null) {
      const mist = s.add.circle(at.x, at.y, w * 0.045, juice, 0.38).setDepth(23);
      s.tweens.add({
        targets: mist,
        scale: 2.4,
        alpha: 0,
        duration: 260,
        ease: Phaser.Math.Easing.Quadratic.Out,
        onComplete: () => mist.destroy(),
      });
      const n = 16 + Math.floor(R(0, 10));
      for (let i = 0; i < n; i++) {
        const a = R(0, Math.PI * 2);
        const size = w * R(0.006, 0.016);
        const drop = s.add.graphics({ x: at.x, y: at.y }).setDepth(23);
        // A teardrop pointing back along its flight, with a highlight.
        drop.fillStyle(juice, 0.92);
        drop.fillCircle(0, 0, size);
        drop.fillTriangle(-size * 0.9, -size * 0.55, -size * 0.9, size * 0.55, -size * 3, 0);
        drop.fillStyle(0xffffff, 0.55);
        drop.fillCircle(size * 0.3, -size * 0.35, size * 0.35);
        drop.setRotation(a);
        fly(drop, a, w * R(0.07, 0.22), R(520, 820));
      }
      if (seed !== null)
        for (let i = 0; i < 4 + Math.floor(R(0, 4)); i++) {
          const a = R(0, Math.PI * 2);
          const sd = s.add.ellipse(at.x, at.y, w * 0.017, w * 0.01, seed, 0.95).setDepth(23);
          sd.setRotation(a);
          fly(sd, a, w * R(0.05, 0.14), R(480, 700));
        }
    } else
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + R(-1.3, 1.3);
        const f = s.add.circle(at.x, at.y, w * R(0.003, 0.006), fleck, 0.85).setDepth(23);
        fly(f, a, w * R(0.03, 0.07), R(260, 380));
      }
  }

  /**
   * A star that pops at the tip: four long thin rays and four short ones over
   * a soft glow — a lens flare. `big` for Perfect Slice and the last cut.
   */
  private star(at: Pt, tier: BladeTier, big = false): void {
    const s = this.scene;
    const g = s.add.graphics({ x: at.x, y: at.y }).setDepth(32).setBlendMode(Phaser.BlendModes.ADD);
    const L = s.scale.width * (0.045 + tier * 0.006) * (big ? 1.6 : 1);
    const warm = tier >= 2 ? 0xffc85a : 0xfff0d0;
    g.fillStyle(warm, 0.22);
    g.fillCircle(0, 0, L * 0.7);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(0, 0, L * 0.28);
    const ray = (a: number, len: number, wide: number, alpha: number) => {
      const c = Math.cos(a);
      const sn = Math.sin(a);
      g.fillStyle(0xffffff, alpha);
      g.fillTriangle(c * len, sn * len, -sn * wide, c * wide, sn * wide, -c * wide);
      g.fillTriangle(-c * len, -sn * len, -sn * wide, c * wide, sn * wide, -c * wide);
    };
    ray(0, L * 1.4, L * 0.07, 0.95);
    ray(Math.PI / 2, L * 1.4, L * 0.07, 0.95);
    ray(Math.PI / 4, L * 0.6, L * 0.05, 0.6);
    ray(-Math.PI / 4, L * 0.6, L * 0.05, 0.6);
    g.setScale(0.15).setRotation(-0.25);
    s.tweens.add({
      targets: g,
      scale: 1,
      rotation: 0.2,
      duration: 170,
      ease: Phaser.Math.Easing.Back.Out,
      onComplete: () =>
        s.tweens.add({
          targets: g,
          alpha: 0,
          scale: 0.7,
          rotation: 0.5,
          duration: big ? 420 : 300,
          onComplete: () => g.destroy(),
        }),
    });
  }

  /** The last cut: the juice is flicked off the blade in a little spray. */
  private flick(): void {
    if (!this.last || this.reduced()) {
      this.wet = [];
      return;
    }
    const { g, p } = this.last;
    const s = this.scene;
    for (const w of this.wet) {
      const q = along(p.cuttingEdge, w.at);
      const at = this.toWorld(g, { x: q.x, y: q.y - p.bladeH * w.up });
      const dot = s.add.circle(
        at.x,
        at.y,
        Math.max(1.6, s.scale.width * 0.006 * w.r),
        w.color,
        0.9,
      );
      dot.setDepth(23);
      const a = g.rotation + (g.scaleX < 0 ? Math.PI : 0) + Phaser.Math.FloatBetween(-0.6, 0.6);
      const d = s.scale.width * Phaser.Math.FloatBetween(0.05, 0.11);
      s.tweens.add({
        targets: dot,
        x: at.x + Math.cos(a) * d,
        y: at.y + Math.sin(a) * d + d * 0.6,
        scale: 0.4,
        alpha: 0,
        duration: 380,
        ease: Phaser.Math.Easing.Quadratic.Out,
        onComplete: () => dot.destroy(),
      });
    }
    this.wet = [];
  }

  /** Every frame, after the knife is drawn: ride the knife's transform and draw what's live. */
  draw(g: Phaser.GameObjects.Graphics, p: KnifeProfile, alpha: number): void {
    this.last = { g, p };
    const now = this.scene.time.now;
    const still = this.reduced();
    for (const fx of [this.glow, this.wetGfx]) {
      fx.clear();
      fx.setPosition(g.x, g.y).setRotation(g.rotation).setScale(g.scaleX, g.scaleY).setAlpha(alpha);
    }
    const edge = p.cuttingEdge;
    const H = p.bladeH;
    const line = Math.max(1, H * 0.05);
    // The glowing blade (tier 1–3): a warm aura over the steel, a wide bloom
    // and a bright line on the edge, pulsing at tier 3; embers rise off the edge.
    // Sharp steel: the edge always catches a thin line of light.
    this.glow.lineStyle(line * 0.9, 0xffffff, 0.32);
    this.glow.strokePoints(edge, false);
    const t = TIER_EDGE[this.tier];
    if (t.alpha > 0) {
      const pulse = this.tier >= 3 && !still ? 0.8 + 0.2 * Math.sin(now / 90) : 1;
      this.glow.fillStyle(t.color, t.aura * pulse);
      this.glow.fillPoints(p.outline, true);
      this.glow.lineStyle(line * 10, t.color, t.glow * 0.5 * pulse);
      this.glow.strokePoints(edge, false);
      this.glow.lineStyle(line * 4.5, t.color, t.glow * pulse);
      this.glow.strokePoints(edge, false);
      this.glow.lineStyle(line * 1.5, 0xfff8e8, t.alpha * pulse);
      this.glow.strokePoints(edge, false);
      if (t.ember > 0 && !still && alpha > 0.5 && now - this.lastEmberAt > t.ember) {
        this.lastEmberAt = now;
        this.ember(this.toWorld(g, along(edge, Phaser.Math.FloatBetween(0.15, 1))), t.color);
      }
      if (this.tier >= 3 && !still && now - this.lastSparkAt > 200) {
        this.lastSparkAt = now;
        this.spark(this.toWorld(g, edge[edge.length - 1]!));
      }
    }
    // The glint: a bright run heel → tip along the edge with a little flare at
    // its head, the spine catching it just behind.
    this.glints = this.glints.filter((gl) => now - gl.t < KNIFE_FX.GLINT_MS);
    for (const gl of this.glints) {
      const k = (now - gl.t) / KNIFE_FX.GLINT_MS;
      if (k < 0) continue;
      const fade = Math.sin(Math.PI * k) * gl.power;
      const span = KNIFE_FX.GLINT_SPAN;
      this.glow.lineStyle(line * 7, 0xffffff, 0.22 * fade);
      this.glow.strokePoints(slice(edge, k - span * 1.3, k + span * 1.3), false);
      this.glow.lineStyle(line * 2.2, 0xffffff, fade);
      this.glow.strokePoints(slice(edge, k - span * 0.6, k + span * 0.6), false);
      this.glow.lineStyle(line * 1.2, 0xffffff, 0.6 * fade);
      this.glow.strokePoints(slice(p.spine, k - 0.08 - span * 0.5, k - 0.08 + span * 0.5), false);
      const c = along(edge, k);
      const f = H * 0.55 * fade;
      this.glow.fillStyle(0xffffff, 0.75 * fade);
      this.glow.fillCircle(c.x, c.y, line * 2.6);
      this.glow.fillTriangle(c.x - f * 1.6, c.y, c.x, c.y - line * 0.8, c.x, c.y + line * 0.8);
      this.glow.fillTriangle(c.x + f * 1.6, c.y, c.x, c.y - line * 0.8, c.x, c.y + line * 0.8);
      this.glow.fillTriangle(c.x, c.y - f, c.x - line * 0.8, c.y, c.x + line * 0.8, c.y);
      this.glow.fillTriangle(c.x, c.y + f * 0.6, c.x - line * 0.8, c.y, c.x + line * 0.8, c.y);
    }
    // Perfect Slice / the last cut: the whole blade flashes white.
    const fk = (now - this.flashT) / (still ? KNIFE_FX.FLASH_MS * 0.5 : KNIFE_FX.FLASH_MS);
    if (fk >= 0 && fk < 1) {
      this.glow.fillStyle(0xffffff, 0.6 * (1 - fk));
      this.glow.fillPoints(p.outline, true);
      this.glow.lineStyle(line * 8, 0xffffff, 0.35 * (1 - fk));
      this.glow.strokePoints(edge, false);
      this.glow.lineStyle(line * 2.4, 0xffffff, 0.95 * (1 - fk));
      this.glow.strokePoints(edge, false);
    }
    // Juice beads on the blade: teardrops that slide down to the edge, leaving
    // a wet streak behind them, and dry off.
    this.wet = this.wet.filter((w) => now - w.t < KNIFE_FX.WET_MS);
    for (const w of this.wet) {
      const age = (now - w.t) / KNIFE_FX.WET_MS;
      const q = along(edge, w.at);
      const slide = Phaser.Math.Easing.Sine.InOut(Math.min(1, age * 1.4));
      const up = w.from * (1 - slide * 0.85);
      const x = q.x;
      const y = q.y - H * up;
      const r = H * 0.15 * w.r * (1 - age * 0.35);
      const a = 0.92 * (1 - age * age);
      const top = q.y - H * w.from;
      this.wetGfx.lineStyle(r * 0.9, w.color, 0.3 * a);
      this.wetGfx.lineBetween(x, top, x, y - r * 0.6);
      this.wetGfx.fillStyle(w.color, a);
      this.wetGfx.fillCircle(x, y, r);
      this.wetGfx.fillTriangle(
        x - r * 0.85,
        y - r * 0.4,
        x + r * 0.85,
        y - r * 0.4,
        x,
        y - r * 2.1,
      );
      this.wetGfx.fillStyle(0x000000, 0.12 * a);
      this.wetGfx.fillCircle(x + r * 0.25, y + r * 0.3, r * 0.6);
      this.wetGfx.fillStyle(0xffffff, 0.7 * a);
      this.wetGfx.fillCircle(x - r * 0.35, y - r * 0.3, r * 0.32);
    }
    // World space: the motion trail (soft swooshes of the edge behind a moving
    // knife) and the edge's afterimage left in the cut.
    this.world.clear();
    const edgeWorld = edge.map((q) => this.toWorld(g, q));
    const tipNow = edgeWorld[edgeWorld.length - 1]!;
    const prev = this.trail[this.trail.length - 1];
    const prevTip = prev?.pts[prev.pts.length - 1];
    if (
      !still &&
      alpha > 0.5 &&
      (!prevTip || Math.hypot(tipNow.x - prevTip.x, tipNow.y - prevTip.y) > 3)
    )
      this.trail.push({ pts: edgeWorld, t: now });
    this.trail = this.trail.filter((tr) => now - tr.t < TRAIL_MS).slice(-TRAIL_MAX);
    this.trail.forEach((tr, i) => {
      const k = 1 - (now - tr.t) / TRAIL_MS;
      const c = this.tier >= 2 ? 0xffd890 : 0xffffff;
      this.world.lineStyle(line * (1 + i * 0.6), c, 0.07 + 0.2 * k * ((i + 1) / this.trail.length));
      this.world.strokePoints(tr.pts, false);
    });
    this.ghosts = this.ghosts.filter((gh) => now - gh.t < KNIFE_FX.AFTERIMAGE_MS);
    for (const gh of this.ghosts) {
      const k = (now - gh.t) / KNIFE_FX.AFTERIMAGE_MS;
      this.world.lineStyle(line * (6 - k * 3), gh.color, 0.7 * (1 - k));
      this.world.strokePoints(gh.pts, false);
    }
  }

  /** An ember rising off the hot edge (tier 2–3). */
  private ember(at: Pt, color: number): void {
    const s = this.scene;
    const w = s.scale.width;
    const dot = s.add.circle(at.x, at.y, w * Phaser.Math.FloatBetween(0.002, 0.004), color, 1);
    dot.setDepth(32).setBlendMode(Phaser.BlendModes.ADD);
    s.tweens.add({
      targets: dot,
      x: at.x + w * Phaser.Math.FloatBetween(-0.03, 0.03),
      y: at.y - w * Phaser.Math.FloatBetween(0.03, 0.07),
      alpha: 0,
      scale: 0.3,
      duration: Phaser.Math.Between(420, 700),
      ease: Phaser.Math.Easing.Sine.Out,
      onComplete: () => dot.destroy(),
    });
  }

  /** A tiny spark off the tip (tier 3). */
  private spark(at: Pt): void {
    const s = this.scene;
    const dot = s.add.circle(at.x, at.y, 1.8, 0xffe39a, 1).setDepth(32);
    dot.setBlendMode(Phaser.BlendModes.ADD);
    const a = -Math.PI / 2 + Phaser.Math.FloatBetween(-1.1, 1.1);
    const d = s.scale.width * Phaser.Math.FloatBetween(0.02, 0.05);
    s.tweens.add({
      targets: dot,
      x: at.x + Math.cos(a) * d,
      y: at.y + Math.sin(a) * d,
      alpha: 0,
      scale: 0.3,
      duration: 340,
      ease: Phaser.Math.Easing.Quadratic.Out,
      onComplete: () => dot.destroy(),
    });
  }

  destroy(): void {
    this.glow.destroy();
    this.wetGfx.destroy();
    this.world.destroy();
  }
}
