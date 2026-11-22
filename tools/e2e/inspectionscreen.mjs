// The Inspection screen (developer 2026-11-22: "inspection is not built properly and not visible when view inspection button is clicked"),
// restaurant build, in a real browser:
//   1. Operations shows the "View Inspection" alert and a short Inspection card; neither carries the full list of checks.
//   2. Tapping the alert opens the Inspection screen: header "Inspection", no Business tab strip, the grade card, all 7 checks, tonight's line.
//   3. The failing refrigerator check has a Repair button; tapping it repairs (cash paid, fridge back to 100) and the screen turns to PASS.
//   4. The Operations card's button opens the same screen; Back returns to Operations.
//   5. Fits at 320 px and in a wide window, no console errors.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot, readSave } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const N = 30;
const save = (cond) =>
  seedSave({
    business: { ...MOVED_IN_BUSINESS, equipmentCondition: { refrigeratorCondition: cond } },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${N}`,
      highestUnlockedLevelId: `level-${N}`,
      completedLevelIds: Array.from({ length: N - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 4095, finaleSeen: false },
  });
const click = (sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
const clickText = (re, scope = "button") =>
  page.evaluate(
    (src, sc) => {
      const b = [...document.querySelectorAll(sc)].find((x) => new RegExp(src).test(x.textContent));
      b?.click();
      return !!b;
    },
    re.source,
    scope,
  );
const toOperations = async () => {
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector(".map-hotspot-zone", { timeout: 15000 }).catch(() => null);
  await sleep(600);
  await page.evaluate(() =>
    [...document.querySelectorAll(".map-hotspot-zone")]
      .find((e) => /Manager \/ Office/.test(e.getAttribute("aria-label") ?? ""))
      ?.click(),
  );
  await sleep(900);
  await clickText(/Operations/, 'nav[aria-label="Business sections"] button');
  await sleep(800);
};
const screenState = () =>
  page.evaluate(() => ({
    screen: !!document.querySelector('[data-testid="inspection-screen"]'),
    h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()),
    tabStrip: !!document.querySelector('nav[aria-label="Business sections"]'),
    checks: document.querySelectorAll("[data-inspection-check]").length,
    grade: document.querySelector('[data-testid="inspection-grade"]')?.dataset.grade ?? null,
    tonight: !!document.querySelector('[data-testid="inspection-tonight"]'),
    top: Math.round(
      document.querySelector('[data-testid="inspection-grade"]')?.getBoundingClientRect().top ?? -1,
    ),
    vh: innerHeight,
  }));

await boot(page, save(20));
await sleep(800);
await toOperations();
const ops = await page.evaluate(() => ({
  alert: [...document.querySelectorAll("button")].some((b) =>
    /View Inspection/.test(b.textContent),
  ),
  card: !!document.querySelector('[data-testid="inspection-summary"]'),
  checkRows: document.querySelectorAll("[data-inspection-check]").length,
}));
check(
  "1 Operations: the alert and a short card, no full check list",
  ops.alert && ops.card && ops.checkRows === 0,
  ops,
);
await shot(page, "inspection-ops-portrait");

await clickText(/View Inspection/);
await sleep(900);
const s = await screenState();
check(
  "2 the alert opens the Inspection screen: own header, no tab strip, grade, 7 checks, tonight, in view",
  s.screen &&
    s.h1.some((t) => /Inspection/.test(t)) &&
    !s.tabStrip &&
    s.checks === 7 &&
    s.grade === "WARNING" &&
    s.tonight &&
    s.top >= 0 &&
    s.top < s.vh,
  s,
);
await shot(page, "inspection-screen-portrait");

const before = (await readSave(page)).credits;
const repair = await page.evaluate(() => {
  const b = document.querySelector('[data-testid="inspection-fix-repair"]');
  const t = b?.textContent ?? null;
  b?.click();
  return t;
});
await sleep(900);
const after = await readSave(page);
const s2 = await screenState();
check(
  "3 Repair on the refrigerator row repairs it and the grade turns PASS",
  /Repair/.test(repair ?? "") &&
    after.credits < before &&
    after.business.equipmentCondition.refrigeratorCondition === 100 &&
    s2.grade === "PASS",
  {
    repair,
    paid: before - after.credits,
    cond: after.business.equipmentCondition.refrigeratorCondition,
    grade: s2.grade,
  },
);
await shot(page, "inspection-screen-passed");

await page.evaluate(() => document.querySelector('button[aria-label="Back"]')?.click());
await sleep(800);
const back = await page.evaluate(() => ({
  card: !!document.querySelector('[data-testid="inspection-summary"]'),
  strip: !!document.querySelector('nav[aria-label="Business sections"]'),
}));
check("4a Back returns to Operations", back.card && back.strip, back);
await click('[data-testid="inspection-open"]');
await sleep(800);
check("4b the card's button opens the same screen", (await screenState()).screen);

// 5. a narrow phone and a wide window (the worn fridge again)
await boot(page, save(20));
await sleep(800);
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await sleep(500);
await toOperations();
await clickText(/View Inspection/);
await sleep(800);
const narrow = await page.evaluate(() => ({
  sideways: document.documentElement.scrollWidth > innerWidth + 1,
  screen: !!document.querySelector('[data-testid="inspection-screen"]'),
}));
check("5a 320 px: no sideways scroll", narrow.screen && !narrow.sideways, narrow);
await shot(page, "inspection-screen-320");
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await sleep(900);
const wide = await page.evaluate(() => ({
  sideways: document.documentElement.scrollWidth > innerWidth + 1,
  screen: !!document.querySelector('[data-testid="inspection-screen"]'),
}));
check(
  "5b wide window: the screen is there, no sideways scroll",
  wide.screen && !wide.sideways,
  wide,
);
await shot(page, "inspection-screen-wide");

const errs = logs.filter((l) => /pageerror|error:/i.test(l));
check("6 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `INSPECTION SCREEN E2E: ${failed} FAIL` : "INSPECTION SCREEN E2E: ALL PASS");
process.exit(failed ? 1 : 0);
