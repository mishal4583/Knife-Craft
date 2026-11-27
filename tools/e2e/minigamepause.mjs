// THE MINI-GAMES' CLOCKS AND THE CAR PARK'S TOW AD in a real browser, restaurant build (deep check 2026-11-27).
//   P1-P6 every timed mini-game stops its clock while the PLATFORM pauses the game (Playgama pause_state_changed: an ad, the player switching away)
//         and goes on after: Fridge Sort, Stock the shelves, Check the delivery, Fridge Check, Sauce Station, Unload the Van. The pause is sent by the
//         real Bridge (`platform._platformBridge._setPauseState`), the same call a platform makes.
//   D1    Check the delivery: the "?" how-to opened in the middle of a round stops the clock
//   C1    Car Park: with the two day counters apart (as for every player from Level 10), the tow ad is offered once a day
//   C2    Car Park: an ad tow not yet used is still there after "Restart this lot"
//   E1    no console errors
// Rewarded ads are stubbed as adbonuses.mjs does it (the mock Bridge has none). Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  PAIGE_QUIET,
  GAME_URL,
  SAVE_KEY,
  launch,
  boot,
  seedSave,
  readSave,
  sleep,
  openShortcut,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

const CRATE = ["tomato", "carrot", "cheddar", "apple", "salmon", "basil"];
const COUNTS = { tomato: 2, carrot: 1, cheddar: 1, apple: 1, salmon: 1, basil: 1 };
const STOCK = Object.fromEntries(
  [...CRATE, "potato"].map((id) => [
    id,
    { ingredientId: id, quantity: 4, unitCost: 100, purchaseDay: 1 },
  ]),
);
const levels = (n) => ({
  currentLevelId: `level-${n}`,
  highestUnlockedLevelId: `level-${n}`,
  completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  campaignVersion: 4,
});
const saveAt = (n, business = {}) =>
  seedSave({
    credits: 50_000,
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: STOCK,
      assistant: PAIGE_QUIET,
      sectionsSeen: ["shop", "inventory", "rack", "business"],
      ...business,
    },
    levelProgress: levels(n),
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });

const { browser, page, logs } = await launch();
await page.evaluateOnNewDocument(() => {
  window.__rewarded = [];
  let real;
  Object.defineProperty(window, "bridge", {
    configurable: true,
    get: () => real,
    set(b) {
      real = b;
      const init = b.initialize.bind(b);
      b.initialize = (...args) =>
        init(...args).then((r) => {
          const adv = b.advertisement;
          const handlers = {};
          for (const k of ["isRewardedSupported", "isInterstitialSupported"])
            Object.defineProperty(adv, k, { get: () => true, configurable: true });
          adv.on = (e, cb) => (handlers[e] ??= []).push(cb);
          adv.off = (e, cb) => (handlers[e] = (handlers[e] ?? []).filter((x) => x !== cb));
          const emit = (e, s) => (handlers[e] ?? []).slice().forEach((h) => h(s));
          const play = (e, states) =>
            states.forEach((s, i) => setTimeout(() => emit(e, s), 80 * (i + 1)));
          adv.showRewarded = (placement) => {
            window.__rewarded.push(placement);
            play(b.EVENT_NAME.REWARDED_STATE_CHANGED, ["opened", "rewarded", "closed"]);
          };
          adv.showInterstitial = () =>
            play(b.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, ["opened", "closed"]);
          return r;
        });
    },
  });
});

const tap = async (sel, wait = 350) => {
  const ok = await page.evaluate((s) => {
    const e = document.querySelector(s);
    e?.click();
    return !!e;
  }, sel);
  await sleep(wait);
  return ok;
};
/** A real mouse tap in the middle of an element. */
const mouseOn = async (sel) => {
  const el = await page.$(sel);
  const box = await el?.boundingBox();
  if (!box) return false;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(700);
  return true;
};
async function sheet(game) {
  for (let i = 0; i < 4; i++) {
    const had = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) => x.textContent.trim() === "Later",
      );
      b?.click();
      return !!b;
    });
    await sleep(500);
    if (!had) break;
  }
  await openShortcut(page, "minigames");
  await page.waitForSelector(`[data-testid="minigame-${game}"]`, { timeout: 8000 });
  await tap(`[data-testid="minigame-${game}"]`, 1500);
}
async function byQuery(query, save) {
  await page.goto(`${GAME_URL.split("?")[0]}?${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.bridge?.storage, { timeout: 20000 });
  await page.evaluate(
    async (s, k) => {
      localStorage.clear();
      await window.bridge.storage.set([k], [JSON.stringify(s)]);
    },
    save,
    SAVE_KEY,
  );
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(
    () => document.elementFromPoint(5, 5)?.closest("#loading-overlay") === null,
    { timeout: 20000 },
  );
  await sleep(2000);
}
/** A clock's seconds, from "1:23" or "83". */
const seconds = async (id) => {
  const t = await page.evaluate(
    (i) => document.querySelector(`[data-testid="${i}"]`)?.textContent?.replace(/[^\d:]/g, ""),
    id,
  );
  if (!t) return NaN;
  const parts = t.split(":").map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
};
const platformPause = (on) =>
  page.evaluate((v) => window.bridge.platform._platformBridge._setPauseState(v), on);

const GAMES = [
  {
    name: "Fridge Sort",
    timer: "sort-timer",
    open: async () => {
      await boot(
        page,
        saveAt(30, {
          fridgeSort: { crate: CRATE, counts: COUNTS, seed: 1 },
          deliveryInspection: { seed: 1, inspected: 99, howto: 31 },
        }),
      );
      await sleep(900);
      await sheet("fridge-sort");
      await tap('[data-testid="sort-guide-ok"]');
      await tap('[data-testid^="sort-token-"]');
      await tap("[data-target-id]");
    },
  },
  {
    name: "Stock the shelves",
    timer: "stock-timer",
    open: async () => {
      await boot(
        page,
        saveAt(30, {
          stockroomSort: {
            crate: [
              { id: "tongs", sets: 1 },
              { id: "ladles", sets: 1 },
              { id: "whisks", sets: 1 },
            ],
            seed: 1,
          },
        }),
      );
      await sleep(900);
      await sheet("stockroom");
      await tap('[data-testid="stock-guide-ok"]');
      await tap('[data-testid="stock-hint"]');
    },
  },
  {
    name: "Check the delivery",
    timer: "insp-timer",
    open: async () => {
      await boot(
        page,
        saveAt(30, {
          fridgeSort: { crate: CRATE, counts: COUNTS, seed: 1 },
          deliveryInspection: { seed: 1, inspected: 0, howto: 31 },
        }),
      );
      await sleep(900);
      await sheet("inspection");
      await tap('[data-testid="insp-guide-ok"]');
      await tap('[data-testid="insp-start"]');
    },
  },
  {
    name: "Fridge Check",
    timer: "fc-timer",
    open: async () => {
      await boot(page, saveAt(30));
      await sleep(900);
      await sheet("fridge-check");
      await tap('[data-testid="fc-guide-skip"]');
      await tap('[data-testid="fc-keep"]');
    },
  },
  {
    name: "Sauce Station",
    timer: "sauce-timer",
    open: async () => {
      await boot(page, saveAt(30));
      await sleep(900);
      await sheet("sauce");
      await tap('[data-testid="sauce-guide-ok"]');
      await tap('[data-testid="sauce-start"]');
    },
  },
  {
    name: "Unload the Van",
    timer: "kd-time",
    open: async () => {
      await byQuery("kitchenDispatch=30", saveAt(30));
      await tap('[data-testid="kd-slip-close"]');
    },
  },
];

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
let n = 0;
for (const g of GAMES) {
  n++;
  await g.open();
  await sleep(1500);
  await platformPause(true);
  await sleep(300);
  const paused = await seconds(g.timer);
  await sleep(3500);
  const still = await seconds(g.timer);
  await platformPause(false);
  await sleep(2500);
  const after = await seconds(g.timer);
  check(
    `P${n} ${g.name}: the clock waits while the platform pauses, and goes on after`,
    Number.isFinite(paused) && still === paused && after < still,
    { paused, after3500msPaused: still, after2500msResumed: after },
  );
}

// D1: the delivery check's "?" how-to, in the middle of a round
await GAMES[2].open();
await sleep(1200);
await tap('[data-testid="insp-help"]');
const guideUp = await page.evaluate(() => !!document.querySelector('[data-testid^="insp-guide"]'));
const a = await seconds("insp-timer");
await sleep(3500);
const b = await seconds("insp-timer");
check("D1 Check the delivery: the how-to opened mid-round stops the clock", guideUp && a === b, {
  guideUp,
  before: a,
  after3500ms: b,
});

// C1 / C2: the Car Park's tow ad
const drifted = () =>
  saveAt(22, { carPark: { howto: true }, calendar: { businessDay: 3 }, restaurantDay: { day: 7 } });
const carpark = '[data-testid="car-park-game"]';
const towText = () =>
  page.evaluate(() => document.querySelector('[data-testid="carpark-tow"]')?.textContent?.trim());
const tapBlocked = async () => {
  const p = await page.evaluate((root) => {
    const v = [...document.querySelectorAll(`${root} section button`)].find((x) =>
      /blocked/.test(x.getAttribute("aria-label")),
    );
    const r = v?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }, carpark);
  if (!p) return false;
  await page.mouse.click(p.x, p.y);
  await sleep(700);
  return true;
};

await byQuery("carPark=22", drifted());
await page.waitForSelector(`${carpark} section button`, { timeout: 20000 });
await mouseOn('[data-testid="carpark-tow"]'); // the free tow
await tapBlocked();
await mouseOn('[data-testid="carpark-tow"]'); // watch the ad
await sleep(600);
const armed = await towText();
await tapBlocked(); // use the ad's tow
const used = await towText();
const save = await readSave(page);
check(
  "C1 Car Park: after today's tow ad (counters apart, as for every player) it is not offered again",
  /Choose/.test(armed) &&
    /Tow used/.test(used) &&
    (await page.evaluate(() => window.__rewarded.length)) === 1,
  { armed, used, towAdDay: save?.business.carPark?.towAdDay },
);

await byQuery("carPark=22", drifted());
await page.waitForSelector(`${carpark} section button`, { timeout: 20000 });
await mouseOn('[data-testid="carpark-tow"]');
await tapBlocked();
await mouseOn('[data-testid="carpark-tow"]'); // the ad: its tow is ready, not used
await sleep(600);
await mouseOn(`${carpark} [aria-label="Pause"]`);
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find((x) => x.textContent.trim() === "Restart this lot")
    ?.click(),
);
await sleep(700);
await mouseOn('[data-testid="carpark-tow"]'); // the free tow again
await tapBlocked();
const kept = await towText();
check(
  "C2 Car Park: the unused ad tow is still there after Restart this lot",
  /Bonus tow/.test(kept),
  {
    button: kept,
  },
);

const errors = logs.filter(
  (l) => /pageerror|^error:/.test(l) && !/favicon|ERR_FAILED|net::/.test(l),
);
check("E1 no console errors", errors.length === 0, errors.slice(0, 4));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nMINI-GAME PAUSE E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
