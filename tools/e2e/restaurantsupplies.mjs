// Unified Restaurant phase G — consumable supplies, in a real browser, on a RESTAURANT_MODE
// test build (VITE_RESTAURANT_MODE=1; a normal build never has it on).
//   1. Level 31 (dine-in starts), nothing bought: the Pre-Service Check lists Supplies — the
//      plate, fork and knife block (START disabled), napkins only warn, and the dish-soap and
//      cleaning-liquid bottles show "Empty".
//   2. Restock → opens the Market on that exact supply line; one pack each of plates, forks,
//      knives, napkins and dish soap (bought in the Market, ONE ledger entry each) and the
//      check turns ready; the soap bottle then shows a % and "~N services left".
//   3. Serving the order takes a place setting (→ washing) and a napkin automatically;
//      finishing the level runs the wash-up (dish soap used, nothing washing).
//   4. Inventory → Supplies shows the place settings and both bottles (read-only).
//   5. Level 32 (Dinner) ends the day: Closing Time shows the empty cleaning-liquid bottle
//      and still closes for the night.
//   6. Level 31 with $1: Grandma's spares lend exactly the missing settings (no money, no
//      ledger) and the service can start.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, clickButton, readSave, shot, text } from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const { browser, page, logs } = await launch();

const saveAt = (n, credits) =>
  seedSave({
    credits,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });

async function prepare(title) {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  await clickButton(page, /^See all orders/);
  await sleep(700);
  await page.evaluate((name) => {
    const h = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === name);
    let n = h;
    for (let i = 0; i < 8 && n; i++) {
      n = n.parentElement;
      const b =
        n &&
        [...n.querySelectorAll("button")].find((x) =>
          /^(Prepare|Replay)$/.test(x.textContent.trim()),
        );
      if (b) {
        b.click();
        return;
      }
    }
  }, title);
  await sleep(900);
}
const sheet = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="pre-service-check"]');
    if (!el) return null;
    const start = [...el.querySelectorAll("button")].find((b) =>
      /OPEN THE RESTAURANT|START SERVICE|Restock to start/.test(b.textContent),
    );
    return {
      supplies: [...el.querySelectorAll("[data-psc-supply]")].map((r) => ({
        id: r.getAttribute("data-psc-supply"),
        status: r.getAttribute("data-psc-status"),
      })),
      bottles: [...el.querySelectorAll("[data-bottle]")].map((r) => ({
        id: r.getAttribute("data-bottle"),
        status: r.getAttribute("data-bottle-status"),
        text: r.innerText.replace(/\s+/g, " "),
      })),
      startDisabled: start ? start.disabled : null,
      text: el.innerText.replace(/\s+/g, " "),
    };
  });

/** From the open check: Restock → Market on that line → Buy one pack → back to the check. */
async function buyFromCheck(selector, supplyId) {
  await page.evaluate((sel) => document.querySelector(`${sel} button`)?.click(), selector);
  await sleep(900);
  const focused = await page.evaluate(
    (id) => !!document.querySelector(`[data-supply="${id}"]`),
    supplyId,
  );
  await page.evaluate((id) => {
    const card = document.querySelector(`[data-supply="${id}"]`);
    [...(card?.querySelectorAll("button") ?? [])]
      .find((b) => /^Buy ·/.test(b.textContent.trim()))
      ?.click();
  }, supplyId);
  await sleep(500);
  await page.evaluate(() => document.querySelector('[data-testid="psc-back"]')?.click());
  await sleep(800);
  return focused;
}
/** Buys exactly what the check says the food is missing (as restaurantguests.mjs does). */
async function restockFood() {
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('[data-psc-ingredient][data-psc-status="missing"]')].map((r) =>
      r.getAttribute("data-psc-ingredient"),
    ),
  );
  for (const id of rows) {
    await page.evaluate(
      (x) => document.querySelector(`[data-psc-ingredient="${x}"] button`)?.click(),
      id,
    );
    await sleep(800);
    await page.evaluate((x) => {
      const card = document.querySelector(`[data-ingredient="${x}"]`);
      [...(card?.querySelectorAll("button") ?? [])]
        .find((b) => /^Buy /.test(b.textContent.trim()))
        ?.click();
    }, id);
    await sleep(400);
    await page.evaluate(() => document.querySelector('[data-testid="psc-back"]')?.click());
    await sleep(700);
  }
}

// ---------- 1. Level 31, nothing bought ----------
await boot(page, saveAt(31, 50_000)); // $50,000 (version-1 test saves are in dollars)
await prepare("Baguette Rounds");
const s1 = await sheet();
await shot(page, "restaurant-supplies-check");
const status = (id) => s1?.supplies.find((r) => r.id === id)?.status;
check(
  "1 L31 check: plate/fork/knife block, napkins warn, both bottles empty, START disabled",
  !!s1 &&
    status("dinner-plates") === "missing" &&
    status("dinner-forks") === "missing" &&
    status("dinner-knives") === "missing" &&
    status("paper-napkins") === "warning" &&
    s1.bottles.length === 2 &&
    s1.bottles.every((b) => b.status === "empty" && /Empty/.test(b.text)) &&
    s1.startDisabled === true,
  s1 && { supplies: s1.supplies, bottles: s1.bottles, startDisabled: s1.startDisabled },
);

// ---------- 2. Restock in the Market ----------
await restockFood();
const before = await readSave(page);
const focus = [];
for (const id of ["dinner-plates", "dinner-forks", "dinner-knives", "paper-napkins"])
  focus.push(await buyFromCheck(`[data-psc-supply="${id}"]`, id));
focus.push(await buyFromCheck('[data-bottle="dish-soap"]', "dish-soap"));
const bought = await readSave(page);
const s2 = await sheet();
const newEntries = bought.economyLedger.slice(before.economyLedger.length);
const soap = s2?.bottles.find((b) => b.id === "dish-soap");
check(
  "2 Restock opens the exact Market line; 5 purchases = 5 ledger entries; the check is ready; soap shows ~N services",
  focus.every(Boolean) &&
    newEntries.length === 5 &&
    newEntries.every((e) => /^supply-/.test(e.category)) &&
    s2?.supplies.every((r) => r.status === "ok") &&
    s2?.startDisabled === false &&
    soap?.status === "ok" &&
    /~\d+ services left/.test(soap.text),
  { focus, entries: newEntries.map((e) => e.category), s2: s2?.supplies, soap },
);

// ---------- 3. Serve: a setting and a napkin; finish: the wash-up ----------
await clickButton(page, /^(OPEN THE RESTAURANT|START SERVICE)$/);
await sleep(900);
await page.waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
  timeout: 30000,
});
const played = await playToReport(page, { maxMs: 150000 });
await clickButton(page, /^Continue$/);
await sleep(900);
await clickButton(page, /^Serve to /);
await sleep(1000);
const served = await readSave(page);
check(
  "3a serving takes a place setting (→ washing) and a napkin, automatically",
  played.ok &&
    served.business.restaurantSupplies?.washing === 1 &&
    served.business.supplies.stock["paper-napkins"]?.units ===
      bought.business.supplies.stock["paper-napkins"].units - 1 &&
    served.business.supplies.stock["dinner-plates"]?.units === 12,
  { washing: served.business.restaurantSupplies, played: played.ok },
);
await clickButton(page, /^Finish Level$/);
await sleep(1800);
const done = await readSave(page);
check(
  "3b finishing the service runs the wash-up: nothing washing, dish soap used (one bottle opened)",
  done.levelProgress.completedLevelIds.includes("level-31") &&
    done.business.restaurantSupplies?.washing === 0 &&
    done.business.restaurantSupplies?.soapPct === 95 &&
    done.business.supplies.stock["dish-soap"]?.units === 3 &&
    done.credits >= served.credits,
  { rs: done.business.restaurantSupplies, soap: done.business.supplies.stock["dish-soap"] },
);

// ---------- 4. Inventory → Supplies ----------
await page.evaluate(() =>
  [...document.querySelectorAll("nav button")]
    .find((x) => x.textContent.includes("Inventory"))
    ?.click(),
);
await sleep(700);
await clickButton(page, /Supplies/);
await sleep(700);
const inv = await page.evaluate(
  () =>
    document.querySelector('[data-testid="supplies-restaurant"]')?.innerText.replace(/\s+/g, " ") ??
    null,
);
await shot(page, "restaurant-supplies-inventory");
check(
  "4 Inventory → Supplies shows 12 clean place settings, the soap at 95% and the empty cleaning liquid",
  !!inv &&
    /Place settings: 12 clean/.test(inv) &&
    /Dish soap · 95%/.test(inv) &&
    /Cleaning liquid · 0%/.test(inv),
  inv,
);

// ---------- 5. Closing time ----------
// Level 31 was the day's first service (Lunch); Level 32 is Dinner, then it's closing time.
await prepare("French Onion Base");
if (await page.evaluate(() => !!document.querySelector('[data-testid="pre-service-check"]'))) {
  await restockFood();
  await clickButton(page, /^(OPEN THE RESTAURANT|START SERVICE)$/);
  await sleep(900);
}
await page.waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
  timeout: 30000,
});
await playToReport(page, { maxMs: 150000 });
await clickButton(page, /^Continue$/);
await sleep(900);
await clickButton(page, /^Serve to /);
await sleep(1000);
await clickButton(page, /^Finish Level$/);
await sleep(1800);
await page.evaluate(() =>
  [...document.querySelectorAll("nav button")]
    .find((x) => x.textContent.includes("Kitchen"))
    ?.click(),
);
await sleep(900);
const day = (await readSave(page)).business.restaurantDay;
const ct = await page.evaluate(
  () =>
    document.querySelector('[data-testid="closing-cleaner"]')?.innerText.replace(/\s+/g, " ") ??
    null,
);
await shot(page, "restaurant-supplies-closing");
await clickButton(page, /^Close for the night/);
await sleep(800);
const afterClose = await readSave(page);
check(
  "5 after Dinner (L32) closing shows the empty cleaning-liquid bottle and still closes for the night",
  day?.closingDue === true &&
    !!ct &&
    /Empty/.test(ct) &&
    afterClose.business.restaurantDay?.day === day.day + 1 &&
    afterClose.business.restaurantSupplies?.washing === 0,
  { ct, day, dayAfter: afterClose.business.restaurantDay },
);

// ---------- 6. Grandma's spares ----------
// Test saves are version 1, whose money is whole dollars (×100 on load): this is $1.
await boot(page, saveAt(31, 1));
await prepare("Baguette Rounds");
const poor = await sheet();
const pantryBtn = /Use Grandma's pantry/.test(poor?.text ?? "");
if (pantryBtn) {
  await clickButton(page, /Use Grandma's pantry/);
  await sleep(600);
}
const b0 = await readSave(page);
await clickButton(page, /Borrow Grandma's spares/);
await sleep(700);
const lent = await readSave(page);
const s6 = await sheet();
check(
  "6 with $1 Grandma lends exactly the missing settings (no money, no ledger) and START is enabled",
  !!poor &&
    /Not enough money/.test(poor.text) &&
    lent.credits === b0.credits &&
    lent.economyLedger.length === b0.economyLedger.length &&
    ["dinner-plates", "dinner-forks", "dinner-knives"].every(
      (id) =>
        lent.business.supplies.stock[id]?.units === 1 &&
        lent.business.supplies.stock[id]?.costBasis === 0,
    ) &&
    s6?.startDisabled === false,
  { stock: lent.business.supplies.stock, start: s6?.startDisabled },
);

const fit = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await sleep(500);
await shot(page, "restaurant-supplies-check-320");
const fit320 = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  sheet: !!document.querySelector('[data-testid="pre-service-check"]'),
}));
check(
  "7 the check fits at 430 and 320 px (no sideways scroll) and survives the resize",
  fit <= 0 && fit320.overflow <= 0 && fit320.sheet,
  { fit, fit320 },
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("8 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `RESTAURANT SUPPLIES E2E: ${failed.length} FAILURE(S)`
    : "RESTAURANT SUPPLIES E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
