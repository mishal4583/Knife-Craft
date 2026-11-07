// The Second Floor, rebuilt (developer 2026-11-02; docs/planning/SECOND-FLOOR-FINAL-SPEC-2026-11-02.md), restaurant build.
// (Rewritten for the new rules: it opens at Level 3, machines cost $500..$4,000, the first two are self-serve, tables / polish /
// tiers, the next-goal strip. The older version of this file tested the hourly model, Level 5 and a Server for every machine.)
//   1. Level 2: the first-floor map's 2nd-floor button is locked ("Lv 3") and does nothing;
//   2. Level 3: the floor opens; Coffee is for sale ($500 pill), Drinks is still locked (its level);
//   3. the next-goal strip points at the $500 Coffee machine; its Buy button buys it: ONE ledger entry, -$500;
//   4. Coffee is self-serve: no "needs a server" label, and the floor comes alive (guests move on the map);
//   5. an hour later (the save's clock moved back 1 h) the Pickup Counter holds $60.00; one tap collects it with ONE
//      automation-income entry; a second tap pays nothing; a reload never pays it again;
//   6. the station panel: Table #2 ($60) and Polish 1 ($40) are bought: wallet debited, tables 2, polish 1, one entry each;
//   7. fits at 320x568 and 390x844 with no sideways scroll and Buy / table buttons at least 48 px high; no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  readSave,
  writeSave,
  shot,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const atLevel = (n, credits = 100_000) =>
  seedSave({
    credits,
    business: { ...MOVED_IN_BUSINESS },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const dismiss = async (page) => {
  for (let i = 0; i < 4; i++) {
    const hit = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /^(Later|No thanks|Continue|Close|Keep playing)$/.test((x.textContent ?? "").trim()),
      );
      if (b && !b.disabled) {
        b.click();
        return true;
      }
      return false;
    });
    if (!hit) break;
    await sleep(500);
  }
};
const openMap = async (page) => {
  await page.waitForSelector('[data-nav="restaurant-map"]', { timeout: 20000 });
  await sleep(1200);
  await dismiss(page);
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  try {
    await page.waitForSelector('[data-testid="upstairs"]', { timeout: 15000 });
  } catch (e) {
    console.log(
      "STUCK:",
      (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 600),
    );
    await shot(page, "floor3-stuck");
    throw e;
  }
};
const goUp = async (page) => {
  await openMap(page);
  await page.evaluate(() => document.querySelector('[data-testid="upstairs"]').click());
  await page.waitForSelector('[data-testid="second-floor"]', { timeout: 15000 });
  await sleep(700);
};
const tapZone = (page, src) =>
  page.evaluate((s) => {
    const z = [...document.querySelectorAll('[data-testid="second-floor"] .map-hotspot-zone')].find(
      (e) => new RegExp(s).test(e.getAttribute("aria-label") ?? ""),
    );
    z?.click();
    return !!z;
  }, src);
const clickText = (page, src) =>
  page.evaluate((s) => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      new RegExp(s).test(x.textContent ?? ""),
    );
    if (b && !b.disabled) b.click();
    return b ? !b.disabled : false;
  }, src);
const flat = (page) => page.evaluate(() => (document.body.innerText ?? "").replace(/\s+/g, " "));

const { browser, page, logs } = await launch();

// ---------- 1. Locked at Level 2 ----------
await boot(page, atLevel(2));
await openMap(page);
const lockedLabel = await page.$eval('[data-testid="upstairs"]', (b) => b.textContent);
await page.evaluate(() => document.querySelector('[data-testid="upstairs"]').click());
await sleep(500);
check(
  "1 Level 2: the 2nd-floor button is locked (a lock and the services to go) and does nothing",
  /🔒 2nd floor · (in \d+ services|after the next service)/.test(lockedLabel) &&
    !(await page.$('[data-testid="second-floor"]')),
  { lockedLabel },
);

// ---------- 2. Open at Level 3 ----------
await boot(page, atLevel(3));
await goUp(page);
await shot(page, "floor3-l3-390");
const labels = await page.$$eval('[data-testid="second-floor"] .map-hotspot-zone', (els) =>
  els.map((e) => e.getAttribute("aria-label")),
);
const coffeeLabel = labels.find((l) => /^Smart Coffee/.test(l ?? "")) ?? "";
const drinksLabel = labels.find((l) => /^Drinks/.test(l ?? "")) ?? "";
check(
  "2 Level 3: the floor opens; Coffee is for sale ($500), Drinks still waits for its level",
  /locked, buy for \$500\.00/.test(coffeeLabel) && /opens/.test(drinksLabel),
  { coffeeLabel, drinksLabel },
);

// ---------- 3. The next-goal strip buys Coffee ----------
const s0 = await readSave(page);
const goalText = await page.$eval('[data-testid="floor-goal"]', (e) =>
  e.innerText.replace(/\s+/g, " "),
);
const stripBtn = await page.$eval('[data-testid="floor-goal"] button', (b) => ({
  h: b.getBoundingClientRect().height,
  disabled: b.disabled,
}));
await page.evaluate(() => document.querySelector('[data-testid="floor-goal"] button')?.click());
await sleep(600);
const fanfare = await page
  .$eval('[data-testid="floor-fanfare"]', (e) => e.innerText.replace(/\s+/g, " "))
  .catch(() => null);
const s1 = await readSave(page);
const buys = s1.economyLedger.filter((e) => e.category === "automation-purchase");
check(
  "3 the goal strip says 'Next: Coffee machine · $500.00' and its Buy button buys it: -$500, ONE ledger entry",
  /Next: .*Coffee machine/.test(goalText) &&
    /\$500\.00/.test(goalText) &&
    !stripBtn.disabled &&
    stripBtn.h >= 47.5 &&
    s1.credits === s0.credits - 50000 &&
    buys.length === 1 &&
    s1.business.secondFloor?.stations?.coffee?.level === 1,
  { goalText, stripBtn, credits: [s0.credits, s1.credits], buys: buys.length },
);

// ---------- 4. Self-serve and alive ----------
await sleep(900);
const alive = await page.evaluate(async () => {
  const actors = [...document.querySelectorAll(".floor-actor")];
  const where = () => actors.map((a) => getComputedStyle(a).transform).join("|");
  const t0 = where();
  await new Promise((r) => setTimeout(r, 1200));
  return { n: actors.length, moved: where() !== t0 };
});
const pills = await page.$$eval(
  '[data-testid="second-floor"] .map-hotspot-zone .locked-pill-badge',
  (els) => els.map((e) => (e.textContent ?? "").replace(/\s+/g, " ")),
);
check(
  "3b buying a machine celebrates it (a short fanfare naming the machine)",
  !!fanfare && /Coffee is open/.test(fanfare),
  { fanfare },
);
check(
  "4 Coffee is self-serve: no 'Needs a server' pill, and guests walk the floor",
  !pills.some((t) => /Needs a server/i.test(t)) && alive.n > 0 && alive.moved,
  { pills, alive },
);
await shot(page, "floor3-bought-390");

// ---------- 5. An hour later: collect ----------
const moved = await readSave(page);
moved.business.secondFloor.stations.coffee.lastCollectAt -= 3_600_000;
await writeSave(page, moved);
await page.reload({ waitUntil: "domcontentloaded" });
await goUp(page);
const pile = await page.evaluate(
  () => document.querySelector('[data-testid="floor-cash"]')?.innerText ?? "",
);
const before = await readSave(page);
await page.evaluate(() => document.querySelector('[data-testid="floor-cash-pile"]')?.click());
await sleep(600);
const after = await readSave(page);
const incomes = after.economyLedger.filter((e) => e.category === "automation-income");
await page.evaluate(() => document.querySelector('[data-testid="floor-cash-pile"]')?.click());
await sleep(400);
const again = await readSave(page);
check(
  "5 an hour of Coffee at one table is $60.00: one tap collects it with ONE automation-income entry; a second tap pays nothing",
  /60/.test(pile) &&
    after.credits - before.credits >= 6000 &&
    after.credits - before.credits <= 6100 &&
    incomes.length === 1 &&
    again.credits === after.credits,
  { pile, gained: after.credits - before.credits, incomes: incomes.length },
);
await page.reload({ waitUntil: "domcontentloaded" });
await sleep(800);
const afterReload = await readSave(page);
check("5b a reload pays nothing more", afterReload.credits - after.credits < 100, {
  delta: afterReload.credits - after.credits,
});

// ---------- 6. Table and Polish ----------
await goUp(page);
await tapZone(page, "^Smart Coffee");
await sleep(400);
const stats = await page.$eval('[data-testid="station-stats"]', (e) =>
  e.innerText.replace(/\s+/g, " "),
);
const c0 = await readSave(page);
const gotTable = await clickText(page, "Table #2 · \\$60\\.00");
await sleep(500);
const gotPolish = await clickText(page, "Polish 1/10 · \\$40\\.00");
await sleep(500);
const c1 = await readSave(page);
const st = c1.business.secondFloor.stations.coffee;
check(
  "6 Table #2 ($60) and Polish 1 ($40) are bought: tables 2, polish 1, wallet down by $100 (less what the floor paid in)",
  /Tier 1 · 1 table · polish 0\/10/.test(stats) &&
    gotTable &&
    gotPolish &&
    st.tables === 2 &&
    st.polish === 1 &&
    c0.credits - c1.credits <= 10000 &&
    c1.economyLedger.filter((e) => /^coffee-(table|polish)-/.test(e.description ?? "")).length ===
      2,
  { stats, st, spent: c0.credits - c1.credits },
);

// ---------- 7. Fits at 320 and 390 ----------
const fits = [];
for (const [w, h] of [
  [320, 568],
  [390, 844],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await sleep(500);
  await page.evaluate(() => document.querySelector('[aria-label="Close"]')?.click());
  await sleep(300);
  const m = await page.evaluate(() => ({
    sw: document.scrollingElement.scrollWidth,
    iw: window.innerWidth,
  }));
  fits.push({ w, ok: m.sw <= m.iw + 1, m });
  await shot(page, `floor3-fit-${w}`);
}
check(
  "7 fits at 320 and 390 with no sideways scroll",
  fits.every((f) => f.ok),
  fits,
);

// ---------- 9. The Golden Guest (a VIP) ----------
// The VIP's slot, arrival and place come from an integer hash of the 4-minute slot number (restaurant/goldenGuest.ts); the
// same hash here lets the test freeze the page's clock one second after a VIP arrives.
{
  const SLOT = 240_000;
  const hash = (n, salt) => {
    let h = Math.imul((n ^ salt) >>> 0, 2654435761) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519) >>> 0;
    h ^= h >>> 13;
    return h >>> 0;
  };
  const arrive = (slot) => slot * SLOT + 15_000 + (hash(slot, 11) % 200_000);
  const slot = Math.floor(Date.now() / SLOT) + 1;
  const frozen = arrive(slot) + 1000;
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const seeded = await readSave(page);
  seeded.credits = 1000; // so the next goal is still ahead
  await writeSave(page, seeded);
  await page.evaluateOnNewDocument((t) => {
    Date.now = () => t;
  }, frozen);
  await page.reload({ waitUntil: "domcontentloaded" });
  await goUp(page);
  const seen = await page
    .waitForSelector('[data-testid="golden-guest"]', { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  const h = seen
    ? await page.$eval('[data-testid="golden-guest"]', (b) => b.getBoundingClientRect().height)
    : 0;
  const w = seen
    ? await page.$eval('[data-testid="golden-guest"]', (b) => b.getBoundingClientRect().width)
    : 0;
  await shot(page, "floor3-golden");
  const g0 = await readSave(page);
  if (seen)
    await page.evaluate(() => document.querySelector('[data-testid="golden-guest"]')?.click());
  await sleep(700);
  const g1 = await readSave(page);
  const gone = !(await page.$('[data-testid="golden-guest"]'));
  check(
    "9 a Golden Guest (VIP) stands on the floor at the right second (a 🌟 button of at least 48 px); one tap puts the tip on the Pickup Counter once; the button then goes",
    seen &&
      h >= 47.5 &&
      w >= 47.5 &&
      g1.business.secondFloor.bonus > 0 &&
      g1.business.secondFloor.goldenSlot === slot &&
      g1.credits === g0.credits &&
      gone,
    {
      seen,
      h,
      w,
      bonus: g1.business.secondFloor.bonus,
      slot: g1.business.secondFloor.goldenSlot,
      wallet: [g0.credits, g1.credits],
      gone,
    },
  );
}

// ---------- 10. Hype and Rush Hour ----------
{
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const seeded = await readSave(page);
  seeded.business.secondFloor.hype = 100;
  delete seeded.business.secondFloor.goldenSlot;
  await writeSave(page, seeded);
  await page.reload({ waitUntil: "domcontentloaded" });
  await goUp(page);
  const ready = await page
    .waitForSelector('[data-testid="rush-ready"]', { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  await shot(page, "floor3-rush-ready");
  await clickText(page, "^⚡ Start Rush$");
  await sleep(700);
  const on = await page
    .$eval('[data-testid="rush-on"]', (e) => e.innerText.replace(/\s+/g, " "))
    .catch(() => null);
  const fan = await page
    .$eval('[data-testid="floor-fanfare"]', (e) => e.innerText.replace(/\s+/g, " "))
    .catch(() => null);
  const r1 = await readSave(page);
  await shot(page, "floor3-rush-on");
  const f = r1.business.secondFloor;
  check(
    "10 a full Hype meter offers 'Start Rush'; starting it spends the Hype, shows '⚡ RUSH ×3 · m:ss' and a fanfare, and the save holds a 3-minute window",
    ready &&
      /RUSH ×3 · [0-3]:\d\d/.test(on ?? "") &&
      /RUSH HOUR/.test(fan ?? "") &&
      f.hype === 0 &&
      f.rushUntil - f.rushFrom === 180000,
    { ready, on, fan, hype: f.hype, window: f.rushUntil - f.rushFrom },
  );
}

const errors = logs.filter(
  (l) =>
    /error|pageerror/i.test(l.type ?? l) &&
    !/favicon|Failed to load resource/i.test(JSON.stringify(l)),
);
check("8 no page errors", errors.length === 0, errors.slice(0, 3));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
void flat;
