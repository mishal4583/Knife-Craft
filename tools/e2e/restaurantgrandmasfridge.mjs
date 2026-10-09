// Grandma's fridge (developer 2026-10-09, Levels 1–15 pass 2), restaurant build, in a real browser:
//   1. Level 2 finished → reaching Level 3: Level Complete says Grandma's leftovers arrived;
//      the save holds them at cost 0 with no ledger entry; Inventory explains them and lists them.
//   2. Level 3 uses nothing; Level 4 uses exactly its tomato and cucumber; Level Complete shows
//      what's left and Inventory shows the new amounts at once; wallet = ledger throughout.
//   3. Level 12: Grandma's note lists what's running low (the real fridge), START still works.
//   4. Level 13: the top-up lists only what's missing; Buy → the Market on that ingredient at the
//      exact step → Buy → back: the row turns ✓; one ledger entry, wallet moved by its cost;
//      START starts the level and the order uses the bought mushroom.
//   5. Level 13 with plenty in the fridge: nothing to buy. With $0: says so, START still works.
//   6. Level 14: the preview includes Level 15's mozzarella.
//   6b. Pass 2 review: Level 3 Inventory has no menu figures (no "/ 48 dishes", no "low for
//       today's menu", "menu opens at Level 11"); Level 11 counts the real 4-dish menu.
//   6c. Level 15's first play shows the hand-over card even with food in the fridge.
//   7. 320×568: the sheet fits, no sideways scroll, buttons ≥ 48 px.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  shot,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

/** Stock as Grandma's leftovers sit in the fridge (cost 0, bought on Business Day 1). */
const stock = (q) =>
  Object.fromEntries(
    Object.entries(q).map(([id, quantity]) => [
      id,
      { ingredientId: id, quantity, unitCost: 0, purchaseDay: 1 },
    ]),
  );
const GIVEN = {
  atLevel: 3,
  lines: [
    { ingredientId: "tomato", quantity: 1.3 },
    { ingredientId: "cucumber", quantity: 0.65 },
  ],
};
const at = (n, extra = {}, business = {}) =>
  seedSave({
    business: { ...MOVED_IN_BUSINESS, ...business },
    credits: 5000,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
    ...extra,
  });
const ledgerSum = (s, from = 0) => s.economyLedger.slice(from).reduce((t, e) => t + e.amount, 0);
const inv = (s) =>
  Object.fromEntries(Object.entries(s.business.inventory).map(([k, v]) => [k, v.quantity]));
const notes = () =>
  page.evaluate(
    () =>
      document.querySelector('[data-testid="banner-notes"]')?.innerText.replace(/\s+/g, " ") ?? "",
  );
const inHud = () =>
  page.evaluate(() => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText));
const fridgeCard = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="psc-grandmas-fridge"]');
    if (!el) return null;
    return {
      stage: el.getAttribute("data-fridge-stage"),
      rows: [...el.querySelectorAll("[data-fridge-ingredient]")].map((r) => ({
        id: r.getAttribute("data-fridge-ingredient"),
        status: r.getAttribute("data-fridge-status"),
        button: r.querySelector("button")?.textContent.trim() ?? "",
      })),
      text: el.innerText.replace(/\s+/g, " "),
    };
  });
const startButton = () =>
  page.evaluate(() => {
    const b = [...document.querySelectorAll('[data-testid="pre-service-check"] button')].find((x) =>
      /^(OPEN THE RESTAURANT|START SERVICE)$/.test(x.textContent.trim()),
    );
    return b ? { disabled: b.disabled } : null;
  });
async function nav(label) {
  await page.evaluate(
    (l) =>
      [...document.querySelectorAll("nav button")].find((x) => x.textContent.includes(l))?.click(),
    label,
  );
  await sleep(800);
}
async function prepareToday() {
  await nav("Kitchen");
  await clickButton(page, /^Prepare$/);
  await sleep(1000);
}
async function playLevel() {
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    { timeout: 30000 },
  );
  const played = await playToReport(page, { maxMs: 150000 });
  await clickButton(page, /^Continue$/);
  await sleep(900);
  if (/ORDER READY/i.test(await page.evaluate(() => document.body.innerText))) {
    await clickButton(page, /^Serve to /);
    await sleep(900);
  }
  await clickButton(page, /^Finish Level$/);
  await sleep(1200);
  return played.ok;
}

// ---------- 1. Reaching Level 3: Grandma's leftovers ----------
await boot(page, at(2));
const s2 = await readSave(page);
await prepareToday();
const played2 = await playLevel();
const n2 = await notes();
const s3 = await readSave(page);
const given = s3.business.grandmasFridge;
check(
  "1a reaching Level 3: Level Complete says the leftovers arrived; the save holds them at cost 0, no ledger entry for them",
  played2 &&
    /Grandma's leftovers are in the fridge/.test(n2) &&
    !!given &&
    given.atLevel === 3 &&
    given.lines.every((l) => s3.business.inventory[l.ingredientId]?.unitCost === 0) &&
    !s3.economyLedger.some((e) => /inventory|pantry/.test(e.category)) &&
    s3.credits - s2.credits === ledgerSum(s3, s2.economyLedger.length),
  { n2, given },
);
await sleep(6500);
// Developer 2026-10-09: the Kitchen tells a new player where to look, and the
// Inventory offers nothing that leads into a section still closed.
await nav("Kitchen");
const tip3 = await page.evaluate(() => ({
  tip: document.querySelector('[data-testid="kitchen-tip"]')?.textContent ?? "",
  isNew: !!document.querySelector('nav button[data-nav="inventory"] [data-nav-new]'),
}));
await clickButton(page, /^Open Inventory$/);
await sleep(900);
const onInventory = await page.evaluate(
  () => !!document.querySelector('[data-testid="inventory"]'),
);
const deadLinks = await page.evaluate(() => ({
  upgrade: !!document.querySelector('[data-testid="fridge-upgrade"]'),
  buttons: [...document.querySelectorAll("button")]
    .map((b) => b.textContent.trim())
    .filter((t) => /Upgrade Refrigerator|View Business Performance|Restock|Go to Market/.test(t)),
}));
check(
  "1d Level 3: Grandma's tip on the Kitchen card opens Inventory (NEW badge); no link there leads to a closed Market or Restaurant",
  /I left food in the fridge/.test(tip3.tip) &&
    tip3.isNew &&
    onInventory &&
    !deadLinks.upgrade &&
    deadLinks.buttons.length === 0,
  { tip3, onInventory, deadLinks },
);
const invText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
await shot(page, "grandma-inventory-l3");
check(
  "1b Inventory explains Grandma's leftovers and lists them",
  /Grandma's leftovers/i.test(invText) &&
    /Tomato[^$]{0,80}\b1\.3 lb/.test(invText) &&
    /Cucumber[^$]{0,80}\b0\.65 lb/.test(invText),
  invText.slice(0, 1200),
);
// Pass 2 review: no menu figures before the menu opens (Level 11).
const menuCards = await page.evaluate(() => ({
  low: !!document.querySelector('[data-testid="summary-low"]'),
  ready: !!document.querySelector('[data-testid="summary-ready"]'),
  opens: document.querySelector('[data-testid="summary-menu-opens"]')?.textContent ?? "",
  lowGroup: /Low for today's menu/i.test(document.body.innerText),
  dishCount: /\/\s*48 dishes/.test(document.body.innerText),
}));
check(
  "1c Level 3 Inventory: no 'running low for today's menu', no '/ 48 dishes'; it says the menu opens at Level 11",
  !menuCards.low &&
    !menuCards.ready &&
    !menuCards.lowGroup &&
    !menuCards.dishCount &&
    /opens at Level 11/.test(menuCards.opens),
  menuCards,
);

// ---------- 2. Level 3 uses nothing, Level 4 uses its own ----------
const before3 = await readSave(page);
await prepareToday();
const played3 = await playLevel();
const after3 = await readSave(page);
check(
  "2a Level 3 uses nothing from the fridge",
  played3 && JSON.stringify(inv(after3)) === JSON.stringify(inv(before3)),
  { before: inv(before3), after: inv(after3) },
);
await sleep(6500);
await prepareToday();
const played4 = await playLevel();
const n4 = await notes();
const after4 = await readSave(page);
const dTomato = +(inv(after3).tomato - inv(after4).tomato).toFixed(3);
const dCucumber = +(inv(after3).cucumber - inv(after4).cucumber).toFixed(3);
check(
  "2b Level 4 uses its tomato and cucumber (0.3 lb each, Chef's knife), Level Complete shows what's left; wallet = ledger",
  played4 &&
    dTomato === 0.3 &&
    dCucumber === 0.3 &&
    /Left in the fridge: Tomato 1 lb · Cucumber 0\.35 lb/.test(n4) &&
    after4.credits - after3.credits === ledgerSum(after4, after3.economyLedger.length),
  { dTomato, dCucumber, n4 },
);
await sleep(6500);
await nav("Inventory");
const inv4 = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
check(
  "2c Inventory shows the new amount at once (Tomato 1 lb)",
  /Tomato[^$]{0,80}\b1 lb/.test(inv4),
  inv4.slice(0, 400),
);

// ---------- 3. Level 12: running low ----------
const L12 = stock({
  tomato: 0.4,
  cucumber: 0.05,
  onion: 0.05,
  potato: 0.05,
  garlic: 0.05,
  carrot: 0.05,
  bread: 0.3,
  basil: 0.3,
});
await boot(page, at(12, {}, { inventory: L12, grandmasFridge: GIVEN }));
await prepareToday();
const low = await fridgeCard();
const start12 = await startButton();
await shot(page, "grandma-l12-low");
check(
  "3 Level 12: Grandma's note lists what's running low from the real fridge; START isn't blocked",
  low?.stage === "low" &&
    ["bread", "mushroom", "zucchini", "carrot"].every((id) =>
      low.rows.some((r) => r.id === id && r.status !== "ok"),
    ) &&
    !low.rows.some((r) => r.id === "tomato") &&
    start12 &&
    !start12.disabled,
  { low, start12 },
);

// ---------- 4. Level 13: the top-up ----------
const L13 = stock({
  tomato: 0.1,
  cucumber: 0.05,
  onion: 0.05,
  potato: 0.05,
  garlic: 0.025,
  carrot: 0.05,
  bread: 0.05,
  basil: 0.05,
});
await boot(page, at(13, {}, { inventory: L13, grandmasFridge: GIVEN }));
const before13 = await readSave(page);
await prepareToday();
const top = await fridgeCard();
await shot(page, "grandma-l13-top-up");
check(
  "4a Level 13: the top-up offers only what's missing (bread, mushroom, zucchini, carrot), garlic is enough",
  top?.stage === "top-up" &&
    ["bread", "mushroom", "zucchini", "carrot"].every((id) =>
      top.rows.some((r) => r.id === id && /^Buy /.test(r.button)),
    ) &&
    top.rows.some((r) => r.id === "garlic" && r.status === "ok" && r.button === "") &&
    /Top-up: \$3\.55/.test(top.text),
  top,
);
await page.evaluate(() =>
  document.querySelector('[data-fridge-ingredient="mushroom"] button')?.click(),
);
await sleep(900);
const market = await page.evaluate(() => {
  const card = document.querySelector('[data-ingredient="mushroom"]');
  const buy =
    card && [...card.querySelectorAll("button")].find((b) => /^Buy /.test(b.textContent.trim()));
  const text = buy?.textContent.trim() ?? "";
  buy?.click();
  return { card: !!card, pill: !!document.querySelector('[data-testid="psc-back"]'), text };
});
await sleep(700);
await page.evaluate(() => document.querySelector('[data-testid="psc-back"]')?.click());
await sleep(900);
const afterBuy = await readSave(page);
const top2 = await fridgeCard();
const newEntries = afterBuy.economyLedger.slice(before13.economyLedger.length);
check(
  "4b Buy → the Market on mushroom at the exact step (¼ lb) → Buy → back: ✓ Enough; one ledger entry, wallet moved by it",
  market.card &&
    market.pill &&
    /^Buy 0\.25 lb/.test(market.text) &&
    top2?.rows.some((r) => r.id === "mushroom" && r.status === "ok") &&
    newEntries.length === 1 &&
    newEntries[0].category === "inventory-purchase" &&
    afterBuy.credits - before13.credits === newEntries[0].amount &&
    Math.abs(afterBuy.business.inventory.mushroom.quantity - 0.25) < 1e-9,
  { market, newEntries, top2: top2?.rows },
);
await clickButton(page, /^(OPEN THE RESTAURANT|START SERVICE)$/);
await sleep(1200);
const started13 = await inHud();
const played13 = started13 && (await playLevel());
const after13 = await readSave(page);
check(
  "4c START starts Level 13; its order uses the bought mushroom",
  played13 && !after13.business.inventory.mushroom,
  { inventory: inv(after13) },
);

// ---------- 5. Surplus and $0 ----------
await boot(
  page,
  at(
    13,
    {},
    {
      inventory: stock({ bread: 2, mushroom: 1, garlic: 0.5, zucchini: 2, carrot: 1 }),
      grandmasFridge: GIVEN,
    },
  ),
);
await prepareToday();
const plenty = await fridgeCard();
check(
  "5a with plenty in the fridge the top-up asks for nothing",
  plenty?.stage === "top-up" &&
    plenty.rows.every((r) => r.status === "ok" && r.button === "") &&
    /Nothing to buy/.test(plenty.text),
  plenty,
);
await boot(page, at(13, { credits: 0 }, { inventory: L13, grandmasFridge: GIVEN }));
await prepareToday();
const broke = await fridgeCard();
const start0 = await startButton();
check(
  "5b with $0 it says not all of it can be bought, and START still works",
  /not enough money/.test(broke?.text ?? "") && start0 && !start0.disabled,
  { text: broke?.text, start0 },
);

// ---------- 6. Level 14: preview ----------
await boot(
  page,
  at(
    14,
    {},
    {
      inventory: stock({ tomato: 0.1, cucumber: 0.05, carrot: 0.05, basil: 0.05 }),
      grandmasFridge: GIVEN,
    },
  ),
);
await prepareToday();
const preview = await fridgeCard();
check(
  "6 Level 14: the preview covers Levels 14–15 (zucchini … mozzarella)",
  preview?.stage === "preview" &&
    preview.rows.some((r) => r.id === "zucchini") &&
    preview.rows.some((r) => r.id === "mozzarella") &&
    /Levels 14–15/i.test(preview.text),
  preview,
);

// ---------- 6b. Level 11: the real menu ----------
await boot(
  page,
  at(11, {}, { inventory: stock({ bread: 0.55, garlic: 0.1 }), grandmasFridge: GIVEN }),
);
await nav("Inventory");
const inv11 = await page.evaluate(() => ({
  ready:
    document.querySelector('[data-testid="summary-ready"]')?.textContent.replace(/\s+/g, " ") ?? "",
  opens: !!document.querySelector('[data-testid="summary-menu-opens"]'),
}));
check(
  "6b Level 11 Inventory counts the real 4-dish menu (not 48)",
  /\/ 4 dishes/.test(inv11.ready) && !inv11.opens,
  inv11,
);

// ---------- 6c. Level 15: the hand-over, with food in the fridge ----------
await boot(
  page,
  at(
    15,
    {},
    {
      inventory: stock({ tomato: 0.4, basil: 0.3, zucchini: 0.5, carrot: 0.25 }),
      grandmasFridge: GIVEN,
    },
  ),
);
await prepareToday();
const handOver = await page.evaluate(
  () =>
    document.querySelector('[data-testid="psc-first-restock"]')?.innerText.replace(/\s+/g, " ") ??
    null,
);
// From Level 15 the normal check applies (unchanged): the missing mozzarella is a Restock row.
const rows15 = await page.evaluate(() =>
  [...document.querySelectorAll("[data-psc-ingredient]")].map((r) => [
    r.getAttribute("data-psc-ingredient"),
    r.getAttribute("data-psc-status"),
  ]),
);
await shot(page, "grandma-l15-hand-over");
check(
  "6c Level 15's first play shows the hand-over (leftovers + top-up → Pre-Service Check) with food in the fridge",
  !!handOver &&
    /first shopping trip/i.test(handOver) &&
    /My leftovers and your top-up got us this far/.test(handOver) &&
    rows15.some(([id, st]) => id === "mozzarella" && st === "missing") &&
    rows15.some(([id, st]) => id === "tomato" && st === "ok"),
  { handOver, rows15 },
);

// ---------- 7. 320 px ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(page, at(13, {}, { inventory: L13, grandmasFridge: GIVEN }));
await prepareToday();
const fit = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="pre-service-check"]');
  const buttons = el ? [...el.querySelectorAll("button")].filter((b) => b.offsetParent) : [];
  return {
    open: !!el,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: buttons
      .filter(
        (b) => b.getBoundingClientRect().height < 47.5 && b.getAttribute("aria-label") !== "Close",
      )
      .map((b) => b.textContent.trim()),
  };
});
await shot(page, "grandma-l13-320");
check(
  "7 at 320×568 the sheet fits, no sideways scroll, buttons ≥ 48 px",
  fit.open && fit.overflow <= 0 && fit.small.length === 0,
  fit,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("8 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `GRANDMA'S FRIDGE E2E: ${failed.length} FAILURE(S)`
    : "GRANDMA'S FRIDGE E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
