// THE LAST PAGE on the restaurant build (developer 2026-10-11, decision 1):
//   1. a restaurant save that finished Level 250 before THE LAST PAGE existed (it saw the old
//      banner) plays it once on load — even with Closing Time due, which waits behind it — its
//      flag saved first, no money or ledger change; BACK TO THE KITCHEN lands on the Kitchen and
//      only then does Closing Time show;
//   2. the next launch never plays it again;
//   3. it fits at 320 / 390 / 768 (screenshots).
// (Finishing the 250th level itself runs the same App path: tools/e2e/legacy.mjs, classic build.)
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  readSave,
  shot,
  text,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async (page) => (await text(page)).replace(/\s+/g, " ");
const BEAT1 = /Every recipe they ever wrote is in here/;
const OLD_SIX = 1 | 2 | 4 | 8 | 16 | 32;

const { browser, page, logs } = await launch();
const save250 = () =>
  seedSave({
    credits: 7000000,
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: {},
      restaurantDay: {
        day: 60,
        opened: true,
        servicesDone: 6,
        servicesPlanned: 6,
        closingDue: true,
        openingCredits: 7000000,
        openingLevel: 245,
      },
    },
    levelProgress: {
      currentLevelId: "level-250",
      highestUnlockedLevelId: "level-250",
      completedLevelIds: Array.from({ length: 250 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: OLD_SIX | 64, finaleSeen: true },
  });

// ---------- 1. On load, once, Closing Time held behind it ----------
await boot(page, save250());
await page
  .waitForFunction(
    (src) => new RegExp(src).test(document.body.innerText),
    { timeout: 8000 },
    BEAT1.source,
  )
  .catch(() => undefined);
const s1 = await readSave(page);
const t1 = await flat(page);
// The sheet's heading (developer 2026-10-23: the button reads "N chores left" until the player closes up).
const closingDuring = await page.evaluate(() => /Time to close up/i.test(document.body.innerText));
await shot(page, "restaurant-legacy-first-beat");
// Through the beats to the button.
await page
  .waitForFunction(() => /BACK TO THE KITCHEN/i.test(document.body.innerText), { timeout: 20000 })
  .catch(() => undefined);
const s2 = await readSave(page);
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find((b) => /BACK TO THE KITCHEN/i.test(b.textContent))
    ?.click(),
);
await sleep(1500);
const after = await flat(page);
check(
  "1 a finished restaurant save plays THE LAST PAGE once on load (flag saved first, no money change); Closing Time waits behind it and shows after",
  BEAT1.test(t1) &&
    (s1.story.milestoneMask & 2048) !== 0 &&
    !closingDuring &&
    s2.credits === s1.credits &&
    s2.economyLedger.length === s1.economyLedger.length &&
    !BEAT1.test(after) &&
    /Time to close up/i.test(after),
  { flagged: (s1.story.milestoneMask & 2048) !== 0, closingDuring, after: after.slice(0, 140) },
);

// ---------- 2. The next launch ----------
await page.reload({ waitUntil: "networkidle0" });
await sleep(4000);
const t3 = await flat(page);
check("2 the next launch never plays it again", !BEAT1.test(t3) && !/THE LAST PAGE/i.test(t3));

// ---------- 3. Widths ----------
const fits = {};
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [768, 1024],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, save250());
  await page
    .waitForFunction(
      (src) => new RegExp(src).test(document.body.innerText),
      { timeout: 8000 },
      BEAT1.source,
    )
    .catch(() => undefined);
  await sleep(1200);
  await shot(page, `restaurant-legacy-${w}`);
  fits[w] = await page.evaluate(() => ({
    shown: /Every recipe they ever wrote/.test(document.body.innerText),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
}
check(
  "3 fits at 320 / 390 / 768",
  Object.values(fits).every((f) => f.shown && f.overflow <= 0),
  fits,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("4 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `RESTAURANT LEGACY E2E: ${failed.length} FAILURE(S)`
    : "RESTAURANT LEGACY E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
