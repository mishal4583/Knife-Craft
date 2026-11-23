// Chef Pride, Phase 3a (developer 2026-11-23: chef titles), restaurant build:
//   1. Restaurant Progress shows "Your chef title" from Level 3: the title worn (the highest tier earned), the bar to the next tier and six identity chips with their stars;
//   2. below Level 3 there is no card;
//   3. the Kitchen's rank card shows the title on a tall window (390x844) and not on a short one (360x640);
//   4. the Achievements list shows the earned titles as badges (no money to collect for them);
//   5. the card fits 320x568, 390x844 and 1280x720: no sideways scroll, nothing cut off; no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const RECORD = { perfectCuts: 120, quickClean: 12, plates: 40, bestCombo: 9, services: 5 };
const saveAt = (completed) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: { hired: true, seen: [], tipsOff: true },
      sectionsSeen: ["shop", "inventory", "rack", "business"],
      chefRecord: RECORD,
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
    const c = document.querySelector('[data-testid="chef-title-card"]');
    if (!c) return null;
    const chips = [...c.querySelectorAll("[data-identity]")].map((x) => ({
      id: x.getAttribute("data-identity"),
      tier: Number(x.getAttribute("data-tier")),
    }));
    return {
      name: c.querySelector('[data-testid="chef-title-name"]')?.textContent?.trim() ?? null,
      goal:
        c
          .querySelector('[data-testid="chef-title-goal"]')
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? null,
      chips,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      inView: (() => {
        const r = c.getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth;
      })(),
    };
  });

// ---- 1. Progress, Level 10 ----
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await boot(page, saveAt(9));
await sleep(1500);
await openProgress();
const c1 = await card();
await shot(page, "titles-progress");
check(
  "1 Progress shows the title worn (Precision Chef: 120 perfect cuts), the bar to the next tier and six chips",
  !!c1 &&
    c1.name === "🔪 Precision Chef" &&
    /^120 of 300 perfect cuts to Master of the Edge$/.test(c1.goal ?? "") &&
    c1.chips.length === 6 &&
    c1.chips.find((x) => x.id === "precision")?.tier === 2 &&
    c1.chips.find((x) => x.id === "speed")?.tier === 1 &&
    c1.chips.find((x) => x.id === "organizer")?.tier === 0,
  c1,
);

// ---- 2. below Level 3 ----
await boot(page, saveAt(1));
await sleep(1500);
await openProgress();
const early = await card();
check("2 below Level 3 there is no title card", early === null, early);

// ---- 3. Kitchen chip ----
await boot(page, saveAt(9));
await sleep(1500);
const tall = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="kitchen-chef-title"]')?.getBoundingClientRect();
  return {
    shown: !!r && r.width > 0,
    text: document.querySelector('[data-testid="kitchen-chef-title"]')?.textContent ?? null,
  };
});
await page.evaluate(() => {
  const g = document.querySelector('[data-testid="guide-card"]');
  [...(g?.querySelectorAll("button") ?? [])]
    .find((b) => /^Later$/.test(b.textContent.trim()))
    ?.click();
});
await sleep(800);
await shot(page, "titles-kitchen-390");
check(
  "3a the Kitchen rank card shows the title on 390x844",
  tall.shown && tall.text === "Precision Chef",
  tall,
);
await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 1 });
await sleep(700);
const short = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="kitchen-chef-title"]')?.getBoundingClientRect();
  return { shown: !!r && r.width > 0 };
});
check("3b it is hidden on a short 360x640 window", !short.shown, short);

// ---- 4. Achievements ----
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await boot(page, saveAt(9));
await sleep(1500);
await click(page, '[data-testid="kitchen-rank"]'); // money waiting: the Achievements tab opens
await sleep(1200);
await page.evaluate(() => {
  // the "Earned" filter
  [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Earned")?.click();
});
await sleep(600);
const ach = await page.evaluate(() => document.body.innerText);
await shot(page, "titles-achievements");
check(
  "4 the Achievements list shows the earned titles (Steady Hand, Precision Chef, Quick Hands)",
  /Steady Hand/.test(ach) &&
    /Precision Chef/.test(ach) &&
    /Quick Hands/.test(ach) &&
    !/Master of the Edge/.test(ach),
  ach.slice(0, 200),
);

// ---- 5. fits ----
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [1280, 720],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, saveAt(9));
  await sleep(1500);
  await openProgress();
  const f = await card();
  await shot(page, `titles-fit-${w}`);
  check(
    `5 ${w}x${h}: the card is in view, no sideways scroll`,
    !!f && f.inView && f.overflow <= 0,
    f,
  );
}

const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("6 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
