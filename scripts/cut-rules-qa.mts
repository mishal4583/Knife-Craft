/**
 * CUT_RULES_QA — the developer's cutting rules (docs/KNIFE_RULES.md), checked
 * for EVERY cutting step of all 250 campaign levels (their own steps plus
 * every recipe in their pools, batches and service objectives) and Endless
 * Service (which draws only from campaign levels):
 *
 *   A. Cut lines run ACROSS the food (vertical lines, like Level 1's tomato)
 *      for every cutting step. Horizontal lines only where the cut can't be
 *      made any other way:
 *      - julienne's lengthwise strips;
 *      - Dice's cross cuts (after its vertical slices);
 *      - a food drawn clearly taller than wide.
 *   B. Order: right to left (the knife in the right hand, the claw grip on
 *      the left). Dice's cross cuts start nearest the cook.
 *   C. The knife stays poised on the last cut between cuts (tap and swipe)
 *      and is laid down only when the step ends.
 *   D. The how-to cards teach right to left.
 *   E. Endless draws only from campaign levels (so A–D cover it).
 *   F. Wiring: the scene uses these rules for the tap, the swipe guides and
 *      the coaching ghost.
 *
 * Run: npx tsx scripts/cut-rules-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { INGREDIENTS, TECHNIQUES, resolveTechniqueFor } from "../src/game/definitions.ts";
import type { IngredientId, TechniqueId } from "../src/game/definitions.ts";
import { getLevels } from "../src/game/levels/LevelManager.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { preparationStepsForRecipe } from "../src/game/service/stepsForRecipe.ts";
import { liveAxis, type Cut } from "../src/game/CutGeometry.ts";
import {
  nextCutIndex,
  nextOpenPosition,
  primaryCutAxis,
  TALL_ASPECT,
} from "../src/game/cutPlan.ts";
import { COACH_TEXT } from "../src/game/coaching.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => fs.readFileSync(path.resolve(ROOT, f), "utf8");
let failures = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`ok   ${label}`);
}

// Every cutting step the game can put in front of the player.
type Step = { level: string; ingredient: IngredientId; technique: TechniqueId };
const steps: Step[] = [];
const levels = getLevels();
for (const lvl of levels) {
  const add = (s: { ingredient: IngredientId; technique: TechniqueId }) =>
    steps.push({ level: lvl.id, ingredient: s.ingredient, technique: s.technique });
  lvl.preparationSteps.forEach(add);
  const recipeIds = new Set<string>([
    ...(lvl.recipePoolIds ?? []),
    ...(lvl.batchGroupRecipeIds ?? []),
    ...lvl.objectives.flatMap((o) =>
      o.type === "completeService" ? o.recipeIds : o.type === "completeRecipe" ? [o.recipeId] : [],
    ),
  ]);
  for (const id of recipeIds) {
    const r = getCampaignRecipe(id);
    if (r) preparationStepsForRecipe(r).forEach(add);
  }
}
const cutting = steps.filter((s) => {
  const t = resolveTechniqueFor(TECHNIQUES[s.technique], INGREDIENTS[s.ingredient]);
  return t.interactionMode === "cut" && !t.radialSnap;
});
assert(levels.length === 250, `all 250 campaign levels enumerated (${levels.length})`);
assert(
  cutting.length > 250,
  `every cutting step collected (${cutting.length} across the campaign)`,
);

// A. Direction, for a food lying left-right or round (every food is drawn so).
const horizontal: string[] = [];
const wrong: string[] = [];
for (const s of cutting) {
  const ing = INGREDIENTS[s.ingredient];
  const t = resolveTechniqueFor(TECHNIQUES[s.technique], ing);
  for (const [rx, ry] of [
    [1, 1],
    [1.6, 1],
    [1, 1.2],
  ] as const) {
    const axis = primaryCutAxis(t, ing, rx, ry);
    if (axis === "h") {
      if (t.cutsLengthwise) horizontal.push(`${s.level}:${s.ingredient}/${s.technique}`);
      else wrong.push(`${s.level}:${s.ingredient}/${s.technique} (${rx}x${ry})`);
    }
  }
}
assert(
  wrong.length === 0,
  "A1. every cutting step slices ACROSS the food: vertical lines (Level 1 style)",
  [...new Set(wrong)].slice(0, 8),
);
assert(
  [...new Set(horizontal)].every((h) => h.endsWith("/julienne")),
  "A2. the only horizontal first lines are julienne's lengthwise strips",
);
assert(
  Object.values(INGREDIENTS).every((i) => (i as { axisOverride?: string }).axisOverride !== "h"),
  "A3. no ingredient forces horizontal cut lines",
);
assert(
  primaryCutAxis({}, {}, 1, TALL_ASPECT + 0.1) === "h" &&
    primaryCutAxis({}, {}, 1, TALL_ASPECT - 0.1) === "v",
  "A4. only a clearly tall food (height > 1.35 × width) is cut with horizontal lines",
);
// Dice: vertical slices first, then the horizontal cross cuts.
const dice = TECHNIQUES.dice;
const v0 = primaryCutAxis(dice, {}, 1, 1);
const afterSlices: Cut[] = Array.from({ length: dice.counts!.v }, (_, i) => ({
  axis: "v" as const,
  c: i,
  slope: 0,
}));
assert(
  v0 === "v" &&
    liveAxis(v0, dice.counts, []) === "v" &&
    liveAxis(v0, dice.counts, afterSlices) === "h",
  "A5. Dice: vertical slices first, then the cross cuts (horizontal) — the only second direction",
);

// B. Order.
const order: number[] = [];
const used = [false, false, false, false, false];
for (;;) {
  const i = nextCutIndex(used, used.length);
  if (i < 0) break;
  order.push(i);
  used[i] = true;
}
assert(
  order.join(",") === "4,3,2,1,0",
  "B1. guided cuts go right to left (bottom first for horizontal lines)",
  order,
);
const pos = [10, 20, 30, 40, 50];
assert(
  nextOpenPosition(pos, [], 2) === 50 &&
    nextOpenPosition(pos, [50], 2) === 40 &&
    nextOpenPosition(pos, [50, 40, 30, 20, 10], 2) === undefined,
  "B2. continuous Slice/Chop aims right to left too",
);

// C. The knife stays on the last cut.
const scene = read("src/game/scenes/PreparationScene.ts");
assert(
  /const retract = stepDone \? \{ \.\.\.this\.idleKnifePose\(\), sign: 1 \} : prep;/.test(scene),
  "C1. after a tap cut the knife stays poised on that cut (laid down only when the step is done)",
);
assert(
  /this\.poiseKnifeOn\(this\.cuts\[this\.cuts\.length - 1\]!, last\)/.test(scene),
  "C2. after a swipe cut the knife settles on that cut instead of going back to the board",
);
const beginStep = scene.slice(
  scene.indexOf("private beginStep("),
  scene.indexOf("private beginChainStep("),
);
assert(/this\.layKnifeDown\(\);/.test(beginStep), "C3. a new step lays the knife down");

// D. Cards.
const rtl = ["slice", "dice", "chop", "rockMince", "chiffonade"] as const;
assert(
  rtl.every((t) => /right/i.test(COACH_TEXT[t].how)) && /claw grip/i.test(COACH_TEXT.slice.how),
  "D. the how-to cards teach right to left (and the claw grip)",
  rtl.filter((t) => !/right/i.test(COACH_TEXT[t].how)),
);

// E. Endless.
const endless = read("src/game/daily/EndlessServiceManager.ts");
assert(
  /return getLevels\(\)\.filter\(\(l\) => l\.type === "SERVICE"/.test(endless),
  "E. Endless Service draws only from campaign levels (covered by A–D)",
);

// F. Wiring.
assert(
  /return primaryCutAxis\(this\.technique, this\.ingredient, this\.ingRx, this\.ingRy\);/.test(
    scene,
  ) && !/this\.technique\.axis\b/.test(scene.replace(/\/\/.*$/gm, "")),
  "F1. the tap axis and swipe guides come from primaryCutAxis (never the raw technique axis)",
);
assert(
  /nextCutIndex\(used, positions\.length\)/.test(scene) &&
    /nextOpenPosition\(positions, existing, minGap\)/.test(scene),
  "F2. the coaching ghost teaches the next cut in that order",
);

console.log(failures === 0 ? "\nCUT RULES QA: ALL PASS" : `\nCUT RULES QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
