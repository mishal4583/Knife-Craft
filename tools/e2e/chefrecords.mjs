// Chef Pride, Phase 0+1 (developer 2026-11-23: "the game knows I'm getting better"), restaurant build, Level 4, a one-plate service:
//   1. after the cut the Knife Report adds a line for what the plate beat in the chef's record (here the seeded marks are low, so a real "Longest combo yet: N");
//      a plate a hair under the next grade says so in words, never digits;
//   2. continuing saves the plate in business.chefRecord (plates + 1, perfect cuts, longest combo) in the SAME save as the result;
//   3. (not here) the Level Complete card's service tiles and "★ Accuracy up" line: a level's card needs a whole multi-order service that the solver cannot finish
//      reliably (a one-order Level 1 rolls straight on and closes the card). Covered by chef-record-qa G4/G6 and by a rendered screenshot of the card at 320, 390 and 1280;
//   4. the report fits 390x844 and 1280x720: nothing sideways, the Continue button on screen (320x568 is covered by knifereport.mjs);
//   5. no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  shot,
  clickButton,
  readSave,
} from "./harness.mjs";
import { playToReport, geometryFromCanvas } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const N = 4;
const RECIPE = "camp-latin-grapes-strawberry";
const IDS = ["grapes", "strawberry"];
const stock = (ids) =>
  Object.fromEntries(
    ids.map((id) => [id, { ingredientId: id, quantity: 14, unitCost: 100, purchaseDay: 7 }]),
  );
const seed = () => {
  const s = seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      staff: { hiredRoles: ["server", "cashier"] },
      calendar: { businessDay: 7 },
      inventory: stock(IDS),
      restaurantStaff: { specialists: ["mexican-chef"] },
      sectionsSeen: ["inventory", "shop", "rack", "business"],
      chefRecord: {
        plates: 5,
        perfectCuts: 3,
        bestPerfects: 1,
        bestCombo: 1,
        fastestMs: 600000,
        services: 1,
        bestServiceAccuracy: 1,
        lastServiceAccuracy: 1,
        bestServicePerfects: 0,
      },
    },
    credits: 5_000_000,
    levelProgress: {
      currentLevelId: `level-${N}`,
      highestUnlockedLevelId: `level-${N}`,
      completedLevelIds: Array.from({ length: N - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
      tickets: { [`level-${N}`]: [RECIPE] },
    },
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
  });
  s.version = 3;
  return s;
};
const click = async (page, re) => {
  const r = await page.evaluate((src) => {
    const b = [...document.querySelectorAll("button")].find(
      (x) =>
        new RegExp(src, "i").test(x.textContent.trim()) &&
        !x.disabled &&
        x.getBoundingClientRect().width > 0,
    );
    if (!b) return null;
    const q = b.getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  }, re.source);
  if (r) await page.mouse.click(r.x, r.y);
  return !!r;
};

const { browser, page, logs } = await launch();
// The Level Complete card shows for a couple of seconds: a sampler keeps what it said.
await page.evaluateOnNewDocument(() => {
  setInterval(() => {
    const tiles = document.querySelector('[data-testid="banner-stats"]');
    if (!tiles) return;
    const card = tiles.closest("div[class*='anim-pop']") ?? tiles.parentElement;
    window.__shift = {
      tiles: tiles.innerText.replace(/\n+/g, " | "),
      notes: document.querySelector('[data-testid="banner-notes"]')?.innerText ?? "",
      text: card?.innerText ?? "",
    };
  }, 120);
});

async function toReport(size) {
  await page.setViewport({ ...size, deviceScaleFactor: 1, hasTouch: size.width < 500 });
  await boot(page, seed());
  await page.evaluate(() => {
    window.__shift = undefined;
  });
  await sleep(2500);
  await clickButton(page, /^Open for service$/);
  await sleep(1500);
  for (let i = 0; i < 6; i++) {
    const had = await click(page, /(Hire Server &|Open restaurant|Start cooking)/);
    await sleep(1800);
    if (!had) break;
  }
  await click(page, /Start cooking/);
  await sleep(2500);
  const geom = size.width >= 900 ? await geometryFromCanvas(page) : undefined;
  return playToReport(page, {
    maxMs: 120000,
    until: () => /KNIFE REPORT/i.test(document.body.innerText),
    ...(geom ? { geom } : {}),
  });
}
const report = () =>
  page.evaluate(() => {
    const sp = [...document.querySelectorAll('[data-testid="knife-report-specials"] p')].map((p) =>
      p.textContent.trim(),
    );
    const btn = [...document.querySelectorAll("button")].find((b) =>
      /^(Continue|Serve|Next|Plate it|Done)/i.test(b.textContent.trim()),
    );
    const r = btn?.getBoundingClientRect();
    return {
      lines: sp,
      continueOn: r ? r.top >= 0 && r.bottom <= innerHeight : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

try {
  const cut = await toReport({ width: 390, height: 844 });
  await sleep(600);
  const rep = await report();
  await shot(page, "chefrecords-report");
  check(
    "1 the Knife Report says what the plate beat in the chef's record (a real number, with a star)",
    cut.stopped && rep.lines.some((l) => /^★ Longest combo yet: \d+/.test(l)),
    rep,
  );
  check(
    "1b near-miss lines (if any) are words only",
    rep.lines.filter((l) => /hair from/i.test(l)).every((l) => !/\d/.test(l)),
    rep,
  );
  check(
    "4a the report fits 390x844 (Continue on screen, no sideways scroll)",
    rep.continueOn !== false && rep.overflow <= 0,
    rep,
  );

  // continue past the report: the plate goes into the record
  await click(page, /^(Continue|Serve|Next)/);
  await sleep(1500);
  const afterPlate = (await readSave(page))?.business?.chefRecord;
  check(
    "2 the plate is in business.chefRecord (plates 6, longest combo raised, perfect cuts not lower)",
    afterPlate?.plates === 6 && afterPlate.bestCombo >= 2 && afterPlate.perfectCuts >= 3,
    afterPlate,
  );

  // other sizes (report only)
  for (const [w, h] of [[1280, 720]]) {
    const c2 = await toReport({ width: w, height: h });
    await sleep(600);
    const r2 = await report();
    await shot(page, `chefrecords-report-${w}`);
    check(
      `4 the report fits ${w}x${h}: Continue on screen, no sideways scroll`,
      c2.stopped && r2.continueOn !== false && r2.overflow <= 0,
      r2,
    );
  }
} catch (e) {
  check("run", false, String(e).slice(0, 300));
}
const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("5 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
