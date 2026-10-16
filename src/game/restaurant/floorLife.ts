/**
 * Floor life (developer 2026-10-16): the idle-game animation of the Second
 * Floor. Floor Servers carry food from the machines to the Pickup Counter;
 * guests come in, pick it up, eat at a table and leave; cleaners clear the
 * tables. It only shows the saved floor (which stations are owned and staffed,
 * how many people are hired) and never touches money or the save.
 *
 * Pure and seeded (no Math.random): the same floor always gives the same
 * cast. Every route is a list of stops in map percent (0–100 of the
 * second-floor image) with how long the person stays there; `timeline`
 * turns a route into keyframe percentages for the view (FloorLife.tsx).
 */
import { makeSeededRand } from "../business/businessDeterministicRandom";
import {
  FLOOR_STAFF,
  STATIONS,
  isStaffed,
  type SecondFloorState,
  type StationId,
} from "./secondFloor";

export type Spot = { x: number; y: number };
/** One stop of a route: walk there, then stay `hold` seconds. */
export type Stop = Spot & {
  hold?: number;
  /** What the person does while there (drives the pose and the bubble). */
  pose?: "sit" | "pick" | "drop" | "clean" | "work" | "away";
};
export type FloorActor = {
  id: string;
  /** guest / server / cleaner on both floors; cook, chef and manager on the first floor. */
  kind: "guest" | "server" | "cleaner" | "cook" | "chef" | "manager" | "cashier";
  /** Food shown in the bubble or on the tray (a station's icon). */
  food?: string;
  outfit: string;
  hair: string;
  stops: Stop[];
  /** Seconds before the first lap starts (staggers the cast). */
  delay: number;
};

/** Walking speed in map percent per second. */
export const WALK_SPEED = 6;
/** Most guests on the floor at once. */
export const MAX_GUESTS = 10;

/** Where things are on `public/restaurant-map/second-floor.webp`, in map percent. */
export const FLOOR_SPOTS = {
  /** The double door at the bottom of the hall (measured on the map at 390 px). */
  door: { x: 50, y: 86.5 },
  /** The aisle between the tables, from the door up to the counter. */
  aisleX: 51.5,
  aisleBottom: 83,
  /** Guests wait here, on the rug in front of the Pickup Counter. */
  counterFront: { x: 65.4, y: 55 },
  /** Servers put the food down here, on the counter's station side. */
  counterBack: { x: 56, y: 40.8 },
  /** The walkway between the stations: across the top row and down the middle. */
  topWalk: 20.6,
  middleWalk: 37.8,
  stationAisleX: 52.5,
  /**
   * The green chairs beside each table, measured on the art on a 2 % grid
   * (developer 2026-10-16: guests sat beside the chairs). Centre tables first,
   * then the booth chairs. One guest per chair, never shared.
   */
  seats: [
    { x: 47.4, y: 65.1 },
    { x: 56.4, y: 65.1 },
    { x: 46.6, y: 77.6 },
    { x: 57.3, y: 77.6 },
    { x: 34.6, y: 65.1 },
    { x: 69.2, y: 65.1 },
    { x: 35.5, y: 77.6 },
    { x: 68.4, y: 77.6 },
    { x: 20.9, y: 65.1 },
    { x: 20.5, y: 77.8 },
    { x: 79.9, y: 71.6 },
  ] as readonly Spot[],
  /**
   * Where a cleaner stands to wipe each table: its open bottom side, on the
   * walkway, away from every chair (so a cleaner never stands on a guest).
   */
  tableSides: [
    { x: 41, y: 69.6 },
    { x: 63.3, y: 69.6 },
    { x: 41.2, y: 82 },
    { x: 63.3, y: 82 },
    { x: 15.5, y: 69.6 },
    { x: 15.5, y: 82.2 },
    { x: 85.5, y: 75.6 },
  ] as readonly Spot[],
} as const;

/** Where a server stands at each station, and the walk from it to the counter. */
const STATION_ROUTE: Record<StationId, Spot[]> = {
  pizza: [
    { x: 20.5, y: 20.6 },
    { x: 52.5, y: 20.6 },
    { x: 52.5, y: 40.8 },
  ],
  coffee: [
    { x: 49, y: 20.6 },
    { x: 52.5, y: 20.6 },
    { x: 52.5, y: 40.8 },
  ],
  drinks: [
    { x: 81, y: 20.6 },
    { x: 52.5, y: 20.6 },
    { x: 52.5, y: 40.8 },
  ],
  burger: [
    { x: 26, y: 37.8 },
    { x: 52.5, y: 37.8 },
    { x: 52.5, y: 40.8 },
  ],
  iceCream: [
    { x: 76, y: 40.2 },
    { x: 60, y: 40.8 },
  ],
  hotFood: [
    { x: 49.6, y: 46 },
    { x: 50.4, y: 40.8 },
  ],
};

const OUTFITS = [
  "#bb633e",
  "#4f7180",
  "#9a5260",
  "#547a55",
  "#a16b3f",
  "#637da8",
  "#9b667f",
  "#7a6a3e",
];
const HAIRS = ["#493324", "#35271f", "#473222", "#2b211b", "#6b4a2e"];
/** Staff wear the house colours. */
const SERVER_OUTFIT = "#f2ead8";
const CLEANER_OUTFIT = "#5d8a8a";

/** From the aisle to a chair: chairs away from the aisle are reached along the
 *  lane below their table row, so nobody walks through a table. */
function toSeat(seat: Spot): Spot[] {
  const S = FLOOR_SPOTS;
  if (Math.abs(seat.x - S.aisleX) <= 8) return [{ x: S.aisleX, y: seat.y }];
  const lane = seat.y + 5.6;
  return [
    { x: S.aisleX, y: lane },
    { x: seat.x, y: lane },
  ];
}

/**
 * Testing preview (developer 2026-10-16): with the Second Floor test switch on
 * (`npm run dev` or `?floor2`) the animation shows this full floor — every
 * station working, 3 servers, 2 cleaners — whatever the save owns. It is only
 * what is drawn; the save, the stations' locks and the money are unchanged.
 */
/**
 * Testing switch for the animations (developer 2026-10-16): true plays the full
 * preview cast on both floors without buying or hiring anything. Off since the
 * developer's testing ended ("hide the people now"): the floors show only what
 * the save owns, staffs and hires.
 */
export const FLOOR_LIFE_ALWAYS_PREVIEW = false;

export const FLOOR_LIFE_PREVIEW: SecondFloorState = {
  stations: Object.fromEntries(STATIONS.map((d) => [d.id, { level: 1, lastCollectAt: 0 }])),
  servers: FLOOR_STAFF.server.max,
  cleaners: FLOOR_STAFF.cleaner.max,
};

/** Owned stations that a Floor Server runs (they are the only ones that make food). */
export function workingStations(floor: SecondFloorState): StationId[] {
  return STATIONS.filter((d) => floor.stations[d.id] && isStaffed(floor, d.id)).map((d) => d.id);
}

function seedOf(floor: SecondFloorState): number {
  let h = 2166136261;
  const key = `${Object.keys(floor.stations).sort().join()}|${floor.servers ?? 0}|${floor.cleaners ?? 0}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const iconOf = (id: StationId) => STATIONS.find((d) => d.id === id)!.icon;

/** The whole cast for this floor. An empty or unstaffed floor is quiet. */
export function floorCast(floor: SecondFloorState): FloorActor[] {
  const working = workingStations(floor);
  if (working.length === 0) return [];
  const rand = makeSeededRand(seedOf(floor));
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
  const cast: FloorActor[] = [];
  const S = FLOOR_SPOTS;

  // Servers: each runs its own stations (2 each), station → counter → station.
  const servers = Math.min(
    floor.servers ?? 0,
    Math.ceil(working.length / FLOOR_STAFF.server.covers),
  );
  for (let i = 0; i < servers; i++) {
    const mine = working.slice(i * FLOOR_STAFF.server.covers, (i + 1) * FLOOR_STAFF.server.covers);
    const stops: Stop[] = [];
    for (const id of mine) {
      const route = STATION_ROUTE[id];
      stops.push({ ...route[0]!, hold: 2.2, pose: "pick" });
      for (const p of route.slice(1)) stops.push({ ...p });
      stops.push({ ...S.counterBack, hold: 1.6, pose: "drop" });
      for (const p of route.slice(1, -1).reverse()) stops.push({ ...p });
    }
    cast.push({
      id: `server-${i}`,
      kind: "server",
      food: iconOf(mine[0]!),
      outfit: SERVER_OUTFIT,
      hair: pick(HAIRS),
      stops,
      delay: -rand() * 20,
    });
  }

  // Guests: two per working station, up to MAX_GUESTS; each has a seat of their own.
  const guests = Math.min(MAX_GUESTS, working.length * 2, S.seats.length);
  for (let i = 0; i < guests; i++) {
    const seat = S.seats[i]!;
    const there = toSeat(seat);
    cast.push({
      id: `guest-${i}`,
      kind: "guest",
      food: iconOf(working[i % working.length]!),
      outfit: pick(OUTFITS),
      hair: pick(HAIRS),
      stops: [
        { ...S.door },
        { x: S.aisleX, y: S.aisleBottom },
        { x: S.aisleX, y: S.counterFront.y },
        // Each guest has a place of their own along the counter (no one stands on another).
        { x: S.counterFront.x + ((i % 5) - 2) * 3.2, y: S.counterFront.y, hold: 2.4, pose: "pick" },
        { x: S.aisleX, y: S.counterFront.y },
        ...there,
        { ...seat, hold: 12 + rand() * 6, pose: "sit" },
        ...[...there].reverse(),
        { x: S.aisleX, y: S.aisleBottom },
        { ...S.door, hold: 4 + rand() * 8, pose: "away" },
      ],
      delay: -i * 9 - rand() * 4,
    });
  }

  // Cleaners: walk the tables and wipe them.
  const cleaners = Math.min(floor.cleaners ?? 0, FLOOR_STAFF.cleaner.max);
  for (let i = 0; i < cleaners; i++) {
    const sides = S.tableSides.filter((_, k) => k % cleaners === i);
    const stops: Stop[] = [];
    for (const side of sides) {
      stops.push({ x: S.aisleX, y: side.y });
      stops.push({ ...side, hold: 2.5, pose: "clean" });
      stops.push({ x: S.aisleX, y: side.y });
    }
    cast.push({
      id: `cleaner-${i}`,
      kind: "cleaner",
      food: "🧽",
      outfit: CLEANER_OUTFIT,
      hair: pick(HAIRS),
      stops,
      delay: -rand() * 15,
    });
  }
  return cast;
}

export type Frame = Spot & {
  /** Percent of the lap (0–100). */
  at: number;
  pose: "walk" | NonNullable<Stop["pose"]>;
};

/**
 * A route as keyframes: one lap visits every stop in order and walks back
 * to the first. Each stop gives two frames (arrive, leave) when the person
 * stays there. Returns the lap length in seconds too.
 */
export function timeline(stops: readonly Stop[]): { seconds: number; frames: Frame[] } {
  if (stops.length === 0) return { seconds: 0, frames: [] };
  const points: { t: number; x: number; y: number; pose: Frame["pose"] }[] = [];
  let t = 0;
  const loop = [...stops, stops[0]!];
  for (let i = 0; i < loop.length; i++) {
    const s = loop[i]!;
    if (i > 0) {
      const p = loop[i - 1]!;
      t += Math.hypot(s.x - p.x, s.y - p.y) / WALK_SPEED;
    }
    if (i === loop.length - 1) {
      points.push({ t, x: s.x, y: s.y, pose: "walk" });
      break;
    }
    points.push({ t, x: s.x, y: s.y, pose: s.hold ? (s.pose ?? "walk") : "walk" });
    if (s.hold) {
      t += s.hold;
      points.push({ t, x: s.x, y: s.y, pose: "walk" });
    }
  }
  const seconds = Math.max(t, 1);
  const frames = points.map((p) => ({
    at: Math.round((p.t / seconds) * 10_000) / 100,
    x: p.x,
    y: p.y,
    pose: p.pose,
  }));
  return { seconds: Math.round(seconds * 100) / 100, frames };
}
