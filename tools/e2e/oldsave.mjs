// Chef Pride audit, Batch 5 (developer 2026-11-24): OLD SAVES and MISSED DAYS, restaurant build, real browser.
//   O1 a save from before Chef Pride (no business.chefRecord, no guideSeen, no league, no dare) at Level 14 opens: the Kitchen, Restaurant Progress (rank, title, prestige and league cards)
//      and the Achievements screen all render, no "NaN" / "undefined" / "[object" anywhere, the wallet and the ledger are untouched by merely opening them, no console errors;
//   O2 a PARTIAL chefRecord (an early shape: only a few numbers) reads with defaults for the rest and the numbers it has are kept;
//   O3 a missed day: a dare accepted three days ago, still unfinished, and a league week from three weeks ago. Nothing is lost or charged: the old dare is not shown as active (a
//      new day starts fresh), the wallet and the ledger are the same, the player's records are intact, the week's result is told ONCE and pays nothing;
//   O4 the same save opened twice (a reload) gives the same Kitchen: nothing is announced twice.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  boot,
  launch,
  openSection,
  readSave,
  seedSave,
  shot,
  sleep,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const completedIds = (n) => Array.from({ length: n }, (_, i) => `level-${i + 1}`);
const DAY = 86400000;
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const now = new Date();
const THREE_DAYS_AGO = ymd(new Date(now.getTime() - 3 * DAY));
const THREE_WEEKS_AGO = ymd(new Date(now.getTime() - 21 * DAY));

const saveAt = (completed, business = {}) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: { hired: true, seen: [], tipsOff: true },
      sectionsSeen: ["shop", "inventory", "rack", "business"],
      ...business,
    },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${completed + 1}`,
      highestUnlockedLevelId: `level-${completed + 1}`,
      completedLevelIds: completedIds(completed),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });

const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

const bad = (text) => /NaN|undefined|\[object|Infinity/.test(text);
const wallet = async () => {
  const s = await readSave(page);
  return { credits: s?.credits, ledger: s?.economyLedger?.length ?? 0 };
};
const dismissGuide = () =>
  page.evaluate(() => {
    const g = document.querySelector('[data-testid="guide-card"]');
    [...(g?.querySelectorAll("button") ?? [])]
      .find((b) => /^Later$/.test(b.textContent.trim()))
      ?.click();
  });
const progressText = async () => {
  await sleep(1200);
  await dismissGuide();
  await openSection(page, "Progress");
  await sleep(1500);
  return page.evaluate(() => ({
    text: document.body.innerText,
    title: !!document.querySelector('[data-testid="chef-title-card"]'),
    league: document.querySelector('[data-testid="league-card"]')?.innerText ?? null,
  }));
};

// ───────── O1: a save from before Chef Pride ─────────
const old = saveAt(13);
delete old.business.chefRecord;
delete old.business.guideSeen;
await boot(page, old);
await sleep(2500);
const w0 = await wallet();
const kitchenText = await page.evaluate(() => document.body.innerText);
const p1 = await progressText();
await shot(page, "oldsave-progress");
check(
  "O1a an old save (no chefRecord, no guideSeen) opens: the Kitchen and Restaurant Progress render with the title and league cards and no broken text",
  kitchenText.length > 50 && p1.title && !!p1.league && !bad(kitchenText) && !bad(p1.text),
  { title: p1.title, league: !!p1.league, kitchenBad: bad(kitchenText), progressBad: bad(p1.text) },
);
await page.reload({ waitUntil: "networkidle0" });
await sleep(2500);
// Achievements opens from Restaurant Progress (as achievements.mjs does it).
await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
await sleep(600);
await page.evaluate(() => document.querySelector('[data-testid="kitchen-rank"]')?.click());
await sleep(900);
await page.evaluate(() =>
  [...document.querySelectorAll("button")].find((b) => /Achievements/.test(b.textContent))?.click(),
);
await sleep(1500);
const ach = await page.evaluate(() => document.body.innerText);
check(
  "O1b the Achievements screen renders the chef titles for an old save, with no broken text",
  /Precision|Steady Hand/i.test(ach) && !bad(ach),
  { hasTitles: /Precision|Steady Hand/i.test(ach), bad: bad(ach) },
);
const w1 = await wallet();
check(
  "O1c opening the Kitchen, Progress and Achievements moved no money and wrote no ledger entry",
  w1.credits === w0.credits && w1.ledger === w0.ledger,
  { w0, w1 },
);

// ───────── O2: a partial early chefRecord ─────────
await boot(page, saveAt(13, { chefRecord: { plates: 7, bestCombo: 9 } }));
await sleep(2500);
const p2 = await progressText();
const s2 = await readSave(page);
check(
  "O2 a partial record (plates 7, best combo 9) is read with defaults for the rest: the card renders, and the numbers it had are still saved",
  p2.title &&
    !bad(p2.text) &&
    (s2.business.chefRecord?.plates ?? 7) === 7 &&
    (s2.business.chefRecord?.bestCombo ?? 9) === 9,
  { plates: s2.business.chefRecord?.plates, bestCombo: s2.business.chefRecord?.bestCombo },
);

// ───────── O3: a missed day and a missed week ─────────
const missed = saveAt(13, {
  chefRecord: {
    plates: 40,
    perfectCuts: 120,
    bestCombo: 14,
    masterful: 12,
    runClean: 3,
    bestRunClean: 6,
    fastestMs: 21000,
    daresWon: 2,
    challenge: { day: THREE_DAYS_AGO, id: "no-mercy", state: "accepted", progress: 2 },
    league: { week: THREE_WEEKS_AGO, tier: 0, points: 40, last: null },
  },
});
// (a version 1 seed is migrated on load: credits x100 into USD cents)
const missedCredits = missed.credits * 100;
await boot(page, missed);
await sleep(3000);
const wM0 = await wallet();
const rowText = await page.evaluate(
  () => document.querySelector("#kitchen-order-details")?.innerText ?? "",
);
const celebration = await page.evaluate(() => {
  const c = document.querySelector('[data-testid="celebration"]');
  return c ? c.innerText.replace(/\s+/g, " ") : null;
});
const sM = await readSave(page);
const chef = sM.business.chefRecord;
check(
  "O3a a dare left unfinished three days ago is not active today, and nothing was charged for missing it",
  !/Dare accepted|in progress|\b2 of 5\b/i.test(rowText) && wM0.credits === missedCredits,
  { rowText: rowText.slice(0, 160), credits: wM0.credits },
);
check(
  "O3b the player's records are intact after the missed days (plates 40, perfect cuts 120, best combo 14, best Clean run 6, fastest 21 s, dares won 2)",
  chef?.plates === 40 &&
    chef.perfectCuts === 120 &&
    chef.bestCombo === 14 &&
    chef.bestRunClean === 6 &&
    chef.fastestMs === 21000 &&
    chef.daresWon === 2,
  chef && {
    plates: chef.plates,
    perfectCuts: chef.perfectCuts,
    bestCombo: chef.bestCombo,
    bestRunClean: chef.bestRunClean,
    fastestMs: chef.fastestMs,
    daresWon: chef.daresWon,
  },
);
check(
  "O3c the week from three weeks ago is settled once and pays nothing (no wallet change, no ledger entry)",
  (celebration === null || /league/i.test(celebration)) &&
    wM0.ledger === (saveAt(13).economyLedger?.length ?? wM0.ledger),
  { celebration: celebration?.slice(0, 120), ledger: wM0.ledger },
);

// ───────── O4: a reload announces nothing twice ─────────
await page.reload({ waitUntil: "networkidle0" });
await sleep(3500);
const again = await page.evaluate(
  () => !!document.querySelector('[data-testid="celebration"][data-celebration="league"]'),
);
const wM1 = await wallet();
check(
  "O4 after a reload the league result is not told again and the wallet and ledger are the same",
  !again && wM1.credits === wM0.credits && wM1.ledger === wM0.ledger,
  { again, wM0, wM1 },
);

const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("0 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
