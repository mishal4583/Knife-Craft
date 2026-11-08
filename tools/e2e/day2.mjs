// Developer 2026-11-01 (Phase 11, point 8): cleaning from Day 2, restaurant build, in a real browser.
// A restaurant day is two services, so Day 2 is Levels 3-4 (seed numbers here are the game's own: Level 3 = level-3
// in the 150-level ids is Level 1, so the seeds below use the +2 offset like every other restaurant test).
//   Y1 the MORNING of Day 2: the Pre-Service Check lists the opening chores (kitchen stations, restroom check).
//   Y2 SERVICE TIME: after the first service the check between services lists the lull's chores.
//   Y3 the NIGHT of Day 2: Closing Time lists chores in the kitchen, the dining area AND the restroom.
//   Y4 closing the night turns the day: Day 3's morning brings the opening chores again.
//   Y5 Day 1 has none of it (the quiet close).
//   Y6 no console errors.
import fs from "node:fs";
import {
  launch,
  boot,
  seedSave,
  MOVED_IN_BUSINESS,
  clickButton,
  sleep,
  readSave,
  text,
  shot,
  sweepCash,
  doClosingChores,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const q = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
// A stuck run says where it is stuck instead of hanging.
setTimeout(async () => {
  console.log("WATCHDOG: stuck after 4 minutes:", (await flat()).slice(0, 700));
  await shot(page, "day2-stuck");
  process.exit(3);
}, 240000).unref();

const ingredientIds = [
  ...fs
    .readFileSync(new URL("../../src/game/definitions.ts", import.meta.url), "utf8")
    .matchAll(/^\s{2}"?([a-z][a-z-]*)"?: \{\s*$/gm),
].map((m) => m[1]);
const FOOD = Object.fromEntries(
  ingredientIds.map((id) => [id, { ingredientId: id, quantity: 40, unitCost: 0, purchaseDay: 1 }]),
);
const SUPPLY_IDS = [
  ...fs
    .readFileSync(new URL("../../src/game/business/businessSupplies.ts", import.meta.url), "utf8")
    .split("export type SupplyId =")[1]
    .split(";")[0]
    .matchAll(/\|\s*"([a-z-]+)"/g),
].map((m) => m[1]);
const saveAt = (seedLevel) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: FOOD,
      refrigerator: { refrigeratorId: "professional-refrigerator" },
      supplies: {
        stock: Object.fromEntries(SUPPLY_IDS.map((id) => [id, { units: 60, costBasis: 100 }])),
      },
      staff: { hiredRoles: ["server", "cashier"] },
    },
    credits: 50_000,
    levelProgress: {
      currentLevelId: `level-${seedLevel}`,
      highestUnlockedLevelId: `level-${seedLevel}`,
      completedLevelIds: Array.from({ length: seedLevel - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 4095, finaleSeen: false },
  });
const toKitchen = async () => {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
};
const chores = (phase) =>
  page.evaluate(
    (ph) =>
      [...document.querySelectorAll(`[data-testid="shift-chores-${ph}"] li`)].map((li) =>
        li.textContent.replace(/\s+/g, " ").trim(),
      ),
    phase,
  );
/** One whole customer: cut, serve, collect, wipe the table, Next Customer. */
async function serveOne() {
  for (let step = 0; step < 4; step++) {
    await playToReport(page);
    await clickButton(page, /^Continue$/);
    await sleep(1200);
    if (/ORDER READY/i.test(await flat())) break;
  }
  await clickButton(page, /^Serve to /);
  await sleep(3500);
  await sweepCash(page);
  await clickButton(page, /^(Next Customer|Back to Kitchen)$/);
  await sleep(2000);
}

/** The Pre-Service Check's start button, when a check is open. */
async function startIfSheet() {
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
    await sleep(1000);
    if (!clicked) break;
  }
}
/** Closing Time: the night's chores, then the Close button. True when it was closed. */
async function closeTheNight() {
  const doneAll = await doClosingChores(page);
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /^Close for the night/.test(x.textContent.trim()),
    );
    if (b && !b.disabled) b.click();
    return !!b && !b.disabled;
  });
  await sleep(1500);
  return doneAll && clicked;
}
/** Serves customers until the game's Level `n` is completed (a level may have several orders). */
async function playLevelDone(n) {
  for (let i = 0; i < 6; i++) {
    const done = (await readSave(page)).levelProgress.completedLevelIds.length;
    console.log(`  .. level ${n}: ${done} completed (need ${n}), customer ${i + 1}`);
    if (done >= n) return true;
    await serveOne();
  }
  return false;
}

try {
  // ---------- Y5: Day 1 has no chores ----------
  await boot(page, saveAt(2 + 1));
  await toKitchen();
  await clickButton(page, /^Open for service$/);
  await sleep(1200);
  const day1 = await q('[data-testid="shift-chores-opening"]');
  check("Y5 Day 1 (Level 1) has no opening chores", !day1, { day1 });
  // Play Day 1 for real (Levels 1 and 2): its quiet close brings Day 2's morning chores.
  for (let n = 1; n <= 2; n++) {
    await startIfSheet();
    await playLevelDone(n);
    if (n === 1) {
      await toKitchen();
      await clickButton(page, /^Open for service$/);
      await sleep(1200);
    }
  }
  // Day 1's night is a short Closing Time (the dishes and the till): no cleaning chores yet.
  await sleep(1500);
  const night1 = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="closing-chores"] li')].map((li) =>
      li.textContent.replace(/\s+/g, " ").trim(),
    ),
  );
  check(
    "Y5b Day 1's night has no cleaning chores (only the dishes and the till)",
    night1.length > 0 && night1.every((t) => /dishes|takings/i.test(t)),
    night1,
  );
  const closed1 = await closeTheNight();

  // ---------- Y1: the morning of Day 2 (Level 3) ----------
  await toKitchen();
  await clickButton(page, /^Open for service$/);
  await sleep(1200);
  const morning = await chores("opening");
  await shot(page, "day2-1-morning");
  check(
    "Y1 the morning of Day 2: the opening chores are listed (stations and the restroom check)",
    morning.length >= 2 &&
      morning.some((t) => /station/i.test(t)) &&
      morning.some((t) => /restroom/i.test(t)),
    morning,
  );

  // Start the service and serve the day's first customer(s) until the level is done.
  await startIfSheet();
  await playLevelDone(3);
  const afterL3 = await readSave(page);

  // ---------- Y2: between the services ----------
  await toKitchen();
  await clickButton(page, /^Open for service$/);
  await sleep(1200);
  const lull = await chores("lull");
  await shot(page, "day2-2-lull");
  check(
    "Y2 between the services of Day 2: the lull's chores are listed",
    afterL3.levelProgress.completedLevelIds.length >= 3 && lull.length >= 1,
    { lull, completed: afterL3.levelProgress.completedLevelIds.length },
  );
  await startIfSheet();
  await playLevelDone(4);

  // ---------- Y3, Y4: the night of Day 2 ----------
  await sleep(1500);
  let closing = await q('[data-testid="closing-time"]');
  if (!closing) {
    await toKitchen();
    await sleep(800);
    closing = await q('[data-testid="closing-time"]');
  }
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="closing-chores"] li')].map((li) =>
      li.textContent.replace(/\s+/g, " ").trim(),
    ),
  );
  await shot(page, "day2-3-closing");
  const t = rows.join(" | ");
  check(
    "Y3 the night of Day 2: Closing Time lists chores in the kitchen, the dining area and the restroom",
    closing &&
      /(boards|degrease|spoiled|wrap|grease|equipment)/i.test(t) &&
      /(mop|floor|tables)/i.test(t) &&
      /(restroom|toilet)/i.test(t),
    { closing, rows },
  );
  const dayBefore = (await readSave(page)).business.restaurantDay?.day ?? 1;
  const doneAll = await closeTheNight();
  const next = await readSave(page);
  await toKitchen();
  await clickButton(page, /^Open for service$/);
  await sleep(1200);
  const day3 = await chores("opening");
  check(
    "Y4 closing the night turns the day, and the next morning brings the opening chores again",
    doneAll &&
      closed1 &&
      (next.business.restaurantDay?.day ?? 0) === dayBefore + 1 &&
      day3.length >= 1,
    { doneAll, dayBefore, day: next.business.restaurantDay?.day, day3 },
  );

  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("Y6 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 500));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
