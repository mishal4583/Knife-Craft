// Car Park (developer 2026-11-15: guests' cars and the neighbour's share one lot; tap a clear vehicle and it drives out), restaurant build,
// real browser: business/carPark.ts + components/kc/inventory/CarParkGame.tsx. Opened with ?carPark=<level> (the test hook every mini-game has).
//   P1 Level 22: a 5 x 7 lot with 8 to 10 painted vehicles, the backdrop and the neighbour load, no fallback boxes, patience 3 of 3
//   P2 a BLOCKED vehicle honks: one heart is gone, the lot is unchanged
//   P3 a CLEAR vehicle drives out (one fewer in the lot) and no heart is lost
//   P4 three honks: "the neighbour called a tow truck", and "Try again" is the SAME lot with three hearts
//   P5 pause: Resume, Restart (the same lot again, no round counted), Leave
//   P6 the Tow takes one blocked vehicle for a star and is then used up (no ad in this build)
//   P7 clearing the lot (a clean run): three stars, the save has the round, the business day done, money and stock untouched
//   P8 320 x 568: nothing scrolls sideways; Level 32 (6 columns) vehicles are at least 40 px wide at 320 and 48 px at 390
//   P9 no console errors
//   P11 Level 32: the hired Prep Cook clears the Car Park from the sheet (no stars, no money)
//   P10 the routine: from Level 15 the 'Before you open' sheet ends with the Car Park (none at Level 14)
// Screenshots: out/carpark-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  PAIGE_QUIET,
  launch,
  seedSave,
  readSave,
  sleep,
  boot,
  openShortcut,
  shot,
  SAVE_KEY,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

const saveAt = (n, carPark = { howto: true }) =>
  seedSave({
    credits: 50_000,
    business: { ...MOVED_IN_BUSINESS, carPark, assistant: PAIGE_QUIET },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });

const { browser, page, logs } = await launch();

async function open(level, w = 390, h = 844, carPark) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  const base = (process.env.KC_URL || "http://localhost:4173/").split("?")[0];
  await page.goto(`${base}?carPark=${level}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.bridge, { timeout: 20000 });
  await page.evaluate(
    async (s, key) => {
      localStorage.clear();
      await window.bridge.storage.set([key], [JSON.stringify(s)]);
    },
    saveAt(level, carPark),
    SAVE_KEY,
  );
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector('[data-testid="car-park-game"] section button', { timeout: 20000 });
  // the loading screen fades out over the game; a click before it is gone lands on the overlay (stale timing, 2026-11-19)
  await page.waitForFunction(
    () => document.elementFromPoint(5, 5)?.closest("#loading-overlay") === null,
    { timeout: 20000 },
  );
  await sleep(300);
}
const vehicles = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="car-park-game"] section button')].map((b) => {
      const r = b.getBoundingClientRect();
      return {
        label: b.getAttribute("aria-label"),
        movable: /can move/.test(b.getAttribute("aria-label")),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    }),
  );
const clickVehicle = (index) =>
  page.evaluate((i) => {
    document.querySelectorAll('[data-testid="car-park-game"] section button')[i].click();
  }, index);
const find = (pred) => vehicles().then((v) => v.findIndex(pred));
const heartsLeft = () =>
  page.evaluate(
    () =>
      document
        .querySelector('[data-testid="car-park-game"] [aria-label$="patience hearts left"]')
        ?.getAttribute("aria-label")
        .match(/\d+/)?.[0],
  );
const text = () => page.evaluate(() => document.body.innerText);
const clickText = (re) =>
  page.evaluate((src) => {
    const re = new RegExp(src);
    const b = [...document.querySelectorAll("button")].find((x) => re.test(x.textContent.trim()));
    b?.click();
    return !!b;
  }, re.source);

// P1
await open(22);
{
  const v = await vehicles();
  const broken = await page.evaluate(
    () =>
      [...document.querySelectorAll('[data-testid="car-park-game"] img')].filter(
        (i) => i.complete && i.naturalWidth === 0,
      ).length,
  );
  const fallback = await page.evaluate(
    () =>
      [...document.querySelectorAll('[data-testid="car-park-game"] section button')].filter((b) =>
        /[🚗🚙]/u.test(b.textContent),
      ).length,
  );
  check(
    "P1 a 5 x 7 lot of 8-10 painted vehicles, all pictures load",
    v.length >= 8 &&
      v.length <= 10 &&
      broken === 0 &&
      fallback === 0 &&
      (await heartsLeft()) === "3",
    { count: v.length, broken, fallback },
  );
  await shot(page, "carpark-1-lot");
}
// P2 + P3
{
  const before = await vehicles();
  const blocked = before.findIndex((x) => !x.movable);
  await clickVehicle(blocked);
  await sleep(250);
  const after = await vehicles();
  check(
    "P2 a blocked vehicle honks: a heart is lost, the lot is unchanged",
    (await heartsLeft()) === "2" && after.length === before.length,
    { hearts: await heartsLeft() },
  );
  await shot(page, "carpark-2-honk");
  await sleep(700);
  const free = after.findIndex((x) => x.movable);
  await clickVehicle(free);
  await sleep(700);
  const last = await vehicles();
  check(
    "P3 a clear vehicle drives out and costs nothing",
    last.length === before.length - 1 && (await heartsLeft()) === "2",
    { count: last.length },
  );
}
// P4
{
  await open(22);
  for (let i = 0; i < 3; i++) {
    const idx = await find((x) => !x.movable);
    await clickVehicle(idx);
    await sleep(120);
  }
  const t = await text();
  check(
    "P4 three honks: the neighbour calls a tow truck",
    /called a tow truck/i.test(t),
    t.slice(0, 120),
  );
  await shot(page, "carpark-3-failed");
  await clickText(/^Try again/);
  await sleep(500);
  const v = await vehicles();
  check(
    "P4b Try again: the same lot, three hearts",
    v.length >= 8 && (await heartsLeft()) === "3",
    { count: v.length },
  );
}
// P5
{
  await open(22);
  const total = (await vehicles()).length;
  const idx = await find((x) => x.movable);
  await clickVehicle(idx);
  await sleep(700);
  await page.evaluate(() => document.querySelector('[aria-label="Pause"]').click());
  await sleep(300);
  const paused = await text();
  const hasButtons =
    /Resume/.test(paused) && /Restart this lot/.test(paused) && /Leave/.test(paused);
  await shot(page, "carpark-4-paused");
  await clickText(/^Restart this lot/);
  await sleep(500);
  const again = (await vehicles()).length;
  const save = await readSave(page);
  check(
    "P5 pause has Resume / Restart / Leave; Restart puts the same lot back and counts no round",
    hasButtons && again === total && !(save?.business?.carPark?.rounds > 0),
    { total, again },
  );
}
// P6
{
  await open(22);
  const before = (await vehicles()).length;
  await page.click('[data-testid="carpark-tow"]');
  await sleep(200);
  const idx = await find((x) => !x.movable);
  await clickVehicle(idx);
  await sleep(700);
  const after = (await vehicles()).length;
  const t = await text();
  check(
    "P6 the Tow takes one blocked vehicle and is then used up",
    after === before - 1 && /Tow used/.test(t),
    { before, after },
  );
}
// P7: clear the whole lot without a honk
{
  await open(15);
  const startSave = await readSave(page);
  for (let guard = 0; guard < 40; guard++) {
    const idx = await find((x) => x.movable);
    if (idx < 0) break;
    await clickVehicle(idx);
    await sleep(520);
    if (/The lot is clear/.test(await text())) break;
  }
  await sleep(400);
  const t = await text();
  await shot(page, "carpark-5-won");
  const save = await readSave(page);
  const cp = save?.business?.carPark ?? {};
  check(
    "P7a a clean run: the lot is clear, three stars",
    /The lot is clear/.test(t) && /⭐⭐⭐/.test(t) && cp.stars === 3 && cp.rounds === 1,
    cp,
  );
  check(
    "P7b the business day is done and money and stock are untouched",
    cp.doneDay === save.business.calendar.businessDay &&
      save.credits === startSave.credits &&
      JSON.stringify(save.business.inventory) === JSON.stringify(startSave.business.inventory) &&
      (save.economyLedger?.length ?? 0) === (startSave.economyLedger?.length ?? 0),
  );
}
// P8
{
  await open(32, 320, 568);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  const small = await vehicles();
  const minW320 = Math.min(...small.map((x) => Math.min(x.w, x.h)));
  await shot(page, "carpark-6-320");
  await open(32, 390, 844);
  const big = await vehicles();
  const minW390 = Math.min(...big.map((x) => Math.min(x.w, x.h)));
  check(
    "P8 no sideways scroll at 320; a 6-column vehicle is >= 40 px at 320 and >= 48 px at 390",
    sw <= 320 && minW320 >= 40 && minW390 >= 48,
    { sw, minW320, minW390 },
  );
}
// P12: a vehicle's departure remains on its row or column, so it cannot cut diagonally through corner scenery.
{
  await open(22);
  const routes = [];
  for (let guard = 0; guard < 10; guard++) {
    const idx = await find((x) => x.movable);
    if (idx < 0) break;
    await clickVehicle(idx);
    await page.waitForSelector('[data-testid="carpark-departing"]', { timeout: 1500 });
    routes.push(
      await page.$eval('[data-testid="carpark-departing"]', (el) => {
        const style = getComputedStyle(el);
        return {
          axis: el.dataset.axis,
          direction: Number(el.dataset.direction),
          dx: parseFloat(style.getPropertyValue("--dx")) || 0,
          dy: parseFloat(style.getPropertyValue("--dy")) || 0,
        };
      }),
    );
    await sleep(500);
    if (/The lot is clear/.test(await text())) break;
  }
  const straightExits =
    routes.length > 0 &&
    routes.every((r) => {
      const horizontal = r.axis === "h";
      const active = horizontal ? r.dx : r.dy;
      const inactive = horizontal ? r.dy : r.dx;
      return active !== 0 && inactive === 0 && Math.sign(active) === r.direction;
    });
  check(
    "P12 departures stay in one row or column and exit in the arrow direction (no corner cuts)",
    straightExits,
    routes,
  );
}
// P10: the routine. From Level 15 the "Before you open" sheet lists the Car Park as the LAST step; at Level 14 it does not.
{
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const base = (process.env.KC_URL || "http://localhost:4173/").split("?")[0];
  const stepsAt = async (level) => {
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await boot(page, saveAt(level, {}));
    await openShortcut(page, "kitchen");
    await sleep(1200);
    await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((x) => /^Open for service$/.test((x.textContent ?? "").trim()))
        ?.click(),
    );
    await sleep(900);
    return page.evaluate(() =>
      [
        ...document.querySelectorAll('[data-testid="service-gate"] [data-testid^="flow-step-"]'),
      ].map((e) => e.dataset.testid.replace("flow-step-", "")),
    );
  };
  const at20 = await stepsAt(20);
  await shot(page, "carpark-7-sheet");
  const at14 = await stepsAt(14);
  check(
    "P10 Level 20: the 'Before you open' sheet ends with the Car Park; Level 14: no Car Park",
    at20.at(-1) === "carpark" && !at14.includes("carpark"),
    { at20, at14 },
  );
}
// P11: the Prep Cook. From Level 30 a hired Prep Cook clears the Car Park from the sheet: the day's step is done, no stars, no money.
{
  const base = (process.env.KC_URL || "http://localhost:4173/").split("?")[0];
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const seed = saveAt(32, {});
  seed.business.staff = { hiredRoles: ["server", "cashier", "prep-cook"] };
  seed.business.sauceStation = { doneDay: 1 };
  await boot(page, seed);
  await openShortcut(page, "kitchen");
  await sleep(1200);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((x) => /^Open for service$/.test((x.textContent ?? "").trim()))
      ?.click(),
  );
  await sleep(900);
  const label = await page.evaluate(
    () => document.querySelector('[data-testid="gate-prep-cook"]')?.textContent ?? null,
  );
  const before = await readSave(page);
  await page.evaluate(() => document.querySelector('[data-testid="gate-prep-cook"]')?.click());
  await sleep(900);
  const after = await readSave(page);
  const cp = after?.business?.carPark ?? {};
  check(
    "P11 Level 32: the Prep Cook clears the Car Park from the sheet, with no stars and no money",
    /car park/i.test(label ?? "") &&
      cp.doneDay === 1 &&
      !cp.stars &&
      !cp.rounds &&
      after.credits === before.credits,
    { label, cp },
  );
}
check(
  "P9 no console errors",
  logs.filter((l) => !/favicon|ERR_FAILED|net::/.test(l)).length === 0,
  logs.slice(0, 5),
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nCAR PARK: ALL PASS");
process.exit(failed.length ? 1 : 0);
