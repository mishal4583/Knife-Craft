// Chef Pride audit remediation, Batch 2 follow-up (developer 2026-11-23): the Level Complete SHIFT CARD and the End Business Day ZERO WASTE, through REAL GAMEPLAY:
// the cutting solver plays whole services (tools/e2e/servicedrive.mjs), and the card is read the moment it appears. Restaurant build, 430x900 (the solver's board).
//   A  early campaign service (Level 5, two pool orders, before freshness is tracked): Orders 2, real accuracy, perfects equal to the record's, THREE tiles and NO waste
//      line or zero claim; the record counts the service once; one card, one completion reward;
//   B  a BATCH service (Level 12, two orders served from one shared prep): the card exists (it did not before), Orders 2, genuine zero waste ("0 WASTED", "Zero waste"),
//      and the star line still says "Dishes -" (batch star ratings are exactly as before: the shift tally is separate);
//   C  the same batch service with 3 units of expired basil in the fridge: "3 WASTED", "Spoiled: Basil", and never "Zero waste";
//   D  a freshness-enabled POOL service (Level 14, two orders) with genuine zero waste, and a deterministic improvement line (seeded earlier mark);
//   E  the hired Prep Cook on AUTO (Level 32): every plate is the cook's, so Perfects is "-" (not a made-up 0) with the note, accuracy is the cook's real 75%;
//   F  the batch star line and the saved service result are identical on the committed build (HEAD, port 4174) and on this build (4173);
//   G  End Business Day (the Endless Restaurant): a clean day shows "ZERO WASTE"; a day with expired stock shows its units and dollars and NO zero claim; so does a
//      day where stock was thrown out earlier (Throw Out Expired).
// Every card is also checked for: one card only, the record's service count +1, exactly one completion-reward entry, no duplicate analytics, the card inside the screen.
// Usage: node shiftreal.mjs [A B C D E F G]   (default: all)   KC_URL=... to point at another build.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MOVED_IN_BUSINESS,
  OUT,
  boot,
  clickButton,
  launch,
  openShortcut,
  readSave,
  seedSave,
  shot,
  sleep,
} from "./harness.mjs";
import {
  bannerSeen,
  driveService,
  eventsSeen,
  serviceSave,
  watchAnalytics,
  watchBanner,
} from "./servicedrive.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const JSON_MODE = args.includes("--json");
const want = new Set(args.filter((a) => /^[A-G]$/.test(a)));
const run = (id) => want.size === 0 || want.has(id);

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  if (!JSON_MODE)
    console.log(
      `${ok ? "PASS" : "FAIL"} ${id}`,
      detail === undefined ? "" : JSON.stringify(detail),
    );
};
const tier = (a) =>
  a >= 95
    ? "A Masterful Shift!"
    : a >= 85
      ? "Excellent Work, Chef!"
      : a >= 70
        ? "Good Shift, Chef"
        : a >= 50
          ? "Steady Hands, Chef"
          : "Every Shift Teaches";
const num = (t) => Number(String(t).match(/-?\d+/)?.[0]);

const { browser, page, logs } = await launch();
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
await watchBanner(page);
await watchAnalytics(page);

/** Boots `save`, plays the service for real, returns the card, the save after, the events and the ledger delta. */
async function play(name, save, { shotName, drive = {} } = {}) {
  await boot(page, save);
  await sleep(2500);
  const before = await readSave(page);
  const r = await driveService(page, { maxMs: 600000, ...drive });
  const banners0 = await bannerSeen(page);
  if (shotName) await shot(page, shotName);
  // the same card must not appear twice (nor a second one from the same plates): watch a little longer, and read the save after
  await sleep(5500);
  const banners = await bannerSeen(page);
  const after = await readSave(page);
  const events = await eventsSeen(page);
  return {
    name,
    ok: r.ok,
    steps: r.steps,
    card: banners0[0] ?? null,
    banners: banners.length,
    before,
    after,
    events,
  };
}

const rewardEntries = (s) =>
  s.economyLedger.filter((e) => e.category === "completion-reward").length;
const common = (id, p, expectOrders) => {
  const { card, before, after } = p;
  check(`${id}1 the service was played to its Level Complete card`, p.ok && !!card, {
    ok: p.ok,
    steps: p.steps.length,
  });
  if (!card) return;
  check(`${id}2 exactly ONE card appeared (no duplicate)`, p.banners === 1, p.banners);
  check(
    `${id}3 the record counted the service once and every plate once`,
    (after.business.chefRecord?.services ?? 0) - (before.business.chefRecord?.services ?? 0) ===
      1 &&
      (after.business.chefRecord?.plates ?? 0) - (before.business.chefRecord?.plates ?? 0) >= 1,
    { services: after.business.chefRecord?.services, plates: after.business.chefRecord?.plates },
  );
  check(
    `${id}4 one completion-reward entry for the level (no extra reward, no duplicate)`,
    rewardEntries(after) - rewardEntries(before) === 1,
    { before: rewardEntries(before), after: rewardEntries(after) },
  );
  const rb = p.events.filter((e) => e.name === "record_broken").map((e) => e.data.kind);
  check(`${id}5 no analytics event is sent twice for the card`, new Set(rb).size === rb.length, rb);
  check(
    `${id}6 the card fits the screen and no tile label is cut`,
    card.box[0] >= 0 &&
      card.box[1] <= card.box[2] &&
      card.box[3] >= 0 &&
      card.box[4] <= card.box[5] &&
      !card.cutTile &&
      card.overflowX <= 0,
    card.box,
  );
  const orders = num(card.tiles[0]);
  const accuracy = num(card.tiles[1]);
  check(`${id}7 Orders is the number really served (${expectOrders})`, orders === expectOrders, {
    tiles: card.tiles,
  });
  check(
    `${id}8 the tier follows the card's own accuracy (${accuracy}% -> ${tier(accuracy)})`,
    (card.tier ?? "").includes(tier(accuracy)),
    card.tier,
  );
  check(
    `${id}9 the record's last service accuracy is the card's accuracy`,
    after.business.chefRecord?.lastServiceAccuracy === accuracy,
    {
      card: accuracy,
      record: after.business.chefRecord?.lastServiceAccuracy,
    },
  );
};

const IMPROVE = { chefRecord: { services: 1, bestServiceAccuracy: 1, lastServiceAccuracy: 1 } };
const data = {};

// ───────────────────────── A: early campaign service (no freshness yet) ─────────────────────────
if (run("A")) {
  const p = await play(
    "A",
    serviceSave({
      level: 5,
      ingredients: ["bread", "mushroom", "garlic", "baguette", "tomato"],
      business: IMPROVE,
      seedSave,
      MOVED_IN_BUSINESS,
    }),
    { shotName: "shiftreal-A-early-L5" },
  );
  common("A", p, 2);
  const c = p.card;
  if (c) {
    const handPerfects = (p.after.business.chefRecord?.perfectCuts ?? 0) - 0;
    check(
      "A11 Orders 2, accuracy, perfects: three tiles, no 'Wasted' tile",
      c.tiles.length === 3 && num(c.tiles[0]) === 2 && !c.tiles.some((t) => /WASTED/.test(t)),
      c.tiles,
    );
    check(
      "A12 the Perfects tile equals the perfect cuts the record gained",
      num(c.tiles[2]) === handPerfects,
      { tile: c.tiles[2], record: handPerfects },
    );
    check(
      "A13 freshness is not tracked yet: no waste line, no 'Zero waste' claim",
      !c.notes.some((n) => /waste|Spoiled/i.test(n)),
      c.notes,
    );
    check(
      "A14 a real improvement is named (seeded earlier mark of 1%)",
      c.notes.some((n) => /most accurate service yet|Accuracy up/i.test(n)),
      c.notes,
    );
    check(
      "A15 the existing recognition is still on the card (spotless service, best prep)",
      c.notes.some((n) => /Spotless service/.test(n)) && c.notes.some((n) => /Best prep/.test(n)),
      c.notes,
    );
  }
}

// ───────────────────────── B / C: a batch service, clean and with spoiled basil ─────────────────────────
const BATCH_ING = ["pepper", "onion", "corn"];
if (run("B")) {
  const p = await play(
    "B",
    serviceSave({ level: 12, ingredients: BATCH_ING, seedSave, MOVED_IN_BUSINESS }),
    { shotName: "shiftreal-B-batch-L12" },
  );
  common("B", p, 2);
  const c = p.card;
  data.B = p;
  if (c) {
    check(
      "B11 the batch card exists: Orders 2 (two batch orders served), four tiles",
      c.tiles.length === 4 && num(c.tiles[0]) === 2,
      c.tiles,
    );
    check(
      "B12 genuine zero waste: '0 WASTED' and the Zero waste line",
      c.tiles.some((t) => /^0 WASTED$/.test(t)) && c.notes.some((n) => /Zero waste/.test(n)),
      { tiles: c.tiles, notes: c.notes },
    );
    check(
      "B13 the batch star line is as before: dishes are not rated ('Dishes -')",
      c.notes.some((n) => /Service .*Dishes [–-]/.test(n)),
      c.notes,
    );
    const res = p.after.business.restaurantDay?.serviceResults?.at(-1);
    check(
      "B14 the saved batch service result has no dish points (null), exactly as before",
      res && (res.dishes === null || res.dishes === undefined),
      res,
    );
  }
}
if (run("C")) {
  const p = await play(
    "C",
    serviceSave({
      level: 12,
      ingredients: BATCH_ING,
      business: {
        inventory: {
          ...Object.fromEntries(
            BATCH_ING.map((id) => [
              id,
              { ingredientId: id, quantity: 24, unitCost: 100, purchaseDay: 7 },
            ]),
          ),
          basil: { ingredientId: "basil", quantity: 3, unitCost: 100, purchaseDay: 1 },
        },
      },
      seedSave,
      MOVED_IN_BUSINESS,
    }),
    { shotName: "shiftreal-C-spoiled-L12" },
  );
  common("C", p, 2);
  const c = p.card;
  if (c) {
    check(
      "C11 actual spoilage: '3 WASTED' and the ingredient is NAMED",
      c.tiles.some((t) => /^3 WASTED$/.test(t)) && c.notes.some((n) => /Spoiled: Basil/.test(n)),
      { tiles: c.tiles, notes: c.notes },
    );
    check(
      "C12 never 'Zero waste' over spoiled stock",
      !c.notes.some((n) => /Zero waste/.test(n)) && !c.tiles.some((t) => /^0 WASTED$/.test(t)),
      c.notes,
    );
  }
}

// ───────────────────────── D: a freshness-enabled pool service ─────────────────────────
if (run("D")) {
  const p = await play(
    "D",
    serviceSave({
      level: 14,
      ingredients: ["carrot", "pepper", "cucumber", "zucchini", "fennel", "lemon"],
      business: IMPROVE,
      seedSave,
      MOVED_IN_BUSINESS,
    }),
    { shotName: "shiftreal-D-pool-L14" },
  );
  common("D", p, 2);
  const c = p.card;
  if (c) {
    check(
      "D11 pool service with freshness: four tiles, '0 WASTED' and the Zero waste line",
      c.tiles.length === 4 &&
        c.tiles.some((t) => /^0 WASTED$/.test(t)) &&
        c.notes.some((n) => /Zero waste/.test(n)),
      { tiles: c.tiles, notes: c.notes },
    );
    check(
      "D12 the real improvement is shown against the seeded mark",
      c.notes.some((n) => /most accurate service yet|Accuracy up/i.test(n)),
      c.notes,
    );
    const res = p.after.business.restaurantDay?.serviceResults?.at(-1);
    check(
      "D13 a pool service's star result still rates its dishes (the star tally is intact)",
      res && typeof res.dishes === "number",
      res,
    );
  }
}

// ───────────────────────── E: the hired Prep Cook cuts the plate ─────────────────────────
const COOK = {
  level: 32,
  ingredients: ["garlic", "ginger"],
  business: { staff: { hiredRoles: ["server", "cashier", "prep-cook"] } },
  seedSave,
  MOVED_IN_BUSINESS,
};
if (run("E")) {
  const p = await play("E", serviceSave({ ...COOK, top: { settings: { autoService: false } } }), {
    shotName: "shiftreal-E-prepcook-L32",
    drive: { cook: true },
  });
  common("E", p, 1);
  const c = p.card;
  const hand = p.steps.filter((s) => s === "cut").length;
  if (c) {
    check(
      "E11 the Prep Cook cut the plate (his button was used, nothing was cut by hand)",
      hand === 0 && p.steps.includes("prep-cook"),
      { steps: p.steps },
    );
    check(
      "E12 Perfects shows '-' (not recorded), never an invented 0",
      /^-\s*PERFECTS$/.test(c.tiles[2]),
      c.tiles,
    );
    check(
      "E13 the card says the perfect cuts are the player's own",
      c.notes.some((n) => /own cuts only/.test(n)),
      c.notes,
    );
    check(
      "E14 accuracy is the Prep Cook's real plate score (75%), tier 'Good Shift, Chef'",
      num(c.tiles[1]) === 75 && /Good Shift/.test(c.tier ?? ""),
      { tiles: c.tiles, tier: c.tier },
    );
    check(
      "E15 the record gained the plate and no perfect cut from it",
      p.after.business.chefRecord?.plates === 1 &&
        (p.after.business.chefRecord?.perfectCuts ?? 0) === 0,
      p.after.business.chefRecord,
    );
  }
}
if (run("E")) {
  // Auto ON (the Prep Cook cuts, serves and moves on by himself).
  // RULE CHANGE (developer 2026-11-24, "Prep Cook Auto Persistence and Payment Fix"): this used to assert that NO card is made, because Auto's serve ran from a timer's older copy of the
  // save and the plate never reached the shift tally (the defect, see tools/e2e/autoservice.mjs and docs/planning/PREP-COOK-AUTO-FIX-2026-11-24.md). With the fix Auto records its
  // plates exactly like the Prep Cook's button does, so the card must now appear and say the same things as the by-hand cook's (E1 to E15).
  const p = await play("E2", serviceSave({ ...COOK, top: { settings: { autoService: true } } }), {
    drive: { auto: true, maxMs: 150000 },
  });
  common("E2", p, 1);
  const c = p.card;
  check(
    "E21 Auto on: the card exists and reads like the by-hand Prep Cook's (Perfects '-', accuracy 75%, tier 'Good Shift, Chef'), one plate recorded",
    !!c &&
      /^-\s*PERFECTS$/.test(c.tiles[2]) &&
      num(c.tiles[1]) === 75 &&
      /Good Shift/.test(c.tier ?? "") &&
      p.after.business.chefRecord?.plates === 1,
    { card: c, plates: p.after.business.chefRecord?.plates },
  );
}

// ───────────────────────── F: batch star ratings, this build against HEAD ─────────────────────────
if (run("F")) {
  const mine =
    data.B ??
    (await play(
      "B",
      serviceSave({ level: 12, ingredients: BATCH_ING, seedSave, MOVED_IN_BUSINESS }),
    ));
  const pick = (p) => {
    const r = p.after.business.restaurantDay?.serviceResults?.at(-1) ?? null;
    return {
      stars: r?.stars ?? null,
      dishes: r?.dishes ?? null,
      waits: r?.waits ?? null,
      clean: r?.clean ?? null,
      covers: r?.covers ?? null,
      walkedOut: r?.walkedOut ?? null,
      starLine: p.card?.notes.find((n) => /^⭐ Service/.test(n)) ?? null,
    };
  };
  const a = pick(mine);
  if (JSON_MODE) {
    console.log("STARS " + JSON.stringify(a));
  } else {
    const out = spawnSync(process.execPath, [path.join(HERE, "shiftreal.mjs"), "F", "--json"], {
      env: { ...process.env, KC_URL: "http://localhost:4174/" },
      encoding: "utf8",
    });
    const line = (out.stdout ?? "").split("\n").find((l) => l.startsWith("STARS "));
    const b = line ? JSON.parse(line.slice(6)) : null;
    check(
      "F1 the committed build (HEAD, :4174) played the same batch service",
      !!b && b.stars !== null,
      b,
    );
    // Audit Batch 5 (2026-11-24): on the committed build a BATCH service shows no Level Complete card at all (Batch 2 added it), so there is no star line to compare there. The
    // star CALCULATION is compared through what the game saves for the service (stars, dishes, waits, clean, covers, walked out), which must be identical; the new card's star line
    // must then agree with that same saved result.
    const rating = ({ stars, dishes, waits, clean, covers, walkedOut }) => ({
      stars,
      dishes,
      waits,
      clean,
      covers,
      walkedOut,
    });
    check(
      "F2 batch star rating: stars, dishes, waits, clean, covers and walked out as SAVED are IDENTICAL on HEAD and on this build",
      !!b && JSON.stringify(rating(a)) === JSON.stringify(rating(b)),
      { head: b && rating(b), now: rating(a) },
    );
    check(
      "F3 the star line on this build's new card says what was saved (5 stars, dishes not rated, clean), and HEAD had no card to compare",
      !!a.starLine &&
        new RegExp(`${"★".repeat(a.stars)}(?!★)`).test(a.starLine) &&
        /Dishes –/.test(a.starLine) === (a.dishes === null) &&
        /Clean ✓/.test(a.starLine) === (a.clean === 1) &&
        b?.starLine === null,
      { now: a.starLine, headLine: b?.starLine ?? null },
    );
  }
}

// ───────────────────────── G: End Business Day, zero waste or not ─────────────────────────
async function endDay(save, name) {
  await boot(page, save);
  await sleep(2500);
  await openShortcut(page, "business");
  await sleep(1500);
  await clickButton(page, /End Business Day/);
  await sleep(1500);
  await shot(page, name);
  return page.evaluate(() => ({
    zero: document.querySelector('[data-testid="day-zero-waste"]')?.innerText ?? null,
    spoiled: document.querySelector('[data-testid="day-spoiled"]')?.innerText ?? null,
  }));
}
if (run("G")) {
  const campaignDone = {
    currentLevelId: "level-150",
    highestUnlockedLevelId: "level-150",
    completedLevelIds: Array.from({ length: 150 }, (_, i) => `level-${i + 1}`),
  };
  const DAY = 7;
  const stock = (extra = {}) => ({
    garlic: { ingredientId: "garlic", quantity: 4, unitCost: 100, purchaseDay: DAY },
    ...extra,
  });
  const biz = (inventory, acc = {}) => ({
    ...MOVED_IN_BUSINESS,
    assistant: { hired: true, seen: [], tipsOff: true },
    calendar: { businessDay: DAY },
    inventory,
    ...(acc.discardedQuantity ? { finance: { dailyAccumulator: acc } } : {}),
  });
  const mk = (b) =>
    seedSave({
      version: 2,
      credits: 50_000,
      levelProgress: campaignDone,
      story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
      business: b,
    });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const clean = await endDay(mk(biz(stock())), "shiftreal-G-zero-waste");
  check(
    "G1 a clean day shows ZERO WASTE and no spoiled units",
    !!clean.zero && /zero waste/i.test(clean.zero) && clean.spoiled === null,
    clean,
  );
  const spoiled = await endDay(
    mk(
      biz(stock({ basil: { ingredientId: "basil", quantity: 3, unitCost: 100, purchaseDay: 1 } })),
    ),
    "shiftreal-G-spoiled",
  );
  check(
    "G2 a day with expired stock shows its units and dollars and NO zero claim",
    spoiled.zero === null && /3.*units.*\$/.test(spoiled.spoiled ?? ""),
    spoiled,
  );
  const earlier = await endDay(
    mk({
      ...biz(stock()),
      finance: {
        dailyAccumulator: {
          revenue: 0,
          cogs: 0,
          inventoryPurchaseCost: 0,
          maintenanceCost: 0,
          supplierCost: 0,
          capitalExpenditure: 0,
          packagingPurchaseCost: 0,
          ordersServed: 0,
          inventoryPurchases: 0,
          discardedQuantity: 2,
          discardedValue: 200,
        },
      },
    }),
    "shiftreal-G-discarded-earlier",
  );
  check(
    "G3 stock thrown out earlier today is included: no zero claim, its units shown",
    earlier.zero === null && /2.*units/.test(earlier.spoiled ?? ""),
    earlier,
  );
}

const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("0 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
if (!JSON_MODE) console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(JSON_MODE ? 0 : failed.length ? 1 : 0);
