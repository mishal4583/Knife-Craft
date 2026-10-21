// Market item showcase (developer 2026-10-21), restaurant build: every Market card shows its
// item big on a lit display stand (components/kc/common/ShopItemArt) instead of a small emoji.
//   S1 each Market tab with item cards (ingredients, the supply sections, the Second Floor)
//      shows one stand per card, the item at least 56 px (its longer side);
//   S2 the owned / in-stock badge sits on the stand, inside the card;
//   S3 at 320×568 the cards still fit (no sideways scroll) and the item stays ≥ 48 px;
//   Z  no console errors.
// Screenshots: shopart-<tab>.png, shopart-supplies-320.png.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const save40 = () =>
  seedSave({
    credits: 5_000_000,
    business: { ...MOVED_IN_BUSINESS },
    levelProgress: {
      currentLevelId: "level-40",
      highestUnlockedLevelId: "level-40",
      completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 2,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const tabs = (page) =>
  page.$$eval('nav[aria-label="Shop categories"] button', (bs) =>
    bs.map((b) => (b.textContent ?? "").replace(/^\d+|\d+$/g, "").trim()),
  );
const openTab = (page, label) =>
  page.evaluate((l) => {
    [...document.querySelectorAll('nav[aria-label="Shop categories"] button')]
      .find((b) => (b.textContent ?? "").includes(l))
      ?.click();
  }, label);
const measure = (page) =>
  page.evaluate(() => {
    const cards = [...document.querySelectorAll("article.product-card")];
    const stands = cards.map((c) => c.querySelector('[data-testid="shop-item-art"]'));
    const sizes = stands.map((s) =>
      Math.max(
        s?.querySelector(".shop-stage__item")?.getBoundingClientRect().height ?? 0,
        s?.querySelector(".shop-stage__item")?.getBoundingClientRect().width ?? 0,
      ),
    );
    const badgesInside = stands.every((s, i) => {
      const b = s?.querySelector(".absolute");
      if (!b) return true;
      const r = b.getBoundingClientRect();
      const c = cards[i].getBoundingClientRect();
      return r.left >= c.left - 0.5 && r.right <= c.right + 0.5;
    });
    return {
      cards: cards.length,
      stands: stands.filter(Boolean).length,
      minItem: Math.round(Math.min(...sizes, 999)),
      badgesInside,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

const { browser, page, logs } = await launch();
await boot(page, save40());
await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
await page.waitForSelector('nav[aria-label="Shop categories"]', { timeout: 15000 });
await sleep(600);
const seen = [];
for (const t of await tabs(page)) {
  await openTab(page, t);
  await sleep(500);
  const m = await measure(page);
  if (m.cards === 0) continue;
  seen.push({ t, ...m });
  await page.evaluate(() =>
    document.querySelector("article.product-card")?.scrollIntoView({ block: "start" }),
  );
  await sleep(300);
  await shot(page, `shopart-${t.replace(/\W+/g, "-").toLowerCase()}`);
}
check(
  "S1 every Market tab with cards shows one display stand per card, the item ≥ 56 px",
  seen.length >= 3 && seen.every((s) => s.stands === s.cards && s.minItem >= 56),
  seen,
);
check(
  "S2 owned / in-stock badges sit on the stand, inside the card",
  seen.every((s) => s.badgesInside),
);

await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await sleep(400);
const supplyTab = seen.find((s) => /Smallwares/i.test(s.t))?.t ?? seen[1]?.t;
await openTab(page, supplyTab);
await sleep(500);
const small = await measure(page);
await page.evaluate(() =>
  document.querySelector("article.product-card")?.scrollIntoView({ block: "start" }),
);
await sleep(300);
await shot(page, "shopart-supplies-320");
check(
  "S3 at 320×568 the cards fit (no sideways scroll), item ≥ 48 px",
  small.overflow <= 0 && small.stands === small.cards && small.minItem >= 48,
  { tab: supplyTab, ...small },
);
check("Z no console errors", logs.filter((l) => /^(error|pageerror)/.test(l)).length === 0, logs);

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
