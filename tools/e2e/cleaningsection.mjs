// Cleanliness is its own section under the Kitchen's Mini-games button (developer 2026-11-22: "remove cleanliness section from business and put it under
// minigames button as a separate section"), restaurant build, in a real browser:
//   1. The Mini-games sheet has two tabs, "Mini-games" and "Cleaning" (with the waiting-jobs count); the Cleaning tab holds the Cleanliness card, apart from the games.
//   2. The Business screen has no Cleanliness tab any more.
//   3. The card opens the cleaning screen: header "Cleanliness", no Business tab strip, the rooms' cards are there, and Back returns to the Kitchen.
//   4. Below its level the card is locked (aria-disabled) and says when it opens.
//   5. The sheet and the screen fit at 320 px and in a wide window; no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

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
let N = 25;
const saveWith = (tasks, settings = {}, cleaned = 0) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
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
        cleaned,
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
    ...(Object.keys(settings).length
      ? { settings: { sound: false, music: false, reducedMotion: false, ...settings } }
      : {}),
  });

const click = (sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
const openCleaningTab = async () => {
  await click('[data-testid="minigames-tab-cleaning"]');
  await sleep(300);
};
const openSheet = async () => {
  await click('[data-testid="minigames-shortcut"]');
  await page
    .waitForSelector('[data-testid="minigames-sheet"]', { timeout: 6000 })
    .catch(() => null);
  await sleep(500);
};

await boot(page, saveWith(["grease", "tables"]));
await sleep(800);
await openSheet();
const tabs = await page.evaluate(() => ({
  games: document
    .querySelector('[data-testid="minigames-tab-games"]')
    ?.getAttribute("aria-selected"),
  cleaning: document
    .querySelector('[data-testid="minigames-tab-cleaning"]')
    ?.getAttribute("aria-selected"),
  badge:
    document.querySelector('[data-testid="minigames-tab-badge-cleaning"]')?.textContent ?? null,
  tabH: Math.round(
    document.querySelector('[data-testid="minigames-tab-cleaning"]')?.getBoundingClientRect()
      .height ?? 0,
  ),
  gamesShown: document.querySelectorAll(
    '[data-testid^="minigame-"]:not([data-testid="minigame-cleaning"])',
  ).length,
  cardShown: !!document.querySelector('[data-testid="minigame-cleaning"]'),
}));
await shot(page, "cleaning-tab-closed-portrait");
await openCleaningTab();
const sec = await page.evaluate(() => {
  const s = document.querySelector('[data-testid="minigames-cleaning-section"]');
  const c = document.querySelector('[data-testid="minigame-cleaning"]');
  return {
    section: !!s,
    others: document.querySelectorAll(
      '[data-testid^="minigame-"]:not([data-testid="minigame-cleaning"])',
    ).length,
    inSheet: !!document.querySelector('[data-testid="minigames-sheet"]')?.contains(s),
    status: document.querySelector('[data-testid="mg-status-cleaning"]')?.textContent ?? null,
    state: c?.dataset.state ?? null,
    painted: !!c?.querySelector("[data-painted-icon]"),
    counted: document.querySelector('[data-testid="minigames-count"]')?.textContent ?? null,
  };
});
check(
  "1 the sheet has a Mini-games tab and a Cleaning tab (2 waiting); the Cleaning tab holds the Cleanliness card and no game",
  tabs.games === "true" &&
    tabs.cleaning === "false" &&
    tabs.badge === "2" &&
    tabs.tabH >= 48 &&
    !tabs.cardShown &&
    tabs.gamesShown >= 6 &&
    sec.section &&
    sec.inSheet &&
    sec.others === 0 &&
    sec.status === "2 jobs waiting" &&
    sec.state === "ready",
  { tabs, sec },
);
await shot(page, "cleaning-section-portrait");

await click('[data-testid="minigames-close"]');
await sleep(400);
await click('[data-nav="restaurant-map"]');
await page.waitForSelector(".map-hotspot-zone", { timeout: 15000 }).catch(() => null);
await sleep(600);
await page.evaluate(() =>
  [...document.querySelectorAll(".map-hotspot-zone")]
    .find((e) => /Manager \/ Office/.test(e.getAttribute("aria-label") ?? ""))
    ?.click(),
);
await sleep(900);
const biz = await page.evaluate(() => ({
  nav: !!document.querySelector('nav[aria-label="Business sections"]'),
  tabs: [...document.querySelectorAll('nav[aria-label="Business sections"] button')].map((b) =>
    b.textContent.trim(),
  ),
}));
check(
  "2 the Business screen has no Cleanliness tab",
  biz.nav && biz.tabs.length > 0 && !biz.tabs.some((t) => /Cleanliness/.test(t)),
  biz,
);

await click('[data-nav="kitchen"]');
await sleep(700);
await openSheet();
await openCleaningTab();
await click('[data-testid="minigame-cleaning"]');
await page.waitForSelector('[data-testid="cleanliness"]', { timeout: 8000 }).catch(() => null);
await sleep(700);
const scr = await page.evaluate(() => ({
  cleanliness: !!document.querySelector('[data-testid="cleanliness"]'),
  title: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()),
  tabStrip: !!document.querySelector('nav[aria-label="Business sections"]'),
  areas: document.querySelectorAll('[data-testid^="area-"]').length,
  sheetGone: !document.querySelector('[data-testid="minigames-sheet"]'),
}));
check(
  "3 the card opens the cleaning screen: its own header, no Business tab strip, the rooms' cards",
  scr.cleanliness &&
    scr.title.some((t) => /Cleanliness/.test(t)) &&
    !scr.tabStrip &&
    scr.areas >= 3 &&
    scr.sheetGone,
  scr,
);
await shot(page, "cleaning-screen-portrait");
await page.evaluate(() => document.querySelector('button[aria-label="Back"]')?.click());
await sleep(700);
const back = await page.evaluate(
  () => !!document.querySelector('[data-testid="minigames-shortcut"]'),
);
check("3b Back returns to the Kitchen", back);

// 5. a narrow phone and a wide window
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await sleep(600);
await openSheet();
await openCleaningTab();
const narrow = await page.evaluate(() => {
  const s = document.querySelector('[data-testid="minigames-sheet"]');
  const c = document.querySelector('[data-testid="minigame-cleaning"]');
  c?.scrollIntoView({ block: "center" });
  const r = c?.getBoundingClientRect();
  return {
    sideways: document.documentElement.scrollWidth > innerWidth + 1,
    inView: !!r && r.left >= 0 && r.right <= innerWidth,
    h: r ? Math.round(r.height) : 0,
    sheet: !!s,
  };
});
check(
  "5a 320 px: the Cleaning card fits with no sideways scroll and is a big enough target",
  !narrow.sideways && narrow.inView && narrow.h >= 48,
  narrow,
);
await shot(page, "cleaning-section-320");
await click('[data-testid="minigames-close"]');
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await sleep(900);
await openSheet();
await openCleaningTab();
const wide = await page.evaluate(() => {
  const c = document.querySelector('[data-testid="minigame-cleaning"]');
  c?.scrollIntoView({ block: "center" });
  const r = c?.getBoundingClientRect();
  return {
    sideways: document.documentElement.scrollWidth > innerWidth + 1,
    inView: !!r && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
    w: r ? Math.round(r.width) : 0,
  };
});
check("5b wide window: the Cleaning card is in view and fits", !wide.sideways && wide.inView, wide);
await shot(page, "cleaning-section-wide");

// 4. a low level: the card is there but locked, and says when it opens
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
N = 2;
await boot(page, saveWith([]));
await sleep(800);
await openSheet();
await openCleaningTab();
const low = await page.evaluate(() => {
  const c = document.querySelector('[data-testid="minigame-cleaning"]');
  return {
    locked: c?.getAttribute("aria-disabled") === "true",
    state: c?.dataset.state ?? null,
    text: document.querySelector('[data-testid="mg-status-cleaning"]')?.textContent ?? null,
  };
});
check(
  "4 below its level the card is locked and says when it opens",
  low.locked && low.state === "locked" && /opens/.test(low.text ?? ""),
  low,
);

check(
  "6 no console errors",
  logs.filter((l) => /pageerror|error:/i.test(l)).length === 0,
  logs.filter((l) => /pageerror|error:/i.test(l)).slice(0, 3),
);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `CLEANING SECTION E2E: ${failed} FAIL` : "CLEANING SECTION E2E: ALL PASS");
process.exit(failed ? 1 : 0);
