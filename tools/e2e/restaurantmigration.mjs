// Unified Restaurant phase M — an existing save moves into the unified restaurant, in a real
// browser, on a RESTAURANT_MODE build (the default — on unless VITE_RESTAURANT_MODE=0). The save is seeded the way
// an older build wrote it (no `restaurantMigration` stamp — NOT MOVED_IN_BUSINESS).
// It is a 250-level save (no campaign stamp): the game renumbers it — its Level 60 (Indian
// Kitchen Service) is Level 40 of the 150-level campaign, 39 levels kept.
//   1. The first load gives a one-time starter crate (migration v2, redesign 0b2ce52) — the next
//      services' kitchen tools, place settings, napkins, a bottle of dish soap and of cleaning
//      liquid; NO ingredients (they are bought in the Market from Level 3) — at cost 0: credits
//      and ledger unchanged, levels kept.
//   2. The Pre-Service Check welcomes the player ("Welcome to your restaurant", buy the food in
//      the Market); the place settings are ready, the ingredients wait to be bought.
//   3. A reload gives no second crate.
//   4. With the food bought (Market, one entry each) and the staff hired, the service starts and
//      the welcome is gone for good.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  shot,
  buyMissingTools,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

async function openLevel(title) {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  await clickButton(page, /^See all orders/);
  await sleep(700);
  await page.evaluate((name) => {
    const h = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === name);
    let n = h;
    for (let i = 0; i < 8 && n; i++) {
      n = n.parentElement;
      const b =
        n && [...n.querySelectorAll("button")].find((x) => /^Prepare$/.test(x.textContent.trim()));
      if (b) {
        b.click();
        return;
      }
    }
  }, title);
  await sleep(900);
}
const statuses = (attr) =>
  page.evaluate(
    (a) =>
      [...document.querySelectorAll(`[${a}]`)].map((r) => ({
        id: r.getAttribute(a),
        status: r.getAttribute("data-psc-status"),
      })),
    attr,
  );

// ---------- 1. The first load moves the save in ----------
// A version-1 save from before the restaurant: $500 (whole dollars → 50,000 cents on load).
await boot(
  page,
  seedSave({
    credits: 500,
    levelProgress: {
      currentLevelId: "level-60",
      highestUnlockedLevelId: "level-60",
      completedLevelIds: Array.from({ length: 59 }, (_, i) => `level-${i + 1}`),
      campaignVersion: undefined, // written before the 150-level campaign
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: true },
  }),
);
const moved = await readSave(page);
const m = moved.business.restaurantMigration;
const units = (s, id) => s.business.supplies.stock[id]?.units ?? 0;
check(
  "1 the first load gives the starter crate at cost 0: credits and ledger unchanged, levels kept",
  m?.version === 2 &&
    m.atLevel === 40 &&
    m.seen === false &&
    m.kit.length > 0 &&
    !m.kit.some((k) => k.kind === "ingredient") &&
    Object.keys(moved.business.inventory ?? {}).length === 0 &&
    units(moved, "dinner-plates") >= 1 &&
    units(moved, "paper-napkins") === 100 &&
    units(moved, "dish-soap") === 1 &&
    units(moved, "cleaning-liquid") === 1 &&
    moved.credits === 50_000 &&
    moved.economyLedger.filter((e) => e.id !== "seed-daily-gift").length === 0 &&
    moved.levelProgress.completedLevelIds.length === 39 &&
    moved.levelProgress.currentLevelId === "level-40",
  { kit: m?.kit, credits: moved.credits, ledger: moved.economyLedger.length },
);

// ---------- 2. The welcome ----------
await openLevel("Indian Kitchen Service");
const welcome = await page.evaluate(
  () =>
    document.querySelector('[data-testid="psc-welcome"]')?.innerText.replace(/\s+/g, " ") ?? null,
);
const ingredients = await statuses("data-psc-ingredient");
const supplies = await statuses("data-psc-supply");
await shot(page, "restaurant-migration-welcome");
check(
  "2 the check says 'Welcome to your restaurant' with the crate (food from the Market); the place settings are ready, the ingredients wait to be bought",
  /Welcome to your restaurant/i.test(welcome ?? "") &&
    /Market/.test(welcome ?? "") &&
    ingredients.length > 0 &&
    ingredients.every((r) => r.status === "missing") &&
    supplies.filter((r) => /dinner-/.test(r.id)).every((r) => r.status === "ok"),
  { welcome: welcome?.slice(0, 200), ingredients, supplies },
);

// ---------- 3. A reload gives no second crate ----------
await page.reload({ waitUntil: "networkidle0" });
await page.waitForFunction(() => document.querySelectorAll("button").length > 3, {
  timeout: 30000,
});
await sleep(800);
const again = await readSave(page);
check(
  "3 a reload gives no second crate (same stock, same stamp)",
  JSON.stringify(again.business.restaurantMigration.kit) === JSON.stringify(m.kit) &&
    units(again, "paper-napkins") === 100 &&
    JSON.stringify(again.business.inventory) === JSON.stringify(moved.business.inventory),
);

// ---------- 4. Starting a service: the welcome is gone ----------
await openLevel("Indian Kitchen Service");
const missing = (await statuses("data-psc-staff")).filter((r) => r.status === "missing");
if (missing.length) {
  await clickButton(page, /^Hire .* → Staff/);
  await sleep(900);
  // Every specialist this service needs (the Indian dishes, and the menu's Mexican ones from
  // Level 16). A row's first button is the chef's ⓘ (2026-10-17); click Hire by name.
  for (const id of ["indian-chef", "mexican-chef"]) {
    await page.evaluate(
      (x) =>
        [...document.querySelectorAll(`[data-specialist="${x}"] button`)]
          .find((b) => b.textContent.trim() === "Hire")
          ?.click(),
      id,
    );
    await sleep(300);
  }
  await sleep(300);
  for (const name of ["Prep Cook", "Server", "Line Cook"]) {
    await page.evaluate((n) => {
      const art = [...document.querySelectorAll("article")].find((a) =>
        [...a.querySelectorAll("p")].some((p) => p.textContent.trim() === n),
      );
      [...(art?.querySelectorAll("button") ?? [])]
        .find((b) => b.textContent.trim() === "Hire")
        ?.click();
    }, name);
    await sleep(300);
  }
  await page.evaluate(() => document.querySelector('[data-testid="psc-back"]')?.click());
  await sleep(900);
}
// Supplies plan A (2026-10-10): the cooks just hired need their own pans.
await buyMissingTools(page);
// The food: each missing row's Restock → the Market on that ingredient → Buy → back.
const toBuy = (await statuses("data-psc-ingredient"))
  .filter((r) => r.status === "missing")
  .map((r) => r.id);
const beforeFood = await readSave(page);
for (const id of toBuy) {
  await page.evaluate(
    (x) =>
      [...document.querySelectorAll(`[data-psc-ingredient="${x}"] button`)]
        .find((b) => /Restock/.test(b.textContent))
        ?.click(),
    id,
  );
  await sleep(800);
  await page.evaluate((x) => {
    const card = document.querySelector(`[data-ingredient="${x}"]`);
    [...(card?.querySelectorAll("button") ?? [])]
      .find((b) => /^Buy /.test(b.textContent.trim()))
      ?.click();
  }, id);
  await sleep(400);
  await page.evaluate(() => document.querySelector('[data-testid="psc-back"]')?.click());
  await sleep(700);
}
const afterFood = await readSave(page);
const foodEntries = afterFood.economyLedger
  .slice(beforeFood.economyLedger.length)
  .filter((e) => e.category === "inventory-purchase");
await clickButton(page, /^(OPEN THE RESTAURANT|START SERVICE)$/);
await sleep(1200);
const started = await page.evaluate(() =>
  /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
);
const afterStart = await readSave(page);
check(
  "4 with the food bought in the Market (one entry each) the service starts; the welcome is marked seen and never shows again",
  started &&
    afterStart.business.restaurantMigration.seen === true &&
    toBuy.length > 0 &&
    foodEntries.length === toBuy.length,
  {
    started,
    seen: afterStart.business.restaurantMigration.seen,
    toBuy,
    foodEntries: foodEntries.length,
  },
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("5 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `RESTAURANT MIGRATION E2E: ${failed.length} FAILURE(S)`
    : "RESTAURANT MIGRATION E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
