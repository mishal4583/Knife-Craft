// The cooking clip after every dish, in the built game:
//   1. after the chef's hands take the plate, the clip appears (Knife Report not yet shown), the
//      video really plays, SKIP › is offered over the old watermark corner, and when it ends the Knife Report follows;
//   2. "Prepare Again" → the clip plays again for the next dish; SKIP › goes straight to the report;
//   3. a tap anywhere on the clip also skips it;
//   4. with Sound off in Settings the clip is muted; with Sound on it plays with sound;
//   5. salads get the salad film (Level 10, Simple Garden Salad — the harness default save);
//      stove-cooked dishes the chef-cooking film (Level 36, Mushroom & Garlic Saute Prep);
//   6. fruit dishes get the fruit-cup film (Level 84, Pineapple & Mango Fresh Cup);
//   7. cut-and-plate dishes get the plating film (Level 3, Carrot Chop Bowl);
//   8. curries get the curry-pot film (Level 58, Pumpkin Curry Dice);
//   9. bread dishes get the bread film (Level 11, Garlic Bread).
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
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    {
      timeout: 30000,
    },
  );
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
check(
  "1e2 Level 10 (Simple Garden Salad) plays the salad film",
  (await page.evaluate(
    () => document.querySelector('[data-testid="cooking-clip"]').dataset.kind,
  )) === "salad" && /^chef-salad/.test(v1?.src ?? ""),
  v1?.src,
);
check("1e with Sound on, the clip plays with sound", v1 && v1.muted === false, v1);
await shot(page, "cooking-1-clip");
await page.waitForFunction(() => /KNIFE REPORT/.test(document.body.innerText), { timeout: 8000 });
check(
  "1f when it ends, the Knife Report follows and the clip is gone",
  await page.evaluate(clipGone),
);

// ---------- 2. next dish: clip again, SKIP ----------
await clickButton(page, /^Prepare Again$/);
check("2a the next dish gets the clip too", await cookUntilClip());
await sleep(500);
const t0 = Date.now();
await page.evaluate(() => document.querySelector('[aria-label="Skip cooking"]').click());
await page.waitForFunction(() => /KNIFE REPORT/.test(document.body.innerText), { timeout: 3000 });
check("2b SKIP › goes straight to the Knife Report", Date.now() - t0 < 1500, Date.now() - t0);

// ---------- 3. tap to skip ----------
await clickButton(page, /^Prepare Again$/);
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

// ---------- 5. a cooked dish gets the cooking film ----------
await boot(
  page,
  seedSave({
    levelProgress: {
      currentLevelId: "level-36",
      highestUnlockedLevelId: "level-36",
      completedLevelIds: Array.from({ length: 35 }, (_, i) => `level-${i + 1}`),
    },
  }),
);
await clickButton(page, /Prepare$/);
check("5a Level 36 (Mushroom & Garlic Saute Prep): clip shown", await cookUntilClip());
await sleep(800);
const v5 = await video(page);
check(
  "5b a cooked dish plays the chef-cooking film, not the curry or salad film",
  (await page.evaluate(
    () => document.querySelector('[data-testid="cooking-clip"]').dataset.kind,
  )) === "cooked" &&
    /^chef-cooking/.test(v5?.src ?? "") &&
    v5.t > 0.2,
  v5,
);
await shot(page, "cooking-5-cooked");
await page.waitForFunction(() => /KNIFE REPORT/.test(document.body.innerText), { timeout: 8000 });
check("5c when it ends, the Knife Report follows", await page.evaluate(clipGone));

// ---------- 6. a fruit dish gets the fruit-cup film ----------
await boot(
  page,
  seedSave({
    levelProgress: {
      currentLevelId: "level-84",
      highestUnlockedLevelId: "level-84",
      completedLevelIds: Array.from({ length: 83 }, (_, i) => `level-${i + 1}`),
    },
  }),
);
await clickButton(page, /Prepare$/);
check("6a Level 84 (Pineapple & Mango Fresh Cup): clip shown", await cookUntilClip());
await sleep(800);
const v6 = await video(page);
check(
  "6b a fruit dish plays the fruit-cup film",
  (await page.evaluate(
    () => document.querySelector('[data-testid="cooking-clip"]').dataset.kind,
  )) === "fruit" &&
    /^chef-fruit/.test(v6?.src ?? "") &&
    v6.t > 0.2 &&
    Math.abs(v6.duration - 3.84) < 0.1,
  v6,
);
await shot(page, "cooking-6-fruit");
await page.waitForFunction(() => /KNIFE REPORT/.test(document.body.innerText), { timeout: 8000 });
check("6c when it ends, the Knife Report follows", await page.evaluate(clipGone));

// ---------- 7. a cut-and-plate dish gets the plating film ----------
await boot(
  page,
  seedSave({
    levelProgress: {
      currentLevelId: "level-3",
      highestUnlockedLevelId: "level-3",
      completedLevelIds: ["level-1", "level-2"],
    },
  }),
);
await clickButton(page, /Prepare$/);
check("7a Level 3 (Carrot Chop Bowl): clip shown", await cookUntilClip());
await sleep(800);
const v7 = await video(page);
check(
  "7b a cut-and-plate dish plays the plating film",
  (await page.evaluate(
    () => document.querySelector('[data-testid="cooking-clip"]').dataset.kind,
  )) === "plated" &&
    /^chef-plating/.test(v7?.src ?? "") &&
    v7.t > 0.2,
  v7,
);
await shot(page, "cooking-7-plated");
await page.waitForFunction(() => /KNIFE REPORT/.test(document.body.innerText), { timeout: 8000 });
check("7c when it ends, the Knife Report follows", await page.evaluate(clipGone));

// ---------- 8. a curry gets the curry-pot film ----------
await boot(
  page,
  seedSave({
    levelProgress: {
      currentLevelId: "level-58",
      highestUnlockedLevelId: "level-58",
      completedLevelIds: Array.from({ length: 57 }, (_, i) => `level-${i + 1}`),
    },
  }),
);
await clickButton(page, /Prepare$/);
check("8a Level 58 (Pumpkin Curry Dice): clip shown", await cookUntilClip());
await sleep(800);
const v8 = await video(page);
check(
  "8b a curry plays the curry-pot film",
  (await page.evaluate(
    () => document.querySelector('[data-testid="cooking-clip"]').dataset.kind,
  )) === "curry" &&
    /^chef-curry/.test(v8?.src ?? "") &&
    v8.t > 0.2,
  v8,
);
await shot(page, "cooking-8-curry");
await page.waitForFunction(() => /KNIFE REPORT/.test(document.body.innerText), { timeout: 8000 });
check("8c when it ends, the Knife Report follows", await page.evaluate(clipGone));

// ---------- 9. a bread dish gets the bread film ----------
await boot(
  page,
  seedSave({
    levelProgress: {
      currentLevelId: "level-11",
      highestUnlockedLevelId: "level-11",
      completedLevelIds: Array.from({ length: 10 }, (_, i) => `level-${i + 1}`),
    },
  }),
);
await clickButton(page, /Prepare$/);
check("9a Level 11 (Garlic Bread): clip shown", await cookUntilClip());
await sleep(800);
const v9 = await video(page);
check(
  "9b a bread dish plays the bread film",
  (await page.evaluate(
    () => document.querySelector('[data-testid="cooking-clip"]').dataset.kind,
  )) === "bread" &&
    /^chef-bread/.test(v9?.src ?? "") &&
    v9.t > 0.2,
  v9,
);
await shot(page, "cooking-9-bread");
await page.waitForFunction(() => /KNIFE REPORT/.test(document.body.innerText), { timeout: 8000 });
check("9c when it ends, the Knife Report follows", await page.evaluate(clipGone));

check("console has no errors", logs.filter((l) => /^error|pageerror/i.test(l)).length === 0, logs);
save("cookingclip-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed === 0 ? "\nCOOKING CLIP E2E: ALL PASS" : `\nCOOKING CLIP E2E: ${failed} FAILURE(S)`,
);
process.exit(failed === 0 ? 0 : 1);
