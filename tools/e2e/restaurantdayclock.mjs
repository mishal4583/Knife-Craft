// The day clock (developer 2026-10-11: "improve the day and night setting"), restaurant build:
//   1. The Kitchen's day strip and light follow the day: opening (Breakfast first, dawn) →
//      lull (Lunch next 2/3, midday) → Dinner (evening) → Closing Time (night sky).
//   2. 320 / 360 / 390 / 1024 px: the strip fits on one line, no sideways scroll.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const saveAt = (n, restaurantDay) =>
  seedSave({
    business: { ...MOVED_IN_BUSINESS, restaurantDay },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });
const day = (done, planned, closingDue = false) => ({
  day: 12,
  opened: planned > 0,
  servicesDone: done,
  servicesPlanned: planned,
  closingDue,
  openingCredits: planned > 0 ? 1000 : null,
  openingLevel: planned > 0 ? 25 : null,
});
const read = () =>
  page.evaluate(() => ({
    strip: document.querySelector('[data-testid="day-strip"]')?.textContent ?? null,
    phase:
      document.querySelector('[data-testid="day-strip"]')?.getAttribute("data-day-phase") ?? null,
    light: document.querySelector("[data-day-light]")?.getAttribute("data-day-light") ?? null,
    closing: !!document.querySelector('[data-testid="closing-time"]'),
  }));

const seen = {};
for (const [name, n, rd] of [
  ["opening", 25, day(0, 0)],
  ["lull", 26, day(1, 3)],
  ["dinner", 27, day(2, 3)],
  ["closing", 28, day(3, 3, true)],
]) {
  await boot(page, saveAt(n, rd));
  await sleep(700);
  seen[name] = await read();
  await shot(page, `dayclock-${name}`);
}
check(
  "1 the strip and light follow the day: opening/dawn → Lunch 2/3/midday → Dinner/evening → Closing Time/night",
  /Day 12 · Fri · .*Opening: Breakfast first \(3 services\)/.test(seen.opening.strip ?? "") &&
    seen.opening.light === "dawn" &&
    /Lunch next \(2\/3\)/.test(seen.lull.strip ?? "") &&
    seen.lull.light === "midday" &&
    /Dinner next \(3\/3\)/.test(seen.dinner.strip ?? "") &&
    seen.dinner.light === "evening" &&
    seen.closing.closing &&
    /Closing time/.test(seen.closing.strip ?? "") &&
    seen.closing.light === "night",
  seen,
);

const fits = [];
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [1024, 1366],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, saveAt(26, day(1, 3)));
  await sleep(600);
  fits.push(
    await page.evaluate((w) => {
      const el = document.querySelector('[data-testid="day-strip"]');
      const r = el?.getBoundingClientRect();
      return {
        w,
        shown: !!el,
        oneLine: !!r && r.height < 40,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, w),
  );
}
check(
  "2 at 320 / 360 / 390 / 1024 px the strip fits on one line, no sideways scroll",
  fits.every((f) => f.shown && f.oneLine && f.overflow <= 0),
  fits,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("3 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `DAY CLOCK E2E: ${failed.length} FAILURE(S)` : "DAY CLOCK E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
