// Par audit & deep clean (a real restaurant's day, plan F4), restaurant build:
//   1. Level 41, Day 14 (an audit day) with 3 dinner forks: the opening card shows the
//      📋 Par audit with the forks short; Buy opens the Market on the forks' card
//      (focused); nothing was bought or saved by the card itself.
//   2. The Kitchen day strip marks the audit (Day 14) and the deep clean (Day 7).
//   3. 320 px: the card fits, its buttons ≥ 48 px.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  readSave,
  clickButton,
  shot,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

const stock = {
  ...MOVED_IN_BUSINESS.supplies.stock,
  "dinner-forks": { units: 3, costBasis: 300 },
  "dinner-plates": { units: 40, costBasis: 4000 },
  "dinner-knives": { units: 40, costBasis: 4000 },
  "water-glasses": { units: 40, costBasis: 4000 },
};
const saveAt = (n, day) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: {},
      supplies: { stock },
      restaurantDay: {
        day,
        opened: false,
        servicesDone: 0,
        servicesPlanned: 0,
        closingDue: false,
        openingCredits: null,
        openingLevel: null,
      },
    },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });
const toKitchen = async () => {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(900);
};
const strip = () =>
  page.evaluate(() => document.querySelector('[data-testid="day-strip"]')?.textContent ?? null);
const auditCard = () =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="par-audit"]');
    if (!el) return null;
    return {
      text: el.innerText.replace(/\s+/g, " "),
      lines: [...el.querySelectorAll("[data-audit-line]")].map((x) =>
        x.getAttribute("data-audit-line"),
      ),
    };
  });

// ---------- 1. The audit on the opening card ----------
await boot(page, saveAt(41, 14));
await toKitchen();
const strip14 = await strip();
await clickButton(page, /^Prepare$/);
await sleep(1200);
const card = await auditCard();
await shot(page, "par-audit-card");
const before = await readSave(page);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-audit-line="dinner-forks"] button')]
    .find((b) => /^Buy$/.test(b.textContent.trim()))
    ?.click(),
);
await sleep(1200);
const market = await page.evaluate(() => {
  const c = document.querySelector('[data-supply="dinner-forks"]');
  return { card: !!c, focused: !!c && /ring-2/.test(c.className) };
});
await shot(page, "par-audit-market");
const after = await readSave(page);
check(
  "1 Day 14 at L41: the opening card's par audit lists the forks short; Buy opens the Market on the forks (focused); the card bought nothing",
  !!card &&
    /Par audit · Day 14/.test(card.text) &&
    card.lines.includes("dinner-forks") &&
    !card.lines.includes("dinner-plates") &&
    market.card &&
    market.focused &&
    after.credits === before.credits &&
    after.economyLedger.length === before.economyLedger.length,
  { card, market },
);

// ---------- 2. The day strip ----------
await boot(page, saveAt(41, 7));
await toKitchen();
const strip7 = await strip();
await boot(page, saveAt(41, 13));
await toKitchen();
const strip13 = await strip();
check(
  "2 the day strip marks the audit (Day 14) and tonight's deep clean (Day 7); an ordinary day has neither",
  /Par audit/.test(strip14 ?? "") &&
    /Deep clean tonight/.test(strip14 ?? "") &&
    /Deep clean tonight/.test(strip7 ?? "") &&
    !/Par audit/.test(strip7 ?? "") &&
    !/Par audit|Deep clean/.test(strip13 ?? ""),
  { strip14, strip7, strip13 },
);

// ---------- 3. 320 px ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await boot(page, saveAt(41, 14));
await toKitchen();
await clickButton(page, /^Prepare$/);
await sleep(1200);
const fit = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="par-audit"]');
  const buttons = el ? [...el.querySelectorAll("button")] : [];
  return {
    shown: !!el,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    wide: el ? el.getBoundingClientRect().right - window.innerWidth : null,
    small: buttons.filter((b) => b.getBoundingClientRect().height < 47.5).map((b) => b.textContent),
  };
});
await shot(page, "par-audit-320");
check(
  "3 at 320 px the audit card fits, buttons ≥ 48 px",
  fit.shown && fit.overflow <= 0 && fit.wide <= 0 && fit.small.length === 0,
  fit,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("4 no page errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `PAR AUDIT E2E: ${failed.length} FAILURE(S)` : "PAR AUDIT E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
