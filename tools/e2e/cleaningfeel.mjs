// The cleaning mini-game's feel (developer 2026-10-22: "finish the cleaning rework, make it
// proper and satisfying, proper cleaning tools"), restaurant build, in a real browser:
//   1. Degrease (kitchen, one tool): the stains are drawn on the stove line, the guide ring
//      points at one with the Grill scraper, and the toolbar is hidden (one tool only).
//   2. One quick pass doesn't lift grease (it is tough); scrubbing on gives particles
//      (data-fx-spawned), a streak chip and a milestone toast, then "Spotless!"; Done
//      removes the task from the save.
//   3. Disinfect (restroom, two tools): rubbing the mirror with the Sponge says
//      "Use the squeegee here" and lights the Squeegee button (data-suggested).
//   4. Reduced Motion: no particles, and the task still reaches Spotless.
//   5. 320×568: the room, the tools and the progress fit with no sideways scroll; every
//      tool button is ≥ 48 px.
//   6. No console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, readSave, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const AREA = { grease: "kitchen", "restroom-disinfect": "restroom", tables: "dining" };
const SUPPLIES = [
  "bin-liners",
  "brooms",
  "disinfectant",
  "floor-cleaner",
  "hand-soap",
  "mop-bucket",
  "paper-towels",
  "sponges-cloths",
  "toilet-brushes",
  "toilet-paper",
];
const N = 25;
const saveWith = (tasks, settings = {}) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      supplies: {
        stock: {
          ...MOVED_IN_BUSINESS.supplies.stock,
          ...Object.fromEntries(SUPPLIES.map((id) => [id, { units: 40, costBasis: 40 }])),
        },
      },
      cleanliness: {
        tasks: tasks.map((kind) => ({ kind, count: 1, since: N - 1 })),
        open: {},
        counters: { sink: 0, paper: 0 },
        cleanerAreas: [],
        introSeen: true,
        cupboardAt: 21,
        lastStart: null,
        cleaned: 0,
        byCleaner: 0,
      },
    },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${N}`,
      highestUnlockedLevelId: `level-${N}`,
      completedLevelIds: Array.from({ length: N - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 4095, finaleSeen: false },
    ...(Object.keys(settings).length
      ? { settings: { sound: false, music: false, reducedMotion: false, ...settings } }
      : {}),
  });

async function openTask(task) {
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector(".map-hotspot-zone", { timeout: 15000 }).catch(() => null);
  await sleep(600);
  await page.evaluate(() =>
    [...document.querySelectorAll(".map-hotspot-zone")]
      .find((e) => /Manager \/ Office/.test(e.getAttribute("aria-label") ?? ""))
      ?.click(),
  );
  await sleep(800);
  await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Business sections"] button')]
      .find((x) => x.textContent.includes("Cleanliness"))
      ?.click(),
  );
  await sleep(900);
  await page.evaluate(
    (a, t) => {
      const card = document.querySelector(`[data-testid="area-${a}"]`);
      if (!card?.querySelector(`[data-task="${t}"]`)) card?.querySelector("button")?.click();
    },
    AREA[task],
    task,
  );
  await sleep(500);
  await page.evaluate((t) => {
    [...(document.querySelector(`[data-task="${t}"]`)?.querySelectorAll("button") ?? [])]
      .find((x) => !x.disabled && /Clean/.test(x.textContent))
      ?.click();
  }, task);
  await page.waitForSelector('[data-testid="cleaning-stage"]', { timeout: 8000 }).catch(() => null);
  await sleep(700);
}

const state = () =>
  page.evaluate(() => ({
    pct: +(document.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow") ?? -1),
    spotless: !!document.querySelector('[data-testid="cleaning-spotless"]'),
    fx: +(document.querySelector('[data-testid="cleaning-fx"]')?.dataset.fxSpawned ?? 0),
    streak: !!document.querySelector('[data-testid="cleaning-streak"]'),
    toast: document.querySelector('[data-testid="cleaning-milestone"]')?.textContent ?? null,
    left: document.querySelector('[data-testid="cleaning-stains-left"]')?.textContent ?? "",
    hint: document.querySelector('[role="status"]')?.textContent ?? null,
    suggested:
      document.querySelector('button[data-tool][data-suggested="true"]')?.dataset.tool ?? null,
  }));
const box = () =>
  page.evaluate(() => {
    const r = document.querySelector('[data-testid="cleaning-dirt"]').getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });

/** One raster pass over the room; `watch` sees the state after every row. */
async function rasterPass(watch, { step = 18, stride = 22 } = {}) {
  const b = await box();
  for (let y = b.y + 12; y < b.y + b.h - 12; y += step) {
    await page.mouse.move(b.x + 8, y);
    await page.mouse.down();
    for (let x = b.x + 8; x < b.x + b.w - 8; x += stride) await page.mouse.move(x, y, { steps: 1 });
    await page.mouse.up();
    const s = await state();
    watch?.(s);
    if (s.spotless) return s;
  }
  return state();
}
async function scrubUntilSpotless(watch, passes = 6) {
  let s = await state();
  for (let i = 0; i < passes && !s.spotless; i++) s = await rasterPass(watch);
  await sleep(500);
  return state();
}

/* ── 1–2. Degrease: guide, toughness, particles, streak, toast, Spotless, Done ── */
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await boot(page, saveWith(["grease"]));
await openTask("grease");
const g0 = await page.evaluate(() => ({
  stage: !!document.querySelector('[data-testid="cleaning-stage"]'),
  stains: +(document.querySelector('[data-testid="cleaning-dirt"]')?.dataset.stains ?? 0),
  guide: document.querySelector('[data-testid="cleaning-guide"]')?.dataset.tool ?? null,
  toolbar: !!document.querySelector('[role="group"][aria-label="Cleaning tools"]'),
}));
check(
  "1 degrease opens with stains and a scraper guide, no toolbar",
  g0.stage && g0.stains > 0 && g0.guide === "scraper" && !g0.toolbar,
  g0,
);
await shot(page, "cleaningfeel-1-grease");

// One fast pass (wide rows) leaves grease behind.
const one = await rasterPass(null, { step: 30, stride: 40 });
check("2a one quick pass doesn't lift the grease", !one.spotless && one.pct < 90, {
  pct: one.pct,
  left: one.left,
});

const seen = { fx: 0, streak: false, toasts: new Set() };
const done = await scrubUntilSpotless((s) => {
  seen.fx = Math.max(seen.fx, s.fx);
  seen.streak ||= s.streak;
  if (s.toast) seen.toasts.add(s.toast);
});
check(
  "2b particles, a streak and a milestone toast while scrubbing",
  seen.fx > 0 && seen.streak && seen.toasts.size > 0,
  { fx: seen.fx, streak: seen.streak, toasts: [...seen.toasts] },
);
check("2c Spotless at 100%", done.spotless && done.pct === 100, done);
await shot(page, "cleaningfeel-2-spotless");
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="cleaning-spotless"] button')].at(0)?.click(),
);
await sleep(1200);
const afterDone = await readSave(page);
const leftTasks = (afterDone?.business?.cleanliness?.tasks ?? []).map((t) => t.kind);
check(
  "2d Done removes the task from the save",
  !leftTasks.includes("grease") && !(await page.$('[data-testid="cleaning-stage"]')),
  { tasks: leftTasks },
);

/* ── 3. Wrong tool on the mirror → hint and suggested Squeegee ── */
await boot(page, saveWith(["restroom-disinfect"]));
await openTask("restroom-disinfect");
await page.evaluate(() => document.querySelector('button[data-tool="sponge"]')?.click());
await sleep(200);
let hint = null;
for (let i = 0; i < 4 && !hint; i++) {
  await rasterPass((s) => {
    if (!hint && s.hint && /squeegee/i.test(s.hint)) hint = s;
  });
}
check(
  "3 the sponge on the mirror says to use the squeegee and lights it",
  !!hint && hint.suggested === "glass-cloth",
  hint,
);
await shot(page, "cleaningfeel-3-hint");

/* ── 4. Reduced Motion: no particles, still Spotless ── */
await boot(page, saveWith(["tables"], { reducedMotion: true }));
await openTask("tables");
const rmTools = await page.evaluate(() =>
  [...document.querySelectorAll("button[data-tool]")].map((b) => b.dataset.tool),
);
let rm = await state();
for (let k = 0; k < Math.max(1, rmTools.length) && !rm.spotless; k++) {
  if (rmTools.length)
    await page.evaluate(
      (t) => document.querySelector(`button[data-tool="${t}"]`)?.click(),
      rmTools[k],
    );
  rm = await scrubUntilSpotless(null, 3);
}
check("4 Reduced Motion: no particles and still Spotless", rm.spotless && rm.fx === 0, rm);

/* ── 5. 320×568 fit ── */
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(page, saveWith(["restroom-disinfect"]));
await openTask("restroom-disinfect");
const fit = await page.evaluate(() => {
  const r = (s) => document.querySelector(s)?.getBoundingClientRect();
  const stage = r('[data-testid="cleaning-dirt"]');
  const bar = r('[role="progressbar"]');
  const buttons = [...document.querySelectorAll("button[data-tool]")].map((b) => {
    const q = b.getBoundingClientRect();
    return Math.min(q.width, q.height);
  });
  const close = r('[aria-label^="Close"]');
  return {
    sideways: document.documentElement.scrollWidth > innerWidth,
    stage: stage && { top: stage.top, bottom: stage.bottom, w: stage.width },
    barBottom: bar?.bottom ?? null,
    buttons,
    close: close ? Math.min(close.width, close.height) : null,
    vh: innerHeight,
  };
});
check(
  "5 320×568: fits, no sideways scroll, buttons ≥ 48 px",
  !fit.sideways &&
    fit.stage &&
    fit.stage.w > 150 &&
    fit.stage.bottom <= fit.vh &&
    fit.barBottom !== null &&
    fit.barBottom <= fit.vh &&
    fit.buttons.length === 2 &&
    fit.buttons.every((s) => s >= 47.5) &&
    (fit.close ?? 0) >= 47.5,
  fit,
);
await shot(page, "cleaningfeel-5-320");

/* ── 6. console ── */
const errors = logs.filter((l) => /pageerror|error:/i.test(l));
check("6 no console errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
