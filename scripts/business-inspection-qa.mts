/**
 * BUSINESS_INSPECTION_QA — Economy V3 Phase 12. Verifies every
 * inspection category's own criteria/thresholds, the overall
 * "weakest-link" aggregation, the real wiring into
 * BusinessDayManager.endBusinessDay (post-mutation state, correct
 * composition into that day's popularity movement via the existing
 * inspectionDelta forward hook), Campaign isolation, wallet/ledger
 * non-interference, no negative credits, no duplicated inspection
 * state, and determinism — against the real production functions only.
 *
 * Run: npx tsx scripts/business-inspection-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { inspectBusiness } from "../src/game/business/businessInspection.ts";
import { inspectionDelta, dailyServiceDelta, neutralPullDelta } from "../src/game/business/PopularityManager.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
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

function categoryOf(report: ReturnType<typeof inspectBusiness>, category: string) {
  const c = report.categories.find((c) => c.category === category);
  if (!c) throw new Error(`missing category ${category}`);
  return c;
}

// ===== A: default/fresh save — every category passes, overall PASS, exactly 7 categories reported. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE } });
  const report = inspectBusiness(save);
  assert(report.categories.length === 7, `A: exactly 7 categories are reported (got ${report.categories.length})`);
  assert(report.categories.every((c) => c.result === "PASS"), "A2: a completely default save passes every category");
  assert(report.overall === "PASS", "A3: overall is PASS on a default save");
  assert(report.overallReason === "All inspection categories passed.", "A4: the overall reason explains a clean pass");
  assert(report.categories.every((c) => c.reason.length > 0), "A5: every category has a non-empty, explanatory reason");
}

// ===== B: FOOD_STORAGE — refrigerator utilization thresholds. =====
{
  const empty = categoryOf(inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE } })), "FOOD_STORAGE");
  assert(empty.result === "PASS", "B: an empty refrigerator passes Food Storage");
  const warning = categoryOf(
    inspectBusiness(
      saveAt({
        business: {
          ...DEFAULT_BUSINESS_STATE,
          inventory: { tomato: { ingredientId: "tomato", quantity: 32, unitCost: 20, purchaseDay: 1 } }, // 32/40 = 80%
        },
      }),
    ),
    "FOOD_STORAGE",
  );
  assert(warning.result === "WARNING", `B2: 80% full (32/40) triggers a Food Storage WARNING (got ${warning.result})`);
  const fail = categoryOf(
    inspectBusiness(
      saveAt({
        business: {
          ...DEFAULT_BUSINESS_STATE,
          inventory: { tomato: { ingredientId: "tomato", quantity: 39, unitCost: 20, purchaseDay: 1 } }, // 39/40 = 97.5%
        },
      }),
    ),
    "FOOD_STORAGE",
  );
  assert(fail.result === "FAIL", `B3: 97.5% full (39/40) triggers a Food Storage FAIL (got ${fail.result})`);
}

// ===== C: INGREDIENT_EXPIRY — NEAR_EXPIRY/EXPIRED thresholds, reusing perishability.ts's own real ageing. =====
{
  // Tomato is Vegetable category, 7-day shelf life: NEAR_EXPIRY at >=75% (day 6+), EXPIRED at 100% (day 7+).
  const fresh = categoryOf(
    inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 2 }, inventory: { tomato: { ingredientId: "tomato", quantity: 5, unitCost: 20, purchaseDay: 1 } } } })),
    "INGREDIENT_EXPIRY",
  );
  assert(fresh.result === "PASS", "C: a freshly-purchased ingredient passes Ingredient Expiry");
  const nearExpiry = categoryOf(
    inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 }, inventory: { tomato: { ingredientId: "tomato", quantity: 5, unitCost: 20, purchaseDay: 1 } } } })),
    "INGREDIENT_EXPIRY",
  );
  assert(nearExpiry.result === "WARNING", `C2: a NEAR_EXPIRY ingredient triggers WARNING (got ${nearExpiry.result})`);
  const expired = categoryOf(
    inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 9 }, inventory: { tomato: { ingredientId: "tomato", quantity: 5, unitCost: 20, purchaseDay: 1 } } } })),
    "INGREDIENT_EXPIRY",
  );
  assert(expired.result === "FAIL", `C3: an EXPIRED ingredient still sitting in storage triggers FAIL (got ${expired.result})`);
}

// ===== D: REFRIGERATOR_CONDITION / EQUIPMENT_CONDITION — reuse Phase 10's own exact banding; today, the same underlying signal. =====
{
  const good = inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 90 } } }));
  assert(categoryOf(good, "REFRIGERATOR_CONDITION").result === "PASS", "D: GOOD condition (90) passes Refrigerator Condition");
  assert(categoryOf(good, "EQUIPMENT_CONDITION").result === "PASS", "D2: GOOD condition (90) also passes Equipment Condition");
  const poor = inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 45 } } }));
  assert(categoryOf(poor, "REFRIGERATOR_CONDITION").result === "WARNING", "D3: POOR condition (45) triggers a Refrigerator Condition WARNING");
  assert(categoryOf(poor, "EQUIPMENT_CONDITION").result === "WARNING", "D4: POOR condition (45) also triggers an Equipment Condition WARNING (same real signal)");
  const broken = inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 5 } } }));
  assert(categoryOf(broken, "REFRIGERATOR_CONDITION").result === "FAIL", "D5: BROKEN condition (5) triggers a Refrigerator Condition FAIL");
  assert(categoryOf(broken, "EQUIPMENT_CONDITION").result === "FAIL", "D6: BROKEN condition (5) also triggers an Equipment Condition FAIL");
}

// ===== E: KITCHEN_CLEANLINESS — a hired Cleaner always passes; otherwise gated on THIS day's spoilage (V3-16 P0 fix: was lifetime spoilage, a one-way ratchet; same 15/50 thresholds). =====
{
  const withCleaner = categoryOf(
    inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE, staff: { hiredRoles: ["cleaner"] }, spoilage: { totalSpoiledQuantity: 500, totalSpoiledValue: 5000 } } })),
    "KITCHEN_CLEANLINESS",
  );
  assert(withCleaner.result === "PASS", "E: a hired Cleaner passes Kitchen Cleanliness regardless of lifetime spoilage");
  const noCleanerLow = categoryOf(inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE, spoilage: { totalSpoiledQuantity: 5, totalSpoiledValue: 50 } } })), "KITCHEN_CLEANLINESS");
  assert(noCleanerLow.result === "PASS", "E2: no Cleaner but low lifetime spoilage still passes");
  const noCleanerWarning = categoryOf(inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE } }), 20), "KITCHEN_CLEANLINESS");
  assert(noCleanerWarning.result === "WARNING", `E3: no Cleaner and moderate spoilage TODAY (20 units) triggers WARNING (got ${noCleanerWarning.result})`);
  const noCleanerFail = categoryOf(inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE } }), 60), "KITCHEN_CLEANLINESS");
  assert(noCleanerFail.result === "FAIL", `E4: no Cleaner and high spoilage TODAY (60 units) triggers FAIL (got ${noCleanerFail.result})`);
  const lifetimeOnly = categoryOf(inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE, spoilage: { totalSpoiledQuantity: 60, totalSpoiledValue: 600 } } }), 0), "KITCHEN_CLEANLINESS");
  assert(lifetimeOnly.result === "PASS", `E5: 60 units of LIFETIME spoilage with nothing spoiled today no longer fails (no permanent ratchet; got ${lifetimeOnly.result})`);
}

// ===== F: FOOD_SAFETY — the worst of Ingredient Expiry and Refrigerator Condition, never a third invented metric. =====
{
  const bothGood = categoryOf(inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE } })), "FOOD_SAFETY");
  assert(bothGood.result === "PASS", "F: fresh ingredients and a good fridge pass Food Safety");
  const badFridge = categoryOf(inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 5 } } })), "FOOD_SAFETY");
  assert(badFridge.result === "FAIL", "F2: a BROKEN fridge alone fails Food Safety (worst-of)");
  const badExpiry = categoryOf(
    inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 9 }, inventory: { tomato: { ingredientId: "tomato", quantity: 5, unitCost: 20, purchaseDay: 1 } } } })),
    "FOOD_SAFETY",
  );
  assert(badExpiry.result === "FAIL", "F3: expired stock alone fails Food Safety (worst-of)");
}

// ===== G: STAFF_COMPLIANCE — not applicable with no staff; otherwise gated on cash covering today's payroll. =====
{
  const noStaff = categoryOf(inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE } })), "STAFF_COMPLIANCE");
  assert(noStaff.result === "PASS" && noStaff.reason.includes("Not applicable"), "G: no staff means Staff Compliance passes as not applicable");
  // Phase 14 stale-precondition fix: staff salaries were recalibrated to real USD-cents payroll (prep-cook is now $160/day = 16,000c) — credits bumped so this stays a genuinely affordable scenario.
  const affordable = categoryOf(inspectBusiness(saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, staff: { hiredRoles: ["prep-cook"] } } })), "STAFF_COMPLIANCE");
  assert(affordable.result === "PASS", "G2: enough cash to cover today's payroll passes Staff Compliance");
  const unaffordable = categoryOf(inspectBusiness(saveAt({ credits: 5, business: { ...DEFAULT_BUSINESS_STATE, staff: { hiredRoles: ["head-chef"] } } })), "STAFF_COMPLIANCE");
  assert(unaffordable.result === "WARNING", `G3: not enough cash to cover today's payroll triggers a WARNING (got ${unaffordable.result})`);
}

// ===== H: overall aggregation — "weakest link": any single FAIL makes the whole report FAIL, any WARNING (with no FAIL) makes it WARNING. =====
{
  const oneFail = inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 5 } } }));
  assert(oneFail.overall === "FAIL", "H: a single FAILing category makes the overall result FAIL");
  const oneWarning = inspectBusiness(saveAt({ business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 45 } } }));
  assert(oneWarning.overall === "WARNING", "H2: a single WARNING category (with nothing worse) makes the overall result WARNING");
  assert(oneFail.overallReason.length > 0 && oneFail.overallReason !== "All inspection categories passed.", "H3: a non-passing overall has a real, non-generic reason");
}

// ===== I: endBusinessDay integration — the report is computed on post-mutation state and composes into that day's popularity movement. =====
{
  // I-expiry-cleared: an ingredient that would be EXPIRED as of the new day is cleared by spoilage BEFORE inspection runs, so it never triggers an Ingredient Expiry FAIL that day.
  const save = saveAt({
    credits: 2000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 8 }, inventory: { tomato: { ingredientId: "tomato", quantity: 5, unitCost: 20, purchaseDay: 1 } } }, // EXPIRED as of day 9
  });
  const result = endBusinessDay(save);
  assert(result.spoiledQuantity === 5, "I: precondition — the ingredient is actually cleared as spoilage this day");
  assert(categoryOf(result.inspectionReport, "INGREDIENT_EXPIRY").result === "PASS", "I2: inspection runs AFTER spoilage cleanup, so the now-removed ingredient no longer triggers a FAIL");
}
{
  // I-composition: popularityDelta equals dailyPopularityDelta(original save) + inspectionDelta(overall) exactly — never a different, re-invented formula.
  const save = saveAt({ credits: 2000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } }); // BROKEN -> refrigeratorPopularityDelta -3, inspection FAIL -> -6
  const result = endBusinessDay(save);
  assert(result.inspectionReport.overall === "FAIL", "I3: precondition — a BROKEN fridge fails the inspection overall");
  // -3 (Phase 10 refrigerator popularity term) + -6 (Phase 12 FAIL) + Phase 16 D2 terms: -3 (no order served today) + 0 (pull at exactly 50) = -12
  const expectedDelta = -3 + inspectionDelta("FAIL") + dailyServiceDelta(0) + neutralPullDelta(50);
  assert(result.popularityDelta === expectedDelta, `I4: popularityDelta correctly composes the existing 4-term calc with the new inspection term (got ${result.popularityDelta}, expected ${expectedDelta})`);
}
{
  // I-payroll-timing: Staff Compliance reflects POST-payroll-settlement credits, per the Business Day Flow's own ordering (Staff Cost before Inspection).
  const save = saveAt({ credits: 40, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, staff: { hiredRoles: ["prep-cook"] } } }); // payroll 50 > 40 -> insolvent, laid off, credits untouched (still 40)
  const result = endBusinessDay(save);
  assert(result.staffLaidOff.length > 0, "I5: precondition — payroll is unaffordable and staff is laid off this day");
  assert(categoryOf(result.inspectionReport, "STAFF_COMPLIANCE").result === "PASS", "I6: once laid off (post-payroll state), Staff Compliance correctly reads as not applicable (no staff) rather than stale WARNING");
}

// ===== J: wallet/ledger non-interference — the INSPECTION EVALUATION itself never touches credits or the ledger; only the (separate, Phase 13) fine does. =====
// NOTE (Phase 13 stale-precondition fix, same pattern as the Phase 8/12
// fixes documented elsewhere): J2 originally asserted credits were
// completely untouched by a FAILing inspection — true under Phase 12
// alone, before any financial consequence existed. Phase 13 correctly
// activates the ALWAYS-documented "Major -> larger fine" behavior for a
// FAIL, so credits now legitimately move by exactly that fine. The
// assertion is updated to verify the DEEPER, still-true invariant this
// test was always really checking: nothing OTHER than the documented
// fine amount ever touches credits during an inspection.
{
  const save = saveAt({ credits: 2000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } });
  const before = save.economyLedger.length;
  const result = endBusinessDay(save);
  assert(result.save.economyLedger.length === before, "J: endBusinessDay itself creates zero ledger entries for the fine — that's App.tsx's wrapper's job, exactly like payroll's own ledger entry");
  assert(
    result.save.credits === save.credits - result.inspectionFine.finePaid,
    `J2: credits move by EXACTLY the documented fine amount and nothing else (got ${result.save.credits}, expected ${save.credits - result.inspectionFine.finePaid})`,
  );
}

// ===== K: no negative credits; no duplicate inspection state ever persisted. =====
{
  const save = saveAt({ credits: 0, business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 5 } } });
  const result = endBusinessDay(save);
  assert(result.save.credits >= 0, "K: credits never go negative as a result of an inspection, even a FAIL");
  const businessKeys = Object.keys(result.save.business);
  assert(!businessKeys.includes("inspection") && !businessKeys.includes("inspectionReport") && !businessKeys.includes("inspectionResult"), "K2: no inspection-related field is ever written into SaveData.business — the report is derived, never persisted");
}

// ===== L: persistence/migration — nothing new to migrate; a save from any prior phase evaluates immediately. =====
{
  const v311Save = {
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
      equipmentCondition: { refrigeratorCondition: 100 },
    },
  } as unknown as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...v311Save, business: { ...DEFAULT_SAVE.business, ...v311Save.business } } as SaveData;
  const report = inspectBusiness(migrated);
  assert(report.overall === "PASS", "L: a save from any prior phase evaluates cleanly with no migration code needed — nothing new was added to SaveData");
}
{
  const roundTripped = JSON.parse(JSON.stringify(saveAt({ business: { ...DEFAULT_BUSINESS_STATE, equipmentCondition: { refrigeratorCondition: 45 } } }))) as SaveData;
  const report = inspectBusiness(roundTripped);
  assert(categoryOf(report, "REFRIGERATOR_CONDITION").result === "WARNING", "L2: the derived report recomputes identically after a JSON round-trip (nothing to desync)");
}

// ===== M: Campaign independence. =====
{
  const save = saveAt({
    credits: 5000,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" },
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } },
  });
  const result = endBusinessDay(save);
  assert(JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress), "M: levelProgress is byte-identical before/after a FAILing inspection day");
  assert(typeof getEquipmentModifier === "function", "M2: equipmentSpecialization.ts's own function still exists and is callable, completely independent of this phase's files");
}

// ===== N: determinism — identical inputs produce identical results; no Math.random() CALL anywhere in the new file. =====
{
  const save = saveAt({ credits: 2000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 45 } } });
  const r1 = inspectBusiness(save);
  const r2 = inspectBusiness(save);
  assert(JSON.stringify(r1) === JSON.stringify(r2), "N: identical inputs produce byte-identical inspection reports");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(import.meta.dirname, "..", "src", "game", "business");
  const content = fs.readFileSync(path.join(dir, "businessInspection.ts"), "utf8");
  const hasMention = /Math\.random\(\)/.test(content);
  const isDocMention = /(Never|No|not)\s+`?Math\.random\(\)/i.test(content);
  assert(!(hasMention && !isDocMention), "N2: no Math.random() CALL exists anywhere in businessInspection.ts");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
