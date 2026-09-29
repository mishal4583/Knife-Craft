/**
 * PREP SOFT-LOCK QA — no preparation session can get stuck.
 *
 * Bug this guards (reported): in "Tomato & Onion Salad" a tap released
 * after the tomato finished cut the onion without peeling it, and the
 * onion step could never finish — PreparationScene refuses every cut on a
 * must-peel ingredient (onion, potato, garlic…) until it is peeled, and the
 * recipe had no Peel step, so the session was a guaranteed soft-lock.
 *
 *  A. The step normalizer (prepStepGuards.ts): inserts the missing Peel,
 *     keeps every original step in order, is idempotent, leaves correct
 *     recipes untouched.
 *  B. EVERY playable content source is completable after normalization:
 *     all campaign recipes (campaign orders + Business dishes), the
 *     Restaurant Service test pool, and every level's preparationSteps.
 *  C. Every step names a real ingredient/technique with a finishable target.
 *  D. The scene's input gates: every cut entry point checks the peel gate,
 *     a queued tap is re-validated, and a gesture never crosses a step.
 *  E. Both the HUD (Preparation.tsx) and the scene apply the same normalizer.
 *
 * Run: npx tsx scripts/prep-softlock-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { INGREDIENTS, TECHNIQUES, requiredCutsFor, type IngredientId, type TechniqueId } from "../src/game/definitions.ts";
import { mustPeelBefore, withRequiredPeelSteps } from "../src/game/prepStepGuards.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import { BUSINESS_ONLY_RECIPES, CAMPAIGN_RECIPES, getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { TEST_RECIPE_POOL } from "../src/game/service/testRecipePool.ts";
import { preparationStepsForRecipe } from "../src/game/service/stepsForRecipe.ts";
import { BUSINESS_DISH_CATALOG } from "../src/game/business/businessDishCatalog.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => fs.readFileSync(path.resolve(ROOT, rel), "utf8");

type S = { ingredient: IngredientId; technique: TechniqueId; chainBreak?: boolean };
const norm = (steps: readonly S[]): S[] =>
  withRequiredPeelSteps(
    steps,
    (s) => s,
    (s) => ({ ...s, technique: "peel" as TechniqueId }),
    ({ chainBreak: _d, ...s }) => s,
  );
const key = (steps: readonly S[]) => steps.map((s) => `${s.ingredient}:${s.technique}${s.chainBreak ? "|" : ""}`).join(" > ");

/** Mirrors PreparationScene exactly: a fresh chain resets `peeled`; a must-peel step before the chain is peeled can never accept input. */
function stuckAt(steps: readonly S[]): number {
  let peeled = false;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!;
    const prev = steps[i - 1];
    if (!prev || prev.ingredient !== s.ingredient || s.chainBreak) peeled = false;
    if (s.technique === "peel") peeled = true;
    else if (mustPeelBefore(s.ingredient, s.technique) && !peeled) return i;
  }
  return -1;
}
const isSubsequence = (orig: readonly S[], out: readonly S[]) => {
  let j = 0;
  for (const s of out) if (j < orig.length && s.ingredient === orig[j]!.ingredient && s.technique === orig[j]!.technique) j++;
  return j === orig.length;
};

// ===== A: the normalizer =====
{
  const salad: S[] = [{ ingredient: "tomato", technique: "dice" }, { ingredient: "onion", technique: "dice" }];
  assert(stuckAt(salad) === 1, "A0: the reported recipe (tomato dice → onion dice) really was a soft-lock at the onion step");
  const fixed = norm(salad);
  assert(key(fixed) === "tomato:dice > onion:peel > onion:dice", `A: a Peel step is inserted before the onion — ${key(fixed)}`);
  assert(stuckAt(fixed) === -1, "A2: the fixed recipe can be completed");
  assert(key(norm(fixed)) === key(fixed), "A3: idempotent — normalizing twice changes nothing (HUD and scene stay aligned)");
  const already: S[] = [{ ingredient: "onion", technique: "peel" }, { ingredient: "onion", technique: "halve" }, { ingredient: "onion", technique: "rings" }];
  assert(key(norm(already)) === key(already), "A4: a recipe that already peels first is left untouched");
  const broken: S[] = [{ ingredient: "onion", technique: "halve" }, { ingredient: "onion", technique: "dice", chainBreak: true }];
  const nb = norm(broken);
  assert(stuckAt(nb) === -1 && nb.length === 4 && isSubsequence(broken, nb), `A5: every fresh chain of a must-peel ingredient gets its own Peel (${key(nb)})`);
  const cucumber: S[] = [{ ingredient: "cucumber", technique: "slice" }];
  assert(!mustPeelBefore("cucumber", "slice") && key(norm(cucumber)) === key(cucumber), "A6: peel-decoupled ingredients (cucumber…) are never forced to peel");
}

// ===== B + C: every playable content source =====
function checkSource(label: string, steps: readonly S[], problems: string[]) {
  const out = norm(steps);
  if (stuckAt(out) !== -1) problems.push(`${label}: still stuck at step ${stuckAt(out) + 1} (${key(out)})`);
  if (!isSubsequence(steps, out)) problems.push(`${label}: normalizer dropped or reordered a step`);
  if (key(norm(out)) !== key(out)) problems.push(`${label}: normalizer not idempotent`);
  for (const s of out) {
    const ing = INGREDIENTS[s.ingredient];
    const tech = TECHNIQUES[s.technique];
    if (!ing || !tech) problems.push(`${label}: unknown ingredient/technique ${s.ingredient}:${s.technique}`);
    else if (tech.interactionMode === "cut" && !(requiredCutsFor(tech) > 0)) problems.push(`${label}: ${s.technique} needs no cuts — step could never register`);
  }
}
{
  const recipeSteps = (id: string): S[] => preparationStepsForRecipe(getCampaignRecipe(id)!).map((s) => ({ ingredient: s.ingredient, technique: s.technique, ...(s.chainBreak ? { chainBreak: true } : {}) }));
  const sources: Array<[string, S[]]> = [
    ...CAMPAIGN_RECIPES.map((r) => [`campaign recipe ${r.id}`, recipeSteps(r.id)] as [string, S[]]),
    ...TEST_RECIPE_POOL.map((r) => [`service recipe ${r.id}`, preparationStepsForRecipe(r).map((s) => ({ ingredient: s.ingredient, technique: s.technique }))] as [string, S[]]),
    ...BUSINESS_DISH_CATALOG.map((d) => [`business dish ${d.id}`, recipeSteps(d.sourceRecipeId)] as [string, S[]]),
    ...LEVELS.map((l) => [`level ${l.id}`, l.preparationSteps.map((s) => ({ ingredient: s.ingredient, technique: s.technique, ...(s.chainBreak ? { chainBreak: true } : {}) }))] as [string, S[]]),
  ];
  const problems: string[] = [];
  let fixedCount = 0;
  for (const [label, steps] of sources) {
    if (stuckAt(steps) !== -1) fixedCount++;
    checkSource(label, steps, problems);
  }
  assert(problems.length === 0, `B: all ${sources.length} step lists (${CAMPAIGN_RECIPES.length} campaign recipes, ${TEST_RECIPE_POOL.length} service recipes, ${BUSINESS_DISH_CATALOG.length} business dishes, ${LEVELS.length} levels) are completable after normalization${problems.length ? " — " + problems.slice(0, 5).join("; ") : ""}`);
  console.log(`     (${fixedCount} step lists were soft-locks before the fix and now get their Peel step)`);
  assert([...CAMPAIGN_RECIPES, ...BUSINESS_ONLY_RECIPES].every((r) => stuckAt(recipeSteps(r.id)) === -1), "B2: every campaign recipe and Business-only recipe (the ones campaign orders and Business dishes actually play) was already completable — no campaign content changes");
}

// ===== D: scene input gates =====
{
  const scene = read("src/game/scenes/PreparationScene.ts");
  const body = (name: string) => scene.slice(scene.indexOf(`private ${name}(`), scene.indexOf("\n  }\n", scene.indexOf(`private ${name}(`)));
  assert(/if \(this\.cutBlockedUntilPeeled\(\)\) return;/.test(body("handleTap")), "D: a tap re-checks the peel gate when it is released, not only when pressed");
  assert(/if \(this\.cutBlockedUntilPeeled\(\)\) return;/.test(body("finishCut")) && />= this\.requiredCuts\) return;/.test(body("finishCut")), "D2: a swipe re-checks the peel gate and the step's cut count");
  assert(/if \(this\.cutBlockedUntilPeeled\(\)\) return;/.test(body("onPointerDown")), "D3: pressing still checks the peel gate");
  const replay = scene.slice(scene.indexOf("if (this.queuedTap) {"), scene.indexOf("if (this.queuedTap) {") + 900);
  assert(/!this\.cutBlockedUntilPeeled\(\)/.test(replay) && /interactionMode === "cut"/.test(replay) && /< this\.requiredCuts/.test(replay) && /!this\.pendingRecipePayload/.test(replay), "D4: a queued (buffered) tap is re-validated before it becomes a cut");
  const reset = body("resetInputState");
  assert(/this\.isDragging = false;/.test(reset) && /this\.currentPath = \[\];/.test(reset) && /this\.queuedTap = null;/.test(reset) && /this\.knifeSeq\+\+;/.test(reset), "D5: starting a step drops any in-progress gesture, the queued tap and in-flight knife callbacks");
  assert(/beginChainStep\(\): void \{[\s\S]*?this\.resetInputState\(\);/.test(scene) && /beginFreshIngredient\(\): void \{[\s\S]*?this\.resetInputState\(\);/.test(scene), "D6: both fresh-ingredient and same-ingredient step starts reset input");
}

// ===== E: HUD and scene agree =====
{
  assert(/withRequiredPeelSteps\(/.test(read("src/game/scenes/PreparationScene.ts")) && /this\.steps = withRequiredPeelSteps\(/.test(read("src/game/scenes/PreparationScene.ts")), "E: the scene normalizes its steps on start");
  const prep = read("src/components/kc/game/Preparation.tsx");
  // One normalization over both step sources (service/business recipe, or the campaign level), used by both views.
  assert(/const givenSteps = service\s*\?\s*preparationStepsForRecipe\(service\.order\.recipe\)\s*:\s*level!\.preparationSteps;/.test(prep) && /const playableSteps = completableSteps\(givenSteps\);/.test(prep) && (prep.match(/preparationSteps: playableSteps,/g) ?? []).length === 2, "E2: Preparation.tsx normalizes both campaign-level and service/business step lists (the HUD indexes the same list the scene plays)");
}

console.log(failures === 0 ? "\nPREP SOFT-LOCK QA: ALL PASS" : `\nPREP SOFT-LOCK QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
