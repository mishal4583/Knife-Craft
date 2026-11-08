// Note (2026-11-01): a new game opens with $236.00 ($10 for food + the Server's and the Cashier's hiring fees): 23600 below.
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
    // Rule changed (developer 2026-11-08): level 1 has no "Next Customer" (the first 20 levels); "Back to Kitchen" is the way on.
    const k = [...document.querySelectorAll("button")].find((x) =>
      /^Back to Kitchen$/.test(x.textContent.trim()),
    );
    return b ? b.disabled : k ? k.disabled : "absent";
  });
  check(
    // Rule changed (developer 2026-11-01): no Collect cash button (the pile is tapped or swiped), and a dirty table
    // holds Next Customer back (the cash never does: it waits on the table).
    // Rule changed again (developer 2026-11-03): the table is wiped only when NO table is free. One party sat at one of the two tables, so
    // the other is still clean and Next Customer is not held back.
    "C2a after the reaction the served card opens by itself: the cash waits on the table (no button), Next Customer is open (the second table is clean)",
    /on the table/i.test(body) && !/Collect cash/i.test(body) && gated === false,
    { gated, body: body.slice(0, 160) },
  );
  await page.screenshot({ path: "tools/e2e/cashflow-table.png" });
  const pieces = await sweepCash(page);
  check("C2b one tap on the pile takes the cash in (and the table is scrubbed)", pieces > 0, {
    pieces,
  });
  await sleep(1500);
  const collected = await readSave(page);
  const kinds = collected.economyLedger.map((e) => e.category);
  check(
    "C3 sweeping pays the order exactly once: wallet = signed ledger, ONE settlement + ONE tip entry, nothing left on the table",
    // Rule changed (developer 2026-11-07): the Server and the Cashier are hired INSIDE the service (two staff-purchase entries), so the pay
    // is judged net of those two fees; nothing else moves.
    collected.credits +
      -collected.economyLedger
        .filter((e) => e.category === "staff-purchase")
        .reduce((t, e) => t + e.amount, 0) >
      base.credits &&
      collected.credits === 23600 + ledgerSum(collected) &&
      // The harness hires the Server and the Cashier (two staff-purchase entries, since 2026-11-03 a service needs both).
      collected.economyLedger.filter(
        (e) => e.category !== "inventory-purchase" && e.category !== "staff-purchase",
      ).length === 2 &&
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
  await clickButton(page, /^(Next Customer|Back to Kitchen)$/);
  await sleep(1500);
  const done = await readSave(page);
  const rewards = done.economyLedger.filter((e) => e.category === "completion-reward");
  check(
    "C4 Next Customer (last order) completes level-1 once and the wallet still equals the ledger",
    done.levelProgress.completedLevelIds.includes("level-1") &&
      rewards.length === 1 &&
      done.credits === 23600 + ledgerSum(done),
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
