// Phase 5 in the built game (2026-10-21), restaurant build (KC_URL, default :4173):
//   R. restoration — Business → Upgrades: Growing Kitchen offers 🔨 Build at its existing price; with
//      too little money nothing is bought and no reveal opens; building it (double-tapped) makes
//      ONE kitchen-investment-purchase entry for exactly that price and opens ONE major before-and-after reveal
//      (Inherited Kitchen → Cleaning & Repair: before shown, Skip jumps to the finished kitchen,
//      what changed, what stayed), Continue closes it; the Kitchen behind now paints the Growing
//      Kitchen's art, also after a reload (and no reveal returns); a build within a stage
//      (Established → Neighborhood Café) gets the short reveal; Reduced Motion shows the result at
//      once; 320×568 fits.
//   G. the daily gift — the Kitchen card shows today's gift ready with its amount; tapping opens
//      the existing gift sheet (Day 1 of 7); Take credits exactly the gift as one entry; the card
//      turns "✓ Taken today"; a double tap pays once; after two days in a row today's gift says
//      "+$100 streak reward" and Take pays gift + $100 (two entries, wallet = entries); a reload
//      can't take it again; six days → Day 7 pays $300; a missed day says a new streak starts and
//      removes nothing; the clock passing midnight (and the page coming back) turns the card
//      over to a new ready gift on Day 2; Today's Special's streak is untouched; 320×568 fits.
//   Z. no console errors.
// A test-only clock (installed in the page before the game loads) shifts Date by whole days.
import {
  launch,
  seedSave,
  sleep,
  clickButton,
  openShortcut,
  shot,
  save,
  readSave,
  SAVE_KEY,
  MOVED_IN_BUSINESS,
} from "./harness.mjs";

const URL = process.env.KC_URL || "http://localhost:4173/";
const ONLY = process.env.ONLY || "RGZ";
const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

const { browser, page, logs } = await launch();
await page.evaluateOnNewDocument(() => {
  const Real = Date;
  const off = () => Number(sessionStorage.getItem("__kcDayOffset") || 0) * 86400000;
  class Shifted extends Real {
    constructor(...a) {
      if (a.length === 0) super(Real.now() + off());
      else super(...a);
    }
    static now() {
      return Real.now() + off();
    }
  }
  window.Date = Shifted;
  window.__setDayOffset = (d) => sessionStorage.setItem("__kcDayOffset", String(d));
});

const pad = (n) => String(n).padStart(2, "0");
const keyAt = (days) => {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const giftEntry = (days) => ({
  id: `seed-gift${days}`,
  timestamp: Date.now() + days * 86400000,
  category: "daily-reward",
  amount: 2000,
  description: `knifecraft-daily-gift-${keyAt(days)}`,
});
const rewardEntry = (days, day) => ({
  id: `seed-r${days}`,
  timestamp: Date.now() + days * 86400000,
  category: "daily-reward",
  amount: day === 3 ? 10000 : 30000,
  description: `knifecraft-gift-streak-day${day}-${keyAt(days)}`,
});
const at = (n, extra = {}) =>
  seedSave({
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 4095, finaleSeen: false },
    business: {
      ...MOVED_IN_BUSINESS,
      sectionsSeen: [
        "inventory",
        "business",
        "shop",
        "restaurant-map",
        "rack",
        "achievements",
        "cleanliness",
        "staff",
        "menu",
        "development",
      ],
    },
    ...extra,
  });
async function bootWith(s, { dayOffset = 0 } = {}) {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.bridge && document.body.innerText.length > 20, {
    timeout: 30000,
  });
  await page.evaluate(
    async (v, key, d) => {
      localStorage.clear();
      window.__setDayOffset(d);
      await window.bridge.storage.set([key], [JSON.stringify(v)]);
    },
    s,
    SAVE_KEY,
    dayOffset,
  );
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelectorAll("button").length > 3, {
    timeout: 30000,
  });
  await sleep(1500);
}
/** Closes whatever the Kitchen opens by itself (gift sheet "Later", pointers). */
async function calm() {
  for (let i = 0; i < 4; i++) {
    const hit = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /^(Later|No thanks|Keep .*)$/.test(x.textContent.trim()),
      );
      b?.click();
      return !!b;
    });
    if (!hit) break;
    await sleep(600);
  }
}
const newEntries = (b, a) => {
  const ids = new Set((b.economyLedger ?? []).map((e) => e.id));
  return (a.economyLedger ?? []).filter((e) => !ids.has(e.id));
};
const kitchenSkin = () =>
  page.evaluate(
    () =>
      document.querySelector('img[alt="The player\'s café kitchen"]')?.getAttribute("src") ?? null,
  );
async function openUpgrades() {
  await openShortcut(page, "business");
  await sleep(600);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => /Upgrades$/.test(b.textContent.trim()))
      ?.click(),
  );
  await page.waitForFunction(() => /Growing Kitchen/.test(document.body.innerText), {
    timeout: 10000,
  });
  await sleep(500);
}
const reveal = () =>
  page.evaluate(() => {
    const r = document.querySelector('[data-testid="restoration-reveal"]');
    return r
      ? {
          major: r.dataset.major,
          phase: r.dataset.phase,
          from: r.dataset.from,
          to: r.dataset.to,
          text: r.innerText.replace(/\s+/g, " "),
          count: document.querySelectorAll('[data-testid="restoration-reveal"]').length,
        }
      : null;
  });

// ================================================================== R. restoration
if (ONLY.includes("R")) {
  // Not enough money: nothing bought, nothing revealed.
  await bootWith(
    at(60, {
      version: 3,
      credits: 5000,
      ownedKitchenUpgradeIds: ["humble-kitchen"],
      equippedKitchenUpgradeId: "humble-kitchen",
    }),
  );
  await calm();
  const skin0 = await kitchenSkin();
  await openUpgrades();
  const poor0 = await readSave(page);
  await clickButton(page, /Build · \$/);
  await sleep(800);
  const poor1 = await readSave(page);
  check(
    "R1 with too little money Build does nothing: no purchase entry, no reveal, the kitchen stays",
    newEntries(poor0, poor1).length === 0 &&
      !(await reveal()) &&
      poor1.equippedKitchenUpgradeId === "humble-kitchen",
  );
  // Version 3 saves (cents, and no level-based tier migration — a version 1 save would be
  // given every tier its level allows on load).
  await bootWith(
    at(60, {
      version: 3,
      credits: 5000000,
      ownedKitchenUpgradeIds: ["humble-kitchen"],
      equippedKitchenUpgradeId: "humble-kitchen",
    }),
  );
  await calm();
  await openUpgrades();
  const t = await page.evaluate(() => document.body.innerText);
  // The restaurant build prices tiers with its own existing rule (restaurantInvestments.kitchenTierPrice).
  const priceText = t.match(/Build · \$([\d,.]+)/)?.[1] ?? null;
  const price = priceText ? Math.round(Number(priceText.replace(/,/g, "")) * 100) : null;
  check(
    "R2 Growing Kitchen offers 🔨 Build at its existing price",
    price !== null && price > 0,
    priceText,
  );
  const b0 = await readSave(page);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      /Build · \$/.test(x.textContent),
    );
    b?.click();
    b?.click();
  });
  await sleep(300);
  const r0 = await reveal();
  const b1 = await readSave(page);
  const kip = newEntries(b0, b1).filter((e) => e.category === "kitchen-investment-purchase");
  check(
    "R3 a double-tapped Build buys once (one entry for exactly the shown price, wallet down by it) and opens one reveal",
    kip.length === 1 &&
      kip[0].amount === -price &&
      b0.credits - b1.credits === price &&
      b1.equippedKitchenUpgradeId === "growing-kitchen" &&
      r0?.count === 1,
    {
      kip: kip.map((e) => e.amount),
      credits: b0.credits - b1.credits,
      reveal: r0 && { ...r0, text: undefined },
    },
  );
  check(
    "R4 the reveal is the major before-and-after: Inherited Kitchen → Cleaning & Repair, the old kitchen first",
    r0?.major === "true" &&
      r0.phase === "before" &&
      r0.from === "humble-kitchen" &&
      r0.to === "growing-kitchen" &&
      /Cleaning & Repair/.test(r0.text),
    r0,
  );
  await page.setViewport({ width: 320, height: 568 });
  await sleep(300);
  await shot(page, "phase5-reveal-before-320");
  await clickButton(page, /^Skip ›$/);
  await sleep(500);
  const r1 = await reveal();
  const fits = await page.evaluate(() => {
    const c = document
      .querySelector('[data-testid="restoration-reveal"] > div')
      .getBoundingClientRect();
    return { top: c.top, bottom: c.bottom, vh: innerHeight };
  });
  await shot(page, "phase5-reveal-after-320");
  check(
    "R5 Skip jumps to the finished kitchen: what changed, what the family's kitchen kept",
    r1?.phase === "after" &&
      /knife rack/.test(r1.text) &&
      /Warmer light/.test(r1.text) &&
      /Still here: the arched window/.test(r1.text),
    r1?.text,
  );
  check("R6 the reveal fits 320×568", fits.top >= 0 && fits.bottom <= fits.vh, fits);
  await page.setViewport({ width: 430, height: 900 });
  await clickButton(page, /^Continue$/);
  await sleep(500);
  check("R7 Continue closes it", !(await reveal()));
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(900);
  await calm();
  const skin1 = await kitchenSkin();
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(1800);
  await calm();
  const skin2 = await kitchenSkin();
  check(
    "R8 the Kitchen now paints the Growing Kitchen (skin-02), and still does after a reload — with no reveal coming back",
    /skin-01/.test(skin0 ?? "") &&
      /skin-02/.test(skin1 ?? "") &&
      /skin-02/.test(skin2 ?? "") &&
      !(await reveal()),
    { skin0, skin1, skin2 },
  );
  // Within a stage: the short reveal; with Reduced Motion: the result at once.
  await bootWith(
    at(150, {
      version: 3,
      credits: 10000000,
      ownedKitchenUpgradeIds: ["humble-kitchen", "growing-kitchen", "established-kitchen"],
      equippedKitchenUpgradeId: "established-kitchen",
      settings: { sound: false, music: false, reducedMotion: true },
    }),
  );
  await calm();
  await openUpgrades();
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => /Neighborhood Café/.test(b.textContent))
      ?.click(),
  );
  await sleep(400);
  await clickButton(page, /Build · \$/);
  await sleep(300);
  const r2 = await reveal();
  check(
    "R9 a build within a stage (Established → Neighborhood Café) gets the short reveal; with Reduced Motion it shows the result at once",
    r2?.major === "false" && r2.phase === "after" && r2.to === "neighborhood-cafe",
    r2 && { ...r2, text: undefined },
  );
  await clickButton(page, /^Continue$/);
}

// R10 — the cutting screen follows the built tier (the workstation's restoration).
if (ONLY.includes("R")) {
  const food = {
    ...MOVED_IN_BUSINESS,
    restaurantStaff: { specialists: ["mexican-chef"] },
    inventory: Object.fromEntries(
      ["tomato", "zucchini", "basil", "onion"].map((id) => [
        id,
        { ingredientId: id, quantity: 12, unitCost: 0, purchaseDay: 1 },
      ]),
    ),
  };
  const cuttingArt = async (tiers) => {
    await bootWith(
      at(13, {
        version: 3,
        credits: 500000,
        ownedKitchenUpgradeIds: tiers,
        equippedKitchenUpgradeId: tiers[tiers.length - 1],
        business: food,
      }),
    );
    await calm();
    if (
      await page.evaluate(() =>
        [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Later"),
      )
    )
      await clickButton(page, /^Later$/);
    await clickButton(page, /Prepare$/);
    await sleep(1200);
    await clickButton(page, /^(OPEN THE RESTAURANT|START SERVICE)$/i);
    await page
      .waitForFunction(() => !!document.querySelector('img[alt^="Warm café kitchen"]'), {
        timeout: 30000,
      })
      .catch(() => null);
    await sleep(800);
    return page.evaluate(
      () => document.querySelector('img[alt^="Warm café kitchen"]')?.getAttribute("src") ?? null,
    );
  };
  const humbleArt = await cuttingArt(["humble-kitchen"]);
  const growingArt = await cuttingArt(["humble-kitchen", "growing-kitchen"]);
  await shot(page, "phase5-cutting-growing");
  check(
    "R10 the cutting screen shows the built tier's painting (Growing → skin-02); the Humble Kitchen keeps the original cutting art",
    /kitchen-bg/.test(humbleArt ?? "") && /skin-02/.test(growingArt ?? ""),
    { humbleArt, growingArt },
  );
}

// ================================================================== G. daily gift
if (ONLY.includes("G")) {
  const card = () =>
    page.evaluate(() => {
      const c = document.querySelector('[data-testid="kitchen-gift"]');
      return c
        ? {
            state: c.dataset.state,
            day: Number(c.dataset.day),
            done: Number(c.dataset.done),
            status: c.querySelector('[data-testid="kitchen-gift-status"]').innerText,
            line: c.querySelector('[data-testid="kitchen-gift-line"]').innerText,
          }
        : null;
    });
  const takeFromCard = async ({ double = false } = {}) => {
    await page.click('[data-testid="kitchen-gift"]');
    await page.waitForSelector('[data-testid="ad-bonus-sheet"]', { timeout: 5000 });
    await sleep(900); // the sheet arms its buttons after a moment
    const offer = await page.evaluate(() => ({
      text: document.querySelector('[data-testid="ad-bonus-sheet"]').innerText.replace(/\s+/g, " "),
      streak: document.querySelector('[data-testid="gift-streak-offer"]')?.innerText ?? null,
    }));
    await page.evaluate((dbl) => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /^Take \$/.test(x.textContent.trim()),
      );
      b?.click();
      if (dbl) b?.click();
    }, double);
    await sleep(700);
    const done = await page.evaluate(() => ({
      text:
        document.querySelector('[data-testid="ad-bonus-done"]')?.innerText.replace(/\s+/g, " ") ??
        null,
      streak: document.querySelector('[data-testid="gift-streak-paid"]')?.innerText ?? null,
    }));
    await clickButton(page, /^Continue$/);
    await sleep(500);
    return { offer, done };
  };
  const giftSave = (ledger, extra = {}) =>
    at(20, {
      economyLedger: ledger,
      credits: 400,
      dailyOrder: { lastClaimedDate: "2026-10-01", streak: 4 },
      ...extra,
    });

  // Day 1, a double tap.
  await bootWith(giftSave([]));
  await calm();
  const c0 = await card();
  check(
    "G1 the Kitchen shows today's gift ready, with its amount, as Day 1 of the week",
    c0?.state === "ready" && /\$\d+.*Take/.test(c0.status) && c0.day === 1,
    c0,
  );
  await page.setViewport({ width: 320, height: 568 });
  await sleep(400);
  await shot(page, "phase5-kitchen-gift-320");
  const fit = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="kitchen-gift"]').getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      vw: innerWidth,
      sw: document.scrollingElement.scrollWidth,
    };
  });
  check(
    "G2 the gift card fits 320 px (no sideways scroll)",
    fit.left >= 0 && fit.right <= fit.vw && fit.sw <= fit.vw,
    fit,
  );
  await page.setViewport({ width: 430, height: 900 });
  await sleep(300);
  const s0 = await readSave(page);
  const t1 = await takeFromCard({ double: true });
  const s1 = await readSave(page);
  const e1 = newEntries(s0, s1);
  check(
    "G3 tapping it opens the existing gift sheet (Day 1 of 7); Take — double-tapped — pays the gift once, one entry",
    /Day 1 of 7/.test(t1.offer.streak ?? "") &&
      e1.length === 1 &&
      e1[0].category === "daily-reward" &&
      s1.credits - s0.credits === e1[0].amount &&
      !t1.done.streak,
    {
      offer: t1.offer.streak,
      entries: e1.map((e) => `${e.description} ${e.amount}`),
      delta: s1.credits - s0.credits,
    },
  );
  const c1 = await card();
  check(
    "G4 the card turns '✓ Taken today' (1 day done)",
    c1?.state === "taken" && /Taken today/.test(c1.status) && c1.done === 1,
    c1,
  );
  check(
    "G5 Today's Special's own streak is untouched by the gift",
    JSON.stringify(s1.dailyOrder) === JSON.stringify(s0.dailyOrder),
    s1.dailyOrder,
  );
  // Midnight: the clock moves a day on, the page comes back.
  await page.evaluate(() => {
    window.__setDayOffset(1);
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await sleep(800);
  const c2 = await card();
  check(
    "G6 past midnight (the page coming back) the card turns over: a new gift ready, Day 2",
    c2?.state === "ready" && c2.day === 2,
    c2,
  );

  // Day 3: two days already in a row.
  await bootWith(giftSave([giftEntry(-2), giftEntry(-1)]));
  await calm();
  const c3 = await card();
  const s3a = await readSave(page);
  const t3 = await takeFromCard();
  const s3b = await readSave(page);
  const e3 = newEntries(s3a, s3b);
  check(
    "G7 Day 3: the card and the sheet say +$100 before; Take pays the gift + $100 as two entries (wallet = entries)",
    /\+\$100/.test(c3?.line ?? "") &&
      /\+\$100\.00 streak reward today/.test(t3.offer.streak ?? "") &&
      e3.length === 2 &&
      e3.some((e) => /gift-streak-day3/.test(e.description) && e.amount === 10000) &&
      s3b.credits - s3a.credits === e3.reduce((a, e) => a + e.amount, 0) &&
      /Day 3 streak reward/i.test(t3.done.streak ?? ""),
    {
      line: c3?.line,
      offer: t3.offer.streak,
      entries: e3.map((e) => `${e.description} ${e.amount}`),
      paid: t3.done.streak,
    },
  );
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(1800);
  await calm();
  const c3b = await card();
  const s3c = await readSave(page);
  check(
    "G8 after a reload it's taken: the card can't open a second claim, nothing more paid",
    c3b?.state === "taken" && newEntries(s3b, s3c).length === 0,
    c3b,
  );

  // Day 7.
  await bootWith(
    giftSave([
      giftEntry(-6),
      giftEntry(-5),
      giftEntry(-4),
      rewardEntry(-4, 3),
      giftEntry(-3),
      giftEntry(-2),
      giftEntry(-1),
    ]),
  );
  await calm();
  const s7a = await readSave(page);
  const t7 = await takeFromCard();
  const s7b = await readSave(page);
  const e7 = newEntries(s7a, s7b);
  const c7 = await card();
  check(
    "G9 Day 7: Take pays the gift + $300 (the larger fixed reward); the week shows complete",
    e7.some((e) => /gift-streak-day7/.test(e.description) && e.amount === 30000) &&
      e7.length === 2 &&
      /week complete/i.test(c7?.line ?? ""),
    { entries: e7.map((e) => `${e.description} ${e.amount}`), line: c7?.line },
  );

  // A missed day.
  const old = [giftEntry(-4), giftEntry(-3), rewardEntry(-3, 3)];
  await bootWith(giftSave(old));
  await calm();
  const cm = await card();
  const sm = await readSave(page);
  check(
    "G10 after a missed day the card says a new streak starts (Day 1) — and nothing earned is removed",
    cm?.day === 1 &&
      /new streak/i.test(cm.line) &&
      old.every((o) => sm.economyLedger.some((e) => e.id === o.id)) &&
      sm.credits === 40000,
    { cm, credits: sm.credits },
  );
}

// ================================================================== Z
if (ONLY.includes("Z")) {
  const errors = logs.filter((l) => /^(error|pageerror)/.test(l));
  check("Z1 no console errors", errors.length === 0, errors.slice(0, 5));
}

save("phase5", { results, logs });
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
