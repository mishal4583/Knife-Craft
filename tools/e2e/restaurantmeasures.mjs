// The developer's 2026-10-08 brief in a real browser (restaurant build — the default):
//   1. Kitchen home: the top-left card shows the restaurant rank ("Restaurant rank · n/13", the
//      rank's name, "Next: … · Lv …"); on the Order Board Prepare (green) and Replay (outlined)
//      look different.
//   2. Level 20's Pre-Service Check: amounts are real portions ("Need 0.3 lb (≈ 1 tomato)"), and
//      Quick Restock buys exactly what's missing at a higher price with a warning — the wallet drops
//      by the shown amount, one inventory-purchase entry per ingredient, and the service can start.
//   3. Settings → Weights → Kilograms: the save keeps "kg"; the Market prices tomatoes per kg with
//      "1 kg ≈ 7 tomatoes"; buying 1 kg adds 2.205 lb and one ledger entry of the kg price.
//   4. Market → Ingredients: "Plan ahead" lists what the next days need (today's first), 1/2/3-day
//      picker, Buy all buys every line (one entry each) and the plan then says you're stocked.
//   5. 320–430 px: the plan and the Quick Restock box fit (no sideways scroll), buttons ≥ 48 px.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  shot,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true });

const done = (n) => Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`);
const saveAt = (n, cents, extra = {}) =>
  seedSave({
    version: 3,
    business: MOVED_IN_BUSINESS,
    credits: cents,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: done(n),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
    ...extra,
  });
const money = (t) => Math.round(Number(String(t).replace(/[^0-9.]/g, "")) * 100);
const navTo = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll("nav button")].find((x) => x.textContent.includes(l))?.click(),
    label,
  );
async function openMarketIngredients() {
  await navTo("Market");
  await sleep(700);
  await clickButton(page, /Ingredients$/);
  await sleep(900);
}
const purchases = (s) => s.economyLedger.filter((e) => e.category === "inventory-purchase");

// ---------- 1. Kitchen rank + button colors ----------
await boot(page, saveAt(20, 5_000_00));
const rank = await page.evaluate(
  () =>
    document.querySelector('[data-testid="kitchen-rank"]')?.innerText.replace(/\s+/g, " ") ?? "",
);
await shot(page, "measures-kitchen-rank");
check(
  "1a Kitchen top-left shows the restaurant rank, its name and the next one",
  /Restaurant rank · 3\/13/i.test(rank) &&
    /Morning Café/.test(rank) &&
    /Next: Working Kitchen · Lv 30/.test(rank),
  rank,
);
await clickButton(page, /^See all orders/);
await sleep(800);
const colors = await page.evaluate(() => {
  const btn = (t) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === t);
  const look = (b) =>
    b ? getComputedStyle(b).backgroundImage + "|" + getComputedStyle(b).backgroundColor : null;
  return { prepare: look(btn("Prepare")), replay: look(btn("Replay")) };
});
check(
  "1b Order Board: Prepare and Replay are styled differently",
  !!colors.prepare && !!colors.replay && colors.prepare !== colors.replay,
  colors,
);

// ---------- 2. Real portions + Quick Restock ----------
await navTo("Kitchen");
await sleep(600);
await clickButton(page, /^Prepare$/);
await sleep(1200);
const rows = await page.evaluate(() =>
  [...document.querySelectorAll("[data-psc-ingredient]")].map((r) =>
    r.innerText.replace(/\s+/g, " "),
  ),
);
const quick = await page.evaluate(
  () =>
    document.querySelector('[data-testid="psc-quick-restock"]')?.innerText.replace(/\s+/g, " ") ??
    "",
);
await page.evaluate(() =>
  document.querySelector('[data-testid="psc-quick-restock"]')?.scrollIntoView({ block: "center" }),
);
await shot(page, "measures-quick-restock");
check(
  "2a the check shows real portions with item counts (Need 0.3 lb (≈ 1 tomato) …)",
  rows.length > 0 &&
    rows.every((t) => /Need [\d.]+ (lb|loa|bunch)/.test(t)) &&
    rows.some((t) => /\(≈ \d+ \w+/.test(t)),
  rows.slice(0, 3),
);
check(
  "2b Quick Restock is offered with a warning that it costs more than the Market",
  /Quick restock just what's missing · \$[\d.,]+/.test(quick) &&
    /more than the Market \(\+25%\)/.test(quick),
  quick,
);
const before = await readSave(page);
const shown = money(quick.match(/missing · (\$[\d.,]+)/)?.[1] ?? "0");
await clickButton(page, /Quick restock just what's missing/);
await sleep(900);
const after = await readSave(page);
const newEntries = purchases(after).length - purchases(before).length;
const startable = await page.evaluate(() =>
  [...document.querySelectorAll("button")].some(
    (b) => /^(OPEN THE RESTAURANT|START SERVICE)$/.test(b.textContent.trim()) && !b.disabled,
  ),
);
check(
  "2c Quick Restock takes exactly the shown amount, one ledger entry per ingredient, and the service can start",
  shown > 0 &&
    before.credits - after.credits === shown &&
    newEntries === rows.filter((t) => /Restock/.test(t)).length &&
    startable,
  { shown, spent: before.credits - after.credits, newEntries, startable },
);

// ---------- 3. Kilograms ----------
await boot(page, saveAt(20, 5_000_00));
await page.evaluate(() => document.querySelector('[aria-label="Settings"]')?.click());
await sleep(700);
await clickButton(page, /^Kilograms \(kg\)$/);
await sleep(600);
const kgSave = await readSave(page);
await shot(page, "measures-settings");
check("3a Settings → Kilograms is saved", kgSave.settings.measure === "kg", kgSave.settings);
await openMarketIngredients();
const tomatoCard = await page.evaluate(
  () => document.querySelector('[data-ingredient="tomato"]')?.innerText.replace(/\s+/g, " ") ?? "",
);
check(
  "3b the tomato card is priced per kg and says 1 kg ≈ 7 tomatoes",
  /\$[\d.]+\/kg/.test(tomatoCard) && /1 kg ≈ 7 tomatoes/.test(tomatoCard),
  tomatoCard.slice(0, 120),
);
// Buy 1 kg (− down to 1 from the default).
for (let i = 0; i < 5; i++)
  await page.evaluate(() =>
    document.querySelector('[aria-label="Decrease quantity for Tomato"]')?.click(),
  );
await sleep(300);
const buyText = await page.evaluate(() => {
  const card = document.querySelector('[data-ingredient="tomato"]');
  return (
    [...card.querySelectorAll("button")]
      .find((b) => /^Buy /.test(b.textContent.trim()))
      ?.textContent.trim() ?? ""
  );
});
const b1 = await readSave(page);
await page.evaluate(() => {
  const card = document.querySelector('[data-ingredient="tomato"]');
  [...card.querySelectorAll("button")].find((b) => /^Buy /.test(b.textContent.trim()))?.click();
});
await sleep(800);
const b2 = await readSave(page);
const tomatoGain =
  (b2.business.inventory.tomato?.quantity ?? 0) - (b1.business.inventory.tomato?.quantity ?? 0);
const entry = purchases(b2).slice(purchases(b1).length);
check(
  "3c Buy 1 kg adds 2.205 lb of tomato and one ledger entry of the kg price",
  /^Buy 1 kg · \$/.test(buyText) &&
    Math.abs(tomatoGain - 2.205) < 1e-9 &&
    entry.length === 1 &&
    -entry[0].amount === money(buyText.split("·")[1]),
  { buyText, tomatoGain, entry },
);

// ---------- 4. Plan ahead ----------
await boot(page, saveAt(31, 5_000_00));
await openMarketIngredients();
const plan = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="market-plan"]');
    return el
      ? {
          text: el.innerText.replace(/\s+/g, " "),
          rows: [...el.querySelectorAll("[data-plan-ingredient]")].map((r) => ({
            id: r.getAttribute("data-plan-ingredient"),
            day: Number(r.getAttribute("data-plan-day")),
          })),
          checked: el.querySelector('[role="radio"][aria-checked="true"]')?.textContent.trim(),
        }
      : null;
  });
const p2 = await plan();
await page.evaluate(() =>
  document.querySelector('[data-testid="market-plan"]')?.scrollIntoView({ block: "start" }),
);
await shot(page, "measures-market-plan");
await clickButton(page, /^3 days$/);
await sleep(400);
const p3 = await plan();
check(
  "4a Plan ahead: 2 days by default, today's lines first, 3 days lists at least as much",
  !!p2 &&
    p2.checked === "2 days" &&
    p2.rows.length > 0 &&
    p2.rows[0].day === 0 &&
    p3.rows.length >= p2.rows.length,
  { two: p2?.rows.length, three: p3?.rows.length, first: p2?.rows[0] },
);
const total = money(p3.text.match(/Buy all · (\$[\d.,]+)/)?.[1] ?? "0");
// The panel lists 6 lines, then "Show all N".
const planLines = Number(p3.text.match(/Show all (\d+)/)?.[1] ?? p3.rows.length);
const pb = await readSave(page);
await clickButton(page, /^Buy all · /);
await sleep(1000);
const pa = await readSave(page);
const pEntries = purchases(pa).length - purchases(pb).length;
const p3after = await plan();
check(
  "4b Buy all buys every line (one entry each, the shown total) and the plan is then stocked",
  total > 0 &&
    pb.credits - pa.credits === total &&
    pEntries === planLines &&
    /stocked for the next 3 days/.test(p3after.text),
  {
    total,
    spent: pb.credits - pa.credits,
    pEntries,
    lines: planLines,
    after: p3after.text.slice(-80),
  },
);

// ---------- 5. Widths ----------
const fit = [];
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 932],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true });
  await boot(page, saveAt(31, 5_000_00));
  await openMarketIngredients();
  const market = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="market-plan"]');
    const small = [...(el?.querySelectorAll("button") ?? [])].filter(
      (b) => b.getBoundingClientRect().height < 47.5,
    ).length;
    return {
      plan: !!el,
      small,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  await navTo("Kitchen");
  await sleep(500);
  await clickButton(page, /^Prepare$/);
  await sleep(1000);
  const sheet = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="psc-quick-restock"]');
    const r = el?.getBoundingClientRect();
    const small = [...(el?.querySelectorAll("button") ?? [])].filter(
      (b) => b.getBoundingClientRect().height < 47.5,
    ).length;
    return {
      quick: !!el,
      small,
      right: r ? Math.round(r.right) : 0,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  fit.push({ w, market, sheet });
  if (w === 320) await shot(page, "measures-quick-320");
}
check(
  "5 320–430 px: the plan and Quick Restock fit (no sideways scroll), every button ≥ 48 px",
  fit.every(
    (f) =>
      f.market.plan &&
      f.market.small === 0 &&
      f.market.overflow <= 0 &&
      f.sheet.quick &&
      f.sheet.small === 0 &&
      f.sheet.overflow <= 0 &&
      f.sheet.right <= f.w,
  ),
  fit,
);

const errors = logs.filter((l) => /pageerror/.test(l));
check("6 no page errors", errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(
  failed ? `RESTAURANT MEASURES E2E: ${failed} FAILURE(S)` : "RESTAURANT MEASURES E2E: ALL PASS",
);
process.exit(failed ? 1 : 0);
