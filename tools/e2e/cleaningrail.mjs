// Cleaning has its own round button in the Kitchen's right-hand column, RIGHT UNDER the Mini-games button (developer 2026-11-22, third time of asking:
// "I need it under mini games button as a separate section from mini games and business", with a screenshot of the wide Kitchen), restaurant build:
//   1. From its level the column ends Daily Check, Inventory, Business, Mini-games, Cleaning, in that order, the Cleaning button below Mini-games;
//   2. it carries a "!" badge while jobs wait, and none when everything is clean;
//   3. the first tap expands it (says "Cleaning"), the second opens the Cleanliness screen (own header, no Business tab strip); Back returns to the Kitchen;
//   4. below its level it shows a lock, says when it opens, and a second tap goes nowhere;
//   5. it fits in view without sideways scroll in a wide window, at 360x640, in a short phone-landscape window, and at 320x568.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, PAIGE_QUIET, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const SUPPLIES = [
  "bin-liners",
  "brooms",
  "disinfectant",
  "floor-cleaner",
  "hand-soap",
  "mop-bucket",
  "paper-towels",
  "sponges-cloths",
  "toilet-brushes",
  "toilet-paper",
];
const saveAt = (N, tasks) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: PAIGE_QUIET,
      supplies: {
        stock: {
          ...MOVED_IN_BUSINESS.supplies.stock,
          ...Object.fromEntries(SUPPLIES.map((id) => [id, { units: 40, costBasis: 40 }])),
        },
      },
      cleanliness: {
        tasks: tasks.map((kind) => ({ kind, count: 1, since: N - 1 })),
        open: {},
        counters: { sink: 0, paper: 0 },
        cleanerAreas: [],
        introSeen: true,
        cupboardAt: 21,
        lastStart: null,
        cleaned: 0,
        byCleaner: 0,
      },
    },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${N}`,
      highestUnlockedLevelId: `level-${N}`,
      completedLevelIds: Array.from({ length: N - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 4095, finaleSeen: false },
  });

const later = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Later")?.click(),
  );
const click = (sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
const rail = () =>
  page.evaluate(() => {
    const order = [
      "daily-check-shortcut",
      "inventory-shortcut",
      "business-shortcut",
      "minigames-shortcut",
      "cleaning-shortcut",
    ];
    const rects = order.map((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      const r = el?.getBoundingClientRect();
      return { id, top: r ? Math.round(r.top) : null, bottom: r ? Math.round(r.bottom) : null };
    });
    const c = document.querySelector('[data-testid="cleaning-shortcut"]');
    const cr = c?.getBoundingClientRect();
    // nothing may sit on top of the button: the day strip and the Next Customer card must not cross it
    const hit = (sel) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return (
        !!r &&
        !!cr &&
        r.width > 0 &&
        r.left < cr.right - 1 &&
        r.right > cr.left + 1 &&
        r.top < cr.bottom - 3 &&
        r.bottom > cr.top + 3
      );
    };
    return {
      covered: hit('[data-testid="day-strip"]') || hit('[data-testid="kitchen-next-dish"]'),
      rects,
      ordered: rects.every((r, i) => r.top !== null && (i === 0 || r.top > rects[i - 1].top)),
      inView: !!cr && cr.top >= 0 && cr.bottom <= innerHeight && cr.right <= innerWidth,
      sideways: document.documentElement.scrollWidth > innerWidth + 1,
      badge: !!document.querySelector('[data-testid="cleaning-shortcut-badge"]'),
      expanded: c?.getAttribute("aria-expanded"),
      disabled: c?.getAttribute("aria-disabled"),
      text: c?.textContent?.trim() ?? null,
      label: c?.getAttribute("aria-label") ?? null,
    };
  });

// 1-3. Level 25, two jobs waiting, a wide window
await page.setViewport({ width: 1815, height: 867, deviceScaleFactor: 1 });
await boot(page, saveAt(25, ["grease", "tables"]));
await sleep(1200);
const wide = await rail();
check(
  "1 wide: Cleaning is the last round button, right under Mini-games",
  wide.ordered && wide.inView && !wide.sideways && !wide.covered,
  wide.rects,
);
check("2a a '!' badge while jobs wait", wide.badge, wide.label);
await later();
await sleep(500);
await shot(page, "cleaningrail-wide");
await click('[data-testid="cleaning-shortcut"]');
await sleep(500);
const open1 = await rail();
check(
  "3a first tap expands it and says Cleaning",
  open1.expanded === "true" && /Cleaning/.test(open1.text ?? ""),
  open1,
);
await click('[data-testid="cleaning-shortcut"]');
await page.waitForSelector('[data-testid="cleanliness"]', { timeout: 8000 }).catch(() => null);
await sleep(700);
const scr = await page.evaluate(() => ({
  cleanliness: !!document.querySelector('[data-testid="cleanliness"]'),
  title: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()),
  tabStrip: !!document.querySelector('nav[aria-label="Business sections"]'),
}));
check(
  "3b second tap opens the Cleanliness screen (own header, no Business tab strip)",
  scr.cleanliness && scr.title.some((t) => /Cleanliness/.test(t)) && !scr.tabStrip,
  scr,
);
await page.evaluate(() => document.querySelector('button[aria-label="Back"]')?.click());
await sleep(800);
check(
  "3c Back returns to the Kitchen",
  await page.evaluate(() => !!document.querySelector('[data-testid="cleaning-shortcut"]')),
);

// 2b. nothing waiting: no badge
await boot(page, saveAt(25, []));
await sleep(1000);
const clean = await rail();
check("2b no badge when everything is clean", !clean.badge && clean.ordered, clean);

// 5. other sizes
for (const [w, h, name] of [
  [360, 640, "portrait-360"],
  [320, 568, "portrait-320"],
  [740, 360, "phone-landscape"],
  [390, 844, "portrait-390"],
  [430, 900, "portrait-430"],
  [768, 1024, "tablet-768"],
  [1280, 720, "wide-1280"],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, saveAt(25, ["grease"]));
  await sleep(1000);
  const r = await rail();
  check(
    `5 ${w}x${h}: the button is in view, nothing scrolls sideways`,
    r.inView && !r.sideways && r.ordered && !r.covered,
    r,
  );
  await later();
  await sleep(500);
  await shot(page, `cleaningrail-${name}`);
}

// 4. below its level
await page.setViewport({ width: 1815, height: 867, deviceScaleFactor: 1 });
await boot(page, saveAt(3, []));
await sleep(1000);
await click('[data-testid="cleaning-shortcut"]');
await sleep(400);
await click('[data-testid="cleaning-shortcut"]');
await sleep(700);
const locked = await rail();
const stayed = await page.evaluate(() => !document.querySelector('[data-testid="cleanliness"]'));
check(
  "4 below its level: locked, says when it opens, a second tap goes nowhere",
  locked.disabled === "true" &&
    /after|Level|Lv|\d/.test(locked.text ?? "") &&
    stayed &&
    !locked.badge,
  locked,
);

const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("6 no console errors", errs.length === 0, errs.slice(0, 3));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
