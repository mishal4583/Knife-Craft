// The Knife Report fits every game width (2026-10-21). Restaurant build (the normal `npm run build`).
// Its stats grid — Evenness, Consistency, Rhythm and the ideal-vs-yours diagram — used to
// overflow the card at every game width up to ~460 px: the grid's plain `1fr` column could not
// shrink below the Rhythm line's nowrap text, so the diagram sat past the card's edge and, at
// 320 px, "100" was clipped to "10". The fix tightens the card below a 390 px-wide GAME — a
// container query, because the game is a contain-fit portrait frame (GameShell) whose width is
// min(window width, window height x 9/16): a short, wide window gives a narrow game.
//   1. a brand-new player plays Level 1 through to the real Knife Report;
//   2. on six real screen sizes — 320×568, 360×800, 390×844, 430×932, a framed 768×1024 tablet and
//      a 1280×720 laptop window (a ~380 px game) — the grid does not overflow; every row, every
//      value and the diagram (both legend labels) sit inside the card; no value is clipped; the
//      bars keep a usable length; the card is wholly on screen; the page does not scroll
//      sideways; and the layout follows the GAME's width, not the window's: compact (digit-sized
//      value column, 16 px padding) under 390 px, the original (62 px column, 20 px padding) from
//      390 px — so 1280×720 is compact while 390×844 is the original;
//   3. the same with the LONGEST content the report can show — the Rhythm line's
//      "a steady pace adds a bonus" and three-character values ("100", "+10"). The engine can't
//      be asked for a particular score, so these strings are written into the real report's own
//      DOM after it renders: a layout stress test of the real component, not a game state;
//   4. no console errors.
// The grid is found by its test hook or, failing that, as the card's grid holding "Evenness", so
// the check also runs against builds from before the hook (that is how the overflow was
// reproduced: 10 failures on the unfixed build).
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot, save } from "./harness.mjs";
import { playToReport, geometryFromCanvas } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

const VIEWPORTS = [
  [320, 568], // iPhone SE (1st gen): the frame is scaled down to its 320 px layout floor
  [360, 800], // small Android
  [390, 844], // iPhone 12–15
  [430, 932], // iPhone Pro Max
  [768, 1024], // tablet: framed "device" look, game ~550 px
  [1280, 720], // short laptop window: the game is only ~380 px wide
];
const COMPACT_BELOW = 390;
const MIN_BAR_PX = 32;

const findGrid = () =>
  document.querySelector('[data-testid="knife-report-stats"]') ??
  [...document.querySelectorAll(".paper .grid")].find((g) => /Evenness/.test(g.textContent)) ??
  null;

/** Geometry of the report's stats grid, in the page (layout px unless noted). */
const measure = (findGridSrc) => {
  const grid = new Function(`return (${findGridSrc})()`)();
  if (!grid) return null;
  const card = grid.closest(".paper");
  const c = card.getBoundingClientRect();
  const cs = getComputedStyle(card);
  const inner = {
    left: c.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft),
    right: c.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight),
  };
  // On-screen boxes (they include the frame's scale below 320 px, as `inner` does).
  const box = (el) => el.getBoundingClientRect();
  const within = (el, area) => box(el).left >= area.left - 0.5 && box(el).right <= area.right + 0.5;
  const rows = [...grid.firstElementChild.children]; // Evenness, Consistency, Rhythm
  const values = rows.map((row) => row.lastElementChild);
  const bars = rows.slice(0, 2).map((row) => row.children[1]);
  const viz = grid.lastElementChild;
  const legend = [...viz.querySelectorAll("span")];
  return {
    gameWidth: card.parentElement.offsetWidth, // the report overlay is inset-0 in the game frame
    padPx: parseFloat(cs.paddingLeft),
    valueColPx: values[0].offsetWidth,
    cardTop: Math.round(c.top),
    cardBottom: Math.round(c.bottom),
    viewportH: window.innerHeight,
    gridOverflowPx: grid.scrollWidth - grid.clientWidth,
    rowsInside: rows.every((r) => within(r, inner)),
    valuesInside: values.every((v) => within(v, inner)),
    valuesUnclipped: values.every((v) => v.scrollWidth <= v.clientWidth + 0.5),
    values: values.map((v) => v.textContent.trim()),
    minBarPx: Math.min(...bars.map((b) => b.offsetWidth)),
    vizInside: within(viz, inner),
    legendInside: legend.length === 2 && legend.every((s) => within(s, box(viz))),
    pageScrollsSideways:
      document.documentElement.scrollWidth > document.documentElement.clientWidth,
    rhythmText: rows[2].children[1].textContent.trim(),
  };
};

async function checkViewports(page, tag) {
  for (const [w, h] of VIEWPORTS) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await sleep(400);
    const m = await page.evaluate(measure, findGrid.toString());
    const fits =
      !!m &&
      m.gridOverflowPx <= 0 &&
      m.rowsInside &&
      m.valuesInside &&
      m.valuesUnclipped &&
      m.vizInside &&
      m.legendInside &&
      m.minBarPx >= MIN_BAR_PX &&
      m.cardTop >= 0 &&
      m.cardBottom <= m.viewportH &&
      !m.pageScrollsSideways;
    check(
      `${tag}a ${w}×${h}: everything inside the card, bars >= ${MIN_BAR_PX} px, on screen`,
      fits,
      m,
    );
    const compact = !!m && m.gameWidth < COMPACT_BELOW;
    const layoutOk =
      !!m &&
      (compact ? m.valueColPx < 62 && m.padPx === 16 : m.valueColPx === 62 && m.padPx === 20);
    check(
      `${tag}b ${w}×${h}: ${compact ? "compact" : "original"} layout for a ${m?.gameWidth} px game`,
      layoutOk,
      m && { gameWidth: m.gameWidth, valueColPx: m.valueColPx, padPx: m.padPx },
    );
    if (w === 320) await shot(page, `knifereport-${tag}-320`);
  }
}

const { browser, page, logs } = await launch();

// ---------- 1. a real report: the solver plays a real plate ----------
// Rule changed (developer 2026-10-30, "nothing is given free"; found stale in the Chef Pride audit Batch 5, 2026-11-24): a brand-new player no longer lands on the cutting board
// after the intro. They start in the Kitchen with the Market open and must buy the first order's food first, so this test used to wait 30 s for a board that never came. The setup
// is now a seeded player with the food already in the fridge (the same real flow as chefrecords.mjs: Open for service, Start cooking, the solver cuts a real plate). Every
// assertion about the report itself (checks 2 to 4) is unchanged.
const N = 4;
const RECIPE = "camp-latin-grapes-strawberry";
const stock = Object.fromEntries(
  ["grapes", "strawberry"].map((id) => [
    id,
    { ingredientId: id, quantity: 14, unitCost: 100, purchaseDay: 7 },
  ]),
);
const seed = seedSave({
  business: {
    ...MOVED_IN_BUSINESS,
    staff: { hiredRoles: ["server", "cashier"] },
    calendar: { businessDay: 7 },
    inventory: stock,
    restaurantStaff: { specialists: ["mexican-chef"] },
    sectionsSeen: ["inventory", "shop", "rack", "business"],
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
seed.version = 3;
const mouseClick = async (re) => {
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
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
await boot(page, seed);
await sleep(2500);
await mouseClick(/^Open for service$/);
await sleep(1500);
for (let i = 0; i < 6; i++) {
  const had = await mouseClick(/(Hire Server &|Open restaurant|Start cooking)/);
  await sleep(1800);
  if (!had) break;
}
await mouseClick(/Start cooking/);
await sleep(2500);
const geom = await geometryFromCanvas(page);
const played = await playToReport(page, {
  maxMs: 120000,
  until: () => /KNIFE REPORT/i.test(document.body.innerText),
  ...(geom ? { geom } : {}),
});
check("1a Level 1 plays through to the Knife Report", played.ok, played.log.slice(-3));
await page.waitForFunction(findGrid, { timeout: 15000 });
await sleep(2000); // let the report's entrance animation and any pending HUD timers finish

// ---------- 2. the report as the engine graded it ----------
await checkViewports(page, "2");

// ---------- 3. the longest content the report can show ----------
await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 1 });
await sleep(400);
await page.evaluate((findGridSrc) => {
  const grid = new Function(`return (${findGridSrc})()`)();
  const rows = [...grid.firstElementChild.children];
  rows[0].lastElementChild.textContent = "100";
  rows[1].lastElementChild.textContent = "100";
  rows[2].children[1].textContent = "a steady pace adds a bonus";
  rows[2].lastElementChild.textContent = "+10";
}, findGrid.toString());
await checkViewports(page, "3");

check(
  "4 console has no errors",
  logs.filter((l) => /^error|pageerror/i.test(l)).length === 0,
  logs,
);
save("knifereport-result.json", results);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed === 0 ? "\nKNIFE REPORT E2E: ALL PASS" : `\nKNIFE REPORT E2E: ${failed} FAILURE(S)`,
);
process.exit(failed === 0 ? 0 : 1);
