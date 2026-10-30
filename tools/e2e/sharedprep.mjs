// Customers who ordered the same dish (developer 2026-10-30), restaurant build, Level 17 with two
// saved Bruschetta Trio tickets: cut plate 1, then plate 2, cook once, serve together; cash is optional to collect.
//   P1 the HUD counts both plates' steps (an even count) and says "2 plates together".
//   P2 after the cut and the cooking, the first plate is served; its cash is NOT mandatory
//      (Next works with the cash still on the table).
//   P3 the next plate arrives already prepared: its serve screen shows at once, no new cutting.
//   P4 both orders paid once; the wallet equals the opening cash + the signed ledger.
//   P5 the Kitchen shows the cash left on the table and collecting it empties it.
//   P6 no console errors.
import {
  launch,
  boot,
  seedSave,
  MOVED_IN_BUSINESS,
  sleep,
  clickButton,
  readSave,
  text,
} from "./harness.mjs";
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
  const n = 17;
  const start = seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      restaurantStaff: { specialists: ["mexican-chef"] },
      sectionsSeen: ["inventory", "shop", "rack", "business"],
    },
    credits: 500_000,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 3,
      tickets: { "level-17": ["camp-bruschetta-trio", "camp-bruschetta-trio"] },
    },
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
  });
  start.version = 3;
  await boot(page, start);
  await sleep(2500);
  await clickButton(page, /^Prepare$/);
  await sleep(1500);
  for (let i = 0; i < 5; i++) {
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) =>
          /^(⚡ Quick restock|🔥 Start service|🚪 Open restaurant)/i.test(x.textContent.trim()) &&
          !x.disabled,
      );
      b?.click();
      return !!b;
    });
    await sleep(900);
    if (!clicked) break;
  }
  // The customer's arrival card, if any.
  await clickButton(page, /Start cooking/).catch(() => {});
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    { timeout: 30000 },
  );
  const hud = await flat(page);
  check(
    "P1 both plates' steps are counted (an even number of steps, plate 1 first) and the order says 2 plates together",
    Number(/STEP 1 OF (\d+)/i.exec(hud)?.[1] ?? 0) % 2 === 0 &&
      /FOR PLATE 1/i.test(hud) &&
      /2 plates together/i.test(hud),
    { hud: hud.slice(0, 200) },
  );
  const before = await readSave(page);

  for (let step = 0; step < 4; step++) {
    await playToReport(page, { maxMs: 120000 });
    await clickButton(page, /^Continue$/);
    await sleep(1500);
    if (/ORDER READY/i.test(await flat(page))) break;
  }
  await page
    .waitForFunction(() => /ORDER READY/i.test(document.body.innerText), { timeout: 60000 })
    .catch(() => {});
  await clickButton(page, /^Serve to /);
  // Two ways, by the party's size (decided by the order id): a table of two holds the first plate
  // (paid, kept back) and goes straight to the second; a lone customer is served and walks out.
  let partyPath = false;
  for (let i = 0; i < 20 && !partyPath; i++) {
    partyPath = await page.evaluate(
      () => !!document.querySelector('[data-testid="party-holding"]'),
    );
    if (!partyPath) await sleep(150);
  }
  await page.waitForFunction(
    () =>
      !!document.querySelector('[data-testid="party-held"]') ||
      (!document.querySelector('[data-testid="service-floor"]') &&
        [...document.querySelectorAll("button")].some((x) =>
          /plate →$/.test(x.textContent.trim()),
        )),
    { timeout: 25000 },
  );
  await sleep(600);
  const afterFirst = await readSave(page);
  const next = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /plate →$/.test(x.textContent.trim()),
    );
    return b ? { label: b.textContent.trim(), disabled: b.disabled } : null;
  });
  check(
    `P2 [${partyPath ? "table of two" : "lone customer"}] the first plate is paid, the cash waits on the table, nothing blocks the next step`,
    !!afterFirst.business.pendingCash && (partyPath || (!!next && !next.disabled)),
    { next, pending: afterFirst.business.pendingCash },
  );
  if (!partyPath) await clickButton(page, /plate →$/);
  await sleep(1800);
  const t = await flat(page);
  check(
    "P3 the second plate arrives prepared: ORDER READY shows at once, nothing is cut again",
    /ORDER READY/i.test(t) && /Serve to /i.test(t),
    { t: t.slice(0, 160) },
  );
  await clickButton(page, /^Serve to /);
  // Watch the dining room: with a party every plate arrives together and everyone walks out together.
  let maxPlates = 0;
  let sawLeaving = false;
  let partySize = 0;
  for (let i = 0; i < 45; i++) {
    const v = await page.evaluate(() => ({
      plates: document.querySelectorAll(".sf-layer .sf-plate").length,
      state:
        document.querySelector('[data-testid="service-floor"]')?.getAttribute("data-state") ??
        "none",
      size: Number(
        document.querySelector('[data-testid="service-floor"]')?.getAttribute("data-party") ?? 0,
      ),
    }));
    partySize = Math.max(partySize, v.size);
    maxPlates = Math.max(maxPlates, v.plates);
    if (v.state === "leaving") sawLeaving = true;
    if (v.state === "reacting" && v.size === 2)
      await page.screenshot({ path: "tools/e2e/party-eating.png" });
    if (v.state === "leaving" && v.size === 2)
      await page.screenshot({ path: "tools/e2e/party-leaving.png" });
    await sleep(150);
  }
  const afterSecond = await readSave(page);
  const paid = afterSecond.levelProgress.paidOrders?.["level-17"]?.length ?? 0;
  check(
    partyPath
      ? "P4 [table of two] both orders are paid, ONE pile of cash waits, both plates reached the table together and the party walked out"
      : "P4 [lone customer] both orders are paid and the cash waits (nothing paid twice)",
    paid === 2 &&
      !!afterSecond.business.pendingCash &&
      (!partyPath || (maxPlates >= 2 && partySize === 2 && sawLeaving)),
    { paid, maxPlates, sawLeaving, partySize, pending: afterSecond.business.pendingCash ?? null },
  );
  await page
    .waitForFunction(() => !document.querySelector('[data-testid="service-floor"]'), {
      timeout: 12000,
    })
    .catch(() => {});
  await sleep(600);
  await clickButton(page, /^(Finish Level|Back to Orders)$/).catch(() => {});
  await sleep(2000);
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(1500);
  const chip = await page.evaluate(
    () => document.querySelector('[data-testid="kitchen-table-cash"]')?.textContent ?? null,
  );
  await page.evaluate(() => document.querySelector('[data-testid="kitchen-table-cash"]')?.click());
  await sleep(1200);
  const cleared = await readSave(page);
  const delta = ledgerSum(cleared) - ledgerSum(before);
  check(
    "P5 the Kitchen offers the cash on the table; collecting it empties the table; wallet = opening + ledger change",
    !!chip &&
      !cleared.business.pendingCash &&
      cleared.economyLedger.some((e) => e.category === "campaign-settlement") &&
      cleared.credits === before.credits + delta,
    { chip, credits: cleared.credits, expected: before.credits + delta },
  );
  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("P6 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
  console.log("PAGE:", (await flat(page)).slice(0, 700));
  console.log(
    "BUTTONS:",
    await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .map((b) => b.textContent.trim())
        .join(" | ")
        .slice(0, 700),
    ),
  );
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
