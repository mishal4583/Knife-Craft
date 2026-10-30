// Prep Cook at the board (developer 2026-10-30), restaurant build, in a real browser:
// (Level 23 is a first play that teaches no technique; Level 21 teaches rock-mincing.)
//   P0 the first play of a level that teaches a technique (Level 21, hired Prep Cook) is the player's: no button.
//   P1 without a hired Prep Cook there is no "Prep Cook cuts it" button on the board.
//   P2 with one hired, the button shows once the customer has sat; it cuts the whole order (no knife
//      work) and the Serve card opens with the plain Honest plate saved as the recipe's score.
//   P3 Serve pays once and the wallet still equals the opening cash plus the signed ledger.
//   P4 Auto on: the next order is cut, served, its cash collected and the queue moved on with no tap.
//   P5 "Stop Auto" on the card turns it off for good (saved setting).
//   P6 no console errors.
import fs from "node:fs";
import {
  launch,
  boot,
  seedSave,
  MOVED_IN_BUSINESS,
  clickButton,
  sleep,
  readSave,
  sweepCash,
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

const stocked = (ids) =>
  Object.fromEntries(
    ids.map((id) => [id, { ingredientId: id, quantity: 6, unitCost: 0, purchaseDay: 1 }]),
  );
const FOOD = stocked([
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
]);
// A bigger restaurant's service needs tableware, napkins and soap: every supply is stocked (read from the type).
const SUPPLY_IDS = [
  ...fs
    .readFileSync(new URL("../../src/game/business/businessSupplies.ts", import.meta.url), "utf8")
    .split("export type SupplyId =")[1]
    .split(";")[0]
    .matchAll(/\|\s*"([a-z-]+)"/g),
].map((m) => m[1]);
const SUPPLIES = Object.fromEntries(SUPPLY_IDS.map((id) => [id, { units: 60, costBasis: 100 }]));
const saveAt = (seedLevel, hired, autoService) => {
  const s = seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: FOOD,
      supplies: { stock: SUPPLIES },
      restaurantStaff: { specialists: ["mexican-chef"] },
      staff: { hiredRoles: hired },
    },
    credits: 5000,
    levelProgress: {
      currentLevelId: `level-${seedLevel}`,
      highestUnlockedLevelId: `level-${seedLevel}`,
      // Seeds use the 150-level numbers (two more than the game's): seed 25 is Level 23, a first play (it pays).
      completedLevelIds: Array.from({ length: seedLevel - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });
  s.settings = { ...s.settings, ...(autoService ? { autoService: true } : {}) };
  return s;
};
async function prepare() {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  await clickButton(page, /^Prepare$/);
  await sleep(900);
  if (await page.evaluate(() => !!document.querySelector('[data-testid="pre-service-check"]'))) {
    await clickButton(
      page,
      /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/,
    );
    await sleep(800);
  }
}
const has = async (re) => re.test(await flat());
try {
  // ---------- P0 teaching level ----------
  await boot(page, saveAt(23, ["prep-cook"], false));
  await prepare();
  await sleep(3500);
  check(
    "P0 a level that teaches a technique (21) is always cut by hand",
    (await has(/Start cooking/)) && !(await has(/Prep Cook cuts it/)),
  );

  // ---------- P1 not hired ----------
  await boot(page, saveAt(25, [], false));
  await prepare();
  await sleep(3500);
  check("P1 no Prep Cook hired: no Prep Cook button", !(await has(/Prep Cook cuts it/)));

  // ---------- P2 / P3 hired, by hand ----------
  await boot(page, saveAt(25, ["prep-cook"], false));
  await prepare();
  await sleep(3500);
  const offered = await has(/Prep Cook cuts it/);
  const before = await readSave(page);
  await clickButton(page, /Prep Cook cuts it/);
  await sleep(500);
  const busy = await page.evaluate(
    () => !!document.querySelector('[data-testid="prep-cook-busy"]'),
  );
  await sleep(2600);
  const ready = await has(/ORDER READY/i);
  const mid = await readSave(page);
  const recipeScores = Object.values(mid.recipeProgress ?? {}).map((r) => r.best);
  check("P2 the button shows, the Prep Cook cuts, the Serve card opens", offered && busy && ready, {
    offered,
    busy,
    ready,
  });
  check(
    "P2b the plate is a plain Honest 75 (saved as the recipe's score), money untouched until Serve",
    recipeScores.includes(75) && mid.credits === before.credits,
    { recipeScores, credits: mid.credits, before: before.credits },
  );
  await clickButton(page, /^Serve to /);
  await sleep(3500);
  await sweepCash(page);
  await sleep(800);
  const served = await readSave(page);
  const paid = served.economyLedger.filter(
    (e) => e.category === "completion-reward" || /order|settle/i.test(e.category),
  ).length;
  check(
    "P3 Serve pays and the wallet equals the opening cash plus the signed ledger",
    served.economyLedger.length > mid.economyLedger.length &&
      served.credits - before.credits === ledgerSum(served) - ledgerSum(before),
    { ledger: served.economyLedger.length - mid.economyLedger.length, paid },
  );

  // ---------- P4 Auto ----------
  await boot(page, saveAt(25, ["prep-cook"], true));
  await prepare();
  const start = await readSave(page);
  let autoRan = false;
  let seen = "";
  for (let i = 0; i < 40; i++) {
    await sleep(1500);
    const cur = await readSave(page);
    seen = (await flat()).slice(0, 120);
    if (cur.economyLedger.length > start.economyLedger.length + 1) {
      autoRan = true;
      break;
    }
  }
  const after = await readSave(page);
  check(
    "P4 Auto cuts, serves and collects without a tap (ledger grew, wallet = cash + ledger)",
    autoRan && after.credits - start.credits === ledgerSum(after) - ledgerSum(start),
    {
      seen,
      entries: after.economyLedger.length - start.economyLedger.length,
      credits: after.credits,
    },
  );

  // ---------- P5 stop ----------
  await boot(page, saveAt(25, ["prep-cook"], true));
  await prepare();
  for (let i = 0; i < 20 && !(await has(/Stop Auto|ORDER READY|SERVED/i)); i++) await sleep(700);
  if (await has(/Stop Auto/)) await clickButton(page, /Stop Auto/);
  await sleep(600);
  const stopped = await readSave(page);
  check("P5 Stop Auto saves the setting off", stopped.settings.autoService === false, {
    autoService: stopped.settings.autoService,
  });

  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("P6 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
