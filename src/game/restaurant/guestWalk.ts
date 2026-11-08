/**
 * WHERE THE FIRST FLOOR'S GUESTS CAN WALK (developer 2026-11-08: "they are walking on top of tables, optimize their walking").
 * The first-floor map has SIX artworks (kitchen/kitchenMapArt.ts) and the dining room is drawn differently on each: two to nine tables,
 * in other places. The guests' old routes were measured on the first artwork only, so on the others they crossed tables and chairs.
 *
 * Now every route is found on the stage's own plan: the table centres below (map percent, measured on each artwork), a walkable
 * room, and a plain grid search (A*) that goes around every table with its chairs, then pulls the path straight. A person never
 * steps on a table top; the chairs of other tables are kept clear too, and only a person's own chair is reached through their own
 * table's chairs. A table whose chair cannot be reached (the nine-table room is packed) is simply not used. Pure and deterministic:
 * no randomness, nothing reads or writes the save.
 */
import type { KitchenMapArtStage } from "../kitchen/kitchenMapArt";

export type Pt = { x: number; y: number };
export type Slot = "bottom" | "left" | "right" | "top";
const SLOTS: readonly Slot[] = ["bottom", "left", "right", "top"];

/** The tables of each artwork (centre of the cloth, map percent). `booth: true` is a table in the sofa corner: an obstacle, never a seat. */
export type StageTable = Pt & { booth?: boolean };

export const STAGE_TABLES: Readonly<Record<KitchenMapArtStage, readonly StageTable[]>> = {
  // The front tables are the dining room's own seats (serviceFloor.ts FLOOR_SEATS: the chair is 3.7 below the cloth); the others are measured
  // on the artwork.
  humble: [
    { x: 42, y: 69 },
    { x: 70, y: 69 },
  ],
  growing: [
    { x: 44, y: 60.5 },
    { x: 67.5, y: 62 },
    { x: 55, y: 70.8 },
  ],
  established: [
    { x: 44.5, y: 59.5 },
    { x: 68, y: 59.5 },
    { x: 44.5, y: 69.5 },
    { x: 68, y: 69.5 },
  ],
  "neighborhood-cafe": [
    { x: 42.4, y: 60.5 },
    { x: 67.8, y: 60.5 },
    { x: 42, y: 70.3 },
    { x: 58.3, y: 70.3 },
    { x: 74.5, y: 70.3 },
  ],
  "flourishing-cafe": [
    { x: 43.5, y: 59.5 },
    { x: 67, y: 59.5 },
    { x: 43, y: 70 },
    { x: 67, y: 70 },
    { x: 85.3, y: 62, booth: true },
    { x: 85.3, y: 68.8, booth: true },
  ],
  grand: [
    { x: 42.5, y: 58.6 },
    { x: 56.4, y: 58.6 },
    { x: 70.5, y: 58.6 },
    { x: 42.5, y: 65.3 },
    { x: 56.4, y: 65.3 },
    { x: 70.5, y: 65.3 },
    { x: 42.5, y: 72 },
    { x: 56.4, y: 72 },
    { x: 70.5, y: 72 },
  ],
};

/** The cloth: nobody steps here, ever. */
export const TABLE_TOP = { hw: 4.6, hh: 3.1 } as const;
/** A chair: other people keep out of it (its half size, around the chair spot). */
export const CHAIR = { hw: 1.6, hh: 1.6 } as const;
/** Where each chair is, next to the table centre (the guest's feet). */
export const SLOT_OFFSET: Readonly<Record<Slot, Pt>> = {
  bottom: { x: 0, y: 3.7 },
  left: { x: -6, y: -0.4 },
  right: { x: 6, y: -0.4 },
  top: { x: 0, y: -3.7 },
};

/** The room a guest may walk in: the dining floor between the counter and the front wall, and the doorway to the street. */
const ROOM = { x0: 35, x1: 79, y0: 55, y1: 77.2 } as const;
/** Some artworks have open floor further right (the nine-table room has an aisle beside its last column). */
const ROOM_X1: Partial<Record<KitchenMapArtStage, number>> = { "neighborhood-cafe": 81, grand: 83 };
/** The nine-table room fills the floor to the front wall, so its walkway runs a little lower. */
const ROOM_Y1: Partial<Record<KitchenMapArtStage, number>> = { grand: 78.4 };
const DOORWAY = { x0: 45, x1: 56, y1: 96 } as const;

const inRoom = (stage: KitchenMapArtStage, x: number, y: number): boolean =>
  y >= (ROOM_Y1[stage] ?? ROOM.y1)
    ? x >= DOORWAY.x0 && x <= DOORWAY.x1 && y <= DOORWAY.y1
    : x >= ROOM.x0 && x <= (ROOM_X1[stage] ?? ROOM.x1) && y >= ROOM.y0;

const inBox = (p: Pt, c: Pt, hw: number, hh: number): boolean =>
  Math.abs(p.x - c.x) < hw && Math.abs(p.y - c.y) < hh;

/**
 * Is this spot closed to a walker? Every table's cloth and chairs are closed; `own` is the table the person is going to sit at, and
 * for that one only the cloth is (they walk in through their own chairs).
 */
export function blockedAt(stage: KitchenMapArtStage, p: Pt, own?: Pt): boolean {
  if (!inRoom(stage, p.x, p.y)) return true;
  for (const t of STAGE_TABLES[stage]) {
    if (inBox(p, t, TABLE_TOP.hw, TABLE_TOP.hh)) return true;
    if (own && t.x === own.x && t.y === own.y) continue;
    for (const slot of SLOTS) {
      const o = SLOT_OFFSET[slot];
      if (inBox(p, { x: t.x + o.x, y: t.y + o.y }, CHAIR.hw, CHAIR.hh)) return true;
    }
  }
  return false;
}

/** A straight walk from `a` to `b` that stays on open floor (sampled every half percent). */
export function segmentFree(stage: KitchenMapArtStage, a: Pt, b: Pt, own?: Pt): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.5));
  for (let i = 0; i <= n; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
    if (blockedAt(stage, p, own)) return false;
  }
  return true;
}

const STEP = 0.5;
const GX0 = 30;
const GY0 = 50;
const GW = 134; // x 30..96.5
const GH = 96; // y 50..97.5

/** A minimal binary heap of [cost, cell]. */
class Heap {
  private a: [number, number][] = [];
  get size() {
    return this.a.length;
  }
  push(f: number, i: number) {
    const a = this.a;
    a.push([f, i]);
    let k = a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (a[p]![0] <= a[k]![0]) break;
      [a[p], a[k]] = [a[k]!, a[p]!];
      k = p;
    }
  }
  pop(): [number, number] {
    const a = this.a;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < a.length && a[l]![0] < a[m]![0]) m = l;
        if (r < a.length && a[r]![0] < a[m]![0]) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k]!, a[m]!];
        k = m;
      }
    }
    return top;
  }
}

const GRIDS = new Map<string, Uint8Array>();
/** 1 = open floor, 0 = closed, for every cell of the half-percent grid; cached per stage and own table (the tables never move). */
function freeGrid(stage: KitchenMapArtStage, own?: Pt): Uint8Array {
  const key = `${stage}|${own ? `${own.x},${own.y}` : "-"}`;
  const hit = GRIDS.get(key);
  if (hit) return hit;
  const free = new Uint8Array(GW * GH);
  for (let cy = 0; cy < GH; cy++)
    for (let cx = 0; cx < GW; cx++)
      free[cy * GW + cx] = blockedAt(stage, { x: cx * STEP + GX0, y: cy * STEP + GY0 }, own)
        ? 0
        : 1;
  GRIDS.set(key, free);
  return free;
}

/** Whether a walker can get from `from` to `to` at all (a flood fill over the cached grid: much cheaper than finding the path). */
export function canWalk(stage: KitchenMapArtStage, from: Pt, to: Pt, own?: Pt): boolean {
  if (segmentFree(stage, from, to, own)) return true;
  const base = freeGrid(stage, own).slice();
  const at = (p: Pt) =>
    Math.min(GH - 1, Math.max(0, Math.round((p.y - GY0) / STEP))) * GW +
    Math.min(GW - 1, Math.max(0, Math.round((p.x - GX0) / STEP)));
  const start = at(from);
  const goal = at(to);
  base[start] = 1;
  base[goal] = 1;
  const seen = new Uint8Array(GW * GH);
  const stack = [start];
  seen[start] = 1;
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur === goal) return true;
    const cx = cur % GW;
    const cy = Math.floor(cur / GW);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const ni = ny * GW + nx;
        if (!base[ni] || seen[ni]) continue;
        if (dx !== 0 && dy !== 0 && (!base[cy * GW + nx] || !base[ny * GW + cx])) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
  }
  return false;
}

/** The shortest way between two spots around the tables: A* on a half-percent grid, then straightened. null when there is none. */
export function walkPath(stage: KitchenMapArtStage, from: Pt, to: Pt, own?: Pt): Pt[] | null {
  if (segmentFree(stage, from, to, own)) return [to];
  const cell = (p: Pt) => ({
    cx: Math.min(GW - 1, Math.max(0, Math.round((p.x - GX0) / STEP))),
    cy: Math.min(GH - 1, Math.max(0, Math.round((p.y - GY0) / STEP))),
  });
  const at = (cx: number, cy: number): Pt => ({ x: cx * STEP + GX0, y: cy * STEP + GY0 });
  // The open floor of this stage for this walker (built once per stage and own table: the build used to be most of the time of a route).
  const base = freeGrid(stage, own);
  const s = cell(from);
  const g = cell(to);
  const start = s.cy * GW + s.cx;
  const goal = g.cy * GW + g.cx;
  // The two ends may sit just inside a closed cell (a chair on the edge of another's chair): open them, on a copy.
  const free = base.slice();
  free[start] = 1;
  free[goal] = 1;
  const dist = new Float64Array(GW * GH).fill(Infinity);
  const prev = new Int32Array(GW * GH).fill(-1);
  const done = new Uint8Array(GW * GH);
  const open = new Heap();
  dist[start] = 0;
  open.push(0, start);
  const h = (i: number) => Math.hypot((i % GW) - g.cx, Math.floor(i / GW) - g.cy);
  while (open.size > 0) {
    const [, cur] = open.pop();
    if (done[cur]) continue;
    done[cur] = 1;
    if (cur === goal) break;
    const cx = cur % GW;
    const cy = Math.floor(cur / GW);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const ni = ny * GW + nx;
        if (!free[ni] || done[ni]) continue;
        // No cutting the corner of a closed cell.
        if (dx !== 0 && dy !== 0 && (!free[cy * GW + nx] || !free[ny * GW + cx])) continue;
        const d = dist[cur]! + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
        if (d < dist[ni]!) {
          dist[ni] = d;
          prev[ni] = cur;
          open.push(d + h(ni), ni);
        }
      }
    }
  }
  if (!Number.isFinite(dist[goal]!)) return null;
  const cells: Pt[] = [];
  for (let i = goal; i !== -1; i = prev[i]!) cells.push(at(i % GW, Math.floor(i / GW)));
  cells.reverse();
  // The real ends instead of the cell centres, then pull the path straight wherever the floor is open.
  const pts: Pt[] = [from, ...cells.slice(1, -1), to];
  const out: Pt[] = [];
  let a = 0;
  while (a < pts.length - 1) {
    let b = pts.length - 1;
    while (b > a + 1 && !segmentFree(stage, pts[a]!, pts[b]!, own)) b--;
    out.push(pts[b]!);
    a = b;
  }
  return out.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
}

/** A chair of a table: where the guest's feet go. */
export const chairOf = (t: Pt, slot: Slot): Pt => ({
  x: Math.round((t.x + SLOT_OFFSET[slot].x) * 10) / 10,
  y: Math.round((t.y + SLOT_OFFSET[slot].y) * 10) / 10,
});

/**
 * The nearest open spot to `want` in front of the service counter (the guests queue there to order), at least `gap` from the ones in
 * `taken`. Some artworks put a table's back chair next to the counter, so the open floor there can be short: when it is full the
 * guest shares an open spot (they order at different times). Only spots a person can walk to from `from` count; null when the room has none.
 */
export function counterSpot(
  stage: KitchenMapArtStage,
  wantX: number,
  y: number,
  taken: readonly number[],
  from: Pt,
  gap = 3.5,
): Pt | null {
  let best: { p: Pt; room: number } | null = null;
  for (let d = 0; d <= 40; d += 0.5) {
    for (const x of d === 0 ? [wantX] : [wantX - d, wantX + d]) {
      if (x < ROOM.x0 + 1 || x > (ROOM_X1[stage] ?? ROOM.x1) - 1 || blockedAt(stage, { x, y }))
        continue;
      const room = taken.reduce((m, t) => Math.min(m, Math.abs(t - x)), Infinity);
      // Only a spot that would be used is tested for being a pocket nobody can walk into.
      if (room < gap && best && room <= best.room) continue;
      if (!canWalk(stage, from, { x, y })) continue;
      if (room >= gap) return { x, y };
      best = { p: { x, y }, room }; // the least crowded open spot
    }
  }
  const fallback = best?.p ?? null;
  return fallback;
}
