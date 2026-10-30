/**
 * MARKET NEEDS QA (developer 2026-10-16; restaurant/marketNeeds.ts, the Market's
 * Ingredients and supplies sections, quickRestock.ts).
 *
 *  N  The Market's "needed" list comes only from the game's own checks: the
 *     Pre-Service Check's missing ingredients (buy = its Restock amount), its
 *     supplies and tools, tonight's closing supplies, and the tools coming up
 *     (as "soon"). A stocked service needs nothing today.
 *  O  Needed items are listed first, most urgent first; the rest keep their order.
 *  Q  Quick restock, on every level in lb and kg: each line costs exactly the
 *     Market price + 25 %, and the service is fully stocked afterwards.
 *  U  The Market shows it: highlighted cards with the amount, needed items
 *     first, "Buy everything needed", needed counts on the tabs.
 *  L  Which level (developer 2026-10-17: a Level 10 shopping list opened the
 *     Market with nothing highlighted): the open Pre-Service Check's level,
 *     else the current level, else the furthest unlocked — the first not
 *     played yet. With needed items a section opens on All (none hidden in
 *     another group), its group chips count them, and tools for the next
 *     levels get their own "needed for the next levels" note.
 *
 * Run: npx tsx scripts/restaurant-market-needs-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import { servicePlanFor } from "../src/game/restaurant/preServiceCheck.ts";
import { quickRestock, quickRestockPlan } from "../src/game/restaurant/quickRestock.ts";
import { restaurantQuote } from "../src/game/restaurant/restaurantEconomy.ts";
import { closingSuppliesFor } from "../src/game/restaurant/serviceSupplies.ts";
import {
  marketNeeds,
  needsFirst,
  planningLevelId,
  type MarketNeed,
} from "../src/game/restaurant/marketNeeds.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const read = (p: string) => fs.readFileSync(path.join(import.meta.dirname, "..", p), "utf8");
const atLevel = (n: number, measure: "lb" | "kg" = "lb"): SaveData => {
  const s = structuredClone(DEFAULT_SAVE);
  return {
    ...s,
    credits: 10_000_000,
    settings: { ...s.settings, measure },
    levelProgress: {
      ...s.levelProgress,
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
  };
};

console.log("N. Needs come from the game's own checks");
{
  const problems: string[] = [];
  for (const n of [3, 12, 25, 40, 60, 90, 120, 148]) {
    const save = atLevel(n);
    const plan = servicePlanFor(save, LEVELS[n - 1]!)!;
    const needs = marketNeeds(save);
    if (plan.check.applies)
      for (const row of plan.check.missingRows) {
        const need = needs.ingredients[row.ingredientId];
        if (!need || need.when !== "today" || need.buy !== row.buyUnits)
          problems.push(
            `L${n} ${row.ingredientId}: ${JSON.stringify(need)} vs buy ${row.buyUnits}`,
          );
      }
    if (plan.supplies.applies)
      for (const row of plan.supplies.rows.filter((r) => r.missing > 0 && !r.guest))
        if (needs.supplies[row.id]?.when !== "today") problems.push(`L${n} supply ${row.id}`);
    if (plan.tools.applies)
      for (const row of plan.tools.rows.filter((r) => r.missing > 0))
        if (needs.supplies[row.id]?.when !== "today") problems.push(`L${n} tool ${row.id}`);
    for (const line of closingSuppliesFor(save, n).filter((l) => l.have < l.need))
      if (!needs.supplies[line.id]) problems.push(`L${n} closing ${line.id}`);
    for (const soon of plan.toolsSoon)
      if (!needs.supplies[soon.id]) problems.push(`L${n} soon ${soon.id}`);
  }
  assert(
    problems.length === 0,
    "N1: every missing ingredient (buy = its Restock amount), supply, tool, closing supply and upcoming tool is listed",
    problems.slice(0, 6),
  );
  const tissues = marketNeeds(atLevel(40)).supplies.tissues;
  assert(
    tissues?.when === "tonight" && tissues.need === 1 && tissues.have === 0 && tissues.buy === 1,
    "N2: tonight's closing tissues: need 1, have 0 → buy 1 pack, marked for tonight",
    tissues,
  );
  // Stock the service (quick restock) → nothing left for today's orders.
  const save = atLevel(40);
  const plan = servicePlanFor(save, LEVELS[39]!)!;
  const r = quickRestock(save, plan.check);
  const after = r.ok ? marketNeeds(r.save) : null;
  assert(
    !!after && Object.values(after.ingredients).every((n) => n!.when !== "today"),
    "N3: once the service is stocked, no ingredient is needed for today's orders",
  );
  const done = { ...atLevel(40) };
  done.levelProgress = {
    ...done.levelProgress,
    completedLevelIds: [...done.levelProgress.completedLevelIds, "level-40"],
  };
  const none = marketNeeds(done);
  assert(
    none.levelNumber === null && Object.keys(none.supplies).length === 0,
    "N4: a level already played has nothing to plan",
  );
}

console.log("O. Needed first");
{
  const need = (when: MarketNeed["when"]): MarketNeed => ({
    when,
    why: "",
    need: 1,
    have: 0,
    buy: 1,
  });
  const items = ["a", "b", "c", "d", "e", "f"];
  const map: Record<string, MarketNeed> = {
    b: need("soon"),
    d: need("today"),
    e: need("guests"),
    f: need("tonight"),
  };
  assert(
    needsFirst(items, (i) => map[i]).join("") === "dfebac",
    "O1: today, tonight, menu guests, soon — then everything else in its own order",
  );
}

console.log("Q. Quick restock price and amount (every level, lb and kg)");
{
  let lines = 0;
  const bad: string[] = [];
  for (const measure of ["lb", "kg"] as const)
    for (let n = 3; n <= 148; n++) {
      const save = atLevel(n, measure);
      const plan = servicePlanFor(save, LEVELS[n - 1]!);
      if (!plan) continue;
      const q = quickRestockPlan(save, plan.check);
      if (!q) continue;
      for (const l of q.lines) {
        lines++;
        const market = restaurantQuote(save, l.ingredientId, l.marketUnits).totalCost;
        if (l.marketCost !== market || l.cost !== Math.round(market * 1.25))
          bad.push(`${measure} L${n} ${l.ingredientId}: ${l.cost} vs market ${market}`);
      }
      if (plan.check.applies && q.marketCost !== plan.check.missingCost)
        bad.push(
          `${measure} L${n}: quick's market ${q.marketCost} ≠ shown missing ${plan.check.missingCost}`,
        );
      const r = quickRestock(save, plan.check);
      const after = r.ok ? servicePlanFor(r.save, LEVELS[n - 1]!) : null;
      if (!r.ok || (after?.check.applies && !after.check.ready))
        bad.push(`${measure} L${n}: not stocked after`);
    }
  assert(
    lines > 200 && bad.length === 0,
    `Q1: ${lines} lines — each exactly the Market price + 25 %, the same Market total the sheet shows, and the service stocked afterwards`,
    bad.slice(0, 5),
  );
  assert(
    /data-testid="psc-quick-covers"/.test(read("src/components/kc/restaurant/PreServiceCheck.tsx")),
    "Q2: the sheet says Quick restock buys this service's missing ingredients only (not menu guests' stock)",
  );
}

console.log("U. The Market shows it");
{
  const sup = read("src/components/kc/MarketSupplies.tsx");
  const ing = read("src/components/kc/MarketIngredients.tsx");
  const shop = read("src/components/kc/Shop.tsx");
  assert(
    /needsFirst\(/.test(sup) &&
      /packs\[id\] \?\? needs\[id\]\?\.buy \?\? 1/.test(sup) &&
      /<NeedNote/.test(sup) &&
      /Buy everything needed/.test(sup),
    "U1: supplies (Smallwares, Tableware, Takeaway, Cleaning): needed cards highlighted with the amount, first, preset, and Buy everything needed",
  );
  assert(
    /needsFirst\(/.test(ing) &&
      /needs\[id\]\?\.buy/.test(ing) &&
      /<NeedNote/.test(ing) &&
      /label: "Needed"/.test(ing),
    "U2: ingredients: a Needed group first, highlighted with the amount, preset",
  );
  assert(
    /needCount\[item\.id\]/.test(shop),
    "U3: each Market tab shows how many items it needs today",
  );
}

console.log("L. Which level the Market plans for");
{
  const l10 = atLevel(10);
  const tools = marketNeeds(l10, "level-10").supplies;
  assert(
    planningLevelId(l10, "level-10") === "level-10" &&
      tools["frying-pans"]?.when === "soon" &&
      tools["frying-pans"]?.level === 11 &&
      tools["stock-pot"]?.when === "soon" &&
      tools["mixing-bowls"]?.when === "today",
    "L1: Level 10's check → the Market highlights today's tools and the shopping list's (fry pan at L11, stock pot …)",
    tools,
  );
  // A save whose current level is already played (or missing) still plans the next one.
  const stale = atLevel(10);
  stale.levelProgress = {
    ...stale.levelProgress,
    currentLevelId: "level-9",
  };
  const none = atLevel(10);
  none.levelProgress = { ...none.levelProgress, currentLevelId: null as unknown as string };
  assert(
    planningLevelId(stale) === "level-10" &&
      planningLevelId(none) === "level-10" &&
      marketNeeds(stale).supplies["frying-pans"]?.when === "soon" &&
      planningLevelId(stale, "level-3") === "level-10",
    "L2: a played or missing current level falls back to the next unplayed one; a played check level is skipped",
    { stale: planningLevelId(stale), none: planningLevelId(none) },
  );
  const sup = read("src/components/kc/MarketSupplies.tsx");
  const ing = read("src/components/kc/MarketIngredients.tsx");
  const app = read("src/App.tsx");
  const router = read("src/ScreensRouter.tsx");
  assert(
    /planLevelId=\{serviceCheckLevelId\}/.test(app) &&
      /planLevelId=\{planLevelId\}/.test(router) &&
      /marketNeeds\(save, planLevelId\)/.test(sup) &&
      /marketNeeds\(save, planLevelId\)/.test(ing),
    "L3: the open Pre-Service Check's level reaches the Market (App → router → Shop → sections)",
  );
  assert(
    /sectionNeeds\.length > 0 \? "All"/.test(sup) &&
      /data-group-needs/.test(sup) &&
      /market-soon-/.test(sup) &&
      /focusId && neededIds\.length === 0/.test(ing),
    "L4: with needed items a section opens on All, its group chips count them, next-level tools get a note",
  );
  assert(
    /data-needs-soon=\{soonCount\[item\.id\]\}/.test(read("src/components/kc/Shop.tsx")),
    "L5: a Market tab with only next-level needs shows them in a gold badge",
  );
}

console.log(failures ? `\nMARKET NEEDS QA: ${failures} FAILURE(S)` : "\nMARKET NEEDS QA: ALL PASS");
process.exit(failures ? 1 : 0);
