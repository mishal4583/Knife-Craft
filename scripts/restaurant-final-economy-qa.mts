/**
 * RESTAURANT FINAL ECONOMY QA — the final economy design pass
 * (docs/ECONOMY_FINAL.md, developer 2026-10-06), restaurant build:
 *
 *  T. Target: the completionist (every item, all 250 levels, no Endless)
 *     ends Level 250 with ≥ $150,000 — preferred $160k–$175k — Local,
 *     Wholesale and Premium alike; the saver stays viable; the gap shrank.
 *  S. Safety: every player completes every level, credits are whole cents
 *     and never < 0, cash = opening + ledger, no soft-lock; a prudent
 *     completionist (keeps $500) never needs Grandma's goods.
 *  V. Investment value: kitchen tiers, Blacksmith, knives, boards and
 *     helpers each add quality bonus; kitchen tiers seat more guests; staff
 *     capacity serves more guests; the bigger fridges hold whole days.
 *  R. Rules: kitchen prices ($110k) and quality shares, equipment shares,
 *     guest capacity, Emergency Service (no quality bonus, cleared on
 *     completion), whole-day stocking, Today's Special 15 % ≤ $50, BUSY =
 *     the whole demand; no double food cost.
 *  X. Release untouched: an unstamped save pays the catalog prices and gets
 *     no shares; the new modules never read RESTAURANT_MODE.
 *  W. Wiring: App's two serve paths, the check layer, the kitchen purchase.
 *  O. Old saves: no emergency / special fields → defaults, nothing moves.
 *
 * Run: npx tsx scripts/restaurant-final-economy-qa.mts
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

import fs from "node:fs";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import { SCENARIOS, runScenario, type ScenarioResult } from "./economy-final-sim.mts";
import { $ } from "./restaurantCampaignSim.mts";
import { dollars } from "../src/game/money.ts";
import { KITCHEN_UPGRADE_CATALOG } from "../src/game/kitchen/kitchenUpgradeDefinitions.ts";
import {
  RESTAURANT_INVESTMENT_RULES,
  equipmentQuality,
  isRestaurantSave,
  kitchenGuestSeats,
  kitchenQualityPct,
  kitchenTierPrice,
  restaurantQuality,
} from "../src/game/restaurant/restaurantInvestments.ts";
import {
  restaurantQualityBonusPct,
  restaurantSettlement,
} from "../src/game/restaurant/restaurantEconomy.ts";
import {
  isEmergencyService,
  markEmergencyService,
} from "../src/game/restaurant/emergencyService.ts";
import { completeLevel } from "../src/game/levels/LevelManager.ts";
import { menuGuestCapacity, menuGuestsFor } from "../src/game/restaurant/menuGuests.ts";
import { menuGuestsPerService } from "../src/game/restaurant/restaurantProgression.ts";
import { todaysSpecialBonus } from "../src/game/restaurant/restaurantEvents.ts";
import { starsForDay } from "../src/game/restaurant/restaurantStanding.ts";
import { computeSettlement } from "../src/game/economy/EconomySettlement.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { freshRestaurantSave } from "./restaurantCampaignSim.mts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const read = (p: string) => fs.readFileSync(p, "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "");

console.log("Simulating the campaign for seven players…");
const R: Record<string, ScenarioResult> = {};
for (const sc of SCENARIOS) R[sc.key] = runScenario(sc);
const atL = (r: ScenarioResult, n: number) => r.rows.find((x) => x.level === n)!;

console.log("T. The Level-250 target (no Endless income)");
{
  const c = R.C!;
  assert(
    c.final >= dollars(150_000) && R.D!.final >= dollars(150_000) && R.E!.final >= dollars(150_000),
    `T1: completionist ≥ $150,000 — Local ${$(c.final)}, Wholesale ${$(R.D!.final)}, Premium ${$(R.E!.final)}`,
  );
  assert(
    c.final >= dollars(160_000) && c.final <= dollars(175_000),
    `T2: completionist in the preferred $160k–$175k (${$(c.final)})`,
  );
  const owns = c.save;
  assert(
    KITCHEN_UPGRADE_CATALOG.every((k) => owns.ownedKitchenUpgradeIds.includes(k.id)) &&
      atL(c, 250).purchases === dollars(168_430),
    `T3: the completionist owns every kitchen tier and bought every item (${$(atL(c, 250).purchases)})`,
  );
  assert(
    R.A!.final >= dollars(250_000) && R.A!.final - c.final < dollars(179_290),
    `T4: saving stays viable (${$(R.A!.final)}) and the saver–completionist gap shrank (${$(R.A!.final - c.final)} < $179,290)`,
  );
}

console.log("S. Safety");
{
  const all = Object.values(R);
  assert(
    all.every((r) => r.stats.levels === 250 && r.stats.blocked.length === 0),
    "S1: every player completes all 250 levels — no soft-lock",
  );
  assert(
    all.every((r) => r.stats.invariant.length === 0 && r.minCash.cash >= 0),
    `S2: credits whole cents, never < 0, cash = opening + ledger after every level (lowest: ${all.map((r) => `${r.key} ${$(r.minCash.cash)}`).join(", ")})`,
  );
  const g = R.G!;
  assert(
    g.minCash.cash >= dollars(450) &&
      g.stats.emergencyOrders === 0 &&
      g.final >= dollars(160_000) &&
      [20, 30, 40, 50, 75, 91].every((n) => atL(g, n).wallet >= dollars(450)),
    `S3: a prudent completionist (keeps $500) never dips (L20–L91 ≥ $450, lowest ${$(g.minCash.cash)}), never needs Grandma, still ends ${$(g.final)}`,
  );
}

console.log("V. Investment value");
{
  const q = R.C!.stats.qualityBy;
  assert(
    ["kitchen", "blacksmith", "knives", "boards", "helpers"].every((k) => (q[k] ?? 0) > 0),
    `V1: every investment adds quality bonus — kitchen ${$(q.kitchen ?? 0)}, Blacksmith ${$(q.blacksmith ?? 0)}, knives ${$(q.knives ?? 0)}, boards ${$(q.boards ?? 0)}, helpers ${$(q.helpers ?? 0)}`,
  );
  assert(
    R.B!.stats.guests > R.A!.stats.guests && R.C!.stats.guests > R.A!.stats.guests,
    `V2: the kitchen's seats bring more menu guests (saver ${R.A!.stats.guests}, kitchen buyer ${R.B!.stats.guests}, completionist ${R.C!.stats.guests})`,
  );
  const c250 = atL(R.C!, 250);
  const a250 = atL(R.A!, 250);
  // Realistic portions (developer 2026-10-08) need about 2.5× less fridge than a pound per step:
  // before them the completionist peaked at L91 61 / L250 102 of 140; now about 35 / 51.
  assert(
    c250.fridgePeak > 40 && c250.fridgePeak <= c250.fridgeCap && a250.fridgePeak <= 40,
    `V3: whole-day stocking outgrows the Basic fridge by L250 (completionist L91 ${atL(R.C!, 91).fridgePeak}, L250 ${c250.fridgePeak} of ${c250.fridgeCap}); service-by-service stocking still fits the Basic (saver ${a250.fridgePeak}/40)`,
  );
  assert(
    R.E!.stats.qualityBy.supplier! > 0 && R.D!.final > R.C!.final,
    `V4: Premium adds quality (${$(R.E!.stats.qualityBy.supplier!)}) and Wholesale is cheaper than Local (+${$(R.D!.final - R.C!.final)})`,
  );
}

console.log("R. Rules");
{
  const stamped = freshRestaurantSave();
  const prices = KITCHEN_UPGRADE_CATALOG.map((d) => kitchenTierPrice(d, stamped));
  const grand = kitchenTierPrice(KITCHEN_UPGRADE_CATALOG.at(-1)!, stamped);
  assert(
    prices.reduce((a, b) => a + b, 0) === dollars(110_000) && grand === Math.max(...prices),
    `R1: kitchen tiers cost $110,000 in the restaurant (${prices.map((p) => $(p)).join(" / ")}); the Grand Kitchen stays the dearest`,
  );
  const withTiers = (ids: string[]): SaveData => ({ ...stamped, ownedKitchenUpgradeIds: ids });
  const tiers = KITCHEN_UPGRADE_CATALOG.map((d) => d.id);
  const shares = tiers.map((_, i) => kitchenQualityPct(withTiers(tiers.slice(0, i + 1))));
  assert(
    JSON.stringify(shares) === JSON.stringify([0, 0.015, 0.03, 0.04, 0.05, 0.07]) &&
      kitchenGuestSeats(withTiers(tiers)) === 2,
    `R2: kitchen quality 0 / 1.5 / 3 / 4 / 5 / 7 %, the Grand Kitchen seats 2 more guests`,
  );
  const full = R.C!.save;
  const eq = equipmentQuality(full);
  assert(
    Math.abs(eq.total - 0.05) < 1e-9 && eq.total <= 0.05 && equipmentQuality(stamped).total === 0,
    `R3: equipment quality at most 5 % (completionist ${(eq.total * 100).toFixed(1)} %: Blacksmith ${(eq.blacksmith * 100).toFixed(1)}, knives ${(eq.knives * 100).toFixed(1)}, boards ${(eq.boards * 100).toFixed(1)}, helpers ${(eq.helpers * 100).toFixed(1)}); nothing owned = 0`,
  );
  const recipe = getCampaignRecipe("camp-sliced-tomato-plate")!;
  const s = computeSettlement(recipe, 3, 92, "chef", "maple", 100, [], "local-market");
  const normal = restaurantSettlement(s, 0.1);
  const emergency = restaurantSettlement(s, 0.1, { emergency: true });
  assert(
    normal.finalCOGS === 0 &&
      normal.qualityBonus === s.qualityBonus + Math.round(s.revenue * 0.1) &&
      emergency.qualityBonus === 0 &&
      emergency.netResult === s.revenue &&
      !emergency.transactions.some(
        (t) => t.type === "QUALITY_BONUS" || t.type === "INGREDIENT_COGS",
      ),
    `R4: no double food cost; the restaurant's share rides on the quality bonus; an Emergency Service earns its pay (${$(emergency.netResult)}) but no quality bonus`,
  );
  const marked = markEmergencyService(stamped, "level-30");
  const done = completeLevel("level-30", {
    ...marked.levelProgress,
    completedLevelIds: Array.from({ length: 29 }, (_, i) => `level-${i + 1}`),
    currentLevelId: "level-30",
    highestUnlockedLevelId: "level-30",
  });
  assert(
    isEmergencyService(marked.levelProgress, "level-30") &&
      !isEmergencyService(stamped.levelProgress, "level-30") &&
      !isEmergencyService(done.progress, "level-30") &&
      markEmergencyService(marked, "level-30") === marked,
    "R5: Emergency Service is recorded per level, idempotent, and dropped when the level completes",
  );
  const crew: SaveData = {
    ...stamped,
    business: { ...stamped.business, staff: { hiredRoles: ["prep-cook", "server"] as never } },
  };
  assert(
    menuGuestCapacity(stamped) === 2 &&
      menuGuestCapacity(crew) === 4 &&
      menuGuestsFor(stamped, 51) === Math.min(menuGuestsPerService(51), 2) &&
      menuGuestsFor({ ...crew, ownedKitchenUpgradeIds: tiers }, 51) ===
        Math.min(menuGuestsPerService(51) + 2, 4) &&
      menuGuestsFor(crew, 10) === 0,
    "R6: menu guests = min(schedule + the kitchen's seats, the team's capacity); none before the menu",
  );
  assert(
    todaysSpecialBonus(dollars(100)) === dollars(15) &&
      todaysSpecialBonus(dollars(1000)) === dollars(50) &&
      todaysSpecialBonus(0) === 0,
    "R7: Today's Special pays 15 % of the day's revenue, capped at the existing $50",
  );
  const day = { profit: 100, ordersServed: 10, inspectionPassed: true };
  assert(
    !starsForDay({ ...day, customersWanted: 14 }).busy &&
      starsForDay({ ...day, customersWanted: 10 }).busy,
    "R8: BUSY needs every guest who wanted to eat served (the demand before the team's cap)",
  );
}

console.log("X. Release untouched");
{
  const release = structuredClone(DEFAULT_SAVE) as SaveData;
  assert(
    !isRestaurantSave(release) &&
      KITCHEN_UPGRADE_CATALOG.every((d) => kitchenTierPrice(d, release) === d.price) &&
      KITCHEN_UPGRADE_CATALOG.reduce((n, d) => n + d.price, 0) === dollars(135_000),
    "X1: a release save pays the catalog kitchen prices ($135,000 in total)",
  );
  assert(
    ["restaurantInvestments", "emergencyService"].every(
      (m) => !/RESTAURANT_MODE|Math\.random/.test(code(`src/game/restaurant/${m}.ts`)),
    ),
    "X2: the new modules never read RESTAURANT_MODE or Math.random",
  );
}

console.log("W. Wiring");
{
  const app = code("src/App.tsx");
  const serves =
    app.match(
      /restaurantSettlement\(computed, save \? restaurantQualityBonusPct\(save\) : 0, \{[\s\S]*?isEmergencyService\(save\.levelProgress, level\.id\)/g,
    ) ?? [];
  assert(
    serves.length === 2 && !/supplierEffects\(save\)\.qualityBonusPct/.test(app),
    "W1: both campaign serve paths pay the restaurant's quality share and honour Emergency Service",
  );
  const layer = code("src/components/kc/restaurant/ServiceCheckLayer.tsx");
  assert(
    (layer.match(/markEmergencyService\(next, plan\.level\.id\)/g) ?? []).length === 2 &&
      /dayStock=\{dayStockFor\(save, plan\.level\)\}/.test(layer),
    "W2: the Pre-Service Check marks pantry/spares services as Emergency Service and offers whole-day stocking",
  );
  assert(
    /const price = kitchenTierPrice\(def, save\)/.test(
      code("src/game/kitchen/KitchenUpgradeManager.ts"),
    ) && /kitchenTierPrice\(selected, save\)/.test(code("src/components/kc/KitchenUpgrades.tsx")),
    "W3: the kitchen purchase and its screen use the same price",
  );
  assert(
    /payTodaysSpecial\(\s*starred,\s*closingDay,\s*closedDay\?\.revenue \?\? 0,?\s*\)/.test(app) &&
      /withTodaysSpecialServed\(/.test(app) &&
      /customersWanted = businessCustomersToday\(save\)\.demand/.test(app),
    "W4: Today's Special is paid at End Business Day from the day's revenue; BUSY reads the day's demand",
  );
  assert(
    restaurantQualityBonusPct(R.C!.save) > restaurantQuality(R.C!.save).total - 1e-9,
    "W5: the order's share = supplier + kitchen + equipment",
  );
}

console.log("O. Old saves");
{
  memoryStore.clear();
  const old = { ...structuredClone(DEFAULT_SAVE), version: 3 } as Record<string, unknown>;
  const lp = old.levelProgress as Record<string, unknown>;
  delete lp.emergency;
  delete (old.business as Record<string, unknown>).todaysSpecialServedDay;
  memoryStore.set("knifecraft.save.v1", JSON.stringify(old));
  (SaveManager as unknown as { cache: SaveData | null }).cache = null;
  const loaded = await SaveManager.load();
  assert(
    !isEmergencyService(loaded.levelProgress, "level-1") &&
      loaded.business.todaysSpecialServedDay === undefined &&
      loaded.credits === (old as unknown as SaveData).credits,
    "O1: a save without the new optional fields loads unchanged (no emergency, no special served, same cash)",
  );
}

console.log(
  failures
    ? `RESTAURANT FINAL ECONOMY QA: ${failures} FAILURE(S)`
    : "RESTAURANT FINAL ECONOMY QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
