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
  type Id = "cookie" | "donut" | "cupcake" | "cone";

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
  assert.equal(GRID, 28, "a 28 x 28 grid: smooth silhouettes, like the developer's reference");
  const paletteHexes = Object.values(RUN_PALETTE) as string[];
  assert.ok(
    paletteHexes.length >= 15,
    "a palette of at least fifteen cube colours (flat tiles: a few tones of each hue)",
  );
  assert.equal(
    new Set(paletteHexes).size,
    paletteHexes.length,
    "no two palette names share a colour",
  );
  paletteHexes.forEach((h) => assert.match(h, /^#[0-9A-F]{6}$/));
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
    assert.ok(d.keys.length >= 5 && d.keys.length <= 9, `${id}: 5 to 9 colour groups`);
    // each group can hold several tones of one hue (drawn), while a waiter fetches the whole group
    assert.equal(d.toneNames.length, d.keys.length, `${id}: a tone list for every group`);
    d.toneNames.forEach((tones: string[], k: number) => {
      assert.ok(tones.length >= 1 && tones.length <= 4, `${id}: group ${k} has 1 to 4 tones`);
      tones.forEach((t) => assert.ok(t in RUN_PALETTE, `${id}: unknown tone ${t}`));
      assert.ok(tones.includes(d.keys[k]), `${id}: the waiter colour is one of its group's tones`);
    });
    const toneGrid: Uint8Array = d.tones();
    assert.equal(toneGrid.length, GRID * GRID);
    grid.forEach((v, i) => {
      if (v >= 0)
        assert.ok(
          toneGrid[i] < d.toneNames[v].length,
          `${id}: cell ${i} has a tone outside its group`,
        );
    });
    assert.equal(d.keys[0], "outline", `${id}: colour 0 is the dark outline`);
    // nothing sits in a corner: the dessert is a round plate
    for (const c of [0, GRID - 1, (GRID - 1) * GRID, GRID * GRID - 1])
      assert.equal(grid[c], -1, `${id}: corner ${c} must be empty`);
    cubes[id] = per.reduce((a: number, b: number) => a + b, 0);
    assert.deepEqual(d.build(), grid, `${id}: the build is the same every time`);
  }
  assert.deepEqual(
    cubes,
    { cookie: 568, donut: 568, cupcake: 568, cone: 568 },
    // RULE CHANGE (developer 2026-11-18: the cubes at the edge follow the plate's round shape): the board holds every cube that meets the plate's
    // well circle (WELL_R), 568, was a 500-cube staircase disc that stopped short of the rim.
    "every picture fills the whole plate well, 568 cubes",
  );
  for (const tier of RUN_TIERS)
    for (const id of DESSERTS_BY_TIER[tier.id])
      assert.equal(
        DESSERTS[id as Id].tier <= tier.id,
        true,
        `${id} is not harder than tier ${tier.id}`,
      );
  console.log(
    "PASS B gallery: 4 pixel-art desserts, 5 to 9 colour groups each (several tones inside a group), outline first, cube counts",
    JSON.stringify(cubes),
  );

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
  // D1 reach = touches the outside; cubes sealed inside the donut's ring are out of reach until a corridor opens
  {
    const donut: Int8Array = DESSERTS.donut.build();
    const mid = Math.floor(GRID / 2);
    const centre = mid * GRID + mid;
    const g = donut.slice();
    const e = run.computeExt(g);
    assert.ok(g[centre] >= 0, "the donut's hole holds background cubes");
    assert.equal(
      run.isExposed(e, centre),
      false,
      "a cube in the middle of the hole starts out of reach",
    );
    let sealed = 0;
    for (let i = 0; i < g.length; i++) if (g[i] >= 0 && !run.isExposed(e, i)) sealed += 1;
    assert.ok(sealed > 100, "most of the picture starts buried under the board and the outline");
    // open a corridor along the middle row from the right edge in to the hole
    for (let x = GRID - 1; x > mid; x--)
      if (g[mid * GRID + x] >= 0) run.removeCell(g, e, mid * GRID + x);
    assert.equal(
      run.isExposed(e, centre),
      true,
      "opening a corridor to the hole makes its cubes reachable",
    );
    console.log(
      "PASS D1 reach: the cubes inside the ring are out of reach until a corridor opens them",
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
  // D3 a waiter with nothing reachable waits, and goes on by itself. A hand-built board: one cube of colour 1
  // sealed inside a ring of colour 0.
  const sealed = (tier: (typeof RUN_TIERS)[number]) => {
    const s = run.makeRun("cookie", 1, tier);
    s.grid.fill(-1);
    for (let y = 11; y <= 13; y++) for (let x = 11; x <= 13; x++) s.grid[y * GRID + x] = 0;
    s.grid[12 * GRID + 12] = 1;
    s.ext.set(run.computeExt(s.grid));
    s.total = 9;
    s.need = [2, 2, 2, 3];
    return s;
  };
  {
    const tier = RUN_TIERS[0];
    const s = sealed(tier);
    const hex = (k: number) => RUN_PALETTE[s.dessert.keys[k]];
    assert.equal(run.reachableCells(s, 1).length, 0, "the sealed cube is out of reach");
    assert.equal(run.reachableCells(s, 0).length, 8, "the ring is on the outside");
    s.lanes = [[{ k: 1, n: 1, hex: hex(1) }], [{ k: 0, n: 8, hex: hex(0) }], []];
    run.tapLane(s, 0);
    for (let i = 0; i < 120; i++) run.stepRun(s, STEP, 1);
    assert.equal(run.isWaiting(s, s.spots[0]), true, "the waiter waits while the cube is sealed");
    assert.equal(s.phase, "play", "one waiting waiter with a free spot is not a jam");
    run.tapLane(s, 1);
    let guard = 0;
    while (s.phase === "play" && guard++ < 30_000) run.stepRun(s, STEP, 1);
    assert.equal(
      s.phase,
      "won",
      "once the ring is gone the waiting waiter went on by itself and the board is won",
    );
    assert.equal(s.delivered, 9);
    console.log(
      "PASS D3 waiting: a sealed colour waits, then resumes by itself when the way opens",
    );
  }
  // D4 a jam: every spot waiting
  {
    const s = sealed(RUN_TIERS[0]);
    const one = { k: 1, n: 1, hex: RUN_PALETTE[s.dessert.keys[1]] };
    s.lanes = [[{ ...one }, { ...one }, { ...one }], [{ ...one }, { ...one }], []];
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
    const s = run.makeRun("cone", 7, tier);
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

  // ---- F2. Rated plates (developer 2026-11-19: "ensure and increase the quality of the levels") ------------------
  // The seeds of a plate run easiest first, inside the tier's window (RUN_HARDNESS), and the windows rise tier by tier. Rating is slow
  // (12 careful rounds a plate), so four seeds of every plate are re-rated here: the first, two in the middle and the last.
  {
    const tierMean: number[] = [];
    for (const tier of RUN_TIERS) {
      const [lo, hi] = run.RUN_HARDNESS[tier.id];
      let sum = 0;
      let count = 0;
      for (const id of DESSERTS_BY_TIER[tier.id]) {
        const seeds: number[] = DESSERT_RUN_SEEDS[`${id}-${tier.id}`];
        let before = -1;
        for (const at of [0, 20, 40, 59]) {
          const rating = run.ratePlate(id as Id, seeds[at], tier, 12);
          assert.ok(
            rating.hardness >= lo - 1e-9 && rating.hardness <= hi + 1e-9,
            `${id}-${tier.id} seed #${at}: hardness ${rating.hardness.toFixed(2)} is outside the tier's window ${lo}..${hi}`,
          );
          assert.ok(
            rating.hardness >= before - 1e-9,
            `${id}-${tier.id}: seeds run easiest first (#${at} is easier than the one before)`,
          );
          before = rating.hardness;
          sum += rating.hardness;
          count += 1;
        }
      }
      tierMean.push(sum / count);
    }
    console.log(
      "     careful-player hardness by tier:",
      tierMean.map((m) => m.toFixed(2)).join(" / "),
    );
    for (let t = 1; t < tierMean.length; t++)
      assert.ok(tierMean[t] > tierMean[t - 1] + 0.02, `tier ${t + 1} is harder than tier ${t}`);
    console.log(
      "PASS F2 ratings: every plate inside its tier's window, easiest first, and each tier harder than the last",
    );
  }

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
    // the ramp: inside a tier a higher level gets later (harder) seeds, whatever the day and the round
    for (const tier of RUN_TIERS) {
      const { first, last } = content.tierLevels(tier);
      const meanIndex = (level: number) => {
        let sum = 0;
        let n = 0;
        for (let day = 1; day <= 9; day++)
          for (let round = 0; round < 4; round++) {
            const p = content.dessertRunFor(level, day, round);
            sum += DESSERT_RUN_SEEDS[`${p.dessertId}-${p.tier.id}`].indexOf(p.seed);
            n += 1;
          }
        return sum / n;
      };
      assert.ok(
        meanIndex(last) > meanIndex(first) + 25,
        `tier ${tier.id}: its last level is much later on the ramp than its first`,
      );
      let prev = -1;
      for (let level = first; level <= last; level++) {
        const m = meanIndex(level);
        assert.ok(
          m >= prev - 3,
          `tier ${tier.id}: level ${level} is not easier than the level before`,
        );
        prev = m;
      }
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
    assert.equal(
      run.ORIGIN.x + (GRID * run.CELL) / 2,
      run.PLATE.x,
      "the grid is centred on the plate",
    );
    assert.equal(
      run.ORIGIN.y + (GRID * run.CELL) / 2,
      run.PLATE.y,
      "the grid is centred on the plate",
    );
    for (const id of Object.keys(DESSERTS) as Id[]) {
      const grid: Int8Array = DESSERTS[id].build();
      assert.ok(
        run.WELL_R <= run.PLATE.r * 0.83 &&
          Math.abs(run.WELL_R / run.CELL - gallery.WELL_CELLS) < 1e-9,
        "the clip circle is inside the plate's well and is the board's circle",
      );
      // RULE CHANGE (2026-11-18): the screen clips the cubes to the well, so the board is every cube whose square meets the circle: none missing (bare plate at the
      // rim), none hidden outside it (was: every cube within 0.83 of the plate's radius).
      grid.forEach((v, i) => {
        const x0 = run.ORIGIN.x + (i % GRID) * run.CELL;
        const y0 = run.ORIGIN.y + Math.floor(i / GRID) * run.CELL;
        const dx = Math.max(x0 - run.PLATE.x, 0, run.PLATE.x - (x0 + run.CELL));
        const dy = Math.max(y0 - run.PLATE.y, 0, run.PLATE.y - (y0 + run.CELL));
        const meets = Math.hypot(dx, dy) < run.WELL_R;
        assert.equal(
          v >= 0,
          meets,
          `${id}: cell ${i} ${meets ? "meets the well but is missing" : "is hidden outside the well"}`,
        );
      });
    }
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

  {
    // developer 2026-11-19: the cubes served to a guest lay in a strip that climbed past the plate's rim; they lie inside its well now
    const draw = readFileSync("src/components/kc/inventory/dessertRunDraw.ts", "utf8");
    assert.ok(
      /plateLayout\(state\.need\[j\]!\)/.test(draw) && !/q % 16/.test(draw),
      "served cubes are laid by plateLayout inside the plate's well, not stacked in rows",
    );
    assert.ok(
      /const GUEST_SIZE = 95/.test(draw) && /const RUNNER_SIZE = 72/.test(draw),
      "guests 95 px (was 105) and the running waiter 72 px (was 62)",
    );
    const game = readFileSync("src/components/kc/inventory/DessertRunGame.tsx", "utf8");
    assert.ok(
      !/peek/.test(draw) && !/peek/.test(game),
      "no colour highlight: pressing or hovering a waiter does not light up or dim the mosaic (developer 2026-11-19: turned off completely)",
    );
    console.log(
      "PASS I plate: served cubes lie inside the plate; guests a little smaller, runners a little bigger",
    );
  }

  console.log("\nDESSERT RUN QA: ALL PASS");
} finally {
  await vite.close();
}
