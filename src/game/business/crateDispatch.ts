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

export const CRATE_FIRST_LEVEL = 18;
/**
 * The colour keys of the crates and their doors. (The names are the game's first, when a colour WAS one ingredient. Since 2026-11-18 a board
 * gives each key it uses ONE food, so a key is again one ingredient's door: see `CRATE_FOODS`.)
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
/** The colour of a zone's crates and door. */
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

/**
 * THE VAN. A crate carries ONE food and goes out of the ONE door that shows that same food (developer 2026-11-18: "if there is mushrooms let
 * mushrooms only pass out through the mushroom door, if there is a spinach crate only through the spinach door: unique for each and every
 * ingredient"). Before this, a door was a colour shared by three foods (green: lettuce, basil, parsley; teal: broccoli, corn, mushroom), so a
 * basil crate left by the lettuce door and a mushroom crate by the broccoli door.
 *
 * How it works: the match key stays a colour key (the solver, the builder and the drag code compare keys), but a board gives every key it
 * uses exactly ONE food (`CrateBoard.foods`), so each food has its own door and its own crates, and no two foods on a board share a key.
 * The foods that share a colour here (`CRATE_FOODS`) never appear on one board together; which of them a board uses comes from the level and
 * the seed (`foodsFor`, no dice), so the player meets all 24 foods over the levels. Foods are grouped by their real colour (a mushroom is brown).
 */
export const CRATE_FOODS: Record<
  CrateIngredient,
  { colour: string; items: readonly [string, string, string] }
> = {
  tomato: { colour: "red", items: ["tomato", "chilli", "paprika"] },
  carrot: { colour: "orange", items: ["carrot", "mango", "turmeric"] },
  lettuce: { colour: "green", items: ["lettuce", "basil", "parsley"] },
  broccoli: { colour: "teal", items: ["broccoli", "avocado", "olive-oil"] },
  onion: { colour: "purple", items: ["onion", "garlic", "ginger"] },
  cheddar: { colour: "yellow", items: ["cheddar", "corn", "lemon"] },
  salmon: { colour: "blue", items: ["salmon", "yogurt", "milk"] },
  mushroom: { colour: "brown", items: ["mushroom", "potato", "cumin"] },
};
/** The name a food is called on screen. */
export const CRATE_ITEM_NAMES: Record<string, string> = {
  tomato: "Tomatoes",
  avocado: "Avocados",
  mango: "Mangoes",
  carrot: "Carrots",
  potato: "Potatoes",
  ginger: "Ginger",
  lettuce: "Lettuce",
  basil: "Basil",
  parsley: "Parsley",
  broccoli: "Broccoli",
  corn: "Sweetcorn",
  mushroom: "Mushrooms",
  onion: "Onions",
  garlic: "Garlic",
  chilli: "Chillies",
  "olive-oil": "Olive oil",
  lemon: "Lemons",
  milk: "Milk",
  salmon: "Salmon",
  cheddar: "Cheddar",
  yogurt: "Yogurt",
  paprika: "Paprika",
  cumin: "Cumin",
  turmeric: "Turmeric",
};
/** The foods of a board: one per colour key, the same for a level and a seed. */
export function foodsFor(level: number, seed: number): Record<CrateIngredient, string> {
  const rand = rngFor(seed * 131 + level * 17 + 9);
  const out = {} as Record<CrateIngredient, string>;
  for (const key of CRATE_INGREDIENTS) out[key] = CRATE_FOODS[key].items[Math.floor(rand() * 3)]!;
  return out;
}
/** The food of a crate or a door of this colour key on this board (a hand-made board without foods reads the first of the colour). */
export function foodOf(board: Pick<CrateBoard, "foods">, key: CrateIngredient): string {
  return board.foods?.[key] ?? CRATE_FOODS[key].items[0];
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
  /** The one food of every colour key this board uses (see `foodsFor`); a door and its crates show the same food. */
  foods?: Record<CrateIngredient, string>;
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

export const CRATE_TIERS: readonly DispatchTier[] = [
  {
    from: 18,
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
    from: 28,
    cols: 6,
    rows: 6,
    bricks: [8, 9],
    colors: 4,
    wallCells: [3, 5],
    sizes: S123,
    span: 3,
    minWaves: 4,
    maxFree: 3,
  },
  {
    from: 45,
    cols: 7,
    rows: 7,
    bricks: [9, 10],
    colors: 5,
    wallCells: [4, 6],
    sizes: S1234,
    span: 3,
    minWaves: 5,
    maxFree: 3,
  },
  {
    from: 65,
    cols: 7,
    rows: 7,
    bricks: [11, 12],
    colors: 6,
    wallCells: [5, 7],
    sizes: S1234,
    span: 3,
    minWaves: 6,
    maxFree: 2,
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
      for (let tries = 0; tries < 80 && found < 10; tries++) {
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
        const score = (before - after) * 3 + Math.min(steps, 6) * 0.5 + rand() * 0.8;
        if (!best || score > best.score) best = { brick, score };
      }
    }
    if (!best) break;
    board.bricks.push(best.brick);
  }
  return board.bricks.length >= tier.bricks[0] ? board : null;
}

/** A board that can be won, for a level and a seed. Same level and seed, same board. */
export function crateBoardFor(level: number, seed: number): CrateBoard {
  return crateBoardForTier(crateTierAt(level), level, seed);
}
/** The same, for an explicit tier (the ramped tier of a level; the QA also builds boards for hand-made tiers). */
export function crateBoardForTier(tier: DispatchTier, level: number, seed: number): CrateBoard {
  let fallback: CrateBoard | null = null;
  for (let attempt = 0; attempt < 240; attempt++) {
    const rand = rngFor(seed * 31 + attempt * 7919 + 17);
    const board = buildOnce(tier, rand);
    if (!board) continue;
    const sol = solveBoard(board);
    if (!sol.solvable) continue;
    fallback = board;
    if (sol.waves.length >= tier.minWaves && sol.free <= tier.maxFree)
      return { ...board, foods: foodsFor(level, seed) };
  }
  if (fallback) return { ...fallback, foods: foodsFor(level, seed) };
  // cannot happen with these tiers (the QA builds hundreds of boards); a tiny sure board keeps the screen alive
  return {
    cols: tier.cols,
    rows: tier.rows,
    walls: [],
    gates: [{ id: "g1", side: "right", at: 0, span: tier.span, color: "tomato" }],
    bricks: [{ id: "b1", x: 0, y: 0, w: 1, h: 2, color: "tomato" }],
    foods: foodsFor(level, seed),
  };
}

/* ---------- the round: the clock, the boosters, the moves ---------- */

/** Seconds on the clock for a board: a little time for every crate. */
export const crateSeconds = (crates: number) => 40 + crates * 9;
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
  const seconds = crateSeconds(board.bricks.length);
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
