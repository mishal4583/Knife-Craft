/**
 * FRIDGE SORT QA (developer 2026-11-03): the rules of the "Put it away" mini-game, business/fridgeSort.ts.
 *   A  the targets: all 57 ingredients have exactly one, the 25 vegetables exactly one of 4 game-only bins, 10 targets in fridge order
 *   B  it opens at Level 14 (the start of Fridge & Freshness) and not before
 *   C  the crate: only real ingredients, no duplicates, a new seed for a new crate, a queue, deterministic rounds, the level's size
 *   D  time, points, combo, stars: the numbers of the plan
 *   E  finishing a round: tokens leave the crate, best / stars / magnets / Hype, practice changes nothing, the Prep Cook gives nothing
 *   F  it NEVER touches money or stock: credits, inventory and the ledger are identical before and after
 *   G  saves: old saves, garbage and a JSON round trip
 *   H  simulated players: a perfect one gets three stars at every level, a careful one two or more, a random one none
 *   I  no randomness and no wallet in the rules file
 * Prints a line per check and exits 1 on any failure.
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { INGREDIENTS, type IngredientId } from "../src/game/definitions.ts";
import { fridgeZoneFor } from "../src/game/business/fridgeView.ts";
import { shelfLifeForIngredient } from "../src/game/business/perishability.ts";
import { achievementsFor } from "../src/game/progression/achievements.ts";
import { afterNight, setStandingOrder } from "../src/game/restaurant/deliveries.ts";
import { secondFloorOf } from "../src/game/restaurant/secondFloor.ts";
import {
  COMBO_MAX,
  DIFFICULTY,
  FRIDGE_SORT_FIRST_LEVEL,
  HYPE_BY_STARS,
  MAX_CRATE_QUEUE,
  MAX_MAGNETS,
  STAR_AT,
  TARGETS,
  VEG_BINS,
  addToCrate,
  autoPutAway,
  MAX_EXPIRING_TOKENS,
  bestPossible,
  comboMultiplier,
  difficultyAt,
  expiringTokens,
  expiryDoubleActive,
  finishRound,
  fridgeSortOf,
  fridgeTierOf,
  isFridgeSortOpen,
  magnetsOf,
  pointsFor,
  roundFor,
  scoreRound,
  starsFor,
  targetOf,
  targetsFor,
  timeLimitMs,
} from "../src/game/business/fridgeSort.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const fresh = (): SaveData => ({ ...structuredClone(DEFAULT_SAVE), credits: 123_456 });
const all = Object.keys(INGREDIENTS) as IngredientId[];

console.log("A. Targets");
{
  const ids = TARGETS.map((t) => t.id);
  const veg = all.filter((id) => fridgeZoneFor(id) === "vegetables");
  const binned = (Object.keys(VEG_BINS) as (keyof typeof VEG_BINS)[]).flatMap(
    (b) => VEG_BINS[b].ids,
  );
  assert(
    all.length === 57 && all.every((id) => ids.includes(targetOf(id))),
    "A1: every one of the 57 ingredients has a target on the screen",
  );
  assert(
    veg.length === 25 &&
      binned.length === 25 &&
      new Set(binned).size === 25 &&
      veg.every((id) => binned.includes(id)) &&
      binned.every((id) => veg.includes(id)),
    "A2: the 25 vegetables are in exactly one of the 4 bins (none missing, none twice, no non-vegetable)",
    { veg: veg.length, binned: binned.length },
  );
  assert(
    all
      .filter((id) => fridgeZoneFor(id) !== "vegetables")
      .every((id) => targetOf(id) === fridgeZoneFor(id)),
    "A3: everything that is not a vegetable keeps the fridge's own zone (fridgeZoneFor is the single truth)",
  );
  assert(
    ids.length === 10 &&
      new Set(ids).size === 10 &&
      ids[0] === "dairy" &&
      ids.slice(1, 5).join() === "veg-roots,veg-salad,veg-stems,veg-pods" &&
      ids[5] === "protein" &&
      ids[9] === "door-aromatics",
    "A4: 10 targets, top to bottom as they sit in the fridge: dairy, the 4 vegetable bins, meat and bread, drawers, door",
    ids,
  );
  const counts: Record<string, number> = {};
  for (const id of all) counts[targetOf(id)] = (counts[targetOf(id)] ?? 0) + 1;
  assert(
    Math.max(...Object.values(counts)) <= 15,
    "A5: no target holds more than 15 of the 57 (before the bins one shelf held 25)",
    counts,
  );
}

console.log("B. When it opens");
{
  assert(
    FRIDGE_SORT_FIRST_LEVEL === 14,
    "B1: it opens at Level 14, the first level of Fridge & Freshness",
    FRIDGE_SORT_FIRST_LEVEL,
  );
  assert(
    !isFridgeSortOpen(13) && isFridgeSortOpen(14) && isFridgeSortOpen(120),
    "B2: closed at Level 13, open from Level 14",
  );
  const s = fresh();
  assert(
    addToCrate(s, ["tomato"], 13) === s && roundFor(s, 13) === null,
    "B3: below Level 14 nothing is put on a crate",
  );
}

console.log("C. The crate");
{
  const s0 = fresh();
  const s1 = addToCrate(s0, ["tomato", "carrot", "nonsense", "tomato", "cheddar"], 14);
  assert(
    JSON.stringify(fridgeSortOf(s1).crate) === JSON.stringify(["tomato", "carrot", "cheddar"]),
    "C1: only real ingredients, once each, in the order bought",
    fridgeSortOf(s1).crate,
  );
  assert(
    addToCrate(s1, ["tomato"], 14) === s1 && addToCrate(s1, [], 14) === s1,
    "C2: buying what already waits changes nothing",
  );
  assert(fridgeSortOf(s1).seed === 1, "C3: a new crate takes a new seed", fridgeSortOf(s1).seed);
  const s2 = addToCrate(s1, ["salmon"], 14);
  assert(
    fridgeSortOf(s2).seed === 1 && fridgeSortOf(s2).crate!.length === 4,
    "C4: adding to a waiting crate keeps its seed",
  );
  const many = addToCrate(fresh(), all, 20);
  assert(
    fridgeSortOf(many).crate!.length === MAX_CRATE_QUEUE,
    "C5: the queue is capped (24), nothing breaks when the whole shop is bought",
    fridgeSortOf(many).crate!.length,
  );
  const sizes = DIFFICULTY.map((d) => roundFor(many, d.from)!.tokens.length);
  assert(
    sizes.join() === "6,8,10,12" && DIFFICULTY.map((d) => d.maxTokens).join() === "6,8,10,12",
    "C6: a crate holds 6, 8, 10 and 12 tokens by level (14, 27, 44, 74)",
    sizes,
  );
  const r1 = roundFor(many, 14)!;
  assert(r1.queued === 18, "C7: what does not fit waits for the next round", r1.queued);
  const a = roundFor(s1, 14)!;
  const b = roundFor(structuredClone(s1), 14)!;
  assert(
    JSON.stringify(a) === JSON.stringify(b),
    "C8: the same crate and seed always give the same round (no randomness)",
  );
  const other = addToCrate(autoPutAway(s1), ["tomato", "carrot", "cheddar"], 14);
  const orders = new Set<string>();
  let save = s1;
  for (let i = 0; i < 12; i++) {
    orders.add(roundFor(save, 14)!.tokens.join());
    save = addToCrate(
      autoPutAway(save),
      ["tomato", "carrot", "cheddar", "apple", "salmon", "basil"],
      14,
    );
  }
  assert(
    fridgeSortOf(other).seed === 2 && orders.size > 1,
    "C9: a later crate with the same food is shuffled differently",
    orders.size,
  );
  assert(roundFor(fresh(), 30) === null, "C10: nothing waiting = no round");
  const t = targetsFor(["tomato", "cheddar"], 14);
  const order = TARGETS.map((x) => x.id);
  assert(
    t.length === 5 &&
      t.includes("veg-salad") &&
      t.includes("dairy") &&
      JSON.stringify(t) === JSON.stringify(order.filter((id) => t.includes(id))),
    "C11: the crate's own targets are always shown, decoys fill up to the level's minimum (5), all in fridge order",
    t,
  );
  assert(
    [14, 27, 44, 74].map((l) => targetsFor(["tomato"], l).length).join() === "5,6,8,10",
    "C12: 5, 6, 8 and 10 targets by level",
  );
  const needMore = targetsFor(
    ["tomato", "carrot", "cheddar", "apple", "salmon", "basil", "garlic", "butter"],
    14,
  );
  assert(
    needMore.length >= 7 && needMore.includes("door-butter"),
    "C13: a crate that needs more targets than the minimum shows them all",
  );
}

console.log("D. Time, points, stars");
{
  assert(
    timeLimitMs(8, 30) === 40_000 && timeLimitMs(12, 80) === 50_000,
    "D1: 20 s + 2.5 s a token: 8 tokens = 40 s, 12 tokens = 50 s",
    [timeLimitMs(8, 30), timeLimitMs(12, 80)],
  );
  assert(
    timeLimitMs(6, 14) === 46_000 && timeLimitMs(8, 20) === 52_000,
    "D2: +30 % in the first stage (Level 14-26), to the whole second: 6 tokens = 45.5 -> 46 s, 8 = 52 s",
    [timeLimitMs(6, 14), timeLimitMs(8, 20)],
  );
  assert(
    [0, 1, 2, 3, 4, 8, 20].map((n) => pointsFor(n)).join() === "100,125,150,175,200,300,300" &&
      COMBO_MAX === 3,
    "D3: 100 a token, +25 % per right in a row, never more than x3",
  );
  assert(
    comboMultiplier(0) === 1 && comboMultiplier(100) === 3,
    "D4: the multiplier starts at 1 and stops at 3",
  );
  assert(
    scoreRound({ drops: [true, true, true], tokens: 3, msLeft: 0 }) === 375 &&
      scoreRound({ drops: [true, true, true], tokens: 3, msLeft: 10_400 }) === 375 + 200,
    "D5: a flawless 3-token round = 375, plus 20 a second left when everything was placed",
  );
  assert(
    scoreRound({ drops: [true, true, false, true, true], tokens: 4, msLeft: 0 }) ===
      100 + 125 + 100 + 125,
    "D6: a wrong drop scores nothing and resets the combo",
  );
  assert(
    scoreRound({ drops: [true, true], tokens: 3, msLeft: 20_000 }) === 225,
    "D7: no time bonus when time ran out with tokens left (the stars earned so far still count)",
  );
  assert(
    scoreRound({ drops: [true, true], tokens: 2, msLeft: 0 }, new Set([1])) === 100 + 250,
    "D8: an expiring (⏳) token is worth double (Level 74 and up)",
  );
  const best = bestPossible(8, 30);
  assert(
    best === 1500 + 20 * 32 && best === 2140,
    "D9: the best possible 8-token round at the reference pace (1 s a token) = 2140",
    best,
  );
  const stars = (score: number) => starsFor(score, 8, 30);
  assert(
    stars(best) === 3 &&
      stars(best * STAR_AT[2]) === 3 &&
      stars(best * STAR_AT[2] - 1) === 2 &&
      stars(best * STAR_AT[1]) === 2 &&
      stars(best * STAR_AT[1] - 1) === 1 &&
      stars(best * STAR_AT[0]) === 1 &&
      stars(best * STAR_AT[0] - 1) === 0 &&
      stars(0) === 0,
    "D10: one, two and three stars at 50 %, 75 % and 95 % of the best possible, exactly on the boundary",
  );
  assert(
    DIFFICULTY.map((d) => d.hint).join() === "always,after-miss,never,never" &&
      difficultyAt(10).from === 14 &&
      difficultyAt(30).from === 27 &&
      difficultyAt(500).from === 74 &&
      DIFFICULTY[3]!.expiryBonus &&
      !DIFFICULTY[2]!.expiryBonus,
    "D11: hints always, after a miss, then none; the double ⏳ token only from Level 74",
  );
}

console.log("E. Finishing a round");
{
  const s = addToCrate(fresh(), ["tomato", "carrot", "cheddar", "apple"], 20);
  const r = roundFor(s, 20)!;
  const done = finishRound(s, { stars: 3, score: 2000, tokens: r.tokens });
  assert(
    fridgeSortOf(done.save).crate === undefined,
    "E1: the shown tokens leave the crate (and the key goes when it is empty)",
  );
  const part = addToCrate(fresh(), all.slice(0, 10), 20);
  const rp = roundFor(part, 20)!;
  const afterPart = finishRound(part, { stars: 1, score: 500, tokens: rp.tokens }).save;
  assert(
    fridgeSortOf(afterPart).crate!.length === 10 - rp.tokens.length &&
      rp.queued === 10 - rp.tokens.length,
    "E2: what did not fit stays for the next round",
  );
  assert(
    done.effects.hype === 15 &&
      secondFloorOf(done.save).hype === 15 &&
      HYPE_BY_STARS.join() === "0,5,10,15",
    "E3: three stars add 15 Hype (the Second Floor's Rush meter)",
  );
  const one = finishRound(s, { stars: 1, score: 100, tokens: r.tokens });
  const none = finishRound(s, { stars: 0, score: 10, tokens: r.tokens });
  assert(
    secondFloorOf(one.save).hype === 5 &&
      secondFloorOf(none.save).hype === 0 &&
      none.save.business.secondFloor === s.business.secondFloor,
    "E4: one star = 5 Hype; no stars = none (and the floor state is not even touched)",
  );
  assert(
    fridgeSortOf(done.save).best?.basic === 2000 &&
      done.effects.newBest &&
      fridgeSortOf(done.save).stars === 3 &&
      fridgeSortOf(done.save).rounds === 1,
    "E5: the best score (per fridge tier), the stars and the round count are kept",
  );
  const lower = finishRound(done.save, { stars: 1, score: 900, tokens: ["tomato"] });
  assert(
    fridgeSortOf(lower.save).best?.basic === 2000 && !lower.effects.newBest,
    "E6: a lower score does not replace the best",
  );
  const comm = structuredClone(s);
  comm.business.refrigerator = { refrigeratorId: "commercial-refrigerator" };
  assert(
    fridgeTierOf(comm) === "commercial" &&
      fridgeSortOf(finishRound(comm, { stars: 2, score: 700, tokens: r.tokens }).save).best
        ?.commercial === 700,
    "E7: the best is kept per fridge tier",
  );
  let m = fresh();
  const magnets: boolean[] = [];
  for (let i = 0; i < 40; i++) {
    m = addToCrate(m, ["tomato"], 20);
    const out = finishRound(m, { stars: 3, score: 1000, tokens: ["tomato"] });
    magnets.push(out.effects.magnet);
    m = out.save;
  }
  assert(
    magnets.slice(0, 9).join() === "false,false,true,false,false,true,false,false,true" &&
      magnets.filter(Boolean).length === MAX_MAGNETS &&
      magnetsOf(m) === MAX_MAGNETS,
    "E8: a magnet for every 3 three-star rounds, 12 in all, never more",
    magnets.filter(Boolean).length,
  );
  const prac = finishRound(s, { stars: 3, score: 5000, tokens: r.tokens, practice: true });
  assert(
    prac.save === s && prac.effects.hype === 0 && !prac.effects.magnet,
    "E9: a practice round changes nothing at all",
  );
  const auto = autoPutAway(s);
  assert(
    fridgeSortOf(auto).crate === undefined &&
      secondFloorOf(auto).hype === 0 &&
      fridgeSortOf(auto).stars === 0 &&
      autoPutAway(auto) === auto,
    "E10: the Prep Cook puts the crate away: no stars, no Hype, no magnet",
  );
}

console.log("F. It never touches money or stock");
{
  const base = fresh();
  base.business = {
    ...base.business,
    inventory: { tomato: { ingredientId: "tomato", quantity: 3, unitCost: 100, purchaseDay: 1 } },
  } as SaveData["business"];
  base.economyLedger = [
    {
      id: "x",
      category: "inventory-purchase",
      amount: -300,
      description: "tomato",
      at: 1,
    } as never,
  ];
  let s = addToCrate(base, ["tomato", "carrot"], 30);
  const r = roundFor(s, 30)!;
  const out = finishRound(s, { stars: 3, score: 1000, tokens: r.tokens });
  const strip = (x: SaveData) => {
    const c = structuredClone(x) as SaveData;
    delete c.business.fridgeSort;
    delete c.business.secondFloor;
    return JSON.stringify(c);
  };
  assert(
    out.save.credits === base.credits &&
      JSON.stringify(out.save.business.inventory) === JSON.stringify(base.business.inventory) &&
      JSON.stringify(out.save.economyLedger) === JSON.stringify(base.economyLedger) &&
      strip(out.save) === strip(base),
    "F1: credits, inventory, the ledger and everything else are identical before and after a round (only the sort state and Hype change)",
  );
  s = autoPutAway(s);
  assert(
    strip(s) === strip(base) && s.credits === base.credits,
    "F2: the Prep Cook's tidy-up moves nothing either",
  );
}

console.log("G. Saves");
{
  const old = fresh();
  assert(
    old.business.fridgeSort === undefined &&
      fridgeSortOf(old).crate === undefined &&
      fridgeSortOf(old).stars === 0,
    "G1: an old save (no field) reads as nothing waiting",
  );
  const junk = fresh();
  junk.business.fridgeSort = {
    crate: ["tomato", 5, "nope", "tomato", null, "apple"] as never,
    seed: -4 as never,
    best: { basic: -3, commercial: "x", professional: 800.9 } as never,
    stars: "many" as never,
    perfect: -1 as never,
    rounds: 2.7 as never,
  };
  const c = fridgeSortOf(junk);
  assert(
    JSON.stringify(c.crate) === JSON.stringify(["tomato", "apple"]) &&
      c.seed === 0 &&
      c.stars === 0 &&
      c.perfect === 0 &&
      c.rounds === 2 &&
      JSON.stringify(c.best) === JSON.stringify({ professional: 800 }),
    "G2: garbage is dropped: unknown ids, duplicates, negative and non-numeric values",
    c,
  );
  const s = addToCrate(fresh(), ["tomato", "carrot"], 30);
  assert(
    JSON.stringify(fridgeSortOf(JSON.parse(JSON.stringify(s)))) === JSON.stringify(fridgeSortOf(s)),
    "G3: the state survives a JSON round trip unchanged",
  );
  const bad = fresh();
  bad.business.fridgeSort = { crate: "not an array" as never };
  assert(
    fridgeSortOf(bad).crate === undefined && roundFor(bad, 30) === null,
    "G4: a crate that is not a list is simply empty",
  );
}

console.log("H. Simulated players");
{
  let seed = 20261103;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const levels = [14, 20, 27, 40, 44, 60, 74, 120];
  const crates: IngredientId[][] = [];
  for (let i = 0; i < 60; i++) {
    const n = 4 + Math.floor(rnd() * 12);
    crates.push([...all].sort(() => rnd() - 0.5).slice(0, n));
  }
  // A player: `ms` per drop, and the chance that a drop is on a WRONG target. The round is played with the real rules.
  const play = (level: number, crate: IngredientId[], ms: number, wrong: number) => {
    const r = roundFor(addToCrate(fresh(), crate, level), level)!;
    const drops: boolean[] = [];
    let t = 0;
    for (const _ of r.tokens) {
      let ok = false;
      while (!ok && t < r.timeMs) {
        t += ms;
        if (t > r.timeMs) break;
        ok = rnd() >= wrong;
        drops.push(ok);
      }
      if (!ok) break;
    }
    const score = scoreRound({ drops, tokens: r.tokens.length, msLeft: Math.max(0, r.timeMs - t) });
    return starsFor(score, r.tokens.length, level);
  };
  const profile = (ms: number, wrong: number) => {
    const d = [0, 0, 0, 0];
    for (const level of levels) for (const crate of crates) d[play(level, crate, ms, wrong)]++;
    const n = d.reduce((a, b) => a + b, 0);
    return { d, n, atLeast: (k: number) => d.slice(k).reduce((a, b) => a + b, 0) / n };
  };
  const fast = profile(900, 0);
  assert(
    fast.d[3] === fast.n,
    "H1: a fast, flawless player (0.9 s a token) gets three stars at every level and crate size",
    fast.d,
  );
  const steady = profile(2000, 0);
  assert(
    steady.d[3] === steady.n,
    "H2: a flawless player at 2 s a token also gets three stars (accuracy matters more than speed)",
    steady.d,
  );
  const slowFlawless = profile(2600, 0);
  assert(
    slowFlawless.d[3] === 0 && slowFlawless.atLeast(2) === 1,
    "H3: flawless but slow (2.6 s a token) = two stars, never three",
    slowFlawless.d,
  );
  const careful = profile(2200, 0.05);
  assert(
    careful.atLeast(1) === 1 && careful.atLeast(2) >= 0.75 && careful.d[3] / careful.n <= 0.05,
    "H4: a careful player (2.2 s, 5 % wrong drops): always a star, two or more at least 3 times in 4, a mistake costs the third star",
    careful.d,
  );
  const average = profile(3000, 0.1);
  assert(
    average.atLeast(1) >= 0.95 && average.d[3] === 0,
    "H5: an average player (3 s, 10 % wrong) gets a star 95 % of the time and never three",
    average.d,
  );
  const slow = profile(4500, 0.15);
  assert(
    slow.d[3] === 0 && slow.d[0] > 0 && slow.atLeast(2) < 0.35,
    "H6: a slow, sloppy player (4.5 s, 15 % wrong) never gets three and often none",
    slow.d,
  );
  let randomStars = 0;
  let randomThree = 0;
  let randomRuns = 0;
  for (const level of levels)
    for (const crate of crates) {
      const q = play(level, crate, 1500, 1 - 1 / Math.max(5, difficultyAt(level).minTargets));
      randomStars += q;
      randomThree += q === 3 ? 1 : 0;
      randomRuns++;
    }
  assert(
    randomThree === 0 && randomStars / randomRuns < 0.35,
    "H7: a player dropping at random never gets three stars and averages under a third of a star",
    { avg: randomStars / randomRuns, three: randomThree, runs: randomRuns },
  );
}

console.log("J. Expiring food (Level 74+), achievements, magnets");
{
  const day = 12;
  const withStock = (ids: IngredientId[], ageLeft: number[]): SaveData => {
    const s = fresh();
    s.business.calendar = { ...s.business.calendar, businessDay: day };
    ids.forEach((id, i) => {
      s.business.inventory[id] = {
        ingredientId: id,
        quantity: 3,
        unitCost: 100,
        purchaseDay: day - (shelfLifeForIngredient(id) - ageLeft[i]!),
      };
    });
    return s;
  };
  const crate: IngredientId[] = ["tomato", "carrot", "cheddar", "apple", "salmon", "basil"];
  const sv = withStock(["tomato", "cheddar", "salmon", "apple"], [1, 1, 2, 30]);
  const stockBefore = JSON.stringify(sv.business.inventory);
  const at74 = expiringTokens(sv, crate, 74);
  assert(
    at74.size === MAX_EXPIRING_TOKENS &&
      MAX_EXPIRING_TOKENS === 2 &&
      at74.has("tomato") &&
      at74.has("cheddar"),
    "J1: exactly two tokens are expiring (⏳) in the crate: the two spoiling tonight, never more than two",
    [...at74],
  );
  assert(
    expiringTokens(sv, crate, 73).size === 0 && expiringTokens(sv, crate, 20).size === 0,
    "J2: no expiring tokens below Level 74 (the bonus is off there)",
  );
  assert(
    [...at74].every((id) => crate.includes(id) && sv.business.inventory[id]) && !at74.has("apple"),
    "J3: only food in the crate that is really about to spoil counts (a fresh apple never does)",
    [...at74],
  );
  assert(
    JSON.stringify(sv.business.inventory) === stockBefore,
    "J4: looking at expiring food never changes the stock",
  );
  assert(
    expiringTokens(sv, crate, 74).size === at74.size &&
      [...expiringTokens(sv, crate, 74)].join() === [...at74].join(),
    "J5: the same save gives the same ⏳ tokens (deterministic)",
  );
  const flat = scoreRound({ drops: [true, true, true], tokens: 3, msLeft: 0 });
  const dbl = scoreRound({ drops: [true, true, true], tokens: 3, msLeft: 0 }, new Set([2]));
  assert(
    dbl === flat + pointsFor(2),
    "J6: a doubled right drop pays exactly twice its own points, nothing else changes",
    { flat, dbl },
  );
  assert(
    expiryDoubleActive(20_000, 45_000) && !expiryDoubleActive(15_000, 45_000),
    "J7: the double holds while more than a third of the clock is left",
  );
  const b0 = bestPossible(12, 74);
  const b2 = bestPossible(12, 74, 2);
  assert(
    b2 > b0 && b2 - b0 <= 2 * pointsFor(11),
    "J8: the best possible score counts the ⏳ tokens too, so a crate with expiring food is not easier to ace",
    { b0, b2 },
  );
  const idealLeft = timeLimitMs(12, 74) - 12 * 1000;
  const doubledScore = scoreRound(
    { drops: Array.from({ length: 12 }, () => true), tokens: 12, msLeft: idealLeft },
    new Set([10, 11]),
  );
  assert(
    doubledScore === b2 && starsFor(doubledScore, 12, 74, 2) === 3,
    "J9: a flawless round at the reference pace that doubles the two ⏳ tokens at the end of the streak equals the best possible and gets three stars",
    { doubledScore, b2 },
  );
  // achievements: badges only
  const a = fresh();
  a.business.fridgeSort = { rounds: 10, perfect: 5 };
  const ach = achievementsFor(a).filter((x) => /^ach-(tidy|perfect)-/.test(x.id));
  assert(
    ach.length === 4 && ach.every((x) => x.reward === 0),
    "J10: Tidy fridge / Perfect crate are four badge-only achievements (no money, so the economy does not move)",
    ach.map((x) => [x.id, x.reward]),
  );
  assert(
    ach.find((x) => x.id === "ach-tidy-10")?.reached === true &&
      ach.find((x) => x.id === "ach-perfect-5")?.reached === true &&
      ach.find((x) => x.id === "ach-tidy-50")?.reached === false &&
      ach.find((x) => x.id === "ach-perfect-25")?.reached === false,
    "J11: 10 crates reach Tidy fridge, 5 three-star crates reach Perfect crate, the next tiers are not reached",
  );
  const m = fresh();
  m.business.fridgeSort = { perfect: 40 };
  assert(
    magnetsOf(m) === MAX_MAGNETS && magnetsOf(fresh()) === 0,
    "J12: magnets cap at 12 and a new save has none",
  );
}

console.log("K. The morning delivery fills the crate");
{
  const base = fresh();
  base.levelProgress = {
    currentLevelId: "level-40",
    highestUnlockedLevelId: "level-40",
    completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 3,
  } as SaveData["levelProgress"];
  base.credits = 5_000_000;
  base.business.inventory = {};
  base.business.restaurantDay = {
    day: 12,
    opened: false,
    servicesDone: 0,
    servicesPlanned: 0,
    closingDue: false,
    openingCredits: null,
    openingLevel: null,
  } as SaveData["business"]["restaurantDay"];
  const night = afterNight(setStandingOrder(base, "fresh", true), 40);
  const arrived = night.received.flatMap((r) => r.lines.map((l) => l.id));
  const filled = addToCrate(night.save, arrived, 40);
  const crate = fridgeSortOf(filled).crate ?? [];
  assert(arrived.length > 0, "K1: the standing order really delivered something", arrived);
  assert(
    crate.length > 0 && crate.every((id) => arrived.includes(id) && id in INGREDIENTS),
    "K2: what arrived (ingredients only) is on the crate",
    { arrived, crate },
  );
  assert(
    filled.credits === night.save.credits &&
      JSON.stringify(filled.economyLedger) === JSON.stringify(night.save.economyLedger) &&
      JSON.stringify(filled.business.inventory) === JSON.stringify(night.save.business.inventory),
    "K3: filling the crate moves no money, no ledger entry and no stock",
  );
  const app = fs.readFileSync(path.join(ROOT, "src/App.tsx"), "utf8");
  assert(
    /afterNight\([\s\S]{0,400}\)[\s\S]{0,300}addToCrate\(\s*night\.save,\s*night\.received/.test(
      app,
    ),
    "K4: App puts the night's delivery on the crate when the day closes",
  );
}

console.log("I. The rules file");
{
  const src = fs.readFileSync(path.join(ROOT, "src/game/business/fridgeSort.ts"), "utf8");
  assert(!/Math\.random\s*\(/.test(src), "I1: no Math.random (the token order is seeded)");
  assert(
    !/EconomyLedger|appendLedgerEntry|debitWallet|economy\/wallet|credits\s*[:+\-=]/.test(
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    ),
    "I2: the rules file has no wallet, ledger or credits code",
  );
}

console.log(
  failures === 0 ? "\nFRIDGE SORT QA: ALL PASS" : `\nFRIDGE SORT QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
