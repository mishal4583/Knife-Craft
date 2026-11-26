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
/**
 * THE STREET DOOR (developer 2026-11-26: "the customers are not walking out through the proper door, some are walking out sideways"). Measured on all twelve pictures (the six tall plans and
 * the six wide ones) the open gap between the two door leaves is only about 4 to 6 % wide, centred near x 50 (the old doorway was 45 to 56, so a guest on the lane at 47 or 53 walked
 * through a leaf or the wall). A person is about 2.6 % wide, so the walkable doorway is the gap less `DOOR_PAD` on each side, and everybody goes through it on a lane of their own inside it
 * (`doorLanes`), in a straight vertical line.
 */
export const DOOR_GAP_TALL = { x0: 47.6, x1: 53.0 } as const;
export const DOOR_GAP_WIDE: Readonly<Record<KitchenMapArtStage, { x0: number; x1: number }>> = {
  humble: { x0: 47.4, x1: 51.1 },
  growing: { x0: 47.95, x1: 51.75 },
  established: { x0: 47.5, x1: 53.0 },
  "neighborhood-cafe": { x0: 47.3, x1: 51.1 },
  "flourishing-cafe": { x0: 47.2, x1: 53.1 },
  grand: { x0: 47.7, x1: 52.5 },
};
/** Half a person's width plus a little air: how far from a door leaf a walker keeps. */
export const DOOR_PAD = 1.3;

/**
 * A walking stage: one of the six tall plans (`"humble"` ...), or the same stage on the WIDE landscape plan (`"humble@wide"`, developer 2026-11-20, 1920 x 1080
 * pictures). Everything below reads its numbers from `geoOf`, so the tall plans behave exactly as before.
 */
export type WalkStage = KitchenMapArtStage | `${KitchenMapArtStage}@wide`;
export const wideOf = (stage: KitchenMapArtStage): WalkStage => `${stage}@wide`;
const isWide = (stage: WalkStage): boolean => stage.endsWith("@wide");
const baseStage = (stage: WalkStage): KitchenMapArtStage =>
  stage.replace("@wide", "") as KitchenMapArtStage;

export type Geo = {
  tables: readonly StageTable[];
  top: { hw: number; hh: number };
  chair: { hw: number; hh: number };
  slot: Readonly<Record<Slot, Pt>>;
  room: { x0: number; x1: number; y0: number; y1: number };
  doorway: { x0: number; x1: number; y1: number };
  /** The half-percent search grid: origin and size in cells. */
  grid: { x0: number; y0: number; w: number; h: number };
  /** The row guests stand on to order, just inside the street door, in the doorway, and outside it. */
  counterY: number;
  insideY: number;
  entryY: number;
  outsideY: number;
  /** Added to a guest's wanted counter spot (the counter is further right on the wide plan). */
  counterShift: number;
};

const TALL_GEO: Record<KitchenMapArtStage, Geo> = Object.fromEntries(
  (Object.keys(STAGE_TABLES) as KitchenMapArtStage[]).map((st) => [
    st,
    {
      tables: STAGE_TABLES[st],
      top: TABLE_TOP,
      chair: CHAIR,
      slot: SLOT_OFFSET,
      room: { x0: ROOM.x0, x1: ROOM_X1[st] ?? ROOM.x1, y0: ROOM.y0, y1: ROOM_Y1[st] ?? ROOM.y1 },
      doorway: { x0: DOOR_GAP_TALL.x0 + DOOR_PAD, x1: DOOR_GAP_TALL.x1 - DOOR_PAD, y1: 96 },
      grid: { x0: 30, y0: 50, w: 134, h: 96 },
      counterY: 56,
      insideY: 80,
      entryY: 87,
      outsideY: 91,
      counterShift: 0,
    } satisfies Geo,
  ]),
) as unknown as Record<KitchenMapArtStage, Geo>;

/**
 * The wide plans (1920 x 1080 pictures). The tables are the cloth centres measured on each picture; a booth is a table in a sofa corner (an obstacle, never a
 * seat). A table straight in front of the street door (x 45 to 54) is left out of this list: its chairs would close the doorway to the walking guests (it stays painted). The dining floor is the room between the service counter's front and the front wall; the doorway is the gap in the front wall (x about 45 to 54).
 */
export const STAGE_TABLES_WIDE: Readonly<Record<KitchenMapArtStage, readonly StageTable[]>> = {
  humble: [
    { x: 35, y: 70.2 },
    { x: 48.6, y: 68.9 },
    { x: 64.4, y: 70.2 },
    { x: 83.9, y: 70.5, booth: true },
    { x: 92, y: 70.5, booth: true },
  ],
  growing: [
    { x: 40.5, y: 63.9 },
    { x: 40.5, y: 76.7 },
    { x: 55.5, y: 67.8 },
    { x: 74.4, y: 63.9 },
    { x: 72.8, y: 76.7 },
    { x: 87.5, y: 71.1 },
    { x: 87.5, y: 77.8, booth: true },
    { x: 28.4, y: 67.8, booth: true },
    { x: 28.4, y: 76.7, booth: true },
  ],
  established: [
    { x: 30.9, y: 72.2 },
    { x: 50.3, y: 63.9 },
    { x: 65.3, y: 63.9 },
    { x: 65.3, y: 76.1 },
    { x: 80.3, y: 72.2 },
    { x: 33.7, y: 62.8, booth: true },
    { x: 78.4, y: 62.8, booth: true },
    { x: 93, y: 68.3, booth: true },
    { x: 93, y: 76.7, booth: true },
  ],
  "neighborhood-cafe": [
    { x: 45, y: 64.4 },
    { x: 43.8, y: 73.9 },
    { x: 56.9, y: 64.4 },
    { x: 56.9, y: 73.9 },
    { x: 68.1, y: 64.4 },
    { x: 68.4, y: 73.9 },
    { x: 78.8, y: 64.4 },
    { x: 80.3, y: 73.9 },
    { x: 29.4, y: 67.2, booth: true },
    { x: 28.4, y: 74.4, booth: true },
    { x: 90.6, y: 66.7, booth: true },
    { x: 93, y: 74.4, booth: true },
  ],
  "flourishing-cafe": [
    { x: 42.8, y: 64.2 },
    { x: 30.9, y: 67.8 },
    { x: 30.9, y: 77.2 },
    { x: 42, y: 73.3 },
    { x: 54.7, y: 64.2 },
    { x: 54.9, y: 72.8 },
    { x: 68.8, y: 63.9 },
    { x: 67.8, y: 73.9 },
    { x: 79, y: 69.4 },
    { x: 90.3, y: 71.1, booth: true },
    { x: 90.9, y: 79.4, booth: true },
    { x: 85.6, y: 63.9, booth: true },
  ],
  grand: [
    { x: 36.6, y: 66.9 },
    { x: 35.6, y: 74.7 },
    { x: 47.5, y: 63.9 },
    { x: 47.2, y: 71.1 },
    { x: 62.5, y: 63.9 },
    { x: 63.1, y: 72.2 },
    { x: 55.6, y: 72.2 },
    { x: 76.9, y: 66.7 },
    { x: 78.4, y: 77.8 },
    { x: 25.6, y: 66.7, booth: true },
    { x: 90, y: 67.8, booth: true },
    { x: 91.9, y: 72.8, booth: true },
  ],
};

const WIDE_SLOT: Readonly<Record<Slot, Pt>> = {
  bottom: { x: 0, y: 5.2 },
  left: { x: -5.4, y: -0.4 },
  right: { x: 5.4, y: -0.4 },
  top: { x: 0, y: -5.2 },
};

/** Each wide stage's counter front (the row guests stand on to order, just below the service counter) and the floor's edges. */
const WIDE_ROOM: Record<
  KitchenMapArtStage,
  { x0: number; x1: number; y0: number; y1: number; counterY: number }
> = {
  humble: { x0: 23, x1: 80, y0: 59, y1: 81, counterY: 61.5 },
  growing: { x0: 22, x1: 94, y0: 59, y1: 82, counterY: 60.5 },
  established: { x0: 22, x1: 95, y0: 59, y1: 82, counterY: 61.5 },
  "neighborhood-cafe": { x0: 22, x1: 94, y0: 58, y1: 82, counterY: 59.5 },
  "flourishing-cafe": { x0: 22, x1: 94, y0: 59, y1: 82, counterY: 61.5 },
  grand: { x0: 22, x1: 94, y0: 59, y1: 82, counterY: 61 },
};

const WIDE_GEO: Record<KitchenMapArtStage, Geo> = Object.fromEntries(
  (Object.keys(STAGE_TABLES_WIDE) as KitchenMapArtStage[]).map((st) => [
    st,
    {
      tables: STAGE_TABLES_WIDE[st],
      top: { hw: 3.3, hh: 3.8 },
      chair: { hw: 1.4, hh: 2.2 },
      slot: WIDE_SLOT,
      room: {
        x0: WIDE_ROOM[st].x0,
        x1: WIDE_ROOM[st].x1,
        y0: WIDE_ROOM[st].y0,
        y1: WIDE_ROOM[st].y1,
      },
      doorway: {
        x0: DOOR_GAP_WIDE[st].x0 + DOOR_PAD,
        x1: DOOR_GAP_WIDE[st].x1 - DOOR_PAD,
        y1: 96,
      },
      grid: { x0: 20, y0: 55, w: 156, h: 84 },
      counterY: WIDE_ROOM[st].counterY,
      insideY: 80,
      entryY: 84,
      outsideY: 93,
      counterShift: 6,
    } satisfies Geo,
  ]),
) as unknown as Record<KitchenMapArtStage, Geo>;

export const geoOf = (stage: WalkStage): Geo =>
  isWide(stage) ? WIDE_GEO[baseStage(stage)] : TALL_GEO[stage as KitchenMapArtStage];

/**
 * `n` lanes through the street door, spread evenly across its walkable width (the same on the way in and the way out, so a guest never crosses a door leaf or the wall). The first
 * is the lane nearest the middle of the gap; a narrow door (the humble kitchen's wide plan) has lanes close together, which is fine: the guests come through one at a time.
 */
export function doorLanes(stage: WalkStage, n: number): number[] {
  const { x0, x1 } = geoOf(stage).doorway;
  if (n <= 1) return [Math.round(((x0 + x1) / 2) * 10) / 10];
  return Array.from(
    { length: n },
    (_, i) => Math.round((x0 + ((x1 - x0) * i) / (n - 1)) * 10) / 10,
  );
}

const inRoom = (stage: WalkStage, x: number, y: number): boolean => {
  const g = geoOf(stage);
  return y >= g.room.y1
    ? x >= g.doorway.x0 && x <= g.doorway.x1 && y <= g.doorway.y1
    : x >= g.room.x0 && x <= g.room.x1 && y >= g.room.y0;
};

const inBox = (p: Pt, c: Pt, hw: number, hh: number): boolean =>
  Math.abs(p.x - c.x) < hw && Math.abs(p.y - c.y) < hh;

/**
 * Is this spot closed to a walker? Every table's cloth and chairs are closed; `own` is the table the person is going to sit at, and
 * for that one only the cloth is (they walk in through their own chairs).
 */
export function blockedAt(stage: WalkStage, p: Pt, own?: Pt): boolean {
  if (!inRoom(stage, p.x, p.y)) return true;
  const g = geoOf(stage);
  for (const t of g.tables) {
    if (inBox(p, t, g.top.hw, g.top.hh)) return true;
    if (own && t.x === own.x && t.y === own.y) continue;
    for (const slot of SLOTS) {
      const o = g.slot[slot];
      if (inBox(p, { x: t.x + o.x, y: t.y + o.y }, g.chair.hw, g.chair.hh)) return true;
    }
  }
  return false;
}

/** A straight walk from `a` to `b` that stays on open floor (sampled every half percent). */
export function segmentFree(stage: WalkStage, a: Pt, b: Pt, own?: Pt): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.5));
  for (let i = 0; i <= n; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
    if (blockedAt(stage, p, own)) return false;
  }
  return true;
}

const STEP = 0.5;

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
function freeGrid(stage: WalkStage, own?: Pt): Uint8Array {
  const key = `${stage}|${own ? `${own.x},${own.y}` : "-"}`;
  const hit = GRIDS.get(key);
  if (hit) return hit;
  const { x0: GX0, y0: GY0, w: GW, h: GH } = geoOf(stage).grid;
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
export function canWalk(stage: WalkStage, from: Pt, to: Pt, own?: Pt): boolean {
  if (segmentFree(stage, from, to, own)) return true;
  const { x0: GX0, y0: GY0, w: GW, h: GH } = geoOf(stage).grid;
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
export function walkPath(stage: WalkStage, from: Pt, to: Pt, own?: Pt): Pt[] | null {
  if (segmentFree(stage, from, to, own)) return [to];
  const { x0: GX0, y0: GY0, w: GW, h: GH } = geoOf(stage).grid;
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

/** Open at the spot AND at the centre of the search-grid cell it falls in (a spot in an open patch whose grid cell is closed could join two rooms that are really apart). */
const openAt = (stage: WalkStage, p: Pt): boolean => {
  if (blockedAt(stage, p)) return false;
  const { x0, y0 } = geoOf(stage).grid;
  const c = {
    x: Math.round((p.x - x0) / STEP) * STEP + x0,
    y: Math.round((p.y - y0) / STEP) * STEP + y0,
  };
  return !blockedAt(stage, c);
};

/**
 * The open spot nearest to `p` on this stage's dining floor (a person never stands on a cloth, a chair or off the floor); `p` itself when it is open. With `from`, only a spot a person can
 * really WALK to from there counts (a packed room, such as the nine-table Grand dining room, closes its middle: the nearest reachable spot is then on the open floor around the tables).
 */
export function nearestOpen(
  stage: WalkStage,
  p: Pt,
  maxR = 9,
  from?: Pt,
  /** With `from`: also at least this far from it (a trip to a table should be a trip). */
  minFrom = 0,
): Pt {
  const far = (q: Pt) => !from || Math.hypot(q.x - from.x, q.y - from.y) >= minFrom;
  if (openAt(stage, p) && far(p) && (!from || canWalk(stage, from, p))) return p;
  const cands: { q: Pt; d: number }[] = [];
  for (let dy = -maxR; dy <= maxR; dy += 0.5)
    for (let dx = -maxR; dx <= maxR; dx += 0.5) {
      const q = { x: p.x + dx, y: p.y + dy };
      const d = Math.hypot(dx, dy);
      if (d <= maxR && openAt(stage, q) && far(q)) cands.push({ q, d });
    }
  cands.sort((a, b) => a.d - b.d);
  for (const c of cands)
    if (!from || canWalk(stage, from, c.q))
      return { x: Math.round(c.q.x * 10) / 10, y: Math.round(c.q.y * 10) / 10 };
  // nothing reachable that is far enough: stay where the walker already is (never a spot behind a wall)
  return from ?? p;
}

/** A chair of a table: where the guest's feet go. */
export const chairOf = (t: Pt, slot: Slot, stage?: WalkStage): Pt => {
  const o = (stage ? geoOf(stage).slot : SLOT_OFFSET)[slot];
  return { x: Math.round((t.x + o.x) * 10) / 10, y: Math.round((t.y + o.y) * 10) / 10 };
};

/**
 * The nearest open spot to `want` in front of the service counter (the guests queue there to order), at least `gap` from the ones in
 * `taken`. Some artworks put a table's back chair next to the counter, so the open floor there can be short: when it is full the
 * guest shares an open spot (they order at different times). Only spots a person can walk to from `from` count; null when the room has none.
 */
export function counterSpot(
  stage: WalkStage,
  wantX: number,
  y: number,
  taken: readonly number[],
  from: Pt,
  gap = 3.5,
): Pt | null {
  let best: { p: Pt; room: number } | null = null;
  for (let d = 0; d <= 40; d += 0.5) {
    for (const x of d === 0 ? [wantX] : [wantX - d, wantX + d]) {
      if (
        x < geoOf(stage).room.x0 + 1 ||
        x > geoOf(stage).room.x1 - 1 ||
        blockedAt(stage, { x, y })
      )
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
