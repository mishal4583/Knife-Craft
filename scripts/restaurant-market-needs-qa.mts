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
import { marketNeeds, needsFirst, type MarketNeed } from "../src/game/restaurant/marketNeeds.ts";

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
  for (const n of [3, 12, 25, 40, 60, 90, 120, 150]) {
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
    for (let n = 3; n <= 150; n++) {
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
      /Needed for today/.test(ing),
    "U2: ingredients: a Needed for today group first, highlighted with the amount, preset",
  );
  assert(
    /needCount\[item\.id\]/.test(shop),
    "U3: each Market tab shows how many items it needs today",
  );
}

console.log(failures ? `\nMARKET NEEDS QA: ${failures} FAILURE(S)` : "\nMARKET NEEDS QA: ALL PASS");
process.exit(failures ? 1 : 0);
