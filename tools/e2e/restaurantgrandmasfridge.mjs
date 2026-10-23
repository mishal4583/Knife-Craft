// Grandma's fridge is RETIRED (developer redesign 2026-10-15, 0b2ce52: "ingredients are
// purchased in the Market from Level 3 onward; there is no free pantry or ingredient handout";
// scripts/restaurant-grandmas-fridge-qa.mts). Re-baselined 2026-10-17: the old browser checks
// (Level 3 leftovers, the Level 12–14 fridge notes, Grandma's pantry) are in git history before
// this date. In a real browser, restaurant build:
//   1. Finishing Level 2 (reaching Level 3): Level Complete says the Market and Inventory are
//      open, no leftovers; the fridge stays empty and no ledger entry is written.
//   2. Level 3 with an empty fridge: the Pre-Service Check lists the order's ingredients with a
//      Market Restock and START waits; there is no Grandma's fridge card or pantry button.
//   3. Level 3 stocked: the order takes only its own ingredients (tomato and cucumber, Garden
//      Prep); wallet = ledger.
//   4. Level 3 with $0 and an empty fridge (no ads on the mock platform): supplier credit brings
//      the food, no money moves, the price is owed, START opens.
//   5. 320×568: the check fits, no sideways scroll, its buttons ≥ 48 px.
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

const stock = (q) =>
  Object.fromEntries(
    Object.entries(q).map(([id, quantity]) => [
      id,
      { ingredientId: id, quantity, unitCost: 0, purchaseDay: 1 },
    ]),
  );
// Test saves are version 1: credits are whole dollars there (×100 on load).
const at = (n, credits, inventory = {}) =>
  seedSave({
    business: { ...MOVED_IN_BUSINESS, inventory },
    credits,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });
const ledgerSum = (s, from = 0) => s.economyLedger.slice(from).reduce((t, e) => t + e.amount, 0);
const qty = (s) =>
  Object.fromEntries(
    Object.entries(s.business.inventory ?? {})
      .filter(([, v]) => v.quantity > 0)
      .map(([k, v]) => [k, v.quantity]),
  );
const notes = () =>
  page.evaluate(
    () =>
      document.querySelector('[data-testid="banner-notes"]')?.innerText.replace(/\s+/g, " ") ?? "",
  );
const inHud = () =>
  page.evaluate(() => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText));
const sheet = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="pre-service-check"]');
    if (!el) return null;
    const start = [...el.querySelectorAll("button")].find((x) =>
      /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service)|(?:🛒 )?Restock to start)$/.test(
        x.textContent.trim(),
      ),
    );
    return {
      rows: [...el.querySelectorAll("[data-psc-ingredient]")].map((r) => ({
        id: r.getAttribute("data-psc-ingredient"),
        status: r.getAttribute("data-psc-status"),
        restock: [...r.querySelectorAll("button")].some((b) =>
          /^(?:🛒 )?Restock/.test(b.textContent),
        ),
      })),
      fridgeCard: !!el.querySelector('[data-testid="psc-grandmas-fridge"]'),
      text: el.innerText.replace(/\s+/g, " "),
      startDisabled: start ? start.disabled : null,
    };
  });
async function prepareToday() {
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(600);
  await clickButton(page, /^Prepare$/);
  await sleep(1200);
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

// ---------- 1. Level 2 → Level 3: no leftovers ----------
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await boot(page, at(2, 5000));
const b1 = await readSave(page);
await prepareToday();
const played2 = await playLevel();
const n1 = await notes();
const a1 = await readSave(page);
check(
  "1 reaching Level 3: Level Complete says the Market and Inventory are open, no leftovers; the fridge stays empty, no ledger entry",
  played2 &&
    /Inventory is open/.test(n1) &&
    /Market is open/.test(n1) &&
    !/leftover|Grandma's fridge/i.test(n1) &&
    Object.keys(qty(a1)).length === 0 &&
    a1.economyLedger.length === b1.economyLedger.length &&
    a1.credits === b1.credits,
  { notes: n1, fridge: qty(a1), ledger: a1.economyLedger.length - b1.economyLedger.length },
);

// ---------- 2. Level 3, empty fridge ----------
await boot(page, at(3, 5000));
await prepareToday();
const s2 = await sheet();
const pantry = await page.evaluate(() =>
  [...document.querySelectorAll("button")].some((b) => /Grandma's pantry/i.test(b.textContent)),
);
await shot(page, "grandmas-fridge-retired-l3");
check(
  "2 Level 3 with an empty fridge: the check lists the order's ingredients with a Market Restock, START waits; no Grandma's fridge card or pantry",
  !!s2 &&
    s2.rows.length > 0 &&
    s2.rows.every((r) => r.status === "missing" && r.restock) &&
    s2.startDisabled === true &&
    !s2.fridgeCard &&
    !pantry &&
    !/Grandma's (fridge|pantry)/i.test(s2.text),
  s2 && { rows: s2.rows, start: s2.startDisabled, fridgeCard: s2.fridgeCard, pantry },
);

// ---------- 3. Level 3, stocked: the order takes only its own ingredients ----------
await boot(page, at(3, 5000, stock({ tomato: 2, cucumber: 2, carrot: 2 })));
const b3 = await readSave(page);
await prepareToday();
await clickButton(
  page,
  /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/,
);
await sleep(600);
const started3 = await inHud();
const played3 = await playLevel();
const a3 = await readSave(page);
const before3 = qty(b3);
const after3 = qty(a3);
const used = Object.keys(before3).filter((id) => (after3[id] ?? 0) < before3[id]);
check(
  "3 Level 3 stocked: the order takes only tomato and cucumber (carrot untouched); wallet = ledger",
  started3 &&
    played3 &&
    used.sort().join() === "cucumber,tomato" &&
    after3.carrot === before3.carrot &&
    a3.credits - b3.credits === ledgerSum(a3, b3.economyLedger.length),
  { used, before3, after3 },
);

// ---------- 4. $0, empty fridge: supplier credit ----------
await boot(page, at(3, 0));
await prepareToday();
const poor = await sheet();
const b4 = await readSave(page);
for (let i = 0; i < 4; i++) {
  if (!(await clickButton(page, /Supplier credit/))) break;
  await sleep(600);
}
const a4 = await readSave(page);
const s4 = await sheet();
check(
  "4 Level 3 with $0: supplier credit brings the food (no money, no ledger entry, the price owed) and START opens; no pantry",
  !!poor &&
    /Supplier credit/.test(poor.text) &&
    !/Grandma's pantry/i.test(poor.text) &&
    a4.credits === b4.credits &&
    a4.economyLedger.length === b4.economyLedger.length &&
    (a4.business.supplierCredit?.owed ?? 0) > 0 &&
    Object.keys(qty(a4)).length > 0 &&
    s4?.startDisabled === false,
  { credit: a4.business.supplierCredit, fridge: qty(a4), start: s4?.startDisabled },
);

// ---------- 5. 320 px ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(page, at(3, 5000));
await prepareToday();
const fit = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="pre-service-check"]');
  const buttons = el ? [...el.querySelectorAll("[data-psc-ingredient] button")] : [];
  return {
    sheet: !!el,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: buttons
      .filter((b) => /Restock/.test(b.textContent) && b.getBoundingClientRect().height < 47.5)
      .map((b) => b.textContent.trim()),
  };
});
await shot(page, "grandmas-fridge-retired-320");
check(
  "5 at 320×568 the check fits, no sideways scroll, its Restock buttons ≥ 48 px",
  fit.sheet && fit.overflow <= 0 && fit.small.length === 0,
  fit,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("6 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `GRANDMA'S FRIDGE (RETIRED) E2E: ${failed.length} FAILURE(S)`
    : "GRANDMA'S FRIDGE (RETIRED) E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
