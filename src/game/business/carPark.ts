/** Car Park — deterministic, solvable shared-lot puzzle. It never changes money or stock. */
import { rampOf } from "./difficultyRamp";
import type { SaveData } from "../SaveManager";
import { playDayOf } from "./playDay";
import { addHype } from "../restaurant/secondFloor";
import { HYPE_BY_STARS } from "./fridgeSort";

export const CAR_PARK_FIRST_LEVEL = 15;
export const CAR_PARK_PREP_COOK_LEVEL = 30;
export const CAR_PARK_STRIKES = 3;
export const CAR_PARK_TEST_UNLOCK =
  typeof location !== "undefined" && /[?&]carPark\b/.test(location.search);
export function carParkDebugLevel(fallback: number): number {
  if (typeof location === "undefined") return fallback;
  const n = Number(new URLSearchParams(location.search).get("carPark"));
  return Number.isInteger(n) && n >= CAR_PARK_FIRST_LEVEL && n <= 250 ? n : fallback;
}

export type CarParkTier = {
  from: number;
  cols: number;
  rows: number;
  minVehicles: number;
  maxVehicles: number;
  lengths: readonly number[];
  minFree: number;
  maxFree: number;
  chain: number;
};
export const CAR_PARK_TIERS: readonly CarParkTier[] = [
  {
    from: 15,
    cols: 5,
    rows: 5,
    minVehicles: 5,
    maxVehicles: 6,
    lengths: [2],
    minFree: 3,
    maxFree: 4,
    chain: 2,
  },
  {
    from: 22,
    cols: 5,
    rows: 7,
    minVehicles: 8,
    maxVehicles: 10,
    lengths: [2, 3],
    minFree: 2,
    maxFree: 3,
    chain: 3,
  },
  {
    from: 32,
    cols: 6,
    rows: 8,
    minVehicles: 10,
    maxVehicles: 13,
    lengths: [2, 3],
    minFree: 2,
    maxFree: 2,
    chain: 4,
  },
  {
    from: 45,
    cols: 6,
    rows: 9,
    minVehicles: 14,
    maxVehicles: 16,
    lengths: [2, 3, 4],
    minFree: 2,
    maxFree: 2,
    chain: 5,
  },
  {
    from: 65,
    cols: 6,
    rows: 9,
    minVehicles: 16,
    maxVehicles: 18,
    lengths: [2, 3, 4],
    minFree: 1,
    maxFree: 2,
    chain: 6,
  },
];

export type CarParkVehicle = {
  id: string;
  x: number;
  y: number;
  length: number;
  axis: "h" | "v";
  dir: -1 | 1;
  color: string;
  neighbor: boolean;
};
export type CarParkLot = { cols: number; rows: number; vehicles: CarParkVehicle[]; seed: number };
export type CarParkState = {
  rounds?: number;
  stars?: number;
  best?: number;
  perfect?: number;
  streak?: number;
  howto?: boolean;
  doneDay?: number;
  towAdDay?: number;
};
const colors = ["red", "blue", "yellow", "green", "orange", "purple"] as const;
const BUS_GUEST_COLORS = ["blue", "yellow", "green"] as const;
const whole = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
export const carParkStateOf = (save: SaveData): CarParkState => {
  const raw = save.business.carPark as CarParkState | undefined;
  return {
    rounds: whole(raw?.rounds),
    stars: whole(raw?.stars),
    best: whole(raw?.best),
    perfect: whole(raw?.perfect),
    streak: whole(raw?.streak),
    ...(raw?.howto ? { howto: true } : {}),
    ...(Number.isFinite(raw?.doneDay) ? { doneDay: whole(raw?.doneDay) } : {}),
    ...(Number.isFinite(raw?.towAdDay) ? { towAdDay: whole(raw?.towAdDay) } : {}),
  };
};
export const isCarParkOpen = (level: number) =>
  CAR_PARK_TEST_UNLOCK || level >= CAR_PARK_FIRST_LEVEL;
export const carParkDue = (save: SaveData, level: number) =>
  isCarParkOpen(level) && carParkStateOf(save).doneDay !== playDayOf(save);
export const canPrepCookClearCarPark = (save: SaveData, level: number) =>
  level >= CAR_PARK_PREP_COOK_LEVEL &&
  save.business.staff?.hiredRoles?.includes("prep-cook") === true;
export const carParkTowAdAvailable = (save: SaveData) =>
  carParkStateOf(save).towAdDay !== playDayOf(save);

function rngFor(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/**
 * The tier a level plays, RAMPED (developer 2026-11-19: "make sure the levels of every mini-game match the rest of the game"; the rule is
 * `difficultyRamp.ts`): the number of vehicles, how few are free at the start and the length of the chain move smoothly from one tier's values to the
 * next tier's over the levels between them (Levels 22-31 were one flat 8-10 vehicle lot). On a tier's first level the numbers are exactly the tier's
 * own and nothing gets easier as the level rises. The lot's size and the vehicle lengths stay the tier's own. `car-park-qa` A9 builds lots for every level.
 */
export const carParkTierAt = (level: number): CarParkTier => {
  let i = 0;
  for (let k = 0; k < CAR_PARK_TIERS.length; k++) if (level >= CAR_PARK_TIERS[k]!.from) i = k;
  const here = CAR_PARK_TIERS[i]!;
  return {
    ...here,
    minVehicles: rampOf(CAR_PARK_TIERS, level, (t) => t.minVehicles),
    maxVehicles: rampOf(CAR_PARK_TIERS, level, (t) => t.maxVehicles),
    minFree: rampOf(CAR_PARK_TIERS, level, (t) => t.minFree),
    maxFree: rampOf(CAR_PARK_TIERS, level, (t) => t.maxFree),
    chain: rampOf(CAR_PARK_TIERS, level, (t) => t.chain),
  };
};
const tierAt = carParkTierAt;
/** A cell as one number (the lot is at most 16 wide), which keeps the generator fast on a phone. */
const cellKey = (x: number, y: number) => y * 16 + x;
const cells = (v: CarParkVehicle): number[] =>
  Array.from({ length: v.length }, (_, i) =>
    v.axis === "h" ? cellKey(v.x + i, v.y) : cellKey(v.x, v.y + i),
  );
function pathCells(v: CarParkVehicle, lot: Pick<CarParkLot, "cols" | "rows">): number[] {
  const out: number[] = [];
  if (v.axis === "h") {
    const start = v.dir < 0 ? v.x - 1 : v.x + v.length;
    for (let x = start; x >= 0 && x < lot.cols; x += v.dir) out.push(cellKey(x, v.y));
  } else {
    const start = v.dir < 0 ? v.y - 1 : v.y + v.length;
    for (let y = start; y >= 0 && y < lot.rows; y += v.dir) out.push(cellKey(v.x, y));
  }
  return out;
}
export function blockersFor(lot: CarParkLot, vehicle: CarParkVehicle): string[] {
  const route = new Set(pathCells(vehicle, lot));
  return lot.vehicles
    .filter((v) => v.id !== vehicle.id && cells(v).some((cell) => route.has(cell)))
    .map((v) => v.id);
}
const freeCount = (lot: CarParkLot) =>
  lot.vehicles.filter((v) => blockersFor(lot, v).length === 0).length;
function chainLength(lot: CarParkLot): number {
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const depth = (id: string): number => {
    const old = memo.get(id);
    if (old !== undefined) return old;
    if (visiting.has(id)) return 0;
    const v = lot.vehicles.find((x) => x.id === id)!;
    visiting.add(id);
    const deps = blockersFor(lot, v);
    const value = deps.length ? Math.max(...deps.map((d) => depth(d) + 1)) : 0;
    visiting.delete(id);
    memo.set(id, value);
    return value;
  };
  return Math.max(0, ...lot.vehicles.map((v) => depth(v.id)));
}
export const canLeave = (lot: CarParkLot, id: string) => {
  const v = lot.vehicles.find((item) => item.id === id);
  return !!v && blockersFor(lot, v).length === 0;
};
export function leave(lot: CarParkLot, id: string): CarParkLot {
  return canLeave(lot, id) ? { ...lot, vehicles: lot.vehicles.filter((v) => v.id !== id) } : lot;
}
/** A tow removes a blocked car directly, unlike a normal move. */
export function towVehicle(lot: CarParkLot, id: string): CarParkLot {
  return lot.vehicles.some((v) => v.id === id)
    ? { ...lot, vehicles: lot.vehicles.filter((v) => v.id !== id) }
    : lot;
}
export const isLotCleared = (lot: CarParkLot) => lot.vehicles.length === 0;
/** The order in which every vehicle can drive out (each one finds its way clear when its turn comes), or null when the lot is jammed for good. */
export function solve(lot: CarParkLot): string[] | null {
  const occupied = new Set<number>();
  for (const v of lot.vehicles) for (const cell of cells(v)) occupied.add(cell);
  const routes = new Map(lot.vehicles.map((v) => [v.id, pathCells(v, lot)] as const));
  const remaining = [...lot.vehicles];
  const order: string[] = [];
  while (remaining.length) {
    const at = remaining.findIndex((v) => routes.get(v.id)!.every((cell) => !occupied.has(cell)));
    if (at < 0) return null;
    const [v] = remaining.splice(at, 1);
    for (const cell of cells(v!)) occupied.delete(cell);
    order.push(v!.id);
  }
  return order;
}

const GENERATE_ATTEMPTS = 40;
const CLIMB_STEPS = 500;

/**
 * Builds a lot that is solvable by construction: vehicles are dropped in one at a time and each is kept only if the lot can still be
 * emptied (no two vehicles ever wait for each other). Then the driving directions are flipped, one at a time, towards the tier's
 * difficulty (few vehicles free at the start, a long chain of "this one waits for that one") and a flip is kept only while the lot stays
 * solvable. Same level and seed, same lot. The best lot found is returned if no attempt hits the targets exactly (the QA proves it does).
 */
export function generateLotFor(tier: CarParkTier, level: number, seed: number): CarParkLot {
  let best: { lot: CarParkLot; score: number } | null = null;
  for (let attempt = 0; attempt < GENERATE_ATTEMPTS; attempt++) {
    const rng = rngFor(seed * 7919 + attempt * 104729 + level);
    const target = tier.minVehicles + Math.floor(rng() * (tier.maxVehicles - tier.minVehicles + 1));
    const lot: CarParkLot = { cols: tier.cols, rows: tier.rows, vehicles: [], seed };
    const taken = new Set<number>();
    for (let tries = 0; tries < 1500 && lot.vehicles.length < target; tries++) {
      const length = tier.lengths[Math.floor(rng() * tier.lengths.length)]!;
      const axis = rng() < 0.5 ? "h" : "v";
      const dir = rng() < 0.5 ? -1 : 1;
      const x = Math.floor(rng() * (tier.cols - (axis === "h" ? length - 1 : 0)));
      const y = Math.floor(rng() * (tier.rows - (axis === "v" ? length - 1 : 0)));
      const v: CarParkVehicle = {
        id: `v${lot.vehicles.length}`,
        x,
        y,
        length,
        axis,
        dir,
        color: "red",
        neighbor: false,
      };
      if (cells(v).some((cell) => taken.has(cell))) continue;
      if (!solve({ ...lot, vehicles: [...lot.vehicles, v] })) continue;
      lot.vehicles.push(v);
      for (const cell of cells(v)) taken.add(cell);
    }
    const penalty = (l: CarParkLot) => {
      const free = freeCount(l);
      const off =
        free < tier.minFree ? tier.minFree - free : free > tier.maxFree ? free - tier.maxFree : 0;
      return (
        off * 10 +
        Math.max(0, tier.chain - chainLength(l)) * 4 +
        Math.max(0, tier.minVehicles - l.vehicles.length) * 50
      );
    };
    let score = penalty(lot);
    for (let step = 0; step < CLIMB_STEPS && score > 0 && lot.vehicles.length; step++) {
      const k = Math.floor(rng() * lot.vehicles.length);
      const flipped = { ...lot.vehicles[k]!, dir: (lot.vehicles[k]!.dir === 1 ? -1 : 1) as -1 | 1 };
      const next = { ...lot, vehicles: lot.vehicles.map((v, i) => (i === k ? flipped : v)) };
      if (!solve(next)) continue;
      const nextScore = penalty(next);
      if (nextScore <= score) {
        lot.vehicles = next.vehicles;
        score = nextScore;
      }
    }
    if (!best || score < best.score)
      best = { lot: { ...lot, vehicles: lot.vehicles.map((v) => ({ ...v })) }, score };
    if (score === 0) break;
  }
  return best!.lot;
}

/** The Car Park's own lot: the placed vehicles, then their colours (some belong to the neighbour). */
export function generateLot(level: number, seed: number): CarParkLot {
  const lot = generateLotFor(tierAt(level), level, seed);
  // Some vehicles belong to the neighbour (grey and white, tidy); the guests are the colours.
  const neighbours = Math.max(1, Math.round(lot.vehicles.length / 4));
  const rng = rngFor(seed + 17);
  const pick = new Set<number>();
  while (pick.size < neighbours) pick.add(Math.floor(rng() * lot.vehicles.length));
  lot.vehicles = lot.vehicles.map((v, i) => {
    const neighbor = pick.has(i);
    // The painted buses come in fewer colours than the cars and vans (the art folder has blue, yellow, green and white).
    const guestColors = v.length >= 4 ? BUS_GUEST_COLORS : colors;
    const color = neighbor
      ? v.length >= 4 || rng() < 0.5
        ? "white"
        : "grey"
      : guestColors[Math.floor(rng() * guestColors.length)]!;
    return { ...v, neighbor, color };
  });
  return lot;
}
export function lotFor(save: SaveData, level: number): CarParkLot {
  const state = carParkStateOf(save);
  const day = whole(playDayOf(save));
  return generateLot(level, level * 1000003 + day * 9176 + (state.rounds ?? 0));
}

export const starsFor = (honks: number, towUsed: boolean): 0 | 1 | 2 | 3 => {
  if (honks >= 3) return 0;
  return Math.max(1, 3 - honks - (towUsed ? 1 : 0)) as 1 | 2 | 3;
};
export function finishCarPark(
  save: SaveData,
  level: number,
  honks: number,
  towUsed: boolean,
  stars: 0 | 1 | 2 | 3,
): SaveData {
  const state = carParkStateOf(save);
  const day = playDayOf(save);
  const perfect = stars === 3 ? state.perfect! + 1 : 0;
  const next: CarParkState = {
    ...state,
    rounds: state.rounds! + 1,
    stars: state.stars! + stars,
    best: Math.max(state.best!, stars),
    perfect,
    streak: perfect,
    doneDay: day,
  };
  void level;
  void honks;
  const updated = { ...save, business: { ...save.business, carPark: next } };
  return stars ? addHype(updated, HYPE_BY_STARS[stars]) : updated;
}
export function autoCarPark(save: SaveData): SaveData {
  const state = carParkStateOf(save);
  return {
    ...save,
    business: {
      ...save.business,
      carPark: { ...state, doneDay: playDayOf(save) },
    },
  };
}
export type CarParkAction =
  | { kind: "start" }
  | { kind: "finish"; honks: number; towUsed: boolean; stars: 0 | 1 | 2 | 3 }
  | { kind: "failed"; honks: number }
  | { kind: "auto" }
  | { kind: "skip" }
  | { kind: "howto" };
export type CarParkActionResult = { ok: true } | { ok: false };
