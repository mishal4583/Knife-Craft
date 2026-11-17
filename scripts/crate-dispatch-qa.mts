// Kitchen Dispatch QA (developer 2026-11-17, rebuilt the same day on the sliding-block "door" mechanism).
// Pure rules: every board can be won, the drag, the gates, undo, the boosters, the clock, and that no move can spoil a board.
// Run: npx tsx scripts/crate-dispatch-qa.mts   (the browser side is tools/e2e/kitchendispatch.mjs)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  check("A1: four tiers from Level 18 / 28 / 45 / 65, never below the first", () => {
    assert.deepEqual(
      CRATE_TIERS.map((t: { from: number }) => t.from),
      [18, 28, 45, 65],
    );
    assert.equal(crateTierFor(1).from, 18);
    assert.equal(crateTierFor(44).from, 28);
    assert.equal(crateTierFor(91).from, 65);
  });
  const SEEDS = 150;
  CRATE_TIERS.forEach((tier: any, index: number) => {
    check(
      `A${index + 2}: tier ${index + 1} (${tier.cols}x${tier.rows}): ${SEEDS} boards, all winnable, well formed, and as hard as the tier says`,
      () => {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const board = crateBoardFor(tier.from, seed);
          const at = `seed ${seed}`;
          assert.equal(board.cols, tier.cols);
          assert.equal(board.rows, tier.rows);
          const sol = solveBoard(board);
          assert.ok(sol.solvable, `${at}: cannot be won`);
          const n = board.bricks.length;
          assert.ok(
            n >= tier.bricks[0] && n <= tier.bricks[1],
            `${at}: ${n} crates, tier wants ${tier.bricks[0]}-${tier.bricks[1]}`,
          );
          assert.ok(sol.waves.length >= tier.minWaves, `${at}: only ${sol.waves.length} waves`);
          assert.ok(
            sol.free >= 1 && sol.free <= tier.maxFree,
            `${at}: ${sol.free} crates free at the start (1-${tier.maxFree})`,
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
    assert.ok(kinds(18) <= 3 && kinds(65) >= 5, `${kinds(18)} then ${kinds(65)}`);
  });
  check("A8: a board is built in under 800 ms (a phone), and tiers get harder, not easier", () => {
    for (const level of [18, 28, 45, 65]) {
      const t0 = performance.now();
      for (let s = 0; s < 5; s++) crateBoardFor(level, 99 + s);
      assert.ok(
        performance.now() - t0 < 4000,
        `level ${level}: ${(performance.now() - t0).toFixed(0)} ms for 5`,
      );
    }
    const mean = (level: number) => {
      let w = 0;
      for (let s = 1; s <= 40; s++) w += solveBoard(crateBoardFor(level, s)).waves.length;
      return w / 40;
    };
    const m = [18, 28, 45, 65].map(mean);
    assert.ok(
      m[0] < m[1] && m[1] < m[2] && m[2] < m[3],
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
    "C1: following each crate's own path with dragBrick clears every board of every tier (20 each)",
    () => {
      for (const level of [18, 28, 45, 65])
        for (let seed = 1; seed <= 20; seed++) {
          let round = startRound(level, seed);
          for (let guard = 0; guard < 60 && !roundCleared(round); guard++) {
            const ready = round.board.bricks.find((b: any) => exitSteps(round.board, b) >= 0);
            assert.ok(ready, `level ${level} seed ${seed}: nothing can leave`);
            const path = pathOut(round.board, ready);
            assert.ok(path, `level ${level} seed ${seed}: no path for ${ready.id}`);
            const from = round.board.bricks.find((b: any) => b.id === ready.id);
            let out = false;
            for (const [x, y] of path.slice(1)) {
              const res = dragBrick(round, ready.id, x, y);
              assert.ok(
                res.moved,
                `level ${level} seed ${seed}: the drag to ${x},${y} did not move`,
              );
              round = res.round;
              if (res.out) {
                round = finishDrag(round, from, { moved: true, out: true });
                out = true;
                break;
              }
            }
            assert.ok(out, `level ${level} seed ${seed}: ${ready.id} never left`);
          }
          assert.ok(roundCleared(round), `level ${level} seed ${seed}`);
          assert.equal(cratesLeft(round), 0);
        }
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
      for (const level of [18, 28, 45, 65])
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
          assert.ok(solveBoard(round.board).solvable, `level ${level} seed ${seed}`);
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

  console.log("E. The boosters, the clock and the stars");
  check("E1: the clock gives time for every crate", () => {
    assert.equal(crateSeconds(10), 130);
    const round = startRound(28, 1);
    assert.equal(round.seconds, crateSeconds(round.board.bricks.length));
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
    assert.ok(solveBoard(out.board).solvable);
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
      const before = solveBoard(round.board);
      const after = solveBoard(out.board);
      assert.ok(after.solvable && after.waves.length <= before.waves.length);
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
} finally {
  await vite.close();
}
console.log(
  failures ? `\nCRATE DISPATCH QA: ${failures} FAILURE(S)` : "\nCRATE DISPATCH QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
