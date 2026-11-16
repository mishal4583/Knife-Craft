// Kitchen Dispatch QA (developer 2026-11-17). Pure rules: every board solvable, the moves, undo, time, hints, gates.
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
  const park = await vite.ssrLoadModule("/src/game/business/carPark.ts");
  const {
    CRATE_TIERS,
    CRATE_INGREDIENTS,
    CRATE_COLORS,
    crateTierFor,
    crateBoardFor,
    crateSeconds,
    startRound,
    tapCrate,
    undoRound,
    addTime,
    hintCrate,
    spendHint,
    crateStars,
    crateSolution,
    gatesOf,
    crateSide,
    roundCleared,
    cratesLeft,
    EXTRA_TIME_SECONDS,
    START_BOOSTERS,
  } = rules;

  console.log("A. Every board is solvable, and fits its tier");
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
      `A${index + 2}: tier ${index + 1} (${tier.cols}x${tier.rows}): ${SEEDS} boards, all solvable and in bounds`,
      () => {
        let hardEnough = 0;
        for (let seed = 1; seed <= SEEDS; seed++) {
          const board = crateBoardFor(tier.from, seed);
          assert.equal(board.cols, tier.cols);
          assert.equal(board.rows, tier.rows);
          assert.ok(crateSolution(board), `seed ${seed}: not solvable`);
          const n = board.vehicles.length;
          assert.ok(
            n >= tier.minVehicles && n <= tier.maxVehicles,
            `seed ${seed}: ${n} crates, tier wants ${tier.minVehicles}-${tier.maxVehicles}`,
          );
          const taken = new Set<string>();
          for (const c of board.vehicles) {
            assert.ok(
              tier.lengths.includes(c.length),
              `seed ${seed}: a crate of ${c.length} cells`,
            );
            assert.ok(c.length === 2 || c.length === 3, "the painted crates are 2 and 3 cells");
            for (let i = 0; i < c.length; i++) {
              const x = c.axis === "h" ? c.x + i : c.x;
              const y = c.axis === "v" ? c.y + i : c.y;
              assert.ok(
                x >= 0 && y >= 0 && x < board.cols && y < board.rows,
                `seed ${seed}: out of the board`,
              );
              const key = `${x},${y}`;
              assert.ok(!taken.has(key), `seed ${seed}: two crates on ${key}`);
              taken.add(key);
            }
            assert.ok(
              (CRATE_INGREDIENTS as readonly string[]).includes(c.color),
              `seed ${seed}: unknown ingredient ${c.color}`,
            );
          }
          const free = board.vehicles.filter((c: any) => park.canLeave(board, c.id)).length;
          if (free >= tier.minFree && free <= tier.maxFree) hardEnough += 1;
        }
        assert.ok(
          hardEnough / SEEDS >= 0.8,
          `only ${hardEnough}/${SEEDS} boards start with ${tier.minFree}-${tier.maxFree} crates free`,
        );
      },
    );
  });
  check("A6: the same level and seed is the same board; another seed is another board", () => {
    assert.deepEqual(crateBoardFor(28, 7), crateBoardFor(28, 7));
    assert.notDeepEqual(crateBoardFor(28, 7), crateBoardFor(28, 8));
  });
  check(
    "A7: ingredients are dealt like a deck: a board of 8 or more shows at least 6 kinds",
    () => {
      for (let seed = 1; seed <= 40; seed++) {
        const board = crateBoardFor(45, seed);
        assert.ok(new Set(board.vehicles.map((c: any) => c.color)).size >= 6, `seed ${seed}`);
      }
      for (const name of CRATE_INGREDIENTS) assert.match(CRATE_COLORS[name], /^#[0-9A-F]{6}$/);
      assert.equal(
        new Set(Object.values(CRATE_COLORS)).size,
        CRATE_INGREDIENTS.length,
        "a colour for each, all different",
      );
    },
  );
  check("A8: a board is built in under 800 ms (a phone)", () => {
    for (const level of [18, 28, 45, 65]) {
      const t0 = performance.now();
      crateBoardFor(level, 99);
      assert.ok(
        performance.now() - t0 < 800,
        `level ${level}: ${(performance.now() - t0).toFixed(0)} ms`,
      );
    }
  });

  console.log("B. The moves");
  check("B1: a free crate leaves; the board loses exactly it and it is remembered", () => {
    const round = startRound(28, 3);
    const free = round.board.vehicles.find((c: any) => park.canLeave(round.board, c.id));
    const out = tapCrate(round, free.id);
    assert.equal(out.kind, "out");
    assert.equal(out.round.board.vehicles.length, round.board.vehicles.length - 1);
    assert.equal(out.round.gone.length, 1);
    assert.equal(out.round.blocked, 0);
  });
  check("B2: a blocked crate stays, the tap is counted, and it says who is in the way", () => {
    const round = startRound(45, 5);
    const stuck = round.board.vehicles.find((c: any) => !park.canLeave(round.board, c.id));
    assert.ok(stuck, "a tier 3 board starts with a blocked crate");
    const res = tapCrate(round, stuck.id);
    assert.equal(res.kind, "blocked");
    assert.deepEqual(res.round.board, round.board);
    assert.equal(res.round.blocked, 1);
    assert.ok(res.by.length >= 1);
  });
  check("B3: a crate that is not there is ignored", () => {
    const round = startRound(18, 1);
    assert.equal(tapCrate(round, "nope").kind, "none");
  });
  check(
    "B4: taking the crates in the proven order clears every board with no blocked tap and 3 stars",
    () => {
      for (const level of [18, 28, 45, 65])
        for (let seed = 1; seed <= 20; seed++) {
          let round = startRound(level, seed);
          for (const id of crateSolution(round.board)) {
            const res = tapCrate(round, id);
            assert.equal(res.kind, "out", `level ${level} seed ${seed}`);
            round = res.round;
          }
          assert.ok(roundCleared(round));
          assert.equal(cratesLeft(round), 0);
          assert.equal(crateStars(round.blocked), 3);
        }
    },
  );
  check("B5: stars: 0 blocked taps = 3, 1 or 2 = 2, more = 1", () => {
    assert.deepEqual([0, 1, 2, 3, 9].map(crateStars), [3, 2, 2, 1, 1]);
  });

  console.log("C. Undo, time and hints");
  check("C1: Undo puts the last crate back exactly where it was and costs one Undo", () => {
    const round = startRound(28, 4);
    const free = round.board.vehicles.find((c: any) => park.canLeave(round.board, c.id));
    const out = tapCrate(round, free.id).round;
    const back = undoRound(out);
    assert.equal(back.undos, START_BOOSTERS.undo - 1);
    assert.equal(back.gone.length, 0);
    const restored = back.board.vehicles.find((c: any) => c.id === free.id);
    assert.deepEqual(restored, free);
    assert.ok(crateSolution(back.board), "the board is still solvable after Undo");
  });
  check("C2: Undo with nothing to undo, or none left, changes nothing", () => {
    const fresh = startRound(18, 2);
    assert.deepEqual(undoRound(fresh), fresh);
    let round = fresh;
    const free = round.board.vehicles.find((c: any) => park.canLeave(round.board, c.id));
    round = { ...tapCrate(round, free.id).round, undos: 0 };
    assert.deepEqual(undoRound(round), round);
  });
  check("C3: the clock gives time for every crate; Extra Time adds 20 s and costs one", () => {
    assert.equal(crateSeconds(10), 100);
    const round = startRound(28, 1);
    assert.equal(round.seconds, crateSeconds(round.board.vehicles.length));
    const more = addTime(round);
    assert.equal(more.seconds, round.seconds + EXTRA_TIME_SECONDS);
    assert.equal(more.extras, START_BOOSTERS.time - 1);
    assert.deepEqual(addTime({ ...round, extras: 0 }), { ...round, extras: 0 });
  });
  check("C4: a hint names a crate that can leave now, and costs one Hint", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const round = startRound(45, seed);
      const id = hintCrate(round);
      assert.ok(id && park.canLeave(round.board, id), `seed ${seed}`);
    }
    const round = startRound(18, 1);
    assert.equal(spendHint(round).hints, START_BOOSTERS.hint - 1);
    assert.deepEqual(spendHint({ ...round, hints: 0 }), { ...round, hints: 0 });
    assert.equal(hintCrate({ ...round, board: { ...round.board, vehicles: [] } }), null);
  });
  check("C5: following hints alone clears a board", () => {
    let round = startRound(45, 6);
    for (let guard = 0; guard < 60 && !roundCleared(round); guard++) {
      const id = hintCrate(round);
      assert.ok(id);
      round = tapCrate(round, id).round;
    }
    assert.ok(roundCleared(round), "a hint is always a move that makes progress");
    assert.equal(round.blocked, 0);
  });

  console.log("D. The gates and the source");
  check("D1: every crate's line has a gate on the side it leaves by", () => {
    const board = crateBoardFor(45, 11);
    const gates = gatesOf(board);
    for (const c of board.vehicles) {
      const side = crateSide(c);
      const index = c.axis === "h" ? c.y : c.x;
      assert.ok(
        gates.some((g: any) => g.side === side && g.index === index),
        `${c.id}`,
      );
      assert.equal(
        side,
        c.axis === "h" ? (c.dir < 0 ? "left" : "right") : c.dir < 0 ? "top" : "bottom",
      );
    }
    assert.equal(
      new Set(gates.map((g: any) => g.side + g.index)).size,
      gates.length,
      "one gate a line",
    );
  });
  check("D2: no uncontrolled randomness or clocks in the rules", () => {
    const text = readFileSync("src/game/business/crateDispatch.ts", "utf8");
    assert.ok(!/Math\.random|Date\.now|performance\.now/.test(text));
  });
  check("D3: the crates never touch money, stock or the save", () => {
    const text = readFileSync("src/game/business/crateDispatch.ts", "utf8");
    assert.ok(!/SaveData|credits|ledger|inventory/i.test(text.replace(/\/\*[\s\S]*?\*\//g, "")));
  });
} finally {
  await vite.close();
}
console.log(
  failures ? `\nCRATE DISPATCH QA: ${failures} FAILURE(S)` : "\nCRATE DISPATCH QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
