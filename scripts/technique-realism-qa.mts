/**
 * TECHNIQUE REALISM QA (developer 2026-11-25: "in the sliced and diced beef level only one steak is present and it is only diced"; "it shows rock mince and while cutting it only requires
 * slicing ... check all levels because there are similar issues, don't reduce the realism of the game").
 *
 *  A  Rock Mince is a real mince: a fine GRID cut both ways (5 x 5 = 10 cuts, finer than Dice's 3 x 3 = 6), not the 12 parallel taps that played exactly like Slice;
 *  B  its how-to card teaches both ways (and still right to left);
 *  C  a dish never takes ONE piece through two different portion cuts (slice then dice, dice then chop, ...): the second cut is a FRESH piece (`chainBreak`). A cut that follows a peel or a halve is
 *     the normal chain (peel then dice, halve then slice) and is unaffected;
 *  D  a recipe whose instruction says "a fresh one" really gives a fresh piece, and the four dishes found in the audit (Sliced & Diced Steak, Onion Two Ways, Potato, Two Ways, Bruschetta Trio) do;
 *  E  the stock and cost rules count the fresh piece (two steaks for Sliced & Diced Steak), so the Market, the Pre-Service Check and the food cost agree with what is on the board;
 *  F  every step of every recipe uses a technique its ingredient allows (nothing is asked that the food cannot do).
 *
 * Run: npx tsx scripts/technique-realism-qa.mts
 */
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { INGREDIENTS, TECHNIQUES, requiredCutsFor } from "../src/game/definitions.ts";
import { COACH_TEXT } from "../src/game/coaching.ts";
import { ingredientInstancesFor } from "../src/game/economy/EconomySettlement.ts";

let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}

console.log("A. Rock Mince is a fine grid");
{
  const r = TECHNIQUES.rockMince;
  const d = TECHNIQUES.dice;
  assert(
    r.guideType === "grid" &&
      r.perpSnap === true &&
      r.continuousTap === false &&
      r.interactionMode === "cut",
    "A1: Rock Mince is a grid cut (rows, then the cross cuts), not parallel taps",
    { guideType: r.guideType, continuousTap: r.continuousTap },
  );
  assert(
    !!r.counts && r.counts.h === 5 && r.counts.v === 5 && requiredCutsFor(r) === 10,
    "A2: 5 x 5 = 10 cuts",
    { counts: r.counts, cuts: requiredCutsFor(r) },
  );
  assert(
    !!r.counts &&
      !!d.counts &&
      r.counts.h > d.counts.h &&
      r.counts.v > d.counts.v &&
      requiredCutsFor(r) > requiredCutsFor(d),
    "A3: finer than Dice (a mince is smaller than a dice)",
    { mince: r.counts, dice: d.counts },
  );
  assert(
    requiredCutsFor(r) !== requiredCutsFor(TECHNIQUES.slice) ||
      r.guideType !== TECHNIQUES.slice.guideType,
    "A4: it no longer plays exactly like Slice",
  );
  assert(
    r.knifeProfile === "chop" && r.unlockLevel > 1,
    "A5: it keeps Chop's quick rocking knife cadence and stays a later-unlocked technique",
    { knife: r.knifeProfile, unlock: r.unlockLevel },
  );
}

console.log("B. The how-to card");
{
  const how = COACH_TEXT.rockMince.how;
  assert(
    /right/i.test(how) && /other way|both ways/i.test(how),
    "B1: the card teaches right to left AND the cross cuts (both ways)",
    how,
  );
}

console.log("C. One piece is never taken through two portion cuts");
const PORTION = new Set(["slice", "dice", "julienne", "chop", "chiffonade", "rockMince"]);
{
  const bad: unknown[] = [];
  for (const r of CAMPAIGN_RECIPES) {
    for (let i = 1; i < r.components.length; i++) {
      const prev = r.components[i - 1]!;
      const c = r.components[i]!;
      if (
        prev.ingredientId === c.ingredientId &&
        !c.chainBreak &&
        PORTION.has(prev.technique) &&
        PORTION.has(c.technique)
      )
        bad.push({
          recipe: r.id,
          ingredient: c.ingredientId,
          cuts: `${prev.technique} then ${c.technique} on one piece`,
        });
    }
  }
  assert(
    bad.length === 0,
    `C1: across all ${CAMPAIGN_RECIPES.length} recipes, no ingredient is sliced/diced/chopped and then cut again as the SAME piece (each second cut is a fresh piece)`,
    bad.slice(0, 5),
  );
}

console.log("D. The dishes found in the audit");
{
  const get = (id: string) => CAMPAIGN_RECIPES.find((r) => r.id === id)!;
  // a fresh piece starts at a component with chainBreak: the cut itself (steak, tomato) or, for a food that must be peeled, the PEEL of the fresh one (onion, potato)
  const fresh = (id: string, ingredient: string, technique: string) =>
    get(id).components.some(
      (c) =>
        c.ingredientId === ingredient &&
        (c.technique === technique || c.technique === "peel") &&
        c.chainBreak === true,
    );
  assert(
    fresh("camp-steak-slice-dice", "steak", "dice") &&
      /fresh one/i.test(get("camp-steak-slice-dice").chefInstruction),
    "D1: Sliced & Diced Steak slices one steak and dices a fresh one",
  );
  assert(
    fresh("camp-onion-two-ways", "onion", "dice") &&
      /fresh onion/i.test(get("camp-onion-two-ways").chefInstruction),
    "D2: Onion Two Ways slices one onion and dices a fresh one",
  );
  assert(
    fresh("camp-indian-potato-branch", "potato", "chop") &&
      /fresh one/i.test(get("camp-indian-potato-branch").chefInstruction),
    "D3: Potato, Two Ways dices one potato and chops a fresh one",
  );
  assert(
    fresh("camp-bruschetta-trio", "tomato", "slice") &&
      /fresh one/i.test(get("camp-bruschetta-trio").chefInstruction),
    "D4: Bruschetta Trio dices one tomato and slices a fresh one",
  );
  const claims = CAMPAIGN_RECIPES.filter((r) =>
    /\bfresh one\b|\ba fresh\b/i.test(r.chefInstruction),
  );
  const liars = claims.filter((r) => !r.components.some((c) => c.chainBreak === true));
  assert(
    claims.length >= 10 && liars.length === 0,
    "D5: every recipe that says 'a fresh one' really gives a fresh piece",
    { claims: claims.length, liars: liars.map((r) => r.id) },
  );
}

console.log("E. The fresh piece is counted");
{
  const r = CAMPAIGN_RECIPES.find((x) => x.id === "camp-steak-slice-dice")!;
  const steaks = ingredientInstancesFor(r).filter((i) => i.ingredientId === "steak");
  assert(
    steaks.length === 2,
    "E1: Sliced & Diced Steak uses TWO steaks in the stock and cost rules (one sliced, one diced)",
    steaks.length,
  );
  const onion = ingredientInstancesFor(
    CAMPAIGN_RECIPES.find((x) => x.id === "camp-onion-two-ways")!,
  ).filter((i) => i.ingredientId === "onion");
  assert(onion.length === 2, "E2: Onion Two Ways uses two onions", onion.length);
  const potato = ingredientInstancesFor(
    CAMPAIGN_RECIPES.find((x) => x.id === "camp-indian-potato-branch")!,
  ).filter((i) => i.ingredientId === "potato");
  assert(potato.length === 2, "E3: Potato, Two Ways uses two potatoes, each peeled", potato.length);
}

console.log("F. Every step is something the food can do");
{
  const bad: string[] = [];
  for (const r of CAMPAIGN_RECIPES)
    for (const c of r.components) {
      const ing = (INGREDIENTS as Record<string, { techniques: readonly string[] }>)[
        c.ingredientId
      ];
      if (!ing || !ing.techniques.includes(c.technique))
        bad.push(`${r.id}: ${c.ingredientId} ${c.technique}`);
    }
  assert(
    bad.length === 0,
    "F1: no recipe asks an ingredient for a technique it does not allow",
    bad.slice(0, 5),
  );
}

console.log(
  failures ? `\nTECHNIQUE REALISM QA: ${failures} FAILED` : "\nTECHNIQUE REALISM QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
