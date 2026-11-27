import { crateSkinOf, type CrateSkin } from "@/game/business/crateCargo";
import {
  doorColor,
  type Brick,
  type CrateBoard,
  foodOf,
  type Gate,
  type Side,
  type Wall,
} from "@/game/business/crateDispatch";
import { SKIN_SIZE, SKIN_SLICE, itemPicture, type KdArt } from "./kitchenDispatchArt";

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

/**
 * Where the board is on a stage. The cells are `grid.w / cols` wide and `grid.h / rows` tall: square on the 9:16 stage, and a little WIDER than tall on the landscape stage
 * (developer 2026-11-20, the mock-up: a wide board that fills the window). Only the DRAWING is wider: the rules count cells, never pixels, so no board changes.
 */
export type Box = { x: number; y: number; w: number; h: number };
export type KdLayout = {
  wide: boolean;
  stage: { readonly w: number; readonly h: number };
  frame: Box;
  grid: Box;
};
export const KD_PORTRAIT: KdLayout = {
  wide: false,
  stage: KD_STAGE,
  frame: { x: FRAME_BOX.x, y: FRAME_BOX.y, w: FRAME_BOX.size, h: FRAME_BOX.size },
  grid: { x: GRID_BOX.x, y: GRID_BOX.y, w: GRID_BOX.size, h: GRID_BOX.size },
};
/** The landscape board, measured on the mock-up (1672 x 941, x 0.574): the frame in the middle, the doors in its margin, the HUD on the two walls (the screen's DOM). */
export const KD_WIDE: KdLayout = {
  wide: true,
  stage: { w: 960, h: 540 },
  frame: { x: 223, y: 99, w: 536, h: 399 },
  grid: { x: 271, y: 124, w: 438, h: 345 },
};
/** How thick a gate's plate is, in stage units. */
const GATE_THICK = 36;
export const LEAVE_MS = 480;

/** One cell's width and height on a layout. */
export const cellsOf = (board: Pick<CrateBoard, "cols" | "rows">, L: KdLayout) => ({
  cw: L.grid.w / board.cols,
  ch: L.grid.h / board.rows,
});

/** The grid cell under a stage point (it may be outside the board), as whole numbers and as a fraction. */
export function cellAt(
  board: Pick<CrateBoard, "cols" | "rows">,
  x: number,
  y: number,
  L: KdLayout = KD_PORTRAIT,
) {
  const { cw, ch } = cellsOf(board, L);
  const fx = (x - L.grid.x) / cw;
  const fy = (y - L.grid.y) / ch;
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
  /** Where the board is (default: the 9:16 stage). The landscape board paints no room and no counter: the screen puts the room picture behind the canvas. */
  layout?: KdLayout;
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

/** An empty cell of the counter: warm dark wood with a faint chef's hat pressed into it (a faint star on the landscape board, as in the mock-up). */
function drawFloorCell(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cw: number,
  ch: number,
  star: boolean,
) {
  const cell = Math.min(cw, ch);
  const inset = cell * 0.035;
  const x = px + inset;
  const y = py + inset;
  const w = cw - inset * 2;
  const h = ch - inset * 2;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#47332d");
  g.addColorStop(1, "#32231f");
  ctx.fillStyle = g;
  rr(ctx, x, y, w, h, cell * 0.12);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  const cx = px + cw / 2;
  const cy = py + ch / 2 + cell * 0.02;
  ctx.fillStyle = "rgba(255,225,190,.075)";
  if (star) {
    // a five-point star
    const R = cell * 0.27;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 === 0 ? R : R * 0.45;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    return;
  }
  // the hat: three puffs over a band
  const u = cell * 0.5;
  ctx.beginPath();
  ctx.arc(cx - u * 0.24, cy - u * 0.1, u * 0.21, 0, 7);
  ctx.arc(cx + u * 0.24, cy - u * 0.1, u * 0.21, 0, 7);
  ctx.arc(cx, cy - u * 0.24, u * 0.25, 0, 7);
  ctx.fill();
  rr(ctx, cx - u * 0.32, cy - u * 0.02, u * 0.64, u * 0.3, u * 0.07);
  ctx.fill();
}

/** The landscape board's frame: thick dark wood with a copper rim round a dark panel that holds the cells (the mock-up), painted in code. */
function paintWideFrame(
  ctx: CanvasRenderingContext2D,
  L: KdLayout,
  frameArt: CanvasImageSource | null,
) {
  const f = L.frame;
  ctx.save();
  ctx.shadowColor = "rgba(20,8,2,.55)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  const wood = ctx.createLinearGradient(0, f.y, 0, f.y + f.h);
  wood.addColorStop(0, "#9a5a26");
  wood.addColorStop(0.5, "#7a4318");
  wood.addColorStop(1, "#5b3012");
  ctx.fillStyle = wood;
  rr(ctx, f.x, f.y, f.w, f.h, 34);
  ctx.fill();
  ctx.restore();
  if (frameArt) {
    // the painted wooden ring (when one is supplied), stretched over the rectangle; its border is a few pixels, so the stretch is not seen
    ctx.drawImage(frameArt, f.x, f.y, f.w, f.h);
  } else {
    ctx.strokeStyle = "#e0924a";
    ctx.lineWidth = 4;
    rr(ctx, f.x, f.y, f.w, f.h, 34);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,225,170,.35)";
    ctx.lineWidth = 2;
    rr(ctx, f.x + 7, f.y + 7, f.w - 14, f.h - 14, 28);
    ctx.stroke();
  }
  // the dark panel the cells lie on, a little larger than the cells
  const pad = 15;
  ctx.fillStyle = "#2a1c18";
  rr(ctx, L.grid.x - pad, L.grid.y - pad + 2, L.grid.w + pad * 2, L.grid.h + pad * 2 - 4, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.45)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** The room and the floor of the board: a dark wooden cell with a chef's hat in it (a star on the landscape board), edge to edge. */
function paintBack(
  ctx: CanvasRenderingContext2D,
  board: CrateBoard,
  backdrop: CanvasImageSource | null,
  L: KdLayout,
  frameArt: CanvasImageSource | null,
) {
  const { cw, ch } = cellsOf(board, L);
  if (L.wide) paintWideFrame(ctx, L, frameArt);
  else {
    if (backdrop) ctx.drawImage(backdrop, 0, 0, KD_STAGE.w, KD_STAGE.h);
    else {
      const g = ctx.createLinearGradient(0, 0, 0, KD_STAGE.h);
      g.addColorStop(0, "#7a5233");
      g.addColorStop(1, "#4b2f1c");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, KD_STAGE.w, KD_STAGE.h);
    }
    ctx.fillStyle = "#2a1c18";
    ctx.fillRect(L.grid.x, L.grid.y, L.grid.w, L.grid.h);
  }
  for (let y = 0; y < board.rows; y++)
    for (let x = 0; x < board.cols; x++)
      drawFloorCell(ctx, L.grid.x + x * cw, L.grid.y + y * ch, cw, ch, L.wide);
}

let back: {
  key: string;
  backdrop: unknown;
  frameArt: unknown;
  canvas: HTMLCanvasElement;
} | null = null;
/** The cached room + floor layer (null where no canvas can be made, e.g. a test without a DOM: the caller paints it directly). */
function backLayer(
  ctx: CanvasRenderingContext2D,
  board: CrateBoard,
  backdrop: CanvasImageSource | null,
  L: KdLayout,
  frameArt: CanvasImageSource | null,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const scale = ctx.getTransform().a || 1;
  const key = `${board.cols}x${board.rows}@${scale}${L.wide ? "w" : ""}`;
  if (back && back.key === key && back.backdrop === backdrop && back.frameArt === frameArt)
    return back.canvas;
  const canvas = back?.canvas ?? document.createElement("canvas");
  canvas.width = Math.round(L.stage.w * scale);
  canvas.height = Math.round(L.stage.h * scale);
  const c = canvas.getContext("2d");
  if (!c) return null;
  c.setTransform(scale, 0, 0, scale, 0, 0);
  paintBack(c, board, backdrop, L, frameArt);
  back = { key, backdrop, frameArt, canvas };
  return canvas;
}

/** A fixed dark block: a riveted metal plate. */
function drawWall(
  ctx: CanvasRenderingContext2D,
  board: CrateBoard,
  L: KdLayout,
  w: Wall,
  pulse: number,
) {
  const { cw, ch } = cellsOf(board, L);
  const cell = Math.min(cw, ch);
  const pad = cell * 0.04;
  const x = L.grid.x + w.x * cw + pad;
  const y = L.grid.y + w.y * ch + pad;
  const wd = w.w * cw - pad * 2;
  const ht = w.h * ch - pad * 2;
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

/** A skin's corner square on the board, as a part of one cell: two of them fit across the narrowest crate. */
const SKIN_CORNER = 0.44;

/** The skin cut in nine and put together for a box of `w` x `h`: the corners keep their shape, the edges stretch, the middle stays empty. */
function nineSlice(
  ctx: CanvasRenderingContext2D,
  skin: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  corner: number,
) {
  const from = [0, SKIN_SLICE, SKIN_SIZE - SKIN_SLICE, SKIN_SIZE];
  const cx = Math.min(corner, Math.floor(w / 2));
  const cy = Math.min(corner, Math.floor(h / 2));
  const toX = [x, x + cx, x + w - cx, x + w];
  const toY = [y, y + cy, y + h - cy, y + h];
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 3; i++) {
      const dw = toX[i + 1]! - toX[i]!;
      const dh = toY[j + 1]! - toY[j]!;
      if ((i === 1 && j === 1) || dw <= 0 || dh <= 0) continue;
      ctx.drawImage(
        skin,
        from[i]!,
        from[j]!,
        from[i + 1]! - from[i]!,
        from[j + 1]! - from[j]!,
        toX[i]!,
        toY[j]!,
        dw,
        dh,
      );
    }
}

/** Skins already put together, by kind and size in device pixels (a board has a handful of crate shapes). */
const skinned = new Map<string, HTMLCanvasElement>();
const SKINNED_LIMIT = 48;

/**
 * Lays a crate's skin over its painted colour with "hard-light": the skin is grey shading, so its darker parts deepen the colour and its lighter parts brighten it, and the colour the player
 * matches to a door stays that colour. It is put together first, in whole device pixels, so no seam shows between its nine pieces.
 */
function drawSkin(
  ctx: CanvasRenderingContext2D,
  kind: CrateSkin,
  skin: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  corner: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = "hard-light";
  if (typeof document === "undefined") {
    nineSlice(ctx, skin, x, y, w, h, corner);
    ctx.restore();
    return;
  }
  const scale = ctx.getTransform().a || 1;
  const pw = Math.max(1, Math.round(w * scale));
  const ph = Math.max(1, Math.round(h * scale));
  const pc = Math.max(1, Math.round(corner * scale));
  const key = `${kind}|${pw}x${ph}|${pc}`;
  let made = skinned.get(key);
  if (!made) {
    made = document.createElement("canvas");
    made.width = pw;
    made.height = ph;
    const c = made.getContext("2d");
    if (c) {
      c.imageSmoothingQuality = "high";
      nineSlice(c, skin, 0, 0, pw, ph, pc);
      // a full shelf is emptied: another screen size makes new ones
      if (skinned.size >= SKINNED_LIMIT) skinned.clear();
      skinned.set(key, made);
    }
  }
  ctx.drawImage(made, x, y, w, h);
  ctx.restore();
}

/** A crate: a painted box in its cargo's colour, in the kind of crate the cargo travels in, with the cargo shown on every cell. */
function drawBrick(
  ctx: CanvasRenderingContext2D,
  art: KdArt | null,
  board: CrateBoard,
  L: KdLayout,
  b: Brick,
  gx: number,
  gy: number,
  lifted: boolean,
  pulse: number,
) {
  const { cw, ch } = cellsOf(board, L);
  const cell = Math.min(cw, ch);
  const base = doorColor(board, b.color);
  const pad = cell * 0.04;
  const lift = lifted ? cell * 0.05 : 0;
  const x = L.grid.x + gx * cw + pad;
  const y = L.grid.y + gy * ch + pad - lift;
  const wd = b.w * cw - pad * 2;
  const ht = b.h * ch - pad * 2;
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
  const item = foodOf(board, b.color);
  const kind = crateSkinOf(item);
  const skin = art?.images[`skin-${kind}`] ?? null;
  ctx.save();
  rr(ctx, x, y, wd, ht, rad);
  ctx.clip();
  if (skin) drawSkin(ctx, kind, skin, x, y, wd, ht, cell * SKIN_CORNER);
  else {
    // (until the skin has loaded) the plank edge: a light rim inside the outline and a darker line under it
    const inset = cell * 0.075;
    ctx.strokeStyle = "rgba(255,255,255,.42)";
    ctx.lineWidth = 2.6;
    rr(ctx, x + inset, y + inset, wd - inset * 2, ht - inset * 2, rad * 0.7);
    ctx.stroke();
    ctx.strokeStyle = mix(base, "#000000", 0.28);
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.6;
    rr(
      ctx,
      x + inset + 2.6,
      y + inset + 2.6,
      wd - inset * 2 - 5.2,
      ht - inset * 2 - 5.2,
      rad * 0.55,
    );
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // a soft sheen across the top
  const sheen = ctx.createLinearGradient(0, y, 0, y + ht * 0.5);
  sheen.addColorStop(0, "rgba(255,255,255,.22)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, wd, ht * 0.5);
  ctx.restore();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = mix(base, "#000000", 0.52);
  rr(ctx, x, y, wd, ht, rad);
  ctx.stroke();
  // a parcel's tape, across the middle of the crate (its painted skin has its own)
  if (!skin && kind === "parcel") {
    const band = cell * 0.2;
    ctx.fillStyle = "rgba(150,98,45,.62)";
    if (wd >= ht) ctx.fillRect(x + 2, y + ht / 2 - band / 2, wd - 4, band);
    else ctx.fillRect(x + wd / 2 - band / 2, y + 2, band, ht - 4);
  }
  // the cargo on every cell (a little smaller inside a painted rim)
  const pic = itemPicture(art, item);
  if (pic) {
    const s = cell * (skin ? 0.76 : 0.8);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.38)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    for (let j = 0; j < b.h; j++)
      for (let i = 0; i < b.w; i++) {
        const cx = L.grid.x + (gx + i + 0.5) * cw;
        const cy = L.grid.y + (gy + j + 0.5) * ch - lift;
        ctx.drawImage(pic, cx - s / 2, cy - s / 2, s, s);
      }
    ctx.restore();
  }
  glow(ctx, x, y, wd, ht, rad, pulse);
}

/** A door in the frame: a plate in its food's colour, chevrons pointing out of the board and the food that goes out of it in the middle. */
function drawGate(
  ctx: CanvasRenderingContext2D,
  art: KdArt | null,
  board: CrateBoard,
  L: KdLayout,
  g: Gate,
) {
  const { cw, ch } = cellsOf(board, L);
  const horizontalSide = g.side === "left" || g.side === "right";
  // a door on a side runs along the cells of THAT side: tall cells on the left and right, wide ones on the top and bottom
  const run = horizontalSide ? ch : cw;
  const thick = GATE_THICK;
  const len = g.span * run - run * 0.1;
  const along = (g.at + g.span / 2) * run;
  const mid = thick / 2 - 1; // the plate's inner edge sits on the board's edge
  const pos =
    g.side === "top"
      ? { x: L.grid.x + along, y: L.grid.y - mid }
      : g.side === "bottom"
        ? { x: L.grid.x + along, y: L.grid.y + L.grid.h + mid }
        : g.side === "left"
          ? { x: L.grid.x - mid, y: L.grid.y + along }
          : { x: L.grid.x + L.grid.w + mid, y: L.grid.y + along };
  const base = doorColor(board, g.color);
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
  // the cargo in the middle, upright, in a white ring
  const pic = itemPicture(art, foodOf(board, g.color));
  const r = thick * 0.62;
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, r, 0, 7);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = mix(base, "#000000", 0.4);
  ctx.stroke();
  if (pic) ctx.drawImage(pic, pos.x - r * 0.86, pos.y - r * 0.86, r * 1.72, r * 1.72);
  // a door whose cargo the restaurant is waiting for: a small badge on its ring (a green tick: delivered today; a gold star: needed next)
  const tag = board.cargo?.[g.color]?.tag;
  const badge = tag ? (art?.images[`tag-${tag}`] ?? null) : null;
  if (tag && badge) {
    const side = r * 1.3;
    ctx.drawImage(badge, pos.x + r * 0.72 - side / 2, pos.y - r * 0.72 - side / 2, side, side);
  } else if (tag) {
    // (until the badge has loaded) the same mark, drawn
    const bx = pos.x + r * 0.72;
    const by = pos.y - r * 0.72;
    const br = r * 0.5;
    ctx.fillStyle = tag === "delivered" ? "#3f9a3a" : "#e9a517";
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, 7);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fffaf0";
    ctx.stroke();
    ctx.fillStyle = "#fffaf0";
    ctx.font = `900 ${br * 1.35}px Nunito, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tag === "delivered" ? "✓" : "★", bx, by + br * 0.06);
    ctx.textBaseline = "alphabetic";
  }
}

export function drawKitchenDispatch(
  ctx: CanvasRenderingContext2D,
  board: CrateBoard,
  view: KdView,
) {
  const { art, now } = view;
  const img = art?.images;
  const L = view.layout ?? KD_PORTRAIT;
  const wide = L.wide;
  ctx.clearRect(0, 0, L.stage.w, L.stage.h);
  // the room and the floor of the board never change during a round: painted once into a layer, then copied
  const { cw, ch } = cellsOf(board, L);
  const backdrop = wide ? null : (img?.backdrop ?? null);
  // the painted wide frame (a `frame-wide.webp` ring) is drawn here once Codex delivers it; until then the frame is painted in code
  const frameArt: CanvasImageSource | null = null;
  const layer = backLayer(ctx, board, backdrop, L, frameArt);
  if (layer) ctx.drawImage(layer, 0, 0, L.stage.w, L.stage.h);
  else {
    ctx.save();
    paintBack(ctx, board, backdrop, L, frameArt);
    ctx.restore();
  }
  const pulse = 0.55 + 0.45 * Math.sin(now / 140);
  // the dark blocks
  for (const w of board.walls) drawWall(ctx, board, L, w, view.armed === "hammer" ? pulse : 0);
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
      L,
      b,
      v.x,
      v.y,
      b.id === view.dragId,
      view.armed === "rocket" ? pulse : 0,
    );
  }
  // the frame over the edges (the 9:16 stage's picture; the landscape frame is in the layer under the crates), then the gates on it
  if (!wide) {
    const f = L.frame;
    if (img?.frame) ctx.drawImage(img.frame, f.x, f.y, f.w, f.h);
    else {
      ctx.strokeStyle = "#a9754a";
      ctx.lineWidth = 16;
      rr(ctx, f.x + 12, f.y + 12, f.w - 24, f.h - 24, 24);
      ctx.stroke();
    }
  }
  for (const g of board.gates) drawGate(ctx, art, board, L, g);
  // crates sliding out of their gates, cut off at the frame's outer edge
  ctx.save();
  ctx.beginPath();
  ctx.rect(L.frame.x + 2, L.frame.y + 2, L.frame.w - 4, L.frame.h - 4);
  ctx.clip();
  for (const l of view.leaving) {
    const p = Math.min(1, (now - l.start) / LEAVE_MS);
    const side = l.gate.side;
    const dir = ANGLE[side];
    const alongX = side === "left" || side === "right";
    // how far it travels: its own length along the way out, plus a little
    const dist = ((alongX ? cw * l.brick.w : ch * l.brick.h) + 70) * p * p;
    drawBrick(
      ctx,
      art,
      board,
      L,
      l.brick,
      l.brick.x + (Math.cos(dir) * dist) / cw,
      l.brick.y + (Math.sin(dir) * dist) / ch,
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
      const mid = l.gate.at + l.gate.span / 2;
      const ex = horizontal
        ? L.grid.x + (l.gate.side === "right" ? L.grid.w : 0)
        : L.grid.x + mid * cw;
      const ey = horizontal
        ? L.grid.y + mid * ch
        : L.grid.y + (l.gate.side === "bottom" ? L.grid.h : 0);
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
  // the counter in front, under the boosters (the landscape board has its boosters on the wall beside the frame)
  if (!wide && img?.counter)
    ctx.drawImage(img.counter, 0, COUNTER_Y, KD_STAGE.w, (KD_STAGE.w * 315) / 810);
}
