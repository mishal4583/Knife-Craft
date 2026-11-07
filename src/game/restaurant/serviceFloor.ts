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
import { guestLookFor } from "./peopleLooks";
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

/**
 * A PERSON carries the food (Phase 9B, developer 2026-11-01: "there is no person serving animation"): the waiter
 * walks from the pass to the table with the plate, sets it down, and walks back. The Server's look when one is
 * hired, otherwise the cook runs it out.
 */
export type WaiterKind = "server" | "cook";
export const WAITER_LOOKS: Readonly<
  Record<WaiterKind, { outfit: string; hair: string; look: string }>
> = {
  server: { outfit: "#7a2e2e", hair: "#473222", look: "server" },
  cook: { outfit: "#f4efe6", hair: "#35271f", look: "line-cook" },
};
/** How long the waiter takes to put the plate down once there. */
export const SET_DOWN_MS = 450;

/** Where the waiter stands to serve a table: beside it, on the side of the aisle (map percent). */
export function waiterStand(s: FloorSeat): FloorPoint {
  const side = s.seat.x < 50 ? 1 : -1;
  return { x: s.seat.x + side * 9, y: s.table.y + 1 };
}

/** The waiter's walk out: the pass, down beside the counter, then to `stand`. */
export const waiterPath = (stand: FloorPoint): FloorPoint[] => [
  FLOOR_PASS,
  { x: stand.x, y: FLOOR_PASS.y + 4 },
  stand,
];

/** The whole serve beat (ms): the walk out and setting the plate down; the waiter walks back while the guests react. */
export const serveMs = (stand: FloorPoint): number => walkMs(waiterPath(stand)) + SET_DOWN_MS;

/**
 * TAKEAWAY (Phase 9C, moved to the counter in Phase 10, developer 2026-11-01: "let the parcel or takeaway people
 * stand next to him and make the order"): a customer who takes a parcel never sits. They stand at the service
 * counter beside the Cashier (the billing staff), order there, and are handed a bag.
 */
export const COUNTER_SPOT: Readonly<Record<KitchenMapArtStage, FloorPoint>> = {
  // The Cashier stands at the counter's computer (staffLife.cashierStops: x, y of STAGE_SPOTS[stage].counter).
  humble: { x: 37.2, y: 55.6 },
  growing: { x: 37.6, y: 55.3 },
  established: { x: 37, y: 55.3 },
  "neighborhood-cafe": { x: 36.8, y: 55.6 },
  "flourishing-cafe": { x: 38.9, y: 56.8 },
  grand: { x: 37.6, y: 55.3 },
};
/** Where the Cashier stands (the counter's computer). */
export const cashierSpot = (stage: KitchenMapArtStage): FloorPoint => COUNTER_SPOT[stage];
/** Where a takeaway customer stands: right beside the Cashier, in front of the counter. */
export const takeawaySpot = (stage: KitchenMapArtStage): FloorPoint => ({
  x: COUNTER_SPOT[stage].x + 6.5,
  y: COUNTER_SPOT[stage].y + 1.2,
});
/** Without a Cashier the waiter hands the bag over, standing beside the customer. */
export const takeawayStand = (stage: KitchenMapArtStage): FloorPoint => ({
  x: takeawaySpot(stage).x + 5,
  y: takeawaySpot(stage).y + 0.5,
});
/** With a Cashier the bag changes hands at once (ms). */
export const BAG_MS = 750;

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
 * The way a walker faces on each stretch of a walk (painted people turn): "down" (toward the viewer), "up", "r" or "l" for the leg
 * that STARTS at each of `walkFrames`' points (the last point keeps the previous leg's).
 */
export function walkFacing(path: readonly FloorPoint[]): ("down" | "up" | "r" | "l")[] {
  return path.map((p, i) => {
    const a = i < path.length - 1 ? p : path[i - 1];
    const b = i < path.length - 1 ? path[i + 1]! : p;
    if (!a) return "down";
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) >= Math.abs(dy) * 0.8) return dx >= 0 ? "r" : "l";
    return dy >= 0 ? "down" : "up";
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

/**
 * Which tables are dirty (developer 2026-11-02: "show the wipe-the-table only when no table is free"). A party that leaves
 * dirties its table; the next party sits at a CLEAN table if there is one, so the player wipes only when both tables are
 * dirty, and then just the one the next party will use. The dirty ones left at the end are the closing "tables" chore.
 * Session memory only (reset with the parties when a service starts).
 */
const dirtyTables = new Set<0 | 1>();
export const markTableDirty = (t: 0 | 1): void => void dirtyTables.add(t);
export const markTableClean = (t: 0 | 1): void => void dirtyTables.delete(t);
/** How many of the two tables are clean right now. */
export const cleanTableCount = (): number => 2 - dirtyTables.size;
/** The table the next party sits at: a clean one when there is one, otherwise the other one from the last customer's. */
export function nextTable(): 0 | 1 {
  const clean = ([0, 1] as const).filter((t) => !dirtyTables.has(t));
  if (clean.length === 1) return clean[0]!;
  return lastSeat === 0 ? 1 : 0;
}
export function seatForOrder(orderId: string): 0 | 1 {
  const known = seatByOrder.get(orderId);
  if (known !== undefined) return known;
  lastSeat = nextTable();
  seatByOrder.set(orderId, lastSeat);
  return lastSeat;
}
export function resetSeatsForTests(): void {
  seatByOrder.clear();
  dirtyTables.clear();
  lastSeat = 1;
  partyByOrderReset();
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
export function lookFor(customerId: string): { outfit: string; hair: string; look: string } {
  let h = 0;
  for (const c of customerId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return {
    outfit: OUTFITS[h % OUTFITS.length]!,
    hair: HAIR[(h >>> 3) % HAIR.length]!,
    // The painted person (peopleLooks.ts): a regular is always themselves, everyone else a fixed pick by the id.
    look: guestLookFor(customerId),
  };
}

/* ── Parties (developer 2026-10-26: "make it 1, 2, 3 or 4 at a time … like a real
 * restaurant … order foods according to their number") ──────────────────────
 *
 * The customers a service still has (its own orders, then its menu guests and walk-in) arrive
 * as parties at one table instead of one by one: a party of 1–4, never more than the service
 * still has, sized by a fixed hash of the first order's id (mostly pairs, like a real dining
 * room — the same service always seats the same way). Each member shows the dish they ordered;
 * the next order of the party is already seated, so only a new party walks in, and the whole
 * party walks out together when the next one arrives. Presentation only and session memory:
 * every member is still served, paid and tipped by the existing order flow, one order at a time.
 *
 * Served together (developer 2026-10-30: "serve everyone together, eat together, leave the cash
 * and leave together"): a member whose party-mates are still to be cooked is only HELD — paid by
 * the existing serve, plate kept back — and when the party's last order is served every plate
 * reaches the table at once, they all react, the cash lies by their seats and the whole party
 * walks out together (`markPartyHeld`, `finishPartyDelivery`).
 */
export const MAX_PARTY = 4;
/** Weights for a party of 1, 2, 3, 4. */
const PARTY_WEIGHTS = [2, 4, 2, 2] as const;
/** A party older than this is gone (a later service never continues it). */
export const PARTY_FRESH_MS = 90_000;

export type PartyDish = { emoji: string; name: string };

function hashOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

/** How many sit down together: 1 + the customers still to come, at most MAX_PARTY, weighted. */
export function partySizeFor(orderId: string, waiting: number): number {
  const cap = Math.min(MAX_PARTY, 1 + Math.max(0, Math.floor(waiting)));
  const weights = PARTY_WEIGHTS.slice(0, cap);
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = hashOf(orderId) % total;
  for (let i = 0; i < weights.length; i++) {
    if (pick < weights[i]!) return i + 1;
    pick -= weights[i]!;
  }
  return 1;
}

/** Where a party of `n` sits around a table: the front pair, then the back pair (map percent). */
export function partySpots(s: FloorSeat, n: number): FloorPoint[] {
  if (n <= 1) return [s.seat];
  const dx = 4.5;
  const back = s.table.y - 4;
  return [
    { x: s.seat.x - dx, y: s.seat.y },
    { x: s.seat.x + dx, y: s.seat.y },
    { x: s.seat.x - dx, y: back },
    { x: s.seat.x + dx, y: back },
  ].slice(0, Math.min(MAX_PARTY, n));
}

/** The walk to a party spot: the table's own path, then round the table's side for the back seats. */
export function pathToSpot(s: FloorSeat, spot: FloorPoint): FloorPoint[] {
  const lead = s.path.slice(0, -1);
  if (spot.y >= s.seat.y - 0.01) return [...lead, spot];
  const side = { x: spot.x + (spot.x < s.seat.x ? -4 : 4), y: s.seat.y };
  return [...lead, side, spot];
}

export type Party = {
  /** The first order's id: the party's identity. */
  key: string;
  table: 0 | 1;
  size: number;
  /** Fixed looks per member (the same person all evening). */
  looks: string[];
  /** The order each member placed, once it is being served (null: still waiting). */
  orderIds: (string | null)[];
  /** What each member ordered (the waiting ones' dishes as the service knows them). */
  dishes: (PartyDish | null)[];
  /** Members already served: their plate and face stay on the table. */
  served: ({ emoji: string; face: string } | null)[];
  /** Members whose plate is ready and paid but waits for the rest of the party to be served together. */
  held: ({ emoji: string; face: string } | null)[];
  /** The whole party has been served and has walked out. */
  left: boolean;
  at: number;
};
export type PartySeat = {
  party: Party;
  slot: number;
  /** True when this order's party walks in now (false: already seated). */
  arriving: boolean;
  /** The party that walks out as this one comes in (fresh only). */
  leaving: Party | null;
};

let party: Party | null = null;
const partyByOrder = new Map<string, PartySeat>();

/**
 * The party seat for `orderId` — decided once per order (a re-render or remount keeps it).
 * A seated party with a free place takes the order; otherwise a new party arrives (the old
 * one leaves), sized by `waiting` (the dishes the service's later customers ordered).
 */
export function seatInParty(
  orderId: string,
  customerId: string,
  dish: PartyDish,
  waiting: readonly (PartyDish | null)[],
  now: number,
  /** A takeaway customer (Phase 9C): alone, never joins or starts a seated party, leaves with the bag. */
  solo = false,
): PartySeat {
  const known = partyByOrder.get(orderId);
  if (known) return known;
  if (solo) {
    const alone: PartySeat = {
      party: {
        key: orderId,
        table: 0,
        size: 1,
        looks: [customerId],
        orderIds: [orderId],
        dishes: [dish],
        served: [null],
        held: [null],
        left: false,
        at: now,
      },
      slot: 0,
      arriving: true,
      leaving: null,
    };
    partyByOrder.set(orderId, alone);
    return alone;
  }
  // A party with plates held back for the table never goes stale (the cooking takes as long as it takes).
  const fresh =
    party && !party.left && (now - party.at <= PARTY_FRESH_MS || party.held.some((h) => !!h))
      ? party
      : null;
  const free = fresh ? fresh.orderIds.indexOf(null) : -1;
  let seat: PartySeat;
  if (fresh && free >= 0) {
    fresh.orderIds[free] = orderId;
    fresh.dishes[free] = dish;
    fresh.at = now;
    seat = { party: fresh, slot: free, arriving: false, leaving: null };
  } else {
    const size = partySizeFor(orderId, waiting.length);
    const next: Party = {
      key: orderId,
      table: seatForOrder(orderId),
      size,
      looks: Array.from({ length: size }, (_, i) => (i === 0 ? customerId : `${orderId}~${i}`)),
      orderIds: Array.from({ length: size }, (_, i) => (i === 0 ? orderId : null)),
      dishes: [dish, ...waiting.slice(0, size - 1)],
      served: Array.from({ length: size }, () => null),
      held: Array.from({ length: size }, () => null),
      left: false,
      at: now,
    };
    seat = { party: next, slot: 0, arriving: true, leaving: fresh };
    party = next;
  }
  partyByOrder.set(orderId, seat);
  return seat;
}

/** A member was served: their plate and face stay at their place. Idempotent. */
export function markPartyServed(orderId: string, emoji: string, face: string, now: number): void {
  const s = partyByOrder.get(orderId);
  if (!s) return;
  s.party.served[s.slot] = { emoji, face };
  s.party.at = now;
}

/** Plates held back for this order's party (not counting this member). */
export function heldPlatesOf(orderId: string): number {
  const s = partyByOrder.get(orderId);
  return s ? s.party.held.filter((h, i) => !!h && i !== s.slot).length : 0;
}

/** A member's plate is ready and paid; it waits for the rest of the party. Idempotent. */
export function markPartyHeld(orderId: string, emoji: string, face: string, now: number): void {
  const s = partyByOrder.get(orderId);
  if (!s) return;
  s.party.held[s.slot] = { emoji, face };
  s.party.at = now;
}

/** True when every place of the party is served, held or this member's own (so all leave together). */
export function partyCompleteWith(seat: PartySeat): boolean {
  const p = seat.party;
  return p.dishes.every((_, i) => i === seat.slot || !!p.served[i] || !!p.held[i]);
}

/**
 * The party's plates have all reached the table: held plates become served, this member's too,
 * and a complete party is marked as gone (the next party finds the room empty). Idempotent.
 */
export function finishPartyDelivery(
  orderId: string,
  emoji: string,
  face: string,
  now: number,
): void {
  const s = partyByOrder.get(orderId);
  if (!s) return;
  const complete = partyCompleteWith(s);
  s.party.held.forEach((h, i) => {
    if (h) s.party.served[i] = h;
    s.party.held[i] = null;
  });
  s.party.served[s.slot] = { emoji, face };
  if (complete) s.party.left = true;
  s.party.at = now;
}

/** A new service starts (or ends): no party carries over. */
export function resetParties(): void {
  partyByOrderReset();
  dirtyTables.clear();
}

export function resetPartiesForTests(): void {
  partyByOrderReset();
}
function partyByOrderReset(): void {
  party = null;
  partyByOrder.clear();
}
