/**
 * BOARD_TEXTURE — paints the cutting board face into a raw 2D canvas
 * (a Phaser CanvasTexture's context), ported near-verbatim from
 * knifecraft.html's `boardQuad()` / `boardFacePath()` / `drawBoard()`.
 *
 * This uses the real Canvas 2D API (arcTo, linear/radial gradients, clip)
 * instead of Phaser's Graphics primitives, which have none of those —
 * the earlier from-scratch Graphics board was where the "large upright
 * wall" drift crept in. Painting once into a texture (regenerated only on
 * resize, not per-frame) gets pixel-accurate fidelity to the reference at
 * negligible runtime cost.
 */
import { BOARD_GEOMETRY } from "../definitions";

export type BoardQuad = {
  xt0: number;
  xt1: number;
  yt: number;
  xb0: number;
  xb1: number;
  yb: number;
};

function boardQuad(w: number, h: number): BoardQuad {
  const cx = w / 2;
  const topW = BOARD_GEOMETRY.FACE_TOP_W_FRAC * w;
  const botW = BOARD_GEOMETRY.FACE_BOT_W_FRAC * w;
  return {
    xt0: cx - topW / 2,
    xt1: cx + topW / 2,
    yt: BOARD_GEOMETRY.FACE_TOP_Y_FRAC * h,
    xb0: cx - botW / 2,
    xb1: cx + botW / 2,
    yb: BOARD_GEOMETRY.FACE_BOT_Y_FRAC * h,
  };
}

function facePath(
  ctx: CanvasRenderingContext2D,
  q: BoardQuad,
  corner: number,
  dy: number,
  inflate: number,
): void {
  const p: [number, number][] = [
    [q.xt0 - inflate, q.yt + dy],
    [q.xt1 + inflate, q.yt + dy],
    [q.xb1 + inflate, q.yb + dy],
    [q.xb0 - inflate, q.yb + dy],
  ];
  ctx.beginPath();
  ctx.moveTo((p[0]![0] + p[1]![0]) / 2, p[0]![1]);
  for (let i = 0; i < 4; i++) {
    const a = p[(i + 1) % 4]!;
    const b = p[(i + 2) % 4]!;
    ctx.arcTo(a[0], a[1], b[0], b[1], corner);
  }
  ctx.closePath();
}

/** Returns the board's logical quad in pixels — the SAME geometry the texture was painted from, so gameplay math (guides, cut clipping) lines up with what's drawn. */
export function computeBoardQuad(w: number, h: number): BoardQuad {
  return boardQuad(w, h);
}

/** Phase 9 — the face's material treatment. "grain" (default, vertical wood-grain stripes) or a per-board alternative; see paintBoardTexture's own dispatch. */
export type BoardTexturePattern = "grain" | "marble" | "copper" | "herb";

/** Paints the full board (contact shadow, edge slab, gradient face, material pattern, light pool) into `ctx`, sized `w`x`h`. `tone` is [light, mid, dark] hex strings — the player's board skin. `pattern`/`accent` (Phase 9) vary the face's material detail per board — everything else (geometry, shadow, light pool) stays identical across every board. */
export function paintBoardTexture(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tone: readonly [string, string, string],
  pattern: BoardTexturePattern = "grain",
  accent?: string,
): void {
  const q = boardQuad(w, h);
  const corner = BOARD_GEOMETRY.CORNER_FRAC * w;
  const edge = BOARD_GEOMETRY.EDGE_FRAC * h;

  ctx.clearRect(0, 0, w, h);

  // The board sits ON the counter — a soft contact shadow under the front edge.
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.26)";
  ctx.beginPath();
  ctx.ellipse(
    (q.xb0 + q.xb1) / 2,
    q.yb + edge + 6,
    (q.xb1 - q.xb0) * 0.52,
    Math.max(6, edge * 1.5),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();

  // The slab: the same face, dropped and darkened — gives the board visible thickness.
  ctx.save();
  facePath(ctx, q, corner, edge, 3.5);
  ctx.fillStyle = tone[2];
  ctx.fill();
  ctx.restore();

  // The top (playing) face — a subtly foreshortened trapezoid, not a flat rect.
  ctx.save();
  facePath(ctx, q, corner, 0, 0);
  const face = ctx.createLinearGradient(0, q.yt, 0, q.yb);
  face.addColorStop(0, tone[0]);
  face.addColorStop(0.46, tone[1]);
  face.addColorStop(1, tone[2]);
  ctx.fillStyle = face;
  ctx.fill();

  // Material pattern — Phase 9's per-board face detail. "grain" (the
  // original/default treatment) is vertical wood-grain stripes; the
  // marble/copper/herb boards swap in a different material read while
  // keeping the exact same face gradient/geometry underneath. Copper and
  // herb layer their own accent on TOP of the same grain base rather than
  // replacing it — still visibly wood, just trimmed/inset differently.
  ctx.save();
  facePath(ctx, q, corner, 0, 0);
  ctx.clip();

  if (pattern === "marble") {
    // Sparse, soft curved veins instead of uniform grain stripes.
    const veins = 6;
    for (let i = 0; i < veins; i++) {
      const t = boardJitter(i * 3.1) * 0.5 + 0.5;
      const x0 = q.xt0 + (q.xt1 - q.xt0) * t;
      const x1 = q.xb0 + (q.xb1 - q.xb0) * t + boardJitter(i * 5.7) * (q.xb1 - q.xb0) * 0.18;
      const midX = (x0 + x1) / 2 + boardJitter(i * 7.3) * (q.xb1 - q.xb0) * 0.12;
      const midY = (q.yt + q.yb) / 2;
      ctx.strokeStyle = `rgba(150,140,128,${0.16 + Math.abs(boardJitter(i * 9.1)) * 0.14})`;
      ctx.lineWidth = 1 + Math.abs(boardJitter(i * 4.4)) * 1.6;
      ctx.beginPath();
      ctx.moveTo(x0, q.yt);
      ctx.quadraticCurveTo(midX, midY, x1, q.yb);
      ctx.stroke();
    }
  } else {
    // Vertical wood grain, converging gently with the trapezoid's sides —
    // the default treatment, and the base every wood board (including
    // copper/herb's accented boards) still shows.
    const grain = BOARD_GEOMETRY.GRAIN_STRIPES;
    for (let i = 0; i < grain; i++) {
      const t0 = i / grain;
      const t1 = (i + 1) / grain;
      const a0 = q.xt0 + (q.xt1 - q.xt0) * t0;
      const a1 = q.xt0 + (q.xt1 - q.xt0) * t1;
      const b0 = q.xb0 + (q.xb1 - q.xb0) * t0;
      const b1 = q.xb0 + (q.xb1 - q.xb0) * t1;
      const strong = pattern === "copper" ? 1.4 : 1;
      ctx.fillStyle = i % 2 ? "rgba(255,235,215,0.05)" : `rgba(60,35,18,${0.07 * strong})`;
      ctx.beginPath();
      ctx.moveTo(a0, q.yt);
      ctx.lineTo(a1, q.yt);
      ctx.lineTo(b1, q.yb);
      ctx.lineTo(b0, q.yb);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(60,35,18,${0.12 * strong})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a0, q.yt);
      ctx.lineTo(b0, q.yb);
      ctx.stroke();
    }
  }

  if (pattern === "herb" && accent) {
    // A soft sage inset band along the board's NEAR (front/bottom) edge —
    // not the top edge, which sits almost exactly where the window-light
    // pool below is brightest and was washing the tint out entirely.
    const bandH = (q.yb - q.yt) * 0.16;
    const band = ctx.createLinearGradient(0, q.yb - bandH, 0, q.yb);
    band.addColorStop(0, `${accent}00`);
    band.addColorStop(1, `${accent}99`);
    ctx.fillStyle = band;
    ctx.fillRect(q.xb0 - 10, q.yb - bandH, q.xb1 - q.xb0 + 20, bandH);
  }

  if (pattern === "copper" && accent) {
    // A thin polished-metal trim tracing the face's own outline.
    ctx.strokeStyle = `${accent}bb`;
    ctx.lineWidth = Math.max(2, corner * 0.14);
    facePath(ctx, q, corner, 0, -ctx.lineWidth * 0.5);
    ctx.stroke();
  }

  // A soft warm pool of window light (knifecraft.html's POOL_ORIGIN/POOL_R) —
  // static warm-avg here since this is a one-shot paint, not the reference's
  // live Light.warmth() flicker.
  const px = 0.4037 * w;
  const py = 0.3125 * h;
  const pool = ctx.createRadialGradient(px, py, 60, px, py, 1.2 * w);
  pool.addColorStop(0, "rgba(255,241,213,0.4)");
  pool.addColorStop(0.42, "rgba(255,238,208,0.29)");
  pool.addColorStop(1, "rgba(255,232,200,0.14)");
  ctx.fillStyle = pool;
  ctx.fillRect(q.xb0 - 30, q.yt - 30, q.xb1 - q.xb0 + 60, q.yb - q.yt + 60);

  ctx.fillStyle = "rgba(255,242,216,0.24)"; // the far edge, catching the window
  ctx.fillRect(q.xt0 - 24, q.yt, q.xt1 - q.xt0 + 48, 3);
  ctx.restore(); // closes the grain-clip save
  ctx.restore(); // closes the outer face save
}

/** A tiny deterministic pseudo-random in [-1,1], seeded by index — same convention every ingredient texture file already uses (avoids Math.random() re-painting differently on every relayout for the same geometry). */
function boardJitter(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}
