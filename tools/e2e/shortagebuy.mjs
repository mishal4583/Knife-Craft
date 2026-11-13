// Deep check 2026-11-12, restaurant build. A Level 55 save with an empty fridge on a "Temporary Shortage" day (business day 5: one purchase is at
// most 10 units). Since the prep batch the plan's rows are often over 10 units:
//   B1. the plan lists rows over today's limit (the case really happens);
//   B2. "Buy all" buys every row (nothing skipped), and charges exactly the total on the button;
//   B3. a row over the limit came as several purchases (more ledger entries than rows), the wallet and the ledger agree;
//   B4. the delivery waits as at most 3 baskets (it was up to 15, each to be checked and unpacked before opening);
//   B5. a single row's own button buys a row over the limit too (a second save);
//   B6. fits at 390 and 320; no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, readSave, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const CREDITS = 5_000_000;
const save55 = () =>
  seedSave({
    credits: CREDITS,
    business: {
      ...MOVED_IN_BUSINESS,
      calendar: { businessDay: 5 },
      inventory: {},
      refrigerator: { refrigeratorId: "professional-refrigerator" },
    },
    levelProgress: {
      currentLevelId: "level-55",
      highestUnlockedLevelId: "level-55",
      completedLevelIds: Array.from({ length: 54 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const openPlan = async (page) => {
  await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
  await page.waitForSelector('nav[aria-label="Shop categories"]', { timeout: 15000 });
  await sleep(400);
  await page.evaluate(() => {
    [...document.querySelectorAll('nav[aria-label="Shop categories"] button')]
      .find((b) => (b.textContent ?? "").includes("Ingredients"))
      ?.click();
  });
  await page.waitForSelector('[data-testid="market-plan"]', { timeout: 15000 });
  await sleep(500);
};
const planRows = (page) =>
  page.evaluate(() => {
    const plan = document.querySelector('[data-testid="market-plan"]');
    [...plan.querySelectorAll("button")]
      .find((b) => /^Show all/.test((b.textContent ?? "").trim()))
      ?.click();
    return null;
  });
const readPlan = (page) =>
  page.evaluate(() => {
    const plan = document.querySelector('[data-testid="market-plan"]');
    const rows = [...plan.querySelectorAll("[data-plan-ingredient]")].map((r) => ({
      id: r.getAttribute("data-plan-ingredient"),
      text: (r.textContent ?? "").replace(/\s+/g, " ").trim(),
    }));
    const all = [...plan.querySelectorAll("button")].find((b) =>
      /^Buy all/.test((b.textContent ?? "").trim()),
    );
    return { rows, buyAll: (all?.textContent ?? "").trim() };
  });
const cents = (text) =>
  Math.round(Number((text.match(/\$([\d,]+\.\d\d)/)?.[1] ?? "0").replace(/,/g, "")) * 100);
const lbOf = (text) => Number(text.match(/Buy ([\d.]+) lb/)?.[1] ?? 0);

const { browser, page, logs } = await launch();
await boot(page, save55());
await openPlan(page);
await planRows(page);
await sleep(300);
const before = await readPlan(page);
const start = (await readSave(page)).credits;
const over = before.rows.filter((r) => lbOf(r.text) > 10);
check("B1 the plan has rows over today's 10-unit limit", over.length > 0, {
  rows: before.rows.length,
  over: over.map((r) => `${r.id} ${lbOf(r.text)}`),
});
await shot(page, "shortagebuy-plan-390");
const shown = cents(before.buyAll);
await page.evaluate(() => {
  const plan = document.querySelector('[data-testid="market-plan"]');
  [...plan.querySelectorAll("button")]
    .find((b) => /^Buy all/.test((b.textContent ?? "").trim()))
    ?.click();
});
await sleep(700);
const s1 = await readSave(page);
const bought = s1.economyLedger.filter((e) => e.category === "inventory-purchase");
const spent = start - s1.credits;
const notice = await page.evaluate(() => document.body.innerText.match(/[✓✗] [^\n]*/)?.[0] ?? "");
check(
  "B2 Buy all buys every row and charges exactly the button's total",
  spent === shown &&
    shown > 0 &&
    !/skipped/.test(notice) &&
    over.every((r) => (s1.business.inventory[r.id]?.quantity ?? 0) > 10),
  { shown, spent, notice },
);
check(
  "B3 a row over the limit came as several purchases; the ledger and the wallet agree",
  bought.length > before.rows.length &&
    bought.reduce((t, e) => t - e.amount, 0) === spent &&
    bought.every((e) => e.amount < 0),
  { rows: before.rows.length, entries: bought.length },
);
const crate = s1.business.fridgeSort ?? {};
const pieces = (crate.crate ?? []).reduce((t, id) => t + (crate.counts?.[id] ?? 1), 0);
check(
  "B4 the delivery waits as at most 3 baskets (63 pieces at Level 55)",
  pieces > 21 && pieces <= 63,
  {
    ingredients: (crate.crate ?? []).length,
    pieces,
  },
);
await shot(page, "shortagebuy-after-390");

// B5: one row's own button, on a fresh save
await boot(page, save55());
await openPlan(page);
await planRows(page);
await sleep(300);
const target = (await readPlan(page)).rows.find((r) => lbOf(r.text) > 10);
const start2 = (await readSave(page)).credits;
await page.evaluate((id) => {
  const row = document.querySelector(`[data-plan-ingredient="${id}"]`);
  [...row.querySelectorAll("button")]
    .find((b) => /^Buy /.test((b.textContent ?? "").trim()))
    ?.click();
}, target?.id);
await sleep(600);
const s2 = await readSave(page);
const one = s2.economyLedger.filter((e) => e.category === "inventory-purchase");
check(
  "B5 a row's own button buys a row over the limit, in parts",
  !!target &&
    Math.abs((s2.business.inventory[target.id]?.quantity ?? 0) - lbOf(target.text)) < 0.01 &&
    one.length >= 2 &&
    start2 - s2.credits === cents(target.text),
  { target, entries: one.length, spent: start2 - s2.credits },
);

await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 2 });
await sleep(400);
const fits = await page.evaluate(
  () => document.documentElement.scrollWidth <= window.innerWidth + 1,
);
await shot(page, "shortagebuy-320");
const errors = logs.filter((l) => /pageerror|Uncaught|TypeError|ReferenceError/.test(l));
check("B6 fits at 320 and no page errors", fits && errors.length === 0, {
  fits,
  errors: errors.slice(0, 3),
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0 ? "SHORTAGE BUY: ALL PASS" : `SHORTAGE BUY: ${failed.length} FAILURE(S)`,
);
process.exit(failed.length === 0 ? 0 : 1);
