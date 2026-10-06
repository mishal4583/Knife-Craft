/**
 * ECONOMY FINAL CANDIDATES — the sweep behind the final economy values
 * (docs/ECONOMY_FINAL.md). Runs the full restaurant campaign simulation
 * (economy-final-sim.mts) for candidate kitchen prices, kitchen quality
 * schedules and equipment quality caps, and prints the Level-250 cash of
 * the saver, the progression buyer and the completionist for each.
 *
 * The candidates are applied by overwriting RESTAURANT_INVESTMENT_RULES in
 * this process only (the shipped values are whatever the module holds).
 *
 * Run: npx tsx scripts/economy-final-candidates.mts
 */
import { RESTAURANT_INVESTMENT_RULES as R } from "../src/game/restaurant/restaurantInvestments.ts";
import { SCENARIOS, runScenario } from "./economy-final-sim.mts";
import { $ } from "./restaurantCampaignSim.mts";
import { dollars } from "../src/game/money.ts";

const TIERS = [
  "growing-kitchen",
  "established-kitchen",
  "neighborhood-cafe",
  "flourishing-cafe",
  "grand-kitchen",
] as const;
const shipped = structuredClone(R);

const PRICES: Record<string, number[]> = {
  "$135k (release)": [20, 25, 25, 30, 35],
  $115k: [17, 21, 22, 25, 30],
  $110k: [16, 20, 21, 24, 29],
  $105k: [15, 19, 20, 23, 28],
};
const QUALITY: Record<string, number[]> = {
  none: [0, 0, 0, 0, 0],
  "low 1/2/2.5/3.5/5 %": [0.01, 0.02, 0.025, 0.035, 0.05],
  "mid 1.5/3/4/5/7 %": [0.015, 0.03, 0.04, 0.05, 0.07],
  "high 2/4/5.5/7/9 %": [0.02, 0.04, 0.055, 0.07, 0.09],
};
const EQUIPMENT: Record<string, number> = { none: 0, "two-thirds": 2 / 3, full: 1 };

function apply(prices: number[], quality: number[], equipment: number) {
  TIERS.forEach((t, i) => {
    R.kitchenPrices[t] = dollars(prices[i]! * 1000);
    R.kitchenQuality[t] = quality[i]!;
  });
  R.blacksmithQuality = shipped.blacksmithQuality * equipment;
  R.knifeRollQuality = shipped.knifeRollQuality * equipment;
  R.boardSetQuality = shipped.boardSetQuality * equipment;
  for (const id of Object.keys(shipped.helperQuality))
    R.helperQuality[id] = shipped.helperQuality[id]! * equipment;
}

const sc = (k: string) => SCENARIOS.find((s) => s.key === k)!;
const rows: string[] = [];
function trial(label: string, prices: number[], quality: number[], equipment: number) {
  apply(prices, quality, equipment);
  const b = runScenario(sc("B"));
  const c = runScenario(sc("C"));
  const ok =
    c.final >= dollars(150_000) && c.stats.blocked.length === 0 && c.stats.invariant.length === 0;
  rows.push(
    `| ${label} | ${$(b.final)} | ${$(c.final)} | ${$(c.minCash.cash)} | ${c.final >= dollars(160_000) && c.final <= dollars(175_000) ? "in target" : ok ? "≥ $150k" : "BELOW $150k"} |`,
  );
  console.log(rows.at(-1));
}

console.log("| candidate | B progression | C completionist | C lowest cash | verdict |");
console.log("|---|---|---|---|---|");
for (const [p, prices] of Object.entries(PRICES))
  for (const [q, quality] of Object.entries(QUALITY))
    trial(`${p} · kitchen ${q} · equipment full`, prices, quality, 1);
for (const [e, f] of Object.entries(EQUIPMENT))
  trial(`$110k · kitchen mid · equipment ${e}`, PRICES["$110k"]!, QUALITY["mid 1.5/3/4/5/7 %"]!, f);
apply(
  TIERS.map((t) => shipped.kitchenPrices[t]! / 100_000),
  TIERS.map((t) => shipped.kitchenQuality[t]!),
  1,
);
