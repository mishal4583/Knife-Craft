// THE LAST PAGE (developer 2026-10-11), classic build (the same App story path as the restaurant):
//   1. finishing the 250th level plays THE LAST PAGE once, its flag saved first; the wallet and
//      ledger don't move while it plays; no interstitial or Replay Bonus covers it;
//   2. a tap moves a beat on; a platform pause holds it; Enter on the last button lands on the
//      Kitchen; then the Level Complete card, then the Family Legacy ($50,000) banner, once each;
//   3. a reload never plays it again;
//   4. a save that finished 250 before it existed: THE LAST PAGE once on load, never on the next
//      launches, no money or ledger change; screenshots at 320 / 390 / 768.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, clickButton, readSave, shot, text } from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async (page) => (await text(page)).replace(/\s+/g, " ");
const BEAT1 = /Every recipe they ever wrote is in here/;
const OLD_SIX = 1 | 2 | 4 | 8 | 16 | 32;

const { browser, page, logs } = await launch();
// Ads available (recorded, never shown here): the ending must not be covered by one.
await page.evaluateOnNewDocument(() => {
  window.__adCalls = [];
  let real;
  Object.defineProperty(window, "bridge", {
    configurable: true,
    get: () => real,
    set(b) {
      real = b;
      const adv = b.advertisement;
      Object.defineProperty(adv, "isInterstitialSupported", {
        get: () => true,
        configurable: true,
      });
      Object.defineProperty(adv, "isRewardedSupported", { get: () => true, configurable: true });
      adv.showInterstitial = (p) => window.__adCalls.push(["interstitial", p]);
      adv.showRewarded = (p) => window.__adCalls.push(["rewarded", p]);
    },
  });
});

// ---------- 1. Finishing the 250th level ----------
// 249 levels done (2–250), Level 1 still open: finishing it is the 250th.
await boot(
  page,
  seedSave({
    credits: 5000000,
    levelProgress: {
      currentLevelId: "level-1",
      highestUnlockedLevelId: "level-250",
      completedLevelIds: Array.from({ length: 249 }, (_, i) => `level-${i + 2}`),
    },
    story: { introDone: true, milestoneMask: OLD_SIX | 128 | 256 | 512 | 1024, finaleSeen: true },
  }),
);
await clickButton(page, /^See all orders/);
await sleep(700);
await page.evaluate(() => {
  const h = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === "First Slice");
  let n = h;
  for (let i = 0; i < 8 && n; i++) {
    n = n.parentElement;
    const b =
      n &&
      [...n.querySelectorAll("button")].find((x) => /^(Prepare|Play)$/.test(x.textContent.trim()));
    if (b) return void b.click();
  }
});
await page.waitForFunction(
  () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
  { timeout: 30000 },
);
const played = await playToReport(page);
await clickButton(page, /^Continue$/);
await sleep(900);
if (/ORDER READY/i.test(await flat(page))) {
  await clickButton(page, /^Serve to /);
  await sleep(900);
}
await clickButton(page, /^Finish Level$/);
await page
  .waitForFunction(
    (src) => new RegExp(src).test(document.body.innerText),
    { timeout: 8000 },
    BEAT1.source,
  )
  .catch(() => undefined);
const atStart = await readSave(page);
const firstText = await flat(page);
await shot(page, "legacy-1-first-beat");
check(
  "1a finishing the 250th level plays THE LAST PAGE, its flag already saved",
  played.ok &&
    BEAT1.test(firstText) &&
    atStart.levelProgress.completedLevelIds.length === 250 &&
    (atStart.story.milestoneMask & 2048) !== 0 &&
    (atStart.story.milestoneMask & 64) !== 0 &&
    // The retired story banner's line (the Kitchen's own campaign card stays).
    !/All 250 levels mastered\. Every kitchen/.test(firstText),
  {
    played: played.ok,
    completed: atStart.levelProgress.completedLevelIds.length,
    mask: atStart.story.milestoneMask,
    text: firstText.slice(0, 160),
  },
);

// ---------- 2. Tap, pause, keyboard ----------
await sleep(400);
await page.mouse.click(200, 450);
await sleep(700);
const afterTap = await flat(page);
const setPause = (p) =>
  page.evaluate((v) => window.bridge.platform._platformBridge._setPauseState(v), p);
await setPause(true);
await sleep(5500);
const whilePaused = await flat(page);
await setPause(false);
check(
  "2a a tap moves the first beat on; a platform pause holds the beat",
  !BEAT1.test(afterTap) &&
    /Two hundred and fifty dishes later/.test(afterTap) &&
    /Two hundred and fifty dishes later/.test(whilePaused),
);
await page
  .waitForFunction(() => /THE LAST PAGE/i.test(document.body.innerText), { timeout: 15000 })
  .catch(() => undefined);
const lastText = await flat(page);
await shot(page, "legacy-1-last-beat");
const midSave = await readSave(page);
const ads = await page.evaluate(() => window.__adCalls);
check(
  "2b the last beat: title, quote, button; the wallet and ledger didn't move while it played; no ad or Replay Bonus",
  /THE LAST PAGE/i.test(lastText) &&
    /They asked you to keep it alive\. You did more than that\./.test(lastText) &&
    /BACK TO THE KITCHEN/i.test(lastText) &&
    midSave.credits === atStart.credits &&
    midSave.economyLedger.length === atStart.economyLedger.length &&
    ads.length === 0 &&
    !/Replay Bonus/i.test(lastText),
  { ads, credits: [atStart.credits, midSave.credits] },
);
// Keyboard: focus the button and press Enter.
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find((b) => /BACK TO THE KITCHEN/i.test(b.textContent))
    ?.focus(),
);
await page.keyboard.press("Enter");
// Record what shows next, in order, for ~12 s.
const seen = [];
for (let i = 0; i < 60; i++) {
  const t = await flat(page);
  const tag = /Level Complete/i.test(t)
    ? "level-complete"
    : /250 \/ 250 · Final Reward/.test(t)
      ? "family-legacy"
      : null;
  if (tag && seen.at(-1) !== tag) seen.push(tag);
  if (seen.includes("family-legacy") && !/Final Reward/.test(t)) break;
  await sleep(200);
  if (i % 10 === 9) await page.mouse.click(10, 10); // dismiss a banner by an outside tap
}
const home = await flat(page);
const endSave = await readSave(page);
check(
  "2c Enter on BACK TO THE KITCHEN lands on the Kitchen; then Level Complete, then the Family Legacy banner — once each",
  /See all orders/.test(home) &&
    !BEAT1.test(home) &&
    seen.join() === "level-complete,family-legacy" &&
    endSave.economyLedger.filter((e) => e.description === "campaign-complete").length === 1 &&
    (await page.evaluate(() => window.__adCalls.length)) === 0,
  {
    seen,
    legacyEntries: endSave.economyLedger.filter((e) => e.description === "campaign-complete")
      .length,
  },
);

// ---------- 3. A reload never plays it again ----------
await page.reload({ waitUntil: "networkidle0" });
await sleep(4000);
const reloaded = await flat(page);
check(
  "3 a reload never plays THE LAST PAGE again",
  !BEAT1.test(reloaded) && !/THE LAST PAGE/i.test(reloaded),
);

// ---------- 4. A save that already finished 250 ----------
const shots = {};
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [768, 1024],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(
    page,
    seedSave({
      credits: 7000000,
      levelProgress: {
        currentLevelId: "level-250",
        highestUnlockedLevelId: "level-250",
        completedLevelIds: Array.from({ length: 250 }, (_, i) => `level-${i + 1}`),
      },
      // It saw the old Level 250 banner (bit 64), never THE LAST PAGE.
      story: { introDone: true, milestoneMask: OLD_SIX | 64, finaleSeen: true },
    }),
  );
  await page
    .waitForFunction(
      (src) => new RegExp(src).test(document.body.innerText),
      { timeout: 8000 },
      BEAT1.source,
    )
    .catch(() => undefined);
  const s1 = await readSave(page);
  const t1 = await flat(page);
  await shot(page, `legacy-on-load-${w}`);
  const fit = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(4000);
  const t2 = await flat(page);
  const s2 = await readSave(page);
  shots[w] = {
    shown: BEAT1.test(t1),
    flagged: (s1.story.milestoneMask & 2048) !== 0,
    again: BEAT1.test(t2),
    money: s1.credits === s2.credits && s1.economyLedger.length === s2.economyLedger.length,
    overflow: fit.overflow,
  };
}
check(
  "4 a save that finished 250 before: THE LAST PAGE once on load (flag saved first), not on the next launch; no money change; fits at 320 / 390 / 768",
  Object.values(shots).every((r) => r.shown && r.flagged && !r.again && r.money && r.overflow <= 0),
  shots,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("5 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `LEGACY E2E: ${failed.length} FAILURE(S)` : "LEGACY E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
