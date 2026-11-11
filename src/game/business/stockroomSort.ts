/**
 * STOCKROOM SORT — the rules of the "Stock the shelves" mini-game (developer 2026-11-06; plan: docs/planning/STOCKROOM-SORT-MINIGAME-PLAN-2026-11-06.md).
 *
 * When the player buys supplies in the Market, the delivery waits as SETS of three identical products. The player moves the goods between
 * the cubbies of a shelf (three slots each) until three of a kind stand together: those are "stocked" and pop away. Everything must be
 * stocked before a timer ends. Pure rules: no I/O, no unseeded randomness (a small seeded generator), and NEVER any money or stock: the game
 * reads which supplies were bought and changes no quantity, price, credit or ledger entry. Its only effects are the stars, a Hype top-up
 * (the Second Floor's Rush meter, `addHype`, the same table as Fridge Sort) and the shelf badges. It is always optional.
 *
 * State lives in `business.stockroomSort` (optional; absent = nothing waiting), read through `stockroomSortOf` which drops bad values.
 *
 * The board is dealt at random and then PROVEN solvable by a small search (`solve`); that search also gives the number of moves the
 * timer is built from, and the Hint button's next move.
 */
import { rampOf } from "./difficultyRamp";
import type { SaveData } from "../SaveManager";
import { STOCKROOM_FROM_LEVEL } from "../config/earlyLevels";
import { addHype } from "../restaurant/secondFloor";
import { getSupplyItem } from "./businessSupplies";
import { HYPE_BY_STARS, bigDeliveryHype } from "./fridgeSort";

// ── When it opens ────────────────────────────────────────────────────────────

/** The first supply purchase: the kitchen-tools shopping list is Level 10 (preServiceCheck.ts), the Market's supplies come with it. */
export const STOCKROOM_FIRST_LEVEL = STOCKROOM_FROM_LEVEL;

/** Dev test: `?stockroomSort` in the address shows the game below its level (the same pattern as `?fridgeSort`). */
export const STOCKROOM_TEST_UNLOCK: boolean =
  typeof location !== "undefined" && /[?&]stockroomSort\b/.test(location.search);

export const isStockroomOpen = (reachedLevel: number): boolean =>
  STOCKROOM_TEST_UNLOCK || reachedLevel >= STOCKROOM_FIRST_LEVEL;

// ── Difficulty by level (plan §4) ────────────────────────────────────────────

export type Tier = {
  /** From this level. */
  from: number;
  /** The most SETS one board holds (a longer delivery makes more boards). */
  maxSets: number;
  /** Empty cubbies on top of the ones the goods need. */
  spare: number;
  /** Cubbies with a hidden second row behind the front one (at most; a small board has fewer). */
  depth: number;
  /** Empty cubbies that start locked (they open after some sets are stocked). */
  locks: number;
  /** Pieces wrapped in paper (they show their product when picked). */
  mystery: number;
  /** Time multiplier (the player is learning in the first tiers). */
  timeFactor: number;
  /** When the Hint button is free. */
  hint: "always" | "after-miss" | "never";
};

export const TIERS: readonly Tier[] = [
  {
    from: STOCKROOM_FIRST_LEVEL,
    maxSets: 2,
    spare: 2,
    depth: 0,
    locks: 0,
    mystery: 0,
    timeFactor: 2.0,
    hint: "always",
  },
  {
    from: 19,
    maxSets: 4,
    spare: 2,
    depth: 0,
    locks: 0,
    mystery: 0,
    timeFactor: 1.6,
    hint: "always",
  },
  {
    from: 31,
    maxSets: 6,
    spare: 1,
    depth: 0,
    locks: 0,
    mystery: 0,
    timeFactor: 1.3,
    hint: "after-miss",
  },
  {
    from: 44,
    maxSets: 8,
    spare: 1,
    depth: 2,
    locks: 0,
    mystery: 0,
    timeFactor: 1.1,
    hint: "never",
  },
  {
    from: 74,
    maxSets: 8,
    spare: 1,
    depth: 2,
    locks: 1,
    mystery: 2,
    timeFactor: 1.0,
    hint: "never",
  },
];

export function tierAt(level: number): Tier {
  let t = TIERS[0]!;
  for (const x of TIERS) if (level >= x.from) t = x;
  // The board grows smoothly toward the next tier's size (difficultyRamp.ts); on a tier's first level it is exactly the tier's own.
  return { ...t, maxSets: rampOf(TIERS, level, (x) => x.maxSets) };
}

export const SLOTS = 3;
/** A board never has more cubbies than this (two to a row on a phone, five rows). */
export const MAX_CUBBIES = 10;

// ── State ────────────────────────────────────────────────────────────────────

export type CrateLine = { id: string; sets: number };

export type StockroomSortState = {
  /** What waits to be stocked: one line per supply, with its sets of three (the order bought). */
  crate?: CrateLine[];
  /** Raises each time a new delivery starts: the seed of its boards. */
  seed?: number;
  /** The best score. */
  best?: number;
  /** Stars won in all rewarded boards. */
  stars?: number;
  /** Rewarded boards finished with three stars (every 3 earn a badge). */
  perfect?: number;
  /** Rewarded boards finished. */
  rounds?: number;
  /** Boards of the CURRENT delivery already stocked with at least one star (0 = none; a 0-star board starts it over). */
  chain?: number;
};

export const MAX_CRATE_LINES = 30;
/** The most sets of ONE supply: a bulk line is 3 sets at most, so it cannot swamp the shelf. */
export const MAX_SETS_PER_LINE = 3;
export const MAX_BADGES = 12;
export const PERFECTS_PER_BADGE = 3;
const whole = (v: unknown, max = Number.MAX_SAFE_INTEGER) =>
  Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

/** Sets for a purchase of `packs`: 1-2 packs = 1 set, 3-5 = 2 sets, 6 or more = 3 sets. */
export const setsFor = (packs: number): number =>
  Math.min(MAX_SETS_PER_LINE, packs >= 6 ? 3 : packs >= 3 ? 2 : 1);

/** The saved state (absent on older saves = nothing waiting); unknown supplies, duplicates and bad numbers are dropped. */
export function stockroomSortOf(save: SaveData): StockroomSortState {
  const raw = save.business.stockroomSort;
  const seen = new Set<string>();
  const crate: CrateLine[] = [];
  for (const line of Array.isArray(raw?.crate) ? raw.crate : []) {
    const id = (line as CrateLine | undefined)?.id;
    if (typeof id !== "string" || !getSupplyItem(id) || seen.has(id)) continue;
    const sets = whole((line as CrateLine).sets, MAX_SETS_PER_LINE);
    if (sets <= 0) continue;
    seen.add(id);
    crate.push({ id, sets });
    if (crate.length >= MAX_CRATE_LINES) break;
  }
  return {
    ...(crate.length > 0 ? { crate } : {}),
    seed: whole(raw?.seed),
    best: whole(raw?.best),
    stars: whole(raw?.stars),
    perfect: whole(raw?.perfect),
    rounds: whole(raw?.rounds),
    ...(whole(raw?.chain, 50) > 0 ? { chain: whole(raw?.chain, 50) } : {}),
  };
}

function withState(save: SaveData, state: StockroomSortState): SaveData {
  return { ...save, business: { ...save.business, stockroomSort: state } };
}

/** How many shelf badges the player has earned (shown in Inventory → Supplies): purely a trophy. */
export const badgesOf = (save: SaveData): number =>
  Math.min(MAX_BADGES, Math.floor(stockroomSortOf(save).perfect! / PERFECTS_PER_BADGE));

// ── The crate ────────────────────────────────────────────────────────────────

/** Every set waiting (what the "Stock the shelves" chip counts). */
export const setsWaiting = (save: SaveData): number =>
  (stockroomSortOf(save).crate ?? []).reduce((n, l) => n + l.sets, 0);

/**
 * Puts what was just bought on the crate (the ONE place that fills it is the supply purchase commit). `lines` = what was bought and how many
 * packs. Only from the game's level; a supply already waiting gets more sets (up to the cap); nothing is lost if more than a board waits.
 */
export function addToSupplyCrate(
  save: SaveData,
  lines: ReadonlyArray<{ id: string; packs: number }>,
  reachedLevel: number,
): SaveData {
  if (!isStockroomOpen(reachedLevel)) return save;
  const state = stockroomSortOf(save);
  const crate = (state.crate ?? []).map((l) => ({ ...l }));
  const had = crate.length;
  let changed = false;
  for (const b of lines) {
    if (!getSupplyItem(b.id) || !(b.packs > 0)) continue;
    const add = setsFor(Math.floor(b.packs));
    const line = crate.find((l) => l.id === b.id);
    if (line) {
      const now = Math.min(MAX_SETS_PER_LINE, line.sets + add);
      if (now !== line.sets) {
        line.sets = now;
        changed = true;
      }
      continue;
    }
    if (crate.length >= MAX_CRATE_LINES) continue;
    crate.push({ id: b.id, sets: add });
    changed = true;
  }
  if (!changed) return save;
  // A new delivery (the old crate was empty) gets a new seed, so its boards are new and never repeat by accident.
  return withState(save, { ...state, crate, seed: had === 0 ? state.seed! + 1 : state.seed! });
}

/**
 * Goods that look alike at the size of a slot (the Codex art check, 2026-11-06): one board never holds two of the same group, or a player
 * could not tell the forks apart. The second one waits for the next board.
 */
export const LOOKALIKES: ReadonlyArray<readonly string[]> = [
  ["dinner-forks", "dessert-forks"],
  ["dinner-knives", "steak-knives"],
  ["teaspoons", "soup-spoons"],
  ["dinner-plates", "side-plates", "dessert-plates"],
  ["water-glasses", "highball-glasses"],
  ["stock-pot", "saute-pans"],
];
const GROUP_OF: ReadonlyMap<string, number> = new Map(
  LOOKALIKES.flatMap((g, i) => g.map((id) => [id, i] as const)),
);

/** One board's worth of sets: the crate's sets in the order bought, at most `max`, never two look-alikes; the first always goes in. */
export function packSets(
  crate: readonly CrateLine[],
  max: number,
): { take: string[]; rest: CrateLine[] } {
  const take: string[] = [];
  const used = new Set<number>();
  const rest: CrateLine[] = [];
  for (const line of crate) {
    let left = line.sets;
    const g = GROUP_OF.get(line.id);
    while (left > 0 && take.length < max) {
      // a second look-alike of a group already on the board waits (the same product twice is fine: it is just two sets)
      if (g !== undefined && used.has(g) && !take.some((t) => t === line.id)) break;
      take.push(line.id);
      if (g !== undefined) used.add(g);
      left--;
    }
    if (left > 0) rest.push({ id: line.id, sets: left });
  }
  return { take, rest };
}

/** How many boards the waiting crate makes at this level (0 = nothing waits, or the game is not open). */
export function boardsLeft(save: SaveData, reachedLevel: number): number {
  if (!isStockroomOpen(reachedLevel)) return 0;
  let rest: CrateLine[] = stockroomSortOf(save).crate ?? [];
  const max = tierAt(reachedLevel).maxSets;
  let n = 0;
  while (rest.length > 0) {
    const out = packSets(rest, max);
    if (out.take.length === 0) break;
    rest = out.rest;
    n++;
  }
  return n;
}

/** About how many boards `extraLines` more purchases would make with what already waits (the Market's hint). */
export function boardsFor(
  save: SaveData,
  reachedLevel: number,
  extraLines: ReadonlyArray<{ id: string; packs: number }>,
): number {
  if (!isStockroomOpen(reachedLevel)) return 0;
  const state = stockroomSortOf(save);
  const crate = (state.crate ?? []).map((l) => ({ ...l }));
  for (const b of extraLines) {
    if (!getSupplyItem(b.id) || !(b.packs > 0)) continue;
    const line = crate.find((l) => l.id === b.id);
    const add = setsFor(Math.floor(b.packs));
    if (line) line.sets = Math.min(MAX_SETS_PER_LINE, line.sets + add);
    else crate.push({ id: b.id, sets: add });
  }
  let rest: CrateLine[] = crate;
  const max = tierAt(reachedLevel).maxSets;
  let n = 0;
  while (rest.length > 0) {
    const out = packSets(rest, max);
    if (out.take.length === 0) break;
    rest = out.rest;
    n++;
  }
  return n;
}

// ── The board ────────────────────────────────────────────────────────────────

export type Piece = {
  /** The supply id (a picture in public/business/stockroom/goods/). */
  id: string;
  /** Tells two pieces of the same product apart (for the screen). */
  uid: number;
  /** Wrapped in paper until picked (Level 74+). The rules treat it as its product. */
  mystery?: boolean;
};

export type Cubby = {
  /** The three visible slots; null = free. */
  front: (Piece | null)[];
  /** A hidden second row: it slides to the front when the front row empties (Level 44+). */
  back: Piece[];
  /** Locked until this many sets are stocked (0 = never locked). */
  lockAt: number;
};

export type Board = { cubbies: Cubby[]; sets: number; stocked: number };

export type Move = { from: number; slot: number; to: number };

export const isLocked = (b: Board, c: number): boolean => b.cubbies[c]!.lockAt > b.stocked;
export const freeSlotOf = (b: Board, c: number): number =>
  isLocked(b, c) ? -1 : b.cubbies[c]!.front.indexOf(null);

const cloneBoard = (b: Board): Board => ({
  ...b,
  cubbies: b.cubbies.map((c) => ({ ...c, front: [...c.front], back: [...c.back] })),
});

const isTriple = (c: Cubby): boolean =>
  c.front.every((p) => p !== null) &&
  c.front[0]!.id === c.front[1]!.id &&
  c.front[1]!.id === c.front[2]!.id;

/** What one move did: the sets that popped (a chain is possible when a hidden row slides forward into a triple). */
export type MoveEvents = { stocked: { cubby: number; id: string }[]; slid: number[] };

/** Slides a hidden row forward in a cubby whose front is empty. Returns true if it did. */
function slide(c: Cubby): boolean {
  if (c.back.length === 0 || c.front.some((p) => p !== null)) return false;
  c.front = [...c.back, null, null, null].slice(0, SLOTS) as (Piece | null)[];
  c.back = [];
  return true;
}

/** The legal move `from` (cubby, slot) to cubby `to`, or null. Pure: it returns a new board. */
export function applyMove(board: Board, m: Move): { board: Board; events: MoveEvents } | null {
  const src = board.cubbies[m.from];
  const dst = board.cubbies[m.to];
  if (!src || !dst || m.from === m.to) return null;
  if (isLocked(board, m.from) || isLocked(board, m.to)) return null;
  const piece = src.front[m.slot];
  if (!piece) return null;
  const free = dst.front.indexOf(null);
  if (free < 0) return null;
  const next = cloneBoard(board);
  next.cubbies[m.from]!.front[m.slot] = null;
  next.cubbies[m.to]!.front[free] = piece;
  const events: MoveEvents = { stocked: [], slid: [] };
  // settle: pop triples, slide hidden rows forward, until nothing changes (a slide can make a new triple)
  for (let guard = 0; guard < 40; guard++) {
    let changed = false;
    next.cubbies.forEach((c, i) => {
      if (isTriple(c)) {
        events.stocked.push({ cubby: i, id: c.front[0]!.id });
        c.front = [null, null, null];
        next.stocked += 1;
        changed = true;
      }
      if (slide(c)) {
        events.slid.push(i);
        changed = true;
      }
    });
    if (!changed) break;
  }
  return { board: next, events };
}

/** Every piece still on the board (front and hidden). */
export const piecesLeft = (b: Board): number =>
  b.cubbies.reduce((n, c) => n + c.front.filter(Boolean).length + c.back.length, 0);

export const isCleared = (b: Board): boolean => b.stocked >= b.sets;

// ── The solver (proves a board is solvable, gives its length and the next hint) ──

const keyOf = (b: Board): string =>
  b.cubbies
    .map(
      (c) =>
        `${c.lockAt > b.stocked ? "L" + c.lockAt : ""}${c.front
          .filter(Boolean)
          .map((p) => p!.id)
          .sort()
          .join(",")}|${c.back.map((p) => p.id).join(",")}`,
    )
    .sort()
    .join("/");

/** A cheap guess of the moves still needed: every product wants its three pieces in one cubby. */
function guess(b: Board): number {
  const best = new Map<string, number>();
  const total = new Map<string, number>();
  for (const c of b.cubbies) {
    const here = new Map<string, number>();
    for (const p of c.front) if (p) here.set(p.id, (here.get(p.id) ?? 0) + 1);
    for (const [id, n] of here) best.set(id, Math.max(best.get(id) ?? 0, n));
    for (const p of c.front) if (p) total.set(p.id, (total.get(p.id) ?? 0) + 1);
    for (const p of c.back) total.set(p.id, (total.get(p.id) ?? 0) + 1);
  }
  let h = 0;
  for (const [id, n] of total) h += Math.max(0, Math.min(SLOTS, n) - (best.get(id) ?? 0));
  return h;
}

/** Legal moves from a board, without the pointless ones (a lone piece into an empty cubby; two empty targets are one move). */
export function legalMoves(b: Board): Move[] {
  const out: Move[] = [];
  b.cubbies.forEach((src, from) => {
    if (isLocked(b, from)) return;
    const pieces = src.front.filter(Boolean).length;
    const seenId = new Set<string>();
    src.front.forEach((p, slot) => {
      if (!p || seenId.has(p.id)) return;
      seenId.add(p.id);
      const seenDst = new Set<string>();
      b.cubbies.forEach((dst, to) => {
        if (to === from || isLocked(b, to) || dst.front.indexOf(null) < 0) return;
        const filled = dst.front.filter(Boolean).length;
        if (filled === 0 && pieces === 1 && src.back.length === 0) return; // moving a lone piece to an empty cubby
        const sig = `${dst.front
          .filter(Boolean)
          .map((q) => q!.id)
          .sort()
          .join(",")}|${dst.back.length}|${dst.lockAt}`;
        if (seenDst.has(sig)) return; // an identical cubby already tried
        seenDst.add(sig);
        out.push({ from, slot, to });
      });
    });
  });
  return out;
}

/** A near-shortest way to stock everything (weighted A*), or null when none is found within `cap` states. */
export function solve(board: Board, cap = 30000): Move[] | null {
  type Node = { b: Board; g: number; f: number; parent: number; move: Move | null };
  const nodes: Node[] = [{ b: board, g: 0, f: 2 * guess(board), parent: -1, move: null }];
  const seen = new Map<string, number>([[keyOf(board), 0]]);
  // a small binary heap of node indexes ordered by f
  const heap: number[] = [0];
  const less = (a: number, c: number) => nodes[a]!.f < nodes[c]!.f;
  const push = (i: number) => {
    heap.push(i);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (!less(heap[k]!, heap[p]!)) break;
      [heap[k], heap[p]] = [heap[p]!, heap[k]!];
      k = p;
    }
  };
  const pop = (): number => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && less(heap[l]!, heap[m]!)) m = l;
        if (r < heap.length && less(heap[r]!, heap[m]!)) m = r;
        if (m === k) break;
        [heap[k], heap[m]] = [heap[m]!, heap[k]!];
        k = m;
      }
    }
    return top;
  };
  if (isCleared(board)) return [];
  let expanded = 0;
  while (heap.length > 0 && expanded < cap) {
    const i = pop();
    const node = nodes[i]!;
    expanded++;
    for (const mv of legalMoves(node.b)) {
      const r = applyMove(node.b, mv);
      if (!r) continue;
      const g = node.g + 1;
      if (isCleared(r.board)) {
        const path: Move[] = [mv];
        for (let p = i; nodes[p]!.parent >= 0; p = nodes[p]!.parent) path.push(nodes[p]!.move!);
        return path.reverse();
      }
      const k = keyOf(r.board);
      const old = seen.get(k);
      if (old !== undefined && old <= g) continue;
      seen.set(k, g);
      nodes.push({ b: r.board, g, f: g + 2 * guess(r.board), parent: i, move: mv });
      push(nodes.length - 1);
    }
  }
  return null;
}

// ── Dealing a board ──────────────────────────────────────────────────────────

/** Deterministic random numbers (a small seeded generator): the same seed always gives the same board. */
function rng(seed: number): () => number {
  let s = (Math.imul(seed >>> 0, 2654435761) ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function shuffle<T>(items: readonly T[], rnd: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** One random deal of `sets` (a supply id per set) for a tier; it may be unsolvable or already hold a triple (`dealBoard` checks). */
function deal(sets: readonly string[], tier: Tier, rnd: () => number, lite: boolean): Board {
  const n = sets.length;
  const pieces = n * SLOTS;
  const depthN = lite ? 0 : Math.min(tier.depth, Math.floor(n / 3));
  // One or two sets are dealt loosely over one more cubby than they fill (three alike must not start together); more are dealt into
  // full cubbies, so the spare cubbies stay really empty.
  const tiny = n <= 2;
  const filled = tiny ? n + 1 : depthN + Math.ceil((pieces - 2 * SLOTS * depthN) / SLOTS);
  const locks = lite || n < 4 ? 0 : tier.locks;
  const spare = Math.max(1, Math.min(tier.spare, MAX_CUBBIES - filled - locks));
  const list: Piece[] = [];
  let uid = 1;
  for (const id of sets) for (let k = 0; k < SLOTS; k++) list.push({ id, uid: uid++ });
  const mystery = lite ? 0 : Math.min(tier.mystery, n);
  for (const p of shuffle(list, rnd).slice(0, mystery)) p.mystery = true;
  const order = shuffle(list, rnd);
  const cubbies: Cubby[] = [];
  if (tiny) {
    const slots = shuffle(
      Array.from({ length: filled * SLOTS }, (_, i) => i),
      rnd,
    ).slice(0, pieces);
    for (let c = 0; c < filled; c++)
      cubbies.push({ front: [null, null, null], back: [], lockAt: 0 });
    slots.forEach((slot, i) => {
      cubbies[Math.floor(slot / SLOTS)]!.front[slot % SLOTS] = order[i]!;
    });
  } else {
    let at = 0;
    for (let c = 0; c < filled; c++) {
      const front = order.slice(at, at + SLOTS);
      at += SLOTS;
      const back = c < depthN ? order.slice(at, at + SLOTS) : [];
      if (c < depthN) at += SLOTS;
      cubbies.push({ front: [...front, null, null, null].slice(0, SLOTS), back, lockAt: 0 });
    }
  }
  for (let c = 0; c < spare + locks; c++)
    cubbies.push({ front: [null, null, null], back: [], lockAt: c < locks ? 2 * (c + 1) : 0 });
  return { cubbies: shuffle(cubbies, rnd), sets: n, stocked: 0 };
}

/**
 * A board built BACKWARDS from a cleared shelf, so it is solvable by construction (a random deal with hidden rows was often a dead end and
 * the search took seconds to say so). Each step is the undo of something the player does: three alike appear in an empty cubby (a "pop"
 * undone), optionally on top of a full row that goes behind them (a "slide" undone), and then one of the three is carried to a free slot
 * elsewhere (the last move undone). A few extra undone moves mix it up. Returns null if it paints itself into a corner (the caller retries).
 */
function dealBackwards(
  sets: readonly string[],
  tier: Tier,
  rnd: () => number,
  lite: boolean,
): Board | null {
  const n = sets.length;
  const depthN = lite ? 0 : Math.min(tier.depth, Math.floor(n / 3));
  const locks = lite || n < 4 ? 0 : tier.locks;
  const filled = depthN + Math.ceil((n * SLOTS - 2 * SLOTS * depthN) / SLOTS);
  const spare = Math.max(1, Math.min(tier.spare, MAX_CUBBIES - filled - locks));
  const total = filled + spare;
  const cubbies: Cubby[] = Array.from({ length: total + locks }, (_, i) => ({
    front: [null, null, null],
    back: [],
    lockAt: i >= total ? 2 * (i - total + 1) : 0,
  }));
  const usable = cubbies.slice(0, total); // locked cubbies stay empty: extra room that opens up later
  const count = (c: Cubby) => c.front.filter(Boolean).length;
  const triple = (c: Cubby) => count(c) === SLOTS && c.front.every((p) => p!.id === c.front[0]!.id);
  let uid = 1;
  let deepLeft = depthN;
  const carry = (allowEmpty: boolean, only?: Cubby): boolean => {
    // undo a move: any front piece (not the last one of a cubby with a hidden row) goes to a free slot elsewhere, never making a triple
    const from = only ? [only] : shuffle(usable, rnd);
    for (const a of from) {
      const slots = shuffle(
        [0, 1, 2].filter((k) => a.front[k]),
        rnd,
      );
      for (const k of slots) {
        if (a.back.length > 0 && count(a) === 1) continue;
        const piece = a.front[k]!;
        // fill cubbies that already hold something first: the empty ones are needed for the sets still to come
        const dests = shuffle(usable, rnd).sort(
          (x, y) => Number(count(x) === 0) - Number(count(y) === 0),
        );
        for (const b of dests) {
          if (b === a || count(b) >= SLOTS || (count(b) === 0 && !allowEmpty)) continue;
          const mates = b.front.filter((q) => q && q.id === piece.id).length;
          if (mates >= SLOTS - 1) continue;
          a.front[k] = null;
          b.front[b.front.indexOf(null)] = piece;
          return true;
        }
      }
    }
    return false;
  };
  for (const id of sets) {
    const empty = usable.filter((c) => count(c) === 0 && c.back.length === 0);
    const fullPlain = usable.filter((c) => count(c) === SLOTS && c.back.length === 0 && !triple(c));
    let target: Cubby | undefined;
    if (deepLeft > 0 && fullPlain.length > 0 && (empty.length === 0 || rnd() < 0.7)) {
      target = shuffle(fullPlain, rnd)[0]!;
      target.back = target.front.filter(Boolean) as Piece[];
      target.front = [null, null, null];
      deepLeft--;
    } else if (empty.length > 0) {
      target = shuffle(empty, rnd)[0]!;
    } else return null;
    target.front = [0, 1, 2].map(() => ({ id, uid: uid++ })) as (Piece | null)[];
    if (!carry(true, target)) return null; // the move that completed this set
    for (let k = Math.floor(rnd() * 3); k > 0; k--) carry(false);
  }
  if (cubbies.some(triple)) return null;
  const all = cubbies.flatMap((c) => [...c.front, ...c.back]).filter(Boolean) as Piece[];
  for (const p of shuffle(all, rnd).slice(0, lite ? 0 : Math.min(tier.mystery, n)))
    p.mystery = true;
  return { cubbies: shuffle(cubbies, rnd), sets: n, stocked: 0 };
}

/** How many states the dealer lets the solver look at before it gives up on a deal and deals again (a bad deal fails fast). */
const DEAL_SOLVE_CAP = 6000;

export type Deal = { board: Board; solution: Move[]; lite: boolean };

/** A board for `sets` that holds no triple yet and is proven solvable (retries with new random deals; a plain board is the last resort). */
export function dealBoard(sets: readonly string[], level: number, seed: number): Deal {
  const tier = tierAt(level);
  for (const lite of [false, true]) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const r = rng(seed * 7919 + attempt * 104729 + (lite ? 17 : 0));
      // one or two sets are dealt loosely; more are built backwards (so a hidden row can never be a dead end), with a random deal as the other way
      const b =
        (sets.length > 2 && attempt < 30 ? dealBackwards(sets, tier, r, lite) : null) ??
        deal(sets, tier, r, lite);
      if (b.cubbies.some(isTriple)) continue;
      const solution = solve(b, DEAL_SOLVE_CAP);
      if (solution) return { board: b, solution, lite };
    }
  }
  // Never reached in the tests (thousands of seeds a tier); kept so a save can never hang on a board it cannot deal.
  const b = deal(sets, { ...tier, spare: 3 }, rng(seed), true);
  return { board: b, solution: solve(b, 60000) ?? [], lite: true };
}

// ── The clock and the score ──────────────────────────────────────────────────

/** Seconds of the board: 12 s plus 1.9 s a move of the proven solution, times the tier's factor (never under 20 s). */
export const timeLimitMs = (moves: number, level: number): number =>
  Math.max(20, Math.round((12 + 1.9 * moves) * tierAt(level).timeFactor)) * 1000;

export const POINTS_PER_SET = 100;
export const COMBO_STEP = 0.25;
export const COMBO_MAX = 3;
/** A set stocked within this long after the previous one keeps the combo going. */
export const COMBO_WINDOW_MS = 8000;
export const TIME_BONUS_PER_SECOND = 20;
export const comboMultiplier = (streak: number): number =>
  Math.min(COMBO_MAX, 1 + COMBO_STEP * streak);
/** One stocked set's points; `streak` = how many sets in a row came fast just before it. */
export const pointsFor = (streak: number): number =>
  Math.round(POINTS_PER_SET * comboMultiplier(streak));

/** Score so far: `gaps` = the milliseconds between each stocked set and the one before it (the first is measured from the start). */
export function scoreBoard(gaps: readonly number[], sets: number, msLeft: number): number {
  let streak = 0;
  let score = 0;
  gaps.forEach((gap, i) => {
    streak = i > 0 && gap <= COMBO_WINDOW_MS ? streak + 1 : 0;
    score += pointsFor(streak);
  });
  if (gaps.length >= sets) score += TIME_BONUS_PER_SECOND * Math.floor(Math.max(0, msLeft) / 1000);
  return score;
}

/** The star thresholds on the painted star bar (the share of `progressOf`): half the sets, all the sets, all the sets with time to spare. */
export const STAR_AT: readonly [number, number, number] = [0.5, 0.74, 0.92];
/** Three stars need this share of the clock left when the last set is stocked. */
export const THREE_STAR_TIME_SHARE = 0.4;

/** 0..1 for the star bar: half the sets = 0.5, all of them = 0.74, then up to 0.92 as the time left reaches 40 %. */
export function progressOf(stocked: number, sets: number, msLeft: number, timeMs: number): number {
  const f = Math.min(1, stocked / Math.max(1, sets));
  if (f < 1) return f <= 0.5 ? f : 0.5 + (f - 0.5) * 0.48;
  const t = Math.min(1, Math.max(0, msLeft) / Math.max(1, timeMs) / THREE_STAR_TIME_SHARE);
  return STAR_AT[1] + (STAR_AT[2] - STAR_AT[1]) * t;
}

export function starsFor(
  stocked: number,
  sets: number,
  msLeft: number,
  timeMs: number,
): 0 | 1 | 2 | 3 {
  const p = progressOf(stocked, sets, msLeft, timeMs);
  return p >= STAR_AT[2] ? 3 : p >= STAR_AT[1] ? 2 : p >= STAR_AT[0] ? 1 : 0;
}

// ── A round ──────────────────────────────────────────────────────────────────

export type Round = {
  /** The supply of each set on this board. */
  sets: string[];
  board: Board;
  /** A proven way to stock everything (its length sets the clock; its first move is the hint). */
  solution: Move[];
  /** How many more sets wait for the next board. */
  queued: number;
  timeMs: number;
  tier: Tier;
};

/** The board the crate offers now, or null when nothing waits or the game is not open yet. */
export function roundFor(save: SaveData, reachedLevel: number): Round | null {
  if (!isStockroomOpen(reachedLevel)) return null;
  const state = stockroomSortOf(save);
  const crate = state.crate ?? [];
  if (crate.length === 0) return null;
  const tier = tierAt(reachedLevel);
  const { take, rest } = packSets(crate, tier.maxSets);
  if (take.length === 0) return null;
  const deal = dealBoard(take, reachedLevel, state.seed! * 1009 + state.rounds!);
  return {
    sets: take,
    board: deal.board,
    solution: deal.solution,
    queued: rest.reduce((n, l) => n + l.sets, 0),
    timeMs: timeLimitMs(deal.solution.length, reachedLevel),
    tier,
  };
}

// ── Finishing a round ────────────────────────────────────────────────────────

export type RoundOutcome = {
  stars: 0 | 1 | 2 | 3;
  score: number;
  /** The supply of each set that was stocked (those leave the crate; the rest wait for the next board). */
  stocked: readonly string[];
  /** "Again" boards score and show stars but give nothing and keep nothing. */
  practice?: boolean;
};

export type RoundEffects = {
  hype: number;
  badge: boolean;
  newBest: boolean;
  /** The big-delivery Hype on top of `hype` (0 = none), and how many boards the delivery had. */
  bigHype?: number;
  boards?: number;
};

/**
 * Applies a finished board: the stocked sets leave the crate, the best score, stars and perfect count are kept, and Hype is added.
 * A practice board (or one with nothing stocked) changes nothing. NEVER touches credits, supplies or the ledger.
 */
export function finishRound(
  save: SaveData,
  o: RoundOutcome,
): { save: SaveData; effects: RoundEffects } {
  const none: RoundEffects = { hype: 0, badge: false, newBest: false };
  if (o.practice || o.stocked.length === 0) return { save, effects: none };
  const state = stockroomSortOf(save);
  const crate = (state.crate ?? []).map((l) => ({ ...l }));
  for (const id of o.stocked) {
    const line = crate.find((l) => l.id === id);
    if (line) line.sets -= 1;
  }
  const left = crate.filter((l) => l.sets > 0);
  const newBest = o.score > (state.best ?? 0);
  const perfect = state.perfect! + (o.stars === 3 ? 1 : 0);
  const badge =
    Math.min(MAX_BADGES, Math.floor(perfect / PERFECTS_PER_BADGE)) >
    Math.min(MAX_BADGES, Math.floor(state.perfect! / PERFECTS_PER_BADGE));
  // A delivery is a run of boards: each needs a star to keep the run; a 0-star board starts it over.
  const chain = o.stars > 0 ? (state.chain ?? 0) + 1 : 0;
  const bigHype = left.length === 0 ? bigDeliveryHype(chain) : 0;
  const next: StockroomSortState = {
    ...state,
    ...(left.length > 0 ? { crate: left } : {}),
    best: newBest ? o.score : state.best!,
    stars: state.stars! + o.stars,
    perfect,
    rounds: state.rounds! + 1,
  };
  if (left.length === 0) {
    delete next.crate;
    delete next.chain;
  } else if (chain > 0) next.chain = chain;
  else delete next.chain;
  const hype = HYPE_BY_STARS[o.stars];
  let out = withState(save, next);
  if (hype + bigHype > 0) out = addHype(out, hype + bigHype);
  return { save: out, effects: { hype, badge, newBest, bigHype, boards: chain } };
}

/** The Prep Cook stocks the crate on its own: no stars, no reward, no Hype. */
export function autoStock(save: SaveData): SaveData {
  const state = stockroomSortOf(save);
  if (!state.crate || state.crate.length === 0) return save;
  const next = { ...state };
  delete next.crate;
  delete next.chain;
  return withState(save, next);
}

// ── What the screen asks of the app ──────────────────────────────────────────

/** The one action the game screen sends: a board ended (the app applies it to the LATEST save). */
export type StockroomSortAction =
  | { kind: "finish"; outcome: RoundOutcome }
  | { kind: "auto" }
  /** Only for analytics: a board began / the player left a crate without stocking it. */
  | { kind: "start"; sets: number; cubbies: number; practice: boolean }
  | { kind: "skip" };

export type StockroomSortResult = { ok: true; effects: RoundEffects } | { ok: false };
