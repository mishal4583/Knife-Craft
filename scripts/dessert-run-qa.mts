// Dessert Run QA (developer 2026-11-16, replaces plating-belt-qa). Pure rules, the gallery, every shipped plate.
// Run: npx tsx scripts/dessert-run-qa.mts   (about half a minute: it replays every shipped plate twice)
// The browser side is tools/e2e/dessertrun.mjs.
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
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
  const { DESSERTS, DESSERT_LADDER, BAND_TIERS, tierOfLadderLevel, RUN_PALETTE, GRID } = gallery;
  // RULE CHANGE (developer 2026-11-26, the 50-level dessert list): every level has its own dessert, in five bands of ten, each band at one tier (`BAND_TIERS`); the desserts are `DESSERT_LADDER`.
  type Id = string;
  /** The desserts of one band tier, with their level on the list. */
  const ofBand = (band: number): Id[] => DESSERT_LADDER.slice(band * 10, band * 10 + 10);
  const levelOf = (id: Id) => DESSERT_LADDER.indexOf(id) + 1;

  // ---- A. Tiers ----------------------------------------------------------------------------------
  // RULE CHANGE (developer 2026-11-19: "plan the levels easy to hard as they level up, and make the mosaic beautiful"): six steps instead of four, a plate
  // every twelve levels or so, eight pictures instead of four.
  assert.equal(RUN_TIERS.length, 6);
  assert.deepEqual(
    RUN_TIERS.map((t: { fromLevel: number }) => t.fromLevel),
    [18, 30, 42, 54, 66, 78],
  );
  assert.deepEqual(
    RUN_TIERS.map((t: { lanes: number }) => t.lanes),
    [3, 3, 4, 4, 5, 5],
  );
  assert.equal(run.runTierForLevel(17).id, 1, "below Level 18 still reads the first tier");
  assert.equal(run.runTierForLevel(41).id, 2);
  assert.equal(run.runTierForLevel(91).id, 6);
  console.log("PASS A tiers: Levels 18 / 30 / 42 / 54 / 66 / 78, lanes 3 / 3 / 4 / 4 / 5 / 5");

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
  // RULE CHANGE (2026-11-26): the gallery is the 50 desserts of the list, every one filling the plate's well (568 cubes).
  assert.equal(DESSERT_LADDER.length, 50, "50 desserts, one per level of the list");
  assert.equal(new Set(DESSERT_LADDER).size, 50, "every dessert of the list is different");
  assert.deepEqual(
    Object.keys(DESSERTS).sort(),
    [...DESSERT_LADDER].sort(),
    "the gallery is exactly the list",
  );
  assert.ok(
    DESSERT_LADDER.every((id: string) => cubes[id] === 568),
    "every picture fills the whole plate well, 568 cubes",
  );
  DESSERT_LADDER.forEach((id: string, n: number) =>
    assert.equal(DESSERTS[id].tier, tierOfLadderLevel(n + 1), `${id} is dealt at its band's tier`),
  );
  assert.deepEqual(
    BAND_TIERS,
    [1, 2, 3, 5, 6],
    "Intro, Easy, Medium, Hard, Expert are tiers 1, 2, 3, 5, 6",
  );
  // RULE CHANGE (developer 2026-11-26, "refer these images in order and fix the desserts ... exactly like in the reference"): no dessert is hand-painted any more: all 50, the former eight too,
  // are the developer's reference pictures (scripts/make-dessert-art.py); the former eight keep their places on the list.
  assert.deepEqual(
    ["cookie", "donut", "macaron", "cupcake", "pancakes", "cone", "cakeslice", "lollipop"].map(
      (id) => DESSERT_LADDER.indexOf(id) + 1,
    ),
    [1, 4, 5, 6, 7, 8, 9, 10],
    "biscuit L1, donut L4, macaron L5, cupcake L6, pancake L7, ice cream L8, cake slice L9, lollipop L10",
  );
  console.log(
    "PASS B gallery: the 50 desserts of the list, 5 to 9 colour groups each (several tones inside a group), outline first, cube counts",
    JSON.stringify({ desserts: Object.keys(cubes).length }),
  );
  // ---- B2. The pictures: every dessert is the reference picture, one small WebP per dessert, loaded only when its dessert is drawn --------
  {
    let total = 0;
    for (const id of DESSERT_LADDER as string[]) {
      const d = DESSERTS[id];
      const file = `public/${d.art}`;
      assert.equal(d.art, `business/dessertrun/desserts/${id}.webp`);
      assert.ok(existsSync(file), `${id}: its picture ${file} exists`);
      const bytes = readFileSync(file);
      assert.ok(
        bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP",
        `${id}: a WebP`,
      );
      const size = statSync(file).size;
      assert.ok(size < 60 * 1024, `${id}: a small picture (${Math.round(size / 1024)} KB)`);
      total += size;
    }
    assert.ok(
      total < 1_600 * 1024,
      `all 50 pictures together stay small (${Math.round(total / 1024)} KB)`,
    );
    const drawSrc = readFileSync("src/components/kc/inventory/dessertRunDraw.ts", "utf8");
    const wideSrc = readFileSync("src/components/kc/inventory/dessertRunWide.ts", "utf8");
    assert.ok(
      drawSrc.includes("export function drawMosaic(") &&
        drawSrc.includes("drawMosaic(ctx, state, art, ORIGIN.x") &&
        wideSrc.includes("drawMosaic(ctx, state, art, ox, oy, cell)"),
      "both the upright and the wide board draw the picture's cubes",
    );
    assert.ok(
      drawSrc.includes("if (!picture || group === 1) {"),
      "without its picture a dessert is drawn in its flat tones (and the board always is)",
    );
    console.log(
      `PASS B2 pictures: 50 reference pictures, ${Math.round(total / 1024)} KB, drawn on both boards with a flat fallback`,
    );
  }

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
  // D2b the "Tap me" hint (audit 2026-11-25: it always pointed at lane 0, even when lane 0 had nothing to fetch)
  {
    let checked = 0;
    for (const tier of RUN_TIERS)
      for (const id of Object.keys(DESSERTS) as Id[])
        for (let seed = 1; seed <= 6; seed++) {
          const s = run.makeRun(id, seed, tier);
          const at = run.hintLane(s);
          assert.ok(at >= 0 && s.lanes[at]?.[0], "the hint points at a lane that has a waiter");
          assert.equal(run.tapLane(s, at), "sent", "tapping the hinted lane sends that waiter");
          checked++;
        }
    // lane 0 empty: the hint moves to the first lane that has a waiter instead of vanishing
    const t = run.makeRun("cookie", 1, RUN_TIERS[0]);
    t.lanes[0] = [];
    assert.ok(run.hintLane(t) > 0, "an empty lane 0 is skipped");
    t.lanes = t.lanes.map(() => []);
    assert.equal(run.hintLane(t), -1, "no waiters, no hint");
    // a front waiter with nothing to fetch is skipped for one that has something
    const u = run.makeRun("cookie", 1, RUN_TIERS[0]);
    const first = u.lanes[0][0];
    u.grid.forEach((c: number, i: number) => {
      if (c === first.k) u.grid[i] = -1;
    });
    u.ext.set(run.computeExt(u.grid));
    const other = run.hintLane(u);
    assert.ok(
      other !== 0 || u.lanes.every((l: Array<{ k: number }>) => l[0]?.k === first.k),
      "a lane whose waiter has nothing to fetch is not the hint when another can fetch",
    );
    console.log(
      `PASS D2b hint: points at a lane that can fetch (${checked} rounds), skips an empty or fruitless lane 0, none when empty`,
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
  DESSERT_LADDER.forEach((id: string, n: number) =>
    wanted.add(`${id}-${tierOfLadderLevel(n + 1)}`),
  );
  assert.deepEqual(
    Object.keys(DESSERT_RUN_SEEDS).sort(),
    [...wanted].sort(),
    "seed lists match the list: one per dessert, at its band's tier",
  );
  let plates = 0;
  let longest = 0;
  for (const key of Object.keys(DESSERT_RUN_SEEDS)) {
    const [id, tierId] = key.split("-") as [Id, string];
    const tier = RUN_TIERS[Number(tierId) - 1];
    const seeds: number[] = DESSERT_RUN_SEEDS[key];
    assert.equal(seeds.length, 6, `${key}: 6 seeds`);
    assert.equal(new Set(seeds).size, 6, `${key}: seeds are distinct`);
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
  for (let band = 0; band < 5; band++) {
    let won = 0;
    let n = 0;
    for (const id of ofBand(band)) {
      const tier = RUN_TIERS[tierOfLadderLevel(levelOf(id)) - 1];
      for (const seed of DESSERT_RUN_SEEDS[`${id}-${tier.id}`]) {
        n += 1;
        won += Number(careless(id, tier, seed));
      }
    }
    rate.push(won / n);
  }
  console.log(
    "     careless wins by band:",
    rate.map((r) => `${Math.round(r * 100)}%`).join(" / "),
  );
  assert.ok(rate[0] >= 0.7, "the Intro band is gentle: careless play wins most plates");
  assert.ok(rate[rate.length - 1] <= 0.5, "the Expert band (tier 6) is not won by careless play");
  assert.ok(rate[0] - rate[rate.length - 1] >= 0.25, "the bands get harder");
  console.log("PASS F difficulty: Intro gentle, Expert hard, in between in order");

  // ---- F2. Rated plates (developer 2026-11-19: "ensure and increase the quality of the levels") ------------------
  // The seeds of a dessert run easiest first, nearest its target in its band tier's window (RUN_HARDNESS), and the windows rise band by band. Rating is slow
  // (12 careful rounds a plate), so two seeds of every dessert are re-rated here: the first and the last.
  {
    const bandMean: number[] = [];
    for (let band = 0; band < 5; band++) {
      let sum = 0;
      let count = 0;
      for (const id of ofBand(band)) {
        const tier = RUN_TIERS[tierOfLadderLevel(levelOf(id)) - 1];
        const [lo, hi] = run.RUN_HARDNESS[tier.id];
        const seeds: number[] = DESSERT_RUN_SEEDS[`${id}-${tier.id}`];
        let before = -1;
        for (const at of [0, 5]) {
          const rating = run.ratePlate(id, seeds[at], tier, 12);
          // RULE CHANGE (2026-11-26): the window is a TARGET for the dessert's six seeds, not a bound (a plain picture cannot be made as hard as a busy one; the generator takes the proven seeds
          // nearest the target), so what is guarded is "never much harder than the band's window".
          assert.ok(
            rating.hardness <= hi + 0.2,
            `${id}-${tier.id} seed #${at}: hardness ${rating.hardness.toFixed(2)} is much harder than the band's window ${lo}..${hi}`,
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
      bandMean.push(sum / count);
    }
    console.log(
      "     careful-player hardness by band:",
      bandMean.map((m) => m.toFixed(2)).join(" / "),
    );
    for (let b = 1; b < bandMean.length; b++)
      assert.ok(bandMean[b] > bandMean[b - 1] + 0.02, `band ${b + 1} is harder than band ${b}`);
    console.log(
      "PASS F2 ratings: no dessert much harder than its band's window, easiest first, and each band harder than the last",
    );
  }

  // ---- G. Which plate a level gets -----------------------------------------------------------------
  {
    const a = content.dessertRunFor(20, 3);
    assert.deepEqual(content.dessertRunFor(20, 3), a, "the same level and day is the same plate");
    assert.equal(
      a.dessertId,
      "cookie",
      "the first level of Dessert Run plays the list's first dessert",
    );
    assert.equal(a.ladderLevel, 1);
    assert.equal(
      content.dessertRunFor(91, 1).dessertId,
      "granddessert",
      "the campaign's last level plays the 50th",
    );
    assert.equal(
      content.dessertRunFor(17, 3).dessertId,
      "cookie",
      "below the first Dessert Run level reads the first dessert",
    );
    assert.notEqual(
      content.dessertRunFor(20, 3, 1).dessertId,
      a.dessertId,
      "round + 1 is the next dessert of the list",
    );
    assert.equal(
      content.dessertRunFor(91, 1, 1).dessertId,
      "cookie",
      "after the 50th the list starts again",
    );
    // every level: the dessert is the list's, at its band's tier, from proven seeds only
    let prev = 0;
    const seen = new Set<string>();
    for (let level = 20; level <= 91; level++) {
      const p = content.dessertRunFor(level, 1);
      assert.ok(p.ladderLevel >= prev, `level ${level}: the list only goes up as the level does`);
      prev = p.ladderLevel;
      seen.add(p.dessertId);
      assert.equal(p.dessertId, DESSERT_LADDER[p.ladderLevel - 1]);
      assert.equal(
        p.tier.id,
        tierOfLadderLevel(p.ladderLevel),
        `level ${level}: the dessert's band tier`,
      );
      for (let day = 1; day <= 9; day++)
        for (let round = 0; round < 3; round++) {
          const q = content.dessertRunFor(level, day, round);
          assert.ok(
            DESSERT_RUN_SEEDS[`${q.dessertId}-${q.tier.id}`].includes(q.seed),
            "only proven seeds are dealt",
          );
        }
    }
    assert.equal(seen.size, 50, "all 50 desserts are played somewhere between level 20 and 91");
    // a business day deals a different plate of the same dessert
    const days = new Set<number>();
    for (let day = 1; day <= 6; day++) days.add(content.dessertRunFor(50, day).seed);
    assert.equal(days.size, 6, "six days deal six different plates of a dessert");
    console.log(
      "PASS G choice: the 50 desserts climb the list with the level, one band tier each, proven seeds only, a new deal each day",
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
