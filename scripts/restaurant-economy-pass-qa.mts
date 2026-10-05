/**
 * RESTAURANT ECONOMY PASS QA — the Unified Restaurant economy pass
 * (docs/ECONOMY_TODO.md), restaurant build only.
 *
 *  P. P0 — no double food cost (restaurant/restaurantEconomy.ts): a campaign
 *     order pays recipe earnings + quality bonus; the food is the real stock
 *     bought in the Market. The quality bonus and its equipment / helper
 *     boosts stay; no INGREDIENT_COGS transaction; the release build's
 *     settlement is unchanged.
 *  T. The target (Economy V2.5, approved): a completionist who buys
 *     everything finishes Level 250 owning it all with $100k–$150k. Measured
 *     with the full restaurant simulation (restaurantCampaignSim.mts): with
 *     P0 it lands in the band; with the double charge it fell below.
 *  S. Safety: the completionist's run has no soft-lock, money never < 0,
 *     opening cash + ledger = cash at every level.
 *  W. Wiring: App applies P0 to both campaign serve paths only under
 *     RESTAURANT_MODE; the result screen says the food came from stock.
 *  I. Information (not asserted — open decisions): the Endless Restaurant's
 *     daily profit after L250.
 *
 * Run: npx tsx scripts/restaurant-economy-pass-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { run, freshRestaurantSave, $ } from "./restaurantCampaignSim.mts";
import { missingPurchases, playBusinessDay } from "./economy-v25-simulation.mts";
import { computeSettlement } from "../src/game/economy/EconomySettlement.ts";
import { foodFromStock, restaurantSettlement } from "../src/game/restaurant/restaurantEconomy.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");

console.log("P. P0 — no double food cost");
{
  const recipe = CAMPAIGN_RECIPES[0]!;
  const base = computeSettlement(recipe, 3, 92);
  const withKnife = computeSettlement(recipe, 3, 92, "santoku", "maple");
  const r = restaurantSettlement(base);
  const rk = restaurantSettlement(withKnife);
  assert(
    base.finalCOGS > 0 &&
      r.finalCOGS === 0 &&
      r.netResult === base.revenue + base.qualityBonus &&
      r.revenue === base.revenue &&
      r.qualityBonus === base.qualityBonus &&
      !r.transactions.some((t) => t.type === "INGREDIENT_COGS") &&
      foodFromStock(r) &&
      !foodFromStock(base),
    `P1: an order pays earnings + quality bonus (${$(base.revenue + base.qualityBonus)} instead of ${$(base.netResult)}); no built-in food cost`,
  );
  assert(
    rk.qualityBonus === withKnife.qualityBonus &&
      rk.netResult === withKnife.revenue + withKnife.qualityBonus,
    "P2: equipment / helper boosts to the quality bonus still count",
  );
  assert(
    JSON.stringify(computeSettlement(recipe, 3, 92)).length > 0 &&
      base.netResult === Math.max(0, base.revenue - base.finalCOGS + base.qualityBonus),
    "P3: the release settlement (EconomySettlement) is unchanged — economy-v2-final-qa guards its baseline",
  );
}

console.log("T. The approved target, measured with the full restaurant simulation");
const after = run(
  "completionist (economy pass)",
  freshRestaurantSave(),
  1,
  { profile: "completionist" },
  false,
);
const before = run(
  "completionist (double food cost)",
  freshRestaurantSave(),
  1,
  { profile: "completionist", legacyFoodCost: true },
  false,
);
console.log(
  `    completionist at L250: ${$(before.s.credits)} with the double charge → ${$(after.s.credits)} after the pass (target $100,000–$150,000)`,
);
{
  assert(
    missingPurchases(after.s).length === 0 && after.stats.levels === 250,
    "T1: the completionist owns everything at Level 250",
  );
  assert(
    after.s.credits >= 100_000_00 && after.s.credits <= 150_000_00,
    `T2: and finishes with ${$(after.s.credits)} — inside the approved $100k–$150k band`,
  );
  assert(
    before.s.credits < 100_000_00 && after.s.credits > before.s.credits,
    `T3: the double charge left it below the band (${$(before.s.credits)}); the pass fixes that`,
  );
}

console.log("S. Safety");
assert(
  after.stats.blocked.length === 0 && after.stats.invariant.length === 0,
  `S1: no soft-lock; money never < 0; cash = ledger at every level ${[...after.stats.blocked, ...after.stats.invariant].slice(0, 2).join(" | ")}`,
);

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  assert(
    (app.match(/computed && RESTAURANT_MODE \? restaurantSettlement\(computed\) : computed/g) ?? [])
      .length === 2,
    "W1: both campaign serve paths apply P0, only under RESTAURANT_MODE",
  );
  const ui = read("src/components/kc/game/ServiceOrderComplete.tsx");
  assert(
    /foodFromStock\(settlement\)/.test(ui) && /Ingredients · from your stock/.test(ui),
    "W2: the result screen says the food came from your stock instead of a food-cost line",
  );
  const mod = read("src/game/restaurant/restaurantEconomy.ts").replace(/\/\*[\s\S]*?\*\//g, "");
  assert(!/RESTAURANT_MODE|Math\.random/.test(mod), "W3: the module never reads the switch");
}

console.log("I. Information — the Endless Restaurant after L250 (open decision)");
{
  for (const [label, save] of [
    ["with the team the campaign required", after.s],
    ["with no staff", { ...after.s, business: { ...after.s.business, staff: { hiredRoles: [] } } }],
  ] as const) {
    let s = save;
    for (let d = 0; d < 14; d++) s = playBusinessDay(s).save;
    console.log(`    14 days ${label}: ${$((s.credits - save.credits) / 14)}/day`);
  }
}

console.log(
  failures
    ? `RESTAURANT ECONOMY PASS QA: ${failures} FAILURE(S)`
    : "RESTAURANT ECONOMY PASS QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
