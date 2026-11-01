// Phase 9 + 10 (developer 2026-11-01), restaurant build, in a real browser: the dining floor and the team.
//   D1 the dining floor has NO hire panel (the cleaners are on the map, the team in the first shop).
//   D2 the map's small 🧹 button opens a tray of three area cleaners; hiring one for the rest of today costs wage ×
//      hours left in ONE staff-purchase entry, the button says it is on shift, the wallet = opening cash + ledger.
//   D3 serving: a person (the waiter) carries the plate — there is a waiter on the floor, no flying plate.
//   D4 with a Cleaner on the dining room the table is cleared by them; without one the dirty table shows in the
//      room, a tap wipes it, and after every third table the napkins ask for a refill.
//   D5 a takeaway customer (seed 69 = the game's Level 67: its first order is takeaway) stands at the counter with the
//      Cashier next to them (no table).
//   D6 the table care works from the very first customer (Level 1), not only once dine-in opens.
//   D7 no console errors.
// (Seeds use the 150-level numbers, two more than the game's.)
import fs from "node:fs";
import {
  launch,
  boot,
  seedSave,
  MOVED_IN_BUSINESS,
  clickButton,
  sleep,
  readSave,
  text,
  shot,
  startFirstLevel,
  sweepCash,
  wipeServedTable,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const ledgerSum = (s) => s.economyLedger.reduce((t, e) => t + e.amount, 0);

const ingredientIds = [
  ...fs
    .readFileSync(new URL("../../src/game/definitions.ts", import.meta.url), "utf8")
    .matchAll(/^\s{2}"?([a-z][a-z-]*)"?: \{\s*$/gm),
].map((m) => m[1]);
const foodOf = (quantity) =>
  Object.fromEntries(
    ingredientIds.map((id) => [id, { ingredientId: id, quantity, unitCost: 0, purchaseDay: 1 }]),
  );
const SUPPLY_IDS = [
  ...fs
    .readFileSync(new URL("../../src/game/business/businessSupplies.ts", import.meta.url), "utf8")
    .split("export type SupplyId =")[1]
    .split(";")[0]
    .matchAll(/\|\s*"([a-z-]+)"/g),
].map((m) => m[1]);
const SUPPLIES = Object.fromEntries(SUPPLY_IDS.map((id) => [id, { units: 60, costBasis: 100 }]));
const CLEAN = {
  tasks: [],
  open: {},
  counters: { sink: 0, paper: 0 },
  cleanerAreas: ["kitchen", "dining", "restroom"],
  introSeen: true,
  cupboardAt: null,
  lastStart: null,
  cleaned: 0,
  byCleaner: 0,
  choreKeys: [],
  dayCleanerDay: null,
};
const saveAt = (seedLevel, { hired = ["prep-cook"], stock = 12, cleanliness } = {}) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: foodOf(stock),
      ...(stock < 12 ? { refrigerator: { refrigeratorId: "professional-refrigerator" } } : {}),
      supplies: { stock: SUPPLIES },
      restaurantStaff: {
        specialists: [
          "mexican-chef",
          "indian-chef",
          "mediterranean-chef",
          "asian-chef",
          "japanese-chef",
        ],
      },
      staff: { hiredRoles: hired },
      cleanliness: { ...CLEAN, ...(cleanliness ?? {}) },
    },
    credits: 50_000,
    levelProgress: {
      currentLevelId: `level-${seedLevel}`,
      highestUnlockedLevelId: `level-${seedLevel}`,
      completedLevelIds: Array.from({ length: seedLevel - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 4095, finaleSeen: false },
  });
async function prepare() {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  await clickButton(page, /^Open for service$/);
  await sleep(900);
  if (await page.evaluate(() => !!document.querySelector('[data-testid="pre-service-check"]'))) {
    await clickButton(
      page,
      /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/,
    );
    await sleep(800);
  }
}
const q = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const attr = (sel, a) =>
  page.evaluate((s, n) => document.querySelector(s)?.getAttribute(n) ?? null, sel, a);

try {
  // ---------- D1: no hire panel on the dining floor ----------
  await boot(page, saveAt(32));
  await prepare();
  await sleep(3500);
  await shot(page, "dining-1-floor");
  check(
    "D1 the dining floor has no hire panel",
    (await q('[data-testid="service-floor"]')) && !(await q('[data-testid="dining-hire"]')),
  );

  // ---------- D2: the map's cleaner button ----------
  await boot(page, saveAt(32));
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector(".map-hotspot-zone", { timeout: 15000 }).catch(() => null);
  await sleep(900);
  await page.evaluate(() => document.querySelector('[data-testid="map-cleaners-button"]')?.click());
  await sleep(400);
  const slots = await page.evaluate(() =>
    [...document.querySelectorAll("[data-cleaner]")].map((b) => b.getAttribute("data-cleaner")),
  );
  const before = await readSave(page);
  await shot(page, "dining-2-map");
  await page.evaluate(() => document.querySelector('[data-cleaner="dining"]')?.click());
  await sleep(900);
  const after = await readSave(page);
  const entry = after.economyLedger.slice(before.economyLedger.length);
  const onShift = await attr('[data-cleaner="dining"]', "data-on-shift");
  const day = after.business.restaurantDay?.day ?? 1;
  check(
    "D2 the map's 🧹 button offers the three area cleaners; hiring the Dining one is ONE staff-purchase entry (wage × hours left), it shows on shift, wallet = opening cash + ledger",
    slots.join() === "kitchen,dining,restroom" &&
      entry.length === 1 &&
      entry[0].category === "staff-purchase" &&
      entry[0].amount < 0 &&
      -entry[0].amount % 50 === 0 &&
      after.business.cleanliness?.hourly?.includes("dining") &&
      after.business.cleanliness?.hourlyDay === day &&
      onShift === "true" &&
      after.credits - before.credits === ledgerSum(after) - ledgerSum(before),
    { slots, entry: entry.map((e) => [e.category, e.amount]), onShift },
  );

  // ---------- D3, D4a: a person serves; the Dining cleaner clears the table ----------
  await prepare();
  await sleep(3500);
  await clickButton(page, /Prep Cook cuts it/);
  await sleep(3200);
  await clickButton(page, /^Serve to /);
  let sawWaiter = false;
  let wipe = null;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    if (await q('[data-testid="service-floor-waiter"]')) {
      if (!sawWaiter) await shot(page, "dining-3-waiter");
      sawWaiter = true;
    }
    wipe = await attr('[data-testid="table-wipe"]', "data-wipe");
    if (wipe) break;
  }
  check("D3 a waiter carries the plate to the table (no flying plate)", sawWaiter);
  const afterServe = await readSave(page);
  check(
    "D4a with a Cleaner on the dining room the table is cleared by them (counted as theirs)",
    wipe === "staff" && (afterServe.business.cleanliness?.wipes?.n ?? 0) >= 1,
    { wipe, wipes: afterServe.business.cleanliness?.wipes },
  );

  // ---------- D4b: no cleaner: the dirty table, the wipe, the napkins ----------
  await boot(page, saveAt(32, { cleanliness: { tissue: 2 } }));
  await prepare();
  await sleep(3500);
  let offer = null;
  for (let round = 0; round < 4 && offer !== "offer"; round++) {
    await clickButton(page, /Prep Cook cuts it/);
    await sleep(3200);
    await clickButton(page, /^Serve to /);
    for (let i = 0; i < 36; i++) {
      await sleep(250);
      offer = await attr('[data-testid="table-wipe"]', "data-wipe");
      if (offer) break;
    }
    if (offer !== "offer") {
      await sleep(1500);
      await clickButton(page, /^Next Customer$/);
      await sleep(2500);
    }
  }
  const dirtyShown = await q('[data-testid="dirty-table"]');
  await shot(page, "dining-4-dirty");
  const beforeWipe = await readSave(page);
  // The player scrubs the table in the cleaning game (developer 2026-11-01), then it is wiped for real.
  const scrubbed = dirtyShown ? await wipeServedTable(page) : 0;
  await sleep(700);
  const afterWipe = await readSave(page);
  const napkins = await q('[data-testid="napkin-refill"]');
  await shot(page, "dining-5-napkins");
  if (napkins) await clickButton(page, /Refill the napkins/);
  await sleep(600);
  const afterRefill = await readSave(page);
  check(
    "D4b without a cleaner the dirty table shows in the room, scrubbing it in the cleaning game wipes it (wallet untouched), the third table's napkins ask for a refill and one tap fills them",
    offer === "offer" &&
      dirtyShown &&
      scrubbed === 1 &&
      (afterWipe.business.cleanliness?.wipes?.n ?? 0) >= 1 &&
      afterWipe.credits === beforeWipe.credits &&
      napkins &&
      (afterRefill.business.cleanliness?.tissue ?? 0) === 0,
    {
      offer,
      dirtyShown,
      napkins,
      tissueBefore: beforeWipe.business.cleanliness?.tissue,
      tissueAfter: afterRefill.business.cleanliness?.tissue ?? 0,
      scrubbed,
      wipes: afterWipe.business.cleanliness?.wipes,
      creditsBefore: beforeWipe.credits,
      creditsAfter: afterWipe.credits,
    },
  );

  // ---------- D5: a takeaway customer beside the Cashier ----------
  await boot(
    page,
    saveAt(69, {
      hired: ["prep-cook", "line-cook", "server", "cashier", "cleaner", "head-chef"],
      stock: 3,
    }),
  );
  await prepare();
  await sleep(1500);
  const svc = await attr('[data-testid="service-floor"]', "data-service");
  const cashier = await q('[data-testid="floor-cashier"]');
  await shot(page, "dining-6-takeaway");
  const txt = await flat();
  check(
    "D5 the first customer of this service takes a parcel: no table, a 🥡 tag on the order, the Cashier at the counter beside them",
    svc === "takeaway" && cashier && /takeaway customer|to go/i.test(txt),
    { svc, cashier },
  );

  // ---------- D6: from the very first customer ----------
  await startFirstLevel(page);
  for (let step = 0; step < 4; step++) {
    await playToReport(page);
    await clickButton(page, /^Continue$/);
    await sleep(1200);
    if (/ORDER READY/i.test(await flat())) break;
  }
  await clickButton(page, /^Serve to /);
  let first = null;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    first = await attr('[data-testid="table-wipe"]', "data-wipe");
    if (first) break;
  }
  await shot(page, "dining-7-level1");
  const l1Dirty = await q('[data-testid="dirty-table"]');
  const l1Scrubbed = first === "offer" ? await wipeServedTable(page) : 0;
  await sleep(600);
  const l1 = await readSave(page);
  await sweepCash(page);
  check(
    "D6 at Level 1, the very first customer: the dirty table shows, scrubbing it in the cleaning game wipes it for free (no supplies exist yet)",
    first === "offer" &&
      l1Dirty &&
      l1Scrubbed === 1 &&
      (l1.business.cleanliness?.wipes?.n ?? 0) >= 1,
    { first, l1Dirty, wipes: l1.business.cleanliness?.wipes },
  );

  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("D7 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
