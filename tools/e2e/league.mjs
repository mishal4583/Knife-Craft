// Chef Pride, Phase 5 (developer 2026-11-23: the LOCAL weekly city league), restaurant build:
//   1. Restaurant Progress shows "City league · this week" from Level 10: the league (Bronze), a table of ten with the player in it, the goal line, and the plain promise
//      that the city's restaurants compete and nobody drops down a league;
//   2. below Level 10 there is no league card;
//   3. a finished week: a saved league week far in the past, with points that beat the table, is settled the first time the Kitchen is seen: the player goes up to Silver,
//      the celebration card says so ONCE (not again after closing it or after a reload), and Progress then shows Silver and last week's result;
//   4. (not here) a real plate earning points: Levels 10+ open with the delivery routine and the Pre-Service Check, which the cutting solver cannot pass reliably; the plate
//      and service hooks are covered by city-league-qa H1/H2 and the same persist path runs in dares.mjs / chefrecords.mjs;
//   5. the card fits 320x568, 390x844 and 1280x720: in view, no sideways scroll; no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot, readSave } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const stock = (ids) =>
  Object.fromEntries(
    ids.map((id) => [id, { ingredientId: id, quantity: 14, unitCost: 100, purchaseDay: 7 }]),
  );
const saveAt = (completed, chefRecord = undefined, recipe = null) => {
  const s = seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: { hired: true, seen: [], tipsOff: true },
      sectionsSeen: ["shop", "inventory", "rack", "business"],
      ...(recipe
        ? {
            staff: { hiredRoles: ["server", "cashier"] },
            calendar: { businessDay: 7 },
            inventory: stock(["grapes", "strawberry"]),
            restaurantStaff: { specialists: ["mexican-chef"] },
          }
        : {}),
      ...(chefRecord ? { chefRecord } : {}),
    },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${completed + 1}`,
      highestUnlockedLevelId: `level-${completed + 1}`,
      completedLevelIds: Array.from({ length: completed }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
      ...(recipe ? { tickets: { [`level-${completed + 1}`]: [recipe] } } : {}),
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
  s.version = 3;
  return s;
};
const click = (page, sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
const clickText = async (page, re) => {
  const r = await page.evaluate((src) => {
    const b = [...document.querySelectorAll("button")].find(
      (x) =>
        new RegExp(src, "i").test(x.textContent.trim()) &&
        !x.disabled &&
        x.getBoundingClientRect().width > 0,
    );
    if (!b) return null;
    const q = b.getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  }, re.source);
  if (r) await page.mouse.click(r.x, r.y);
  return !!r;
};
const { browser, page, logs } = await launch();
const dismissGuide = () =>
  page.evaluate(() => {
    const g = document.querySelector('[data-testid="guide-card"]');
    [...(g?.querySelectorAll("button") ?? [])]
      .find((b) => /^Later$/.test(b.textContent.trim()))
      ?.click();
  });
/** Opens Restaurant Progress from the Kitchen's rank card (money waiting sends the player to Achievements first: collect it, go back). */
async function openProgress() {
  await dismissGuide();
  await sleep(400);
  await click(page, '[data-testid="kitchen-rank"]');
  await sleep(1000);
  for (let i = 0; i < 8; i++) {
    const collected = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) =>
        /^Collect \$/.test(x.textContent.trim()),
      );
      b?.click();
      return !!b;
    });
    if (!collected) break;
    await sleep(500);
  }
  if (
    await page.evaluate(
      () =>
        !document.querySelector('[data-testid="city-rank-hero"]') &&
        !!document.querySelector('button[aria-label="Back"]'),
    )
  ) {
    await click(page, 'button[aria-label="Back"]');
    await sleep(900);
    await click(page, '[data-testid="kitchen-rank"]');
    await sleep(1000);
  }
}
const card = () =>
  page.evaluate(() => {
    const c = document.querySelector('[data-testid="league-card"]');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return {
      league: c.getAttribute("data-league"),
      name: c.querySelector('[data-testid="league-name"]')?.textContent?.trim() ?? null,
      rows: c.querySelectorAll("[data-row]").length,
      player: c.querySelectorAll('[data-row="player"]').length,
      goal: c.querySelector('[data-testid="league-goal"]')?.textContent?.trim() ?? null,
      last: c.querySelector('[data-testid="league-last"]')?.textContent?.trim() ?? null,
      promise: /nobody drops down a league/i.test(c.textContent ?? ""),
      inView: r.left >= 0 && r.right <= innerWidth,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

// ---- 1. the card ----
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await boot(page, saveAt(11));
await sleep(1500);
await openProgress();
const c1 = await card();
await shot(page, "league-progress");
check(
  "1 Level 12: a Bronze table of ten with the player in it, a goal line and the promise that nobody drops down",
  !!c1 &&
    // RULE CHANGE (developer 2026-11-25, Restaurant Progress redesign, commit 79a035c): the card's title is a painted icon plus the words, no 🏅 in the text.
    c1.name === "Bronze League" &&
    c1.rows === 10 &&
    c1.player === 1 &&
    !!c1.goal &&
    c1.promise,
  c1,
);

// ---- 2. below Level 10 ----
await boot(page, saveAt(6));
await sleep(1500);
await openProgress();
check("2 below Level 10 there is no league card", (await card()) === null);

// ---- 3. a finished week ----
await boot(page, saveAt(11, { league: { week: "2026-01-05", tier: 0, points: 500, last: null } }));
let cel = null;
for (let i = 0; i < 12 && !cel; i++) {
  await sleep(700);
  await dismissGuide();
  cel = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="celebration"]');
    return c
      ? { kind: c.getAttribute("data-celebration"), text: c.innerText.replace(/\s+/g, " ") }
      : null;
  });
}
await shot(page, "league-week-end");
check(
  "3a the first Kitchen visit after the week tells the result once: Promoted to Silver League",
  !!cel &&
    cel.kind === "league" &&
    /Promoted to Silver League!/.test(cel.text) &&
    /Bronze League · #1 of 10 · 500 points/.test(cel.text),
  cel,
);
await clickText(page, /Keep going/);
await sleep(1200);
const after = await readSave(page);
const l = after.business.chefRecord?.league;
check(
  "3b it is saved: Silver, a new empty week, the last week kept and marked as told",
  l?.tier === 1 &&
    l.points === 0 &&
    l.last?.promoted === true &&
    l.last.shown === true &&
    l.last.rank === 1,
  l,
);
await page.reload({ waitUntil: "networkidle0" });
await sleep(3500);
const again = await page.evaluate(
  () => !!document.querySelector('[data-testid="celebration"][data-celebration="league"]'),
);
check("3c after a reload the result is not told again", !again);
await openProgress();
const c3 = await card();
check(
  "3d Progress now shows Silver League and last week's result",
  // RULE CHANGE (developer 2026-11-25): painted icon, no 🏅 in the title text (see check 1).
  !!c3 && c3.name === "Silver League" && /#1 of 10, promoted/.test(c3.last ?? ""),
  c3,
);

// ---- 5. fits ----
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [1280, 720],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, saveAt(11));
  await sleep(1500);
  await openProgress();
  const f = await card();
  await shot(page, `league-fit-${w}`);
  check(
    `5 ${w}x${h}: the card is in view, no sideways scroll`,
    !!f && f.inView && f.overflow <= 0,
    f,
  );
}

const errs = logs.filter((x) => /error/i.test(x) && !/favicon|Failed to load resource/i.test(x));
check("6 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
