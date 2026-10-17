// Shift chores (a real restaurant's day, developer 2026-10-11), restaurant build:
//   1. Between services (Level 41, Lunch done): Prepare opens the check with "Between services"
//      — sanitizer bucket, sweep the line, refresh the restroom; there is no "Do all" (developer
//      2026-10-17); each Do it does one (supplies once, no money) and the list is gone.
//   2. Closing Time lists the closing chores with Do it; one done leaves; Close for the night
//      brings the next morning's opening chores (stations, restroom check, lay the tables), and
//      the opening card shows them.
//   3. 320 px: the checklist fits, buttons ≥ 48 px.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  readSave,
  clickButton,
  shot,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const STOCK = {
  ...MOVED_IN_BUSINESS.supplies.stock,
  "mop-bucket": { units: 1, costBasis: 0 },
  brooms: { units: 1, costBasis: 0 },
  "toilet-brushes": { units: 1, costBasis: 0 },
  "floor-cleaner": { units: 2, costBasis: 2000 },
  disinfectant: { units: 4, costBasis: 1200 },
  "paper-towels": { units: 1000, costBasis: 700 },
  "sponges-cloths": { units: 4, costBasis: 400 },
  "cleaning-liquid": { units: 2, costBasis: 3000 },
};
const cleanliness = (tasks, keys) => ({
  tasks: tasks.map((kind) => ({ kind, count: 1, since: 40 })),
  open: {},
  counters: { sink: 0, paper: 0 },
  cleanerAreas: ["kitchen", "dining", "restroom"],
  introSeen: true,
  cupboardAt: 10,
  lastStart: null,
  cleaned: 0,
  byCleaner: 0,
  choreKeys: keys,
});
const saveAt = (n, restaurantDay, tasks, keys) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      supplies: { stock: STOCK },
      restaurantDay,
      cleanliness: cleanliness(tasks, keys),
    },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });
const chores = (phase) =>
  page.evaluate(
    (phase) =>
      [...document.querySelectorAll(`[data-testid="shift-chores-${phase}"] [data-chore-task]`)].map(
        (x) => x.getAttribute("data-chore-task"),
      ),
    phase,
  );
async function prepare() {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(600);
  await clickButton(page, /^Prepare$/);
  await sleep(1200);
}

// ---------- 1. The lull ----------
const lullDay = {
  day: 15,
  opened: true,
  servicesDone: 1,
  servicesPlanned: 3,
  closingDue: false,
  openingCredits: 1000,
  openingLevel: 40,
};
await boot(
  page,
  saveAt(41, lullDay, ["sanitizer-bucket", "sweep-line", "restroom-refresh"], ["15:lull:1"]),
);
await prepare();
const l1 = await chores("lull");
await shot(page, "shift-lull");
const before1 = await readSave(page);
const noDoAll = await page.evaluate(
  () =>
    ![...document.querySelectorAll('[data-testid="shift-chores-lull"] button')].some((b) =>
      /^Do all/.test(b.textContent.trim()),
    ),
);
for (let i = 0; i < 3; i++) {
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="shift-chores-lull"] [data-chore-task] button')]
      .find((b) => /^Do it/.test(b.textContent.trim()))
      ?.click(),
  );
  await sleep(500);
}
const l1b = await chores("lull");
const after1 = await readSave(page);
check(
  "1 between services: the check lists the lull's chores, no Do all; Do it does each (supplies once, no money) and the list is gone",
  noDoAll &&
    l1.sort().join() === "restroom-refresh,sanitizer-bucket,sweep-line" &&
    l1b.length === 0 &&
    after1.business.cleanliness.tasks.length === 0 &&
    after1.credits === before1.credits &&
    after1.economyLedger.length === before1.economyLedger.length &&
    after1.business.supplies.stock.disinfectant.units === 3,
  { noDoAll, l1, l1b, tasks: after1.business.cleanliness.tasks },
);

// ---------- 2. Closing → the next morning ----------
const closingDay = { ...lullDay, servicesDone: 3, closingDue: true };
await boot(
  page,
  saveAt(
    43,
    closingDay,
    ["degrease", "mop-all", "restroom-disinfect", "condiments", "polish-cutlery"],
    ["15:closing:3"],
  ),
);
await page.evaluate(() =>
  [...document.querySelectorAll("nav button")]
    .find((x) => x.textContent.includes("Kitchen"))
    ?.click(),
);
await sleep(900);
const c2 = await chores("closing");
await shot(page, "shift-closing");
await page.evaluate(() =>
  [...document.querySelectorAll('[data-chore-task="degrease"] button')]
    .find((b) => /Do it/.test(b.textContent))
    ?.click(),
);
await sleep(500);
const c2b = await chores("closing");
await clickButton(page, /^Close for the night/);
await sleep(900);
const after2 = await readSave(page);
await prepare();
const o2 = await chores("opening");
await shot(page, "shift-opening");
check(
  "2 Closing Time lists the closing chores; Do it removes one; closing brings the morning's opening chores to the opening card",
  c2.length === 5 &&
    c2b.length === 4 &&
    !c2b.includes("degrease") &&
    after2.business.restaurantDay.day === 16 &&
    after2.business.cleanliness.choreKeys.includes("16:opening:0") &&
    o2.sort().join() === "lay-tables,restroom-check,stations",
  { c2, c2b, o2, keys: after2.business.cleanliness.choreKeys },
);

// ---------- 3. 320 px ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(
  page,
  saveAt(41, lullDay, ["sanitizer-bucket", "sweep-line", "restroom-refresh"], ["15:lull:1"]),
);
await prepare();
const fit = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="shift-chores-lull"]');
  const buttons = el ? [...el.querySelectorAll("button")] : [];
  return {
    shown: !!el,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: buttons.filter((b) => b.getBoundingClientRect().height < 47.5).map((b) => b.textContent),
  };
});
check(
  "3 at 320 px the checklist fits, buttons ≥ 48 px",
  fit.shown && fit.overflow <= 0 && fit.small.length === 0,
  fit,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("4 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `SHIFT E2E: ${failed.length} FAILURE(S)` : "SHIFT E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
