// The level system is hidden (developer 2026-10-30), restaurant build:
//   R1 after the last customer of Level 1 ("Next Customer") the service rolls on: no Level Complete screen, no
//      Order Board — Level 2's customer arrives (its own Pre-Service Check first when stock is short).
//   R2 Level 1 is completed once (one completion reward), wallet = $10 + signed ledger.
//   R3 no console errors.
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
const ledgerSum = (s) => s.economyLedger.reduce((t, e) => t + e.amount, 0);
try {
  await startFirstLevel(page);
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
  await sleep(3500);
  const t = await flat(page);
  const done = await readSave(page);
  const rewards = done.economyLedger.filter((e) => e.category === "completion-reward");
  const onNext =
    /Potato|Pre-Service|PRE-SERVICE|Start cooking|A customer|party of|table of/i.test(t) &&
    !/LEVEL COMPLETE/i.test(t) &&
    !/TODAY'S BOARD/i.test(t);
  check("R1 service rolls on to Level 2's customers (no Level Complete, no Order Board)", onNext, {
    t: t.slice(0, 220),
  });
  check(
    "R2 Level 1 completed once with one completion reward; wallet = $10 + signed ledger",
    done.levelProgress.completedLevelIds.includes("level-1") &&
      rewards.length === 1 &&
      done.credits === 1000 + ledgerSum(done),
    {
      completed: done.levelProgress.completedLevelIds,
      rewards: rewards.length,
      credits: done.credits,
    },
  );
  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("R3 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
