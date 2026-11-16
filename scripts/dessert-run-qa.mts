// Dessert Run QA (developer 2026-11-16, replaces plating-belt-qa). Pure rules, the gallery, every shipped plate.
// Run: npx tsx scripts/dessert-run-qa.mts   (about half a minute: it replays every shipped plate twice)
// The browser side is tools/e2e/dessertrun.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const vite = await createServer({
  configFile: "vite.config.ts",
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});
try {
  const run = await vite.ssrLoadModule("/src/game/business/dessertRun.ts");
  const gallery = await vite.ssrLoadModule("/src/game/business/dessertGallery.ts");
  const content = await vite.ssrLoadModule("/src/game/business/dessertRunContent.ts");
  const { DESSERT_RUN_SEEDS } = await vite.ssrLoadModule("/src/game/business/dessertSeeds.ts");
  const draw = await vite.ssrLoadModule("/src/components/kc/inventory/dessertRunDraw.ts");
  const { makeSeededRand } = await vite.ssrLoadModule(
    "/src/game/business/businessDeterministicRandom.ts",
  );
  const { RUN_TIERS, STEP } = run;
  const { DESSERTS, DESSERTS_BY_TIER, RUN_PALETTE, GRID } = gallery;
  type Id = "cookie" | "donut" | "tart" | "pancake";

  // ---- A. Tiers ----------------------------------------------------------------------------------
  assert.equal(RUN_TIERS.length, 4);
  assert.deepEqual(
    RUN_TIERS.map((t: { fromLevel: number }) => t.fromLevel),
    [18, 28, 45, 65],
  );
  assert.deepEqual(
    RUN_TIERS.map((t: { lanes: number }) => t.lanes),
    [3, 3, 4, 5],
  );
  assert.equal(run.runTierForLevel(17).id, 1, "below Level 18 still reads the first tier");
  assert.equal(run.runTierForLevel(44).id, 2);
  assert.equal(run.runTierForLevel(91).id, 4);
  console.log("PASS A tiers: Levels 18 / 28 / 45 / 65, lanes 3 / 3 / 4 / 5");

  // ---- B. The gallery ----------------------------------------------------------------------------
  assert.equal(GRID, 24);
  assert.equal(Object.keys(RUN_PALETTE).length, 10, "ten cube colours");
  const cubes: Record<string, number> = {};
  for (const id of Object.keys(DESSERTS) as Id[]) {
    const d = DESSERTS[id];
    const grid: Int8Array = d.build();
    assert.equal(grid.length, GRID * GRID);
    const per = new Array(d.keys.length).fill(0);
    grid.forEach((v) => {
      assert.ok(v >= -1 && v < d.keys.length, `${id}: colour index ${v} outside its keys`);
      if (v >= 0) per[v]++;
    });
    per.forEach((n, k) => assert.ok(n >= 4, `${id}: colour ${d.keys[k]} has only ${n} cubes`));
    d.keys.forEach((key: string) => assert.ok(key in RUN_PALETTE, `${id}: unknown colour ${key}`));
    assert.equal(new Set(d.keys).size, d.keys.length, `${id}: a colour is listed twice`);
    assert.ok(d.keys.length >= 3 && d.keys.length <= 6, `${id}: 3 to 6 colours`);
    // nothing sits in a corner: the dessert is a round plate
    for (const c of [0, GRID - 1, (GRID - 1) * GRID, GRID * GRID - 1])
      assert.equal(grid[c], -1, `${id}: corner ${c} must be empty`);
    cubes[id] = per.reduce((a: number, b: number) => a + b, 0);
    assert.deepEqual(d.build(), grid, `${id}: the build is the same every time`);
  }
  assert.deepEqual(cubes, { cookie: 345, donut: 336, tart: 392, pancake: 384 });
  for (const tier of RUN_TIERS)
    for (const id of DESSERTS_BY_TIER[tier.id])
      assert.equal(
        DESSERTS[id as Id].tier <= tier.id,
        true,
        `${id} is not harder than tier ${tier.id}`,
      );
  console.log("PASS B gallery: 4 desserts, 10 palette colours, cube counts", JSON.stringify(cubes));

  // ---- C. Source guard: the plate must be the same on every browser -------------------------------
  for (const file of [
    "src/game/business/dessertRun.ts",
    "src/game/business/dessertGallery.ts",
    "src/game/business/dessertRunContent.ts",
  ]) {
    const text = readFileSync(file, "utf8");
    assert.ok(
      !/Math\.random|Date\.now|performance\.now/.test(text),
      `${file}: no uncontrolled randomness or clocks`,
    );
  }
  console.log("PASS C source: no Math.random, Date.now or performance.now in the rules");

  // ---- D. Rules ----------------------------------------------------------------------------------
  // D1 reachable = touches the outside; a donut's hole counts only once it is opened
  {
    const donut = DESSERTS.donut.build();
    const ext = run.computeExt(donut);
    const hole = donut.findIndex((v: number, i: number) => v === -1 && i === 12 * GRID + 12);
    assert.ok(hole >= 0 && ext[hole] === 0, "the donut's hole starts closed");
    // a cube touching only the hole (and other cubes) is not reachable
    let sealed = -1;
    for (let i = 0; i < donut.length && sealed < 0; i++)
      if (donut[i] >= 0 && !run.isExposed(ext, i)) sealed = i;
    assert.ok(sealed >= 0, "some donut cubes start out of reach");
    // open a corridor along row 12 from the right edge in to the hole
    const g = donut.slice();
    const e = run.computeExt(g);
    for (let x = GRID - 1; x >= 12; x--)
      if (g[12 * GRID + x] >= 0) run.removeCell(g, e, 12 * GRID + x);
    assert.equal(e[hole], 1, "opening a corridor to the hole makes the hole outside");
    console.log(
      "PASS D1 reach: the cubes behind the hole are out of reach until a corridor opens it",
    );
  }
  // D2 taps
  {
    const tier = RUN_TIERS[0];
    const s = run.makeRun("cookie", 1, tier);
    assert.equal(run.tapLane(s, 0), "sent");
    assert.equal(s.spots.filter(Boolean).length, 1);
    assert.equal(run.tapLane(s, 99), "empty", "a lane that does not exist is empty");
    for (let i = 0; i < 4; i++) run.tapLane(s, i % 3);
    const lanesBefore = JSON.stringify(s.lanes);
    if (s.spots.every(Boolean)) {
      assert.equal(run.tapLane(s, 0), "full");
      assert.equal(JSON.stringify(s.lanes), lanesBefore, "a refused tap changes nothing");
    }
    s.lanes = [[], [], []];
    assert.equal(
      run.tapLane(s, 0),
      s.spots.every(Boolean) ? "empty" : "empty",
      "an empty lane refuses",
    );
    console.log(
      "PASS D2 taps: sent to a free spot; a full row or an empty lane refuses and changes nothing",
    );
  }
  // D3 a waiter with nothing reachable waits, and goes on by itself
  {
    const tier = RUN_TIERS[0];
    const s = run.makeRun("donut", 1, tier);
    const hex = (k: number) => RUN_PALETTE[s.dessert.keys[k]];
    assert.equal(run.reachableCells(s, 1).length, 0, "the donut's glaze starts under the dough");
    assert.ok(run.reachableCells(s, 0).length > 0, "the dough is on the outside");
    s.lanes = [[{ k: 1, n: 1, hex: hex(1) }], [{ k: 0, n: 60, hex: hex(0) }], []];
    run.tapLane(s, 0);
    for (let i = 0; i < 120; i++) run.stepRun(s, STEP, 1);
    assert.equal(
      run.isWaiting(s, s.spots[0]),
      true,
      "a glaze waiter waits while the dough covers it",
    );
    assert.equal(s.phase, "play", "one waiting waiter with a free spot is not a jam");
    run.tapLane(s, 1);
    let guard = 0;
    while (s.spots[0] && guard++ < 30_000) run.stepRun(s, STEP, 1);
    assert.equal(
      s.spots[0],
      null,
      "the waiting waiter went on by itself once the way opened, and left",
    );
    assert.ok(s.delivered >= 1);
    console.log(
      "PASS D3 waiting: a buried colour waits, then resumes by itself when the way opens",
    );
  }
  // D4 a jam: every spot waiting
  {
    const s = run.makeRun("donut", 1, RUN_TIERS[0]);
    const glaze = { k: 1, n: 1, hex: RUN_PALETTE[s.dessert.keys[1]] };
    s.lanes = [[{ ...glaze }, { ...glaze }, { ...glaze }], [{ ...glaze }, { ...glaze }], []];
    for (let i = 0; i < 5; i++) run.tapLane(s, i % 2);
    for (let i = 0; i < 400 && s.phase === "play"; i++) run.stepRun(s, STEP, 1);
    assert.equal(s.phase, "jam", "five waiters, none reachable: the kitchen is jammed");
    assert.equal(run.tapLane(s, 0), "over", "no tap after a jam");
    const again = run.makeRun("donut", 1, RUN_TIERS[0]);
    assert.deepEqual(again.grid, run.makeRun("donut", 1, RUN_TIERS[0]).grid);
    assert.deepEqual(
      again.lanes,
      run.makeRun("donut", 1, RUN_TIERS[0]).lanes,
      "Try again deals the same plate",
    );
    console.log("PASS D4 jam: all five spots waiting is a jam; Try again is the same plate");
  }
  // D5 a win, and the guests
  {
    const tier = RUN_TIERS[1];
    const s = run.makeRun("tart", 7, tier);
    const result = run.playDeckOrder(s, tier);
    assert.equal(result.won, true);
    assert.equal(s.delivered, s.total);
    assert.equal(s.flights.length, 0);
    assert.equal(
      s.grid.every((v: number) => v === -1),
      true,
      "the dessert is gone",
    );
    assert.equal(
      s.need.reduce((a: number, b: number) => a + b, 0),
      s.total,
      "the four guests share the plate",
    );
    s.served.forEach((list: number[], j: number) =>
      assert.equal(list.length, s.need[j], `guest ${j} is full`),
    );
    assert.ok(Math.max(...s.need) - Math.min(...s.need) <= 1, "guests are served by even quarters");
    assert.equal(run.runWon(s), true);
    console.log("PASS D5 win: every cube served, four even quarters, the dessert gone");
  }
  // D6 stars
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(run.starsForPeakWaiting), [3, 3, 3, 2, 2, 1]);
  console.log("PASS D6 stars: at most 2 waiting = 3, 3 or 4 = 2, 5 = 1");

  // ---- E. Shipped plates --------------------------------------------------------------------------
  const wanted = new Set<string>();
  for (const tier of RUN_TIERS)
    for (const id of DESSERTS_BY_TIER[tier.id]) wanted.add(`${id}-${tier.id}`);
  assert.deepEqual(
    Object.keys(DESSERT_RUN_SEEDS).sort(),
    [...wanted].sort(),
    "seed lists match the gallery by tier",
  );
  let plates = 0;
  let longest = 0;
  for (const key of Object.keys(DESSERT_RUN_SEEDS)) {
    const [id, tierId] = key.split("-") as [Id, string];
    const tier = RUN_TIERS[Number(tierId) - 1];
    const seeds: number[] = DESSERT_RUN_SEEDS[key];
    assert.equal(seeds.length, 60, `${key}: 60 seeds`);
    assert.equal(new Set(seeds).size, 60, `${key}: seeds are distinct`);
    for (const seed of seeds) {
      const round = run.makeRun(id, seed, tier);
      assert.equal(run.runDeckProblem(round, tier), null, `${key} ${seed}: deck follows the plan`);
      const onTime = run.playDeckOrder(run.makeRun(id, seed, tier), tier);
      assert.equal(onTime.won, true, `${key} ${seed}: not won in deck order`);
      longest = Math.max(longest, onTime.steps);
      const late = makeSeededRand(seed);
      const slow = run.playDeckOrder(run.makeRun(id, seed, tier), tier, () =>
        Math.floor(late() * 240),
      );
      assert.equal(slow.won, true, `${key} ${seed}: a late player turns it into a jam`);
      plates += 1;
    }
  }
  console.log(
    `PASS E plates: ${plates} shipped plates won in deck order, on time and with taps up to 4 s late (longest ${(longest * STEP).toFixed(0)} s at x1)`,
  );

  // ---- F. Difficulty band --------------------------------------------------------------------------
  // Careless play: a random front waiter whenever a spot is free. Measured 2026-11-16: tier 1 about 95 %, tier 4 about 15 %.
  const careless = (id: Id, tier: (typeof RUN_TIERS)[number], seed: number) => {
    const s = run.makeRun(id, seed, tier);
    const rnd = makeSeededRand(seed ^ 0x51ed);
    let guard = 0;
    while (s.phase === "play" && guard++ < 150_000) {
      if (s.spots.indexOf(null) >= 0 && rnd() < 0.2) {
        const open = s.lanes
          .map((l: unknown[], i: number) => (l.length ? i : -1))
          .filter((i: number) => i >= 0);
        if (open.length) run.tapLane(s, open[Math.floor(rnd() * open.length)]);
      }
      run.stepRun(s, STEP, 1);
    }
    return s.phase === "won";
  };
  const rate: number[] = [];
  for (const tier of RUN_TIERS) {
    let won = 0;
    let n = 0;
    for (const id of DESSERTS_BY_TIER[tier.id])
      for (const seed of DESSERT_RUN_SEEDS[`${id}-${tier.id}`].slice(0, 20)) {
        n += 1;
        won += Number(careless(id as Id, tier, seed));
      }
    rate.push(won / n);
  }
  console.log(
    "     careless wins by tier:",
    rate.map((r) => `${Math.round(r * 100)}%`).join(" / "),
  );
  assert.ok(rate[0] >= 0.7, "tier 1 is gentle: careless play wins most plates");
  assert.ok(rate[3] <= 0.5, "tier 4 is not won by careless play");
  assert.ok(rate[0] - rate[3] >= 0.25, "the tiers get harder");
  console.log("PASS F difficulty: tier 1 gentle, tier 4 hard, in between in order");

  // ---- G. Which plate a level gets -----------------------------------------------------------------
  {
    const a = content.dessertRunFor(18, 3);
    assert.deepEqual(content.dessertRunFor(18, 3), a, "the same level and day is the same plate");
    assert.equal(a.tier.id, 1);
    assert.equal(content.dessertRunFor(17, 3).tier.id, 1);
    assert.notDeepEqual(content.dessertRunFor(18, 3, 1), a, "round + 1 is another plate");
    for (let level = 18; level <= 91; level += 7)
      for (let day = 1; day <= 9; day++)
        for (let round = 0; round < 4; round++) {
          const p = content.dessertRunFor(level, day, round);
          assert.ok(DESSERTS_BY_TIER[p.tier.id].includes(p.dessertId));
          assert.ok(
            DESSERT_RUN_SEEDS[`${p.dessertId}-${p.tier.id}`].includes(p.seed),
            "only proven seeds are dealt",
          );
        }
    console.log(
      "PASS G choice: the plate follows the level, the day and the round, from proven seeds only",
    );
  }

  // ---- H. Layout -----------------------------------------------------------------------------------
  {
    const { STAGE, SPOT_COUNT, SPOT_W, spotCenter, QUEUE } = run;
    for (let i = 1; i < SPOT_COUNT; i++)
      assert.ok(spotCenter(i).x - spotCenter(i - 1).x >= SPOT_W, "standby spots do not overlap");
    assert.ok(
      spotCenter(0).x - SPOT_W / 2 >= 0 && spotCenter(SPOT_COUNT - 1).x + SPOT_W / 2 <= STAGE.w,
    );
    assert.ok(run.PLATE.y - run.PLATE.r >= 80, "the plate clears the header buttons");
    assert.ok(run.ORIGIN.y + GRID * run.CELL <= run.ENTRY.y, "the dessert ends above the aisle");
    for (const tier of RUN_TIERS) {
      for (let lane = 0; lane < tier.lanes; lane++) {
        const box = draw.laneBox(lane, tier.lanes);
        // 320 px phone: the whole lane column is the target, never smaller than 48 px
        assert.ok(
          (box.w * 320) / STAGE.w >= 48,
          `tier ${tier.id}: lane ${lane} is 48 px wide on a 320 px phone`,
        );
        assert.ok((box.h * 320) / STAGE.w >= 48);
        assert.ok(box.y + box.h <= STAGE.h);
        assert.equal(draw.laneAt(box.x + box.w / 2, box.y + 10, tier.lanes), lane);
      }
      assert.ok(QUEUE.y >= spotCenter(0).y + 46, "the queue starts below the spots");
    }
    console.log(
      "PASS H layout: spots, plate, aisle and lane columns fit the 540 x 960 stage; lane targets are 48 px",
    );
  }

  console.log("\nDESSERT RUN QA: ALL PASS");
} finally {
  await vite.close();
}
