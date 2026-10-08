// The plating skip guard (developer report 2026-10-08: "when you tap one extra after cutting the
// plating and chef taking animation skips automatically, the sound while it skips is very annoying").
// Level 3 (Carrot Chop Bowl) in the built game:
//   1. baseline: the last cut, no more taps: time until the cooking clip appears;
//   2. an extra tap 150 ms after the last cut does NOT skip: the clip comes at the baseline time;
//   3. a deliberate tap 1.8 s after the last cut still fast-forwards the plating (clip sooner);
//   4. that skipped plating plays no plate chimes (no oscillator started once the skip tap is in).
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, clickButton } from "./harness.mjs";
import { CX, CY, HALF_W, playToReport, stepInfo } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
// Count every oscillator the game starts (each plate chime starts one).
await page.evaluateOnNewDocument(() => {
  window.__osc = 0;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const orig = Ctx.prototype.createOscillator;
  Ctx.prototype.createOscillator = function (...a) {
    window.__osc++;
    return orig.apply(this, a);
  };
});
const clipShown = () =>
  document.querySelector('[data-testid="cooking-clip"]')?.getAttribute("aria-hidden") === "false";
const tapAt = async (x, y) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await sleep(16);
  await page.mouse.up();
};
const save = seedSave({
  business: MOVED_IN_BUSINESS,
  settings: { sound: true, music: false, reducedMotion: false },
  levelProgress: {
    currentLevelId: "level-3",
    highestUnlockedLevelId: "level-3",
    completedLevelIds: ["level-1", "level-2"],
  },
  story: { introDone: true, milestoneMask: 0, finaleSeen: false },
});

/** Plays Level 3 to one cut before the end, makes the last cut, then `extraTapAfter` ms later one more tap (or none). Returns ms from the last cut to the clip, and oscillators started after the extra tap. */
async function run(extraTapAfter) {
  await boot(page, save);
  await clickButton(page, /Prepare$/);
  await sleep(800);
  // the restaurant build opens the day first
  await clickButton(page, /^OPEN THE RESTAURANT$/);
  await page.waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
    timeout: 30000,
  });
  // last step, one cut to go
  const r = await playToReport(page, {
    until: () => {
      const t = document.body.innerText;
      const m = t.match(/·\s*(\d+)\/(\d+)\s+[a-z-]+/i);
      const s = t.match(/STEP (\d+) OF (\d+)/);
      return !!m && +m[1] === +m[2] - 1 && (!s || s[1] === s[2]);
    },
  });
  if (!r.stopped) return { error: r.log.slice(-3) };
  await sleep(400);
  const s = await stepInfo(page);
  await tapAt(CX - HALF_W + ((s.n + 0.5) / s.m) * 2 * HALF_W, CY);
  const t0 = Date.now();
  let oscAtTap = null;
  if (extraTapAfter !== null) {
    await sleep(extraTapAfter);
    await tapAt(CX, CY);
    oscAtTap = await page.evaluate(() => window.__osc);
  }
  await page.waitForFunction(clipShown, { timeout: 20000, polling: 20 });
  const ms = Date.now() - t0;
  const oscAfter = (await page.evaluate(() => window.__osc)) - (oscAtTap ?? 0);
  return { ms, oscAfter, cuts: s };
}

const base = await run(null);
const extra = await run(150);
const skip = await run(1800);
check("1 baseline: the last cut → plating → chef takes the plate → clip", base.ms > 2000, base);
check(
  "2 an extra tap 150 ms after the last cut does not skip the plating",
  extra.ms >= base.ms - 400,
  { base: base.ms, extra: extra.ms },
);
check("3 a tap 1.8 s after the last cut still fast-forwards it", skip.ms < base.ms - 300, {
  base: base.ms,
  skip: skip.ms,
});
check("4 the skipped plating plays no plate chimes", skip.oscAfter === 0, skip);

const errors = logs.filter((l) => /pageerror/.test(l));
check("5 no page errors", errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(failed ? `PLATING SKIP E2E: ${failed} FAILURE(S)` : "PLATING SKIP E2E: ALL PASS");
process.exit(failed ? 1 : 0);
