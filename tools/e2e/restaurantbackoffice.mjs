// Unified Restaurant phase 7 — one back office, in a real browser, on a RESTAURANT_MODE test
// build (the default build — the restaurant is on unless VITE_RESTAURANT_MODE=0).
//   1. The Market has no supplier tab; Ingredients names the current supplier (Local Market) and
//      the tomato card shows the Local price; "Change supplier →" opens Restaurant → Suppliers.
//   2. Restaurant → Suppliers: the ingredient supplier sits above the contracts; choosing
//      Wholesale is free (no money, no ledger entry) and saves the choice.
//   3. Back in the Market the line says Wholesale −10% and the tomato card shows that price.
//   4. Business → Upgrades (developer 2026-10-15): the saved tier is Current, the earlier ones
//      Upgraded ✓; Equipment keeps the fridge, with no development card.
//   5. 320×568: Suppliers and Upgrades fit (no sideways scroll), their buttons ≥ 48 px tall.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  readSave,
  shot,
  openSection,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

// Test saves are version 1: credits are whole dollars there (×100 on load).
const saveAt = (n, dollars) =>
  seedSave({
    business: MOVED_IN_BUSINESS,
    credits: dollars,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: true },
  });
const clickIn = (scope, re) =>
  page.evaluate(
    (sel, src) => {
      const r = new RegExp(src);
      const b = [...document.querySelectorAll(`${sel} button`)].find((x) =>
        r.test(x.textContent.trim()),
      );
      b?.click();
      return !!b;
    },
    scope,
    re.source,
  );
// "Restaurant" / "Business": the back office, through the Restaurant map (openSection).
const nav = (label) =>
  ["Restaurant", "Business"].includes(label)
    ? openSection(page, "Business")
    : clickIn("nav", new RegExp(`^\\S*\\s*${label}`));
const marketView = () =>
  page.evaluate(() => ({
    tabs: [...document.querySelectorAll('nav[aria-label="Shop categories"] button')].map((b) =>
      b.textContent.trim(),
    ),
    supplier: document
      .querySelector('[data-testid="market-supplier"]')
      ?.innerText.replace(/\s+/g, " "),
    tomato: document
      .querySelector('article[data-ingredient="tomato"]')
      ?.innerText.replace(/\s+/g, " "),
  }));
async function openMarketIngredients() {
  await nav("Market");
  await sleep(700);
  await clickIn('nav[aria-label="Shop categories"]', /Ingredients/);
  await sleep(700);
}

// ---------- 1. The Market ----------
await boot(page, saveAt(30, 500));
await openMarketIngredients();
const m1 = await marketView();
check(
  "1 the Market has no supplier tab; Ingredients names Local Market; tomato at the Local price",
  m1.tabs.length > 0 &&
    !m1.tabs.some((t) => /Supplier/.test(t)) &&
    /Supplier: Local Market/.test(m1.supplier ?? "") &&
    /\$1\.00/.test(m1.tomato ?? ""),
  m1,
);
await clickIn('[data-testid="market-supplier"]', /^Change supplier/);
await sleep(900);
const onSuppliers = await page.evaluate(() => ({
  card: !!document.querySelector('[data-testid="ingredient-supplier"]'),
  contracts: /Sign contract|Active/.test(document.body.innerText),
}));
check(
  "1b Change supplier → opens Restaurant → Suppliers with the ingredient supplier",
  onSuppliers.card && onSuppliers.contracts,
  onSuppliers,
);

// ---------- 2. Choosing Wholesale ----------
const before = await readSave(page);
await clickIn('[data-supplier="wholesale-supplier"]', /^Choose$/);
await sleep(700);
const after = await readSave(page);
const current = await page.evaluate(() =>
  document.querySelector('[data-supplier="wholesale-supplier"]')?.innerText.replace(/\s+/g, " "),
);
await shot(page, "restaurant-suppliers");
check(
  "2 choosing Wholesale is free: saved, no money, no ledger entry",
  after.selectedSupplierId === "wholesale-supplier" &&
    after.credits === before.credits &&
    (after.economyLedger?.length ?? 0) === (before.economyLedger?.length ?? 0) &&
    /current/i.test(current ?? ""),
  {
    supplier: after.selectedSupplierId,
    credits: [before.credits, after.credits],
    ledger: [before.economyLedger?.length, after.economyLedger?.length],
    added: (after.economyLedger ?? []).slice(before.economyLedger?.length ?? 0),
    current,
  },
);

// ---------- 3. The Market follows ----------
await openMarketIngredients();
const m3 = await marketView();
check(
  "3 the Market says Wholesale −10% and the tomato card shows $0.90",
  /Wholesale Supplier/.test(m3.supplier ?? "") &&
    /−10%/.test(m3.supplier ?? "") &&
    /\$0\.90/.test(m3.tomato ?? ""),
  m3,
);

// ---------- 3b. Staff: two teams on one screen ----------
await nav("Restaurant");
await sleep(600);
await clickIn('nav[aria-label="Business sections"]', /Staff/);
await sleep(700);
const teams = await page.evaluate(() => {
  const k = document.querySelector('[data-testid="kitchen-team"]');
  const r = document.querySelector('[data-testid="restaurant-team"]');
  return {
    kitchen: !!k,
    restaurant: !!r,
    order: !!k && !!r && !!(k.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING),
    chefs: !!document.querySelector('[data-testid="specialist-chefs"]'),
  };
});
check(
  "3b Staff is one screen in two teams: Kitchen Upgrades, then Restaurant Team (with the specialist chefs)",
  teams.kitchen && teams.restaurant && teams.order && teams.chefs,
  teams,
);

// ---------- 4. Upgrades: restaurant development ----------
// The developer moved development from an Equipment card to Business → Upgrades (5db9451,
// 2026-10-15): the Kitchen Upgrade screen, embedded. Equipment keeps the fridge.
await nav("Restaurant");
await sleep(700);
await clickIn('nav[aria-label="Business sections"]', /Equipment/);
await sleep(700);
const equipment = await page.evaluate(() => ({
  fridge: /Your refrigerator/i.test(document.body.innerText),
  oldCard: !!document.querySelector('[data-testid="restaurant-development"]'),
}));
await shot(page, "restaurant-equipment");
await clickIn('nav[aria-label="Business sections"]', /Upgrades/);
await sleep(800);
// The seeded save keeps the kitchen tiers its level had earned (migrateKitchenDevelopment),
// so the expected tiles come from the saved tiers.
const tiers = [
  "humble-kitchen",
  "growing-kitchen",
  "established-kitchen",
  "neighborhood-cafe",
  "flourishing-cafe",
  "grand-kitchen",
];
const names = [
  "Humble Kitchen",
  "Growing Kitchen",
  "Established Kitchen",
  "Neighborhood Café",
  "Flourishing Café",
  "Grand Kitchen",
];
const owned = ((await readSave(page)).ownedKitchenUpgradeIds ?? []).filter((id) => id !== tiers[0]);
const builtExpected = owned.length;
const currentExpected = names[builtExpected];
const tiles = await page.evaluate((list) => {
  const out = {};
  for (const b of document.querySelectorAll("button")) {
    const t = b.innerText.replace(/\s+/g, " ").trim();
    const name = list.find((n) => t.startsWith(n));
    if (name) out[name] = t.slice(name.length).trim().toLowerCase(); // badges are uppercase
  }
  return out;
}, names);
await shot(page, "restaurant-upgrades");
check(
  "4 Upgrades shows restaurant development: the saved tier is Current, the ones before it Upgraded ✓; Equipment keeps the fridge (no development card)",
  tiles[currentExpected] === "current" &&
    names.slice(0, builtExpected).every((n) => tiles[n] === "upgraded ✓") &&
    names.slice(builtExpected + 1).every((n) => tiles[n] && !/current|upgraded/.test(tiles[n])) &&
    equipment.fridge &&
    !equipment.oldCard,
  { tiles, builtExpected, currentExpected, equipment },
);

// ---------- 5. 320 px ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await sleep(500);
const fit = [];
for (const tab of ["Suppliers", "Upgrades"]) {
  await nav("Restaurant");
  await sleep(600);
  await clickIn('nav[aria-label="Business sections"]', new RegExp(tab));
  await sleep(600);
  fit.push(
    await page.evaluate((tab) => {
      // The tab's own content: the ingredient supplier card, or the upgrade screen's buttons.
      const scope =
        tab === "Suppliers"
          ? document.querySelector('[data-testid="ingredient-supplier"]')
          : (document.querySelector("main") ?? document.body);
      const buttons = [...(scope?.querySelectorAll("button") ?? [])].filter(
        (b) => !b.closest("nav"),
      );
      const small = buttons
        .map((b) => b.getBoundingClientRect().height)
        .filter((h) => h > 0 && h < 47.5); // sub-pixel rounding, as restaurantwidths.mjs
      return {
        tab,
        found: !!scope,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        wider: buttons.some((b) => b.getBoundingClientRect().right > window.innerWidth + 0.5),
        small,
      };
    }, tab),
  );
}
check(
  "5 at 320×568 Suppliers and Upgrades fit (no sideways scroll) and their buttons are ≥ 48 px",
  fit.every((f) => f.found && f.pageOverflow <= 0 && !f.wider && f.small.length === 0),
  fit,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("6 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `RESTAURANT BACK OFFICE E2E: ${failed.length} FAILURE(S)`
    : "RESTAURANT BACK OFFICE E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
