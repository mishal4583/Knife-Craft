// Sauce Station LOOK (developer 2026-11-11 bug list: "not even understanding what to pour and do", "the pouring and the sauce inside the bottle is not
// accurate", "the whisk is upside down and whisking is not realistic"), restaurant build, real browser. Takes the screenshots to look at, and checks:
//   V1 the whisk is held handle UP: turned over (rotated about 180 degrees) with its head at the fingertip, inside the bowl
//   V2 while circling, the handle leans toward the middle of the bowl (the tilt follows the side the head is on)
//   V3 a finger dragged far outside the bowl cannot take the whisk out of it
//   V4 the mix screen names the next step ("1 Pour" ...) and the recipe tiles are marked with what to add
//   V5 bottling: the stream starts at the pitcher's spout, lands on the bottle's mouth and the liquid in the bottle is the sauce's colour
//   V6 no console errors
// Screenshots: out/sauce-v-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  openShortcut,
  shot,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const saveAt = (n, business = {}) =>
  seedSave({
    credits: 500_000,
    business: { ...MOVED_IN_BUSINESS, ...business },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const tap = async (page, sel) => {
  const ok = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    el.click();
    return true;
  }, sel);
  await sleep(250);
  return ok;
};
const rect = (page, sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  }, sel);
const press = async (page, sel, hold = 60) => {
  const r = await rect(page, sel);
  if (!r) return false;
  await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
  await page.mouse.down();
  await sleep(hold);
  await page.mouse.up();
  await sleep(80);
  return true;
};
const root = (page) =>
  page.evaluate(() => {
    const g = document.querySelector('[data-testid="sauce-station"]');
    return g
      ? {
          phase: g.dataset.phase,
          sauce: g.dataset.sauce,
          volume: Number(g.dataset.volume),
          blend: Number(g.dataset.blend),
          recipe: g.dataset.recipe,
        }
      : null;
  });
const tool = (page) =>
  page.evaluate(() => {
    const t = document.querySelector('[data-testid="sauce-tool"]');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    const st = getComputedStyle(t).transform;
    let deg = null;
    if (st && st !== "none") {
      const m = st
        .match(/matrix\(([^)]+)\)/)?.[1]
        .split(",")
        .map(Number);
      if (m) deg = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
    }
    return {
      held: t.dataset.held,
      tilt: Number(t.dataset.tilt),
      deg,
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
    };
  });

const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await boot(page, saveAt(7, { sauceStation: { howto: 1 } }));
await openShortcut(page, "inventory");
await sleep(1200);
await tap(page, '[data-testid="sauce-station-chip"]');
await sleep(1000);
await shot(page, "sauce-v-1-ready");
await tap(page, '[data-testid="sauce-start"]');
await sleep(400);
await shot(page, "sauce-v-2-mix-empty");

// V4: guidance
const guide = await page.evaluate(() => ({
  step:
    document
      .querySelector('[data-testid="sauce-step"]')
      ?.textContent?.replace(/\s+/g, " ")
      .trim() ?? null,
  marked: [...document.querySelectorAll('[data-testid^="sauce-pantry-"][data-need]')].map(
    (e) => `${e.dataset.testid}:${e.dataset.need}`,
  ),
  recipe: document.querySelector('[data-testid="sauce-station"]')?.dataset.recipe ?? null,
}));
check(
  "V4 the mix screen says what to do next and marks the recipe tiles with how many to add",
  !!guide.step && /pour/i.test(guide.step) && guide.marked.length >= 3,
  guide,
);

// pour a few scoops so there is liquid
const first = guide.marked[0]?.split(":")[0];
for (let i = 0; i < 3; i++) await press(page, `[data-testid="${first}"]`);
await sleep(300);
const stage = await rect(page, '[data-testid="sauce-stage"]');
const cx = stage.x + stage.w * 0.5;
const cy = stage.y + stage.h * 0.5;

// V1/V2: circle the whisk
await page.mouse.move(cx + stage.w * 0.18, cy);
await page.mouse.down();
let right = null;
let left = null;
for (let k = 0; k < 90; k++) {
  const a = (k / 30) * 2 * Math.PI;
  await page.mouse.move(cx + Math.cos(a) * stage.w * 0.18, cy + Math.sin(a) * stage.h * 0.09);
  await sleep(14);
  if (k === 8) right = await tool(page);
  if (k === 23) left = await tool(page);
  if (k === 50) await shot(page, "sauce-v-3-whisking");
}
check(
  "V1 held: the whisk is turned over (about 180 degrees), handle up, its head at the fingertip",
  !!right && right.held === "1" && Math.abs(Math.abs(right.deg) - 180) < 40,
  right,
);
check(
  "V2 the handle leans toward the middle: the tilt flips sign from one side of the bowl to the other",
  !!right && !!left && right.tilt * left.tilt < 0,
  { right: right?.tilt, left: left?.tilt },
);
// V3: far outside the bowl
await page.mouse.move(stage.x + stage.w * 1.4, stage.y + stage.h * 1.4);
await sleep(150);
const out = await tool(page);
await page.mouse.up();
check(
  "V3 a finger far outside the bowl cannot take the whisk out of it",
  !!out &&
    out.left >= stage.x - 120 &&
    out.right <= stage.x + stage.w + 120 &&
    out.bottom <= stage.y + stage.h * 1.0,
  { out, stage },
);
await sleep(300);
await shot(page, "sauce-v-4-resting");

// V5: bottling
await tap(page, '[data-testid="sauce-auto"]');
await sleep(2500);
await tap(page, '[data-testid="sauce-bottle-it"]');
await sleep(800);
await shot(page, "sauce-v-5-bottle-ready");
const bt = await rect(page, '[data-testid="sauce-pour"]');
if (bt) {
  await page.mouse.move(bt.x + bt.w / 2, bt.y + bt.h / 2);
  await page.mouse.down();
  await sleep(1100);
  await shot(page, "sauce-v-6-pouring");
  const geo = await page.evaluate(() => {
    const q = (s) => document.querySelector(s)?.getBoundingClientRect();
    const st = q('[data-testid="sauce-stream"]');
    const bottle = q('[data-testid="sauce-bottling"] [data-testid="sauce-bottle"]');
    const jug = q('[data-testid="sauce-jug"]');
    const cv = document.querySelector(
      '[data-testid="sauce-bottling"] [data-testid="sauce-bottle-liquid"]',
    );
    let rows = null;
    if (cv && cv.width) {
      const ctx = cv.getContext("2d");
      const W = cv.width;
      const H = cv.height;
      const alphaAt = (y) => {
        const d = ctx.getImageData(0, Math.min(H - 1, Math.floor(y * H)), W, 1).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
        return n;
      };
      const mid = ctx.getImageData(Math.floor(W * 0.5), Math.floor(H * 0.82), 1, 1).data;
      rows = { below: alphaAt(0.95), body: alphaAt(0.82), mid: [mid[0], mid[1], mid[2], mid[3]] };
    }
    return {
      stream: st ? { l: st.left, r: st.right, t: st.top, b: st.bottom } : null,
      bottle: bottle ? { l: bottle.left, r: bottle.right, t: bottle.top, b: bottle.bottom } : null,
      jug: jug ? { l: jug.left, t: jug.top, b: jug.bottom } : null,
      rows,
    };
  });
  await page.mouse.up();
  check(
    "V5 the stream falls inside the bottle's neck from the pitcher's spout, and the sauce is painted only inside the glass (none under the base)",
    !!geo.stream &&
      !!geo.bottle &&
      !!geo.jug &&
      geo.stream.l >= geo.bottle.l &&
      geo.stream.r <= geo.bottle.r &&
      geo.stream.t <= geo.bottle.t + (geo.bottle.b - geo.bottle.t) * 0.12 &&
      Math.abs(geo.jug.b - geo.jug.t) > 20 &&
      !!geo.rows &&
      geo.rows.below === 0 &&
      geo.rows.body > 10 &&
      geo.rows.mid[3] > 200,
    geo,
  );
}

check(
  "V6 no console errors",
  logs.filter((l) => /^(error|pageerror)/.test(l)).length === 0,
  logs.slice(0, 3),
);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
