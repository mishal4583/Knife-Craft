// Kitchen Dispatch (developer 2026-11-17: ingredient crates that slide out of a counter), restaurant build, real browser:
// business/crateDispatch.ts + components/kc/inventory/KitchenDispatchGame.tsx. Opened with ?kitchenDispatch=<level> (a
// developer preview; not in the daily routine). The rules and every board are proved by scripts/crate-dispatch-qa.mts;
// this checks the screen that runs them.
//   K1 Level 18: a 9:16 stage inside the phone, a level badge, a clock, the crates counted, three boosters, nothing scrolls
//   K2 a tap on a blocked crate shakes it, says so and counts a blocked tap; a free one leaves and the count drops
//   K3 Hint costs one and Extra Time adds 20 seconds to the clock
//   K4 Undo puts the last crate back and costs one
//   K5 pause: Resume, Restart and Leave; the clock stands still; Resume closes the card
//   K6 tapping the counter until it is empty wins: stars, blocked taps, Next dispatch and Leave
//   K7 doing nothing until the clock runs out: Time is up, Try again is the same counter with the full clock
//   K8 five phone sizes x tiers 1 and 4: no sideways scroll, every button 48 px, the stage inside the screen
//   K9 Back leaves the game
//   K10 no console errors
// Screenshots: out/kitchendispatch-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  PAIGE_QUIET,
  launch,
  seedSave,
  sleep,
  shot,
  SAVE_KEY,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

const saveAt = (n) =>
  seedSave({
    credits: 50_000,
    business: { ...MOVED_IN_BUSINESS, assistant: PAIGE_QUIET },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });

const { browser, page, logs } = await launch();
const GAME = '[data-testid="kitchen-dispatch-game"]';
const COLS = { 18: 5, 28: 6, 45: 7, 65: 7 };

async function open(level, w = 390, h = 844) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  const base = (process.env.KC_URL || "http://localhost:4173/").split("?")[0];
  await page.goto(`${base}?kitchenDispatch=${level}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.bridge, { timeout: 20000 });
  await page.evaluate(
    async (s, key) => {
      localStorage.clear();
      await window.bridge.storage.set([key], [JSON.stringify(s)]);
    },
    saveAt(level),
    SAVE_KEY,
  );
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector(GAME, { timeout: 20000 });
  // The Playgama loading overlay covers the screen for the first moments; taps before it goes miss.
  await page.waitForFunction(
    () => document.elementFromPoint(5, 5)?.closest("#loading-overlay") === null,
    {
      timeout: 20000,
    },
  );
  await sleep(500);
}
const data = (name) => page.$eval(GAME, (e, n) => e.dataset[n], name);
const text = (id) => page.$eval(`[data-testid="${id}"]`, (e) => e.textContent);
const crates = async () => Number(await data("crates"));
const seconds = async () => {
  const [m, s] = (await text("kd-time")).trim().split(":").map(Number);
  return m * 60 + s;
};
const num = async (id) => Number((await text(id)).trim());
const GRID = { x: 40 + (460 * 70) / 1080, y: 292 + (460 * 70) / 1080, size: (460 * 940) / 1080 };
async function tapCell(cx, cy, cols) {
  const box = await (await page.$('[data-testid="kd-canvas"]')).boundingBox();
  const cell = GRID.size / cols;
  const sx = GRID.x + (cx + 0.5) * cell;
  const sy = GRID.y + (cy + 0.5) * cell;
  await page.mouse.click(box.x + (sx / 540) * box.width, box.y + (sy / 960) * box.height);
}
/** Taps every cell, round after round, until `stop()` says so: a free crate leaves, a blocked one shakes. */
async function scan(cols, stop, ms = 90_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    for (let cy = 0; cy < cols; cy++)
      for (let cx = 0; cx < cols; cx++) {
        if (await stop()) return true;
        await tapCell(cx, cy, cols);
      }
    await sleep(120);
  }
  return false;
}

// K1
await open(18);
const k1 = await page.evaluate(() => {
  const c = document.querySelector('[data-testid="kd-canvas"]').getBoundingClientRect();
  return {
    ratio: Math.round((c.width / c.height) * 1000) / 1000,
    sw: document.documentElement.scrollWidth,
    iw: innerWidth,
    top: Math.round(c.top),
    bottom: Math.round(c.bottom),
    ih: innerHeight,
  };
});
const n0 = await crates();
const t0 = await seconds();
check(
  "K1 Level 18: a 9:16 stage inside the phone, the level on its badge, the clock, the crates counted, three boosters",
  Math.abs(k1.ratio - 0.5625) < 0.01 &&
    k1.sw <= k1.iw &&
    k1.top >= 0 &&
    k1.bottom <= k1.ih &&
    (await text("kd-level")).trim() === "18" &&
    n0 >= 6 &&
    n0 <= 7 &&
    t0 <= 20 + n0 * 8 &&
    t0 >= 20 + n0 * 8 - 4 &&
    (await num("kd-booster-hint-n")) === 3 &&
    (await num("kd-booster-time-n")) === 3 &&
    (await num("kd-booster-undo-n")) === 3,
  { k1, n0, t0 },
);
await shot(page, "kitchendispatch-start");

// K2: find a blocked tap and a free one by tapping the counter
let sawBlocked = false;
let sawNotice = false;
const before = await crates();
await scan(5, async () => {
  if ((await crates()) < before && sawBlocked) return true;
  if (!sawNotice && (await text("kd-notice")).includes("in the way")) sawNotice = true;
  sawBlocked = sawBlocked || Number(await data("blocked")) > 0;
  return false;
});
const k2 = { crates: await crates(), before, blocked: Number(await data("blocked")), sawNotice };
check(
  "K2 a blocked crate shakes and is counted with a notice; a free crate leaves and the count drops",
  k2.crates < before && k2.blocked >= 1,
  k2,
);

// K3: Hint and Extra Time
await open(18);
const tBefore = await seconds();
await page.click('[data-testid="kd-booster-hint"]');
await sleep(200);
await page.click('[data-testid="kd-booster-time"]');
await sleep(300);
const tAfter = await seconds();
const k3 = {
  hint: await num("kd-booster-hint-n"),
  time: await num("kd-booster-time-n"),
  tBefore,
  tAfter,
};
check(
  "K3 Hint costs one and Extra Time adds 20 seconds",
  k3.hint === 2 && k3.time === 2 && k3.tAfter >= k3.tBefore + 19,
  k3,
);

// K4: Undo
await open(18);
const start4 = await crates();
await scan(5, async () => (await crates()) < start4);
const mid4 = await crates();
await sleep(500);
await page.click('[data-testid="kd-booster-undo"]');
await sleep(300);
const k4 = { start4, mid4, after: await crates(), undos: await num("kd-booster-undo-n") };
check(
  "K4 Undo puts the last crate back and costs one",
  k4.mid4 === start4 - 1 && k4.after === start4 && k4.undos === 2,
  k4,
);

// K5: pause
await open(18);
await page.click('[data-testid="kd-pause"]');
await sleep(300);
const k5 = {
  overlay: await page.$('[data-testid="kd-overlay"]').then(Boolean),
  resume: await page.$('[data-testid="kd-resume"]').then(Boolean),
  restart: await page.$('[data-testid="kd-restart"]').then(Boolean),
  leave: await page.$('[data-testid="kd-leave"]').then(Boolean),
};
const s5 = await seconds();
await sleep(2200);
const still = (await seconds()) === s5;
await page.click('[data-testid="kd-resume"]');
await sleep(300);
k5.closed = !(await page.$('[data-testid="kd-overlay"]'));
check(
  "K5 pause: Resume, Restart and Leave; the clock stands still; Resume closes the card",
  k5.overlay && k5.resume && k5.restart && k5.leave && k5.closed && still,
  { ...k5, still },
);

// K6: clear the counter
await open(18);
const cleared = await scan(5, async () => (await data("phase")) === "won");
await sleep(900);
if (cleared || (await data("phase")) === "won") {
  const k6 = {
    stars: await page.$('[data-testid="kd-result"]').then(Boolean),
    next: await page.$('[data-testid="kd-next"]').then(Boolean),
    leave: await page.$('[data-testid="kd-leave"]').then(Boolean),
    picture: await page.$('[data-testid="kd-picture"]').then(Boolean),
    result: (await text("kd-result")).replace(/\s+/g, " ").trim(),
  };
  await shot(page, "kitchendispatch-win");
  check(
    "K6 tapping the counter until it is empty wins: stars, blocked taps, the picture, Next dispatch and Leave",
    k6.stars && k6.next && k6.leave && k6.picture && /blocked/.test(k6.result),
    k6,
  );
} else check("K6 the counter was cleared", false, { phase: await data("phase") });

// K7: out of time
await open(18);
const crates7 = await crates();
const full7 = await seconds();
const t7 = Date.now();
while (Date.now() - t7 < 110_000 && (await data("phase")) !== "lost") await sleep(1000);
const lost = (await data("phase")) === "lost";
if (lost) {
  await shot(page, "kitchendispatch-lost");
  await page.click('[data-testid="kd-restart"]');
  await sleep(500);
  check(
    "K7 out of time: Time is up; Try again is the same counter with the full clock",
    (await data("phase")) === "play" &&
      (await crates()) === crates7 &&
      (await seconds()) >= full7 - 1,
    { crates7, full7, now: await seconds() },
  );
} else check("K7 the clock ran out", false, { phase: await data("phase") });

// K8
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 900],
  [768, 1024],
]) {
  for (const level of [18, 65]) {
    await open(level, w, h);
    const m = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="kd-canvas"]').getBoundingClientRect();
      const small = [...document.querySelectorAll('[data-testid="kitchen-dispatch-game"] button')]
        .map((b) => b.getBoundingClientRect())
        .filter((r) => r.width > 0 && (r.width < 47.5 || r.height < 47.5)).length;
      return {
        sw: document.documentElement.scrollWidth,
        iw: innerWidth,
        small,
        top: c.top,
        bottom: c.bottom,
        left: c.left,
        right: c.right,
        ih: innerHeight,
      };
    });
    check(
      `K8 Level ${level} at ${w} x ${h}: no sideways scroll, 48 px buttons, the stage inside the screen`,
      m.sw <= m.iw &&
        m.small === 0 &&
        m.top >= -1 &&
        m.bottom <= m.ih + 1 &&
        m.left >= -1 &&
        m.right <= m.iw + 1,
      m,
    );
    if (level === 65 && w === 320) await shot(page, "kitchendispatch-65-320");
  }
}

// K9
await open(18);
await page.click('[data-testid="kd-back"]');
await sleep(800);
check("K9 Back leaves the game", !(await page.$(GAME)), {});

check(
  "K10 no console errors",
  logs.filter((l) => !/favicon|ERR_FAILED|net::/.test(l)).length === 0,
  logs.slice(0, 5),
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nKITCHEN DISPATCH: ALL PASS");
process.exit(failed.length ? 1 : 0);
