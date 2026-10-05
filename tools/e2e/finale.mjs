// The finale (developer decisions #21 and #22):
//   1. finishing the 100th level plays the finale once, after the level is paid;
//   2. a platform pause stops its beat timer, freezes its animations and ignores
//      taps; after the resume it carries on from where it was;
//   3. "BACK TO THE KITCHEN" lands on the Kitchen home screen (it used to leave
//      the player on the Order Board), with nothing paid twice.
// The platform pause is the mock Bridge's own pause state (PAUSE_STATE_CHANGED),
// the same event Playgama sends. Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, clickButton, readSave, shot, text } from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async (page) => (await text(page)).replace(/\s+/g, " ");

const { browser, page, logs } = await launch();

// 99 levels done (2–100), Level 1 still open: finishing it is the 100th.
const done = Array.from({ length: 99 }, (_, i) => `level-${i + 2}`);
await boot(
  page,
  seedSave({
    credits: 5000000,
    levelProgress: {
      currentLevelId: "level-1",
      highestUnlockedLevelId: "level-101",
      completedLevelIds: done,
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  }),
);

// Kitchen → Order Board → First Slice.
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
    if (b) {
      b.click();
      return;
    }
  }
});
await page.waitForFunction(
  () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
  {
    timeout: 30000,
  },
);
const played = await playToReport(page);
await clickButton(page, /^Continue$/);
await sleep(900);
if (/ORDER READY/i.test(await flat(page))) {
  await clickButton(page, /^Serve to /);
  await sleep(900);
}
await clickButton(page, /^Finish Level$/);
const paid = await readSave(page);

// ---------- 1. The finale plays once the level is paid ----------
await page
  .waitForFunction(() => /keep a promise/.test(document.body.innerText), { timeout: 8000 })
  .catch(() => undefined);
const first = await flat(page);
check(
  "1 finishing the 100th level plays the finale after the level is saved",
  played.ok &&
    /keep a promise/.test(first) &&
    paid.levelProgress.completedLevelIds.length === 100 &&
    paid.story.finaleSeen === true,
  { played: played.ok, completed: paid.levelProgress.completedLevelIds.length },
);
await shot(page, "finale-1-first-beat");

// ---------- 2. A platform pause holds the beat ----------
const setPlatformPause = (p) =>
  page.evaluate((v) => window.bridge.platform._platformBridge._setPauseState(v), p);
await sleep(1000);
await setPlatformPause(true);
await sleep(300);
const pausedState = await page.evaluate(() => {
  const el = document.querySelector('[data-story-paused="true"]');
  const art = el?.querySelector(".kc-story-text");
  return { marked: !!el, playState: art ? getComputedStyle(art).animationPlayState : null };
});
// The first beat holds 4.2 s; 6 s paused (and a tap) must not move it on.
await sleep(6000);
await page.evaluate(() => document.querySelector('[data-story-paused="true"]')?.click());
await sleep(400);
const whilePaused = await flat(page);
check(
  "2a while paused the beat stays, its animations are frozen and taps are ignored",
  pausedState.marked &&
    pausedState.playState === "paused" &&
    /keep a promise/.test(whilePaused) &&
    !/You built this/.test(whilePaused),
  pausedState,
);
const resumedAt = Date.now();
await setPlatformPause(false);
await page.waitForFunction(() => !/keep a promise/.test(document.body.innerText), {
  timeout: 8000,
});
const movedAfter = Date.now() - resumedAt;
check(
  "2b after the resume it carries on with the time that was left (not a fresh 4.2 s, not at once)",
  movedAfter > 1500 &&
    movedAfter < 4000 &&
    !(await page.evaluate(() => !!document.querySelector('[data-story-paused="true"]'))),
  { movedAfterMs: movedAfter },
);

// ---------- 3. BACK TO THE KITCHEN → Kitchen home ----------
await page.waitForFunction(() => /BACK TO THE KITCHEN/.test(document.body.innerText), {
  timeout: 15000,
});
await shot(page, "finale-2-last-beat");
await clickButton(page, /^BACK TO THE KITCHEN$/);
await sleep(1200);
const home = await flat(page);
const after = await readSave(page);
check(
  "3a BACK TO THE KITCHEN lands on the Kitchen home screen, not the Order Board",
  /See all orders/.test(home) && !/BACK TO THE KITCHEN/.test(home),
  home.slice(0, 160),
);
check(
  "3b the finale paid nothing and changed nothing (wallet and ledger as after Finish Level)",
  after.credits === paid.credits &&
    after.economyLedger.length === paid.economyLedger.length &&
    after.story.finaleSeen === true,
  { before: paid.credits, after: after.credits },
);
await shot(page, "finale-3-kitchen");

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("4 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `FINALE E2E: ${failed.length} FAILURE(S)` : "FINALE E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
