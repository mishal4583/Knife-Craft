// Market · Second Floor (developer 2026-10-16), restaurant build:
//   1. Level 40: the Market's Second Floor section lists the six machines locked (Level 60)
//      and the floor team ("Buy a machine first");
//   2. Level 60: Buy Coffee ($400) in the Market — one debit, one ledger entry, it shows Lv 1;
//   3. Hire a Floor Server ($400) in the Market — one ledger entry, the team shows 1 / 3;
//   4. Upgrade Coffee to Lv 2 ($600) in the Market — one ledger entry, it shows Lv 2;
//   5. the floor's Pickup Counter opens the Market on its Second Floor section;
//   6. fits at 320 / 390 (no sideways scroll), no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, readSave, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const atLevel = (n, credits = 1_000_000) =>
  seedSave({
    credits,
    business: { ...MOVED_IN_BUSINESS },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 2,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const openSection = async (page) => {
  await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
  await sleep(900);
  await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Shop categories"] button')]
      .find((b) => /Second Floor/.test(b.textContent ?? ""))
      ?.click(),
  );
  await page.waitForSelector('[data-testid="market-second-floor"]', { timeout: 15000 });
  await sleep(300);
};
const clickIn = (page, sel, re) =>
  page.evaluate(
    (s, src) => {
      const b = [...(document.querySelector(s)?.querySelectorAll("button") ?? [])].find((x) =>
        new RegExp(src).test(x.textContent ?? ""),
      );
      if (b && !b.disabled) b.click();
      return b ? !b.disabled : false;
    },
    sel,
    re.source,
  );
const textOf = (page, sel) =>
  page.evaluate((s) => document.querySelector(s)?.textContent ?? "", sel);
const floorEntries = (s) => s.economyLedger.filter((e) => e.category === "automation-purchase");

const { browser, page, logs } = await launch();

// 1. Level 40
await boot(page, atLevel(40));
await openSection(page);
const machines40 = await page.$$eval("[data-floor-machine]", (els) =>
  els.map((e) => (e.textContent ?? "").replace(/\s+/g, " ")),
);
const team40 = await textOf(page, '[data-floor-staff="server"]');
check(
  "1 Level 40: six machines listed, all locked until Level 60; the team waits for a machine",
  machines40.length === 6 &&
    machines40.every((t) => /🔒 Level 60/.test(t)) &&
    /Buy a machine first/.test(team40),
  { machines40: machines40.map((t) => t.slice(0, 60)), team40: team40.slice(0, 80) },
);

// 2. Level 60: buy Coffee
await boot(page, atLevel(60));
await openSection(page);
await shot(page, "market-second-floor-390");
const s0 = await readSave(page);
const bought = await clickIn(page, '[data-floor-machine="coffee"]', /^Buy \$400\.00$/);
await sleep(500);
const s1 = await readSave(page);
const coffee1 = await textOf(page, '[data-floor-machine="coffee"]');
check(
  "2 Level 60: Buy Coffee ($400) in the Market — one debit, one ledger entry, it shows Lv 1",
  bought &&
    s1.credits === s0.credits - 40000 &&
    floorEntries(s1).length === 1 &&
    /Lv 1/.test(coffee1),
  { bought, paid: s0.credits - s1.credits, entries: floorEntries(s1).length },
);

// 3. Hire a server
const hired = await clickIn(page, '[data-floor-staff="server"]', /^Hire \$400\.00$/);
await sleep(500);
const s2 = await readSave(page);
const team2 = await textOf(page, '[data-floor-staff="server"]');
check(
  "3 Hire a Floor Server ($400) in the Market — one ledger entry, the team shows 1 / 3",
  hired &&
    s2.credits === s1.credits - 40000 &&
    floorEntries(s2).length === 2 &&
    s2.business.secondFloor.servers === 1 &&
    /1 \/ 3/.test(team2),
  { hired, team2: team2.slice(0, 60) },
);

// 4. Upgrade Coffee
const upgraded = await clickIn(page, '[data-floor-machine="coffee"]', /^Upgrade \$600\.00$/);
await sleep(500);
const s3 = await readSave(page);
const coffee3 = await textOf(page, '[data-floor-machine="coffee"]');
check(
  "4 Upgrade Coffee to Lv 2 ($600) in the Market — one ledger entry, it shows Lv 2",
  upgraded &&
    s3.credits <= s2.credits - 60000 &&
    floorEntries(s3).length === 3 &&
    s3.business.secondFloor.stations.coffee.level === 2 &&
    /Lv 2/.test(coffee3),
  { upgraded, level: s3.business.secondFloor.stations.coffee?.level },
);

// 5. The floor's Pickup Counter opens the Market on its Second Floor section.
await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
await page.waitForSelector('[data-testid="upstairs"]', { timeout: 15000 });
await page.evaluate(() => document.querySelector('[data-testid="upstairs"]').click());
await page.waitForSelector('[data-testid="second-floor"]', { timeout: 15000 });
await sleep(500);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="second-floor"] .map-hotspot-zone')]
    .find((e) => /^Pickup Counter/.test(e.getAttribute("aria-label") ?? ""))
    ?.click(),
);
await sleep(400);
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find((b) => /in the Market/.test(b.textContent ?? ""))
    ?.click(),
);
const linked = await page
  .waitForSelector('[data-testid="market-second-floor"]', { timeout: 15000 })
  .then(() => true)
  .catch(() => false);
check("5 the floor's Pickup Counter opens the Market on its Second Floor section", linked);

// 6. Widths
const fits = {};
for (const [w, h] of [
  [320, 568],
  [390, 844],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await sleep(500);
  await shot(page, `market-second-floor-${w}`);
  fits[w] = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check(
  "6 fits at 320 / 390; no page errors",
  Object.values(fits).every((o) => o <= 0) && errors.length === 0,
  { fits, errors: errors.slice(0, 3) },
);
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `MARKET SECOND FLOOR E2E: ${failed.length} FAILURE(S)`
    : "MARKET SECOND FLOOR E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
