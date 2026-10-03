// The Inventory section (bottom bar → Inventory) in the built game:
//   1. the bottom bar has 5 sections in order — Kitchen · Market · Inventory · Business ·
//      Progress — and Inventory opens straight from it; Business has no Inventory tab;
//   2. the screen shows the save as it is: header, wallet, "Fridge: Commercial · N / 80 units",
//      Total Stock / Running Low / Expiring Soon / Ready to Cook cards, the physical fridge;
//   3. Needs Attention: the expired cheddar, the basil spoiling tonight and the low tomato appear,
//      most urgent first; the healthy potato and apple do not;
//   4. All Inventory: every stocked item once, needs-attention first; Sort by Name reorders;
//      a filter shows one group;
//   5. tapping a stock card opens its details (in stock, freshness, days, average cost, value,
//      today's requirement, after today's service, used by) above the bottom bar;
//   6. Restock → Market → Ingredients on that ingredient; Upgrade Refrigerator → Business →
//      Equipment; View Business Performance → Business → Overview — none of them moves money,
//      stock or the fridge;
//   7. visiting Inventory changes nothing in the save;
//   8. at 320×568 · 360×640 · 375×642 · 390×844 · 430×932 · 768×1024 · 1024×1366: no horizontal
//      page scroll, the 5 bottom-bar buttons fit and are ≥ 48 px tall, the page scrolls and its
//      last control clears the bottom bar; no console errors.
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

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const DAY = 7;
const entry = (id, quantity, purchaseDay = DAY, unitCost = 100) => [
  id,
  { ingredientId: id, quantity, unitCost, purchaseDay },
];
const STOCK = Object.fromEntries([
  entry("cheddar", 2, DAY - 4, 450), // Dairy, 4-day shelf life → expired
  entry("basil", 1, DAY - 2, 300), // Herb, 3 days → spoils tonight
  entry("chicken", 1, DAY - 1, 450), // Protein, 3 days → 2 left: expiring (or low)
  entry("tomato", 0.25, DAY), // below today's menu need
  entry("potato", 30, DAY, 60), // plenty, fresh
  entry("apple", 4, DAY, 120), // fresh
]);
const inventorySave = () =>
  seedSave({
    version: 2,
    credits: 250_000,
    business: {
      calendar: { businessDay: DAY },
      inventory: STOCK,
      refrigerator: { refrigeratorId: "commercial-refrigerator" },
    },
  });

const { browser, page, logs } = await launch();
await page.setViewport({ width: 375, height: 642, deviceScaleFactor: 1, hasTouch: true });
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const openInventory = async () => {
  await clickButton(page, /Inventory$/);
  await sleep(800);
};
const essentials = (s) =>
  JSON.stringify({
    credits: s.credits,
    ledger: s.economyLedger.length,
    inventory: s.business.inventory,
    fridge: s.business.refrigerator,
    condition: s.business.equipmentCondition,
    calendar: s.business.calendar,
    popularity: s.business.popularity,
    menu: s.business.menuActivation,
  });

// ---------- 1. Navigation ----------
await boot(page, inventorySave());
const nav = await page.evaluate(() =>
  [...document.querySelectorAll("nav.absolute button")].map((b) =>
    b.innerText.replace(/\s+/g, " ").trim(),
  ),
);
check(
  "1a the bottom bar: Kitchen · Market · Inventory · Business · Progress",
  nav.map((n) => n.replace(/^\S+\s/, "")).join() === "Kitchen,Market,Inventory,Business,Progress",
  nav,
);
const before = await readSave(page);
await openInventory();
check(
  "1b Inventory opens straight from the bottom bar",
  !!(await page.$('[data-testid="inventory"]')) &&
    /Manage your restaurant stock/.test(await flat()),
);
await clickButton(page, /Business$/);
await sleep(700);
const bizTabs = await page.evaluate(() =>
  [...document.querySelectorAll('nav[aria-label="Business sections"] button')].map((b) =>
    b.innerText.replace(/\s+/g, " ").replace(/\d+$/, "").trim(),
  ),
);
check(
  "1c Business: Overview · Equipment · Staff · Suppliers · Menu · Operations (no Inventory or Supplies)",
  bizTabs.map((t) => t.replace(/^\S+\s/, "")).join() ===
    "Overview,Equipment,Staff,Suppliers,Menu,Operations",
  bizTabs,
);

// ---------- 2. The screen ----------
await openInventory();
let t = await flat();
const pill = await page.evaluate(
  () =>
    document
      .querySelector('[data-testid="inventory-fridge-pill"]')
      ?.innerText.replace(/\s+/g, " ") ?? "",
);
const used = Object.values(STOCK).reduce((n, e) => n + e.quantity, 0);
const card = (id) =>
  page.evaluate(
    (id) => document.querySelector(`[data-testid="${id}"]`)?.innerText.replace(/\s+/g, " ") ?? "",
    id,
  );
check(
  "2a header, wallet and the save's fridge: Fridge: Commercial · 38.25 / 80 units",
  /Inventory/.test(t) &&
    /\$2,500\.00/.test(t) &&
    /Fridge: Commercial/.test(pill) &&
    pill.includes(`${used} / 80 units`),
  { pill },
);
const stockCard = await card("summary-stock");
const lowCard = await card("summary-low");
const expCard = await card("summary-expiring");
const readyCard = await card("summary-ready");
const value = Object.values(STOCK).reduce((n, e) => n + Math.round(e.quantity * e.unitCost), 0);
check(
  "2b summary cards: Total Stock (units + value), Running Low, Expiring Soon, Ready to Cook (x / 48)",
  stockCard.includes(`${used} / 80 units`) &&
    stockCard.includes(`$${(value / 100).toFixed(2)} stock value`) &&
    /Running Low \d+ items?/.test(lowCard) &&
    /Expiring Soon [1-9]\d* items?/.test(expCard) &&
    /Ready to Cook \d+ \/ 48 dishes/.test(readyCard),
  { stockCard, lowCard, expCard, readyCard },
);
check(
  "2c the physical fridge shows the Commercial model",
  (await page.evaluate(() =>
    document.querySelector('[data-testid="physical-fridge"]')?.getAttribute("data-tier"),
  )) === "commercial-refrigerator",
);
await shot(page, "inventory-1-top-375x642");

// ---------- 3. Needs Attention ----------
const groups = await page.evaluate(() =>
  [...document.querySelectorAll("[data-attention-group]")].map((g) => ({
    id: g.getAttribute("data-attention-group"),
    items: [...g.querySelectorAll("[data-attention-item]")].map((r) =>
      r.getAttribute("data-attention-item"),
    ),
  })),
);
const groupOf = (id) => groups.find((g) => g.items.includes(id))?.id;
check(
  "3a expired cheddar, spoiling-tonight basil and low tomato appear, most urgent first",
  groupOf("cheddar") === "expired" &&
    groupOf("basil") === "spoils_today" &&
    ["critical", "low"].includes(groupOf("tomato")) &&
    groups[0]?.id === "expired" &&
    groups[1]?.id === "spoils_today",
  groups,
);
check(
  "3b healthy stock (potato, apple) is not listed as urgent",
  !groupOf("potato") && !groupOf("apple"),
);
const expiredRow = await page.evaluate(
  () =>
    document.querySelector('[data-attention-item="cheddar"]')?.innerText.replace(/\s+/g, " ") ?? "",
);
check(
  "3c each row says what's wrong in words and offers Restock",
  /EXPIRED/i.test(expiredRow) && /0 lb usable/.test(expiredRow) && /Restock →/.test(expiredRow),
  expiredRow,
);
await page.evaluate(() =>
  document.querySelector('[data-testid="inventory-attention"]').scrollIntoView({ block: "start" }),
);
await shot(page, "inventory-2-attention");

// ---------- 4. All Inventory ----------
const listIds = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-inventory-item]")].map((a) =>
      a.getAttribute("data-inventory-item"),
    ),
  );
let ids = await listIds();
check(
  "4a every stocked item once, needs-attention first, healthy stock last",
  ids.length === Object.keys(STOCK).length &&
    new Set(ids).size === ids.length &&
    ids[0] === "cheddar" &&
    ids.slice(-2).sort().join() === "apple,potato",
  ids,
);
await page.select("#inventory-sort", "name");
await sleep(300);
ids = await listIds();
check(
  "4b Sort by Name reorders (by display name)",
  ids.join() === "apple,basil,cheddar,chicken,potato,tomato",
  ids,
); // Cheddar < Chicken Breast
await page.select("#inventory-sort", "status");
await clickButton(page, /^Protein \d+$/);
await sleep(300);
ids = await listIds();
check("4c the Protein filter shows only chicken", ids.join() === "chicken", ids);
await clickButton(page, /^All \d+$/);
await sleep(300);
await page.evaluate(() =>
  document.querySelector('[data-testid="inventory-all"]').scrollIntoView({ block: "start" }),
);
await shot(page, "inventory-3-all");

// ---------- 5. Details ----------
await page.evaluate(() => {
  const card = document.querySelector('[data-inventory-item="tomato"]');
  card.scrollIntoView({ block: "center" });
  card.querySelector("button").click();
});
await sleep(500);
const detail = await page.evaluate(() => {
  const d = document.querySelector('[data-testid="inventory-detail"]');
  const r = d?.getBoundingClientRect();
  const nav = document.querySelector("nav.absolute").getBoundingClientRect();
  return {
    text: d?.innerText.replace(/\s+/g, " ") ?? "",
    above: !!r && r.bottom <= nav.top + 1 && r.top >= 0,
  };
});
check(
  "5 a stock card opens its details above the bottom bar: in stock, freshness, days, cost, value, today's requirement, after service, used by",
  /In stock 0\.25 lb/.test(detail.text) &&
    /Freshness Fresh/.test(detail.text) &&
    /Days remaining \d+ days left/.test(detail.text) &&
    /Average cost \$1\.00 \/ lb/.test(detail.text) &&
    /Stock value \$0\.25/.test(detail.text) &&
    /Today's requirement ≈ [\d.]+ lb/.test(detail.text) &&
    /After today's service ≈ 0 lb/.test(detail.text) &&
    /Used by/i.test(detail.text) &&
    detail.above,
  detail,
);
await shot(page, "inventory-4-detail");

// ---------- 6. Navigation out (nothing bought) ----------
const s0 = await readSave(page);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="inventory-detail"] button')]
    .find((b) => /Restock in Market/.test(b.textContent))
    ?.click(),
);
await sleep(900);
const focused = await page.evaluate(
  () =>
    document.querySelector("article.product-card.ring-2")?.getAttribute("data-ingredient") ?? null,
);
const s1 = await readSave(page);
check(
  "6a Restock opens Market → Ingredients on the tomato and changes nothing",
  /Fresh Ingredients/.test(await flat()) &&
    focused === "tomato" &&
    essentials(s1) === essentials(s0),
  { focused },
);
await openInventory();
await clickButton(page, /^Upgrade Refrigerator →$/);
await sleep(800);
t = await flat();
const s2 = await readSave(page);
check(
  "6b Upgrade Refrigerator opens Business → Equipment and buys nothing",
  /Refrigerators/.test(t) &&
    /Professional Refrigerator/.test(t) &&
    essentials(s2) === essentials(s0),
);
await openInventory();
await clickButton(page, /^View Business Performance →$/);
await sleep(800);
t = await flat();
check(
  "6c View Business Performance opens Business → Overview",
  /Restaurant health/i.test(t) && /Today at a glance/i.test(t),
);

// ---------- 6d. Supplies: every other kind of stock ----------
await openInventory();
await page.evaluate(() => document.querySelector('[data-inventory-kind="supplies"]').click());
await sleep(500);
const rows = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-supply-row]")].map((r) =>
      r.getAttribute("data-supply-row"),
    ),
  );
const smallwares = await rows();
const supSummary = await page.evaluate(
  () =>
    document.querySelector('[data-testid="supplies-summary"]')?.innerText.replace(/\s+/g, " ") ??
    "",
);
await clickButton(page, /TablewareFront of house$/);
await sleep(300);
const tableware = await rows();
await clickButton(page, /TakeawayPackaging$/);
await sleep(300);
const takeaway = await rows();
const supAttention = await page.evaluate(() =>
  [...document.querySelectorAll("[data-supply-attention]")].map((r) =>
    r.getAttribute("data-supply-attention"),
  ),
);
const supButtons = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="inventory-supplies"] button')].map((b) =>
    b.textContent.trim(),
  ),
);
check(
  "6d Inventory → Supplies: 18 smallwares, 17 tableware incl. cutlery, 15 takeaway parcels; summary cards; one packaging alert (not 15); nothing to buy",
  smallwares.length === 18 &&
    tableware.length === 17 &&
    tableware.includes("dinner-forks") &&
    takeaway.length === 15 &&
    /Supplies on hand/.test(supSummary) &&
    /Takeaway orders covered/.test(supSummary) &&
    !supButtons.some((t) => /^Buy|^[−+]$/.test(t)) &&
    supAttention.join() === "packaging-coverage",
  {
    smallwares: smallwares.length,
    tableware: tableware.length,
    takeaway: takeaway.length,
    supSummary,
  },
);
await shot(page, "inventory-6-supplies");
// Restock on the packaging alert jumps to that exact line in the Market (like ingredients).
await page.evaluate(() =>
  [...document.querySelectorAll('[data-supply-attention="packaging-coverage"] button')]
    .find((b) => /Restock/.test(b.textContent))
    ?.click(),
);
await sleep(900);
const supplyFocus = await page.evaluate(() => {
  const a = document.querySelector("article.product-card.ring-2[data-supply]");
  const r = a?.getBoundingClientRect();
  return a
    ? { id: a.getAttribute("data-supply"), visible: r.top >= 0 && r.bottom <= innerHeight }
    : null;
});
check(
  "6e Restock on a supply opens the Market on that exact line, in view",
  supplyFocus?.id === "microwave-containers" && supplyFocus.visible,
  supplyFocus,
);
await openInventory();
await page.evaluate(() => document.querySelector('[data-inventory-kind="ingredients"]').click());
await sleep(300);

// ---------- 7. The save is untouched ----------
const after = await readSave(page);
check("7 visiting Inventory changes nothing in the save", essentials(after) === essentials(before));

// ---------- 7b. Throw Out Expired ----------
await openInventory();
const tBefore = await readSave(page);
const firstTap = await page.evaluate(() => {
  const box = document.querySelector('[data-testid="throw-out-expired"]');
  box?.querySelector("button")?.click();
  return box?.innerText.replace(/\s+/g, " ") ?? "";
});
await sleep(300);
const confirmText = await page.evaluate(
  () =>
    document.querySelector('[data-testid="throw-out-expired"]')?.innerText.replace(/\s+/g, " ") ??
    "",
);
const unchangedAfterFirstTap = essentials(await readSave(page)) === essentials(tBefore);
await clickButton(page, /^Yes, throw out$/);
await sleep(600);
const tAfter = await readSave(page);
const stillListed = await page.evaluate(
  () => !!document.querySelector('[data-inventory-item="cheddar"]'),
);
check(
  "7b Throw Out Expired asks first, then removes only the expired cheddar: no money or ledger change, waste recorded",
  /Throw Out Expired \(1\)/.test(firstTap) &&
    /can't be undone/.test(confirmText) &&
    unchangedAfterFirstTap &&
    !tAfter.business.inventory.cheddar &&
    !!tAfter.business.inventory.basil &&
    !!tAfter.business.inventory.potato &&
    tAfter.credits === tBefore.credits &&
    tAfter.economyLedger.length === tBefore.economyLedger.length &&
    tAfter.business.spoilage.totalSpoiledValue > tBefore.business.spoilage.totalSpoiledValue &&
    tAfter.business.finance.dailyAccumulator.discardedQuantity === 2 &&
    !stillListed,
  { firstTap, confirmText, spoilage: tAfter.business.spoilage },
);

// ---------- 8. Sizes ----------
const sizes = [
  [320, 568],
  [360, 640],
  [375, 642],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 1366],
];
const perSize = {};
await openInventory();
for (const [w, h] of sizes) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true });
  await sleep(500);
  const m = await page.evaluate(async () => {
    const scroller = document.querySelector('[data-testid="inventory"]');
    const nav = document.querySelector("nav.absolute");
    const navR = nav.getBoundingClientRect();
    const buttons = [...nav.querySelectorAll("button")].map((b) => b.getBoundingClientRect());
    const top0 = scroller.scrollTop;
    scroller.scrollTop = scroller.scrollHeight;
    await new Promise((r) => setTimeout(r, 150));
    const lastBtn = [...scroller.querySelectorAll("button")].at(-1).getBoundingClientRect();
    const scrolled = scroller.scrollTop > top0;
    scroller.scrollTop = 0;
    const shell = scroller.getBoundingClientRect();
    return {
      hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      navButtons: buttons.length,
      navFits: buttons.every((b) => b.left >= shell.left - 1 && b.right <= shell.right + 1),
      navTall: buttons.every((b) => b.height >= 47.5),
      scrolls: scrolled,
      lastClear: lastBtn.bottom <= navR.top + 1,
      tooSmall: [...scroller.querySelectorAll("button, select")].filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && Math.min(r.height, r.width) < 40 && !b.closest(".kcf-unit");
      }).length,
    };
  });
  perSize[`${w}x${h}`] = m;
  await shot(page, `inventory-5-${w}x${h}`);
}
check(
  "8a every size: no horizontal scroll; 5 bottom-bar buttons fit, ≥ 48 px tall; the page scrolls and its last button clears the bar",
  Object.values(perSize).every(
    (m) => !m.hScroll && m.navButtons === 5 && m.navFits && m.navTall && m.scrolls && m.lastClear,
  ),
  perSize,
);
check(
  "8b no tiny controls on the Inventory screen",
  Object.values(perSize).every((m) => m.tooSmall === 0),
  Object.fromEntries(Object.entries(perSize).map(([k, m]) => [k, m.tooSmall])),
);
check(
  "8c console has no errors",
  logs.filter((l) => /^error|pageerror/i.test(l)).length === 0,
  logs,
);

save("inventory-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? "\nINVENTORY E2E: ALL PASS" : `\nINVENTORY E2E: ${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
