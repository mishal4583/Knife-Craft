// Unified Restaurant phase N — every restaurant screen at every phone width the project tests
// (CLAUDE.md §10: 320×568, 360×640, 390×844, 430×900, 768×1024), on a RESTAURANT_MODE test
// build. For each width and screen: no sideways scroll, and every button inside the screen's
// restaurant panel is at least 48 px tall (rendered size).
//   Screens: the Pre-Service Check at Level 51 (news, staff, stock, supplies, guests — the
//   fullest sheet), Inventory's NEEDS ATTENTION, Restaurant → Staff (specialist chefs), Market
//   ingredients and supplies (bulk presets), Restaurant overview (one-restaurant note) and
//   Closing Time.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, clickButton, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const WIDTHS = [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 900],
  [768, 1024],
];
const save = (n, extraBusiness = {}) =>
  seedSave({
    business: { ...MOVED_IN_BUSINESS, ...extraBusiness },
    credits: 3000,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: true },
  });
const nav = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll("nav button")].find((x) => x.textContent.includes(l))?.click(),
    label,
  );
/** Overflow of the page, and buttons under 48 px inside `selector` (visible ones only). */
const measure = (selector) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const small = root
      ? [...root.querySelectorAll("button")]
          .map((b) => ({ b, r: b.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.height > 0 && r.height < 47.5)
          .map(({ b, r }) => `${b.textContent.trim().slice(0, 24)} (${Math.round(r.height)}px)`)
      : null;
    return {
      found: !!root,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      small,
    };
  }, selector);

const screens = [
  {
    name: "Pre-Service Check (L51)",
    selector: '[data-testid="pre-service-check"]',
    async open() {
      await boot(page, save(51));
      await nav("Kitchen");
      await sleep(400);
      await clickButton(page, /^See all orders/);
      await sleep(600);
      await page.evaluate(() => {
        const h = [...document.querySelectorAll("p")].find(
          (p) => p.textContent.trim() === "Potato Curry Base",
        );
        let n = h;
        for (let i = 0; i < 8 && n; i++) {
          n = n.parentElement;
          const b =
            n &&
            [...n.querySelectorAll("button")].find((x) => /^Prepare$/.test(x.textContent.trim()));
          if (b) {
            b.click();
            return;
          }
        }
      });
      await sleep(900);
    },
  },
  {
    name: "Inventory NEEDS ATTENTION (L51)",
    selector: '[data-testid="restaurant-attention"]',
    async open() {
      await boot(page, save(51));
      await nav("Inventory");
      await sleep(800);
    },
  },
  {
    name: "Restaurant → Staff (specialist chefs)",
    selector: '[data-testid="specialist-chefs"]',
    async open() {
      await boot(page, save(130));
      await nav("Restaurant");
      await sleep(700);
      await clickButton(page, /Staff$/);
      await sleep(700);
    },
  },
  {
    name: "Market → Ingredients (bulk presets)",
    selector: '[data-testid="bulk-presets"]',
    async open() {
      await boot(page, save(51));
      await nav("Market");
      await sleep(600);
      await clickButton(page, /Ingredients/);
      await sleep(700);
    },
  },
  {
    name: "Market → Takeaway (bulk presets)",
    selector: '[data-supply="paper-napkins"]',
    async open() {
      await boot(page, save(51));
      await nav("Market");
      await sleep(600);
      await clickButton(page, /Takeaway/);
      await sleep(700);
    },
  },
  {
    name: "Restaurant overview (one restaurant)",
    selector: '[data-testid="one-restaurant-note"]',
    async open() {
      await boot(page, save(60));
      await nav("Restaurant");
      await sleep(700);
    },
  },
  {
    name: "Closing Time (L95)",
    selector: '[data-testid="closing-time"]',
    async open() {
      await boot(
        page,
        save(95, {
          restaurantDay: {
            day: 4,
            opened: true,
            servicesDone: 3,
            servicesPlanned: 3,
            closingDue: true,
            openingCredits: 250000,
            openingLevel: 92,
          },
        }),
      );
      await nav("Kitchen");
      await sleep(400);
      await clickButton(page, /^See all orders/);
      await sleep(700);
    },
  },
];

for (const screen of screens) {
  const rows = [];
  for (const [w, h] of WIDTHS) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await screen.open();
    const m = await measure(screen.selector);
    if (w === 320) await shot(page, `widths-${screen.name.replace(/[^a-z0-9]+/gi, "-")}-320`);
    rows.push({ w, ...m });
  }
  check(
    `${screen.name}: fits 320–768 px (no sideways scroll), every button ≥ 48 px`,
    rows.every((r) => r.found && r.overflow <= 0 && r.small.length === 0),
    rows.filter((r) => !r.found || r.overflow > 0 || r.small.length > 0),
  );
}

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("no page errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `RESTAURANT WIDTHS E2E: ${failed.length} FAILURE(S)`
    : "RESTAURANT WIDTHS E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
