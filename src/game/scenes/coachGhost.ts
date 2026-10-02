/**
 * The beginner ghost demonstration (coaching.ts) — drawn by
 * PreparationScene on its own Graphics layer, above the ingredient and
 * guides and under the real knife. Pure drawing: the scene works out WHERE
 * (the exact spot its own tap resolution would cut next), this draws HOW,
 * as one looping cycle (coachCycleMs):
 *
 * - "cut": the line glows, then both ways to cut it, labelled. The
 *   see-through knife is held like the real one (cuttingRot / cuttingStroke):
 *   the blade lies ALONG the cut line, handle at the player's end, and
 *   slides along it tip-first — vertically for a vertical cut, never
 *   sideways across it. SWIPE: the fingertip draws along the line with the
 *   knife riding on it. TAP: the fingertip taps and the knife makes the same
 *   quick slice the real tap cut makes. The cut lights up.
 * - "drag": a fingertip sweeps across the skin that is left, leaving a
 *   pale trail (Peel).
 * - "press": a fingertip presses with a ripple; for Rings the next ring
 *   glows too.
 *
 * Shapes are drawn with Graphics only (no textures), in white at partial
 * alpha so they read as a ghost on every board and ingredient.
 */
import type Phaser from "phaser";
import type { KnifeBladeShape } from "../knives/knifeTypes";
import { band, cuttingRot, cuttingStroke, knifeProfile, type KnifeProfile } from "./knifeProfile";

export const COACH_CYCLE_MS = 2200;

export type CoachTarget =
  | {
      kind: "cut";
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      /** Where the demonstration taps. */
      tx: number;
      ty: number;
      /** The ingredient's centre — the knife's spine faces away from it. */
      cx: number;
      cy: number;
    }
  | { kind: "drag"; x0: number; y0: number; x1: number; y1: number; width: number }
  | {
      kind: "press";
      x: number;
      y: number;
      ring?: { cx: number; cy: number; rx: number; ry: number };
    };

const GHOST = 0xffffff;
const GLOW = 0xffd36b;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 0→1 over [a, b]. */
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeOut = (k: number) => 1 - (1 - k) * (1 - k) * (1 - k);
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/** A fingertip: soft halo + pad, `press` 0..1 squashes it a little. */
function finger(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  alpha: number,
  press = 0,
) {
  if (alpha <= 0) return;
  const pr = r * (1 - 0.18 * press);
  g.fillStyle(GHOST, 0.18 * alpha);
  g.fillCircle(x, y, pr * 1.55);
  g.fillStyle(GHOST, 0.6 * alpha);
  g.fillCircle(x, y, pr);
  g.lineStyle(2, GHOST, 0.9 * alpha);
  g.strokeCircle(x, y, pr);
}

function ripple(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, k: number) {
  if (k <= 0 || k >= 1) return;
  g.lineStyle(3, GLOW, 0.85 * (1 - k));
  g.strokeCircle(x, y, r * (1 + 1.8 * easeOut(k)));
}

/**
 * A see-through copy of the equipped knife (the same knifeProfile the real
 * knife is drawn from) with its local origin — a point on the cutting edge —
 * at (px, py), turned `rot` radians the way PreparationScene turns the real
 * knife (cuttingRot: along the cut line, tip away from the player). Fills only (thin strokes break into dots in WebGL).
 */
function ghostKnifeAt(
  g: Phaser.GameObjects.Graphics,
  profile: KnifeProfile,
  px: number,
  py: number,
  rot: number,
  alpha: number,
): void {
  if (alpha <= 0) return;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const P = (q: { x: number; y: number }) => ({
    x: px + q.x * c - q.y * s,
    y: py + q.x * s + q.y * c,
  });
  const H = profile.bladeH;
  // Handle and bolster, behind the heel.
  g.fillStyle(GHOST, 0.2 * alpha);
  g.fillPoints(profile.handle.map(P), true);
  g.fillStyle(GHOST, 0.45 * alpha);
  g.fillPoints(profile.bolster.map(P), true);
  // Blade body, with a light rim along the spine.
  g.fillStyle(GHOST, 0.3 * alpha);
  g.fillPoints(profile.outline.map(P), true);
  g.fillStyle(GHOST, 0.5 * alpha);
  g.fillPoints(band(profile.spine, Math.max(1, H * 0.06), 1).map(P), true);
  // The sharp edge — the part that cuts — glows.
  g.fillStyle(GLOW, 0.4 * alpha);
  g.fillPoints(band(profile.cuttingEdge, Math.max(2, H * 0.16), -1).map(P), true);
  g.fillStyle(GHOST, 0.95 * alpha);
  g.fillPoints(band(profile.cuttingEdge, Math.max(1.2, H * 0.06), -1).map(P), true);
}

/** The cut line ordered the way the knife slides along it (cuttingRot): near (handle) end first. */
function cutNearEnd(cut: Extract<CoachTarget, { kind: "cut" }>) {
  const { x0, y0, x1, y1 } = cut;
  const rot = cuttingRot((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI);
  const forward = (x1 - x0) * Math.cos(rot) + (y1 - y0) * Math.sin(rot) >= 0;
  return forward ? { x0, y0, x1, y1 } : { x0: x1, y0: y1, x1: x0, y1: y0 };
}

/** A label drawn by the scene next to the fingertip: which gesture this part of the loop shows. */
export type CoachLabel = { text: string; x: number; y: number; alpha: number };

/** How long one loop of the demonstration for `target` lasts. */
export function coachCycleMs(target: CoachTarget): number {
  return target.kind === "cut" ? COACH_CUT_CYCLE_MS : COACH_CYCLE_MS;
}

/** Cutting demonstrates both inputs: SWIPE (0–SWIPE_PART_MS) then TAP. */
const SWIPE_PART_MS = 1500;
export const COACH_CUT_CYCLE_MS = 3000;

/**
 * Draws frame `t` (0..coachCycleMs) of the demonstration for `target`; `w`
 * is the scene width, `blade` the equipped knife's shape. Returns the label
 * to show by the fingertip (or null).
 */
export function drawCoachGhost(
  g: Phaser.GameObjects.Graphics,
  target: CoachTarget,
  t: number,
  w: number,
  blade: KnifeBladeShape,
): CoachLabel | null {
  g.clear();
  const fingerR = Math.max(12, w * 0.032);
  const pulse = 0.5 + 0.5 * Math.sin((t / COACH_CYCLE_MS) * Math.PI * 4);
  const label = (text: string, x: number, y: number, alpha: number): CoachLabel | null =>
    alpha > 0 ? { text, x: x + fingerR * 1.5, y: y - fingerR * 1.7, alpha } : null;

  if (target.kind === "cut") {
    // Where: the glowing line.
    g.lineStyle(10, GLOW, 0.16 + 0.1 * pulse);
    g.lineBetween(target.x0, target.y0, target.x1, target.y1);
    g.lineStyle(3, GLOW, 0.65 + 0.3 * pulse);
    g.lineBetween(target.x0, target.y0, target.x1, target.y1);
    const profile = knifeProfile(blade, w);
    const line = cutNearEnd(target);
    const lineLen = Math.hypot(line.x1 - line.x0, line.y1 - line.y0);
    const at = (d: number) => {
      const k = Math.max(0, Math.min(1, d / lineLen));
      return { x: line.x0 + (line.x1 - line.x0) * k, y: line.y0 + (line.y1 - line.y0) * k };
    };
    // The real knife's pose and stroke for this cut (cuttingStroke): the
    // blade lies on the line and slides along it, tip first.
    const lineDeg = (Math.atan2(line.y1 - line.y0, line.x1 - line.x0) * 180) / Math.PI;
    const rot = cuttingRot(lineDeg);
    const ux = Math.cos(rot);
    const uy = Math.sin(rot);
    const lightUp = (d0: number, d1: number, alpha: number) => {
      if (alpha <= 0 || d1 <= d0) return;
      const a = at(d0);
      const b = at(d1);
      g.lineStyle(5, GHOST, 0.75 * alpha);
      g.lineBetween(a.x, a.y, b.x, b.y);
    };

    if (t < SWIPE_PART_MS) {
      // SWIPE: the fingertip draws along the line from its near end and the
      // knife rides on the line with it, its heel at the fingertip and the
      // blade lying ahead along the cut.
      const knifeAlpha = span(t, 0, 200) * (1 - span(t, 1200, 1450));
      const slice = easeInOut(span(t, 300, 1150));
      const fingerAlpha = span(t, 150, 300) * (1 - span(t, 1150, 1350));
      const d = lineLen * (0.08 + 0.84 * slice);
      const p = at(d);
      ghostKnifeAt(g, profile, p.x, p.y, rot, knifeAlpha);
      if (slice > 0) lightUp(0, d, knifeAlpha);
      finger(g, p.x, p.y, fingerR, fingerAlpha, 0.6);
      return label("SWIPE", p.x, p.y, fingerAlpha);
    }

    // TAP: the fingertip taps the line and the knife makes the real tap
    // cut's slice — along the line, tip first, through the whole cut.
    const t2 = t - SWIPE_PART_MS;
    const fingerAlpha = span(t2, 0, 150) * (1 - span(t2, 1000, 1250));
    const press = span(t2, 200, 300) * (1 - span(t2, 450, 600));
    const knifeAlpha = span(t2, 150, 300) * (1 - span(t2, 950, 1200));
    const mid = { x: (line.x0 + line.x1) / 2, y: (line.y0 + line.y1) / 2 };
    const stroke = cuttingStroke(mid, lineDeg, lineLen / 2, profile.tip);
    const k = easeInOut(span(t2, 300, 650));
    ghostKnifeAt(
      g,
      profile,
      stroke.from.x + (stroke.to.x - stroke.from.x) * k,
      stroke.from.y + (stroke.to.y - stroke.from.y) * k,
      rot,
      knifeAlpha,
    );
    // The cut opens behind the tip as it slides through.
    const tipAlong = (stroke.from.x - line.x0) * ux + (stroke.from.y - line.y0) * uy + profile.tip;
    const travel = Math.hypot(stroke.to.x - stroke.from.x, stroke.to.y - stroke.from.y);
    if (k > 0) lightUp(0, Math.min(lineLen, tipAlong + travel * k), knifeAlpha);
    finger(g, target.tx, target.ty, fingerR, fingerAlpha, press);
    ripple(g, target.tx, target.ty, fingerR, span(t2, 230, 900));
    return label("TAP", target.tx, target.ty, fingerAlpha);
  }

  if (target.kind === "drag") {
    const k = easeInOut(span(t, 250, 1450));
    const alpha = span(t, 0, 250) * (1 - span(t, 1650, 1950));
    const x = target.x0 + (target.x1 - target.x0) * k;
    const y = target.y0 + (target.y1 - target.y0) * k;
    if (k > 0) {
      g.lineStyle(target.width, GHOST, 0.22 * alpha);
      g.lineBetween(target.x0, target.y0, x, y);
      g.lineStyle(2, GLOW, 0.7 * alpha);
      g.lineBetween(target.x0, target.y0, x, y);
    }
    finger(g, x, y, fingerR, alpha, k > 0 && k < 1 ? 0.6 : 0);
    return label("DRAG", x, y, alpha);
  }

  if (target.ring) {
    const r = target.ring;
    g.lineStyle(3, GLOW, 0.5 + 0.4 * pulse);
    g.strokeEllipse(r.cx, r.cy, r.rx * 2, r.ry * 2);
  }
  const alpha = span(t, 0, 300) * (1 - span(t, 1500, 1800));
  const press = span(t, 400, 550) * (1 - span(t, 700, 900));
  finger(g, target.x, target.y, fingerR, alpha, press);
  ripple(g, target.x, target.y, fingerR, span(t, 480, 1250));
  ripple(g, target.x, target.y, fingerR * 1.6, span(t, 620, 1400));
  return label(target.ring ? "TAP" : "PRESS", target.x, target.y, alpha);
}
