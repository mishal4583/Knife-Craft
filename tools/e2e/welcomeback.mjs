// Welcome back (src/game/ads/adBonuses.ts, developer 2026-10-31): back after 30+ minutes, a few hours of
// earnings for a rewarded ad and ONLY for the ad (no free part, no doubling), in a real browser,
// restaurant build, rewarded ads stubbed like adbonuses.mjs. Level 40: the full amount is $90.
//   W1 away 4 h (daily gift already taken): the sheet shows "+$90" for 3 h with a 📺 button and no free Take;
//      📺 pays exactly $90 with ONE rewarded-ad entry, placement welcome_back; wallet = ledger.
//   W2 a reload right after is not offered again (one a day, and it is no longer "away").
//   W3 away 10 minutes: nothing is offered.
//   W4 a skipped ad pays nothing and says so; "No thanks" leaves the wallet alone.
//   W5 with today's daily gift still due, the gift opens first; after "Later" the welcome-back offer follows.
//   W6 no console errors.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  openSection,
  shot,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

// Rewarded (and interstitial) ads stubbed from inside initialize(), on every document.
await page.evaluateOnNewDocument(() => {
  window.__rewarded = [];
  window.__interstitials = [];
  let real;
  Object.defineProperty(window, "bridge", {
    configurable: true,
    get() {
      return real;
    },
    set(b) {
      real = b;
      const init = b.initialize.bind(b);
      b.initialize = (...args) =>
        init(...args).then((r) => {
          const adv = b.advertisement;
          const handlers = {};
          Object.defineProperty(adv, "isRewardedSupported", {
            get: () => true,
            configurable: true,
          });
          Object.defineProperty(adv, "isInterstitialSupported", {
            get: () => true,
            configurable: true,
          });
          adv.on = (e, cb) => (handlers[e] ??= []).push(cb);
          adv.off = (e, cb) => (handlers[e] = (handlers[e] ?? []).filter((x) => x !== cb));
          const emit = (e, s) => (handlers[e] ?? []).slice().forEach((h) => h(s));
          adv.showRewarded = (placement) => {
            window.__rewarded.push(placement);
            const states = window.__adSkip
              ? ["opened", "closed"]
              : ["opened", "rewarded", "closed"];
            states.forEach((s, i) =>
              setTimeout(() => emit(b.EVENT_NAME.REWARDED_STATE_CHANGED, s), 80 * (i + 1)),
            );
          };
          adv.showInterstitial = (placement) => {
            window.__interstitials.push(placement);
            ["opened", "closed"].forEach((s, i) =>
              setTimeout(() => emit(b.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, s), 60 * (i + 1)),
            );
          };
          return r;
        });
    },
  });
});

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** A ledger entry saying today's free gift was already taken (so it doesn't open). */
const giftTaken = () => ({
  id: "seed-gift",
  timestamp: Date.now(),
  category: "daily-reward",
  amount: 2000,
  description: `knifecraft-daily-gift-${dayKey()}`,
});
const food = (ids, q = 12) =>
  Object.fromEntries(
    ids.map((id) => [id, { ingredientId: id, quantity: q, unitCost: 0, purchaseDay: 1 }]),
  );
const at = (n, extra = {}) =>
  seedSave({
    business: { ...MOVED_IN_BUSINESS, ...(extra.business ?? {}) },
    credits: extra.credits ?? 5000,
    economyLedger: extra.ledger ?? [],
    story: { introDone: true, milestoneMask: 4095, finaleSeen: false },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
  });
const sheet = () =>
  page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="ad-bonus-sheet"], [data-testid="ad-bonus-done"]',
    );
    if (!el) return null;
    return {
      kind: el.getAttribute("data-ad-bonus"),
      done: el.getAttribute("data-testid") === "ad-bonus-done",
      text: el.innerText.replace(/\s+/g, " "),
      buttons: [...el.querySelectorAll("button")].map((b) => b.textContent.trim()),
    };
  });
/** Taps the sheet's own 📺 button (the Market card has one too). */
const watch = async () => {
  await sleep(700); // the sheet ignores a tap in its first 600 ms
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="ad-bonus-sheet"] button')]
      .find((b) => /^📺 Watch/.test(b.textContent.trim()))
      ?.click(),
  );
  await sleep(900);
};
const rewarded = () => page.evaluate(() => window.__rewarded);
const adEntries = (s) => s.economyLedger.filter((e) => e.category === "rewarded-ad");
const balanced = (before, after) =>
  after.credits - before.credits ===
  after.economyLedger.slice(before.economyLedger.length).reduce((t, e) => t + e.amount, 0);
const closeSheet = async () => {
  await clickButton(page, /^(Continue|No thanks|Later)$/);
  await sleep(500);
};

const H = 3_600_000;
const seedAway = (ms, giftToday = true) => {
  const e = giftToday
    ? [{ ...giftTaken(), timestamp: Date.now() - ms }]
    : [
        {
          id: "seed-x",
          timestamp: Date.now() - ms,
          category: "completion-reward",
          amount: 100,
          description: "x",
        },
      ];
  return at(40, { ledger: e });
};
try {
  // ---------- W1 / W2 ----------
  await boot(page, seedAway(4 * H));
  await sleep(2800);
  const w = await sheet();
  const b = await readSave(page);
  await shot(page, "adbonus-welcome-back");
  await watch();
  const a = await readSave(page);
  const done = await sheet();
  const r = await rewarded();
  const paid = adEntries(a);
  check(
    "W1 away 4 h: '+$90 · 3 h' with a 📺 button and no free Take; the ad pays exactly $90 as ONE rewarded-ad entry (placement welcome_back); wallet = ledger",
    w?.kind === "welcome_back" &&
      /\+\$90/.test(w.text) &&
      /3 h/.test(w.text) &&
      w.buttons.some((t) => /^📺 Watch · \+\$90/.test(t)) &&
      !w.buttons.some((t) => /^Take/.test(t)) &&
      paid.length === 1 &&
      paid[0].amount === 9000 &&
      a.credits - b.credits === 9000 &&
      done?.done === true &&
      r.includes("welcome_back") &&
      balanced(b, a),
    { w, paid: paid.map((e) => e.amount), r },
  );
  await closeSheet();
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(3000);
  check("W2 after a reload it is not offered again", (await sheet()) === null);

  // ---------- W3 ----------
  await boot(page, seedAway(10 * 60_000));
  await sleep(2800);
  check("W3 away only 10 minutes: nothing is offered", (await sheet()) === null);

  // ---------- W4 skipped ad ----------
  await boot(page, seedAway(2 * H));
  await page.evaluate(() => (window.__adSkip = true));
  await sleep(2800);
  const s4 = await sheet();
  const b4 = await readSave(page);
  await watch();
  const failed = await page.evaluate(
    () => !!document.querySelector('[data-testid="ad-bonus-failed"]'),
  );
  const a4 = await readSave(page);
  await closeSheet();
  const a4b = await readSave(page);
  check(
    "W4 a skipped ad pays nothing and says so; No thanks leaves the wallet alone",
    s4?.kind === "welcome_back" &&
      /\+\$90.*2 h/.test(s4.text) &&
      failed &&
      a4.credits === b4.credits &&
      adEntries(a4).length === 0 &&
      a4b.credits === b4.credits,
    { s4: s4?.text },
  );

  // ---------- W5 order with the daily gift ----------
  await boot(page, seedAway(5 * H, false));
  await sleep(2800);
  const first = await sheet();
  await closeSheet(); // Later
  await sleep(2500);
  const second = await sheet();
  check(
    "W5 with today's gift due, the gift opens first; after Later the welcome-back offer follows",
    first?.kind === "daily_gift" && second?.kind === "welcome_back",
    { first: first?.kind, second: second?.kind },
  );

  const errors = logs.filter(
    (l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l),
  );
  check("W6 no console errors", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  check("run", false, String(e).slice(0, 400));
} finally {
  await browser.close();
}
const failedChecks = results.filter((x) => !x.ok);
console.log(`
${results.length - failedChecks.length}/${results.length} passed`);
process.exit(failedChecks.length ? 1 : 0);
