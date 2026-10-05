// Unified Restaurant phase M — an existing save moves into the unified restaurant, in a real
// browser, on a RESTAURANT_MODE test build (VITE_RESTAURANT_MODE=1). The save is seeded the way
// an older build wrote it (no `restaurantMigration` stamp — NOT MOVED_IN_BUSINESS).
//   1. Level 60 (Indian Kitchen Service): the first load gives a one-time starter crate —
//      ingredients for the next services, place settings, napkins, a bottle of dish soap and of
//      cleaning liquid — at cost 0: credits and ledger unchanged, levels kept.
//   2. The Pre-Service Check welcomes the player ("Welcome to your restaurant") and the service's
//      ingredients and place settings are ready (only the staff remain to hire).
//   3. A reload gives no second crate.
//   4. Once a service starts the welcome is gone for good.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, clickButton, readSave, shot } from "./harness.mjs";

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
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: true },
  }),
);
const moved = await readSave(page);
const m = moved.business.restaurantMigration;
const units = (s, id) => s.business.supplies.stock[id]?.units ?? 0;
check(
  "1 the first load gives the starter crate at cost 0: credits and ledger unchanged, levels kept",
  m?.version === 1 &&
    m.atLevel === 60 &&
    m.seen === false &&
    m.kit.some((k) => k.kind === "ingredient") &&
    units(moved, "dinner-plates") >= 1 &&
    units(moved, "paper-napkins") === 100 &&
    units(moved, "dish-soap") === 1 &&
    units(moved, "cleaning-liquid") === 1 &&
    moved.credits === 50_000 &&
    moved.economyLedger.length === 0 &&
    moved.levelProgress.completedLevelIds.length === 59,
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
  "2 the check says 'Welcome to your restaurant' with the crate; the service's stock and place settings are ready",
  /Welcome to your restaurant/i.test(welcome ?? "") &&
    /Napkins|napkins/.test(welcome ?? "") &&
    ingredients.length > 0 &&
    ingredients.every((r) => r.status === "ok") &&
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
  await page.evaluate(() =>
    document.querySelector('[data-specialist="indian-chef"] button')?.click(),
  );
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
await clickButton(page, /^(OPEN THE RESTAURANT|START SERVICE)$/);
await sleep(1200);
const started = await page.evaluate(() =>
  /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
);
const afterStart = await readSave(page);
check(
  "4 once the service starts the welcome is marked seen and never shows again",
  started && afterStart.business.restaurantMigration.seen === true,
  { started, seen: afterStart.business.restaurantMigration.seen },
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
