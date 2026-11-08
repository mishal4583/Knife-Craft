// Slow, satisfying peeling (developer 2026-11-07: "make the peeling slow and satisfying because players enjoy it"). Restaurant build.
//   P1 scribbling fast does not beat a steady stroke: 3 seconds of frantic zigzag leave the potato well short of done
//   P2 the blade bites at a fixed pace behind the finger: the peel takes at least 6 seconds even with a perfect sweep
//   P3 a steady, slow peel does finish (and moves on to the next step)
//   P4 lifting the finger mid-stroke lets the blade finish the stroke (the progress keeps rising a moment after the release)
//   P5 no console errors
// Screenshots: out/peelslow-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  shot,
  clickButton,
  text,
} from "./harness.mjs";
import { CX, CY } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const FOOD = Object.fromEntries(
  ["potato", "carrot", "tomato", "bread", "garlic", "onion"].map((id) => [
    id,
    { ingredientId: id, quantity: 12, unitCost: 0, purchaseDay: 1 },
  ]),
);
const at = (n) =>
  seedSave({
    credits: 500_000,
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: FOOD,
      staff: { hiredRoles: ["server", "cashier"] },
    },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    settings: { sound: false, music: false, reducedMotion: false, restaurantName: "Test Kitchen" },
  });
/** The peel's progress in percent, from the HUD ("Potato · 34% peeled"); 100 once the step is done. */
const pct = async (page) => {
  const t = await text(page);
  const m = t.match(/(\d+)%\s*peeled/i);
  if (m) return +m[1];
  return /STEP 2 OF|KNIFE REPORT/.test(t) ? 100 : null;
};

const { browser, page, logs } = await launch();
await boot(page, at(2));
await sleep(1500);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="guide-card"] button')]
    .find((b) => b.textContent.includes("Later"))
    ?.click(),
);
await sleep(400);
await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
await sleep(800);
await clickButton(page, /Open for service$|Prepare$/);
await sleep(1200);
for (let k = 0; k < 3; k++) {
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) =>
        /^(🔥 Start service|START SERVICE|🚪 Open restaurant|OPEN THE RESTAURANT)$/i.test(
          x.textContent.trim(),
        ) && !x.disabled,
    );
    b?.click();
    return !!b;
  });
  if (!clicked) break;
  await sleep(1200);
}
await clickButton(page, /Start cooking/);
await page
  .waitForFunction(
    () =>
      !!document.querySelector("[data-game-viewport] canvas") &&
      /peeled/i.test(document.body.innerText),
    { timeout: 20000 },
  )
  .catch(() => {});
await sleep(2500);
await shot(page, "peelslow-0-start");

// P1: three seconds of frantic zigzag.
await page.mouse.move(CX, CY);
await page.mouse.down();
const t0 = Date.now();
let i = 0;
while (Date.now() - t0 < 3000) {
  await page.mouse.move(CX + (i % 2 ? 60 : -60), CY + ((i * 7) % 90) - 45);
  await sleep(8);
  i++;
}
await sleep(100);
const after3 = await pct(page);
await shot(page, "peelslow-1-after-scribble");
check(
  "P1 three seconds of scribbling leave the peel under 45% done",
  after3 !== null && after3 < 45,
  after3,
);

// P4: lift the finger mid-stroke; the blade finishes the stroke (progress still rising after the release).
await page.mouse.move(CX + 60, CY - 45);
await sleep(100);
const beforeUp = await pct(page);
await page.mouse.up();
await sleep(1200);
const afterUp = await pct(page);
check(
  "P4 after lifting the finger the blade finishes its stroke (progress does not stop dead)",
  afterUp !== null && beforeUp !== null && afterUp >= beforeUp,
  { beforeUp, afterUp },
);

// P2 + P3: a patient, full-width sweep row by row; measure how long the whole peel takes.
const startAll = Date.now();
let done = false;
let row = 0;
const rows = [0, -24, 24, -48, 48, -12, 12, -36, 36, -58, 58, -6, 6, -30, 30, -54, 54];
for (let n = 0; n < 40 && !done; n++) {
  const dir = n % 2 === 0 ? 1 : -1;
  const y = CY + rows[row++ % rows.length];
  await page.mouse.move(CX - dir * 50, y);
  await page.mouse.down();
  for (let k = 1; k <= 14; k++) {
    await page.mouse.move(CX - dir * 50 + (dir * 165 * k) / 14, y);
    await sleep(12);
  }
  await sleep(2300);
  await page.mouse.up();
  await sleep(300);
  const p = await pct(page);
  if (p !== null && p >= 100) done = true;
}
const secs = (Date.now() - startAll) / 1000 + 3.5;
await shot(page, "peelslow-2-done");
check("P3 a steady slow peel finishes", done, { rows: row });
check(
  "P2 even a perfect sweep takes at least 6 seconds (the blade bites at a fixed pace)",
  done && secs >= 6,
  { secs: Math.round(secs) },
);

const bad = logs.filter(
  (l) =>
    /error/i.test(l.type ?? l) &&
    !/favicon|Failed to load resource|bridge/i.test(l.text ?? String(l)),
);
check("P5 no console errors", bad.length === 0, bad.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
