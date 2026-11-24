/**
 * SHIFT RECOGNITION QA (Chef Pride audit remediation, Batch 2, developer 2026-11-23): the Level Complete "shift card" tells only what really happened.
 *
 *  A  performance tiers: boundaries on the game's grade ladder, "Excellent Work, Chef!" at 85-94, no tier for a service with no plate, bad input safe;
 *  B  waste is READ from the fridge: not tracked before the freshness level (null: nothing is claimed, not even a zero), genuine zero ONLY when the spoilage
 *     data is exactly zero, one or more spoiled ingredients named, a fraction of a unit still counts, stock thrown out earlier today counts, fresh stock is not waste;
 *  C  old saves and missing optional statistics never throw and never invent a number;
 *  D  improvements are real: perfect cuts in a service only beat a real earlier mark; a first service reports nothing; dare progress only for a dare under way;
 *  E  purity: the rule file has no wallet, ledger, clock, random, bridge or storage; its lines make no population claim and no insult;
 *  F  wiring: the card is built ONLY on a first completion of a campaign service in the restaurant build (so daily, endless, batch replays and the Business
 *     service never show one and never send its events), once per service, the banner shows the tier / the wasted tile / the notes, no duplicate analytics,
 *     no new top-level save field, no economy file touched.
 *
 * Run: npx tsx scripts/shift-recognition-qa.mts
 */
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { addStock } from "../src/game/business/businessInventory.ts";
import { discardExpiredStock, withoutExpiredOf } from "../src/game/business/discardExpired.ts";
import { clearExpiredStock } from "../src/game/business/SpoilageManager.ts";
import { DEFAULT_CHEF_RECORD, recordService } from "../src/game/restaurant/chefRecord.ts";
import {
  EMPTY_SHIFT_TALLY,
  dayIsWasteFree,
  isZeroWaste,
  perfectsNews,
  shiftDare,
  shiftNotes,
  shiftService,
  shiftStats,
  shiftTier,
  shiftWaste,
  tallyPlate,
  tallyRun,
  type ShiftCard,
  wasteNote,
  wasteTile,
} from "../src/game/restaurant/shiftRecognition.ts";
import {
  advanceDareOnDay,
  takeDare,
  type DareView,
} from "../src/game/restaurant/skillChallenges.ts";
import { DEFAULT_CHEF_RECORD } from "../src/game/restaurant/chefRecord.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("      ", JSON.stringify(detail));
  }
}
const read = (f: string) => fs.readFileSync(path.resolve(f), "utf8");

const LIVE = 36; // the fridge-and-freshness stage is live
const NOT_YET = 8; // before it
const today = DEFAULT_SAVE.business.calendar.businessDay;
const withStock = (inventory: SaveData["business"]["inventory"], discarded = 0): SaveData => ({
  ...DEFAULT_SAVE,
  business: {
    ...DEFAULT_SAVE.business,
    inventory,
    finance: {
      ...DEFAULT_SAVE.business.finance,
      dailyAccumulator: {
        ...DEFAULT_SAVE.business.finance.dailyAccumulator,
        discardedQuantity: discarded,
      },
    },
  },
});

console.log("A. Performance tiers");
{
  const t = (accuracy: number, orders = 3) => shiftTier({ orders, accuracy })?.id ?? null;
  assert(
    t(100) === "masterful" && t(95) === "masterful" && t(94) === "excellent",
    "A1: 95+ Masterful, 94 Excellent",
  );
  assert(t(85) === "excellent" && t(84) === "good", "A2: 85 is Excellent Work, Chef!; 84 is Good");
  assert(t(70) === "good" && t(69) === "steady" && t(50) === "steady", "A3: 70 Good, 69-50 Steady");
  assert(
    t(49) === "learning" && t(0) === "learning",
    "A4: under 50 is a warm 'Every Shift Teaches'",
  );
  assert(
    shiftTier({ orders: 3, accuracy: 90 })?.title === "Excellent Work, Chef!",
    "A5: the wording",
  );
  assert(shiftTier({ orders: 0, accuracy: 100 }) === null, "A6: no plate served, no tier");
  assert(
    shiftTier({ orders: 2, accuracy: Number.NaN })?.id === "learning" &&
      shiftTier({ orders: Number.NaN, accuracy: 90 }) === null,
    "A7: bad numbers are safe (never a better tier than the data)",
  );
}

console.log("B. Waste is read from the fridge");
{
  const expired = addStock({}, "basil", 2, 180, today - 3);
  assert(
    shiftWaste(withStock(expired), NOT_YET) === null &&
      wasteTile(null) === null &&
      wasteNote(null) === null &&
      isZeroWaste(null) === false,
    "B1: before the freshness level nothing is tracked: no tile, no note, and null is NOT zero waste",
  );
  const clean = shiftWaste(withStock({}), LIVE);
  assert(
    clean?.quantity === 0 &&
      isZeroWaste(clean) &&
      wasteTile(clean)?.value === "0" &&
      wasteTile(clean)?.label === "Wasted" &&
      /Zero waste/.test(wasteNote(clean) ?? ""),
    "B2: a genuinely empty-of-spoilage fridge reads exactly zero and says Zero waste",
    clean,
  );
  const fresh = shiftWaste(withStock(addStock({}, "basil", 2, 180, today)), LIVE);
  assert(isZeroWaste(fresh), "B3: stock bought today is fresh, not waste", fresh);
  const bad = shiftWaste(withStock(expired), LIVE);
  assert(
    bad?.quantity === 2 &&
      !isZeroWaste(bad) &&
      bad?.names.join() === "Basil" &&
      wasteTile(bad)?.value === "2" &&
      /Spoiled: Basil/.test(wasteNote(bad) ?? "") &&
      !/Zero waste/.test(wasteNote(bad) ?? ""),
    "B4: one spoiled ingredient is named and is never called zero waste",
    bad,
  );
  const two = shiftWaste(
    withStock({
      ...addStock({}, "basil", 2, 180, today - 3),
      ...addStock({}, "tomato", 3, 90, today - 8),
    }),
    LIVE,
  );
  assert(
    two?.names.length === 2 && two.quantity === 5 && /Spoiled: .*, /.test(wasteNote(two) ?? ""),
    "B5: several spoiled ingredients are all named and counted",
    two,
  );
  const frac = shiftWaste(withStock(addStock({}, "basil", 0.3, 180, today - 3)), LIVE);
  assert(
    frac?.quantity === 1 && !isZeroWaste(frac),
    "B6: a fraction of a unit still spoiled something: never rounded down to zero",
    frac,
  );
  const earlier = shiftWaste(withStock({}, 3), LIVE);
  assert(
    earlier?.quantity === 3 &&
      earlier.thrownOutEarlier &&
      !isZeroWaste(earlier) &&
      /Thrown out earlier today/.test(wasteNote(earlier) ?? ""),
    "B7: stock thrown out earlier today counts (Throw Out Expired cannot make a shift 'zero waste')",
    earlier,
  );
  const both = shiftWaste(withStock(expired, 3), LIVE);
  assert(both?.quantity === 5, "B8: expired now + thrown out earlier add up", both);
}

console.log("B2. The card's tiles and lines");
{
  const card = (waste: ShiftCard["waste"], extra: Partial<ShiftCard> = {}): ShiftCard => ({
    orders: 4,
    accuracy: 91,
    perfects: 7,
    cook: false,
    news: [],
    tier: shiftTier({ orders: 4, accuracy: 91 }),
    waste,
    dare: null,
    ...extra,
  });
  const labels = (c: ShiftCard) =>
    shiftStats(c)
      .map((s) => s.label)
      .join();
  assert(
    labels(card(null)) === "Orders,Accuracy,Perfects" && shiftNotes(card(null)).length === 0,
    "B9: spoilage not tracked: three tiles and no waste line (no claim either way)",
  );
  const zeroCard = card(shiftWaste(withStock({}), LIVE));
  assert(
    labels(zeroCard) === "Orders,Accuracy,Perfects,Wasted" &&
      shiftStats(zeroCard)[3]!.value === "0" &&
      shiftNotes(zeroCard).some((n) => /Zero waste/.test(n)),
    "B10: a genuine zero shows '0 Wasted' and the Zero waste line",
  );
  const spoiledCard = card(shiftWaste(withStock(addStock({}, "basil", 2, 180, today - 3)), LIVE), {
    news: ["Accuracy up from 81% to 91%"],
  });
  assert(
    shiftStats(spoiledCard)[3]!.value === "2" &&
      shiftNotes(spoiledCard)[0] === "★ Accuracy up from 81% to 91%" &&
      shiftNotes(spoiledCard).some((n) => /Spoiled: Basil/.test(n)) &&
      !shiftNotes(spoiledCard).some((n) => /Zero waste/.test(n)),
    "B11: a spoiled ingredient shows its count, its name, the real improvement, and never 'Zero waste'",
    shiftNotes(spoiledCard),
  );
  assert(
    shiftNotes(
      card(null, { dare: { title: "Perfect Chef", progress: "2 of 3 plates" } }),
    ).join() === "⚔ Dare: Perfect Chef · 2 of 3 plates",
    "B12: a dare under way shows on the card with its progress",
  );
}

console.log("C. Old saves and missing statistics");
{
  const noFinance = {
    ...DEFAULT_SAVE,
    business: { ...DEFAULT_SAVE.business, finance: undefined },
  } as unknown as SaveData;
  let ok = true;
  let w: ReturnType<typeof shiftWaste> = null;
  try {
    w = shiftWaste(noFinance, LIVE);
  } catch {
    ok = false;
  }
  assert(
    ok && w?.quantity === 0,
    "C1: a save with no finance block reads zero spoilage, no throw",
    w,
  );
  const odd = shiftWaste(withStock({}, Number.NaN), LIVE);
  const neg = shiftWaste(withStock({}, -4), LIVE);
  assert(
    odd?.quantity === 0 && neg?.quantity === 0,
    "C2: NaN and negative discards are ignored, never a negative waste",
  );
  assert(
    perfectsNews(DEFAULT_CHEF_RECORD, { orders: 3, accuracy: 90, perfects: 9 }).length === 0,
    "C3: an old save (no record yet) has nothing to beat, so no improvement is invented",
  );
  assert(shiftDare(null) === null, "C4: no dare, no dare line");
}

console.log("D. Improvements and dare progress are real");
{
  const first = recordService(DEFAULT_CHEF_RECORD, { orders: 3, accuracy: 80, perfects: 6 });
  assert(
    perfectsNews(first, { orders: 3, accuracy: 85, perfects: 7 })[0]?.text ===
      "Most perfect cuts in a service: 7",
    "D1: more perfect cuts than ever in a service is news, with the real number",
  );
  assert(
    perfectsNews(first, { orders: 3, accuracy: 85, perfects: 6 }).length === 0 &&
      perfectsNews(first, { orders: 3, accuracy: 85, perfects: 2 }).length === 0,
    "D2: an equal or lower count is not news",
  );
  const zero = recordService(DEFAULT_CHEF_RECORD, { orders: 3, accuracy: 80, perfects: 0 });
  assert(
    perfectsNews(zero, { orders: 3, accuracy: 85, perfects: 1 }).length === 0,
    "D3: beating a mark of zero is not a record",
  );
  const view = (status: DareView["status"], progress = 2): DareView =>
    ({
      dare: { id: "perfect-chef", title: "Perfect Chef", goal: 3, unit: "plates" },
      status,
      progress,
    }) as unknown as DareView;
  assert(
    shiftDare(view("accepted"))?.title === "Perfect Chef" &&
      shiftDare(view("accepted"))?.progress === "2 of 3 plates",
    "D4: a dare under way shows its real progress",
  );
  assert(
    shiftDare(view("offered")) === null &&
      shiftDare(view("won")) === null &&
      shiftDare(view("declined")) === null,
    "D5: an offered, declined or won dare adds no progress line",
  );
}

console.log("G. The shift tally (its own tally, Prep Cook honest)");
{
  const L = "level-12";
  let t = EMPTY_SHIFT_TALLY;
  t = tallyPlate(t, L, { id: "o1", score: 90 });
  t = tallyPlate(t, L, { id: "o2", score: 80 });
  t = tallyRun(t, L, { perfects: 5 });
  const s = shiftService(t, L);
  assert(
    s?.orders === 2 && s.accuracy === 85 && s.perfects === 5 && s.cook === false,
    "G1: orders, average accuracy and the hand-cut perfect cuts are exactly what was recorded",
    s,
  );
  assert(
    shiftService(tallyPlate(t, L, { id: "o1", score: 10 }), L)?.orders === 2 &&
      shiftService(tallyPlate(t, L, { id: "o1", score: 10 }), L)?.accuracy === 85,
    "G2: an order is counted once, however many times it is reported (no double counting)",
  );
  assert(
    shiftService(t, "level-13") === null && shiftService(EMPTY_SHIFT_TALLY, L) === null,
    "G3: no plate recorded for the level, no card (nothing is made up)",
  );
  const other = tallyPlate(t, "level-13", { id: "p1", score: 60 });
  assert(
    shiftService(other, L) === null && shiftService(other, "level-13")?.orders === 1,
    "G4: another level starts its own tally; the old plates never leak into it",
  );
  const bad = tallyPlate(
    tallyPlate(tallyPlate(EMPTY_SHIFT_TALLY, L, { id: "", score: 80 }), L, {
      id: "x",
      score: Number.NaN,
    }),
    L,
    { id: "y", score: 250 },
  );
  assert(
    shiftService(bad, L)?.orders === 1 && shiftService(bad, L)?.accuracy === 100,
    "G5: a plate with no id or a bad score is ignored; a score is kept inside 0-100",
  );
  // Prep Cook Auto: its plates are real (a score) but add NO perfect cuts and never a zero the player did not earn
  const cookOnly = tallyRun(
    tallyPlate(tallyPlate(EMPTY_SHIFT_TALLY, L, { id: "a", score: 75 }), L, { id: "b", score: 75 }),
    L,
    { perfects: 0, byCook: true },
  );
  const cs = shiftService(cookOnly, L);
  assert(
    cs?.orders === 2 && cs.accuracy === 75 && cs.perfects === null && cs.cook === true,
    "G6: every plate by the Prep Cook: the plates and their real score count, perfect cuts are NOT recorded (null, never 0)",
    cs,
  );
  const mixed = tallyRun(tallyRun(cookOnly, L, { perfects: 3 }), L, { perfects: 2, byCook: true });
  const ms = shiftService(mixed, L);
  assert(
    ms?.perfects === 3 && ms.cook === true,
    "G7: a mix: only the hand-cut run's perfect cuts count, and the card knows the cook worked",
    ms,
  );
  const reloaded = tallyPlate(EMPTY_SHIFT_TALLY, L, { id: "z", score: 88 });
  assert(
    shiftService(reloaded, L)?.perfects === null,
    "G8: plates with no run stats (a reload mid-service) show no perfect-cut number rather than a false zero",
  );
  const card = (perfects: number | null, cook: boolean): ShiftCard => ({
    orders: 2,
    accuracy: 75,
    perfects,
    cook,
    news: [],
    tier: shiftTier({ orders: 2, accuracy: 75 }),
    waste: null,
    dare: null,
  });
  assert(
    shiftStats(card(null, true))[2]!.value === "-" &&
      shiftStats(card(0, false))[2]!.value === "0" &&
      shiftNotes(card(null, true)).some((n) => /own cuts only/.test(n)) &&
      !shiftNotes(card(4, false)).some((n) => /own cuts/.test(n)),
    "G9: the card shows a dash for 'not recorded', a real 0 as 0, and the Prep Cook note only when the cook worked",
  );
}

console.log("H. Zero Waste cannot be bypassed by throwing spoiled stock out first (audit F4)");
{
  const DAY = "2026-11-23";
  const dare = (state: "accepted" | "offered" = "accepted") => ({
    ...DEFAULT_CHEF_RECORD,
    challenge: { day: DAY, id: "zero-waste" as const, state, progress: 0 },
  });
  const wins = (save: SaveData, level = LIVE) =>
    !!advanceDareOnDay(dare(), DAY, level, { noWaste: dayIsWasteFree(save, level) }).won;
  // what the dare used to read: only the sweep at closing (the lifetime total moves by what closing throws out)
  const oldRuleSaysClean = (save: SaveData) =>
    clearExpiredStock(save.business.inventory, save.business.calendar.businessDay + 1)
      .spoiledQuantity === 0;
  const expiredBasil = (q = 2) => addStock({}, "basil", q, 180, today - 3);

  assert(
    wins(withStock({})) && wins(withStock(addStock({}, "basil", 2, 180, today))),
    "H1: a genuinely clean day completes the dare (nothing stored, or only fresh stock)",
  );
  const left = withStock(expiredBasil());
  assert(
    !wins(left) && !oldRuleSaysClean(left),
    "H2: expired stock left in the fridge until closing fails it (as before)",
  );

  const discarded = discardExpiredStock(left);
  assert(discarded.ok, "H3a: (setup) Throw Out Expired removes the expired basil");
  const afterDiscard = discarded.ok ? discarded.save : left;
  assert(
    oldRuleSaysClean(afterDiscard) === true,
    "H3b: the OLD rule would now have seen a clean fridge at closing (the loophole)",
  );
  assert(
    !wins(afterDiscard) && !dayIsWasteFree(afterDiscard, LIVE),
    "H3c: THE FIX: the day still counts what was thrown out earlier, so the dare is not won",
  );
  assert(
    (afterDiscard.business.finance.dailyAccumulator.discardedQuantity ?? 0) === 2 &&
      afterDiscard.business.spoilage.totalSpoiledQuantity === 2,
    "H3d: it reads the existing discard data (today's discards, and the lifetime totals are untouched by this calculation)",
  );
  assert(
    !wins(withoutExpiredOf(left, ["basil"])),
    "H3e: a purchase that clears old stock of what it buys counts as waste too",
  );

  // multiple discards on the same day
  const second = discardExpiredStock({
    ...afterDiscard,
    business: {
      ...afterDiscard.business,
      inventory: {
        ...afterDiscard.business.inventory,
        ...addStock({}, "tomato", 3, 90, today - 8),
      },
    },
  });
  const afterTwo = second.ok ? second.save : afterDiscard;
  assert(
    second.ok &&
      afterTwo.business.finance.dailyAccumulator.discardedQuantity === 5 &&
      shiftWaste(afterTwo, LIVE)?.quantity === 5 &&
      !wins(afterTwo),
    "H4: several discards add up (2 + 3 = 5 units) and the dare is not won",
  );
  // fractions
  const tiny = discardExpiredStock(withStock(addStock({}, "basil", 0.3, 180, today - 3)));
  assert(
    tiny.ok && !wins(tiny.save) && (shiftWaste(tiny.save, LIVE)?.quantity ?? 0) === 1,
    "H5: a fraction of a unit thrown out is still waste (never rounded down to a clean day)",
  );
  assert(
    !wins(withStock(addStock({}, "basil", 0.3, 180, today - 3))),
    "H5b: and a fraction left expired at closing is waste too",
  );
  // old or missing data
  const noFinance = {
    ...DEFAULT_SAVE,
    business: { ...DEFAULT_SAVE.business, finance: undefined, spoilage: undefined },
  } as unknown as SaveData;
  let threw = false;
  let oldWins = false;
  try {
    oldWins = wins(noFinance);
  } catch {
    threw = true;
  }
  assert(
    !threw && oldWins,
    "H6: a save with no finance or spoilage block reads as a clean day and never throws",
  );
  const noAcc = {
    ...DEFAULT_SAVE,
    business: {
      ...DEFAULT_SAVE.business,
      finance: { ...DEFAULT_SAVE.business.finance, dailyAccumulator: undefined },
    },
  } as unknown as SaveData;
  assert(
    dayIsWasteFree(noAcc, LIVE) === true,
    "H6b: a save with no daily accumulator reads as nothing discarded",
  );
  assert(
    dayIsWasteFree(afterDiscard, NOT_YET) === true,
    "H6c: before the freshness stage nothing is tracked, so nothing was wasted (as before)",
  );

  // accepting the dare AFTER already throwing stock out
  const late = takeDare(DEFAULT_CHEF_RECORD, DAY, LIVE);
  assert(
    JSON.stringify(Object.keys(late.challenge ?? {}).sort()) ===
      JSON.stringify(["day", "id", "progress", "state"]),
    "H7a: accepting records nothing about the past (no baseline field, no invented history)",
  );
  assert(
    !advanceDareOnDay(
      {
        ...DEFAULT_CHEF_RECORD,
        challenge: { day: DAY, id: "zero-waste", state: "accepted", progress: 0 },
      },
      DAY,
      LIVE,
      { noWaste: dayIsWasteFree(afterDiscard, LIVE) },
    ).won,
    "H7b: accepted after the discard, the dare cannot be won today (the day's waste is the day's waste); it still never blocks anything",
  );
  // the next day starts clean: the discards are reset with the day, so the dare can be won then
  const nextMorning = {
    ...afterDiscard,
    business: {
      ...afterDiscard.business,
      finance: {
        ...afterDiscard.business.finance,
        dailyAccumulator: {
          ...afterDiscard.business.finance.dailyAccumulator,
          discardedQuantity: 0,
          discardedValue: 0,
        },
      },
    },
  };
  assert(
    wins(nextMorning),
    "H7c: the next day (discards reset by closing) starts clean and the dare can be won",
  );
  // the calculation is the ONE spoilage read: App's closing uses it, nothing else recomputes spoilage for the dare
  const app = read("src/App.tsx");
  const closeBody = /function closeDayDared\([^)]*\)[^{]*\{[\s\S]*?\n {2}\}\n/.exec(app)?.[0] ?? "";
  assert(
    /dayIsWasteFree\(s, level\)/.test(closeBody) && !/totalSpoiledQuantity/.test(closeBody),
    "H8: closeDayDared asks dayIsWasteFree (the shift card's own spoilage read) and no longer compares lifetime totals",
  );
  assert(
    /export const dayIsWasteFree[\s\S]*?shiftWaste\(save, levelNumber\)/.test(
      read("src/game/restaurant/shiftRecognition.ts"),
    ),
    "H9: dayIsWasteFree is built on shiftWaste: no second spoilage calculation",
  );
}

console.log("E. Purity and honest wording");
{
  const src = read("src/game/restaurant/shiftRecognition.ts");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert(
    !/credits|economyLedger|appendLedgerEntry|Date\.now|new Date|Math\.random|window\.|bridge|localStorage|fetch\(/.test(
      code,
    ),
    "E1: no wallet, ledger, clock, random, bridge, storage or network in the rule file",
  );
  const lines = [...code.matchAll(/title: "([^"]*)"|`([^`]*)`|"(♻[^"]*|🗑️[^"]*)"/g)]
    .map((m) => m[1] ?? m[2] ?? m[3] ?? "")
    .join(" | ");
  assert(
    !/\d+\s?% of (chefs|players)|only \d|stupid|idiot|loser|pathetic|useless/i.test(lines),
    "E2: no population claim and no insult in the shift wording",
  );
}

console.log("F. Wiring");
{
  const app = read("src/App.tsx");
  const complete =
    /function completeCampaignLevel\([^)]*\)[^{]*\{[\s\S]*?\n {2}\}\n/.exec(app)?.[0] ?? "";
  assert(
    // RULE CHANGE (developer 2026-11-23, batch follow-up): the card reads its OWN tally (shiftTallyRef), no longer the star rating's.
    /if \(RESTAURANT_MODE && isFirstCompletion\) \{[^\n]*\n[^\n]*\n\s*const counted = shiftService\(shiftTallyRef\.current, level\.id\);/.test(
      complete,
    ) && /shift = \{[\s\S]*?tier: shiftTier\(service\)[\s\S]*?waste: shiftWaste\(/.test(complete),
    "F1: the shift is built only on a first completion in the restaurant build, with the tier and the waste read from real data",
  );
  assert(
    (app.match(/applyService\(/g) ?? []).length === 1 &&
      (app.match(/shiftWaste\(/g) ?? []).length === 1,
    "F2: one service is recorded once and the fridge is read once per card",
  );
  const calls = [...app.matchAll(/completeCampaignLevel\(/g)].length;
  const fn = (name: string) =>
    new RegExp(`function ${name}\\([^)]*\\)[^{]*\\{[\\s\\S]*?\\n {2}\\}\\n`).exec(app)?.[0] ?? "";
  assert(
    calls >= 3 &&
      ["recordDailyResult", "recordEndlessResult", "recordBusinessServiceResult"].every(
        (n) => fn(n).length > 0 && !/shift|setLevelRewardNotice|record_broken/.test(fn(n)),
      ),
    "F3: daily, endless and Business-service results never build a shift card or send its events",
  );
  assert(
    /for \(const kind of new Set\(beaten\.map/.test(app) &&
      // RULE CHANGE (developer 2026-11-23, audit F2): the plate's record_broken moved into persist() (after its save); the service's stays here, now after ITS save. Two senders, one each.
      (app.match(/sendAnalyticsEvent\("record_broken"/g) ?? []).length === 2,
    "F4: one record_broken per KIND of record for a service (no duplicate analytics)",
  );
  const batch = fn("serveBatchGroupViewedOrder");
  assert(
    /noteShiftPlate\(levelId, viewed\.order\.id, viewed\.order\.preparationScore, false\)/.test(
      batch,
    ) && !/noteServedScore|serviceScoresRef/.test(batch),
    "F8: a served and paid batch order joins the shift tally, and the star rating's tally is NOT touched by batch serving (byte-for-byte as before)",
  );
  assert(
    /function noteServedScore\([^)]*\) \{\s*if \(isReplay \|\| typeof score !== "number"\) return;\s*const t = serviceScoresRef\.current;\s*serviceScoresRef\.current = \{\s*levelId,\s*scores: t\.levelId === levelId \? \[\.\.\.t\.scores, score\] : \[score\],\s*\};\s*\}/.test(
      app,
    ) &&
      /rateService\(\{\s*scores: tally\.levelId === level\.id \? tally\.scores : \[\],/.test(app),
    "F9: the star rating still reads serviceScoresRef through the unchanged noteServedScore",
  );
  assert(
    !/shiftTallyRef/.test(/const rated = rateService\([\s\S]*?\}\);/.exec(app)?.[0] ?? "x") &&
      /shiftTallyRef\.current = EMPTY_SHIFT_TALLY/.test(complete),
    "F10: the shift tally feeds only the card, and it is emptied once the card is made (no second card from the same plates)",
  );
  assert(
    /byCook: true/.test(read("src/components/kc/game/Preparation.tsx")) &&
      /setPreparedBy\("player"\)/.test(read("src/components/kc/game/Preparation.tsx")),
    "F11: Preparation tells the tally which runs were the Prep Cook's (and a replayed plate is the player's again)",
  );
  const dash = read("src/components/kc/business/BusinessDashboard.tsx");
  assert(
    /result\.spoiledQuantity === 0 \?[\s\S]*?data-testid="day-zero-waste"/.test(dash) &&
      /formatQuantity\(result\.spoiledQuantity\)\} units · \$\{formatUsd\(result\.spoiledValue\)\}/.test(
        dash,
      ),
    "F12: End Business Day shows ZERO WASTE only for an exactly-zero day total, otherwise the unchanged units and dollars",
  );
  const banner = read("src/components/kc/story/MilestoneBanner.tsx");
  assert(
    /data-testid="banner-tier"/.test(banner) &&
      /stats\.length >= 4 \? "grid-cols-2 min-\[400px\]:grid-cols-4"/.test(banner),
    "F5: the banner shows the tier and lays four tiles out two by two on a narrow phone",
  );
  assert(
    /stats: shiftStats\(levelRewardNotice\.shift\)/.test(app) &&
      /shiftNotes\(levelRewardNotice\.shift\)/.test(app),
    "F6: the tiles and the lines on the card come from the shift's own value (shiftStats / shiftNotes)",
  );
  const types = read("src/game/business/businessTypes.ts");
  assert(
    !/shift|waste/i.test(
      (types.match(/chefRecord\?:[^;]*;/)?.[0] ?? "") + (types.match(/spoilage:[^;]*;/)?.[0] ?? ""),
    ) && !/shiftRecognition/.test(read("src/game/SaveManager.ts")),
    "F7: nothing new is saved (the card is derived; no new field, no save-manager change)",
  );
}

console.log(
  failures === 0
    ? "\nSHIFT RECOGNITION QA: ALL PASS"
    : `\nSHIFT RECOGNITION QA: ${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
