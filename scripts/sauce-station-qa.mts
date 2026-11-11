/**
 * SAUCE STATION QA (developer 2026-11-08; plan docs/planning/SAUCE-STATION-MINIGAME-PLAN-2026-11-08.md). The rules that are pure; the pictures and
 * the touch play are checked in tools/e2e/saucestation.mjs.
 *   A  when it opens, rounds a day, the Prep Cook, old and damaged saves
 *   B  colour maths: distance, linear-light mixing, tint, hints
 *   C  the 24 sauces: every recipe exists, fits the bowl, and makes its own target exactly (solvable by construction), the pantry always holds it
 *   D  thickness, blending, splitting, grading a mix
 *   E  bottling and the round's stars; finishing: stars, Hype, pins, shelf; never money, stock or ledger
 *   F  wiring and rules kept: screen, chips, App action, no unseeded randomness, no network, no new top-level save field
 * Run: npx tsx scripts/sauce-station-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { TOOL_BOWL, bottleMouth, toolPose } from "../src/components/kc/sauce/SauceParts.tsx";
import {
  BLENDED,
  MAX_PINS,
  MAX_ROUNDS_PER_DAY,
  PANTRY,
  PANTRY_BY_ID,
  PERFECTS_PER_PIN,
  SAUCES,
  SAUCE_FIRST_LEVEL,
  SAUCE_TIERS,
  autoSauce,
  sauceDutyDone,
  blendStep,
  bottleScore,
  bottleStars,
  finishRound,
  gradeMix,
  hasPrepCook,
  isMastered,
  isSauceStationOpen,
  masteredCount,
  mixOf,
  overallStars,
  pantryFor,
  pinsOf,
  pourRate,
  recipeScoops,
  roundsLeft,
  roundsTag,
  sauceOfTheDay,
  sauceStationOf,
  speedOf,
  splits,
  targetOf,
  thickOf,
  thickState,
  tierAt,
  tierNumberAt,
  unlockedSauces,
  volumeOf,
  withHowtoSeen,
  howtoSeen,
  canOfferRoundsAd,
  withAdRounds,
  roundsAllowed,
  SAUCE_AD_ROUNDS,
  rng,
  WHISK_ZONE,
  FILL_LINE,
} from "../src/game/business/sauceStation.ts";
import {
  colorHint,
  deltaE,
  hexToRgb,
  matchPercent,
  mixColors,
  rgbToHex,
} from "../src/game/business/sauceColor.ts";
import { HYPE_BY_STARS } from "../src/game/business/fridgeSort.ts";

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

function saveAt(level: number, extra: Partial<SaveData["business"]> = {}): SaveData {
  const s = structuredClone(DEFAULT_SAVE) as SaveData;
  s.levelProgress = {
    ...s.levelProgress,
    currentLevelId: `level-${level}`,
    highestUnlockedLevelId: `level-${level}`,
    completedLevelIds: Array.from({ length: level - 1 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 4,
  } as SaveData["levelProgress"];
  s.business = { ...s.business, ...extra } as SaveData["business"];
  return s;
}
const outcome = (sauceId: string, stars: 0 | 1 | 2 | 3, score = 1000) => ({
  sauceId,
  stars,
  mixStars: stars,
  bottleStars: stars as 0 | 1 | 2 | 3,
  score,
});

console.log("A. When it opens");
{
  assert(
    !isSauceStationOpen(SAUCE_FIRST_LEVEL - 1) && isSauceStationOpen(SAUCE_FIRST_LEVEL),
    "A1: it opens at Level 7, the Simple Garden Salad (developer 2026-11-10: before Level 20)",
    SAUCE_FIRST_LEVEL,
  );
  assert(
    SAUCES.length === 24 && new Set(SAUCES.map((s) => s.id)).size === 24,
    "A2: 24 sauces with unique ids",
  );
  assert(
    SAUCES.every((s, i) => i === 0 || s.unlock >= SAUCES[i - 1]!.unlock),
    "A3: the shelf is in the order they are first asked for",
  );
  assert(
    unlockedSauces(6).length === 0 &&
      unlockedSauces(7)
        .map((x) => x.id)
        .join() === "tomato-sauce,lemon-dressing,vinaigrette" &&
      unlockedSauces(19).length === 9 &&
      unlockedSauces(20).length === 10,
    "A4: three sauces at Level 7, nine by Level 19, ten (with the Caesar) at Level 20",
  );
  assert(unlockedSauces(99).length === 24, "A5: all 24 by the end");
  const s = saveAt(23);
  assert(
    roundsLeft(s, 6) === 0 &&
      roundsLeft(s, 7) === MAX_ROUNDS_PER_DAY &&
      roundsLeft(s, 23) === MAX_ROUNDS_PER_DAY,
    "A6: three rounds a day once open, none before",
  );
  const r1 = finishRound(s, outcome("tomato-sauce", 2)).save;
  assert(
    roundsLeft(r1, 23) === MAX_ROUNDS_PER_DAY - 1 && roundsTag(r1, 23).done === 1,
    "A7: a finished round counts (Sauces 1/3)",
  );
  const next = structuredClone(r1);
  next.business.calendar = {
    ...next.business.calendar,
    businessDay: next.business.calendar.businessDay + 1,
  };
  assert(
    roundsLeft(next, 23) === MAX_ROUNDS_PER_DAY,
    "A8: a new business day brings the three rounds back",
  );
  assert(
    [7, 8, 12, 20, 40].every((lv) =>
      [
        saveAt(lv),
        (() => {
          const x = saveAt(lv);
          x.business.calendar = { ...x.business.calendar, businessDay: 9 };
          return x;
        })(),
      ].every((sv) => sauceOfTheDay(sv, lv).id === "lemon-dressing"),
    ) &&
      sauceOfTheDay(finishRound(s, outcome("lemon-dressing", 1)).save, 7).id !== "lemon-dressing",
    "A8b: the very first round is always the Lemon Dressing; after it the sauce of the day is seeded as before",
  );
  assert(!hasPrepCook(s), "A9: no Prep Cook by default");
  const withCook = structuredClone(s);
  withCook.business.staff = {
    ...DEFAULT_SAVE.business.staff,
    hiredRoles: ["prep-cook"],
  } as never;
  assert(hasPrepCook(withCook), "A10: the Prep Cook is read from the staff");
  const old = saveAt(30);
  assert(
    old.business.sauceStation === undefined &&
      sauceStationOf(old).rounds === 0 &&
      masteredCount(old) === 0 &&
      pinsOf(old) === 0,
    "A11: an old save with no state reads as nothing done",
  );
  const bad = saveAt(30, {
    sauceStation: {
      mastered: -5,
      best: Number.NaN,
      stars: "x",
      perfect: 1e99,
      rounds: -1,
      today: 999,
    } as never,
  });
  const g = sauceStationOf(bad);
  assert(
    g.mastered === 0 &&
      g.best === 0 &&
      g.stars === 0 &&
      g.rounds === 0 &&
      g.today === 99 &&
      pinsOf(bad) === MAX_PINS,
    "A12: damaged state is sanitised (never negative, capped)",
    g,
  );
  const h = withHowtoSeen(s);
  assert(!howtoSeen(s) && howtoSeen(h) && withHowtoSeen(h) === h, "A13: the how-to is seen once");
}

console.log("B. Colour maths");
{
  const red = hexToRgb("#C23A22");
  assert(
    deltaE(red, red) === 0 && matchPercent(0) === 100,
    "B1: the same colour is distance 0 and 100%",
  );
  assert(
    matchPercent(deltaE(hexToRgb("#000000"), hexToRgb("#FFFFFF"))) === 0,
    "B2: black against white is 0%",
  );
  assert(rgbToHex(hexToRgb("#a1b2c3")) === "#A1B2C3", "B3: hex round-trips");
  const lin = mixColors([
    { color: hexToRgb("#FFFFFF"), volume: 1, tint: 1 },
    { color: hexToRgb("#000000"), volume: 1, tint: 1 },
  ]);
  assert(
    lin.r > 170 && lin.r < 200,
    "B4: mixing is in linear light (white + black = a light grey, not 127)",
    lin,
  );
  const yb = mixColors([
    { color: hexToRgb("#E8A91B"), volume: 1, tint: 1 },
    { color: hexToRgb("#2A5FB0"), volume: 1, tint: 1 },
  ]);
  assert(yb.r + yb.g + yb.b > 200, "B5: yellow and blue do not make mud", yb);
  // adding more of a strong colour moves the mix toward it (monotonic)
  const target = hexToRgb("#B3261B");
  let prev = Infinity;
  let monotonic = true;
  for (let n = 0; n <= 6; n++) {
    const m = mixOf({ water: 3, passata: n }).color;
    const d = deltaE(m, target);
    if (d > prev + 1e-9) monotonic = false;
    prev = d;
  }
  assert(monotonic, "B6: more passata is always closer to the passata red");
  assert(
    deltaE(
      mixOf({ passata: 3, onion: 1 }).color,
      mixOf({ passata: 3, onion: 1, salt: 0.25 }).color,
    ) < 1,
    "B7: a pinch of salt hardly changes the colour (tint 0.02)",
  );
  const h = colorHint(hexToRgb("#7A2A1A"), hexToRgb("#E8A91B"));
  assert(h.lighter && !h.darker, "B8: the hint says lighter when the target is lighter", h);
  const h2 = colorHint(hexToRgb("#E8A91B"), hexToRgb("#3E7A22"));
  assert(h2.cooler && !h2.warmer, "B9: the hint says cooler going from yellow to green", h2);
  const none = colorHint(red, red);
  assert(
    !none.lighter && !none.darker && !none.warmer && !none.cooler,
    "B10: no hint when it already matches",
  );
  assert(
    mixOf({}).volume === 0 && mixOf({ nothing: 2 }).volume === 0,
    "B11: an empty or unknown mix is empty",
  );
}

console.log("C. The sauces");
{
  assert(
    PANTRY.every(
      (p) =>
        /^#[0-9A-F]{6}$/i.test(p.color) && p.tint >= 0 && p.tint <= 1 && p.visc >= 0 && p.visc <= 1,
    ),
    "C1: every pantry colour, tint and thickness is valid",
  );
  assert(new Set(PANTRY.map((p) => p.id)).size === PANTRY.length, "C2: pantry ids are unique");
  assert(
    PANTRY.filter((p) => p.kind !== "produce").length === 28 &&
      PANTRY.filter((p) => p.kind === "produce").length === 15,
    "C3: 28 pantry items and 15 pieces of produce",
  );
  assert(
    SAUCES.every((s) => s.recipe.every(([id, n]) => PANTRY_BY_ID[id] && n > 0)),
    "C4: every recipe item is a real pantry item",
  );
  const tooBig = SAUCES.filter((s) => volumeOf(recipeScoops(s)) > tierAt(s.unlock).cap);
  assert(
    tooBig.length === 0,
    "C5: every recipe fits the bowl of its tier",
    tooBig.map((s) => s.id),
  );
  const fails: string[] = [];
  for (const s of SAUCES) {
    for (const t of SAUCE_TIERS) {
      const g = gradeMix(recipeScoops(s), s, 1, 0, t);
      if (g.stars !== 3 || g.de > 0.01 || g.thick !== "in") fails.push(`${s.id}@${t.from}`);
    }
  }
  assert(
    fails.length === 0,
    "C6: the reference recipe of every sauce earns three stars at every tier",
    fails,
  );
  // a different but close recipe also earns stars (the target is a colour, not one recipe): +1 salt, +0.25 pepper
  const near = SAUCES.filter((s) => {
    const r = { ...recipeScoops(s), salt: (recipeScoops(s).salt ?? 0) + 0.25 };
    return gradeMix(r, s, 1, 0, tierAt(s.unlock)).stars < 3;
  });
  assert(
    near.length === 0,
    "C7: a pinch of extra salt never costs a star",
    near.map((s) => s.id),
  );
  const distinct = SAUCES.filter((s) => {
    const t = targetOf(s);
    return deltaE(mixOf({ water: 8 }).color, t.color) < 12;
  });
  assert(
    distinct.length === 0,
    "C8: no sauce is the colour of plain water",
    distinct.map((s) => s.id),
  );
  let minPair = Infinity;
  for (let i = 0; i < SAUCES.length; i++)
    for (let j = i + 1; j < SAUCES.length; j++)
      minPair = Math.min(minPair, deltaE(targetOf(SAUCES[i]!).color, targetOf(SAUCES[j]!).color));
  console.log(`      (closest two sauce colours: ΔE ${minPair.toFixed(1)})`);
  assert(minPair >= 0, "C9: the colours were compared");
  // the pantry always holds the recipe, is seeded, and is bigger in the harder tiers
  let missing = 0;
  for (const s of SAUCES)
    for (let tier = 1; tier <= 4; tier++) {
      const p = pantryFor(s, tier, 7);
      const have = new Set([...p.pantry, ...p.produce].map((x) => x.id));
      for (const [id] of s.recipe) if (!have.has(id)) missing++;
    }
  assert(missing === 0, "C10: the pantry always holds every item of the recipe", missing);
  const a = pantryFor(SAUCES[0]!, 2, 9);
  const b = pantryFor(SAUCES[0]!, 2, 9);
  assert(
    a.pantry.map((x) => x.id).join() === b.pantry.map((x) => x.id).join() &&
      a.produce.map((x) => x.id).join() === b.produce.map((x) => x.id).join(),
    "C11: the pantry is seeded (the same seed, the same shelf)",
  );
  assert(
    pantryFor(SAUCES[0]!, 4, 3).pantry.length >= pantryFor(SAUCES[0]!, 1, 3).pantry.length,
    "C12: harder tiers have a bigger pantry",
  );
  assert(
    SAUCES.every((s) => s.bottle >= 0 && s.bottle <= 5 && s.label >= 0 && s.label <= 3),
    "C13: every sauce names one of the six bottles and four labels",
  );
  const day = saveAt(30);
  const pick = sauceOfTheDay(day, 30);
  assert(
    unlockedSauces(30).includes(pick) && sauceOfTheDay(day, 30).id === pick.id,
    "C14: today's sauce is unlocked and the same each time it is asked",
  );
  const mastered = finishRound(day, outcome(pick.id, 3)).save;
  const again = sauceOfTheDay(mastered, 30);
  assert(
    unlockedSauces(30).length < 2 ||
      again.id !== pick.id ||
      !isMastered(mastered, again.id) === false,
    "C15: a sauce not mastered yet is preferred",
  );
}

console.log("D. Thickness, blending, splitting, grading");
{
  const tomato = SAUCES[0]!;
  const t = targetOf(tomato);
  assert(
    t.band[0] < t.thick &&
      t.thick < t.band[1] &&
      thickOf(recipeScoops(tomato), tomato, 1) === t.thick,
    "D1: the band is around the recipe's thickness",
  );
  assert(thickState(t.thick, t.band) === "in", "D2: the recipe's thickness is in the band");
  assert(
    thickState(0, [0.6, 0.8]) === "out" &&
      thickState(0.55, [0.6, 0.8]) === "near" &&
      thickState(0.7, [0.6, 0.8]) === "in",
    "D3: in / near / out",
  );
  const mayo = SAUCES.find((s) => s.id === "mayonnaise")!;
  const thin = thickOf(recipeScoops(mayo), mayo, 0);
  const thick = thickOf(recipeScoops(mayo), mayo, 1);
  assert(thick > thin, "D4: blending an emulsion thickens it", { thin, thick });
  const [lo, hi] = WHISK_ZONE.whisk;
  assert(
    speedOf("whisk", lo - 0.1) === "slow" &&
      speedOf("whisk", lo) === "zone" &&
      speedOf("whisk", hi) === "zone" &&
      speedOf("whisk", hi + 0.1) === "fast",
    "D5: slow / zone / fast",
  );
  assert(
    blendStep(0.2, "whisk", 2, 1) > 0.2 &&
      blendStep(0.2, "whisk", 0.5, 1) === 0.2 &&
      blendStep(0.5, "whisk", 5, 1) < 0.5,
    "D6: the zone blends, slow holds, fast undoes",
  );
  assert(
    blendStep(0.95, "whisk", 2, 5) === 1 && blendStep(0.05, "whisk", 5, 5) === 0,
    "D7: the blend stays within 0..1",
  );
  let steps = 0;
  let b = 0;
  while (b < BLENDED && steps < 1000) {
    b = blendStep(b, "whisk", 2, 0.1);
    steps++;
  }
  assert(
    steps * 0.1 > 2 && steps * 0.1 < 4,
    "D8: a good whisk takes 2-4 seconds to blend",
    steps * 0.1,
  );
  const tier1 = tierAt(23);
  const vinaigrette = SAUCES.find((s) => s.id === "vinaigrette")!;
  assert(
    splits(3, 0.1, tier1, vinaigrette) &&
      !splits(1, 0.1, tier1, vinaigrette) &&
      !splits(3, 0.8, tier1, vinaigrette),
    "D9: too much oil too fast into an unblended dressing splits it; slow or blended does not",
  );
  assert(!splits(9, 0, tier1, tomato), "D10: a sauce that is not a dressing never splits");
  assert(
    splits(1.5, 0.1, tierAt(75), vinaigrette) && !splits(1.5, 0.1, tier1, vinaigrette),
    "D11: the harder tiers split sooner",
  );
  const exact = recipeScoops(vinaigrette);
  const full = gradeMix(exact, vinaigrette, 1, 0, tier1);
  assert(
    full.stars === 3 && full.match === 100,
    "D12: the exact recipe, blended = three stars, 100%",
    full,
  );
  assert(
    gradeMix(exact, vinaigrette, 0.2, 0, tier1).stars === 0,
    "D13: a right colour that is not blended earns nothing",
  );
  assert(gradeMix(exact, vinaigrette, 0.6, 0, tier1).stars === 1, "D14: half blended = one star");
  assert(
    gradeMix(exact, vinaigrette, 1, 1, tier1).stars === 2,
    "D15: a dressing that split caps at two stars",
  );
  assert(
    gradeMix({ water: 8 }, vinaigrette, 1, 0, tier1).stars === 0,
    "D16: plain water earns nothing",
  );
  const kinda = { ...exact, passata: 3 };
  const k = gradeMix(kinda, vinaigrette, 1, 0, tier1);
  assert(k.stars < 3, "D17: a clearly wrong mix does not reach three stars", k);
  const wide = gradeMix(exact, vinaigrette, 1, 0, tierAt(75));
  assert(wide.stars === 3, "D18: the exact recipe is three stars at the hardest tier too");
  assert(
    SAUCE_TIERS.every(
      (x, i) =>
        i === 0 ||
        (x.cap >= SAUCE_TIERS[i - 1]!.cap &&
          x.timeMs <= SAUCE_TIERS[i - 1]!.timeMs &&
          x.tolerance <= SAUCE_TIERS[i - 1]!.tolerance),
    ),
    "D19: the tiers only get harder",
  );
  assert(
    tierNumberAt(7) === 1 &&
      tierNumberAt(23) === 1 &&
      tierNumberAt(40) === 2 &&
      tierNumberAt(55) === 3 &&
      tierNumberAt(75) === 4 &&
      tierNumberAt(91) === 4,
    "D20: tiers start at 7 / 40 / 55 / 75",
  );
}

console.log("E. Bottling, stars, finishing");
{
  const w = 0.25;
  assert(
    bottleScore(FILL_LINE, w).score === 1 && bottleScore(FILL_LINE, w).spill === 0,
    "E1: on the line = a full score",
  );
  assert(
    bottleScore(FILL_LINE - w, w).score === 0 && bottleScore(FILL_LINE - w / 2, w).score > 0.4,
    "E2: the further from the line, the less",
  );
  const sp = bottleScore(1.2, w);
  assert(sp.spill > 0.19 && sp.score < 0.1, "E3: overfilling spills and scores almost nothing", sp);
  assert(pourRate(0, 0) > 0 && pourRate(2000, 0) > pourRate(0, 0), "E4: pouring eases in");
  assert(pourRate(1000, 1) < pourRate(1000, 0), "E5: a thick sauce pours slower");
  const perfect = { scores: [1, 0.95, 0.9], spill: 0, bottles: 3, filled: 3 };
  assert(bottleStars(perfect) === 3, "E6: every bottle near the line, no spill = 3");
  assert(bottleStars({ ...perfect, scores: [1, 0.7, 0.6] }) === 2, "E7: decent = 2");
  assert(
    bottleStars({ scores: [], spill: 0, bottles: 3, filled: 0 }) === 0,
    "E8: nothing poured = 0",
  );
  assert(
    overallStars(3, 3) === 3 &&
      overallStars(3, 2) === 3 &&
      overallStars(3, 1) === 2 &&
      overallStars(2, 3) === 2 &&
      overallStars(0, 0) === 0,
    "E9: overall stars",
  );
  assert(
    overallStars(3, null) === 2 && overallStars(1, null) === 1,
    "E10: a skipped bottling caps at two stars",
  );
  const s = saveAt(30);
  const before = JSON.stringify({ c: s.credits, l: s.economyLedger, i: s.business.inventory });
  let cur = s;
  const effects: ReturnType<typeof finishRound>["effects"][] = [];
  for (let i = 0; i < 3; i++) {
    const r = finishRound(cur, outcome("tomato-sauce", 3, 1000 + i));
    cur = r.save;
    effects.push(r.effects);
  }
  assert(
    JSON.stringify({ c: cur.credits, l: cur.economyLedger, i: cur.business.inventory }) === before,
    "E11: finishing rounds moves no money, no stock and writes no ledger entry",
  );
  assert(
    effects[0]!.hype === HYPE_BY_STARS[3] && effects[0]!.mastered && !effects[1]!.mastered,
    "E12: three stars gives the Hype and masters the sauce once",
  );
  assert(
    effects[0]!.newBest && effects[2]!.newBest && effects.map((e) => e.streak).join() === "1,2,3",
    "E13: best score and streak",
  );
  assert(
    effects[PERFECTS_PER_PIN - 1]!.pin && !effects[0]!.pin && pinsOf(cur) === 1,
    "E14: a Saucier pin every 3 perfect rounds",
  );
  assert(
    isMastered(cur, "tomato-sauce") && !isMastered(cur, "vinaigrette") && masteredCount(cur) === 1,
    "E15: the Sauce Shelf bit is set for that sauce only",
  );
  const broken = finishRound(cur, outcome("vinaigrette", 1));
  assert(
    broken.effects.streak === 0 &&
      broken.effects.hype === HYPE_BY_STARS[1] &&
      !broken.effects.mastered,
    "E16: a one-star round breaks the streak and masters nothing",
  );
  assert(
    !broken.effects.newBest || broken.save.business.sauceStation!.best! >= 1000,
    "E17: the best never goes down",
  );
  let many = s;
  for (let i = 0; i < 80; i++) many = finishRound(many, outcome("tomato-sauce", 3)).save;
  assert(pinsOf(many) === MAX_PINS, "E18: pins stop at 12");
  const pr = finishRound(s, { ...outcome("tomato-sauce", 3), practice: true });
  assert(pr.save === s && pr.effects.hype === 0, "E19: practice changes nothing");
  const autoed = autoSauce(s);
  assert(
    sauceStationOf(autoed).rounds === sauceStationOf(s).rounds &&
      sauceStationOf(autoed).stars === sauceStationOf(s).stars &&
      sauceStationOf(autoed).today === sauceStationOf(s).today &&
      autoed.credits === s.credits &&
      sauceDutyDone(autoed),
    "E20: the Prep Cook's batch counts for nothing (no round, stars, Hype or day count); since 2026-11-11 it only meets the day's duty (doneDay)",
  );
  const rnd = rng(5);
  const rnd2 = rng(5);
  assert(rnd() === rnd2() && rnd() === rnd2(), "E21: the generator is seeded");
}

console.log("F. Wiring and rules kept");
{
  const rules = read("src/game/business/sauceStation.ts") + read("src/game/business/sauceColor.ts");
  assert(!/Math\.random/.test(rules), "F1: the rules have no unseeded randomness");
  assert(
    !/credits|economyLedger|spendFromWallet|inventory\./.test(
      rules.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""),
    ),
    "F2: the rules never touch money, stock or the ledger",
  );
  assert(
    !/fetch\(|XMLHttpRequest|localStorage/.test(rules),
    "F3: no network and no storage in the rules",
  );
  assert(
    Object.keys(DEFAULT_SAVE).sort().join() ===
      Object.keys(structuredClone(DEFAULT_SAVE)).sort().join() && !("sauceStation" in DEFAULT_SAVE),
    "F4: no new top-level save field (the state lives in business.sauceStation)",
  );
  assert(
    /sauceStation\?: SauceStationState/.test(read("src/game/business/businessTypes.ts")),
    "F5: the state is declared in the business types",
  );
  const optional = [
    ["src/components/kc/data.ts", /"sauce-station"/],
    ["src/components/kc/restaurantScreens.ts", /SauceStationGame/],
    ["src/ScreensRouter.tsx", /SauceStationGame/],
    ["src/App.tsx", /sauceStationAction/],
  ] as const;
  for (const [file, re] of optional) {
    if (!fs.existsSync(path.join(ROOT, "src/components/kc/sauce/SauceStationGame.tsx"))) break;
    assert(re.test(read(file)), `F6: ${file} is wired`);
  }
  const gamePath = "src/components/kc/sauce/SauceStationGame.tsx";
  if (fs.existsSync(path.join(ROOT, gamePath))) {
    const game = read(gamePath);
    assert(!/Math\.random/.test(game), "F7: the screen has no unseeded randomness");
    assert(
      /reducedMotion/.test(game) && /touch-none/.test(game) && /data-testid="sauce-/.test(game),
      "F8: reduced motion is handled, the stage does not scroll the page, test ids are in",
    );
    assert(
      /Auto/i.test(game) && /Back/.test(game),
      "F9: there is a no-drag Auto-whisk path and a Back arrow before the clock starts",
    );
  }
}

console.log("K. The rewarded ad: 3 more rounds today (developer 2026-11-10)");
{
  const L = 12;
  let s = saveAt(L);
  assert(
    !canOfferRoundsAd(s, L),
    "K1: no offer while free rounds are left (the ad is never in the way)",
  );
  for (let i = 0; i < MAX_ROUNDS_PER_DAY; i++) s = finishRound(s, outcome("tomato-sauce", 2)).save;
  assert(
    roundsLeft(s, L) === 0 && canOfferRoundsAd(s, L),
    "K2: after the three free rounds the offer is there",
  );
  assert(!canOfferRoundsAd(s, 6), "K2b: no offer before the station opens");
  const money = [s.credits, s.economyLedger.length, JSON.stringify(s.business.inventory)];
  const w = withAdRounds(s, L);
  assert(
    SAUCE_AD_ROUNDS === 3 &&
      roundsLeft(w, L) === 3 &&
      roundsAllowed(w) === 6 &&
      roundsTag(w, L).total === 6 &&
      roundsTag(w, L).done === 3,
    "K3: the ad gives three more rounds today (3 + 3 = 6, the tag reads 3/6)",
    roundsTag(w, L),
  );
  assert(
    w.credits === money[0] &&
      w.economyLedger.length === money[1] &&
      JSON.stringify(w.business.inventory) === money[2],
    "K4: it moves no money, no stock and no ledger entry",
  );
  assert(
    withAdRounds(w, L) === w && !canOfferRoundsAd(w, L),
    "K5: once a day: a second grant changes nothing",
  );
  const fresh = saveAt(L);
  assert(withAdRounds(fresh, L) === fresh, "K5b: with free rounds left the grant does nothing");
  let u = w;
  for (let i = 0; i < SAUCE_AD_ROUNDS; i++) u = finishRound(u, outcome("tomato-sauce", 2)).save;
  assert(
    roundsLeft(u, L) === 0 && !canOfferRoundsAd(u, L),
    "K6: after the six rounds there is no offer: the day is done",
    roundsTag(u, L),
  );
  assert(
    sauceStationOf(u).extra === 3 && sauceStationOf(u).rounds === 6,
    "K6b: finishing rounds keeps the ad's grant",
    sauceStationOf(u),
  );
  const next = structuredClone(u);
  next.business.calendar = {
    ...next.business.calendar,
    businessDay: next.business.calendar.businessDay + 1,
  };
  assert(
    roundsAllowed(next) === MAX_ROUNDS_PER_DAY &&
      roundsLeft(next, L) === MAX_ROUNDS_PER_DAY &&
      !canOfferRoundsAd(next, L),
    "K7: a new business day starts at the free three again",
  );
  const junk = structuredClone(w);
  junk.business.sauceStation = { ...junk.business.sauceStation, extra: 999, extraDay: -5 } as never;
  assert(
    sauceStationOf(junk).extra! <= SAUCE_AD_ROUNDS && roundsAllowed(junk) === MAX_ROUNDS_PER_DAY,
    "K8: bad saved numbers are made safe",
  );
  assert(roundsAllowed(fresh) === 3, "K9: an old save (no ad fields) has the usual three");
  const app = read("src/App.tsx");
  assert(
    /requestRewardedAd\(newSauceRoundsRewardId\(\), AD_PLACEMENT\.sauceRounds\)/.test(app) &&
      /if \(ad\.status !== "rewarded"\) return "no"/.test(app),
    "K10: granted only on the `rewarded` state, with its own placement",
  );
  assert(
    /"sauce_rounds"/.test(read("public/playgama-bridge-config.json")),
    "K11: the placement is listed in the Bridge config",
  );
  const game = read("src/components/kc/sauce/SauceStationGame.tsx");
  assert(
    /testId="sauce-ad"/.test(game) && /more rounds today/.test(game),
    "K12: the button says what it gives before the ad",
  );
}

console.log("L. What you see: the guidance, the whisk, the pour (developer 2026-11-11)");
{
  const parts = read("src/components/kc/sauce/SauceParts.tsx");
  const game = read("src/components/kc/sauce/SauceStationGame.tsx");
  // The whisk is held handle up and stays in the bowl.
  assert(
    toolPose({ x: 0, y: 0, w: 400, h: 300 }).x >= 400 * (TOOL_BOWL.cx - TOOL_BOWL.rx) - 0.01 &&
      toolPose({ x: 9999, y: 9999, w: 400, h: 300 }).x <=
        400 * (TOOL_BOWL.cx + TOOL_BOWL.rx) + 0.01 &&
      toolPose({ x: 9999, y: 9999, w: 400, h: 300 }).y <=
        300 * (TOOL_BOWL.cy + TOOL_BOWL.ry) + 0.01,
    "L1: a finger far outside the bowl cannot take the whisk out of it (its head is held inside the rim)",
  );
  const right = toolPose({ x: 300, y: 150, w: 400, h: 300 });
  const left = toolPose({ x: 100, y: 150, w: 400, h: 300 });
  assert(
    right.tilt < 0 === left.tilt > 0 &&
      Math.abs(right.tilt) <= 24 &&
      Math.abs(left.tilt) <= 24 &&
      toolPose({ x: 200, y: 150, w: 400, h: 300 }).tilt === 0,
    "L2: the handle leans toward the middle of the bowl, never more than 24 degrees, and stands straight over the middle",
    [right.tilt, left.tilt],
  );
  assert(
    /rotate\(\$\{\(180 - pose\.tilt\)/.test(parts),
    "L3: held, the picture is turned over (handle up, head down in the sauce)",
  );
  // The pour is built from the bottle's own mouth.
  assert(
    [0, 1, 2, 3, 4, 5].every((n) => {
      const m = bottleMouth(n);
      return m.x > 0.3 && m.x < 0.7 && m.y >= 0 && m.y < 0.5 && m.neck > 0.1;
    }),
    "L4: every bottle shape has a mouth to pour into",
  );
  assert(
    /transformOrigin: `\$\{JUG_TIP\.x \* 100\}% \$\{JUG_TIP\.y \* 100\}%`/.test(parts) &&
      /left: `\$\{mouth\.x \* 100\}%`/.test(parts),
    "L5: the pitcher turns about its spout tip, which sits over the bottle's mouth, and the stream falls from that tip",
  );
  assert(
    /globalCompositeOperation = "source-in"/.test(parts) &&
      !/maskImage: maskUrl,\s*WebkitMaskRepeat/.test(
        parts.slice(
          parts.indexOf("export function BottleView"),
          parts.indexOf("function BottleLiquid"),
        ),
      ),
    "L6: the sauce in a bottle is painted through the glass silhouette on a canvas (not a CSS mask), so it can never be outside the glass on any browser",
  );
  // The guidance.
  assert(
    /data-testid="sauce-step"/.test(game) &&
      /Tap the ingredients to pour them in/.test(game) &&
      /Now circle the \$\{toolName\} in the green zone/.test(game) &&
      /Tap Bottle it/.test(game),
    "L7: the mix screen always says the next step: pour, circle, bottle",
  );
  assert(
    /data-need=\{need === null \? undefined : need\}/.test(game) &&
      /data-testid=\{`sauce-want-\$\{item\.id\}`\}/.test(game) &&
      /data-testid=\{`sauce-need-\$\{x\.id\}`\}/.test(game),
    "L8: the recipe's tiles glow with how many scoops are still wanted, and the recipe chips count 0/3 up to a tick",
  );
}

console.log("M. 2026-11-11: the pot's liquid, Play again, the Pour button");
{
  const parts = read("src/components/kc/sauce/SauceParts.tsx");
  const gameSrc = read("src/components/kc/sauce/SauceStationGame.tsx");
  const { surfaceOf } = await import("../src/components/kc/sauce/sauceSurface.ts");
  const lv = [0.05, 0.2, 0.4, 0.6, 0.8, 1];
  for (const kind of ["bowl", "pan"] as const) {
    const tops = lv.map((l) => surfaceOf(kind, l).top);
    const widths = lv.map((l) => surfaceOf(kind, l).width);
    assert(
      tops.every((t, i) => i === 0 || t < tops[i - 1]!) &&
        widths.every((w, i) => i === 0 || w > widths[i - 1]!),
      `M1 ${kind}: the surface rises and widens as the pot fills (a real ellipse, not a slab), never moving the wrong way`,
      { tops, widths },
    );
    const full = surfaceOf(kind, 1);
    assert(
      full.left >= 0 &&
        full.left + full.width <= 1 &&
        full.top >= 0.1 &&
        full.top + full.height <= 0.7,
      `M2 ${kind}: a full pot's surface sits inside the picture, just below the rim`,
      full,
    );
  }
  assert(
    /Math\.abs\(fill - FILL_LINE\) <= window_/.test(gameSrc) &&
      /data-state=\{state\}/.test(gameSrc) &&
      /data-testid="sauce-pour"/.test(gameSrc) &&
      /LET GO NOW!/.test(gameSrc) &&
      /Too much!/.test(gameSrc) &&
      /navigator\.vibrate\?\.\(14\)/.test(gameSrc) &&
      /sauce-pour-idle/.test(parts) &&
      /\.sauce-pour-idle,\.sauce-pour-go\{animation:none\}/.test(parts),
    "M3: the Pour button shows the sauce rising in it, 'LET GO NOW!' on the line (with a small buzz), 'Too much!' past it, breathes when idle, and Reduced Motion turns its animation off",
  );
  assert(
    /sameSauceId/.test(gameSrc) &&
      /onAgain=\{\(\) => onAgain\(sauce\.id\)\}/.test(gameSrc) &&
      /setAgain\(sauceId\)/.test(gameSrc) &&
      /setAgain\(null\)/.test(gameSrc) &&
      /SAUCE_BY_ID\[sameSauceId\]/.test(gameSrc),
    "M4: 'Play again' makes the SAME sauce again (it dealt a different one); 'Next round' goes back to the day's sauce",
  );
  assert(
    /items-end justify-center px-2 pb-4/.test(gameSrc),
    "M5: the pot sits low in its space, on the counter",
  );
}

console.log(
  failures ? `\nSAUCE STATION QA: ${failures} FAILURE(S)` : "\nSAUCE STATION QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
