/**
 * STOCKROOM SORT QA (developer 2026-11-06): the rules of the "Stock the shelves" mini-game, business/stockroomSort.ts.
 *   A  it opens at Level 6 (the first shopping list; was 10) and has five tiers
 *   B  the crate: only real supplies, one line each, sets of three by packs bought, a cap, a new seed for a new delivery, look-alikes wait
 *   C  the board: legal moves, three alike pop, hidden rows slide forward, locks open, no triple at the start, sizes by tier
 *   D  every dealt board is proven solvable (thousands of seeds per tier), deterministic, and replayable from its solution
 *   E  the clock, points, combo and stars
 *   F  finishing a board: the stocked sets leave the crate, best / stars / badges / Hype, practice changes nothing, the Prep Cook gives nothing
 *   G  it NEVER touches money or stock: credits, inventory, supplies and the ledger are identical before and after
 *   H  saves: old saves, garbage and a JSON round trip
 *   I  no randomness and no wallet in the rules file
 *   J  wiring: the purchase commit, the chips, the screen, the news line, the art files
 * Prints a line per check and exits 1 on any failure.
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { SUPPLY_CATALOG } from "../src/game/business/businessSupplies.ts";
import { secondFloorOf } from "../src/game/restaurant/secondFloor.ts";
import { HYPE_BY_STARS } from "../src/game/business/fridgeSort.ts";
import { hasNewsToShow, restaurantNewsAt } from "../src/game/restaurant/restaurantNews.ts";
import {
  COMBO_MAX,
  LOOKALIKES,
  MAX_BADGES,
  MAX_CUBBIES,
  MAX_SETS_PER_LINE,
  STAR_AT,
  STOCKROOM_FIRST_LEVEL,
  TIERS,
  addToSupplyCrate,
  applyMove,
  autoStock,
  badgesOf,
  boardsFor,
  boardsLeft,
  comboMultiplier,
  dealBoard,
  finishRound,
  isCleared,
  isStockroomOpen,
  legalMoves,
  packSets,
  piecesLeft,
  pointsFor,
  progressOf,
  roundFor,
  scoreBoard,
  setsFor,
  setsWaiting,
  starsFor,
  stockroomSortOf,
  tierAt,
  timeLimitMs,
  type Board,
  type Cubby,
  type Piece,
} from "../src/game/business/stockroomSort.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const fresh = (): SaveData => ({ ...structuredClone(DEFAULT_SAVE), credits: 123_456 });
const ids = SUPPLY_CATALOG.map((s) => s.id);
const buy = (save: SaveData, lines: [string, number][], level = 20) =>
  addToSupplyCrate(
    save,
    lines.map(([id, packs]) => ({ id, packs })),
    level,
  );
const P = (id: string, uid: number): Piece => ({ id, uid });
const cub = (front: (Piece | null)[], back: Piece[] = [], lockAt = 0): Cubby => ({
  front: [...front, null, null, null].slice(0, 3) as (Piece | null)[],
  back,
  lockAt,
});

console.log("A. When it opens");
{
  assert(STOCKROOM_FIRST_LEVEL === 6, "A1: it opens at Level 6, the first shopping list (rule 2026-11-08, was Level 10)");
  assert(
    !isStockroomOpen(5) && isStockroomOpen(6) && isStockroomOpen(150),
    "A2: closed at Level 5, open from Level 6",
  );
  const s = fresh();
  assert(
    addToSupplyCrate(s, [{ id: ids[0]!, packs: 1 }], 5) === s && roundFor(s, 5) === null,
    "A3: below Level 6 nothing is put on the crate",
  );
  assert(
    TIERS.map((t) => t.from).join() === "6,19,31,44,74" &&
      TIERS.map((t) => t.maxSets).join() === "2,4,6,8,8" &&
      TIERS.map((t) => t.timeFactor).join() === "2,1.6,1.3,1.1,1" &&
      TIERS.map((t) => t.hint).join() === "always,always,after-miss,never,never",
    "A4: five tiers: 2 / 4 / 6 / 8 / 8 sets, clock x2 / 1.6 / 1.3 / 1.1 / 1, hints fade out",
  );
  assert(
    tierAt(6).from === 6 &&
      tierAt(18).from === 6 &&
      tierAt(19).from === 19 &&
      tierAt(43).from === 31 &&
      tierAt(500).from === 74,
    "A5: tierAt picks the last tier reached",
  );
  assert(
    TIERS[3]!.depth === 2 &&
      TIERS[2]!.depth === 0 &&
      TIERS[4]!.locks === 1 &&
      TIERS[4]!.mystery === 2,
    "A6: hidden rows from Level 44, locks and wrapped parcels from Level 74",
  );
}

console.log("B. The crate");
{
  assert(
    setsFor(1) === 1 &&
      setsFor(2) === 1 &&
      setsFor(3) === 2 &&
      setsFor(5) === 2 &&
      setsFor(6) === 3 &&
      setsFor(99) === MAX_SETS_PER_LINE,
    "B1: 1-2 packs = 1 set, 3-5 = 2 sets, 6 or more = 3 sets (never more than 3)",
  );
  let s = buy(fresh(), [
    ["dinner-plates", 1],
    ["tongs", 3],
    ["not-a-supply", 2],
    ["ladles", 0],
  ]);
  const st = stockroomSortOf(s);
  assert(
    JSON.stringify(st.crate) ===
      JSON.stringify([
        { id: "dinner-plates", sets: 1 },
        { id: "tongs", sets: 2 },
      ]) && setsWaiting(s) === 3,
    "B2: only real supplies with packs bought go on the crate, with their sets",
    st.crate,
  );
  assert(st.seed === 1, "B3: a new delivery starts a new seed");
  const s2 = buy(s, [["dinner-plates", 6]]);
  assert(
    stockroomSortOf(s2).crate!.find((l) => l.id === "dinner-plates")!.sets === 3 &&
      stockroomSortOf(s2).seed === 1,
    "B4: a supply already waiting gets more sets (capped at 3) and keeps the seed",
  );
  assert(
    buy(s2, [["dinner-plates", 6]]) === s2 && buy(s2, []) === s2,
    "B5: nothing new changes nothing",
  );
  const many = buy(
    fresh(),
    ids.map((id) => [id, 1] as [string, number]),
  );
  assert(
    stockroomSortOf(many).crate!.length === 30 && ids.length === 62,
    "B6: the crate holds at most 30 lines (62 supplies exist); the rest are simply not queued",
    stockroomSortOf(many).crate!.length,
  );
  const pk = packSets(
    [
      { id: "dinner-forks", sets: 1 },
      { id: "dessert-forks", sets: 1 },
      { id: "ladles", sets: 1 },
    ],
    8,
  );
  assert(
    pk.take.join() === "dinner-forks,ladles" && pk.rest.map((l) => l.id).join() === "dessert-forks",
    "B7: two look-alikes never share a board (the second waits)",
    pk,
  );
  assert(
    LOOKALIKES.every((g) => g.every((id) => ids.includes(id))),
    "B8: every look-alike group names real supplies",
  );
  const lone = packSets(
    [
      { id: "dessert-forks", sets: 2 },
      { id: "dinner-forks", sets: 1 },
    ],
    8,
  );
  assert(
    lone.take.join() === "dessert-forks,dessert-forks" && lone.rest[0]!.id === "dinner-forks",
    "B9: the same product twice is fine, its look-alike waits",
    lone,
  );
  const six = buy(
    fresh(),
    ["tongs", "ladles", "whisks", "peelers", "graters", "skimmers", "sheet-pans"].map(
      (id) => [id, 1] as [string, number],
    ),
    20,
  );
  assert(
    boardsLeft(six, 20) === 2 &&
      boardsLeft(six, 80) === 1 &&
      boardsLeft(fresh(), 20) === 0 &&
      boardsLeft(six, 5) === 0,
    "B10: boardsLeft: 7 sets = 2 boards at Level 20 (4 a board), 1 at Level 80 (8 a board); none when empty or closed",
    [boardsLeft(six, 20), boardsLeft(six, 80)],
  );
  assert(
    boardsFor(fresh(), 20, [{ id: "tongs", packs: 1 }]) === 1 &&
      boardsFor(six, 20, [
        { id: "mixing-bowls", packs: 1 },
        { id: "tamper-labels", packs: 1 },
      ]) === 3 &&
      boardsFor(fresh(), 5, [{ id: "tongs", packs: 1 }]) === 0,
    "B11: boardsFor counts what a purchase would add",
  );
  const r = roundFor(s, 20)!;
  assert(
    r && r.sets.length === 3 && r.queued === 0,
    "B12: roundFor: one board of the waiting sets",
    r?.sets,
  );
  assert(
    JSON.stringify(roundFor(s, 20)!.board) === JSON.stringify(r.board) &&
      roundFor(fresh(), 20) === null,
    "B13: the same crate gives the same board (seeded); an empty crate gives none",
  );
  void s2;
  s = fresh();
}

console.log("C. The board");
{
  const a = P("a", 1),
    b = P("a", 2),
    c = P("a", 3),
    d = P("b", 4);
  const board: Board = {
    cubbies: [cub([a, b]), cub([c, d]), cub([]), cub([])],
    sets: 1,
    stocked: 0,
  };
  const m = applyMove(board, { from: 1, slot: 0, to: 0 })!;
  assert(
    m &&
      m.events.stocked.length === 1 &&
      m.events.stocked[0]!.id === "a" &&
      m.board.stocked === 1 &&
      m.board.cubbies[0]!.front.every((p) => p === null),
    "C1: three alike in one cubby pop (stocked +1, the cubby is free again)",
  );
  assert(
    JSON.stringify(board).includes('"stocked":0') && board.cubbies[0]!.front[0] === a,
    "C2: a move returns a NEW board (the old one is untouched)",
  );
  assert(
    applyMove(board, { from: 0, slot: 2, to: 1 }) === null &&
      applyMove(board, { from: 0, slot: 0, to: 0 }) === null &&
      applyMove(board, { from: 9, slot: 0, to: 0 }) === null,
    "C3: an empty slot, the same cubby or a missing cubby is no move",
  );
  const full: Board = {
    cubbies: [cub([a, d, P("c", 5)]), cub([b, P("c", 6), P("b", 7)]), cub([])],
    sets: 3,
    stocked: 0,
  };
  assert(
    applyMove(full, { from: 2, slot: 0, to: 0 }) === null &&
      applyMove(full, { from: 0, slot: 0, to: 1 }) === null,
    "C4: a full cubby takes nothing",
  );
  const hid: Board = {
    cubbies: [
      cub([P("x", 1), P("x", 2)], [P("y", 3), P("y", 4), P("y", 5)]),
      cub([P("x", 6), P("z", 7)]),
      cub([]),
    ],
    sets: 2,
    stocked: 0,
  };
  const h1 = applyMove(hid, { from: 1, slot: 0, to: 0 })!;
  assert(
    h1.events.stocked.length === 2 && h1.board.stocked === 2 && h1.events.slid.includes(0),
    "C5: a hidden row slides forward and its triple pops as a chain",
    h1.events,
  );
  const slideOnly: Board = {
    cubbies: [cub([P("x", 1)], [P("y", 2), P("z", 3), P("x", 4)]), cub([]), cub([P("w", 5)])],
    sets: 2,
    stocked: 0,
  };
  const s1 = applyMove(slideOnly, { from: 0, slot: 0, to: 1 })!;
  assert(
    s1.board.cubbies[0]!.front.filter(Boolean).length === 3 &&
      s1.board.cubbies[0]!.back.length === 0,
    "C6: emptying a front row reveals the hidden row",
  );
  const locked: Board = { cubbies: [cub([a, d]), cub([], [], 1), cub([])], sets: 1, stocked: 0 };
  assert(
    applyMove(locked, { from: 0, slot: 0, to: 1 }) === null &&
      applyMove({ ...locked, stocked: 1 }, { from: 0, slot: 0, to: 1 }) !== null,
    "C7: a locked cubby takes nothing until enough sets are stocked",
  );
  assert(
    legalMoves(locked).every((mv) => mv.to !== 1),
    "C8: legalMoves skips locked cubbies",
  );
  // the tiers' boards
  for (const t of TIERS) {
    const lvl = t.from;
    const sets = [
      "tongs",
      "ladles",
      "whisks",
      "peelers",
      "graters",
      "skimmers",
      "sheet-pans",
      "mixing-bowls",
    ].slice(0, t.maxSets);
    const dl = dealBoard(sets, lvl, 7);
    const bd = dl.board;
    const pcs = bd.cubbies.reduce(
      (n, cb) => n + cb.front.filter(Boolean).length + cb.back.length,
      0,
    );
    assert(
      pcs === sets.length * 3 &&
        bd.sets === sets.length &&
        bd.cubbies.length <= MAX_CUBBIES &&
        !bd.cubbies.some((cb) => cb.front.every((p) => p && p.id === cb.front[0]!.id)),
      `C9: Level ${lvl}: ${sets.length} sets = ${pcs} pieces on ${bd.cubbies.length} cubbies (at most ${MAX_CUBBIES}), no triple at the start`,
      [pcs, bd.cubbies.length],
    );
    const hasBack = bd.cubbies.some((cb) => cb.back.length > 0);
    const hasLock = bd.cubbies.some((cb) => cb.lockAt > 0);
    const hasMyst = bd.cubbies.some(
      (cb) => cb.front.some((p) => p?.mystery) || cb.back.some((p) => p.mystery),
    );
    assert(
      hasBack === (t.depth > 0 && !dl.lite) &&
        hasLock === (t.locks > 0 && !dl.lite) &&
        hasMyst === (t.mystery > 0 && !dl.lite),
      `C10: Level ${lvl}: hidden rows ${hasBack}, locks ${hasLock}, wrapped parcels ${hasMyst} as the tier says`,
    );
  }
}

console.log("D. Every board is solvable");
{
  const pool = [
    "tongs",
    "ladles",
    "whisks",
    "peelers",
    "graters",
    "skimmers",
    "sheet-pans",
    "mixing-bowls",
    "tamper-labels",
  ];
  let lite = 0;
  let worst = 0;
  let boards = 0;
  const t0 = Date.now();
  for (const t of TIERS) {
    for (let n = 1; n <= t.maxSets; n++) {
      const seeds = n >= 6 ? 60 : 150;
      for (let seed = 1; seed <= seeds; seed++) {
        const dl = dealBoard(pool.slice(0, n), t.from, seed);
        boards++;
        if (dl.lite && (t.depth > 0 || t.locks > 0 || t.mystery > 0) && n >= 3) lite++;
        let b = dl.board;
        for (const mv of dl.solution) {
          const r = applyMove(b, mv);
          if (!r) break;
          b = r.board;
        }
        if (!isCleared(b) || piecesLeft(b) !== 0) {
          assert(
            false,
            `D1: Level ${t.from}, ${n} sets, seed ${seed}: the stored solution does not clear the board`,
          );
          break;
        }
        worst = Math.max(worst, dl.solution.length);
      }
    }
  }
  assert(
    boards > 1500,
    `D1: ${boards} boards over all tiers and sizes: each one's solution replays to a cleared shelf`,
  );
  assert(
    lite === 0,
    "D2: no hard board had to fall back to a plain one (hidden rows / locks / parcels all deal)",
    lite,
  );
  assert(worst <= 60, `D3: the longest solution is ${worst} moves (the clock stays fair)`, worst);
  console.log(`       (${boards} boards in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const x = dealBoard(pool.slice(0, 5), 31, 11);
  const y = dealBoard(pool.slice(0, 5), 31, 11);
  const z = dealBoard(pool.slice(0, 5), 31, 12);
  assert(
    JSON.stringify(x) === JSON.stringify(y) && JSON.stringify(x.board) !== JSON.stringify(z.board),
    "D4: the same seed gives the same board, another seed another",
  );
  assert(
    legalMoves(x.board).length > 0 && x.solution.length >= 3,
    "D5: a 5-set board has moves to make and a proven way out",
  );
}

console.log("E. The clock, points and stars");
{
  assert(
    timeLimitMs(2, 10) === 32_000 &&
      timeLimitMs(10, 31) === 40_000 &&
      timeLimitMs(20, 80) === 50_000 &&
      timeLimitMs(0, 10) === 24_000 + 0,
    "E1: (12 s + 1.9 s a move) x the tier factor: 2 moves at Level 10 = 31.6 -> 32 s, 10 at Level 31 = 40 s, 20 at Level 80 = 50 s",
    [timeLimitMs(2, 10), timeLimitMs(10, 31), timeLimitMs(20, 80), timeLimitMs(0, 10)],
  );
  assert(timeLimitMs(0, 80) >= 20_000, "E2: never under 20 s");
  assert(
    comboMultiplier(0) === 1 &&
      comboMultiplier(4) === 2 &&
      comboMultiplier(99) === COMBO_MAX &&
      pointsFor(0) === 100 &&
      pointsFor(4) === 200,
    "E3: 100 a set, +25 % a fast set in a row, at most x3",
  );
  assert(
    scoreBoard([3000, 3000, 3000], 3, 10_000) === 100 + 125 + 150 + 200 &&
      scoreBoard([3000, 9000, 3000], 3, 0) === 100 + 100 + 125 &&
      scoreBoard([3000], 3, 20_000) === 100,
    "E4: score = the sets' points with the combo, plus 20 a second left once ALL are stocked",
  );
  assert(
    starsFor(0, 4, 10_000, 40_000) === 0 &&
      starsFor(1, 4, 10_000, 40_000) === 0 &&
      starsFor(2, 4, 10_000, 40_000) === 1 &&
      starsFor(4, 4, 1_000, 40_000) === 2 &&
      starsFor(4, 4, 15_000, 40_000) === 2 &&
      starsFor(4, 4, 16_000, 40_000) === 3,
    "E5: 1 star = half the sets, 2 = all of them, 3 = all of them with 40 % of the clock left",
  );
  assert(
    progressOf(0, 4, 5, 40_000) === 0 &&
      Math.abs(progressOf(2, 4, 0, 40_000) - STAR_AT[0]) < 1e-9 &&
      Math.abs(progressOf(4, 4, 0, 40_000) - STAR_AT[1]) < 1e-9 &&
      Math.abs(progressOf(4, 4, 40_000, 40_000) - STAR_AT[2]) < 1e-9,
    "E6: the star bar sits on the 1-, 2- and 3-star marks",
  );
}

console.log("F. Finishing a board");
{
  const s0 = buy(fresh(), [
    ["tongs", 1],
    ["ladles", 1],
    ["whisks", 3],
  ]);
  const f = finishRound(s0, {
    stars: 3,
    score: 900,
    stocked: ["tongs", "ladles", "whisks", "whisks"],
  });
  const st = stockroomSortOf(f.save);
  assert(
    st.crate === undefined &&
      st.rounds === 1 &&
      st.stars === 3 &&
      st.perfect === 1 &&
      st.best === 900 &&
      f.effects.hype === HYPE_BY_STARS[3] &&
      f.effects.newBest,
    "F1: the stocked sets leave the crate (the key goes when empty); stars, perfect, best and Hype are kept",
    st,
  );
  assert(
    secondFloorOf(f.save).hype === HYPE_BY_STARS[3],
    "F2: 3 stars add 15 Hype to the Second Floor",
  );
  const part = finishRound(s0, { stars: 1, score: 200, stocked: ["tongs", "whisks"] });
  assert(
    JSON.stringify(stockroomSortOf(part.save).crate) ===
      JSON.stringify([
        { id: "ladles", sets: 1 },
        { id: "whisks", sets: 1 },
      ]) && stockroomSortOf(part.save).chain === 1,
    "F3: unstocked sets stay for the next board, and the delivery's run is 1",
    stockroomSortOf(part.save),
  );
  const prac = finishRound(s0, { stars: 3, score: 9999, stocked: ["tongs"], practice: true });
  assert(
    prac.save === s0 && prac.effects.hype === 0,
    "F4: practice changes nothing and gives nothing",
  );
  const none = finishRound(s0, { stars: 0, score: 0, stocked: [] });
  assert(none.save === s0, "F5: a board with nothing stocked changes nothing");
  const zero = finishRound(s0, { stars: 0, score: 100, stocked: ["tongs"] });
  assert(
    zero.effects.hype === 0 && stockroomSortOf(zero.save).chain === undefined,
    "F6: 0 stars give no Hype and start the run over",
  );
  // a big delivery: 3 boards, every one with a star, the last one empties the crate
  const sB = buy(
    fresh(),
    [
      "tongs",
      "ladles",
      "whisks",
      "peelers",
      "graters",
      "skimmers",
      "sheet-pans",
      "mixing-bowls",
      "tamper-labels",
    ].map((id) => [id, 1] as [string, number]),
    19,
  );
  let cur = sB;
  let last = { hype: 0, bigHype: 0, boards: 0 } as {
    hype: number;
    bigHype?: number;
    boards?: number;
  };
  let n = 0;
  while (roundFor(cur, 19)) {
    const r = roundFor(cur, 19)!;
    const out = finishRound(cur, { stars: 2, score: 500, stocked: r.sets });
    cur = out.save;
    last = out.effects;
    n++;
  }
  assert(
    n === 3 &&
      last.bigHype === 10 &&
      last.boards === 3 &&
      stockroomSortOf(cur).crate === undefined &&
      stockroomSortOf(cur).chain === undefined,
    "F7: a 3-board delivery with a star each pays the big-delivery bonus (+10 Hype) when the last board empties the crate",
    [n, last],
  );
  const broke = finishRound(sB, { stars: 0, score: 50, stocked: roundFor(sB, 19)!.sets });
  assert(
    stockroomSortOf(broke.save).chain === undefined,
    "F8: a 0-star board in the middle starts the delivery's run over",
  );
  let pf = buy(fresh(), [["tongs", 1]]);
  let gotBadge = false;
  for (let i = 0; i < 3; i++) {
    pf = buy(pf, [["tongs", 1]]);
    const out = finishRound(pf, { stars: 3, score: 100 + i, stocked: ["tongs"] });
    pf = out.save;
    gotBadge = gotBadge || out.effects.badge;
  }
  assert(
    gotBadge && badgesOf(pf) === 1 && badgesOf(fresh()) === 0,
    "F9: every 3 three-star boards earn a shelf badge (at most 12)",
    stockroomSortOf(pf),
  );
  assert(MAX_BADGES === 12, "F10: 12 badges exist");
  const auto = autoStock(s0);
  assert(
    stockroomSortOf(auto).crate === undefined &&
      secondFloorOf(auto).hype === secondFloorOf(s0).hype &&
      autoStock(fresh()).business.stockroomSort === undefined,
    "F11: the Prep Cook clears the crate and gives no Hype",
  );
}

console.log("G. It never touches money or stock");
{
  const s0 = buy(fresh(), [
    ["tongs", 1],
    ["ladles", 1],
  ]);
  const out = finishRound(s0, { stars: 3, score: 900, stocked: ["tongs", "ladles"] }).save;
  const strip = (x: SaveData) => {
    const c = structuredClone(x) as SaveData;
    delete c.business.stockroomSort;
    delete c.business.secondFloor;
    return JSON.stringify(c);
  };
  assert(
    out.credits === s0.credits &&
      JSON.stringify(out.business.supplies) === JSON.stringify(s0.business.supplies) &&
      JSON.stringify(out.business.inventory) === JSON.stringify(s0.business.inventory) &&
      JSON.stringify(out.economyLedger) === JSON.stringify(s0.economyLedger) &&
      strip(out) === strip(s0),
    "G1: credits, supplies, inventory, the ledger and everything else are identical before and after a board (only the sort state and Hype change)",
  );
  const bought = addToSupplyCrate(fresh(), [{ id: "tongs", packs: 2 }], 20);
  assert(
    bought.credits === fresh().credits &&
      JSON.stringify(bought.economyLedger) === JSON.stringify(fresh().economyLedger) &&
      JSON.stringify(bought.business.supplies) === JSON.stringify(fresh().business.supplies),
    "G2: putting a purchase on the crate moves no money and no stock",
  );
}

console.log("H. Saves");
{
  const old = fresh();
  assert(
    old.business.stockroomSort === undefined &&
      stockroomSortOf(old).seed === 0 &&
      setsWaiting(old) === 0 &&
      roundFor(old, 80) === null,
    "H1: an old save (no field) reads as nothing waiting",
  );
  const junk = fresh();
  (junk.business as unknown as Record<string, unknown>).stockroomSort = {
    crate: [
      { id: "tongs", sets: 9 },
      { id: "nope", sets: 1 },
      { id: "tongs", sets: 1 },
      null,
      { id: "ladles", sets: -3 },
      { id: "whisks", sets: "2" },
    ],
    seed: -5,
    best: "x",
    stars: 1.9,
    perfect: NaN,
    rounds: 2,
    chain: 999,
  };
  const g = stockroomSortOf(junk);
  assert(
    JSON.stringify(g.crate) ===
      JSON.stringify([
        { id: "tongs", sets: 3 },
        { id: "whisks", sets: 2 },
      ]) &&
      g.seed === 0 &&
      g.best === 0 &&
      g.stars === 1 &&
      g.perfect === 0 &&
      g.rounds === 2 &&
      g.chain === 50,
    "H2: garbage is dropped (unknown or repeated supplies, bad numbers), sets are 1-3, the run is capped",
    g,
  );
  const s = buy(fresh(), [["tongs", 1]]);
  const back = JSON.parse(JSON.stringify(s)) as SaveData;
  assert(
    JSON.stringify(stockroomSortOf(back)) === JSON.stringify(stockroomSortOf(s)),
    "H3: a JSON round trip keeps the state",
  );
}

console.log("I. The rules file");
{
  const src = fs.readFileSync(path.join(ROOT, "src/game/business/stockroomSort.ts"), "utf8");
  assert(!/Math\.random\s*\(/.test(src), "I1: no Math.random (the deal is seeded)");
  assert(
    !/EconomyLedger|appendLedgerEntry|debitWallet|economy\/wallet|credits\s*[:+\-=]/.test(
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    ),
    "I2: the rules file has no wallet, ledger or credits code",
  );
}

console.log("J. Wiring");
{
  const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
  const app = read("src/App.tsx");
  const router = read("src/ScreensRouter.tsx");
  const game = read("src/components/kc/inventory/StockroomSortGame.tsx");
  const news = read("src/game/restaurant/restaurantNews.ts");
  assert(
    /addToSupplyCrate\(/.test(app) &&
      /stockroomSortAction/.test(app) &&
      /stockroom-sort/.test(router) &&
      /StockroomSortGame/.test(router),
    "J1: the supply purchase commit fills the crate, and the app and router route the screen",
  );
  assert(
    /STOCKROOM_FIRST_LEVEL/.test(news) &&
      restaurantNewsAt(STOCKROOM_FIRST_LEVEL).minigame === "stockroom-sort" &&
      restaurantNewsAt(3).minigame === "fridge-sort" &&
      restaurantNewsAt(11).minigame === null &&
      hasNewsToShow(restaurantNewsAt(STOCKROOM_FIRST_LEVEL)),
    "J2: Level 6's Pre-Service Check shows a Stockroom Sort line (Level 3 still shows Fridge Sort)",
  );
  assert(
    [
      "stock-guide",
      "stock-help",
      "stock-slip",
      "stock-big-delivery",
      "stock-chain",
      "stock-more-boards",
      "stock-undo",
      "stock-hint",
    ].every((t) => game.includes(t)),
    "J3: the screen has the how-to card, the ? button, the delivery slip, Undo, Hint, and the run and bonus lines",
  );
  const art = path.join(ROOT, "public/business/stockroom");
  const need = [
    "backdrop",
    "cubby",
    "unit-top",
    "unit-plinth",
    "lock-closed",
    "lock-open",
    "parcel-closed",
    "parcel-open",
    "truck",
    "stamp",
    "ribbon-sage",
    "ribbon-gold",
    "ribbon-copper",
    "burst",
    "boost-undo",
    "boost-hint",
    "boost-shelf",
    "boost-time",
    "boost-shuffle",
    "boost-blank",
    "boost-locked",
    "boost-ad",
    ...Array.from({ length: 12 }, (_, i) => `badge-${String(i + 1).padStart(2, "0")}`),
    ...Array.from({ length: 4 }, (_, i) => `spark-${i + 1}`),
    ...Array.from({ length: 4 }, (_, i) => `puff-${i + 1}`),
  ];
  const missing = need.filter((n) => !fs.existsSync(path.join(art, `${n}.webp`)));
  assert(missing.length === 0, "J4: every painted piece of the kit exists as WebP", missing);
  const missingGoods = SUPPLY_CATALOG.filter(
    (x) => !fs.existsSync(path.join(art, "goods", `${x.id}.webp`)),
  ).map((x) => x.id);
  assert(
    missingGoods.length === 0 && SUPPLY_CATALOG.length === 62,
    "J5: all 62 supplies have a painted good",
    missingGoods,
  );
  let bytes = 0;
  const walk = (d: string) =>
    fs
      .readdirSync(d, { withFileTypes: true })
      .forEach((e) =>
        e.isDirectory()
          ? walk(path.join(d, e.name))
          : (bytes += fs.statSync(path.join(d, e.name)).size),
      );
  walk(art);
  assert(
    bytes <= 470 * 1024,
    `J6: the whole folder stays within 470 KB (${Math.round(bytes / 1024)} KB)`,
    bytes,
  );
  const big = fs
    .readdirSync(path.join(art, "goods"))
    .filter((f) => fs.statSync(path.join(art, "goods", f)).size > 9 * 1024);
  assert(big.length === 0, "J7: no good is over 9 KB", big);
}

console.log(
  failures === 0 ? "\nSTOCKROOM SORT QA: ALL PASS" : `\nSTOCKROOM SORT QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
