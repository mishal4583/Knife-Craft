// Daily Maintenance → "Running low · freshness watch" as picture tiles (developer 2026-11-21: "instead of just showing list … digitalized, the same system
// from the fridge check, showing the image of each ingredient"):
//   1. every ingredient that is low or going off is a tile (data-testid="freshness-tile") with its painted picture, name, status word, amount;
//   2. the picture shows its state (the expired one is the Fridge Check's spoiled twin / overlays; fresh is plain);
//   3. a freshness bar (role=meter) with a value for each stocked tile; the expired one reads 0-ish and says "Expired";
//   4. the button is Inventory › (Restock › for a low one) and opens its screen;
//   5. no horizontal scroll at 375×642 and 1280×720; two columns on the phone; no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, shot, openShortcut, text } from "./harness.mjs";

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
const STOCK = Object.fromEntries([
  entry("cheddar", 2, DAY - 4, 450), // expired
  entry("parsley", 7, DAY - 2, 100), // spoils tonight (a herb lasts 3 days)
  entry("mozzarella", 1.7, DAY - 3, 450), // spoils tonight (dairy lasts 4)
  entry("chicken", 1, DAY - 1, 450), // 2 left
  entry("sweetpotato", 2.8, DAY - 6, 100), // vegetables last 7: 1 left
  entry("avocado", 3, DAY - 5, 100), // fruit lasts 6: 1 left
  entry("potato", 30, DAY, 60),
]);
const mk = () =>
  seedSave({
    version: 2,
    credits: 250_000,
    levelProgress: {
      currentLevelId: "level-12",
      highestUnlockedLevelId: "level-12",
      completedLevelIds: Array.from({ length: 11 }, (_, i) => `level-${i + 1}`),
    },
    business: {
      calendar: { businessDay: DAY },
      inventory: STOCK,
      refrigerator: { refrigeratorId: "commercial-refrigerator" },
    },
  });

const { browser, page, logs } = await launch();
const open = async () => {
  await boot(page, mk());
  await openShortcut(page, "daily-check");
  await sleep(900);
};
const tiles = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="freshness-tile"]')].map((t) => ({
      id: t.getAttribute("data-ingredient"),
      state: t.getAttribute("data-state"),
      text: t.innerText.replace(/\s+/g, " ").trim(),
      img: !!t.querySelector("img[data-ingredient-icon],img[data-fc-twin]"),
      meter: t.querySelector('[role="meter"]')?.getAttribute("aria-valuenow") ?? null,
      button: [...t.querySelectorAll("button")].map((b) => b.innerText.trim()).join("|"),
    })),
  );
const noSideScroll = () =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

await page.setViewport({ width: 375, height: 642, deviceScaleFactor: 1, hasTouch: true });
await open();
const t1 = await tiles();
check(
  "1a the watch is picture tiles",
  t1.length >= 3,
  t1.map((t) => t.id),
);
check(
  "1b every tile has a picture",
  t1.every((t) => t.img),
  t1.map((t) => [t.id, t.img]),
);
const by = (id) => t1.find((t) => t.id === id);
check(
  "1c the parsley spoils tonight with its word and amount",
  !!by("parsley") &&
    /Spoils tonight/.test(by("parsley").text) &&
    by("parsley").button === "Inventory ›",
  by("parsley"),
);
check(
  "1d a food that spoils tonight is drawn going off, not clean",
  by("parsley")?.state === "NEAR_EXPIRY",
  by("parsley")?.state,
);
check(
  "2 the cheddar is drawn expired (spoiled look) and says Expired",
  !!by("cheddar") && by("cheddar").state === "EXPIRED" && /Expired/.test(by("cheddar").text),
  by("cheddar"),
);
check(
  "3 a stocked tile has a freshness bar",
  t1.filter((t) => t.meter !== null).length >= 3 &&
    t1.filter((t) => t.id !== "tomato").every((t) => t.meter !== null),
  t1.map((t) => [t.id, t.meter]),
);
const cols = await page.evaluate(() => {
  const g = document.querySelector('[data-testid="freshness-grid"]');
  return getComputedStyle(g).gridTemplateColumns.split(" ").length;
});
check("5a two columns on the phone", cols === 2, cols);
check("5b no sideways scroll on the phone", await noSideScroll());
await page.evaluate(() =>
  document.querySelector('[data-testid="freshness-grid"]')?.scrollIntoView({ block: "start" }),
);
await sleep(300);
await shot(page, "freshwatch-phone");

await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await open();
await page.evaluate(() =>
  document.querySelector('[data-testid="freshness-grid"]')?.scrollIntoView({ block: "start" }),
);
await sleep(400);
const colsW = await page.evaluate(() => {
  const g = document.querySelector('[data-testid="freshness-grid"]');
  return g ? getComputedStyle(g).gridTemplateColumns.split(" ").length : 0;
});
check("5c more columns in a wide window", colsW >= 4, colsW);
check("5d no sideways scroll in a wide window", await noSideScroll());
await shot(page, "freshwatch-wide");

// 4. a tile's button does its job: Inventory › opens the Inventory screen
await page.setViewport({ width: 375, height: 642, deviceScaleFactor: 1, hasTouch: true });
await open();
const opened = await page.evaluate(() => {
  const t = document.querySelector('[data-testid="freshness-tile"][data-ingredient="cheddar"]');
  const b = t && [...t.querySelectorAll("button")].find((x) => /Inventory/.test(x.innerText));
  b?.click();
  return !!b;
});
await sleep(900);
check(
  "4 Inventory › on the cheddar opens the Inventory",
  opened && !!(await page.$('[data-testid="inventory"]')),
);

const errors = logs.filter(
  (l) => /error/i.test(l.type ?? l) && !/favicon|Failed to load resource/.test(String(l.text ?? l)),
);
check("6 no console errors", errors.length === 0, errors.slice(0, 3));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nFRESHWATCH: ALL PASS");
process.exit(failed.length ? 1 : 0);
