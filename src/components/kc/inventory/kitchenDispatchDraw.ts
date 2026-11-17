import {
  CRATE_COLORS,
  type Brick,
  type CrateBoard,
  type CrateIngredient,
  type Gate,
  type Side,
  type Wall,
} from "@/game/business/crateDispatch";
import type { KdArt } from "./kitchenDispatchArt";

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
export const LEAVE_MS = 480;

export const cellOf = (board: Pick<CrateBoard, "cols">) => GRID_BOX.size / board.cols;

/** The grid cell under a stage point (it may be outside the board), as whole numbers and as a fraction. */
export function cellAt(board: Pick<CrateBoard, "cols">, x: number, y: number) {
  const cell = cellOf(board);
  const fx = (x - GRID_BOX.x) / cell;
  const fy = (y - GRID_BOX.y) / cell;
  return { cx: Math.floor(fx), cy: Math.floor(fy), fx, fy };
}

export type Leaving = { brick: Brick; gate: Gate; start: number };
export type KdView = {
  now: number;
  art: KdArt | null;
  leaving: Leaving[];
  /** Where each crate is drawn (in cells, easing toward its cell), so a crate glides instead of jumping. */
  vis: Map<string, { x: number; y: number }>;
  /** The crate under the finger. */
  dragId: string | null;
  /** A booster waiting for a tap: the crates (Rocket) or the dark blocks (Hammer) pulse. */
  armed: "rocket" | "hammer" | null;
};

const ANGLE: Record<Side, number> = {
  right: 0,
  bottom: Math.PI / 2,
  left: Math.PI,
  top: -Math.PI / 2,
};

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** `hex` mixed toward `to` by `t` (0 to 1). */
function mix(hex: string, to: string, t: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function drawWall(ctx: CanvasRenderingContext2D, board: CrateBoard, w: Wall, pulse: number) {
  const cell = cellOf(board);
  const pad = cell * 0.03;
  const x = GRID_BOX.x + w.x * cell + pad;
  const y = GRID_BOX.y + w.y * cell + pad;
  const wd = w.w * cell - pad * 2;
  const ht = w.h * cell - pad * 2;
  const rad = cell * 0.16;
  ctx.fillStyle = "rgba(0,0,0,.4)";
  rr(ctx, x, y + cell * 0.06, wd, ht, rad);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + ht);
  g.addColorStop(0, "#5a6070");
  g.addColorStop(0.55, "#3c414d");
  g.addColorStop(1, "#2a2e37");
  ctx.fillStyle = g;
  rr(ctx, x, y, wd, ht, rad);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#14161b";
  ctx.stroke();
  // a lighter top edge and two rivets, so it reads as a solid fixture
  ctx.strokeStyle = "rgba(255,255,255,.28)";
  ctx.lineWidth = 2;
  rr(ctx, x + 3, y + 3, wd - 6, ht - 6, rad * 0.8);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.22)";
  for (const [rx, ry] of [
    [x + cell * 0.2, y + cell * 0.2],
    [x + wd - cell * 0.2, y + ht - cell * 0.2],
  ] as const) {
    ctx.beginPath();
    ctx.arc(rx, ry, cell * 0.06, 0, 7);
    ctx.fill();
  }
  if (pulse > 0) {
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "#fff1a8";
    ctx.shadowColor = "#ffd24a";
    ctx.shadowBlur = 14;
    ctx.lineWidth = 4;
    rr(ctx, x, y, wd, ht, rad);
    ctx.stroke();
    ctx.restore();
  }
}

/** A crate: a toy brick in its ingredient's colour, with a stud on every cell and the ingredient on the stud. */
function drawBrick(
  ctx: CanvasRenderingContext2D,
  art: KdArt | null,
  board: CrateBoard,
  b: Brick,
  gx: number,
  gy: number,
  lifted: boolean,
  pulse: number,
) {
  const cell = cellOf(board);
  const base = CRATE_COLORS[b.color];
  const pad = cell * 0.035;
  const lift = lifted ? cell * 0.05 : 0;
  const x = GRID_BOX.x + gx * cell + pad;
  const y = GRID_BOX.y + gy * cell + pad - lift;
  const wd = b.w * cell - pad * 2;
  const ht = b.h * cell - pad * 2;
  const rad = cell * 0.2;
  ctx.fillStyle = `rgba(0,0,0,${lifted ? 0.42 : 0.32})`;
  rr(ctx, x, y + cell * (lifted ? 0.13 : 0.07) + lift, wd, ht, rad);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + ht);
  g.addColorStop(0, mix(base, "#ffffff", 0.22));
  g.addColorStop(0.5, base);
  g.addColorStop(1, mix(base, "#000000", 0.25));
  ctx.fillStyle = g;
  rr(ctx, x, y, wd, ht, rad);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = mix(base, "#000000", 0.5);
  ctx.stroke();
  // a bright top-left edge and a darker bottom edge: the bevel
  ctx.save();
  rr(ctx, x, y, wd, ht, rad);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + ht - rad);
  ctx.lineTo(x + 2, y + rad * 0.9);
  ctx.quadraticCurveTo(x + 2, y + 2, x + rad * 0.9, y + 2);
  ctx.lineTo(x + wd - rad, y + 2);
  ctx.stroke();
  ctx.restore();
  // the studs
  const sr = cell * 0.34;
  for (let j = 0; j < b.h; j++)
    for (let i = 0; i < b.w; i++) {
      const cx = GRID_BOX.x + (gx + i + 0.5) * cell;
      const cy = GRID_BOX.y + (gy + j + 0.5) * cell - lift;
      ctx.fillStyle = "rgba(0,0,0,.3)";
      ctx.beginPath();
      ctx.arc(cx, cy + sr * 0.16, sr, 0, 7);
      ctx.fill();
      const sg = ctx.createRadialGradient(cx - sr * 0.35, cy - sr * 0.4, sr * 0.1, cx, cy, sr);
      sg.addColorStop(0, mix(base, "#ffffff", 0.5));
      sg.addColorStop(0.6, mix(base, "#ffffff", 0.12));
      sg.addColorStop(1, mix(base, "#000000", 0.12));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, cy, sr, 0, 7);
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = mix(base, "#000000", 0.38);
      ctx.stroke();
      const img = art?.images[`ingredient-${b.color as CrateIngredient}`];
      if (img) ctx.drawImage(img, cx - sr * 0.86, cy - sr * 0.9, sr * 1.72, sr * 1.72);
    }
  if (pulse > 0) {
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "#fff1a8";
    ctx.shadowColor = "#ffd24a";
    ctx.shadowBlur = 14;
    ctx.lineWidth = 4;
    rr(ctx, x, y, wd, ht, rad);
    ctx.stroke();
    ctx.restore();
  }
}

/** A gate in the frame: a plate in the ingredient's colour, with the ingredient and chevrons pointing out of the board. */
function drawGate(ctx: CanvasRenderingContext2D, art: KdArt | null, board: CrateBoard, g: Gate) {
  const cell = cellOf(board);
  const band = (FRAME_BOX.size * 70) / 1080;
  const thick = Math.min(band * 0.8, 26);
  const len = g.span * cell - cell * 0.14;
  const along = (g.at + g.span / 2) * cell;
  const mid = band * 0.46;
  const pos =
    g.side === "top"
      ? { x: GRID_BOX.x + along, y: GRID_BOX.y - mid }
      : g.side === "bottom"
        ? { x: GRID_BOX.x + along, y: GRID_BOX.y + GRID_BOX.size + mid }
        : g.side === "left"
          ? { x: GRID_BOX.x - mid, y: GRID_BOX.y + along }
          : { x: GRID_BOX.x + GRID_BOX.size + mid, y: GRID_BOX.y + along };
  const base = CRATE_COLORS[g.color];
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(ANGLE[g.side]); // local +x points out of the board
  // a dark slot in the frame, then the glowing plate
  ctx.fillStyle = "rgba(20,10,4,.55)";
  rr(ctx, -thick / 2 - 3, -len / 2 - 3, thick + 6, len + 6, thick * 0.5);
  ctx.fill();
  const pg = ctx.createLinearGradient(-thick / 2, 0, thick / 2, 0);
  pg.addColorStop(0, mix(base, "#ffffff", 0.3));
  pg.addColorStop(0.5, base);
  pg.addColorStop(1, mix(base, "#000000", 0.3));
  ctx.shadowColor = base;
  ctx.shadowBlur = 12;
  ctx.fillStyle = pg;
  rr(ctx, -thick / 2, -len / 2, thick, len, thick * 0.45);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = mix(base, "#000000", 0.5);
  ctx.stroke();
  // chevrons pointing out
  ctx.strokeStyle = "#fffaf0";
  ctx.lineWidth = Math.max(2.4, thick * 0.13);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const o of [-len * 0.34, len * 0.34]) {
    ctx.beginPath();
    ctx.moveTo(-thick * 0.16, o - thick * 0.22);
    ctx.lineTo(thick * 0.12, o);
    ctx.lineTo(-thick * 0.16, o + thick * 0.22);
    ctx.stroke();
  }
  ctx.restore();
  // the ingredient in the middle, upright
  const img = art?.images[`ingredient-${g.color as CrateIngredient}`];
  ctx.fillStyle = "rgba(255,250,240,.92)";
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, thick * 0.55, 0, 7);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = mix(base, "#000000", 0.45);
  ctx.stroke();
  if (img) ctx.drawImage(img, pos.x - thick * 0.5, pos.y - thick * 0.5, thick, thick);
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
  const pulse = 0.55 + 0.45 * Math.sin(now / 140);
  // the dark blocks
  for (const w of board.walls) drawWall(ctx, board, w, view.armed === "hammer" ? pulse : 0);
  // the crates; the one under the finger last, so it rides over the others
  const ordered = [...board.bricks].sort(
    (a, b) => Number(a.id === view.dragId) - Number(b.id === view.dragId),
  );
  for (const b of ordered) {
    const v = view.vis.get(b.id) ?? { x: b.x, y: b.y };
    drawBrick(
      ctx,
      art,
      board,
      b,
      v.x,
      v.y,
      b.id === view.dragId,
      view.armed === "rocket" ? pulse : 0,
    );
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
  for (const g of board.gates) drawGate(ctx, art, board, g);
  // crates sliding out of their gates, cut off at the frame's outer edge
  ctx.save();
  ctx.beginPath();
  ctx.rect(FRAME_BOX.x + 2, FRAME_BOX.y + 2, FRAME_BOX.size - 4, FRAME_BOX.size - 4);
  ctx.clip();
  for (const l of view.leaving) {
    const p = Math.min(1, (now - l.start) / LEAVE_MS);
    const dist = (cell * Math.max(l.brick.w, l.brick.h) + 70) * p * p;
    const dir = ANGLE[l.gate.side];
    drawBrick(
      ctx,
      art,
      board,
      l.brick,
      l.brick.x + (Math.cos(dir) * dist) / cell,
      l.brick.y + (Math.sin(dir) * dist) / cell,
      false,
      0,
    );
  }
  ctx.restore();
  // the dust where a crate left
  if (img?.puff)
    for (const l of view.leaving) {
      const p = (now - l.start) / LEAVE_MS;
      if (p < 0.5 || p > 1.5) continue;
      const q = (p - 0.5) / 1;
      const dir = ANGLE[l.gate.side];
      const horizontal = l.gate.side === "left" || l.gate.side === "right";
      const gx = GRID_BOX.x + (l.gate.at + l.gate.span / 2) * cell;
      const ex = horizontal ? GRID_BOX.x + (l.gate.side === "right" ? GRID_BOX.size : 0) : gx;
      const ey = horizontal
        ? gx - GRID_BOX.x + GRID_BOX.y
        : GRID_BOX.y + (l.gate.side === "bottom" ? GRID_BOX.size : 0);
      ctx.globalAlpha = Math.max(0, 1 - q);
      const s = 38 + q * 34;
      ctx.drawImage(
        img.puff,
        ex + Math.cos(dir) * 14 - s / 2,
        ey + Math.sin(dir) * 14 - s / 2 - q * 10,
        s,
        s,
      );
      ctx.globalAlpha = 1;
    }
  // the counter in front, under the boosters
  if (img?.counter) ctx.drawImage(img.counter, 0, COUNTER_Y, KD_STAGE.w, (KD_STAGE.w * 315) / 810);
}
