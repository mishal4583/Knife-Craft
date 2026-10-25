// Transformation Phase C (2026-10-25) — the interactive oven, restaurant build, Level 5
// (Garlic Bread), in a real browser:
//   O1 after the cut the oven appears instead of the cooking film; the tray goes in and bakes.
//   O2 it fits 320×568, 390×844 and 768×1024 (no sideways scroll, the button on screen).
//   O3 a double tap in the golden window takes it out once: "Golden and crisp!", then the
//      Knife Report (the order is not served or paid by the oven).
//   O4 Serve pays once (one settlement entry), as for any dish.
//   O5 Reduced Motion: the same bake, no sliding tray; left alone it comes out by itself.
//   O6 no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  launch,
  boot,
  seedSave,
  MOVED_IN_BUSINESS,
  clickButton,
  sleep,
  readSave,
  shot,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const FOOD = Object.fromEntries(
  ["bread", "garlic"].map((id) => [
    id,
    { ingredientId: id, quantity: 3, unitCost: 0, purchaseDay: 1 },
  ]),
);
const saveAt5 = (reducedMotion) => {
  const s = seedSave({
    business: { ...MOVED_IN_BUSINESS, inventory: FOOD },
    credits: 5000,
    levelProgress: {
      currentLevelId: "level-5",
      highestUnlockedLevelId: "level-5",
      completedLevelIds: ["level-1", "level-2", "level-3", "level-4"],
    },
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
  });
  s.settings = { ...(s.settings ?? {}), reducedMotion };
  return s;
};
async function startLevel5() {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  await clickButton(page, /^Prepare$/);
  await sleep(900);
  if (await page.evaluate(() => !!document.querySelector('[data-testid="pre-service-check"]')))
    await clickButton(
      page,
      /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/,
    );
  await sleep(600);
}
const oven = () =>
  page.evaluate(() => {
    const o = document.querySelector('[data-testid="oven-step"]');
    if (!o) return null;
    const b = [...o.querySelectorAll("button")]
      .find((x) => /Take it out/.test(x.textContent))
      ?.getBoundingClientRect();
    return {
      state: o.dataset.state,
      zone: o.dataset.zone,
      result: o.querySelector('[data-testid="oven-result"]')?.textContent ?? null,
      clip: !!document.querySelector("video"),
      buttonOn: b ? b.top >= 0 && b.bottom <= innerHeight && b.height >= 47.5 : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
const untilOven = () => !!document.querySelector('[data-testid="oven-step"]');

// ---------- O1–O4 ----------
await boot(page, saveAt5(false));
await startLevel5();
const cut = await playToReport(page, { maxMs: 150000, until: untilOven });
const first = await oven();
await shot(page, "oven-1-in");
check(
  "O1 after the cut the oven appears instead of the film; the tray goes in",
  cut.stopped && !!first && !first.clip,
  first,
);

const sizes = {};
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [768, 1024],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await sleep(250);
  sizes[w] = await oven();
  await shot(page, `oven-${w}`);
}
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
check(
  "O2 the oven fits 320, 390 and 768 px: no sideways scroll, a 48 px button on screen",
  Object.values(sizes).every((o) => o && o.overflow <= 0 && o.buttonOn !== false),
  sizes,
);

await page.waitForFunction(
  () => document.querySelector('[data-testid="oven-step"]')?.dataset.zone === "golden",
  { timeout: 15000 },
);
await shot(page, "oven-2-golden");
await page.evaluate(() => {
  const b = [...document.querySelectorAll('[data-testid="oven-step"] button')].find((x) =>
    /Take it out/.test(x.textContent),
  );
  b?.click();
  b?.click();
});
await sleep(200);
const out = await oven();
await shot(page, "oven-3-out");
await page
  .waitForFunction(() => /KNIFE REPORT/i.test(document.body.innerText), { timeout: 10000 })
  .catch(() => null);
const report = await page.evaluate(() => ({
  report: /KNIFE REPORT/i.test(document.body.innerText),
  oven: !!document.querySelector('[data-testid="oven-step"]'),
}));
check(
  "O3 a double tap in the golden window takes it out once: 'Golden and crisp!', then the Knife Report",
  out?.state === "done" && out.result === "Golden and crisp!" && report.report && !report.oven,
  { out, report },
);

await clickButton(page, /^Continue$/);
await sleep(900);
const before = await readSave(page);
await clickButton(page, /^Serve to /);
await sleep(2500);
await clickButton(page, /^Serve to /);
await sleep(400);
const after = await readSave(page);
const n = (s) =>
  (s?.economyLedger ?? []).filter((e) => e.category === "campaign-settlement").length;
check("O4 Serve pays once (one settlement entry), as for any dish", n(after) === n(before) + 1, [
  n(before),
  n(after),
]);

// ---------- O5 Reduced Motion ----------
await boot(page, saveAt5(true));
await startLevel5();
await playToReport(page, { maxMs: 150000, until: untilOven });
const rm0 = await oven();
await page
  .waitForFunction(() => /KNIFE REPORT/i.test(document.body.innerText), { timeout: 15000 })
  .catch(() => null);
const rmEnd = await page.evaluate(() => /KNIFE REPORT/i.test(document.body.innerText));
check(
  "O5 Reduced Motion: baking at once (no sliding tray); left alone it comes out by itself, then the Knife Report",
  rm0?.state === "baking" && rmEnd,
  { rm0, rmEnd },
);

const errors = logs.filter((l) => /^(error|pageerror)/.test(l) && !/bridge|favicon|ERR_/.test(l));
check("O6 no console errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `\nOVEN STEP E2E: ${failed.length} FAILURE(S)` : "\nOVEN STEP E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
