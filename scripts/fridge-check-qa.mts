/**
 * FRIDGE CHECK QA (developer 2026-11-06): the rules of the closing-night inspection, restaurant/fridgeCheck.ts.
 *   A  the five tiers follow the freshness stage and full operation; the game opens only when freshness is live and there is something to judge
 *   B  the cards are the REAL stock, judged for tomorrow: the verdicts equal what `closingPreview` says closing throws out
 *   C  the deck: capped by tier, the spoiled ones are never left out, the order is seeded (same night = same deck)
 *   D  tier 1 has two piles (near-expiry food is kept), the later tiers three (near-expiry = use first)
 *   E  wrap: the food that stays, soonest use-by first (ties in any order), the sticker words
 *   F  the clock, points, combo and stars (a spoiled card kept counts double)
 *   G  finishing a stage: best / stars / pins / streak, Hype once a night per stage, practice changes nothing
 *   H  the cleanliness action "check": completes ITS chore only, a second call pays nothing, and credits / inventory / supplies / ledger never change
 *   I  saves: old saves, garbage and a JSON round trip
 *   J  no randomness and no wallet in the rules file; wiring and art files
 * Prints a line per check and exits 1 on any failure.
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { secondFloorOf } from "../src/game/restaurant/secondFloor.ts";
import { HYPE_BY_STARS } from "../src/game/business/fridgeSort.ts";
import { closingPreview } from "../src/game/restaurant/restaurantDay.ts";
import { restaurantSystem } from "../src/game/restaurant/restaurantProgression.ts";
import {
  applyCleanlinessAction,
  cleanlinessOf,
  type TaskKind,
} from "../src/game/restaurant/cleanliness.ts";
import {
  ACCURACY_STARS,
  CHECK_TASK,
  MAX_PINS,
  MIN_CARDS,
  PERFECTS_PER_PIN,
  allCards,
  checkCards,
  checkTierAt,
  checkTiers,
  finishCheck,
  fridgeCheckOf,
  howtoSeen,
  isFridgeCheckOpen,
  isNextToWrap,
  isPracticeOpen,
  isSortOpen,
  isWrapOpen,
  pinsOf,
  reasonOf,
  scoreCheck,
  sortStars,
  sortTimeMs,
  stageOfTask,
  tierNumberAt,
  tomorrowOf,
  stickerText,
  verdictOf,
  wrapItems,
  wrapStars,
  wrapTimeMs,
  withHowtoSeen,
  type CheckOutcome,
} from "../src/game/restaurant/fridgeCheck.ts";
import type { IngredientId } from "../src/game/definitions.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}

const FRESH = restaurantSystem("fridge-freshness").firstLevel;
const FULL = restaurantSystem("full-operation").firstLevel;
const DAY = 40;

/** A save at business day DAY with these stock lines: [id, bought on day]. Level is passed to the functions, not stored. */
const stocked = (lines: [string, number][], extra: Partial<SaveData> = {}): SaveData => {
  const s = structuredClone(DEFAULT_SAVE);
  s.credits = 123_456;
  s.business.calendar = { businessDay: DAY };
  s.business.inventory = Object.fromEntries(
    lines.map(([id, bought]) => [
      id,
      { ingredientId: id as IngredientId, quantity: 2, unitCost: 300, purchaseDay: bought },
    ]),
  ) as SaveData["business"]["inventory"];
  return { ...s, ...extra };
};
// Tomorrow is DAY + 1 = 41. Shelf lives: salmon 3, basil 3, cheddar 4, bread 5, apple 6, tomato 7, garlic 12.
const NIGHT: [string, number][] = [
  ["salmon", 38], // age 3 tomorrow = expired: BIN
  ["basil", 39], // age 2 of 3 tomorrow = 0.67 aging
  ["cheddar", 38], // 3 of 4 = 0.75 near expiry: USE FIRST
  ["bread", 40], // 1 of 5 fresh
  ["apple", 41], // fresh
  ["tomato", 35], // 6 of 7 = 0.86 near expiry: USE FIRST
  ["garlic", 30], // 11 of 12 = 0.92 near expiry
];
const T3 = FRESH + 20; // a level with three piles

console.log("A. Tiers and when it opens");
{
  const t = checkTiers();
  assert(t.length === 5, "A1: five tiers");
  assert(
    t.map((x) => x.from).join() ===
      [
        FRESH,
        ...[1, 2, 3].map((k) => FRESH + Math.max(k, Math.round(((FULL - FRESH) * k) / 4))),
        FULL,
      ].join(),
    "A2: tiers start at the freshness stage, then a quarter, half and three quarters of the way to full operation (+10 / +20 / +30 in the 148-level campaign), and full operation",
    t.map((x) => x.from),
  );
  assert(
    t.map((x) => x.maxCards).join() === "9,12,14,16,18" &&
      t.map((x) => x.timeFactor).join() === "2,1.6,1.3,1.1,1",
    "A3: 9 / 12 / 14 / 16 / 18 cards (6 / 8 / 10 / 12 / 12 until 2026-11-12), clock x2 / 1.6 / 1.3 / 1.1 / 1",
  );
  assert(
    t.map((x) => x.piles).join() === "3,3,3,3,3" &&
      t[0]!.cues.icon &&
      t[0]!.cues.days &&
      !t[2]!.cues.icon &&
      t[2]!.cues.days &&
      !t[3]!.cues.days,
    "A4: every tier has three piles (Use next from the start, developer 2026-11-11); the cues fade out (icon, then days)",
  );
  assert(tierNumberAt(FRESH) === 1 && tierNumberAt(FULL + 50) === 5, "A5: tierNumberAt");
  const second = checkTiers()[1]!.from;
  assert(checkTierAt(second + 1).from === second, "A6: tierAt picks the last tier reached");
  const s = stocked(NIGHT);
  assert(
    !isSortOpen(s, FRESH - 1),
    "A7: before the freshness stage nothing opens (nothing can spoil)",
  );
  assert(
    isSortOpen(s, FRESH) && isSortOpen(s, FULL),
    "A8: from the freshness stage it opens when something is to judge",
  );
  const quiet = stocked([
    ["bread", 40],
    ["apple", 41],
    ["garlic", 41],
    ["tomato", 41],
  ]);
  // Rule changed 2026-11-11 ("sauce station and fridge check are not mandatory", "increase the amount of things to check"): a quiet or thin fridge is
  // topped up with training cards, so the game is always there once freshness is live and every night has Bin and Use next cards.
  const quietDeck = checkCards(quiet, FULL);
  assert(
    isSortOpen(quiet, FULL) &&
      quietDeck.filter((c) => c.verdict === "bin").length >= checkTierAt(FULL).minBin &&
      quietDeck.filter((c) => c.verdict === "use-first").length >= checkTierAt(FULL).minUse &&
      quietDeck.some((c) => c.training),
    "A9: a quiet night is topped up with training cards: enough Bin and Use next to judge",
    quietDeck.map((c) => `${c.id}:${c.verdict}`),
  );
  const thinDeck = checkCards(stocked(NIGHT.slice(0, MIN_CARDS - 1)), FULL);
  assert(
    isSortOpen(stocked(NIGHT.slice(0, MIN_CARDS - 1)), FULL) &&
      thinDeck.length >= checkTierAt(FULL).minCards &&
      thinDeck.length <= checkTierAt(FULL).maxCards,
    "A10: too few real cards is topped up to the tier's minimum, never over its maximum",
    thinDeck.length,
  );
  assert(
    checkTiers().every(
      (x, i, all) =>
        i === 0 ||
        (x.minCards >= all[i - 1]!.minCards &&
          x.minBin >= all[i - 1]!.minBin &&
          x.minUse >= all[i - 1]!.minUse),
    ) && checkTiers().every((x) => x.minCards <= x.maxCards),
    "A11: the minimum deck, Bin and Use next counts only grow tier by tier (the challenge rises gradually)",
  );
  // A fridge FULL of spoiled food must still be a mix (it used to be an all-Bin deck: nothing to keep, nothing to use next).
  const spoiledFridge = stocked(
    [
      "apple",
      "parsley",
      "greenbean",
      "radish",
      "strawberry",
      "bread",
      "lettuce",
      "tomato",
      "carrot",
      "garlic",
      "basil",
    ].map((id, i) => [id, i < 8 ? 25 : 41] as [string, number]),
  );
  const mixDeck = checkCards(spoiledFridge, FULL);
  assert(
    mixDeck.some((c) => c.verdict === "keep") &&
      mixDeck.filter((c) => c.verdict === "use-first").length >= checkTierAt(FULL).minUse &&
      mixDeck.filter((c) => c.verdict === "bin").length >= checkTierAt(FULL).minBin &&
      mixDeck.length <= checkTierAt(FULL).maxCards &&
      new Set(mixDeck.map((c) => c.id)).size === mixDeck.length,
    "A13: a fridge full of spoiled food is still a mix: Bin, Use next AND Keep cards (never an all-Bin deck)",
    mixDeck.map((c) => `${c.id}:${c.verdict}`),
  );
  const real = new Set(Object.values(quiet.business.inventory).map((e) => e!.ingredientId));
  assert(
    JSON.stringify(checkCards(quiet, FULL)) === JSON.stringify(checkCards(quiet, FULL)) &&
      JSON.stringify(checkCards(quiet, FULL, 1)) !== JSON.stringify(checkCards(quiet, FULL, 0)) &&
      quietDeck.filter((c) => c.training).every((c) => !real.has(c.id)) &&
      new Set(quietDeck.map((c) => c.id)).size === quietDeck.length,
    "A12: the deck is seeded (same night, same deck), Play again deals a new one, training cards never repeat a real ingredient",
  );
  assert(
    stageOfTask(CHECK_TASK.sort) === "sort" &&
      stageOfTask(CHECK_TASK.wrap) === "wrap" &&
      stageOfTask("tables") === null,
    "A11: only the two night chores are the game's",
  );
  assert(
    isFridgeCheckOpen(s, FULL, "spoiled-out") && !isFridgeCheckOpen(s, FULL, "tables"),
    "A12: isFridgeCheckOpen asks the right stage",
  );
}

console.log("B. The cards are the real stock, judged for tomorrow");
{
  const s = stocked(NIGHT);
  assert(tomorrowOf(s) === DAY + 1, "B1: tomorrow is the next business day");
  const all = allCards(s, FULL);
  assert(all.length === NIGHT.length, "B2: one card per stock line", all.length);
  const bin = all
    .filter((c) => c.verdict === "bin")
    .map((c) => c.id)
    .sort();
  const preview = closingPreview(s, FULL).spoiled;
  assert(
    preview !== null && JSON.stringify([...preview.ingredientIds].sort()) === JSON.stringify(bin),
    "B3: the Bin cards are exactly what closing will throw out (closingPreview)",
    { bin, preview },
  );
  const salmon = all.find((c) => c.id === "salmon")!;
  assert(
    salmon.state === "EXPIRED" &&
      salmon.verdict === "bin" &&
      salmon.daysLeft === 0 &&
      salmon.shelfLife === 3 &&
      salmon.age === 2,
    "B4: salmon bought 2 days ago with a 3-day life spoils tonight",
    salmon,
  );
  const garlic = all.find((c) => c.id === "garlic")!;
  assert(
    garlic.shelfLife === 12 && garlic.verdict === "use-first",
    "B5: garlic lasts 12 days; at 11 of 12 it is use first",
    garlic,
  );
  assert(
    all.every((c) => c.quantity === 2),
    "B6: the card shows the real quantity",
  );
  const empty = stocked([]);
  empty.business.inventory = {
    tomato: { ingredientId: "tomato", quantity: 0, unitCost: 1, purchaseDay: 1 },
  };
  assert(allCards(empty, FULL).length === 0, "B7: a line with nothing in it is not a card");
}

console.log("C. The deck");
{
  const many: [string, number][] = [
    ["salmon", 38],
    ["chicken", 38],
    ["steak", 41],
    ["tomato", 41],
    ["carrot", 41],
    ["cucumber", 41],
    ["onion", 41],
    ["potato", 41],
    ["mushroom", 41],
    ["apple", 41],
    ["pear", 41],
    ["lemon", 41],
    ["bread", 41],
    ["cheddar", 41],
    ["garlic", 41],
    ["basil", 41],
  ];
  const s = stocked(many);
  const deck = checkCards(s, T3);
  assert(deck.length === checkTierAt(T3).maxCards, "C1: capped by the tier", deck.length);
  assert(
    deck.filter((c) => c.verdict === "bin" && !c.training).length === 2 &&
      deck.filter((c) => c.verdict === "bin").length >= checkTierAt(T3).minBin,
    "C2: both real spoiled cards are always in the deck (training cards may add more, up to the tier's minimum)",
  );
  assert(
    JSON.stringify(checkCards(s, T3).map((c) => c.id)) === JSON.stringify(deck.map((c) => c.id)),
    "C3: the same night gives the same deck",
  );
  const other = structuredClone(s);
  other.business.calendar = { businessDay: DAY + 1 };
  for (const e of Object.values(other.business.inventory)) e!.purchaseDay += 1;
  assert(
    JSON.stringify(checkCards(other, T3).map((c) => c.id)) !==
      JSON.stringify(deck.map((c) => c.id)) || checkCards(other, T3).length === deck.length,
    "C4: another night is dealt from its own seed",
  );
  const tier1 = checkCards(s, FRESH);
  assert(tier1.length === 9, "C5: tier 1 shows 9 cards (6 until 2026-11-12)", tier1.length);
  assert(new Set(deck.map((c) => c.id)).size === deck.length, "C6: no ingredient twice");
}

console.log("D. Piles by tier");
{
  assert(
    verdictOf("EXPIRED", 2) === "bin" && verdictOf("EXPIRED", 3) === "bin",
    "D1: expired is always Bin",
  );
  assert(
    verdictOf("NEAR_EXPIRY", 2) === "keep",
    "D2: a two-pile verdict keeps near-expiry food (the rule function; no tier uses it now)",
  );
  assert(verdictOf("NEAR_EXPIRY", 3) === "use-first", "D3: later tiers put near-expiry food first");
  assert(
    verdictOf("AGING", 3) === "keep" && verdictOf("FRESH", 3) === "keep",
    "D4: aging and fresh are Keep",
  );
  const s = stocked(NIGHT);
  assert(
    allCards(s, FRESH).filter((c) => c.verdict === "use-first").length === 3 &&
      allCards(s, FULL).filter((c) => c.verdict === "use-first").length === 3,
    "D5: Use next is there from tier 1 (2026-11-11): the same stock has three Use next cards in tier 1 and in tier 5",
  );
}

console.log("E. Wrap and label");
{
  const s = stocked(NIGHT);
  const items = wrapItems(s, FULL);
  assert(
    items.every((c) => c.state !== "EXPIRED"),
    "E1: only the food that stays is wrapped",
  );
  assert(
    items.length <= checkTierAt(FULL).maxWrap &&
      items.filter((c) => !c.training).length === NIGHT.length - 1,
    "E2: capped by the tier; every real item that stays is on the shelf",
    items.length,
  );
  const first = [...items].sort((a, b) => a.expires - b.expires)[0]!;
  const last = [...items].sort((a, b) => b.expires - a.expires)[0]!;
  assert(
    isNextToWrap(items, first) && !isNextToWrap(items, last),
    "E3: the soonest use-by goes first",
  );
  const ties = items.filter((c) => Math.ceil(c.expires) === Math.ceil(first.expires));
  assert(
    ties.every((c) => isNextToWrap(items, c)),
    "E4: items that expire together may go in any order",
  );
  assert(
    isWrapOpen(s, FULL) && !isWrapOpen(s, FRESH - 1),
    "E5: wrap opens with items to order, not before freshness",
  );
  const same = stocked([
    ["tomato", 40],
    ["carrot", 40],
    ["cucumber", 40],
  ]);
  const sameItems = wrapItems(same, FULL);
  assert(
    isWrapOpen(same, FULL) && new Set(sameItems.map((c) => Math.ceil(c.expires))).size >= 2,
    "E6: all the same use-by day: training items make it a real ordering job (more than one use-by day)",
  );
  const c = items.find((x) => x.id === "tomato")!;
  assert(
    stickerText({ ...c, daysLeft: 0 }) === "Today" &&
      stickerText({ ...c, daysLeft: 1 }) === "1 day left" &&
      stickerText({ ...c, daysLeft: 4 }) === "4 days left",
    "E7: sticker words",
  );
  const bin = allCards(s, FULL).find((x) => x.id === "salmon")!;
  assert(
    /Salmon Fillet: 3-day shelf life, bought 2 days ago: spoils tonight/.test(
      reasonOf(bin, checkTierAt(FULL)),
    ),
    "E8: the reason line names the shelf life, the age and the verdict",
    reasonOf(bin, checkTierAt(FULL)),
  );
}

console.log("F. Clock, points and stars");
{
  assert(
    sortTimeMs(4, FRESH) === Math.round((8 + 2.2 * 4) * 2.0) * 1000,
    "F1: sort clock = (8 s + 2.2 s a card) x factor",
  );
  assert(sortTimeMs(1, FULL) === 20_000, "F2: never under 20 s");
  assert(
    wrapTimeMs(4, FRESH) === Math.round((8 + 2.5 * 4) * 2.0) * 1000 &&
      wrapTimeMs(1, FULL) === 15_000,
    "F3: wrap clock",
  );
  assert(
    scoreCheck([0, 1, 2], false, 10_000) === 100 + 125 + 150,
    "F4: 100 a right card, x1.25 per right in a row",
  );
  assert(
    scoreCheck([0], true, 12_400) === 100 + 20 * 12,
    "F5: 20 a second left when the deck is finished",
  );
  assert(
    scoreCheck([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], false, 0) ===
      100 + 125 + 150 + 175 + 200 + 225 + 250 + 275 + 300 + 300,
    "F6: the combo stops at x3",
  );
  assert(sortStars(6, 0, 0, false) === 3, "F7: every card right = 3 stars");
  assert(sortStars(6, 0, 0, true) !== 3, "F8: the clock running out loses the third star");
  assert(sortStars(10, 1, 0, false) === 2, "F9: one slip in ten = 2 stars (90%)");
  assert(
    sortStars(10, 1, 1, false) === 1 && sortStars(10, 2, 0, false) === 1,
    "F10: a kept-spoiled slip in ten counts double (80%) = 1 star",
  );
  assert(
    sortStars(6, 1, 1, false) === 1 && sortStars(6, 1, 0, false) === 1,
    "F11: 1 wrong of 6 = 83%: 1 star; kept-spoiled counts double (67%) also 1 star",
  );
  assert(
    sortStars(10, 1, 1, false) < 3 &&
      sortStars(7, 1, 1, false) === 1 &&
      sortStars(7, 1, 0, false) === 2,
    "F12: keeping spoiled food costs more than binning fresh food (7 cards: 2 stars vs 1)",
  );
  assert(sortStars(5, 5, 0, false) === 0 && sortStars(0, 0, 0, false) === 0, "F13: all wrong = 0");
  assert(ACCURACY_STARS[0] === 0.6 && ACCURACY_STARS[1] === 0.85, "F14: the star shares");
  assert(
    wrapStars(4, 4) === 3 &&
      wrapStars(4, 3) === 2 &&
      wrapStars(4, 2) === 1 &&
      wrapStars(4, 1) === 0,
    "F15: wrap stars by first-try share",
  );
}

console.log("G. Finishing a stage");
{
  const base = stocked(NIGHT);
  const out = (o: Partial<CheckOutcome> = {}): CheckOutcome => ({
    stage: "sort",
    stars: 3,
    score: 700,
    right: 6,
    total: 6,
    ...o,
  });
  const h0 = secondFloorOf(base).hype ?? 0;
  const a = finishCheck(base, out());
  const st = fridgeCheckOf(a.save);
  assert(
    a.effects.hype === HYPE_BY_STARS[3] && (secondFloorOf(a.save).hype ?? 0) >= h0,
    "G1: 3 stars pay the shared Hype",
  );
  assert(
    st.best === 700 && st.stars === 3 && st.perfect === 1 && st.rounds === 1 && a.effects.newBest,
    "G2: best, stars, perfect and rounds are kept",
  );
  assert(
    a.effects.streak === 1 && st.streak === 1 && st.streakDay === DAY,
    "G3: the first perfect night starts a streak",
  );
  const again = finishCheck(a.save, out({ score: 500 }));
  assert(again.effects.hype === 0, "G4: Hype is paid once a night per stage");
  assert(
    !again.effects.newBest && fridgeCheckOf(again.save).best === 700,
    "G5: a lower score is not a new best",
  );
  const wrap = finishCheck(a.save, out({ stage: "wrap", stars: 2, score: 400 }));
  assert(
    wrap.effects.hype === HYPE_BY_STARS[2] && fridgeCheckOf(wrap.save).bestWrap === 400,
    "G6: the wrap stage has its own Hype and best",
  );
  const next = structuredClone(a.save);
  next.business.calendar = { businessDay: DAY + 1 };
  const b = finishCheck(next, out());
  assert(
    b.effects.streak === 2 && b.effects.hype === HYPE_BY_STARS[3],
    "G7: a perfect night the next day continues the streak",
  );
  const gap = structuredClone(a.save);
  gap.business.calendar = { businessDay: DAY + 3 };
  assert(finishCheck(gap, out()).effects.streak === 1, "G8: a gap starts it over");
  assert(
    finishCheck(a.save, out({ stars: 1, score: 100 })).effects.streak === 0 &&
      fridgeCheckOf(finishCheck(a.save, out({ stars: 1, score: 100 })).save).streak === 0,
    "G9: a night under 3 stars ends the streak",
  );
  let s = base;
  for (let i = 0; i < PERFECTS_PER_PIN * 2; i++) {
    s = structuredClone(s);
    s.business.calendar = { businessDay: DAY + i * 2 };
    s = finishCheck(s, out()).save;
  }
  assert(pinsOf(s) === 2, "G10: every 3 perfect stages earn a freshness pin", pinsOf(s));
  const third = structuredClone(base);
  third.business.fridgeCheck = { perfect: PERFECTS_PER_PIN - 1 };
  assert(finishCheck(third, out()).effects.pin, "G11: the pin is announced when it is earned");
  const cap = structuredClone(base);
  cap.business.fridgeCheck = { perfect: 9999 };
  assert(pinsOf(cap) === MAX_PINS, "G12: pins stop at 12");
  const pr = finishCheck(base, out({ practice: true }));
  assert(pr.save === base && pr.effects.hype === 0, "G13: practice changes nothing");
  assert(
    finishCheck(base, out({ stars: 0, score: 0 })).effects.hype === 0,
    "G14: 0 stars pay nothing",
  );
}

console.log("H. The cleanliness action: its own chore only, and never money or stock");
{
  const withTasks = (kinds: TaskKind[]): SaveData => {
    const s = stocked(NIGHT);
    s.business.cleanliness = {
      ...cleanlinessOf(s),
      tasks: kinds.map((kind) => ({ kind, count: 1, since: 0 })),
    };
    return s;
  };
  const before = withTasks(["spoiled-out", "wrap-fridge", "wipe-boards"]);
  const outcome: CheckOutcome = { stage: "sort", stars: 3, score: 900, right: 6, total: 6 };
  const r = applyCleanlinessAction(before, { kind: "check", task: "spoiled-out", outcome });
  const left = cleanlinessOf(r.save)
    .tasks.map((t) => t.kind)
    .sort()
    .join();
  assert(
    r.cleaned.join() === "spoiled-out" && left === "wipe-boards,wrap-fridge",
    "H1: the sort stage cleans Throw out spoiled food and nothing else",
    left,
  );
  assert(
    !!r.checkEffects && r.checkEffects.hype === HYPE_BY_STARS[3],
    "H2: the effects come back for the result board",
  );
  const w = applyCleanlinessAction(r.save, {
    kind: "check",
    task: "wrap-fridge",
    outcome: { ...outcome, stage: "wrap" },
  });
  assert(
    w.cleaned.join() === "wrap-fridge" &&
      cleanlinessOf(w.save)
        .tasks.map((t) => t.kind)
        .join() === "wipe-boards",
    "H3: the wrap stage cleans Wrap and label only",
  );
  const dup = applyCleanlinessAction(r.save, { kind: "check", task: "spoiled-out", outcome });
  assert(
    dup.save === r.save && dup.cleaned.length === 0 && !dup.checkEffects,
    "H4: a second call (the chore is done) pays and changes nothing",
  );
  const bad = applyCleanlinessAction(before, { kind: "check", task: "wipe-boards", outcome });
  assert(bad.save === before && bad.cleaned.length === 0, "H5: any other chore is refused");
  assert(
    r.save.credits === before.credits &&
      JSON.stringify(r.save.business.inventory) === JSON.stringify(before.business.inventory) &&
      JSON.stringify(r.save.business.supplies) === JSON.stringify(before.business.supplies) &&
      JSON.stringify(r.save.economyLedger) === JSON.stringify(before.economyLedger) &&
      JSON.stringify(r.save.economy) === JSON.stringify(before.economy),
    "H6: credits, inventory, supplies, ledger and economy are identical before and after",
  );
  assert(
    JSON.stringify(closingPreview(r.save, FULL).spoiled) ===
      JSON.stringify(closingPreview(before, FULL).spoiled),
    "H7: closing still throws out the same food at the same value whatever the player did",
  );
  const noTask = applyCleanlinessAction(withTasks(["wipe-boards"]), {
    kind: "check",
    task: "spoiled-out",
    outcome,
  });
  assert(
    noTask.cleaned.length === 0 && !noTask.checkEffects,
    "H8: a chore the Prep Cook already did gives nothing",
  );
}

console.log("I. Saves");
{
  const old = structuredClone(DEFAULT_SAVE);
  delete (old.business as { fridgeCheck?: unknown }).fridgeCheck;
  const f = fridgeCheckOf(old);
  assert(
    f.best === 0 && f.perfect === 0 && f.streak === 0 && pinsOf(old) === 0,
    "I1: an old save has nothing earned",
  );
  const junk = structuredClone(DEFAULT_SAVE);
  (junk.business as unknown as { fridgeCheck: unknown }).fridgeCheck = {
    best: -5,
    stars: "x",
    perfect: 1e30,
    streak: NaN,
    rounds: 3.7,
  };
  const j = fridgeCheckOf(junk);
  assert(
    j.best === 0 &&
      j.stars === 0 &&
      j.streak === 0 &&
      j.rounds === 3 &&
      j.perfect! > 0 &&
      pinsOf(junk) === MAX_PINS,
    "I2: garbage is dropped to whole, non-negative numbers",
  );
  const round = finishCheck(stocked(NIGHT), {
    stage: "sort",
    stars: 2,
    score: 321,
    right: 5,
    total: 6,
  }).save;
  const again = JSON.parse(JSON.stringify(round)) as SaveData;
  assert(
    JSON.stringify(fridgeCheckOf(again)) === JSON.stringify(fridgeCheckOf(round)),
    "I3: a JSON round trip keeps the state",
  );
  assert(
    allCards(structuredClone(DEFAULT_SAVE), FULL).length === 0 &&
      isSortOpen(structuredClone(DEFAULT_SAVE), FULL) &&
      checkCards(structuredClone(DEFAULT_SAVE), FULL).length >= checkTierAt(FULL).minCards,
    "I4: an empty fridge has no real cards, and the game still opens with a full training deck",
  );
}

console.log("K. The practice entry");
{
  const s = stocked(NIGHT);
  assert(
    isPracticeOpen(s, FULL) && !isPracticeOpen(s, FRESH - 1),
    "K1: practice opens from the freshness stage when there is stock",
  );
  const quiet = stocked([
    ["bread", 40],
    ["apple", 41],
    ["garlic", 41],
  ]);
  assert(
    isPracticeOpen(quiet, FULL) && isSortOpen(quiet, FULL),
    "K2: the game opens on a quiet night too (training cards)",
  );
  assert(
    isPracticeOpen(stocked(NIGHT.slice(0, MIN_CARDS - 1)), FULL) &&
      isPracticeOpen(structuredClone(DEFAULT_SAVE), FULL) &&
      !isPracticeOpen(structuredClone(DEFAULT_SAVE), FRESH - 1),
    "K3: too little stock still opens (training cards), but never before the freshness stage",
  );
}

console.log(
  "L. The how-to tour (developer 2026-11-07: show beginners what is spoiled, what to use first, and how it works)",
);
{
  const s = stocked(NIGHT);
  assert(
    !howtoSeen(s, "sort") && !howtoSeen(s, "wrap"),
    "L1: a save that never saw the tour (every old save) has seen neither stage's tour",
  );
  const sort = withHowtoSeen(s, "sort");
  assert(
    howtoSeen(sort, "sort") && !howtoSeen(sort, "wrap") && fridgeCheckOf(sort).howto === 1,
    "L2: seeing the Sort tour is remembered, and only for Sort",
  );
  const both = withHowtoSeen(sort, "wrap");
  assert(
    howtoSeen(both, "wrap") &&
      fridgeCheckOf(both).howto === 3 &&
      withHowtoSeen(both, "sort") === both,
    "L3: Wrap has its own bit, and a second mark is the same save back (nothing to persist)",
  );
  const played = finishCheck(
    withHowtoSeen(
      {
        ...s,
        business: { ...s.business, fridgeCheck: { best: 5, stars: 2, perfect: 1, rounds: 1 } },
      },
      "sort",
    ),
    { stage: "sort", stars: 3, score: 99, practice: false } as CheckOutcome,
  );
  assert(
    fridgeCheckOf(played.save).howto === 1 && fridgeCheckOf(played.save).rounds === 2,
    "L4: finishing a night keeps the seen flag (and the earlier stars)",
  );
  const r = applyCleanlinessAction(s, { kind: "check-howto", stage: "sort" });
  assert(
    howtoSeen(r.save, "sort") &&
      r.cleaned.length === 0 &&
      r.save.credits === s.credits &&
      JSON.stringify(r.save.business.inventory) === JSON.stringify(s.business.inventory) &&
      JSON.stringify(r.save.economyLedger) === JSON.stringify(s.economyLedger) &&
      JSON.stringify(cleanlinessOf(r.save).tasks) === JSON.stringify(cleanlinessOf(s).tasks),
    "L5: the 'seen' action touches no money, stock, ledger or chore",
  );
  const junk = { ...s, business: { ...s.business, fridgeCheck: { howto: 99 } } } as SaveData;
  assert(
    fridgeCheckOf(junk).howto === 3 &&
      fridgeCheckOf({ ...s, business: { ...s.business, fridgeCheck: { howto: -4 } } } as SaveData)
        .howto === 0,
    "L6: a bad saved number is clamped (0..3)",
  );
  const game = fs.readFileSync(
    path.join(ROOT, "src/components/kc/restaurant/FridgeCheckGame.tsx"),
    "utf8",
  );
  const tour = fs.readFileSync(
    path.join(ROOT, "src/components/kc/restaurant/FridgeCheckHowTo.tsx"),
    "utf8",
  );
  assert(
    /useState\(!howtoSeen\(save, stage\)\)/.test(game) &&
      /<FridgeCheckHowTo/.test(game) &&
      /onGuideSeen/.test(game) &&
      /fc-guide-ok/.test(tour) &&
      /fc-guide-skip/.test(tour),
    "L7: the tour shows by itself the first time (practice too), is saved on close, and can be skipped",
  );
  assert(
    /FRESH/.test(tour) &&
      /NEAR_EXPIRY/.test(tour) &&
      /EXPIRED/.test(tour) &&
      /InspectionCard/.test(tour) &&
      /SHELF_LIFE_GUIDE/.test(tour) &&
      /6 \+ 1 = 7/.test(tour) &&
      /ingredients-spoiled/.test(tour),
    "L8: the tour shows a fresh, a going-off and a spoiled card (the game's own pieces), the days rule and the shelf lives; the spoiled picture is preloaded",
  );
  const cleanSrc = fs.readFileSync(
    path.join(ROOT, "src/components/kc/restaurant/CleaningGame.tsx"),
    "utf8",
  );
  const router = fs.readFileSync(path.join(ROOT, "src/ScreensRouter.tsx"), "utf8");
  assert(
    /kind: "check-howto"/.test(cleanSrc) && /kind: "check-howto"/.test(router),
    "L9: both entries (the night chore and the Inventory practice chip) save that the tour was seen",
  );
}

console.log("J. Rules file, wiring and art");
{
  const src = fs.readFileSync(path.join(ROOT, "src/game/restaurant/fridgeCheck.ts"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert(!/Math\.random/.test(code), "J1: no Math.random in the rules");
  assert(
    !/debitWallet|creditWallet|appendLedgerEntry|removeStock|addStock|consumeIngredients/.test(
      code,
    ),
    "J2: no wallet, ledger or stock call in the rules",
  );
  const has = (f: string) => fs.existsSync(path.join(ROOT, f));
  const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
  assert(has("src/components/kc/restaurant/FridgeCheckGame.tsx"), "J3: the screen exists");
  assert(
    /isFridgeCheckOpen/.test(read("src/components/kc/restaurant/CleaningGame.tsx")),
    "J4: the cleaning hook opens the game for the two chores",
  );
  assert(
    has("src/components/kc/inventory/FridgeCheckChip.tsx") &&
      /fridge-check/.test(read("src/ScreensRouter.tsx")) &&
      /fridge-check/.test(read("src/components/kc/data.ts")),
    "J7: the practice chip, the screen id and the route exist",
  );
  assert(
    /FridgeCheckChip/.test(read("src/components/kc/inventory/InventoryScreen.tsx")) &&
      /pins=\{pinsOf/.test(read("src/components/kc/inventory/InventoryScreen.tsx")) &&
      /data-fridge-pin/.test(read("src/components/kc/inventory/fridge/PhysicalFridge.tsx")),
    "J8: Inventory shows the chip and the freshness pins on the fridge door",
  );
  const twinDir = path.join(ROOT, "public/business/ingredients-spoiled");
  const twins = has("public/business/ingredients-spoiled") ? fs.readdirSync(twinDir) : [];
  const freshIds = fs
    .readdirSync(path.join(ROOT, "public/business/ingredients"))
    .map((f) => f.replace(".webp", ""));
  const missing = freshIds.filter((i) => i !== "chicken" && !twins.includes(i + ".webp"));
  assert(
    twins.length === 56 && missing.length === 0,
    "J9: every ingredient except the chicken (a breast, not the twin's drumstick) has a spoiled twin",
    { n: twins.length, missing },
  );
  const twinBytes = twins.reduce((n, f) => n + fs.statSync(path.join(twinDir, f)).size, 0);
  assert(
    twinBytes > 0 && twinBytes <= 450_000,
    `J10: the twins stay small (${Math.round(twinBytes / 1024)} KB)`,
  );
  const dir = path.join(ROOT, "public/business/fridge-check");
  const files = has("public/business/fridge-check") ? fs.readdirSync(dir) : [];
  assert(
    files.includes("backdrop.webp") &&
      files.includes("card.webp") &&
      files.includes("stamp-keep.webp") &&
      files.includes("bin-open.webp"),
    "J5: the built art is in public/business/fridge-check",
    files.slice(0, 8),
  );
  const bytes = files.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
  assert(bytes > 0 && bytes <= 700_000, `J6: the kit stays small (${Math.round(bytes / 1024)} KB)`);
}

if (failures) {
  console.log(`\n${failures} FAILED`);
  process.exit(1);
}
console.log("\nALL PASS");
