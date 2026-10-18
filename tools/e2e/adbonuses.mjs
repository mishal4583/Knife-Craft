// The five rewarded-ad cash bonuses (src/game/ads/adBonuses.ts, developer 2026-10-18) in a real
// browser, restaurant build. The Bridge's mock platform has no ads, so rewarded ads are stubbed
// (supported; showRewarded → opened → rewarded → closed, or opened → closed when `__adSkip`):
//   1. Daily gift: a Level 40 Kitchen opens it once (Take / 📺 double / Later); 📺 pays the gift
//      twice — one daily-reward entry + one rewarded-ad entry, placement daily_gift; a reload
//      doesn't offer it again.
//   2. Floating cash: ~60 s on the Kitchen, a bag drifts in over the shelves (📺 +$X), clear of
//      Today's Order; tapping opens the sheet;
//      📺 pays $X with one entry, placement floating_cash.
//   3. Level Complete: a first clear of Level 4 offers +50% of its reward (after the card),
//      placement level_bonus, and no interstitial at that break.
//   4. Short by: $300 for the $350 Santoku shows "📺 Watch · +$50"; after the ad the knife can be
//      bought.
//   5. Second Floor ×2 (one staffed coffee machine, 12 h) → "📺 Collect ×2"; one automation-income + one rewarded-ad
//      entry, +$240 in all.
//   6. A skipped ad pays nothing and says so.
//   7. 320×568: the sheet fits, its buttons ≥ 48 px, no sideways scroll. Wallet = ledger.
// Prints PASS/FAIL per check and exits 1 on any failure.
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
import { playToReport } from "./solver.mjs";

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

// ---------- 1. Daily gift ----------
await boot(page, at(40));
await sleep(2500);
const g = await sheet();
const b1 = await readSave(page);
await shot(page, "adbonus-daily-gift");
await watch();
const a1 = await readSave(page);
const g1done = await sheet();
const r1 = await rewarded();
await closeSheet();
await page.reload({ waitUntil: "networkidle0" });
await sleep(3000);
const again = await sheet();
const giftEntry = a1.economyLedger.find((e) => e.category === "daily-reward");
check(
  "1 daily gift at Level 40: Take / 📺 double / Later; 📺 pays it twice (one daily-reward + one rewarded-ad entry, placement daily_gift); not offered again after a reload",
  g?.kind === "daily_gift" &&
    g.buttons.some((t) => /^Take \$/.test(t)) &&
    g.buttons.some((t) => /^📺 Watch · take \$/.test(t)) &&
    g.buttons.includes("Later") &&
    !!giftEntry &&
    adEntries(a1).length === 1 &&
    adEntries(a1)[0].amount === giftEntry.amount &&
    a1.credits - b1.credits === giftEntry.amount * 2 &&
    g1done?.done === true &&
    r1.includes("daily_gift") &&
    again === null &&
    balanced(b1, a1),
  { g1done, again, rewarded: r1, diff: a1.credits - b1.credits },
);

// ---------- 2. Floating cash ----------
await boot(page, at(40, { ledger: [giftTaken()] }));
await sleep(1500);
const noGift = await sheet();
await page.waitForSelector('[data-testid="floating-cash"]', { timeout: 75000 }).catch(() => null);
const bag = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="floating-cash"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const order = [...document.querySelectorAll("p")]
    .find((p) => /today's order/i.test(p.textContent))
    ?.closest("section, article, div[class*='rounded']")
    ?.getBoundingClientRect();
  const clear = !order || r.bottom <= order.top || r.top >= order.bottom;
  return { text: el.innerText.replace(/\s+/g, " "), w: r.width, h: r.height, clear };
});
await shot(page, "adbonus-floating-cash");
await sleep(900); // armed after 700 ms
await page.evaluate(() => document.querySelector('[data-testid="floating-cash"]')?.click());
await sleep(500);
const fc = await sheet();
const b2 = await readSave(page);
await watch();
const a2 = await readSave(page);
await closeSheet();
check(
  "2 ~60 s on the Kitchen: a bag (📺 +$X, ≥ 48 px) drifts in; its sheet pays $X with one rewarded-ad entry, placement floating_cash",
  noGift === null &&
    !!bag &&
    /📺 \+\$\d+/.test(bag.text) &&
    bag.w >= 48 &&
    bag.h >= 48 &&
    bag.clear &&
    fc?.kind === "floating_cash" &&
    adEntries(a2).length === 1 &&
    a2.credits - b2.credits === adEntries(a2)[0].amount &&
    `+$${adEntries(a2)[0].amount / 100}` === bag.text.match(/\+\$\d+/)?.[0] &&
    (await rewarded()).includes("floating_cash") &&
    balanced(b2, a2),
  { bag, fc, ads: adEntries(a2) },
);

// ---------- 3. Level Complete +50% ----------
await boot(
  page,
  at(4, { ledger: [giftTaken()], business: { inventory: food(["potato", "tomato"]) } }),
);
await sleep(1200);
await page.evaluate(() => {
  window.__interstitials.length = 0;
});
await clickButton(page, /Prepare$/);
await sleep(1200);
await clickButton(page, /^(START SERVICE|OPEN THE RESTAURANT)$/);
let finished = false;
for (let order = 0; order < 8 && !finished; order++) {
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    { timeout: 30000 },
  );
  await playToReport(page);
  await clickButton(page, /^Continue$/);
  await sleep(900);
  if (/ORDER READY/i.test(await page.evaluate(() => document.body.innerText))) {
    await clickButton(page, /^Serve to /);
    await sleep(900);
  }
  if (await clickButton(page, /^Finish Level$/)) finished = true;
  else if (!(await clickButton(page, /^Next (Customer|Order)/))) break;
  await sleep(900);
}
await sleep(400);
const cardFirst = await sheet();
// Level Complete's card goes on its own after a few seconds (or with its ✕).
await page.evaluate(() => document.querySelector('[data-testid="banner-close"]')?.click());
await sleep(1200);
const lv = await sheet();
const b3 = await readSave(page);
await watch();
const a3 = await readSave(page);
await closeSheet();
const completion = b3.economyLedger.filter((e) => e.category === "completion-reward").at(-1);
check(
  "3 Level 4's first clear: after the Level Complete card, +50% of its reward (placement level_bonus); no interstitial at that break",
  finished &&
    cardFirst === null &&
    lv?.kind === "level_double" &&
    !!completion &&
    adEntries(a3).length === 1 &&
    adEntries(a3)[0].amount === Math.round(completion.amount / 200) * 100 &&
    (await rewarded()).includes("level_bonus") &&
    (await page.evaluate(() => window.__interstitials.length)) === 0 &&
    balanced(b3, a3),
  { finished, lv, completion: completion?.amount, ads: adEntries(a3) },
);

// ---------- 4. Short by ----------
await boot(page, at(40, { ledger: [giftTaken()], credits: 300 }));
await openSection(page, "Market");
await sleep(900);
const offer = await page.evaluate(() => {
  const card = [...document.querySelectorAll("article.product-card")].find((a) =>
    /Santoku/.test(a.textContent),
  );
  const b = card?.querySelector('[data-testid="shortfall-offer"]');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { text: b.textContent.trim(), h: r.height };
});
await page.evaluate(() =>
  [...document.querySelectorAll("article.product-card")]
    .find((a) => /Santoku/.test(a.textContent))
    ?.querySelector('[data-testid="shortfall-offer"]')
    ?.click(),
);
await sleep(500);
const sf = await sheet();
const b4 = await readSave(page);
await watch();
await closeSheet();
await page.evaluate(() => {
  const c = [...document.querySelectorAll("article.product-card")].find((a) =>
    /Santoku/.test(a.textContent),
  );
  [...(c?.querySelectorAll("button") ?? [])]
    .find((x) => /^Buy$/.test(x.textContent.trim()))
    ?.click();
});
await sleep(900);
const a4 = await readSave(page);
check(
  "4 $300 for the $350 Santoku: 📺 Watch · +$50 (≥ 48 px); after the ad the knife is bought",
  offer?.text === "📺 Watch · +$50.00" &&
    offer.h >= 47.5 &&
    sf?.kind === "shortfall" &&
    adEntries(a4).length === 1 &&
    adEntries(a4)[0].amount === 5000 &&
    a4.ownedKnifeIds.includes("santoku") &&
    (await rewarded()).includes("shortfall_topup") &&
    balanced(b4, a4),
  { offer, sf, ads: adEntries(a4), knives: a4.ownedKnifeIds },
);

// ---------- 5. Second Floor ×2 ----------
const twelveHoursAgo = Date.now() - 12 * 3600 * 1000;
await boot(
  page,
  at(70, {
    ledger: [giftTaken()],
    business: {
      secondFloor: {
        stations: { coffee: { level: 1, lastCollectAt: twelveHoursAgo } },
        servers: 1,
        cleaners: 1,
      },
    },
  }),
);
await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
await sleep(1500);
await page.evaluate(() =>
  [...document.querySelectorAll("button")].find((b) => /2nd floor/.test(b.textContent))?.click(),
);
await sleep(1500);
await page.evaluate(() =>
  [...document.querySelectorAll(".map-hotspot-zone")]
    .find((z) => /^Pickup Counter/.test(z.getAttribute("aria-label") ?? ""))
    ?.click(),
);
await sleep(700);
await shot(page, "adbonus-floor");
const dbl = await page.evaluate(
  () => document.querySelector('[data-testid="floor-double"]')?.innerText.trim() ?? null,
);
await page.evaluate(() => document.querySelector('[data-testid="floor-double"] button')?.click());
await sleep(500);
const fd = await sheet();
const b5 = await readSave(page);
await watch();
const a5 = await readSave(page);
await closeSheet();
const income = a5.economyLedger.filter((e) => e.category === "automation-income");
check(
  "5 Second Floor (12 h of a staffed coffee machine): 📺 Collect ×2; one automation-income + one rewarded-ad entry, the same amount each",
  /^📺 Collect ×2 · \$\d+/.test(dbl ?? "") &&
    fd?.kind === "floor_double" &&
    income.length === 1 &&
    adEntries(a5).length === 1 &&
    adEntries(a5)[0].amount === income[0].amount &&
    a5.credits - b5.credits === income[0].amount * 2 &&
    (await rewarded()).includes("floor_double") &&
    balanced(b5, a5),
  { dbl, fd, income: income.map((e) => e.amount), ads: adEntries(a5) },
);

// ---------- 6. A skipped ad pays nothing ----------
await boot(page, at(40, { ledger: [giftTaken()], credits: 300 }));
await page.evaluate(() => {
  window.__adSkip = true;
});
await openSection(page, "Market");
await sleep(900);
await page.evaluate(() =>
  [...document.querySelectorAll("article.product-card")]
    .find((a) => /Santoku/.test(a.textContent))
    ?.querySelector('[data-testid="shortfall-offer"]')
    ?.click(),
);
await sleep(500);
const b6 = await readSave(page);
await watch();
const a6 = await readSave(page);
const failed = await page.evaluate(
  () => document.querySelector('[data-testid="ad-bonus-failed"]')?.textContent ?? null,
);
await closeSheet();
check(
  "6 a skipped ad pays nothing (no entry, wallet unchanged) and says so",
  a6.credits === b6.credits &&
    a6.economyLedger.length === b6.economyLedger.length &&
    /didn't finish/.test(failed ?? ""),
  { failed },
);

// ---------- 7. 320 px ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(page, at(40));
await sleep(2500);
const fit = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="ad-bonus-sheet"]');
  const r = el?.getBoundingClientRect();
  return {
    sheet: !!el,
    inside: !!r && r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: el
      ? [...el.querySelectorAll("button")]
          .filter((b) => b.getBoundingClientRect().height < 47.5)
          .map((b) => b.textContent.trim())
      : [],
  };
});
await shot(page, "adbonus-320");
check(
  "7 at 320×568 the sheet fits, its buttons ≥ 48 px, no sideways scroll",
  fit.sheet && fit.inside && fit.overflow <= 0 && fit.small.length === 0,
  fit,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("8 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failedN = results.filter((r) => !r.ok);
console.log(
  failedN.length ? `AD BONUSES E2E: ${failedN.length} FAILURE(S)` : "AD BONUSES E2E: ALL PASS",
);
process.exit(failedN.length ? 1 : 0);
