// Prep Cook at the board (developer 2026-10-30), restaurant build, in a real browser:
// (The Prep Cook opens at level 30 of the game's own numbering, developer 2026-10-31; seed 32 is a first play
// of a level past it. Level 21, below it, teaches rock-mincing. No level past 22 teaches a technique, so the
// "teaching first play is by hand" rule is covered by prep-cook-auto-qa.)
//   P0 before the Prep Cook's level (seed 23), a hired Prep Cook does not cut: no button.
//   P1 without a hired Prep Cook there is no "Prep Cook cuts it" button on the board.
//   P2 with one hired, the button shows once the customer has sat; it cuts the whole order (no knife
//      work) and the Serve card opens with the plain Honest plate saved as the recipe's score.
//   P3 Serve pays once and the wallet still equals the opening cash plus the signed ledger.
//   P4 Auto on: the next order is cut and served with no tap and its cash is LEFT on the tables (piles up);
//   P4b one tap on the Kitchen's Collect takes it in (wallet = cash + ledger).
//   P5 "Stop Auto" on the card turns it off for good (saved setting).
//   P5b before level 30 the Staff screen shows the Prep Cook locked: no Hire button, and from level 30 it has one.
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
  openShortcut,
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
  "butter",
  "celery",
  "apple",
  "lemon",
  "parsley",
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
      // Seeds use the 150-level numbers (two more than the game's): seed 32 is Level 30, a first play (it pays).
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
const has = async (re) => re.test(await flat());
try {
  // ---------- P0 teaching level ----------
  await boot(page, saveAt(23, ["prep-cook"], false));
  await prepare();
  await sleep(3500);
  check(
    "P0 below the Prep Cook's level (30) a hired Prep Cook does not cut: by hand only",
    (await has(/Start cooking/)) && !(await has(/Prep Cook cuts it/)),
  );

  // ---------- P1 not hired ----------
  await boot(page, saveAt(32, [], false));
  await prepare();
  await sleep(3500);
  check("P1 no Prep Cook hired: no Prep Cook button", !(await has(/Prep Cook cuts it/)));

  // ---------- P2 / P3 hired, by hand ----------
  await boot(page, saveAt(32, ["prep-cook"], false));
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
  const byCook = await page.evaluate(() => !!document.querySelector('[data-testid="prepared-by"]'));
  check("P2c the served card says the Prep Cook cut it", byCook);
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
  // Rule changed (developer 2026-10-31): Auto never collects the table cash; it piles up for the player.
  await boot(page, saveAt(32, ["prep-cook"], true));
  await prepare();
  const start = await readSave(page);
  const owedOf = (s) =>
    s.business.pendingCash ? s.business.pendingCash.payCents + s.business.pendingCash.tipCents : 0;
  let autoRan = false;
  let seen = "";
  for (let i = 0; i < 40; i++) {
    await sleep(1500);
    const cur = await readSave(page);
    seen = (await flat()).slice(0, 120);
    if (
      owedOf(cur) > 0 &&
      (cur.levelProgress.completedLevelIds.length > start.levelProgress.completedLevelIds.length ||
        cur.business.guestsServed > 0)
    ) {
      autoRan = true;
      break;
    }
  }
  const after = await readSave(page);
  check(
    "P4 Auto cuts and serves without a tap and leaves the cash on the tables (no order pay in the ledger yet; wallet = ledger)",
    autoRan &&
      owedOf(after) > 0 &&
      !after.economyLedger
        .slice(start.economyLedger.length)
        .some((e) => e.category === "campaign-settlement" || e.category === "customer-tip") &&
      after.credits - start.credits === ledgerSum(after) - ledgerSum(start),
    { seen, owed: owedOf(after), credits: after.credits, start: start.credits },
  );
  // The player collects it when they like: from the Kitchen, in one tap; the wallet equals cash + ledger.
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(700);
  await clickButton(page, /on the table · Collect/);
  await sleep(800);
  const collected = await readSave(page);
  check(
    "P4b one tap on Collect takes it all in: wallet = opening cash + signed ledger, the table is empty",
    owedOf(collected) === 0 &&
      collected.credits - start.credits === ledgerSum(collected) - ledgerSum(start) &&
      collected.credits > start.credits,
    { credits: collected.credits, owed: owedOf(collected) },
  );

  // ---------- P5 stop ----------
  await boot(page, saveAt(32, ["prep-cook"], true));
  await prepare();
  for (let i = 0; i < 20 && !(await has(/Stop Auto|ORDER READY|SERVED/i)); i++) await sleep(700);
  if (await has(/Stop Auto/)) await clickButton(page, /Stop Auto/);
  await sleep(600);
  const stopped = await readSave(page);
  check("P5 Stop Auto saves the setting off", stopped.settings.autoService === false, {
    autoService: stopped.settings.autoService,
  });

  // ---------- P5b hiring waits for level 30 ----------
  const staffCard = async (seedLevel) => {
    await boot(page, saveAt(seedLevel, [], false));
    await openShortcut(page, "business");
    await sleep(600);
    await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) => /Staff$/.test(b.textContent.trim()))
        ?.click(),
    );
    await sleep(800);
    return page.evaluate(() => {
      const c = document.querySelector('[data-staff-role="prep-cook"]');
      return c
        ? {
            found: true,
            hire: [...c.querySelectorAll("button")].some((b) => /Hire/.test(b.textContent)),
          }
        : { found: false, hire: false };
    });
  };
  const early = await staffCard(23);
  const open = await staffCard(32);
  check(
    "P5b before level 30 the Prep Cook card has no Hire button; at level 30 it does",
    early.found && !early.hire && open.found && open.hire,
    { early, open },
  );

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
