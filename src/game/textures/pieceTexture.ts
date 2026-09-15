/**
 * PIECE_TEXTURE — renders one cut piece into its own small CanvasTexture,
 * ported from knifecraft.html's `drawPieces()`/`clipHalfPlane()`: clip to
 * the ingredient's silhouette, then clip again to every half-plane
 * constraint the piece has accumulated (intersecting clips — exactly what
 * `containsPoint` computes analytically), then blit the ONE shared,
 * already-painted ingredient canvas through that clip. This is what makes
 * a diced grid cell or a julienne baton render as a real, correctly-
 * shaded slice instead of a rotated rectangle.
 */
import type { Constraint } from "../CutGeometry";

/** Clips `ctx` (already translated so world coords are canvas coords) to the half-plane on `cn.sign`'s side of its cut line — ported from clipHalfPlane(). `reach` must be large enough to cover the whole board. Exported for PreparationScene's protein-only depth-wall bake (paintProteinDepthWall), which needs the exact same half-plane clip this file already uses for every piece. */
export function clipHalfPlaneWorld(
  ctx: CanvasRenderingContext2D,
  cn: Constraint,
  cx: number,
  cy: number,
  reach: number,
): void {
  const cut = cn.cut;
  let px: number, py: number, dx: number, dy: number, nx: number, ny: number;
  if (cut.axis === "h") {
    px = cx;
    py = cut.c;
    dx = 1;
    dy = cut.slope;
  } else {
    px = cut.c;
    py = cy;
    dx = cut.slope;
    dy = 1;
  }
  const m = Math.hypot(dx, dy);
  dx /= m;
  dy /= m;
  if (cut.axis === "h") {
    nx = -cut.slope / m;
    ny = 1 / m;
  } else {
    nx = 1 / m;
    ny = -cut.slope / m;
  }
  if (cn.sign < 0) {
    nx = -nx;
    ny = -ny;
  }
  ctx.beginPath();
  ctx.moveTo(px - dx * reach, py - dy * reach);
  ctx.lineTo(px + dx * reach, py + dy * reach);
  ctx.lineTo(px + dx * reach + nx * 2 * reach, py + dy * reach + ny * 2 * reach);
  ctx.lineTo(px - dx * reach + nx * 2 * reach, py - dy * reach + ny * 2 * reach);
  ctx.closePath();
  ctx.clip();
}

/**
 * Paints one piece into `ctx` (a canvas exactly `bboxX0..bboxX1` x
 * `bboxY0..bboxY1` in world space — pad the bbox a few px before calling,
 * same as the reference's silPath pad:1.5 for pieces). `traceSilhouette`
 * draws the ingredient's own outline path in WORLD coordinates (an ellipse
 * or taper trace — see ingredientShapes.ts's factories' callers). `source`
 * is the ONE shared pre-painted ingredient canvas; `sourceOriginWorld` is
 * where that canvas's own (0,0) sits in world space.
 */
/**
 * Clips `ctx` (already translated so world coords are canvas coords) to
 * a FINITE band `w` wide along `cn.cut`'s own line, offset toward
 * whichever side `cn.sign` is on — ported from knifecraft.html's
 * `clipFaceBand(cn,w)`. Unlike `clipHalfPlaneWorld` (an infinite
 * half-plane), this is the band a protein's cut-face/cut-edge gradient
 * paints into, hugging the cut line from just inside the piece's own
 * edge. Returns the band's anchor point and outward normal so the
 * caller can build a gradient running along it. Proteins only — see
 * PreparationScene's `paintProteinCutFace`/`paintProteinCutEdges`.
 *
 * `reach` (the band's half-length along the cut line) is a caller-
 * supplied, viewport-scaled value — the same `reach` every call site
 * here already computes for `clipHalfPlaneWorld` (`Math.max(ingRx,
 * ingRy) * 6 + 200`) — rather than the source's own hardcoded `L =
 * 1000`. The source's single authored canvas never exceeds its own
 * ~540px design resolution, so a fixed 1000 is always more than
 * enough there; this project runs Phaser in `Scale.RESIZE` (see
 * GameBridge.ts), where `ingRx`/`ingRy` scale up with the real
 * viewport, so a fixed constant could in principle fall short on an
 * unusually large screen. Reusing the already-scaled `reach` removes
 * that ceiling entirely.
 */
export function clipCutBand(
  ctx: CanvasRenderingContext2D,
  cn: Constraint,
  cx: number,
  cy: number,
  w: number,
  reach: number,
): { px: number; py: number; nx: number; ny: number } {
  const cut = cn.cut;
  const L = reach;
  let px: number, py: number, dx: number, dy: number, nx: number, ny: number;
  if (cut.axis === "h") {
    px = cx;
    py = cut.c;
    dx = 1;
    dy = cut.slope;
  } else {
    px = cut.c;
    py = cy;
    dx = cut.slope;
    dy = 1;
  }
  const m = Math.hypot(dx, dy);
  dx /= m;
  dy /= m;
  if (cut.axis === "h") {
    nx = -cut.slope / m;
    ny = 1 / m;
  } else {
    nx = 1 / m;
    ny = -cut.slope / m;
  }
  if (cn.sign < 0) {
    nx = -nx;
    ny = -ny;
  }
  ctx.beginPath();
  ctx.moveTo(px - dx * L, py - dy * L);
  ctx.lineTo(px + dx * L, py + dy * L);
  ctx.lineTo(px + dx * L + nx * w, py + dy * L + ny * w);
  ctx.lineTo(px - dx * L + nx * w, py - dy * L + ny * w);
  ctx.closePath();
  ctx.clip();
  return { px, py, nx, ny };
}

export function paintPieceTexture(
  ctx: CanvasRenderingContext2D,
  bboxX0: number,
  bboxY0: number,
  traceSilhouette: (ctx: CanvasRenderingContext2D) => void,
  cons: Constraint[],
  cx: number,
  cy: number,
  reach: number,
  source: HTMLCanvasElement,
  sourceOriginWorld: { x: number; y: number },
): void {
  ctx.save();
  ctx.translate(-bboxX0, -bboxY0);
  ctx.beginPath();
  traceSilhouette(ctx);
  ctx.clip();
  for (const cn of cons) clipHalfPlaneWorld(ctx, cn, cx, cy, reach);
  ctx.drawImage(source, sourceOriginWorld.x, sourceOriginWorld.y);
  ctx.restore();
}

/**
 * Phase 6 addition — Onion Rings. A small, ADDITIVE sibling of
 * paintPieceTexture, not a replacement: the existing Cut/Piece half-plane
 * engine (CutGeometry.ts's rebuildPieces) has no radial/annulus
 * primitive, so a concentric ring band can't be expressed as a `Piece`'s
 * `cons` at all. This clips the exact same way (silhouette, then every
 * half-plane constraint the piece already carries — e.g. the one Halve
 * left behind) and ADDS one more clip on top: an ellipse annulus between
 * `ring.rxOut/ryOut` (outer) and `ring.rxIn/ryIn` (inner, 0 for the
 * innermost remaining core — a plain disc clip in that case), via the
 * "evenodd" fill rule to cut the inner ellipse out of the outer one.
 * PreparationScene.runRingCut/peelOneRingLayer are the only callers —
 * every other technique keeps using paintPieceTexture unchanged.
 */
export function paintRingPieceTexture(
  ctx: CanvasRenderingContext2D,
  bboxX0: number,
  bboxY0: number,
  traceSilhouette: (ctx: CanvasRenderingContext2D) => void,
  cons: Constraint[],
  cx: number,
  cy: number,
  reach: number,
  source: HTMLCanvasElement,
  sourceOriginWorld: { x: number; y: number },
  ring: { cx: number; cy: number; rxOut: number; ryOut: number; rxIn: number; ryIn: number },
): void {
  ctx.save();
  ctx.translate(-bboxX0, -bboxY0);
  ctx.beginPath();
  traceSilhouette(ctx);
  ctx.clip();
  for (const cn of cons) clipHalfPlaneWorld(ctx, cn, cx, cy, reach);
  ctx.beginPath();
  ctx.ellipse(
    ring.cx,
    ring.cy,
    Math.max(ring.rxOut, 0.01),
    Math.max(ring.ryOut, 0.01),
    0,
    0,
    Math.PI * 2,
  );
  if (ring.rxIn > 0.5 && ring.ryIn > 0.5) {
    ctx.ellipse(ring.cx, ring.cy, ring.rxIn, ring.ryIn, 0, 0, Math.PI * 2, true);
  }
  ctx.clip("evenodd");
  ctx.drawImage(source, sourceOriginWorld.x, sourceOriginWorld.y);
  ctx.restore();
}
