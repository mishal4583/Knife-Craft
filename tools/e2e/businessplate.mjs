// Audit F1 (developer 2026-11-23): a Business-service plate (the Service Counter's real order, sessionMode "business-service") must reach the chef's record the moment
// it is finished, through the one save funnel. Before the fix `recordBusinessServiceResult` never saved, so the plate waited in `pendingRunRef` and rode along with whatever
// unrelated save came next (a later serve, a purchase, another day). Restaurant build, a finished campaign (the Endless Restaurant), a steak order cooked with the real solver at 430x900.
//   1. before the plate: the record holds the seeded 5 plates and 7 perfect cuts;
//   2. right after the plate is cooked (the report is up, NOTHING served yet) the saved record already counts exactly ONE more plate, with the plate's perfect cuts added;
//   3. serving the order afterwards (a different save write) changes the record by nothing: no double counting, no late attachment;
//   4. the plate's league points reach the saved league once (not twice);
//   5. the wallet and the ledger are untouched by the plate itself;
//   6. no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  launch,
  boot,
  seedSave,
  readSave,
  clickButton,
  sleep,
  text,
  openSection,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";
import { ALL_DISH_IDS } from "./businessDishes.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
const stock = Object.fromEntries(
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
    // The Business engine runs in the restaurant build only once the campaign is complete (the Endless Restaurant, endlessRestaurant.ts businessDayAllowed).
    levelProgress: {
      currentLevelId: "level-150",
      highestUnlockedLevelId: "level-150",
      completedLevelIds: Array.from({ length: 150 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    business: {
      calendar: { businessDay: 7 },
      inventory: stock,
      menuActivation: {
        inactiveDishIds: ALL_DISH_IDS.filter((id) => id !== "biz-ribeye-herb-butter"),
      },
      chefRecord: { plates: 5, perfectCuts: 7 },
    },
  }),
);
const before = await readSave(page);
const rec0 = before.business.chefRecord ?? {};
check(
  "1 the seeded record holds 5 plates and 7 perfect cuts",
  rec0.plates === 5 && rec0.perfectCuts === 7,
  rec0,
);

await openSection(page, "Service");
await sleep(600);
await clickButton(page, /Open the Counter/);
await sleep(800);
const ordered = /Ribeye with Herb Butter/.test(await text(page));
await clickButton(page, /Start Preparing/);
await sleep(1500);
const cooked = await playToReport(page, { maxMs: 120000 });
// The plate's result is credited when the Order Complete screen appears (the Continue after the Knife Report).
await clickButton(page, /^Continue$/);
await sleep(1500);
const afterPlate = await readSave(page);
const rec1 = afterPlate.business.chefRecord ?? {};
check(
  "2 right after the plate (the order is not served yet) the saved record counts exactly one more plate and its perfect cuts",
  ordered && cooked.ok && rec1.plates === 6 && rec1.perfectCuts >= 7,
  { ordered, cooked: cooked.ok, plates: rec1.plates, perfectCuts: rec1.perfectCuts },
);
check(
  "5 the plate itself moved no money and wrote no ledger entry",
  afterPlate.credits === before.credits &&
    afterPlate.economyLedger.length === before.economyLedger.length,
  {
    credits: [before.credits, afterPlate.credits],
    ledger: [before.economyLedger.length, afterPlate.economyLedger.length],
  },
);

const tapped = await clickButton(page, /^Serve to /);
await sleep(1200);
const stillThere = await page.evaluate(() =>
  [...document.querySelectorAll("button")].some((b) => /^Serve to /.test(b.textContent.trim())),
);
const served = await readSave(page);
const rec2 = served.business.chefRecord ?? {};
const same = (k) => JSON.stringify(rec2[k]) === JSON.stringify(rec1[k]);
check(
  "3 serving the order afterwards leaves the record as it was (no double counting, no late attachment)",
  rec2.plates === 6 &&
    rec2.perfectCuts === rec1.perfectCuts &&
    same("bestCombo") &&
    same("fastestMs") &&
    same("masterful"),
  { plates: rec2.plates, perfectCuts: [rec1.perfectCuts, rec2.perfectCuts] },
);
check(
  "3b the serve really happened (its button was tapped and is gone)",
  tapped !== false && !stillThere,
  { tapped, stillThere },
);
const lg1 = rec1.league?.points ?? 0;
const lg2 = rec2.league?.points ?? 0;
check(
  "4 the league points of the plate were written with the plate and not again by the serve",
  lg1 === lg2,
  { lg1, lg2 },
);

const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("6 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
