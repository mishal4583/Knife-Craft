/**
 * OVEN_STEP_QA — Transformation Phase C/D/E (developer 2026-10-25): the
 * interactive oven for the bread and baguette dishes (src/game/cooking/ovenStep.ts,
 * components/kc/game/OvenStep.tsx, Preparation.tsx, App.tsx).
 *   A. the bake: doneness over time, the golden window, the lines, the colour;
 *   B. scope: Garlic Bread, the five Phase D bread dishes (L6, L7, L12, L15,
 *      L17) and the four Phase E baguette dishes (🥖 tray); the gratin, the
 *      Peach & Cheddar Board and every other recipe keep the cooking film;
 *   C. wiring: in the film's place (after the cut, before the Knife Report),
 *      finishes once, cleans up when interrupted, restaurant build only;
 *   D. presentation only: no score, grade, pay, wallet, ledger or save;
 *   E. no save field, no economy file changed since Phase B (0e0d83b); since
 *      Phase D (cc46bbd) only the recipe list, the tray item and the Phase F
 *      cold-board exception in dishService changed.
 *
 * Run: npx tsx scripts/oven-step-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  DONENESS_LINE,
  OVEN,
  BAGUETTE_TRAY_RECIPES,
  OVEN_STEP_RECIPES,
  breadFilter,
  donenessAt,
  donenessLabel,
  ovenStepFor,
  trayItemFor,
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
  // Phase D then Phase E (developer 2026-10-25): the rule changed from "Garlic Bread only"
  // to six bread dishes, then to these ten.
  const BREAD: Record<number, string> = {
    5: "camp-garlic-bread",
    6: "camp-tomato-basil-toast",
    7: "camp-mushroom-bruschetta",
    12: "camp-bruschetta-for-the-house",
    15: "camp-family-antipasto-for-two",
    17: "camp-bruschetta-trio",
  };
  const BAGUETTE = [
    "camp-avocado-baguette-toast", // L47
    "camp-baguette-rounds",
    "camp-baguette-cheddar-rounds",
    "camp-baguette-crostini-prep",
  ];
  const bread = Object.values(BREAD);
  const all = [...bread, ...BAGUETTE];
  assert(
    OVEN_STEP_RECIPES.length === all.length &&
      new Set(OVEN_STEP_RECIPES).size === all.length &&
      all.every((id) => ovenStepFor(id)),
    "B1: exactly the ten recipes use the oven (Garlic Bread, five bread dishes, four baguette dishes)",
    OVEN_STEP_RECIPES,
  );
  assert(
    Object.entries(BREAD).every(([n, id]) => getLevel(`level-${n}`)?.recipeId === id) &&
      getLevel("level-47")?.recipeId === "camp-avocado-baguette-toast",
    "B2: each level's recipe (L5, L6, L7, L12, L15, L17, L47) is the one listed",
  );
  const parts = (id: string) => getCampaignRecipe(id)?.components.map((c) => c.ingredientId) ?? [];
  assert(
    bread.every((id) => parts(id).includes("bread") && !parts(id).includes("baguette")) &&
      bread.every((id) => trayItemFor(id) === "🍞"),
    "B3: the six bread dishes use bread, no baguette, and bake 🍞 on the tray",
  );
  assert(
    BAGUETTE.every((id) => !!getCampaignRecipe(id) && parts(id).includes("baguette")) &&
      BAGUETTE.every((id) => trayItemFor(id) === "🥖") &&
      BAGUETTE_TRAY_RECIPES.length === BAGUETTE.length &&
      BAGUETTE_TRAY_RECIPES.every((id) => ovenStepFor(id)),
    "B4: the four baguette dishes exist, use a baguette, and bake 🥖 on the tray",
  );
  assert(
    ["camp-potato-onion-gratin-prep", "camp-peach-cheddar-board"].every(
      (id) => !!getCampaignRecipe(id) && !ovenStepFor(id),
    ),
    "B5: the Potato & Onion Gratin Prep and the Peach & Cheddar Board keep the film",
  );
  assert(
    !ovenStepFor("camp-garden-tomato-cup") &&
      !ovenStepFor("") &&
      trayItemFor("camp-garden-tomato-cup") === "🍞" &&
      trayItemFor("camp-peach-cheddar-board") === "🍞",
    "B6: other recipes (e.g. L17's batch partner) keep the film; trayItemFor defaults to 🍞",
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
  // Since Phase D (cc46bbd): no flow, pay, achievement or ranking file changed, and in the
  // oven view and Preparation only lines about the tray item.
  // Phase F (developer 2026-10-25, option B): dishService.ts may change only by the cold-board
  // exception (the Peach & Cheddar Board loses "oven"); dish-classification-qa checks its effect.
  // Early-game phase 1 (developer 2026-10-25): levelPayPreview.ts, display only — the practice
  // level previews $0 (restaurant-measures-qa A1b checks it); no pay, serve or oven code moves.
  // Early-game phase 2 (developer 2026-10-25): the menu opens at Level 5 — the unlock level
  // (restaurantProgression.ts) and the first-levels copy (firstLevels.ts) only;
  // restaurant-guests-qa and restaurant-first-levels-qa check them. No pay, serve or oven code moves.
  // Early-game phase 3 (developer 2026-10-25): walk-ins — menuGuests.ts and the check's optional
  // customer rows (preServiceCheck.ts), guarded by walkin-qa; in App.tsx only the customer
  // offer's label may change (checked below: no pay, serve, ledger, save or reward code).
  const flow = execSync(
    "git diff cc46bbd -- src/game/restaurant ':!src/game/restaurant/dishService.ts' ':!src/game/restaurant/levelPayPreview.ts' ':!src/game/restaurant/restaurantProgression.ts' ':!src/game/restaurant/firstLevels.ts' ':!src/game/restaurant/menuGuests.ts' ':!src/game/restaurant/preServiceCheck.ts' src/game/progression src/game/recipes/dishKind.ts",
    { cwd: ROOT, encoding: "utf8" },
  );
  const appDiff = execSync("git diff -U0 cc46bbd -- src/App.tsx", { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((l) => /^[+-](?![+-])/.test(l));
  const offLabel = appDiff.filter((l) =>
    /persist|credits|appendLedgerEntry|serve|complete|reward|settle|levelProgress|onClick: take/i.test(
      l,
    ),
  );
  const serviceDiff = execSync("git diff -U0 cc46bbd -- src/game/restaurant/dishService.ts", {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter((l) => /^[+-](?![+-])/.test(l));
  const offBoard = serviceDiff.filter(
    (l) =>
      !/COLD_BOARD_RECIPE_IDS/.test(l) &&
      !/^\+\s*cooking\.add\("oven"\);$/.test(l) &&
      l !== '-  if (kind === "bread" || OVEN_NAME.test(recipe.name)) cooking.add("oven");' &&
      !/^\+\s*(\/\*\*|\*\/|\* .*)$/.test(l),
  );
  const viewDiff = execSync(
    "git diff -U0 cc46bbd -- src/components/kc/game/Preparation.tsx src/components/kc/game/OvenStep.tsx",
    { cwd: ROOT, encoding: "utf8" },
  )
    .split("\n")
    .filter((l) => /^[+-](?![+-])/.test(l));
  // Allowed: lines about the tray, the removed fixed 🍞, and the old one-name import.
  const offTray = viewDiff.filter(
    (l) =>
      !/tray|TrayItem/i.test(l) &&
      !/^-\s*🍞$/.test(l) &&
      l !== '-import { ovenStepFor } from "@/game/cooking/ovenStep";',
  );
  assert(
    flow.trim() === "" &&
      offTray.length === 0 &&
      offBoard.length === 0 &&
      offLabel.length === 0 &&
      appDiff.some((l) => /Walk-in/.test(l)),
    "E2: since Phase D only the tray item, the Phase F cold-board exception, the Level 2 pay preview, the Level 5 menu unlock and the walk-in offer's label changed (no order, serve, pay, achievement, ranking or dishKind code)",
    { flow: flow.slice(0, 200), offTray, offBoard, offLabel },
  );
}

console.log(failures === 0 ? "\nOVEN STEP QA: ALL PASS" : `\nOVEN STEP QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
