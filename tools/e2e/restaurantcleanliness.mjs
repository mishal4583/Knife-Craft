// Cleanliness & Maintenance (developer 2026-10-10), restaurant build, in a real browser:
//   1. Level 25: Restaurant → Cleanliness opens with the guided intro (once); Kitchen, Dining
//      Area and Restroom cards show the seeded tasks (meter < 100, ! badges), the tab badge counts
//      them.
//   2. View details → Clean a task: it leaves, its supplies are used once (no money, no ledger);
//      a second tap on the same task isn't possible (it's gone).
//   3. A task without its supplies shows "Buy …" → the exact Market card in the Cleaning section;
//      buying it updates the same stock the strip shows (one ledger entry).
//   4. "Clean everything I can" cleans the rest; every area Ready.
//   5. With a Cleaner hired, the area chips assign them; Level 20 has no Cleanliness tab.
//   6. Widths 320 / 360 / 390 / 1024: no sideways scroll, buttons ≥ 48 px.
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
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });

async function openCleanliness() {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Restaurant"))
      ?.click(),
  );
  await sleep(900);
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
    .find((b) => /View details/.test(b.textContent))
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

// ---------- 4. Clean everything ----------
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="cleanliness-ready"] button')]
    .find((b) => /Clean everything/.test(b.textContent))
    ?.click(),
);
await sleep(600);
const v4 = await view();
const after4 = await readSave(page);
await shot(page, "cleanliness-ready");
check(
  "4 Clean everything → every task done, every area Ready, ✨ Ready for service",
  !!v4 &&
    after4.business.cleanliness.tasks.length === 0 &&
    v4.ready.every((r) => r === "ready") &&
    v4.allReady &&
    v4.badge === null,
  { v4, tasks: after4.business.cleanliness.tasks },
);

// ---------- 5. The Cleaner's areas; no tab at Level 20 ----------
await boot(page, saveAt(30, { staff: ["cleaner"], introSeen: true }));
await openCleanliness();
await page.evaluate(() => document.querySelector('[data-cleaner-area="restroom"]')?.click());
await sleep(400);
const areas5 = (await readSave(page)).business.cleanliness.cleanerAreas;
await boot(page, saveAt(20, { introSeen: true }));
const tab20 = await openCleanliness();
check(
  "5 a hired Cleaner's area chips assign them (restroom off); Level 20 has no Cleanliness tab",
  areas5.join() === "kitchen,dining" && tab20 === false,
  { areas5, tab20 },
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

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("7 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `CLEANLINESS E2E: ${failed.length} FAILURE(S)` : "CLEANLINESS E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
