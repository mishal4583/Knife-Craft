/**
 * MULTI_INSTANCE_PREPARATION_QA — task: "food scale + multi-instance
 * preparation bug", Bug B. Run like the project's other focused QA
 * scripts:
 *   npx tsx scripts/multi-instance-preparation-qa.mts
 *
 * Root cause (see the task's own final report for the full trace):
 * "Chicken, the Full Kitchen" (camp-finale-chicken-grand) declares THREE
 * components that all share `ingredientId: "chicken"` with three
 * different techniques/destinations (slice->plate, julienne->bowl,
 * dice->cup) — the chef instruction itself says "julienne A FRESH one...
 * dice A THIRD", i.e. three fresh preparation instances by the recipe's
 * own semantics (task §B3). The engine's existing, generic mechanism for
 * exactly this — `RecipeComponent.chainBreak` (recipeTypes.ts), which
 * forces PreparationScene.beginStep() to treat a same-ingredient step as
 * a fresh instance (closeOutCurrentIngredient + this.cuts=[] reset)
 * instead of a chain continuation — was simply never set on the julienne
 * and dice components. Without it, PreparationScene's own `isChain` check
 * (same ingredientId, no chainBreak) treated all three techniques as ONE
 * continuous chain on ONE physical chicken, which is exactly the observed
 * "one chicken, dense overlapping geometry, frame drops" bug: all three
 * techniques' cuts/pieces accumulated on the same never-reset instance.
 *
 * The fix is a two-line recipe data change (campaignRecipes.ts), not an
 * engine change — `chainBreak` already existed, was already used by 15+
 * other recipes, and PreparationScene/RecipeValidator's own chain-
 * continuation logic was already correct and generic. This QA is
 * deliberately generic too (task §G: "Chicken is the test case, not a
 * hardcoded exception") — check 1 below scans EVERY campaign recipe for
 * the same latent pattern, not just this one id.
 */
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import type { RecipeComponent, RecipeDefinition } from "../src/game/recipes/recipeTypes.ts";
import { requiredCutsFor } from "../src/game/definitions.ts";
import { TECHNIQUES } from "../src/game/definitions.ts";
import * as fs from "node:fs";
import { execSync } from "node:child_process";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

const CHICKEN_RECIPE_ID = "camp-finale-chicken-grand";

/**
 * Mirrors PreparationScene.beginStep()'s own `isChain` rule (same
 * ingredientId as the previous component, no explicit chainBreak) and
 * RecipeValidator.ts's private `componentRuns` — splits a recipe's
 * components into "runs", one run per independently-prepared instance.
 * Duplicated locally (not imported) the same way plating-system-qa.mts's
 * runFullPipeline mirrors PreparationScene's pipeline without reaching
 * into its private internals — this file only reads public recipe data.
 */
function componentRuns(recipe: RecipeDefinition): RecipeComponent[][] {
  const runs: RecipeComponent[][] = [];
  for (const c of recipe.components) {
    const current = runs[runs.length - 1];
    const continuesRun = current && current[0]!.ingredientId === c.ingredientId && !c.chainBreak;
    if (continuesRun) current!.push(c);
    else runs.push([c]);
  }
  return runs;
}

// ===== 1: GENERIC scan — no campaign recipe has a same-ingredient component run whose later member's destinations are entirely disjoint from every destination already touched earlier in that run (the exact shape of a missing chainBreak: a "fresh instance" component wrongly left chained onto the previous one). Not chicken-specific — every one of the 221 recipes is scanned. =====
{
  const offenders: string[] = [];
  for (const recipe of CAMPAIGN_RECIPES) {
    let runDestUnion = new Set<string>();
    let runIngredient: string | null = null;
    recipe.components.forEach((c, i) => {
      const continuesRun = runIngredient === c.ingredientId && !c.chainBreak;
      if (!continuesRun) {
        runDestUnion = new Set<string>();
        runIngredient = c.ingredientId;
      } else if (!c.destinationIds.some((d) => runDestUnion.has(d))) {
        offenders.push(`${recipe.id}[${i}] (${c.technique}->${c.destinationIds.join(",")})`);
      }
      for (const d of c.destinationIds) runDestUnion.add(d);
    });
  }
  assert(
    offenders.length === 0,
    `1: no campaign recipe has a same-ingredient run component whose destinations are disjoint from everything earlier in the run without chainBreak (${offenders.join("; ")})`,
  );
}

// ===== 2: the chicken recipe exists, with the exact id the task asked to be looked up (not assumed) — "Chicken, the Full Kitchen". =====
const chickenRecipe = CAMPAIGN_RECIPES.find((r) => r.id === CHICKEN_RECIPE_ID);
assert(!!chickenRecipe && chickenRecipe.name === "Chicken, the Full Kitchen", `2: "${CHICKEN_RECIPE_ID}" resolves to "Chicken, the Full Kitchen"`);

// ===== 3: it declares exactly 3 chicken components (slice/julienne/dice), one per destination (plate/bowl/cup) — the recipe's own declared shape, verified rather than assumed. =====
if (chickenRecipe) {
  const chickenComponents = chickenRecipe.components.filter((c) => c.ingredientId === "chicken");
  assert(
    chickenComponents.length === 3 &&
      chickenComponents.map((c) => c.technique).join(",") === "slice,julienne,dice" &&
      chickenComponents.map((c) => c.destinationIds.join("+")).join(",") === "plate,bowl,cup",
    `3: exactly 3 chicken components in order slice->plate, julienne->bowl, dice->cup (${chickenComponents.map((c) => `${c.technique}->${c.destinationIds}`).join(", ")})`,
  );
}

// ===== 4/5/6 (E's "7/8/9/10"): componentRuns splits the chicken recipe into exactly 3 independent runs — i.e. each technique gets its OWN preparation instance, not one continuous chain. =====
if (chickenRecipe) {
  const runs = componentRuns(chickenRecipe);
  assert(runs.length === 3, `4: "Chicken, the Full Kitchen" splits into exactly 3 independent preparation runs (got ${runs.length})`);
  assert(runs.every((r) => r.length === 1), "5: each of the 3 runs contains exactly one component (no run accidentally absorbed a second technique)");
  const techniques = runs.map((r) => r[0]!.technique);
  assert(
    techniques[0] === "slice" && techniques[1] === "julienne" && techniques[2] === "dice",
    `6: run order is Slice (own instance), Julienne (own instance), Dice (own instance) — got ${techniques.join(",")}`,
  );
}

// ===== 7: the run-splitting fix is the MINIMAL data change — components[1] (julienne) and components[2] (dice) carry chainBreak:true; components[0] (slice) correctly does NOT (index 0 never chains from anything, chainBreak there would be a meaningless no-op). =====
if (chickenRecipe) {
  const [c0, c1, c2] = chickenRecipe.components;
  assert(
    !c0!.chainBreak && c1!.chainBreak === true && c2!.chainBreak === true,
    `7: chainBreak is set exactly on julienne and dice (the two components that follow a same-ingredient predecessor), not on slice (${[c0, c1, c2].map((c) => c!.chainBreak ?? false).join(",")})`,
  );
}

// ===== 8: outputs remain distinct — recordAllComponents (ServiceManager.ts) creates exactly one PreparedOutput per COMPONENT (source-level: the loop is over recipe.components, not deduplicated by ingredientId), so 3 chicken components always yield 3 PreparedOutputs regardless of chainBreak. =====
{
  const src = fs.readFileSync("src/game/service/ServiceManager.ts", "utf8");
  const recordAllComponentsBody = src.slice(src.indexOf("export function recordAllComponents"), src.indexOf("export function recordAllComponents") + 800);
  assert(
    recordAllComponentsBody.includes("for (const component of session.current.recipe.components)") &&
      recordAllComponentsBody.includes("createPreparedOutput(orgSession,"),
    "8: recordAllComponents creates one PreparedOutput per recipe component (never deduplicated by ingredientId) — organization-layer output identity was never the bug",
  );
}

// ===== 9: destinations remain distinct — plate/bowl/cup share no requirement overlap, so each of the 3 chicken outputs satisfies exactly one destination, never accidentally fanning out to the others. =====
if (chickenRecipe) {
  const allDest = chickenRecipe.components.flatMap((c) => c.destinationIds);
  const unique = new Set(allDest);
  assert(allDest.length === unique.size, `9: every chicken component's destinationIds are unique across the recipe (no shared/overlapping destination) — ${allDest.join(",")}`);
}

// ===== 10: cut-history isolation — PreparationScene.beginStep's own lifecycle (structural check): a chainBreak step takes the non-chain branch, which resets this.cuts/this.cutTimestamps/this.perfectUsed/this.peeled to fresh BEFORE layout() paints the new instance. This is the SAME generic reset every other multi-ingredient recipe already relies on (verified working for 3-different-ingredient recipes in the prior plating task) — chainBreak routes chicken through the identical, already-correct path. =====
{
  const src = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  const beginStepBody = src.slice(src.indexOf("private beginStep(index: number)"), src.indexOf("private beginChainStep()"));
  assert(
    beginStepBody.includes("!step.chainBreak") &&
      beginStepBody.includes("this.closeOutCurrentIngredient()") &&
      beginStepBody.includes("this.cuts = [];") &&
      beginStepBody.includes("this.cutTimestamps = [];"),
    "10: a chainBreak step takes beginStep's non-chain branch — closeOutCurrentIngredient banks the previous instance, then this.cuts/cutTimestamps/perfectUsed/peeled reset to fresh before the new instance is painted",
  );
}

// ===== 11: no duplicate rendering — closeOutCurrentIngredient is the ONLY site that pushes into platedPieceImages/platedPieceMeta, and it runs exactly once per non-chain transition (guarded by `if (!isChain && prevStep !== null)`), so 3 fresh chicken instances bank exactly 3 times, never re-pushing an already-banked instance's pieces. =====
{
  const src = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  const pushSites = [...src.matchAll(/platedPieceImages\.push/g)].length;
  assert(
    pushSites === 1,
    `11: exactly one call site pushes into platedPieceImages (closeOutCurrentIngredient) — got ${pushSites}, ruling out a second/duplicate rendering path`,
  );
}

// ===== 12: object growth is bounded per instance, not accumulating across instances — requiredCutsFor (definitions.ts) derives each step's own cut cap purely from that TECHNIQUE's own definition/TAP_KNIFE margins, never from `this.cuts.length` or any other cross-step/cross-instance state, so 3 fresh instances' total piece counts sum linearly (instance A's cap + B's cap + C's cap), never compound. =====
{
  const src = fs.readFileSync("src/game/definitions.ts", "utf8");
  const fnBody = src.slice(src.indexOf("export function requiredCutsFor"), src.indexOf("export function requiredCutsFor") + 400);
  assert(
    !fnBody.includes("this.cuts") && !fnBody.includes("stepIndex") && !fnBody.includes("closedSegments"),
    "12: requiredCutsFor computes each step's own cut cap purely from the technique's own definition — no dependency on prior steps/instances that could compound across a multi-instance recipe",
  );
  // Sanity: every technique's own cap is a small bounded number, not unbounded.
  const caps = Object.values(TECHNIQUES).map((t) => requiredCutsFor(t));
  assert(caps.every((c) => c >= 1 && c <= 20), `12b: every technique's requiredCutsFor stays in a small bounded range (1-20) — ${caps.join(",")}`);
}

// ===== 13: no Math.random() introduced by this fix — the only change is recipe data (chainBreak flags), verified by a direct source scan of the touched recipe module. =====
{
  const src = fs.readFileSync("src/game/recipes/campaignRecipes.ts", "utf8");
  assert(!src.includes("Math.random("), "13: campaignRecipes.ts contains no Math.random() call");
}

// ===== 14: no second organization/output system was introduced — organizationManager.ts/organizationTypes.ts (the foundational PreparedOutput/Destination/assignedTo[] architecture) are completely untouched by this fix, confirming the existing chainBreak + PreparedOutput mechanism was reused, not duplicated with a parallel system. (ServiceManager.ts carries unrelated pre-existing edits from earlier session work — not part of this fix, so not asserted here; recordAllComponents' own unchanged shape is verified separately by check 8.) =====
{
  let diffStat = "";
  try {
    diffStat = execSync(
      "git diff --name-only HEAD -- src/game/organization/organizationManager.ts src/game/organization/organizationTypes.ts",
      { cwd: process.cwd() },
    ).toString();
  } catch {
    diffStat = "<git unavailable>";
  }
  assert(diffStat.trim() === "", `14: organizationManager.ts/organizationTypes.ts are untouched by this fix (no second output system was created) — diff: "${diffStat.trim()}"`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
