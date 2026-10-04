// Unified Restaurant phase 5 (the day clock) + the early menu, in a real browser, on a
// RESTAURANT_MODE test build (VITE_RESTAURANT_MODE=1; a normal build never has it on).
//   1. Level 5 opens Day 1: the opening card lists Lunch · Level 5 and Dinner · Level 6.
//   2. Level 6 (the same day) starts with no sheet.
//   3. After the day's last service, Closing Time shows over the Order Board: the services,
//      the chores, the day's count; the next level can't start until the restaurant closes.
//   4. "Close for the night" → Day 2; the next level opens Day 2. Before L21 the freshness
//      clock doesn't move and no money moves.
//   5. Restaurant → Menu at the restaurant's level (L7): 3 active dishes, the rest locked
//      with their level; the early menu has no on/off switches.
//   6. 320×568: the closing sheet fits, no sideways scroll, buttons ≥ 48 px.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
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
const inHud = () => page.evaluate(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText));
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
  await page.waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
    timeout: 30000,
  });
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

// ---------- 1. Opening Day 1 ----------
await prepare("Onion Basics");
const opening = await sheetText();
await shot(page, "restaurant-day1-opening");
check(
  "1 Level 5 opens Day 1: the opening card lists Lunch · Level 5 and Dinner · Level 6",
  !!opening &&
    /Day 1 · Opening time/i.test(opening) &&
    /Lunch · Level 5/.test(opening) &&
    /Dinner · Level 6/.test(opening),
  opening?.slice(0, 200),
);
await clickButton(page, /^OPEN THE RESTAURANT$/);
await sleep(800);
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

// ---------- 3. Closing time ----------
await toBoard();
const closing = await closingText();
const chores = await page.evaluate(() =>
  [...document.querySelectorAll("[data-chore]")].map((c) => c.getAttribute("data-chore")),
);
await shot(page, "restaurant-day1-closing");
check(
  "3a after the last service Closing Time shows: the services, the chores, the day's count",
  played6 &&
    !!closing &&
    /Day 1 · Closing time/i.test(closing) &&
    /Lunch · Level 5/.test(closing) &&
    /Dinner · Level 6/.test(closing) &&
    chores.join() === "wash-up,wipe-down,count" &&
    /at opening →/.test(closing),
  { closing: closing?.slice(0, 260), chores },
);
await page.evaluate(() => {
  const h = [...document.querySelectorAll("p")].find(
    (p) => p.textContent.trim() === "Peeled Potato",
  );
  let n = h;
  for (let i = 0; i < 8 && n; i++) {
    n = n.parentElement;
    const b =
      n && [...n.querySelectorAll("button")].find((x) => /^Prepare$/.test(x.textContent.trim()));
    if (b) {
      b.click();
      return;
    }
  }
});
await sleep(900);
check("3b the next level can't start before closing", !(await inHud()) && !!(await closingText()));

// ---------- 4. Day 2 ----------
const beforeClose = await readSave(page);
await clickButton(page, /^Close for the night/);
await sleep(800);
const afterClose = await readSave(page);
check(
  "4a closing → Day 2; before L21 the freshness clock and the money don't move",
  !(await closingText()) &&
    afterClose.business.restaurantDay?.day === 2 &&
    afterClose.business.restaurantDay?.opened === false &&
    afterClose.business.calendar.businessDay === beforeClose.business.calendar.businessDay &&
    afterClose.credits === beforeClose.credits &&
    afterClose.economyLedger.length === beforeClose.economyLedger.length,
  { day: afterClose.business.restaurantDay },
);
await prepare("Peeled Potato");
const day2 = await sheetText();
check(
  "4b the next level opens Day 2",
  !!day2 && /Day 2 · Opening time/i.test(day2) && /Lunch · Level 7/.test(day2),
  day2?.slice(0, 160),
);
await page.evaluate(() => document.querySelector('[aria-label="Close"]')?.click());
await sleep(400);

// ---------- 5. Menu ----------
await page.evaluate(() =>
  [...document.querySelectorAll("nav button")]
    .find((x) => x.textContent.includes("Business"))
    ?.click(),
);
await sleep(700);
await clickButton(page, /Menu$/);
await sleep(700);
const menu = await page.evaluate(() => ({
  count: document.querySelector('[data-testid="menu-active-count"]')?.textContent.trim(),
  dishes: [...document.querySelectorAll("[data-menu-dish]")].map((d) =>
    d.getAttribute("data-menu-dish"),
  ),
  locked: document.querySelectorAll("[data-menu-locked]").length,
  switches: [...document.querySelectorAll("[data-menu-dish] button")].filter((b) =>
    /^(ON|OFF)$/.test(b.textContent.trim()),
  ).length,
  firstLocked: document.querySelector("[data-menu-locked]")?.textContent.replace(/\s+/g, " "),
  page: document.body.innerText.replace(/\s+/g, " ").slice(0, 300),
}));
await shot(page, "restaurant-menu-l7");
check(
  "5 the menu at Level 7: 3 active dishes, 45 locked with their level, no switches yet",
  menu.count === "3 / 3 dishes" &&
    menu.dishes.length === 3 &&
    menu.dishes.includes("biz-caprese-salad") &&
    menu.dishes.includes("biz-garden-salad") &&
    menu.locked === 45 &&
    menu.switches === 0 &&
    /Level 11/.test(menu.firstLocked ?? ""),
  menu,
);

// ---------- 6. 320 px closing sheet ----------
await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1 });
const s = await readSave(page);
s.business.restaurantDay = {
  ...s.business.restaurantDay,
  opened: true,
  servicesDone: 2,
  servicesPlanned: 2,
  closingDue: true,
  openingCredits: s.credits - 4500,
  openingLevel: 7,
};
await writeSave(page, s);
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
