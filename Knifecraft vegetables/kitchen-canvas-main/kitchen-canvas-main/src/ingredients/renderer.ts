/**
 * Procedural render + cache layer.
 *
 * renderIngredient() paints the COMPLETE ingredient (skin, flesh, veins,
 * highlights, texture) once into a supersampled offscreen canvas in unit space.
 * drawPiece() then clips that cached bitmap with piece geometry — a cut never
 * repaints the ingredient, which is why cut faces expose the true interior.
 */
import { makeRng } from "./rng";
import { tracePoly } from "./paintUtils";
import type { Piece } from "./cutter";
import type { IngredientDefinition, Poly } from "./types";

export const SUPERSAMPLE = 2;

export type CachedIngredient = {
  canvas: HTMLCanvasElement;
  /** px per unit-space unit inside the cache. */
  pxPerUnit: number;
  size: number;
};

const cache = new Map<string, CachedIngredient>();

export function renderIngredient(def: IngredientDefinition, size = 512): CachedIngredient {
  const key = `${def.id}:${def.seed}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const px = size * SUPERSAMPLE;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const pxPerUnit = px / 2; // unit space is [-1, 1]
  ctx.save();
  ctx.translate(px / 2, px / 2);
  ctx.scale(pxPerUnit, pxPerUnit);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const geometry = def.geometry(def.seed);
  def.paint({ ctx, geometry, rnd: makeRng(def.seed ^ 0x9e37), unit: pxPerUnit });
  ctx.restore();

  const entry = { canvas, pxPerUnit, size: px };
  cache.set(key, entry);
  return entry;
}

export function clearIngredientCache() {
  cache.clear();
}

export type Viewport = {
  /** Screen position of unit-space origin. */
  cx: number;
  cy: number;
  /** Screen px for one unit-space unit. */
  radius: number;
};

function tracePolys(ctx: CanvasRenderingContext2D, polys: Poly[]) {
  ctx.beginPath();
  for (const poly of polys) {
    const first = poly[0]!;
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i]!.x, poly[i]!.y);
    ctx.closePath();
  }
}

/** Draws one cut piece by clipping the cached ingredient rendering. */
export function drawPiece(
  ctx: CanvasRenderingContext2D,
  def: IngredientDefinition,
  cached: CachedIngredient,
  piece: Piece,
  view: Viewport,
  opts: { seam?: boolean; shadow?: boolean } = {},
) {
  const { seam = true, shadow = true } = opts;
  ctx.save();
  ctx.translate(view.cx, view.cy);
  ctx.scale(view.radius, view.radius);
  // Plating transform: move/rotate the piece, paint stays anchored to source.
  ctx.translate(piece.offset.x, piece.offset.y);
  ctx.rotate(piece.rotation);

  if (shadow) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#3a2a1c";
    ctx.translate(0.02, 0.03);
    tracePolys(ctx, piece.polys);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  tracePolys(ctx, piece.polys);
  ctx.clip();
  ctx.drawImage(cached.canvas, -1, -1, 2, 2);
  ctx.restore();

  if (seam) {
    // Soft interior seam glow, clipped so it reads as an exposed cut face.
    ctx.save();
    tracePolys(ctx, piece.polys);
    ctx.clip();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = def.seamColors.inner;
    ctx.lineWidth = 0.028;
    for (const poly of piece.polys) {
      tracePoly(ctx, poly);
      ctx.stroke();
    }
    ctx.restore();

    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = def.seamColors.edge;
    ctx.lineWidth = 0.009;
    for (const poly of piece.polys) {
      tracePoly(ctx, poly);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
