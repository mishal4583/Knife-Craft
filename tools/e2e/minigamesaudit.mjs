// MINI-GAMES AUDIT (developer 2026-11-21: "make sure there is no issue like this in all mini game"): every mini-game (Dessert Run, Unload the Van, Car Park, Fridge Sort,
// Delivery Inspection, Stock the shelves, Sauce Station, Fridge Check, the dishwashing sink) at four window sizes (1917 x 912, 1280 x 720, 390 x 844, 844 x 390), opened the real way
// (a seeded save, the chip or the URL hook), once ready and once playing where the game has a start button. For each one:
//   M1 the game opens (its root is on screen)
//   M2 no picture fails to load (no <img> with no pixels) and no request answers 4xx / 5xx: a missing or renamed asset shows up here
//   M3 no page error and no sideways scroll
// Screenshots out/_a-<game>-<size>[-play].png (build contact sheets from them by eye: art cut off, covered or too small is not something a script can see).
// Controls that stick out of the window are only LISTED (the sink's cover box and Dessert Run's counter strip are meant to be larger than the window).
// Prints PASS/FAIL and exits 1 on any failure. Run:  ONLY=sink,inspection node minigamesaudit.mjs  for some games.
import {
  MOVED_IN_BUSINESS,
  PAIGE_QUIET,
  launch,
  boot,
  seedSave,
  sleep,
  openShortcut,
  SAVE_KEY,
} from "./harness.mjs";

const VPS = [
  ["wide", 1917, 912],
  ["lap", 1280, 720],
  ["phone", 390, 844],
  ["side", 844, 390],
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const levelProgress = (n) => ({
  currentLevelId: `level-${n}`,
  highestUnlockedLevelId: `level-${n}`,
  completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  campaignVersion: 4,
});
const story = { introDone: true, milestoneMask: 0xffff, finaleSeen: true };
const mk = (n, business = {}, extra = {}) =>
  seedSave({
    credits: 50_000,
    business: { ...MOVED_IN_BUSINESS, assistant: PAIGE_QUIET, ...business },
    levelProgress: levelProgress(n),
    story,
    ...extra,
  });
const STOCK = (ids) =>
  Object.fromEntries(
    ids.map((id) => [id, { ingredientId: id, quantity: 4, unitCost: 100, purchaseDay: 1 }]),
  );
const CRATE = ["tomato", "carrot", "cheddar", "apple", "salmon", "basil"];
const COUNTS = { tomato: 2, carrot: 1, cheddar: 1, apple: 1, salmon: 1, basil: 1 };
const click = (page, sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);

const GAMES = {
  "dessert-run": {
    url: "?dessertRun=58",
    save: () => mk(58),
    root: "dessert-run-game",
  },
  "unload-van": {
    url: "?kitchenDispatch=58",
    save: () => mk(58),
    root: "kitchen-dispatch-game",
  },
  "car-park": {
    url: "?carPark=40",
    save: () => mk(40, { carPark: { howto: true } }),
    root: "car-park-game",
  },
  fridgesort: {
    save: () =>
      mk(
        20,
        {
          inventory: STOCK([...CRATE, "potato"]),
          fridgeSort: { crate: CRATE, counts: COUNTS, seed: 1 },
          deliveryInspection: { seed: 1, inspected: 99, howto: 1 },
        },
        {},
      ),
    open: async (page) => {
      await openShortcut(page, "inventory");
      await sleep(1200);
      await click(page, '[data-testid="fridge-sort-chip"]');
      await sleep(900);
      await click(page, '[data-testid="sort-guide-ok"]');
    },
    root: "fridge-sort",
  },
  inspection: {
    save: () =>
      mk(20, {
        inventory: STOCK([...CRATE, "potato", "lettuce", "onion"]),
        fridgeSort: {
          crate: ["tomato", "carrot", "lettuce", "apple", "onion", "basil"],
          counts: { tomato: 2, carrot: 2, lettuce: 1, apple: 1, onion: 1, basil: 1 },
          seed: 1,
        },
      }),
    open: async (page) => {
      await openShortcut(page, "inventory");
      await sleep(1200);
      await click(page, '[data-testid="delivery-inspection-chip"]');
      await sleep(900);
      await click(page, '[data-testid="insp-guide-ok"]');
    },
    root: "delivery-inspection",
    play: async (page) => {
      await click(page, '[data-testid="insp-start"]');
    },
  },
  stockroom: {
    save: () =>
      mk(20, {
        stockroomSort: {
          crate: [
            { id: "tongs", sets: 1 },
            { id: "ladles", sets: 1 },
            { id: "whisks", sets: 1 },
          ],
          seed: 1,
        },
      }),
    open: async (page) => {
      await openShortcut(page, "inventory");
      await sleep(1200);
      await page.evaluate(() =>
        [...document.querySelectorAll("button")]
          .find((b) => /^\S*\s*Supplies/.test(b.textContent?.trim() ?? ""))
          ?.click(),
      );
      await sleep(900);
      await click(page, '[data-testid="stockroom-sort-chip"]');
      await sleep(900);
      await click(page, '[data-testid="stock-guide-ok"]');
    },
    root: "stockroom-sort",
  },
  sauce: {
    save: () => mk(20),
    open: async (page) => {
      await openShortcut(page, "inventory");
      await sleep(1200);
      await click(page, '[data-testid="sauce-station-chip"]');
      await sleep(1000);
      await click(page, '[data-testid="sauce-guide-ok"]');
    },
    root: "sauce-station",
    play: async (page) => {
      await click(page, '[data-testid="sauce-start"]');
    },
  },
  "fridge-check": {
    save: () =>
      mk(40, {
        calendar: { businessDay: 40 },
        inventory: Object.fromEntries(
          [
            ["salmon", 38],
            ["basil", 39],
            ["cheddar", 38],
            ["bread", 40],
            ["apple", 41],
            ["tomato", 35],
            ["garlic", 30],
          ].map(([id, b]) => [
            id,
            { ingredientId: id, quantity: 2, unitCost: 300, purchaseDay: b },
          ]),
        ),
        cleanliness: {
          tasks: [
            { kind: "spoiled-out", count: 1, since: 1 },
            { kind: "wrap-fridge", count: 1, since: 1 },
            { kind: "wipe-boards", count: 1, since: 1 },
          ],
          open: {},
          counters: { sink: 0, paper: 0 },
          cleanerAreas: ["kitchen", "dining", "restroom"],
          introSeen: true,
          cupboardAt: 21,
          lastStart: null,
          cleaned: 0,
          byCleaner: 0,
        },
      }),
    open: async (page) => {
      await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
      await page.waitForSelector(".map-hotspot-zone", { timeout: 15000 }).catch(() => null);
      await sleep(600);
      await page.evaluate(() =>
        [...document.querySelectorAll(".map-hotspot-zone")]
          .find((e) => /Manager \/ Office/.test(e.getAttribute("aria-label") ?? ""))
          ?.click(),
      );
      await sleep(900);
      await page.evaluate(() => {
        [...document.querySelectorAll('nav[aria-label="Business sections"] button')]
          .find((x) => x.textContent.includes("Cleanliness"))
          ?.click();
      });
      await sleep(900);
      await page.evaluate(() => {
        const open = [...document.querySelectorAll("button")].find((b) =>
          /View \d+ cleaning tasks?/.test(b.textContent),
        );
        if (!document.querySelector('[data-testid="area-details-kitchen"]')) open?.click();
      });
      await sleep(500);
      await page.evaluate(() =>
        document.querySelector('[data-task="spoiled-out"] button')?.click(),
      );
      await sleep(900);
      await click(page, '[data-testid="fc-guide-skip"]');
    },
    root: "fridge-check",
  },
  sink: {
    save: () =>
      mk(
        40,
        {
          supplies: {
            stock: {
              ...MOVED_IN_BUSINESS.supplies.stock,
              "dinner-plates": { units: 24, costBasis: 2400 },
              "dinner-forks": { units: 24, costBasis: 1200 },
              "frying-pans": { units: 2, costBasis: 1868 },
              "dish-soap": { units: 2, costBasis: 3000 },
            },
          },
          restaurantSupplies: {
            soapPct: 60,
            cleanerPct: 60,
            washing: 0,
            dirty: { "frying-pans": 1, "dinner-plates": 2 },
            washedTotal: 100,
            washedKitchen: 0,
            used: {},
            brokenTotal: 0,
          },
        },
        { story: { introDone: true, milestoneMask: 4095, finaleSeen: true } },
      ),
    open: async (page) => {
      await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
      await sleep(900);
      await openShortcut(page, "business");
      await sleep(700);
      await page.evaluate(() =>
        [...document.querySelectorAll("button")]
          .find((b) => /Cleanliness\d*$/.test(b.textContent.trim()))
          ?.click(),
      );
      await sleep(900);
      await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            '[data-testid="cleanliness-wash-up"] [data-testid="sink-wash"] button',
          ),
        ]
          .find((b) => /Wash/.test(b.textContent))
          ?.click(),
      );
      await sleep(1200);
    },
    root: "wash-up-sink",
  },
};

const names = ONLY ?? Object.keys(GAMES);
const { browser, page } = await launch();
const bad = [];
const results = [];
const fail = (id, detail) => {
  results.push(id);
  console.log("FAIL", id, detail);
};
page.on("response", (r) => {
  if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}`);
});
page.on("pageerror", (e) => bad.push(`pageerror ${String(e).slice(0, 100)}`));
for (const name of names) {
  const g = GAMES[name];
  for (const [vp, w, h] of VPS) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    try {
      if (g.url) {
        await page.goto(`http://localhost:4173/${g.url}`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.bridge, { timeout: 20000 });
        await page.evaluate(
          async (s, key) => {
            localStorage.clear();
            await window.bridge.storage.set([key], [JSON.stringify(s)]);
          },
          g.save(),
          SAVE_KEY,
        );
        await page.reload({ waitUntil: "networkidle0" });
        await page.waitForSelector(`[data-testid="${g.root}"]`, { timeout: 20000 });
        await page.waitForFunction(
          () => document.elementFromPoint(5, 5)?.closest("#loading-overlay") === null,
          { timeout: 20000 },
        );
      } else {
        await boot(page, g.save());
        await g.open(page);
      }
      await sleep(900);
      await page.screenshot({ path: `out/_a-${name}-${vp}.png` });
      if (g.play) {
        await g.play(page);
        await sleep(1200);
        await page.screenshot({ path: `out/_a-${name}-${vp}-play.png` });
      }
      const info = await page.evaluate((r) => {
        const root = document.querySelector(`[data-testid="${r}"]`);
        const brokenImgs = [...document.querySelectorAll("img")]
          .filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute("src"))
          .map((i) => i.getAttribute("src"));
        const vw = innerWidth,
          vh = innerHeight;
        // visible elements poking out of the window
        const out = [...(root ?? document).querySelectorAll("button,[data-testid]")]
          .filter((e) => {
            const b = e.getBoundingClientRect();
            return (
              b.width > 4 &&
              b.height > 4 &&
              (b.right > vw + 2 || b.bottom > vh + 2 || b.left < -2 || b.top < -2)
            );
          })
          .slice(0, 4)
          .map(
            (e) =>
              `${e.dataset.testid ?? e.tagName}:${Math.round(e.getBoundingClientRect().right)}x${Math.round(e.getBoundingClientRect().bottom)}`,
          );
        return {
          root: !!root,
          brokenImgs,
          out,
          sideways: document.documentElement.scrollWidth > vw + 1,
        };
      }, g.root);
      if (!info.root) fail(`M1 ${name} ${vp}`, "the game did not open");
      if (info.brokenImgs.length)
        fail(`M2 ${name} ${vp}`, `pictures with no pixels: ${info.brokenImgs.join(", ")}`);
      if (info.sideways) fail(`M3 ${name} ${vp}`, "sideways scroll");
      console.log(
        `${info.root && !info.brokenImgs.length && !info.sideways ? "PASS" : "    "} ${name} ${vp}${info.out.length ? `   (sticks out, listed only: ${info.out.join(" ")})` : ""}`,
      );
    } catch (e) {
      fail(`M1 ${name} ${vp}`, String(e).slice(0, 160));
    }
  }
}
const problems = [...new Set(bad)];
if (problems.length) fail("M2/M3 requests and page errors", problems.join(" | "));
else console.log("PASS no failed request and no page error in any game");
await browser.close();
console.log(
  results.length ? `MINI-GAMES AUDIT: ${results.length} FAILED` : "MINI-GAMES AUDIT: ALL PASS",
);
process.exit(results.length ? 1 : 0);
