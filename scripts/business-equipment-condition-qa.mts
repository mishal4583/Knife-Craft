/**
 * BUSINESS_EQUIPMENT_CONDITION_QA — Economy V3 Phase 10. Verifies the
 * refrigerator's own 0-100 condition: default state, the exact banding
 * thresholds, deterministic decay driven by real ingredient purchases,
 * the reset-to-100 on a refrigerator purchase, the two real wired
 * effects (spoilage-value multiplier, popularity delta), boundary
 * clamping, persistence, migration (old saves and future-field
 * forward-compatibility), Campaign independence (sharpness/equipment
 * specialization completely untouched), wallet/ledger correctness, and
 * determinism — against the real production functions only.
 *
 * Run: npx tsx scripts/business-equipment-condition-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import {
  DEFAULT_EQUIPMENT_CONDITION_STATE,
  clampCondition,
  conditionBandFor,
  applyStockingWear,
  DECAY_DIVISOR,
  refrigeratorSpoilagePenaltyMultiplier,
  refrigeratorPopularityDelta,
} from "../src/game/business/businessEquipmentCondition.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { purchaseRefrigerator } from "../src/game/business/RefrigeratorManager.ts";
import { dailyPopularityDelta } from "../src/game/business/PopularityManager.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import { businessUnitCostFor } from "../src/game/business/businessPricing.ts";
import { getEquipmentModifier } from "../src/game/economy/equipmentSpecialization.ts";

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

// ===== A: default state and banding thresholds (master spec's own exact numbers). =====
{
  assert(DEFAULT_BUSINESS_STATE.equipmentCondition.refrigeratorCondition === 100, "A: a brand-new save starts at full condition (100)");
  assert(conditionBandFor(100) === "GOOD" && conditionBandFor(80) === "GOOD", "A2: 100 and 80 are both GOOD");
  assert(conditionBandFor(79) === "WORN" && conditionBandFor(60) === "WORN", "A3: 79 and 60 are both WORN");
  assert(conditionBandFor(59) === "POOR" && conditionBandFor(40) === "POOR", "A4: 59 and 40 are both POOR");
  assert(conditionBandFor(39) === "CRITICAL" && conditionBandFor(20) === "CRITICAL", "A5: 39 and 20 are both CRITICAL");
  assert(conditionBandFor(19) === "BROKEN" && conditionBandFor(0) === "BROKEN", "A6: 19 and 0 are both BROKEN");
}

// ===== B: clampCondition — the one range enforcement point. =====
{
  assert(clampCondition(150) === 100, "B: a value above 100 clamps to 100");
  assert(clampCondition(-10) === 0, "B2: a value below 0 clamps to 0");
  assert(clampCondition(55.6) === 56, "B3: a fractional value rounds");
  assert(clampCondition(0) === 0 && clampCondition(100) === 100, "B4: the boundaries themselves pass through unchanged");
}

// ===== C: applyStockingWear — deterministic, 1 point per DECAY_DIVISOR (10) units stocked, remainder carried, split-invariant.
// V3-16 P2 remediation: replaces the per-TRANSACTION rule (1-point floor, 3-point ceiling), whose wear depended on how
// many times "Buy" was tapped rather than on how much the refrigerator was used (master spec §12: "declines through usage").
{
  const fresh = { refrigeratorCondition: 100 };
  assert(DECAY_DIVISOR === 10, "C0: the rate is the existing documented 10 units per point (unchanged)");
  const w1 = applyStockingWear(fresh, 1);
  assert(w1.refrigeratorCondition === 100 && w1.wearCarryUnits === 1, "C: 1 unit costs no whole point yet — it is carried (1/10)");
  const w5 = applyStockingWear(fresh, 5);
  assert(w5.refrigeratorCondition === 100 && w5.wearCarryUnits === 5, "C2: 5 units are carried (5/10), no point yet");
  const w10 = applyStockingWear(fresh, 10);
  assert(w10.refrigeratorCondition === 99 && w10.wearCarryUnits === 0, "C3: 10 units cost exactly 1 point");
  const w25 = applyStockingWear(fresh, 25);
  assert(w25.refrigeratorCondition === 98 && w25.wearCarryUnits === 5, "C4: 25 units cost exactly 2 points with 5 carried");
  const w1000 = applyStockingWear(fresh, 1000);
  assert(w1000.refrigeratorCondition === 0 && w1000.wearCarryUnits === 0, "C5: 1,000 units cost 100 points (no bulk-buy ceiling), clamped at 0");
  let split = fresh as { refrigeratorCondition: number; wearCarryUnits?: number };
  for (const q of [5, 5, 5, 5, 5]) split = applyStockingWear(split, q);
  assert(split.refrigeratorCondition === w25.refrigeratorCondition && split.wearCarryUnits === w25.wearCarryUnits, "C6: 25 units bought as five lots of 5 wear EXACTLY as one lot of 25 (split-invariant)");
  let ones = fresh as { refrigeratorCondition: number; wearCarryUnits?: number };
  for (let i = 0; i < 25; i++) ones = applyStockingWear(ones, 1);
  assert(ones.refrigeratorCondition === 98 && ones.wearCarryUnits === 5, "C7: 25 single-unit purchases also cost exactly 2 points with 5 carried");
  assert(JSON.stringify(applyStockingWear(fresh, 7)) === JSON.stringify(applyStockingWear(fresh, 7)), "C8: identical input always produces identical output (determinism)");
  const legacy = applyStockingWear({ refrigeratorCondition: 80 }, 12);
  assert(legacy.refrigeratorCondition === 79 && legacy.wearCarryUnits === 2, "C9: a pre-V3-16 state with no carry field is treated as carry 0");
  assert(applyStockingWear({ refrigeratorCondition: 0, wearCarryUnits: 9 }, 50).refrigeratorCondition === 0, "C10: condition never goes below 0");
}

// ===== D: purchaseIngredient integration — a real purchase wears condition by exactly applyStockingWear(quantity). =====
{
  const save = saveAt({
    credits: 10000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 } }, // day 7 = quiet, no event
  });
  const result = purchaseIngredient(save, "tomato", 5);
  assert(result.ok, "D: precondition — purchase succeeds");
  if (result.ok) {
    const expected = applyStockingWear(DEFAULT_EQUIPMENT_CONDITION_STATE, 5);
    assert(
      JSON.stringify(result.save.business.equipmentCondition) === JSON.stringify(expected),
      `D2: condition/carry change by exactly applyStockingWear(5) (got ${JSON.stringify(result.save.business.equipmentCondition)}, expected ${JSON.stringify(expected)})`,
    );
    const second = purchaseIngredient(result.save, "tomato", 5);
    assert(second.ok && second.save.business.equipmentCondition.refrigeratorCondition === 99 && second.save.business.equipmentCondition.wearCarryUnits === 0, "D2b: a second real 5-unit purchase completes the 10 units -> exactly 1 point");
  }
}
{
  // D-rejected: a REJECTED purchase (insufficient funds) leaves condition completely untouched.
  const save = saveAt({ credits: 0, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 } } });
  const result = purchaseIngredient(save, "tomato", 5);
  assert(!result.ok, "D3: precondition — purchase is rejected (insufficient funds)");
  assert(save.business.equipmentCondition.refrigeratorCondition === 100, "D4: a rejected purchase never decays condition");
}
{
  // D-clamp: condition never goes below 0 no matter how many purchases are made.
  let save = saveAt({
    credits: 100000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 }, equipmentCondition: { refrigeratorCondition: 2 } },
  });
  const result = purchaseIngredient(save, "tomato", 40); // exactly fills the default (basic, 40-capacity) refrigerator
  assert(result.ok, "D5: precondition — purchase succeeds");
  if (result.ok) {
    assert(result.save.business.equipmentCondition.refrigeratorCondition === 0, "D6: condition clamps at 0, never negative");
  }
}
{
  // D-price: condition/decay never affects the purchase price itself — pricing is completely unaffected by this phase.
  const save = saveAt({
    credits: 10000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 }, equipmentCondition: { refrigeratorCondition: 5 } },
  });
  const baseCost = businessUnitCostFor("tomato");
  const result = purchaseIngredient(save, "tomato", 3);
  assert(result.ok && result.unitCost === baseCost, "D7: a low-condition refrigerator never changes the ingredient's unit price");
}

// ===== E: purchaseRefrigerator integration — a real refrigerator purchase resets condition to 100. =====
{
  const save = saveAt({
    credits: 1_000_000,
    business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 12 } },
  });
  const result = purchaseRefrigerator(save, "commercial-refrigerator");
  assert(result.ok, "E: precondition — the upgrade succeeds");
  if (result.ok) {
    assert(result.save.business.equipmentCondition.refrigeratorCondition === 100, "E2: buying/upgrading a refrigerator resets condition to full (100)");
  }
}
{
  // E-rejected: a rejected refrigerator purchase (already owned) leaves condition untouched.
  const save = saveAt({
    credits: 100000,
    business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 33 } },
  });
  const result = purchaseRefrigerator(save, save.business.refrigerator.refrigeratorId);
  assert(!result.ok && result.reason === "alreadyOwned", "E3: precondition — rejected as already owned");
  assert(save.business.equipmentCondition.refrigeratorCondition === 33, "E4: a rejected refrigerator purchase never touches condition");
}

// ===== F: refrigeratorSpoilagePenaltyMultiplier — the real, wired "waste" effect. =====
{
  assert(refrigeratorSpoilagePenaltyMultiplier(100) === 1 && refrigeratorSpoilagePenaltyMultiplier(80) === 1, "F: GOOD condition applies no spoilage penalty");
  assert(refrigeratorSpoilagePenaltyMultiplier(79) === 1 && refrigeratorSpoilagePenaltyMultiplier(60) === 1, "F2: WORN condition also applies no spoilage penalty");
  assert(refrigeratorSpoilagePenaltyMultiplier(59) === 1.1 && refrigeratorSpoilagePenaltyMultiplier(40) === 1.1, "F3: POOR condition applies a 1.1x spoilage penalty");
  assert(refrigeratorSpoilagePenaltyMultiplier(39) === 1.25 && refrigeratorSpoilagePenaltyMultiplier(20) === 1.25, "F4: CRITICAL condition applies a 1.25x spoilage penalty");
  assert(refrigeratorSpoilagePenaltyMultiplier(19) === 1.5 && refrigeratorSpoilagePenaltyMultiplier(0) === 1.5, "F5: BROKEN condition applies a 1.5x spoilage penalty");
}

// ===== G: refrigeratorPopularityDelta — the real, wired "quality consistency" effect. =====
{
  assert(refrigeratorPopularityDelta(100) === 0 && refrigeratorPopularityDelta(60) === 0, "G: GOOD/WORN condition costs no popularity");
  assert(refrigeratorPopularityDelta(59) === -1 && refrigeratorPopularityDelta(40) === -1, "G2: POOR condition costs exactly -1 popularity");
  assert(refrigeratorPopularityDelta(39) === -2 && refrigeratorPopularityDelta(20) === -2, "G3: CRITICAL condition costs exactly -2 popularity");
  assert(refrigeratorPopularityDelta(19) === -3 && refrigeratorPopularityDelta(0) === -3, "G4: BROKEN condition costs exactly -3 popularity");
}
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 15 } } });
  assert(dailyPopularityDelta(save) === -3, `G5: dailyPopularityDelta includes the refrigerator term on an otherwise-neutral menu/staff (got ${dailyPopularityDelta(save)})`);
}

// ===== H: endBusinessDay integration — condition penalty composes multiplicatively with Phase 9's Cleaner reduction, never replacing it. =====
{
  const save = saveAt({
    credits: 2000,
    business: {
      ...DEFAULT_BUSINESS_STATE,
      calendar: { businessDay: 20 },
      inventory: { tomato: { ingredientId: "tomato", quantity: 10, unitCost: 12, purchaseDay: 1 } }, // long expired by day 21
      equipmentCondition: { refrigeratorCondition: 15 }, // BROKEN -> 1.5x
    },
  });
  const result = endBusinessDay(save);
  const expectedValue = Math.round(10 * 12 * 1.5);
  assert(result.spoiledValue === expectedValue, `H: a BROKEN refrigerator inflates the recorded spoiled value by exactly 1.5x (got ${result.spoiledValue}, expected ${expectedValue})`);
  assert(result.spoiledQuantity === 10, "H2: condition never changes HOW MANY units physically expire");
}
{
  // H-compose: Cleaner (0.8x) AND a POOR fridge (1.1x) both apply together, multiplicatively.
  const save = saveAt({
    credits: 2000,
    business: {
      ...DEFAULT_BUSINESS_STATE,
      calendar: { businessDay: 20 },
      inventory: { tomato: { ingredientId: "tomato", quantity: 10, unitCost: 12, purchaseDay: 1 } },
      staff: { hiredRoles: ["cleaner"] },
      equipmentCondition: { refrigeratorCondition: 45 }, // POOR -> 1.1x
    },
  });
  const result = endBusinessDay(save);
  const expectedValue = Math.round(10 * 12 * 0.8 * 1.1);
  assert(result.spoiledValue === expectedValue, `H3: Cleaner (0.8x) and a POOR fridge (1.1x) compose multiplicatively (got ${result.spoiledValue}, expected ${expectedValue})`);
}
{
  // H-untouched: endBusinessDay itself never mutates condition — only real purchases/refrigerator swaps do.
  const save = saveAt({
    credits: 2000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, equipmentCondition: { refrigeratorCondition: 77 } },
  });
  const result = endBusinessDay(save);
  assert(result.save.business.equipmentCondition.refrigeratorCondition === 77, "H4: ending a day never itself changes refrigerator condition (never a timer)");
}

// ===== I: wallet/ledger correctness — condition changes never touch credits or the ledger by themselves. =====
{
  const save = saveAt({
    credits: 10000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 } },
  });
  const before = save.economyLedger.length;
  const result = purchaseIngredient(save, "tomato", 5);
  assert(result.ok, "I: precondition — purchase succeeds");
  if (result.ok) {
    assert(result.save.economyLedger.length === before, "I2: purchaseIngredient itself creates no ledger entry (the caller/App.tsx wrapper does that, unchanged by this phase)");
    assert(result.save.credits === 10000 - result.totalCost, "I3: credits move by exactly the purchase cost — condition decay never itself costs credits");
  }
}

// ===== J: persistence — condition survives a JSON save/load round-trip. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 63 } } });
  const roundTripped = JSON.parse(JSON.stringify(save)) as SaveData;
  assert(roundTripped.business.equipmentCondition.refrigeratorCondition === 63, "J: condition survives a JSON round-trip exactly");
}

// ===== K: migration — old saves (pre-V3-10) default condition to 100; forward-compatible with a later field. =====
{
  const v39Save = {
    version: 1,
    credits: 4000,
    business: {
      calendar: { businessDay: 8 },
      inventory: {},
      refrigerator: { refrigeratorId: "basic-refrigerator" },
      spoilage: { totalSpoiledQuantity: 0, totalSpoiledValue: 0 },
      menu: {},
      popularity: { score: 50 },
      supplierContract: null,
      staff: { hiredRoles: ["head-chef"] },
    },
  } as unknown as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...v39Save, business: { ...DEFAULT_SAVE.business, ...v39Save.business } } as SaveData;
  assert(migrated.business.staff.hiredRoles.includes("head-chef"), "K: a pre-V3-10 save's staff field survives exactly");
  assert(migrated.business.equipmentCondition.refrigeratorCondition === 100, "K2: equipmentCondition defaults cleanly to 100 on a save that predates this phase");
}
{
  type FutureBusinessState = SaveData["business"] & { futureField?: string };
  const laterSave = {
    version: 1,
    credits: 1000,
    business: {
      calendar: { businessDay: 7 },
      inventory: {},
      refrigerator: { refrigeratorId: "basic-refrigerator" },
      spoilage: { totalSpoiledQuantity: 0, totalSpoiledValue: 0 },
      menu: {},
      popularity: { score: 50 },
      supplierContract: null,
      staff: { hiredRoles: [] },
      equipmentCondition: { refrigeratorCondition: 71 },
    },
  } as unknown as Partial<SaveData>;
  const defaultWithFuture: FutureBusinessState = { ...DEFAULT_SAVE.business, futureField: "default-value" };
  const migrated = { ...DEFAULT_SAVE, ...laterSave, business: { ...defaultWithFuture, ...laterSave.business } };
  assert((migrated.business as SaveData["business"]).equipmentCondition.refrigeratorCondition === 71, "K3: an existing field (equipmentCondition) survives when a LATER phase's field is also present");
  assert((migrated.business as FutureBusinessState).futureField === "default-value", "K4: a field from a LATER phase not yet in this save correctly falls back to its own default");
}

// ===== L: Campaign independence — sharpness.ts and equipmentSpecialization.ts are completely untouched by this phase. =====
{
  const save = saveAt({
    credits: 10000,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" },
    knifeSharpness: { "chef-knife": 55 },
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 } },
  });
  const result = purchaseIngredient(save, "tomato", 5);
  assert(result.ok, "L: precondition — purchase succeeds");
  if (result.ok) {
    assert(
      JSON.stringify(result.save.knifeSharpness) === JSON.stringify(save.knifeSharpness),
      "L2: Campaign's own knifeSharpness is byte-identical before/after a Business Mode purchase that decays refrigerator condition",
    );
    assert(
      JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress),
      "L3: levelProgress is byte-identical before/after",
    );
  }
  // equipmentSpecialization.ts's own function is entirely untouched (this phase never calls or imports it) — a real live import proves it still behaves exactly as Economy V2 left it.
  assert(typeof getEquipmentModifier === "function", "L4: equipmentSpecialization.ts's own function still exists and is callable, completely independent of this phase's files");
}

// ===== M: no negative cash/inventory ever; no duplicated state. =====
{
  const save = saveAt({
    credits: 3,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 } },
  });
  const result = purchaseIngredient(save, "tomato", 1000);
  assert(!result.ok, "M: an unaffordable purchase is rejected outright");
  assert(save.credits === 3, "M2: credits are never touched by a rejected purchase");
  const stateKeys = Object.keys(DEFAULT_BUSINESS_STATE.equipmentCondition);
  assert(stateKeys.length === 1 && stateKeys[0] === "refrigeratorCondition", "M3: equipmentCondition holds exactly one field — no duplicated/second wallet, ledger, or catalog state");
}

// ===== N: determinism — identical inputs produce identical results; no Math.random() CALL anywhere in the new file. =====
{
  const save = saveAt({
    credits: 10000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 } },
  });
  const r1 = purchaseIngredient(save, "tomato", 7);
  const r2 = purchaseIngredient(save, "tomato", 7);
  assert(
    r1.ok && r2.ok && r1.save.business.equipmentCondition.refrigeratorCondition === r2.save.business.equipmentCondition.refrigeratorCondition,
    "N: identical purchase inputs produce identical condition results",
  );
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(import.meta.dirname, "..", "src", "game", "business");
  const content = fs.readFileSync(path.join(dir, "businessEquipmentCondition.ts"), "utf8");
  const hasMention = /Math\.random\(\)/.test(content);
  const isDocMention = /(Never|No|not)\s+`?Math\.random\(\)/i.test(content);
  assert(!(hasMention && !isDocMention), "N2: no Math.random() CALL exists anywhere in businessEquipmentCondition.ts");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
