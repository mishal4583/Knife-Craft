// Business Supplies in the built game (master spec §25), on a 375×642 phone viewport:
//   1. the Market shows the three supply sections (Smallwares 18 · Tableware 17 · Takeaway 15)
//      next to its own Knives and Cutting Boards;
//   2. buying dinner plates moves the wallet by exactly the card's total, adds exactly ONE
//      "supply-equipment-purchase" ledger entry and 12 plates to save-backed Business stock;
//      takeaway containers use "supply-packaging-purchase";
//   3. Business → Supplies shows that saved stock and the spend straight away, with no purchase
//      controls; its "Restock" opens the Market on the same section;
//   4. after a reload the stock is still there;
//   5. not enough money: the card says so, and a tap changes nothing (no ledger entry);
//   6. no horizontal page scroll; no console errors;
//   7. a Business order cooked and served for real goes out in one container and one carry bag:
//      both leave save-backed stock, their cost is added to the order's COGS, and the serve still
//      writes only its one business-revenue ledger entry.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  shot,
  save,
  text,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";
import { ALL_DISH_IDS } from "./businessDishes.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const businessSave = (credits) =>
  seedSave({ version: 2, credits, business: { calendar: { businessDay: 7 } } });

const { browser, page, logs } = await launch();
await page.setViewport({ width: 375, height: 642, deviceScaleFactor: 1 });

const cardCount = () => page.evaluate(() => document.querySelectorAll("[data-supply]").length);
const cardText = (id) =>
  page.evaluate(
    (id) => document.querySelector(`[data-supply="${id}"]`)?.textContent.replace(/\s+/g, " ") ?? "",
    id,
  );
const buy = (id) =>
  page.evaluate((id) => {
    const card = document.querySelector(`[data-supply="${id}"]`);
    card?.scrollIntoView({ block: "center" });
    const b = [...(card?.querySelectorAll("button") ?? [])].find((x) => /^Buy/.test(x.textContent));
    b?.click();
    return !!b;
  }, id);
const priceOf = (text) => {
  const m = text.match(/Buy · \$([\d,]+\.\d{2})/);
  return m ? Math.round(parseFloat(m[1].replace(/,/g, "")) * 100) : null;
};
async function openMarketTab(label) {
  await clickButton(page, /Market$/);
  await sleep(600);
  await clickButton(page, new RegExp(`${label}$`));
  await sleep(500);
}

// ---------- 1. Market sections ----------
await boot(page, businessSave(500_000));
await clickButton(page, /Market$/);
await sleep(600);
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('nav[aria-label="Shop categories"] button')].map((b) =>
    b.textContent.trim(),
  ),
);
check(
  "1a the Market has Knives, Cutting Boards and the three supply sections",
  ["Knives", "Cutting Boards", "Smallwares", "Tableware", "Takeaway"].every((t) =>
    tabs.some((x) => x.endsWith(t)),
  ),
  tabs,
);
const counts = {};
for (const label of ["Smallwares", "Tableware", "Takeaway"]) {
  await clickButton(page, new RegExp(`${label}$`));
  await sleep(400);
  counts[label] = await cardCount();
}
check(
  "1b 18 smallwares · 17 tableware · 15 takeaway lines",
  counts.Smallwares === 18 && counts.Tableware === 17 && counts.Takeaway === 15,
  counts,
);
const noHScroll = await page.evaluate(
  () => document.documentElement.scrollWidth <= window.innerWidth + 1,
);
check("1c no horizontal page scroll at 375 px", noHScroll);

// ---------- 2. Buying ----------
await clickButton(page, /Tableware$/);
await sleep(400);
const before = await readSave(page);
const plateCard = await cardText("dinner-plates");
const platePrice = priceOf(plateCard);
await buy("dinner-plates");
await sleep(600);
const afterPlates = await readSave(page);
const newEntries = afterPlates.economyLedger.slice(before.economyLedger.length);
check(
  "2a dinner plates: wallet − exactly the card's total, ONE equipment ledger entry, +12 plates saved",
  platePrice !== null &&
    afterPlates.credits === before.credits - platePrice &&
    newEntries.length === 1 &&
    newEntries[0].category === "supply-equipment-purchase" &&
    newEntries[0].amount === -platePrice &&
    afterPlates.business.supplies.stock["dinner-plates"]?.units === 12,
  { platePrice, delta: before.credits - afterPlates.credits, newEntries },
);
check(
  "2b the card now shows the plates owned",
  /12 owned/.test(await cardText("dinner-plates")),
  await cardText("dinner-plates"),
);
await clickButton(page, /Takeaway$/);
await sleep(400);
await buy("microwave-containers");
await sleep(600);
const afterBoxes = await readSave(page);
const last = afterBoxes.economyLedger.at(-1);
check(
  "2c takeaway containers: a packaging ledger entry and +150 containers",
  last?.category === "supply-packaging-purchase" &&
    afterBoxes.business.supplies.stock["microwave-containers"]?.units === 150 &&
    afterBoxes.economyLedger.length === afterPlates.economyLedger.length + 1,
  last,
);
await shot(page, "supplies-1-market");

// ---------- 3. Business → Supplies ----------
await clickButton(page, /Business$/);
await sleep(600);
await clickButton(page, /Supplies$/);
await sleep(600);
const bizButtons = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="business-supplies"] button')].map((b) =>
    b.textContent.trim(),
  ),
);
check(
  "3a Business → Supplies has no purchase controls",
  !bizButtons.some((t) => /^Buy|^[−+]$/.test(t)),
  bizButtons,
);
await clickButton(page, /TablewareFront of house$/);
await sleep(400);
const row = await page.evaluate(
  () =>
    document.querySelector('[data-supply-row="dinner-plates"]')?.innerText.replace(/\s+/g, " ") ??
    "",
);
const analytics = await page.evaluate(
  () =>
    document
      .querySelector('[data-testid="supplies-analytics"]')
      ?.textContent.replace(/\s+/g, " ") ?? "",
);
check(
  "3b the saved plates and the spend show in Business straight away",
  /\b12\b/.test(row) &&
    /owned/i.test(row) &&
    analytics.includes(`$${(platePrice / 100).toFixed(2)}`) &&
    /1 Market order/.test(analytics),
  { row, analytics },
);
await shot(page, "supplies-2-business");
await clickButton(page, /Restock Tableware in the Market/);
await sleep(700);
check(
  "3c Restock opens the Market on Tableware",
  (await cardCount()) === 17 && (await cardText("dinner-plates")).includes("Dinner plates"),
);

// ---------- 4. Reload ----------
await page.reload({ waitUntil: "networkidle0" });
await page.waitForFunction(() => document.querySelectorAll("button").length > 3, {
  timeout: 20000,
});
const reloaded = await readSave(page);
await clickButton(page, /Business$/);
await sleep(600);
await clickButton(page, /Supplies$/);
await sleep(500);
await clickButton(page, /TakeawayPackaging$/);
await sleep(400);
const boxRow = await page.evaluate(
  () =>
    document
      .querySelector('[data-supply-row="microwave-containers"]')
      ?.innerText.replace(/\s+/g, " ") ?? "",
);
check(
  "4 after a reload the stock is still saved and shown",
  reloaded.business.supplies.stock["dinner-plates"]?.units === 12 &&
    reloaded.business.supplies.stock["microwave-containers"]?.units === 150 &&
    /\b150\b/.test(boxRow),
  boxRow,
);

// ---------- 5. Not enough money ----------
await boot(page, businessSave(100));
await openMarketTab("Tableware");
const poorText = await cardText("dinner-plates");
const poorBefore = await readSave(page);
await buy("dinner-plates");
await sleep(500);
const poorAfter = await readSave(page);
check(
  "5 not enough money: the card says so and a tap changes nothing",
  /Not enough money — need \$[\d,.]+ more\./.test(poorText) &&
    (poorAfter === null ||
      ((poorAfter.economyLedger?.length ?? 0) === (poorBefore?.economyLedger?.length ?? 0) &&
        poorAfter.credits === 100 &&
        !poorAfter.business?.supplies?.stock?.["dinner-plates"])),
  { poorText: poorText.slice(0, 160) },
);

// ---------- 7. Packaging used by a real served order ----------
// The cutting solver plays at the harness's 430×900 viewport (its board coordinates).
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
const seedStock = Object.fromEntries(
  ["steak", "butter", "parsley", "garlic"].map((id) => [
    id,
    { ingredientId: id, quantity: 5, unitCost: 100, purchaseDay: 7 },
  ]),
);
await boot(
  page,
  seedSave({
    version: 2,
    credits: 50_000,
    business: {
      calendar: { businessDay: 7 },
      inventory: seedStock,
      menuActivation: {
        inactiveDishIds: ALL_DISH_IDS.filter((id) => id !== "biz-ribeye-herb-butter"),
      },
      supplies: {
        stock: {
          "microwave-containers": { units: 10, costBasis: 121 },
          "paper-bags": { units: 4, costBasis: 48 },
        },
        lifetime: {
          culinary: { spent: 0, retailValue: 0, purchases: 0, unitsUsed: 0, usedCost: 0 },
          service: { spent: 0, retailValue: 0, purchases: 0, unitsUsed: 0, usedCost: 0 },
          packaging: { spent: 169, retailValue: 260, purchases: 2, unitsUsed: 0, usedCost: 0 },
        },
      },
    },
  }),
);
await clickButton(page, /Business$/);
await sleep(600);
await clickButton(page, /Open Restaurant →|Go to Service →/);
await sleep(600);
await clickButton(page, /Open the Counter/);
await sleep(800);
const ordered = /Ribeye with Herb Butter/.test(await text(page));
await clickButton(page, /Start Preparing/);
await sleep(1500);
const cooked = await playToReport(page, { maxMs: 120000 });
await clickButton(page, /^Continue$/);
await sleep(900);
const beforeServe = await readSave(page);
await clickButton(page, /^Serve to /);
await sleep(900);
const served = await readSave(page);
const newServeEntries = served.economyLedger.slice(beforeServe.economyLedger.length);
const sup = served.business.supplies;
// Expected packaging cost: one container's and one bag's share of what was paid.
const packagingCost = Math.round(121 / 10) + Math.round(48 / 4);
const cogsDelta = served.business.finance.lifetimeCogs - beforeServe.business.finance.lifetimeCogs;
check(
  "7 a served order uses one container + one bag; their cost goes to COGS; still one ledger entry",
  ordered &&
    cooked.ok &&
    sup.stock["microwave-containers"]?.units === 9 &&
    sup.stock["paper-bags"]?.units === 3 &&
    sup.lifetime.packaging.unitsUsed === 2 &&
    sup.lifetime.packaging.usedCost === packagingCost &&
    cogsDelta >= packagingCost &&
    newServeEntries.length === 1 &&
    newServeEntries[0].category === "business-revenue",
  {
    ordered,
    cooked: cooked.ok,
    stock: sup.stock,
    used: sup.lifetime.packaging,
    cogsDelta,
    newServeEntries,
  },
);

check(
  "6 console has no errors",
  logs.filter((l) => /^error|pageerror/i.test(l)).length === 0,
  logs,
);
save("supplies-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? "\nSUPPLIES E2E: ALL PASS" : `\nSUPPLIES E2E: ${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
