/**
 * POLYGON_CANVAS — small Canvas2D equivalents of the reference ("Lovable")
 * art batch's Phaser-Graphics-based shapeUtils.ts (`place`, `fillPoly`,
 * `strokePoly`, `groundShadow`, `softHighlight`, `shrinkToward`), shared by
 * every "polygon"-shape ingredient's texture file (mushroom/pepper/bread/
 * strawberry/apple) the same way that file's own shapeUtils.ts is shared
 * by all of its ingredient files. Kept as close to the reference's own
 * call signatures as possible so each ported ingredient file reads like a
 * direct translation, not a reinterpretation.
 *
 * The one real difference from the reference: `place()` here also folds
 * in a per-shape recentering offset (see ingredientShapes.ts's
 * `polygonBoundsCenter`) so an ingredient's world anchor (cx,cy) lands on
 * its own true bounding-box center — required by this engine's generic
 * dead-zone-safe `reachX`/`reachY` convention (PreparationScene.ts),
 * which the reference's own game doesn't need to satisfy. It's an
 * invisible shift (the whole shape moves together), not a redesign.
 */
import type { LocalPoint } from "../ingredientShapes";

/** A local-space point placed into canvas-local (world-equivalent) space, offset-corrected. */
export function place(
  pts: readonly LocalPoint[],
  origin: LocalPoint,
  cx: number,
  cy: number,
  scale: number,
): LocalPoint[] {
  return pts.map((p) => ({ x: cx + (p.x - origin.x) * scale, y: cy + (p.y - origin.y) * scale }));
}

/** 0xRRGGBB -> CSS "#rrggbb". */
export function hex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function tracePts(ctx: CanvasRenderingContext2D, pts: readonly LocalPoint[]): void {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

/** Canvas2D equivalent of shapeUtils.ts's `fillPoly`. */
export function fillPoly(
  ctx: CanvasRenderingContext2D,
  pts: readonly LocalPoint[],
  color: number,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = hex(color);
  tracePts(ctx, pts);
  ctx.fill();
  ctx.restore();
}

/** Canvas2D equivalent of shapeUtils.ts's `strokePoly`. `closed` false leaves the path open (an open polyline, not a ring). */
export function strokePoly(
  ctx: CanvasRenderingContext2D,
  pts: readonly LocalPoint[],
  color: number,
  width: number,
  alpha = 1,
  closed = true,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = hex(color);
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  if (closed) ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** Shrink a (already-placed, canvas-local) polygon toward a canvas-local point — shapeUtils.ts's `shrinkToward`, used to build inner shading/highlight regions as smaller offset copies of the same silhouette. */
export function shrinkToward(
  pts: readonly LocalPoint[],
  tx: number,
  ty: number,
  k: number,
): LocalPoint[] {
  return pts.map((p) => ({ x: p.x + (tx - p.x) * k, y: p.y + (ty - p.y) * k }));
}

/** Canvas2D equivalent of shapeUtils.ts's `groundShadow` — a soft layered drop shadow under an ingredient, matching the shared upper-left key light. cx,cy is the shadow ellipse's own canvas-local center. */
export function groundShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  ctx.save();
  ctx.fillStyle = hex(0x3e2819);
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = 0.06 * i;
    ctx.beginPath();
    ctx.ellipse(cx + rx * 0.12, cy, rx * (1 + i * 0.12), ry * (1 + i * 0.16), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Canvas2D equivalent of shapeUtils.ts's `softHighlight` — a soft, layered specular highlight. */
export function softHighlight(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color = 0xfff7e8,
  strength = 0.5,
  angle = -0.5,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = hex(color);
  for (let i = 4; i >= 1; i--) {
    ctx.globalAlpha = (strength / 4) * (5 - i) * 0.5;
    const s = i / 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * s, ry * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
