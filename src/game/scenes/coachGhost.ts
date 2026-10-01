/**
 * The beginner ghost demonstration (coaching.ts) — drawn by
 * PreparationScene on its own Graphics layer, above the ingredient and
 * guides and under the real knife. Pure drawing: the scene works out WHERE
 * (the exact spot its own tap resolution would cut next), this draws HOW,
 * as one looping cycle of COACH_CYCLE_MS:
 *
 * - "cut": the line glows; a see-through copy of the equipped knife brings
 *   its sharp edge down onto it and slices through, tip first (the stretch
 *   the edge touches lights up); then a fingertip taps the line.
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
import { knifeProfile, type KnifeProfile } from "./knifeProfile";

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
 * knife is drawn from), its curved cutting edge on the cut line, slicing.
 * `along` = how far (px) the heel sits along the line from its near end;
 * `lift` = how far the edge is still above the line, on the spine side.
 * Handle towards the player: at the line's lower end, or its left end for
 * a flat cut. The spine faces away from the ingredient's centre, so the
 * sharp edge is what meets the food.
 */
function ghostKnife(
  g: Phaser.GameObjects.Graphics,
  cut: Extract<CoachTarget, { kind: "cut" }>,
  profile: KnifeProfile,
  along: number,
  lift: number,
  alpha: number,
): { from: number; to: number } {
  const { x0, y0, x1, y1 } = cutNearEnd(cut);
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  // Spine side: away from the ingredient's centre (or up, for a cut through it).
  let nx = -uy;
  let ny = ux;
  const away = ((x0 + x1) / 2 - cut.cx) * nx + ((y0 + y1) / 2 - cut.cy) * ny;
  if (Math.abs(away) > 2 ? away < 0 : ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  // Local (x along heel→tip, y with the blade body at y < 0) → world.
  const ox = x0 + ux * (along - profile.heel) + nx * lift;
  const oy = y0 + uy * (along - profile.heel) + ny * lift;
  const P = (p: { x: number; y: number }) => ({
    x: ox + ux * p.x - nx * p.y,
    y: oy + uy * p.x - ny * p.y,
  });
  if (alpha > 0) {
    const { bladeH, heel, handleLen, edge } = profile;
    const rect = (x: number, y: number, w: number, h: number) =>
      [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ].map(P);
    // Handle and bolster, behind the heel.
    const handle = rect(heel - 7 - handleLen, -bladeH * 0.45 - edge, handleLen, bladeH * 0.9);
    g.fillStyle(GHOST, 0.2 * alpha);
    g.fillPoints(handle, true);
    g.lineStyle(1.5, GHOST, 0.6 * alpha);
    g.strokePoints(handle, true);
    g.fillStyle(GHOST, 0.45 * alpha);
    g.fillPoints(rect(heel - 7, -bladeH * 0.5 - edge, 7, bladeH), true);
    // Blade body.
    const blade = profile.outline.map(P);
    g.fillStyle(GHOST, 0.3 * alpha);
    g.fillPoints(blade, true);
    g.lineStyle(1.5, GHOST, 0.7 * alpha);
    g.strokePoints(blade, true);
    // The sharp edge — the part that cuts — glows.
    const edgePts = profile.cuttingEdge.map(P);
    g.lineStyle(5, GLOW, 0.35 * alpha);
    g.strokePoints(edgePts, false);
    g.lineStyle(2, GHOST, 0.95 * alpha);
    g.strokePoints(edgePts, false);
  }
  // The stretch of the line the edge covers right now (0..len, from the near end).
  return { from: Math.max(0, along), to: Math.min(len, along + profile.tip - profile.heel) };
}

/** The cut line ordered from its near end (lower on screen, or left for a flat cut) — the same order ghostKnife uses. */
function cutNearEnd(cut: Extract<CoachTarget, { kind: "cut" }>) {
  const { x0, y0, x1, y1 } = cut;
  const flat = Math.abs(y1 - y0) < Math.abs(x1 - x0) * 0.25;
  return (flat ? x0 > x1 : y0 < y1) ? { x0: x1, y0: y1, x1: x0, y1: y0 } : { x0, y0, x1, y1 };
}

/** Draws frame `t` (0..COACH_CYCLE_MS) of the demonstration for `target`; `w` is the scene width. */
export function drawCoachGhost(
  g: Phaser.GameObjects.Graphics,
  target: CoachTarget,
  t: number,
  w: number,
  blade: KnifeBladeShape,
): void {
  g.clear();
  const fingerR = Math.max(12, w * 0.032);
  const pulse = 0.5 + 0.5 * Math.sin((t / COACH_CYCLE_MS) * Math.PI * 4);

  if (target.kind === "cut") {
    // Where: the glowing line.
    g.lineStyle(10, GLOW, 0.16 + 0.1 * pulse);
    g.lineBetween(target.x0, target.y0, target.x1, target.y1);
    g.lineStyle(3, GLOW, 0.65 + 0.3 * pulse);
    g.lineBetween(target.x0, target.y0, target.x1, target.y1);
    // How: the knife's sharp edge comes down onto the line, then slices
    // through — the blade pushed forward, tip first, along the cut.
    const profile = knifeProfile(blade, w);
    const lineLen = Math.hypot(target.x1 - target.x0, target.y1 - target.y0);
    const edgeLen = profile.tip - profile.heel;
    const knifeAlpha = span(t, 0, 200) * (1 - span(t, 1150, 1400));
    const lower = easeInOut(span(t, 150, 450));
    const slice = easeInOut(span(t, 450, 1100));
    // The edge's middle starts behind the line's middle and passes beyond it.
    const along = lineLen / 2 - edgeLen / 2 + (slice - 0.5) * edgeLen * 0.5;
    const lift = (1 - lower) * Math.max(18, profile.bladeH * 1.2);
    const covered = ghostKnife(g, target, profile, along, lift, knifeAlpha);
    if (lower >= 1 && knifeAlpha > 0 && covered.to > covered.from) {
      // Where the edge touches, the line lights up: this is the cut.
      const k0 = covered.from / lineLen;
      const k1 = covered.to / lineLen;
      const nearEnd = cutNearEnd(target);
      const ax = nearEnd.x0 + (nearEnd.x1 - nearEnd.x0) * k0;
      const ay = nearEnd.y0 + (nearEnd.y1 - nearEnd.y0) * k0;
      const bx = nearEnd.x0 + (nearEnd.x1 - nearEnd.x0) * k1;
      const by = nearEnd.y0 + (nearEnd.y1 - nearEnd.y0) * k1;
      g.lineStyle(5, GHOST, 0.75 * knifeAlpha);
      g.lineBetween(ax, ay, bx, by);
    }
    // …because the finger taps the line.
    const fingerAlpha = span(t, 1150, 1300) * (1 - span(t, 1900, 2150));
    const press = span(t, 1300, 1400) * (1 - span(t, 1500, 1650));
    finger(g, target.tx, target.ty, fingerR, fingerAlpha, press);
    ripple(g, target.tx, target.ty, fingerR, span(t, 1330, 2000));
    return;
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
    return;
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
}
