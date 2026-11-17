// The snag screen after a new release (developer 2026-11-17: "Open for service" showed "The game hit a snag" and Reload did nothing,
// three times). Restaurant build, real browser: src/main.tsx (error boundary, vite:preloadError) + src/lib/freshReload.ts.
// The restaurant screens' chunk is made unreachable on purpose (as when a phone still holds the previous index.html and asks for a
// file the new release no longer has), then let through again.
//   R1 opening a screen of the restaurant chunk with it missing: the page starts a fresh load by itself (new ?fresh= query string), once
//   R2 the chunk still missing after that: the snag screen stays (no reload loop) and says what to do
//   R3 the chunk back: the snag screen's button starts a fresh load and the screen opens
//   R4 the save is untouched through all of it (same level, same money)
//   R5 no console errors other than the blocked chunk
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  PAIGE_QUIET,
  launch,
  readSave,
  seedSave,
  sleep,
  SAVE_KEY,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

const LEVEL = 20;
const save = seedSave({
  credits: 50_000,
  business: {
    ...MOVED_IN_BUSINESS,
    assistant: PAIGE_QUIET,
    sectionsSeen: [
      "shop",
      "inventory",
      "rack",
      "business",
      "staff",
      "equipment",
      "second-floor",
      "restaurant",
      "menu",
      "progress",
    ],
  },
  levelProgress: {
    currentLevelId: `level-${LEVEL}`,
    highestUnlockedLevelId: `level-${LEVEL}`,
    completedLevelIds: Array.from({ length: LEVEL - 1 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 4,
  },
  story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
});

const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
let blocked = false;
let blockedHits = 0;
await page.setRequestInterception(true);
page.on("request", (req) => {
  if (blocked && /restaurantScreens-[^/]*\.js/.test(req.url())) {
    blockedHits++;
    req.abort("failed");
  } else req.continue();
});

const base = (process.env.KC_URL || "http://localhost:4173/").split("?")[0];
await page.goto(base, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.bridge, { timeout: 20000 });
await page.evaluate(
  async (s, key) => {
    localStorage.clear();
    sessionStorage.clear();
    await window.bridge.storage.set([key], [JSON.stringify(s)]);
  },
  save,
  SAVE_KEY,
);
// the chunk is missing from the first load on (the Kitchen would otherwise fetch it in the background before the test blocks it)
blocked = true;
await page.reload({ waitUntil: "networkidle0" });
const ready = async () => {
  await page.waitForSelector('[data-testid="minigames-shortcut"]', { timeout: 20000 });
  await page.waitForFunction(
    () => document.elementFromPoint(5, 5)?.closest("#loading-overlay") === null,
    { timeout: 20000 },
  );
  for (let i = 0; i < 6; i++) {
    const gone = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="guide-card"]');
      if (!card) return true;
      [...card.querySelectorAll("button")].find((b) => b.textContent.includes("Later"))?.click();
      return false;
    });
    if (gone) break;
    await sleep(600);
  }
  await sleep(300);
};
/** Kitchen Dispatch lives in the restaurant screens' chunk: opening it from the Mini-games sheet fetches that chunk. */
const openService = async () => {
  await page.click('[data-testid="minigames-shortcut"]');
  await page.waitForSelector('[data-testid="minigames-sheet"]', { timeout: 5000 });
  await sleep(350);
  await page.click('[data-testid="minigame-kitchen-dispatch"]');
};
const snag = () => page.evaluate(() => !!document.querySelector('[role="alert"]'));
const search = () => page.evaluate(() => window.location.search);
const credits = async () => {
  const s = await readSave(page);
  return { credits: s.credits, level: s.levelProgress.highestUnlockedLevelId };
};

await ready();
const before = await credits();

// R1: the chunk is missing; one tap on a screen that lives in it
const navigated = page
  .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 })
  .catch(() => null);
await openService();
await navigated;
await sleep(1500);
const q1 = await search();
check(
  "R1 a missing chunk starts a fresh load by itself, with a new query string",
  /[?&]fresh=\d+/.test(q1),
  {
    search: q1,
    blockedHits,
  },
);

// R2: still missing, still the old index.html: the snag screen stays, no loop
await ready();
await openService();
await sleep(2500);
const stillSnag = await snag();
const q2 = await search();
const body = await page.evaluate(() => document.body.innerText);
check(
  "R2 with the chunk still missing the snag screen stays (no loop) and offers Reload game",
  stillSnag && q2 === q1 && /Reload game/.test(body),
  { stillSnag, q1, q2 },
);

// R3: the chunk is back; the button starts a fresh load and the service opens
blocked = false;
const navigated2 = page
  .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 })
  .catch(() => null);
await page.evaluate(() =>
  [...document.querySelectorAll("button")].find((b) => /Reload game/.test(b.textContent))?.click(),
);
await navigated2;
await ready();
const q3 = await search();
await openService();
await page
  .waitForSelector('[data-testid="kitchen-dispatch-game"]', { timeout: 10000 })
  .catch(() => null);
await sleep(500);
const afterSnag = await snag();
const opened = await page.evaluate(
  () => !!document.querySelector('[data-testid="kitchen-dispatch-game"]'),
);
check(
  "R3 the button gave a new query string and the screen now opens",
  /[?&]fresh=\d+/.test(q3) && q3 !== q1 && !afterSnag && opened,
  { q3, afterSnag, opened },
);

const after = await credits();
check(
  "R4 the save is untouched",
  before.credits === after.credits && before.level === after.level,
  {
    before,
    after,
  },
);

const bad = logs.filter(
  (l) =>
    /error/i.test(l) &&
    !/restaurantScreens|dynamically imported|Failed to load resource|net::ERR|snag|failed to render|JSHandle@error/i.test(
      l,
    ),
);
// (the boundary logs the blocked chunk's own error object, which the log shows as JSHandle@error)
check("R5 no console errors other than the blocked chunk", bad.length === 0, bad.slice(0, 3));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\nCHUNK RELOAD: ${failed.length} FAILED` : "\nCHUNK RELOAD: ALL PASS");
process.exit(failed.length ? 1 : 0);
