// Short game copy + the ⓘ InfoTip (developer 2026-10-16), restaurant build:
//   1. Market → Knives: each card has a ⓘ and no clipped description; tapping it opens one
//      bubble with the knife's description, fully on screen;
//   2. a second ⓘ closes the first (one bubble at a time); a tap outside closes it;
//   3. the ⓘ's touch area is ≥ 48 px;
//   4. Market → Second Floor at Level 60: machine cards show earnings / payback chips;
//   5. fits at 320 / 390 / 768 with no sideways scroll; no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const save = seedSave({
  credits: 50_000,
  business: { ...MOVED_IN_BUSINESS },
  levelProgress: {
    currentLevelId: "level-60",
    highestUnlockedLevelId: "level-60",
    completedLevelIds: Array.from({ length: 59 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 2,
  },
  story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
});
const bubble = (page) =>
  page
    .$$eval("[data-infotip-bubble]", (els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          text: (e.textContent ?? "").slice(0, 80),
        };
      }),
    )
    .catch(() => []);

const { browser, page, logs } = await launch();
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(page, save);
await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
await page.waitForSelector(".product-card [data-infotip]", { timeout: 15000 });
await sleep(500);

const cards = await page.$$eval(".product-card", (els) =>
  els.map((c) => ({
    tip: !!c.querySelector("[data-infotip]"),
    clamp: !!c.querySelector(".line-clamp-3"),
  })),
);
// Scroll each ⓘ to the middle first: at 320×568 a card's corner can sit under the bottom nav.
const tap = async (i) => {
  const h = (await page.$$(".product-card [data-infotip]"))[i];
  await h.evaluate((b) => b.scrollIntoView({ block: "center" }));
  await sleep(250);
  await h.click();
  await sleep(300);
};
await tap(1);
const open1 = await bubble(page);
await shot(page, "infotip-open-320");
check(
  "1 knife cards: a ⓘ each, no clipped description; ⓘ opens the description on screen",
  cards.length >= 4 &&
    cards.every((c) => c.tip && !c.clamp) &&
    open1.length === 1 &&
    open1[0].text.length > 20 &&
    open1[0].left >= 0 &&
    open1[0].right <= 320 &&
    open1[0].bottom <= 568,
  { cards: cards.length, open1 },
);

await tap(0);
const open2 = await bubble(page);
// "Outside": the first card's name plank (2026-10-22: with one card a row at 320 px the old
// fixed point (160, 40) landed on a Market tab and switched the tab).
const outside = await page.$eval(".product-card .shop-card__title", (t) => {
  const r = t.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
await page.mouse.click(outside.x, outside.y);
await sleep(300);
const open3 = await bubble(page);
check("2 one bubble at a time; a tap outside closes it", open2.length === 1 && open3.length === 0, {
  open2: open2.length,
  open3: open3.length,
});

const area = await page.$eval(".product-card [data-infotip]", (b) => {
  const r = b.getBoundingClientRect();
  return { w: r.width, h: r.height };
});
check("3 the ⓘ button is at least 48 px", area.w >= 47.5 && area.h >= 47.5, area);

await page.evaluate(() =>
  [...document.querySelectorAll("nav[aria-label='Shop categories'] button")]
    .find((b) => /Second Floor/.test(b.textContent ?? ""))
    ?.click(),
);
await page.waitForSelector("[data-floor-machine]", { timeout: 15000 });
await sleep(400);
const machine = await page.$eval("[data-floor-machine]", (c) => ({
  text: c.textContent ?? "",
  tip: !!c.querySelector("[data-infotip]"),
}));
await shot(page, "infotip-second-floor-320");
check(
  "4 Second Floor machines: ⓘ for the blurb, earnings and payback as chips",
  machine.tip &&
    /\/h/.test(machine.text) &&
    /~\d+ h/.test(machine.text) &&
    !/Pays itself/.test(machine.text),
  { text: machine.text.slice(0, 120) },
);

const fits = {};
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [768, 1024],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await sleep(400);
  fits[w] = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check(
  "5 fits at 320 / 390 / 768, no page errors",
  Object.values(fits).every((o) => o <= 0) && errors.length === 0,
  { fits, errors: errors.slice(0, 3) },
);
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `INFOTIP E2E: ${failed.length} FAILURE(S)` : "INFOTIP E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
