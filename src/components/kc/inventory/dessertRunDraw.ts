import {
  AISLE,
  CART,
  CELL,
  GUESTS,
  GUEST_PLATE_Y,
  ORIGIN,
  PLATE,
  WELL_R,
  QUEUE,
  SPOT_COUNT,
  SPOT_W,
  STAGE,
  TABLES,
  cellHex,
  isExposed,
  isWaiting,
  spotCenter,
  type RunState,
} from "@/game/business/dessertRun";
import { GRID, RUN_PALETTE } from "@/game/business/dessertGallery";
import { FRAME, waiterSheet, type RunArt } from "./dessertRunArt";

/**
 * Dessert Run drawn in the 540 x 960 stage. The painted pieces (Dessert Run Assets) are used when they have
 * loaded; each one has a plain-shape fallback, so the game plays the same without them. Only the dessert, the
 * cubes, the numbers and the lit cubes are always code-drawn.
 */

export type DrawView = {
  now: number;
  /** Colour index of a held waiter: its cubes light up, the rest dim. */
  peek: number | null;
  /** The lane under the finger, if any. */
  hoverLane: number | null;
  hintOn: boolean;
  shake: Array<{ lane: number; t: number }>;
  notice: string;
  art: RunArt | null;
};

const SKIN = "#F2C9A0";
const FONT = "Nunito, sans-serif";
const shadeCache = new Map<string, string>();

export function shade(hex: string, t: number): string {
  const key = hex + t;
  const hit = shadeCache.get(key);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = t > 0 ? 255 : 0;
  const p = Math.abs(t);
  const out = `rgb(${Math.round(r + (f - r) * p)},${Math.round(g + (f - g) * p)},${Math.round(b + (f - b) * p)})`;
  shadeCache.set(key, out);
  return out;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

const cubeCache = new Map<string, HTMLCanvasElement>();
/**
 * One toy-block tile, drawn once per colour at 3x. Like the developer's reference mosaics (Colony Flow) but with NO
 * gap at all (developer 2026-11-17: "absolute zero gaps"): the tile is a full-bleed square with sharp corners, so
 * neighbours meet edge to edge and nothing of the plate shows between them. Only a very soft cushion (a faint lit
 * edge at the top and left, a faint shaded edge at the bottom and right) keeps each tile readable (the small white glint was removed 2026-11-18).
 */
function cubeSprite(hex: string): HTMLCanvasElement {
  let c = cubeCache.get(hex);
  if (c) return c;
  const S = 48;
  c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = hex;
  g.fillRect(0, 0, S, S);
  // (no white dot: developer 2026-11-18, "remove these white dots from the mosaics")
  cubeCache.set(hex, c);
  return c;
}

const tileCache = new Map<string, HTMLCanvasElement>();
/**
 * One mosaic tile at its exact size in DEVICE pixels, with the edge treatment of the developer's reference tiles
 * (2026-11-17): a bright edge along the top, a soft fade from the light top to a deeper bottom, a thin shaded edge
 * at the bottom and right (the small white glint was removed 2026-11-18). It fills its whole box, so neighbouring tiles meet
 * edge to edge with nothing showing between them (no gap, no rounded corner); and it is blitted 1:1 (never scaled),
 * so no edge is ever blurred into a hairline.
 */
function tileSprite(hex: string, w: number, h: number): HTMLCanvasElement {
  const key = `${hex}|${w}|${h}`;
  let c = tileCache.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const face = g.createLinearGradient(0, 0, 0, h);
  face.addColorStop(0, shade(hex, 0.2));
  face.addColorStop(0.42, hex);
  face.addColorStop(1, shade(hex, -0.17));
  g.fillStyle = face;
  g.fillRect(0, 0, w, h);
  const t = Math.max(1, Math.round(h * 0.07));
  const l = Math.max(1, Math.round(w * 0.05));
  g.fillStyle = "rgba(255,255,255,.5)";
  g.fillRect(0, 0, w, t);
  g.fillStyle = "rgba(255,255,255,.2)";
  g.fillRect(0, 0, l, h);
  g.fillStyle = "rgba(0,0,0,.18)";
  g.fillRect(0, h - t, w, t);
  g.fillStyle = "rgba(0,0,0,.1)";
  g.fillRect(w - l, 0, l, h);
  // (no white glint on the face: developer 2026-11-18, "remove these white dots from the mosaics")
  tileCache.set(key, c);
  return c;
}

export function drawCube(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  hex: string,
) {
  ctx.drawImage(cubeSprite(hex), x, y, s, s);
}

function drawPlainPlate(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
  let gr = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.2, cx, cy, R);
  gr.addColorStop(0, "#FFFDF7");
  gr.addColorStop(1, "#E7DCC6");
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 7);
  ctx.fill();
  ctx.strokeStyle = "#3F6FA6";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.93, 0, 7);
  ctx.stroke();
  gr = ctx.createRadialGradient(cx, cy - R * 0.1, R * 0.1, cx, cy, R * 0.84);
  gr.addColorStop(0, "#FFFFFF");
  gr.addColorStop(1, "#EFE6D3");
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.84, 0, 7);
  ctx.fill();
}

/** A plain waiter, for the moments the painted one has not loaded. */
function drawPlainWaiter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  hex: string,
  carry: string | null,
) {
  ctx.fillStyle = "rgba(0,0,0,.22)";
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.5, s * 0.38, s * 0.1, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = hex;
  rr(ctx, x - s * 0.3, y - s * 0.02, s * 0.6, s * 0.5, s * 0.16);
  ctx.fill();
  ctx.fillStyle = "#fff";
  rr(ctx, x - s * 0.12, y + s * 0.02, s * 0.24, s * 0.34, s * 0.06);
  ctx.fill();
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(x, y - s * 0.2, s * 0.26, 0, 7);
  ctx.fill();
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.38, s * 0.3, s * 0.15, 0, Math.PI, 0);
  ctx.fill();
  if (carry) drawCube(ctx, x - s * 0.17, y - s * 0.78, s * 0.34, carry);
}

const GUEST_LOOK = [
  { skin: "#F2C9A0", hair: "#5a3a22" },
  { skin: "#D9A67A", hair: "#2a1f16" },
  { skin: "#F5D2B0", hair: "#b4531a" },
  { skin: "#E3B78E", hair: "#7a7a7a" },
] as const;

function drawPlainGuest(ctx: CanvasRenderingContext2D, x: number, y: number, p: number, j: number) {
  const look = GUEST_LOOK[j]!;
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.arc(x, y - 3, 21, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(x, y, 19, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#2a1f16";
  ctx.beginPath();
  ctx.arc(x - 7, y - 3, 2.4, 0, 7);
  ctx.arc(x + 7, y - 3, 2.4, 0, 7);
  ctx.fill();
  ctx.strokeStyle = "#7a3b2a";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  if (p >= 1) {
    ctx.fillStyle = "#7a3b2a";
    ctx.arc(x, y + 4, 7, 0, Math.PI);
    ctx.fill();
  } else if (p > 0.4) ctx.arc(x, y + 3, 7, 0.15, Math.PI - 0.15);
  else {
    ctx.moveTo(x - 6, y + 9);
    ctx.lineTo(x + 6, y + 9);
  }
  ctx.stroke();
}

/** Queue geometry: one column a lane; the front tile is tall enough for a thumb (48 px on a 390 px phone). */
export function laneBox(lane: number, lanes: number) {
  const gap = 8;
  const w = (STAGE.w - QUEUE.x * 2 - gap * (lanes - 1)) / lanes;
  return { x: QUEUE.x + lane * (w + gap), y: QUEUE.y, w, h: STAGE.h - QUEUE.y - 14 };
}
const FRONT_H = 68;
const BACK_H = 42;
export function tileRect(lane: number, row: number, lanes: number) {
  const box = laneBox(lane, lanes);
  if (row === 0) return { x: box.x, y: box.y, w: box.w, h: FRONT_H };
  return { x: box.x, y: box.y + FRONT_H + 6 + (row - 1) * (BACK_H + 6), w: box.w, h: BACK_H };
}

/** The lane whose column holds the stage point, or null. Any tile of the column counts. */
export function laneAt(x: number, y: number, lanes: number): number | null {
  for (let l = 0; l < lanes; l++) {
    const b = laneBox(l, lanes);
    if (x >= b.x - 3 && x <= b.x + b.w + 3 && y >= b.y - 4 && y <= b.y + b.h) return l;
  }
  return null;
}

type Frame = { sheet: HTMLCanvasElement; col: number; row: number };
function frameOf(
  art: RunArt | null,
  kind: "stand" | "run",
  k: number,
  hex: string,
  col: number,
  row = 0,
): Frame | null {
  if (!art) return null;
  const sheet = waiterSheet(art, kind, (k % 2) as 0 | 1, hex);
  return sheet ? { sheet, col, row } : null;
}
/** Draws a waiter frame `size` stage pixels tall, standing with its feet at (x, feetY). */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  x: number,
  feetY: number,
  size: number,
) {
  const sx = FRAME * f.col;
  ctx.drawImage(
    f.sheet,
    sx,
    f.row * FRAME,
    FRAME,
    FRAME,
    x - size / 2,
    feetY - size * 0.97,
    size,
    size,
  );
}

export function drawRun(ctx: CanvasRenderingContext2D, state: RunState, view: DrawView) {
  const { now, art } = view;
  const img = art?.images;
  const lanes = state.lanes.length;
  const keys = state.dessert.keys;
  const hexOfK = (k: number) => RUN_PALETTE[keys[k]!];
  ctx.clearRect(0, 0, STAGE.w, STAGE.h);

  // ---- room
  if (img?.backdrop) ctx.drawImage(img.backdrop, 0, 0, STAGE.w, STAGE.h);
  else {
    const floor = ctx.createLinearGradient(0, 0, 0, STAGE.h);
    floor.addColorStop(0, "#7a5233");
    floor.addColorStop(1, "#5b3d25");
    ctx.fillStyle = floor;
    ctx.fillRect(0, 0, STAGE.w, STAGE.h);
    ctx.strokeStyle = "rgba(0,0,0,.12)";
    ctx.lineWidth = 1;
    for (let y = 30; y < STAGE.h; y += 34) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(STAGE.w, y);
      ctx.stroke();
    }
  }
  // the plate, with a soft shadow
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath();
  ctx.arc(PLATE.x, PLATE.y + 9, PLATE.r, 0, 7);
  ctx.fill();
  if (img?.plate) {
    const d = (PLATE.r * 2) / 0.96;
    ctx.drawImage(img.plate, PLATE.x - d / 2, PLATE.y - d / 2, d, d);
  } else drawPlainPlate(ctx, PLATE.x, PLATE.y, PLATE.r);
  // the aisle
  if (img?.aisle) ctx.drawImage(img.aisle, AISLE.x, AISLE.y, AISLE.w, AISLE.h);
  else {
    ctx.fillStyle = "#c9a06a";
    ctx.fillRect(AISLE.x, AISLE.y, AISLE.w, AISLE.h);
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(AISLE.x, AISLE.y, 5, AISLE.h);
    ctx.fillRect(AISLE.x + AISLE.w - 5, AISLE.y, 5, AISLE.h);
  }
  // the counter under the spots and the queue
  if (img?.counter) ctx.drawImage(img.counter, 0, STAGE.h - 320, STAGE.w, 320);
  else {
    ctx.fillStyle = "rgba(40,22,10,.35)";
    ctx.fillRect(0, 660, STAGE.w, STAGE.h - 660);
  }

  // ---- guests (behind their tables), tables, plates
  const mood = (j: number) => {
    const p = Math.min(1, state.served[j]!.length / Math.max(1, state.need[j]!));
    return { p, row: p >= 1 ? 2 : p > 0.4 ? 1 : 0 };
  };
  TABLES.forEach((t) => {
    if (img?.table) ctx.drawImage(img.table, t.x, t.y, t.w, t.h);
    else {
      ctx.fillStyle = "#a9754a";
      rr(ctx, t.x + 10, t.y + 62, t.w - 20, 60, 12);
      ctx.fill();
    }
  });
  GUESTS.forEach((g, j) => {
    const { p, row } = mood(j);
    if (img?.guests) {
      const cell = img.guests.naturalWidth / 4;
      const size = 105;
      ctx.drawImage(img.guests, j * cell, row * cell, cell, cell, g.x - size / 2, 474, size, size);
    } else drawPlainGuest(ctx, g.x, g.y, p, j);
  });
  // the table's front (cloth and legs) over the guests, so they sit IN their chairs, behind the table top
  if (img?.table)
    for (const t of TABLES) {
      const k = img.table.naturalHeight / 320;
      const cut = 72;
      ctx.drawImage(
        img.table,
        0,
        cut * k,
        img.table.naturalWidth,
        img.table.naturalHeight - cut * k,
        t.x,
        t.y + (cut / 320) * t.h,
        t.w,
        t.h - (cut / 320) * t.h,
      );
    }
  GUESTS.forEach((g, j) => {
    const { p } = mood(j);
    if (img?.["guest-plate"])
      ctx.drawImage(img["guest-plate"], g.x - 42, GUEST_PLATE_Y - 21, 84, 42);
    else {
      ctx.fillStyle = "#fffaf0";
      ctx.beginPath();
      ctx.ellipse(g.x, GUEST_PLATE_Y, 36, 15, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "#3F6FA6";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    state.served[j]!.forEach((k, i) => {
      const q = Math.min(i, 111);
      drawCube(
        ctx,
        g.x - 29 + (q % 16) * 3.7,
        GUEST_PLATE_Y - 6 - Math.floor(q / 16) * 3.7,
        4.2,
        hexOfK(k),
      );
    });
    if (p >= 1) {
      const bob = Math.sin(now / 200 + j) * 3;
      if (img?.sparkle) ctx.drawImage(img.sparkle, g.x + 18, 466 + bob, 30, 30);
      else {
        ctx.fillStyle = "#e8514a";
        ctx.font = `800 20px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText("♥", g.x, 500 + bob);
      }
    }
  });
  // the serving cart
  if (img?.cart) ctx.drawImage(img.cart, CART.x - 42, CART.y - 26, 84, 84);
  else {
    ctx.fillStyle = "#6e4a2b";
    rr(ctx, CART.x - 28, CART.y - 5, 56, 36, 8);
    ctx.fill();
    ctx.fillStyle = "#e3c27f";
    rr(ctx, CART.x - 24, CART.y - 11, 48, 11, 5);
    ctx.fill();
  }

  // ---- the dessert
  const dim = view.peek != null;
  const dprK = ctx.getTransform().a || 1;
  // The cubes are cut by the plate's round well, so the ones at the edge follow its shape (the board holds every cube that meets the circle).
  ctx.save();
  ctx.beginPath();
  ctx.arc(PLATE.x, PLATE.y, WELL_R, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < state.grid.length; i++) {
    const k = state.grid[i]!;
    if (k < 0) continue;
    const col = i % GRID;
    const row = (i / GRID) | 0;
    // Tile edges sit on whole device pixels: the right edge of one tile is the left edge of the next, never a gap.
    const x = Math.floor((ORIGIN.x + col * CELL) * dprK) / dprK;
    const y = Math.floor((ORIGIN.y + row * CELL) * dprK) / dprK;
    const x2 = Math.floor((ORIGIN.x + (col + 1) * CELL) * dprK) / dprK;
    const y2 = Math.floor((ORIGIN.y + (row + 1) * CELL) * dprK) / dprK;
    const match = view.peek != null && k === view.peek && isExposed(state.ext, i);
    ctx.globalAlpha = dim && k !== view.peek ? 0.32 : 1;
    // The tile's box is whole device pixels; its sprite is blitted 1:1, so the right edge of one tile is the left
    // edge of the next and nothing can show or blur between them.
    ctx.drawImage(
      tileSprite(cellHex(state, i), Math.round((x2 - x) * dprK), Math.round((y2 - y) * dprK)),
      x,
      y,
      x2 - x,
      y2 - y,
    );
    if (match) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 130);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2.5;
      rr(ctx, x - 0.5, y - 0.5, CELL + 0.5, CELL + 0.5, 4);
      ctx.stroke();
    } else if (dim && k === view.peek) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "rgba(0,0,0,.35)";
      rr(ctx, x, y, CELL - 0.6, CELL - 0.6, 4);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // a soft shade just inside the rim, so the mosaic sits down in the dish
  const rim = ctx.createRadialGradient(PLATE.x, PLATE.y, WELL_R - 10, PLATE.x, PLATE.y, WELL_R);
  rim.addColorStop(0, "rgba(70,35,10,0)");
  rim.addColorStop(1, "rgba(70,35,10,.32)");
  ctx.fillStyle = rim;
  ctx.fillRect(PLATE.x - WELL_R, PLATE.y - WELL_R, WELL_R * 2, WELL_R * 2);
  ctx.restore();

  // ---- runners and flying cubes
  const step = Math.floor(state.time * 9) % 2;
  state.spots.forEach((spot) => {
    if (!spot || spot.done || !spot.run.path) return;
    const run = spot.run;
    const carrying = run.carry >= 0;
    const f = carrying
      ? frameOf(art, "run", spot.k, spot.hex, step, 1)
      : frameOf(art, "run", spot.k, spot.hex, 2 + step, 0);
    if (f) {
      const size = 62;
      drawFrame(ctx, f, run.x, run.y + 14, size);
      if (carrying) drawCube(ctx, run.x - 6, run.y - 12, 12, hexOfK(run.carry));
    } else drawPlainWaiter(ctx, run.x, run.y, 34, spot.hex, carrying ? hexOfK(run.carry) : null);
  });
  for (const f of state.flights) {
    const g = GUESTS[f.guest]!;
    const x = CART.x + (g.x - CART.x) * f.t;
    const y = CART.y + (GUEST_PLATE_Y - CART.y) * f.t - Math.sin(Math.PI * f.t) * 36;
    drawCube(ctx, x - 6, y - 6, 12, hexOfK(f.k));
  }

  // ---- standby spots
  if (!img?.counter) {
    ctx.fillStyle = "rgba(255,240,215,.95)";
    ctx.font = `800 13px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText("STANDBY", 18, 666);
  }
  for (let i = 0; i < SPOT_COUNT; i++) {
    const c = spotCenter(i);
    const spot = state.spots[i];
    if (img?.spot) {
      const half = img.spot.naturalWidth / 2;
      ctx.drawImage(
        img.spot,
        spot ? half : 0,
        0,
        half,
        img.spot.naturalHeight,
        c.x - 52,
        c.y - 44,
        104,
        104,
      );
    } else {
      ctx.fillStyle = spot ? "rgba(255,248,232,.16)" : "rgba(0,0,0,.2)";
      rr(ctx, c.x - SPOT_W / 2, c.y - 46, SPOT_W, 92, 16);
      ctx.fill();
      ctx.setLineDash(spot ? [] : [5, 5]);
      ctx.strokeStyle = "rgba(255,240,215,.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (!spot) continue;
    const waiting = isWaiting(state, spot);
    const out = !!spot.run.path;
    if (!out) {
      const pose = spot.done ? 2 : waiting ? 1 : 0;
      const f = frameOf(art, "stand", spot.k, spot.hex, pose);
      const bow = spot.done ? Math.sin(Math.min(1, spot.done / 0.5) * Math.PI) * 3 : 0;
      if (f) drawFrame(ctx, f, c.x, c.y + 16 + bow, 82);
      else {
        ctx.globalAlpha = waiting ? 0.6 : 1;
        drawPlainWaiter(ctx, c.x, c.y - 4 + bow, 56, spot.hex, null);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.arc(c.x + 30, c.y + 28, 17, 0, 7);
    ctx.fill();
    ctx.strokeStyle = spot.hex;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.fillStyle = "#2a1f16";
    ctx.font = `800 18px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(String(Math.max(0, spot.n)), c.x + 30, c.y + 35);
    if (waiting) {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,.55)";
      ctx.lineWidth = 3;
      ctx.font = `800 13px ${FONT}`;
      ctx.textAlign = "left";
      ctx.strokeText("waiting", c.x - SPOT_W / 2 + 6, c.y - 36);
      ctx.fillText("waiting", c.x - SPOT_W / 2 + 6, c.y - 36);
    }
  }

  // ---- the queue
  if (!img?.counter) {
    ctx.fillStyle = "rgba(255,240,215,.95)";
    ctx.font = `800 13px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText("WAITERS", STAGE.w - 18, QUEUE.y - 6);
  }
  for (let l = 0; l < lanes; l++) {
    const lane = state.lanes[l]!;
    for (let r = 0; r < QUEUE.rows; r++) {
      const w = lane[r];
      if (!w) continue;
      const q = tileRect(l, r, lanes);
      const sh = r === 0 ? view.shake.find((s) => s.lane === l) : undefined;
      const dx = sh ? Math.sin(sh.t * 60) * 5 * (1 - sh.t / 0.4) : 0;
      const front = r === 0;
      ctx.globalAlpha = front ? 1 : 0.6;
      ctx.fillStyle = shade(w.hex, -0.3);
      rr(ctx, q.x + dx, q.y + 3, q.w, q.h, 14);
      ctx.fill();
      ctx.fillStyle = w.hex;
      rr(ctx, q.x + dx, q.y, q.w, q.h - 3, 14);
      ctx.fill();
      if (front && view.hoverLane === l) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      const f = frameOf(art, "stand", w.k, w.hex, 0);
      if (f) {
        // the waiter's head and chest, cropped into the tile
        const sc = (front ? 66 : 40) / 105;
        ctx.save();
        rr(ctx, q.x + dx + 2, q.y, q.w - 4, q.h - 3, 14);
        ctx.clip();
        ctx.drawImage(f.sheet, 30, 0, 132, 105, q.x + dx + 6, q.y + 2, 132 * sc, 105 * sc);
        ctx.restore();
      } else
        drawPlainWaiter(
          ctx,
          q.x + dx + 28,
          q.y + q.h / 2 - 2,
          front ? 36 : 28,
          shade(w.hex, -0.2),
          null,
        );
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,.45)";
      ctx.lineWidth = 4;
      ctx.font = `800 ${front ? 26 : 20}px ${FONT}`;
      ctx.textAlign = "right";
      ctx.strokeText(String(w.n), q.x + dx + q.w - 12, q.y + q.h / 2 + (front ? 9 : 7));
      ctx.fillText(String(w.n), q.x + dx + q.w - 12, q.y + q.h / 2 + (front ? 9 : 7));
      ctx.globalAlpha = 1;
    }
    if (lane.length > QUEUE.rows) {
      const q = tileRect(l, QUEUE.rows - 1, lanes);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,.55)";
      ctx.lineWidth = 3;
      ctx.font = `800 13px ${FONT}`;
      ctx.textAlign = "left";
      ctx.strokeText(`+${lane.length - QUEUE.rows}`, q.x + 6, q.y + q.h + 15);
      ctx.fillText(`+${lane.length - QUEUE.rows}`, q.x + 6, q.y + q.h + 15);
    }
  }
  if (view.hintOn && state.lanes[0]?.[0] && state.phase === "play") {
    const q = tileRect(0, 0, lanes);
    const b = Math.sin(now / 220) * 5;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(q.x + 70, q.y - 6 + b);
    ctx.lineTo(q.x + 56, q.y - 22 + b);
    ctx.lineTo(q.x + 84, q.y - 22 + b);
    ctx.closePath();
    ctx.fill();
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = "left";
    ctx.strokeText("Tap me", q.x + 94, q.y - 10 + b);
    ctx.fillText("Tap me", q.x + 94, q.y - 10 + b);
  }
  if (view.notice) {
    ctx.fillStyle = "rgba(40,22,10,.85)";
    rr(ctx, STAGE.w / 2 - 130, 648, 260, 30, 15);
    ctx.fill();
    ctx.fillStyle = "#fff4d9";
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(view.notice, STAGE.w / 2, 669);
  }
}
