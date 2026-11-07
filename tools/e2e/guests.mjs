// Phase 8 (developer 2026-11-01), restaurant build, in a real browser: the Service Report and the guests.
//   G1 a service played to its end under Auto (Prep Cook hired, past the dine-in level) saves its star report
//      in business.restaurantDay.serviceResults (1..5 stars, the parts, covers) and the wallet still equals the
//      opening cash plus the signed ledger (the report moves no money).
//   G2 the closing card says "Service" with the stars.
//   G3 the Kitchen's Business → Pace card shows the guests of the next service.
//   G4 no console errors.
// (Seeds use the 150-level numbers: seed 32 is the game's Level 30, a first play.)
import fs from "node:fs";
import {
  launch,
  boot,
  seedSave,
  MOVED_IN_BUSINESS,
  sleep,
  readSave,
  text,
  openShortcut,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const ledgerSum = (s) => s.economyLedger.reduce((t, e) => t + e.amount, 0);

const ingredientIds = [
  ...fs
    .readFileSync(new URL("../../src/game/definitions.ts", import.meta.url), "utf8")
    .matchAll(/^\s{2}"?([a-z][a-z-]*)"?: \{\s*$/gm),
].map((m) => m[1]);
const FOOD = Object.fromEntries(
  [
    "bread",
    "tomato",
    "garlic",
    "basil",
    "mozzarella",
    "mushroom",
    "cucumber",
    "carrot",
    "potato",
    "onion",
    "spinach",
    "fennel",
    "lettuce",
    "pepper",
    "butter",
    "celery",
    "apple",
    "lemon",
    "parsley",
    ...ingredientIds,
  ].map((id) => [id, { ingredientId: id, quantity: 12, unitCost: 0, purchaseDay: 1 }]),
);
const SUPPLY_IDS = [
  ...fs
    .readFileSync(new URL("../../src/game/business/businessSupplies.ts", import.meta.url), "utf8")
    .split("export type SupplyId =")[1]
    .split(";")[0]
    .matchAll(/\|\s*"([a-z-]+)"/g),
].map((m) => m[1]);
const SUPPLIES = Object.fromEntries(SUPPLY_IDS.map((id) => [id, { units: 60, costBasis: 100 }]));

const save = seedSave({
  business: {
    ...MOVED_IN_BUSINESS,
    inventory: FOOD,
    supplies: { stock: SUPPLIES },
    restaurantStaff: { specialists: ["mexican-chef", "indian-chef"] }, // the Indian chapter opens at L31 in the 91-level campaign
    // The Server and the Cashier are required for a service (2026-11-03).
    staff: { hiredRoles: ["server", "cashier", "prep-cook"] },
  },
  credits: 5000,
  levelProgress: {
    currentLevelId: "level-32",
    highestUnlockedLevelId: "level-32",
    completedLevelIds: Array.from({ length: 31 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 4,
  },
  story: { introDone: true, milestoneMask: 127, finaleSeen: false },
});
save.settings = { ...save.settings, autoService: true };

try {
  await boot(page, save);
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  const open = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /^Open for service$/.test(x.textContent.trim()),
    );
    b?.click();
    return !!b;
  });
  await sleep(900);
  if (await page.evaluate(() => !!document.querySelector('[data-testid="pre-service-check"]'))) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/.test(
          x.textContent.trim(),
        ),
      );
      b?.click();
    });
    await sleep(800);
  }
  const start = await readSave(page);
  let done = null;
  let card = "";
  for (let i = 0; i < 120 && !done; i++) {
    await sleep(1500);
    const cur = await readSave(page);
    const results = cur.business?.restaurantDay?.serviceResults ?? [];
    card = await flat();
    if (results.length > 0) done = { cur, results };
  }
  check("G0 the service was reached", open);
  if (done) {
    const r = done.results.at(-1);
    check(
      "G1 the finished service saved its star report (1..5 stars, the parts, covers) and the wallet equals the opening cash plus the signed ledger",
      r.stars >= 1 &&
        r.stars <= 5 &&
        typeof r.covers === "number" &&
        done.cur.credits - start.credits === ledgerSum(done.cur) - ledgerSum(start),
      r,
    );
    await sleep(800);
    card = await flat();
    check(
      "G2 the closing card shows the Service stars",
      /Service [★☆]{5}/.test(card),
      card.slice(0, 160),
    );
  } else {
    check("G1 the finished service saved its star report", false, card.slice(0, 200));
    check("G2 the closing card shows the Service stars", false);
  }
  // The Pace card is on the Business overview: a restaurant past the menu and the first star report.
  const withResult = structuredClone(save);
  withResult.business.restaurantDay = {
    day: 8,
    opened: false,
    servicesDone: 0,
    servicesPlanned: 0,
    closingDue: false,
    openingCredits: null,
    openingLevel: null,
    serviceResults: [
      {
        level: 31,
        stars: 4,
        dishes: 1,
        waits: 1,
        clean: 1,
        covers: 6,
        walkedOut: 0,
        turnedAway: 1,
        avgWaitSec: 12,
      },
    ],
  };
  withResult.settings = { ...withResult.settings, autoService: false };
  await boot(page, withResult);
  await openShortcut(page, "business");
  await sleep(1200);
  const guests = await page.evaluate(() => ({
    row: document.querySelector('[data-testid="pace-guests"]')?.innerText ?? null,
    parts: document.querySelector('[data-testid="pace-guests-parts"]')?.innerText ?? null,
    stars: document.querySelector('[data-testid="pace-last-stars"]')?.innerText ?? null,
  }));
  check(
    "G3 the Pace card shows the next service's guests (with the parts that pull) and the last service's stars",
    !!guests.row &&
      /Guests next/.test(guests.row) &&
      /booked/.test(guests.parts ?? "") &&
      /★★★★☆/.test(guests.stars ?? ""),
    guests,
  );
  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("G4 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
