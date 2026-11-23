// The LANDSCAPE oven film (developer 2026-11-23: "take necessary frames from these videos because Gemini is not properly generating it and integrate the oven game properly"),
// restaurant build, Level 5 (Garlic Bread). The 16:9 film (oven-bread-wide.*, scripts/make-oven-bread-wide-video.py) is the picture of the oven step in a landscape window:
//   1. in a 1280x720 window the oven step shows the wide film full frame (data-film-wide="on", a playing <video> of oven-bread-wide, no skip button), the controls in a panel
//      at the bottom right that stays clear of the loaf's middle, the "Take it out" button 48 px tall and on screen;
//   2. the film follows the bake clock: while the zone is "golden" the film is at about 1.5 s + 0.64 x 6.5 s;
//   3. the same panel fits 1815x867 and a phone on its side (740x360);
//   4. a double tap in the golden window takes it out once ("Golden and crisp!"), then the Knife Report;
//   5. an upright phone (390x844) still plays the portrait film (not the wide one);
//   6. no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot, clickButton } from "./harness.mjs";
import { playToReport, geometryFromCanvas } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const N = 4;
const RECIPE = "camp-tomato-basil-toast"; // bread, oven dish
const stock = (ids) =>
  Object.fromEntries(
    ids.map((id) => [id, { ingredientId: id, quantity: 6, unitCost: 100, purchaseDay: 7 }]),
  );
const seed = () => {
  const s = seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      staff: { hiredRoles: ["server", "cashier"] },
      calendar: { businessDay: 7 },
      inventory: stock(["bread", "tomato", "basil"]),
      restaurantStaff: { specialists: ["mexican-chef"] },
      sectionsSeen: ["inventory", "shop", "rack", "business"],
    },
    credits: 5_000_000,
    levelProgress: {
      currentLevelId: `level-${N}`,
      highestUnlockedLevelId: `level-${N}`,
      completedLevelIds: Array.from({ length: N - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
      tickets: { [`level-${N}`]: [RECIPE, RECIPE] },
    },
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
  });
  s.version = 3;
  return s;
};
const click = async (re) => {
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
/** A one-dish service in a window of this size, played until the oven shows; the cutting solver can stall, so one retry. */
async function toOven(size) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.setViewport({ ...size, deviceScaleFactor: 1, hasTouch: size.width < 500 });
    await boot(page, seed());
    await sleep(2500);
    await clickButton(page, /^Open for service$/);
    await sleep(1500);
    for (let i = 0; i < 6; i++) {
      const had = await click(/(Hire Server &|Open restaurant|Start cooking)/);
      await sleep(1800);
      if (!had) break;
    }
    await click(/Start cooking/);
    await sleep(2500);
    const geom = size.width >= 700 ? await geometryFromCanvas(page) : undefined;
    const r = await playToReport(page, {
      maxMs: 120000,
      until: untilOven,
      ...(geom ? { geom } : {}),
    });
    if (r.stopped) return r;
  }
  return { stopped: false };
}
const oven = () =>
  page.evaluate(() => {
    const o = document.querySelector('[data-testid="oven-step"]');
    if (!o) return null;
    const v = o.querySelector("video");
    const b = [...o.querySelectorAll("button")]
      .find((x) => /Take it out/.test(x.textContent))
      ?.getBoundingClientRect();
    const panel = o.querySelector('[data-testid="oven-panel"]')?.getBoundingClientRect();
    return {
      state: o.dataset.state,
      zone: o.dataset.zone,
      result: o.querySelector('[data-testid="oven-result"]')?.textContent ?? null,
      wide: o.dataset.filmWide === "on",
      src: v?.currentSrc ?? null,
      t: v ? Math.round(v.currentTime * 100) / 100 : null,
      playing: v ? !v.paused && v.readyState >= 2 : false,
      skip: [...o.querySelectorAll("button")].some((x) => /skip/i.test(x.textContent)),
      btnH: b ? Math.round(b.height) : null,
      btnOn: b ? b.top >= 0 && b.bottom <= innerHeight && b.right <= innerWidth : null,
      panelLeftShare: panel ? Math.round((panel.left / innerWidth) * 100) / 100 : null,
      panelOn: panel
        ? panel.top >= 0 && panel.bottom <= innerHeight && panel.right <= innerWidth
        : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
const untilOven = () => !!document.querySelector('[data-testid="oven-step"]');

// ---------- wide window ----------
const cut = await toOven({ width: 1280, height: 720 });
await sleep(1200);
const first = await oven();
await shot(page, "ovenwide-1-in");
check(
  "1 in a 1280x720 window the oven step plays the wide film full frame (no skip), the controls in a bottom-right panel clear of the middle, a 48 px button on screen",
  cut.stopped &&
    !!first &&
    first.wide &&
    (first.src ?? "").includes("oven-bread-wide") &&
    first.playing &&
    !first.skip &&
    first.btnH >= 47.5 &&
    first.btnOn &&
    first.panelOn &&
    first.panelLeftShare >= 0.7,
  first,
);

// 2/4. the golden window: the film's time, then a double tap
const golden = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const t0 = performance.now();
      const look = () => {
        const o = document.querySelector('[data-testid="oven-step"]');
        if (o?.dataset.zone === "golden") {
          const v = o.querySelector("video");
          const b = [...o.querySelectorAll("button")].find((x) =>
            /Take it out/.test(x.textContent),
          );
          const t = v ? v.currentTime : null;
          b?.click();
          b?.click();
          return resolve({ t });
        }
        if (performance.now() - t0 > 15000) return resolve(null);
        requestAnimationFrame(look);
      };
      look();
    }),
);
await shot(page, "ovenwide-2-golden");
check(
  "2 while the bake is golden the film is at about 1.5 s + 0.64 x 6.5 s (5.7 s)",
  !!golden && golden.t > 5.2 && golden.t < 6.2,
  golden,
);
await sleep(300);
const out = await oven();
check(
  "4a a double tap in the golden window takes it out once: 'Golden and crisp!'",
  out?.state === "done" && out.result === "Golden and crisp!",
  out,
);
await page
  .waitForFunction(() => /KNIFE REPORT/i.test(document.body.innerText), { timeout: 10000 })
  .catch(() => null);
check(
  "4b then the Knife Report, no oven left",
  await page.evaluate(
    () =>
      /KNIFE REPORT/i.test(document.body.innerText) &&
      !document.querySelector('[data-testid="oven-step"]'),
  ),
);

// ---------- other windows (a fresh bake each) ----------
const sizes = {};
for (const [w, h] of [
  [1815, 867],
  [740, 360],
]) {
  await toOven({ width: w, height: h });
  await sleep(2500);
  sizes[w] = await oven();
  await shot(page, `ovenwide-${w}`);
}
check(
  "3 the panel fits 1815x867 and a phone on its side (740x360): on screen, a 48 px button, no sideways scroll, the wide film",
  Object.values(sizes).every(
    (o) => o && o.wide && o.btnOn && o.btnH >= 47.5 && o.panelOn && o.overflow <= 0,
  ),
  sizes,
);

// ---------- an upright phone ----------
await toOven({ width: 390, height: 844 });
await sleep(1200);
const upright = await oven();
await shot(page, "ovenwide-390");
check(
  "5 an upright phone still plays the portrait film (not the wide one)",
  !!upright &&
    !upright.wide &&
    (upright.src ?? "").includes("oven-bread") &&
    !(upright.src ?? "").includes("wide"),
  upright,
);

const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("6 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
