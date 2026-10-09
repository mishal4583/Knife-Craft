/**
 * LEVEL GOALS QA (developer 2026-10-09, "Levels 1–15" pass 3;
 * restaurant/levelGoals.ts + levelChecklist.ts). Presentation only.
 *
 *  G  goals come from each Level 1–15 dish's real steps; dishes the engine
 *     can't grade (peel/smash only: L7, L9) get a completion goal;
 *  S  stars are the engine's own grade ladder (CutEvaluator.qualityFor) on
 *     the save's existing best score — ★ Honest, ★★ Clean, ★★★ Masterful;
 *     nothing new saved; never money (no wallet, ledger or reward code);
 *  C  the customer line is the recipe's own authored customerDialogue and
 *     fits two short lines;
 *  K  the checklist is the dish's real steps, ticked by the active step
 *     index (the scene's STEP_STARTED), none for a single-step dish;
 *  I  Level 9+ ingredient list: only the dish's own ingredients (its pool's
 *     dishes before it's rolled), read-only;
 *  D  Grandma: one line for each of Levels 1–15, none duplicated, one per
 *     Level Complete (Pass 1's, reused);
 *  P  Pass 2 review fixes intact; E rewards unchanged; W wiring (restaurant
 *     build only).
 *
 * Run: npx tsx scripts/restaurant-level-goals-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getLevel, getLevels } from "../src/game/levels/LevelManager.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { qualityFor } from "../src/game/CutEvaluator.ts";
import {
  STARS_FOR_GRADE,
  checklistFor,
  customerLineFor,
  dishIngredientsFor,
  goalFor,
  isGraded,
  levelStars,
  starsForScore,
} from "../src/game/restaurant/levelGoals.ts";
import { GRANDMA_LINES, grandmaLineFor } from "../src/game/restaurant/firstLevels.ts";
import { inventoryMenuOf } from "../src/game/restaurant/restaurantMenu.ts";
import { isFirstStockService } from "../src/game/restaurant/firstRestock.ts";
import { paidLevelReward } from "../src/game/levels/levelRewards.ts";
import { addStock } from "../src/game/business/businessInventory.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const level = (n: number) => getLevel(`level-${n}`)!;
const recipesOf = (n: number) => (level(n).recipePoolIds ?? []).map((id) => getCampaignRecipe(id)!);
const at = (n: number, extra: Partial<SaveData> = {}): SaveData => ({
  ...DEFAULT_SAVE,
  levelProgress: {
    currentLevelId: `level-${n}`,
    highestUnlockedLevelId: `level-${n}`,
    completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  },
  ...extra,
});

console.log("G. Goals from the real dish");
{
  const goals = Object.fromEntries(
    Array.from({ length: 15 }, (_, i) => [i + 1, recipesOf(i + 1).map(goalFor)]),
  );
  assert(
    goals[1]!.join() === "Even slices" &&
      goals[3]!.join() === "Short, even pieces" &&
      goals[5]!.join() === "Clean, even cuts" &&
      goals[6]!.join() === "A neat, even grid" &&
      goals[7]!.join() === "Finish the step cleanly" &&
      goals[9]!.join() === "Finish all 2 steps" &&
      goals[10]!.join() === "Clean, even cuts",
    "G1: a one-step dish names what its cut is judged on, a multi-step dish all its cuts, an ungraded dish completion",
    goals,
  );
  const ungraded = Array.from({ length: 15 }, (_, i) => i + 1).filter(
    (n) => !recipesOf(n).every(isGraded),
  );
  assert(
    ungraded.join() === "7,9",
    "G2: only Level 7 (peel) and Level 9 (peel + smash) are ungraded — the engine scores them a fixed 90",
    ungraded,
  );
}

console.log("S. Stars = the engine's grade");
{
  const scores = [0, 49, 50, 69, 70, 84, 85, 94, 95, 100];
  assert(
    scores.every((x) => starsForScore(x) === STARS_FOR_GRADE[qualityFor(x)]) &&
      scores.map(starsForScore).join() === "0,0,0,0,1,1,2,2,3,3",
    "S1: ★ at Honest (70), ★★ at Clean (85), ★★★ at Masterful (95) — CutEvaluator's own thresholds",
  );
  const played = (best: Record<string, number>) =>
    at(16, {
      recipeProgress: Object.fromEntries(
        Object.entries(best).map(([id, b]) => [id, { best: b, done: true }]),
      ),
    });
  const s = played({
    "camp-sliced-tomato-plate": 96,
    "camp-peeled-potato-bowl": 90,
    "camp-tomato-basil-toast": 72,
    "camp-bruschetta-trio": 88,
  });
  assert(
    levelStars(s, level(1)) === 3 &&
      levelStars(s, level(2)) === null &&
      levelStars(s, level(7)) === null &&
      levelStars(s, level(12)) === 2,
    "S2: from the save's best score (Level 1 ★★★); unplayed → none; ungraded (L7) → none; a pool level takes its best dish (L12 ★★)",
  );
  const goals =
    read("src/game/restaurant/levelGoals.ts") + read("src/game/restaurant/levelChecklist.ts");
  const save = read("src/game/SaveManager.ts");
  assert(
    !/credits|appendLedgerEntry|economyLedger|paidLevelReward/.test(goals) &&
      /recipeProgress: Record<string, \{ best: number \| null; done: boolean \}>/.test(save),
    "S3: stars touch no wallet, ledger or reward code, and add no save field (recipeProgress unchanged)",
  );
}

console.log("C. Customer lines");
{
  const lines = Array.from({ length: 15 }, (_, i) => recipesOf(i + 1)).flat();
  assert(
    lines.every(
      (r) => customerLineFor(r) === r.customerDialogue && r.customerDialogue.length > 0,
    ) && lines.every((r) => r.customerDialogue.length <= 64),
    "C1: the recipe's own customerDialogue for every Level 1–15 dish, at most 64 characters (two lines at 320 px)",
    lines.map((r) => r.customerDialogue.length),
  );
}

console.log("K. Checklist");
{
  const steps = recipesOf(5)[0]!.components.map((c) => ({
    ingredientId: c.ingredientId,
    techniqueId: c.technique,
  }));
  const k0 = checklistFor(steps, 0, false);
  const k1 = checklistFor(steps, 1, false);
  const kDone = checklistFor(steps, 2, true);
  const single = recipesOf(1)[0]!.components.map((c) => ({
    ingredientId: c.ingredientId,
    techniqueId: c.technique,
  }));
  assert(
    k0.map((c) => c.label).join("|") === "Onion — peel|Onion — halve|Onion — slice" &&
      k0.map((c) => c.state).join() === "now,todo,todo" &&
      k1.map((c) => c.state).join() === "done,now,todo" &&
      kDone.every((c) => c.state === "done") &&
      checklistFor(single, 0, false).length === 0,
    "K1: Level 5's real steps (peel → halve → slice), ticked by the active step; none for a one-step dish",
  );
}

console.log("I. Ingredient list (Level 9+)");
{
  const s = at(9, {
    business: {
      ...DEFAULT_SAVE.business,
      inventory: addStock({}, "garlic", 0.1, 0, 1),
    },
  });
  const before = JSON.stringify(s);
  const l9 = dishIngredientsFor(s, level(9));
  const l12 = dishIngredientsFor(at(12), level(12));
  assert(
    l9.length === 1 &&
      l9[0]!.dish === "Smashed Garlic Prep" &&
      l9[0]!.rows.map((r) => r.ingredientId).join() === "garlic" &&
      l9[0]!.rows[0]!.have === 0.1 &&
      JSON.stringify(s) === before &&
      l12.map((d) => d.dish).join("|") === "Tomato Basil Toast|Bruschetta Trio",
    "I1: Level 9 lists only its dish's garlic with the fridge's amount, changes nothing; a pool level (12) lists its two possible dishes",
    { l9, l12: l12.map((d) => d.dish) },
  );
}

console.log("D. Grandma's lines");
{
  const app = read("src/App.tsx");
  const lines = Array.from({ length: 15 }, (_, i) => grandmaLineFor(i + 1));
  assert(
    lines.every((l) => !!l && l.length <= 64) &&
      new Set(lines).size === 15 &&
      Object.keys(GRANDMA_LINES).length === 15 &&
      (app.match(/grandmaLineFor\(/g) ?? []).length === 1,
    "D1: one short line for each of Levels 1–15, none repeated, shown once per Level Complete (Pass 1's, reused)",
  );
}

console.log("P. Pass 2 review fixes intact");
{
  assert(
    inventoryMenuOf(at(3)).length === 0 &&
      inventoryMenuOf(at(11)).length === 4 &&
      isFirstStockService(at(15), 15) &&
      !isFirstStockService(at(16), 16),
    "P1: Inventory menu by level (none at L3, 4 at L11); the Level 15 hand-over by progression",
  );
}

console.log("E. Rewards unchanged");
{
  const expected = [
    5000, 5200, 5500, 5800, 6100, 6400, 6800, 7200, 7600, 8000, 8000, 8300, 8600, 8900, 9200,
  ];
  assert(
    getLevels()
      .slice(0, 15)
      .every((l, i) => l.id === `level-${i + 1}` && paidLevelReward(l) === expected[i]),
    "E1: Levels 1–15 keep their order and completion rewards",
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  const prep = read("src/components/kc/game/Preparation.tsx");
  const hud = read("src/components/kc/game/GameHUD.tsx");
  const kitchen = read("src/components/kc/Kitchen.tsx");
  assert(
    /RESTAURANT_MODE && isCampaignService && campaignServiceSession/.test(app) &&
      /checklistFor\(steps, activeStep\.index, phase !== "prep"\)/.test(prep) &&
      /data-testid="hud-checklist"/.test(hud) &&
      /data-testid="hud-goal"/.test(hud) &&
      /data-testid="hud-customer-line"/.test(hud) &&
      /RESTAURANT_MODE && completed && hasLevelGoals/.test(kitchen) &&
      /<DishIngredientsToggle save=\{save\} level=\{level\} \/>/.test(kitchen),
    "W1: the HUD (restaurant build, Levels 1–15) shows the line, goal and checklist; the board shows stars and the ingredient list",
  );
}

console.log(failures ? `LEVEL GOALS QA: ${failures} FAILURE(S)` : "LEVEL GOALS QA: ALL PASS");
process.exit(failures ? 1 : 0);
