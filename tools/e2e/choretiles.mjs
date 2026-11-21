// Daily Maintenance as picture tiles all the way down (developer 2026-11-21: "make these also digitalized" = Opening clean / Night close; "check the whole"):
//   1. Tonight's close: every step is a numbered tile with its own painted icon (not the same moon), what spoils tonight is a banner with the foods' pictures;
//   2. closing supplies and the tools needed are tiles with a Restock / Get tool button;
//   3. "Ingredients for the full day" are picture tiles with Buy ›;
//   4. Opening clean shows the three area photographs and a green "No opening tasks" card;
//   5. no sideways scroll at 375×642 and 1280×720; no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  shot,
  openShortcut,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const DAY = 7;
const entry = (id, quantity, purchaseDay = DAY, unitCost = 100) => [
  id,
  { ingredientId: id, quantity, unitCost, purchaseDay },
];
const mk = () =>
  seedSave({
    credits: 5_000_000,
    business: {
      ...MOVED_IN_BUSINESS,
      calendar: { businessDay: DAY },
      inventory: Object.fromEntries([
        entry("cheddar", 2, DAY - 4, 450),
        entry("parsley", 7, DAY - 2),
      ]),
      supplies: { stock: { "paper-napkins": { units: 300, costBasis: 400 } } },
    },
    levelProgress: {
      currentLevelId: "level-40",
      highestUnlockedLevelId: "level-40",
      completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 2,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });

const { browser, page, logs } = await launch();
const open = async () => {
  await boot(page, mk());
  await openShortcut(page, "daily-check");
  await sleep(900);
};
const q = (sel) =>
  page.$$eval(sel, (els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
const attr = (sel, a) => page.$$eval(sel, (els, n) => els.map((e) => e.getAttribute(n)), a);
const noSideScroll = () =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const view = async (sel, name) => {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), sel);
  await sleep(400);
  await shot(page, name);
};

await page.setViewport({ width: 375, height: 642, deviceScaleFactor: 1, hasTouch: true });
await open();
const steps = await attr('[data-testid="closing-step"]', "data-step");
check("1a Tonight's close is numbered step tiles", steps.length >= 3, steps);
const icons = await page.$$eval('[data-testid="closing-step"] img[data-painted-icon]', (els) =>
  els.map((e) => e.getAttribute("data-painted-icon")),
);
check(
  "1b every step has its own painted icon (not one moon for all)",
  icons.length === steps.length && new Set(icons).size === icons.length,
  icons,
);
const spoiled = await attr("[data-spoils]", "data-spoils");
check("1c what spoils tonight shows the foods' pictures", spoiled.length >= 1, spoiled);
const supply = await attr('[data-testid="supply-tile"]', "data-supply");
check("2a the closing supplies / tools are tiles", supply.length >= 1, supply);
const tools = await q('[data-testid="supply-tile"] button');
check(
  "2b a missing tool has Get tool ›",
  tools.some((t) => /Get tool/.test(t)),
  tools.slice(0, 6),
);
const buy = await q('[data-testid="freshness-tile"] button');
check(
  "3 ingredients for the day are tiles with Buy ›",
  buy.some((t) => /Buy/.test(t)),
  buy.slice(0, 4),
);
check(
  "4 Opening clean: the area photos and a green card",
  (await page.$$('[data-testid="area-thumbs"] img')).length === 3 &&
    (await q('[data-testid="all-clear"]')).some((t) => /No opening tasks/.test(t)),
);
const team = await page.$$eval('[data-testid="team-tile"]', (els) =>
  els.map((e) => ({
    role: e.getAttribute("data-role"),
    portrait: !!e.querySelector("img"),
    hire: /Hire/.test(e.innerText),
  })),
);
check(
  "1d the people a service needs are tiles with a portrait and Hire ›",
  team.length >= 2 && team.every((t) => t.portrait && t.hire),
  team,
);
check("5a no sideways scroll on the phone", await noSideScroll());
await view('[data-testid="closing-plan"]', "choretiles-phone");

await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await open();
check("5b no sideways scroll in a wide window", await noSideScroll());
await view('[data-testid="closing-plan"]', "choretiles-wide");

const errors = logs.filter(
  (l) => /error/i.test(String(l)) && !/favicon|Failed to load resource/.test(String(l)),
);
check("6 no console errors", errors.length === 0, errors.slice(0, 3));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nCHORETILES: ALL PASS");
process.exit(failed.length ? 1 : 0);
