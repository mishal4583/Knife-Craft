/**
 * BUSINESS_EXPERIENCE_QA — V3-16 player-experience & realism audit.
 * Pins every player-facing claim this pass corrected to the real rule it
 * describes, so text and behaviour cannot drift apart again:
 *   A. supplier-event text never tells a contract-less player about "your
 *      active contract";
 *   B. staff descriptions state each role's ACTUAL effect (numbers read
 *      from the effect functions themselves), and no role promises an
 *      effect the game doesn't have;
 *   C. refrigerator descriptions match their modeled size class (§24);
 *   D. the near-expiry alert names its inspection consequence;
 *   E. Business play no longer reads or writes Campaign recipe progress
 *      (source-level check of the one App.tsx handler + the Knife Report
 *      "previous best" read).
 *
 * Run: npx tsx scripts/business-experience-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { addStock } from "../src/game/business/businessInventory.ts";
import { SUPPLIER_EVENT_CATALOG } from "../src/game/business/businessSupplierEvents.ts";
import { supplierEventSummary, businessAlertsFor, repeatedWarningFineAmount } from "../src/game/business/businessAlerts.ts";
import { signContract } from "../src/game/business/BusinessSupplierManager.ts";
import { getStaffDefinition, staffUnitCostDiscount, staffPopularityDelta, staffSpoilageValueMultiplier, dailyPayroll } from "../src/game/business/businessStaff.ts";
import { REFRIGERATOR_CATALOG } from "../src/game/business/refrigeratorDefinitions.ts";
import { formatUsd } from "../src/game/business/businessCurrency.ts";
import { perishabilityStateFor, shelfLifeForIngredient } from "../src/game/business/perishability.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

// ===== A: supplier-event text vs contract state. =====
{
  const delay = SUPPLIER_EVENT_CATALOG["supplier-delay"];
  const noContract = supplierEventSummary(delay, false);
  assert(!/your active contract/i.test(noContract) && /no contract/i.test(noContract) && /unaffected/i.test(noContract), "A: with no contract, Supplier Delay says prices are unaffected (never 'your active contract')");
  assert(supplierEventSummary(delay, true) === delay.description, "A2: with an active contract, the original suspension text is shown");
  const bulk = SUPPLIER_EVENT_CATALOG["bulk-discount"];
  assert(supplierEventSummary(bulk, false) === bulk.description && supplierEventSummary(bulk, true) === bulk.description, "A3: events that don't depend on a contract are unchanged");
  const day1: SaveData = { ...DEFAULT_SAVE, credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 } } };
  const alertNo = businessAlertsFor(day1).find((a) => a.key.startsWith("supplier-event:"))!;
  assert(!/your active contract/i.test(alertNo.detail) && alertNo.severity === "info", "A4: the Day-1 Dashboard alert for a contract-less player is informational and doesn't mention 'your active contract'");
  const signed = signContract(day1, "local-market");
  const alertYes = signed.ok ? businessAlertsFor(signed.save).find((a) => a.key.startsWith("supplier-event:"))! : null;
  assert(!!alertYes && alertYes.severity === "warning" && alertYes.detail.includes(delay.description), "A5: with a contract, the same day is a warning that explains the suspension");
}

// ===== B: staff descriptions state real, measured effects. =====
{
  const prep = getStaffDefinition("prep-cook")!;
  const pct = Math.round((1 - staffUnitCostDiscount(10_000, ["prep-cook"]) / 10_000) * 100);
  assert(prep.description.includes(`${pct}%`), `B: Prep Cook text states the real purchase discount (${pct}%)`);
  for (const role of ["line-cook", "head-chef", "server"] as const) {
    const n = staffPopularityDelta([role]);
    assert(getStaffDefinition(role)!.description.includes(`+${n} popularity each business day`), `B2: ${role} text states its real effect (+${n} popularity/day)`);
  }
  const cleanerPct = Math.round((1 - staffSpoilageValueMultiplier(["cleaner"])) * 100);
  assert(getStaffDefinition("cleaner")!.description.includes("Kitchen Cleanliness always passes") && getStaffDefinition("cleaner")!.description.includes(`${cleanerPct}%`), "B3: Cleaner text states its inspection effect and the real recorded-spoilage reduction");
  const mgrPct = Math.round((1 - (dailyPayroll(["manager", "server"]) - dailyPayroll(["manager"])) / dailyPayroll(["server"])) * 100);
  assert(getStaffDefinition("manager")!.description.includes(`${mgrPct}%`), `B4: Manager text states the real payroll discount (${mgrPct}%)`);
  const all = ["prep-cook", "line-cook", "head-chef", "server", "cleaner", "manager"].map((r) => getStaffDefinition(r)!.description).join(" ");
  assert(!/customers coming back|a little|small, steady|catching spoilage/i.test(all), "B5: no role promises a vague or non-existent effect");
}

// ===== C: refrigerator descriptions vs modeled size (§24 reach-in classes). =====
{
  const [basic, commercial, pro] = REFRIGERATOR_CATALOG;
  assert(!/under-counter/i.test(basic!.description) && /single-door reach-in/i.test(basic!.description) && basic!.approxCubicFeet >= 17 && basic!.approxCubicFeet <= 22, `C: the starter unit is described as a single-door reach-in, matching its ≈${basic!.approxCubicFeet} cu ft (§24: 17.6-22)`);
  assert(/two-door reach-in/i.test(commercial!.description) && /three-door reach-in/i.test(pro!.description), "C2: larger units are named by their reach-in class");
}

// ===== D: near-expiry alert names its consequence. =====
{
  const day = 20;
  let nearDay = -1;
  for (let p = day; p > day - shelfLifeForIngredient("garlic"); p--) {
    if (perishabilityStateFor("garlic", p, day) === "NEAR_EXPIRY" && perishabilityStateFor("garlic", p, day + 1) !== "EXPIRED") { nearDay = p; break; }
  }
  const save: SaveData = { ...DEFAULT_SAVE, credits: 100_000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: day }, inventory: addStock({}, "garlic", 1, 350, nearDay) } };
  const a = businessAlertsFor(save).find((x) => x.key.startsWith("near-expiry:"));
  assert(!!a && /Ingredient Expiry WARNING/.test(a.detail) && a.detail.includes(formatUsd(repeatedWarningFineAmount())), "D: the Nearing Expiry alert explains the inspection WARNING and the repeat fine");
}

// ===== E: Business play never touches Campaign recipe progress. =====
{
  const app = fs.readFileSync(path.resolve(import.meta.dirname, "..", "src", "App.tsx"), "utf8");
  const start = app.indexOf("function recordBusinessServiceResult(");
  const body = app.slice(start, app.indexOf("\n  }\n", start));
  assert(start > 0 && !/recipeProgress/.test(body.replace(/\/\*[\s\S]*?\*\//g, "")), "E: recordBusinessServiceResult no longer writes Campaign recipeProgress");
  assert(/isBusinessService\s*\?\s*0\s*:\s*\(save\.recipeProgress/.test(app), "E2: a Business Knife Report doesn't read a Campaign 'previous best'");
}

// ===== F: USD formatting — negatives read "−$2.33", never "$-2.33". =====
{
  assert(formatUsd(-233) === "−$2.33" && formatUsd(233) === "$2.33" && formatUsd(0) === "$0.00" && formatUsd(-150000) === "−$1,500.00", "F: formatUsd renders negatives as −$X (one convention on every Business screen)");
}

console.log(failures === 0 ? "\nBUSINESS EXPERIENCE QA: ALL PASS" : `\nBUSINESS EXPERIENCE QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
