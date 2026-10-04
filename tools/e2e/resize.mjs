// A resize or rotation must never restart the game screen (GameShell used to swap its element
// tree when the frame crossed 320 px wide, which remounted everything under it).
//   1. Mid-cut: Level 8 with its peel step done, resize 430 → 320 → 768 → 430: the same order,
//      the same step, and the peel progress are still there.
//   2. Served: the result panel ("Finish Level") survives a resize to 320×568 and to
//      768×1024 and back, and Finish Level still completes the level once.
//   3. Kitchen home survives a resize to 320 (no remount flash: a marker set on the page
//      element is still there).
// Prints PASS/FAIL per check and exits 1 on any failure.
import { launch, boot, seedSave, sleep, clickButton, readSave, text } from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const { browser, page, logs } = await launch();
const sizes = [
  { width: 320, height: 568 },
  { width: 768, height: 1024 },
  { width: 430, height: 900 },
];
async function resizeAll() {
  for (const v of sizes) {
    await page.setViewport({ ...v, deviceScaleFactor: 1 });
    await sleep(500);
  }
}

await boot(
  page,
  seedSave({
    credits: 5000,
    levelProgress: {
      currentLevelId: "level-8",
      highestUnlockedLevelId: "level-8",
      completedLevelIds: Array.from({ length: 7 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  }),
);

// ---------- 3. Kitchen home ----------
await page.evaluate(() => {
  const el = document.querySelector("nav");
  if (el) el.dataset.resizeMarker = "kept";
});
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await sleep(500);
const kept = await page.evaluate(() => !!document.querySelector('[data-resize-marker="kept"]'));
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
await sleep(400);
check("3 Kitchen home is not rebuilt by a resize to 320 px", kept);

// ---------- 1. Mid-cut ----------
await clickButton(page, /^See all orders/);
await sleep(700);
await page.evaluate(() => {
  const h = [...document.querySelectorAll("p")].find(
    (p) => p.textContent.trim() === "Halved Potato",
  );
  let n = h;
  for (let i = 0; i < 8 && n; i++) {
    n = n.parentElement;
    const b =
      n && [...n.querySelectorAll("button")].find((x) => /^Prepare$/.test(x.textContent.trim()));
    if (b) {
      b.click();
      return;
    }
  }
});
await page.waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
  timeout: 30000,
});
await sleep(800);
// Real progress: play until the peel step is finished and step 2 (halve) is on screen.
await playToReport(page, {
  maxMs: 90000,
  until: () => /STEP 2 OF 2/i.test(document.body.innerText),
});
await sleep(500);
const before = await flat();
await resizeAll();
const after = await flat();
const sameOrder = /Halved Potato/i.test(after) && /ORDER/i.test(after);
check(
  "1 mid-cut: with the peel done (step 2 of 2), resizing to 320, 768 and back keeps the order, the step and the progress",
  sameOrder &&
    /STEP 2 OF 2/i.test(before) &&
    /STEP 2 OF 2/i.test(after) &&
    /1\/1 peel|halve/i.test(after),
  { before: before.slice(0, 160), after: after.slice(0, 160) },
);

// ---------- 2. Served ----------
const played = await playToReport(page, { maxMs: 120000 });
await clickButton(page, /^Continue$/);
await sleep(900);
await clickButton(page, /^Serve to /);
await sleep(900);
const servedBefore = /Finish Level/.test(await flat());
await resizeAll();
const servedAfter = /Finish Level/.test(await flat());
check(
  "2a the served result panel survives resizes to 320×568, 768×1024 and back",
  played && servedBefore && servedAfter,
  { servedBefore, servedAfter },
);
await clickButton(page, /^Finish Level$/);
await sleep(1500);
const s = await readSave(page);
check(
  "2b Finish Level still completes the level once",
  s.levelProgress.completedLevelIds.includes("level-8") &&
    s.economyLedger.filter((e) => e.category === "completion-reward" && e.description === "level-8")
      .length === 1,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("4 no page errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `RESIZE E2E: ${failed.length} FAILURE(S)` : "RESIZE E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
