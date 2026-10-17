// Market highlights from the Pre-Service Check (developer 2026-10-17: a Level 10 shopping list
// opened the Market with nothing highlighted), restaurant build:
//   1. Level 10's first shopping list → Buy on the stock pot → the Smallwares section opens on
//      All (not one group): the 4 tools the next levels need come first, each card says
//      "Needed at Level N · buy 1", the group chips count them, a "next levels" note shows;
//   2. the same with a save whose current level is already played (it plans the next one);
//   3. no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, clickButton } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const GRANDMA = {
  grandmasTools: { atLevel: 10 },
  supplies: {
    stock: {
      peelers: { units: 1, costBasis: 0 },
      "mixing-bowls": { units: 1, costBasis: 0 },
      "measuring-cups": { units: 1, costBasis: 0 },
    },
  },
};
for (const [n, current] of [
  [1, "level-10"],
  [2, "level-9"],
]) {
  await boot(
    page,
    seedSave({
      credits: 278_296,
      business: { ...MOVED_IN_BUSINESS, ...GRANDMA },
      levelProgress: {
        currentLevelId: current,
        highestUnlockedLevelId: "level-10",
        completedLevelIds: Array.from({ length: 9 }, (_, i) => `level-${i + 1}`),
        campaignVersion: 2,
      },
      story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    }),
  );
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(600);
  await clickButton(page, /^Prepare$/);
  await sleep(1500);
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-shopping-tool="stock-pot"] button')]
      .find((b) => /^Buy/.test(b.textContent.trim()))
      ?.click(),
  );
  await sleep(1500);
  const m = await page.evaluate(() => ({
    group: [...document.querySelectorAll('[aria-label$="groups"] button[aria-pressed="true"]')].map(
      (b) => b.textContent.trim(),
    ),
    chips: document.querySelectorAll("[data-group-needs]").length,
    first: [...document.querySelectorAll("[data-supply]")]
      .slice(0, 4)
      .map((c) => c.getAttribute("data-needed")),
    note: document.querySelector("[data-supply] [data-testid='need-note']")?.textContent ?? "",
    soon: !!document.querySelector('[data-testid="market-soon-culinary"]'),
  }));
  check(
    n === 1
      ? "1 Level 10 shopping list → Market: opens on All, the 4 next-level tools first and labelled, chips count them"
      : "2 a save whose current level is already played still highlights the next level's tools",
    /^All/.test(m.group[0] ?? "") &&
      m.first.every((w) => w === "soon") &&
      /Needed at Level \d+ · buy 1/.test(m.note) &&
      m.chips >= 2 &&
      m.soon,
    m,
  );
}
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("3 no page errors", errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `MARKET NEEDS LEVEL E2E: ${failed.length} FAILURE(S)`
    : "MARKET NEEDS LEVEL E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
