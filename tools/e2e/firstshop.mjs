// The first run (developer 2026-10-30), restaurant build:
//   S1 a new game starts with $10.00 and lands on the Kitchen after the intro (not in the cutting).
//   S2 a hand points at the Market (Grandma's section pointer), and "Show me" opens the ingredients.
//   S3 the Market shows the first-shopping hint and the hand on a needed item's Buy button.
//   S4 buying spends the player's own money: one inventory-purchase entry, wallet = opening + ledger.
//   S5 nothing is given for free: no Grandma tools, cupboard or leftovers in the save.
//   S6 with the food bought, Prepare opens the cutting; serve, sweep and Next Customer (last order) complete level-1.
//   S7 no console errors.
import { launch, freshPlayer, sleep, clickButton, readSave, text, sweepCash } from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async (page) => (await text(page)).replace(/\s+/g, " ");
const { browser, page, logs } = await launch();
const ledgerSum = (s) => s.economyLedger.reduce((t, e) => t + e.amount, 0);

try {
  await freshPlayer(page);
  await page.waitForFunction(() => !!document.querySelector('[aria-label="Skip intro"]'), {
    timeout: 30000,
  });
  await page.evaluate(() => document.querySelector('[aria-label="Skip intro"]').click());
  await page.waitForFunction(() => !document.querySelector("[data-intro-scene]"), {
    timeout: 10000,
  });
  await sleep(2500);

  const start = await readSave(page);
  const onBoard = await page.evaluate(() =>
    /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
  );
  const pointer = await page.evaluate(
    () =>
      document.querySelector('[data-testid="section-pointer"]')?.getAttribute("data-pointer-tab") ??
      null,
  );
  check(
    "S1 starts with $10.00 on the Kitchen (not in the cutting)",
    start.credits === 1000 && !onBoard,
    { credits: start.credits, onBoard },
  );
  check("S2 a hand points at the Market first", pointer === "shop", { pointer });
  await page.screenshot({ path: "tools/e2e/firstshop-1-kitchen.png" });

  await clickButton(page, /^Show me/);
  await sleep(1500);
  const hint = await page.evaluate(
    () => !!document.querySelector('[data-testid="first-shopping-hint"]'),
  );
  const hand = await page.evaluate(
    () => !!document.querySelector('[data-testid="first-shopping-hand"]'),
  );
  check("S3 the Market shows the first-shopping hint and the hand on Buy", hint && hand, {
    hint,
    hand,
  });
  await page.screenshot({ path: "tools/e2e/firstshop-2-market.png" });

  // Buy every ingredient in the plan, one tap each (the hand moves to the next one).
  for (let i = 0; i < 4; i++) {
    const had = await page.evaluate(() => {
      const row = document.querySelector("[data-plan-ingredient]");
      const b =
        row && [...row.querySelectorAll("button")].find((x) => /^Buy /.test(x.textContent.trim()));
      b?.click();
      return !!b;
    });
    await sleep(900);
    if (!had) break;
  }
  const bought = await readSave(page);
  const purchases = bought.economyLedger.filter((e) => e.category === "inventory-purchase");
  check(
    "S4 buying spends the player's own money: inventory-purchase entries, wallet = $10 + signed ledger",
    purchases.length >= 1 &&
      bought.credits < start.credits &&
      bought.credits === 1000 + ledgerSum(bought) &&
      bought.credits >= 0,
    { credits: bought.credits, purchases: purchases.length },
  );
  check(
    "S5 nothing is given free: no Grandma tools, cupboard or leftovers",
    !bought.business.grandmasTools &&
      !bought.business.grandmasFridge &&
      (bought.business.cleanliness?.cupboardAt ?? null) === null,
    { tools: !!bought.business.grandmasTools },
  );

  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(1200);
  await clickButton(page, /^Prepare$/);
  await sleep(1500);
  // A Pre-Service Check or opening card may come first.
  for (let i = 0; i < 3; i++) {
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) =>
          /^(🔥 Start service|START SERVICE|🚪 Open restaurant|OPEN THE RESTAURANT)$/i.test(
            x.textContent.trim(),
          ) && !x.disabled,
      );
      b?.click();
      return !!b;
    });
    await sleep(900);
    if (!clicked) break;
  }
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    { timeout: 30000 },
  );
  for (let step = 0; step < 4; step++) {
    await playToReport(page);
    await clickButton(page, /^Continue$/);
    await sleep(1200);
    if (/ORDER READY/i.test(await flat(page))) break;
  }
  await clickButton(page, /^Serve to /);
  await sleep(3500);
  await sweepCash(page);
  await clickButton(page, /^Next Customer$/);
  await sleep(1500);
  const done = await readSave(page);
  check(
    "S6 the bought food cooks, serves, sweeps and Next Customer (last order) completes level-1; wallet = $10 + signed ledger",
    done.levelProgress.completedLevelIds.includes("level-1") &&
      done.credits === 1000 + ledgerSum(done),
    { completed: done.levelProgress.completedLevelIds, credits: done.credits },
  );
  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("S7 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
