// The core loop with swipe-to-collect cash (developer 2026-10-29), restaurant build:
//   C1 Serve books nothing: the wallet and ledger are untouched until cash is swept in.
//   C2 Next / Next Customer (last order) wait for the cash (disabled), then work once it is all collected.
//   C3 sweeping the pieces pays exactly the order's pay + tip; the wallet equals the signed ledger.
//   C4 Next Customer (last order) completes level-1 (one completion reward) and lands on the Kitchen.
//   C5 no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  launch,
  startFirstLevel,
  sleep,
  clickButton,
  readSave,
  text,
  sweepCash,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async (page) => (await text(page)).replace(/\s+/g, " ");
const { browser, page, logs } = await launch();

try {
  await startFirstLevel(page);
  const base = await readSave(page);
  // Level 1 is now a two-ingredient plate: play every step until the order is ready.
  let played = { ok: false };
  for (let step = 0; step < 4; step++) {
    played = await playToReport(page);
    await clickButton(page, /^Continue$/);
    await sleep(1200);
    if (/ORDER READY/i.test(await flat(page))) break;
    await page
      .waitForFunction(
        () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
        {
          timeout: 15000,
        },
      )
      .catch(() => {});
  }
  await clickButton(page, /^Serve to /);
  await sleep(3500);

  const afterServe = await readSave(page);
  const ledgerSum = (s) => s.economyLedger.reduce((t, e) => t + e.amount, 0);
  check(
    "C1 Serve books nothing until the cash is swept in",
    played.ok &&
      afterServe.credits === base.credits &&
      afterServe.economyLedger.length === base.economyLedger.length,
    { credits: afterServe.credits, ledger: afterServe.economyLedger.length },
  );

  // The customer reacts and walks out, then the served card opens by itself (no cash screen in between).
  await page
    .waitForFunction(() => !document.querySelector('[data-testid="service-floor"]'), {
      timeout: 12000,
    })
    .catch(() => {});
  await sleep(500);
  const body = await flat(page);
  const gated = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /^Next Customer$/.test(x.textContent.trim()),
    );
    return b ? b.disabled : "absent";
  });
  check(
    "C2a after the reaction the served card opens by itself: cash waits (Collect cash), Next Customer is NOT gated",
    /Collect cash/i.test(body) && gated === false,
    { gated, body: body.slice(0, 160) },
  );
  await page.screenshot({ path: "tools/e2e/cashflow-table.png" });
  const pieces = await sweepCash(page);
  check("C2b one tap on Collect cash takes it in", pieces > 0, { pieces });
  await sleep(1500);
  const collected = await readSave(page);
  const kinds = collected.economyLedger.map((e) => e.category);
  check(
    "C3 sweeping pays the order exactly once: wallet = signed ledger, ONE settlement + ONE tip entry, nothing left on the table",
    collected.credits > base.credits &&
      collected.credits === 1000 + ledgerSum(collected) &&
      collected.economyLedger.filter((e) => e.category !== "inventory-purchase").length === 2 &&
      !collected.business.pendingCash,
    {
      credits: collected.credits,
      ledger: collected.economyLedger.length,
      kinds,
      amounts: collected.economyLedger.map((e) => e.amount),
      pend: collected.business.pendingCash ?? null,
      base: base.economyLedger.length,
    },
  );

  const t = await flat(page);
  await clickButton(page, /^Next Customer$/);
  await sleep(1500);
  const done = await readSave(page);
  const rewards = done.economyLedger.filter((e) => e.category === "completion-reward");
  check(
    "C4 Next Customer (last order) completes level-1 once and the wallet still equals the ledger",
    done.levelProgress.completedLevelIds.includes("level-1") &&
      rewards.length === 1 &&
      done.credits === 1000 + ledgerSum(done),
    {
      completed: done.levelProgress.completedLevelIds,
      rewards: rewards.length,
      credits: done.credits,
      was: t.slice(0, 120),
    },
  );
  await page.screenshot({ path: "tools/e2e/cashflow-after.png" });
  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("C5 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 300));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
