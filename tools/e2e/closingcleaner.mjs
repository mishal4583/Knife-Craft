// Closing Time: "Hire a Cleaner" for the dishes (developer 2026-11-21: "while closing why can't I hire a cleaner for washing dishes? Add a hire cleaner option to wash dishes"):
//   1. with dishes in the sink and no Cleaner, Closing Time offers "Hire a Cleaner" (tonight's wage, and an ad button when ads exist); the Wash row is the player's;
//   2. "Tonight · $x" pays once (one Staff Hire ledger entry), the offer turns into "A Cleaner is on duty" and the row reads "The Cleaner washes the dishes" ✓;
//   3. closing the night with them leaves the sink empty and the dishes washed by hand (nothing in the sink next morning);
//   4. no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot, readSave } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const N = 40;
const mk = () =>
  seedSave({
    credits: 500_000,
    business: {
      ...MOVED_IN_BUSINESS,
      supplies: {
        ...MOVED_IN_BUSINESS.supplies,
        stock: {
          ...MOVED_IN_BUSINESS.supplies.stock,
          "dish-soap": { units: 2, costBasis: 3000 },
          "dinner-plates": { units: 12, costBasis: 6000 },
        },
      },
      restaurantSupplies: { soapPct: 100, dirty: { "dinner-plates": 4 } },
      restaurantDay: {
        day: 4,
        opened: true,
        servicesDone: 3,
        servicesPlanned: 3,
        closingDue: true,
        openingCredits: 400_000,
        openingLevel: N - 2,
      },
    },
    levelProgress: {
      currentLevelId: `level-${N}`,
      highestUnlockedLevelId: `level-${N}`,
      completedLevelIds: Array.from({ length: N - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 2,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });

const { browser, page, logs } = await launch();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await boot(page, mk());
await sleep(2500);
const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const rowText = () =>
  page.evaluate(
    () =>
      document.querySelector('[data-chore="wash-up"]')?.innerText.replace(/\s+/g, " ").trim() ?? "",
  );

check("1a Closing Time shows", await has('[data-testid="closing-time"]'));
check("1b it offers Hire a Cleaner", await has('[data-testid="closing-hire-cleaner"]'));
const before = await rowText();
check(
  "1c the Wash row is still the player's",
  /Wash the dishes/.test(before) && /Wash/.test(before),
  before,
);
await shot(page, "closingcleaner-offer");

const credits0 = (await readSave(page)).credits;
const entries0 = (await readSave(page)).economyLedger.length;
await page.evaluate(() => {
  const card = document.querySelector('[data-testid="closing-hire-cleaner"]');
  [...card.querySelectorAll("button")].find((b) => /Tonight/.test(b.innerText))?.click();
});
await sleep(900);
const after = await readSave(page);
check(
  "2a hiring pays once with one ledger entry",
  after.credits < credits0 && after.economyLedger.length === entries0 + 1,
  { paid: credits0 - after.credits, entries: after.economyLedger.length - entries0 },
);
check(
  "2b the offer is replaced by 'A Cleaner is on duty'",
  !(await has('[data-testid="closing-hire-cleaner"]')) &&
    (await has('[data-testid="closing-cleaner-on"]')),
);
const row = await rowText();
check(
  "2c the Wash row reads 'The Cleaner washes the dishes' and is done",
  /The Cleaner washes the dishes/.test(row) && /✓/.test(row),
  row,
);
await shot(page, "closingcleaner-hired");

// 3. close the night: the sink is washed by hand
await page.evaluate(() => document.querySelector('[data-chore="count"] button')?.click());
await sleep(700);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('[data-testid="closing-time"] button')].find((x) =>
    /Close for the night|Close up|Good night/i.test(x.innerText),
  );
  b?.click();
});
await sleep(1500);
const closed = await readSave(page);
const dirty = Object.values(closed.business.restaurantSupplies?.dirty ?? {}).reduce(
  (a, b) => a + (b || 0),
  0,
);
check("3 closing the night leaves no dirty dishes in the sink", dirty === 0, {
  dirty,
  day: closed.business.restaurantDay?.day,
});

const errors = logs.filter(
  (l) => /error/i.test(String(l)) && !/favicon|Failed to load resource/.test(String(l)),
);
check("4 no console errors", errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nCLOSINGCLEANER: ALL PASS");
process.exit(failed.length ? 1 : 0);
