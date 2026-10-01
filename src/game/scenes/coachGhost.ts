/**
 * The beginner ghost demonstration (coaching.ts) — drawn by
 * PreparationScene on its own Graphics layer, above the ingredient and
 * guides and under the real knife. Pure drawing: the scene works out WHERE
 * (the exact spot its own tap resolution would cut next), this draws HOW,
 * as one looping cycle of COACH_CYCLE_MS:
 *
 * - "cut": the line glows; a see-through knife drops onto it, the same
 *   plunge a tap makes; a fingertip taps the line with a ripple.
 * - "drag": a fingertip sweeps across the skin that is left, leaving a
 *   pale trail (Peel).
 * - "press": a fingertip presses with a ripple; for Rings the next ring
 *   glows too.
 *
 * Shapes are drawn with Graphics only (no textures), in white at partial
 * alpha so they read as a ghost on every board and ingredient.
 */
import type Phaser from "phaser";

export const COACH_CYCLE_MS = 2200;

export type CoachTarget =
  | { kind: "cut"; x0: number; y0: number; x1: number; y1: number; tx: number; ty: number }
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
 * A see-through chef's knife whose cutting edge lies on (ex0,ey0)–(ex1,ey1),
 * handle towards the player, lifted `lift` px along the edge's upward normal.
 */
function ghostKnife(
  g: Phaser.GameObjects.Graphics,
  ex0: number,
  ey0: number,
  ex1: number,
  ey1: number,
  lift: number,
  alpha: number,
) {
  if (alpha <= 0) return;
  // The heel (and the handle behind it) sits at the end nearer the player:
  // the lower end on screen, or the left end of a flat cut — the way the
  // real knife rests, handle towards us, tip pointing away.
  const flat = Math.abs(ey1 - ey0) < Math.abs(ex1 - ex0) * 0.25;
  if (flat ? ex0 > ex1 : ey0 < ey1) {
    [ex0, ex1] = [ex1, ex0];
    [ey0, ey1] = [ey1, ey0];
  }
  const len = Math.hypot(ex1 - ex0, ey1 - ey0) || 1;
  const ux = (ex1 - ex0) / len;
  const uy = (ey1 - ey0) / len;
  // Upward normal: the side with the smaller y (or smaller x for a vertical edge).
  let nx = uy;
  let ny = -ux;
  if (ny > 0 || (Math.abs(ny) < 1e-6 && nx > 0)) {
    nx = -nx;
    ny = -ny;
  }
  const h = Math.max(10, len * 0.16);
  const P = (along: number, up: number) => ({
    x: ex0 + ux * along + nx * (up + lift),
    y: ey0 + uy * along + ny * (up + lift),
  });
  const blade = [
    P(0, 0),
    P(len * 0.72, 0),
    P(len * 0.9, h * 0.25),
    P(len, h * 0.62),
    P(len * 0.86, h),
    P(0, h),
  ];
  g.fillStyle(GHOST, 0.32 * alpha);
  g.fillPoints(blade, true);
  g.lineStyle(2, GHOST, 0.85 * alpha);
  g.strokePoints(blade, true);
  // Handle, behind the heel.
  const handle = [
    P(-len * 0.04, h * 0.15),
    P(-len * 0.38, h * 0.2),
    P(-len * 0.38, h * 0.85),
    P(-len * 0.04, h * 0.9),
  ];
  g.fillStyle(GHOST, 0.22 * alpha);
  g.fillPoints(handle, true);
  g.lineStyle(2, GHOST, 0.6 * alpha);
  g.strokePoints(handle, true);
}

/** Draws frame `t` (0..COACH_CYCLE_MS) of the demonstration for `target`; `w` is the scene width. */
export function drawCoachGhost(
  g: Phaser.GameObjects.Graphics,
  target: CoachTarget,
  t: number,
  w: number,
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
    // How: the knife comes down onto it — from a little above and closer to
    // the camera (larger), landing with its edge on the line at any angle.
    const lineLen = Math.hypot(target.x1 - target.x0, target.y1 - target.y0);
    const drop = easeInOut(span(t, 150, 850));
    const knifeAlpha = span(t, 0, 250) * (1 - span(t, 1150, 1450));
    const grow = 1.12 + 0.3 * (1 - drop); // a little longer than the cut, larger while "up"
    const mx = (target.x0 + target.x1) / 2;
    const my = (target.y0 + target.y1) / 2 - (1 - drop) * Math.max(30, lineLen * 0.35);
    const hx = ((target.x1 - target.x0) / 2) * grow;
    const hy = ((target.y1 - target.y0) / 2) * grow;
    ghostKnife(g, mx - hx, my - hy, mx + hx, my + hy, 0, knifeAlpha);
    // …because the finger taps the line.
    const fingerAlpha = span(t, 650, 850) * (1 - span(t, 1500, 1750));
    const press = span(t, 850, 950) * (1 - span(t, 1050, 1200));
    finger(g, target.tx, target.ty, fingerR, fingerAlpha, press);
    ripple(g, target.tx, target.ty, fingerR, span(t, 880, 1550));
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
