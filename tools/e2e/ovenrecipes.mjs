// Transformation Phase D (2026-10-25) — the oven for the five bread dishes, restaurant build:
//   R1–R5 at L6, L7, L12, L15 and L17: after the cut the oven appears (no cooking film), it
//         bakes, "Take it out" ends it, the Knife Report follows, and Serve pays once (one
//         settlement entry, the wallet moves by exactly that entry).
//   R6 a 390×844 and a 320×568 mid-bake view (L6): no sideways scroll, the button on screen.
//   R7 no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  launch,
  boot,
  seedSave,
  MOVED_IN_BUSINESS,
  clickButton,
  sleep,
  readSave,
  shot,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const LEVELS = [
  [6, "Tomato Basil Toast", ["bread", "tomato", "basil"]],
  [7, "Mushroom Bruschetta", ["bread", "mushroom", "garlic"]],
  [12, "Bruschetta for the House", ["bread", "tomato", "garlic", "basil", "mozzarella"]],
  [15, "Family Antipasto for Two", ["bread", "tomato", "mozzarella"]],
  [17, "Bruschetta Trio", ["bread", "tomato", "basil", "garlic", "cucumber"]],
];
const saveAt = (n, food) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      // L16 brings the free Mexican Chef hire (as phase5.mjs); 8 each fits cold storage.
      ...(n >= 16 ? { restaurantStaff: { specialists: ["mexican-chef"] } } : {}),
      inventory: Object.fromEntries(
        food.map((id) => [id, { ingredientId: id, quantity: 8, unitCost: 0, purchaseDay: 1 }]),
      ),
    },
    credits: 5000,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: n > 10 ? 1 : 0, finaleSeen: false },
  });
async function startLevel() {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  await clickButton(page, /^Prepare$/);
  await sleep(900);
  if (await page.evaluate(() => !!document.querySelector('[data-testid="pre-service-check"]')))
    await clickButton(
      page,
      /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/,
    );
  await sleep(600);
}
const oven = () =>
  page.evaluate(() => {
    const o = document.querySelector('[data-testid="oven-step"]');
    if (!o) return null;
    const b = [...o.querySelectorAll("button")]
      .find((x) => /Take it out/.test(x.textContent))
      ?.getBoundingClientRect();
    return {
      state: o.dataset.state,
      title: o.getAttribute("aria-label"),
      clip: !!document.querySelector("video"),
      buttonOn: b ? b.top >= 0 && b.bottom <= innerHeight && b.height >= 47.5 : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
const untilOven = () => !!document.querySelector('[data-testid="oven-step"]');
const settlements = (s) =>
  (s?.economyLedger ?? []).filter((e) => e.category === "campaign-settlement");

for (const [i, [n, dish, food]] of LEVELS.entries()) {
  await boot(page, saveAt(n, food));
  await startLevel();
  const cut = await playToReport(page, { maxMs: 180000, until: untilOven });
  await page
    .waitForFunction(
      () => document.querySelector('[data-testid="oven-step"]')?.dataset.state === "baking",
      { timeout: 5000 },
    )
    .catch(() => null);
  const inOven = await oven();
  let views = null;
  if (n === 6) {
    views = {};
    for (const [w, h] of [
      [390, 844],
      [320, 568],
    ]) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
      await sleep(600);
      views[w] = await oven();
      await shot(page, `ovenrecipes-l6-${w}`);
    }
    await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
    await sleep(300);
  }
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="oven-step"] button')]
      .find((x) => /Take it out/.test(x.textContent))
      ?.click(),
  );
  await page
    .waitForFunction(() => /KNIFE REPORT/i.test(document.body.innerText), { timeout: 10000 })
    .catch(() => null);
  const report = await page.evaluate(() => ({
    report: /KNIFE REPORT/i.test(document.body.innerText),
    oven: !!document.querySelector('[data-testid="oven-step"]'),
  }));
  await clickButton(page, /^Continue$/);
  await sleep(900);
  const before = await readSave(page);
  await clickButton(page, /^Serve to /);
  await sleep(2500);
  const after = await readSave(page);
  const added = settlements(after).slice(settlements(before).length);
  // Every wallet move is in the ledger: one settlement per Serve, plus whatever the normal
  // serve already writes (e.g. a batch partner's or tip entry) — all of it, and only it.
  const moved = (after.economyLedger ?? []).slice((before.economyLedger ?? []).length);
  const paidOnce =
    added.length === 1 &&
    after.credits - before.credits === moved.reduce((t, e) => t + (e.amount ?? 0), 0);
  check(
    `R${i + 1} L${n} ${dish}: oven after the cut (no film), Take it out, the Knife Report, Serve pays once`,
    cut.stopped &&
      inOven?.state === "baking" &&
      !inOven.clip &&
      inOven.title === `Baking ${dish}` &&
      report.report &&
      !report.oven &&
      paidOnce,
    {
      inOven,
      report,
      added: added.length,
      walletDelta: after.credits - before.credits,
      paidOnce,
      entries: moved.map((e) => [e.category, e.amount, e.description]),
    },
  );
  if (views)
    check(
      "R6 L6 mid-bake at 390×844 and 320×568: baking, no sideways scroll, a 48 px button on screen",
      Object.values(views).every((v) => v?.state === "baking" && v.overflow <= 0 && v.buttonOn),
      views,
    );
}

const errors = logs.filter((l) => /^(error|pageerror)/.test(l) && !/bridge|favicon|ERR_/.test(l));
check("R7 no console errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `\nOVEN RECIPES E2E: ${failed.length} FAILURE(S)`
    : "\nOVEN RECIPES E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
