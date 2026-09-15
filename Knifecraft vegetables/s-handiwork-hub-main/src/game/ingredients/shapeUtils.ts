import type Phaser from "phaser";
import type { Bounds, Pt } from "./types";

/** Deterministic 1D value noise — same silhouette every run, no Math.random. */
export function noise(t: number, seed = 1): number {
  return (
    0.6 * Math.sin(t * 2.7 + seed * 12.9898) +
    0.3 * Math.sin(t * 5.3 + seed * 78.233) +
    0.1 * Math.sin(t * 11.1 + seed * 39.425)
  );
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Sample a closed parametric curve into a dense polygon. */
export function sampleClosed(steps: number, fn: (t: number) => Pt): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < steps; i++) out.push(fn(i / steps));
  return out;
}

/** Closed polygon from a polar radius function r(theta). */
export function polarShape(steps: number, r: (theta: number) => number): Pt[] {
  return sampleClosed(steps, (t) => {
    const a = t * Math.PI * 2;
    const rad = r(a);
    return { x: Math.cos(a) * rad, y: Math.sin(a) * rad };
  });
}

/**
 * Closed polygon from a vertical width profile.
 * `halfWidth(v)` is the half width at normalised height v (0 = top, 1 = bottom).
 * `bulge` optionally offsets the centre line to break symmetry.
 */
export function profileShape(
  steps: number,
  top: number,
  bottom: number,
  halfWidth: (v: number) => number,
  centreOffset: (v: number) => number = () => 0,
): Pt[] {
  const right: Pt[] = [];
  const left: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const v = i / steps;
    const y = lerp(top, bottom, v);
    const hw = Math.max(0, halfWidth(v));
    const c = centreOffset(v);
    right.push({ x: c + hw, y });
    left.push({ x: c - hw, y });
  }
  return [...right, ...left.reverse()];
}

export function translate(pts: Pt[], dx: number, dy: number): Pt[] {
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

export function scalePts(pts: Pt[], sx: number, sy = sx, cx = 0, cy = 0): Pt[] {
  return pts.map((p) => ({ x: cx + (p.x - cx) * sx, y: cy + (p.y - cy) * sy }));
}

/** Shrink a polygon toward a point — used to build inner shading / highlight shapes. */
export function shrinkToward(pts: Pt[], cx: number, cy: number, k: number): Pt[] {
  return pts.map((p) => ({ x: lerp(p.x, cx, k), y: lerp(p.y, cy, k) }));
}

export function boundsOf(pts: Pt[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Place a local-space polygon into world space. */
export function place(pts: Pt[], x: number, y: number, scale: number): Pt[] {
  return pts.map((p) => ({ x: x + p.x * scale, y: y + p.y * scale }));
}

export function fillPoly(
  g: Phaser.GameObjects.Graphics,
  pts: Pt[],
  color: number,
  alpha = 1,
): void {
  g.fillStyle(color, alpha);
  g.fillPoints(pts as unknown as Phaser.Math.Vector2[], true, true);
}

export function strokePoly(
  g: Phaser.GameObjects.Graphics,
  pts: Pt[],
  color: number,
  width: number,
  alpha = 1,
  closed = true,
): void {
  g.lineStyle(width, color, alpha);
  g.strokePoints(pts as unknown as Phaser.Math.Vector2[], closed, closed);
}

/** Soft drop shadow under an ingredient, matching the shared upper-left key light. */
export function groundShadow(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  rx: number,
  ry: number,
): void {
  for (let i = 3; i >= 1; i--) {
    g.fillStyle(0x3e2819, 0.06 * i);
    g.fillEllipse(x + rx * 0.12, y, rx * (1 + i * 0.12), ry * (1 + i * 0.16));
  }
}

/** A soft, layered specular highlight (upper-left key light). */
export function softHighlight(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color = 0xfff7e8,
  strength = 0.5,
  angle = -0.5,
): void {
  for (let i = 4; i >= 1; i--) {
    g.fillStyle(color, (strength / 4) * (5 - i) * 0.5);
    const s = i / 2.2;
    g.save();
    g.translateCanvas(x, y);
    g.rotateCanvas(angle);
    g.fillEllipse(0, 0, rx * s, ry * s);
    g.restore();
  }
}
