import Phaser from "phaser";
import { KNIFE_FX, type BladeTier, type CutMoment } from "../knifeFeel";
import type { KnifeProfile, Pt } from "./knifeProfile";

/**
 * The knife's own effects while cutting (knifeFeel.ts says when; this draws
 * them). Two Graphics ride on the knife's own transform — one additive (the
 * glint, the heated edge, the flash), one plain (juice beads on the blade) —
 * and one more in world space (the edge's afterimage in the cut). Presentation
 * only; it never moves the knife itself (docs/KNIFE_RULES.md stays the knife's).
 */

type Wet = { at: number; up: number; color: number; r: number; t: number };
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

const TIER_EDGE: Record<BladeTier, { color: number; alpha: number; glow: number }> = {
  0: { color: 0xffffff, alpha: 0, glow: 0 },
  1: { color: 0xfff3d8, alpha: 0.35, glow: 0.08 },
  2: { color: 0xffc94a, alpha: 0.55, glow: 0.16 },
  3: { color: 0xfff0b0, alpha: 0.75, glow: 0.24 },
};

export class KnifeFx {
  private glow: Phaser.GameObjects.Graphics;
  private wetGfx: Phaser.GameObjects.Graphics;
  private world: Phaser.GameObjects.Graphics;
  private glints: { t: number; power: number }[] = [];
  private flashT = -Infinity;
  private tier: BladeTier = 0;
  private wet: Wet[] = [];
  private ghosts: Afterimage[] = [];
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
    this.flashT = -Infinity;
  }

  /** One cut landed: what it gets comes from knifeFeel.cutMoment. `juice` = the ingredient's juice colour, if any. */
  onCut(m: CutMoment, juice: number | null): void {
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
      if (m.star) this.star(this.toWorld(g, p.cuttingEdge[p.cuttingEdge.length - 1]!), m.tier);
    }
    if (juice !== null && !still) {
      const r = () => Phaser.Math.FloatBetween(0, 1);
      const n = 1 + (r() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++)
        this.wet.push({
          at: 0.2 + r() * 0.7,
          up: 0.15 + r() * 0.6,
          color: juice,
          r: 0.6 + r() * 0.7,
          t: now,
        });
      this.wet = this.wet.slice(-KNIFE_FX.WET_MAX);
    }
    if (m.flick) this.flick();
    if (m.haptic > 0 && typeof navigator !== "undefined" && "vibrate" in navigator)
      navigator.vibrate?.(m.haptic);
  }

  /** A four-point star that pops at the tip. */
  private star(at: Pt, tier: BladeTier): void {
    const s = this.scene;
    const g = s.add.graphics({ x: at.x, y: at.y }).setDepth(32).setBlendMode(Phaser.BlendModes.ADD);
    const L = s.scale.width * (0.028 + tier * 0.004);
    g.fillStyle(0xffffff, 0.95);
    g.fillPoints(
      [
        { x: 0, y: -L },
        { x: L * 0.16, y: -L * 0.16 },
        { x: L, y: 0 },
        { x: L * 0.16, y: L * 0.16 },
        { x: 0, y: L },
        { x: -L * 0.16, y: L * 0.16 },
        { x: -L, y: 0 },
        { x: -L * 0.16, y: -L * 0.16 },
      ],
      true,
    );
    g.fillStyle(tier >= 2 ? 0xffd36a : 0xfff4d6, 0.5);
    g.fillCircle(0, 0, L * 0.35);
    g.setScale(0.2).setRotation(-0.3);
    s.tweens.add({
      targets: g,
      scale: 1,
      rotation: 0.35,
      duration: 160,
      ease: Phaser.Math.Easing.Back.Out,
      onComplete: () =>
        s.tweens.add({
          targets: g,
          alpha: 0,
          scale: 0.6,
          duration: 260,
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
        Math.max(1.2, s.scale.width * 0.004 * w.r),
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
    // The heated edge (tier 1–3), pulsing at tier 3.
    const t = TIER_EDGE[this.tier];
    if (t.alpha > 0) {
      const pulse = this.tier >= 3 && !still ? 0.8 + 0.2 * Math.sin(now / 90) : 1;
      this.glow.lineStyle(line * 5, t.color, t.glow * pulse);
      this.glow.strokePoints(edge, false);
      this.glow.lineStyle(line * 1.4, t.color, t.alpha * pulse);
      this.glow.strokePoints(edge, false);
      // Tier 3: now and then a spark leaps off the tip.
      if (this.tier >= 3 && !still && now - this.lastSparkAt > 240) {
        this.lastSparkAt = now;
        this.spark(this.toWorld(g, edge[edge.length - 1]!));
      }
    }
    // The glint: a bright run heel → tip along the edge, the spine just behind.
    this.glints = this.glints.filter((gl) => now - gl.t < KNIFE_FX.GLINT_MS);
    for (const gl of this.glints) {
      const k = (now - gl.t) / KNIFE_FX.GLINT_MS;
      if (k < 0) continue;
      const fade = Math.sin(Math.PI * k) * gl.power;
      const span = KNIFE_FX.GLINT_SPAN;
      this.glow.lineStyle(line * 4, 0xffffff, 0.25 * fade);
      this.glow.strokePoints(slice(edge, k - span, k + span), false);
      this.glow.lineStyle(line * 1.6, 0xffffff, 0.95 * fade);
      this.glow.strokePoints(slice(edge, k - span * 0.5, k + span * 0.5), false);
      this.glow.lineStyle(line, 0xffffff, 0.5 * fade);
      this.glow.strokePoints(slice(p.spine, k - 0.08 - span * 0.4, k - 0.08 + span * 0.4), false);
      const c = along(edge, k);
      this.glow.fillStyle(0xffffff, 0.6 * fade);
      this.glow.fillCircle(c.x, c.y, line * 2.2);
    }
    // Perfect Slice: the whole blade flashes white.
    const fk = (now - this.flashT) / (still ? KNIFE_FX.FLASH_MS * 0.5 : KNIFE_FX.FLASH_MS);
    if (fk >= 0 && fk < 1) {
      this.glow.fillStyle(0xffffff, 0.45 * (1 - fk));
      this.glow.fillPoints(p.outline, true);
      this.glow.lineStyle(line * 2, 0xffffff, 0.9 * (1 - fk));
      this.glow.strokePoints(edge, false);
    }
    // Juice beads on the blade: they slide down to the edge and dry off.
    this.wet = this.wet.filter((w) => now - w.t < KNIFE_FX.WET_MS);
    for (const w of this.wet) {
      const age = (now - w.t) / KNIFE_FX.WET_MS;
      const q = along(edge, w.at);
      const up = w.up * (1 - age * 0.8);
      const x = q.x;
      const y = q.y - H * up;
      const r = H * 0.07 * w.r * (1 - age * 0.3);
      const a = 0.85 * (1 - age * age);
      this.wetGfx.fillStyle(w.color, a);
      this.wetGfx.fillEllipse(x, y, r * 2.2, r * 1.7);
      this.wetGfx.fillStyle(0xffffff, 0.6 * a);
      this.wetGfx.fillCircle(x - r * 0.35, y - r * 0.3, r * 0.35);
    }
    // The edge's afterimage, left in the cut and fading.
    this.world.clear();
    this.ghosts = this.ghosts.filter((gh) => now - gh.t < KNIFE_FX.AFTERIMAGE_MS);
    for (const gh of this.ghosts) {
      const k = (now - gh.t) / KNIFE_FX.AFTERIMAGE_MS;
      this.world.lineStyle(line * (3 - k * 2), gh.color, 0.45 * (1 - k));
      this.world.strokePoints(gh.pts, false);
    }
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
