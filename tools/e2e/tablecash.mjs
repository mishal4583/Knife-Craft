// The cash lying on the tables (developer 2026-10-31: "let the cash lay there and players collect it
// whenever they like or let it pile up ... if it is not collected let it show on the main restaurant
// map near the tables"), restaurant build, in a real browser:
//   T1 cash owed shows as piles on the restaurant map with its amount; one tap on a pile collects it all
//      (wallet = ledger, the table empty, the piles gone) and does not open a room behind it.
//   T2 in the dining room (the arrival card) the piles show too; tapping them collects and does NOT
//      start the cooking.
//   T3 it PILES UP: serving the next order leaves the old cash where it is and adds the new pay
//      (no order pay or tip enters the ledger until the player collects).
//   T4 the Kitchen still offers "on the table · Collect", and nothing is owed afterwards.
//   T5 no console errors.
import fs from "node:fs";
import {
  launch,
  boot,
  seedSave,
  MOVED_IN_BUSINESS,
  clickButton,
  sleep,
  readSave,
  shot,
  text,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const ledgerSum = (s) => s.economyLedger.reduce((t, e) => t + e.amount, 0);
const owedOf = (s) =>
  s.business.pendingCash ? s.business.pendingCash.payCents + s.business.pendingCash.tipCents : 0;

const FOOD = Object.fromEntries(
  [
    "bread",
    "tomato",
    "garlic",
    "basil",
    "mozzarella",
    "mushroom",
    "cucumber",
    "carrot",
    "potato",
    "onion",
    "spinach",
    "fennel",
    "lettuce",
    "pepper",
    "butter",
    "celery",
    "apple",
    "lemon",
    "parsley",
  ].map((id) => [id, { ingredientId: id, quantity: 6, unitCost: 0, purchaseDay: 1 }]),
);
const SUPPLY_IDS = [
  ...fs
    .readFileSync(new URL("../../src/game/business/businessSupplies.ts", import.meta.url), "utf8")
    .split("export type SupplyId =")[1]
    .split(";")[0]
    .matchAll(/\|\s*"([a-z-]+)"/g),
].map((m) => m[1]);
const SUPPLIES = Object.fromEntries(SUPPLY_IDS.map((id) => [id, { units: 60, costBasis: 100 }]));
// Seed 32 = Level 30: the first level a hired Prep Cook cuts (developer 2026-10-31), so Auto can cut it fast.
const OWED = { payCents: 6000, tipCents: 400 };
const saveOwing = () =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: FOOD,
      supplies: { stock: SUPPLIES },
      restaurantStaff: { specialists: ["mexican-chef"] },
      staff: { hiredRoles: ["prep-cook"] },
      pendingCash: {
        batch: "cash-1",
        category: "campaign-settlement",
        description: "camp-garden-tomato-cucumber",
        tipDescription: "level-9:camp-garden-tomato-cucumber",
        ...OWED,
      },
    },
    credits: 5000,
    levelProgress: {
      currentLevelId: "level-32",
      highestUnlockedLevelId: "level-32",
      completedLevelIds: Array.from({ length: 31 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });
const goKitchen = async () => {
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(700);
};
async function prepare() {
  await goKitchen();
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
const piles = () =>
  page.evaluate(() => ({
    count: document.querySelectorAll('[data-testid="table-cash-pile"]').length,
    amount: document.querySelector('[data-testid="table-cash-amount"]')?.textContent ?? null,
    inFloor: !!document.querySelector('[data-testid="service-floor"] [data-testid="table-cash"]'),
  }));
const floorMode = () =>
  page.evaluate(
    () =>
      document.querySelector('[data-testid="service-floor"]')?.getAttribute("data-mode") ?? null,
  );
try {
  // ---------- T1 the map ----------
  await boot(page, saveOwing());
  const t1 = await readSave(page);
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector(".map-hotspot-zone", { timeout: 15000 }).catch(() => null);
  await sleep(700);
  const onMap = await piles();
  await shot(page, "tablecash-map");
  check(
    "T1a the cash owed shows as piles on the restaurant map with its amount",
    onMap.count >= 1 && /\$64\.00/.test(onMap.amount ?? ""),
    onMap,
  );
  await page.evaluate(() => document.querySelector('[data-testid="table-cash-pile"]')?.click());
  await sleep(800);
  const t1b = await readSave(page);
  const after = await piles();
  const stillMap = await page.evaluate(() => !!document.querySelector(".restaurant-map-stage"));
  check(
    "T1b one tap collects it all: wallet = ledger, the table is empty, the piles are gone, still on the map",
    owedOf(t1b) === 0 &&
      t1b.credits - t1.credits === OWED.payCents + OWED.tipCents &&
      t1b.credits - t1.credits === ledgerSum(t1b) - ledgerSum(t1) &&
      after.count === 0 &&
      stillMap,
    { credits: t1b.credits, before: t1.credits, after },
  );

  // ---------- T2 the dining room ----------
  await boot(page, saveOwing());
  await prepare();
  await sleep(3500);
  const onFloor = await piles();
  await shot(page, "tablecash-floor");
  const arrive = await floorMode();
  check(
    "T2a the dining room (arrival card) shows the cash piles too",
    onFloor.inFloor && onFloor.count >= 1 && arrive === "arrive",
    { ...onFloor, arrive },
  );
  const t2 = await readSave(page);
  await page.evaluate(() => document.querySelector('[data-testid="table-cash-pile"]')?.click());
  await sleep(800);
  const t2b = await readSave(page);
  const stillArrive = await floorMode();
  check(
    "T2b tapping the pile collects it and does not start the cooking",
    owedOf(t2b) === 0 &&
      t2b.credits - t2.credits === OWED.payCents + OWED.tipCents &&
      stillArrive === "arrive",
    { credits: t2b.credits, before: t2.credits, stillArrive },
  );

  // ---------- T3 it piles up ----------
  await boot(page, saveOwing());
  await prepare();
  await sleep(3500);
  const before = await readSave(page);
  await clickButton(page, /Prep Cook cuts it/);
  await sleep(3200);
  await clickButton(page, /^Serve to /);
  await sleep(3500);
  const served = await readSave(page);
  const orderPay = served.economyLedger
    .slice(before.economyLedger.length)
    .filter((e) => e.category === "campaign-settlement" || e.category === "customer-tip");
  check(
    "T3 serving the next order leaves the old cash on the table and adds the new pay: nothing collected, no order pay in the ledger",
    owedOf(served) > owedOf(before) &&
      served.business.pendingCash.payCents > OWED.payCents &&
      orderPay.length === 0 &&
      served.credits - before.credits === ledgerSum(served) - ledgerSum(before),
    { owed: owedOf(served), was: owedOf(before), orderPay: orderPay.length },
  );

  // ---------- T4 the Kitchen ----------
  await clickButton(page, /Back to Kitchen/).catch(() => null);
  await sleep(500);
  await goKitchen();
  await sleep(500);
  const chip = /on the table · Collect/.test(await flat());
  await clickButton(page, /on the table · Collect/);
  await sleep(800);
  const t4 = await readSave(page);
  check(
    "T4 the Kitchen's Collect still takes it all in: the table is empty, wallet = ledger",
    chip && owedOf(t4) === 0 && t4.credits - before.credits === ledgerSum(t4) - ledgerSum(before),
    { chip, credits: t4.credits },
  );

  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("T5 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
