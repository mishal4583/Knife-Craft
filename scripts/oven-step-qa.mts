/**
 * OVEN_STEP_QA — Transformation Phase C/D (developer 2026-10-25): the
 * interactive oven for the bread dishes (src/game/cooking/ovenStep.ts,
 * components/kc/game/OvenStep.tsx, Preparation.tsx, App.tsx).
 *   A. the bake: doneness over time, the golden window, the lines, the colour;
 *   B. scope: Garlic Bread plus the five Phase D bread dishes (L6, L7, L12, L15,
 *      L17); the baguette dishes, the gratin, the board and every other recipe
 *      keep the cooking film;
 *   C. wiring: in the film's place (after the cut, before the Knife Report),
 *      finishes once, cleans up when interrupted, restaurant build only;
 *   D. presentation only: no score, grade, pay, wallet, ledger or save;
 *   E. no save field, no economy file changed since Phase B (0e0d83b); Phase D
 *      changed only the recipe list (since 54e30cc).
 *
 * Run: npx tsx scripts/oven-step-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  DONENESS_LINE,
  OVEN,
  OVEN_STEP_RECIPES,
  breadFilter,
  donenessAt,
  donenessLabel,
  ovenStepFor,
} from "../src/game/cooking/ovenStep.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { getLevel } from "../src/game/levels/LevelManager.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const code = (f: string) =>
  fs
    .readFileSync(path.resolve(ROOT, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
let failures = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`ok   ${label}`);
}

console.log("A. The bake");
{
  assert(
    donenessAt(-5) === 0 &&
      donenessAt(Number.NaN) === 0 &&
      donenessAt(OVEN.BAKE_MS / 2) === 0.5 &&
      donenessAt(OVEN.BAKE_MS * 3) === 1,
    "A1: doneness rises 0 → 1 over the bake, clamped",
  );
  assert(
    donenessLabel(0.2) === "pale" &&
      donenessLabel(OVEN.GOLDEN_FROM) === "golden" &&
      donenessLabel(OVEN.GOLDEN_TO) === "golden" &&
      donenessLabel(0.95) === "toasty",
    "A2: pale → golden window → toasty",
  );
  const goldenMs = (OVEN.GOLDEN_TO - OVEN.GOLDEN_FROM) * OVEN.BAKE_MS;
  assert(goldenMs >= 1000, "A3: the golden window is open for at least a second", goldenMs);
  assert(
    Object.values(DONENESS_LINE).every((l) => l.length > 0 && !/\d/.test(l)),
    "A4: each result is a line, never a number",
  );
  assert(breadFilter(0) !== breadFilter(1), "A5: the bread visibly browns");
}

console.log("B. Scope");
{
  // Phase D (developer 2026-10-25): the rule changed from "Garlic Bread only" to these six.
  const PHASE_D: Record<number, string> = {
    5: "camp-garlic-bread",
    6: "camp-tomato-basil-toast",
    7: "camp-mushroom-bruschetta",
    12: "camp-bruschetta-for-the-house",
    15: "camp-family-antipasto-for-two",
    17: "camp-bruschetta-trio",
  };
  const ids = Object.values(PHASE_D);
  assert(
    OVEN_STEP_RECIPES.length === ids.length && ids.every((id) => ovenStepFor(id)),
    "B1: exactly Garlic Bread and the five Phase D bread dishes use the oven",
    OVEN_STEP_RECIPES,
  );
  assert(
    Object.entries(PHASE_D).every(([n, id]) => getLevel(`level-${n}`)?.recipeId === id),
    "B2: each is the recipe its level (L5, L6, L7, L12, L15, L17) cooks",
  );
  assert(
    ids.every((id) => {
      const parts = getCampaignRecipe(id)?.components.map((c) => c.ingredientId) ?? [];
      return parts.includes("bread") && !parts.includes("baguette");
    }),
    "B3: all are bread-slice dishes (the tray draws 🍞), none uses a baguette",
  );
  const excluded = [
    "camp-avocado-baguette-toast",
    "camp-baguette-rounds",
    "camp-baguette-cheddar-rounds",
    "camp-baguette-crostini-prep",
    "camp-potato-onion-gratin-prep",
    "camp-peach-cheddar-board",
  ];
  assert(
    excluded.every((id) => !!getCampaignRecipe(id) && !ovenStepFor(id)),
    "B4: the four baguette dishes, the gratin and the Peach & Cheddar Board keep the film",
  );
  assert(
    !ovenStepFor("camp-garden-tomato-cup") && !ovenStepFor(""),
    "B5: other recipes (e.g. L17's batch partner) keep the film",
  );
}

console.log("C. Wiring");
{
  const prep = code("src/components/kc/game/Preparation.tsx");
  const view = code("src/components/kc/game/OvenStep.tsx");
  const app = code("src/App.tsx");
  assert(
    /const ovenStep = !!ovenCooking && ovenStepFor\(view\.recipeId\);/.test(prep) &&
      /cooking === "playing" && ovenStep \?/.test(prep) &&
      /cooking !== "off" && !ovenStep \?/.test(prep),
    "C1: the oven takes the film's place, for its recipes only",
  );
  assert(
    /<OvenStep[\s\S]{0,260}onDone=\{\(\) => \{\s*setCooking\("off"\);\s*setPhase\("result"\);/.test(
      prep,
    ),
    "C2: when the tray is out, the Knife Report follows exactly as after the film",
  );
  assert(
    /if \(finished\.current\) return;\s*finished\.current = true;/.test(view) &&
      /finished\.current = true;\s*window\.clearTimeout\(placed\);\s*cancelAnimationFrame\(raf\);\s*if \(doneTimer\.current !== null\) window\.clearTimeout\(doneTimer\.current\);/.test(
        view,
      ),
    "C3: Take it out finishes once; an interrupted bake fires nothing afterwards",
  );
  assert(
    /\.\.\.\(RESTAURANT_MODE\s*\?\s*\{[\s\S]{0,500}ovenCooking: true/.test(app),
    "C4: the oven is on in the restaurant build only",
  );
  assert(
    /disabled=\{state !== "baking"\}/.test(view),
    "C5: the tray can't come out before it is in",
  );
}

console.log("D. Presentation only");
{
  const logic = code("src/game/cooking/ovenStep.ts");
  const view = code("src/components/kc/game/OvenStep.tsx");
  assert(
    !/Math\.random|credits|Ledger|Settlement|wallet|SaveManager|persist|setSave|score|grade|quality|\btips?\b|\bpay|reward|achievement|ranking/i.test(
      logic + view,
    ),
    "D1: no randomness, score, grade, tip, pay, reward, wallet, ledger or save in the oven",
  );
}

console.log("E. Nothing else moves");
{
  const diff = execSync(
    "git diff 0e0d83b -- src/game/SaveManager.ts src/game/business/businessTypes.ts src/game/economy src/game/levels src/game/recipes",
    { cwd: ROOT, encoding: "utf8" },
  );
  assert(
    diff.trim() === "",
    "E1: no save field, economy, level or recipe change",
    diff.slice(0, 300),
  );
  const flow = execSync(
    "git diff 54e30cc -- src/components/kc/game/Preparation.tsx src/components/kc/game/OvenStep.tsx src/App.tsx src/game/restaurant src/game/progression",
    { cwd: ROOT, encoding: "utf8" },
  );
  assert(
    flow.trim() === "",
    "E2: Phase D changes no order, serve, pay, oven-view, achievement or ranking code",
    flow.slice(0, 300),
  );
}

console.log(failures === 0 ? "\nOVEN STEP QA: ALL PASS" : `\nOVEN STEP QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
