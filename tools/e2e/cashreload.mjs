// Cash left on the table is never lost (developer 2026-10-29), restaurant build:
//   R1 after Serve the unswept cash is SAVED (business.pendingCash), the wallet and ledger untouched.
//   R2 closing the game (a reload) before sweeping loses nothing: the cash is still on the table
//      (collecting is optional, developer 2026-10-30).
//   R3 the Kitchen's Collect button pays it exactly once; R3b a second reload pays nothing more.
//   R4 no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, startFirstLevel, sleep, clickButton, readSave, text } from "./harness.mjs";
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
  await startFirstLevel(page);
  const base = await readSave(page);
  for (let step = 0; step < 4; step++) {
    await playToReport(page);
    await clickButton(page, /^Continue$/);
    await sleep(1200);
    if (/ORDER READY/i.test(await flat(page))) break;
  }
  await clickButton(page, /^Serve to /);
  await sleep(3000);

  const owed = await readSave(page);
  const p = owed.business.pendingCash;
  check(
    "R1 after Serve the cash on the table is saved; wallet and ledger untouched",
    !!p &&
      p.payCents + p.tipCents > 0 &&
      owed.credits === base.credits &&
      owed.economyLedger.length === base.economyLedger.length,
    { pending: p && p.payCents + p.tipCents, credits: owed.credits },
  );
  const total = p ? p.payCents + p.tipCents : 0;

  // The player closes the game before sweeping anything.
  await page.reload({ waitUntil: "load" });
  await sleep(4000);
  const after = await readSave(page);
  check(
    "R2 the reload leaves the cash on the table (nothing is settled behind the player's back)",
    after.credits === base.credits &&
      after.economyLedger.length === base.economyLedger.length &&
      after.business.pendingCash?.payCents + after.business.pendingCash?.tipCents === total,
    { credits: after.credits, pending: after.business.pendingCash ?? null },
  );
  // The player collects it from the Kitchen when they want: once, one settlement + one tip entry.
  await page.evaluate(() => document.querySelector('[data-testid="kitchen-table-cash"]')?.click());
  await sleep(1500);
  const taken = await readSave(page);
  check(
    "R3 collecting from the Kitchen pays it exactly once: wallet = $10 + signed ledger, one settlement + one tip entry",
    taken.credits === base.credits + total &&
      taken.credits === 1000 + ledgerSum(taken) &&
      taken.economyLedger.length === base.economyLedger.length + 2 &&
      !taken.business.pendingCash,
    { credits: taken.credits, total, entries: taken.economyLedger.length },
  );
  await page.reload({ waitUntil: "load" });
  await sleep(3000);
  const again = await readSave(page);
  check(
    "R3b a second reload pays nothing more",
    again.credits === base.credits + total &&
      again.economyLedger.length === base.economyLedger.length + 2,
    { credits: again.credits },
  );
  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("R4 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 300));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
