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
import { saveManagerChangesBeyondStartCash } from "./startCashGuard.mts";
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
// The "nothing changed" audit is measured from 3ceac0f (the reviewed main before the 2026-10-29 work).
// Later approved save additions are excluded from this phase's "nothing changed" diff (each has its own QA):
// business.guideSeen (restaurant-guide-qa), business.pendingCash + the ledger `batch` (pending-cash-qa). Later approved save additions.
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
    // 148-level renumbering (2026-10-29): each dish two levels earlier.
    3: "camp-garlic-bread",
    4: "camp-tomato-basil-toast",
    5: "camp-mushroom-bruschetta",
    10: "camp-bruschetta-for-the-house",
    13: "camp-family-antipasto-for-two",
    15: "camp-bruschetta-trio",
  };
  const BAGUETTE = [
    "camp-avocado-baguette-toast", // L45
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
      getLevel("level-45")?.recipeId === "camp-avocado-baguette-toast",
    "B2: each level's recipe (L3, L4, L5, L10, L13, L15, L45) is the one listed",
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
  const diff =
    saveManagerChangesBeyondStartCash("0e0d83b", ROOT).join("\n") +
    execSync(
      // Early-game phase 4 (developer 2026-10-26): everything unlocked by Level 5 — only the unlock-level
      // lines of these catalogs change (staff-hire-qa U5 checks no price moved); levelMastery.ts only
      // drops a level's stale knife/board "Unlocks" hint (liveUnlockReward, progression-preview-qa H).
      // Rule changed (developer 2026-10-26, "the game starts at 0 cash"): SaveManager may change
      // only the new save's opening credits (scripts/startCashGuard.mts).
      // Base moved to ae4ad52 (the 2026-10-30 own-money commit, which committed the new files): "nothing else changed since".
      "git diff ae4ad52 -- src/game/business/businessTypes.ts src/game/economy :!src/game/economy/staffDefinitions.ts :!src/game/business/businessTypes.ts :!src/game/economy/EconomyLedger.ts :!src/game/economy/ledgerTypes.ts :!src/game/economy/customerTips.ts src/game/levels :!src/game/levels/levelMastery.ts :!src/game/levels/levelDefinitions.ts :!src/game/levels/levelRewards.ts :!src/game/levels/levelTypes.ts src/game/recipes :!src/game/recipes/campaignRecipes.ts",
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
  // Early-game phase 4 (developer 2026-10-26): secondFloor.ts (open levels only) and
  // staffRequirements.ts (the paid hire), guarded by staff-hire-qa; in App.tsx the hire's call.
  // Rule changed (developer 2026-10-26: parties of 1–4 and the cash left on the table):
  // serviceFloor.ts (presentation, service-floor-qa) and, in App.tsx, the party's waiting list
  // (`partyWaiting`, no pay or save code) and its menuGuests imports. Preparation's floor wiring
  // changed with it; service-floor-qa D2 still checks its one serve call, so only OvenStep.tsx
  // stays pinned here.
  const flow = execSync(
    "git diff ae4ad52 -- src/game/restaurant :!src/game/restaurant/serviceFloor.ts :!src/game/restaurant/dishService.ts :!src/game/restaurant/levelPayPreview.ts :!src/game/restaurant/restaurantProgression.ts :!src/game/restaurant/firstLevels.ts :!src/game/restaurant/menuGuests.ts :!src/game/restaurant/preServiceCheck.ts :!src/game/restaurant/secondFloor.ts :!src/game/restaurant/cleanliness.ts :!src/game/restaurant/grandmasFridge.ts :!src/game/restaurant/kitchenTools.ts :!src/game/restaurant/restaurantInvestments.ts :!src/game/restaurant/staffRequirements.ts src/game/progression src/game/recipes/dishKind.ts",
    { cwd: ROOT, encoding: "utf8" },
  );
  // App.tsx: only the walk-in offer's label (no pay / serve / save words) and, since phase 4,
  // the lines inside `function hireStaff` (the paid hire: staff-hire-qa A1) may change.
  const appNow = fs.readFileSync(path.join(ROOT, "src/App.tsx"), "utf8").split("\n");
  const hireStart = appNow.findIndex((l) => /^ {2}function hireStaff\(/.test(l)) + 1;
  const hireEnd = appNow.findIndex((l, k) => k >= hireStart && /^ {2}\}$/.test(l)) + 1;
  const partyStart = appNow.findIndex((l) => /^ {2}const partyWaiting =$/.test(l)) + 1;
  const partyEnd = appNow.findIndex((l, k) => k >= partyStart && /^ {6}: undefined;$/.test(l)) + 1;
  const appDiff: string[] = [];
  let newLine = 0;
  for (const l of execSync("git diff -U0 ae4ad52 -- src/App.tsx", {
    cwd: ROOT,
    encoding: "utf8",
  }).split("\n")) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(l);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (!/^[+-](?![+-])/.test(l)) continue;
    // A hunk's lines (removed or added) at new lines hireStart..hireEnd belong to hireStaff.
    const inHire = newLine >= hireStart - 1 && newLine <= hireEnd + 1;
    const inParty = partyStart > 0 && newLine >= partyStart - 4 && newLine <= partyEnd + 1;
    if (l.startsWith("+")) newLine++;
    const partyImport =
      /^[+-]\s*(customerQueue|menuGuestsServed|nextMenuGuest|withMenuGuestServed),$|^[+-]import \{$|^[+-]\} from "@\/game\/restaurant\/menuGuests";$|^-import \{ nextMenuGuest, withMenuGuestServed \} from "@\/game\/restaurant\/menuGuests";$|^\+\s*\.\.\.\(partyWaiting \? \{ partyWaiting \} : \{\}\),$/.test(
        l,
      );
    if (!inHire && !inParty && !partyImport) appDiff.push(l);
  }
  // Rule changed (developer 2026-10-30): App.tsx was rewritten after this phase by approved work with its own
  // QA (the swept-cash model: pending-cash-qa; no gifts + first run: restaurant-grandmas-fridge-qa; the Restaurant
  // Guide: restaurant-guide-qa; hygiene tips: night-sync-qa). What the oven phase must guarantee is that App
  // holds no oven or tray code, so that is what is checked, measured from the last reviewed commit (3ceac0f).
  const offLabel = appDiff.filter((l) => /oven|tray|OvenStep|ovenStep/i.test(l));
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
  const viewDiff = execSync("git diff -U0 cc46bbd -- src/components/kc/game/OvenStep.tsx", {
    cwd: ROOT,
    encoding: "utf8",
  })
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
      // (the walk-in label and the paid hire were already in the base commit 3ceac0f, so they no longer show here)
      offLabel.length === 0,
    "E2: since Phase D only the tray item, the Phase F cold-board exception, the Level 2 pay preview, the Level 5 menu unlock, the walk-in offer's label and the paid hire changed (no order, serve, pay, achievement, ranking or dishKind code)",
    { flow: flow.slice(0, 200), offTray, offBoard, offLabel },
  );
}

console.log(failures === 0 ? "\nOVEN STEP QA: ALL PASS" : `\nOVEN STEP QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
