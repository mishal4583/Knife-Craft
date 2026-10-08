// The Endless Restaurant, connected (2026-10-06), in a real browser on a RESTAURANT_MODE test
// build (the default build — the restaurant is on unless VITE_RESTAURANT_MODE=0):
//   1. Business Day 4 (a Dinner Rush) after Level 250: Restaurant → Overview shows today's events
//      (Dinner Rush + Today's Special with its dish and the bonus line: 15% of the day's revenue at
//      closing, up to the existing $50 — final economy pass); the Service screen
//      shows them too, with the lines, and states today's expected customers (the real target),
//      not the classic "popularity … brings N customers"; Overview's day card states the same target, not
//      the classic "8 base customers" formula. Business Day 2 shows a Large Group instead.
//   2. End Business Day: the day summary shows the day's stars (0–3, which ones); the save adds them
//      to business.endlessStars (total, days + 1, best day) and notes them on the day's history
//      record; no ledger entry carries stars (credits change = the ledger's change).
//   3. Restaurant Progress: Restaurant standing (rank, stage "Restaurant Complete", Endless open)
//      and the lifetime stars after a reload.
//   4. A save at Level 120: Progress says "Complete all 250 campaign levels to unlock Endless
//      Restaurant." and shows no stars; an old Endless save without endlessStars shows ★ 0.
//   5. 320×568 · 360×640 · 390×844 · 430×932: Progress and Overview fit (no sideways scroll),
//      the events card fits; no page errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, readSave, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true });

const ALL = Array.from({ length: 250 }, (_, i) => `level-${i + 1}`);
const saveAt = (n, business = {}) =>
  seedSave({
    version: 2,
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${Math.min(n, 250)}`,
      highestUnlockedLevelId: `level-${Math.min(n, 250)}`,
      completedLevelIds: n > 250 ? ALL : ALL.slice(0, n - 1),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: true },
    business: { ...MOVED_IN_BUSINESS, ...business },
  });
const clickIn = (scope, re) =>
  page.evaluate(
    (sel, src) => {
      const r = new RegExp(src);
      const b = [...document.querySelectorAll(`${sel} button`)].find((x) =>
        r.test(x.textContent.trim()),
      );
      b?.click();
      return !!b;
    },
    scope,
    re.source,
  );
const nav = (label) => clickIn("nav", new RegExp(`^\\S*\\s*${label}`));
const clickText = (re) =>
  page.evaluate((src) => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      new RegExp(src).test(x.textContent.trim()),
    );
    b?.click();
    return !!b;
  }, re.source);
const card = (id) =>
  page.evaluate(
    (t) => document.querySelector(`[data-testid="${t}"]`)?.innerText.replace(/\s+/g, " ") ?? null,
    id,
  );
const fits = () =>
  page.evaluate(() => {
    const over = [...document.querySelectorAll("*")].some(
      (e) =>
        e.scrollWidth > e.clientWidth + 1 &&
        getComputedStyle(e).overflowX === "visible" &&
        e.getBoundingClientRect().right > window.innerWidth + 1,
    );
    return document.documentElement.scrollWidth <= window.innerWidth && !over;
  });

// ---------- 1. Events on the Endless day ----------
await boot(
  page,
  saveAt(251, { calendar: { businessDay: 4 }, endlessStars: { total: 7, days: 3, bestDay: 3 } }),
);
await nav("Restaurant");
await sleep(900);
const ov = await card("endless-events");
await page.evaluate(() =>
  document.querySelector('[data-testid="endless-events"]')?.scrollIntoView(),
);
await shot(page, "endless-overview");
// Overview's "Today's service" day card (BusinessDayCard) — read before leaving the tab.
const opsText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
await clickIn('nav[aria-label="Business sections"]', /Operations/);
await sleep(700);
await clickText(/Open Restaurant →|Go to Service →/);
await sleep(900);
const svc = await card("endless-events");
const svcCustomers = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
await shot(page, "endless-service");
check(
  "1a Day 4: Overview and Service show Dinner Rush + Today's Special (dish; 15% of the day's revenue at closing, up to the existing $50, once a day)",
  /Dinner Rush/.test(ov ?? "") &&
    /Today's Special: \S/.test(ov ?? "") &&
    !/Large Group/.test(ov ?? "") &&
    /Serve it today: at closing you earn 15% of today's restaurant revenue, up to \$50(\.00)? \(once a day\)/.test(
      svc ?? "",
    ) &&
    /A busy evening/.test(svc ?? "") &&
    !/NaN/.test(`${ov} ${svc}`) &&
    /Today's expected customers: \d+ — set by your popularity, menu and today's events, up to what your team can serve\./.test(
      svcCustomers,
    ) &&
    !/brings \d+ customers today/.test(svcCustomers),
  { ov, svc },
);
await boot(page, saveAt(251, { calendar: { businessDay: 2 } }));
await nav("Restaurant");
await sleep(900);
const ov2 = await card("endless-events");
check(
  "1b Day 2: a Large Group instead",
  /Large Group/.test(ov2 ?? "") && !/Dinner Rush/.test(ov2 ?? ""),
  ov2,
);
check(
  '1c Overview day card: today\'s expected customers (the real target, as on Service), no classic "8 base customers" formula',
  /Today's expected customers: \d+ — set by your popularity, menu and today's events, up to what your team can serve\. \d+ remaining\./.test(
    opsText,
  ) &&
    !/base customers/.test(opsText) &&
    (opsText.match(/Today's expected customers: (\d+)/)?.[1] ?? "") ===
      (opsText.match(/\d+ \/ (\d+) served/)?.[1] ?? "x"),
  {
    line: opsText.match(/Today's expected customers: \d+ — [^.]*\. \d+ remaining\./)?.[0],
    served: opsText.match(/\d+ \/ \d+ served/)?.[0],
  },
);

// ---------- 2. End Business Day → stars ----------
await boot(
  page,
  saveAt(251, { calendar: { businessDay: 4 }, endlessStars: { total: 7, days: 3, bestDay: 3 } }),
);
const before = await readSave(page);
await nav("Restaurant");
await sleep(900);
await clickText(/^End Business Day →/);
await sleep(1500);
const summary = await card("day-stars");
const after = await readSave(page);
const life = after.business.endlessStars;
const rec = after.business.finance.history?.at(-1);
const ledgerDelta = after.economyLedger
  .slice(before.economyLedger.length)
  .reduce((n, e) => n + e.amount, 0);
const dayStars = rec?.stars;
check(
  "2 End Business Day: the summary shows the day's stars; lifetime = 7 + the day's, days 4, the history notes them; no ledger entry for stars",
  /Stars [★☆]{3}/.test(summary ?? "") &&
    typeof dayStars === "number" &&
    dayStars >= 0 &&
    dayStars <= 3 &&
    life?.total === 7 + dayStars &&
    life?.days === 4 &&
    life?.bestDay === 3 &&
    after.credits - before.credits === ledgerDelta &&
    !after.economyLedger.some((e) => /star/i.test(`${e.category} ${e.description ?? ""}`)),
  { summary, life, dayStars, credits: [before.credits, after.credits], ledgerDelta },
);

// ---------- 3. Restaurant Progress after a reload ----------
await page.reload({ waitUntil: "networkidle0" });
await sleep(1500);
await nav("Progress");
await sleep(900);
const st = await card("restaurant-standing");
await page.evaluate(() =>
  document.querySelector('[data-testid="restaurant-standing"]')?.scrollIntoView(),
);
await shot(page, "endless-progress");
check(
  "3 Progress: rank, stage Restaurant Complete, Endless open, lifetime stars (after a reload)",
  /Rank \S/.test(st ?? "") &&
    /Stage Restaurant Complete/.test(st ?? "") &&
    /Restaurant Complete ✅ Yes/.test(st ?? "") &&
    /Endless Restaurant 🔓 Open/.test(st ?? "") &&
    new RegExp(`★ ${life?.total}`).test(st ?? "") &&
    /4 days run · best day 3 \/ 3/.test(st ?? "") &&
    /not money/.test(st ?? ""),
  st,
);

// ---------- 4. Locked, and an old save ----------
await boot(page, saveAt(120));
await nav("Progress");
await sleep(900);
const locked = await card("restaurant-standing");
check(
  "4a Level 120: Endless locked with the line; no stars",
  /Complete all 250 campaign levels to unlock Endless Restaurant\./.test(locked ?? "") &&
    /Endless Restaurant 🔒 Locked/.test(locked ?? "") &&
    /Restaurant Complete Not yet/.test(locked ?? "") &&
    !/Endless stars/.test(locked ?? ""),
  locked,
);
await boot(page, saveAt(251));
await nav("Progress");
await sleep(900);
const oldSave = await card("restaurant-standing");
check(
  "4b an Endless save without endlessStars shows ★ 0",
  /★ 0/.test(oldSave ?? "") && /0 days run/.test(oldSave ?? ""),
  oldSave,
);

// ---------- 5. Widths ----------
const widths = [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 932],
];
const fit = [];
for (const [w, h] of widths) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true });
  await boot(
    page,
    saveAt(251, { calendar: { businessDay: 4 }, endlessStars: { total: 12, days: 5, bestDay: 3 } }),
  );
  await nav("Progress");
  await sleep(800);
  const p = await fits();
  await nav("Restaurant");
  await sleep(800);
  const o = await fits();
  const cardW = await page.evaluate(
    () =>
      document.querySelector('[data-testid="endless-events"]')?.getBoundingClientRect().right ?? 0,
  );
  fit.push({ w, progress: p, overview: o, card: cardW <= w });
  if (w === 320) await shot(page, "endless-overview-320");
}
check(
  "5 320–430 px: Progress and Overview fit, the events card fits",
  fit.every((f) => f.progress && f.overview && f.card),
  fit,
);
const errors = logs.filter((l) => /pageerror|Uncaught/i.test(l));
check("6 no page errors", errors.length === 0, errors.slice(0, 3));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed ? `RESTAURANT ENDLESS E2E: ${failed} FAILURE(S)` : "RESTAURANT ENDLESS E2E: ALL PASS",
);
process.exit(failed ? 1 : 0);
