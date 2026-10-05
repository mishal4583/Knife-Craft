// The 30-day restaurant history (task #10), on the release build:
//   1. a save holding 30 completed days ends one more real Business Day: the history keeps 30,
//      drops Day 1 and adds Day 31 — saved and shown on Business → Operations, newest first;
//   2. a day opens its breakdown (revenue, costs, profit, orders, purchases, cash) on tap;
//   3. ending the day moved no money beyond its own settlement (no staff, no orders: credits
//      unchanged, no ledger entry);
//   4. 320×568 · 360×640 · 375×642 · 390×844 · 430×932 · 768×1024: no sideways scroll, every
//      day row ≥ 48 px tall; no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, clickButton, readSave, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const day = (n) => ({
  day: n,
  revenue: 10000 + n * 100,
  goodsUsed: 3000,
  staffWages: 0,
  maintenance: 0,
  supplierFees: 0,
  inspectionFines: 0,
  otherOperating: 0,
  totalCosts: 3000,
  profit: 7000 + n * 100,
  waste: 0,
  ingredientPurchases: 2500,
  packagingPurchases: 0,
  equipmentPurchases: 0,
  netCash: 7500 + n * 100,
  ordersServed: 6,
  customersServed: 6,
  averageOrderValue: Math.round((10000 + n * 100) / 6),
});
const { browser, page, logs } = await launch();
await page.setViewport({ width: 375, height: 642, deviceScaleFactor: 1, hasTouch: true });
await boot(
  page,
  seedSave({
    version: 2,
    credits: 1000,
    business: {
      calendar: { businessDay: 31 },
      finance: { history: Array.from({ length: 30 }, (_, i) => day(i + 1)) },
    },
  }),
);
const before = await readSave(page);
const nav = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll("nav button")].find((b) => b.textContent.includes(l))?.click(),
    label,
  );
await nav("Business");
await sleep(800);
await clickButton(page, /^End Business Day →/);
await sleep(1200);
const after = await readSave(page);
const tab = (re) =>
  page.evaluate(
    (src) =>
      [...document.querySelectorAll('nav[aria-label="Business sections"] button')]
        .find((b) => new RegExp(src).test(b.textContent))
        ?.click(),
    re.source,
  );
// Close any day-result panel, then open Operations.
await page.keyboard.press("Escape");
await tab(/Operations/);
await sleep(800);
await page.evaluate(() =>
  document.querySelector('[data-testid="business-history"]')?.scrollIntoView({ block: "start" }),
);
await sleep(300);
const view = await page.evaluate(() => {
  const h = document.querySelector('[data-testid="business-history"]');
  const rows = [...(h?.querySelectorAll("[data-history-day]") ?? [])].map(
    (r) => +r.getAttribute("data-history-day"),
  );
  return { found: !!h, rows, text: h?.innerText.replace(/\s+/g, " ").slice(0, 160) };
});
const stored = after.business.finance.history ?? [];
check(
  "1 31st day: the history keeps 30 (Day 1 dropped, Day 31 added), saved and shown newest first",
  stored.length === 30 &&
    stored[0].day === 2 &&
    stored[29].day === 31 &&
    view.found &&
    view.rows.length === 30 &&
    view.rows[0] === 31 &&
    !view.rows.includes(1),
  {
    stored: [stored[0]?.day, stored.at(-1)?.day, stored.length],
    rows: view.rows.slice(0, 3),
    n: view.rows.length,
  },
);
await page.evaluate(() => document.querySelector('[data-history-day="30"] button')?.click());
await sleep(300);
const open = await page.evaluate(() =>
  document.querySelector('[data-history-day="30"]')?.innerText.replace(/\s+/g, " "),
);
await shot(page, "history-open");
check(
  "2 a tap opens the day's breakdown",
  /Revenue \$130\.00/.test(open ?? "") &&
    /Total costs −\$30\.00/.test(open ?? "") &&
    /Profit \$100\.00/.test(open ?? "") &&
    /Average order \$21\.67/.test(open ?? ""),
  open,
);
check(
  "3 ending the day moved no money (no staff, no orders) and wrote no ledger entry",
  after.credits === before.credits && after.economyLedger.length === before.economyLedger.length,
  { credits: [before.credits, after.credits] },
);
const fit = [];
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [375, 642],
  [390, 844],
  [430, 932],
  [768, 1024],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true });
  await sleep(300);
  fit.push(
    await page.evaluate((w) => {
      const small = [...document.querySelectorAll("[data-history-day] > button")]
        .map((b) => b.getBoundingClientRect().height)
        .filter((x) => x > 0 && x < 47.5);
      return {
        w,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        small: small.length,
      };
    }, w),
  );
}
check(
  "4 no sideways scroll at 320–768 px; every day row ≥ 48 px",
  fit.every((f) => f.overflow <= 0 && f.small === 0),
  fit,
);
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("5 no page errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `HISTORY E2E: ${failed.length} FAILURE(S)` : "HISTORY E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
