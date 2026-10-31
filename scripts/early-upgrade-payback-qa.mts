/**
 * EARLY UPGRADE PAYBACK QA (Phase 3, 2026-10-31): the opening economy's investments, checked for the
 * two things a player feels — "can I reach it soon?" and "does it ever pay me back?".
 *
 *   L. Ladders: inside a family (knives, boards, fridges) the price rises with the unlock level, so a
 *      later item is never cheaper than an earlier one. The kitchen tiers are the one KNOWN exception
 *      (developer decision D8, 2026-10-30: "left as set"), pinned here so a change is seen.
 *   A. Reach: every knife and board costs at most a dozen services of the completionist's real income at the
 *      time they open (all of them open with the Market at Level 5), so none is a wall.
 *   B. Payback, measured on the economy simulation (completionist who buys everything versus one who buys
 *      only the kitchen tiers, the same staffing):
 *        - the items (knives, boards, Blacksmith, fridges, helpers) return a measured share of what they cost.
 *          The ratio is printed and pinned as a finding, NOT as a target: they are power and quality items
 *          (sharper cuts, better scores), not income machines;
 *        - the kitchen tiers' own quality share, measured on the order earnings, does NOT pay back their price
 *          in money. They are restoration milestones (quality, menu seats, the reveal), so the price is a
 *          prestige goal. Reported for the developer's decision (D8-b), nothing changed.
 *
 * Run: npx tsx scripts/early-upgrade-payback-qa.mts
 */
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import { KNIFE_CATALOG } from "../src/game/knives/knifeDefinitions.ts";
import { BOARD_CATALOG } from "../src/game/boards/boardDefinitions.ts";
import { REFRIGERATOR_CATALOG } from "../src/game/business/refrigeratorDefinitions.ts";
import { KITCHEN_UPGRADE_CATALOG } from "../src/game/kitchen/kitchenUpgradeDefinitions.ts";
import { RESTAURANT_INVESTMENT_RULES as R } from "../src/game/restaurant/restaurantInvestments.ts";
import { curatedRewardAt } from "../src/game/levels/levelRewards.ts";
import { LAST_CAMPAIGN_LEVEL as LAST } from "../src/game/restaurant/restaurantProgression.ts";
import { SCENARIOS, runScenario } from "./economy-final-sim.mts";

let failed = 0;
function check(id: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${id}`,
    ok || detail === undefined ? "" : JSON.stringify(detail),
  );
}
const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

type Item = { id: string; price: number; unlockLevel: number };
const asItems = (cat: unknown, unlock: (x: Record<string, unknown>) => number): Item[] =>
  Object.values(cat as Record<string, Record<string, unknown>>)
    .filter((x) => (x.price as number) > 0)
    .map((x) => ({ id: x.id as string, price: x.price as number, unlockLevel: unlock(x) }));
const knives = asItems(KNIFE_CATALOG, (x) => (x.unlockLevel as number) ?? 1);
const boards = asItems(BOARD_CATALOG, (x) => (x.unlockLevel as number) ?? 1);
const fridges = asItems(REFRIGERATOR_CATALOG, (x) => (x.unlockLevel as number) ?? 1);

// ── L. ladders ───────────────────────────────────────────────────────────
const rises = (items: Item[]) => {
  const byLevel = [...items].sort((a, b) => a.unlockLevel - b.unlockLevel || a.price - b.price);
  return byLevel.every((x, i) => i === 0 || x.price >= byLevel[i - 1]!.price);
};
check("L1 knife prices rise with their unlock level", rises(knives), knives);
check("L2 board prices rise with their unlock level", rises(boards), boards);
check("L3 refrigerator prices rise", fridges.length < 2 || rises(fridges), fridges);
const tiers = KITCHEN_UPGRADE_CATALOG.filter((k) => R.kitchenPrices[k.id] !== undefined);
const tierPrices = tiers.map((k) => R.kitchenPrices[k.id]!);
check(
  "L4 KNOWN exception (D8, left as set): the first kitchen tier costs more than the next three",
  tierPrices[0]! > tierPrices[1]! &&
    tierPrices[0]! > tierPrices[2]! &&
    tierPrices[0]! > tierPrices[3]!,
  tierPrices.map(usd),
);
check(
  "L5 from the second tier on the kitchen prices rise, and so do their quality shares and seats",
  tierPrices.slice(1).every((p, i, a) => i === 0 || p > a[i - 1]!) &&
    tiers.every(
      (k, i) =>
        i === 0 || (R.kitchenQuality[k.id] ?? 0) > (R.kitchenQuality[tiers[i - 1]!.id] ?? 0),
    ),
  tiers.map((k) => [k.id, R.kitchenPrices[k.id], R.kitchenQuality[k.id]]),
);

// ── A. reach ─────────────────────────────────────────────────────────────
console.log("\nSimulating the completionist and the kitchen-tiers-only player…");
const simC = runScenario(SCENARIOS.find((s) => s.key === "C")!);
const simB = runScenario(SCENARIOS.find((s) => s.key === "B")!);
const rowAt = (r: typeof simC, n: number) => r.rows.find((x) => x.level === n)!;
/** What the completionist takes in per service between two checkpoints (completion pay, orders, tips, guests). */
const incomePer = (a: number, b: number) =>
  (rowAt(simC, b).income - rowAt(simC, a).income) / (b - a);
const incomeNow = incomePer(10, 20);
const SERVICES_LIMIT = 12;
const gear = [...knives, ...boards].map((x) => ({ ...x, services: x.price / incomeNow }));
console.log(`\nReach: price ÷ income per service at Levels 10–20 (${usd(incomeNow)})`);
for (const r of gear)
  console.log(
    `  ${r.id.padEnd(14)} ${usd(r.price).padStart(8)}  ${r.services.toFixed(1)} services`,
  );
check(
  `A1 every knife and board costs at most ${SERVICES_LIMIT} services of the completionist's income at Levels 10–20`,
  gear.every((r) => r.services <= SERVICES_LIMIT),
  gear.filter((r) => r.services > SERVICES_LIMIT).map((r) => [r.id, r.services.toFixed(1)]),
);

// ── B. payback ───────────────────────────────────────────────────────────
const last = rowAt(simC, LAST);
const lastB = rowAt(simB, LAST);
const itemCost = last.purchases - lastB.purchases;
const extraEarned = simC.final - simB.final + itemCost;
console.log("\nPayback of the items, measured (completionist vs kitchen-tiers-only):");
console.log(
  `  items bought: ${usd(itemCost)} · extra money earned by the end because of them: ${usd(extraEarned)} · returned ${(extraEarned / itemCost).toFixed(2)}x`,
);
check(
  "B1 FINDING pinned: the items are bought, the difference is measured, and it is a number (not a payback target)",
  itemCost > 0 && Number.isFinite(extraEarned / itemCost),
  { itemCost, extraEarned },
);
const earnPer = (a: number, b: number) =>
  (rowAt(simC, b).orderEarnings - rowAt(simC, a).orderEarnings) / (b - a);
const earn = earnPer(40, 50);
console.log(
  `\nKitchen tiers: price ÷ (quality share × order earnings per service at Levels 40–50, ${usd(earn)})`,
);
const kitchens = tiers.map((k) => {
  const price = R.kitchenPrices[k.id]!;
  const gain = (R.kitchenQuality[k.id] ?? 0) * earn;
  return { id: k.id, price, gain, services: price / gain, opens: k.unlockLevel };
});
for (const r of kitchens)
  console.log(
    `  ${r.id.padEnd(22)} ${usd(r.price).padStart(8)}  ≈ ${usd(r.gain)}/service  → ${Math.round(r.services).toLocaleString()} services`,
  );
check(
  "B2 REPORT (developer decision D8-b): no kitchen tier pays its price back in money inside the campaign — they are restoration milestones (quality, menu seats, the reveal)",
  kitchens.every((r) => r.services > LAST - r.opens),
  kitchens.map((r) => [r.id, Math.round(r.services)]),
);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
