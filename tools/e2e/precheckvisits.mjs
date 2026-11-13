// Developer 2026-11-13, restaurant build. The two new cards of the Pre-Service Check.
//  THE HEALTH INSPECTOR (restaurant/healthInspector.ts), Level 13:
//   I1. a dirty restaurant (3 cleaning tasks open, no soap, no cleaning liquid): he is at the door, the card lists five checks, previews Grade C
//       with the fine, and START waits;
//   I2. "Let him in": Grade C, the fine leaves the wallet as ONE "inspection-fine" entry, he is back in 2;
//   I3. a spotless restaurant: Grade A, Hype added, no money moved, he stays away 6;
//   I4. an old seeded save that says he is away: no card.
//  THE BIGGER FRIDGE (restaurant/fridgeUpgradeNeed.ts), Level 46, a Basic fridge full of food the service does not use:
//   F1. the wallet covers it: "Bigger fridge needed", one Buy button, START waits;
//   F2. Buy: the Commercial fridge, its full price as ONE "refrigerator-purchase" entry, the card is gone;
//   F3. short by $400 with ads available: "Watch · 25% off · $1,500.00"; an ad that is not finished changes nothing;
//   F4. the finished ad: placement fridge_discount, one "rewarded-ad" entry of $500 and one purchase entry of $2,000, the wallet paid $1,500;
//   F5. far too little money: no ad, nothing required, the supplier's cover is still there.
//  Z. both cards fit at 320 px; no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, readSave, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const progress = (n) => ({
  currentLevelId: `level-${n}`,
  highestUnlockedLevelId: `level-${n}`,
  completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  campaignVersion: 4,
});
const STORY = { introDone: true, milestoneMask: 0xffff, finaleSeen: true };
// Seeded credits are whole dollars (the save's old unit; the game reads them as cents after its one-time conversion).
const saveAt = (n, credits, business = {}) =>
  seedSave({
    credits,
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: {},
      staff: { hiredRoles: ["server", "cashier"] },
      // Today's sauce is made (the delivery routine's step from Level 10), so "Open for service" reaches the check.
      sauceStation: { doneDay: business.calendar?.businessDay ?? 1 },
      ...business,
    },
    levelProgress: progress(n),
    story: STORY,
  });
const CLEAN_SUPPLIES = {
  stock: {
    ...MOVED_IN_BUSINESS.supplies.stock,
    "dish-soap": { units: 2, costBasis: 0 },
    "cleaning-liquid": { units: 2, costBasis: 0 },
  },
};
const openCheck = async (page) => {
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(900);
  for (let i = 0; i < 6; i++) {
    const open = await page.evaluate(() => {
      if (document.querySelector('[data-testid="pre-service-check"]')) return true;
      const b = [...document.querySelectorAll("button")].find((x) =>
        /^Open for service$/.test((x.textContent ?? "").trim()),
      );
      b?.click();
      return false;
    });
    if (open) return true;
    await sleep(700);
  }
  return false;
};
const inspector = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="psc-inspector"]');
    if (!el) return null;
    const start = [...document.querySelectorAll('[data-testid="pre-service-check"] button')].find(
      (b) => /Start service|Open restaurant|to start|inspector in$/.test(b.textContent ?? ""),
    );
    return {
      status: el.getAttribute("data-status"),
      grade: el.getAttribute("data-grade"),
      rows: [...el.querySelectorAll("[data-check]")].map(
        (r) => `${r.getAttribute("data-check")}:${r.getAttribute("data-verdict")}`,
      ),
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
      startDisabled: !!start?.disabled,
      startText: (start?.textContent ?? "").trim(),
    };
  });
const fridgeCard = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="psc-fridge-need"]');
    if (!el) return null;
    return {
      required: el.getAttribute("data-required"),
      reason: el.getAttribute("data-reason"),
      buy: (el.querySelector('[data-testid="psc-fridge-buy"]')?.textContent ?? "").trim(),
      ad: (el.querySelector('[data-testid="psc-fridge-ad"]')?.textContent ?? "").trim(),
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
    };
  });
const fits = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const small = (page, sel) =>
  page.evaluate(
    (s) =>
      [...document.querySelectorAll(`${s} button`)]
        .map((b) => Math.round(b.getBoundingClientRect().height))
        .filter((h) => h > 0 && h < 48),
    sel,
  );

const { browser, page, logs } = await launch();
// Rewarded ads stubbed from inside initialize() (as saucestation.mjs does): opened -> rewarded -> closed, or opened -> closed when __adSkip.
await page.evaluateOnNewDocument(() => {
  window.__rewarded = [];
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
          adv.on = (e, cb) => (handlers[e] ??= []).push(cb);
          adv.off = (e, cb) => (handlers[e] = (handlers[e] ?? []).filter((x) => x !== cb));
          const emit = (e, st) => (handlers[e] ?? []).slice().forEach((h) => h(st));
          adv.showRewarded = (placement) => {
            window.__rewarded.push(placement);
            const states = window.__adSkip
              ? ["opened", "closed"]
              : ["opened", "rewarded", "closed"];
            states.forEach((st, i) =>
              setTimeout(() => emit(b.EVENT_NAME.REWARDED_STATE_CHANGED, st), 80 * (i + 1)),
            );
          };
          return r;
        });
    },
  });
});

/* ── The health inspector ── */
const DIRTY = {
  healthInspector: undefined,
  cleanliness: {
    tasks: ["equipment", "grease", "bins"].map((kind) => ({ kind, count: 1, since: 0 })),
    introSeen: true,
  },
};
await boot(page, saveAt(13, 5_000, DIRTY));
const opened = await openCheck(page);
await sleep(500);
const due = await inspector(page);
check(
  "I1 a dirty restaurant: he is at the door, five checks, a Grade C preview with its fine, START waits",
  opened &&
    due?.status === "due" &&
    due.grade === "C" &&
    due.rows.length === 5 &&
    due.rows.includes("cleaning:FAIL") &&
    due.rows.includes("dish-soap:WARNING") &&
    /fine \$/.test(due.text) &&
    due.startDisabled,
  due,
);
await shot(page, "precheck-inspector-due-390");
const smallDue = await small(page, '[data-testid="psc-inspector"]');
const before = await readSave(page);
await page.evaluate(() => document.querySelector('[data-testid="psc-inspector-let-in"]')?.click());
await sleep(600);
const done = await inspector(page);
const afterC = await readSave(page);
const fines = afterC.economyLedger.filter((e) => e.category === "inspection-fine");
check(
  "I2 Let him in: Grade C, the fine is ONE ledger entry and exactly what left the wallet, back in 2",
  done?.status === "done" &&
    done.grade === "C" &&
    fines.length === 1 &&
    fines[0].amount < 0 &&
    before.credits + fines[0].amount === afterC.credits &&
    afterC.business.healthInspector?.nextLevel === 15 &&
    /Fine \$/.test(done.text) &&
    /back in 2/.test(done.text),
  { done, fine: fines[0]?.amount, next: afterC.business.healthInspector?.nextLevel },
);
await shot(page, "precheck-inspector-done-390");

await boot(
  page,
  saveAt(13, 5_000, {
    healthInspector: undefined,
    supplies: CLEAN_SUPPLIES,
    cleanliness: { tasks: [], introSeen: true },
  }),
);
await openCheck(page);
await sleep(500);
const dueA = await inspector(page);
const beforeA = await readSave(page);
await page.evaluate(() => document.querySelector('[data-testid="psc-inspector-let-in"]')?.click());
await sleep(600);
const doneA = await inspector(page);
const afterA = await readSave(page);
check(
  "I3 a spotless restaurant: Grade A, Hype added, no money moved, he stays away 6",
  dueA?.status === "due" &&
    dueA.grade === "A" &&
    dueA.rows.every((r) => r.endsWith(":PASS")) &&
    doneA?.status === "done" &&
    doneA.grade === "A" &&
    afterA.credits === beforeA.credits &&
    (afterA.business.secondFloor?.hype ?? 0) === 20 &&
    afterA.business.healthInspector?.nextLevel === 19 &&
    afterA.economyLedger.every((e) => e.category !== "inspection-fine"),
  { dueA, doneA, hype: afterA.business.secondFloor?.hype },
);

await boot(page, saveAt(13, 5_000));
await openCheck(page);
await sleep(500);
check(
  "I4 a seeded save that says he is away (the harness default) shows no card",
  (await inspector(page)) === null,
);

/* ── The bigger fridge ── */
const FULL = (day) => ({
  calendar: { businessDay: day },
  refrigerator: { refrigeratorId: "basic-refrigerator" },
  inventory: {
    watermelon: { ingredientId: "watermelon", quantity: 20, unitCost: 100, purchaseDay: day },
    pumpkin: { ingredientId: "pumpkin", quantity: 16, unitCost: 100, purchaseDay: day },
  },
  staff: { hiredRoles: ["server", "cashier", "prep-cook", "cleaner"] },
});
await boot(page, saveAt(46, 3_000, FULL(3)));
const opened46 = await openCheck(page);
await sleep(500);
const f1 = await fridgeCard(page);
const start1 = await page.evaluate(() => {
  const b = [...document.querySelectorAll('[data-testid="pre-service-check"] button')].find((x) =>
    /Start service|Open restaurant|to start/.test(x.textContent ?? ""),
  );
  return { disabled: !!b?.disabled, text: (b?.textContent ?? "").trim() };
});
check(
  "F1 the wallet covers it: 'Bigger fridge needed', Buy · $2,000.00, START waits",
  opened46 &&
    f1?.required === "1" &&
    f1.reason === "full" &&
    /Bigger fridge needed/.test(f1.text) &&
    /^Buy · \$2,000\.00$/.test(f1.buy) &&
    f1.ad === "" &&
    start1.disabled,
  { f1, start1 },
);
await shot(page, "precheck-fridge-required-390");
const smallFridge = await small(page, '[data-testid="psc-fridge-need"]');
const b2 = await readSave(page);
await page.evaluate(() => document.querySelector('[data-testid="psc-fridge-buy"]')?.click());
await sleep(600);
const a2 = await readSave(page);
const buys = a2.economyLedger.filter((e) => e.category === "refrigerator-purchase");
check(
  "F2 Buy: the Commercial fridge, $2,000 as ONE ledger entry, the food untouched, the card is gone",
  a2.business.refrigerator.refrigeratorId === "commercial-refrigerator" &&
    b2.credits - a2.credits === 200_000 &&
    buys.length === 1 &&
    buys[0].amount === -200_000 &&
    a2.business.inventory.watermelon.quantity === 20 &&
    (await fridgeCard(page)) === null,
  { fridge: a2.business.refrigerator, entries: buys.length },
);

await boot(page, saveAt(46, 1_600, FULL(3)));
await openCheck(page);
await sleep(500);
const f3 = await fridgeCard(page);
await page.evaluate(() => {
  window.__adSkip = true;
  window.__rewarded = [];
  document.querySelector('[data-testid="psc-fridge-ad"]')?.click();
});
await sleep(900);
const skipped = await readSave(page);
check(
  "F3 short by $400: 'Watch · 25% off · $1,500.00' (not required); an unfinished ad changes nothing",
  f3?.required === "0" &&
    f3.buy === "" &&
    /Watch · 25% off · \$1,500\.00/.test(f3.ad) &&
    /\$400\.00 short/.test(f3.text) &&
    skipped.credits === 160_000 &&
    skipped.business.refrigerator.refrigeratorId === "basic-refrigerator" &&
    skipped.economyLedger.every((e) => e.category !== "rewarded-ad"),
  { f3, credits: skipped.credits },
);
await shot(page, "precheck-fridge-ad-390");
await page.evaluate(() => {
  window.__adSkip = false;
  window.__rewarded = [];
  document.querySelector('[data-testid="psc-fridge-ad"]')?.click();
});
await sleep(1100);
const a4 = await readSave(page);
const placements = await page.evaluate(() => window.__rewarded);
const adEntries = a4.economyLedger.filter((e) => e.category === "rewarded-ad");
const buy4 = a4.economyLedger.filter((e) => e.category === "refrigerator-purchase");
check(
  "F4 the finished ad (placement fridge_discount): +$500 'rewarded-ad', -$2,000 purchase, the wallet paid $1,500",
  placements.join() === "fridge_discount" &&
    adEntries.length === 1 &&
    adEntries[0].amount === 50_000 &&
    buy4.length === 1 &&
    buy4[0].amount === -200_000 &&
    a4.credits === 10_000 &&
    a4.business.refrigerator.refrigeratorId === "commercial-refrigerator",
  { placements, credits: a4.credits, ad: adEntries.length, buy: buy4.length },
);

await boot(page, saveAt(46, 500, FULL(3)));
await openCheck(page);
await sleep(500);
const f5 = await fridgeCard(page);
const cover = await page.evaluate(
  () => !!document.querySelector('[data-testid="psc-fridge-cover"]'),
);
check(
  "F5 far too little money: no ad, nothing required, the supplier's cover is still offered",
  f5?.required === "0" && f5.ad === "" && f5.buy === "" && cover,
  { f5, cover },
);

/* ── Widths and errors ── */
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 2 });
await sleep(400);
const fitFridge = await fits(page);
await shot(page, "precheck-fridge-320");
await boot(page, saveAt(13, 5_000, DIRTY));
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 2 });
await openCheck(page);
await sleep(500);
const fitInspector = await fits(page);
await shot(page, "precheck-inspector-320");
const errors = logs.filter((l) => /pageerror|Uncaught|TypeError|ReferenceError/.test(l));
check(
  "Z both cards fit at 320 px, every button is at least 48 px tall, no page errors",
  fitFridge &&
    fitInspector &&
    smallDue.length === 0 &&
    smallFridge.length === 0 &&
    errors.length === 0,
  { fitFridge, fitInspector, smallDue, smallFridge, errors: errors.slice(0, 3) },
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0
    ? "PRE-CHECK VISITS: ALL PASS"
    : `PRE-CHECK VISITS: ${failed.length} FAILURE(S)`,
);
process.exit(failed.length === 0 ? 0 : 1);
