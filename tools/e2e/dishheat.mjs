// Popular dishes cost more (Phase 2, restaurant/dishHeat.ts), restaurant build:
//   H1 a dish with heat 5 shows "🔥 +15%" on the Menu; a dish with no heat shows nothing;
//   H2 the tag fits at 320 px (no sideways scroll);
//   H3 no page errors.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const save = seedSave({
  credits: 50_000,
  business: { ...MOVED_IN_BUSINESS, dishHeat: { "biz-caprese-salad": 5 } },
  levelProgress: {
    currentLevelId: "level-40",
    highestUnlockedLevelId: "level-40",
    completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
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
const { browser, page, logs } = await launch();
try {
  await boot(page, save);
  await sleep(1500);
  await openMenu(page);
  const tags = await page.$$eval("[data-dish-hot]", (els) =>
    els.map((e) => [
      e.closest("[data-menu-dish]")?.getAttribute("data-menu-dish"),
      e.textContent.trim(),
    ]),
  );
  await shot(page, "dishheat-menu");
  check(
    "H1 the hot dish shows 🔥 +15%, nothing else does",
    tags.length === 1 && tags[0][0] === "biz-caprese-salad" && /🔥 \+15%/.test(tags[0][1]),
    tags,
  );
  await page.setViewport({ width: 320, height: 568 });
  await sleep(600);
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  check("H2 fits at 320 px", !sideways);
  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("H3 no page errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`
${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
