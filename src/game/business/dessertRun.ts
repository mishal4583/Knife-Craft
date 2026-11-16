import { makeSeededRand } from "./businessDeterministicRandom";
import {
  DESSERTS,
  GRID,
  RUN_PALETTE,
  type Dessert,
  type DessertId,
  type DessertTier,
} from "./dessertGallery";

/**
 * Dessert Run (developer 2026-11-16, replaces the Plating Belt). Waiters stand on five standby spots. Each
 * one fetches cubes of its colour from the OUTSIDE of the hand-made dessert, one at a time, and a tiny runner
 * takes each to the serving cart and on to four guests. A waiter with nothing reachable waits and resumes by
 * itself; the round jams only when every spot waits. No clock, no undo.
 *
 * This module is the whole game: the screen only draws it. The same `stepRun` runs in the browser and in the
 * QA, so "every shipped plate can be won" is proved on the real rules, not on a model of them.
 */

/** The stage is 540 x 960 logical pixels, the size every other screen and all the art are made for. */
export const STAGE = { w: 540, h: 960 } as const;
export const CELL = 13.5;
export const ORIGIN = { x: 81, y: 119 } as const;
export const PLATE = { x: 270, y: 308, r: 218 } as const;
export const ENTRY = { x: 270, y: 514 } as const;
export const CART = { x: 270, y: 596 } as const;
export const AISLE = { x: 235, y: 500, w: 70, h: 170 } as const;
export const SPOT_COUNT = 5;
export const SPOT_Y = 716;
export const SPOT_W = 96;
export const spotCenter = (i: number) => ({ x: 270 + (i - 2) * 104, y: SPOT_Y });
/** Two tables beside the aisle, two guests at each; the guests sit at the table's two place settings. */
export const TABLES = [
  { x: 8, y: 520, w: 220, h: 110 },
  { x: 312, y: 520, w: 220, h: 110 },
] as const;
export const GUESTS = [
  { x: 66, y: 560 },
  { x: 170, y: 560 },
  { x: 370, y: 560 },
  { x: 474, y: 560 },
] as const;
export const GUEST_PLATE_Y = 565;
export const QUEUE = { rows: 3, tileH: 52, gap: 8, x: 16, y: 770 } as const;
/** Pixels a runner covers in a second at speed x1. */
const RUN_SPEED = 700;
/** Fixed step the whole game runs on, so a replay is the same on every phone. */
export const STEP = 1 / 60;

export type RunTier = {
  id: DessertTier;
  fromLevel: number;
  lanes: number;
  /** Cubes a waiter carries: at least `min`, at most `min + spread - 1`. */
  min: number;
  spread: number;
  /** Chance that the next waiter of the deck is the colour with the FEWEST reachable cubes: higher = longer chains, more traps. */
  narrow: number;
};

export const RUN_TIERS: readonly RunTier[] = [
  { id: 1, fromLevel: 18, lanes: 3, min: 8, spread: 14, narrow: 0.4 },
  { id: 2, fromLevel: 28, lanes: 3, min: 6, spread: 14, narrow: 0.5 },
  { id: 3, fromLevel: 45, lanes: 4, min: 5, spread: 14, narrow: 0.5 },
  { id: 4, fromLevel: 65, lanes: 5, min: 4, spread: 14, narrow: 0.4 },
];

export function runTierForLevel(level: number): RunTier {
  return [...RUN_TIERS].reverse().find((tier) => level >= tier.fromLevel) ?? RUN_TIERS[0]!;
}

export type DeckEntry = { k: number; n: number };
export type RunWaiter = { k: number; n: number; hex: string };
export type PathPoint = { x: number; y: number; act?: "pick" | "drop"; cell?: number };
export type Runner = {
  x: number;
  y: number;
  path: PathPoint[] | null;
  i: number;
  /** Colour index the runner holds, or -1. */
  carry: number;
};
export type Spot = {
  k: number;
  hex: string;
  /** Cubes this waiter still has to deliver (the number on its badge). */
  n: number;
  run: Runner;
  /** Seconds since the waiter finished; 0 while it works. */
  done: number;
};
export type Flight = { guest: number; k: number; t: number };

export type RunState = {
  dessert: Dessert;
  grid: Int8Array;
  /** Empty cells joined to the outside of the grid. */
  ext: Uint8Array;
  /** Cells a runner is already on its way to. */
  reserved: Uint8Array;
  lanes: RunWaiter[][];
  /** The lane each waiter of the deck (in deck order) was dealt to; tapping in deck order always wins. */
  deckLanes: number[];
  spots: Array<Spot | null>;
  total: number;
  delivered: number;
  need: number[];
  served: number[][];
  flights: Flight[];
  peakSpots: number;
  /** The most waiters that stood blocked at once: the measure of a tidy plan. */
  peakWaiting: number;
  phase: "play" | "won" | "jam";
  /** The seconds the round has run at x1; lets the screen animate without its own clock. */
  time: number;
};

export function hexOf(state: RunState, k: number): string {
  return RUN_PALETTE[state.dessert.keys[k]!];
}

/* ---------- the grid: what a waiter can reach ---------- */

export function computeExt(grid: Int8Array): Uint8Array {
  const ext = new Uint8Array(GRID * GRID);
  const stack: number[] = [];
  const push = (i: number) => {
    if (grid[i] === -1 && !ext[i]) {
      ext[i] = 1;
      stack.push(i);
    }
  };
  for (let k = 0; k < GRID; k++) {
    push(k);
    push((GRID - 1) * GRID + k);
    push(k * GRID);
    push(k * GRID + GRID - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % GRID;
    const y = (i / GRID) | 0;
    if (x > 0) push(i - 1);
    if (x < GRID - 1) push(i + 1);
    if (y > 0) push(i - GRID);
    if (y < GRID - 1) push(i + GRID);
  }
  return ext;
}

/** A cube is reachable when it touches the outside: the grid's edge or an empty cell joined to it. */
export function isExposed(ext: Uint8Array, i: number): boolean {
  const x = i % GRID;
  const y = (i / GRID) | 0;
  return (
    x === 0 ||
    y === 0 ||
    x === GRID - 1 ||
    y === GRID - 1 ||
    ext[i - 1] === 1 ||
    ext[i + 1] === 1 ||
    ext[i - GRID] === 1 ||
    ext[i + GRID] === 1
  );
}

export function removeCell(grid: Int8Array, ext: Uint8Array, i: number) {
  grid[i] = -1;
  if (!isExposed(ext, i)) return; // a hole inside stays closed until it is opened from outside
  ext[i] = 1;
  const stack = [i];
  while (stack.length) {
    const c = stack.pop()!;
    const x = c % GRID;
    const y = (c / GRID) | 0;
    for (const j of [
      x > 0 ? c - 1 : -1,
      x < GRID - 1 ? c + 1 : -1,
      y > 0 ? c - GRID : -1,
      y < GRID - 1 ? c + GRID : -1,
    ])
      if (j >= 0 && grid[j] === -1 && !ext[j]) {
        ext[j] = 1;
        stack.push(j);
      }
  }
}

/** The reachable cube of colour k nearest the aisle, or -1. Deterministic: the first on a tie. */
function pickNearest(
  grid: Int8Array,
  ext: Uint8Array,
  k: number,
  reserved: Uint8Array | null,
): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== k || reserved?.[i] || !isExposed(ext, i)) continue;
    const d = ((i % GRID) + 0.5 - GRID / 2) ** 2 + (((i / GRID) | 0) + 0.5 - (GRID + 1)) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** The cubes of colour k a waiter could take right now; the screen lights them while a waiter is held. */
export function reachableCells(state: RunState, k: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < state.grid.length; i++)
    if (state.grid[i] === k && isExposed(state.ext, i)) out.push(i);
  return out;
}

export function cellCenter(i: number) {
  return {
    x: ORIGIN.x + (i % GRID) * CELL + CELL / 2,
    y: ORIGIN.y + ((i / GRID) | 0) * CELL + CELL / 2,
  };
}

/* ---------- dealing a plate ---------- */

/**
 * The waiters, in the order they are meant to go. The deck is built by taking the dessert apart in a
 * sequence that can always continue; the live rules then replay it (the QA proves that for every shipped
 * seed, with taps late by a random time too).
 */
export function makeDeck(dessertId: DessertId, seed: number, tier: RunTier): DeckEntry[] {
  const dessert = DESSERTS[dessertId];
  const grid = dessert.build();
  const ext = computeExt(grid);
  const rand = makeSeededRand(seed);
  const out: DeckEntry[] = [];
  const remain = new Array<number>(dessert.keys.length).fill(0);
  let left = 0;
  grid.forEach((v) => {
    if (v >= 0) {
      remain[v]!++;
      left++;
    }
  });
  while (left > 0) {
    const options: Array<[number, number]> = [];
    for (let k = 0; k < dessert.keys.length; k++) {
      if (!remain[k]) continue;
      let n = 0;
      for (let i = 0; i < grid.length; i++) if (grid[i] === k && isExposed(ext, i)) n++;
      if (n) options.push([k, n]);
    }
    if (!options.length) throw new Error(`Dessert ${dessertId} cannot be taken apart`);
    let total = 0;
    for (const [k] of options) total += remain[k]!;
    let roll = rand() * total;
    let chosen = options[0]!;
    for (const option of options) {
      roll -= remain[option[0]]!;
      if (roll <= 0) {
        chosen = option;
        break;
      }
    }
    if (rand() < tier.narrow) chosen = options.reduce((a, b) => (b[1] < a[1] ? b : a));
    const [k, reachable] = chosen;
    let take = Math.min(reachable, tier.min + Math.floor(rand() * tier.spread));
    // No tiny waiter left over at the end of a colour.
    if (remain[k]! - take > 0 && remain[k]! - take < tier.min)
      take = Math.min(reachable, remain[k]!);
    for (let t = 0; t < take; t++) removeCell(grid, ext, pickNearest(grid, ext, k, null));
    remain[k]! -= take;
    left -= take;
    out.push({ k, n: take });
  }
  return out;
}

export function makeRun(dessertId: DessertId, seed: number, tier: RunTier): RunState {
  const dessert = DESSERTS[dessertId];
  const grid = dessert.build();
  const deck = makeDeck(dessertId, seed, tier);
  const lanes: RunWaiter[][] = Array.from({ length: tier.lanes }, () => []);
  const deckLanes = dealLanes(deck.length, tier.lanes, makeSeededRand(seed ^ 0x9e3779b9));
  deck.forEach((entry, i) =>
    lanes[deckLanes[i]!]!.push({
      k: entry.k,
      n: entry.n,
      hex: RUN_PALETTE[dessert.keys[entry.k]!],
    }),
  );
  let total = 0;
  grid.forEach((v) => {
    if (v >= 0) total++;
  });
  return {
    dessert,
    grid,
    ext: computeExt(grid),
    reserved: new Uint8Array(GRID * GRID),
    lanes,
    deckLanes,
    spots: new Array<Spot | null>(SPOT_COUNT).fill(null),
    total,
    delivered: 0,
    // the same split `guestOf` deals by: guest j takes the deliveries whose floor(4 d / total) is j
    need: [0, 1, 2, 3].map((j) => Math.ceil((total * (j + 1)) / 4) - Math.ceil((total * j) / 4)),
    served: [[], [], [], []],
    flights: [],
    peakSpots: 0,
    peakWaiting: 0,
    phase: "play",
    time: 0,
  };
}

/**
 * Deals the deck into lanes of nearly equal length in a shuffled pattern. Each lane keeps deck order, so
 * sending the waiters in deck order is always possible; the lane fronts, though, can be far ahead of it.
 */
function dealLanes(count: number, lanes: number, rand: () => number): number[] {
  const labels = Array.from({ length: count }, (_, i) => i % lanes);
  for (let i = labels.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [labels[i], labels[j]] = [labels[j]!, labels[i]!];
  }
  return labels;
}

/* ---------- play ---------- */

export type TapResult = "sent" | "full" | "empty" | "over";

/** Sends the front waiter of a lane to the first free standby spot. */
export function tapLane(state: RunState, lane: number): TapResult {
  if (state.phase !== "play") return "over";
  const waiter = state.lanes[lane]?.[0];
  if (!waiter) return "empty";
  const free = state.spots.indexOf(null);
  if (free < 0) return "full";
  state.lanes[lane]!.shift();
  const c = spotCenter(free);
  state.spots[free] = {
    k: waiter.k,
    hex: waiter.hex,
    n: waiter.n,
    run: { x: c.x, y: c.y, path: null, i: 0, carry: -1 },
    done: 0,
  };
  const used = state.spots.filter(Boolean).length;
  if (used > state.peakSpots) state.peakSpots = used;
  return "sent";
}

function planTrip(state: RunState, spot: Spot): boolean {
  const cell = pickNearest(state.grid, state.ext, spot.k, state.reserved);
  if (cell < 0) return false;
  state.reserved[cell] = 1;
  const c = cellCenter(cell);
  const run = spot.run;
  const path: PathPoint[] = [];
  if (run.y > AISLE.y + AISLE.h) path.push({ x: ENTRY.x, y: AISLE.y + AISLE.h });
  path.push(
    { x: ENTRY.x, y: ENTRY.y },
    { x: c.x, y: c.y, act: "pick", cell },
    { x: ENTRY.x, y: ENTRY.y },
    { x: CART.x, y: CART.y + 6, act: "drop" },
  );
  run.path = path;
  run.i = 0;
  return true;
}

/** Guest j is served by the quarter of the plate delivered so far. */
export function guestOf(state: RunState, delivered: number): number {
  return Math.min(3, Math.floor((delivered * 4) / state.total));
}

/** A waiter that stands with nothing reachable to fetch. */
export function isWaiting(state: RunState, spot: Spot): boolean {
  return (
    !spot.run.path &&
    !spot.done &&
    spot.n > 0 &&
    pickNearest(state.grid, state.ext, spot.k, state.reserved) < 0
  );
}

/** Advances the game by `dt` seconds of play at speed x1. Call with STEP (or a multiple of it). */
export function stepRun(state: RunState, dt: number, speed = 1) {
  if (state.phase !== "play") return;
  const sim = dt * speed;
  state.time += sim;
  const reach = RUN_SPEED * sim;
  state.spots.forEach((spot, si) => {
    if (!spot) return;
    if (spot.done) {
      spot.done += sim;
      if (spot.done > 0.6) state.spots[si] = null;
      return;
    }
    const run = spot.run;
    if (!run.path) {
      if (spot.n > 0) planTrip(state, spot);
      return;
    }
    let step = reach;
    while (step > 0 && run.path) {
      const p = run.path[run.i]!;
      const dx = p.x - run.x;
      const dy = p.y - run.y;
      const d = Math.hypot(dx, dy);
      if (d > step) {
        run.x += (dx / d) * step;
        run.y += (dy / d) * step;
        break;
      }
      run.x = p.x;
      run.y = p.y;
      step -= d;
      if (p.act === "pick") {
        state.reserved[p.cell!] = 0;
        if (state.grid[p.cell!] === spot.k) {
          removeCell(state.grid, state.ext, p.cell!);
          run.carry = spot.k;
        }
      }
      if (p.act === "drop" && run.carry >= 0) {
        const guest = guestOf(state, state.delivered);
        state.delivered++;
        spot.n--;
        state.flights.push({ guest, k: run.carry, t: 0 });
        run.carry = -1;
      }
      run.i++;
      if (run.i >= run.path.length) {
        run.path = null;
        if (spot.n <= 0) spot.done = 0.001;
      }
    }
  });
  for (const f of state.flights) f.t += sim * 3;
  state.flights = state.flights.filter((f) => {
    if (f.t >= 1) {
      state.served[f.guest]!.push(f.k);
      return false;
    }
    return true;
  });
  let waiting = 0;
  for (const spot of state.spots) if (spot && isWaiting(state, spot)) waiting++;
  if (waiting > state.peakWaiting) state.peakWaiting = waiting;
  if (state.delivered >= state.total && !state.flights.length) state.phase = "won";
  else if (isJammed(state)) state.phase = "jam";
}

/** Nothing can move: no waiter is running, every waiter is blocked, and no tap could help. */
export function isJammed(state: RunState): boolean {
  let any = false;
  for (const spot of state.spots) {
    if (!spot) continue;
    any = true;
    if (spot.run.path || spot.done || !isWaiting(state, spot)) return false;
  }
  if (!any) return false;
  const lanesLeft = state.lanes.some((lane) => lane.length > 0);
  const free = state.spots.indexOf(null) >= 0;
  return !(lanesLeft && free);
}

export function runWon(state: RunState): boolean {
  return state.phase === "won";
}

/** Three stars when never more than two waiters stood blocked at once; five blocked is a near jam. */
export function starsForPeakWaiting(peakWaiting: number): number {
  return peakWaiting <= 2 ? 3 : peakWaiting <= 4 ? 2 : 1;
}

/** Plain colour name for screen readers: the cubes are told apart by colour. */
export function runColorName(key: string): string {
  return key === "choc" ? "dark chocolate" : key === "milk" ? "milk chocolate" : key;
}

/* ---------- proof: replay a deck ---------- */

/**
 * Plays a round the way the deck was built: the next waiter in deck order goes as soon as a spot is free
 * and `lateSteps` has passed (a late player). Returns whether it was won and the most waiters blocked at once.
 * The QA runs this for every shipped seed; a late tap must not turn a won plate into a jam.
 */
export function playDeckOrder(
  state: RunState,
  _tier: RunTier,
  tapDelaySteps: (index: number) => number = () => 0,
  maxSteps = 120_000,
): { won: boolean; peak: number; steps: number } {
  const total = state.lanes.reduce((n, lane) => n + lane.length, 0);
  let next = 0;
  let wait = tapDelaySteps(0);
  let steps = 0;
  while (state.phase === "play" && steps < maxSteps) {
    if (next < total && state.spots.indexOf(null) >= 0) {
      if (wait <= 0) {
        tapLane(state, state.deckLanes[next]!);
        next++;
        wait = tapDelaySteps(next);
        continue;
      }
      wait--;
    }
    stepRun(state, STEP, 1);
    steps++;
  }
  return { won: state.phase === "won", peak: state.peakWaiting, steps };
}

/** What is wrong with a round, or null when it follows the plan. */
export function runDeckProblem(state: RunState, tier: RunTier): string | null {
  if (state.lanes.length !== tier.lanes)
    return `${state.lanes.length} lanes, the tier wants ${tier.lanes}`;
  const waiters = state.lanes.flat();
  const per = new Array<number>(state.dessert.keys.length).fill(0);
  state.grid.forEach((v) => {
    if (v >= 0) per[v]!++;
  });
  for (let k = 0; k < per.length; k++) {
    const sum = waiters.filter((w) => w.k === k).reduce((n, w) => n + w.n, 0);
    if (sum !== per[k]) return `colour ${k}: waiters carry ${sum}, the dessert has ${per[k]}`;
  }
  return null;
}
