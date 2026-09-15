/** Painting helpers shared by every ingredient paint function. */
import { centroid, inset } from "./primitives";
import type { Poly, Vec } from "./types";

export function tracePoly(ctx: CanvasRenderingContext2D, poly: Poly) {
  ctx.beginPath();
  const first = poly[0]!;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i]!.x, poly[i]!.y);
  ctx.closePath();
}

export function fillPoly(ctx: CanvasRenderingContext2D, poly: Poly, fill: string | CanvasGradient) {
  tracePoly(ctx, poly);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokePoly(
  ctx: CanvasRenderingContext2D,
  poly: Poly,
  color: string,
  width: number,
) {
  tracePoly(ctx, poly);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.stroke();
}

/** Paints the band between a polygon and its inset copy (skin / crust / rind). */
export function fillBand(
  ctx: CanvasRenderingContext2D,
  poly: Poly,
  thickness: number,
  fill: string | CanvasGradient,
) {
  const innerPoly = inset(poly, thickness).slice().reverse();
  ctx.beginPath();
  const a = poly[0]!;
  ctx.moveTo(a.x, a.y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i]!.x, poly[i]!.y);
  ctx.closePath();
  const b = innerPoly[0]!;
  ctx.moveTo(b.x, b.y);
  for (let i = 1; i < innerPoly.length; i++) ctx.lineTo(innerPoly[i]!.x, innerPoly[i]!.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill("evenodd");
}

export function radial(
  ctx: CanvasRenderingContext2D,
  c: Vec,
  r0: number,
  r1: number,
  stops: [number, string][],
  focus: Vec = c,
) {
  const g = ctx.createRadialGradient(focus.x, focus.y, r0, c.x, c.y, r1);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

export function linear(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, stops: [number, string][]) {
  const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

/** Subtle painterly speckle constrained to the current clip. */
export function speckle(
  ctx: CanvasRenderingContext2D,
  poly: Poly,
  rnd: () => number,
  count: number,
  color: string,
  rMin: number,
  rMax: number,
  alpha = 0.25,
) {
  const c = centroid(poly);
  let maxR = 0;
  for (const p of poly) maxR = Math.max(maxR, Math.hypot(p.x - c.x, p.y - c.y));
  ctx.save();
  tracePoly(ctx, poly);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd()) * maxR;
    const r = rMin + rnd() * (rMax - rMin);
    ctx.beginPath();
    ctx.ellipse(
      c.x + Math.cos(a) * rr,
      c.y + Math.sin(a) * rr,
      r,
      r * (0.6 + rnd() * 0.8),
      rnd() * 3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

/** Soft cozy highlight blob. */
export function highlight(
  ctx: CanvasRenderingContext2D,
  poly: Poly,
  at: Vec,
  r: number,
  color: string,
  alpha = 0.5,
) {
  ctx.save();
  tracePoly(ctx, poly);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = radial(ctx, at, 0, r, [
    [0, color],
    [1, "rgba(255,255,255,0)"],
  ]);
  ctx.beginPath();
  ctx.ellipse(at.x, at.y, r, r * 0.8, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function withClip(ctx: CanvasRenderingContext2D, poly: Poly, draw: () => void) {
  ctx.save();
  tracePoly(ctx, poly);
  ctx.clip();
  draw();
  ctx.restore();
}

/**
 * Base/tip endpoints of a `leaf()` polygon (primitives.ts): vertex 0 is
 * always the petiole-end base, and the farthest vertex from it is the tip.
 * Robust to whatever `segments` the leaf was built with.
 */
export function leafAxis(poly: Poly): { base: Vec; tip: Vec } {
  const base = poly[0]!;
  let tip = base;
  let maxD = 0;
  for (const p of poly) {
    const d = Math.hypot(p.x - base.x, p.y - base.y);
    if (d > maxD) {
      maxD = d;
      tip = p;
    }
  }
  return { base, tip };
}

/**
 * Shared leaf-blade paint: fill, optional darker edge band, a central vein
 * with branching secondary veins, a soft highlight, and an outline. Colors
 * and fill gradient stay ingredient-specific (basil vs parsley pass their
 * own `fill` callback and palette) — only the mechanics are shared.
 */
export function paintLeafBlade(
  ctx: CanvasRenderingContext2D,
  poly: Poly,
  opts: {
    fill: (axis: { base: Vec; tip: Vec }) => string | CanvasGradient;
    edgeColor?: string;
    edgeThickness?: number;
    veinColor?: string;
    veinAlpha?: number;
    highlightColor?: string;
    highlightAlpha?: number;
    strokeColor?: string;
    strokeWidth?: number;
  },
) {
  const axis = leafAxis(poly);
  fillPoly(ctx, poly, opts.fill(axis));
  if (opts.edgeColor) fillBand(ctx, poly, opts.edgeThickness ?? 0.012, opts.edgeColor);

  if (opts.veinColor) {
    withClip(ctx, poly, () => {
      const { base, tip } = axis;
      const dx = tip.x - base.x;
      const dy = tip.y - base.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy;
      const py = ux;
      const alpha = opts.veinAlpha ?? 0.35;
      ctx.strokeStyle = opts.veinColor!;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(0.003, len * 0.012);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.lineWidth = Math.max(0.002, len * 0.007);
      ctx.globalAlpha = alpha * 0.7;
      for (let k = 1; k < 5; k++) {
        const t = k / 5;
        const cx = base.x + dx * t;
        const cy = base.y + dy * t;
        const spread = len * 0.15 * (1 - t * 0.4);
        for (const side of [1, -1]) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.quadraticCurveTo(
            cx + px * side * spread * 0.5 + ux * spread * 0.3,
            cy + py * side * spread * 0.5 + uy * spread * 0.3,
            cx + px * side * spread + ux * spread * 0.55,
            cy + py * side * spread + uy * spread * 0.55,
          );
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    });
  }

  if (opts.highlightColor) {
    const { base, tip } = axis;
    const at = { x: base.x + (tip.x - base.x) * 0.35, y: base.y + (tip.y - base.y) * 0.35 };
    const r = Math.hypot(tip.x - base.x, tip.y - base.y) * 0.35;
    highlight(ctx, poly, at, r, opts.highlightColor, opts.highlightAlpha ?? 0.4);
  }

  strokePoly(ctx, poly, opts.strokeColor ?? "rgba(20,40,15,0.35)", opts.strokeWidth ?? 0.008);
}
