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
  hintLane,
  isWaiting,
  spotCenter,
  type RunState,
} from "@/game/business/dessertRun";
import { RUN_PALETTE } from "@/game/business/dessertGallery";
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
  drawMosaic,
  type DrawView,
  drawWaitingTag,
} from "./dessertRunDraw";

/**
 * Dessert Run on a LANDSCAPE board, laid out like the developer's mock-up (2026-11-20: "make the dessert run proper and optimized like this"). The rules are untouched:
 * the same `RunState`, the same `stepRun`, the same seeds and proofs (`dessert-run-qa`), because nothing here changes where anything is IN THE GAME: the plate, the aisle
 * and the cart keep their game coordinates, and this file only decides where they are DRAWN. The board is 960 x 540 (16:9):
 *   - the header (back, the dessert's name, speed, tip, pause) runs along the top (the screen's DOM),
 *   - on the left the big round plate, UPRIGHT (a lollipop stays a lollipop), with the aisle and the serving cart under it, and the two tables with the four
 *     guests along the bottom, the cart between them (the guests are cosmetic: a plate is served in quarters),
 *   - on the right a wooden cabinet: the five standby spots in a ROW on its top shelf (the first one nearest the plate), and under it the waiters' queue as
 *     COLUMNS, one a lane, the front waiter on top, "+N" under a column that has more waiters than the three shown (a tap anywhere in a column sends its front waiter).
 * The picture behind it is the Codex wide room (`game-dessert-run.webp`), put there by the screen.
 */
export const RUN_WIDE = { w: 960, h: 540 } as const;

/** The game column (plate, aisle, cart) is the game's own stage scaled by SCALE; the game's (270, 308) lands at (CX, PY). */
const SCALE = 0.79;
const CX = 275;
const PY = 235;
export const mapX = (x: number) => CX + (x - 270) * SCALE;
export const mapY = (y: number) => PY + (y - 308) * SCALE;

/** The two tables sit either side of the cart, a little smaller than in the game (K); the guests sit at their two place settings. */
const K = 0.86;
const TABLE_AT = [
  { x: 36, y: 408 },
  { x: 322, y: 408 },
] as const;
const guestAt = (j: number) => {
  const t = j >> 1;
  const table = TABLE_AT[t]!;
  return {
    x: table.x + (GUESTS[j]!.x - TABLES[t]!.x) * K,
    bottom: table.y + (GUEST_BOTTOM - TABLES[t]!.y) * K,
    plateY: table.y + 45 * K,
  };
};

/** The cabinet: a shelf of five standby spots over the box that holds the queue. */
const CAB = { x: 491, y: 91, w: 442, h: 397 } as const;
const SHELF = { x: 500, y: 100, w: 424, h: 142 } as const;
const BOX = { x: 500, y: 254, w: 424, h: 226 } as const;
/** The first standby spot is the nearest to the plate. */
export const spotAt = (i: number) => ({ x: 548 + i * 80, y: 198 });

const GRID_X = 512;
const GRID_W = 400;
const GAP = 6;
const ROWS = [
  { y: 275, h: 58 },
  { y: 339, h: 46 },
  { y: 391, h: 46 },
] as const;
const colW = (lanes: number) => (GRID_W - GAP * (lanes - 1)) / lanes;
export function tileRectWide(lane: number, row: number, lanes: number) {
  const w = colW(lanes);
  return { x: GRID_X + lane * (w + GAP), y: ROWS[row]!.y, w, h: ROWS[row]!.h };
}
/** The lane whose column holds the board point, or null. The whole height of the box counts, so a thumb never misses between two tiles. */
export function laneAtWide(x: number, y: number, lanes: number): number | null {
  if (y < BOX.y || y > BOX.y + BOX.h || x < GRID_X - 4 || x > GRID_X + GRID_W + 4) return null;
  const w = colW(lanes);
  return Math.min(lanes - 1, Math.max(0, Math.floor((x - GRID_X) / (w + GAP))));
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

/** The wooden cabinet and the bench along the bottom, painted in code over the room picture. */
function drawCabinet(ctx: CanvasRenderingContext2D) {
  // (the counter along the bottom of the room is the screen's own full-width strip behind the canvas, so it never stops at the board's edge)
  // the cabinet: a gold-rimmed wooden frame
  ctx.save();
  ctx.shadowColor = "rgba(30,14,4,.5)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 5;
  const wood = ctx.createLinearGradient(0, CAB.y, 0, CAB.y + CAB.h);
  wood.addColorStop(0, "#b8702f");
  wood.addColorStop(1, "#8a4d1e");
  ctx.fillStyle = wood;
  rr(ctx, CAB.x, CAB.y, CAB.w, CAB.h, 24);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#e9bd5e";
  ctx.lineWidth = 4;
  rr(ctx, CAB.x, CAB.y, CAB.w, CAB.h, 24);
  ctx.stroke();
  // the shelf of standby spots: a dark recess with a light wooden lip under it
  const recess = ctx.createLinearGradient(0, SHELF.y, 0, SHELF.y + SHELF.h);
  recess.addColorStop(0, "#4b2a12");
  recess.addColorStop(1, "#7a4519");
  ctx.fillStyle = recess;
  rr(ctx, SHELF.x, SHELF.y, SHELF.w, SHELF.h, 16);
  ctx.fill();
  const lip = ctx.createLinearGradient(0, SHELF.y + SHELF.h - 4, 0, SHELF.y + SHELF.h + 14);
  lip.addColorStop(0, "#e6a85a");
  lip.addColorStop(1, "#b9742f");
  ctx.fillStyle = lip;
  rr(ctx, CAB.x + 4, SHELF.y + SHELF.h - 2, CAB.w - 8, 16, 7);
  ctx.fill();
  // the queue's box
  const box = ctx.createLinearGradient(0, BOX.y, 0, BOX.y + BOX.h);
  box.addColorStop(0, "#5a3416");
  box.addColorStop(1, "#44250f");
  ctx.fillStyle = box;
  rr(ctx, BOX.x, BOX.y, BOX.w, BOX.h, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(233,189,94,.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawRunWide(ctx: CanvasRenderingContext2D, state: RunState, view: DrawView) {
  const { now, art } = view;
  const img = art?.images;
  const lanes = state.lanes.length;
  const keys = state.dessert.keys;
  const hexOfK = (k: number) => RUN_PALETTE[keys[k]!];
  ctx.clearRect(0, 0, RUN_WIDE.w, RUN_WIDE.h);

  drawCabinet(ctx);

  // ---- the plate (upright), the aisle and the dessert
  const px = mapX(PLATE.x);
  const py = mapY(PLATE.y);
  const pr = PLATE.r * SCALE;
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath();
  ctx.arc(px, py + 8, pr, 0, 7);
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
  const cell = CELL * SCALE;
  const ox = mapX(ORIGIN.x);
  const oy = mapY(ORIGIN.y);
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, WELL_R * SCALE, 0, Math.PI * 2);
  ctx.clip();
  drawMosaic(ctx, state, art, ox, oy, cell);
  const rim = ctx.createRadialGradient(px, py, WELL_R * SCALE - 10, px, py, WELL_R * SCALE);
  rim.addColorStop(0, "rgba(70,35,10,0)");
  rim.addColorStop(1, "rgba(70,35,10,.32)");
  ctx.fillStyle = rim;
  ctx.fillRect(px - WELL_R * SCALE, py - WELL_R * SCALE, WELL_R * 2 * SCALE, WELL_R * 2 * SCALE);
  ctx.restore();

  // ---- the two tables, the guests behind them, the plates on them (in front of the plate's lower rim, as in the mock-up)
  const mood = (j: number) => {
    const p = Math.min(1, state.served[j]!.length / Math.max(1, state.need[j]!));
    return { p, row: p >= 1 ? 2 : p > 0.4 ? 1 : 0 };
  };
  const TW = TABLES[0].w * K;
  const TH = TABLES[0].h * K;
  for (const t of TABLE_AT) {
    if (img?.table) ctx.drawImage(img.table, t.x, t.y, TW, TH);
    else {
      ctx.fillStyle = "#a9754a";
      rr(ctx, t.x + 8, t.y + 52, TW - 16, 52, 12);
      ctx.fill();
    }
  }
  const gs = GUEST_SIZE * K;
  GUESTS.forEach((_g, j) => {
    const at = guestAt(j);
    const { p, row } = mood(j);
    if (img?.guests) {
      const c = img.guests.naturalWidth / 4;
      ctx.drawImage(img.guests, j * c, row * c, c, c, at.x - gs / 2, at.bottom - gs, gs, gs);
    } else drawPlainGuest(ctx, at.x, at.bottom - 17, p, j);
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
    ctx.save();
    ctx.translate(at.x, at.plateY);
    ctx.scale(K, K);
    if (img?.["guest-plate"]) ctx.drawImage(img["guest-plate"], -42, -21, 84, 42);
    else {
      ctx.fillStyle = "#fffaf0";
      ctx.beginPath();
      ctx.ellipse(0, 0, 36, 15, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "#3F6FA6";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    const lay = plateLayout(state.need[j]!);
    state.served[j]!.forEach((k, i) => {
      const c = lay.cells[Math.min(i, lay.cells.length - 1)]!;
      drawCube(ctx, c.x - lay.size / 2, c.y - lay.size / 2, lay.size + 0.3, hexOfK(k));
    });
    ctx.restore();
    if (p >= 1) {
      const bob = Math.sin(now / 200 + j) * 3;
      if (img?.sparkle) ctx.drawImage(img.sparkle, at.x + 14, at.bottom - gs - 12 + bob, 28, 28);
      else {
        ctx.fillStyle = "#e8514a";
        ctx.font = `800 20px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText("♥", at.x, at.bottom - gs + bob);
      }
    }
  });

  // ---- the serving cart, between the tables
  const cartX = mapX(CART.x);
  const cartY = mapY(CART.y);
  if (img?.cart)
    ctx.drawImage(img.cart, cartX - 42 * SCALE, cartY - 26 * SCALE, 84 * SCALE, 84 * SCALE);
  else {
    ctx.fillStyle = "#6e4a2b";
    rr(ctx, cartX - 22, cartY - 4, 44, 30, 8);
    ctx.fill();
  }

  // ---- runners and flying cubes
  const step = Math.floor(state.time * 9) % 2;
  const runSize = RUNNER_SIZE * 0.86;
  state.spots.forEach((spot, si) => {
    if (!spot || spot.done || !spot.run.path) return;
    const at = runnerAt(state, si);
    const carrying = spot.run.carry >= 0;
    const f = carrying
      ? frameOf(art, "run", spot.k, spot.hex, step, 1)
      : frameOf(art, "run", spot.k, spot.hex, 2 + step, 0);
    if (f) {
      drawFrame(ctx, f, at.x, at.y + 12, runSize);
      if (carrying)
        drawCube(
          ctx,
          at.x + runSize * 0.035 - 6,
          at.y + 12 - runSize * 0.58 - 8,
          12,
          hexOfK(spot.run.carry),
        );
    } else drawPlainWaiter(ctx, at.x, at.y, 30, spot.hex, carrying ? hexOfK(spot.run.carry) : null);
  });
  for (const f of state.flights) {
    const at = guestAt(f.guest);
    const x = cartX + (at.x - cartX) * f.t;
    const y = cartY + (at.plateY - cartY) * f.t - Math.sin(Math.PI * f.t) * 50;
    const fs = 12 - 7 * f.t;
    drawCube(ctx, x - fs / 2, y - fs / 2, fs, hexOfK(f.k));
  }

  // ---- standby spots: a row on the cabinet's shelf, the first nearest the plate
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
        c.x - 38,
        c.y - 30,
        76,
        76,
      );
    } else {
      ctx.fillStyle = spot ? "rgba(255,248,232,.16)" : "rgba(0,0,0,.2)";
      rr(ctx, c.x - 34, c.y - 32, 68, 68, 14);
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
      if (f) drawFrame(ctx, f, c.x, c.y + 10 + bow, 82);
      else {
        ctx.globalAlpha = waiting ? 0.6 : 1;
        drawPlainWaiter(ctx, c.x, c.y - 4 + bow, 48, spot.hex, null);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.arc(c.x + 22, c.y + 34, 14, 0, 7);
    ctx.fill();
    ctx.strokeStyle = spot.hex;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#2a1f16";
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(String(Math.max(0, spot.n)), c.x + 22, c.y + 39);
    if (waiting) drawWaitingTag(ctx, c.x, c.y + 61, spot.hex);
  }

  // ---- the queue: one COLUMN a lane, the front waiter on top, "+N" under a column with more waiters than the three shown
  for (let l = 0; l < lanes; l++) {
    const lane = state.lanes[l]!;
    for (let r = 0; r < QUEUE.rows; r++) {
      const w = lane[r];
      if (!w) continue;
      const q = tileRectWide(l, r, lanes);
      const sh = r === 0 ? view.shake.find((s) => s.lane === l) : undefined;
      const dx = sh ? Math.sin(sh.t * 60) * 4 * (1 - sh.t / 0.4) : 0;
      const front = r === 0;
      ctx.globalAlpha = front ? 1 : 0.66;
      ctx.fillStyle = shade(w.hex, -0.3);
      rr(ctx, q.x + dx, q.y + 3, q.w, q.h, 12);
      ctx.fill();
      ctx.fillStyle = w.hex;
      rr(ctx, q.x + dx, q.y, q.w, q.h - 3, 12);
      ctx.fill();
      if (front && view.hoverLane === l) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }
      const f = frameOf(art, "stand", w.k, w.hex, 0);
      if (f) {
        // the waiter's head and chest, cropped into the tile (narrower on a narrow column)
        const sc = Math.min((q.h - 6) / 105, (q.w * 0.6) / 132);
        ctx.save();
        rr(ctx, q.x + dx + 2, q.y, q.w - 4, q.h - 3, 12);
        ctx.clip();
        ctx.drawImage(f.sheet, 30, 0, 132, 105, q.x + dx + 3, q.y + 2, 132 * sc, 105 * sc);
        ctx.restore();
      } else
        drawPlainWaiter(
          ctx,
          q.x + dx + 22,
          q.y + q.h / 2 - 2,
          front ? 30 : 24,
          shade(w.hex, -0.2),
          null,
        );
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,.45)";
      ctx.lineWidth = 3.5;
      const fsz = Math.min(front ? 27 : 21, q.w * 0.3);
      ctx.font = `800 ${fsz}px ${FONT}`;
      ctx.textAlign = "right";
      const ty = q.y + q.h / 2 + fsz * 0.34;
      ctx.strokeText(String(w.n), q.x + dx + q.w - 8, ty);
      ctx.fillText(String(w.n), q.x + dx + q.w - 8, ty);
      ctx.globalAlpha = 1;
    }
    if (lane.length > QUEUE.rows) {
      const q = tileRectWide(l, QUEUE.rows - 1, lanes);
      ctx.fillStyle = "#fff4d9";
      ctx.strokeStyle = "rgba(0,0,0,.55)";
      ctx.lineWidth = 3;
      ctx.font = `800 15px ${FONT}`;
      ctx.textAlign = "center";
      ctx.strokeText(`+${lane.length - QUEUE.rows}`, q.x + q.w / 2, q.y + q.h + 17);
      ctx.fillText(`+${lane.length - QUEUE.rows}`, q.x + q.w / 2, q.y + q.h + 17);
    }
  }
  const hintAt = view.hintOn && state.phase === "play" ? hintLane(state) : -1;
  if (hintAt >= 0) {
    const q = tileRectWide(hintAt, 0, lanes);
    const b = Math.sin(now / 220) * 3;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(q.x + 12, q.y - 4 + b);
    ctx.lineTo(q.x + 3, q.y - 16 + b);
    ctx.lineTo(q.x + 21, q.y - 16 + b);
    ctx.closePath();
    ctx.fill();
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = "left";
    ctx.strokeText("Tap me", q.x + 30, q.y - 5 + b);
    ctx.fillText("Tap me", q.x + 30, q.y - 5 + b);
  }
  if (view.notice) {
    ctx.fillStyle = "rgba(40,22,10,.88)";
    rr(ctx, BOX.x + BOX.w / 2 - 130, BOX.y + BOX.h - 40, 260, 30, 15);
    ctx.fill();
    ctx.fillStyle = "#fff4d9";
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(view.notice, BOX.x + BOX.w / 2, BOX.y + BOX.h - 19);
  }
}
