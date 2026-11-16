/**
 * Kitchen Dispatch (developer 2026-11-17, preview): ingredient crates sit on a counter, each with an arrow. Tap a crate
 * and it slides the way its arrow points and leaves the counter, when nothing is in its way; a blocked one shakes. Clear
 * every crate before the timer runs out. Boosters: Hint (lights a crate that can leave), Extra Time, Undo.
 *
 * The board is the Car Park's puzzle (crates are its vehicles: `carPark.ts` places them and proves every board can be
 * emptied), with its own tiers, crates of 2 and 3 cells, ingredients and a timer. Pure and deterministic: the screen only
 * draws it and counts the seconds. It never touches money, stock or the save.
 */
import {
  blockersFor,
  canLeave,
  generateLotFor,
  leave,
  solve,
  type CarParkLot,
  type CarParkTier,
  type CarParkVehicle,
} from "./carPark";

export const CRATE_FIRST_LEVEL = 18;
/** The ingredients on the crates; each has a picture and a crate colour. */
export const CRATE_INGREDIENTS = [
  "tomato",
  "carrot",
  "lettuce",
  "onion",
  "cheddar",
  "salmon",
  "mushroom",
  "broccoli",
] as const;
export type CrateIngredient = (typeof CRATE_INGREDIENTS)[number];
/** The painted crate's key colour becomes this one. */
export const CRATE_COLORS: Record<CrateIngredient, string> = {
  tomato: "#E5483E",
  carrot: "#F59A28",
  lettuce: "#5BB84A",
  onion: "#9A5BD0",
  cheddar: "#F2C230",
  salmon: "#3F8EE8",
  mushroom: "#B98A5A",
  broccoli: "#2FB5A0",
};

export const CRATE_TIERS: readonly CarParkTier[] = [
  {
    from: 18,
    cols: 5,
    rows: 5,
    minVehicles: 6,
    maxVehicles: 7,
    lengths: [2],
    minFree: 3,
    maxFree: 4,
    chain: 2,
  },
  {
    from: 28,
    cols: 6,
    rows: 6,
    minVehicles: 9,
    maxVehicles: 11,
    lengths: [2, 3],
    minFree: 2,
    maxFree: 3,
    chain: 3,
  },
  {
    from: 45,
    cols: 7,
    rows: 7,
    minVehicles: 12,
    maxVehicles: 15,
    lengths: [2, 3],
    minFree: 2,
    maxFree: 2,
    chain: 4,
  },
  {
    from: 65,
    cols: 7,
    rows: 7,
    minVehicles: 15,
    maxVehicles: 18,
    lengths: [2, 3],
    minFree: 1,
    maxFree: 2,
    chain: 5,
  },
];

export function crateTierFor(level: number): CarParkTier {
  let tier = CRATE_TIERS[0]!;
  for (const next of CRATE_TIERS) if (level >= next.from) tier = next;
  return tier;
}
export const crateTierIndex = (level: number) => CRATE_TIERS.indexOf(crateTierFor(level)) + 1;

/** A crate is a Car Park vehicle whose `color` is its ingredient. */
export type Crate = CarParkVehicle;
export type CrateBoard = CarParkLot;

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

/** A solvable board for a level and a seed, with an ingredient on every crate. Same level and seed, same board. */
export function crateBoardFor(level: number, seed: number): CrateBoard {
  const board = generateLotFor(crateTierFor(level), level, seed);
  const rng = rngFor(seed + 4242);
  // A different ingredient for neighbours on the same line is nicer to read, so deal them like a deck.
  const deck: CrateIngredient[] = [];
  return {
    ...board,
    vehicles: board.vehicles.map((v) => {
      if (!deck.length) {
        const fresh = [...CRATE_INGREDIENTS];
        for (let i = fresh.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [fresh[i], fresh[j]] = [fresh[j]!, fresh[i]!];
        }
        deck.push(...fresh);
      }
      return { ...v, color: deck.pop()!, neighbor: false };
    }),
  };
}

/** Seconds on the clock for a board: a little time for every crate. */
export const crateSeconds = (crates: number) => 20 + crates * 8;
export const EXTRA_TIME_SECONDS = 20;
export const START_BOOSTERS = { hint: 3, time: 3, undo: 3 } as const;

export type CrateRound = {
  board: CrateBoard;
  /** Crates taken off the counter, oldest first; Undo puts the last one back. */
  gone: Crate[];
  blocked: number;
  seconds: number;
  hints: number;
  extras: number;
  undos: number;
};

export function startRound(level: number, seed: number): CrateRound {
  const board = crateBoardFor(level, seed);
  return {
    board,
    gone: [],
    blocked: 0,
    seconds: crateSeconds(board.vehicles.length),
    hints: START_BOOSTERS.hint,
    extras: START_BOOSTERS.time,
    undos: START_BOOSTERS.undo,
  };
}

export type TapResult =
  | { kind: "out"; round: CrateRound; crate: Crate }
  | { kind: "blocked"; round: CrateRound; by: string[] }
  | { kind: "none"; round: CrateRound };

/** Taps a crate: it leaves when its way is clear, otherwise it is blocked (and counted). */
export function tapCrate(round: CrateRound, id: string): TapResult {
  const crate = round.board.vehicles.find((v) => v.id === id);
  if (!crate) return { kind: "none", round };
  if (!canLeave(round.board, id))
    return {
      kind: "blocked",
      round: { ...round, blocked: round.blocked + 1 },
      by: blockersFor(round.board, crate),
    };
  return {
    kind: "out",
    crate,
    round: { ...round, board: leave(round.board, id), gone: [...round.gone, crate] },
  };
}

export const roundCleared = (round: CrateRound) => round.board.vehicles.length === 0;
export const cratesLeft = (round: CrateRound) => round.board.vehicles.length;

/** Undo puts the last crate back where it was. Costs one Undo. */
export function undoRound(round: CrateRound): CrateRound {
  const last = round.gone[round.gone.length - 1];
  if (!last || round.undos <= 0) return round;
  return {
    ...round,
    board: { ...round.board, vehicles: [...round.board.vehicles, last] },
    gone: round.gone.slice(0, -1),
    undos: round.undos - 1,
  };
}

/** Extra Time adds seconds to the clock. Costs one. */
export function addTime(round: CrateRound): CrateRound {
  if (round.extras <= 0) return round;
  return { ...round, seconds: round.seconds + EXTRA_TIME_SECONDS, extras: round.extras - 1 };
}

/**
 * The crate a hint should light: one that can leave now and that holds up the most other crates, so the hint is a
 * move that matters. Costs one Hint. Null when no crate can leave (cannot happen on a board this module made).
 */
export function hintCrate(round: CrateRound): string | null {
  const crates = round.board.vehicles;
  const free = crates.filter((v) => canLeave(round.board, v.id));
  if (!free.length) return null;
  const holds = new Map(free.map((v) => [v.id, 0]));
  for (const v of crates)
    for (const b of blockersFor(round.board, v)) if (holds.has(b)) holds.set(b, holds.get(b)! + 1);
  return free.reduce((best, v) => (holds.get(v.id)! > holds.get(best.id)! ? v : best)).id;
}
export const spendHint = (round: CrateRound): CrateRound =>
  round.hints > 0 ? { ...round, hints: round.hints - 1 } : round;

/** Three stars for no blocked tap, two for one or two, one after that. */
export const crateStars = (blocked: number): 1 | 2 | 3 =>
  blocked === 0 ? 3 : blocked <= 2 ? 2 : 1;

/** The order to take every crate in (the Car Park's proof), or null: used by the QA and to prove a board. */
export const crateSolution = (board: CrateBoard) => solve(board);

/* ---------- the gates in the frame: where the crates will leave ---------- */

export type GateSide = "top" | "bottom" | "left" | "right";
export type Gate = { side: GateSide; index: number; ingredient: string };

export const crateSide = (c: Crate): GateSide =>
  c.axis === "h" ? (c.dir < 0 ? "left" : "right") : c.dir < 0 ? "top" : "bottom";

/** One gate for every line a crate will leave by (the first crate of a line gives it its colour). */
export function gatesOf(board: CrateBoard): Gate[] {
  const seen = new Map<string, Gate>();
  for (const c of board.vehicles) {
    const side = crateSide(c);
    const index = c.axis === "h" ? c.y : c.x;
    const key = `${side}${index}`;
    if (!seen.has(key)) seen.set(key, { side, index, ingredient: c.color });
  }
  return [...seen.values()];
}
