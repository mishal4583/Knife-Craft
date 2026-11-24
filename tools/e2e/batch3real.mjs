// Chef Pride audit remediation, Batch 3 (developer 2026-11-23), through REAL GAMEPLAY (the cutting solver plays real plates and services; restaurant build, 430x900):
//   F2  record announcements: R1 a genuine record improvement is announced on the Knife Report, is saved on Continue, and its analytics event is sent once per kind, AFTER the save;
//       R2 a retried attempt and an abandoned attempt (left through "Back to Kitchen") send NO event and change nothing in the save; the kept attempt then sends each event once;
//   F6  timing: R5 a plate with 35 s of idle time before the first cut records only the working time (a few seconds of cutting, not 35 s +), and Speed Demon is won on it;
//   F4  Zero Waste: R3 a genuinely clean day completes the dare; R4 after Throw Out Expired (pressed in the real Inventory) the same day does NOT complete it.
// Usage: node batch3real.mjs [R1 R2 R3 R4 R5]   (default all). KC_URL=http://localhost:4174/ runs the same flows on another build (the committed HEAD: its outcomes are the "before").
import {
  MOVED_IN_BUSINESS,
  boot,
  clickButton,
  launch,
  openShortcut,
  readSave,
  seedSave,
  shot,
  sleep,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";
import { driveService, eventsSeen, serviceSave, watchAnalytics } from "./servicedrive.mjs";

const args = process.argv.slice(2);
const want = new Set(args.filter((a) => /^R[1-5]$/.test(a)));
const run = (id) => want.size === 0 || want.has(id);
const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const info = (id, detail) => console.log(`INFO ${id}`, JSON.stringify(detail));
const now = new Date();
const TODAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const BASELINE = (process.env.KC_URL ?? "").includes("4174");

const { browser, page, logs } = await launch();
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
await watchAnalytics(page);

// ───────────── one plate: Level 6, one order (grapes & strawberry), played to its Knife Report ─────────────
const RECIPE = "camp-latin-grapes-strawberry";
const plateSave = (chefRecord) =>
  serviceSave({
    level: 6,
    ingredients: ["grapes", "strawberry"],
    business: { chefRecord },
    top: {
      levelProgress: {
        currentLevelId: "level-6",
        highestUnlockedLevelId: "level-6",
        completedLevelIds: Array.from({ length: 5 }, (_, i) => `level-${i + 1}`),
        campaignVersion: 4,
        tickets: { "level-6": [RECIPE] },
      },
    },
    seedSave,
    MOVED_IN_BUSINESS,
  });
const tap = async (re) => {
  const hit = await page.evaluate((src) => {
    const b = [...document.querySelectorAll("button")].find(
      (x) =>
        new RegExp(src, "i").test(x.textContent.trim().replace(/\s+/g, " ")) &&
        !x.disabled &&
        x.getBoundingClientRect().width > 0,
    );
    if (!b) return null;
    const q = b.getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  }, re.source);
  if (hit) await page.mouse.click(hit.x, hit.y);
  return !!hit;
};
const reportUp = () => page.evaluate(() => /KNIFE REPORT/i.test(document.body.innerText));
const reportLines = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="knife-report-specials"] p')].map((p) =>
      p.textContent.trim(),
    ),
  );

/** Boots, opens the service and starts cooking; waits `idleMs` BEFORE the first cut; plays to the Knife Report. Returns timestamps. */
async function toReport(save, { idleMs = 0 } = {}) {
  await boot(page, save);
  await sleep(2500);
  await tap(/^Later$/);
  await tap(/^Open for service$/);
  await sleep(1500);
  for (let i = 0; i < 8; i++) {
    if (await tap(/(Hire Server|Hire Cashier|Open restaurant)/)) await sleep(1800);
    else break;
  }
  let started = false;
  for (let i = 0; i < 30 && !started; i++) {
    started = await tap(/Start cooking/);
    if (!started) await sleep(700);
  }
  const tCook = Date.now();
  await sleep(2000 + idleMs);
  const r = await playToReport(page, {
    maxMs: 150000,
    until: () => /KNIFE REPORT/i.test(document.body.innerText),
  });
  await sleep(700);
  return {
    ok: !!r.stopped && (await reportUp()),
    tCook,
    tReport: Date.now(),
    idleMs: 2000 + idleMs,
  };
}
const recordEvents = async () =>
  (await eventsSeen(page))
    .filter((e) => e.name === "record_broken")
    .map((e) => e.data.kind)
    .sort();

// ───────────── R1: a genuine record improvement ─────────────
const LOW = { plates: 3, bestCombo: 3, fastestMs: 200000 };
if (run("R1")) {
  const t = await toReport(plateSave(LOW));
  const lines = await reportLines();
  const before = await recordEvents();
  await shot(page, "batch3-R1-knife-report");
  await tap(/^Continue$/);
  await sleep(2500);
  const s = await readSave(page);
  const after = await recordEvents();
  info("R1", {
    lines,
    eventsOnReport: before,
    eventsAfterContinue: after,
    bestCombo: s.business.chefRecord?.bestCombo,
    fastestMs: s.business.chefRecord?.fastestMs,
  });
  check("R1a the plate reached the Knife Report", t.ok);
  check(
    "R1b the Knife Report announces the real improvements (longest combo, fastest plate)",
    lines.some((l) => /Longest combo yet/.test(l)) &&
      lines.some((l) => /Fastest plate yet/.test(l)),
    lines,
  );
  if (!BASELINE) {
    check(
      "R1c nothing is sent to analytics while the report is only on screen",
      before.length === 0,
      before,
    );
    check(
      "R1d after Continue the record is SAVED (combo above the old 3, a faster plate than the old 200 s)",
      (s.business.chefRecord?.bestCombo ?? 0) > 3 &&
        (s.business.chefRecord?.fastestMs ?? 1e9) < 200000,
      s.business.chefRecord,
    );
    check(
      "R1e and only now is the event sent: exactly one per kind (combo, speed)",
      JSON.stringify(after) === JSON.stringify(["combo", "speed"]),
      after,
    );
  }
}

// ───────────── R2: a retried and an abandoned attempt ─────────────
if (run("R2")) {
  const t = await toReport(plateSave(LOW));
  const linesA = await reportLines();
  await tap(/Prepare Again/);
  await sleep(3000);
  const afterRetry = await recordEvents();
  const sRetry = await readSave(page);
  info("R2 retry", {
    reportLines: linesA,
    eventsAfterRetry: afterRetry,
    record: {
      bestCombo: sRetry.business.chefRecord?.bestCombo,
      fastestMs: sRetry.business.chefRecord?.fastestMs,
    },
  });
  check(
    "R2a attempt one reached the Knife Report (it announced records)",
    t.ok && linesA.some((l) => /yet/.test(l)),
    linesA,
  );
  if (!BASELINE) {
    check(
      "R2b retried: NO event was sent and the saved record is unchanged (combo 3, 200 s)",
      afterRetry.length === 0 &&
        sRetry.business.chefRecord?.bestCombo === 3 &&
        sRetry.business.chefRecord?.fastestMs === 200000,
      { afterRetry, record: sRetry.business.chefRecord },
    );
  } else {
    info("R2 BASELINE (HEAD) events sent for the retried attempt", afterRetry);
  }
  // the retry is played and KEPT
  const r = await playToReport(page, {
    maxMs: 150000,
    until: () => /KNIFE REPORT/i.test(document.body.innerText),
  });
  await sleep(700);
  await tap(/^Continue$/);
  await sleep(2500);
  const kept = await recordEvents();
  const sKept = await readSave(page);
  info("R2 kept", {
    events: kept,
    record: {
      bestCombo: sKept.business.chefRecord?.bestCombo,
      fastestMs: sKept.business.chefRecord?.fastestMs,
    },
  });
  if (!BASELINE)
    check(
      "R2c the kept attempt sends each event exactly once (combo, speed): not doubled by the retry",
      !!r.stopped && JSON.stringify(kept) === JSON.stringify(["combo", "speed"]),
      kept,
    );
  else info("R2 BASELINE (HEAD) events after keeping the retry", kept);

  // abandoned: leave the Knife Report through Back to Kitchen without continuing
  const t2 = await toReport(plateSave(LOW));
  await tap(/Back to Kitchen/);
  await sleep(2500);
  const ab = await recordEvents();
  const sAb = await readSave(page);
  info("R2 abandoned", {
    events: ab,
    record: {
      bestCombo: sAb.business.chefRecord?.bestCombo,
      fastestMs: sAb.business.chefRecord?.fastestMs,
    },
  });
  if (!BASELINE)
    check(
      "R2d abandoned (left the report without continuing): no event, record unchanged",
      t2.ok &&
        ab.length === 0 &&
        sAb.business.chefRecord?.bestCombo === 3 &&
        sAb.business.chefRecord?.fastestMs === 200000,
      { ab, record: sAb.business.chefRecord },
    );
}

// ───────────── R5: idle time before the first cut; Speed Demon ─────────────
if (run("R5")) {
  const IDLE = 35000;
  const speed = {
    plates: 0,
    challenge: { day: TODAY, id: "speed-demon", state: "accepted", progress: 0 },
  };
  const t = await toReport(plateSave(speed), { idleMs: IDLE });
  const lines = await reportLines();
  await shot(page, "batch3-R5-speed-demon-report");
  const wall = t.tReport - t.tCook;
  await tap(/^Continue$/);
  await sleep(2500);
  const s = await readSave(page);
  const rec = s.business.chefRecord ?? {};
  info("R5", {
    wallMsFromStartCooking: wall,
    idleBeforeFirstCutMs: t.idleMs,
    savedFastestMs: rec.fastestMs,
    daresWon: rec.daresWon,
    challenge: rec.challenge,
    lines,
  });
  check("R5a the plate reached the Knife Report after the long wait", t.ok && wall > IDLE);
  if (!BASELINE) {
    check(
      "R5b the saved plate time is the WORKING time (about the cutting only): well below the wall time and below 30 s",
      rec.fastestMs > 0 && rec.fastestMs < 30000 && rec.fastestMs < wall - IDLE + 5000,
      { fastestMs: rec.fastestMs, wall },
    );
  } else {
    info("R5 BASELINE (HEAD) saved plate time (it counts the idle time)", {
      fastestMs: rec.fastestMs,
    });
  }
  check(
    "R5c Speed Demon is won on that plate (the report said so and it is saved)",
    lines.some((l) => /Dare won: Speed Demon/.test(l)) &&
      rec.daresWon === 1 &&
      rec.challenge?.state === "won",
    { lines, daresWon: rec.daresWon, state: rec.challenge?.state },
  );
}

// ───────────── R3 / R4: Zero Waste ─────────────
const BATCH_ING = ["pepper", "onion", "corn"];
// The day's last service: two services are done, this one closes the day quietly (before Level 21) through the Zero Waste dare's own check.
const lastService = {
  day: 1,
  opened: true,
  servicesDone: 2,
  servicesPlanned: 3,
  closingDue: false,
  openingCredits: 1,
  openingLevel: 12,
  // the two fridge chores (their own mini-game; points only, they never remove stock) are already done tonight; the hired Cleaner does the rest
  closingDone: ["spoiled-out", "wrap-fridge"],
};
const zeroWasteDare = {
  plates: 0,
  challenge: { day: TODAY, id: "zero-waste", state: "accepted", progress: 0 },
};
const fridge = (expired) => ({
  ...Object.fromEntries(
    BATCH_ING.map((id) => [id, { ingredientId: id, quantity: 24, unitCost: 100, purchaseDay: 7 }]),
  ),
  ...(expired
    ? { basil: { ingredientId: "basil", quantity: 3, unitCost: 100, purchaseDay: 1 } }
    : {}),
});
const daySave = (expired) =>
  serviceSave({
    level: 12,
    ingredients: BATCH_ING,
    business: { chefRecord: zeroWasteDare, restaurantDay: lastService, inventory: fridge(expired) },
    seedSave,
    MOVED_IN_BUSINESS,
  });
if (run("R3")) {
  await boot(page, daySave(false));
  await sleep(2500);
  const r = await driveService(page, { maxMs: 600000, closeDay: true });
  await sleep(2500);
  const s = await readSave(page);
  const rec = s.business.chefRecord ?? {};
  info("R3", {
    ok: r.ok,
    day: s.business.restaurantDay?.day,
    daresWon: rec.daresWon,
    state: rec.challenge?.state,
    spoiled: s.business.spoilage,
  });
  check(
    "R3a the service was played and the day closed (Day 2)",
    r.ok && s.business.restaurantDay?.day === 2,
    { ok: r.ok, day: s.business.restaurantDay?.day },
  );
  check(
    "R3b a genuinely clean day completes Zero Waste (saved: dare won, daresWon 1)",
    rec.daresWon === 1 && rec.challenge?.state === "won",
    { daresWon: rec.daresWon, state: rec.challenge?.state },
  );
}
if (run("R4")) {
  await boot(page, daySave(true));
  await sleep(2500);
  // the player throws the spoiled basil out in the REAL Inventory before closing
  await openShortcut(page, "inventory");
  await sleep(1200);
  await page.evaluate(() =>
    document.querySelector('[data-testid="throw-out-expired"] button')?.click(),
  );
  await sleep(500);
  await clickButton(page, /^Yes, throw out$/);
  await sleep(1200);
  const mid = await readSave(page);
  await shot(page, "batch3-R4-inventory-after-throw-out");
  await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
  await sleep(1200);
  const r = await driveService(page, { maxMs: 600000, closeDay: true });
  await sleep(2500);
  const s = await readSave(page);
  const rec = s.business.chefRecord ?? {};
  info("R4", {
    thrownOutToday: mid.business.finance?.dailyAccumulator?.discardedQuantity,
    basilLeft: !!mid.business.inventory.basil,
    ok: r.ok,
    day: s.business.restaurantDay?.day,
    daresWon: rec.daresWon,
    state: rec.challenge?.state,
  });
  check(
    "R4a the spoiled basil was really thrown out first (3 units discarded today, none left)",
    mid.business.finance?.dailyAccumulator?.discardedQuantity === 3 &&
      !mid.business.inventory.basil,
    { discarded: mid.business.finance?.dailyAccumulator?.discardedQuantity },
  );
  check(
    "R4b the service was played and the day closed (Day 2)",
    r.ok && s.business.restaurantDay?.day === 2,
    { ok: r.ok, day: s.business.restaurantDay?.day },
  );
  if (!BASELINE)
    check(
      "R4c Throw Out Expired does NOT win Zero Waste: no win, nothing saved as won",
      (rec.daresWon ?? 0) === 0 && rec.challenge?.state !== "won",
      { daresWon: rec.daresWon, state: rec.challenge?.state },
    );
  else
    info("R4 BASELINE (HEAD): the loophole", {
      daresWon: rec.daresWon,
      state: rec.challenge?.state,
    });
}

const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("0 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
