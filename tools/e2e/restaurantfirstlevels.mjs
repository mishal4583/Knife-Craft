// First levels (developer 2026-10-09, Levels 1–15 pass 1), restaurant build, in a real browser:
//   1. Level 1 played: Level Complete carries Grandma's line; no day screen.
//   2. Level 2 reached: only the Kitchen is open; Inventory / Market / Progress / Restaurant
//      show a lock and "Lv 3 / 7 / 10 / 11"; a tap says when it opens and goes nowhere; the
//      Kitchen's Market and Progress places say "opens at Level …".
//   3. Level 2 starts with no opening card; finished, Level Complete has Grandma's line,
//      "📦 Inventory is open" and "☀️ Day 2 begins"; no Closing Time; Day 2 in the save,
//      and the wallet moved only by the ledger's entries.
//   4. Level 7: the Market opens for a look: Knives and Cutting Boards only.
//   5. Level 10 played: the big milestone card (Santoku, Maple Board in the Market, the menu
//      next), a tap dismisses it, then Level Complete with Grandma's line and the Restaurant
//      opening; every section is open.
//   6. 320×568: the bottom bar's locks fit, buttons ≥ 48 px, no sideways scroll.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  GAME_URL,
  MOVED_IN_BUSINESS,
  SAVE_KEY,
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  shot,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const at = (n, extra = {}) =>
  seedSave({
    business: MOVED_IN_BUSINESS,
    credits: 0,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: n > 10 ? 1 : 0, finaleSeen: false },
    ...extra,
  });
const navState = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("nav button[data-nav]")].map((b) => ({
      id: b.getAttribute("data-nav"),
      locked: b.hasAttribute("data-locked"),
      text: b.innerText.replace(/\s+/g, " ").trim(),
    })),
  );
const bannerText = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="banner-grandma"]')?.closest(".text-center");
    return el ? el.innerText.replace(/\s+/g, " ") : null;
  });
const inHud = () =>
  page.evaluate(() => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText));
async function prepareToday() {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  await clickButton(page, /^Prepare$/);
  await sleep(900);
}
async function playLevel() {
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    { timeout: 30000 },
  );
  const played = await playToReport(page, { maxMs: 150000 });
  await clickButton(page, /^Continue$/);
  await sleep(900);
  if (/ORDER READY/i.test(await page.evaluate(() => document.body.innerText))) {
    await clickButton(page, /^Serve to /);
    await sleep(900);
  }
  await clickButton(page, /^Finish Level$/);
  await sleep(1200);
  return played.ok;
}

// ---------- 1. Level 1 played (a new player lands straight on the board) ----------
await page.goto(GAME_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.bridge, { timeout: 30000 });
await page.evaluate(
  async (s, key) => {
    localStorage.clear();
    await window.bridge.storage.set([key], [JSON.stringify(s)]);
  },
  at(1),
  SAVE_KEY,
);
await page.reload({ waitUntil: "networkidle0" });
const played1 = await playLevel();
const b1 = await bannerText();
check(
  "1 Level 1: Level Complete carries Grandma's line; no day screen",
  played1 &&
    /There you go\. Our first plate is back on the table\./.test(b1 ?? "") &&
    !(await page.evaluate(() => !!document.querySelector('[data-testid="closing-time"]'))),
  b1,
);

// ---------- 2. Level 2 reached: only the Kitchen is open ----------
await sleep(6500); // the Level Complete card times out
await page.evaluate(() =>
  [...document.querySelectorAll("nav button")]
    .find((x) => x.textContent.includes("Kitchen"))
    ?.click(),
);
await sleep(800);
const nav1 = await navState();
const navOf = (id) => nav1.find((n) => n.id === id);
check(
  "2a Level 2: Kitchen open; Inventory Lv 3, Market Lv 7, Restaurant Lv 11, Progress Lv 10 locked",
  nav1.length === 5 &&
    navOf("kitchen")?.locked === false &&
    navOf("inventory")?.locked &&
    /Lv 3/.test(navOf("inventory").text) &&
    navOf("shop")?.locked &&
    /Lv 7/.test(navOf("shop").text) &&
    navOf("rack")?.locked &&
    /Lv 10/.test(navOf("rack").text) &&
    navOf("business")?.locked &&
    /Lv 11/.test(navOf("business").text),
  nav1,
);
await page.click('nav button[data-nav="shop"]');
await sleep(300);
const hint = await page.evaluate(
  () => document.querySelector('[data-testid="nav-lock-hint"]')?.textContent,
);
const stillKitchen = await page.evaluate(
  () => !!document.querySelector('[data-testid="kitchen-rank"]'),
);
const places = await page.evaluate(() =>
  [...document.querySelectorAll("button[data-locked]")]
    .filter((b) => !b.hasAttribute("data-nav"))
    .map((b) => b.innerText.replace(/\s+/g, " ").trim()),
);
await shot(page, "first-levels-l2-kitchen");
check(
  "2b a tap on a locked section says when it opens and stays on the Kitchen; the Kitchen's places say so too",
  /Market opens at Level 7/.test(hint ?? "") &&
    stillKitchen &&
    places.some((p) => /Market opens at Level 7/.test(p)) &&
    places.some((p) => /Progress opens at Level 10/.test(p)),
  { hint, places },
);

// ---------- 3. Level 2: the day ends quietly ----------
const before2 = await readSave(page);
await prepareToday();
const startedAt2 = await inHud();
const played2 = await playLevel();
const b2 = await bannerText();
const after2 = await readSave(page);
const ledgerDelta = after2.economyLedger
  .slice(before2.economyLedger.length)
  .reduce((sum, e) => sum + e.amount, 0);
await shot(page, "first-levels-l2-complete");
check(
  "3 Level 2: starts at once; Grandma's line + Inventory open + Day 2 begins; no Closing Time; wallet = ledger",
  startedAt2 &&
    played2 &&
    /Nice and steady\./.test(b2 ?? "") &&
    /Inventory is open/.test(b2 ?? "") &&
    /Day 2 begins/.test(b2 ?? "") &&
    !(await page.evaluate(() => !!document.querySelector('[data-testid="closing-time"]'))) &&
    after2.business.restaurantDay?.day === 2 &&
    after2.business.restaurantDay?.closingDue === false &&
    after2.credits - before2.credits === ledgerDelta,
  {
    b2,
    day: after2.business.restaurantDay,
    credits: [before2.credits, after2.credits],
    ledgerDelta,
  },
);

// ---------- 4. Level 7: the Market for a look ----------
await boot(page, at(7));
await page.click('nav button[data-nav="shop"]');
await sleep(900);
const market = await page.evaluate(() => ({
  cats: [...document.querySelectorAll('nav[aria-label="Shop categories"] button')].map((b) =>
    b.innerText.replace(/\s+/g, " ").trim(),
  ),
  notice: document.querySelector('[aria-live="polite"]')?.textContent ?? "",
}));
await shot(page, "first-levels-l7-market");
check(
  "4 Level 7: the Market opens with Knives and Cutting Boards to look at",
  market.cats.length === 2 &&
    /Knives$/.test(market.cats[0]) &&
    /Cutting Boards$/.test(market.cats[1]) &&
    /Level 10/.test(market.notice),
  market,
);

// ---------- 5. Level 10: the big moment ----------
await boot(page, at(10));
await prepareToday();
const played10 = await playLevel();
await sleep(600);
const grand = await page.evaluate(() =>
  document.querySelector('[data-testid="milestone-grand"]')?.innerText.replace(/\s+/g, " "),
);
await shot(page, "first-levels-l10-milestone");
await page.click('[data-testid="milestone-grand"]');
await sleep(900);
const b10 = await bannerText();
const nav10 = await navState();
check(
  "5 Level 10: the big card (Santoku, Maple Board, the menu next), tap → Level Complete with Grandma and the Restaurant open",
  played10 &&
    /THE ROOM COMES BACK/i.test(grand ?? "") &&
    /Santoku/.test(grand ?? "") &&
    /Maple Board/.test(grand ?? "") &&
    /first menu at Level 11/.test(grand ?? "") &&
    /Look at this place\./.test(b10 ?? "") &&
    /Restaurant is open/.test(b10 ?? "") &&
    nav10.every((n) => !n.locked),
  { grand, b10 },
);

// ---------- 6. 320 px ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(page, at(2));
const fit = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  small: [...document.querySelectorAll("nav button[data-nav]")]
    .filter((b) => b.getBoundingClientRect().height < 47.5)
    .map((b) => b.innerText),
  inside: [...document.querySelectorAll("nav button[data-nav]")].every((b) => {
    const r = b.getBoundingClientRect();
    return r.left >= 0 && r.right <= 320;
  }),
}));
await shot(page, "first-levels-320");
check(
  "6 at 320×568 the locked bar fits, buttons ≥ 48 px",
  fit.overflow <= 0 && fit.small.length === 0 && fit.inside,
  fit,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("7 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `FIRST LEVELS E2E: ${failed.length} FAILURE(S)` : "FIRST LEVELS E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
