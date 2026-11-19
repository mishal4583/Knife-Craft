/**
 * DIFFICULTY RAMP QA (developer 2026-11-11: "increase the amount of things to check gradually: sorting to the fridge, sorting to the shelves, the Fridge
 * Check, the delivery check"). The five-tier tables used to be flat for 10-20 levels; business/difficultyRamp.ts moves each number smoothly toward the
 * next tier's value, and equals the tier's own on its first level.
 *
 *  A. The helper: the ends, rounding, never outside [a, b], flat after the last tier.
 *  B. Each game: equal to the tier's own number on every tier's first level; never goes down as the level rises; and the first 20 levels (the
 *     part a new player lives in) really climb: more than one step.
 *  C. Nothing else moves: no money, no stock (the ramp is pure numbers).
 *
 * Run: npx tsx scripts/difficulty-ramp-qa.mts
 */
import fs from "node:fs";
import { rampBetween, rampOf } from "../src/game/business/difficultyRamp.ts";
import {
  SAUCE_TIERS,
  tierAt as sauceTier,
  tierNumberAt as sauceTierNumber,
} from "../src/game/business/sauceStation.ts";
import { CAR_PARK_TIERS, carParkTierAt } from "../src/game/business/carPark.ts";
import { CRATE_TIERS, crateTierAt } from "../src/game/business/crateDispatch.ts";
import { DIFFICULTY, difficultyAt } from "../src/game/business/fridgeSort.ts";
import { TIERS, tierAt as stockTier } from "../src/game/business/stockroomSort.ts";
import { INSPECTION_TIERS } from "../src/game/business/deliveryInspection.ts";
import { checkTiers, checkTierAt } from "../src/game/restaurant/fridgeCheck.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const levels = Array.from({ length: 100 }, (_, i) => i + 1);
const nonDecreasing = (xs: number[]) => xs.every((x, i) => i === 0 || x >= xs[i - 1]!);
const distinct = (xs: number[]) => new Set(xs).size;

console.log("A. The helper");
assert(
  rampBetween(3, 3, 14, 8, 10) === 8 &&
    rampBetween(14, 3, 14, 8, 10) === 10 &&
    rampBetween(1, 3, 14, 8, 10) === 8 &&
    rampBetween(99, 3, 14, 8, 10) === 10 &&
    rampBetween(9, 3, 3, 8, 10) === 8,
  "A1: a at the start, b at the end, clamped outside, a flat span is a",
);
assert(
  levels.every((l) => {
    const v = rampBetween(l, 4, 30, 5, 12);
    return Number.isInteger(v) && v >= 5 && v <= 12;
  }),
  "A2: whole numbers, never outside [a, b]",
);
assert(rampOf(DIFFICULTY, 500, (t) => t.maxTokens) === 22, "A3: the last tier is flat");

console.log("B. The games");
{
  assert(
    DIFFICULTY.every(
      (t) =>
        difficultyAt(t.from).maxTokens === t.maxTokens &&
        difficultyAt(t.from).minTargets === t.minTargets,
    ) && TIERS.every((t) => stockTier(t.from).maxSets === t.maxSets),
    "B1: on every tier's first level Fridge Sort and Stockroom Sort are exactly the tier's own numbers",
  );
  const fs = levels.map((l) => difficultyAt(l).maxTokens);
  const st = levels.map((l) => stockTier(l).maxSets);
  assert(
    nonDecreasing(fs) && nonDecreasing(st),
    "B2: Fridge Sort's basket and Stockroom Sort's board never shrink as the levels rise",
  );
  assert(
    distinct(levels.filter((l) => l >= 4 && l <= 20).map((l) => difficultyAt(l).maxTokens)) >= 3 &&
      distinct(levels.filter((l) => l >= 6 && l <= 20).map((l) => stockTier(l).maxSets)) >= 2,
    "B3: in the first 20 levels the basket has at least 3 sizes (it was one: 8) and the board at least 2 (it was one: 2 sets)",
    {
      sort: levels.filter((l) => l >= 4 && l <= 20).map((l) => difficultyAt(l).maxTokens),
      stock: levels.filter((l) => l >= 6 && l <= 20).map((l) => stockTier(l).maxSets),
    },
  );
  assert(
    INSPECTION_TIERS.every(
      (t, i, all) =>
        i === 0 || (t.items[1] >= all[i - 1]!.items[1] && t.defects[1] >= all[i - 1]!.defects[1]),
    ),
    "B4: the delivery check's tiers only grow (more to look over, more to find)",
  );
  const ck = levels.map((l) => checkTierAt(l));
  assert(
    checkTiers().every(
      (t) =>
        checkTierAt(t.from).maxCards === t.maxCards && checkTierAt(t.from).minCards === t.minCards,
    ) &&
      nonDecreasing(ck.map((t) => t.maxCards)) &&
      nonDecreasing(ck.map((t) => t.minCards)) &&
      nonDecreasing(ck.map((t) => t.minBin)) &&
      nonDecreasing(ck.map((t) => t.minUse)),
    "B5: the Fridge Check's deck (cards, Bin, Use next) equals the tier on its first level and never shrinks",
  );
}

console.log(
  "B2. The Sauce Station, the Car Park and Unload the Van (developer 2026-11-19: every mini-game climbs level by level)",
);
{
  assert(
    SAUCE_TIERS.every((t) => {
      const s = sauceTier(t.from);
      return (
        s.cap === t.cap &&
        s.timeMs === t.timeMs &&
        s.tastes === t.tastes &&
        s.tolerance === t.tolerance &&
        s.oilLimit === t.oilLimit &&
        s.bottles === t.bottles &&
        s.window === t.window
      );
    }),
    "S1: on every tier's first level the Sauce Station is exactly the tier's own numbers",
  );
  const sauceLv = levels.filter((l) => l >= 7);
  assert(
    nonDecreasing(sauceLv.map((l) => sauceTier(l).cap)) &&
      nonDecreasing(sauceLv.map((l) => -sauceTier(l).timeMs)) &&
      nonDecreasing(sauceLv.map((l) => -sauceTier(l).tolerance)) &&
      nonDecreasing(sauceLv.map((l) => -sauceTier(l).oilLimit)) &&
      nonDecreasing(sauceLv.map((l) => sauceTier(l).bottles)) &&
      nonDecreasing(sauceLv.map((l) => -sauceTier(l).window)) &&
      nonDecreasing(sauceLv.map((l) => -sauceTier(l).tastes)),
    "S2: the Sauce Station never gets easier as the level rises (clock, tolerance, oil limit, window, Taste looks only shrink; bowl and bottles only grow)",
  );
  assert(
    distinct(levels.filter((l) => l >= 7 && l <= 39).map((l) => sauceTier(l).timeMs)) >= 6 &&
      sauceTierNumber(7) === 1 &&
      sauceTierNumber(39) === 1 &&
      sauceTierNumber(40) === 2 &&
      sauceTierNumber(91) === 4,
    "S3: Levels 7-39 climb (the clock was one flat 90 s) and the tier numbers are unchanged",
  );
  const same = (a: any, b: any, keys: string[]) =>
    keys.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
  assert(
    CAR_PARK_TIERS.every((t) =>
      same(carParkTierAt(t.from), t, ["minVehicles", "maxVehicles", "minFree", "maxFree", "chain"]),
    ) &&
      CRATE_TIERS.every((t) =>
        same(crateTierAt(t.from), t, ["bricks", "colors", "wallCells", "minWaves", "maxFree"]),
      ),
    "P1: on every tier's first level the Car Park and Unload the Van are exactly the tier's own numbers",
  );
  const cp = levels.filter((l) => l >= 15).map(carParkTierAt);
  const cr = levels.filter((l) => l >= 18).map(crateTierAt);
  assert(
    nonDecreasing(cp.map((t) => t.minVehicles)) &&
      nonDecreasing(cp.map((t) => t.maxVehicles)) &&
      nonDecreasing(cp.map((t) => -t.minFree)) &&
      nonDecreasing(cp.map((t) => -t.maxFree)) &&
      nonDecreasing(cp.map((t) => t.chain)) &&
      nonDecreasing(cr.map((t) => t.bricks[0])) &&
      nonDecreasing(cr.map((t) => t.bricks[1])) &&
      nonDecreasing(cr.map((t) => t.colors)) &&
      nonDecreasing(cr.map((t) => t.wallCells[1])) &&
      nonDecreasing(cr.map((t) => t.minWaves)) &&
      nonDecreasing(cr.map((t) => -t.maxFree)),
    "P2: the Car Park and Unload the Van never get easier as the level rises",
  );
  assert(
    distinct(levels.filter((l) => l >= 15 && l <= 31).map((l) => carParkTierAt(l).maxVehicles)) >=
      4 &&
      distinct(levels.filter((l) => l >= 18 && l <= 44).map((l) => crateTierAt(l).bricks[1])) >= 3,
    "P3: the Car Park's Levels 15-31 and the Van's Levels 18-44 really climb (they were two flat lots)",
  );
}

console.log("C. Pure");
{
  const src = fs
    .readFileSync("src/game/business/difficultyRamp.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert(
    !/credits|economyLedger|Math\.random|inventory|save/i.test(src),
    "C1: the ramp is pure numbers: no money, stock, ledger, save or randomness",
  );
}

console.log(
  failures === 0
    ? "\nDIFFICULTY RAMP QA: ALL PASS"
    : `\nDIFFICULTY RAMP QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
