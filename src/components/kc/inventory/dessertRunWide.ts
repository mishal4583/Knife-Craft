import {
  AISLE,
  CART,
  CELL,
  GUESTS,
  ORIGIN,
  PLATE,
  QUEUE,
  SPOT_COUNT,
  TABLES,
  WELL_R,
  cellHex,
  isWaiting,
  spotCenter,
  type RunState,
} from "@/game/business/dessertRun";
import { GRID, RUN_PALETTE } from "@/game/business/dessertGallery";
import {
  FONT,
  GUEST_BOTTOM,
  GUEST_SIZE,
  RUNNER_SIZE,
  drawCube,
  drawFrame,
  drawPlainGuest,
  drawPlainPlate,
  drawPlainWaiter,
  frameOf,
  plateLayout,
  rr,
  shade,
  tileSprite,
  type DrawView,
} from "./dessertRunDraw";

/**
 * Dessert Run on a LANDSCAPE board (developer 2026-11-20: "design wide versions"). The rules are untouched: the same `RunState`, the same `stepRun`, the same
 * seeds and the same proofs (`dessert-run-qa`), because nothing here changes where anything is IN THE GAME: the plate, the aisle and the cart keep their game
 * coordinates, and this file only decides where they are DRAWN. The board is 960 x 540 (16:9) and reads from left to right:
 *   - the four guests at their two tables (cosmetic: a plate is served in quarters and the cube flies to the guest it belongs to),
 *   - the plate, upright (a lollipop stays a lollipop), with the aisle and the serving cart under it at 0.88 of their game size,
 *   - the five standby spots, the first one lowest (nearest the aisle, where the first waiters go), and
 *   - the waiters' queue, one ROW a lane, the front waiter on the left (a tap anywhere in a row sends it).
 * The picture behind it is the Codex wide room (`game-dessert-run.webp`), put there by the screen.
 */
export const RUN_WIDE = { w: 960, h: 540 } as const;

/** The game column (plate, aisle, cart) is the game's own stage scaled by SCALE; the game's (270, 81) lands at (CX, TOP). */
const SCALE = 0.88;
const CX = 410;
const TOP = 10;
export const mapX = (x: number) => CX + (x - 270) * SCALE;
export const mapY = (y: number) => TOP + (y - 81) * SCALE;

/** The two tables: the left edge of each is at x 0; the guests sit at the table's two place settings. */
const TABLE_AT = [
  { x: 0, y: 112 },
  { x: 0, y: 332 },
] as const;
const guestAt = (j: number) => {
  const t = j >> 1;
  const table = TABLE_AT[t]!;
  return {
    x: table.x + (GUESTS[j]!.x - TABLES[t]!.x),
    bottom: table.y + (GUEST_BOTTOM - TABLES[t]!.y),
    plateY: table.y + 45,
  };
};

const SPOT_X = 654;
const SPOT_STEP = 96;
/** The first standby spot is the lowest, nearest the aisle: the first waiters of a round run the shortest way. */
export const spotAt = (i: number) => ({ x: SPOT_X, y: 450 - i * SPOT_STEP });

const BENCH = { x: 596, y: 6, w: 362, h: 528 } as const;
const QUEUE_X = 708;
const QUEUE_COLS = [
  { dx: 0, w: 118 },
  { dx: 124, w: 56 },
  { dx: 186, w: 56 },
] as const;

/** A lane is one row of the queue: the front waiter on the left. */
export function rowBox(lane: number, lanes: number) {
  const top = 14;
  const band = (RUN_WIDE.h - top * 2) / lanes;
  const h = Math.min(80, band - 10);
  return { x: QUEUE_X, y: top + lane * band + (band - h) / 2, w: 242, h, band, top };
}
export function tileRectWide(lane: number, row: number, lanes: number) {
  const b = rowBox(lane, lanes);
  const c = QUEUE_COLS[row]!;
  return { x: b.x + c.dx, y: b.y, w: c.w, h: b.h };
}
/** The lane whose row holds the board point, or null. The whole band of the row counts, so a thumb never misses between two tiles. */
export function laneAtWide(x: number, y: number, lanes: number): number | null {
  if (x < QUEUE_X - 10 || x > RUN_WIDE.w) return null;
  for (let l = 0; l < lanes; l++) {
    const b = rowBox(l, lanes);
    if (y >= b.top + l * b.band && y < b.top + (l + 1) * b.band) return l;
  }
  return null;
}

/**
 * Where a runner is DRAWN. In the game a runner starts on its standby spot, walks to the foot of the aisle, up the aisle, to its cube and back to the
 * cart; only the first walk (spot to aisle) is not on the game column, so it is drawn as a straight line from the spot's place on this board to the
 * foot of the aisle, at the same share of the way as in the game.
 */
function runnerAt(state: RunState, si: number) {
  const run = state.spots[si]!.run;
  const first = run.path?.[0];
  if (first && run.i === 0 && run.y > AISLE.y + AISLE.h && first.y === AISLE.y + AISLE.h) {
    const c = spotCenter(si);
    const total = Math.hypot(first.x - c.x, first.y - c.y) || 1;
    const f = Math.min(1, Math.hypot(run.x - c.x, run.y - c.y) / total);
    const from = spotAt(si);
    const to = { x: mapX(first.x), y: mapY(first.y) };
    return { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f };
  }
  return { x: mapX(run.x), y: mapY(run.y) };
}

export function drawRunWide(ctx: CanvasRenderingContext2D, state: RunState, view: DrawView) {
  const { now, art } = view;
  const img = art?.images;
  const lanes = state.lanes.length;
  const keys = state.dessert.keys;
  const hexOfK = (k: number) => RUN_PALETTE[keys[k]!];
  ctx.clearRect(0, 0, RUN_WIDE.w, RUN_WIDE.h);

  // ---- the bench under the standby spots and the queue (the room itself is the picture behind the canvas)
  ctx.fillStyle = "rgba(48,26,12,.62)";
  rr(ctx, BENCH.x, BENCH.y, BENCH.w, BENCH.h, 22);
  ctx.fill();
  ctx.strokeStyle = "rgba(230,190,120,.55)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // ---- the two tables, the guests behind them, the plates on them
  const mood = (j: number) => {
    const p = Math.min(1, state.served[j]!.length / Math.max(1, state.need[j]!));
    return { p, row: p >= 1 ? 2 : p > 0.4 ? 1 : 0 };
  };
  const TW = TABLES[0].w;
  const TH = TABLES[0].h;
  for (const t of TABLE_AT) {
    if (img?.table) ctx.drawImage(img.table, t.x, t.y, TW, TH);
    else {
      ctx.fillStyle = "#a9754a";
      rr(ctx, t.x + 10, t.y + 62, TW - 20, 60, 12);
      ctx.fill();
    }
  }
  GUESTS.forEach((_g, j) => {
    const at = guestAt(j);
    const { p, row } = mood(j);
    if (img?.guests) {
      const cell = img.guests.naturalWidth / 4;
      ctx.drawImage(
        img.guests,
        j * cell,
        row * cell,
        cell,
        cell,
        at.x - GUEST_SIZE / 2,
        at.bottom - GUEST_SIZE,
        GUEST_SIZE,
        GUEST_SIZE,
      );
    } else drawPlainGuest(ctx, at.x, at.bottom - 19, p, j);
  });
  // the table's front over the guests, so they sit behind the table top
  if (img?.table)
    for (const t of TABLE_AT) {
      const k = img.table.naturalHeight / 320;
      const cut = 72;
      ctx.drawImage(
        img.table,
        0,
        cut * k,
        img.table.naturalWidth,
        img.table.naturalHeight - cut * k,
        t.x,
        t.y + (cut / 320) * TH,
        TW,
        TH - (cut / 320) * TH,
      );
    }
  GUESTS.forEach((_g, j) => {
    const at = guestAt(j);
    const { p } = mood(j);
    if (img?.["guest-plate"]) ctx.drawImage(img["guest-plate"], at.x - 42, at.plateY - 21, 84, 42);
    else {
      ctx.fillStyle = "#fffaf0";
      ctx.beginPath();
      ctx.ellipse(at.x, at.plateY, 36, 15, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "#3F6FA6";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    const lay = plateLayout(state.need[j]!);
    state.served[j]!.forEach((k, i) => {
      const c = lay.cells[Math.min(i, lay.cells.length - 1)]!;
      drawCube(
        ctx,
        at.x + c.x - lay.size / 2,
        at.plateY + c.y - lay.size / 2,
        lay.size + 0.3,
        hexOfK(k),
      );
    });
    if (p >= 1) {
      const bob = Math.sin(now / 200 + j) * 3;
      if (img?.sparkle) ctx.drawImage(img.sparkle, at.x + 16, at.bottom - 105 + bob, 30, 30);
      else {
        ctx.fillStyle = "#e8514a";
        ctx.font = `800 20px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText("♥", at.x, at.bottom - 73 + bob);
      }
    }
  });

  // ---- the plate (upright), the aisle and the cart
  const px = mapX(PLATE.x);
  const py = mapY(PLATE.y);
  const pr = PLATE.r * SCALE;
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath();
  ctx.arc(px, py + 9, pr, 0, 7);
  ctx.fill();
  if (img?.plate) {
    const d = (pr * 2) / 0.96;
    ctx.drawImage(img.plate, px - d / 2, py - d / 2, d, d);
  } else drawPlainPlate(ctx, px, py, pr);
  if (img?.aisle)
    ctx.drawImage(img.aisle, mapX(AISLE.x), mapY(AISLE.y), AISLE.w * SCALE, AISLE.h * SCALE);
  else {
    ctx.fillStyle = "#c9a06a";
    ctx.fillRect(mapX(AISLE.x), mapY(AISLE.y), AISLE.w * SCALE, AISLE.h * SCALE);
  }
  const cartX = mapX(CART.x);
  const cartY = mapY(CART.y);
  if (img?.cart)
    ctx.drawImage(img.cart, cartX - 42 * SCALE, cartY - 26 * SCALE, 84 * SCALE, 84 * SCALE);
  else {
    ctx.fillStyle = "#6e4a2b";
    rr(ctx, cartX - 25, cartY - 4, 50, 32, 8);
    ctx.fill();
  }

  // ---- the dessert: the game's cubes at the game column's scale, cut by the plate's round well
  const dpr = ctx.getTransform().a || 1;
  const cell = CELL * SCALE;
  const ox = mapX(ORIGIN.x);
  const oy = mapY(ORIGIN.y);
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, WELL_R * SCALE, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < state.grid.length; i++) {
    if (state.grid[i]! < 0) continue;
    const col = i % GRID;
    const row = (i / GRID) | 0;
    const x = Math.floor((ox + col * cell) * dpr) / dpr;
    const y = Math.floor((oy + row * cell) * dpr) / dpr;
    const x2 = Math.floor((ox + (col + 1) * cell) * dpr) / dpr;
    const y2 = Math.floor((oy + (row + 1) * cell) * dpr) / dpr;
    ctx.drawImage(
      tileSprite(cellHex(state, i), Math.round((x2 - x) * dpr), Math.round((y2 - y) * dpr)),
      x,
      y,
      x2 - x,
      y2 - y,
    );
  }
  const rim = ctx.createRadialGradient(px, py, WELL_R * SCALE - 10, px, py, WELL_R * SCALE);
  rim.addColorStop(0, "rgba(70,35,10,0)");
  rim.addColorStop(1, "rgba(70,35,10,.32)");
  ctx.fillStyle = rim;
  ctx.fillRect(px - WELL_R * SCALE, py - WELL_R * SCALE, WELL_R * 2 * SCALE, WELL_R * 2 * SCALE);
  ctx.restore();

  // ---- runners and flying cubes
  const step = Math.floor(state.time * 9) % 2;
  const runSize = RUNNER_SIZE * 0.92;
  state.spots.forEach((spot, si) => {
    if (!spot || spot.done || !spot.run.path) return;
    const at = runnerAt(state, si);
    const carrying = spot.run.carry >= 0;
    const f = carrying
      ? frameOf(art, "run", spot.k, spot.hex, step, 1)
      : frameOf(art, "run", spot.k, spot.hex, 2 + step, 0);
    if (f) {
      drawFrame(ctx, f, at.x, at.y + 13, runSize);
      if (carrying)
        drawCube(
          ctx,
          at.x + runSize * 0.035 - 6.5,
          at.y + 13 - runSize * 0.58 - 9,
          13,
          hexOfK(spot.run.carry),
        );
    } else drawPlainWaiter(ctx, at.x, at.y, 32, spot.hex, carrying ? hexOfK(spot.run.carry) : null);
  });
  for (const f of state.flights) {
    const at = guestAt(f.guest);
    const x = cartX + (at.x - cartX) * f.t;
    const y = cartY + (at.plateY - cartY) * f.t - Math.sin(Math.PI * f.t) * 60;
    const fs = 12 - 7 * f.t;
    drawCube(ctx, x - fs / 2, y - fs / 2, fs, hexOfK(f.k));
  }

  // ---- standby spots (the first one lowest)
  for (let i = 0; i < SPOT_COUNT; i++) {
    const c = spotAt(i);
    const spot = state.spots[i];
    if (img?.spot) {
      const half = img.spot.naturalWidth / 2;
      ctx.drawImage(
        img.spot,
        spot ? half : 0,
        0,
        half,
        img.spot.naturalHeight,
        c.x - 48,
        c.y - 40,
        96,
        96,
      );
    } else {
      ctx.fillStyle = spot ? "rgba(255,248,232,.16)" : "rgba(0,0,0,.2)";
      rr(ctx, c.x - 44, c.y - 42, 88, 88, 16);
      ctx.fill();
      ctx.setLineDash(spot ? [] : [5, 5]);
      ctx.strokeStyle = "rgba(255,240,215,.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (!spot) continue;
    const waiting = isWaiting(state, spot);
    if (!spot.run.path) {
      const pose = spot.done ? 2 : waiting ? 1 : 0;
      const f = frameOf(art, "stand", spot.k, spot.hex, pose);
      const bow = spot.done ? Math.sin(Math.min(1, spot.done / 0.5) * Math.PI) * 3 : 0;
      if (f) drawFrame(ctx, f, c.x, c.y + 15 + bow, 76);
      else {
        ctx.globalAlpha = waiting ? 0.6 : 1;
        drawPlainWaiter(ctx, c.x, c.y - 4 + bow, 52, spot.hex, null);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.arc(c.x + 28, c.y + 26, 16, 0, 7);
    ctx.fill();
    ctx.strokeStyle = spot.hex;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.fillStyle = "#2a1f16";
    ctx.font = `800 17px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(String(Math.max(0, spot.n)), c.x + 28, c.y + 32);
    if (waiting) {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,.55)";
      ctx.lineWidth = 3;
      ctx.font = `800 13px ${FONT}`;
      ctx.textAlign = "left";
      ctx.strokeText("waiting", c.x - 42, c.y - 34);
      ctx.fillText("waiting", c.x - 42, c.y - 34);
    }
  }

  // ---- the queue: one row a lane, the front waiter on the left
  for (let l = 0; l < lanes; l++) {
    const lane = state.lanes[l]!;
    for (let r = 0; r < QUEUE.rows; r++) {
      const w = lane[r];
      if (!w) continue;
      const q = tileRectWide(l, r, lanes);
      const sh = r === 0 ? view.shake.find((s) => s.lane === l) : undefined;
      const dy = sh ? Math.sin(sh.t * 60) * 5 * (1 - sh.t / 0.4) : 0;
      const front = r === 0;
      ctx.globalAlpha = front ? 1 : 0.62;
      ctx.fillStyle = shade(w.hex, -0.3);
      rr(ctx, q.x, q.y + 3 + dy, q.w, q.h, 14);
      ctx.fill();
      ctx.fillStyle = w.hex;
      rr(ctx, q.x, q.y + dy, q.w, q.h - 3, 14);
      ctx.fill();
      if (front && view.hoverLane === l) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      const f = frameOf(art, "stand", w.k, w.hex, 0);
      if (f) {
        // the waiter's head and chest, cropped into the tile
        const sc = (q.h - 6) / 105;
        ctx.save();
        rr(ctx, q.x + 2, q.y + dy, q.w - 4, q.h - 3, 14);
        ctx.clip();
        ctx.drawImage(
          f.sheet,
          30,
          0,
          132,
          105,
          q.x + (front ? 4 : -4),
          q.y + dy + 2,
          132 * sc,
          105 * sc,
        );
        ctx.restore();
      } else
        drawPlainWaiter(
          ctx,
          q.x + 28,
          q.y + dy + q.h / 2 - 2,
          front ? 36 : 26,
          shade(w.hex, -0.2),
          null,
        );
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,.45)";
      ctx.lineWidth = 4;
      ctx.font = `800 ${front ? 28 : 21}px ${FONT}`;
      ctx.textAlign = "right";
      ctx.strokeText(String(w.n), q.x + q.w - 10, q.y + dy + q.h / 2 + (front ? 9 : 7));
      ctx.fillText(String(w.n), q.x + q.w - 10, q.y + dy + q.h / 2 + (front ? 9 : 7));
      ctx.globalAlpha = 1;
    }
    if (lane.length > QUEUE.rows) {
      const q = tileRectWide(l, QUEUE.rows - 1, lanes);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,.55)";
      ctx.lineWidth = 3;
      ctx.font = `800 14px ${FONT}`;
      ctx.textAlign = "right";
      ctx.strokeText(`+${lane.length - QUEUE.rows}`, q.x + q.w - 2, q.y + q.h + 15);
      ctx.fillText(`+${lane.length - QUEUE.rows}`, q.x + q.w - 2, q.y + q.h + 15);
    }
  }
  if (view.hintOn && state.lanes[0]?.[0] && state.phase === "play") {
    const q = tileRectWide(0, 0, lanes);
    const b = Math.sin(now / 220) * 4;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(q.x + 40, q.y + q.h + 4 + b);
    ctx.lineTo(q.x + 28, q.y + q.h + 18 + b);
    ctx.lineTo(q.x + 52, q.y + q.h + 18 + b);
    ctx.closePath();
    ctx.fill();
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = "left";
    ctx.strokeText("Tap me", q.x + 62, q.y + q.h + 18 + b);
    ctx.fillText("Tap me", q.x + 62, q.y + q.h + 18 + b);
  }
  if (view.notice) {
    ctx.fillStyle = "rgba(40,22,10,.85)";
    rr(ctx, mapX(270) - 130, 8, 260, 30, 15);
    ctx.fill();
    ctx.fillStyle = "#fff4d9";
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(view.notice, mapX(270), 29);
  }
}
