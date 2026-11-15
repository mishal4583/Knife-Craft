// Plating Belt QA (docs/planning/PLATING-BELT-PLAN-2026-11-15.md). Pure rules, shipped seeds, dish colours.
// Run: npx tsx scripts/plating-belt-qa.mts   (about four minutes: it re-proves every shipped plate)
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
  const rules = await vite.ssrLoadModule("/src/game/business/platingBelt.ts");
  const palette = await vite.ssrLoadModule("/src/game/business/ingredientBeltColor.ts");
  const { DEFAULT_SAVE } = await vite.ssrLoadModule("/src/game/SaveManager.ts");
  const content = await vite.ssrLoadModule("/src/game/business/platingBeltContent.ts");
  const { BELT_PROVEN_SEEDS_BY_TIER } = await vite.ssrLoadModule(
    "/src/game/business/plateSeeds.ts",
  );
  const { BUSINESS_DISH_CATALOG } = await vite.ssrLoadModule(
    "/src/game/business/businessDishCatalog.ts",
  );
  const { getCampaignRecipe } = await vite.ssrLoadModule("/src/game/recipes/campaignRecipes.ts");

  // ---- A. Tiers -----------------------------------------------------------------------------
  assert.equal(rules.BELT_TIERS.length, 4);
  assert.deepEqual(
    rules.BELT_TIERS.map((t: { fromLevel: number }) => t.fromLevel),
    [18, 28, 45, 65],
  );
  assert.deepEqual(
    rules.BELT_TIERS.map((t: { lanes: number }) => t.lanes),
    [3, 4, 5, 5],
  );
  assert.equal(rules.beltTierForLevel(17).id, 1, "below Level 18 still reads the first tier");
  assert.equal(rules.beltTierForLevel(44).id, 2);
  assert.equal(rules.beltTierForLevel(91).id, 4);

  // ---- B. Source guard: the plate must be the same on every browser -------------------------
  // The seeds were proved on one engine; Math.hypot / log / pow / trig are allowed to differ in the last
  // digit between engines, which could build a different plate on a phone than the one that was proved.
  const source = readFileSync("src/game/business/platingBelt.ts", "utf8").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    "",
  );
  assert.ok(
    !/Math\.(hypot|log|log2|log10|pow|exp|sin|cos|tan|atan2?|cbrt|random)\b|\*\*/.test(source),
    "platingBelt.ts uses only exactly-specified arithmetic",
  );
  assert.ok(!/\.sort\(\s*\(\s*\)\s*=>/.test(source), "no comparator-less random sort");
  assert.ok(!/Date\.now|performance\.now/.test(source), "no clock in the rules");

  // ---- C. Shipped plates: structure, deck balance, proof, difficulty -------------------------
  const bands: Record<number, [number, number]> = {
    1: [0.7, 0.9],
    2: [0.4, 0.55],
    3: [0.3, 0.45],
    4: [0.15, 0.3],
  };
  const rates: string[] = [];
  for (const tier of rules.BELT_TIERS) {
    const seeds: number[] = BELT_PROVEN_SEEDS_BY_TIER[tier.id as 1 | 2 | 3 | 4];
    assert.equal(seeds.length, 300, `tier ${tier.id} ships 300 plates`);
    assert.equal(new Set(seeds).size, seeds.length, `tier ${tier.id} seeds are distinct`);
    const hues = rules.BELT_PALETTE.map((_: unknown, color: number) => ({
      id: `h${color}`,
      color,
    }));
    const radius = tier.size / 2 - 0.5;
    const centre = (tier.size - 1) / 2;
    let carelessWins = 0;
    let largestShare = 0;
    for (const seed of seeds) {
      const round = rules.makeBeltRound(tier, hues, seed);
      const again = rules.makeBeltRound(tier, hues, seed);
      assert.deepEqual(round, again, `seed ${seed} builds the same plate twice`);
      assert.equal(round.board.size, tier.size);
      assert.equal(round.board.colors, tier.colors);
      assert.equal(round.board.colorHexes.length, tier.colors);
      assert.equal(round.board.colorHexes[0], rules.BELT_RIM_HEX, "colour 0 is the cream rim");
      assert.equal(
        new Set(round.board.colorHexes).size,
        tier.colors,
        "every colour on a plate is different",
      );
      assert.equal(round.lanes.length, tier.lanes);
      assert.equal(round.tables.length, 5);
      // The plate is round: no cubes outside the circle, a full ring of cream just inside it.
      const perColor = new Array<number>(tier.colors).fill(0);
      for (let y = 0; y < tier.size; y += 1) {
        for (let x = 0; x < tier.size; x += 1) {
          const cell = round.board.cells[y * tier.size + x];
          const d = Math.sqrt((x - centre) ** 2 + (y - centre) ** 2);
          if (d > radius) assert.equal(cell, -1, "corners are empty");
          else {
            assert.ok(cell >= 0 && cell < tier.colors, "inside the plate every cell holds a cube");
            if (d > radius - tier.rim) assert.equal(cell, 0, "the outer ring is the cream rim");
            perColor[cell] += 1;
          }
        }
      }
      perColor.forEach((n, color) =>
        assert.ok(n >= 4, `seed ${seed} colour ${color} keeps four cubes`),
      );
      // The deck: cubes add up per colour, 2 to 5 waiters a colour, none under the tier's minimum, the total
      // inside the tier's range (beltDeckProblem), and no colour lumped into one giant waiter.
      assert.equal(rules.beltDeckProblem(round, tier), null, `seed ${seed} deck`);
      const waiters = round.lanes.flat();
      const total = perColor.reduce((a, b) => a + b, 0);
      for (let color = 0; color < tier.colors; color += 1) {
        const mine = waiters.filter((w: { color: number }) => w.color === color);
        assert.equal(
          mine.reduce((a: number, w: { count: number }) => a + w.count, 0),
          perColor[color],
          `seed ${seed} colour ${color} cubes match its waiters`,
        );
      }
      for (const w of waiters) largestShare = Math.max(largestShare, w.count / total);
      assert.ok(rules.solveBeltRound(round, 30000), `seed ${seed} of tier ${tier.id} is winnable`);
      // Careless play: always the first legal move.
      let state = round;
      for (let m = 0; m < 300 && !rules.beltWon(state) && !rules.beltTrapped(state); m += 1) {
        const outcome = rules.moveBeltWaiter(state, rules.legalBeltMoves(state)[0]);
        if (outcome.ok) state = outcome.state;
      }
      if (rules.beltWon(state)) carelessWins += 1;
    }
    assert.ok(
      largestShare <= 0.4,
      `tier ${tier.id}: the biggest waiter holds ${Math.round(largestShare * 100)}% of the plate`,
    );
    const rate = carelessWins / seeds.length;
    rates.push(`tier ${tier.id} ${Math.round(rate * 100)}%`);
    assert.ok(
      rate >= bands[tier.id]![0] && rate <= bands[tier.id]![1],
      `tier ${tier.id}: careless play wins ${Math.round(rate * 100)}%, band ${bands[tier.id]!.join("-")}`,
    );
  }

  // ---- D. The dish of the day ---------------------------------------------------------------
  for (const dish of BUSINESS_DISH_CATALOG) {
    const recipe = getCampaignRecipe(dish.sourceRecipeId);
    assert.ok(recipe, `${dish.name} points to an existing recipe`);
    for (const component of recipe.components)
      assert.notEqual(
        palette.INGREDIENT_BELT_COLOR[component.ingredientId],
        undefined,
        `${dish.name}: ${component.ingredientId} has an image colour`,
      );
    assert.ok(
      content.platingBeltIngredientsOf(dish).length >= 2,
      `${dish.name} has at least two ingredients`,
    );
  }
  const days = Array.from({ length: 96 }, (_, i) => i + 1);
  const picks = days.map((day) => content.platingBeltDishOfTheDay(DEFAULT_SAVE, day).id);
  assert.deepEqual(
    picks,
    days.map((day) => content.platingBeltDishOfTheDay(DEFAULT_SAVE, day).id),
    "the dish of a day never changes",
  );
  assert.ok(new Set(picks).size >= 30, "96 days visit at least 30 different dishes");
  const menuChanged = structuredClone(DEFAULT_SAVE);
  menuChanged.business.menuActivation = {
    ...menuChanged.business.menuActivation,
    activeDishIds: [],
  };
  assert.deepEqual(
    days.map((day) => content.platingBeltDishOfTheDay(menuChanged, day).id),
    picks,
    "the dish does not depend on the player's menu",
  );
  // After the campaign (the Endless Restaurant) the dish of the day is Today's Special.
  const events = await vite.ssrLoadModule("/src/game/restaurant/restaurantEvents.ts");
  const endless = structuredClone(DEFAULT_SAVE);
  endless.levelProgress.completedLevelIds = Array.from({ length: 250 }, (_, i) => `level-${i + 1}`);
  endless.business.restaurantMigration = { version: 1, atLevel: 250, kit: [], welcomed: true };
  endless.business.restaurantStaff = {
    specialists: ["indian-chef", "mediterranean-chef", "mexican-chef", "asian-chef"],
  };
  assert.ok(events.endlessEventsActive(endless), "the test save is an Endless Restaurant");
  let special = 0;
  for (let day = 1; day <= 30; day += 1) {
    const featured = events.todaysSpecialDish(endless, day);
    if (!featured) continue;
    special += 1;
    assert.equal(
      content.platingBeltDishOfTheDay(endless, day).id,
      featured.id,
      `day ${day}: the special is the plate`,
    );
  }
  assert.ok(special > 0, "the Endless test save has a special to feature");
  const resolved = content.platingBeltDishFor(DEFAULT_SAVE, 1);
  assert.ok(resolved.dish && resolved.ingredients.length > 0);

  // ---- E. The rules on a hand-made plate ---------------------------------------------------
  const board = (size: number, cells: number[], colors = 2) => ({
    size,
    cells,
    colors,
    colorHexes: ["#f6f0e4", "#d9392b", "#2764b4"].slice(0, colors + 1),
  });
  const empty = (n: number) => Array.from({ length: n }, () => null);
  // Worked example (plan section 2): red must wait while blue clears, then red finishes.
  const sample = board(
    6,
    [
      -1, 1, 1, 1, 1, -1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1,
      -1, 1, 1, 1, 1, -1,
    ],
  );
  const example = {
    board: sample,
    lanes: [[{ id: "r", color: 0, count: 12 }], [{ id: "b", color: 1, count: 20 }]],
    tables: empty(5),
    peakTables: 0,
  };
  assert.ok(rules.solveBeltRound(example));
  const redFirst = rules.moveBeltWaiter(example, { kind: "lane", lane: 0 });
  assert.ok(
    redFirst.ok && redFirst.collected === 0 && redFirst.state.tables.filter(Boolean).length === 1,
    "red sent first finds nothing and waits at a table",
  );
  const blueFirst = rules.moveBeltWaiter(example, { kind: "lane", lane: 1 });
  assert.ok(blueFirst.ok && blueFirst.collected > 0, "blue sent first collects");
  // An idle tap is allowed and uses a table.
  const buried = {
    board: board(
      6,
      // One colour-1 cube in the middle, shut in by colour-0 cubes on all four sides: out of reach.
      Array.from({ length: 36 }, (_, i) => (i === 14 ? 1 : [8, 13, 15, 20].includes(i) ? 0 : -1)),
    ),
    lanes: [[{ id: "x", color: 1, count: 3 }]],
    tables: empty(5),
    peakTables: 0,
  };
  const idleTap = rules.moveBeltWaiter(buried, { kind: "lane", lane: 0 });
  assert.ok(
    idleTap.ok && idleTap.collected === 0 && idleTap.state.tables[0].count === 3,
    "an idle tap is allowed while a table is free, and the waiter waits with all its cubes",
  );
  // A tap that would strand a waiter is refused and costs nothing; trapped = no legal move.
  const blocked = {
    board: board(
      6,
      Array.from({ length: 36 }, (_, i) => (i === 14 ? 0 : -1)),
      1,
    ),
    lanes: [[{ id: "front", color: 0, count: 2 }]],
    tables: Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, color: 1, count: 3 })),
    peakTables: 5,
  };
  assert.ok(rules.beltTrapped(blocked));
  assert.deepEqual(rules.moveBeltWaiter(blocked, { kind: "lane", lane: 0 }), {
    ok: false,
    reason: "table-full",
  });
  assert.deepEqual(rules.moveBeltWaiter(blocked, { kind: "table", table: 0 }), {
    ok: false,
    reason: "nothing-to-collect",
  });
  assert.deepEqual(rules.moveBeltWaiter(blocked, { kind: "lane", lane: 2 }), {
    ok: false,
    reason: "empty-lane",
  });
  // A waiter that finishes uses no table; the lane moves up; a table waiter keeps its table.
  const finishing = {
    board: board(
      6,
      Array.from({ length: 36 }, (_, i) => (i === 14 ? 1 : i === 15 ? 1 : -1)),
    ),
    lanes: [
      [
        { id: "a", color: 1, count: 2 },
        { id: "b", color: 1, count: 9 },
      ],
    ],
    tables: empty(5),
    peakTables: 0,
  };
  const done = rules.moveBeltWaiter(finishing, { kind: "lane", lane: 0 });
  assert.ok(
    done.ok &&
      done.collected === 2 &&
      done.state.tables.every((t: unknown) => t === null) &&
      done.state.lanes[0].length === 1,
  );
  assert.ok(rules.beltWon(done.state), "the plate is clear after its last cube");
  const keeps = {
    board: board(
      6,
      Array.from({ length: 36 }, (_, i) => (i === 14 ? 1 : -1)),
    ),
    lanes: [[]],
    tables: [null, null, { id: "w", color: 1, count: 4 }, null, null],
    peakTables: 1,
  };
  const retap = rules.moveBeltWaiter(keeps, { kind: "table", table: 2 });
  assert.ok(
    retap.ok && retap.state.tables[2].count === 3 && retap.state.tables[0] === null,
    "a waiter with cubes left keeps its own table",
  );
  // The belt looks inward through cubes already taken, and one lap takes at most one cube per belt position.
  const column = {
    board: board(
      6,
      Array.from({ length: 36 }, (_, i) => (i % 6 === 2 ? 1 : -1)),
      1,
    ),
    lanes: [[{ id: "c", color: 1, count: 99 }]],
    tables: empty(5),
    peakTables: 0,
  };
  const lap = rules.moveBeltWaiter(column, { kind: "lane", lane: 0 });
  assert.ok(
    lap.ok && lap.collected === 6 && rules.beltWon(lap.state),
    "a lone column is cleared by one lap from both ends",
  );
  // Stars: peak tables, one Undo costs a star, never below one.
  for (const [peak, stars] of [
    [0, 3],
    [2, 3],
    [3, 2],
    [4, 2],
    [5, 1],
  ])
    assert.equal(rules.starsForPeakTables(peak), stars);
  assert.equal(rules.starsForPeakTables(0, true), 2);
  assert.equal(rules.starsForPeakTables(5, true), 1);
  // The hint never points at an idle tap.
  assert.equal(rules.hintBeltMove(buried), null, "only an idle tap exists, so no hint");
  const tier1 = rules.BELT_TIERS[0];
  for (const seed of BELT_PROVEN_SEEDS_BY_TIER[1].slice(0, 25)) {
    let state = rules.makeBeltRound(
      tier1,
      rules.BELT_PALETTE.map((_: unknown, color: number) => ({ id: String(color), color })),
      seed,
    );
    for (let m = 0; m < 60 && !rules.beltWon(state) && !rules.beltTrapped(state); m += 1) {
      const hint = rules.hintBeltMove(state);
      if (hint)
        assert.ok(rules.moveBeltWaiter(state, hint).collected > 0, "a hint always collects cubes");
      const outcome = rules.moveBeltWaiter(state, hint ?? rules.legalBeltMoves(state)[0]);
      if (outcome.ok) state = outcome.state;
    }
  }
  assert.equal(rules.beltColorName(rules.BELT_RIM_HEX), "cream");
  assert.equal(rules.beltColorName(rules.BELT_PALETTE[0].hex), "red");

  console.log(
    `Plating Belt QA passed: tiers, deterministic maths, 1,200 shipped plates (structure, deck balance, proof), careless play wins ${rates.join(", ")}, dish of the day, rules, hint, stars.`,
  );
} finally {
  await vite.close();
}
