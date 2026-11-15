import { makeSeededRand } from "./businessDeterministicRandom";

export type BeltColor = 0 | 1 | 2 | 3 | 4 | 5;
export type BeltWaiter = { id: string; color: BeltColor; count: number };
export type BeltIngredient = { id: string; color: BeltColor };

export const BELT_PALETTE = [
  { name: "red", hex: "#D9392B" },
  { name: "orange", hex: "#F28C28" },
  { name: "yellow", hex: "#F4C430" },
  { name: "green", hex: "#4C9A2A" },
  { name: "brown", hex: "#8B5A2B" },
  { name: "purple", hex: "#7B4BA3" },
] as const;

export type BeltTier = {
  id: 1 | 2 | 3 | 4;
  fromLevel: number;
  size: number;
  lanes: number;
  colors: number;
  waiterCount: readonly [number, number];
  /** Added to every waiter's random weight: higher = the waiters of a colour are more alike. Measured: hardly changes the difficulty. */
  evenness: number;
  /** Fewest cubes one waiter carries; small waiters are the ones that clog a table. */
  minWaiter: number;
  /** Seeds per colour for the food regions. Measured: hardly changes the difficulty (the rim and the waiter total do). */
  patches: number;
  /** Cells the cream rim is thick; food is out of reach until it is cleared. */
  rim: number;
};

export const BELT_TIERS: readonly BeltTier[] = [
  {
    id: 1,
    fromLevel: 18,
    size: 20,
    lanes: 3,
    colors: 3,
    waiterCount: [14, 15],
    evenness: 0.2,
    minWaiter: 4,
    patches: 2,
    rim: 3.7,
  },
  {
    id: 2,
    fromLevel: 28,
    size: 26,
    lanes: 4,
    colors: 4,
    waiterCount: [19, 20],
    evenness: 0.2,
    minWaiter: 4,
    patches: 2,
    rim: 3.6,
  },
  {
    id: 3,
    fromLevel: 45,
    size: 30,
    lanes: 5,
    colors: 5,
    waiterCount: [24, 25],
    evenness: 0.2,
    minWaiter: 4,
    patches: 2,
    rim: 3.5,
  },
  {
    id: 4,
    fromLevel: 65,
    size: 36,
    lanes: 5,
    colors: 6,
    waiterCount: [28, 30],
    evenness: 0.2,
    minWaiter: 4,
    patches: 2,
    rim: 3.5,
  },
];

export type BeltBoard = {
  size: number;
  cells: number[];
  colors: number;
  colorHexes: string[];
};
export type BeltState = {
  board: BeltBoard;
  lanes: BeltWaiter[][];
  tables: Array<BeltWaiter | null>;
  peakTables: number;
};
export type BeltMove = { kind: "lane"; lane: number } | { kind: "table"; table: number };
export type BeltMoveResult =
  | { ok: true; state: BeltState; collected: number; waiter: BeltWaiter }
  | { ok: false; reason: "table-full" | "nothing-to-collect" | "empty-lane" };

const TABLES = 5;
const EMPTY = -1;

export function beltTierForLevel(level: number): BeltTier {
  return [...BELT_TIERS].reverse().find((tier) => level >= tier.fromLevel) ?? BELT_TIERS[0]!;
}

function boardCount(board: BeltBoard, color: number): number {
  return board.cells.reduce((n, cell) => n + Number(cell === color), 0);
}

/** Fewest cubes a colour may have on a plate, and most waiters one colour is split into. */
const MIN_WAITER_CUBES = 4;
const MAX_WAITERS_PER_COLOR = 5;

/**
 * Splits every colour's cubes into waiters. The tier's waiter total is shared
 * between the colours in proportion to their cubes, so no colour is lumped into
 * one giant waiter, and each waiter carries at least four cubes. The sizes
 * inside a colour vary a little so the plate is not a row of equal numbers.
 */
function splitWaiters(board: BeltBoard, tier: BeltTier, rand: () => number): BeltWaiter[] {
  const counts = Array.from({ length: board.colors }, (_, color) => boardCount(board, color));
  if (counts.some((count) => count < MIN_WAITER_CUBES))
    throw new Error("Belt colour has fewer than four cells");
  const [minTotal, maxTotal] = tier.waiterCount;
  const target = minTotal + Math.floor(rand() * (maxTotal - minTotal + 1));
  const cubes = counts.reduce((a, b) => a + b, 0);
  const cap = (color: number) =>
    Math.min(MAX_WAITERS_PER_COLOR, Math.floor(counts[color]! / tier.minWaiter));
  const floor = (color: number) => Math.min(2, cap(color));
  const parts = counts.map((count, color) =>
    Math.max(floor(color), Math.min(cap(color), Math.round((target * count) / cubes))),
  );
  // Nudge the total to the target: add to the colour whose waiters are biggest,
  // take from the colour whose waiters are smallest.
  for (let guard = 0; guard < 64; guard += 1) {
    const total = parts.reduce((a, b) => a + b, 0);
    if (total === target) break;
    const colors = counts.map((_, color) => color);
    if (total < target) {
      const open = colors.filter((c) => parts[c]! < cap(c));
      if (!open.length) break;
      open.sort((a, b) => counts[b]! / parts[b]! - counts[a]! / parts[a]!);
      parts[open[0]!]! += 1;
    } else {
      const spare = colors.filter((c) => parts[c]! > floor(c));
      if (!spare.length) break;
      spare.sort((a, b) => counts[a]! / parts[a]! - counts[b]! / parts[b]!);
      parts[spare[0]!]! -= 1;
    }
  }
  const all: BeltWaiter[] = [];
  counts.forEach((count, color) => {
    const n = parts[color]!;
    const weights = Array.from({ length: n }, () => tier.evenness + rand() * rand());
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const spare = count - tier.minWaiter * n;
    const sizes = weights.map((w) => tier.minWaiter + Math.floor((spare * w) / weightSum));
    let left = count - sizes.reduce((a, b) => a + b, 0);
    for (let i = 0; left > 0; i = (i + 1) % n, left -= 1) sizes[i]! += 1;
    sizes.forEach((size, i) =>
      all.push({ id: `${color}-${i}`, color: color as BeltColor, count: size }),
    );
  });
  for (let i = all.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all;
}

/** Colour 0 of every plate: the cream rim, a colour of cubes like any other. */
export const BELT_RIM_HEX = "#F6F0E4";
/**
 * Seeded round plate. Colour 0 is the cream rim ring; colours 1.. are the
 * dish's food colours (taken from its real ingredients, topped up from the
 * palette when two ingredients share a hue), laid out as big organic regions.
 * The rim has to be cleared before the food under it, which is what makes the
 * order of the waiters matter. The grey shade under the plate is only art.
 */
export function makeBeltBoard(
  tier: BeltTier,
  ingredients: readonly BeltIngredient[],
  seed: number,
): BeltBoard {
  if (ingredients.length === 0) throw new Error("Plating Belt needs a real recipe ingredient");
  const rand = makeSeededRand(seed);
  const foodCount = tier.colors - 1;
  const foodHues: number[] = [];
  for (const item of ingredients)
    if (!foodHues.includes(item.color) && foodHues.length < foodCount) foodHues.push(item.color);
  for (let hue = 0; foodHues.length < foodCount && hue < BELT_PALETTE.length; hue += 1)
    if (!foodHues.includes(hue)) foodHues.push(hue);
  const colorHexes = [BELT_RIM_HEX, ...foodHues.map((hue) => BELT_PALETTE[hue]!.hex)];
  const size = tier.size;
  const cells = Array<number>(size * size).fill(EMPTY);
  const center = (size - 1) / 2;
  const radius = size / 2 - 0.5;
  // Two blobs' worth of seeds per colour, scattered round the middle, so each
  // food colour is a few big regions and some are buried under others.
  const seeds = Array.from({ length: tier.colors * tier.patches }, (_, i) => ({
    x: center + (rand() - 0.5) * radius * 1.3,
    y: center + (rand() - 0.5) * radius * 1.3,
    color: 1 + (i % foodCount),
  }));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dist = Math.sqrt((x - center) * (x - center) + (y - center) * (y - center));
      if (dist > radius) continue;
      if (dist > radius - tier.rim) {
        cells[y * size + x] = 0;
        continue;
      }
      let best = Infinity;
      let color = 1;
      for (const point of seeds) {
        const d =
          Math.sqrt((x - point.x) * (x - point.x) + (y - point.y) * (y - point.y)) + rand() * 1.5;
        if (d < best) {
          best = d;
          color = point.color;
        }
      }
      cells[y * size + x] = color;
    }
  }
  // A seed can be swallowed by its neighbours; every colour keeps at least four cubes.
  const counts = Array<number>(tier.colors).fill(0);
  for (const cell of cells) if (cell >= 0) counts[cell]! += 1;
  for (let color = 1; color < tier.colors; color += 1) {
    while (counts[color]! < MIN_WAITER_CUBES) {
      const donor = counts.indexOf(Math.max(...counts.slice(1)), 1);
      const idx = cells.findIndex((cell) => cell === donor);
      if (idx < 0 || counts[donor]! <= MIN_WAITER_CUBES) throw new Error("Belt plate too small");
      cells[idx] = color;
      counts[donor]! -= 1;
      counts[color]! += 1;
    }
  }
  return { size, cells, colors: tier.colors, colorHexes };
}

export function makeBeltRound(
  tier: BeltTier,
  ingredients: readonly BeltIngredient[],
  seed: number,
): BeltState {
  const rand = makeSeededRand(seed ^ 0x5eedb317);
  const board = makeBeltBoard(tier, ingredients, seed);
  const waiters = splitWaiters(board, tier, rand);
  const lanes = Array.from({ length: tier.lanes }, () => [] as BeltWaiter[]);
  waiters.forEach((waiter, i) => lanes[i % lanes.length]!.push(waiter));
  return { board, lanes, tables: Array<BeltWaiter | null>(TABLES).fill(null), peakTables: 0 };
}

function beltPath(size: number): Array<[number, number, number, number]> {
  const perimeter: Array<[number, number, number, number]> = [];
  // Corners are visited once for each adjoining side, matching 4 × size.
  for (let x = size - 1; x >= 0; x -= 1) perimeter.push([x, size - 1, 0, -1]);
  for (let y = size - 1; y >= 0; y -= 1) perimeter.push([0, y, 1, 0]);
  for (let x = 0; x < size; x += 1) perimeter.push([x, 0, 0, 1]);
  for (let y = 0; y < size; y += 1) perimeter.push([size - 1, y, -1, 0]);
  const middle = Math.floor(size / 2);
  const start = perimeter.findIndex(([x, y]) => x === middle && y === size - 1);
  return [...perimeter.slice(start), ...perimeter.slice(0, start)];
}

/** Apply exactly one perimeter lap, looking inward through removed cells. */
export function collectLap(
  board: BeltBoard,
  waiter: BeltWaiter,
): { board: BeltBoard; waiter: BeltWaiter; collected: number } {
  const cells = [...board.cells];
  let remaining = waiter.count;
  let collected = 0;
  for (const [edgeX, edgeY, dx, dy] of beltPath(board.size)) {
    if (remaining <= 0) break;
    let x = edgeX;
    let y = edgeY;
    while (x >= 0 && y >= 0 && x < board.size && y < board.size) {
      const index = y * board.size + x;
      const found = cells[index]!;
      if (found !== EMPTY) {
        if (found === waiter.color) {
          cells[index] = EMPTY;
          remaining -= 1;
          collected += 1;
        }
        break;
      }
      x += dx;
      y += dy;
    }
  }
  return { board: { ...board, cells }, waiter: { ...waiter, count: remaining }, collected };
}

export function moveBeltWaiter(state: BeltState, move: BeltMove): BeltMoveResult {
  const fromLane = move.kind === "lane";
  const lane = fromLane ? state.lanes[move.lane] : undefined;
  const tableWaiter = move.kind === "table" ? state.tables[move.table] : undefined;
  const waiter = fromLane ? lane?.[0] : tableWaiter;
  if (!waiter) return { ok: false, reason: "empty-lane" };
  const result = collectLap(state.board, waiter);
  const completed = result.waiter.count === 0;
  if (!fromLane && result.collected === 0) return { ok: false, reason: "nothing-to-collect" };
  const freeTable = state.tables.findIndex((entry) => entry === null);
  if (fromLane && !completed && freeTable < 0) return { ok: false, reason: "table-full" };
  const lanes = state.lanes.map((entry) => [...entry]);
  const tables = [...state.tables];
  if (fromLane) lanes[move.lane]!.shift();
  else tables[move.table] = null;
  if (!completed) tables[fromLane ? freeTable : move.table] = result.waiter;
  const peakTables = Math.max(state.peakTables, tables.filter(Boolean).length);
  return {
    ok: true,
    collected: result.collected,
    waiter,
    state: { board: result.board, lanes, tables, peakTables },
  };
}

export function legalBeltMoves(state: BeltState): BeltMove[] {
  const moves: BeltMove[] = [];
  state.lanes.forEach((lane, i) => {
    if (lane.length && moveBeltWaiter(state, { kind: "lane", lane: i }).ok)
      moves.push({ kind: "lane", lane: i });
  });
  state.tables.forEach((waiter, i) => {
    if (waiter && moveBeltWaiter(state, { kind: "table", table: i }).ok)
      moves.push({ kind: "table", table: i });
  });
  return moves;
}

/**
 * A move worth suggesting after a pause in play: one that collects cubes, the
 * ones that send a waiter home first, then the biggest haul. Never an idle tap.
 */
export function hintBeltMove(state: BeltState): BeltMove | null {
  let best: { move: BeltMove; home: number; collected: number } | null = null;
  for (const move of legalBeltMoves(state)) {
    const result = moveBeltWaiter(state, move);
    if (!result.ok || result.collected === 0) continue;
    const home = Number(
      (move.kind === "lane" ? state.lanes[move.lane]![0]! : state.tables[move.table]!).count ===
        result.collected,
    );
    if (!best || home > best.home || (home === best.home && result.collected > best.collected))
      best = { move, home, collected: result.collected };
  }
  return best?.move ?? null;
}

/** Plain colour name for screen readers (the cubes are told apart by colour). */
export function beltColorName(hex: string): string {
  if (hex === BELT_RIM_HEX) return "cream";
  return BELT_PALETTE.find((entry) => entry.hex === hex)?.name ?? "colour";
}

/**
 * What is wrong with a plate's deck, or null when it follows the plan: the cubes of every colour are
 * shared out exactly between its waiters, 2 to 5 waiters a colour, none under the tier's minimum, and
 * the total is inside the tier's range. The seed builder only ships plates that pass.
 */
export function beltDeckProblem(state: BeltState, tier: BeltTier): string | null {
  const waiters = state.lanes.flat();
  if (waiters.length < tier.waiterCount[0] || waiters.length > tier.waiterCount[1])
    return `${waiters.length} waiters, the tier wants ${tier.waiterCount.join("-")}`;
  for (let color = 0; color < state.board.colors; color += 1) {
    const mine = waiters.filter((waiter) => waiter.color === color);
    const cubes = boardCount(state.board, color);
    if (mine.length < 2 || mine.length > MAX_WAITERS_PER_COLOR)
      return `colour ${color} has ${mine.length} waiters`;
    if (mine.reduce((sum, waiter) => sum + waiter.count, 0) !== cubes)
      return `colour ${color}: waiters do not add up to its ${cubes} cubes`;
    if (mine.some((waiter) => waiter.count < tier.minWaiter))
      return `colour ${color} has a waiter under ${tier.minWaiter} cubes`;
  }
  return null;
}

export function beltWon(state: BeltState): boolean {
  return state.board.cells.every((cell) => cell === EMPTY);
}
export function beltTrapped(state: BeltState): boolean {
  return !beltWon(state) && legalBeltMoves(state).length === 0;
}

export function starsForPeakTables(peakTables: number, usedUndo = false): number {
  const stars = peakTables <= 2 ? 3 : peakTables <= 4 ? 2 : 1;
  return usedUndo ? Math.max(1, stars - 1) : stars;
}

export function solveBeltRound(initial: BeltState, nodeCap = 30_000): boolean {
  const seen = new Set<string>();
  let visits = 0;
  const visit = (state: BeltState): boolean => {
    if (beltWon(state)) return true;
    if (++visits > nodeCap) return false;
    const key = `${state.board.cells.join(",")}|${state.lanes.map((l) => l.map((w) => `${w.color}:${w.count}`).join(";")).join("/")}|${state.tables.map((w) => (w ? `${w.color}:${w.count}` : "-")).join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    for (const move of legalBeltMoves(state)) {
      const next = moveBeltWaiter(state, move);
      if (next.ok && visit(next.state)) return true;
    }
    return false;
  };
  return visit(initial);
}
