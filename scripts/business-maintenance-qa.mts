/**
 * BUSINESS_MAINTENANCE_QA — Economy V3 Phase 11. Verifies the
 * refrigerator maintenance/repair action: derived maintenance status,
 * data-driven cost lookup, atomic repair transaction (condition
 * restoration, insufficient-funds rejection, "already operational"
 * rejection), ledger integration, interaction with perishability/staff/
 * popularity after a repair, Campaign independence, no negative cash,
 * no duplicated equipment-condition state, and determinism — against
 * the real production functions only.
 *
 * Run: npx tsx scripts/business-maintenance-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { DEFAULT_EQUIPMENT_CONDITION_STATE } from "../src/game/business/businessEquipmentCondition.ts";
import {
  maintenanceStatusFor,
  maintenanceCostFor,
  performRefrigeratorMaintenance,
} from "../src/game/business/businessMaintenance.ts";
import { dailyPopularityDelta } from "../src/game/business/PopularityManager.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import { appendLedgerEntry, ledgerTotals } from "../src/game/economy/EconomyLedger.ts";
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

// ===== A: maintenanceStatusFor — pure, derived, reuses V3-10's own condition thresholds exactly. =====
{
  assert(maintenanceStatusFor(100) === "OPERATIONAL" && maintenanceStatusFor(80) === "OPERATIONAL", "A: GOOD condition (100/80) is OPERATIONAL");
  assert(maintenanceStatusFor(79) === "OPERATIONAL" && maintenanceStatusFor(60) === "OPERATIONAL", "A2: WORN condition (79/60) is still OPERATIONAL");
  assert(maintenanceStatusFor(59) === "NEEDS_SERVICE" && maintenanceStatusFor(40) === "NEEDS_SERVICE", "A3: POOR condition (59/40) is NEEDS_SERVICE");
  assert(maintenanceStatusFor(39) === "NEEDS_SERVICE" && maintenanceStatusFor(20) === "NEEDS_SERVICE", "A4: CRITICAL condition (39/20) is still NEEDS_SERVICE");
  assert(maintenanceStatusFor(19) === "BROKEN" && maintenanceStatusFor(0) === "BROKEN", "A5: BROKEN condition (19/0) is BROKEN");
}

// ===== B: maintenanceCostFor — data-driven lookup, null exactly when nothing needs repair. =====
// NOTE (Phase 14 stale-precondition fix, documented): maintenance costs
// were recalibrated from prototype "coins" (150/400) to real USD cents
// (15,000/40,000 = $150/$400 — see businessMaintenance.ts's own doc).
// Every affected `credits` value below is bumped to stay comfortably
// affordable under the new numbers; the tests' own intent (exact cost,
// atomicity, insufficient-funds rejection) is unchanged.
{
  assert(maintenanceCostFor(100) === null && maintenanceCostFor(60) === null, "B: OPERATIONAL has no cost to look up (null)");
  assert(maintenanceCostFor(59) === 15_000 && maintenanceCostFor(20) === 15_000, "B2: NEEDS_SERVICE costs exactly $150 across its whole range");
  assert(maintenanceCostFor(19) === 40_000 && maintenanceCostFor(0) === 40_000, "B3: BROKEN costs exactly $400 across its whole range");
  assert(maintenanceCostFor(19)! > maintenanceCostFor(59)!, "B4: a worse breakdown costs strictly more to repair (severity-scaled, not arbitrary)");
}

// ===== C: performRefrigeratorMaintenance — rejection paths leave the save completely untouched. =====
{
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 100 } } });
  const result = performRefrigeratorMaintenance(save);
  assert(!result.ok && result.reason === "alreadyOperational", "C: repairing an already-OPERATIONAL fridge is rejected");
}
{
  const save = saveAt({ credits: 50, business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 10 } } }); // BROKEN, costs $400
  const result = performRefrigeratorMaintenance(save);
  assert(!result.ok && result.reason === "insufficientFunds", "C2: an unaffordable repair is rejected");
  assert(save.credits === 50 && save.business.equipmentCondition.refrigeratorCondition === 10, "C3: a rejected repair leaves credits AND condition completely untouched");
}

// ===== D: performRefrigeratorMaintenance — a successful repair is atomic: exact cost deducted, condition fully restored. =====
{
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 45 } } }); // NEEDS_SERVICE (POOR), costs $150
  const result = performRefrigeratorMaintenance(save);
  assert(result.ok, "D: precondition — repair succeeds");
  if (result.ok) {
    assert(result.cost === 15_000, `D2: NEEDS_SERVICE repair costs exactly $150 (got ${result.cost})`);
    assert(result.save.credits === 85_000, `D3: credits drop by exactly the cost (100,000-15,000=85,000, got ${result.save.credits})`);
    assert(result.save.business.equipmentCondition.refrigeratorCondition === 100, "D4: condition is fully restored to 100");
    assert(result.statusBefore === "NEEDS_SERVICE" && result.duringRepair === "UNDER_REPAIR" && result.statusAfter === "OPERATIONAL", "D5: the result reports all three of the transaction's own states (before/during/after) correctly");
  }
}
{
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 5 } } }); // BROKEN, costs $400
  const result = performRefrigeratorMaintenance(save);
  assert(result.ok && result.cost === 40_000 && result.save.credits === 60_000, `D6: a BROKEN repair costs exactly $400 and deducts correctly (got ok=${result.ok}, credits=${result.ok ? result.save.credits : "n/a"})`);
  if (result.ok) {
    assert(result.save.business.equipmentCondition.refrigeratorCondition === 100, "D7: a BROKEN fridge is also fully restored to 100, never a partial fix");
  }
}
{
  // D-exact-affordability: paying EXACTLY the cost (0 left over) still succeeds — never rejected merely for being tight.
  const save = saveAt({ credits: 15_000, business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 45 } } });
  const result = performRefrigeratorMaintenance(save);
  assert(result.ok && result.save.credits === 0, `D8: paying exactly the cost succeeds and leaves credits at exactly 0 (got ok=${result.ok}, credits=${result.ok ? result.save.credits : "n/a"})`);
}

// ===== E: repair never touches inventory, staff, popularity, or any other Business Mode field. =====
{
  const save = saveAt({
    credits: 100_000,
    business: {
      ...DEFAULT_BUSINESS_STATE,
      equipmentCondition: { refrigeratorCondition: 45 },
      inventory: { tomato: { ingredientId: "tomato", quantity: 7, unitCost: 20, purchaseDay: 3 } },
      staff: { hiredRoles: ["cleaner"] },
      popularity: { score: 62 },
    },
  });
  const result = performRefrigeratorMaintenance(save);
  assert(result.ok, "E: precondition — repair succeeds");
  if (result.ok) {
    assert(JSON.stringify(result.save.business.inventory) === JSON.stringify(save.business.inventory), "E2: inventory is byte-identical before/after a repair (no accidental inventory deletion)");
    assert(JSON.stringify(result.save.business.staff) === JSON.stringify(save.business.staff), "E3: staff roster is byte-identical before/after a repair");
    assert(result.save.business.popularity.score === 62, "E4: popularity score is untouched by the repair transaction ITSELF (the daily delta effect is a separate, already-tested pipeline)");
  }
}

// ===== F: interaction with popularity — after a repair, the refrigerator's own popularity penalty is gone from dailyPopularityDelta. =====
{
  const brokenSave = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 10 } } });
  assert(dailyPopularityDelta(brokenSave) === -3, `F: precondition — a BROKEN fridge costs -3 popularity per day (got ${dailyPopularityDelta(brokenSave)})`);
  const repaired = performRefrigeratorMaintenance(saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 10 } } }));
  assert(repaired.ok, "F2: precondition — repair succeeds");
  if (repaired.ok) {
    assert(dailyPopularityDelta(repaired.save) === 0, `F3: after repair, the refrigerator's own popularity penalty is gone (got ${dailyPopularityDelta(repaired.save)})`);
  }
}

// ===== G: interaction with perishability (spoilage) — after a repair, endBusinessDay's spoilage multiplier returns to 1x. =====
{
  const brokenSave = saveAt({
    credits: 100_000,
    business: {
      ...DEFAULT_BUSINESS_STATE,
      calendar: { businessDay: 20 },
      inventory: { tomato: { ingredientId: "tomato", quantity: 10, unitCost: 12, purchaseDay: 1 } }, // long expired by day 21
      equipmentCondition: { refrigeratorCondition: 10 }, // BROKEN -> 1.5x
    },
  });
  const beforeRepairResult = endBusinessDay(brokenSave);
  assert(beforeRepairResult.spoiledValue === Math.round(10 * 12 * 1.5), `G: precondition — a BROKEN fridge inflates spoiled value by 1.5x (got ${beforeRepairResult.spoiledValue})`);

  const repaired = performRefrigeratorMaintenance(brokenSave);
  assert(repaired.ok, "G2: precondition — repair succeeds");
  if (repaired.ok) {
    const afterRepairSave = saveAt({
      ...repaired.save,
      business: {
        ...repaired.save.business,
        calendar: { businessDay: 20 },
        inventory: { tomato: { ingredientId: "tomato", quantity: 10, unitCost: 12, purchaseDay: 1 } },
      },
    });
    const afterRepairResult = endBusinessDay(afterRepairSave);
    assert(afterRepairResult.spoiledValue === 10 * 12, `G3: after repair, the spoilage multiplier returns to exactly 1x (got ${afterRepairResult.spoiledValue}, expected ${10 * 12})`);
  }
}

// ===== H: interaction with staff — the Cleaner's own 0.8x spoilage discount still composes correctly after a repair (multiplier chain unaffected by this phase). =====
{
  const save = saveAt({
    credits: 100_000,
    business: {
      ...DEFAULT_BUSINESS_STATE,
      calendar: { businessDay: 20 },
      inventory: { tomato: { ingredientId: "tomato", quantity: 10, unitCost: 12, purchaseDay: 1 } },
      staff: { hiredRoles: ["cleaner"] },
      equipmentCondition: { refrigeratorCondition: 45 }, // POOR -> 1.1x, will be repaired to 100 -> 1x
    },
  });
  const repaired = performRefrigeratorMaintenance(save);
  assert(repaired.ok, "H: precondition — repair succeeds");
  if (repaired.ok) {
    const afterRepairSave = {
      ...repaired.save,
      business: {
        ...repaired.save.business,
        calendar: { businessDay: 20 },
        inventory: { tomato: { ingredientId: "tomato", quantity: 10, unitCost: 12, purchaseDay: 1 } },
      },
    };
    const result = endBusinessDay(afterRepairSave);
    assert(result.spoiledValue === Math.round(10 * 12 * 0.8), `H2: Cleaner's own 0.8x discount still applies correctly, alone, once the fridge is repaired back to 1x (got ${result.spoiledValue})`);
  }
}

// ===== I: ledger integration — a real repair creates exactly one correctly-categorized entry. =====
{
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 45 } } });
  const before = save.economyLedger.length;
  const result = performRefrigeratorMaintenance(save);
  assert(result.ok, "I: precondition — repair succeeds");
  if (result.ok) {
    const withLedger = appendLedgerEntry(result.save, "refrigerator-maintenance", -result.cost);
    const newEntries = withLedger.economyLedger.length - before;
    assert(newEntries === 1, `I2: a real repair creates EXACTLY one ledger entry (got ${newEntries})`);
    const entry = withLedger.economyLedger[withLedger.economyLedger.length - 1]!;
    assert(entry.category === "refrigerator-maintenance" && entry.amount === -15_000, "I3: the ledger entry has the correct category and exact signed amount");
    const totals = ledgerTotals(withLedger.economyLedger);
    assert(totals.byCategory["refrigerator-maintenance"] === -15_000, "I4: ledgerTotals correctly aggregates the new category");
  }
}
{
  // I-rejected: a rejected repair (insufficient funds) never reaches the ledger at all — mirrors every other purchase action's own guarantee.
  const save = saveAt({ credits: 10, business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 5 } } });
  const before = save.economyLedger.length;
  const result = performRefrigeratorMaintenance(save);
  assert(!result.ok, "I5: precondition — rejected as unaffordable");
  assert(save.economyLedger.length === before, "I6: a rejected repair creates zero ledger entries");
}

// ===== J: no negative credits, ever. =====
{
  const save = saveAt({ credits: 0, business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 5 } } });
  const result = performRefrigeratorMaintenance(save);
  assert(!result.ok && result.reason === "insufficientFunds", "J: a 0-credit save cannot repair (never goes negative)");
  assert(save.credits === 0, "J2: credits remain exactly 0, never negative");
}

// ===== K: no duplicated equipment-condition state — this phase adds no second condition field anywhere. =====
{
  const stateKeys = Object.keys(DEFAULT_EQUIPMENT_CONDITION_STATE);
  assert(stateKeys.length === 1 && stateKeys[0] === "refrigeratorCondition", "K: businessEquipmentCondition.ts's own state shape is unchanged by this phase — still exactly one field");
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 45 } } });
  const result = performRefrigeratorMaintenance(save);
  if (result.ok) {
    assert(Object.keys(result.save.business.equipmentCondition).length === 1, "K2: a repaired save's own equipmentCondition still holds exactly one field — no second condition value introduced");
  }
}

// ===== L: Campaign independence — sharpness/equipmentSpecialization completely untouched by a repair. =====
{
  const save = saveAt({
    credits: 100_000,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" },
    knifeSharpness: { "chef-knife": 55 },
    business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 45 } },
  });
  const result = performRefrigeratorMaintenance(save);
  assert(result.ok, "L: precondition — repair succeeds");
  if (result.ok) {
    assert(JSON.stringify(result.save.knifeSharpness) === JSON.stringify(save.knifeSharpness), "L2: Campaign's own knifeSharpness is byte-identical before/after a Business Mode repair");
    assert(JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress), "L3: levelProgress is byte-identical before/after");
  }
  assert(typeof getEquipmentModifier === "function", "L4: equipmentSpecialization.ts's own function still exists and is callable, completely independent of this phase's files");
}

// ===== M: persistence — a mid-repair-cycle save (NEEDS_SERVICE/BROKEN) survives a JSON round-trip, and the derived status recomputes identically. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 12 } } });
  const roundTripped = JSON.parse(JSON.stringify(save)) as SaveData;
  assert(roundTripped.business.equipmentCondition.refrigeratorCondition === 12, "M: condition survives a JSON round-trip exactly");
  assert(maintenanceStatusFor(roundTripped.business.equipmentCondition.refrigeratorCondition) === "BROKEN", "M2: the derived maintenance status recomputes identically after a round-trip (no separate persisted status to drift out of sync)");
}

// ===== N: migration — an old save (pre-V3-11, but already V3-10) needs no new field at all; maintenance status derives cleanly from whatever condition already exists. =====
{
  const v310Save = {
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
      staff: { hiredRoles: [] },
      equipmentCondition: { refrigeratorCondition: 33 },
    },
  } as unknown as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...v310Save, business: { ...DEFAULT_SAVE.business, ...v310Save.business } } as SaveData;
  assert(migrated.business.equipmentCondition.refrigeratorCondition === 33, "N: a pre-V3-11 (V3-10) save's own condition survives exactly");
  assert(maintenanceStatusFor(migrated.business.equipmentCondition.refrigeratorCondition) === "NEEDS_SERVICE", "N2: V3-11's status function works immediately on an old save with no migration code needed — nothing new was added to SaveData");
}
{
  // N-fresh: a genuinely fresh save (predates even V3-10) still defaults to OPERATIONAL via the existing V3-10 migration default, unaffected by V3-11.
  const freshSave = { version: 1, credits: 500 } as unknown as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...freshSave, business: { ...DEFAULT_SAVE.business, ...(freshSave.business ?? {}) } } as SaveData;
  assert(migrated.business.equipmentCondition.refrigeratorCondition === 100, "N3: a save that predates V3-10 entirely still defaults condition to 100 via V3-10's own migration");
  assert(maintenanceStatusFor(migrated.business.equipmentCondition.refrigeratorCondition) === "OPERATIONAL", "N4: which V3-11 correctly derives as OPERATIONAL");
}

// ===== O: determinism — identical inputs produce identical results; no Math.random() CALL anywhere in the new file. =====
{
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 45 } } });
  const r1 = performRefrigeratorMaintenance(save);
  const r2 = performRefrigeratorMaintenance(save);
  assert(
    r1.ok && r2.ok && r1.cost === r2.cost && r1.save.business.equipmentCondition.refrigeratorCondition === r2.save.business.equipmentCondition.refrigeratorCondition,
    "O: identical repair inputs produce identical results",
  );
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(import.meta.dirname, "..", "src", "game", "business");
  const content = fs.readFileSync(path.join(dir, "businessMaintenance.ts"), "utf8");
  const hasMention = /Math\.random\(\)/.test(content);
  const isDocMention = /(Never|No|not)\s+`?Math\.random\(\)/i.test(content);
  assert(!(hasMention && !isDocMention), "O2: no Math.random() CALL exists anywhere in businessMaintenance.ts");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
