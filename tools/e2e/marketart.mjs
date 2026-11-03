// Market art (developer 2026-11-03), restaurant build: the supply emoji were replaced by painted icons, the Floor team by portraits.
//   M1 every supply tab (Kitchen tools, Tableware, Packaging, Cleaning) shows a painted icon on EVERY card (none fell back to an emoji,
//      none failed to load: complete and naturalWidth > 0 after scrolling the list)
//   M2 the four tabs together show all 62 supplies' icons
//   M3 the Second Floor tab shows the Floor Server and Floor Cleaner portraits, loaded
//   M4 no network errors for the pictures and no console errors
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const save = seedSave({
  credits: 1_000_000,
  business: { ...MOVED_IN_BUSINESS },
  levelProgress: {
    currentLevelId: "level-40",
    highestUnlockedLevelId: "level-40",
    completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 3,
  },
  story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
});
const { browser, page, logs } = await launch();
const failedImages = [];
page.on("response", (r) => {
  if (/business\/(supplies|staff-portraits)\//.test(r.url()) && r.status() >= 400)
    failedImages.push(`${r.status()} ${r.url()}`);
});

await boot(page, save);
await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
await sleep(900);
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('nav[aria-label="Shop categories"] button')].map((b) =>
    (b.textContent ?? "").trim(),
  ),
);
const supplyTabs = tabs.filter(
  (t) => !/Knives|Cutting Boards|Ingredients|Blacksmith|Second Floor/.test(t),
);

const seen = new Set();
const perTab = [];
for (const label of supplyTabs) {
  await page.evaluate((l) => {
    [...document.querySelectorAll('nav[aria-label="Shop categories"] button')]
      .find((b) => (b.textContent ?? "").trim() === l)
      ?.click();
  }, label);
  await sleep(700);
  // scroll the whole list so every lazy picture loads
  await page.evaluate(async () => {
    const step = () => new Promise((r) => setTimeout(r, 120));
    const scroller = [...document.querySelectorAll("*")].find(
      (e) =>
        e.scrollHeight > e.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(e).overflowY),
    );
    if (scroller) {
      for (let y = 0; y <= scroller.scrollHeight; y += 260) {
        scroller.scrollTop = y;
        await step();
      }
      scroller.scrollTop = 0;
    }
  });
  await sleep(900);
  const info = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("img[data-supply-icon]")];
    const cards = document.querySelectorAll('[data-testid="shop-item-art"]');
    return {
      cards: cards.length,
      imgs: imgs.length,
      broken: imgs
        .filter((i) => !(i.complete && i.naturalWidth > 0))
        .map((i) => i.dataset.supplyIcon),
      ids: imgs.map((i) => i.dataset.supplyIcon),
    };
  });
  info.ids.forEach((id) => seen.add(id));
  perTab.push({ label, cards: info.cards, imgs: info.imgs, broken: info.broken });
  if (label === supplyTabs[0]) await shot(page, "market-art-tools");
  if (label === supplyTabs[supplyTabs.length - 1]) await shot(page, "market-art-last");
}
check(
  "M1 every supply card shows a painted icon, loaded (none fell back to an emoji)",
  perTab.length === 4 &&
    perTab.every((t) => t.cards > 0 && t.imgs === t.cards && t.broken.length === 0),
  perTab,
);
check("M2 the four supply tabs together show all 62 icons", seen.size === 62, { seen: seen.size });

await page.evaluate(() =>
  [...document.querySelectorAll('nav[aria-label="Shop categories"] button')]
    .find((b) => /Second Floor/.test(b.textContent ?? ""))
    ?.click(),
);
await sleep(1200);
const faces = await page.evaluate(() =>
  [...document.querySelectorAll("img[data-floor-staff-face]")].map((i) => ({
    role: i.dataset.floorStaffFace,
    ok: i.complete && i.naturalWidth > 0,
    w: Math.round(i.getBoundingClientRect().width),
  })),
);
await shot(page, "market-art-staff");
check(
  "M3 the Floor Server and Floor Cleaner portraits show, loaded",
  faces.length === 2 &&
    faces.some((f) => f.role === "server") &&
    faces.some((f) => f.role === "cleaner") &&
    faces.every((f) => f.ok && f.w >= 80),
  faces,
);
const errors = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check(
  "M4 no failed picture requests, no console errors",
  failedImages.length === 0 && errors.length === 0,
  {
    failedImages,
    errors: errors.slice(0, 3),
  },
);
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `MARKET ART E2E: ${failed.length} FAILURE(S)` : "MARKET ART E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
