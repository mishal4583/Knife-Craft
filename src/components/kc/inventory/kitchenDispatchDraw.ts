import {
  CRATE_COLORS,
  type Brick,
  type CrateBoard,
  foodOf,
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
/** How thick a gate's plate is, in stage units. */
const GATE_THICK = 36;
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

/** The glow round a crate or a dark block that a booster is waiting to be tapped on. */
function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  pulse: number,
) {
  if (pulse <= 0) return;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = "#fff1a8";
  ctx.shadowColor = "#ffd24a";
  ctx.shadowBlur = 14;
  ctx.lineWidth = 4;
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
}

/** An empty cell of the counter: warm dark wood with a faint chef's hat pressed into it. */
function drawFloorCell(ctx: CanvasRenderingContext2D, px: number, py: number, cell: number) {
  const inset = cell * 0.035;
  const x = px + inset;
  const y = py + inset;
  const s = cell - inset * 2;
  const g = ctx.createLinearGradient(0, y, 0, y + s);
  g.addColorStop(0, "#47332d");
  g.addColorStop(1, "#32231f");
  ctx.fillStyle = g;
  rr(ctx, x, y, s, s, cell * 0.12);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // the hat: three puffs over a band
  const cx = px + cell / 2;
  const cy = py + cell / 2 + cell * 0.02;
  const u = cell * 0.5;
  ctx.fillStyle = "rgba(255,225,190,.075)";
  ctx.beginPath();
  ctx.arc(cx - u * 0.24, cy - u * 0.1, u * 0.21, 0, 7);
  ctx.arc(cx + u * 0.24, cy - u * 0.1, u * 0.21, 0, 7);
  ctx.arc(cx, cy - u * 0.24, u * 0.25, 0, 7);
  ctx.fill();
  rr(ctx, cx - u * 0.32, cy - u * 0.02, u * 0.64, u * 0.3, u * 0.07);
  ctx.fill();
}

/** The room and the floor of the board: a dark wooden cell with a chef's hat in it, edge to edge. */
function paintBack(
  ctx: CanvasRenderingContext2D,
  board: CrateBoard,
  backdrop: CanvasImageSource | null,
  cell: number,
) {
  if (backdrop) ctx.drawImage(backdrop, 0, 0, KD_STAGE.w, KD_STAGE.h);
  else {
    const g = ctx.createLinearGradient(0, 0, 0, KD_STAGE.h);
    g.addColorStop(0, "#7a5233");
    g.addColorStop(1, "#4b2f1c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, KD_STAGE.w, KD_STAGE.h);
  }
  ctx.fillStyle = "#2a1c18";
  ctx.fillRect(GRID_BOX.x, GRID_BOX.y, GRID_BOX.size, GRID_BOX.size);
  for (let y = 0; y < board.rows; y++)
    for (let x = 0; x < board.cols; x++)
      drawFloorCell(ctx, GRID_BOX.x + x * cell, GRID_BOX.y + y * cell, cell);
}

let back: { key: string; backdrop: unknown; canvas: HTMLCanvasElement } | null = null;
/** The cached room + floor layer (null where no canvas can be made, e.g. a test without a DOM: the caller paints it directly). */
function backLayer(
  ctx: CanvasRenderingContext2D,
  board: CrateBoard,
  backdrop: CanvasImageSource | null,
  cell: number,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const scale = ctx.getTransform().a || 1;
  const key = `${board.cols}x${board.rows}@${scale}`;
  if (back && back.key === key && back.backdrop === backdrop) return back.canvas;
  const canvas = back?.canvas ?? document.createElement("canvas");
  canvas.width = Math.round(KD_STAGE.w * scale);
  canvas.height = Math.round(KD_STAGE.h * scale);
  const c = canvas.getContext("2d");
  if (!c) return null;
  c.setTransform(scale, 0, 0, scale, 0, 0);
  paintBack(c, board, backdrop, cell);
  back = { key, backdrop, canvas };
  return canvas;
}

/** A fixed dark block: a riveted metal plate. */
function drawWall(ctx: CanvasRenderingContext2D, board: CrateBoard, w: Wall, pulse: number) {
  const cell = cellOf(board);
  const pad = cell * 0.04;
  const x = GRID_BOX.x + w.x * cell + pad;
  const y = GRID_BOX.y + w.y * cell + pad;
  const wd = w.w * cell - pad * 2;
  const ht = w.h * cell - pad * 2;
  const rad = cell * 0.14;
  ctx.fillStyle = "rgba(0,0,0,.4)";
  rr(ctx, x, y + cell * 0.06, wd, ht, rad);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + ht);
  g.addColorStop(0, "#9b9da6");
  g.addColorStop(0.5, "#6f717b");
  g.addColorStop(1, "#52545d");
  ctx.fillStyle = g;
  rr(ctx, x, y, wd, ht, rad);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "#2c2e35";
  ctx.stroke();
  // a lighter inner edge, so the plate looks thick
  ctx.strokeStyle = "rgba(255,255,255,.38)";
  ctx.lineWidth = 2;
  rr(ctx, x + 3, y + 3, wd - 6, ht - 6, rad * 0.8);
  ctx.stroke();
  // a rivet in every corner
  const o = cell * 0.17;
  for (const [rx, ry] of [
    [x + o, y + o],
    [x + wd - o, y + o],
    [x + o, y + ht - o],
    [x + wd - o, y + ht - o],
  ] as const) {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.arc(rx, ry + 1, cell * 0.055, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#c9ccd4";
    ctx.beginPath();
    ctx.arc(rx, ry, cell * 0.05, 0, 7);
    ctx.fill();
  }
  glow(ctx, x, y, wd, ht, rad, pulse);
}

/** A crate: a painted wooden box in its food's colour, with the food it carries shown on every cell. */
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
  const pad = cell * 0.04;
  const lift = lifted ? cell * 0.05 : 0;
  const x = GRID_BOX.x + gx * cell + pad;
  const y = GRID_BOX.y + gy * cell + pad - lift;
  const wd = b.w * cell - pad * 2;
  const ht = b.h * cell - pad * 2;
  const rad = cell * 0.17;
  ctx.fillStyle = `rgba(0,0,0,${lifted ? 0.42 : 0.32})`;
  rr(ctx, x, y + cell * (lifted ? 0.13 : 0.07) + lift, wd, ht, rad);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + ht);
  g.addColorStop(0, mix(base, "#ffffff", 0.3));
  g.addColorStop(0.45, mix(base, "#ffffff", 0.05));
  g.addColorStop(1, mix(base, "#000000", 0.2));
  ctx.fillStyle = g;
  rr(ctx, x, y, wd, ht, rad);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = mix(base, "#000000", 0.52);
  ctx.stroke();
  ctx.save();
  rr(ctx, x, y, wd, ht, rad);
  ctx.clip();
  // the plank edge: a light rim inside the outline and a darker line under it
  const inset = cell * 0.075;
  ctx.strokeStyle = "rgba(255,255,255,.42)";
  ctx.lineWidth = 2.6;
  rr(ctx, x + inset, y + inset, wd - inset * 2, ht - inset * 2, rad * 0.7);
  ctx.stroke();
  ctx.strokeStyle = mix(base, "#000000", 0.28);
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.6;
  rr(ctx, x + inset + 2.6, y + inset + 2.6, wd - inset * 2 - 5.2, ht - inset * 2 - 5.2, rad * 0.55);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // a soft sheen across the top
  const sheen = ctx.createLinearGradient(0, y, 0, y + ht * 0.5);
  sheen.addColorStop(0, "rgba(255,255,255,.22)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, wd, ht * 0.5);
  ctx.restore();
  // the ingredient on every cell
  const pic = art?.images[`item-${foodOf(board, b.color)}`];
  if (pic) {
    const s = cell * 0.8;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.38)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    for (let j = 0; j < b.h; j++)
      for (let i = 0; i < b.w; i++) {
        const cx = GRID_BOX.x + (gx + i + 0.5) * cell;
        const cy = GRID_BOX.y + (gy + j + 0.5) * cell - lift;
        ctx.drawImage(pic, cx - s / 2, cy - s / 2, s, s);
      }
    ctx.restore();
  }
  glow(ctx, x, y, wd, ht, rad, pulse);
}

/** A door in the frame: a plate in its food's colour, chevrons pointing out of the board and the food that goes out of it in the middle. */
function drawGate(ctx: CanvasRenderingContext2D, art: KdArt | null, board: CrateBoard, g: Gate) {
  const cell = cellOf(board);
  const thick = GATE_THICK;
  const len = g.span * cell - cell * 0.1;
  const along = (g.at + g.span / 2) * cell;
  const mid = thick / 2 - 1; // the plate's inner edge sits on the board's edge
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
  ctx.fillStyle = "rgba(20,10,4,.6)";
  rr(ctx, -thick / 2 - 3, -len / 2 - 3, thick + 6, len + 6, thick * 0.5);
  ctx.fill();
  const pg = ctx.createLinearGradient(-thick / 2, 0, thick / 2, 0);
  pg.addColorStop(0, mix(base, "#000000", 0.18));
  pg.addColorStop(0.45, mix(base, "#ffffff", 0.18));
  pg.addColorStop(1, mix(base, "#000000", 0.25));
  ctx.shadowColor = base;
  ctx.shadowBlur = 12;
  ctx.fillStyle = pg;
  rr(ctx, -thick / 2, -len / 2, thick, len, thick * 0.42);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = mix(base, "#000000", 0.5);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.4)";
  ctx.lineWidth = 1.8;
  rr(ctx, -thick / 2 + 3, -len / 2 + 3, thick - 6, len - 6, thick * 0.34);
  ctx.stroke();
  // chevrons pointing out
  ctx.strokeStyle = "#fffaf0";
  ctx.lineWidth = Math.max(3, thick * 0.12);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const reach = Math.min(len * 0.36, len / 2 - thick * 0.5);
  for (const o of [-reach, reach]) {
    ctx.beginPath();
    ctx.moveTo(-thick * 0.14, o - thick * 0.24);
    ctx.lineTo(thick * 0.14, o);
    ctx.lineTo(-thick * 0.14, o + thick * 0.24);
    ctx.stroke();
  }
  ctx.restore();
  // the ingredient in the middle, upright, in a white ring
  const pic = art?.images[`item-${foodOf(board, g.color)}`];
  const r = thick * 0.62;
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, r, 0, 7);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = mix(base, "#000000", 0.4);
  ctx.stroke();
  if (pic) ctx.drawImage(pic, pos.x - r * 0.86, pos.y - r * 0.86, r * 1.72, r * 1.72);
}

export function drawKitchenDispatch(
  ctx: CanvasRenderingContext2D,
  board: CrateBoard,
  view: KdView,
) {
  const { art, now } = view;
  const img = art?.images;
  ctx.clearRect(0, 0, KD_STAGE.w, KD_STAGE.h);
  // the room and the floor of the board never change during a round: painted once into a layer, then copied
  const cell = cellOf(board);
  const layer = backLayer(ctx, board, img?.backdrop ?? null, cell);
  if (layer) ctx.drawImage(layer, 0, 0, KD_STAGE.w, KD_STAGE.h);
  else paintBack(ctx, board, img?.backdrop ?? null, cell);
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
