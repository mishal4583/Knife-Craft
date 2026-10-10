// Level 1–10 UX pass (docs/HANDOFF.md §4), on the release build:
//   1. The Order Board highlights no bottom-bar section (it used to light up Kitchen) and its
//      rows say "Next: Santoku in the Market · Lv 10" (not a free "Next: Santoku").
//   2. The HUD: a single-step level shows no "Step 1 of 1"; its destination line ("For Bowl")
//      sits on the order card, readable.
//   3. Level 7 (a peel): the HUD shows "% peeled" rising while peeling, before the step is done.
//   4. The Knife Report: the line follows the grade (one of the per-cut toast's words), the
//      retry button says "Prepare Again".
//   5. Level 10: the story milestone shows first, then "Level Complete" with Order payout,
//      Completion reward and Earned this level — equal to what the ledger paid for the level.
//   6. 320×568 / 360×640 / 375×642 / 390×844 / 430×932: the HUD card and the Level Complete
//      notice fit (no sideways scroll).
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, clickButton, readSave, shot } from "./harness.mjs";
import { playToReport, CX, CY } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const flat = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
// Test saves are version 1: credits are whole dollars there (×100 on load).
const saveAt = (n, mask = 127) =>
  seedSave({
    credits: 500,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: mask, finaleSeen: false },
  });
async function openLevel(title) {
  await clickButton(page, /^See all orders/);
  await sleep(800);
  await page.evaluate((name) => {
    const h = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === name);
    let n = h;
    for (let i = 0; i < 8 && n; i++) {
      n = n.parentElement;
      const b =
        n && [...n.querySelectorAll("button")].find((x) => /^Prepare$/.test(x.textContent.trim()));
      if (b) return b.click();
    }
  }, title);
  // Supplies plan A (2026-10-10): Level 10's first play opens the Pre-Service Check with
  // Grandma's first shopping list (it never blocks START).
  await sleep(900);
  await clickButton(page, /^(OPEN THE RESTAURANT|START SERVICE)$/);
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    { timeout: 30000 },
  );
  await sleep(600);
}

// ---------- 1. Order Board ----------
await boot(page, saveAt(3));
await clickButton(page, /^See all orders/);
await sleep(900);
const board = await page.evaluate(() => {
  const nav = [...document.querySelectorAll("nav button")].map((b) => ({
    label: b.textContent.trim(),
    lit: !!b.getAttribute("style"),
  }));
  return { nav, text: document.body.innerText.replace(/\s+/g, " ") };
});
await shot(page, "levelux-board");
check(
  "1 the Order Board lights no bottom-bar section; rows say 'Next: Santoku in the Market · Lv 10'",
  board.nav.length === 5 &&
    board.nav.every((n) => !n.lit) &&
    /Next: Santoku in the Market · Lv 10/.test(board.text) &&
    !/Next: Santoku · Lv 10/.test(board.text),
  { nav: board.nav },
);

// ---------- 2. HUD ----------
await openLevel("Carrot Chop");
const hud = await page.evaluate(() => {
  const step = document.querySelector('[data-testid="hud-step"]');
  const card = step?.closest(".paper");
  return {
    text: step?.innerText ?? null,
    inCard: !!card && card.contains(step),
    opacity: step ? getComputedStyle(step).color : null,
    stepOneOfOne: /STEP 1 OF 1/i.test(document.body.innerText),
  };
});
await shot(page, "levelux-hud");
check(
  "2 single-step HUD: no 'Step 1 of 1'; 'For Bowl' sits on the order card",
  !hud.stepOneOfOne && /for bowl/i.test(hud.text ?? "") && hud.inCard,
  hud,
);

// ---------- 4. Knife Report (Level 3) ----------
const played = await playToReport(page);
await sleep(400);
const report = await flat();
check(
  "4 Knife Report: the line follows the grade; the retry button says 'Prepare Again'",
  played.ok &&
    /(Masterful\. Effortless\.|Clean cut\.|Honest work\.|Rustic, and still lovely\.|A direction, not a verdict\.)/.test(
      report,
    ) &&
    !/looked lovely/.test(report) &&
    /Prepare Again/.test(report) &&
    !/Prep Again/.test(report),
  { report: report.slice(0, 260) },
);

// ---------- 3. Level 7: peel progress ----------
await boot(page, saveAt(7));
await openLevel("Peeled Potato");
const pct = () =>
  page.evaluate(() => {
    const m = document.body.innerText.match(/(\d+)% peeled/);
    return m ? +m[1] : null;
  });
const before = await pct();
async function strokeAt(dy) {
  await page.mouse.move(CX, CY + dy);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) {
    await page.mouse.move(CX - (115 * i) / 14, CY + dy);
    await sleep(12);
  }
  await page.mouse.up();
  await sleep(250);
}
await strokeAt(0);
await strokeAt(-18);
const mid = await pct();
await shot(page, "levelux-peel");
check(
  "3 Level 7: the HUD shows '% peeled' rising while peeling, before the step is done",
  before === 0 && mid !== null && mid > 0 && mid < 100,
  { before, mid },
);

// ---------- 5. Level 10: milestone first, then Level Complete with the earnings ----------
await boot(page, saveAt(10, 0));
await openLevel("Simple Garden Salad");
const ledgerBefore = (await readSave(page)).economyLedger.length;
const p10 = await playToReport(page, { maxMs: 150000 });
await clickButton(page, /^Continue$/);
await sleep(900);
await clickButton(page, /^Serve to /);
await sleep(900);
await clickButton(page, /^Finish Level$/);
await sleep(600);
const first = await flat();
await page.waitForFunction(() => /LEVEL COMPLETE/i.test(document.body.innerText), {
  timeout: 15000,
});
await sleep(400);
const banner = await page.evaluate(() => {
  const rows = document.querySelector('[data-testid="banner-rows"]');
  return {
    text: document.body.innerText.replace(/\s+/g, " "),
    rows: rows
      ? [...rows.children].map((r) => [...r.children].map((c) => c.textContent.trim()))
      : null,
  };
});
await shot(page, "levelux-l10-complete");
const after = await readSave(page);
const added = after.economyLedger.slice(ledgerBefore);
const cents = (v) => Math.round(parseFloat(v.replace(/[^0-9.]/g, "")) * 100);
const order = added
  .filter((e) => e.category === "campaign-settlement")
  .reduce((s, e) => s + e.amount, 0);
const reward = added
  .filter((e) => e.category === "completion-reward")
  .reduce((s, e) => s + e.amount, 0);
const row = (label) => banner.rows?.find((r) => r[0] === label)?.[1] ?? null;
check(
  "5 Level 10: the story milestone shows first; then Level Complete lists Order payout + Completion reward = Earned this level, as the ledger paid",
  p10.ok &&
    !/LEVEL COMPLETE/i.test(first) &&
    banner.rows?.length === 3 &&
    cents(row("Order payout")) === order &&
    cents(row("Completion reward")) === reward &&
    cents(row("Earned this level")) === order + reward &&
    reward === 8000,
  { first: first.slice(0, 120), rows: banner.rows, order, reward },
);

// ---------- 6. Widths ----------
const widths = [
  [320, 568],
  [360, 640],
  [375, 642],
  [390, 844],
  [430, 932],
];
const fit = [];
for (const [w, h] of widths) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await sleep(300);
  fit.push(
    await page.evaluate(
      (w) => ({
        w,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }),
      w,
    ),
  );
}
check(
  "6 no sideways scroll at 320–430 px",
  fit.every((f) => f.overflow <= 0),
  fit,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("7 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `LEVEL UX E2E: ${failed.length} FAILURE(S)` : "LEVEL UX E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
