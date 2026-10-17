// Cleanliness & Maintenance (developer 2026-10-10), restaurant build, in a real browser:
//   1. Level 25: Restaurant → Cleanliness opens with the guided intro (once); Kitchen, Dining
//      Area and Restroom cards show the seeded tasks (meter < 100, ! badges), the tab badge counts
//      them.
//   2. View (the area's tasks) → Clean a task: it leaves, its supplies are used once (no money, no ledger);
//      a second tap on the same task isn't possible (it's gone).
//   3. A task without its supplies shows "Buy …" → the exact Market card in the Cleaning section;
//      buying it updates the same stock the strip shows (one ledger entry).
//   4. No "Clean everything I can" (developer 2026-10-17): "Today · $X" hires a Cleaner for the
//      day — the routine tasks are cleaned, one Staff Payroll entry of the day wage, every area
//      Ready; the card then says the Cleaner is on today.
//   5. With a Cleaner hired, the area chips assign them; at Level 10 the Restaurant (and its
//      Cleanliness tab) is still closed; at Level 11 the tab is there (developer 2026-10-10: from L10).
//   6. Widths 320 / 360 / 390 / 1024: no sideways scroll, buttons ≥ 48 px.
//   9. "Free with an ad" (stubbed): a declined ad changes nothing; a finished one puts a Cleaner
//      on today with no money and no ledger entry (placement day_cleaner).
//   8. No practice / test / mock dishwashing panels (developer 2026-10-17); today's status
//      first (a chip per area), each area once, then the real wash-up (automatic, serviceSupplies).
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, readSave, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const STOCK = (extra = {}) => ({
  ...MOVED_IN_BUSINESS.supplies.stock,
  "mop-bucket": { units: 1, costBasis: 0 },
  brooms: { units: 1, costBasis: 0 },
  "toilet-brushes": { units: 1, costBasis: 0 },
  "floor-cleaner": { units: 1, costBasis: 1000 },
  "sponges-cloths": { units: 3, costBasis: 300 },
  "bin-liners": { units: 30, costBasis: 30 },
  ...extra,
});
const saveAt = (n, { tasks, stock, staff, introSeen = false } = {}) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      supplies: { stock: stock ?? STOCK() },
      ...(staff ? { staff: { hiredRoles: staff } } : {}),
      cleanliness: {
        tasks: tasks ?? [
          { kind: "equipment", count: 1, since: n - 1 },
          { kind: "bins", count: 1, since: n - 1 },
          { kind: "floor", count: 1, since: n - 1 },
          { kind: "toilet", count: 1, since: n - 1 },
          { kind: "restroom-floor", count: 1, since: n - 1 },
        ],
        open: {},
        counters: { sink: 0, paper: 0 },
        cleanerAreas: ["kitchen", "dining", "restroom"],
        introSeen,
        cupboardAt: 21,
        lastStart: null,
        cleaned: 0,
        byCleaner: 0,
      },
    },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      // The 150-level campaign's numbering (an unversioned save is renumbered from the old 250).
      campaignVersion: 2,
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });

// The Restaurant tab opens the map; its Manager / Office hotspot holds the section tabs.
async function openCleanliness() {
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector(".map-hotspot-zone", { timeout: 15000 }).catch(() => null);
  await sleep(600);
  await page.evaluate(() =>
    [...document.querySelectorAll(".map-hotspot-zone")]
      .find((e) => /Manager \/ Office/.test(e.getAttribute("aria-label") ?? ""))
      ?.click(),
  );
  await page
    .waitForSelector('nav[aria-label="Business sections"]', { timeout: 4000 })
    .catch(() => null);
  await sleep(400);
  const tab = await page.evaluate(() => {
    const b = [...document.querySelectorAll('nav[aria-label="Business sections"] button')].find(
      (x) => x.textContent.includes("Cleanliness"),
    );
    b?.click();
    return !!b;
  });
  await sleep(800);
  return tab;
}
const view = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="cleanliness"]');
    if (!el) return null;
    return {
      intro: !!document.querySelector('[data-testid="cleanliness-intro"]'),
      areas: Object.fromEntries(
        [...el.querySelectorAll("[data-area-status]")].map((a) => [
          a.getAttribute("data-testid"),
          {
            status: a.getAttribute("data-area-status"),
            meter: Number(a.querySelector("[data-area-meter]")?.getAttribute("data-area-meter")),
            todo: [...a.querySelectorAll('[data-spot-status]:not([data-spot-status="ok"])')].map(
              (s) => s.getAttribute("data-spot"),
            ),
          },
        ]),
      ),
      badge: document.querySelector('[data-tab-badge="cleanliness"]')?.textContent.trim() ?? null,
      ready: [...el.querySelectorAll("[data-ready-area]")].map((r) => r.getAttribute("data-ready")),
      allReady: !!el.querySelector('[data-testid="cleanliness-all-ready"]'),
    };
  });

// ---------- 1. Level 25: the section, the intro, the areas ----------
await boot(page, saveAt(25));
const tab1 = await openCleanliness();
const v1 = await view();
await shot(page, "cleanliness-intro");
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="cleanliness-intro"] button')]
    .find((b) => /Skip/.test(b.textContent))
    ?.click(),
);
await sleep(500);
const afterIntro = await readSave(page);
await shot(page, "cleanliness-l25");
check(
  "1 Level 25: Cleanliness tab + the guided intro (once); Kitchen, Dining, Restroom cards show the seeded tasks; the tab badge counts 5",
  tab1 &&
    !!v1 &&
    v1.intro &&
    afterIntro.business.cleanliness.introSeen === true &&
    v1.areas["area-kitchen"]?.todo.includes("equipment") &&
    v1.areas["area-kitchen"]?.todo.includes("bins") &&
    v1.areas["area-dining"]?.todo.includes("floor") &&
    v1.areas["area-restroom"]?.todo.includes("toilet") &&
    Object.values(v1.areas).every((a) => a.meter < 100 && a.status !== "clean") &&
    v1.badge === "5",
  v1,
);

// ---------- 2. Clean one task ----------
const before2 = await readSave(page);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="area-kitchen"] button')]
    .find((b) => /^View /.test(b.textContent.trim()))
    ?.click(),
);
await sleep(400);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-task="bins"] button')]
    .find((b) => /^Clean$/.test(b.textContent.trim()))
    ?.click(),
);
await sleep(500);
const after2 = await readSave(page);
const stillThere = await page.evaluate(() => !!document.querySelector('[data-task="bins"]'));
check(
  "2 Clean → the bins task leaves; 3 liners used once; no money, no ledger",
  !after2.business.cleanliness.tasks.some((t) => t.kind === "bins") &&
    after2.business.supplies.stock["bin-liners"].units ===
      before2.business.supplies.stock["bin-liners"].units - 3 &&
    after2.credits === before2.credits &&
    after2.economyLedger.length === before2.economyLedger.length &&
    !stillThere,
  {
    liners: after2.business.supplies.stock["bin-liners"],
    tasks: after2.business.cleanliness.tasks,
  },
);

// ---------- 3. Missing disinfectant → Buy → Market → back ----------
const need = await page.evaluate(() => {
  const b = document.querySelector('[data-task="equipment"] [data-need="disinfectant"]');
  b?.click();
  return !!b;
});
await sleep(900);
const market = await page.evaluate(() => {
  const card = document.querySelector('[data-supply="disinfectant"]');
  const focused = !!card && /ring-2/.test(card.className);
  [...(card?.querySelectorAll("button") ?? [])]
    .find((b) => /^Buy · /.test(b.textContent.trim()))
    ?.click();
  return {
    card: !!card,
    focused,
    section: !!document.querySelector('[data-testid="market-supplies-cleaning"]'),
  };
});
await sleep(600);
const after3 = await readSave(page);
const entries3 = after3.economyLedger.slice(after2.economyLedger.length);
await openCleanliness();
const strip = await page.evaluate(
  () =>
    document.querySelector('[data-clean-supply="disinfectant"]')?.getAttribute("data-low") ?? null,
);
check(
  "3 the task's Buy opens the exact Market card (Cleaning section); one ledger entry; the strip reads the same stock (no longer low)",
  need &&
    market.card &&
    market.focused &&
    market.section &&
    entries3.length === 1 &&
    entries3[0].category === "supply-packaging-purchase" &&
    after3.business.supplies.stock.disinfectant?.units === 12 &&
    strip === "false",
  { need, market, entries3, strip },
);

// ---------- 4. A Cleaner for today (in place of Clean everything) ----------
const before4 = await readSave(page);
const offer4 = await page.evaluate(() => ({
  cleanAll: [...document.querySelectorAll("button")].some((b) =>
    /Clean everything/.test(b.textContent),
  ),
  offer: !!document.querySelector('[data-testid="day-cleaner"]'),
}));
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="day-cleaner"] button')]
    .find((b) => /^Today · \$/.test(b.textContent.trim()))
    ?.click(),
);
await sleep(700);
const v4 = await view();
const after4 = await readSave(page);
const entries4 = after4.economyLedger.slice(before4.economyLedger.length);
await shot(page, "cleanliness-ready");
check(
  "4 no Clean everything button; Today · $X hires a Cleaner for the day: the tasks are cleaned, one Staff Payroll entry, every area Ready",
  !offer4.cleanAll &&
    offer4.offer &&
    !!v4 &&
    after4.business.cleanliness.tasks.length === 0 &&
    after4.business.cleanliness.dayCleanerDay === (after4.business.restaurantDay?.day ?? 1) &&
    entries4.length === 1 &&
    entries4[0].category === "business-staff-salary" &&
    before4.credits - after4.credits === -entries4[0].amount &&
    v4.ready.every((r) => r === "ready") &&
    v4.allReady &&
    v4.badge === null,
  { offer4, v4, entries4, tasks: after4.business.cleanliness.tasks },
);

// ---------- 5. The Cleaner's areas; no tab at Level 10, the tab at Level 11 ----------
await boot(page, saveAt(30, { staff: ["cleaner"], introSeen: true }));
await openCleanliness();
await page.evaluate(() => document.querySelector('[data-cleaner-area="restroom"]')?.click());
await sleep(400);
const areas5 = (await readSave(page)).business.cleanliness.cleanerAreas;
await boot(page, saveAt(10, { introSeen: true }));
const tab20 = await openCleanliness();
await boot(page, saveAt(11, { introSeen: true }));
const tab11 = await openCleanliness();
check(
  "5 a hired Cleaner's area chips assign them (restroom off); no tab at Level 10 (Restaurant closed), the tab at Level 11",
  areas5.join() === "kitchen,dining" && tab20 === false && tab11 === true,
  { areas5, tab20, tab11 },
);

// ---------- 6. Widths ----------
const fits = [];
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [1024, 1366],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, saveAt(25, { introSeen: true }));
  await openCleanliness();
  fits.push(
    await page.evaluate((w) => {
      const el = document.querySelector('[data-testid="cleanliness"]');
      const buttons = el ? [...el.querySelectorAll("button")].filter((b) => b.offsetParent) : [];
      return {
        w,
        open: !!el,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        small: buttons
          .filter((b) => b.getBoundingClientRect().height < 47.5)
          .map((b) => b.textContent.trim())
          .slice(0, 4),
      };
    }, w),
  );
  if (w === 320) await shot(page, "cleanliness-320");
}
check(
  "6 at 320 / 360 / 390 / 1024 px: no sideways scroll, every button ≥ 48 px",
  fits.every((f) => f.open && f.overflow <= 0 && f.small.length === 0),
  fits,
);

// ---------- 8. No mock panels; today's status first; the real wash-up ----------
await boot(page, saveAt(30, { introSeen: true }));
await openCleanliness();
const layout8 = await page.evaluate(() => ({
  order: [...document.querySelectorAll('[data-testid="cleanliness"] > [data-testid]')].map((e) =>
    e.getAttribute("data-testid"),
  ),
  mocks: ["cleaning-test-spots", "dishwashing-prototype-entry", "kitchen-tools-wash-entry"].filter(
    (id) => !!document.querySelector(`[data-testid="${id}"]`),
  ),
  chips: [...document.querySelectorAll("[data-ready-area]")].map((e) => e.tagName),
  wash: document.querySelector('[data-testid="cleanliness-wash-up"]')?.textContent ?? "",
}));
check(
  "8 no practice / test / mock dishwashing panels; today's status first (one chip per area), the areas once each, then the real wash-up",
  layout8.mocks.length === 0 &&
    layout8.order[0] === "cleanliness-ready" &&
    layout8.order.filter((id) => /^area-/.test(id)).length === 3 &&
    layout8.order.indexOf("cleanliness-wash-up") > layout8.order.indexOf("area-restroom") &&
    layout8.chips.length === 3 &&
    layout8.chips.every((t) => t === "BUTTON") &&
    /Automatic after each service/.test(layout8.wash),
  layout8,
);

// ---------- 9. A Cleaner for today with an ad (stubbed rewarded ads) ----------
async function stubRewarded(outcome) {
  await page.evaluate((outcome) => {
    window.__adOutcome = outcome;
    const adv = window.bridge.advertisement;
    if (adv.__stubbed) return;
    adv.__stubbed = true;
    let handler = null;
    Object.defineProperty(adv, "isRewardedSupported", { get: () => true, configurable: true });
    adv.on = (_event, cb) => (handler = cb);
    adv.off = () => (handler = null);
    adv.showRewarded = (placement) => {
      window.__adPlacements = [...(window.__adPlacements ?? []), placement];
      const seq =
        window.__adOutcome === "rewarded" ? ["opened", "rewarded", "closed"] : ["opened", "closed"];
      seq.forEach((st, i) => setTimeout(() => handler && handler(st), 80 * (i + 1)));
    };
  }, outcome);
}
const tapAd = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="day-cleaner"] button')]
      .find((b) => /Free with an ad/.test(b.textContent))
      ?.click(),
  );
await boot(page, saveAt(30, { introSeen: true }));
await stubRewarded("not-rewarded");
await openCleanliness();
const b9 = await readSave(page);
await tapAd();
await sleep(900);
const declined = await readSave(page);
await stubRewarded("rewarded");
await tapAd();
await sleep(1200);
const a9 = await readSave(page);
const placements9 = await page.evaluate(() => window.__adPlacements ?? []);
const onDuty9 = await page.evaluate(
  () => !!document.querySelector('[data-testid="cleaner-on-duty"]'),
);
check(
  "9 Free with an ad: a declined ad changes nothing; a finished ad puts a Cleaner on today (no money, no ledger), placement day_cleaner",
  declined.business.cleanliness.dayCleanerDay == null &&
    declined.credits === b9.credits &&
    a9.business.cleanliness.dayCleanerDay === (a9.business.restaurantDay?.day ?? 1) &&
    a9.credits === b9.credits &&
    a9.economyLedger.length === b9.economyLedger.length &&
    a9.business.cleanliness.tasks.length < b9.business.cleanliness.tasks.length &&
    placements9.length === 2 &&
    placements9.every((p) => p === "day_cleaner") &&
    onDuty9,
  { placements9, tasks: a9.business.cleanliness.tasks.map((t) => t.kind), onDuty9 },
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("7 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `CLEANLINESS E2E: ${failed.length} FAILURE(S)` : "CLEANLINESS E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
