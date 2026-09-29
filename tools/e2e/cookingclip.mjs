// The cooking clip after every dish, in the built game:
//   1. after the chef's hands take the plate, the clip appears (Knife Report not yet shown), the
//      video really plays, SKIP › is offered over the old watermark corner, and when it ends the Knife Report follows;
//   2. "Prep Again" → the clip plays again for the next dish; SKIP › goes straight to the report;
//   3. a tap anywhere on the clip also skips it;
//   4. with Sound off in Settings the clip is muted; with Sound on it plays with sound.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, clickButton, shot, save } from "./harness.mjs";
import { playToReport, stepInfo } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const clipShown = () =>
  document.querySelector('[data-testid="cooking-clip"]')?.getAttribute("aria-hidden") === "false";
const clipGone = () => !document.querySelector('[data-testid="cooking-clip"]');
const video = (page) =>
  page.evaluate(() => {
    const v = document.querySelector('[data-testid="cooking-clip"] video');
    return v
      ? {
          t: v.currentTime,
          paused: v.paused,
          muted: v.muted,
          src: v.currentSrc.replace(/^.*\//, ""),
          duration: v.duration,
        }
      : null;
  });

const { browser, page, logs } = await launch();

/** Plays the dish on screen until the clip appears. */
async function cookUntilClip() {
  await page.waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
    timeout: 30000,
  });
  const r = await playToReport(page, { until: clipShown });
  return r.stopped === true;
}

// ---------- 1. the clip plays through to the Knife Report ----------
await boot(page, seedSave({ settings: { sound: true, music: true, reducedMotion: false } }));
await clickButton(page, /Prepare$/);
check("1a the clip appears after the plate is taken", await cookUntilClip());
check("1b the Knife Report waits for it", !(await stepInfo(page)).report);
await sleep(900);
const v1 = await video(page);
check("1c the video is really playing", !!v1 && v1.t > 0.3 && !v1.paused, v1);
check(
  "1d SKIP › is offered (≥ 48 px)",
  await page.evaluate(() => {
    const b = document.querySelector('[aria-label="Skip cooking"]');
    const r = b?.getBoundingClientRect();
    return !!r && r.width >= 48 && r.height >= 48;
  }),
);
check(
  "1d2 SKIP › covers the corner where the source film's AI watermark was (the whole mark)",
  await page.evaluate(() => {
    const clip = document.querySelector('[data-testid="cooking-clip"]').getBoundingClientRect();
    const pill = document.querySelector('[aria-label="Skip cooking"] span').getBoundingClientRect();
    // The mark: centre (600, 1160), ~50 px wide in the 720×1280 source.
    const cx = clip.left + (600 / 720) * clip.width;
    const cy = clip.top + (1160 / 1280) * clip.height;
    const half = (28 / 720) * clip.width;
    return (
      pill.left <= cx - half &&
      pill.right >= cx + half &&
      pill.top <= cy - half &&
      pill.bottom >= cy + half
    );
  }),
);
check("1e with Sound on, the clip plays with sound", v1 && v1.muted === false, v1);
await shot(page, "cooking-1-clip");
await page.waitForFunction(() => /KNIFE REPORT/.test(document.body.innerText), { timeout: 8000 });
check(
  "1f when it ends, the Knife Report follows and the clip is gone",
  await page.evaluate(clipGone),
);

// ---------- 2. next dish: clip again, SKIP ----------
await clickButton(page, /^Prep Again$/);
check("2a the next dish gets the clip too", await cookUntilClip());
await sleep(500);
const t0 = Date.now();
await page.evaluate(() => document.querySelector('[aria-label="Skip cooking"]').click());
await page.waitForFunction(() => /KNIFE REPORT/.test(document.body.innerText), { timeout: 3000 });
check("2b SKIP › goes straight to the Knife Report", Date.now() - t0 < 1500, Date.now() - t0);

// ---------- 3. tap to skip ----------
await clickButton(page, /^Prep Again$/);
check("3a clip shown", await cookUntilClip());
await sleep(600);
await page.mouse.click(215, 500);
await page.waitForFunction(() => /KNIFE REPORT/.test(document.body.innerText), { timeout: 3000 });
check("3b a tap on the clip skips it", await page.evaluate(clipGone));

// ---------- 4. Sound off → muted ----------
await boot(page, seedSave({ settings: { sound: false, music: true, reducedMotion: false } }));
await clickButton(page, /Prepare$/);
check("4a clip shown", await cookUntilClip());
await sleep(700);
const v4 = await video(page);
check("4b with Sound off the clip is muted (and still plays)", v4?.muted === true && v4.t > 0, v4);
await page.evaluate(() => document.querySelector('[aria-label="Skip cooking"]').click());

check("console has no errors", logs.filter((l) => /^error|pageerror/i.test(l)).length === 0, logs);
save("cookingclip-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed === 0 ? "\nCOOKING CLIP E2E: ALL PASS" : `\nCOOKING CLIP E2E: ${failed} FAILURE(S)`,
);
process.exit(failed === 0 ? 0 : 1);
