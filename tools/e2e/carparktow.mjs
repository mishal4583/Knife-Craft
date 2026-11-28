// THE CAR PARK'S AD TOW IS THE PLAYER'S UNTIL IT TOWS A CAR, in a real browser, restaurant build (developer 2026-11-28).
//   T1  watched but not used, then Pause → Leave: the save still holds it
//   T2  after the game is reloaded the button offers both tows ("Tow ×2") and no new ad is asked for
//   T3  the free tow goes first: the held one is still in the save
//   T4  using the held tow removes it from the save, once; no second ad that day
//   T5  after another reload only the free tow is there
//   E1  no console errors
// Rewarded ads are stubbed as minigamepause.mjs does it. Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  PAIGE_QUIET,
  GAME_URL,
  SAVE_KEY,
  launch,
  seedSave,
  readSave,
  sleep,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

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

const save = seedSave({
  credits: 50_000,
  business: {
    ...MOVED_IN_BUSINESS,
    assistant: PAIGE_QUIET,
    sectionsSeen: ["shop", "inventory", "rack", "business"],
    carPark: { howto: true },
    calendar: { businessDay: 3 },
    restaurantDay: { day: 7 },
  },
  levelProgress: {
    currentLevelId: "level-22",
    highestUnlockedLevelId: "level-22",
    completedLevelIds: Array.from({ length: 21 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 4,
  },
  story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
});

const ROOT = '[data-testid="car-park-game"]';
const BUTTON = '[data-testid="carpark-tow"]';
async function settled() {
  await page.waitForFunction(
    () => document.elementFromPoint(5, 5)?.closest("#loading-overlay") === null,
    { timeout: 20000 },
  );
  await page.waitForSelector(`${ROOT} section button`, { timeout: 20000 });
  await sleep(1500);
}
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.goto(`${GAME_URL.split("?")[0]}?carPark=22`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.bridge?.storage, { timeout: 20000 });
await page.evaluate(
  async (s, k) => {
    localStorage.clear();
    await window.bridge.storage.set([k], [JSON.stringify(s)]);
  },
  save,
  SAVE_KEY,
);
const reload = async () => {
  await page.reload({ waitUntil: "networkidle0" });
  await settled();
};

const mouseOn = async (sel) => {
  const box = await (await page.$(sel))?.boundingBox();
  if (!box) return false;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(700);
  return true;
};
const tapBlocked = async () => {
  const p = await page.evaluate((root) => {
    const v = [...document.querySelectorAll(`${root} section button`)].find((x) =>
      /blocked/.test(x.getAttribute("aria-label")),
    );
    const r = v?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }, ROOT);
  if (!p) return false;
  await page.mouse.click(p.x, p.y);
  await sleep(700);
  return true;
};
const towText = () =>
  page.evaluate((s) => document.querySelector(s)?.textContent?.trim() ?? "", BUTTON);
const state = async () => (await readSave(page))?.business?.carPark ?? {};
const ads = () => page.evaluate(() => window.__rewarded.length);
const pressText = (text) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === t);
    b?.click();
    return !!b;
  }, text);

await reload();
await mouseOn(BUTTON); // the free tow
await tapBlocked();
await mouseOn(BUTTON); // watch the ad
await sleep(600);
const armed = await towText();
const watched = await ads();
await mouseOn(`${ROOT} [aria-label="Pause"]`);
const left = await pressText("Leave");
await sleep(1200);
const gone = !(await page.$(ROOT));
const kept = await state();
check(
  "T1 an ad tow not used is still in the save after leaving",
  /Choose/.test(armed) && watched === 1 && left && gone && kept.towHeld === true,
  { armed, watched, left, gone, kept },
);

await reload();
const back = await towText();
check(
  "T2 after a reload both tows are offered, with no new ad",
  /Tow ×2/.test(back) && (await ads()) === 0,
  { button: back },
);

await mouseOn(BUTTON);
await tapBlocked();
const second = await towText();
const afterFree = await state();
check(
  "T3 the free tow goes first: the held one stays saved",
  /Bonus tow/.test(second) && afterFree.towHeld === true,
  { button: second, saved: afterFree },
);

await mouseOn(BUTTON);
await tapBlocked();
const spent = await towText();
const afterBonus = await state();
check(
  "T4 using the held tow removes it from the save; no second ad that day",
  /Tow used/.test(spent) &&
    afterBonus.towHeld === undefined &&
    afterBonus.towAdDay !== undefined &&
    (await ads()) === 0,
  { button: spent, saved: afterBonus },
);

await reload();
const fresh = await towText();
check("T5 after another reload only the free tow is there", /^Tow · costs/.test(fresh), {
  button: fresh,
});

const errors = logs.filter(
  (l) => /pageerror|^error:/.test(l) && !/favicon|ERR_FAILED|net::/.test(l),
);
check("E1 no console errors", errors.length === 0, errors.slice(0, 4));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nCAR PARK TOW E2E: ALL PASS");
process.exit(failed.length ? 1 : 0);
