// Unload the Van / Kitchen Dispatch QA (developer 2026-11-17, rebuilt the same day on the sliding-block "door" mechanism).
// Pure rules: every board can be won, the drag, the gates, undo, the boosters, the clock, and that no move can spoil a board.
// Run: npx tsx scripts/crate-dispatch-qa.mts   (the browser side is tools/e2e/kitchendispatch.mjs)
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "vite";

const vite = await createServer({
  configFile: "vite.config.ts",
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});
let failures = 0;
const check = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL ${name}\n       ${(error as Error).message}`);
  }
};
try {
  const rules = await vite.ssrLoadModule("/src/game/business/crateDispatch.ts");
  const {
    CRATE_TIERS,
    CRATE_INGREDIENTS,
    CRATE_COLORS,
    FREEZE_SECONDS,
    START_BOOSTERS,
    crateTierFor,
    crateBoardFor,
    crateTierAt,
    gateCapacity,
    crateSeconds,
    crateStars,
    solveBoard,
    exitSteps,
    brickFits,
    gateTouched,
    startRound,
    dragBrick,
    finishDrag,
    undoRound,
    freezeRound,
    rocketBrick,
    hammerWall,
    roundCleared,
    cratesLeft,
    brickAtCell,
    crateProofFor,
    pathToGate,
    trappedCount,
    dressBoard,
    foodOf,
  } = rules;

  // A small counter to test by hand: 5 x 5, a tomato gate on the right (rows 0-1), a dark block at (2, 2).
  const hand = (over: Record<string, unknown> = {}) => ({
    cols: 5,
    rows: 5,
    walls: [{ id: "w1", x: 2, y: 2, w: 1, h: 1 }],
    gates: [{ id: "g1", side: "right", at: 0, span: 2, color: "tomato" }],
    bricks: [{ id: "b1", x: 0, y: 0, w: 2, h: 1, color: "tomato" }],
    ...over,
  });
  // RULE CHANGE (developer 2026-11-27, trapped crates): from Level 23 a board cannot be cleared just by sending free crates out, so "winnable" is proved by replaying the builder's own
  // shuffles backwards with the game's real drag (one cell at a time), then sending the first winnable board's crates out in order.
  const proven = (proof: any, what: string) => {
    let round: any = roundOf(proof.board);
    const step = (id: string, x: number, y: number) => {
      if (!round.board.bricks.some((b: any) => b.id === id)) return;
      const res = dragBrick(round, id, x, y);
      assert.ok(
        res.moved && (res.out || (res.brick.x === x && res.brick.y === y)),
        `${what}: the drag of ${id} to ${x},${y} failed`,
      );
      round = res.round;
    };
    for (const move of [...proof.moves].reverse())
      for (const [x, y] of [...move.way].reverse().slice(1)) step(move.id, x, y);
    for (const id of solveBoard(proof.base).waves.flat()) {
      const brick = round.board.bricks.find((b: any) => b.id === id);
      if (!brick) continue;
      const way = pathToGate(round.board, brick);
      assert.ok(way, `${what}: ${id} has no way out`);
      for (const [x, y] of way.slice(1)) step(id, x, y);
    }
    assert.equal(round.board.bricks.length, 0, `${what}: the proof does not clear the board`);
  };
  const roundOf = (board: any) => ({
    board,
    history: [],
    seconds: 100,
    total: board.bricks.length,
    freezes: 2,
    rockets: 2,
    hammers: 2,
    undos: 3,
    moves: 0,
  });

  console.log("A. Every board can be won, and fits its tier");
  // RULE CHANGE (developer 2026-11-19: "gradually add more crates, more rows and columns, all levels feel the same"): thirteen steps instead of four, the grid
  // grows 5x5 (L18) -> 6x6 (L28) -> 7x7 (L46) -> 8x8 (L66), the last step is Level 91 so no stretch of levels is flat.
  check(
    "A1: thirteen steps from Level 18 to 91, the grid growing 5 -> 6 -> 7 -> 8, never below the first",
    () => {
      assert.deepEqual(
        CRATE_TIERS.map((t: { from: number }) => t.from),
        [18, 23, 28, 34, 40, 46, 52, 58, 66, 72, 78, 84, 91],
      );
      assert.deepEqual(
        [18, 28, 46, 66].map((l) => crateTierFor(l).cols),
        [5, 6, 7, 8],
      );
      assert.ok(
        CRATE_TIERS.every((t: any) => t.cols === t.rows && t.cols <= 8),
        "square, at most 8 x 8",
      );
      assert.equal(crateTierFor(1).from, 18);
      assert.equal(crateTierFor(44).from, 40);
      assert.equal(crateTierFor(91).from, 91);
    },
  );
  const SEEDS = 150;
  CRATE_TIERS.forEach((tier: any, index: number) => {
    check(
      `A${index + 2}: tier ${index + 1} (${tier.cols}x${tier.rows}): ${SEEDS} boards, all winnable, well formed, and as hard as the tier says`,
      () => {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const proof = crateProofFor(tier.from, seed);
          const board = proof.board;
          const at = `seed ${seed}`;
          assert.equal(board.cols, tier.cols);
          assert.equal(board.rows, tier.rows);
          proven(proof, at);
          // RULE CHANGE (developer 2026-11-27): the tier's waves are those of the winnable board before its crates are shuffled; its free crates and trapped crates are the shuffled board's
          const sol = solveBoard(proof.base);
          const free = solveBoard(board).waves[0]?.length ?? 0;
          assert.equal(trappedCount(board), tier.trapped, `${at}: trapped crates`);
          assert.equal(board.trapped, tier.trapped, `${at}: the board says how many are trapped`);
          const n = board.bricks.length;
          assert.ok(
            n >= tier.bricks[0] && n <= tier.bricks[1],
            `${at}: ${n} crates, tier wants ${tier.bricks[0]}-${tier.bricks[1]}`,
          );
          assert.ok(sol.waves.length >= tier.minWaves, `${at}: only ${sol.waves.length} waves`);
          assert.ok(
            free >= 1 && free <= tier.maxFree,
            `${at}: ${free} crates free at the start (1-${tier.maxFree})`,
          );
          // nothing overlaps, nothing is off the counter
          const taken = new Set<string>();
          const claim = (x: number, y: number, w: number, h: number, what: string) => {
            assert.ok(
              x >= 0 && y >= 0 && x + w <= board.cols && y + h <= board.rows,
              `${at}: ${what} off the counter`,
            );
            for (let j = 0; j < h; j++)
              for (let i = 0; i < w; i++) {
                const key = `${x + i},${y + j}`;
                assert.ok(!taken.has(key), `${at}: ${what} overlaps on ${key}`);
                taken.add(key);
              }
          };
          for (const w of board.walls) claim(w.x, w.y, w.w, w.h, w.id);
          for (const b of board.bricks) {
            claim(b.x, b.y, b.w, b.h, b.id);
            assert.ok(
              tier.sizes.some(([w, h]: number[]) => w === b.w && h === b.h),
              `${at}: a ${b.w}x${b.h} crate is not a tier size`,
            );
            assert.ok(
              (CRATE_INGREDIENTS as readonly string[]).includes(b.color),
              `${at}: ${b.color}`,
            );
          }
          // the gates: one per ingredient, inside the frame's sides, not overlapping, every crate fits its gate, no dark block in a gate's mouth
          assert.equal(board.gates.length, tier.colors, `${at}: one gate for each ingredient`);
          assert.equal(new Set(board.gates.map((g: any) => g.color)).size, board.gates.length);
          // RULE CHANGE (developer 2026-11-27, "fix the doors that have no matching crate"): every door has at least one crate
          for (const g of board.gates)
            assert.ok(
              board.bricks.some((b: any) => b.color === g.color),
              `${at}: no crate goes to the ${g.color} door`,
            );
          for (const g of board.gates) {
            const length = g.side === "left" || g.side === "right" ? board.rows : board.cols;
            assert.ok(g.at >= 0 && g.at + g.span <= length, `${at}: gate off its side`);
            assert.equal(g.span, tier.span);
            for (const o of board.gates)
              if (o !== g && o.side === g.side)
                assert.ok(g.at + g.span < o.at || o.at + o.span < g.at, `${at}: gates touch`);
            for (let k = g.at; k < g.at + g.span; k++) {
              const x = g.side === "left" ? 0 : g.side === "right" ? board.cols - 1 : k;
              const y = g.side === "top" ? 0 : g.side === "bottom" ? board.rows - 1 : k;
              assert.ok(
                !board.walls.some(
                  (w: any) => x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h,
                ),
                `${at}: a dark block in a gate's mouth`,
              );
            }
          }
          for (const b of board.bricks) {
            const g = board.gates.find((x: any) => x.color === b.color);
            assert.ok(g, `${at}: ${b.id} has no gate`);
            const cross = g.side === "left" || g.side === "right" ? b.h : b.w;
            assert.ok(cross <= g.span, `${at}: ${b.id} is wider than its gate`);
          }
        }
      },
    );
  });
  check("A6: the same level and seed is the same board; another seed is another board", () => {
    assert.deepEqual(crateBoardFor(28, 7), crateBoardFor(28, 7));
    assert.notDeepEqual(crateBoardFor(28, 7), crateBoardFor(28, 8));
  });
  check("A7: the colours are all different, and a harder tier shows more ingredients", () => {
    for (const name of CRATE_INGREDIENTS) assert.match(CRATE_COLORS[name], /^#[0-9A-F]{6}$/);
    assert.equal(new Set(Object.values(CRATE_COLORS)).size, CRATE_INGREDIENTS.length);
    const kinds = (level: number) => {
      let most = 0;
      for (let seed = 1; seed <= 20; seed++)
        most = Math.max(
          most,
          new Set(crateBoardFor(level, seed).bricks.map((b: any) => b.color)).size,
        );
      return most;
    };
    assert.ok(
      kinds(18) <= 3 && kinds(65) >= 5 && kinds(91) >= 7,
      `${kinds(18)}, ${kinds(65)} then ${kinds(91)}`,
    );
  });
  // RULE CHANGE (developer 2026-11-19: every mini-game climbs level by level like the rest, `difficultyRamp.ts`): crates, dark blocks, ingredients, waves
  // and free crates move from one tier's values to the next tier's between their first levels. A9 builds boards for EVERY level.
  check(
    "A9: the ramp: on a tier's first level the numbers are the tier's own, nothing gets easier as the level rises, and every level's boards are solvable and meet the ramped numbers",
    () => {
      for (const t of CRATE_TIERS) {
        const at = crateTierAt(t.from);
        assert.deepEqual(
          [at.bricks, at.colors, at.wallCells, at.minWaves, at.maxFree],
          [t.bricks, t.colors, t.wallCells, t.minWaves, t.maxFree],
          `tier ${t.from} is its own on its first level`,
        );
      }
      let prev: any = null;
      for (let level = 18; level <= 91; level++) {
        const t = crateTierAt(level);
        assert.ok(
          t.colors <= gateCapacity(t),
          `level ${level}: ${t.colors} ingredients fit ${gateCapacity(t)} doors`,
        );
        if (prev)
          assert.ok(
            t.bricks[0] >= prev.bricks[0] &&
              t.bricks[1] >= prev.bricks[1] &&
              t.colors >= prev.colors &&
              t.wallCells[1] >= prev.wallCells[1] &&
              t.minWaves >= prev.minWaves &&
              t.maxFree <= prev.maxFree &&
              t.trapped >= prev.trapped,
            `level ${level} is not easier than level ${level - 1}`,
          );
        prev = t;
        for (let seed = 1; seed <= 25; seed++) {
          const proof = crateProofFor(level, seed);
          const board = proof.board;
          proven(proof, `level ${level} seed ${seed}`);
          const waves = solveBoard(proof.base).waves.length;
          const free = solveBoard(board).waves[0]?.length ?? 0;
          assert.ok(
            board.bricks.length >= t.bricks[0] &&
              board.bricks.length <= t.bricks[1] &&
              waves >= t.minWaves &&
              free >= 1 &&
              free <= t.maxFree &&
              trappedCount(board) === t.trapped,
            `level ${level} seed ${seed}: ${board.bricks.length} crates, ${waves} waves, ${free} free, ${trappedCount(board)} trapped (${t.trapped})`,
          );
        }
      }
      assert.ok(
        new Set([18, 20, 22, 24, 26].map((l) => crateTierAt(l).bricks[1])).size >= 3,
        "Levels 18-26 really climb",
      );
      // trapped crates: none while learning, from Level 23 at least two (a lone trapped crate cannot exist), 9 at the last level
      assert.deepEqual(
        [18, 22, 23, 91].map((l) => crateTierAt(l).trapped),
        [0, 0, 2, 9],
      );
    },
  );
  check(
    "A10: every door has a crate, on the very boards a player gets: every level, five business days (developer 2026-11-27: 42 % of boards had a door no crate matched)",
    () => {
      for (let level = 18; level <= 91; level++)
        for (let day = 1; day <= 5; day++) {
          const board = startRound(level, level * 1000003 + day * 9176).board;
          const t = crateTierAt(level);
          const idle = board.gates.filter(
            (g: any) => !board.bricks.some((b: any) => b.color === g.color),
          );
          assert.equal(
            idle.length,
            0,
            `level ${level} day ${day}: no crate for the ${idle.map((g: any) => g.color).join(", ")} door`,
          );
          assert.equal(
            board.gates.length,
            t.colors,
            `level ${level} day ${day}: as many doors as the level shows`,
          );
          proven(crateProofFor(level, level * 1000003 + day * 9176), `level ${level} day ${day}`);
        }
    },
  );
  check("A8: a board is built in under 800 ms (a phone), and tiers get harder, not easier", () => {
    for (const level of [18, 28, 46, 66, 91]) {
      const t0 = performance.now();
      for (let s = 0; s < 5; s++) crateBoardFor(level, 99 + s);
      assert.ok(
        performance.now() - t0 < 4000,
        `level ${level}: ${(performance.now() - t0).toFixed(0)} ms for 5`,
      );
    }
    const mean = (level: number) => {
      let w = 0;
      for (let s = 1; s <= 40; s++) w += solveBoard(crateProofFor(level, s).base).waves.length;
      return w / 40;
    };
    const m = [18, 28, 46, 66, 91].map(mean);
    assert.ok(
      m[0] < m[1] && m[1] < m[2] && m[2] < m[3] && m[3] <= m[4],
      `waves per tier ${m.map((x) => x.toFixed(1))}`,
    );
  });

  console.log("B. The drag");
  check("B1: a crate follows the target one cell at a time and stops at a dark block", () => {
    // b1 (2 x 1) at (0, 2) dragged right: the dark block at (2, 2) stops it flush against it
    const board = hand({ bricks: [{ id: "b1", x: 0, y: 2, w: 2, h: 1, color: "carrot" }] });
    const res = dragBrick(roundOf(board), "b1", 3, 2);
    assert.equal(res.moved, false, "it is already against the block");
    const res2 = dragBrick(roundOf(board), "b1", 0, 4);
    assert.ok(res2.moved);
    assert.deepEqual([res2.round.board.bricks[0].x, res2.round.board.bricks[0].y], [0, 4]);
  });
  check(
    "B2: a crate cannot pass through another crate, a dark block or the edge of the counter",
    () => {
      const board = hand({
        bricks: [
          { id: "b1", x: 0, y: 3, w: 1, h: 1, color: "carrot" },
          { id: "b2", x: 2, y: 3, w: 1, h: 1, color: "onion" },
        ],
      });
      const right = dragBrick(roundOf(board), "b1", 4, 3);
      assert.equal(
        right.round.board.bricks.find((b: any) => b.id === "b1").x,
        1,
        "stops against b2",
      );
      const off = dragBrick(roundOf(board), "b1", -3, 3);
      assert.equal(off.moved, false, "never off the counter");
      const far = dragBrick(roundOf(board), "b2", 9, 9);
      const b2 = far.round.board.bricks.find((b: any) => b.id === "b2");
      assert.ok(b2.x <= 4 && b2.y <= 4, "stays on the 5 x 5 counter");
    },
  );
  check("B3: a blocked drag slides along the obstacle toward the target", () => {
    // b1 at (1,2) dragged toward (4,4): the way right is open, so it goes right then down
    const board = hand({ bricks: [{ id: "b1", x: 1, y: 3, w: 1, h: 1, color: "carrot" }] });
    const res = dragBrick(roundOf(board), "b1", 4, 4);
    const b = res.round.board.bricks[0];
    assert.deepEqual([b.x, b.y], [4, 4]);
  });
  check(
    "B4: a crate pushed against the gate of ITS colour, with its width inside the gate, leaves",
    () => {
      const board = hand();
      const res = dragBrick(roundOf(board), "b1", 3, 0);
      assert.ok(res.out, "it left");
      assert.equal(res.out.side, "right");
      assert.deepEqual([res.brick.x, res.brick.y], [3, 0]);
      assert.equal(res.round.board.bricks.length, 0);
      assert.ok(roundCleared(res.round));
    },
  );
  check("B5: another colour's crate, or one wider than the gate, does not leave", () => {
    const wrong = hand({ bricks: [{ id: "b1", x: 0, y: 0, w: 2, h: 1, color: "onion" }] });
    const r1 = dragBrick(roundOf(wrong), "b1", 3, 0);
    assert.equal(r1.out, null);
    assert.equal(r1.round.board.bricks[0].x, 3, "it sits against the wrong gate");
    // a 1 x 3 crate (3 high) cannot go through a 2-wide gate on the right
    const tall = hand({ bricks: [{ id: "b1", x: 0, y: 0, w: 1, h: 3, color: "tomato" }] });
    const r2 = dragBrick(roundOf(tall), "b1", 4, 0);
    assert.equal(r2.out, null, "3 high does not fit a gate 2 high");
    assert.equal(gateTouched(tall, "tomato", 4, 0, 1, 2)?.id, "g1", "2 high does");
    assert.equal(gateTouched(tall, "tomato", 4, 1, 1, 2), null, "rows 1-2 are not inside rows 0-1");
  });
  check("B6: dragging writes no history; finishDrag writes one entry for the whole drag", () => {
    const board = hand({ bricks: [{ id: "b1", x: 0, y: 3, w: 1, h: 1, color: "carrot" }] });
    const r = roundOf(board);
    const mid = dragBrick(r, "b1", 3, 3);
    assert.equal(mid.round.history.length, 0);
    const done = finishDrag(mid.round, board.bricks[0], { moved: true, out: false });
    assert.equal(done.history.length, 1);
    assert.equal(done.moves, 1);
    assert.deepEqual(finishDrag(r, board.bricks[0], { moved: false, out: false }), r);
  });
  check("B7: brickAtCell finds the crate under any of its cells", () => {
    const board = hand({ bricks: [{ id: "b1", x: 1, y: 3, w: 2, h: 2, color: "carrot" }] });
    for (const [x, y] of [
      [1, 3],
      [2, 3],
      [1, 4],
      [2, 4],
    ])
      assert.equal(brickAtCell(board, x, y)?.id, "b1");
    assert.equal(brickAtCell(board, 3, 3), null);
  });

  console.log("C. The boards can really be won by dragging (the real drag function, cell by cell)");
  /** The fewest-cell path to a cell touching the crate's gate, by the same rules as the engine; null when there is none. */
  const pathOut = (board: any, brick: any) => {
    const key = (x: number, y: number) => `${x},${y}`;
    const prev = new Map<string, string | null>([[key(brick.x, brick.y), null]]);
    const queue: Array<[number, number]> = [[brick.x, brick.y]];
    for (let head = 0; head < queue.length; head++) {
      const [x, y] = queue[head];
      if (gateTouched(board, brick.color, x, y, brick.w, brick.h)) {
        const path: Array<[number, number]> = [];
        for (let k: string | null = key(x, y); k; k = prev.get(k) ?? null) {
          const [px, py] = k.split(",").map(Number);
          path.unshift([px, py]);
        }
        return path;
      }
      for (const [sx, sy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + sx;
        const ny = y + sy;
        if (prev.has(key(nx, ny)) || !brickFits(board, brick.id, nx, ny)) continue;
        prev.set(key(nx, ny), key(x, y));
        queue.push([nx, ny]);
      }
    }
    return null;
  };
  check(
    "C1: the builder's proof, dragged with dragBrick, clears every board of every tier (20 each)",
    () => {
      for (const level of [18, 28, 46, 66, 91])
        for (let seed = 1; seed <= 20; seed++)
          proven(crateProofFor(level, seed), `level ${level} seed ${seed}`);
    },
  );
  check(
    "C2: no move can spoil a board: 40 random drags (and crates leaving) can all be taken back, and the board can be won again (15 boards a tier)",
    () => {
      let seedState = 12345;
      const rnd = () => {
        seedState = (Math.imul(seedState, 1664525) + 1013904223) >>> 0;
        return seedState / 4294967296;
      };
      for (const level of [18, 28, 46, 66, 91])
        for (let seed = 1; seed <= 15; seed++) {
          const start = startRound(level, seed);
          let round = { ...start, undos: 999 };
          for (let step = 0; step < 40 && !roundCleared(round); step++) {
            const b = round.board.bricks[Math.floor(rnd() * round.board.bricks.length)];
            const res = dragBrick(
              round,
              b.id,
              Math.floor(rnd() * round.board.cols),
              Math.floor(rnd() * round.board.rows),
            );
            round = finishDrag(res.round, b, { moved: res.moved, out: !!res.out });
          }
          while (round.history.length > 0) {
            const next = undoRound(round);
            assert.notEqual(
              next,
              round,
              `level ${level} seed ${seed}: a drag could not be taken back`,
            );
            round = next;
          }
          assert.deepEqual(
            [...round.board.bricks].sort((a: any, b: any) => a.id.localeCompare(b.id)),
            [...start.board.bricks].sort((a: any, b: any) => a.id.localeCompare(b.id)),
            `level ${level} seed ${seed}: not back to the start`,
          );
        }
    },
  );

  console.log("D. Undo");
  check("D1: Undo takes back a whole drag and costs one", () => {
    const board = hand({ bricks: [{ id: "b1", x: 0, y: 3, w: 1, h: 1, color: "carrot" }] });
    const r = roundOf(board);
    const res = dragBrick(r, "b1", 3, 3);
    const after = finishDrag(res.round, board.bricks[0], { moved: true, out: false });
    const back = undoRound(after);
    assert.deepEqual(back.board.bricks, board.bricks);
    assert.equal(back.undos, r.undos - 1);
    assert.equal(back.history.length, 0);
  });
  check("D2: Undo brings back a crate that left, where it stood before the drag", () => {
    const board = hand({ bricks: [{ id: "b1", x: 0, y: 0, w: 2, h: 1, color: "tomato" }] });
    const r = roundOf(board);
    const res = dragBrick(r, "b1", 3, 0);
    assert.ok(res.out);
    const after = finishDrag(res.round, board.bricks[0], { moved: true, out: true });
    const back = undoRound(after);
    assert.deepEqual(back.board.bricks, board.bricks);
    assert.ok(solveBoard(back.board).solvable);
  });
  check("D3: Undo with nothing to undo, or none left, changes nothing", () => {
    const fresh = startRound(18, 2);
    assert.deepEqual(undoRound(fresh), fresh);
    const board = hand({ bricks: [{ id: "b1", x: 0, y: 3, w: 1, h: 1, color: "carrot" }] });
    const res = dragBrick(roundOf(board), "b1", 3, 3);
    const after = {
      ...finishDrag(res.round, board.bricks[0], { moved: true, out: false }),
      undos: 0,
    };
    assert.deepEqual(undoRound(after), after);
  });

  check(
    "D4: an Undo that can no longer be done is dropped and the one before it is taken back (never a dead button)",
    () => {
      const board = hand({
        bricks: [
          { id: "b1", x: 3, y: 3, w: 1, h: 1, color: "carrot" },
          { id: "b2", x: 0, y: 3, w: 1, h: 1, color: "tomato" },
        ],
      });
      const r = roundOf(board);
      // b2 was dragged from (0,1) to (0,3); b1 had been dragged from (0,3) before that, so its origin is taken now.
      const stuck = {
        ...r,
        history: [
          { kind: "move" as const, id: "b2", fromX: 0, fromY: 1 },
          { kind: "move" as const, id: "b1", fromX: 0, fromY: 3 },
        ],
      };
      const back = undoRound(stuck);
      assert.equal(back.history.length, 0);
      assert.equal(back.undos, r.undos - 1, "only the take-back that worked cost an Undo");
      const b2 = back.board.bricks.find((b: any) => b.id === "b2");
      assert.deepEqual([b2.x, b2.y], [0, 1]);
    },
  );

  console.log("E. The boosters, the clock and the stars");
  check("E1: the clock gives time for every crate", () => {
    assert.equal(crateSeconds(10), 130);
    const round = startRound(28, 1);
    assert.equal(round.seconds, crateSeconds(round.board.bricks.length, round.board.trapped));
    // RULE CHANGE (developer 2026-11-27): six more seconds for every trapped crate
    assert.equal(crateSeconds(10, 3), 148);
    assert.equal(round.total, round.board.bricks.length);
  });
  check(
    "E2: Freeze costs one, holds the clock for 10 s (the screen), and does nothing at zero",
    () => {
      assert.equal(FREEZE_SECONDS, 10);
      const round = startRound(18, 1);
      assert.equal(freezeRound(round).freezes, START_BOOSTERS.freeze - 1);
      assert.deepEqual(freezeRound({ ...round, freezes: 0 }), { ...round, freezes: 0 });
    },
  );
  check("E3: Rocket sends one crate out wherever it is, costs one, and Undo brings it back", () => {
    const round = startRound(45, 3);
    const id = round.board.bricks[0].id;
    const out = rocketBrick(round, id);
    assert.equal(out.board.bricks.length, round.board.bricks.length - 1);
    assert.equal(out.rockets, START_BOOSTERS.rocket - 1);
    assert.equal(out.history.length, 1);
    assert.ok(trappedCount(out.board) <= trappedCount(round.board), "a crate gone traps no more");
    assert.deepEqual(
      undoRound(out).board.bricks.find((b: any) => b.id === id),
      round.board.bricks[0],
    );
    assert.deepEqual(rocketBrick({ ...round, rockets: 0 }, id), { ...round, rockets: 0 });
    assert.deepEqual(rocketBrick(round, "nope"), round);
  });
  check("E4: Hammer smashes one dark block, costs one, and never makes a board harder", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const round = startRound(45, seed);
      const w = round.board.walls[0];
      assert.ok(w, `seed ${seed}: a tier 3 board has dark blocks`);
      const out = hammerWall(round, w.id);
      assert.equal(out.board.walls.length, round.board.walls.length - 1);
      assert.equal(out.hammers, START_BOOSTERS.hammer - 1);
      assert.ok(
        trappedCount(out.board) <= trappedCount(round.board),
        `seed ${seed}: a smashed block traps no more`,
      );
    }
    const round = startRound(18, 1);
    assert.deepEqual(hammerWall({ ...round, hammers: 0 }, round.board.walls[0].id), {
      ...round,
      hammers: 0,
    });
    assert.deepEqual(hammerWall(round, "nope"), round);
  });
  check("E5: stars: 45 % of the clock left or more = 3, 20 % = 2, less = 1", () => {
    assert.deepEqual(
      [100, 45, 44, 20, 19, 0].map((left) => crateStars(left, 100)),
      [3, 3, 2, 2, 1, 1],
    );
  });
  check("E6: the boosters on the screen are the four the rules have", () => {
    assert.deepEqual(START_BOOSTERS, { freeze: 2, rocket: 2, hammer: 2, undo: 3 });
  });

  console.log("F. The source");
  check("F1: no uncontrolled randomness or clocks in the rules", () => {
    const text = readFileSync("src/game/business/crateDispatch.ts", "utf8");
    assert.ok(!/Math\.random|Date\.now|performance\.now/.test(text));
  });
  check("F2: the crates never touch money, stock or the save", () => {
    const text = readFileSync("src/game/business/crateDispatch.ts", "utf8");
    assert.ok(!/SaveData|credits|ledger|inventory/i.test(text.replace(/\/\*[\s\S]*?\*\//g, "")));
  });
  check(
    "F3: the screen drags (pointer down, move, up), has the four boosters, and no longer loads the old arrow crates",
    () => {
      const game = readFileSync("src/components/kc/inventory/KitchenDispatchGame.tsx", "utf8");
      assert.ok(game.includes("onPointerDown={onDown}") && game.includes("onPointerMove={onMove}"));
      assert.ok(game.includes("dragBrick(") && game.includes("finishDrag("));
      for (const key of ["freeze", "rocket", "hammer", "undo"])
        assert.ok(game.includes(`"${key}"`), key);
      assert.ok(!/tapCrate|hintCrate|addTime/.test(game));
      const art = readFileSync("src/components/kc/inventory/kitchenDispatchArt.ts", "utf8");
      assert.ok(!art.includes("crate-2") && !art.includes("kdSheet"));
    },
  );
  // THE VAN'S CARGO. RULE CHANGE (developer 2026-11-27: "instead of repeated ingredients add our 50+ ingredients ... culinary and cutlery items, parcel items", matched to what the restaurant
  // orders without ever making a level easier): the 24 foods are now 140 items in 11 door colours, laid on the board after it is built. Z1-Z5 replace the old Z1-Z3 food checks; one door per
  // thing (developer 2026-11-18) stays.
  const cargo = await vite.ssrLoadModule("/src/game/business/crateCargo.ts");
  const { INGREDIENTS } = await vite.ssrLoadModule("/src/game/definitions.ts");
  const { SUPPLY_CATALOG } = await vite.ssrLoadModule("/src/game/business/businessSupplies.ts");
  const ownPictures = new Set([
    "tomato",
    "carrot",
    "lettuce",
    "onion",
    "cheddar",
    "salmon",
    "mushroom",
    "broccoli",
  ]);
  const doorsOf = (board: any) => board.gates.map((g: any) => board.cargo[g.color]);
  const shapeOf = (board: any) =>
    JSON.stringify([board.cols, board.bricks, board.walls, board.gates, board.trapped]);
  check(
    "Z1: 140 items, each with a picture the game already has and a short name; every one of the 57 ingredients is on the van",
    () => {
      const items = cargo.CARGO_ITEMS as any[];
      assert.equal(items.length, 140);
      assert.equal(new Set(items.map((c) => c.id)).size, 140);
      for (const family of cargo.CARGO_FAMILIES)
        assert.ok(cargo.CARGO_BY_FAMILY[family].length >= 3, family);
      assert.equal(
        new Set(Object.values(cargo.FAMILY_COLORS)).size,
        cargo.CARGO_FAMILIES.length,
        "every family its own colour",
      );
      // no two door colours that can share a board look alike (Lab distance; brown and cardboard never share one)
      const lab = (hex: string) => {
        const [r, g, b] = [1, 3, 5].map((k) => {
          const c = parseInt(hex.slice(k, k + 2), 16) / 255;
          return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
        }) as [number, number, number];
        const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
        const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
        const y = f(0.2126729 * r + 0.715152 * g + 0.072175 * b);
        const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
        return [116 * y - 16, 500 * (x - y), 200 * (y - z)] as const;
      };
      const names = cargo.CARGO_FAMILIES as string[];
      for (let i = 0; i < names.length; i++)
        for (let j = i + 1; j < names.length; j++) {
          if (`${names[i]} ${names[j]}` === "brown cardboard") continue;
          const p_ = lab(cargo.FAMILY_COLORS[names[i]!]);
          const q = lab(cargo.FAMILY_COLORS[names[j]!]);
          const gap = Math.hypot(p_[0] - q[0], p_[1] - q[1], p_[2] - q[2]);
          assert.ok(gap >= 23, `${names[i]} and ${names[j]} look alike (${gap.toFixed(0)})`);
        }
      for (const id of Object.keys(INGREDIENTS))
        assert.ok(
          items.some((c) => c.id === id && c.source === "ingredient"),
          `${id} is cargo`,
        );
      for (const c of items) {
        const folder =
          c.source === "ingredient"
            ? "ingredients"
            : c.source === "pantry"
              ? "sauce/products"
              : "supplies";
        const file = ownPictures.has(c.id)
          ? `public/business/cratedispatch/ingredient-${c.id}.webp`
          : `public/business/${folder}/${c.id}.webp`;
        assert.ok(existsSync(file), file);
        assert.ok(
          c.name.length >= 3 && c.name.length <= 18,
          `${c.name}: short enough for the slip`,
        );
      }
      // every supply the restaurant buys is on the van, as itself or as its near-twin
      for (const supply of SUPPLY_CATALOG)
        assert.ok(cargo.cargoIdOf(supply.id), `${supply.id} has a van item`);
    },
  );
  check(
    "Z2: one door per thing and per colour, never brown beside cardboard; all 140 items turn up across the levels and two weeks",
    () => {
      const seen = new Set<string>();
      for (let level = 18; level <= 91; level++)
        for (let day = 1; day <= 14; day++) {
          const seed = level * 1000003 + day * 9176;
          const slots = Array.from(
            { length: crateTierAt(level).colors },
            (_, i) => CRATE_INGREDIENTS[i],
          );
          const doors = Object.values(
            cargo.dressDoors(slots, cargo.NO_WISHES, { level, seed, trip: 0 }),
          ) as any[];
          assert.equal(doors.length, slots.length);
          assert.equal(
            new Set(doors.map((d) => d.item)).size,
            doors.length,
            `level ${level}: two doors show the same thing`,
          );
          assert.equal(
            new Set(doors.map((d) => d.family)).size,
            doors.length,
            `level ${level}: two doors share a colour`,
          );
          assert.ok(
            !(
              doors.some((d) => d.family === "brown") && doors.some((d) => d.family === "cardboard")
            ),
            `level ${level}: brown beside cardboard`,
          );
          for (const d of doors) {
            assert.equal(cargo.cargoItem(d.item).family, d.family);
            assert.ok(!d.tag, "nothing is waited for on an empty restaurant");
            seen.add(d.item);
          }
        }
      assert.equal(seen.size, 140, `only ${seen.size} of the 140 turn up`);
    },
  );
  check(
    "Z3: the board's shape NEVER depends on the orders: with nothing ordered or everything ordered it is the same board, only its cargo differs",
    () => {
      const busy = {
        delivered: Object.keys(INGREDIENTS),
        needed: SUPPLY_CATALOG.map((c: any) => c.id),
        menu: ["milk", "salmon"],
        yours: ["tomato"],
      };
      for (let level = 18; level <= 91; level += 3) {
        const seed = level * 1000003 + 9176;
        const plain = startRound(level, seed).board;
        const full = dressBoard(plain, busy, { level, seed, trip: 0 });
        assert.equal(shapeOf(full), shapeOf(plain), `level ${level}: orders changed the board`);
        assert.equal(doorsOf(full).length, crateTierAt(level).colors);
      }
    },
  );
  check(
    "Z4: what the restaurant waits for comes first, several of one colour take turns over the van's trips, and the rest of the catalogue keeps a door",
    () => {
      const slots = (n: number) => CRATE_INGREDIENTS.slice(0, n);
      const wishes = {
        delivered: ["tomato", "kraft-boxes"],
        needed: ["salmon", "teaspoons"],
        menu: ["milk"],
        yours: ["basil"],
      };
      for (let seed = 1; seed <= 40; seed++) {
        const doors = Object.values(
          cargo.dressDoors(slots(8), wishes, { level: 80, seed, trip: 0 }),
        ) as any[];
        const by = Object.fromEntries(doors.map((d) => [d.item, d.tag]));
        assert.deepEqual(
          [by.tomato, by["kraft-boxes"], by.salmon, by["soup-spoons"]],
          ["delivered", "delivered", "needed", "needed"],
          `seed ${seed}: teaspoons come as soup spoons`,
        );
        const wished = new Set(["tomato", "kraft-boxes", "salmon", "soup-spoons", "milk", "basil"]);
        assert.ok(
          doors.some((d) => !wished.has(d.item)),
          "at least one door from the rest of the catalogue",
        );
      }
      // a long shopping list (an empty fridge) takes at most half the doors, so the catalogue keeps turning up: on 8 doors, with 8 things listed, 3.5 or more doors on average carry something else
      const list = [
        "apple",
        "carrot",
        "lemon",
        "lettuce",
        "eggplant",
        "potato",
        "garlic",
        "chicken",
      ];
      let other = 0;
      for (let seed = 1; seed <= 40; seed++)
        other += (
          Object.values(
            cargo.dressDoors(
              slots(8),
              { delivered: [], needed: list, menu: [], yours: [] },
              { level: 80, seed, trip: 0 },
            ),
          ) as any[]
        ).filter((d) => !list.includes(d.item)).length;
      assert.ok(
        other / 40 >= 3.5,
        `only ${(other / 40).toFixed(1)} doors of 8 carry something else`,
      );
      // three green things on order: one a trip, all three within three trips
      const greens = {
        delivered: [],
        needed: ["lettuce", "basil", "spinach"],
        menu: [],
        yours: [],
      };
      const brought = new Set(
        [0, 1, 2].map(
          (trip) =>
            (
              Object.values(
                cargo.dressDoors(slots(5), greens, { level: 50, seed: 7 + trip, trip }),
              ) as any[]
            ).find((d) => d.family === "green")!.item,
        ),
      );
      assert.deepEqual([...brought].sort(), ["basil", "lettuce", "spinach"]);
      // a long order on a small board: every wanted colour comes within a few trips
      const many = {
        delivered: [],
        needed: ["apple", "carrot", "lemon", "lettuce", "eggplant", "potato", "garlic", "chicken"],
        menu: [],
        yours: [],
      };
      const got = new Set<string>();
      for (let trip = 0; trip < 8; trip++)
        for (const d of Object.values(
          cargo.dressDoors(slots(3), many, { level: 20, seed: 11 + trip, trip }),
        ) as any[])
          if (d.tag) got.add(d.item);
      assert.equal(got.size, 8, `only ${[...got].join(" ")} came`);
    },
  );
  const { DEFAULT_SAVE } = await vite.ssrLoadModule("/src/game/SaveManager.ts");
  const { cargoWishes } = await vite.ssrLoadModule("/src/game/restaurant/vanWishes.ts");
  const { serviceStockCheck } = await vite.ssrLoadModule("/src/game/restaurant/campaignStock.ts");
  const { ticketsFor } = await vite.ssrLoadModule("/src/game/restaurant/serviceTickets.ts");
  const { getLevel } = await vite.ssrLoadModule("/src/game/levels/LevelManager.ts");
  check(
    "Z5: from a real save the van carries today's purchases and what the next service is short of, and changes nothing in the save",
    () => {
      const save = structuredClone(DEFAULT_SAVE);
      save.levelProgress = {
        ...save.levelProgress,
        currentLevelId: "level-40",
        highestUnlockedLevelId: "level-40",
        completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
      };
      save.business.calendar.businessDay = 12;
      save.business.inventory = {
        kiwi: { ingredientId: "kiwi", quantity: 3, purchaseDay: 12 },
        onion: { ingredientId: "onion", quantity: 2, purchaseDay: 5 },
      } as any;
      const before = JSON.stringify(save);
      const wishes = cargoWishes(save);
      assert.equal(JSON.stringify(save), before, "reading the wishes changed the save");
      assert.ok(wishes.delivered.includes("kiwi"), "bought today");
      assert.ok(!wishes.delivered.includes("onion"), "bought last week is not today's delivery");
      const level = getLevel("level-40")!;
      const stock = serviceStockCheck(save, 40, ticketsFor(save.levelProgress, level).tickets);
      assert.ok(
        stock.applies && stock.missingRows.length > 0,
        "the sample save is short of something",
      );
      for (const row of stock.applies ? stock.missingRows : [])
        assert.ok(wishes.needed.includes(row.ingredientId), `needed: ${row.ingredientId}`);
      assert.ok(wishes.yours.length > 0, "the player's dishes");
      const seed = 40 * 1000003 + 12 * 9176;
      const board = dressBoard(startRound(40, seed).board, wishes, { level: 40, seed, trip: 0 });
      assert.ok(
        doorsOf(board).some((d: any) => d.tag === "delivered" && d.item === "kiwi"),
        "today's kiwis take a door",
      );
      assert.ok(
        doorsOf(board).some((d: any) => d.tag === "needed"),
        "something needed takes a door",
      );
    },
  );
  check(
    "Z6: the screen says where a crate goes, shows the delivery slip, and the cargo never touches money, stock or the save",
    () => {
      const game = readFileSync("src/components/kc/inventory/KitchenDispatchGame.tsx", "utf8");
      assert.ok(game.includes("Unload the Van") && !game.includes(">Kitchen Dispatch<"));
      assert.ok(
        /\$\{thing\} → the \$\{thing\} door/.test(game) && /door with the same picture/.test(game),
        "the hint on a touched crate and the line that tells what to do",
      );
      assert.ok(/✓ \$\{cargoName\(foodOf\(next\.board, brick\.color\)\)\} sent out/.test(game));
      assert.ok(
        game.includes('data-testid="kd-slip-open"') && game.includes("<DeliverySlip"),
        "the slip",
      );
      for (const file of [
        "src/game/business/crateCargo.ts",
        "src/game/restaurant/vanWishes.ts",
        "src/components/kc/inventory/DeliverySlip.tsx",
      ]) {
        const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
        assert.ok(
          !/Math\.random|Date\.now|persist|writeSave|updateSave|appendLedger|credits|purchaseIngredient|purchaseSupply/.test(
            text,
          ),
          `${file}: reads only`,
        );
      }
    },
  );
  const art = await vite.ssrLoadModule("/src/components/kc/inventory/kitchenDispatchArt.ts");
  check(
    "Z7: the developer's cargo art (2026-11-27): every item travels in one of six crates by what it is; each skin, both badges and the slip are in the game, small and the size the drawing expects",
    () => {
      const chilled = [
        "chicken",
        "steak",
        "salmon",
        "milk",
        "yogurt",
        "cream",
        "butter",
        "cheddar",
        "mozzarella",
      ];
      const used = new Set<string>();
      for (const c of cargo.CARGO_ITEMS as any[]) {
        const skin = cargo.crateSkinOf(c.id) as string;
        const expected = chilled.includes(c.id)
          ? "cold"
          : c.family === "cardboard"
            ? "parcel"
            : c.family === "teal"
              ? "tableware"
              : c.family === "blue"
                ? "cleaning"
                : c.source === "pantry"
                  ? "pantry"
                  : "produce";
        assert.equal(skin, expected, `${c.id} travels in the ${expected} crate`);
        used.add(skin);
      }
      for (const id of chilled) assert.ok(cargo.cargoItem(id), `${id} is cargo`);
      assert.deepEqual([...used].sort(), [...(cargo.CRATE_SKINS as string[])].sort());
      /** A WebP file's width and height, from its header. */
      const size = (file: string) => {
        const b = readFileSync(file);
        const kind = b.toString("latin1", 12, 16);
        if (kind === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
        if (kind === "VP8L") {
          const bits = b.readUInt32LE(21);
          return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
        }
        return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
      };
      const expect = [
        ...(cargo.CRATE_SKINS as string[]).map(
          (k) => [`skin-${k}`, art.SKIN_SIZE, art.SKIN_SIZE, 20] as const,
        ),
        ["tag-delivered", 96, 96, 12] as const,
        ["tag-needed", 96, 96, 12] as const,
        ["slip", art.SLIP_SIZE.w, art.SLIP_SIZE.h, 60] as const,
      ];
      for (const [name, w, h, mostKB] of expect) {
        const file = `public/business/cratedispatch/${name}.webp`;
        assert.ok(existsSync(file), file);
        assert.deepEqual(size(file), [w, h], `${name}: ${size(file).join("x")}`);
        assert.ok(readFileSync(file).length <= mostKB * 1024, `${name} is small`);
      }
      // the cutter and the drawing agree on the nine-slice
      const cutter = readFileSync("scripts/make-van-cargo-assets.py", "utf8");
      assert.ok(new RegExp(`^SKIN_SIZE = ${art.SKIN_SIZE}\\b`, "m").test(cutter));
      assert.ok(new RegExp(`^SKIN_SLICE = ${art.SKIN_SLICE}\\b`, "m").test(cutter));
      // the colour a player matches to a door stays the crate's own: the skin is laid over it with hard-light, and the plain crate is still drawn without it
      const draw = readFileSync("src/components/kc/inventory/kitchenDispatchDraw.ts", "utf8");
      assert.ok(/globalCompositeOperation = "hard-light"/.test(draw));
      assert.ok(/if \(skin\) drawSkin\(/.test(draw), "a crate without its skin yet is drawn plain");
    },
  );
  const levels = await vite.ssrLoadModule("/src/game/business/miniGameLevels.ts");
  check(
    "level picker (developer 2026-11-26): every level 18 to 91 is listed once with its board, and each can be played",
    () => {
      const list = levels.VAN_LEVELS as number[];
      assert.deepEqual(
        list,
        Array.from({ length: 74 }, (_, i) => 18 + i),
      );
      for (const level of list) {
        // RULE CHANGE (developer 2026-11-27): the picker's line also says how many crates are blocked
        assert.match(
          levels.vanLevelLine(level) as string,
          /^\d×\d · \d+(-\d+)? crates( · \d+ blocked)?$/,
        );
        const round = startRound(level, level * 1000003 + 9176);
        assert.ok(round.board.bricks.length > 0);
      }
      const game = readFileSync("src/components/kc/inventory/KitchenDispatchGame.tsx", "utf8");
      assert.ok(
        game.includes('data-testid="kd-choose"') &&
          game.includes('data-testid="kd-levels"') &&
          game.includes("<LevelPicker"),
        "the badge and the result card open the picker",
      );
    },
  );
} finally {
  await vite.close();
}
console.log(
  failures ? `\nCRATE DISPATCH QA: ${failures} FAILURE(S)` : "\nCRATE DISPATCH QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
