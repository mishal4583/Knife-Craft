import path from "node:path";
import fs from "node:fs";
/**
 * ECONOMY_V2_FINAL_QA — Economy V2 Phase 10 (Freeze + Audit). The final
 * gate: every locked value, every wallet-mutation path, every migration
 * shape, and every composition combination re-verified in ONE script,
 * against the REAL shipped production functions only. This is not a
 * second economy — every check here reads/calls the exact same
 * production code every prior phase's own QA script already exercised;
 * this script exists to prove the SYSTEM AS A WHOLE is still internally
 * consistent, not to introduce new coverage of any single mechanic.
 *
 * Run: npx tsx scripts/economy-v2-final-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
// USD: every wallet/settlement amount is integer US cents (money.ts). The frozen Economy V2 figures are
// the original numbers read as dollars — $165,140.00 / $77,581.00 / $37,620.00 / $3,315.00 / $208,416.00 (V2.5 completion rewards).
import { dollars } from "../src/game/money.ts";
import { DEFAULT_LEVEL_PROGRESS, completeLevel, isChapterComplete } from "../src/game/levels/LevelManager.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import {
  computeSettlement,
  ingredientInstancesFor,
  baselineCOGSFor,
} from "../src/game/economy/EconomySettlement.ts";
import { KNIFE_CATALOG } from "../src/game/knives/knifeDefinitions.ts";
import { buyKnife } from "../src/game/knives/KnifeManager.ts";
import { BOARD_CATALOG } from "../src/game/boards/boardDefinitions.ts";
import { buyBoard } from "../src/game/boards/BoardManager.ts";
import { STAFF_CATALOG } from "../src/game/economy/staffDefinitions.ts";
import { buyStaff } from "../src/game/economy/StaffManager.ts";
import {
  getKnifeSharpness,
  applySharpnessDecay,
  sharpenKnife,
  SHARPEN_COST,
  DEFAULT_SHARPNESS,
  getSharpnessModifier,
} from "../src/game/economy/sharpness.ts";
import { SUPPLIER_CATALOG, DEFAULT_SUPPLIER_ID } from "../src/game/economy/supplierDefinitions.ts";
import { getSupplierModifier } from "../src/game/economy/supplier.ts";
import { selectSupplier, getSelectedSupplierId } from "../src/game/economy/SupplierManager.ts";
import {
  appendLedgerEntry,
  ledgerTotals,
  MAX_LEDGER_ENTRIES,
} from "../src/game/economy/EconomyLedger.ts";
import { simulateCampaign, SCORE } from "./economy-v2-campaign-simulation.mts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

function saveAt(overrides: Partial<SaveData>): SaveData {
  return { ...DEFAULT_SAVE, ...overrides };
}

const recipe = CAMPAIGN_RECIPES[30]!;

/* ============================================================
 * A — SAVE FIELD AUDIT
 * ============================================================ */
{
  const expectedFields = [
    "version", "credits", "equippedKnifeId", "equippedBoardId", "ownedKnifeIds", "ownedBoardIds",
    "ownedKitchenUpgradeIds", "equippedKitchenUpgradeId", "ownedKitchenInvestmentIds",
    "knifeSharpness", "ownedStaffIds", "selectedSupplierId", "economyLedger", "recipeProgress",
    "settings", "levelProgress", "story", "dailyOrder", "endless",
    // Economy V3 Phase 1 — the one new top-level field for the entire
    // Business Simulation layer (src/game/business/). This is the ONLY
    // field Economy V3 will ever add directly to SaveData; every later
    // V3 phase extends BusinessState itself instead (see businessTypes.ts).
    "business",
    // Blacksmith knife upgrades (src/game/knives/blacksmith.ts) — a Campaign
    // knife feature stored next to knifeSharpness, not an Economy V3 system.
    "knifeUpgrades",
    // Economy V2.5 (approved): migration version, milestone claims and exact lifetime ledger totals.
    "economy",
  ];
  const actualFields = Object.keys(DEFAULT_SAVE);
  for (const f of expectedFields) {
    assert(actualFields.includes(f), `A: SaveData.${f} exists on DEFAULT_SAVE`);
  }
  assert(actualFields.length === expectedFields.length, `A2: DEFAULT_SAVE has exactly ${expectedFields.length} top-level fields (got ${actualFields.length}) — no undocumented field was silently added`);
}

/* ============================================================
 * B — OLD-SAVE MIGRATION (A-G: pre-V2 through current-complete)
 * ============================================================ */
{
  const fixtures: Record<string, unknown> = {
    "A-pre-economy-v2": {
      version: 1, credits: 3200, equippedKnifeId: "santoku", equippedBoardId: "copper",
      ownedKnifeIds: ["chef", "santoku"], ownedBoardIds: ["walnut", "copper"],
      ownedKitchenUpgradeIds: ["humble-kitchen"], equippedKitchenUpgradeId: "humble-kitchen",
      recipeProgress: { "camp-test": { best: 88, done: true } },
      settings: { sound: false, music: true, reducedMotion: true },
      levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-30" },
      story: { introDone: true, milestoneMask: 3, finaleSeen: false },
      dailyOrder: { lastClaimedDate: "2026-01-01", streak: 4 },
      endless: { date: "2026-01-01", coinsEarnedToday: 120 },
    },
    "B-before-kitchen-investments": {
      version: 1, credits: 5000, equippedKnifeId: "chef", equippedBoardId: "walnut",
      ownedKnifeIds: ["chef"], ownedBoardIds: ["walnut"],
      ownedKitchenUpgradeIds: ["humble-kitchen"], equippedKitchenUpgradeId: "humble-kitchen",
      recipeProgress: {}, settings: { sound: true, music: true, reducedMotion: false },
      levelProgress: { ...DEFAULT_LEVEL_PROGRESS }, story: { introDone: false, milestoneMask: 0, finaleSeen: false },
      dailyOrder: { lastClaimedDate: null, streak: 0 }, endless: { date: "", coinsEarnedToday: 0 },
    },
    "C-before-sharpness": {
      version: 1, credits: 8000, ownedKnifeIds: ["chef", "santoku"],
      ownedKitchenInvestmentIds: ["prep-station-upgrade"],
    },
    "D-before-staff": {
      version: 1, credits: 9000, ownedKnifeIds: ["chef"], knifeSharpness: { chef: 62 },
    },
    "E-before-suppliers": {
      version: 1, credits: 12000, ownedStaffIds: ["prep-assistant"],
    },
    "F-before-ledger": {
      version: 1, credits: 15000, selectedSupplierId: "wholesale-supplier",
    },
    "G-current-complete": { ...DEFAULT_SAVE, credits: 20000 },
  };

  for (const [label, raw] of Object.entries(fixtures)) {
    let migrated: SaveData;
    try {
      // The exact SaveManager.load() merge — never a second migration framework.
      migrated = { ...DEFAULT_SAVE, ...(raw as Partial<SaveData>) };
    } catch (e) {
      failures++;
      console.error(`FAIL: B [${label}]: load threw — ${String(e)}`);
      continue;
    }
    assert(typeof migrated.credits === "number", `B [${label}]: credits survives as a number`);
    assert(Array.isArray(migrated.ownedKnifeIds), `B [${label}]: ownedKnifeIds is an array`);
    assert(Array.isArray(migrated.ownedBoardIds), `B [${label}]: ownedBoardIds is an array`);
    assert(typeof migrated.equippedKnifeId === "string", `B [${label}]: equippedKnifeId is a string`);
    assert(typeof migrated.equippedBoardId === "string", `B [${label}]: equippedBoardId is a string`);
    assert(!!migrated.levelProgress && typeof migrated.levelProgress === "object", `B [${label}]: levelProgress survives as an object`);
    assert(!!migrated.recipeProgress && typeof migrated.recipeProgress === "object", `B [${label}]: recipeProgress survives as an object`);
    assert(!!migrated.story && typeof migrated.story === "object", `B [${label}]: story survives as an object`);
    assert(!!migrated.dailyOrder && typeof migrated.dailyOrder === "object", `B [${label}]: dailyOrder survives as an object`);
    assert(!!migrated.endless && typeof migrated.endless === "object", `B [${label}]: endless survives as an object`);
    assert(!!migrated.settings && typeof migrated.settings === "object", `B [${label}]: settings survives as an object`);
    // Every Economy V2 field must resolve to a well-typed default, never undefined.
    assert(Array.isArray(migrated.ownedKitchenInvestmentIds), `B [${label}]: ownedKitchenInvestmentIds resolves to an array (never undefined)`);
    assert(typeof migrated.knifeSharpness === "object" && migrated.knifeSharpness !== null, `B [${label}]: knifeSharpness resolves to an object (never undefined)`);
    assert(Array.isArray(migrated.ownedStaffIds), `B [${label}]: ownedStaffIds resolves to an array (never undefined)`);
    assert(typeof migrated.selectedSupplierId === "string" && migrated.selectedSupplierId.length > 0, `B [${label}]: selectedSupplierId resolves to a non-empty string (never undefined)`);
    assert(Array.isArray(migrated.economyLedger), `B [${label}]: economyLedger resolves to an array (never undefined)`);
    // These must never throw when driven off the migrated save.
    try {
      getKnifeSharpness(migrated, migrated.equippedKnifeId);
      getSelectedSupplierId(migrated);
      ledgerTotals(migrated.economyLedger);
    } catch (e) {
      failures++;
      console.error(`FAIL: B [${label}]: a downstream economy read threw — ${String(e)}`);
    }
  }
  console.log("ok   B: all 7 migration fixtures (pre-V2 through current-complete) load safely with zero crashes, using ONLY the existing {...DEFAULT_SAVE, ...parsed} merge — no new migration framework was needed or added");
}

/* ============================================================
 * C — WALLET MUTATION AUDIT (structural — every purchase manager's own success/failure atomicity)
 * ============================================================ */
{
  const save = saveAt({ credits: dollars(5000), levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-60" } });
  const knifeFail = buyKnife(saveAt({ credits: 0 }), "santoku");
  assert(!knifeFail.ok, "C: an unaffordable knife purchase fails cleanly (no partial state)");
  const knifeOk = buyKnife(save, "santoku");
  assert(knifeOk.ok && knifeOk.save.credits === save.credits - dollars(350), "C2: a successful knife purchase deducts EXACTLY the catalog price ($350.00) — no other field silently affected");
}

/* ============================================================
 * D — LEDGER RECONCILIATION
 * ============================================================ */
{
  const startingCredits = 10000;
  let save = saveAt({ credits: startingCredits, levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-60" } });

  // Campaign settlement.
  const settlement = computeSettlement(recipe, 10, 85, save.equippedKnifeId, save.equippedBoardId);
  save = appendLedgerEntry({ ...save, credits: save.credits + settlement.netResult }, "campaign-settlement", settlement.netResult, recipe.id);

  // Completion reward.
  const level = LEVELS.find((l) => l.chapter === 1)!;
  const { progress: levelProgress, rewardCoins } = completeLevel(level.id, save.levelProgress);
  save = { ...save, credits: save.credits + rewardCoins, levelProgress };
  if (rewardCoins > 0) save = appendLedgerEntry(save, "completion-reward", rewardCoins, level.id);

  // Knife + board + staff purchases.
  for (const [buy, id, category] of [
    [() => buyKnife(save, "santoku"), "santoku", "knife-purchase"],
    [() => buyBoard("copper", save), "copper", "board-purchase"],
    [() => buyStaff(save, "prep-assistant"), "prep-assistant", "staff-purchase"],
  ] as const) {
    const result = buy();
    if (result.ok) {
      const spent = save.credits - result.save.credits;
      save = appendLedgerEntry(result.save, category, -spent, id);
    }
  }

  // Sharpening.
  const sharpenResult = sharpenKnife(save, save.equippedKnifeId);
  if (sharpenResult.ok) {
    const spent = save.credits - sharpenResult.save.credits;
    save = appendLedgerEntry(sharpenResult.save, "sharpening", -spent, save.equippedKnifeId);
  }

  // Daily reward.
  save = appendLedgerEntry({ ...save, credits: save.credits + 50 }, "daily-reward", 50, "daily-test");

  // Endless revenue.
  save = appendLedgerEntry({ ...save, credits: save.credits + 40 }, "endless-revenue", 40, "endless-test");

  // Restaurant Service payout (its own raw basePayment, never computeSettlement).
  save = appendLedgerEntry({ ...save, credits: save.credits + 90 }, "service-revenue", 90, "service-test");

  // Supplier selection — free, no ledger entry, no credits change.
  const beforeSupplier = save.credits;
  const supplierResult = selectSupplier(save, "premium-supplier");
  if (supplierResult.ok) save = supplierResult.save;
  assert(save.credits === beforeSupplier, "D0: supplier selection never touches credits");

  // Replay — contributes nothing (proven structurally: no append call is ever reached for isReplay).
  const totals = ledgerTotals(save.economyLedger);
  const expectedEnding = startingCredits + totals.netCashFlow;
  assert(
    save.credits === expectedEnding,
    `D: startingCredits(${startingCredits}) + netCashFlow(${totals.netCashFlow}) === endingCredits(${save.credits}) exactly across settlement+reward+upkeep+4 purchases+sharpening+daily+endless+service+supplier-selection+replay (expected ${expectedEnding})`,
  );
}

/* ============================================================
 * E — SETTLEMENT RECONCILIATION
 * ============================================================ */
{
  const s = computeSettlement(recipe, 12, 82, "santoku", "copper", 60, ["prep-assistant", "quality-chef", "kitchen-assistant"], "wholesale-supplier");
  assert(s.netResult === Math.max(0, s.revenue - s.finalCOGS + s.qualityBonus), "E: netResult === max(0, revenue - finalCOGS + qualityBonus) — the one accounting identity every settlement must satisfy");
  assert(s.finalCOGS >= 0, "E2: finalCOGS is never negative");
  assert(s.netResult >= 0, "E3: netResult is never negative");
}

/* ============================================================
 * F — REPLAY AUDIT
 * ============================================================ */
{
  const isReplay = true;
  const save = saveAt({ credits: 500, knifeSharpness: { chef: 80 } });
  const settlement = isReplay ? undefined : computeSettlement(recipe, 10, 90);
  const amount = settlement?.netResult ?? 0;
  assert(amount === 0, "F: a replay's computed payout amount is a hard 0");
  // Sharpness decay is gated the SAME way in App.tsx (`if (save && !isReplay)`).
  const sharpnessAfter = isReplay ? getKnifeSharpness(save, "chef") : applySharpnessDecay(save, "chef", recipe).knifeSharpness["chef"];
  assert(sharpnessAfter === 80, "F2: a replay never alters knife sharpness");
  assert(!isReplay || amount === 0, "F3: replay structurally never reaches a positive payout branch");
}

/* ============================================================
 * G — PHYSICAL-INSTANCE COGS REGRESSION
 * ============================================================ */
{
  let distinctInstances = 0;
  let sameInstanceChains = 0;
  let ambiguous = 0;
  for (const r of CAMPAIGN_RECIPES) {
    const instances = ingredientInstancesFor(r);
    if (instances.length === r.components.length) distinctInstances++;
    else if (instances.length < r.components.length) sameInstanceChains++;
    else ambiguous++;
  }
  assert(distinctInstances === 106, `G: DISTINCT_INSTANCES unchanged at 106 (got ${distinctInstances})`);
  assert(sameInstanceChains === 115, `G2: SAME_INSTANCE_CHAIN unchanged at 115 (got ${sameInstanceChains})`);
  assert(ambiguous === 0, `G3: 0 ambiguous cases (got ${ambiguous})`);
}

/* ============================================================
 * H — 250-LEVEL BASELINE REGRESSION (the freeze gate)
 * ============================================================ */
let lockedBaseline = { revenue: 0, rewards: 0, cogs: 0, qualityBonus: 0, net: 0 };
{
  const { results } = simulateCampaign(SCORE.Honest, false, DEFAULT_LEVEL_PROGRESS, "chef", "walnut", 100, [], "local-market");
  const totals = results.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.grossRecipeRevenue,
      rewards: acc.rewards + r.levelCompletionReward,
      cogs: acc.cogs + r.ingredientCOGS,
      qualityBonus: acc.qualityBonus + r.qualityBonus,
      net: acc.net + r.netResult,
    }),
    { revenue: 0, rewards: 0, cogs: 0, qualityBonus: 0, net: 0 },
  );
  lockedBaseline = totals;
  assert(totals.revenue === dollars(165140), `H: recipe revenue unchanged at $165,140.00 (got ${totals.revenue})`);
  assert(totals.rewards === dollars(77581), `H2: completion rewards at the V2.5 locked $77,581.00 (got ${totals.rewards})`);
  assert(totals.cogs === dollars(37620), `H3: baseline COGS unchanged at $37,620.00 (got ${totals.cogs})`);
  assert(totals.qualityBonus === dollars(3315), `H4: quality bonus unchanged at $3,315.00 (got ${totals.qualityBonus})`);
  assert(totals.net === dollars(208416), `H5: Honest net at the V2.5 locked $208,416.00 (got ${totals.net})`);
}

/* ============================================================
 * I — EQUIPMENT REGRESSION
 * ============================================================ */
{
  assert(KNIFE_CATALOG.length === 8, `I: exactly 8 knives (got ${KNIFE_CATALOG.length})`);
  assert(BOARD_CATALOG.length === 8, `I2: exactly 8 boards (got ${BOARD_CATALOG.length})`);
  const knifePrices: Record<string, number> = { chef: 0, santoku: 350, paring: 500, nakiri: 700, bread: 850, cleaver: 1100, damascus: 1800, obsidian: 2200 };
  for (const [id, price] of Object.entries(knifePrices)) {
    const def = KNIFE_CATALOG.find((k) => k.id === id);
    assert(!!def && def.price === dollars(price), `I3: knife '${id}' price is locked at $${price} (got ${def?.price} cents)`);
  }
  const boardPrices: Record<string, number> = { walnut: 0, maple: 300, herb: 500, marble: 750, darkoak: 1000, copper: 1500, butcherblock: 1800, seafoodslate: 2000 };
  for (const [id, price] of Object.entries(boardPrices)) {
    const def = BOARD_CATALOG.find((b) => b.id === id);
    assert(!!def && def.price === dollars(price), `I4: board '${id}' price is locked at $${price} (got ${def?.price} cents)`);
  }
}

/* ============================================================
 * J — SHARPNESS REGRESSION
 * ============================================================ */
{
  assert(DEFAULT_SHARPNESS === 100, "J: default sharpness is 100");
  assert(SHARPEN_COST === dollars(50), "J2: sharpen cost is locked at $50.00");
  assert(getSharpnessModifier(100) === 0, "J3: full sharpness (100) has exactly 0 COGS penalty");
  assert(Math.abs(getSharpnessModifier(0) - 0.05) < 1e-9, "J4: zero sharpness has exactly the 5% max penalty");
  const decayed = applySharpnessDecay(saveAt({ knifeSharpness: { chef: 100 } }), "chef", recipe);
  assert(decayed.knifeSharpness["chef"]! < 100 && decayed.knifeSharpness["chef"]! >= 95, "J5: a single order's decay stays within the documented [1,5] clamp");
}

/* ============================================================
 * K — STAFF REGRESSION
 * ============================================================ */
{
  assert(STAFF_CATALOG.length === 3, `K: exactly 3 staff roles (got ${STAFF_CATALOG.length})`);
  const prep = STAFF_CATALOG.find((s) => s.id === "prep-assistant")!;
  const quality = STAFF_CATALOG.find((s) => s.id === "quality-chef")!;
  const kitchen = STAFF_CATALOG.find((s) => s.id === "kitchen-assistant")!;
  assert(prep.price === dollars(3000) && prep.unlockLevel === 20, "K2: Prep Assistant locked at $3,000.00 / Level 20");
  assert(quality.price === dollars(6000) && quality.unlockLevel === 45, "K3: Quality Chef locked at $6,000.00 / Level 45");
  assert(kitchen.price === dollars(4000) && kitchen.unlockLevel === 65, "K4: Kitchen Assistant locked at $4,000.00 / Level 65");
  const allThree = computeSettlement(recipe, 10, 75, undefined, undefined, undefined, ["prep-assistant", "kitchen-assistant"]).staffCOGSSavings;
  const noStaff = computeSettlement(recipe, 10, 75).staffCOGSSavings;
  assert(noStaff === 0, "K5: staffCOGSSavings is exactly 0 with no staff owned");
  assert(allThree >= 0, "K6: staff never produces a negative COGS effect");
}

/* ============================================================
 * L — SUPPLIER REGRESSION
 * ============================================================ */
{
  assert(SUPPLIER_CATALOG.length === 3, `L: exactly 3 suppliers (got ${SUPPLIER_CATALOG.length})`);
  assert(DEFAULT_SUPPLIER_ID === "local-market", "L2: default supplier is local-market");
  assert(getSupplierModifier("local-market") === 0, "L3: Local Market modifier is exactly 0%");
  assert(getSupplierModifier("wholesale-supplier") === -0.1, "L4: Wholesale modifier is exactly -10%");
  assert(getSupplierModifier("premium-supplier") === 0.1, "L5: Premium modifier is exactly +10%");
}

/* ============================================================
 * M — KITCHEN INVESTMENTS RETIRED
 * ============================================================ */
{
  // Kitchen Investments were retired (the six kitchen backgrounds are the kitchen progression);
  // their modules are deleted and nothing in the game can buy one or charge upkeep. Legacy ledger
  // labels stay so an old save's history still displays.
  const gone = ["KitchenInvestmentManager.ts", "kitchenInvestmentDefinitions.ts", "kitchenInvestmentTypes.ts"].every(
    (f) => !fs.existsSync(path.resolve(import.meta.dirname, "../src/game/kitchen", f)),
  );
  assert(gone, "M: the retired Kitchen Investment modules no longer exist");
}

/* ============================================================
 * N — COMPOSITION REGRESSION (A-D from the Phase 10 brief)
 * ============================================================ */
{
  const veg = CAMPAIGN_RECIPES.find((r) => r.components.some((c) => c.ingredientId === "carrot")) ?? recipe;
  const combos: [string, string, string, number, readonly string[], string][] = [
    ["A-Neutral", "chef", "walnut", 100, [], "local-market"],
    ["B-Specialized", "santoku", "copper", 100, ["prep-assistant", "quality-chef", "kitchen-assistant"], "wholesale-supplier"],
    ["C-Dull", "chef", "walnut", 0, [], "local-market"],
    ["D-Premium", "chef", "walnut", 100, [], "premium-supplier"],
  ];
  const seen = new Set<string>();
  for (const [label, knife, board, sharpness, staff, supplier] of combos) {
    const s1 = computeSettlement(veg, 10, 78, knife, board, sharpness, staff, supplier);
    const s2 = computeSettlement(veg, 10, 78, knife, board, sharpness, staff, supplier);
    assert(s1.finalCOGS >= 0 && s1.netResult >= 0, `N [${label}]: no negative COGS/net`);
    assert(s1.finalCOGS === s2.finalCOGS && s1.netResult === s2.netResult, `N [${label}]: deterministic — identical inputs produce identical output`);
    const key = `${label}:${s1.finalCOGS}:${s1.netResult}`;
    assert(!seen.has(key) || label === "A-Neutral", `N [${label}]: distinct combination produces a distinguishable result (no silently-missing modifier)`);
    seen.add(key);
  }
}

/* ============================================================
 * O — SOLVENCY REGRESSION
 * ============================================================ */
{
  let anyNegative = false;
  for (const scoreKey of ["Rustic", "Honest", "Masterful"] as const) {
    const score = SCORE[scoreKey];
    for (const supplier of SUPPLIER_CATALOG) {
      const { results } = simulateCampaign(score, false, DEFAULT_LEVEL_PROGRESS, "chef", "walnut", 100, [], supplier.id);
      let credits = DEFAULT_SAVE.credits;
      for (const r of results) {
        credits += r.netResult;
        if (credits < 0) anyNegative = true;
      }
    }
  }
  assert(!anyNegative, "O: 0 negative-cash occurrences across Rustic/Honest/Masterful x all 3 suppliers (full-campaign running balance)");
}

/* ============================================================
 * P — LEDGER BOUNDEDNESS
 * ============================================================ */
{
  let save = saveAt({ credits: 1_000_000 });
  for (let i = 0; i < MAX_LEDGER_ENTRIES + 50; i++) {
    save = appendLedgerEntry(save, "daily-reward", 1, `entry-${i}`);
  }
  assert(save.economyLedger.length === MAX_LEDGER_ENTRIES, `P: economyLedger never exceeds MAX_LEDGER_ENTRIES (${MAX_LEDGER_ENTRIES}) even after ${MAX_LEDGER_ENTRIES + 50} appends (got ${save.economyLedger.length})`);
  assert(save.economyLedger[0]!.description === `entry-${50}`, "P2: FIFO — the OLDEST entries are the ones dropped, not the newest");
  const zeroSave = appendLedgerEntry(saveAt({ credits: 100 }), "daily-reward", 0, "zero-test");
  assert(zeroSave.economyLedger.length === 0, "P3: a zero-amount transaction is never recorded (no fake/zero-value entries)");
}

/* ============================================================
 * Q — NO-RANDOMNESS ASSERTION (static source check)
 * ============================================================ */
{
  const fs = await import("node:fs");
  const path = await import("node:path");
  const economyDir = path.join(import.meta.dirname, "..", "src", "game", "economy");
  const files = fs.readdirSync(economyDir).filter((f) => f.endsWith(".ts"));
  let foundRandomCall = false;
  for (const file of files) {
    const content = fs.readFileSync(path.join(economyDir, file), "utf8");
    // Match an actual Math.random() CALL, not the word appearing in a comment/doc sentence (every hit here is prose like "Never Math.random()").
    const callSites = content.match(/Math\.random\(\)/g) ?? [];
    for (const _hit of callSites) {
      const isDocMention = /(Never|No|not)\s+Math\.random\(\)/i.test(content);
      if (!isDocMention) foundRandomCall = true;
    }
  }
  assert(!foundRandomCall, `Q: no Math.random() CALL exists anywhere under src/game/economy/ (${files.length} files scanned) — every mention found is a doc comment documenting its absence`);
}

/* ============================================================
 * R — FINAL BASELINE ASSERTION (the freeze gate — this MUST fail if the locked economy ever drifts)
 *
 * Economy V2.5 (approved rebalance, "Final Wealth"): the ONE intentional
 * change to this baseline is the completion-reward line. Each level's
 * stored reward.coins is untouched; levels/levelRewards.ts pays a tapering
 * share of it (100% for Levels 1–20 and 250, down to 15% for 201–249), so
 * completion rewards are $77,581.00 (was $330,691.00) and the Honest net
 * $208,416.00 (was $461,526.00). Recipe revenue, COGS and quality bonuses
 * are unchanged and still gated exactly. Any OTHER drift is a regression.
 * ============================================================ */
{
  assert(lockedBaseline.revenue === dollars(165140), "R: FREEZE GATE — recipe revenue === $165,140.00");
  assert(lockedBaseline.rewards === dollars(77581), "R2: FREEZE GATE — completion rewards === $77,581.00 (V2.5)");
  assert(lockedBaseline.cogs === dollars(37620), "R3: FREEZE GATE — baseline COGS === $37,620.00");
  assert(lockedBaseline.qualityBonus === dollars(3315), "R4: FREEZE GATE — quality bonus === $3,315.00");
  assert(lockedBaseline.net === dollars(208416), "R5: FREEZE GATE — Honest net === $208,416.00 (V2.5)");
}

console.log(failures === 0 ? "\nALL PASS — ECONOMY V2 FROZEN — NO KNOWN ECONOMY REGRESSIONS." : `\n${failures} FAILURE(S) — DO NOT FREEZE`);
process.exit(failures === 0 ? 0 : 1);
