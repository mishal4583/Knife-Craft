/**
 * DISH_CLASSIFICATION_QA — Transformation Phase F (developer 2026-10-25): the cold
 * Peach & Cheddar Board is read as kind "bread" by its baguette (dishKind.ts), and
 * dishService added "oven" to every bread kind, so it needed sheet pans and oven mitts.
 * Option B (approved): `dishServiceFor` skips "oven" for the cold boards listed by id; the
 * board stays kind "bread" (its film, tableware, packaging and takeaway rate unchanged).
 *   A. the board: kind "bread", no oven, and no sheet pans or oven mitts at L114;
 *   B. every other recipe's profile equals the deployed baseline's (62c8a6d), rebuilt
 *      here from `git show 62c8a6d:src/game/restaurant/dishService.ts`;
 *   C. the ten oven-step recipes still cook in the oven, and the oven list is unchanged;
 *   D. nothing else moved: dishKind.ts and ovenStep.ts are identical to 62c8a6d.
 *
 * Run: npx tsx scripts/dish-classification-qa.mts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { CAMPAIGN_RECIPES, getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { dishKindFor } from "../src/game/recipes/dishKind.ts";
import { dishServiceFor } from "../src/game/restaurant/dishService.ts";
import { toolsNeeded } from "../src/game/restaurant/kitchenTools.ts";
import { OVEN_STEP_RECIPES } from "../src/game/cooking/ovenStep.ts";
import type { SaveData } from "../src/game/SaveManager.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE = "62c8a6d";
const BOARD = "camp-peach-cheddar-board";
let failures = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`ok   ${label}`);
}

// The baseline dishService, its imports pointed at this checkout's (unchanged) modules.
const baseSrc = execSync(`git show ${BASE}:src/game/restaurant/dishService.ts`, {
  cwd: ROOT,
  encoding: "utf8",
}).replace(
  /from "\.\.\/recipes\/(dishKind|recipeTypes)"/g,
  (_, m: string) => `from "${pathToFileURL(path.resolve(ROOT, `src/game/recipes/${m}.ts`)).href}"`,
);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kc-dish-"));
const basePath = path.join(tmp, "dishService.baseline.ts");
fs.writeFileSync(basePath, baseSrc);
const baseline = (await import(pathToFileURL(basePath).href)) as {
  dishServiceFor: typeof dishServiceFor;
};
fs.rmSync(tmp, { recursive: true, force: true });

const recipes = CAMPAIGN_RECIPES;
const board = getCampaignRecipe(BOARD)!;

console.log("A. The Peach & Cheddar Board");
{
  const now = dishServiceFor(board);
  const was = baseline.dishServiceFor(board);
  assert(
    !!board && dishKindFor(board.id, board.name) === "bread" && now.kind === "bread",
    'A1: it stays kind "bread" (its film, tableware and packaging are unchanged)',
  );
  assert(
    was.cooking.includes("oven") && !now.cooking.includes("oven") && now.cooking.length === 0,
    "A2: it no longer cooks in the oven (baseline: oven)",
    { was: was.cooking, now: now.cooking },
  );
  assert(
    JSON.stringify({ ...now, cooking: [] }) === JSON.stringify({ ...was, cooking: [] }),
    "A3: everything else in its profile is as before (kind, cheese, shared, messy, …)",
    { was, now },
  );
  const save = { business: { staff: { hiredRoles: [] } } } as unknown as SaveData;
  const tools = toolsNeeded(save, 114, [board]).map((t) => t.rule.id);
  assert(
    !tools.includes("sheet-pans") && !tools.includes("oven-mitts"),
    "A4: at L114 it needs no sheet pans or oven mitts",
    tools,
  );
}

console.log("B. Every other recipe");
{
  const others = recipes.filter((r) => r.id !== BOARD);
  const changed = others
    .filter((r) => JSON.stringify(dishServiceFor(r)) !== JSON.stringify(baseline.dishServiceFor(r)))
    .map((r) => r.id);
  assert(
    recipes.length === 222 && others.length === 221 && changed.length === 0,
    `B1: the other ${others.length} recipe profiles equal ${BASE}'s`,
    { total: recipes.length, changed },
  );
}

console.log("C. The oven recipes");
{
  assert(
    OVEN_STEP_RECIPES.length === 10 &&
      !OVEN_STEP_RECIPES.includes(BOARD) &&
      OVEN_STEP_RECIPES.every((id) => {
        const r = getCampaignRecipe(id);
        return !!r && dishServiceFor(r).cooking.includes("oven");
      }),
    "C1: the ten oven-step recipes still cook in the oven; the board is not one of them",
  );
}

console.log("D. Nothing else moved");
{
  const diff = execSync(
    `git diff ${BASE} -- src/game/recipes/dishKind.ts src/game/cooking/ovenStep.ts`,
    { cwd: ROOT, encoding: "utf8" },
  );
  assert(
    diff.trim() === "",
    "D1: dishKind.ts and the oven list are identical to the baseline",
    diff.slice(0, 200),
  );
}

console.log(
  failures === 0
    ? "\nDISH CLASSIFICATION QA: ALL PASS"
    : `\nDISH CLASSIFICATION QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
