/**
 * BUSINESS_INSPECTION_FINES_QA — Economy V3 Phase 13. Verifies the
 * PASS/WARNING/FAIL -> fine severity mapping (Minor/Repeated/Major),
 * the exact documented fine amounts, the atomic all-or-nothing wallet
 * mutation (never a partial charge, never debt), ledger correctness
 * (including the zero-fine no-entry guarantee), no double-charging
 * across re-renders/reloads/repeated end-of-day calls, interaction with
 * popularity, Campaign isolation, and determinism — against the real
 * production functions only. Never re-implements or re-evaluates
 * inspection criteria itself — every scenario here consumes Phase 12's
 * own `inspectBusiness`/`endBusinessDay` output exactly as produced.
 *
 * Run: npx tsx scripts/business-inspection-fines-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { DEFAULT_INSPECTION_FINE_STATE, fineSeverityFor, determineInspectionFine } from "../src/game/business/businessInspectionFines.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import { inspectBusiness } from "../src/game/business/businessInspection.ts";
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

// ===== A: default state — nobody has ever been inspected yet. =====
{
  assert(DEFAULT_INSPECTION_FINE_STATE.lastInspectionResult === null, "A: a brand-new save has no prior inspection result recorded");
  assert(DEFAULT_BUSINESS_STATE.inspectionFines.lastInspectionResult === null, "A2: DEFAULT_BUSINESS_STATE carries the same default");
}

// ===== B: fineSeverityFor — the exact Minor/Repeated/Major mapping, pure and deterministic. =====
{
  assert(fineSeverityFor("PASS", null) === "NONE", "B: PASS never fines regardless of history");
  assert(fineSeverityFor("PASS", "FAIL") === "NONE", "B2: PASS never fines even right after a FAIL");
  assert(fineSeverityFor("WARNING", null) === "NONE", "B3: a FIRST-time WARNING (Minor) is just a warning, no fine");
  assert(fineSeverityFor("WARNING", "PASS") === "NONE", "B4: a WARNING following a PASS is still a first-time Minor occurrence, no fine");
  assert(fineSeverityFor("WARNING", "WARNING") === "SMALL", "B5: a WARNING following yesterday's WARNING is Repeated -> small fine");
  assert(fineSeverityFor("WARNING", "FAIL") === "SMALL", "B6: a WARNING following yesterday's FAIL is also Repeated -> small fine");
  assert(fineSeverityFor("FAIL", null) === "LARGE", "B7: FAIL is always Major -> larger fine, even on a save's very first inspection");
  assert(fineSeverityFor("FAIL", "PASS") === "LARGE", "B8: FAIL always fines regardless of yesterday's result");
  assert(fineSeverityFor("FAIL", "FAIL") === "LARGE", "B9: a repeated FAIL still fines exactly the same documented LARGE amount (no invented Critical escalation)");
}

// ===== C: determineInspectionFine — exact documented amounts, and the all-or-nothing affordability rule. =====
// NOTE (Phase 14 stale-precondition fix, documented): inspection fine
// amounts were recalibrated from prototype "coins" (100/300) to real
// USD cents (27,500/52,500 = $275/$525, the City of Chicago's own 2026
// fine schedule — see businessInspectionFines.ts's own doc). Every
// affected `credits` value below is bumped/recomputed to preserve each
// test's original intent (exact fine amount, exact boundary, exact
// insufficient-funds behavior) under the new real numbers.
{
  const pass = determineInspectionFine("PASS", "FAIL", 100_000);
  assert(pass.severity === "NONE" && pass.fineAmount === 0 && pass.finePaid === 0, "C: PASS costs exactly nothing");
  const minorWarning = determineInspectionFine("WARNING", null, 100_000);
  assert(minorWarning.severity === "NONE" && minorWarning.fineAmount === 0 && minorWarning.finePaid === 0, "C2: a first-time WARNING costs exactly nothing");
  const repeatedWarning = determineInspectionFine("WARNING", "WARNING", 100_000);
  assert(repeatedWarning.severity === "SMALL" && repeatedWarning.fineAmount === 27_500 && repeatedWarning.finePaid === 27_500, `C3: a repeated WARNING costs exactly the documented $275 small fine (got ${repeatedWarning.fineAmount})`);
  const fail = determineInspectionFine("FAIL", null, 100_000);
  assert(fail.severity === "LARGE" && fail.fineAmount === 52_500 && fail.finePaid === 52_500, `C4: a FAIL costs exactly the documented $525 larger fine (got ${fail.fineAmount})`);
  assert(fail.fineAmount > repeatedWarning.fineAmount, "C5: the larger (Major) fine is strictly greater than the small (Repeated) fine");
}
{
  // C-boundary: paying EXACTLY the fine amount (0 left over) still succeeds — never rejected merely for being tight.
  const exact = determineInspectionFine("FAIL", null, 52_500);
  assert(exact.finePaid === 52_500, "C6: exactly enough credits still pays the full fine");
  const oneShort = determineInspectionFine("FAIL", null, 52_499);
  assert(oneShort.finePaid === 0, "C7: one credit short of the fine waives it entirely — never a partial charge");
}
{
  // C-unaffordable: an unaffordable fine is waived, never partial, never negative.
  const unaffordable = determineInspectionFine("FAIL", null, 0);
  assert(unaffordable.severity === "LARGE" && unaffordable.fineAmount === 52_500 && unaffordable.finePaid === 0, "C8: an unaffordable FAIL still reports the documented severity/amount, but pays exactly 0");
}

// ===== D: endBusinessDay integration — PASS pays no fine. =====
{
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 } } }); // default state -> PASS
  const result = endBusinessDay(save);
  assert(result.inspectionReport.overall === "PASS", "D: precondition — a default save passes inspection");
  assert(result.inspectionFine.finePaid === 0, "D2: a PASS day pays no fine");
  assert(result.save.credits === 100_000, "D3: credits are completely untouched by a PASS day's (non-)fine");
}

// ===== E: endBusinessDay integration — a FIRST-time WARNING pays no fine (Minor). =====
{
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 45 } } }); // POOR -> WARNING
  const result = endBusinessDay(save);
  assert(result.inspectionReport.overall === "WARNING", "E: precondition — a POOR fridge triggers a WARNING inspection");
  assert(result.inspectionFine.severity === "NONE" && result.inspectionFine.finePaid === 0, "E2: the FIRST WARNING (no prior recorded day) pays no fine");
  assert(result.save.credits === 100_000, "E3: credits are untouched by a first-time WARNING");
  assert(result.save.business.inspectionFines.lastInspectionResult === "WARNING", "E4: today's result is recorded for tomorrow's repeat check");
}

// ===== F: endBusinessDay integration — a REPEATED WARNING (two consecutive real days) pays the small fine. =====
{
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 45 } } });
  const day1 = endBusinessDay(save);
  assert(day1.inspectionFine.finePaid === 0, "F: precondition — day 1's WARNING is the first occurrence, no fine");
  const day2 = endBusinessDay(day1.save); // condition is still 45 (POOR) — nothing repaired it
  assert(day2.inspectionReport.overall === "WARNING", "F2: precondition — day 2 is also a WARNING (condition never changes on its own)");
  assert(day2.inspectionFine.severity === "SMALL" && day2.inspectionFine.finePaid === 27_500, `F3: day 2's REPEATED WARNING pays exactly the documented $275 small fine (got ${day2.inspectionFine.finePaid})`);
  assert(day2.save.credits === 100_000 - 27_500, `F4: credits drop by exactly the small fine on day 2 (got ${day2.save.credits})`);
}

// ===== G: endBusinessDay integration — FAIL always pays the larger fine, even on a save's very first day. =====
{
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } }); // BROKEN -> FAIL
  const result = endBusinessDay(save);
  assert(result.inspectionReport.overall === "FAIL", "G: precondition — a BROKEN fridge triggers a FAIL inspection");
  assert(result.inspectionFine.severity === "LARGE" && result.inspectionFine.finePaid === 52_500, `G2: a FAIL pays exactly the documented $525 larger fine on its very first occurrence (got ${result.inspectionFine.finePaid})`);
  assert(result.save.credits === 47_500, `G3: credits drop by exactly the larger fine (100,000-52,500=47,500, got ${result.save.credits})`);
}
{
  // G-repeated-fail: a repeated FAIL still fines exactly the SAME documented amount — no invented Critical escalation. credits sized to comfortably afford BOTH consecutive $525 fines.
  const save = saveAt({ credits: 200_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } });
  const day1 = endBusinessDay(save);
  const day2 = endBusinessDay(day1.save);
  assert(day2.inspectionReport.overall === "FAIL" && day2.inspectionFine.finePaid === 52_500, `G4: a second consecutive FAIL still fines exactly $525, unchanged (got ${day2.inspectionFine.finePaid})`);
}

// ===== H: insufficient-funds behavior — an unaffordable fine is waived, never partial, never negative. =====
{
  const save = saveAt({ credits: 50, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } }); // FAIL costs $525, only 50 available
  const result = endBusinessDay(save);
  assert(result.inspectionFine.severity === "LARGE" && result.inspectionFine.fineAmount === 52_500, "H: precondition — the documented fine is still $525 even though it can't be paid");
  assert(result.inspectionFine.finePaid === 0, "H2: an unaffordable fine is waived entirely — never a partial charge");
  assert(result.save.credits === 50, "H3: credits are completely untouched when the fine can't be covered");
  assert(result.save.credits >= 0, "H4: credits never go negative");
}

// ===== I: exact affordability boundary via endBusinessDay (post-payroll credits). =====
{
  const save = saveAt({ credits: 52_500, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } }); // exactly enough for the $525 fine, no staff
  const result = endBusinessDay(save);
  assert(result.inspectionFine.finePaid === 52_500 && result.save.credits === 0, `I: exactly enough credits pays the full fine and leaves credits at exactly 0 (got finePaid=${result.inspectionFine.finePaid}, credits=${result.save.credits})`);
}
{
  const save = saveAt({ credits: 52_499, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } });
  const result = endBusinessDay(save);
  assert(result.inspectionFine.finePaid === 0 && result.save.credits === 52_499, "I2: one credit short of the fine waives it and leaves credits completely untouched");
}
{
  // I-post-payroll: the fine is assessed against credits AFTER payroll, so an affordable-before-payroll but unaffordable-after-payroll fine is correctly waived.
  const save = saveAt({
    credits: 68_500,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 }, staff: { hiredRoles: ["prep-cook"] } }, // payroll $160 (16,000c), leaving exactly $525 (52,500c) for the fine
  });
  const result = endBusinessDay(save);
  assert(result.payrollPaid === 16_000, "I3: precondition — payroll of $160 is paid first");
  assert(result.inspectionFine.finePaid === 52_500, `I4: the fine is correctly assessed against the POST-payroll $525 remaining, and is exactly affordable (got ${result.inspectionFine.finePaid})`);
  assert(result.save.credits === 0, "I5: credits reflect both deductions correctly (68,500-16,000-52,500=0)");
}

// ===== J: atomic wallet mutation — the fine is the ONLY thing that moves credits during a FAIL inspection; ledger entries are the caller's job (App.tsx), not endBusinessDay's own. =====
{
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } });
  const before = save.economyLedger.length;
  const result = endBusinessDay(save);
  assert(result.save.economyLedger.length === before, "J: endBusinessDay itself never appends a ledger entry for the fine (mirrors payroll's own pattern exactly)");
  assert(result.save.credits === save.credits - result.inspectionFine.finePaid, "J2: credits move by exactly the fine amount, nothing else");
}

// ===== K: ledger entry correctness — the caller's own appendLedgerEntry call records exactly one correctly-categorized entry, and NEVER a zero-amount entry. =====
{
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } });
  const result = endBusinessDay(save);
  const withLedger = appendLedgerEntry(result.save, "inspection-fine", -result.inspectionFine.finePaid);
  const newEntries = withLedger.economyLedger.length - save.economyLedger.length;
  assert(newEntries === 1, `K: a real FAIL fine creates EXACTLY one ledger entry (got ${newEntries})`);
  const entry = withLedger.economyLedger[withLedger.economyLedger.length - 1]!;
  assert(entry.category === "inspection-fine" && entry.amount === -52_500, "K2: the ledger entry has the correct category and exact signed amount");
  const totals = ledgerTotals(withLedger.economyLedger);
  assert(totals.byCategory["inspection-fine"] === -52_500, "K3: ledgerTotals correctly aggregates the new category");
}
{
  // K-zero: a PASS day's zero fine creates NO ledger entry — appendLedgerEntry's own 0-amount no-op.
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 } } });
  const result = endBusinessDay(save);
  const before = save.economyLedger.length;
  const withLedger = appendLedgerEntry(result.save, "inspection-fine", -result.inspectionFine.finePaid);
  assert(withLedger.economyLedger.length === before, "K4: a zero-amount (PASS) fine creates ZERO ledger entries");
}

// ===== L: no double-charging across re-renders/reloads/repeated UI actions — the inspection screen (inspectBusiness) is purely observational. =====
{
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } });
  const before = JSON.stringify(save);
  inspectBusiness(save);
  inspectBusiness(save);
  inspectBusiness(save);
  assert(JSON.stringify(save) === before, "L: calling inspectBusiness (what the Inspections screen and Dashboard both call on every render) any number of times never mutates the save or touches credits");
}
{
  // L-reload: a JSON round-trip of an already-fined save never re-triggers or duplicates the charge.
  const save = saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } });
  const result = endBusinessDay(save);
  const roundTripped = JSON.parse(JSON.stringify(result.save)) as SaveData;
  assert(roundTripped.credits === result.save.credits, "L2: a JSON round-trip (simulating a reload) preserves the already-charged credits exactly, without charging again");
  assert(roundTripped.business.inspectionFines.lastInspectionResult === "FAIL", "L3: the recorded lastInspectionResult also survives the round-trip exactly");
}
{
  // L-two-distinct-days: calling endBusinessDay twice in a row (two real, distinct clicks) charges each day's OWN correctly-computed fine — never the same day's fine twice.
  const save = saveAt({ credits: 200_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } });
  const day1 = endBusinessDay(save);
  const day2 = endBusinessDay(day1.save);
  assert(day1.save.business.calendar.businessDay !== day2.save.business.calendar.businessDay, "L4: precondition — the two calls represent two genuinely different business days");
  assert(day1.inspectionFine.finePaid === 52_500 && day2.inspectionFine.finePaid === 52_500, "L5: each of the two distinct days is fined independently and correctly — never a skipped or doubled charge");
  assert(day2.save.credits === 200_000 - 52_500 - 52_500, `L6: total credits across both real days reflect exactly two separate $525 fines (got ${day2.save.credits})`);
}

// ===== M: interaction with popularity — the fine and the popularity effect are independent; paying (or waiving) a fine never changes popularity math. =====
{
  const affordable = endBusinessDay(saveAt({ credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } }));
  const unaffordable = endBusinessDay(saveAt({ credits: 50, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } }));
  assert(affordable.popularityDelta === unaffordable.popularityDelta, `M: whether the fine could actually be paid never changes the popularity delta (both FAIL the same way) — got ${affordable.popularityDelta} vs ${unaffordable.popularityDelta}`);
}

// ===== N: Campaign independence. =====
{
  const save = saveAt({
    credits: 100_000,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" },
    knifeSharpness: { "chef-knife": 55 },
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } },
  });
  const result = endBusinessDay(save);
  assert(result.inspectionFine.finePaid === 52_500, "N: precondition — a real fine is charged");
  assert(JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress), "N2: levelProgress is byte-identical before/after a FAIL fine");
  assert(JSON.stringify(result.save.knifeSharpness) === JSON.stringify(save.knifeSharpness), "N3: Campaign's own knifeSharpness is byte-identical before/after");
  assert(typeof getEquipmentModifier === "function", "N4: equipmentSpecialization.ts's own function still exists and is callable, completely independent of this phase's files");
}

// ===== O: no negative credits ever; no second wallet/ledger; no duplicate inspection evaluator. =====
{
  const save = saveAt({ credits: 0, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } });
  const result = endBusinessDay(save);
  assert(result.save.credits >= 0, "O: credits never go negative from a FAIL fine, even starting from 0");
  const businessKeys = Object.keys(DEFAULT_BUSINESS_STATE);
  assert(businessKeys.filter((k) => k.toLowerCase().includes("ledger") || k.toLowerCase().includes("wallet")).length === 0, "O2: no second wallet/ledger field exists anywhere on BusinessState");
  const stateKeys = Object.keys(DEFAULT_INSPECTION_FINE_STATE);
  assert(stateKeys.length === 1 && stateKeys[0] === "lastInspectionResult", "O3: inspectionFines holds exactly the one field this phase needs — no duplicated inspection report/state");
}

// ===== P: determinism — identical inputs produce identical results; no Math.random() CALL anywhere in the new file. =====
{
  const save = saveAt({ credits: 2000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 3 }, equipmentCondition: { refrigeratorCondition: 5 } } });
  const r1 = endBusinessDay(save);
  const r2 = endBusinessDay(save);
  assert(
    r1.inspectionFine.finePaid === r2.inspectionFine.finePaid && r1.save.credits === r2.save.credits,
    "P: identical endBusinessDay inputs produce identical fine results",
  );
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(import.meta.dirname, "..", "src", "game", "business");
  const content = fs.readFileSync(path.join(dir, "businessInspectionFines.ts"), "utf8");
  const hasMention = /Math\.random\(\)/.test(content);
  const isDocMention = /(Never|No|not)\s+`?Math\.random\(\)/i.test(content);
  assert(!(hasMention && !isDocMention), "P2: no Math.random() CALL exists anywhere in businessInspectionFines.ts");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
