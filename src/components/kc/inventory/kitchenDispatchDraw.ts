import {
  CRATE_COLORS,
  gatesOf,
  type Crate,
  type CrateBoard,
  type CrateIngredient,
  type GateSide,
} from "@/game/business/crateDispatch";
import { PANELS, kdSheet, type KdArt } from "./kitchenDispatchArt";

/** Kitchen Dispatch is drawn on a 540 x 960 stage, like every other screen. */
export const KD_STAGE = { w: 540, h: 960 } as const;
/** The wooden frame's picture, and the playing area inside its opening (the opening is 940 of the 1080 px picture). */
export const FRAME_BOX = { x: 40, y: 292, size: 460 } as const;
export const GRID_BOX = {
  x: FRAME_BOX.x + (FRAME_BOX.size * 70) / 1080,
  y: FRAME_BOX.y + (FRAME_BOX.size * 70) / 1080,
  size: (FRAME_BOX.size * 940) / 1080,
} as const;
export const COUNTER_Y = 750;
export const LEAVE_MS = 460;
export const SHAKE_MS = 380;

export const cellOf = (board: Pick<CrateBoard, "cols">) => GRID_BOX.size / board.cols;
export const crateRect = (c: Crate, board: Pick<CrateBoard, "cols">) => {
  const cell = cellOf(board);
  return {
    x: GRID_BOX.x + c.x * cell,
    y: GRID_BOX.y + c.y * cell,
    w: (c.axis === "h" ? c.length : 1) * cell,
    h: (c.axis === "v" ? c.length : 1) * cell,
  };
};

/** The crate under a stage point, or null. */
export function crateAt(board: CrateBoard, x: number, y: number): Crate | null {
  const cell = cellOf(board);
  const cx = Math.floor((x - GRID_BOX.x) / cell);
  const cy = Math.floor((y - GRID_BOX.y) / cell);
  if (cx < 0 || cy < 0 || cx >= board.cols || cy >= board.rows) return null;
  return (
    board.vehicles.find((c) =>
      c.axis === "h"
        ? cy === c.y && cx >= c.x && cx < c.x + c.length
        : cx === c.x && cy >= c.y && cy < c.y + c.length,
    ) ?? null
  );
}

export type Leaving = { crate: Crate; start: number };
export type KdView = {
  now: number;
  art: KdArt | null;
  leaving: Leaving[];
  shake: { id: string; start: number } | null;
  hint: { id: string; until: number } | null;
};

const ANGLE: Record<GateSide, number> = {
  right: 0,
  bottom: Math.PI / 2,
  left: Math.PI,
  top: -Math.PI / 2,
};
const dirAngle = (c: Crate) =>
  ANGLE[c.axis === "h" ? (c.dir < 0 ? "left" : "right") : c.dir < 0 ? "top" : "bottom"];

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** A white arrow with a dark outline, pointing right at angle 0, `s` stage px long. */
function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, -s * 0.17);
  ctx.lineTo(s * 0.08, -s * 0.17);
  ctx.lineTo(s * 0.08, -s * 0.4);
  ctx.lineTo(s * 0.55, 0);
  ctx.lineTo(s * 0.08, s * 0.4);
  ctx.lineTo(s * 0.08, s * 0.17);
  ctx.lineTo(-s * 0.5, s * 0.17);
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, s * 0.13);
  ctx.strokeStyle = "#4a2815";
  ctx.stroke();
  ctx.fillStyle = "#fffaf0";
  ctx.fill();
  ctx.restore();
}

function drawCrate(
  ctx: CanvasRenderingContext2D,
  art: KdArt | null,
  board: CrateBoard,
  c: Crate,
  dx: number,
  dy: number,
) {
  const cell = cellOf(board);
  const r = crateRect(c, board);
  const pad = cell * 0.04;
  const len = c.length * cell - pad * 2;
  const thick = cell - pad * 2;
  const cx = r.x + r.w / 2 + dx;
  const cy = r.y + r.h / 2 + dy;
  const sheet = art ? kdSheet(art, c.length === 3 ? "crate-3" : "crate-2", c.color) : null;
  ctx.save();
  ctx.translate(cx, cy);
  if (c.axis === "v") ctx.rotate(c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  else if (c.dir < 0) ctx.scale(-1, 1);
  if (sheet) ctx.drawImage(sheet, -len / 2, -thick / 2, len, thick);
  else {
    ctx.fillStyle = CRATE_COLORS[c.color as CrateIngredient] ?? "#B98A5A";
    rr(ctx, -len / 2, -thick / 2, len, thick, cell * 0.14);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#4a2815";
    ctx.stroke();
  }
  ctx.restore();
  // the ingredient on every panel, always upright, and the arrow on the plate
  const panels = PANELS[c.length as 2 | 3];
  const img = art?.images[`ingredient-${c.color as CrateIngredient}`];
  const along = (f: number) => (c.dir < 0 ? 1 - f : f) * len;
  const startX = c.axis === "h" ? r.x + pad : r.y + pad;
  const at = (f: number) => {
    const t = startX + along(f);
    return c.axis === "h" ? { x: t + dx, y: cy } : { x: cx, y: t + dy };
  };
  for (const f of panels.at) {
    const p = at(f);
    if (img) ctx.drawImage(img, p.x - cell * 0.31, p.y - cell * 0.31, cell * 0.62, cell * 0.62);
    else {
      ctx.fillStyle = "#fff4d9";
      ctx.beginPath();
      ctx.arc(p.x, p.y, cell * 0.22, 0, 7);
      ctx.fill();
    }
  }
  const a = at(panels.arrow);
  drawArrow(ctx, a.x, a.y, dirAngle(c), cell * 0.36);
}

function drawGates(ctx: CanvasRenderingContext2D, art: KdArt | null, board: CrateBoard) {
  const cell = cellOf(board);
  const w = Math.min(cell * 0.82, 62);
  const h = w * 0.5;
  const off = (FRAME_BOX.size * (70 - 24)) / 1080 / 2; // the middle of the frame's band
  for (const g of gatesOf(board)) {
    const along = (g.index + 0.5) * cell;
    const pos =
      g.side === "top"
        ? { x: GRID_BOX.x + along, y: GRID_BOX.y - off }
        : g.side === "bottom"
          ? { x: GRID_BOX.x + along, y: GRID_BOX.y + GRID_BOX.size + off }
          : g.side === "left"
            ? { x: GRID_BOX.x - off, y: GRID_BOX.y + along }
            : { x: GRID_BOX.x + GRID_BOX.size + off, y: GRID_BOX.y + along };
    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (g.side === "left" || g.side === "right") ctx.rotate(Math.PI / 2);
    const sheet = art ? kdSheet(art, "gate", g.ingredient) : null;
    if (sheet) ctx.drawImage(sheet, -w / 2, -h / 2, w, h);
    else {
      ctx.fillStyle = CRATE_COLORS[g.ingredient as CrateIngredient] ?? "#B98A5A";
      rr(ctx, -w / 2, -h / 2, w, h, h / 2);
      ctx.fill();
    }
    ctx.restore();
    // two white chevrons pointing out of the board
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(ANGLE[g.side]);
    ctx.strokeStyle = "#fffaf0";
    ctx.lineWidth = Math.max(2.4, h * 0.16);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const o of [-h * 0.22, h * 0.14]) {
      ctx.beginPath();
      ctx.moveTo(o - h * 0.14, -h * 0.26);
      ctx.lineTo(o + h * 0.14, 0);
      ctx.lineTo(o - h * 0.14, h * 0.26);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawKitchenDispatch(
  ctx: CanvasRenderingContext2D,
  board: CrateBoard,
  view: KdView,
) {
  const { art, now } = view;
  const img = art?.images;
  ctx.clearRect(0, 0, KD_STAGE.w, KD_STAGE.h);
  // the room
  if (img?.backdrop) ctx.drawImage(img.backdrop, 0, 0, KD_STAGE.w, KD_STAGE.h);
  else {
    const g = ctx.createLinearGradient(0, 0, 0, KD_STAGE.h);
    g.addColorStop(0, "#7a5233");
    g.addColorStop(1, "#4b2f1c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, KD_STAGE.w, KD_STAGE.h);
  }
  // the floor of the board: a dark tile in every cell, edge to edge
  const cell = cellOf(board);
  ctx.fillStyle = "#2a2c30";
  ctx.fillRect(GRID_BOX.x, GRID_BOX.y, GRID_BOX.size, GRID_BOX.size);
  for (let y = 0; y < board.rows; y++)
    for (let x = 0; x < board.cols; x++) {
      const px = GRID_BOX.x + x * cell;
      const py = GRID_BOX.y + y * cell;
      if (img?.tile) ctx.drawImage(img.tile, px, py, cell + 0.5, cell + 0.5);
      else {
        ctx.fillStyle = (x + y) % 2 ? "#33363b" : "#2c2f34";
        ctx.fillRect(px, py, cell, cell);
      }
    }
  // crates sitting on the board
  const shaking = view.shake && now - view.shake.start < SHAKE_MS ? view.shake : null;
  for (const c of board.vehicles) {
    let dx = 0;
    let dy = 0;
    if (shaking && shaking.id === c.id) {
      const t = (now - shaking.start) / SHAKE_MS;
      const wob = Math.sin(t * 38) * 5 * (1 - t);
      if (c.axis === "h") dx = wob;
      else dy = wob;
    }
    drawCrate(ctx, art, board, c, dx, dy);
    if (shaking && shaking.id === c.id) {
      const r = crateRect(c, board);
      ctx.globalAlpha = 0.3 * (1 - (now - shaking.start) / SHAKE_MS);
      ctx.fillStyle = "#ff4a3a";
      rr(ctx, r.x + dx + 2, r.y + dy + 2, r.w - 4, r.h - 4, cell * 0.14);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // a hint pulses round a crate that can leave
  if (view.hint && now < view.hint.until) {
    const c = board.vehicles.find((v) => v.id === view.hint!.id);
    if (c) {
      const r = crateRect(c, board);
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(now / 140);
      ctx.strokeStyle = "#fff1a8";
      ctx.shadowColor = "#ffd24a";
      ctx.shadowBlur = 14;
      ctx.lineWidth = 4.5;
      rr(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, cell * 0.16);
      ctx.stroke();
      ctx.restore();
    }
  }
  // the frame over the edges, then the gates on it
  if (img?.frame)
    ctx.drawImage(img.frame, FRAME_BOX.x, FRAME_BOX.y, FRAME_BOX.size, FRAME_BOX.size);
  else {
    ctx.strokeStyle = "#a9754a";
    ctx.lineWidth = 16;
    rr(ctx, FRAME_BOX.x + 12, FRAME_BOX.y + 12, FRAME_BOX.size - 24, FRAME_BOX.size - 24, 24);
    ctx.stroke();
  }
  drawGates(ctx, art, board);
  // crates sliding out of their gates, cut off at the frame
  ctx.save();
  ctx.beginPath();
  ctx.rect(FRAME_BOX.x + 6, FRAME_BOX.y + 6, FRAME_BOX.size - 12, FRAME_BOX.size - 12);
  ctx.clip();
  for (const l of view.leaving) {
    const p = Math.min(1, (now - l.start) / LEAVE_MS);
    const r = crateRect(l.crate, board);
    const reach =
      l.crate.axis === "h"
        ? l.crate.dir > 0
          ? FRAME_BOX.x + FRAME_BOX.size - r.x
          : r.x + r.w - FRAME_BOX.x
        : l.crate.dir > 0
          ? FRAME_BOX.y + FRAME_BOX.size - r.y
          : r.y + r.h - FRAME_BOX.y;
    const d = (reach + 6) * p * p;
    drawCrate(
      ctx,
      art,
      board,
      l.crate,
      l.crate.axis === "h" ? d * l.crate.dir : 0,
      l.crate.axis === "v" ? d * l.crate.dir : 0,
    );
  }
  ctx.restore();
  // the dust where a crate left
  if (img?.puff)
    for (const l of view.leaving) {
      const p = (now - l.start) / LEAVE_MS;
      if (p < 0.55 || p > 1.5) continue;
      const q = (p - 0.55) / 0.95;
      const r = crateRect(l.crate, board);
      const ex =
        l.crate.axis === "h"
          ? l.crate.dir > 0
            ? GRID_BOX.x + GRID_BOX.size + 10
            : GRID_BOX.x - 10
          : r.x + r.w / 2;
      const ey =
        l.crate.axis === "v"
          ? l.crate.dir > 0
            ? GRID_BOX.y + GRID_BOX.size + 10
            : GRID_BOX.y - 10
          : r.y + r.h / 2;
      ctx.globalAlpha = 1 - q;
      const s = 34 + q * 30;
      ctx.drawImage(img.puff, ex - s / 2, ey - s / 2 - q * 12, s, s);
      ctx.globalAlpha = 1;
    }
  // the counter in front, under the boosters
  if (img?.counter) ctx.drawImage(img.counter, 0, COUNTER_Y, KD_STAGE.w, (KD_STAGE.w * 315) / 810);
}
