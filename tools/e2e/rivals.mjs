// Chef Pride, Phase 2 (developer 2026-11-23: rival chefs with a voice), restaurant build:
//   1. Restaurant Progress shows the next rival's chef under "Next: pass ..." from Level 8 ("Chef Xxx: ..."), and nothing below Level 8;
//   2. the Kitchen's rank card shows the chef's line on a tall window (390x844) and not on a short one (360x640: the card stays two lines);
//   3. Paige (hired, tips on) tells the player about a FEATURED rival just before the level that passes them: two short lines, "Go there" opens Progress;
//      once said it does not come back (a reload of the same save shows it no more);
//   4. no sideways scroll and no overlap with the shortcut column at 320x568, 390x844 and 1280x720; no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot, readSave } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const saveAt = (completed, assistant, credits = 500000) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      assistant,
      sectionsSeen: ["shop", "inventory", "rack", "business"], // Grandma's pointers are done, so Paige's turn comes
    },
    credits,
    levelProgress: {
      currentLevelId: `level-${completed + 1}`,
      highestUnlockedLevelId: `level-${completed + 1}`,
      completedLevelIds: Array.from({ length: completed }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const QUIET = { hired: true, seen: [], tipsOff: true };
// tips ON; the tips that also apply at Level 18 (restock, fish-board, second-floor) are already given, so the rival message is the one offered
const TIPS = { hired: true, seen: ["restock", "fish-board", "second-floor"], tipsOff: false };
const click = (page, sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
const { browser, page, logs } = await launch();
/** Opens Restaurant Progress from the Kitchen's rank card: money waiting sends the player to Achievements first, so it is collected, then back. */
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

// ---- 1. Progress ----
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await boot(page, saveAt(9, QUIET)); // Level 10: the next rival to pass is Curry Corner (Level 11)
await sleep(1500);
await openProgress();
const hero = await page.evaluate(() => ({
  hero: !!document.querySelector('[data-testid="city-rank-hero"]'),
  line: document.querySelector('[data-testid="rival-chef-line"]')?.textContent?.trim() ?? null,
  next:
    document.querySelector('[data-testid="city-rank-hero"]')?.innerText.replace(/\s+/g, " ") ?? "",
}));
await shot(page, "rivals-progress");
check(
  "1a Progress shows the next rival's chef from Level 8 ('Chef Arjun: ...' for Curry Corner)",
  hero.hero && /^👨‍🍳 Chef Arjun: “Spice takes patience\. Do you have any\?”$/.test(hero.line ?? ""),
  hero,
);
await boot(page, saveAt(5, QUIET)); // Level 6: before the ranking news
await sleep(1500);
await openProgress();
const early = await page.evaluate(() => ({
  hero: !!document.querySelector('[data-testid="city-rank-hero"]'),
  line: document.querySelector('[data-testid="rival-chef-line"]')?.textContent ?? null,
}));
check("1b below Level 8 there is no chef line", early.hero && early.line === null, early);

// ---- 2. Kitchen card ----
await boot(page, saveAt(9, QUIET));
await sleep(1500);
const tall = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="kitchen-rival-chef"]');
  const r = el?.getBoundingClientRect();
  return { shown: !!r && r.width > 0 && r.height > 0, text: el?.textContent ?? null };
});
await page.evaluate(() => {
  const g = document.querySelector('[data-testid="guide-card"]');
  [...(g?.querySelectorAll("button") ?? [])]
    .find((b) => /^Later$/.test(b.textContent.trim()))
    ?.click();
});
await sleep(800);
await shot(page, "rivals-kitchen-390");
check(
  "2a the Kitchen rank card shows the chef on 390x844",
  tall.shown && /^Chef Arjun: /.test(tall.text ?? ""),
  tall,
);
await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 1 });
await sleep(700);
const short = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="kitchen-rival-chef"]')?.getBoundingClientRect();
  return { shown: !!r && r.width > 0 && r.height > 0 };
});
await shot(page, "rivals-kitchen-360");
check("2b it is hidden on a short 360x640 window", !short.shown, short);

// ---- 3. Paige ----
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await boot(page, saveAt(17, TIPS, 300)); // Level 18 passes Harbor Grill (featured); Pasta Fresca fell at 17
let beat = null;
for (let i = 0; i < 14 && !beat; i++) {
  await sleep(700);
  // the Restaurant Guide's card (achievement money waiting) comes first: "Later" puts it off for ten levels
  await page.evaluate(() => {
    const g = document.querySelector('[data-testid="guide-card"]');
    [...(g?.querySelectorAll("button") ?? [])]
      .find((b) => /^Later$/.test(b.textContent.trim()))
      ?.click();
  });
  beat = await page.evaluate(
    () =>
      document.querySelector('[data-testid="assistant-host"]')?.innerText.replace(/\s+/g, " ") ??
      null,
  );
}
await shot(page, "rivals-paige");
check(
  "3a Paige says who is next and that their chef is talking big (line 1)",
  !!beat && /Harbor Grill is next, and Chef Nils is talking big\./.test(beat),
  beat,
);
await click(page, '[data-testid="assistant-next"]');
await sleep(600);
const line2 = await page.evaluate(
  () => document.querySelector('[data-testid="assistant-text"]')?.textContent ?? null,
);
check(
  "3a2 then what the chef says (line 2)",
  /^"The sea is rough\. Dinner service will be rougher\."$/.test(line2 ?? ""),
  line2,
);
await click(page, '[data-testid="assistant-go"]');
await sleep(1200);
check(
  "3b 'Go there' opens Progress",
  await page.evaluate(() => !!document.querySelector('[data-testid="city-rank-hero"]')),
);
const seen = (await readSave(page))?.business?.assistant?.seen ?? [];
check("3c the message is marked as given", seen.includes("rival:harbor-grill"), seen);
await page.reload({ waitUntil: "networkidle0" });
await sleep(4000);
const again = await page.evaluate(
  () =>
    document.querySelector('[data-testid="assistant-host"]')?.innerText.replace(/\s+/g, " ") ??
    null,
);
check(
  "3d after a reload it does not come back",
  !again || !/Harbor Grill is next/.test(again),
  again,
);

// ---- 4. fits ----
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [1280, 720],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, saveAt(9, QUIET));
  await sleep(1500);
  const f = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="kitchen-rank"]');
    const r = el?.getBoundingClientRect();
    const col = document
      .querySelector('[data-testid="daily-check-shortcut"]')
      ?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overlapsColumn:
        !!r && !!col && r.right > col.left + 1 && r.top < col.bottom && r.bottom > col.top,
    };
  });
  await shot(page, `rivals-fit-${w}`);
  check(
    `4 ${w}x${h}: no sideways scroll, the rank card clear of the shortcut column`,
    f.overflow <= 0 && !f.overlapsColumn,
    f,
  );
}

const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("5 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
