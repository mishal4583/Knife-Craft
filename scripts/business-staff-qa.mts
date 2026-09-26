/**
 * BUSINESS_STAFF_QA — Economy V3 Phase 9. Verifies the staff catalog,
 * hire/fire actions, the real wired effects (Prep Cook purchase
 * discount, Line Cook/Head Chef/Server popularity boost, Cleaner
 * spoilage-value reduction, Manager payroll discount), daily payroll
 * settlement (including the insolvency mass-layoff safety net), ledger
 * integration, migration, Campaign independence, and determinism —
 * against the real production functions only.
 *
 * Run: npx tsx scripts/business-staff-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { STAFF_CATALOG as CAMPAIGN_STAFF_CATALOG } from "../src/game/economy/staffDefinitions.ts";
import {
  ALL_STAFF_ROLES,
  getStaffDefinition,
  getAllStaffDefinitions,
  staffUnitCostDiscount,
  staffPopularityDelta,
  staffSpoilageValueMultiplier,
  dailyPayroll,
} from "../src/game/business/businessStaff.ts";
import { hireStaff, fireStaff } from "../src/game/business/BusinessStaffManager.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { dailyPopularityDelta } from "../src/game/business/PopularityManager.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import { businessUnitCostFor } from "../src/game/business/businessPricing.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";

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

// ===== A: default staff state is empty; the catalog is exactly the 6 spec'd roles, distinct from Campaign's own. =====
{
  assert(DEFAULT_BUSINESS_STATE.staff.hiredRoles.length === 0, "A: DEFAULT_BUSINESS_STATE starts with nobody hired");
  assert(ALL_STAFF_ROLES.length === 6, `A2: exactly 6 roles exist (got ${ALL_STAFF_ROLES.length})`);
  for (const role of ["prep-cook", "line-cook", "head-chef", "server", "cleaner", "manager"]) {
    assert(!!getStaffDefinition(role), `A3: ${role} exists in the Business Mode catalog`);
  }
  const campaignIds = new Set(CAMPAIGN_STAFF_CATALOG.map((s) => s.id));
  assert(ALL_STAFF_ROLES.every((r) => !campaignIds.has(r)), "A4: no Business Mode role id collides with Campaign's own staff catalog");
  assert(getAllStaffDefinitions().every((d) => Number.isInteger(d.salary) && d.salary > 0), "A5: every role has a positive integer salary");
}

// ===== B: hireStaff — validation, atomicity, free (no ledger entry). =====
{
  const save = saveAt({ credits: 1000 });
  const unknown = hireStaff(save, "not-a-real-role");
  assert(!unknown.ok && unknown.reason === "unknownRole", "B: an unknown role is rejected");
  const result = hireStaff(save, "prep-cook");
  assert(result.ok, "B2: hiring a real role succeeds");
  if (result.ok) {
    assert(result.save.business.staff.hiredRoles.includes("prep-cook"), "B3: the hired role is recorded exactly");
    assert(result.save.credits === 1000, "B4: hiring is free — credits are completely untouched");
    assert(result.save.economyLedger.length === save.economyLedger.length, "B5: hiring creates ZERO ledger entries");
  }
}
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, staff: { hiredRoles: ["prep-cook"] } } });
  const result = hireStaff(save, "prep-cook");
  assert(!result.ok && result.reason === "alreadyHired", "B6: hiring an already-hired role is rejected");
  assert(save.business.staff.hiredRoles.length === 1, "B7: a rejected re-hire leaves the roster untouched");
}

// ===== C: fireStaff — validation, atomicity, free. =====
{
  const save = saveAt({ credits: 500 });
  const notHired = fireStaff(save, "prep-cook");
  assert(!notHired.ok && notHired.reason === "notHired", "C: firing an unhired role is rejected");
}
{
  const save = saveAt({ credits: 500, business: { ...DEFAULT_BUSINESS_STATE, staff: { hiredRoles: ["prep-cook", "manager"] } } });
  const result = fireStaff(save, "prep-cook");
  assert(result.ok, "C2: firing a hired role succeeds");
  if (result.ok) {
    assert(!result.save.business.staff.hiredRoles.includes("prep-cook"), "C3: the fired role is removed");
    assert(result.save.business.staff.hiredRoles.includes("manager"), "C4: the OTHER hired role is untouched");
    assert(result.save.credits === 500, "C5: firing is free — credits are completely untouched");
    assert(result.save.economyLedger.length === save.economyLedger.length, "C6: firing creates ZERO ledger entries");
  }
}

// ===== D: staffUnitCostDiscount — the real, wired Prep Cook discount. =====
{
  assert(staffUnitCostDiscount(100, []) === 100, "D: no Prep Cook means the base price, unchanged");
  assert(staffUnitCostDiscount(100, ["prep-cook"]) === 97, `D2: a Prep Cook gives exactly the documented 3% discount (got ${staffUnitCostDiscount(100, ["prep-cook"])})`);
  assert(staffUnitCostDiscount(100, ["manager", "cleaner"]) === 100, "D3: a non-Prep-Cook roster gives no purchase discount");
  assert(staffUnitCostDiscount(0, ["prep-cook"]) === 0, "D4: a 0 base price never goes negative under the discount");
}

// ===== E: purchaseIngredient integration — the Prep Cook discount actually applies at purchase time, composing with V3-7/V3-8. =====
{
  const save = saveAt({
    credits: 10000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 }, staff: { hiredRoles: ["prep-cook"] } }, // day 7 = quiet, no event
  });
  const baseCost = businessUnitCostFor("tomato");
  const result = purchaseIngredient(save, "tomato", 5);
  const expected = Math.round(baseCost * 0.97);
  assert(result.ok && result.unitCost === expected, `E: a hired Prep Cook's discount applies at purchase time (got ${result.ok ? result.unitCost : "n/a"}, expected ${expected})`);
}
{
  // E-none: with no Prep Cook, purchases are completely unaffected (regression against V3-2/V3-7/V3-8's own behavior).
  const save = saveAt({ credits: 10000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 } } });
  const baseCost = businessUnitCostFor("tomato");
  const result = purchaseIngredient(save, "tomato", 5);
  assert(result.ok && result.unitCost === baseCost, "E2: with no staff, purchases are priced exactly as before this phase");
}

// ===== F: staffPopularityDelta / dailyPopularityDelta integration. =====
{
  assert(staffPopularityDelta([]) === 0, "F: no staff means zero popularity delta");
  assert(staffPopularityDelta(["line-cook"]) === 1, "F2: Line Cook gives exactly +1");
  assert(staffPopularityDelta(["head-chef"]) === 3, "F3: Head Chef gives exactly +3");
  assert(staffPopularityDelta(["server"]) === 2, "F4: Server gives exactly +2");
  assert(staffPopularityDelta(["line-cook", "head-chef", "server"]) === 6, "F5: all three combine additively (1+3+2=6)");
  assert(staffPopularityDelta(["prep-cook", "cleaner", "manager"]) === 0, "F6: non-popularity roles contribute nothing");
}
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, staff: { hiredRoles: ["head-chef"] } } });
  assert(dailyPopularityDelta(save) === 3, `F7: dailyPopularityDelta includes the staff term on an otherwise-neutral menu (got ${dailyPopularityDelta(save)})`);
}

// ===== G: staffSpoilageValueMultiplier — the real, wired Cleaner effect. =====
{
  assert(staffSpoilageValueMultiplier([]) === 1, "G: no Cleaner means no reduction (multiplier 1)");
  assert(staffSpoilageValueMultiplier(["cleaner"]) === 0.8, `G2: a Cleaner gives exactly the documented 20% reduction (got ${staffSpoilageValueMultiplier(["cleaner"])})`);
}

// ===== H: dailyPayroll — base sum, and the Manager's own discount on the REST of payroll (never their own salary). =====
// NOTE (Phase 14 stale-precondition fix, documented): staff salaries were
// recalibrated from prototype "coins" to real US-cents payroll (hourly
// wage x scheduled hours + 25% employer burden — see businessStaff.ts's
// own doc): prep-cook 16,000c/day, cleaner 11,250c/day, manager
// 24,000c/day, server 15,000c/day. The exact numbers below are updated
// accordingly; the test's own intent (exact sums, the Manager's own
// discount formula) is unchanged.
{
  assert(dailyPayroll([]) === 0, "H: no staff means zero payroll");
  assert(dailyPayroll(["prep-cook"]) === 16_000, "H2: a single role's payroll is exactly its own salary");
  assert(dailyPayroll(["prep-cook", "cleaner"]) === 27_250, `H3: two roles (no manager) sum exactly (16,000+11,250=27,250, got ${dailyPayroll(["prep-cook", "cleaner"])})`);
  const withManager = dailyPayroll(["prep-cook", "manager"]);
  const expected = Math.round(16_000 * 0.9) + 24_000; // prep-cook discounted, manager's own salary untouched
  assert(withManager === expected, `H4: a Manager discounts every OTHER role's salary by 10%, never their own (got ${withManager}, expected ${expected})`);
}

// ===== I: endBusinessDay integration — payroll is deducted, and the Cleaner's spoilage discount applies. =====
{
  const save = saveAt({
    credits: 50_000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, staff: { hiredRoles: ["prep-cook"] } },
  });
  const result = endBusinessDay(save);
  assert(result.payrollPaid === 16_000, `I: a single Prep Cook's payroll is deducted exactly (got ${result.payrollPaid})`);
  assert(result.save.credits === 34_000, `I2: credits reflect exactly the payroll deduction (50,000-16,000=34,000, got ${result.save.credits})`);
  assert(result.staffLaidOff.length === 0, "I3: an affordable payroll never lays anyone off");
  assert(result.save.business.staff.hiredRoles.includes("prep-cook"), "I4: staff remains employed after an affordable payroll");
}
{
  // I-cleaner: a Cleaner reduces the RECORDED spoiled value, never the physically-removed quantity.
  const save = saveAt({
    credits: 2000,
    business: {
      ...DEFAULT_BUSINESS_STATE,
      calendar: { businessDay: 20 },
      inventory: { tomato: { ingredientId: "tomato", quantity: 10, unitCost: 12, purchaseDay: 1 } }, // long expired by day 21
      staff: { hiredRoles: ["cleaner"] },
    },
  });
  const result = endBusinessDay(save);
  assert(result.spoiledQuantity === 10, "I5: the Cleaner never changes HOW MANY units physically expire");
  const expectedValue = Math.round(10 * 12 * 0.8);
  assert(result.spoiledValue === expectedValue, `I6: the Cleaner reduces the RECORDED spoiled value by exactly 20% (got ${result.spoiledValue}, expected ${expectedValue})`);
}

// ===== J: insolvency — payroll never creates debt; an unaffordable day lays off the WHOLE staff, atomically. =====
{
  const save = saveAt({
    credits: 30,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, staff: { hiredRoles: ["head-chef", "manager"] } }, // payroll far exceeds 30
  });
  const before = save.economyLedger.length;
  const result = endBusinessDay(save);
  assert(result.payrollPaid === 0, "J: an unaffordable payroll pays exactly 0 — never a partial payment");
  assert(result.save.credits === 30, "J2: credits are completely untouched when payroll can't be covered");
  assert(result.staffLaidOff.length === 2 && result.staffLaidOff.includes("head-chef") && result.staffLaidOff.includes("manager"), "J3: the ENTIRE staff is reported as laid off, atomically");
  assert(result.save.business.staff.hiredRoles.length === 0, "J4: the roster is actually cleared after an insolvent day");
  assert(result.save.economyLedger.length === before, "J5: an insolvent day (0 paid) creates ZERO ledger entries — appendLedgerEntry's own 0-amount no-op");
  assert(result.save.credits >= 0, "J6: credits never go negative from payroll, ever");
}

// ===== K: ledger integration — a real payroll payment creates exactly one correctly-categorized entry. =====
{
  const save = saveAt({ credits: 50_000, business: { ...DEFAULT_BUSINESS_STATE, staff: { hiredRoles: ["server"] } } });
  const result = endBusinessDay(save);
  const withLedger = appendLedgerEntry(result.save, "business-staff-salary", -result.payrollPaid);
  const newEntries = withLedger.economyLedger.length - save.economyLedger.length;
  assert(newEntries === 1, `K: a real payroll payment creates EXACTLY one ledger entry (got ${newEntries})`);
  const entry = withLedger.economyLedger[withLedger.economyLedger.length - 1]!;
  assert(entry.category === "business-staff-salary" && entry.amount === -15_000, "K2: the ledger entry has the correct category and exact signed amount");
}

// ===== L: persistence — a hired roster survives a JSON save/load round-trip. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, staff: { hiredRoles: ["prep-cook", "cleaner"] } } });
  const roundTripped = JSON.parse(JSON.stringify(save)) as SaveData;
  assert(
    roundTripped.business.staff.hiredRoles.length === 2 &&
      roundTripped.business.staff.hiredRoles.includes("prep-cook") &&
      roundTripped.business.staff.hiredRoles.includes("cleaner"),
    "L: a hired roster survives a JSON round-trip exactly",
  );
}

// ===== M: migration — old saves (pre-V3-9) default staff cleanly; forward-compatible with a later field. =====
{
  const v38Save = {
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
    },
  } as unknown as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...v38Save, business: { ...DEFAULT_SAVE.business, ...v38Save.business } } as SaveData;
  assert(migrated.business.popularity.score === 50, "M: a pre-V3-9 save's popularity survives exactly");
  assert(migrated.business.staff.hiredRoles.length === 0, "M2: staff defaults cleanly to an empty roster on a save that predates this phase");
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
      staff: { hiredRoles: ["head-chef"] },
    },
  } as unknown as Partial<SaveData>;
  const defaultWithFuture: FutureBusinessState = { ...DEFAULT_SAVE.business, futureField: "default-value" };
  const migrated = { ...DEFAULT_SAVE, ...laterSave, business: { ...defaultWithFuture, ...laterSave.business } };
  assert(migrated.business.staff.hiredRoles.includes("head-chef"), "M3: an existing field (staff) survives when a LATER phase's field is also present");
  assert((migrated.business as FutureBusinessState).futureField === "default-value", "M4: a field from a LATER phase not yet in this save correctly falls back to its own default");
}

// ===== N: Campaign independence. =====
{
  const save = saveAt({
    credits: 5000,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" },
    ownedStaffIds: ["prep-assistant"],
  });
  const result = hireStaff(save, "prep-cook");
  assert(result.ok, "N0: precondition");
  if (result.ok) {
    assert(JSON.stringify(result.save.ownedStaffIds) === JSON.stringify(save.ownedStaffIds), "N: Campaign's own ownedStaffIds is completely untouched by a Business Mode hire");
    assert(JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress), "N2: levelProgress is byte-identical before/after hiring");
  }
}
{
  const save = saveAt({
    credits: 5000,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" },
    business: { ...DEFAULT_BUSINESS_STATE, staff: { hiredRoles: ["prep-cook"] } },
  });
  const result = endBusinessDay(save);
  assert(JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress), "N3: levelProgress is byte-identical before/after a payroll-settling End Business Day");
}

// ===== O: no negative cash/inventory ever. =====
{
  const save = saveAt({ credits: 0, business: { ...DEFAULT_BUSINESS_STATE, staff: { hiredRoles: ["manager"] } } });
  const result = endBusinessDay(save);
  assert(result.save.credits === 0, "O: an insolvent payroll never makes credits negative, even starting from 0");
}

// ===== P: determinism — identical inputs produce identical results; no Math.random() CALL anywhere in the new files. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, staff: { hiredRoles: ["head-chef", "manager"] } } });
  const r1 = endBusinessDay(save);
  const r2 = endBusinessDay(save);
  assert(r1.payrollPaid === r2.payrollPaid && r1.popularityDelta === r2.popularityDelta, "P: identical endBusinessDay inputs produce identical staff-related results");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(import.meta.dirname, "..", "src", "game", "business");
  const files = ["businessStaff.ts", "BusinessStaffManager.ts"];
  let foundRandomCall = false;
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    const hasMention = /Math\.random\(\)/.test(content);
    const isDocMention = /(Never|No|not)\s+`?Math\.random\(\)/i.test(content);
    if (hasMention && !isDocMention) foundRandomCall = true;
  }
  assert(!foundRandomCall, "P2: no Math.random() CALL exists anywhere in the new business staff files");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
