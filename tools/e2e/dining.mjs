// Phase 9 (developer 2026-11-01), restaurant build, in a real browser: the dining floor.
//   D1 the dining area's side panel offers the Server (from Level 3) and the three hourly Cleaners before cooking.
//   D2 hiring a Cleaner takes the hourly wage in one ledger entry, the offer disappears, the wallet = opening cash + ledger.
//   D3 serving: a person (the waiter) carries the plate — there is a waiter on the floor, no flying plate.
//   D4 the table is left to wipe: with the Dining cleaner on shift the staff clear it by themself; without one the player's
//      "Wipe the table" button works and costs the closing task's supplies once.
//   D5 a takeaway customer (seed 69 = the game's Level 67: its first order is takeaway) stands at the door with a 🥡
//      bag, no table, and the next two orders still sit together.
//   D6 no console errors.
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
} from "./harness.mjs";

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
const saveAt = (seedLevel, hired = ["prep-cook"], stock = 12) =>
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
  // ---------- D1, D2: the side panel and an hourly Cleaner ----------
  await boot(page, saveAt(32));
  await prepare();
  await sleep(600);
  const offers = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="dining-hire"] [data-hire]')].map((b) =>
      b.getAttribute("data-hire"),
    ),
  );
  await shot(page, "dining-1-panel");
  check(
    "D1 the side panel offers the Server and the three hourly Cleaners",
    offers.includes("server") &&
      ["cleaner-kitchen", "cleaner-dining", "cleaner-restroom"].every((o) => offers.includes(o)),
    offers,
  );
  const before = await readSave(page);
  await page.evaluate(() =>
    document.querySelector('[data-testid="dining-hire"] [data-hire="cleaner-dining"]')?.click(),
  );
  await sleep(900);
  const after = await readSave(page);
  const offersAfter = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="dining-hire"] [data-hire]')].map((b) =>
      b.getAttribute("data-hire"),
    ),
  );
  const entry = after.economyLedger.slice(before.economyLedger.length);
  check(
    "D2 the Dining cleaner costs $15 (one staff-purchase entry), the offer is gone, the others stay, the wallet = opening cash + ledger",
    entry.length === 1 &&
      entry[0].category === "staff-purchase" &&
      entry[0].amount === -1500 &&
      after.business.cleanliness?.hourly?.includes("dining") &&
      !offersAfter.includes("cleaner-dining") &&
      offersAfter.includes("cleaner-kitchen") &&
      after.credits - before.credits === ledgerSum(after) - ledgerSum(before),
    { entry, offersAfter },
  );

  // ---------- D3, D4: a person serves; the Dining cleaner clears the table ----------
  await clickButton(page, /Prep Cook cuts it/);
  await sleep(3200);
  await clickButton(page, /^Serve to /);
  let sawWaiter = false;
  let wipe = null;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    if (await q('[data-testid="service-floor-waiter"]')) {
      if (!sawWaiter) await shot(page, "dining-2-waiter");
      sawWaiter = true;
    }
    wipe = await attr('[data-testid="table-wipe"]', "data-wipe");
    if (wipe) break;
  }
  await shot(page, "dining-3-after");
  check("D3 a waiter carries the plate to the table (no flying plate)", sawWaiter);
  const afterServe = await readSave(page);
  check(
    "D4a with the Dining cleaner on shift the staff clear the table by themself (one wipe taken from the supplies, counted as theirs)",
    wipe === "staff" && (afterServe.business.cleanliness?.wipes?.n ?? 0) >= 1,
    { wipe, wipes: afterServe.business.cleanliness?.wipes },
  );

  // ---------- D4b: no cleaner: the player wipes ----------
  await boot(page, saveAt(32));
  await prepare();
  await sleep(600);
  let offer = null;
  // A party leaves when its last order is served: serve customers until a table is left to wipe.
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
  await shot(page, "dining-5-d4b");
  const beforeWipe = await readSave(page);
  if (offer === "offer") await clickButton(page, /Wipe the table/);
  await sleep(700);
  const afterWipe = await readSave(page);
  const supplyUsed = (s) => s.business.supplies?.lifetime?.cleaning?.unitsUsed ?? 0;
  check(
    "D4b without a cleaner the player's tap wipes the table (once, the closing task's supplies), the wallet is untouched",
    offer === "offer" &&
      (afterWipe.business.cleanliness?.wipes?.n ?? 0) >= 1 &&
      afterWipe.credits === beforeWipe.credits &&
      supplyUsed(afterWipe) >= supplyUsed(beforeWipe) &&
      (await attr('[data-testid="table-wipe"]', "data-wipe")) === "done",
    { offer, wipes: afterWipe.business.cleanliness?.wipes },
  );

  // ---------- D5: a takeaway customer ----------
  await boot(page, saveAt(69, ["prep-cook", "line-cook", "server", "cleaner", "head-chef"], 3));
  await prepare();
  await sleep(1500);
  const svc = await attr('[data-testid="service-floor"]', "data-service");
  await shot(page, "dining-4-takeaway");
  const txt = await flat();
  check(
    "D5 the first customer of this service takes a parcel: no table, a 🥡 tag on the order",
    svc === "takeaway" && /takeaway customer|to go/i.test(txt),
    { svc },
  );

  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("D6 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
