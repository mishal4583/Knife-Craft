// Fridge Sort (developer 2026-11-03; the basket of loose pieces, developer 2026-11-05), restaurant build, in a real browser: the "Unpack the delivery"
// mini-game (business/fridgeSort.ts). A purchase becomes loose PIECES (1 lb of tomato = 3 tomatoes) mixed in one basket; each piece goes to a shelf.
//   S1 below Level 3 there is no chip; from Level 3 a basket of bought food shows "Unpack delivery · 7" (the pieces) above the Inventory fridge
//   S2 the chip opens the game: the how-to card shows the first time, the clock does NOT run until the first touch; 7 pieces, the targets
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
//   S15 the painted pieces (HUD, star bar, basket, bins, drawers, racks, shelves) all load
//   S16 the how-to card is shown once (until a crate is finished) and the ? button brings it back
//   S17 an empty shelf shows pictures of what lives there at EVERY level (developer 2026-11-07: players could not tell the shelves apart)
//   S18 Level 3: the first basket is small (8 pieces at most) and a wrong shelf tells where the piece goes
//   S20 a delivery of 30 pieces is 3 baskets: the run is shown, and the whole delivery adds bonus Hype
//   S19 two or more stars keep the stock fresh longer: the result says so and the stock's purchase day moves (quantity unchanged)
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
// 2 tomatoes and one piece of everything else = 7 loose pieces in the basket
const COUNTS = { tomato: 2, carrot: 1, cheddar: 1, apple: 1, salmon: 1, basil: 1 };
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
      fridgeSort: { crate: CRATE, counts: COUNTS, seed: 1 },
      ...business,
    },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
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
/** Opens the game from the chip and dismisses the first-time how-to card (returns whether it was shown). */
const openGame = async (page) => {
  await tap(page, '[data-testid="fridge-sort-chip"]');
  await sleep(800);
  const guide = await page.evaluate(() => !!document.querySelector('[data-testid="sort-guide"]'));
  if (guide) await tap(page, '[data-testid="sort-guide-ok"]');
  await sleep(200);
  return guide;
};
/** Sorts every piece still in the basket onto its right shelf (tap the piece, then the shelf). */
const sortAll = async (page) => {
  for (let k = 0; k < 40; k++) {
    const id = await page.evaluate(
      () => document.querySelector("[data-piece]")?.getAttribute("data-token") ?? null,
    );
    if (!id) return;
    await tap(page, "[data-piece]");
    await tap(page, `[data-testid="sort-target-${WHERE[id]}"]`);
  }
};
// the freshness reward moves the stock's purchase day, so the stock is compared without it
const strip = (s) => {
  const c = structuredClone(s);
  delete c.business.fridgeSort;
  delete c.business.secondFloor;
  delete c.business.inventory;
  return JSON.stringify(c);
};
const quantities = (s) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(s.business.inventory).map(([k, v]) => [k, [v.quantity, v.unitCost]]),
    ),
  );

const { browser, page, logs } = await launch();
try {
  // ---- S1: closed below Level 3, open from it ----
  await boot(page, saveAt(2));
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
    "S1 no chip at Level 2; at Level 20 the chip says Unpack delivery · 7 (the loose pieces)",
    !closed && /Unpack delivery · 7/.test(chip ?? ""),
    {
      closed,
      chip,
    },
  );
  const before = await readSave(page);

  // ---- S2: open the game ----
  const guideShown = await openGame(page);
  const s2 = await state(page);
  const targets = await page.$$eval('[data-testid="sort-targets"] [data-target-id]', (els) =>
    els.map((e) => e.dataset.targetId),
  );
  await shot(page, "fridgesort-ready");
  await sleep(1500);
  const s2b = await state(page);
  check(
    "S2 the game opens with the how-to card, then ready: 7 pieces, 5+ shelves, and the clock waits for the first touch",
    guideShown &&
      s2?.phase === "ready" &&
      s2.tokens === 7 &&
      s2.left === 7 &&
      targets.length >= 5 &&
      s2.timer === s2b?.timer,
    { s2, s2b, targets },
  );

  // ---- S3: a wrong drop, then a right one by tap + tap ----
  await dragTo(page, '[data-testid="sort-token-tomato"]', '[data-testid="sort-target-dairy"]');
  const wrong = await state(page);
  const wrongNote = await page.evaluate(
    () => document.querySelector('[data-testid="sort-note"]')?.textContent ?? null,
  );
  const wrongBack = await page.evaluate(
    () => !!document.querySelector('[data-testid="sort-token-tomato"]'),
  );
  await tap(page, '[data-testid="sort-token-tomato"]');
  await tap(page, `[data-testid="sort-target-${WHERE.tomato}"]`);
  const right = await state(page);
  check(
    "S3 a wrong drop springs back (nothing placed, no points) and says where it goes; tap the piece then its shelf places it",
    wrong?.left === 7 &&
      wrongBack &&
      wrong.score === "0" &&
      /Tomato goes in/.test(wrongNote ?? "") &&
      right?.left === 6 &&
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
    "S4 dragging a piece onto its shelf places it (and the combo scores 125)",
    dragged?.left === 5 && Number(dragged.score) === 225,
    dragged,
  );

  // ---- S5: finish the crate ----
  await sortAll(page);
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
          fresh: document.querySelector('[data-testid="sort-fresh"]')?.textContent ?? "",
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
      /Stays fresh/.test(result.fresh) &&
      (after.business.secondFloor?.hype ?? 0) > 0 &&
      !after.business.fridgeSort?.crate?.length &&
      after.business.fridgeSort?.rounds === 1,
    { result, hype: after.business.secondFloor?.hype, fs: after.business.fridgeSort },
  );
  check(
    "S6 credits, quantities, prices and the ledger are identical before and after the whole round (only the freshness days move)",
    after.credits === before.credits &&
      quantities(after) === quantities(before) &&
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
    "S8 buying in the Market puts the food in the basket (Level 3+): the chip counts the pieces bought (1 lb of tomato = 3)",
    bought.clicked &&
      afterBuy.business.fridgeSort?.crate?.includes(bought.id) &&
      Number(/Unpack delivery · (\d+)/.exec(chipInMarket ?? "")?.[1]) ===
        afterBuy.business.fridgeSort?.counts?.[bought.id] &&
      afterBuy.business.fridgeSort?.counts?.[bought.id] >= 1,
    { bought, fs: afterBuy.business.fridgeSort, chipInMarket },
  );

  // ---- S9: skip keeps the crate; the Prep Cook clears it ----
  await boot(page, saveAt(20));
  await openInventory(page);
  await openGame(page);
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
  await openGame(page);
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
  await openGame(page);
  await tap(page, '[data-testid="sort-token-tomato"]');
  await tap(page, `[data-testid="sort-target-${WHERE.tomato}"]`);
  const floating = await page.evaluate(
    () => document.querySelectorAll('[class*="floatUp"]').length,
  );
  const placedRM = (await state(page))?.left;
  check(
    "S10 Reduced Motion: no floating-score animation, and the round still works",
    floating === 0 && placedRM === 6,
    { floating, placedRM },
  );

  // ---- S11: a small phone ----
  await boot(page, saveAt(20));
  await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
  await sleep(500);
  await openInventory(page);
  await openGame(page);
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
    "S11 at 320 x 568: no sideways scroll and every piece and shelf is at least 48 px tall",
    small.overflowX <= 0 && small.minH >= 48 && small.count >= 12,
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
  await openGame(page);
  const exp = await page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('[data-token][data-expiring="1"]')].map((e) => e.dataset.token),
    ),
  ]);
  await tap(page, '[data-token="tomato"]');
  await tap(page, '[data-target-id="veg-salad"]');
  const first = await state(page);
  check(
    "S13 Level 80: tomato and cheddar (spoiling tonight) are hourglass pieces, and the first right drop of one pays 200",
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
  await openGame(page);
  await sleep(800);
  const art = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("img[data-fridge-art]")];
    return {
      n: imgs.length,
      bad: imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.dataset.fridgeArt),
      names: [...new Set(imgs.map((i) => i.dataset.fridgeArt))],
    };
  });
  check(
    "S15 the painted HUD, star bar, basket, bins, drawers, racks and shelves all load",
    art.n >= 14 && art.bad.length === 0,
    art,
  );

  // ---- S16: the how-to card shows once, the ? button brings it back ----
  await boot(page, saveAt(20));
  await openInventory(page);
  await tap(page, '[data-testid="fridge-sort-chip"]');
  await sleep(800);
  const g1 = await page.evaluate(() => !!document.querySelector('[data-testid="sort-guide"]'));
  await tap(page, '[data-testid="sort-guide-ok"]');
  const g2 = await page.evaluate(() => !!document.querySelector('[data-testid="sort-guide"]'));
  await tap(page, '[data-testid="sort-help"]');
  const g3 = await page.evaluate(() => !!document.querySelector('[data-testid="sort-guide"]'));
  await tap(page, '[data-testid="sort-guide-ok"]');
  await boot(
    page,
    saveAt(20, {}, { fridgeSort: { crate: CRATE, counts: COUNTS, seed: 1, rounds: 3 } }),
  );
  await openInventory(page);
  await tap(page, '[data-testid="fridge-sort-chip"]');
  await sleep(800);
  const g4 = await page.evaluate(() => !!document.querySelector('[data-testid="sort-guide"]'));
  check(
    "S16 the how-to card shows the first time, closes with Got it, comes back from the ? button, and stays away once a crate was finished",
    g1 && !g2 && g3 && !g4,
    { g1, g2, g3, g4 },
  );

  // ---- S17: pictures of what lives on a shelf ----
  const pics = async (n) => {
    await boot(page, saveAt(n));
    await openInventory(page);
    await openGame(page);
    await shot(page, `fridgesort-level-${n}`);
    return page.evaluate(
      () => document.querySelectorAll("[data-target-id] img[data-ingredient-icon]").length,
    );
  };
  const p20 = await pics(20);
  const p80 = await pics(80);
  check(
    "S17 an empty shelf shows pictures of what lives there at Level 20 AND at Level 80 (it was none from Level 44)",
    p20 >= 9 && p80 >= 9,
    { p20, p80 },
  );

  // ---- S18: Level 3 ----
  await boot(
    page,
    saveAt(
      3,
      {},
      { fridgeSort: { crate: ["tomato", "cheddar"], counts: { tomato: 3, cheddar: 2 }, seed: 1 } },
    ),
  );
  await openInventory(page);
  await openGame(page);
  const l3 = await state(page);
  const l3targets = await page.$$eval("[data-target-id]", (e) => e.length);
  await tap(page, '[data-testid="sort-token-tomato"]');
  await tap(page, '[data-target-id="dairy"]');
  const l3note = await page.evaluate(
    () => document.querySelector('[data-testid="sort-note"]')?.textContent ?? "",
  );
  check(
    "S18 Level 3: a basket of 5 pieces and 3 shelves; a wrong shelf says where the tomato goes",
    l3?.tokens === 5 && l3targets === 3 && /Tomato goes in: .*Salad/.test(l3note),
    { l3, l3targets, l3note },
  );

  // ---- S19: freshness days ----
  await boot(page, saveAt(20));
  await openInventory(page);
  await openGame(page);
  const beforeDays = (await readSave(page)).business.inventory.tomato.purchaseDay;
  await sortAll(page);
  await sleep(500);
  const afterSave = await readSave(page);
  const today = afterSave.business.calendar.businessDay;
  check(
    "S19 a well sorted basket keeps the tomatoes fresh longer: the purchase day moves forward (never more than 2 days past today), quantity unchanged",
    afterSave.business.inventory.tomato.purchaseDay > beforeDays &&
      afterSave.business.inventory.tomato.purchaseDay <= today + 2 &&
      afterSave.business.inventory.tomato.quantity === 4,
    { beforeDays, after: afterSave.business.inventory.tomato.purchaseDay, today },
  );

  // ---- S20: a big delivery (30 pieces = 3 baskets at Level 20): the run, then the bonus ----
  const five = Object.fromEntries(CRATE.map((id) => [id, 5]));
  await boot(
    page,
    saveAt(20, {}, { fridgeSort: { crate: CRATE, counts: five, seed: 1, rounds: 1 } }),
  );
  await openInventory(page);
  const chipBig = await page.evaluate(
    () => document.querySelector('[data-testid="fridge-sort-chip"]')?.textContent ?? "",
  );
  await openGame(page);
  const slipMore = await page.evaluate(
    () => document.querySelector('[data-testid="sort-more-baskets"]')?.textContent ?? "",
  );
  await sortAll(page);
  await sleep(500);
  const chain1 = await page.evaluate(
    () => document.querySelector('[data-testid="sort-chain"]')?.textContent ?? "",
  );
  await tap(page, '[data-testid="sort-next"]');
  await sleep(400);
  await sortAll(page);
  await sleep(500);
  await tap(page, '[data-testid="sort-next"]');
  await sleep(400);
  await sortAll(page);
  await sleep(500);
  const bigText = await page.evaluate(
    () => document.querySelector('[data-testid="sort-big-delivery"]')?.textContent ?? "",
  );
  const bigSave = await readSave(page);
  check(
    "S20 30 pieces = 3 baskets: the chip counts 30, the first basket says 2 more + the bonus, the last shows 'Whole delivery unpacked' +10 Hype",
    /Unpack delivery · 30/.test(chipBig) &&
      /\+2 more baskets/.test(slipMore) &&
      /2 more baskets/.test(chain1) &&
      /\+10 Hype/.test(chain1) &&
      /Whole delivery unpacked \(3 baskets\)/.test(bigText) &&
      !bigSave.business.fridgeSort?.crate?.length &&
      !bigSave.business.fridgeSort?.chain,
    { chipBig, slipMore, chain1, bigText },
  );

  // ---- S21-S26: the 2026-11-07 fixes (player reviews), at a normal phone size ----
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await boot(page, saveAt(20));
  await openInventory(page);
  await openGame(page);
  await sleep(500);

  // S22: every shelf is on screen with no scrolling; S23: the stool is cropped off and the basket sits low
  const fit = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="sort-fridge"]');
    const crate = document.querySelector('[data-testid="sort-crate"]')?.getBoundingClientRect();
    const root = document.querySelector('[data-testid="fridge-sort"]')?.getBoundingClientRect();
    const shelves = [...document.querySelectorAll("[data-target-id]")].map((e) => {
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });
    const pr = panel?.getBoundingClientRect();
    return {
      overflow: panel ? panel.scrollHeight - panel.clientHeight : null,
      cue: !!document.querySelector('[data-testid="sort-more-shelves"]'),
      allInside: shelves.every(
        (s) => s.top >= (pr?.top ?? 0) - 1 && s.bottom <= (pr?.bottom ?? 0) + 1,
      ),
      shelves: shelves.length,
      panelH: Math.round(pr?.height ?? 0),
      basketRatio: crate ? +(crate.width / crate.height).toFixed(2) : null,
      basketH: crate ? Math.round(crate.height) : null,
      gapToBottom: crate && root ? Math.round(root.bottom - crate.bottom) : null,
    };
  });
  await shot(page, "fridgesort-390-fit");
  check(
    "S22 at 390 x 844 all 6 shelves are inside the fridge with nothing to scroll and no 'more shelves' cue",
    fit.overflow !== null && fit.overflow <= 1 && !fit.cue && fit.allInside && fit.shelves === 6,
    fit,
  );
  check(
    "S23 the stool is cropped off: the basket is wide and low (ratio about 2.2) and sits within 12 px of the screen's bottom",
    fit.basketRatio !== null &&
      fit.basketRatio >= 2.1 &&
      fit.basketRatio <= 2.3 &&
      fit.gapToBottom !== null &&
      fit.gapToBottom <= 12,
    fit,
  );

  // S24: every shelf carries its emoji in the name chip
  const chips = await page.evaluate(() =>
    [...document.querySelectorAll("[data-shelf-chip]")].map(
      (c) => c.querySelector("[data-shelf-icon]")?.textContent?.trim() ?? "",
    ),
  );
  check(
    "S24 every shelf's name chip carries its emoji",
    chips.length === 6 && chips.every((c) => c.length > 0),
    chips,
  );

  // S21: a drop that misses the shelf by a thumb still lands on it: the finger is let go well BELOW the lowest shelf
  const low = await page.evaluate((WHERE) => {
    let best = null;
    for (const [id, where] of Object.entries(WHERE)) {
      const el = document.querySelector(`[data-target-id="${where}"]`);
      const tok = document.querySelector(`[data-token="${id}"]`);
      if (!el || !tok) continue;
      const r = el.getBoundingClientRect();
      if (!best || r.bottom > best.bottom)
        best = { id, where, bottom: r.bottom, x: r.left + r.width / 2 };
    }
    return best;
  }, WHERE);
  const tokA = await center(page, `[data-token="${low.id}"]`);
  await page.mouse.move(tokA.x, tokA.y);
  await page.mouse.down();
  await page.mouse.move((tokA.x + low.x) / 2, (tokA.y + low.bottom) / 2, { steps: 6 });
  await page.mouse.move(low.x, low.bottom + 28, { steps: 6 });
  await page.mouse.up();
  await sleep(300);
  const missed = await page.evaluate(
    (w) => Number(document.querySelector(`[data-target-id="${w}"]`)?.getAttribute("data-count")),
    low.where,
  );
  check("S21 a piece let go 28 px below its shelf (not on it) still lands there", missed === 1, {
    low,
    missed,
  });

  // S25: a wrong drop lights the RIGHT shelf (at every level)
  await boot(page, saveAt(60));
  await openInventory(page);
  await openGame(page);
  await tap(page, '[data-testid="sort-token-tomato"]');
  await tap(page, '[data-target-id="dairy"]');
  await sleep(150);
  const lit = await page.evaluate(() => ({
    right: /border-gold/.test(
      document.querySelector('[data-target-id="veg-salad"]')?.getAttribute("class") ?? "",
    ),
    wrong: /border-gold/.test(
      document.querySelector('[data-target-id="dairy"]')?.getAttribute("class") ?? "",
    ),
    note: document.querySelector('[data-testid="sort-note"]')?.textContent ?? "",
  }));
  check(
    "S25 at Level 60 a wrong drop lights the right shelf (Salad) and the note names it",
    lit.right && !lit.wrong && /Tomato goes in: .*Salad/.test(lit.note),
    lit,
  );

  // S26: practice as often as you like: three practice rounds in a row, the button is still there
  await boot(page, saveAt(20));
  await openInventory(page);
  await openGame(page);
  await sortAll(page);
  await sleep(500);
  const practiceLabels = [];
  for (let k = 0; k < 3; k++) {
    const label = await page.evaluate(
      () => document.querySelector('[data-testid="sort-again"]')?.textContent?.trim() ?? null,
    );
    practiceLabels.push(label);
    if (!label) break;
    await tap(page, '[data-testid="sort-again"]');
    await sleep(300);
    await sortAll(page);
    await sleep(500);
  }
  const lastLabel = await page.evaluate(
    () => document.querySelector('[data-testid="sort-again"]')?.textContent?.trim() ?? null,
  );
  const prac = await state(page);
  check(
    "S26 'Again · practice' then 'Practice again' three times in a row: every result still offers another practice",
    practiceLabels.length === 3 &&
      practiceLabels[0] === "Again · practice" &&
      practiceLabels[1] === "Practice again" &&
      lastLabel === "Practice again" &&
      prac?.practice === "1",
    { practiceLabels, lastLabel, prac },
  );

  // S27: the full 10-shelf fridge (Level 80) at a normal phone: every shelf is in view, no scrolling
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await boot(page, saveAt(80));
  await openInventory(page);
  await openGame(page);
  await sleep(500);
  const full = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="sort-fridge"]');
    const pr = panel?.getBoundingClientRect();
    const shelves = [...document.querySelectorAll("[data-target-id]")].map((e) =>
      e.getBoundingClientRect(),
    );
    return {
      shelves: shelves.length,
      overflow: panel ? panel.scrollHeight - panel.clientHeight : null,
      allInside: shelves.every((r) => r.top >= pr.top - 1 && r.bottom <= pr.bottom + 1),
      minH: Math.round(Math.min(...shelves.map((r) => r.height))),
      cue: !!document.querySelector('[data-testid="sort-more-shelves"]'),
    };
  });
  await shot(page, "fridgesort-390-level80");
  check(
    "S27 at 390 x 844 the full 10-shelf fridge (Level 80) is all in view, nothing to scroll, every shelf at least 48 px tall",
    full.shelves === 10 && full.overflow <= 1 && full.allInside && full.minH >= 48 && !full.cue,
    full,
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
