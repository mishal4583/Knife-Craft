// Transformation Phase E (2026-10-25) — the oven for the four baguette dishes, restaurant build.
// Only Avocado Baguette Toast has a level (L47, a late service: five hires and takeaway
// supplies), and the other three are on no level. So, on the development server
// (KC_URL = `npm run dev`), the test puts each dish in Level 6's place in memory (the page's
// own LevelManager module; nothing saved) — the oven is chosen by recipe, not by level.
//   B1–B4 Avocado Baguette Toast, Baguette Rounds, Baguette & Cheddar Rounds, Baguette
//         Crostini Prep: after the cut the oven appears (no cooking film) with a baguette
//         tray (🥖 ×3), "Take it out", the Knife Report, then Serve writes one settlement
//         entry and the wallet moves by exactly the new ledger entries.
//   B5 mid-bake (Avocado Baguette Toast) at 390×844 and 320×568: the baguette tray, no
//      sideways scroll, a 48 px button on screen.
//   B6 no console errors.
// On a production build the swap is impossible: the test says so and exits 1.
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
const CASES = [
  ["B1", "camp-avocado-baguette-toast", "Avocado Baguette Toast", ["baguette", "avocado", "lemon"]],
  ["B2", "camp-baguette-rounds", "Baguette Rounds", ["baguette"]],
  [
    "B3",
    "camp-baguette-cheddar-rounds",
    "Baguette & Cheddar Rounds",
    ["baguette", "cheddar", "apple"],
  ],
  ["B4", "camp-baguette-crostini-prep", "Baguette Crostini Prep", ["baguette", "tomato"]],
];
const N = 6;
const saveAt = (food) => {
  const s = seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: Object.fromEntries(
        food.map((id) => [id, { ingredientId: id, quantity: 8, unitCost: 0, purchaseDay: 1 }]),
      ),
    },
    credits: 5000,
    levelProgress: {
      currentLevelId: `level-${N}`,
      highestUnlockedLevelId: `level-${N}`,
      completedLevelIds: Array.from({ length: N - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
  });
  return s;
};
// Development server only: put `recipeId` in Level 6's place (in memory, this page only).
const swapLevel = (recipeId) =>
  page.evaluate(async (id) => {
    try {
      const m = await import("/src/game/levels/LevelManager.ts");
      const l = m.getLevel("level-6");
      l.recipeId = id;
      l.recipePoolIds = [id];
      return true;
    } catch {
      return false;
    }
  }, recipeId);
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
      tray: [...o.querySelectorAll('[data-testid="oven-tray-item"]')].map((x) => x.textContent),
      clip: !!document.querySelector("video"),
      buttonOn: b ? b.top >= 0 && b.bottom <= innerHeight && b.height >= 47.5 : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
const untilOven = () => !!document.querySelector('[data-testid="oven-step"]');
const settlements = (s) =>
  (s?.economyLedger ?? []).filter((e) => e.category === "campaign-settlement");
const baguetteTray = (o) => !!o && o.tray.length === 3 && o.tray.every((t) => t === "🥖");

for (const [id, swap, dish, food] of CASES) {
  await boot(page, saveAt(food));
  if (!(await swapLevel(swap))) {
    check(`${id} ${dish}: the development server is needed (KC_URL = npm run dev)`, false);
    continue;
  }
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
  if (id === "B1") {
    views = {};
    for (const [w, h] of [
      [390, 844],
      [320, 568],
    ]) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
      await sleep(600);
      views[w] = await oven();
      await shot(page, `ovenbaguette-${w}`);
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
  const moved = (after.economyLedger ?? []).slice((before.economyLedger ?? []).length);
  const paidOnce =
    added.length === 1 &&
    after.credits - before.credits === moved.reduce((t, e) => t + (e.amount ?? 0), 0);
  check(
    `${id} ${dish}: oven after the cut (no film), a 🥖 tray, Take it out, the Knife Report, Serve pays once`,
    cut.stopped &&
      inOven?.state === "baking" &&
      !inOven.clip &&
      inOven.title === `Baking ${dish}` &&
      baguetteTray(inOven) &&
      report.report &&
      !report.oven &&
      paidOnce,
    {
      inOven,
      report,
      walletDelta: after.credits - before.credits,
      entries: moved.map((e) => [e.category, e.amount, e.description]),
    },
  );
  if (views)
    check(
      "B5 Avocado Baguette Toast mid-bake at 390×844 and 320×568: the 🥖 tray, no sideways scroll, a 48 px button on screen",
      Object.values(views).every(
        (v) => v?.state === "baking" && baguetteTray(v) && v.overflow <= 0 && v.buttonOn,
      ),
      views,
    );
}

const errors = logs.filter((l) => /^(error|pageerror)/.test(l) && !/bridge|favicon|ERR_/.test(l));
check("B6 no console errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `\nOVEN BAGUETTE E2E: ${failed.length} FAILURE(S)`
    : "\nOVEN BAGUETTE E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
