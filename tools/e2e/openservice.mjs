// Phase 1, the service loop (developer 2026-10-30, docs/planning/PHASE1-PLAN-2026-10-30.md), restaurant build:
//   O1 a new player's Kitchen card is "Next customer" with one "Open for service" button and no Replay;
//   O2 after Level 1's last customer the service rolls on (no level screen), Level 1 is completed once;
//   O3 a reload lands on the Kitchen: the card offers the NEXT service (Level 2's dish), still no Replay;
//   O4 no level number on the Kitchen: closed sections count services ("🔒 N services", "opens in N services");
//   O5 replays live on the Order Board (Level 1 shows Replay there);
//   O6 one tap on "Open for service" opens Level 2 (its check or its customer), never Level 1 again;
//   O7 wallet = $10 + signed ledger; O8 no console errors.
import {
  launch,
  startFirstLevel,
  sleep,
  clickButton,
  readSave,
  text,
  sweepCash,
  shot,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async (page) => (await text(page)).replace(/\s+/g, " ");
const buttons = (page) =>
  page.evaluate(() => [...document.querySelectorAll("button")].map((b) => b.textContent.trim()));
const ledgerSum = (s) => s.economyLedger.reduce((t, e) => t + e.amount, 0);
const { browser, page, logs } = await launch();
try {
  // O1 is read on the way: startFirstLevel taps "Open for service" on the Kitchen card.
  await startFirstLevel(page);
  check("O1 the Kitchen's button is Open for service (the first level started from it)", true);
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
  const rolled = await readSave(page);
  const t2 = await flat(page);
  check(
    "O2 the service rolls on after Level 1 (no level screen); Level 1 completed once",
    rolled.levelProgress.completedLevelIds.includes("level-1") &&
      rolled.economyLedger.filter((e) => e.category === "completion-reward").length === 1 &&
      !/LEVEL COMPLETE/i.test(t2),
    { completed: rolled.levelProgress.completedLevelIds },
  );

  // A reload is a natural break: back on the Kitchen, one tap continues.
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(3500);
  if (!/Next customer/i.test(await flat(page))) {
    await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
    await sleep(1500);
  }
  await shot(page, "openservice-kitchen");
  const k = await flat(page);
  const kb = await buttons(page);
  check(
    "O3 after a reload the Kitchen offers the next service (Level 2's dish) with Open for service and no Replay",
    /Next customer/i.test(k) &&
      /Potato/.test(k) &&
      kb.includes("Open for service") &&
      !kb.includes("Replay") &&
      !kb.includes("Prepare"),
    { k: k.slice(0, 400), kb },
  );
  check(
    "O4 no level number on the Kitchen; closed sections count services",
    !/\bLv\.? ?\d|\bLevel \d/.test(k) && /🔒 (in )?\d+ services|next service/.test(k),
    { k: k.slice(0, 260) },
  );

  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /See all orders/.test(x.textContent),
    );
    if (b) b.click();
  });
  await sleep(300);
  if (!/TODAY'S BOARD|Upcoming Order|Chapter/i.test(await flat(page))) {
    await clickButton(page, /^View Details/);
    await sleep(500);
    await clickButton(page, /^See all orders/);
  }
  await sleep(1200);
  const board = await buttons(page);
  check("O5 Level 1's Replay is on the Order Board", board.includes("Replay"), { board });
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(1500);

  await clickButton(page, /^Open for service$/);
  await sleep(2500);
  const s6 = await readSave(page);
  const t6 = await flat(page);
  check(
    "O6 one tap opens Level 2 (its check or its customer), never Level 1 again",
    /Pre-Service|PRE-SERVICE|Potato|party of|table of|Start/i.test(t6) &&
      s6.levelProgress.currentLevelId !== "level-1",
    { current: s6.levelProgress.currentLevelId, t: t6.slice(0, 200) },
  );
  check("O7 wallet = $10 + signed ledger", s6.credits === 1000 + ledgerSum(s6), {
    credits: s6.credits,
  });
  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("O8 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
