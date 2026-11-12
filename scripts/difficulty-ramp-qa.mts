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
