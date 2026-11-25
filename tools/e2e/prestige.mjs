// Chef Pride, Phase 4 (developer 2026-11-23: restaurant prestige), restaurant build:
//   1. Restaurant Progress shows "Restaurant prestige" from Level 5: the tier (Local Favourite at Level 15 with a good record), the bar to the next tier, the five parts
//      that make the points and their total, all adding up;
//   2. below Level 5 there is no card;
//   3. the numbers follow play: more popularity and spotless services raise the points (the same level with a better record shows more);
//   4. the card fits 320x568, 390x844 and 1280x720: in view, no sideways scroll; no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const saveAt = (completed, pop = 50, spotless = 0) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: { hired: true, seen: [], tipsOff: true },
      sectionsSeen: ["shop", "inventory", "rack", "business"],
      popularity: { ...MOVED_IN_BUSINESS.popularity, score: pop },
      restaurantRecord: {
        services: completed,
        spotless,
        streak: 0,
        bestStreak: 0,
        at: { covers: 0, takeaway: 0, packed: 0, washed: 0, broken: 0 },
        lastHygiene: null,
      },
    },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${completed + 1}`,
      highestUnlockedLevelId: `level-${completed + 1}`,
      completedLevelIds: Array.from({ length: completed }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const click = (page, sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
const { browser, page, logs } = await launch();
/** Opens Restaurant Progress from the Kitchen's rank card (money waiting sends the player to Achievements first: collect it, go back). */
async function openProgress() {
  await click(page, '[data-testid="kitchen-rank"]');
  await sleep(1000);
  for (let i = 0; i < 8; i++) {
    const collected = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /^Collect \$/.test(x.textContent.trim()),
      );
      b?.click();
      return !!b;
    });
    if (!collected) break;
    await sleep(500);
  }
  if (
    await page.evaluate(
      () =>
        !document.querySelector('[data-testid="city-rank-hero"]') &&
        !!document.querySelector('button[aria-label="Back"]'),
    )
  ) {
    await click(page, 'button[aria-label="Back"]');
    await sleep(900);
    await click(page, '[data-testid="kitchen-rank"]');
    await sleep(1000);
  }
}
const card = () =>
  page.evaluate(() => {
    const c = document.querySelector('[data-testid="prestige-card"]');
    if (!c) return null;
    const parts = [...c.querySelectorAll("[data-part]")].map((x) => ({
      id: x.getAttribute("data-part"),
      points: Number(x.textContent.match(/\+(\d+)$/)?.[1] ?? NaN),
    }));
    const r = c.getBoundingClientRect();
    return {
      tier: c.getAttribute("data-tier"),
      name: c.querySelector('[data-testid="prestige-tier"]')?.textContent?.trim() ?? null,
      goal:
        c
          .querySelector('[data-testid="prestige-goal"]')
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? null,
      parts,
      sum: parts.reduce((t, p) => t + p.points, 0),
      inView: r.left >= 0 && r.right <= innerWidth,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await boot(page, saveAt(14, 66, 12)); // Level 15
await sleep(1500);
await openProgress();
const c1 = await card();
await shot(page, "prestige-progress");
const claimed = Number((c1?.goal ?? "").match(/^(\d+) of (\d+) points to (.+)$/)?.[1] ?? NaN);
check(
  "1 Level 15 with a good record: Local Favourite, five parts that add up to the points in the bar, and the next tier named",
  !!c1 &&
    // RULE CHANGE (developer 2026-11-25, Restaurant Progress redesign, commit 79a035c): the tier is shown by a painted icon, so the text is only "Local Favourite".
    c1.name === "Local Favourite" &&
    c1.parts.length === 5 &&
    c1.sum === claimed &&
    /to City Landmark$/.test(c1.goal ?? ""),
  c1,
);

await boot(page, saveAt(3));
await sleep(1500);
await openProgress();
check("2 below Level 5 there is no prestige card", (await card()) === null);

await boot(page, saveAt(14, 50, 0));
await sleep(1500);
await openProgress();
const plain = await card();
check(
  "3 the same level with a plainer record shows fewer points (popularity and spotless services count)",
  !!plain &&
    !!c1 &&
    plain.sum < c1.sum &&
    plain.parts.find((p) => p.id === "popularity")?.points === 0,
  { plain: plain?.sum, good: c1?.sum },
);

for (const [w, h] of [
  [320, 568],
  [390, 844],
  [1280, 720],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, saveAt(14, 66, 12));
  await sleep(1500);
  await openProgress();
  const f = await card();
  await shot(page, `prestige-fit-${w}`);
  check(
    `4 ${w}x${h}: the card is in view, no sideways scroll`,
    !!f && f.inView && f.overflow <= 0,
    f,
  );
}

const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("5 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
