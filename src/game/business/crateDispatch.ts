/**
 * "Unload the Van" (shown name; ids and files keep the first name, Kitchen Dispatch; developer 2026-11-17, preview), rebuilt the same day on the mechanism of the sliding-block "door" games
 * (Color Block Jam and its kind): ingredient crates of different sizes (1x2, 2x2, 2x3 ...) sit on a counter with a few dark
 * fixed blocks. The player DRAGS a crate freely in any direction; it cannot pass through another crate or a dark block. Each
 * ingredient has a GATE of its own in the wooden frame (the same food, in the same colour): push a crate against its own gate, with its width inside the
 * gate, and it leaves. Clear every crate before the clock runs out. Boosters: Freeze (the clock stops for a few seconds),
 * Rocket (one crate goes out at once), Hammer (smash one dark block), Undo (take back the last move).
 *
 * The board is built BACKWARDS so every board can be won (proved again by `scripts/crate-dispatch-qa.mts`): crates are put on
 * the counter last-to-leave first, and each new crate is kept only if it can reach its own gate past the crates already there.
 * So taking the crates in the reverse order of placement always works, and no move of the player can spoil it: every move
 * can be taken back, and a crate that has left only makes room.
 *
 * Pure and deterministic: the screen only draws it, reads the finger and counts the seconds. It never touches money, stock or
 * the save.
 */

import { rampBetween } from "./difficultyRamp";
import {
  FAMILY_COLORS,
  NO_WISHES,
  dressDoors,
  type CargoDoor,
  type CargoWishes,
} from "./crateCargo";

export const CRATE_FIRST_LEVEL = 18;
/**
 * The board's eight colour SLOTS: the builder, the solver and the drags match crates to doors by slot. What a slot LOOKS like (its item and its door colour) is the board's CARGO, laid on
 * afterwards (crateCargo.ts), so what is on the van can never change a board's shape. (The slot names are the game's first eight foods.)
 */
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
/** A slot's colour on a board with no cargo (a hand-made test board). */
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
/** The item of a slot's crates and door on this board (a hand-made board without cargo reads the slot's own food). */
export function foodOf(board: Pick<CrateBoard, "cargo">, key: CrateIngredient): string {
  return board.cargo?.[key]?.item ?? key;
}
/** The colour of a slot's crates and door on this board. */
export function doorColor(board: Pick<CrateBoard, "cargo">, key: CrateIngredient): string {
  const door = board.cargo?.[key];
  return door ? FAMILY_COLORS[door.family] : CRATE_COLORS[key];
}
/** Lays the van's cargo on a board: one item for every door. The shape is untouched. */
export function dressBoard(
  board: CrateBoard,
  wishes: CargoWishes,
  ctx: { level: number; seed: number; trip: number },
): CrateBoard {
  return {
    ...board,
    cargo: dressDoors(
      board.gates.map((g) => g.color),
      wishes,
      ctx,
    ),
  };
}

export type Side = "top" | "bottom" | "left" | "right";
/** A crate: `w` x `h` cells with its top-left cell at (`x`, `y`). */
export type Brick = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: CrateIngredient;
};
/** A dark block fixed to the counter: nothing moves it (the Hammer smashes it). */
export type Wall = { id: string; x: number; y: number; w: number; h: number };
/** A gate in the frame: `span` cells wide from cell `at` along its side, in an ingredient's colour. */
export type Gate = { id: string; side: Side; at: number; span: number; color: CrateIngredient };
export type CrateBoard = {
  cols: number;
  rows: number;
  bricks: Brick[];
  walls: Wall[];
  gates: Gate[];
  /** What every door (and its crates) carries: the van's cargo (crateCargo.ts). */
  cargo?: Partial<Record<CrateIngredient, CargoDoor>>;
  /** Crates that cannot leave until another crate is moved out of their way. */
  trapped?: number;
};

export type DispatchTier = {
  from: number;
  cols: number;
  rows: number;
  /** Crates on the counter, at least and at most. */
  bricks: readonly [number, number];
  /** Ingredients (so gates) on the counter. */
  colors: number;
  /** Cells covered by dark blocks. */
  wallCells: readonly [number, number];
  /** Crate sizes [w, h] that may appear. */
  sizes: readonly (readonly [number, number])[];
  /** A gate is this many cells wide: the widest crate that goes through it. */
  span: number;
  /** The board must need at least this many "waves": crates that can go now, then the ones they were holding up, and so on. */
  minWaves: number;
  /** At most this many crates can leave at the very start. */
  maxFree: number;
  /**
   * Crates that cannot leave until the player first moves another crate out of their way (developer 2026-11-27; plan UNLOAD-THE-VAN-CARGO-PLAN: before, every board could be won without ever
   * moving a crate aside, so the levels felt alike). 0 until Level 23, never 1: a crate waits only for crates that wait too (once all others had left, it could drag back the way it came and go), so
   * trapped crates come at least two at a time.
   */
  trapped?: number;
};

/* Crate sizes [w, h]; a size listed twice is dealt twice as often, so the small crates outnumber the big ones. */
const S12 = [
  [1, 2],
  [2, 1],
  [1, 2],
  [2, 1],
  [2, 2],
] as const;
const S123 = [...S12, [1, 3], [3, 1]] as const;
const S1234 = [...S123, [1, 2], [2, 1], [2, 3], [3, 2]] as const;

const S12345 = [...S1234, [3, 3]] as const;

/**
 * The board grows with the level (developer 2026-11-19: "gradually add more crates, more rows and columns; right now all levels feel the same"): 5 x 5 from Level
 * 18, 6 x 6 from 28, 7 x 7 from 46 and 8 x 8 from 66, and a new step of crates, dark blocks, doors or waves about every five levels (`crateTierAt` ramps the numbers
 * level by level between the steps; the last step is Level 91, so no stretch of levels stays flat). The grid never goes past 8 x 8: the frame is one square and a cell
 * is 36 px on a 390 px phone there. A board is never filled more than about two thirds, so a crate can always be moved.
 */
export const CRATE_TIERS: readonly DispatchTier[] = [
  {
    from: 18,
    trapped: 0,
    cols: 5,
    rows: 5,
    bricks: [5, 6],
    colors: 3,
    wallCells: [2, 3],
    sizes: S12,
    span: 2,
    minWaves: 3,
    maxFree: 4,
  },
  {
    from: 23,
    trapped: 2,
    cols: 5,
    rows: 5,
    bricks: [6, 7],
    colors: 3,
    wallCells: [3, 3],
    sizes: S12,
    span: 2,
    minWaves: 4,
    maxFree: 3,
  },
  {
    from: 28,
    trapped: 2,
    cols: 6,
    rows: 6,
    bricks: [7, 8],
    colors: 4,
    wallCells: [3, 4],
    sizes: S123,
    span: 3,
    minWaves: 4,
    maxFree: 3,
  },
  {
    from: 34,
    trapped: 2,
    cols: 6,
    rows: 6,
    bricks: [8, 9],
    colors: 4,
    wallCells: [4, 5],
    sizes: S123,
    span: 3,
    minWaves: 5,
    maxFree: 3,
  },
  {
    from: 40,
    trapped: 3,
    cols: 6,
    rows: 6,
    bricks: [9, 10],
    colors: 4,
    wallCells: [4, 5],
    sizes: S1234,
    span: 3,
    minWaves: 6,
    maxFree: 3,
  },
  {
    from: 46,
    trapped: 3,
    cols: 7,
    rows: 7,
    bricks: [10, 10],
    colors: 5,
    wallCells: [4, 6],
    sizes: S1234,
    span: 3,
    minWaves: 6,
    maxFree: 3,
  },
  {
    from: 52,
    trapped: 4,
    cols: 7,
    rows: 7,
    bricks: [11, 11],
    colors: 5,
    wallCells: [5, 7],
    sizes: S1234,
    span: 3,
    minWaves: 7,
    maxFree: 3,
  },
  {
    from: 58,
    trapped: 4,
    cols: 7,
    rows: 7,
    bricks: [12, 12],
    colors: 6,
    wallCells: [6, 7],
    sizes: S1234,
    span: 3,
    minWaves: 8,
    maxFree: 3,
  },
  {
    from: 66,
    trapped: 5,
    cols: 8,
    rows: 8,
    bricks: [12, 12],
    colors: 6,
    wallCells: [6, 8],
    sizes: S12345,
    span: 3,
    minWaves: 8,
    maxFree: 3,
  },
  {
    from: 72,
    trapped: 6,
    cols: 8,
    rows: 8,
    bricks: [13, 13],
    colors: 7,
    wallCells: [7, 9],
    sizes: S12345,
    span: 3,
    minWaves: 9,
    maxFree: 3,
  },
  {
    from: 78,
    trapped: 6,
    cols: 8,
    rows: 8,
    bricks: [14, 14],
    colors: 7,
    wallCells: [8, 10],
    sizes: S12345,
    span: 3,
    minWaves: 9,
    maxFree: 3,
  },
  {
    from: 84,
    trapped: 7,
    cols: 8,
    rows: 8,
    bricks: [15, 15],
    colors: 8,
    wallCells: [8, 10],
    sizes: S12345,
    span: 3,
    minWaves: 9,
    maxFree: 3,
  },
  {
    from: 91,
    trapped: 9,
    cols: 8,
    rows: 8,
    bricks: [15, 16],
    colors: 8,
    wallCells: [9, 10],
    sizes: S12345,
    span: 3,
    minWaves: 9,
    maxFree: 3,
  },
];

export function crateTierFor(level: number): DispatchTier {
  let tier = CRATE_TIERS[0]!;
  for (const next of CRATE_TIERS) if (level >= next.from) tier = next;
  return tier;
}
/** How many doors of this tier's width fit round the frame (one cell between two doors on a side): the most ingredients a grid can show. */
export const gateCapacity = (t: Pick<DispatchTier, "cols" | "rows" | "span">) =>
  2 * Math.floor((t.cols + 1) / (t.span + 1)) + 2 * Math.floor((t.rows + 1) / (t.span + 1));

/**
 * The tier a level plays, RAMPED (developer 2026-11-19: "make sure the levels of every mini-game match the rest of the game"; the rule is
 * `difficultyRamp.ts`): the number of crates, the dark blocks, the ingredients, the waves a board needs and how few crates are free at the start move
 * smoothly from one tier's values to the next tier's over the levels between them (Levels 18-27 used to be one flat 5-6 crate board). On a tier's first
 * level the numbers are exactly the tier's own and nothing gets easier as the level rises. The board's size, the crate shapes and the door width stay the
 * tier's own (they change the look of the board); the ingredients stop at what the grid has room for doors for (`gateCapacity`: the 6 x 6 board shows 4).
 * `crate-dispatch-qa` A9 builds boards for every level and checks them against the ramped numbers.
 */
export function crateTierAt(level: number): DispatchTier {
  const here = crateTierFor(level);
  const next = CRATE_TIERS[CRATE_TIERS.indexOf(here) + 1];
  if (!next) return here;
  const at = (pick: (t: DispatchTier) => number) =>
    rampBetween(level, here.from, next.from, pick(here), pick(next));
  return {
    ...here,
    bricks: [at((t) => t.bricks[0]), at((t) => t.bricks[1])],
    colors: Math.min(
      at((t) => t.colors),
      gateCapacity(here),
    ),
    wallCells: [at((t) => t.wallCells[0]), at((t) => t.wallCells[1])],
    minWaves: at((t) => t.minWaves),
    maxFree: at((t) => t.maxFree),
    // none until the first trapped level, then a steady climb
    trapped: level < CRATE_TIERS[1]!.from ? 0 : at((t) => t.trapped ?? 0),
  };
}
export const crateTierIndex = (level: number) => CRATE_TIERS.indexOf(crateTierFor(level)) + 1;

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
function shuffled<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/* ---------- the counter: what is free, what fits, what is touching a gate ---------- */

/** 1 where a cell is taken by a dark block or by a crate other than `ignoreId`. */
function takenGrid(board: CrateBoard, ignoreId: string | null): Uint8Array {
  const grid = new Uint8Array(board.cols * board.rows);
  for (const w of board.walls)
    for (let j = 0; j < w.h; j++)
      for (let i = 0; i < w.w; i++) grid[(w.y + j) * board.cols + w.x + i] = 1;
  for (const b of board.bricks) {
    if (b.id === ignoreId) continue;
    for (let j = 0; j < b.h; j++)
      for (let i = 0; i < b.w; i++) grid[(b.y + j) * board.cols + b.x + i] = 1;
  }
  return grid;
}
function fitsGrid(
  grid: Uint8Array,
  cols: number,
  rows: number,
  w: number,
  h: number,
  x: number,
  y: number,
): boolean {
  if (x < 0 || y < 0 || x + w > cols || y + h > rows) return false;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) if (grid[(y + j) * cols + x + i]) return false;
  return true;
}

/** Whether crate `id` would fit with its top-left cell at (x, y): on the counter, clear of the dark blocks and the other crates. */
export function brickFits(board: CrateBoard, id: string, x: number, y: number): boolean {
  const b = board.bricks.find((k) => k.id === id);
  return !!b && fitsGrid(takenGrid(board, id), board.cols, board.rows, b.w, b.h, x, y);
}

/** The gate of this colour a crate at (x, y) of w x h is pushed against, with its width inside the gate; else null. */
export function gateTouched(
  board: Pick<CrateBoard, "cols" | "rows" | "gates">,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Gate | null {
  for (const g of board.gates) {
    if (g.color !== color) continue;
    const alongStart = g.side === "left" || g.side === "right" ? y : x;
    const alongEnd = alongStart + (g.side === "left" || g.side === "right" ? h : w);
    if (alongStart < g.at || alongEnd > g.at + g.span) continue;
    if (g.side === "left" && x === 0) return g;
    if (g.side === "right" && x + w === board.cols) return g;
    if (g.side === "top" && y === 0) return g;
    if (g.side === "bottom" && y + h === board.rows) return g;
  }
  return null;
}

/**
 * Can this crate be dragged to its gate with everything else standing still? Returns the fewest one-cell moves, or -1.
 * (The player may also move other crates out of the way; this is the sure way, and the one the boards are built on.)
 */
export function exitSteps(board: CrateBoard, brick: Brick): number {
  const grid = takenGrid(board, brick.id);
  const { cols, rows } = board;
  const seen = new Uint8Array(cols * rows);
  const queue: number[] = [brick.x, brick.y, 0];
  seen[brick.y * cols + brick.x] = 1;
  for (let head = 0; head < queue.length; head += 3) {
    const x = queue[head]!;
    const y = queue[head + 1]!;
    const d = queue[head + 2]!;
    if (gateTouched(board, brick.color, x, y, brick.w, brick.h)) return d;
    for (const [sx, sy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + sx;
      const ny = y + sy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen[ny * cols + nx]) continue;
      if (!fitsGrid(grid, cols, rows, brick.w, brick.h, nx, ny)) continue;
      seen[ny * cols + nx] = 1;
      queue.push(nx, ny, d + 1);
    }
  }
  return -1;
}
export const canExit = (board: CrateBoard, brick: Brick) => exitSteps(board, brick) >= 0;

export type Solution = {
  solvable: boolean;
  /** Crate ids, wave by wave: every crate in a wave can leave once the earlier waves are gone. */
  waves: string[][];
  /** How many crates can leave at the very start. */
  free: number;
};

/**
 * The sure solution: take every crate that can reach its gate, then the ones that they were holding up, and so on. A crate
 * that leaves only makes room, so this order finds a way whenever one exists with the others standing still.
 */
export function solveBoard(board: CrateBoard): Solution {
  let cur: CrateBoard = board;
  const waves: string[][] = [];
  while (cur.bricks.length > 0) {
    const ready = cur.bricks.filter((b) => canExit(cur, b)).map((b) => b.id);
    if (ready.length === 0) return { solvable: false, waves, free: waves[0]?.length ?? 0 };
    waves.push(ready);
    cur = { ...cur, bricks: cur.bricks.filter((b) => !ready.includes(b.id)) };
  }
  return { solvable: true, waves, free: waves[0]?.length ?? 0 };
}

/* ---------- building a board backwards ---------- */

const SIDES: readonly Side[] = ["top", "bottom", "left", "right"];

function placeGates(
  tier: DispatchTier,
  colors: CrateIngredient[],
  rand: () => number,
): Gate[] | null {
  // every legal slot on every side, in a random order; take the first ones that do not touch each other
  const slots: Array<{ side: Side; at: number }> = [];
  for (const side of SIDES) {
    const length = side === "left" || side === "right" ? tier.rows : tier.cols;
    for (let at = 0; at + tier.span <= length; at++) slots.push({ side, at });
  }
  const gates: Gate[] = [];
  for (const slot of shuffled(slots, rand)) {
    if (gates.length === colors.length) break;
    // keep a cell between two gates on the same side
    if (
      gates.some(
        (g) =>
          g.side === slot.side && slot.at < g.at + g.span + 1 && g.at < slot.at + tier.span + 1,
      )
    )
      continue;
    gates.push({
      id: `g${gates.length + 1}`,
      side: slot.side,
      at: slot.at,
      span: tier.span,
      color: colors[gates.length]!,
    });
  }
  return gates.length === colors.length ? gates : null;
}

/** The row or column of cells right inside a gate: a dark block never sits there, so every gate can be reached. */
function mouthCells(tier: DispatchTier, gates: Gate[]): Set<number> {
  const out = new Set<number>();
  for (const g of gates)
    for (let k = g.at; k < g.at + g.span; k++) {
      const x = g.side === "left" ? 0 : g.side === "right" ? tier.cols - 1 : k;
      const y = g.side === "top" ? 0 : g.side === "bottom" ? tier.rows - 1 : k;
      out.add(y * tier.cols + x);
    }
  return out;
}

function placeWalls(tier: DispatchTier, gates: Gate[], rand: () => number): Wall[] {
  const mouth = mouthCells(tier, gates);
  const target =
    tier.wallCells[0] + Math.floor(rand() * (tier.wallCells[1] - tier.wallCells[0] + 1));
  const shapes: readonly (readonly [number, number])[] = [
    [1, 1],
    [1, 2],
    [2, 1],
    [1, 1],
    [2, 2],
  ];
  const walls: Wall[] = [];
  let cells = 0;
  for (let tries = 0; tries < 60 && cells < target; tries++) {
    const [w, h] = shapes[Math.floor(rand() * shapes.length)]!;
    if (cells + w * h > target + 1) continue;
    const x = Math.floor(rand() * (tier.cols - w + 1));
    const y = Math.floor(rand() * (tier.rows - h + 1));
    const probe: CrateBoard = { cols: tier.cols, rows: tier.rows, bricks: [], walls, gates: [] };
    if (!fitsGrid(takenGrid(probe, null), tier.cols, tier.rows, w, h, x, y)) continue;
    let onMouth = false;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) if (mouth.has((y + j) * tier.cols + x + i)) onMouth = true;
    if (onMouth) continue;
    walls.push({ id: `w${walls.length + 1}`, x, y, w, h });
    cells += w * h;
  }
  return walls;
}

function buildOnce(tier: DispatchTier, rand: () => number): CrateBoard | null {
  const colors = shuffled(CRATE_INGREDIENTS, rand).slice(0, tier.colors);
  const gates = placeGates(tier, colors, rand);
  if (!gates) return null;
  const count = tier.bricks[0] + Math.floor(rand() * (tier.bricks[1] - tier.bricks[0] + 1));
  const board: CrateBoard = {
    cols: tier.cols,
    rows: tier.rows,
    bricks: [],
    walls: placeWalls(tier, gates, rand),
    gates,
  };
  const deal = shuffled(
    Array.from({ length: count }, (_, i) => colors[i % colors.length]!),
    rand,
  );
  for (let n = 0; n < count; n++) {
    const before = board.bricks.filter((b) => canExit(board, b)).length;
    let best: { brick: Brick; score: number } | null = null;
    // the dealt colour first; when its gate cannot be reached any more, the next colour
    for (let c = 0; c < colors.length && !best; c++) {
      const color = c === 0 ? deal[n]! : colors[(colors.indexOf(deal[n]!) + c) % colors.length]!;
      let found = 0;
      for (let tries = 0; tries < 200 && found < 30; tries++) {
        const [w, h] = tier.sizes[Math.floor(rand() * tier.sizes.length)]!;
        const x = Math.floor(rand() * (tier.cols - w + 1));
        const y = Math.floor(rand() * (tier.rows - h + 1));
        if (!fitsGrid(takenGrid(board, null), tier.cols, tier.rows, w, h, x, y)) continue;
        const brick: Brick = { id: `b${n + 1}`, x, y, w, h, color };
        const steps = exitSteps(board, brick);
        // it must be able to leave past the crates already placed, and not already sit at its gate
        if (steps < 1) continue;
        found++;
        const withIt: CrateBoard = { ...board, bricks: [...board.bricks, brick] };
        const after = board.bricks.filter((b) => canExit(withIt, b)).length;
        // prefer a crate that holds up others (so the board needs thinking) and one that has a way to go
        const score = (before - after) * 5 + Math.min(steps, 6) * 0.5 + rand() * 0.8;
        if (!best || score > best.score) best = { brick, score };
      }
    }
    if (!best) break;
    board.bricks.push(best.brick);
  }
  return board.bricks.length >= tier.bricks[0] ? board : null;
}

/** How far a board is from its tier's numbers (0 = meets them). */
const missOf = (tier: DispatchTier, sol: Solution) =>
  Math.max(0, tier.minWaves - sol.waves.length) +
  Math.max(0, sol.free - tier.maxFree) +
  (sol.free < 1 ? 1 : 0);

/**
 * Every door has a crate (developer 2026-11-27: a door no crate matched looked as if something was missing; when a colour's crates would not fit, another colour's took their place). For each
 * unused door, a crate of a colour that has two or more is repainted for it: the layout stays, and the repaint is kept only where the board can still be won (the one nearest the tier's
 * numbers). Null if no crate can be repainted: the builder then tries another board.
 */
function fillEveryDoor(tier: DispatchTier, board: CrateBoard): CrateBoard | null {
  let current = board;
  for (const gate of board.gates) {
    if (current.bricks.some((b) => b.color === gate.color)) continue;
    let best: { board: CrateBoard; miss: number } | null = null;
    for (const brick of current.bricks) {
      if (current.bricks.filter((b) => b.color === brick.color).length < 2) continue;
      // never a crate that would already sit at its new door
      if (gateTouched(current, gate.color, brick.x, brick.y, brick.w, brick.h)) continue;
      const repainted: CrateBoard = {
        ...current,
        bricks: current.bricks.map((b) => (b.id === brick.id ? { ...b, color: gate.color } : b)),
      };
      const sol = solveBoard(repainted);
      if (!sol.solvable) continue;
      const miss = missOf(tier, sol);
      if (!best || miss < best.miss) best = { board: repainted, miss };
      if (miss === 0) break;
    }
    if (!best) return null;
    current = best.board;
  }
  return current;
}

/* ---------- trapping crates: shuffling a winnable board with ordinary drags ---------- */

/** The crates still waiting when every crate that can leave has left, again and again: they need another crate moved out of their way first. */
export function trappedCount(board: CrateBoard): number {
  const sol = solveBoard(board);
  return sol.solvable ? 0 : board.bricks.length - sol.waves.reduce((n, w) => n + w.length, 0);
}

export type Cell = readonly [number, number];
/**
 * The cells a crate can be dragged to, one cell at a time, without ever touching its own door, each with the way there (a map from a cell to the cell before it). `toGate` instead stops at
 * the first cell that does touch the door.
 */
function reachOf(board: CrateBoard, brick: Brick, toGate: boolean) {
  const grid = takenGrid(board, brick.id);
  const { cols, rows } = board;
  const from = new Int16Array(cols * rows).fill(-1);
  const start = brick.y * cols + brick.x;
  from[start] = start;
  const queue = [start];
  const cells: number[] = [];
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    const x = c % cols;
    const y = (c / cols) | 0;
    for (const [sx, sy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + sx;
      const ny = y + sy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || from[ny * cols + nx] !== -1) continue;
      if (!fitsGrid(grid, cols, rows, brick.w, brick.h, nx, ny)) continue;
      const gate = gateTouched(board, brick.color, nx, ny, brick.w, brick.h);
      if (gate && !toGate) continue;
      from[ny * cols + nx] = c;
      if (gate) return { from, cells: [ny * cols + nx] };
      queue.push(ny * cols + nx);
      cells.push(ny * cols + nx);
    }
  }
  return { from, cells: toGate ? [] : cells };
}
function wayTo(board: CrateBoard, from: Int16Array, cell: number): Cell[] {
  const way: Cell[] = [];
  for (let c = cell; ; c = from[c]!) {
    way.push([c % board.cols, (c / board.cols) | 0]);
    if (from[c] === c) break;
  }
  return way.reverse();
}
/** The way (cell by cell, from where it stands) that sends a crate out of its door with everything else still, or null. */
export function pathToGate(board: CrateBoard, brick: Brick): Cell[] | null {
  const { from, cells } = reachOf(board, brick, true);
  return cells.length ? wayTo(board, from, cells[0]!) : null;
}

/** One shuffle of the builder: crate `id` dragged along `way` (its first cell is where it stood). Dragged back, it undoes the shuffle. */
export type ShuffleMove = { id: string; way: Cell[] };

/**
 * Shuffles a winnable board until `target` crates are trapped (and 1 to `maxFree` can leave at the start). Every shuffle is an ordinary drag that never reaches the crate's own door, so
 * dragging them all back, last first, gives the winnable board again: the shuffled board can always be won. Of 24 random drags it keeps the one nearest the target.
 */
function trapCrates(board: CrateBoard, target: number, maxFree: number, rand: () => number) {
  let current = board;
  const moves: ShuffleMove[] = [];
  const scoreOf = (b: CrateBoard) => {
    const sol = solveBoard(b);
    const trapped = sol.solvable
      ? 0
      : b.bricks.length - sol.waves.reduce((n, w) => n + w.length, 0);
    const free = sol.waves[0]?.length ?? 0;
    return {
      trapped,
      free,
      // nearer the target is better; more than the target counts against; too many (or no) free crates count against
      score:
        (trapped <= target ? trapped : 2 * target - trapped) * 10 -
        Math.max(0, free - maxFree) * 4 -
        (free < 1 ? 15 : 0),
    };
  };
  let now = scoreOf(current);
  const done = () => now.trapped === target && now.free >= 1 && now.free <= maxFree;
  for (let step = 0; step < 48 && !done(); step++) {
    let best: {
      board: CrateBoard;
      move: ShuffleMove;
      value: ReturnType<typeof scoreOf>;
      pick: number;
    } | null = null;
    for (let tries = 0; tries < 24; tries++) {
      const brick = current.bricks[Math.floor(rand() * current.bricks.length)]!;
      const { from, cells } = reachOf(current, brick, false);
      if (!cells.length) continue;
      const cell = cells[Math.floor(rand() * cells.length)]!;
      const x = cell % current.cols;
      const y = (cell / current.cols) | 0;
      const next = {
        ...current,
        bricks: current.bricks.map((b) => (b.id === brick.id ? { ...b, x, y } : b)),
      };
      const value = scoreOf(next);
      const pick = value.score + rand();
      if (!best || pick > best.pick)
        best = {
          board: next,
          move: { id: brick.id, way: wayTo(current, from, cell) },
          value,
          pick,
        };
      if (value.trapped === target && value.free >= 1 && value.free <= maxFree) {
        best = {
          board: next,
          move: { id: brick.id, way: wayTo(current, from, cell) },
          value,
          pick: Infinity,
        };
        break;
      }
    }
    if (!best || best.value.score < now.score) continue;
    current = best.board;
    moves.push(best.move);
    now = best.value;
  }
  const off =
    Math.abs(now.trapped - target) + Math.max(0, now.free - maxFree) + (now.free < 1 ? 3 : 0);
  return { board: { ...current, trapped: now.trapped }, moves, off };
}

/** A level's board with the proof that it can be won: drag the `moves` back, last first, to get `base`, then send its crates out in `solveBoard(base)`'s order. */
export type BoardProof = { board: CrateBoard; base: CrateBoard; moves: ShuffleMove[] };

/** A board that can be won, for a level and a seed. Same level and seed, same board. */
export function crateBoardFor(level: number, seed: number): CrateBoard {
  return crateBoardForTier(crateTierAt(level), level, seed);
}
/** The same, for an explicit tier (the ramped tier of a level; the QA also builds boards for hand-made tiers). */
export function crateBoardForTier(tier: DispatchTier, level: number, seed: number): CrateBoard {
  return crateProofForTier(tier, level, seed).board;
}
/** A level's board and the proof it can be won (crate-dispatch-qa replays it with the real drags). */
export function crateProofFor(level: number, seed: number): BoardProof {
  return crateProofForTier(crateTierAt(level), level, seed);
}
function crateProofForTier(tier: DispatchTier, level: number, seed: number): BoardProof {
  const target = tier.trapped ?? 0;
  const dress = (p: BoardProof): BoardProof => ({
    ...p,
    board: dressBoard(p.board, NO_WISHES, { level, seed, trip: 0 }),
  });
  let fallback: (BoardProof & { off: number }) | null = null;
  // a bigger, fuller grid is harder to build to the tier's numbers, so it gets more tries (about 1 board in 60 needs more than 240 on 8 x 8)
  const attempts = tier.cols >= 8 ? 600 : tier.cols >= 7 ? 400 : 240;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rand = rngFor(seed * 31 + attempt * 7919 + 17);
    const built = buildOnce(tier, rand);
    const base = built && fillEveryDoor(tier, built);
    if (!base) continue;
    const sol = solveBoard(base);
    if (!sol.solvable) continue;
    // how far this board is from the tier's numbers (0 = meets them); the closest one is kept if none meets them
    const miss = missOf(tier, sol);
    if (miss > 0 && fallback && miss * 100 >= fallback.off) continue;
    const trap =
      target > 0
        ? trapCrates(base, target, tier.maxFree, rand)
        : { board: { ...base, trapped: 0 }, moves: [], off: 0 };
    const off = miss * 100 + trap.off;
    if (off === 0) return dress({ board: trap.board, base, moves: trap.moves });
    if (!fallback || off < fallback.off)
      fallback = { board: trap.board, base, moves: trap.moves, off };
  }
  if (fallback) return dress(fallback);
  // cannot happen with these tiers (the QA builds hundreds of boards); a tiny sure board keeps the screen alive
  const tiny: CrateBoard = {
    cols: tier.cols,
    rows: tier.rows,
    walls: [],
    gates: [{ id: "g1", side: "right", at: 0, span: tier.span, color: "tomato" }],
    bricks: [{ id: "b1", x: 0, y: 0, w: 1, h: 2, color: "tomato" }],
    trapped: 0,
  };
  return dress({ board: tiny, base: tiny, moves: [] });
}

/* ---------- the round: the clock, the boosters, the moves ---------- */

/** Seconds on the clock for a board: a little time for every crate, and more for every trapped one (it needs a move of another crate first). */
export const crateSeconds = (crates: number, trapped = 0) => 40 + crates * 9 + trapped * 6;
export const FREEZE_SECONDS = 10;
export const START_BOOSTERS = { freeze: 2, rocket: 2, hammer: 2, undo: 3 } as const;

/** What Undo takes back: the last drag, or the last crate that left. (A smashed block stays smashed.) */
export type Action =
  { kind: "move"; id: string; fromX: number; fromY: number } | { kind: "out"; brick: Brick };

export type CrateRound = {
  board: CrateBoard;
  history: Action[];
  seconds: number;
  total: number;
  freezes: number;
  rockets: number;
  hammers: number;
  undos: number;
  /** Drags that moved a crate (for the result). */
  moves: number;
};

export function startRound(level: number, seed: number): CrateRound {
  const board = crateBoardFor(level, seed);
  const seconds = crateSeconds(board.bricks.length, board.trapped ?? 0);
  return {
    board,
    history: [],
    seconds,
    total: board.bricks.length,
    freezes: START_BOOSTERS.freeze,
    rockets: START_BOOSTERS.rocket,
    hammers: START_BOOSTERS.hammer,
    undos: START_BOOSTERS.undo,
    moves: 0,
  };
}

export const roundCleared = (round: CrateRound) => round.board.bricks.length === 0;
export const cratesLeft = (round: CrateRound) => round.board.bricks.length;

/** The crate under a cell, or null. */
export function brickAtCell(board: CrateBoard, cx: number, cy: number): Brick | null {
  return (
    board.bricks.find((b) => cx >= b.x && cx < b.x + b.w && cy >= b.y && cy < b.y + b.h) ?? null
  );
}
export function wallAtCell(board: CrateBoard, cx: number, cy: number): Wall | null {
  return (
    board.walls.find((w) => cx >= w.x && cx < w.x + w.w && cy >= w.y && cy < w.y + w.h) ?? null
  );
}

export type DragResult = {
  round: CrateRound;
  /** Whether the crate changed cell. */
  moved: boolean;
  /** The gate it left through, else null; then `brick` is where it was when it left. */
  out: Gate | null;
  brick: Brick | null;
};

/**
 * Drags a crate toward the cell (`tx`, `ty`) its top-left corner is wanted at, one cell at a time, stopping at whatever is in
 * the way (it slides along a wall when it can). The moment it is pushed against its own gate it leaves. No history is written:
 * the screen calls `finishDrag` when the finger lifts, so a whole drag is one Undo.
 */
export function dragBrick(round: CrateRound, id: string, tx: number, ty: number): DragResult {
  const board = round.board;
  const start = board.bricks.find((b) => b.id === id);
  if (!start) return { round, moved: false, out: null, brick: null };
  const grid = takenGrid(board, id);
  let { x, y } = start;
  let gate: Gate | null = null;
  for (let guard = 0; guard < 80 && !gate; guard++) {
    if (x === tx && y === ty) break;
    const dx = Math.sign(tx - x);
    const dy = Math.sign(ty - y);
    const xFirst = Math.abs(tx - x) >= Math.abs(ty - y);
    const tries: Array<readonly [number, number]> = xFirst
      ? [
          [dx, 0],
          [0, dy],
        ]
      : [
          [0, dy],
          [dx, 0],
        ];
    let moved = false;
    for (const [sx, sy] of tries) {
      if (
        (sx !== 0 || sy !== 0) &&
        fitsGrid(grid, board.cols, board.rows, start.w, start.h, x + sx, y + sy)
      ) {
        x += sx;
        y += sy;
        moved = true;
        break;
      }
    }
    if (!moved) break;
    gate = gateTouched(board, start.color, x, y, start.w, start.h);
  }
  const moved = x !== start.x || y !== start.y;
  if (!moved) return { round, moved: false, out: null, brick: null };
  const at: Brick = { ...start, x, y };
  if (gate) {
    return {
      round: { ...round, board: { ...board, bricks: board.bricks.filter((b) => b.id !== id) } },
      moved: true,
      out: gate,
      brick: at,
    };
  }
  return {
    round: {
      ...round,
      board: { ...board, bricks: board.bricks.map((b) => (b.id === id ? at : b)) },
    },
    moved: true,
    out: null,
    brick: at,
  };
}

/** Writes a finished drag into the history (one Undo for the whole drag). `from` is where the crate stood when the finger went down. */
export function finishDrag(
  round: CrateRound,
  from: Brick,
  result: { moved: boolean; out: boolean },
): CrateRound {
  if (!result.moved) return round;
  const action: Action = result.out
    ? { kind: "out", brick: from }
    : { kind: "move", id: from.id, fromX: from.x, fromY: from.y };
  return { ...round, history: [...round.history, action], moves: round.moves + 1 };
}

/** Undo takes back the last drag or the last crate that left. Costs one Undo. */
export function undoRound(round: CrateRound): CrateRound {
  const last = round.history[round.history.length - 1];
  if (!last || round.undos <= 0) return round;
  const board = round.board;
  if (last.kind === "move") {
    const b = board.bricks.find((x) => x.id === last.id);
    if (!b) return { ...round, history: round.history.slice(0, -1) };
    const grid = takenGrid(board, b.id);
    // That drag can no longer be taken back (another crate sits where it came from): it is dropped from the list and the one before it is tried, so an
    // Undo is never a dead button that blocks every older one (audit 2026-11-18). Only a take-back that works costs an Undo.
    if (!fitsGrid(grid, board.cols, board.rows, b.w, b.h, last.fromX, last.fromY))
      return undoRound({ ...round, history: round.history.slice(0, -1) });
    return {
      ...round,
      board: {
        ...board,
        bricks: board.bricks.map((x) =>
          x.id === b.id ? { ...x, x: last.fromX, y: last.fromY } : x,
        ),
      },
      history: round.history.slice(0, -1),
      undos: round.undos - 1,
    };
  }
  const b = last.brick;
  if (!fitsGrid(takenGrid(board, null), board.cols, board.rows, b.w, b.h, b.x, b.y))
    return undoRound({ ...round, history: round.history.slice(0, -1) });
  return {
    ...round,
    board: { ...board, bricks: [...board.bricks, b] },
    history: round.history.slice(0, -1),
    undos: round.undos - 1,
  };
}

/** Freeze: costs one. The screen holds the clock for `FREEZE_SECONDS`. */
export function freezeRound(round: CrateRound): CrateRound {
  return round.freezes > 0 ? { ...round, freezes: round.freezes - 1 } : round;
}

/** Rocket: the crate goes out at once, wherever it is. Costs one. Undo brings it back. */
export function rocketBrick(round: CrateRound, id: string): CrateRound {
  const b = round.board.bricks.find((x) => x.id === id);
  if (!b || round.rockets <= 0) return round;
  return {
    ...round,
    board: { ...round.board, bricks: round.board.bricks.filter((x) => x.id !== id) },
    history: [...round.history, { kind: "out", brick: b }],
    rockets: round.rockets - 1,
  };
}

/** Hammer: one dark block is smashed. Costs one. */
export function hammerWall(round: CrateRound, id: string): CrateRound {
  if (round.hammers <= 0 || !round.board.walls.some((w) => w.id === id)) return round;
  return {
    ...round,
    board: { ...round.board, walls: round.board.walls.filter((w) => w.id !== id) },
    hammers: round.hammers - 1,
  };
}

/** Three stars for a clear with a good part of the clock left, two for some, one otherwise. */
export const crateStars = (secondsLeft: number, seconds: number): 1 | 2 | 3 => {
  const share = seconds > 0 ? secondsLeft / seconds : 0;
  return share >= 0.45 ? 3 : share >= 0.2 ? 2 : 1;
};

/** The side a crate leaves by is the gate's side. */
export const gateSide = (g: Gate): Side => g.side;
