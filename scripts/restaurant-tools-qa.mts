/**
 * KITCHEN TOOLS QA (supplies plan Phase A, developer 2026-10-10: "use
 * everything when necessary; ask the player to buy some important tools when
 * the game starts and the rest when necessary").
 * restaurant/kitchenTools.ts + dishService.ts.
 *
 *  T  Every one of the 18 culinary smallwares has a rule, and every rule is
 *     needed by real campaign dishes from its level (no tool without a use).
 *  D  dishServiceFor reads every recipe (oven / fry / pot / sauté / grill,
 *     protein, cheese, skewer, shared, messy) — derived, stable.
 *  G  Grandma's old tools: once, when the Market opens (L10), at cost 0 —
 *     no money, no ledger; never before L10, never twice.
 *  C  The check: nothing before L10; L10 never blocks (Grandma's set covers
 *     it); L11's garlic bread blocks without a sheet pan and oven mitts;
 *     buying them makes it ready; menu dishes count; pans per cook (L41+).
 *  S  Level 10's first shopping list = the tools the next ten levels need;
 *     later levels announce tools 5 levels ahead.
 *  V  Cover: an ad / supplier credit brings missing tools when the wallet
 *     can't pay (no money now; credit owes the Market price).
 *  W  Wiring: the plan opens the sheet for the shopping list and a missing
 *     tool; START waits for tools; App gives Grandma's tools; the ad has its
 *     own placement; no RESTAURANT_MODE / Math.random in the modules.
 *
 * Run: npx tsx scripts/restaurant-tools-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getLevel, getLevels } from "../src/game/levels/LevelManager.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { SUPPLY_CATALOG, type SupplyId } from "../src/game/business/businessSupplies.ts";
import { supplyUnits } from "../src/game/business/BusinessSuppliesManager.ts";
import { dishServiceFor } from "../src/game/restaurant/dishService.ts";
import {
  GRANDMAS_TOOL_SET,
  TOOL_RULES,
  cooksOnLine,
  giveGrandmasTools,
  levelRecipesAt,
  toolsCheck,
  toolsComingUp,
  toolsNeeded,
} from "../src/game/restaurant/kitchenTools.ts";
import { servicePlanFor, servicePlanNeedsSheet } from "../src/game/restaurant/preServiceCheck.ts";
import { coverFor, coverWithAd, coverWithCredit } from "../src/game/restaurant/serviceCover.ts";
import { supplierCreditOf } from "../src/game/restaurant/supplierCredit.ts";
import { AD_PLACEMENT } from "../src/game/PlayablesSDK.ts";

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
const noComments = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "");
const saveAt = (
  n: number,
  credits = 500_000,
  extra: Partial<SaveData["business"]> = {},
): SaveData => ({
  ...DEFAULT_SAVE,
  credits,
  levelProgress: {
    currentLevelId: `level-${n}`,
    highestUnlockedLevelId: `level-${n}`,
    completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  },
  business: { ...DEFAULT_SAVE.business, inventory: {}, ...extra },
});
const withTools = (s: SaveData, ids: readonly SupplyId[], units = 1): SaveData => {
  const stock = { ...s.business.supplies.stock };
  for (const id of ids) stock[id] = { units, costBasis: 100 * units };
  return { ...s, business: { ...s.business, supplies: { ...s.business.supplies, stock } } };
};

console.log("T. Every culinary smallware has a use");
{
  const culinary = SUPPLY_CATALOG.filter((i) => i.section === "culinary").map((i) => i.id);
  const ruled = TOOL_RULES.map((r) => r.id);
  assert(
    culinary.length === 18 &&
      culinary.every((id) => ruled.filter((x) => x === id).length === 1) &&
      ruled.every((id) => culinary.includes(id)),
    "T1: all 18 culinary smallwares have exactly one rule",
  );
  const first: Record<string, number> = {};
  for (const l of getLevels()) {
    const n = Number(l.id.split("-")[1]);
    for (const t of toolsNeeded(DEFAULT_SAVE, n, levelRecipesAt(n))) first[t.rule.id] ??= n;
  }
  assert(
    TOOL_RULES.every((r) => first[r.id] !== undefined && first[r.id]! - r.fromLevel <= 1),
    "T2: every tool is needed by real campaign dishes from (or right after) its level — none without a use",
    Object.fromEntries(TOOL_RULES.map((r) => [r.id, [r.fromLevel, first[r.id]]])),
  );
}

console.log("D. Dish service");
{
  const all = getLevels().flatMap((l) =>
    [...(l.recipePoolIds ?? []), ...(l.batchGroupRecipeIds ?? [])].map((id) =>
      getCampaignRecipe(id)!,
    ),
  );
  const d = (id: string) => dishServiceFor(getCampaignRecipe(id)!);
  assert(
    all.every((r) => !!dishServiceFor(r).kind) &&
      d("camp-garlic-bread").cooking.includes("oven") &&
      d("camp-onion-rings-basket").cooking.includes("fry") &&
      d("camp-garden-minestrone-base").cooking.includes("pot") &&
      dishServiceFor(all.find((r) => /Ribeye/.test(r.name))!).protein === "steak" &&
      dishServiceFor(all.find((r) => /Skewers/.test(r.name))!).skewer &&
      dishServiceFor(all.find((r) => /for Two/.test(r.name))!).shared &&
      dishServiceFor(all.find((r) => /Caprese Plate/.test(r.name))!).cheese &&
      dishServiceFor(all[0]!) === dishServiceFor(all[0]!),
    `D1: every one of the campaign's ${all.length} dishes is read (oven / fry / pot / protein / skewer / shared / cheese), cached`,
  );
}

console.log("G. Grandma's old tools");
{
  const s9 = saveAt(9);
  const s10 = saveAt(10);
  const given = giveGrandmasTools(s10, 10);
  assert(
    giveGrandmasTools(s9, 9) === s9 &&
      GRANDMAS_TOOL_SET.every((id) => supplyUnits(given.business.supplies, id) === 1) &&
      GRANDMAS_TOOL_SET.every((id) => given.business.supplies.stock[id]!.costBasis === 0) &&
      given.credits === s10.credits &&
      given.economyLedger.length === s10.economyLedger.length &&
      given.business.grandmasTools?.atLevel === 10 &&
      giveGrandmasTools(given, 12) === given,
    "G1: once, when the Market opens (L10): peeler, mixing bowl, measuring cups at cost 0 — no money, no ledger; not before, never twice",
  );
}

console.log("C. The check");
{
  const at = (n: number, s: SaveData) => toolsCheck(s, n, [...levelRecipesAt(n)].slice(0, 1));
  const c9 = at(9, saveAt(9));
  const c10 = at(10, giveGrandmasTools(saveAt(10), 10));
  const s11 = giveGrandmasTools(saveAt(11), 11);
  const c11 = at(11, s11);
  const bought = withTools(s11, ["sheet-pans", "oven-mitts"]);
  const c11b = at(11, bought);
  assert(
    !c9.applies &&
      c10.applies &&
      c10.ready &&
      c11.applies &&
      !c11.ready &&
      c11.rows
        .filter((r) => r.missing > 0)
        .map((r) => r.id)
        .sort()
        .join() === "oven-mitts,sheet-pans" &&
      c11.rows.find((r) => r.id === "sheet-pans")!.dishes.includes("Garlic Bread") &&
      c11.missingCost > 0 &&
      c11b.applies &&
      c11b.ready,
    "C1: nothing before L10; L10 ready with Grandma's set; L11's Garlic Bread waits for a sheet pan and oven mitts; bought → ready",
  );
  // The menu's dishes count too: L16 (rings) needs a frying pan even for an own dish without one.
  const s16 = giveGrandmasTools(saveAt(16), 16);
  const ownOnly = toolsCheck(s16, 16, levelRecipesAt(16));
  assert(
    ownOnly.applies && ownOnly.rows.some((r) => r.id === "frying-pans" && r.missing > 0),
    "C2: L16's onion rings need a frying pan (tongs, skimmer) before the service",
  );
  const crew = {
    ...saveAt(61),
    business: {
      ...saveAt(61).business,
      staff: { ...DEFAULT_SAVE.business.staff, hiredRoles: ["prep-cook", "line-cook"] },
    },
  } as SaveData;
  const solo = saveAt(30);
  const pans = toolsNeeded(crew, 61, levelRecipesAt(61)).find((t) => t.rule.id === "saucepans");
  assert(
    cooksOnLine(solo, 30) === 1 && cooksOnLine(crew, 61) === 3 && !!pans && pans.need === 3,
    "C3: pans are per cook from the staff stage — the chef + 2 cooks need 3 of each",
    { pans: pans?.need },
  );
}

console.log("S. First shopping list and what's coming");
{
  const s10 = giveGrandmasTools(saveAt(10), 10);
  const list = toolsComingUp(s10, 10, 10, levelRecipesAt).map((t) => t.id);
  const plan10 = servicePlanFor(s10, getLevel("level-10")!)!;
  const plan30 = servicePlanFor(saveAt(30), getLevel("level-30")!)!;
  assert(
    ["sheet-pans", "oven-mitts", "frying-pans", "tongs", "skimmers", "stock-pot", "ladles"].every(
      (id) => list.includes(id as SupplyId),
    ) &&
      !list.some((id) => (GRANDMAS_TOOL_SET as readonly string[]).includes(id)) &&
      plan10.firstShoppingList &&
      plan10.toolsSoon.length === list.length &&
      servicePlanNeedsSheet(plan10) &&
      !plan30.firstShoppingList &&
      plan30.toolsSoon.every((t) => t.level > 30 && t.level <= 35),
    "S1: Level 10's sheet opens with the first shopping list (L11–20's tools, not Grandma's); later levels look 5 ahead",
    list,
  );
}

console.log("V. Covering missing tools");
{
  const s11 = giveGrandmasTools(saveAt(11, 0), 11);
  const plan = servicePlanFor(s11, getLevel("level-11")!)!;
  const viaAd = coverWithAd(s11, plan, "tools")!;
  const viaCredit = coverWithCredit(s11, plan, "tools")!;
  const rich = servicePlanFor(giveGrandmasTools(saveAt(11), 11), getLevel("level-11")!)!;
  assert(
    !!coverFor(plan, "tools") &&
      coverFor(rich, "tools") === null &&
      !!viaAd &&
      viaAd.credits === 0 &&
      viaAd.economyLedger.length === s11.economyLedger.length &&
      supplyUnits(viaAd.business.supplies, "sheet-pans") === 1 &&
      !!viaCredit &&
      viaCredit.credits === 0 &&
      supplierCreditOf(viaCredit).owed === coverFor(plan, "tools")!.creditCost &&
      servicePlanFor(viaCredit, getLevel("level-11")!)!.tools.applies &&
      (servicePlanFor(viaCredit, getLevel("level-11")!)!.tools as { ready: boolean }).ready,
    "V1: with $0 an ad brings the missing tools free, or supplier credit at the Market price; a player who can pay buys them",
  );
}

console.log("W. Wiring");
{
  const psc = read("src/components/kc/restaurant/PreServiceCheck.tsx");
  const app = read("src/App.tsx");
  const plan = read("src/game/restaurant/preServiceCheck.ts");
  assert(
    /\(!kit \|\| kit\.ready\) &&/.test(psc) &&
      /data-testid="psc-tools"/.test(psc) &&
      /data-testid="psc-shopping-list"/.test(psc) &&
      /if \(plan\.firstShoppingList\) return true;/.test(plan) &&
      /if \(plan\.tools\.applies && !plan\.tools\.ready\) return true;/.test(plan),
    "W1: START waits for the tools; the sheet opens for Level 10's list and for a missing tool",
  );
  assert(
    /giveGrandmasTools\(nextSave, restaurantLevelOf\(nextSave\.levelProgress\)\)/.test(app) &&
      /AD_PLACEMENT\.serviceTools/.test(app) &&
      AD_PLACEMENT.serviceTools === "service_tools" &&
      /"service_tools"/.test(read("public/playgama-bridge-config.json")),
    "W2: App gives Grandma's tools at a first completion; the tools ad has its own placement (in the config too)",
  );
  assert(
    ["kitchenTools", "dishService"].every(
      (m) => !/RESTAURANT_MODE|Math\.random/.test(noComments(`src/game/restaurant/${m}.ts`)),
    ),
    "W3: the modules never read RESTAURANT_MODE or Math.random",
  );
}

console.log(failures ? `KITCHEN TOOLS QA: ${failures} FAILURE(S)` : "KITCHEN TOOLS QA: ALL PASS");
process.exit(failures ? 1 : 0);
