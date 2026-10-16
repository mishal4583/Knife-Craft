// Restaurant menu (developer 2026-10-16), restaurant build:
//   1. the dishes are listed in the order the campaign brings them (the level a dish joins
//      the menu, then the level it is first cooked) — not "on first, off last";
//   2. on / off is a toggle switch (role=switch); turning a dish off keeps its place;
//   3. popular restaurant (popularity 80): a tip suggests raising prices; at 50 there is none;
//   5. price cap: tapping + stops at the max price (≤ 1.5 × suggested), and the card says so;
//   4. the category chips aren't cut off (fully inside their row), the food-cost badge is one
//      line; fits at 320 / 390; no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const atLevel = (n, popularity) =>
  seedSave({
    credits: 50_000,
    business: { ...MOVED_IN_BUSINESS, popularity: { score: popularity } },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 2,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const openMenu = async (page) => {
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector(".map-hotspot-zone", { timeout: 15000 });
  await sleep(600);
  await page.evaluate(() =>
    [...document.querySelectorAll(".map-hotspot-zone")]
      .find((e) => /Manager \/ Office/.test(e.getAttribute("aria-label") ?? ""))
      ?.click(),
  );
  await sleep(900);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find(
        (b) =>
          /^\s*🍽️?\s*Menu\s*$/.test(b.textContent ?? "") ||
          (b.textContent ?? "").trim() === "🍽️Menu",
      )
      ?.click(),
  );
  await page.waitForSelector("[data-menu-dish]", { timeout: 15000 });
  await sleep(400);
};
const order = (page) =>
  page.$$eval("[data-menu-dish]", (els) => els.map((e) => e.getAttribute("data-menu-dish")));

const { browser, page, logs } = await launch();
await boot(page, atLevel(60, 80));
await openMenu(page);
const before = await order(page);
// Each card carries its campaign key: [joins the menu at, first cooked at, catalog index].
const keys = await page.$$eval("[data-menu-dish]", (els) =>
  els.map((e) => (e.getAttribute("data-menu-order") ?? "").split(".").map(Number)),
);
const ascending = keys.every((k, i) => {
  if (i === 0) return true;
  const p = keys[i - 1];
  for (let n = 0; n < 3; n++) if (k[n] !== p[n]) return k[n] > p[n];
  return true;
});
const states = await page.$$eval("[data-menu-dish]", (els) =>
  els.map((e) => e.getAttribute("data-menu-on")),
);
check(
  "1 dishes in campaign order (not on-first): the list matches the order the campaign brings them",
  before.length > 4 && keys.every((k) => k.length === 3 && k.every(Number.isFinite)) && ascending,
  {
    count: before.length,
    first: before.slice(0, 6),
    keys: keys.slice(0, 6).map((k) => k.join(".")),
  },
);

const sw = await page.$$eval("[data-menu-switch]", (els) =>
  els
    .slice(0, 3)
    .map((e) => ({ role: e.getAttribute("role"), checked: e.getAttribute("aria-checked") })),
);
const target = before[1];
await page.evaluate((id) => document.querySelector(`[data-menu-switch="${id}"]`)?.click(), target);
await sleep(500);
const after = await order(page);
// The knob sits inside its track: right when on, left when off.
const knobs = await page.$$eval("[data-menu-switch]", (els) =>
  els.slice(0, 2).map((b) => {
    const track = b.firstElementChild.getBoundingClientRect();
    const knob = b.firstElementChild.firstElementChild.getBoundingClientRect();
    return {
      on: b.getAttribute("aria-checked") === "true",
      inside: knob.left >= track.left && knob.right <= track.right,
      right: knob.left + knob.width / 2 > track.left + track.width / 2,
    };
  }),
);
const nowOn = await page.$eval(`[data-menu-dish="${target}"]`, (e) =>
  e.getAttribute("data-menu-on"),
);
check(
  "2 on/off is a toggle switch; turning a dish off keeps its place in the list",
  sw.length > 0 &&
    sw.every((s) => s.role === "switch") &&
    after.join() === before.join() &&
    nowOn === "false",
  { sw, knobs, target, nowOn, samePlace: after.indexOf(target) === before.indexOf(target) },
);

const tip80 = await page
  .$eval('[data-testid="menu-price-tip"]', (e) => e.textContent ?? "")
  .catch(() => "");
await shot(page, "restaurant-menu-390");
const layout = await page.evaluate(() => {
  const row = document.querySelector('[aria-label="Dish categories"]');
  const r = row.getBoundingClientRect();
  const chips = [...row.querySelectorAll("button")].map((b) => b.getBoundingClientRect());
  const badges = [...document.querySelectorAll("[data-menu-dish] .whitespace-nowrap")].map(
    (b) => b.getBoundingClientRect().height,
  );
  return {
    chipsInside: chips.every((c) => c.top >= r.top && c.bottom <= r.bottom),
    badgeOneLine: badges.length > 0 && badges.every((h) => h < 30),
  };
});
await boot(page, atLevel(60, 50));
await openMenu(page);
const tip50 = await page.$('[data-testid="menu-price-tip"]');
check(
  "3 popularity 80: a tip suggests raising prices; at 50 there is no tip",
  /popular \(80\/100\)/.test(tip80) &&
    /raise your menu prices/.test(tip80) &&
    /\+12%/.test(tip80) &&
    !tip50,
  { tip80 },
);
// 5. Price cap: tap + on the first dish until it stops.
const capDish = (await order(page))[0];
const sel = `[data-menu-dish="${capDish}"]`;
const money = (t) => Number((t.match(/\$([\d,]+(?:\.\d+)?)/) ?? [0, "NaN"])[1].replace(/,/g, ""));
const priceOf = () => page.$eval(`${sel} [data-testid="menu-price"]`, (e) => e.textContent ?? "");
const suggestedText = await page.$eval(`${sel} [data-testid="menu-price"]`, (e) =>
  e.nextElementSibling ? (e.nextElementSibling.textContent ?? "") : "",
);
const startPrice = money(await priceOf());
const suggestedPrice = /suggested price/.test(suggestedText) ? startPrice : money(suggestedText);
let taps = 0;
for (; taps < 120; taps++) {
  const disabled = await page.$eval(
    `${sel} button[aria-label^="Increase price"]`,
    (b) => b.disabled,
  );
  if (disabled) break;
  await page.click(`${sel} button[aria-label^="Increase price"]`);
  await sleep(40);
}
const capPrice = money(await priceOf());
const capLabel = await page.$eval(`${sel} [data-testid="menu-price-cap"]`, (e) => e.textContent);
await shot(page, "restaurant-menu-cap-390");
check(
  "5 price cap: + stops at the max price (≤ 1.5 × suggested) and the card says max price",
  taps > 0 &&
    taps < 120 &&
    capPrice > suggestedPrice &&
    capPrice <= Math.round(suggestedPrice * 1.5 * 100) / 100 + 0.001 &&
    /max price/.test(capLabel ?? ""),
  { capDish, startPrice, suggestedPrice, capPrice, taps, capLabel },
);
const fits = {};
for (const [w, h] of [
  [320, 568],
  [390, 844],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await sleep(400);
  fits[w] = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check(
  "4 chips not cut off, food-cost badge on one line, fits at 320 / 390, no page errors",
  layout.chipsInside &&
    layout.badgeOneLine &&
    Object.values(fits).every((o) => o <= 0) &&
    errors.length === 0,
  { layout, fits, errors: errors.slice(0, 3) },
);
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `MENU E2E: ${failed.length} FAILURE(S)` : "MENU E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
