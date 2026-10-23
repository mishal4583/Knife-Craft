// Standing orders & deliveries (a real restaurant's day, plan F3), restaurant build:
//   1. Restaurant → Suppliers: the Standing orders card; switching Fresh and Weekly on is saved.
//   2. Closing Time (Day 15 → tomorrow Day 16, a fresh day) shows tonight's order; Close for the
//      night delivers it with the morning — the stock is in, one ledger entry per line, the money
//      matches — and the opening card says what arrived.
//   3. 320 px: the card fits, buttons ≥ 48 px.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  readSave,
  clickButton,
  openSection,
  shot,
  doClosingChores,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const saveAt = (n, business = {}) =>
  seedSave({
    business: { ...MOVED_IN_BUSINESS, inventory: {}, ...business },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });
async function openSuppliers() {
  // The back office opens from the Restaurant map's Manager / Office.
  await openSection(page, "Business");
  await sleep(800);
  await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Business sections"] button')]
      .find((x) => x.textContent.includes("Suppliers"))
      ?.click(),
  );
  await sleep(800);
}

// ---------- 1. The card ----------
await boot(page, saveAt(41));
await openSuppliers();
const card = await page.evaluate(() => !!document.querySelector('[data-testid="standing-orders"]'));
for (const k of ["fresh", "weekly"]) {
  await page.evaluate(
    (k) =>
      [...document.querySelectorAll(`[data-standing-order="${k}"] button`)]
        .find((b) => /Turn on/.test(b.textContent))
        ?.click(),
    k,
  );
  await sleep(400);
}
const s1 = await readSave(page);
await shot(page, "deliveries-card");
check(
  "1 Suppliers shows the standing orders; switching Fresh and Weekly on is saved",
  card && s1.business.deliveries?.fresh === true && s1.business.deliveries?.weekly === true,
  { card, deliveries: s1.business.deliveries },
);

// ---------- 2. Closing → the morning's delivery ----------
await boot(
  page,
  saveAt(44, {
    deliveries: { fresh: true, weekly: true, pending: [], delivered: [], history: [] },
    restaurantDay: {
      day: 15,
      opened: true,
      servicesDone: 3,
      servicesPlanned: 3,
      closingDue: true,
      openingCredits: 1000,
      openingLevel: 41,
    },
  }),
);
await page.evaluate(() =>
  [...document.querySelectorAll("nav button")]
    .find((x) => x.textContent.includes("Kitchen"))
    ?.click(),
);
await sleep(900);
const tonight = await page.evaluate(
  () => document.querySelector('[data-testid="tonights-order"]')?.innerText ?? null,
);
const tonightNames = await page.evaluate(() =>
  [...document.querySelectorAll("[data-order-line]")].map((x) => x.getAttribute("data-order-line")),
);
const before = await readSave(page);
await doClosingChores(page);
await clickButton(page, /^Close for the night/);
await sleep(1200);
const after = await readSave(page);
const entries = after.economyLedger.slice(before.economyLedger.length);
const rec = after.business.deliveries?.history?.at(-1);
await clickButton(page, /^Prepare$/);
await sleep(1200);
const morning = await page.evaluate(
  () => document.querySelector('[data-testid="morning-deliveries"]')?.innerText ?? null,
);
await shot(page, "deliveries-morning");
check(
  "2 Closing shows tonight's order; Close delivers it with the morning — stock in, one ledger entry per line, the money matches; the opening card says what arrived",
  !!tonight &&
    /Fresh delivery/.test(tonight) &&
    !!rec &&
    rec.id === "16-fresh" &&
    rec.lines.length > 0 &&
    entries.filter((e) => e.category === "inventory-purchase").length === rec.lines.length &&
    -entries
      .filter((e) => e.category === "inventory-purchase")
      .reduce((n, e) => n + e.amount, 0) === rec.cost &&
    // The money matches its entries (closing may also pay a milestone or wages).
    before.credits + entries.reduce((n, e) => n + e.amount, 0) === after.credits &&
    // Tonight's order is exactly what arrives.
    rec.lines.every((l) => tonightNames.some((n) => n === l.id)) &&
    Object.keys(after.business.inventory).length >= rec.lines.length &&
    !!morning &&
    /Fresh delivery arrived/.test(morning),
  {
    tonight: tonight?.slice(0, 120),
    rec,
    entries: entries.length,
    morning: morning?.slice(0, 120),
  },
);

// ---------- 3. 320 px ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(page, saveAt(41));
await openSuppliers();
const fit = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="standing-orders"]');
  const buttons = el ? [...el.querySelectorAll("button")] : [];
  return {
    shown: !!el,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: buttons.filter((b) => b.getBoundingClientRect().height < 47.5).map((b) => b.textContent),
  };
});
check(
  "3 at 320 px the card fits, buttons ≥ 48 px",
  fit.shown && fit.overflow <= 0 && fit.small.length === 0,
  fit,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("4 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `DELIVERIES E2E: ${failed.length} FAILURE(S)` : "DELIVERIES E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
