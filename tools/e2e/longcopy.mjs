// Short game copy, in the running game (developer 2026-10-16 and 2026-10-23: "players won't
// read big sentences … show the issues with emojis"). Restaurant build. At Levels 25, 70 and
// 100 it opens the Kitchen, the order board, every Market tab, every map zone, every Business
// tab, Inventory, the Daily Check, Progress, Settings, the Recipe Book, Kitchen Upgrades and the
// Pre-Service Check, scrolling each, and lists every visible line longer than MAX_WORDS words
// (an InfoTip's bubble and screen-reader text don't count — that is where long copy goes).
// scripts/ui-copy-qa.mts guards the literal JSX; this guards the copy built from game data.
// Exits 1 when a line is too long. Env: LEVELS=25,70,100 MAXW=12.
import {
  launch,
  boot,
  seedSave,
  sleep,
  MOVED_IN_BUSINESS,
  openShortcut,
  clickButton,
} from "./harness.mjs";
const { browser, page } = await launch();
const [W, H] = (process.env.VP || "390x844").split("x").map(Number);
const MAXW = +(process.env.MAXW || 12);
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const found = new Map(); // text -> Set(screen)
let step = "";
const probe = async () => {
  const list = await page.evaluate((maxw) => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("[data-infotip-bubble], [role=tooltip], .sr-only, script, style, svg"))
        continue;
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join(" ")
        .trim();
      if (!own) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || +cs.opacity === 0)
        continue;
      const copy = el.cloneNode(true);
      copy.querySelectorAll(".sr-only, [data-infotip-bubble]").forEach((n) => n.remove());
      const full = copy.textContent.replace(/\s+/g, " ").trim();
      const words = full.split(" ").filter((w) => /[A-Za-z]/.test(w)).length;
      if (words > maxw && el.children.length < 6 && !el.closest("button, nav"))
        out.push(full.slice(0, 240));
    }
    return [...new Set(out)];
  }, MAXW);
  for (const t of list) {
    if (!found.has(t)) found.set(t, new Set());
    found.get(t).add(step);
  }
};
const go = async (name, fn) => {
  step = `${curLv} ${name}`;
  try {
    await fn();
  } catch (e) {
    console.log("ERR", name, e.message.slice(0, 80));
  }
  await sleep(1000);
  await probe();
  // scroll the main list to see below the fold
  for (let k = 0; k < 6; k++) {
    const more = await page.evaluate(() => {
      const s = [...document.querySelectorAll(".overflow-y-auto")].sort(
        (a, b) => b.clientHeight - a.clientHeight,
      )[0];
      if (!s || s.scrollTop + s.clientHeight >= s.scrollHeight - 4) return false;
      s.scrollBy(0, s.clientHeight * 0.8);
      return true;
    });
    if (!more) break;
    await sleep(350);
    await probe();
  }
};
let curLv = "";
for (const lv of (process.env.LEVELS || "25,70,100").split(",").map(Number)) {
  curLv = `L${lv}`;
  const inv = {
    bread: { ingredientId: "bread", quantity: 2, unitCost: 100, purchaseDay: 1 },
    tomato: { ingredientId: "tomato", quantity: 1, unitCost: 100, purchaseDay: 1 },
  };
  const save = seedSave({
    credits: 20000,
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: inv,
      secondFloor: {
        stations: { coffee: { level: 1, lastCollectAt: Date.now() - 3600e3 } },
        servers: 1,
        cleaners: 1,
      },
      cleanliness: {
        tasks: ["equipment", "grease", "floor", "tables", "toilet", "restroom-floor"].map(
          (kind) => ({ kind, count: 1, since: lv - 1 }),
        ),
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
    levelProgress: {
      currentLevelId: `level-${lv}`,
      highestUnlockedLevelId: `level-${lv}`,
      completedLevelIds: Array.from({ length: lv - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 4095, finaleSeen: true },
  });
  await go(`L${lv} kitchen`, () => boot(page, save));
  await go("kitchen-details", () =>
    page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) => /View Details/.test(b.textContent))
        ?.click(),
    ),
  );
  await go("board", () =>
    page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) => /See all orders/.test(b.textContent))
        ?.click(),
    ),
  );
  await go("market", () =>
    page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click()),
  );
  for (const c of [
    "knives",
    "boards",
    "ingredients",
    "blacksmith",
    "culinary",
    "service",
    "packaging",
    "cleaning",
    "second-floor",
  ])
    await go(`market:${c}`, () =>
      page.evaluate((x) => document.querySelector(`[data-category="${x}"]`)?.click(), c),
    );
  await go("map", () =>
    page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click()),
  );
  const zones = await page.evaluate(() =>
    [...document.querySelectorAll(".map-hotspot-zone")].map((z) => z.getAttribute("aria-label")),
  );
  for (const z of zones) {
    await go(`map:${z?.split("(")[0].trim().slice(0, 24)}`, () =>
      page.evaluate(
        (l) =>
          [...document.querySelectorAll(".map-hotspot-zone")]
            .find((e) => e.getAttribute("aria-label") === l)
            ?.click(),
        z,
      ),
    );
    await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
    await sleep(600);
  }
  await go("business", () => openShortcut(page, "business"));
  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Business sections"] button')].map((b) =>
      b.textContent.trim(),
    ),
  );
  for (const t of tabs)
    await go(`biz:${t.replace(/\W+/g, "")}`, () =>
      page.evaluate(
        (l) =>
          [...document.querySelectorAll('nav[aria-label="Business sections"] button')]
            .find((b) => b.textContent.trim() === l)
            ?.click(),
        t,
      ),
    );
  await go("inventory", () => openShortcut(page, "inventory"));
  await go("inventory-supplies", () =>
    page.evaluate(() =>
      [...document.querySelectorAll("[role=tablist] button, button")]
        .find((b) => /^📦?\s*Supplies/.test(b.textContent.trim()))
        ?.click(),
    ),
  );
  await go("dailycheck", () => openShortcut(page, "daily-maintenance"));
  await go("progress", () =>
    page
      .evaluate(() => {
        document.querySelector('[data-nav="kitchen"]')?.click();
      })
      .then(() => sleep(600))
      .then(() =>
        page.evaluate(() => document.querySelector('[data-testid="kitchen-rank"]')?.click()),
      ),
  );
  await go("settings", () =>
    page
      .evaluate(() => {
        document.querySelector('[data-nav="kitchen"]')?.click();
      })
      .then(() => sleep(600))
      .then(() => page.evaluate(() => document.querySelector('[aria-label="Settings"]')?.click())),
  );
  await go("psc", () =>
    page
      .evaluate(() => {
        document.querySelector('[data-nav="kitchen"]')?.click();
      })
      .then(() => sleep(700))
      .then(() => clickButton(page, /Prepare$/)),
  );

  await go("recipes", () =>
    page
      .evaluate(() => {
        document.querySelector('[data-nav="kitchen"]')?.click();
      })
      .then(() => sleep(600))
      .then(() =>
        page.evaluate(() =>
          [...document.querySelectorAll("button")]
            .find((b) => /📖|Recipe/.test(b.getAttribute("aria-label") ?? b.textContent))
            ?.click(),
        ),
      ),
  );
  await go("kitchen-upgrades", () =>
    page
      .evaluate(() => {
        document.querySelector('[data-nav="kitchen"]')?.click();
      })
      .then(() => sleep(600))
      .then(() => openShortcut(page, "business"))
      .then(() =>
        page.evaluate(() =>
          [...document.querySelectorAll('nav[aria-label="Business sections"] button')]
            .find((b) => /Upgrades/.test(b.textContent))
            ?.click(),
        ),
      ),
  );
}
await browser.close();
const rows = [...found]
  .map(([t, s]) => ({
    words: t.split(" ").filter((w) => /[A-Za-z]/.test(w)).length,
    screens: [...s].join(", "),
    text: t,
  }))
  .sort((a, b) => b.words - a.words);
for (const r of rows)
  console.log(`FAIL [${r.words} words] {${r.screens.slice(0, 80)}} ${r.text.slice(0, 200)}`);
console.log(
  rows.length
    ? `\nLONG COPY: ${rows.length} line(s) over ${MAXW} words`
    : `LONG COPY: none over ${MAXW} words`,
);
process.exit(rows.length ? 1 : 0);
