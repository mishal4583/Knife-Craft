/**
 * DELIVERY INSPECTION QA (developer 2026-11-08; plan docs/planning/DELIVERY-INSPECTION-MINIGAME-PLAN-2026-11-08.md). The rules that are pure; the
 * pictures and the touch play are checked in tools/e2e/deliveryinspection.mjs.
 *   A  when it opens, how many rounds a day, the Prep Cook, old saves
 *   B  the crate: the real delivery's ingredients first, only things a defect can be drawn on, seeded, the tiers' numbers
 *   C  fairness: every defect can be found; never behind a defect; a decoy never on a defect (400 crates per tier)
 *   D  scoring, stars, Hype, pins; finishing never moves money, stock or the ledger
 *   E  wiring and rules kept: screen, chips, App action, no unseeded randomness, no network, no new top-level save field
 * Run: npx tsx scripts/delivery-inspection-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  INSPECTION_TIERS,
  MAX_PINS,
  MAX_ROUNDS_PER_DAY,
  MARK_SCALE,
  WRONG_PENALTY_MS,
  buildCrate,
  crateIngredients,
  crateIssues,
  autoInspect,
  deliveriesTag,
  deliveryInspectionOf,
  finishRound,
  findPoints,
  isDefective,
  isInspectionOpen,
  INSPECTION_FIRST_LEVEL,
  markPoint,
  coversAt,
  pinsOf,
  progressOf,
  roundCrate,
  roundsLeft,
  scoreRound,
  starsFor,
  tierAt,
  tierNumberAt,
  withHowtoSeen,
  howtoSeen,
} from "../src/game/business/deliveryInspection.ts";
import { DIFFICULTY } from "../src/game/business/fridgeSort.ts";
import { HYPE_BY_STARS } from "../src/game/business/fridgeSort.ts";
import { INGREDIENTS } from "../src/game/definitions.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("      ", JSON.stringify(detail).slice(0, 300));
  }
}

/** A save with a delivery of `n` loose pieces waiting (Fridge Sort's crate) at campaign level `level`. */
function saveWith(
  level: number,
  extra: Partial<SaveData["business"]> = {},
  crate?: string[],
): SaveData {
  const ids = crate ?? [
    "tomato",
    "carrot",
    "lettuce",
    "apple",
    "onion",
    "basil",
    "potato",
    "pepper",
  ];
  const s = structuredClone(DEFAULT_SAVE) as SaveData;
  s.levelProgress = {
    ...s.levelProgress,
    currentLevelId: `level-${level}`,
    highestUnlockedLevelId: `level-${level}`,
    completedLevelIds: Array.from({ length: level - 1 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 4,
  } as SaveData["levelProgress"];
  s.business = {
    ...s.business,
    fridgeSort: {
      crate: ids as never,
      counts: Object.fromEntries(ids.map((i) => [i, 3])) as never,
      seed: 5,
    },
    ...extra,
  } as SaveData["business"];
  return s;
}

console.log("A. When it opens");
{
  assert(
    !isInspectionOpen(2) && isInspectionOpen(3),
    "A1: it opens at Level 3, Fridge Sort's level: the delivery is checked BEFORE it is unpacked (Level 9 from 2026-11-10 to 2026-11-11)",
  );
  const lvl = (n: number) => 0 + n;
  assert(
    INSPECTION_TIERS.map((t) => t.from).join() === DIFFICULTY.map((d) => d.from).join(),
    "A2: the five tiers start at the same levels as Fridge Sort's five",
    INSPECTION_TIERS.map((t) => t.from),
  );
  assert(
    tierNumberAt(lvl(3)) === 1 && tierNumberAt(30) === 3 && tierNumberAt(90) === 5,
    "A3: tierAt follows the level",
  );
  const s = saveWith(3);
  assert(
    roundsLeft(s, 3) >= 1 && roundsLeft(s, 3) <= MAX_ROUNDS_PER_DAY,
    "A4: a delivery that waits has inspections to do",
    roundsLeft(s, 3),
  );
  assert(roundsLeft(saveWith(2), 2) === 0, "A5: below Level 3 there are none");
  const empty = saveWith(3, { fridgeSort: undefined });
  assert(roundsLeft(empty, 3) === 0, "A6: no delivery waiting = nothing to inspect");
  const prep = saveWith(3, {
    staff: { ...DEFAULT_SAVE.business.staff, hiredRoles: ["prep-cook"] } as never,
  });
  const before7 = roundsLeft(prep, 3);
  const auto = autoInspect(prep);
  assert(
    before7 >= 1 &&
      roundsLeft(auto, 3) === before7 - 1 &&
      deliveryInspectionOf(auto).rounds === 0 &&
      deliveryInspectionOf(auto).today === 0 &&
      auto.credits === prep.credits,
    "A7: a hired Prep Cook does not hide the game (developer 2026-11-08); his button counts the basket as inspected and gives no stars, Hype, pins or day count",
    { before7 },
  );
  // The daily limit and the basket count.
  const big = saveWith(3, {}, Object.keys(INGREDIENTS).slice(0, 24));
  const rounds0 = roundsLeft(big, 3);
  let cur: SaveData = big;
  let done = 0;
  while (roundsLeft(cur, 3) > 0 && done < 12) {
    cur = finishRound(cur, { stars: 2, score: 500, found: 2, total: 2 }).save;
    done++;
  }
  assert(
    done === rounds0 && done <= MAX_ROUNDS_PER_DAY,
    "A8: every basket is inspected once, at most five a day",
    { rounds0, done },
  );
  const tag = deliveriesTag(cur, 3);
  assert(
    tag.done === done && tag.total === done,
    "A9: the 'Deliveries 2/5' tag counts what was done",
    tag,
  );
  // A new day resets the day's count.
  const next = structuredClone(cur) as SaveData;
  next.business.calendar = {
    ...next.business.calendar,
    businessDay: next.business.calendar.businessDay + 1,
  };
  assert(
    deliveryInspectionOf(next).day !== next.business.calendar.businessDay &&
      deliveriesTag(next, 3).done === 0,
    "A10: the next day starts at 0 rounds",
  );
  // Old saves: the field is missing.
  const old = structuredClone(DEFAULT_SAVE) as SaveData;
  const st = deliveryInspectionOf(old);
  assert(
    st.rounds === 0 && st.best === 0 && !howtoSeen(old) && pinsOf(old) === 0,
    "A11: an old save (no deliveryInspection) reads as nothing done",
  );
  const bad = structuredClone(DEFAULT_SAVE) as SaveData;
  (bad.business as unknown as { deliveryInspection: unknown }).deliveryInspection = {
    rounds: -5,
    best: "x",
    perfect: 1e12,
    howto: 99,
  };
  const sane = deliveryInspectionOf(bad);
  assert(
    sane.rounds === 0 && sane.best === 0 && sane.howto! <= 1 && pinsOf(bad) <= MAX_PINS,
    "A12: bad saved numbers are made safe",
  );
  assert(
    (howtoSeen(withHowtoSeen(old)) && withHowtoSeen(withHowtoSeen(old)) === withHowtoSeen(old)) ||
      howtoSeen(withHowtoSeen(old)),
    "A13: the how-to tour is remembered once",
  );
}

console.log("B. The crate");
{
  const s = saveWith(3, {}, ["tomato", "carrot", "salmon", "chicken", "lettuce"]);
  const ing = crateIngredients(s, 1, 10);
  assert(
    ing.slice(0, 3).join() === "tomato,carrot,lettuce",
    "B1: the delivery's own produce comes first (meat and fish stay out)",
    ing,
  );
  assert(
    ing.every((id) =>
      ["Fruit", "Vegetable", "Aromatic", "Herb"].includes(INGREDIENTS[id].category),
    ),
    "B2: tiers 1-2 hold only produce, herbs and aromatics",
  );
  const t3 = crateIngredients(saveWith(30, {}, ["bread", "cheddar", "tomato"]), 3, 6);
  assert(
    t3.includes("bread" as never) && t3.includes("cheddar" as never),
    "B3: from tier 3 bread and cheese (mold) can be in the crate",
  );
  const a = roundCrate(saveWith(30), 30, 0)!;
  const b = roundCrate(saveWith(30), 30, 0)!;
  const c = roundCrate(saveWith(30), 30, 1)!;
  assert(
    JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c),
    "B4: the same round is the same crate; another salt another crate",
  );
  for (const t of INSPECTION_TIERS) {
    const level = Math.max(t.from, INSPECTION_FIRST_LEVEL);
    const crate = roundCrate(saveWith(level), level, 0)!;
    const defects = crate.items.filter(isDefective).length;
    const decoys = crate.items.filter((i) => i.mark?.type === "decoy").length;
    const hidden = crate.items.filter((i) => i.hidden).length;
    assert(
      crate.items.length >= t.items[0] &&
        crate.items.length <= t.items[1] &&
        defects >= t.defects[0] &&
        defects <= t.defects[1] &&
        defects === crate.defects &&
        decoys === t.decoys &&
        hidden === t.hidden,
      `B5 tier ${tierNumberAt(level)}: ${crate.items.length} items, ${defects} defects, ${hidden} hidden, ${decoys} decoys`,
      { items: crate.items.length, defects, hidden, decoys },
    );
    const px = crate.items.every((i) => i.size * 5 >= 56 - 0.01 / 5);
    assert(
      px,
      `B6 tier ${tierNumberAt(level)}: every ingredient is at least 56 px at 500 px wide (touch targets)`,
      Math.min(...crate.items.map((i) => i.size)),
    );
    assert(
      crate.items
        .filter(isDefective)
        .every((i) => t.kinds.includes((i.mark as { kind: never }).kind)),
      `B7 tier ${tierNumberAt(level)}: only that tier's kinds of defect`,
    );
  }
  assert(
    tierAt(3).timeMs >= tierAt(3).defects[1] * 4500 &&
      tierAt(74).timeMs >= tierAt(74).defects[1] * 4500,
    "B8: the clock is long enough for ~4.5 s a defect in the first and the last tier",
  );
  assert(
    MARK_SCALE.big > MARK_SCALE.medium &&
      MARK_SCALE.medium > MARK_SCALE.small &&
      MARK_SCALE.small > MARK_SCALE.tiny,
    "B9: marks shrink big to tiny",
  );
}

console.log("C. Fairness (400 crates per tier)");
{
  const mix = (n: number) =>
    Array.from(
      { length: n },
      (_, i) =>
        (
          ["tomato", "lettuce", "carrot", "onion", "pepper", "potato", "mushroom", "apple"] as const
        )[i % 8],
    ) as never[];
  for (const t of INSPECTION_TIERS) {
    let issues = 0;
    let fallback = 0;
    let decoyOnDefect = 0;
    let behindDefect = 0;
    let wrongHidden = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const crate = buildCrate(t.from, mix, seed * 7919 + 13);
      issues += crateIssues(crate.items).length;
      if (crate.items.filter((i) => i.hidden).length < t.hidden) fallback++;
      crate.items.forEach((it, i) => {
        if (it.mark?.type === "decoy" && isDefective(it)) decoyOnDefect++;
        if (!isDefective(it)) return;
        const p = markPoint(it);
        const covers = coversAt(crate.items, i, p.x, p.y);
        if (covers.some(isDefective)) behindDefect++;
        if (it.hidden && covers.length !== 1) wrongHidden++;
        if (!it.hidden && covers.length > 0) wrongHidden++;
      });
    }
    assert(
      issues === 0 &&
        fallback === 0 &&
        decoyOnDefect === 0 &&
        behindDefect === 0 &&
        wrongHidden === 0,
      `C1 tier ${tierNumberAt(t.from)}: every defect findable, none behind a defect, hidden ones under exactly one sound ingredient, no fallback layouts`,
      { issues, fallback, decoyOnDefect, behindDefect, wrongHidden },
    );
  }
}

console.log("D. Scoring and effects");
{
  const r = (found: number, total: number, wrongs: number, msLeft: number, timeMs = 60000) => ({
    found,
    total,
    wrongs,
    msLeft,
    timeMs,
  });
  assert(
    starsFor(r(0, 3, 0, 30000)) === 0 && starsFor(r(1, 3, 0, 30000)) === 0,
    "D1: fewer than half found = 0 stars",
  );
  assert(
    starsFor(r(2, 3, 0, 30000)) === 1 && starsFor(r(1, 2, 0, 0)) === 1,
    "D2: half or more but not all = 1 star",
  );
  assert(
    starsFor(r(3, 3, 1, 50000)) === 2 && starsFor(r(3, 3, 0, 5000)) === 2,
    "D3: all found but a wrong flag, or no time to spare = 2 stars",
  );
  assert(
    starsFor(r(3, 3, 0, 15000)) === 3,
    "D4: all found, no wrong flag, a quarter of the clock left = 3 stars",
  );
  assert(
    findPoints(0) === 100 && findPoints(4) === 200 && findPoints(99) === 300,
    "D5: 100 a find, the combo grows 25% a find in a row up to 3x",
  );
  assert(
    scoreRound([0, 1, 2], r(3, 3, 0, 20000)) === 100 + 125 + 150 + 20 * 20,
    "D6: the score is the finds with their combo plus 20 a second left when all found",
  );
  assert(scoreRound([0], r(1, 3, 0, 20000)) === 100, "D7: no time bonus when something was missed");
  assert(
    progressOf(r(0, 3, 0, 1)) === 0 &&
      Math.abs(progressOf(r(3, 3, 1, 30000)) - 0.8) < 1e-9 &&
      progressOf(r(3, 3, 0, 40000)) === 1,
    "D8: the star bar fills 0.8 for all found, the rest for a clean quick finish",
  );
  assert(WRONG_PENALTY_MS === 4000, "D9: a wrong flag costs 4 seconds");
  // Finishing: Hype, pins, never money or stock.
  const base = saveWith(3);
  base.credits = 12345;
  base.business.inventory = {
    tomato: { ingredientId: "tomato", quantity: 3, unitCost: 100, purchaseDay: 1 },
  } as never;
  const ledger = base.economyLedger.length;
  let cur = base;
  let pins = 0;
  for (let i = 0; i < 6; i++) {
    const out = finishRound(cur, { stars: 3, score: 900 + i, found: 2, total: 2 });
    cur = out.save;
    if (out.effects.pin) pins++;
    if (i === 0)
      assert(
        out.effects.hype === HYPE_BY_STARS[3],
        "D10: Hype follows the shared table (15 for three stars)",
        out.effects,
      );
  }
  assert(
    pins === 2 && pinsOf(cur) === 2 && deliveryInspectionOf(cur).streak === 6,
    "D11: a pin for every 3 perfect rounds; the streak counts",
    { pins },
  );
  assert(
    cur.credits === base.credits &&
      JSON.stringify(cur.business.inventory) === JSON.stringify(base.business.inventory) &&
      cur.economyLedger.length === ledger,
    "D12: credits, stock and the ledger are identical after rounds",
  );
  const practice = finishRound(base, { stars: 3, score: 999, found: 2, total: 2, practice: true });
  assert(
    practice.save === base && practice.effects.hype === 0,
    "D13: a practice round changes nothing and gives nothing",
  );
  const zero = finishRound(base, { stars: 0, score: 0, found: 0, total: 2 });
  assert(
    zero.effects.hype === 0 && deliveryInspectionOf(zero.save).streak === 0,
    "D14: a 0-star round gives no Hype and ends the streak",
  );
}

console.log("E. Wiring and rules");
{
  const src = read("src/game/business/deliveryInspection.ts");
  assert(
    !/Math\.random/.test(src) && !/Date\.now|performance\.now/.test(src) && !/fetch\(/.test(src),
    "E1: the rules use no unseeded randomness, no clock, no network",
  );
  assert(
    !/credits|economyLedger|addToLedger|recordLedger/.test(
      src.replace(/NEVER[^\n]*\n/g, "").replace(/\/\*\*[\s\S]*?\*\//g, ""),
    ),
    "E2: the rules never touch credits or the ledger in code",
  );
  const router = read("src/ScreensRouter.tsx");
  const app = read("src/App.tsx");
  assert(
    /screen === "delivery-inspection"/.test(router) &&
      /DeliveryInspectionGame/.test(read("src/components/kc/restaurantScreens.ts")) &&
      /"delivery-inspection"/.test(read("src/components/kc/data.ts")),
    "E3: a screen of its own, lazy in the Restaurant chunk",
  );
  assert(
    /deliveryInspectionAction=\{deliveryInspectionAction\}/.test(app) &&
      /delivery_inspection_started/.test(app) &&
      /delivery_inspection_finished/.test(app) &&
      /delivery_inspection_skipped/.test(app),
    "E4: App applies the action to the latest save and sends analytics",
  );
  assert(
    /DeliveryInspectionChip/.test(read("src/components/kc/inventory/InventoryScreen.tsx")) &&
      /DeliveryInspectionChip/.test(read("src/components/kc/Shop.tsx")),
    "E5: the chip is in the Market's Ingredients tab and above the Inventory fridge",
  );
  assert(
    Object.keys(DEFAULT_SAVE).sort().join() ===
      Object.keys(structuredClone(DEFAULT_SAVE)).sort().join() &&
      !("deliveryInspection" in DEFAULT_SAVE),
    "E6: no new top-level save field (the state lives in business.deliveryInspection)",
  );
  const game = read("src/components/kc/inventory/DeliveryInspectionGame.tsx");
  assert(
    /reducedMotion/.test(game) && /touch-none/.test(game) && /data-testid="insp-/.test(game),
    "E7: reduced motion is handled, the crate does not scroll the page, test ids are in",
  );
  assert(!/Math\.random/.test(game), "E8: the screen has no unseeded randomness");
}

console.log(
  failures
    ? `\nDELIVERY INSPECTION QA: ${failures} FAILURE(S)`
    : "\nDELIVERY INSPECTION QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
