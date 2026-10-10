// Unified Restaurant phase 5 (the day clock), in a real browser, on a RESTAURANT_MODE test
// build (the default build). Since the first levels (developer 2026-10-09) the day's
// ceremony — the opening card and Closing Time — starts at Level 21; before it a day opens
// and ends quietly ("☀️ Day N begins" on Level Complete).
//   1. Level 5 opens Day 1 with no card: the level starts at once and the day is open.
//   2. Level 6 (the same day) starts with no sheet.
//   3. After the day's last service (L6): no Closing Time; Level Complete says "Day 2
//      begins"; Day 2 in the save; the freshness clock doesn't move and the wallet moves
//      only by the ledger's entries.
//   4. From L21: a finished day shows Closing Time over the Order Board (services, chores
//      with "Throw out spoiled food", the day's count) and blocks the next level; Close →
//      the next day, and the next level opens with the opening card.
//   5. Level 7: the Restaurant section (the menu) is still locked ("Lv 11").
//   6. 320×568: the closing sheet fits, no sideways scroll, buttons ≥ 48 px.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  clickButton,
  readSave,
  writeSave,
  shot,
  text,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const { browser, page, logs } = await launch();

async function toBoard() {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  await clickButton(page, /^See all orders/);
  await sleep(700);
}
async function prepare(title) {
  await toBoard();
  await page.evaluate((name) => {
    const h = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === name);
    let n = h;
    for (let i = 0; i < 8 && n; i++) {
      n = n.parentElement;
      const b =
        n &&
        [...n.querySelectorAll("button")].find((x) =>
          /^(Prepare|Play|Start Service)$/.test(x.textContent.trim()),
        );
      if (b) {
        b.click();
        return;
      }
    }
  }, title);
  await sleep(900);
}
const inHud = () =>
  page.evaluate(() => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText));
const sheetText = () =>
  page.evaluate(
    () =>
      document.querySelector('[data-testid="pre-service-check"]')?.innerText.replace(/\s+/g, " ") ??
      null,
  );
const closingText = () =>
  page.evaluate(
    () =>
      document.querySelector('[data-testid="closing-time"]')?.innerText.replace(/\s+/g, " ") ??
      null,
  );
async function playLevel() {
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    {
      timeout: 30000,
    },
  );
  const played = await playToReport(page, { maxMs: 120000 });
  await clickButton(page, /^Continue$/);
  await sleep(900);
  if (/ORDER READY/i.test(await flat())) {
    await clickButton(page, /^Serve to /);
    await sleep(900);
  }
  await clickButton(page, /^Finish Level$/);
  await sleep(1800);
  return played.ok;
}

await boot(
  page,
  seedSave({
    business: MOVED_IN_BUSINESS,
    credits: 5000,
    levelProgress: {
      currentLevelId: "level-5",
      highestUnlockedLevelId: "level-5",
      completedLevelIds: ["level-1", "level-2", "level-3", "level-4"],
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  }),
);
const start = await readSave(page);

// ---------- 1. Day 1 opens quietly ----------
await prepare("Onion Basics");
const opening = await sheetText();
const started5 = await inHud();
const open5 = (await readSave(page)).business.restaurantDay;
check(
  "1 Level 5 opens Day 1 with no card: the level starts at once and the day is open",
  opening === null && started5 && open5?.opened === true && open5?.openingLevel === 5,
  { opening, open5 },
);
const played5 = await playLevel();
const after5 = await readSave(page);

// ---------- 2. Level 6, same day ----------
await prepare("Diced Tomato");
const midSheet = await sheetText();
check(
  "2 Level 6 (the same day) starts with no sheet",
  played5 &&
    midSheet === null &&
    (await inHud()) &&
    after5.business.restaurantDay?.servicesDone === 1,
  { played5, midSheet, day: after5.business.restaurantDay },
);
const played6 = await playLevel();

// ---------- 3. The day ends quietly ----------
const notes = await page.evaluate(
  () => document.querySelector('[data-testid="banner-notes"]')?.textContent ?? "",
);
const after6 = await readSave(page);
const ledgerDelta = after6.economyLedger
  .slice(after5.economyLedger.length)
  .reduce((sum, e) => sum + e.amount, 0);
await toBoard();
const quietClosing = await closingText();
check(
  "3 after L6: no Closing Time, 'Day 2 begins', Day 2 saved; no clock change, wallet = ledger",
  played6 &&
    quietClosing === null &&
    /Day 2 begins/.test(notes) &&
    after6.business.restaurantDay?.day === 2 &&
    after6.business.restaurantDay?.closingDue === false &&
    after6.business.calendar.businessDay === start.business.calendar.businessDay &&
    after6.credits - after5.credits === ledgerDelta,
  { notes, day: after6.business.restaurantDay, ledgerDelta },
);

// ---------- 4. From Level 21: the ceremony ----------
const closingSave = (s) => ({
  ...s,
  levelProgress: {
    currentLevelId: "level-23",
    highestUnlockedLevelId: "level-23",
    completedLevelIds: Array.from({ length: 22 }, (_, i) => `level-${i + 1}`),
  },
  business: {
    ...s.business,
    restaurantDay: {
      day: 11,
      opened: true,
      servicesDone: 2,
      servicesPlanned: 2,
      closingDue: true,
      openingCredits: s.credits - 4500,
      openingLevel: 21,
    },
  },
});
await writeSave(page, closingSave(await readSave(page)));
await page.reload({ waitUntil: "networkidle0" });
await sleep(1500);
await toBoard();
const closing = await closingText();
const chores = await page.evaluate(() =>
  [...document.querySelectorAll("[data-chore]")].map((c) => c.getAttribute("data-chore")),
);
await shot(page, "restaurant-day11-closing");
check(
  "4a from L21 a finished day shows Closing Time: the services, the chores (spoiled food and wrapping what's left too), the count",
  !!closing &&
    /Day 11 · Closing time/i.test(closing) &&
    /Lunch · Level 21/.test(closing) &&
    /Dinner · Level 22/.test(closing) &&
    chores.join() === "wash-up,wipe-down,spoiled,wrap,count" &&
    /at opening →/.test(closing),
  { closing: closing?.slice(0, 260), chores },
);
await clickButton(page, /^Prepare$/);
await sleep(900);
check("4b the next level can't start before closing", !(await inHud()) && !!(await closingText()));
await clickButton(page, /^Close for the night/);
await sleep(800);
const afterClose = await readSave(page);
await prepare("Orange Rose Garnish");
const day12 = await sheetText();
check(
  "4c Close → Day 12; the next level opens with the opening card",
  !(await closingText()) &&
    afterClose.business.restaurantDay?.day === 12 &&
    !!day12 &&
    /Day 12 · Opening time/i.test(day12) &&
    /Level 23/.test(day12),
  { day: afterClose.business.restaurantDay, day12: day12?.slice(0, 160) },
);
await page.evaluate(() => document.querySelector('[aria-label="Close"]')?.click());
await sleep(400);

// ---------- 5. Level 7: the menu is still locked ----------
await boot(
  page,
  seedSave({
    business: MOVED_IN_BUSINESS,
    levelProgress: {
      currentLevelId: "level-7",
      highestUnlockedLevelId: "level-7",
      completedLevelIds: Array.from({ length: 6 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  }),
);
const restaurantTab = await page.evaluate(() => {
  const b = document.querySelector('nav button[data-nav="business"]');
  return b
    ? { locked: b.hasAttribute("data-locked"), text: b.innerText.replace(/\s+/g, " ") }
    : null;
});
check(
  "5 Level 7: the Restaurant section (the menu) opens at Level 11",
  restaurantTab?.locked === true && /Lv 11/.test(restaurantTab.text),
  restaurantTab,
);

// ---------- 6. 320 px closing sheet ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
await writeSave(page, closingSave(await readSave(page)));
await page.reload({ waitUntil: "networkidle0" });
await sleep(1500);
await toBoard();
const fit = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="closing-time"]');
  const buttons = el ? [...el.querySelectorAll("button")].filter((b) => b.offsetParent) : [];
  return {
    open: !!el,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: buttons
      .filter((b) => b.getBoundingClientRect().height < 47.5)
      .map((b) => b.textContent.trim()),
  };
});
await shot(page, "restaurant-closing-320");
check(
  "6 at 320×568 the closing sheet fits, no sideways scroll, buttons ≥ 48 px",
  fit.open && fit.overflow <= 0 && fit.small.length === 0,
  fit,
);

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("7 no page errors", errors.length === 0, errors.slice(0, 5));
void start;

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `RESTAURANT DAY E2E: ${failed.length} FAILURE(S)`
    : "RESTAURANT DAY E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
