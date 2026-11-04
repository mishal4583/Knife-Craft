// Fridge Sort (developer 2026-11-03), restaurant build, in a real browser: the "Put it away" mini-game (business/fridgeSort.ts).
//   S1 below Level 14 there is no chip; from Level 14 a crate of bought food shows "Put it away · 6" above the Inventory fridge
//   S2 the chip opens the game: the clock does NOT run until the first touch; 6 tokens, the targets, the timer
//   S3 a WRONG drop springs back (no token placed, no score) and a RIGHT one by TAP then TAP places it
//   S4 the DRAG path (pointer down, move, up on the shelf) places a token too
//   S5 sorting the whole crate ends the round: stars, a score, Hype added to the Second Floor, the crate is gone
//   S6 money and stock never move: credits, inventory and the ledger are identical before and after
//   S7 Done returns to the Inventory and the chip is gone
//   S8 a purchase in the Market puts what was bought on the crate (Level 14+) and the chip shows it
//   S9 Skip (from Pause) leaves the crate waiting; the Prep Cook button clears it with no Hype and no stars
//   S10 Reduced Motion: no floating-score animation; the round still works
//   S11 at 320 x 568 nothing scrolls sideways and every token and shelf is at least 48 px tall
//   S12 no console errors
//   S13 Level 80: food that spoils tonight shows an hourglass x2 token and pays double (200 for the first drop)
//   S14 earned magnets are stuck on the Inventory fridge door (none before the first)
//   S15 the painted pieces (HUD, star bar, crate, bins, drawers, racks, shelves) all load
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  readSave,
  openShortcut,
  shot,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

const CRATE = ["tomato", "carrot", "cheddar", "apple", "salmon", "basil"];
const WHERE = {
  tomato: "veg-salad",
  carrot: "veg-roots",
  cheddar: "dairy",
  apple: "fruit-drawer",
  salmon: "protein",
  basil: "greens-drawer",
};
const STOCK = Object.fromEntries(
  [...CRATE, "potato"].map((id) => [
    id,
    { ingredientId: id, quantity: 4, unitCost: 100, purchaseDay: 1 },
  ]),
);
// With campaignVersion 3 the seed's level number IS the game level (restaurantLevelOf).
const saveAt = (n, extra = {}, business = {}) =>
  seedSave({
    credits: 50_000,
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: STOCK,
      fridgeSort: { crate: CRATE, seed: 1 },
      ...business,
    },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 3,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    ...extra,
  });

const center = (page, sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }, sel);
const tap = async (page, sel) => {
  await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  await sleep(250);
};
const dragTo = async (page, from, to) => {
  const a = await center(page, from);
  const b = await center(page, to);
  if (!a || !b) return false;
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  await sleep(300);
  return true;
};
const state = (page) =>
  page.evaluate(() => {
    const g = document.querySelector('[data-testid="fridge-sort"]');
    return g
      ? {
          phase: g.dataset.phase,
          left: Number(g.dataset.left),
          tokens: Number(g.dataset.tokens),
          practice: g.dataset.practice,
          score: document
            .querySelector('[data-testid="sort-score"]')
            ?.textContent?.replace(/\D/g, ""),
          timer: document.querySelector('[data-testid="sort-timer"]')?.textContent?.trim(),
        }
      : null;
  });
const openInventory = async (page) => {
  await openShortcut(page, "inventory");
  await sleep(1200);
};
const strip = (s) => {
  const c = structuredClone(s);
  delete c.business.fridgeSort;
  delete c.business.secondFloor;
  return JSON.stringify(c);
};

const { browser, page, logs } = await launch();
try {
  // ---- S1: closed below Level 14, open from it ----
  await boot(page, saveAt(13));
  await openInventory(page);
  const closed = await page.evaluate(
    () => !!document.querySelector('[data-testid="fridge-sort-chip"]'),
  );
  await boot(page, saveAt(20));
  await openInventory(page);
  const chip = await page.evaluate(
    () => document.querySelector('[data-testid="fridge-sort-chip"]')?.textContent?.trim() ?? null,
  );
  check(
    "S1 no chip at Level 13; at Level 20 the chip says Put it away · 6",
    !closed && /Put it away · 6/.test(chip ?? ""),
    {
      closed,
      chip,
    },
  );
  const before = await readSave(page);

  // ---- S2: open the game ----
  await tap(page, '[data-testid="fridge-sort-chip"]');
  await sleep(900);
  const s2 = await state(page);
  const targets = await page.$$eval('[data-testid="sort-targets"] [data-target-id]', (els) =>
    els.map((e) => e.dataset.targetId),
  );
  await shot(page, "fridgesort-ready");
  await sleep(1500);
  const s2b = await state(page);
  check(
    "S2 the game opens ready: 6 tokens, 5+ shelves, and the clock waits for the first touch",
    s2?.phase === "ready" &&
      s2.tokens === 6 &&
      s2.left === 6 &&
      targets.length >= 5 &&
      s2.timer === s2b?.timer,
    { s2, s2b, targets },
  );

  // ---- S3: a wrong drop, then a right one by tap + tap ----
  await dragTo(page, '[data-testid="sort-token-tomato"]', '[data-testid="sort-target-dairy"]');
  const wrong = await state(page);
  const wrongBack = await page.evaluate(
    () => !!document.querySelector('[data-testid="sort-token-tomato"]'),
  );
  await tap(page, '[data-testid="sort-token-tomato"]');
  await tap(page, `[data-testid="sort-target-${WHERE.tomato}"]`);
  const right = await state(page);
  check(
    "S3 a wrong drop springs back (nothing placed, no points); tap the token then its shelf places it",
    wrong?.left === 6 &&
      wrongBack &&
      wrong.score === "0" &&
      right?.left === 5 &&
      Number(right.score) === 100 &&
      right.phase === "playing",
    { wrong, right },
  );

  // ---- S4: the drag path ----
  await dragTo(
    page,
    '[data-testid="sort-token-carrot"]',
    `[data-testid="sort-target-${WHERE.carrot}"]`,
  );
  const dragged = await state(page);
  check(
    "S4 dragging a token onto its shelf places it (and the combo scores 125)",
    dragged?.left === 4 && Number(dragged.score) === 225,
    dragged,
  );

  // ---- S5: finish the crate ----
  for (const id of ["cheddar", "apple", "salmon", "basil"]) {
    await tap(page, `[data-testid="sort-token-${id}"]`);
    await tap(page, `[data-testid="sort-target-${WHERE[id]}"]`);
  }
  await sleep(600);
  const result = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="sort-result"]');
    return r
      ? {
          stars: Number(r.dataset.stars),
          score: document
            .querySelector('[data-testid="sort-final-score"]')
            ?.textContent?.replace(/\D/g, ""),
          reward: document.querySelector('[data-testid="sort-reward"]')?.textContent ?? "",
        }
      : null;
  });
  await shot(page, "fridgesort-result");
  const after = await readSave(page);
  check(
    "S5 sorting the crate ends the round: stars, a score, Hype on the Second Floor, the crate is gone",
    !!result &&
      result.stars >= 2 &&
      Number(result.score) > 0 &&
      /Hype/.test(result.reward) &&
      (after.business.secondFloor?.hype ?? 0) > 0 &&
      !after.business.fridgeSort?.crate?.length &&
      after.business.fridgeSort?.rounds === 1,
    { result, hype: after.business.secondFloor?.hype, fs: after.business.fridgeSort },
  );
  check(
    "S6 credits, inventory and the ledger are identical before and after the whole round",
    after.credits === before.credits &&
      JSON.stringify(after.business.inventory) === JSON.stringify(before.business.inventory) &&
      JSON.stringify(after.economyLedger) === JSON.stringify(before.economyLedger) &&
      strip(after) === strip(before),
    { credits: [before.credits, after.credits] },
  );

  // ---- S7: Done ----
  await tap(page, '[data-testid="sort-done"]');
  await sleep(900);
  const back = await page.evaluate(() => ({
    onInventory: !!document.querySelector('[data-testid="fridge-sort"]') === false,
    chip: !!document.querySelector('[data-testid="fridge-sort-chip"]'),
  }));
  check(
    "S7 Done returns to the Inventory and the chip is gone (nothing waits)",
    back.onInventory && !back.chip,
    back,
  );

  // ---- S8: a Market purchase fills the crate ----
  await boot(page, saveAt(20, {}, { fridgeSort: undefined }));
  await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
  await sleep(900);
  await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Shop categories"] button')]
      .find((b) => /Ingredients/.test(b.textContent ?? ""))
      ?.click(),
  );
  await sleep(1200);
  const bought = await page.evaluate(() => {
    const card =
      document.querySelector("[data-ingredient=tomato]") ??
      document.querySelector("[data-ingredient]");
    const b = [...(card?.querySelectorAll("button") ?? [])].find((x) =>
      /^Buy /.test(x.textContent?.trim() ?? ""),
    );
    b?.click();
    return { id: card?.getAttribute("data-ingredient"), clicked: !!b };
  });
  await sleep(1200);
  const afterBuy = await readSave(page);
  const chipInMarket = await page.evaluate(
    () => document.querySelector('[data-testid="fridge-sort-chip"]')?.textContent?.trim() ?? null,
  );
  check(
    "S8 buying in the Market puts the food on the crate (Level 14+) and the chip shows it",
    bought.clicked &&
      afterBuy.business.fridgeSort?.crate?.includes(bought.id) &&
      /Put it away · 1/.test(chipInMarket ?? ""),
    { bought, crate: afterBuy.business.fridgeSort?.crate, chipInMarket },
  );

  // ---- S9: skip keeps the crate; the Prep Cook clears it ----
  await boot(page, saveAt(20));
  await openInventory(page);
  await tap(page, '[data-testid="fridge-sort-chip"]');
  await sleep(700);
  await tap(page, '[data-testid="sort-token-tomato"]'); // select (does not start the clock)
  await tap(page, `[data-testid="sort-target-${WHERE.tomato}"]`); // starts and places
  await tap(page, '[data-testid="sort-pause"]');
  await sleep(300);
  const paused = (await state(page))?.phase;
  const t1 = await page.evaluate(
    () => document.querySelector('[data-testid="sort-timer"]')?.textContent,
  );
  await sleep(1500);
  const t2 = await page.evaluate(
    () => document.querySelector('[data-testid="sort-timer"]')?.textContent,
  );
  await tap(page, '[data-testid="sort-skip"]');
  await sleep(900);
  const skipped = await readSave(page);
  check(
    "S9a Pause freezes the clock; Skip leaves the whole crate waiting (nothing is lost, no reward)",
    paused === "paused" &&
      t1 === t2 &&
      skipped.business.fridgeSort?.crate?.length === 6 &&
      !(skipped.business.secondFloor?.hype > 0),
    { paused, t1, t2, crate: skipped.business.fridgeSort?.crate?.length },
  );
  await boot(page, saveAt(20, {}, { staff: { hiredRoles: ["prep-cook"] } }));
  await openInventory(page);
  await tap(page, '[data-testid="fridge-sort-chip"]');
  await sleep(700);
  const hasAuto = await page.evaluate(() => !!document.querySelector('[data-testid="sort-auto"]'));
  await tap(page, '[data-testid="sort-auto"]');
  await sleep(900);
  const auto = await readSave(page);
  check(
    "S9b with a Prep Cook hired the crate can be put away by him: it is gone, no Hype, no stars",
    hasAuto &&
      !auto.business.fridgeSort?.crate?.length &&
      !(auto.business.secondFloor?.hype > 0) &&
      !auto.business.fridgeSort?.stars,
    { hasAuto, fs: auto.business.fridgeSort },
  );

  // ---- S10: Reduced Motion ----
  const rm = saveAt(20);
  rm.settings = { ...rm.settings, reducedMotion: true };
  await boot(page, rm);
  await openInventory(page);
  await tap(page, '[data-testid="fridge-sort-chip"]');
  await sleep(700);
  await tap(page, '[data-testid="sort-token-tomato"]');
  await tap(page, `[data-testid="sort-target-${WHERE.tomato}"]`);
  const floating = await page.evaluate(
    () => document.querySelectorAll('[class*="floatUp"]').length,
  );
  const placedRM = (await state(page))?.left;
  check(
    "S10 Reduced Motion: no floating-score animation, and the round still works",
    floating === 0 && placedRM === 5,
    { floating, placedRM },
  );

  // ---- S11: a small phone ----
  await boot(page, saveAt(20));
  await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
  await sleep(500);
  await openInventory(page);
  await tap(page, '[data-testid="fridge-sort-chip"]');
  await sleep(900);
  const small = await page.evaluate(() => {
    const els = [
      ...document.querySelectorAll('[data-testid^="sort-token-"]'),
      ...document.querySelectorAll("[data-target-id]"),
    ];
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      minH: Math.min(...els.map((e) => e.getBoundingClientRect().height)),
      count: els.length,
    };
  });
  await shot(page, "fridgesort-320");
  check(
    "S11 at 320 x 568: no sideways scroll and every token and shelf is at least 48 px tall",
    small.overflowX <= 0 && small.minH >= 48 && small.count >= 11,
    small,
  );

  // ---- S13: an expiring token pays double (Level 74+) ----
  await boot(
    page,
    saveAt(
      80,
      {},
      {
        calendar: { businessDay: 20 },
        inventory: {
          ...STOCK,
          tomato: { ingredientId: "tomato", quantity: 4, unitCost: 100, purchaseDay: 14 },
          cheddar: { ingredientId: "cheddar", quantity: 4, unitCost: 100, purchaseDay: 17 },
        },
      },
    ),
  );
  await openInventory(page);
  await tap(page, '[data-testid="fridge-sort-chip"]');
  await sleep(900);
  const exp = await page.evaluate(() =>
    [...document.querySelectorAll('[data-token][data-expiring="1"]')].map((e) => e.dataset.token),
  );
  await tap(page, '[data-token="tomato"]');
  await tap(page, '[data-target-id="veg-salad"]');
  const first = await state(page);
  check(
    "S13 Level 80: tomato and cheddar (spoiling tonight) are hourglass tokens, and the first right drop of one pays 200",
    exp.length === 2 && exp.includes("tomato") && exp.includes("cheddar") && first?.score === "200",
    { exp, score: first?.score },
  );

  // ---- S14: magnets on the Inventory fridge door ----
  await boot(page, saveAt(20, {}, { fridgeSort: { perfect: 7 } }));
  await openInventory(page);
  const mag2 = await page.evaluate(() => {
    const m = document.querySelector('[data-testid="fridge-magnets"]');
    return m ? { n: Number(m.dataset.count), imgs: m.querySelectorAll("img").length } : null;
  });
  await boot(page, saveAt(20, {}, { fridgeSort: { perfect: 2 } }));
  await openInventory(page);
  const mag0 = await page.evaluate(
    () => !!document.querySelector('[data-testid="fridge-magnets"]'),
  );
  check(
    "S14 7 three-star crates = 2 magnets on the door; 2 crates = none",
    mag2?.n === 2 && mag2.imgs === 2 && !mag0,
    { mag2, mag0 },
  );

  // ---- S15: the painted pieces load ----
  await boot(page, saveAt(80));
  await openInventory(page);
  await tap(page, '[data-testid="fridge-sort-chip"]');
  await sleep(1200);
  const art = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("img[data-fridge-art]")];
    return {
      n: imgs.length,
      bad: imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.dataset.fridgeArt),
      names: [...new Set(imgs.map((i) => i.dataset.fridgeArt))],
    };
  });
  check(
    "S15 the painted HUD, star bar, crate, bins, drawers, racks and shelves all load",
    art.n >= 14 && art.bad.length === 0,
    art,
  );

  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("S12 no console errors", errors.length === 0, errors.slice(0, 3));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `FRIDGE SORT E2E: ${failed.length} FAILURE(S)` : "FRIDGE SORT E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
