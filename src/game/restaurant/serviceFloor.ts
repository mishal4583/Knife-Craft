/**
 * SERVICE FLOOR — the dining room a service's customer walks into
 * (Transformation Phase B, developer 2026-10-25: "watch a customer enter the
 * restaurant, sit at a table, display an order … react and leave").
 *
 * Presentation only, and pure. It knows WHERE things are on each of the six
 * first-floor paintings (kitchenMapArt.ts, one per kitchen stage) — the front
 * door, two front-row seats and the walk between them — and nothing about
 * money, stock or the order engine. The customer, the dish and the grade come
 * from the real order (ServiceManager's ServiceOrder, the Knife Report); the
 * view (ServiceFloor.tsx) only animates them.
 *
 * Positions are map percent (0–100 of the painting), measured on a 5 % grid
 * over each stage's art (2026-10-25): the door is the gate at the bottom
 * (x 50, y ≈ 81) on every stage, and each seat is the FRONT chair of a
 * front-row table, reached through open floor (never across a table, a rug's
 * furniture or a wall). Seats alternate between customers so one leaving and
 * the next arriving never share a chair.
 */
import type { KitchenMapArtStage } from "../kitchen/kitchenMapArt";
import type { QualityLabel } from "@/types/game";

export type FloorPoint = { x: number; y: number };
export type FloorSeat = {
  /** Where the customer sits (feet), map percent. */
  seat: FloorPoint;
  /** The middle of the table in front of the seat (where the plate goes). */
  table: FloorPoint;
  /** Outside the door → the seat, through open floor. */
  path: readonly FloorPoint[];
};

/** The part of the painting the floor view shows: the dining room and the door. */
export const FLOOR_VIEW = { x0: 20, x1: 80, y0: 48, y1: 96 } as const;

/** Where a plate comes from: the pass at the service counter. */
export const FLOOR_PASS: FloorPoint = { x: 50, y: 57 };

const OUTSIDE: FloorPoint = { x: 50, y: 93 };
const DOOR: FloorPoint = { x: 50, y: 81 };

const seat = (sx: number, sy: number, via: FloorPoint, tableY: number): FloorSeat => ({
  seat: { x: sx, y: sy },
  table: { x: sx, y: tableY },
  path: [OUTSIDE, DOOR, via, { x: sx, y: sy }],
});

export const FLOOR_SEATS: Readonly<Record<KitchenMapArtStage, readonly [FloorSeat, FloorSeat]>> = {
  humble: [seat(42, 73.5, { x: 48, y: 77 }, 69), seat(70, 73.5, { x: 56, y: 77 }, 69)],
  growing: [
    seat(55, 74.5, { x: 54, y: 78 }, 70.5),
    {
      seat: { x: 67.5, y: 66.5 },
      table: { x: 67.5, y: 62.5 },
      path: [OUTSIDE, DOOR, { x: 64, y: 78 }, { x: 70, y: 72 }, { x: 67.5, y: 66.5 }],
    },
  ],
  established: [seat(44.5, 73.5, { x: 47, y: 77 }, 69.5), seat(68, 73.5, { x: 58, y: 77 }, 69.5)],
  "neighborhood-cafe": [seat(42, 74.5, { x: 46, y: 78 }, 70), seat(74, 74.5, { x: 64, y: 78 }, 70)],
  "flourishing-cafe": [
    seat(42.5, 74, { x: 46, y: 77.5 }, 70),
    seat(67, 74, { x: 58, y: 77.5 }, 70),
  ],
  grand: [seat(42.5, 75.5, { x: 46, y: 79 }, 71.5), seat(70.5, 75.5, { x: 60, y: 79 }, 71.5)],
};

/** A map point in the floor view's own percent (0–100 of the view box). */
export function inView(p: FloorPoint): FloorPoint {
  const { x0, x1, y0, y1 } = FLOOR_VIEW;
  return { x: ((p.x - x0) / (x1 - x0)) * 100, y: ((p.y - y0) / (y1 - y0)) * 100 };
}

/** Walking pace, map percent per second (a calm stroll, ~2 s door to table). */
export const WALK_PER_SECOND = 14;
/** How long the customer takes to sit down once at the chair. */
export const SIT_MS = 350;
/** The plate's trip from the pass to the table, and the reaction after it. */
export const DELIVER_MS = 900;
export const REACT_MS = 900;

/** Each leg's duration (ms) along `path`, at the walking pace. */
export function legDurations(path: readonly FloorPoint[]): number[] {
  return path
    .slice(1)
    .map((p, i) =>
      Math.round((Math.hypot(p.x - path[i]!.x, p.y - path[i]!.y) / WALK_PER_SECOND) * 1000),
    );
}

/** The whole walk's duration (ms). */
export const walkMs = (path: readonly FloorPoint[]) =>
  legDurations(path).reduce((a, b) => a + b, 0);

/**
 * Keyframe stops for a walk: each point with its share of the time (0–100),
 * in view percent — what a CSS animation needs, nothing else.
 */
export function walkFrames(path: readonly FloorPoint[]): { at: number; x: number; y: number }[] {
  const legs = legDurations(path);
  const total = legs.reduce((a, b) => a + b, 0) || 1;
  let t = 0;
  return path.map((p, i) => {
    if (i > 0) t += legs[i - 1]!;
    const v = inView(p);
    return { at: Math.round((t / total) * 1000) / 10, x: v.x, y: v.y };
  });
}

/**
 * Which seat an order's customer takes: decided once per order id (a React
 * StrictMode double render or a remount of the same order keeps it), and the
 * other seat from the previous customer's — so the one leaving and the one
 * arriving never meet at a chair. Session memory only; a reload starts at 0.
 */
const seatByOrder = new Map<string, 0 | 1>();
let lastSeat: 0 | 1 = 1;
export function seatForOrder(orderId: string): 0 | 1 {
  const known = seatByOrder.get(orderId);
  if (known !== undefined) return known;
  lastSeat = lastSeat === 0 ? 1 : 0;
  seatByOrder.set(orderId, lastSeat);
  return lastSeat;
}
export function resetSeatsForTests(): void {
  seatByOrder.clear();
  lastSeat = 1;
  departing = null;
  departingFor.clear();
}

/**
 * The customer who just left (Next Customer / a menu guest): the next order's
 * arrival shows them walking out from their own seat while the new customer
 * walks in — so advancing never waits for an animation. Session memory only,
 * read once, and stale after DEPARTING_FRESH_MS (a later service never shows
 * someone from long ago leaving).
 */
export type Departing = { customerId: string; seat: 0 | 1; face: string; at: number };
export const DEPARTING_FRESH_MS = 30_000;
let departing: Departing | null = null;
export function noteDeparting(d: Departing): void {
  departing = d;
}
/** Who walks out during `orderId`'s arrival — taken once, and the same answer for that order again. */
const departingFor = new Map<string, Departing | null>();
export function takeDeparting(now: number, orderId: string): Departing | null {
  if (departingFor.has(orderId)) return departingFor.get(orderId)!;
  const d = departing;
  departing = null;
  const shown = d && now - d.at <= DEPARTING_FRESH_MS ? d : null;
  departingFor.set(orderId, shown);
  return shown;
}

/** The customer's face after the first bite: the dish's REAL grade (the one its pay came from). */
export const REACTION_FACE: Readonly<Record<QualityLabel, string>> = {
  Masterful: "😍",
  Clean: "😋",
  Honest: "🙂",
  Rustic: "🙂",
  Learning: "😌",
};

/** A customer's clothes and hair, fixed by their id (the same customer always looks the same). */
const OUTFITS = [
  "#bb633e",
  "#4f7180",
  "#9a5260",
  "#547a55",
  "#a16b3f",
  "#637da8",
  "#9b667f",
  "#7a6a3a",
];
const HAIR = ["#493324", "#35271f", "#473222", "#2b211b", "#6b4a2e", "#8a8a8a"];
export function lookFor(customerId: string): { outfit: string; hair: string } {
  let h = 0;
  for (const c of customerId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { outfit: OUTFITS[h % OUTFITS.length]!, hair: HAIR[(h >>> 3) % HAIR.length]! };
}
