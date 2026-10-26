// The Second Floor (developer 2026-10-16), restaurant build:
//   (Rule changed, developer 2026-10-26: everything by Level 5 — the floor and every station open
//   at L5; were L10 and L60.)
//   1. Level 4: the first-floor map's 2nd-floor button is locked ("Lv 5");
//   1b. Level 10: the floor can be visited; every station is already on sale ("🔒 $price");
//   2. Level 60: all six stations go on sale, still locked until bought ("🔒 $price");
//   3. buying Coffee debits the price once (one ledger entry); it needs a Floor Server;
//      a server and a cleaner are one-time hires (one ledger entry each);
//   3c. nobody walks the floor before a server is hired; then a server, 2 guests and a
//      cleaner move on the map (FloorLife, decorative: aria-hidden, no taps);
//   4. two hours later (the save's clock moved back 2 h) the Pickup Counter collects
//      2 × the hourly rate — one ledger entry; a second tap pays nothing;
//   5. a reload never pays it again; Downstairs returns to the first floor;
//   6. it fits at 320 / 390 / 768 (screenshots), no page errors;
//   8. ?floor2 (testing) opens the floor at any level (checked at L3); every station still shows
//      its level lock, "🔒 Lv.5" (developer 2026-10-16); with nothing bought nobody walks the floor
//      (the preview cast is off since the developer's testing ended).
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
  text,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async (page) => (await text(page)).replace(/\s+/g, " ");
const atLevel = (n, credits = 1_000_000) =>
  seedSave({
    credits,
    business: { ...MOVED_IN_BUSINESS },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 2,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const openMap = async (page) => {
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector('[data-testid="upstairs"]', { timeout: 15000 });
};
const tapZone = (page, re) =>
  page.evaluate((src) => {
    const z = [...document.querySelectorAll('[data-testid="second-floor"] .map-hotspot-zone')].find(
      (e) => new RegExp(src).test(e.getAttribute("aria-label") ?? ""),
    );
    z?.click();
    return !!z;
  }, re.source);
const clickText = (page, re) =>
  page.evaluate((src) => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      new RegExp(src).test(x.textContent ?? ""),
    );
    if (b && !b.disabled) b.click();
    return b ? !b.disabled : false;
  }, re.source);

const { browser, page, logs } = await launch();

const pillsOf = (page) =>
  page.$$eval('[data-testid="second-floor"] .map-hotspot-zone .locked-pill-badge', (els) =>
    els.map((e) => (e.textContent ?? "").replace(/\s+/g, "")),
  );
const labelsOf = (page) =>
  page.$$eval('[data-testid="second-floor"] .map-hotspot-zone', (els) =>
    els.map((e) => e.getAttribute("aria-label")),
  );

// ---------- 1. Locked at 4 ----------
await boot(page, atLevel(4));
await openMap(page);
const lockedLabel = await page.$eval('[data-testid="upstairs"]', (b) => b.textContent);
await page.evaluate(() => document.querySelector('[data-testid="upstairs"]').click());
await sleep(600);
check(
  "1 Level 4: the 2nd-floor button is locked and does nothing",
  /🔒 2nd floor · Lv 5/.test(lockedLabel) && !(await page.$('[data-testid="second-floor"]')),
  { lockedLabel },
);

// ---------- 1b. Visit at 10 ----------
await boot(page, atLevel(10));
await openMap(page);
await page.evaluate(() => document.querySelector('[data-testid="upstairs"]').click());
await page.waitForSelector('[data-testid="second-floor"]', { timeout: 15000 });
await sleep(800);
await shot(page, "second-floor-l10-390");
const l10Labels = await labelsOf(page);
const l10Pills = await pillsOf(page);
await tapZone(page, /^Smart Coffee/);
await sleep(300);
const l10Buy = await page.evaluate(() =>
  [...document.querySelectorAll("button")].some(
    (b) => /For sale from Level 60/.test(b.textContent ?? "") && b.disabled,
  ),
);
check(
  "1b Level 10: the floor can be visited; every station is already on sale (🔒 + its price), none says 'For sale from Level'",
  l10Labels.filter((z) => / — locked, buy for \$[\d,]+\.\d\d$/.test(z)).length === 6 &&
    l10Pills.length === 6 &&
    l10Pills.every((t) => /^🔒\$[\d,]+\.\d\d$/.test(t)) &&
    !l10Buy,
  { l10Labels, l10Pills, l10Buy },
);

// ---------- 2. Open at 60 ----------
await boot(page, atLevel(60));
await openMap(page);
await page.evaluate(() => document.querySelector('[data-testid="upstairs"]').click());
await page.waitForSelector('[data-testid="second-floor"]', { timeout: 15000 });
await sleep(800);
await shot(page, "second-floor-390");
const zones = await labelsOf(page);
const l60Pills = await pillsOf(page);
check(
  "2 Level 60: every station is on sale, still locked until bought (🔒 + its price)",
  zones.filter((z) => / — locked, buy for \$[\d,]+\.\d\d$/.test(z)).length === 6 &&
    l60Pills.length === 6 &&
    l60Pills.every((t) => /^🔒\$[\d,]+\.\d\d$/.test(t)) &&
    zones.length === 9,
  { zones, l60Pills },
);

// ---------- 3. Buy Coffee ----------
const s0 = await readSave(page);
await tapZone(page, /^Smart Coffee/);
await sleep(300);
await clickText(page, /^Buy for \$400\.00$/);
await sleep(600);
const s1 = await readSave(page);
const buys = s1.economyLedger.filter((e) => e.category === "automation-purchase");
check(
  "3 buying Coffee debits $400 once (economy plan 2026-10-16), with one ledger entry",
  s1.credits === s0.credits - 40000 &&
    buys.length === 1 &&
    s1.business.secondFloor?.stations?.coffee?.level === 1,
  { credits: [s0.credits, s1.credits], buys: buys.length },
);

// ---------- 3b. Floor staff: a server and a cleaner, hired for good ----------
const lifeBeforeHire = await page.$$eval(".floor-actor", (els) => els.length);
// While the temporary always-preview flag is on (developer 2026-10-16) the full cast plays
// whatever the save owns; otherwise only the bought, staffed floor comes alive.
const previewOn = await page.$eval(
  '[data-testid="second-floor"]',
  (el) => el.querySelector('[data-testid="floor-life"]')?.getAttribute("data-preview") === "true",
);
const needsServer = await page.evaluate(() =>
  /Needs a server/.test(document.querySelector('[data-testid="second-floor"]').innerText),
);
await page.evaluate(() => document.querySelector('[aria-label="Close"]')?.click());
await sleep(200);
await tapZone(page, /^Pickup Counter/);
await sleep(300);
const hiredServer = await clickText(page, /^Hire for \$400\.00$/);
await sleep(500);
const hiredCleaner = await clickText(page, /^Hire for \$300\.00$/);
await sleep(500);
const s1b = await readSave(page);
const hires = s1b.economyLedger.filter((e) => /^hire-/.test(e.description ?? ""));
check(
  "3b an unstaffed station says it needs a server; a Floor Server ($400) and a Floor Cleaner ($300) are one-time hires — one ledger entry each, no wages",
  needsServer &&
    hiredServer &&
    hiredCleaner &&
    hires.length === 2 &&
    s1b.credits === s1.credits - 40000 - 30000 &&
    s1b.business.secondFloor.servers === 1 &&
    s1b.business.secondFloor.cleaners === 1,
  { needsServer, hires: hires.length },
);

// ---------- 3c. Floor life: the server, guests and cleaner come alive ----------
await page.evaluate(() => document.querySelector('[aria-label="Close"]')?.click());
await sleep(600);
const life = await page.evaluate(async () => {
  const actors = [...document.querySelectorAll(".floor-actor")];
  const kinds = actors.map((a) => a.getAttribute("data-actor"));
  const where = () => actors.map((a) => getComputedStyle(a).transform).join("|");
  const t0 = where();
  await new Promise((r) => setTimeout(r, 1200));
  const layer = document.querySelector('[data-testid="floor-life"]');
  return {
    kinds,
    moved: where() !== t0,
    running: actors.every((a) => a.getAnimations().some((x) => x.playState === "running")),
    hidden: layer?.getAttribute("aria-hidden") === "true",
    taps: layer ? getComputedStyle(layer).pointerEvents : null,
  };
});
await shot(page, "second-floor-life-390");
check(
  "3c floor life: nobody before a server; after the hire a server, 2 guests and a cleaner move on the map (decorative, no taps) — or, with the temporary preview on, the full cast moves",
  (previewOn
    ? lifeBeforeHire === 15 &&
      life.kinds.filter((k) => k === "server").length === 3 &&
      life.kinds.filter((k) => k === "guest").length === 10 &&
      life.kinds.filter((k) => k === "cleaner").length === 2
    : lifeBeforeHire === 0 &&
      life.kinds.filter((k) => k === "server").length === 1 &&
      life.kinds.filter((k) => k === "guest").length === 2 &&
      life.kinds.filter((k) => k === "cleaner").length === 1) &&
    life.moved &&
    life.running &&
    life.hidden &&
    life.taps === "none",
  { previewOn, lifeBeforeHire, ...life },
);

// ---------- 4. Two hours later: collect ----------
const moved = structuredClone(s1b);
moved.business.secondFloor.stations.coffee.lastCollectAt -= 2 * 3_600_000;
await writeSave(page, moved);
await page.reload({ waitUntil: "domcontentloaded" });
await sleep(2500);
await openMap(page);
await page.evaluate(() => document.querySelector('[data-testid="upstairs"]').click());
await page.waitForSelector('[data-testid="second-floor"]', { timeout: 15000 });
await sleep(500);
const s2 = await readSave(page);
await tapZone(page, /^Pickup Counter/);
await sleep(300);
const collected = await clickText(page, /^Collect \$/);
await sleep(600);
const s3 = await readSave(page);
const incomes = s3.economyLedger.filter((e) => e.category === "automation-income");
await shot(page, "second-floor-collected");
const again = await clickText(page, /^Collect \$/);
await sleep(400);
const s4 = await readSave(page);
check(
  "4 two hours later the Pickup Counter collects 2 × $10 — one ledger entry; a second tap pays nothing",
  collected &&
    s3.credits - s2.credits >= 2000 &&
    s3.credits - s2.credits < 2100 &&
    incomes.length === 1 &&
    !again &&
    s4.credits === s3.credits,
  { gained: s3.credits - s2.credits, incomes: incomes.length, again },
);

// ---------- 5. Reload; Downstairs ----------
await page.reload({ waitUntil: "domcontentloaded" });
await sleep(2500);
const s5 = await readSave(page);
await openMap(page);
await page.evaluate(() => document.querySelector('[data-testid="upstairs"]').click());
await page.waitForSelector('[data-testid="second-floor"]', { timeout: 15000 });
await clickText(page, /Downstairs/);
await sleep(800);
check(
  "5 a reload pays nothing more; Downstairs returns to the first-floor map",
  s5.credits === s4.credits &&
    s5.economyLedger.filter((e) => e.category === "automation-income").length === 1 &&
    !!(await page.$('[data-testid="upstairs"]')) &&
    !(await page.$('[data-testid="second-floor"]')),
);

// ---------- 6. Widths ----------
const fits = {};
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [768, 1024],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await sleep(300);
  await page.evaluate(() => document.querySelector('[data-testid="upstairs"]')?.click());
  await page.waitForSelector('[data-testid="second-floor"]', { timeout: 15000 });
  await sleep(700);
  await shot(page, `second-floor-${w}`);
  fits[w] = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    shown: !!document.querySelector('[data-testid="second-floor"] img'),
  }));
  await clickText(page, /Downstairs/);
  await sleep(500);
}
check(
  "6 fits at 320 / 390 / 768",
  Object.values(fits).every((f) => f.shown && f.overflow <= 0),
  fits,
);

// ---------- 8. The testing switch: ?floor2 opens the floor; stations keep their lock ----------
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await boot(page, atLevel(3));
const base = process.env.KC_URL || "http://127.0.0.1:4173/";
await page.goto(base + "?floor2", { waitUntil: "domcontentloaded" });
await sleep(2500);
await openMap(page);
const testLabel = await page.$eval('[data-testid="upstairs"]', (b) => b.textContent);
await page.evaluate(() => document.querySelector('[data-testid="upstairs"]').click());
await page
  .waitForSelector('[data-testid="second-floor"]', { timeout: 15000 })
  .catch(() => undefined);
const testZones = await page.$$eval('[data-testid="second-floor"] .map-hotspot-zone', (els) =>
  els.map((e) => e.getAttribute("aria-label")),
);
const previewKinds = await page.$$eval(".floor-actor", (els) =>
  els.map((e) => e.getAttribute("data-actor")),
);
const lockPills = await page.$$eval(
  '[data-testid="second-floor"] .map-hotspot-zone .locked-pill-badge',
  (els) => els.map((e) => (e.textContent ?? "").replace(/\s+/g, "")),
);
await shot(page, "second-floor-test-locks-390");
check(
  "8 ?floor2 (testing): the floor opens at Level 3, all six stations stay locked with 🔒 Lv.5, and nobody walks the floor (nothing bought; the preview cast is off)",
  /⬆ 2nd floor/.test(testLabel) &&
    testZones.length === 9 &&
    testZones.filter((z) => /opens at Level 5$/.test(z)).length === 6 &&
    lockPills.filter((t) => t === "🔒Lv.5").length === 6 &&
    previewKinds.length === 0,
  { testLabel, testZones, lockPills, previewKinds },
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("7 no page errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `SECOND FLOOR E2E: ${failed.length} FAILURE(S)` : "SECOND FLOOR E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
