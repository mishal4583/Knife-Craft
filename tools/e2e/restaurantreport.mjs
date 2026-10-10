// The restaurant's numbers (supplies plan D, developer 2026-10-10: "they should feel proud after
// successfully progressing their restaurant"), restaurant build, in a real browser:
//   1. Restaurant Progress shows "Your restaurant in numbers" from the save: services, guests,
//      takeaway orders, pieces packed and washed, spotless services, the streak and the best.
//   2. Read-only: opening it changes nothing in the save.
//   3. 320×568 and 768×1024: the card fits, no sideways scroll.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, readSave, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const SAVE = seedSave({
  business: {
    ...MOVED_IN_BUSINESS,
    restaurantSupplies: {
      soapPct: 50,
      cleanerPct: 50,
      washing: 0,
      dirty: {},
      washedTotal: 1234,
      brokenTotal: 9,
      coversTotal: 321,
      takeawayTotal: 45,
      packedTotal: 180,
    },
    restaurantRecord: {
      services: 120,
      spotless: 98,
      streak: 7,
      bestStreak: 15,
      at: { covers: 321, takeaway: 45, packed: 180, washed: 1234, broken: 9 },
      lastHygiene: { soap: true, cleaner: true, dirtyLeft: 0 },
    },
  },
  credits: 500000,
  levelProgress: {
    currentLevelId: "level-121",
    highestUnlockedLevelId: "level-121",
    completedLevelIds: Array.from({ length: 120 }, (_, i) => `level-${i + 1}`),
  },
  story: { introDone: true, milestoneMask: 127, finaleSeen: false },
});

async function openProgress() {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Progress"))
      ?.click(),
  );
  await sleep(900);
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="restaurant-numbers"]');
    return el
      ? {
          text: el.innerText.replace(/\s+/g, " "),
          numbers: Object.fromEntries(
            [...el.querySelectorAll("[data-number]")].map((x) => [
              x.getAttribute("data-number"),
              x.innerText.replace(/\s+/g, " "),
            ]),
          ),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      : null;
  });
}

await boot(page, SAVE);
const before = await readSave(page);
const c1 = await openProgress();
await page.evaluate(() =>
  document.querySelector('[data-testid="restaurant-numbers"]')?.scrollIntoView(),
);
await sleep(300);
await shot(page, "restaurant-numbers");
check(
  "1 Restaurant Progress shows the restaurant's numbers: services, guests, takeaway, packed, washed, spotless, streak and best",
  !!c1 &&
    /120/.test(c1.numbers["Services"] ?? "") &&
    /321/.test(c1.numbers["Guests at the tables"] ?? "") &&
    /45/.test(c1.numbers["Takeaway orders"] ?? "") &&
    /180/.test(c1.numbers["Pieces packed"] ?? "") &&
    /1,234/.test(c1.numbers["Pieces washed"] ?? "") &&
    /98/.test(c1.numbers["Spotless services"] ?? "") &&
    /Spotless streak: 7 · best 15 · 9 pieces broken/.test(c1.text),
  c1,
);
const after = await readSave(page);
check(
  "2 read-only: the save is unchanged",
  JSON.stringify(after.business.restaurantRecord) ===
    JSON.stringify(before.business.restaurantRecord) &&
    after.credits === before.credits &&
    after.economyLedger.length === before.economyLedger.length,
);
const fits = [];
for (const [w, h] of [
  [320, 568],
  [768, 1024],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, SAVE);
  const c = await openProgress();
  fits.push({ w, open: !!c, overflow: c?.overflow });
}
await shot(page, "restaurant-numbers-768");
check(
  "3 at 320×568 and 768×1024 the card fits, no sideways scroll",
  fits.every((f) => f.open && f.overflow <= 0),
  fits,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("4 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `RESTAURANT REPORT E2E: ${failed.length} FAILURE(S)`
    : "RESTAURANT REPORT E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
