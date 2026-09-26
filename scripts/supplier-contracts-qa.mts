/**
 * SUPPLIER_CONTRACTS_QA — Economy V3 Phase 7. Verifies the contract
 * catalog, activity/expiry math, the real wired discount (purchase-time
 * effective unit cost), the quality-modifier forward hook, sign/cancel
 * actions, End Business Day integration, ledger integration, migration,
 * Campaign independence, and determinism — against the real production
 * functions only.
 *
 * Run: npx tsx scripts/supplier-contracts-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { SUPPLIER_CATALOG } from "../src/game/economy/supplierDefinitions.ts";
import {
  SUPPLIER_CONTRACT_CATALOG,
  getContractTerms,
  getAllContractOffers,
  isContractActive,
  effectiveUnitCost,
  qualityModifierFor,
  type ActiveSupplierContract,
} from "../src/game/business/businessSupplierContract.ts";
import { signContract, cancelContract } from "../src/game/business/BusinessSupplierManager.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
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

function contractAt(supplierId: string, startDay: number): ActiveSupplierContract {
  const terms = getContractTerms(supplierId)!;
  return { ...terms, supplierId, contractStartDay: startDay, contractEndDay: startDay + terms.contractLength };
}

// ===== A: default contract state is null; every real supplier has exactly one contract offer. =====
{
  assert(DEFAULT_BUSINESS_STATE.supplierContract === null, "A: DEFAULT_BUSINESS_STATE starts with no contract");
  for (const supplier of SUPPLIER_CATALOG) {
    assert(!!getContractTerms(supplier.id), `A2: ${supplier.id} has a real contract offer in the catalog`);
  }
  assert(getAllContractOffers().length === SUPPLIER_CATALOG.length, "A3: exactly one contract offer per real supplier, no more, no fewer");
  assert(Object.keys(SUPPLIER_CONTRACT_CATALOG).every((id) => !!SUPPLIER_CATALOG.find((s) => s.id === id)), "A4: every contract offer maps to a REAL existing supplier id, never an invented one");
}

// ===== B: isContractActive — null, not-yet-expired, and expired cases. =====
{
  assert(!isContractActive(null, 5), "B: a null contract is never active");
  const contract = contractAt("local-market", 1); // 10-day contract -> ends day 11
  assert(isContractActive(contract, 1), "B2: active on its own start day");
  assert(isContractActive(contract, 10), "B3: still active the day before it ends");
  assert(!isContractActive(contract, 11), "B4: no longer active exactly on its end day");
  assert(!isContractActive(contract, 50), "B5: stays inactive long after expiry");
}

// ===== C: effectiveUnitCost — the real, wired discount. =====
{
  const base = 100;
  assert(effectiveUnitCost(base, null, 5, 10) === base, "C: no contract means the base price, unchanged");
  const wholesale = contractAt("wholesale-supplier", 1); // discount 0.2, minimumOrder 25
  assert(effectiveUnitCost(base, wholesale, 1, 24) === base, "C2: a purchase below the contract's minimum order gets NO discount");
  assert(effectiveUnitCost(base, wholesale, 1, 25) === 80, `C3: a purchase meeting the minimum order gets the exact discount (100*0.8=80, got ${effectiveUnitCost(base, wholesale, 1, 25)})`);
  assert(effectiveUnitCost(base, wholesale, 25, 25) === base, "C4: an expired contract (day >= contractEndDay) grants no discount even at a qualifying quantity");
}

// ===== D: qualityModifierFor — forward hook, 0 when inactive. =====
{
  assert(qualityModifierFor(null, 5) === 0, "D: no contract means 0 quality modifier");
  const premium = contractAt("premium-supplier", 1);
  assert(qualityModifierFor(premium, 1) === 0.15, `D2: an active premium contract exposes its own +0.15 quality modifier (got ${qualityModifierFor(premium, 1)})`);
  assert(qualityModifierFor(premium, 100) === 0, "D3: an expired contract's quality modifier is 0, not leaked");
}

// ===== E: signContract — validation, atomicity. =====
{
  const save = saveAt({});
  const unknown = signContract(save, "not-a-real-supplier");
  assert(!unknown.ok && unknown.reason === "unknownSupplier", "E: an unknown supplier id is rejected");
  const result = signContract(save, "local-market");
  assert(result.ok, "E2: signing with a real supplier succeeds");
  if (result.ok) {
    assert(result.save.business.supplierContract?.supplierId === "local-market", "E3: the signed contract's supplierId is recorded exactly");
    assert(result.save.credits === save.credits, "E4: signing is free — credits are completely untouched");
    assert(result.save.economyLedger.length === save.economyLedger.length, "E5: signing creates ZERO ledger entries");
    assert(result.contractEndDay === result.save.business.supplierContract!.contractEndDay, "E6: the reported contractEndDay matches the save's own value exactly");
  }
}
{
  // E-double: signing while one is already active is rejected, atomically.
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, supplierContract: contractAt("local-market", 1) } });
  const result = signContract(save, "wholesale-supplier");
  assert(!result.ok && result.reason === "contractAlreadyActive", "E7: signing a second contract while one is active is rejected");
  assert(save.business.supplierContract?.supplierId === "local-market", "E8: the original contract is untouched by the rejected attempt");
}
{
  // E-afterexpiry: signing IS allowed once the previous contract has expired.
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 20 }, supplierContract: contractAt("local-market", 1) } }); // ended day 11, now day 20
  const result = signContract(save, "wholesale-supplier");
  assert(result.ok, "E9: signing a new contract is allowed once the previous one has expired");
}

// ===== F: cancelContract — validation, fee, atomicity. =====
{
  const save = saveAt({ credits: 1000 });
  const none = cancelContract(save);
  assert(!none.ok && none.reason === "noActiveContract", "F: cancelling with no active contract is rejected");
}
{
  // Phase 14 stale-precondition fix: cancellationFee was recalibrated from prototype "coins" (300) to real USD cents (12,000 = $120) — see businessSupplierContract.ts's own doc. `credits` bumped to stay comfortably affordable; the test's own intent (a successful cancellation deducts exactly the fee) is unchanged.
  const save = saveAt({ credits: 20_000, business: { ...DEFAULT_BUSINESS_STATE, supplierContract: contractAt("wholesale-supplier", 1) } }); // fee 12,000
  const result = cancelContract(save);
  assert(result.ok, "F2: cancelling an active contract succeeds");
  if (result.ok) {
    assert(result.fee === 12_000, `F3: the reported fee matches the contract's own cancellationFee exactly (got ${result.fee})`);
    assert(result.save.credits === 8_000, `F4: credits are deducted by exactly the fee (20,000-12,000=8,000, got ${result.save.credits})`);
    assert(result.save.business.supplierContract === null, "F5: the contract is cleared after cancellation");
  }
}
{
  // F-poor: insufficient funds to pay the cancellation fee leaves everything untouched.
  const save = saveAt({ credits: 100, business: { ...DEFAULT_BUSINESS_STATE, supplierContract: contractAt("wholesale-supplier", 1) } }); // fee 12,000 > 100
  const result = cancelContract(save);
  assert(!result.ok && result.reason === "insufficientFunds", "F6: cancelling without enough credits for the fee is rejected");
  assert(save.credits === 100 && save.business.supplierContract !== null, "F7: a rejected cancellation leaves credits and the contract completely untouched");
}
{
  // F-free: a 0-fee contract (Local Market) cancels with no ledger entry (mirrors appendLedgerEntry's own 0-amount no-op).
  const save = saveAt({ credits: 500, business: { ...DEFAULT_BUSINESS_STATE, supplierContract: contractAt("local-market", 1) } }); // fee 0
  const result = cancelContract(save);
  assert(result.ok && result.fee === 0, "F8: a 0-fee contract cancels successfully with a reported fee of exactly 0");
  if (result.ok) {
    const withLedger = appendLedgerEntry(result.save, "supplier-contract-cancellation", -result.fee);
    assert(withLedger.economyLedger.length === save.economyLedger.length, "F9: a 0-fee cancellation creates ZERO ledger entries");
  }
}
{
  // F-ledger: a real fee DOES create exactly one ledger entry with the correct category/amount.
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, supplierContract: contractAt("wholesale-supplier", 1) } });
  const result = cancelContract(save);
  if (result.ok) {
    const withLedger = appendLedgerEntry(result.save, "supplier-contract-cancellation", -result.fee);
    const newEntries = withLedger.economyLedger.length - save.economyLedger.length;
    assert(newEntries === 1, `F10: a real cancellation fee creates EXACTLY one ledger entry (got ${newEntries})`);
    const entry = withLedger.economyLedger[withLedger.economyLedger.length - 1]!;
    assert(entry.category === "supplier-contract-cancellation" && entry.amount === -300, "F11: the ledger entry has the correct category and exact signed amount");
  }
}

// ===== G: purchaseIngredient integration — the discount actually applies at purchase time. =====
// Uses business day 7 deliberately — a "quiet" day with no Economy V3
// Phase 8 supplier event active, so this test isolates the CONTRACT
// discount alone (day 1 is now "Supplier Delay" by Phase 8's own
// deterministic schedule, which intentionally suspends a contract's
// discount that day — see supplier-events-qa.mts's own G/G2 checks for
// that interaction instead).
{
  const save = saveAt({
    credits: 10000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 }, supplierContract: contractAt("wholesale-supplier", 7) },
  });
  const baseCost = businessUnitCostFor("tomato");
  const result = purchaseIngredient(save, "tomato", 25); // meets wholesale's minimumOrder of 25
  assert(result.ok, "G0: precondition — the purchase succeeds");
  if (result.ok) {
    const expectedUnitCost = Math.max(0, Math.round(baseCost * 0.8));
    assert(result.unitCost === expectedUnitCost, `G: a qualifying purchase under an active contract pays the discounted unit cost (got ${result.unitCost}, expected ${expectedUnitCost})`);
  }
}
{
  const save = saveAt({
    credits: 10000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 7 }, supplierContract: contractAt("wholesale-supplier", 7) },
  });
  const baseCost = businessUnitCostFor("tomato");
  const result = purchaseIngredient(save, "tomato", 5); // below the 25-unit minimum
  assert(result.ok && result.unitCost === baseCost, `G2: a purchase below the minimum order pays the FULL base price, no discount (got ${result.ok ? result.unitCost : "n/a"}, expected ${baseCost})`);
}
{
  // G-none: with no contract at all, purchases are completely unaffected (regression against V3-2's own behavior).
  const save = saveAt({ credits: 10000 });
  const baseCost = businessUnitCostFor("tomato");
  const result = purchaseIngredient(save, "tomato", 25);
  assert(result.ok && result.unitCost === baseCost, "G3: with no contract, purchases are priced exactly as V3-2 always priced them");
}

// ===== H: endBusinessDay integration — a contract naturally expires with no fee and no ledger entry. =====
{
  const save = saveAt({
    credits: 2000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 10 }, supplierContract: contractAt("premium-supplier", 1) }, // 14-day contract, ends day 15
  });
  const result = endBusinessDay(save);
  assert(result.save.business.supplierContract !== null, "H: the contract is still present the day before it expires");
  assert(result.expiredSupplierId === null, "H2: expiredSupplierId is null while the contract is still running");
}
{
  const save = saveAt({
    credits: 2000,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 14 }, supplierContract: contractAt("premium-supplier", 1) }, // ends day 15; advancing to day 15 expires it
  });
  const before = save.economyLedger.length;
  const result = endBusinessDay(save);
  assert(result.save.business.calendar.businessDay === 15, "H3: the calendar still advances correctly alongside the expiry check");
  assert(result.save.business.supplierContract === null, "H4: the contract is cleared exactly when it expires");
  assert(result.expiredSupplierId === "premium-supplier", `H5: expiredSupplierId names exactly which supplier's contract ended (got ${result.expiredSupplierId})`);
  assert(result.save.credits === 2000, "H6: natural expiry never charges a fee — credits are completely untouched");
  assert(result.save.economyLedger.length === before, "H7: natural expiry creates ZERO ledger entries");
}

// ===== I: persistence — a signed contract survives a JSON save/load round-trip. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, supplierContract: contractAt("wholesale-supplier", 3) } });
  const roundTripped = JSON.parse(JSON.stringify(save)) as SaveData;
  assert(roundTripped.business.supplierContract?.supplierId === "wholesale-supplier", "I: a signed contract survives a JSON round-trip exactly");
  assert(roundTripped.business.supplierContract?.contractEndDay === save.business.supplierContract!.contractEndDay, "I2: contractEndDay survives exactly too");
}

// ===== J: migration — old saves (pre-V3-7) default supplierContract cleanly; forward-compatible with a later field. =====
{
  const v36Save = {
    version: 1,
    credits: 4000,
    business: {
      calendar: { businessDay: 8 },
      inventory: {},
      refrigerator: { refrigeratorId: "basic-refrigerator" },
      spoilage: { totalSpoiledQuantity: 0, totalSpoiledValue: 0 },
      menu: {},
      popularity: { score: 60 },
    },
  } as unknown as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...v36Save, business: { ...DEFAULT_SAVE.business, ...v36Save.business } } as SaveData;
  assert(migrated.business.popularity.score === 60, "J: a pre-V3-7 save's popularity survives exactly");
  assert(migrated.business.supplierContract === null, "J2: supplierContract defaults cleanly to null on a save that predates this phase");
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
      supplierContract: contractAt("premium-supplier", 5),
    },
  } as unknown as Partial<SaveData>;
  const defaultWithFuture: FutureBusinessState = { ...DEFAULT_SAVE.business, futureField: "default-value" };
  const migrated = { ...DEFAULT_SAVE, ...laterSave, business: { ...defaultWithFuture, ...laterSave.business } };
  assert(migrated.business.supplierContract?.supplierId === "premium-supplier", "J3: an existing field (supplierContract) survives when a LATER phase's field is also present");
  assert((migrated.business as FutureBusinessState).futureField === "default-value", "J4: a field from a LATER phase not yet in this save correctly falls back to its own default");
}

// ===== K: Campaign independence. =====
{
  const save = saveAt({
    credits: 5000,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" },
    selectedSupplierId: "premium-supplier",
  });
  const result = signContract(save, "wholesale-supplier");
  assert(result.ok, "K0: precondition");
  if (result.ok) {
    assert(result.save.selectedSupplierId === "premium-supplier", "K: Campaign's own selectedSupplierId is completely untouched by a Business Mode contract");
    assert(JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress), "K2: levelProgress is byte-identical before/after signing a contract");
  }
}
{
  const save = saveAt({
    credits: 20_000,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" },
    business: { ...DEFAULT_BUSINESS_STATE, supplierContract: contractAt("wholesale-supplier", 1) },
  });
  const result = cancelContract(save);
  assert(result.ok, "K3: precondition");
  if (result.ok) {
    assert(JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress), "K4: levelProgress is byte-identical before/after cancelling a contract");
  }
}

// ===== L: no negative cash ever. =====
{
  const save = saveAt({ credits: 0, business: { ...DEFAULT_BUSINESS_STATE, supplierContract: contractAt("local-market", 1) } }); // fee 0
  const result = cancelContract(save);
  assert(result.ok && result.save.credits === 0, "L: a 0-fee cancellation never makes credits negative, even starting from 0");
}

// ===== M: determinism — identical inputs produce identical results; no Math.random() CALL anywhere in the new files. =====
{
  const save = saveAt({ credits: 5000 });
  const r1 = signContract(save, "wholesale-supplier");
  const r2 = signContract(save, "wholesale-supplier");
  assert(r1.ok && r2.ok && r1.contractEndDay === r2.contractEndDay, "M: identical signContract inputs produce identical results");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(import.meta.dirname, "..", "src", "game", "business");
  const files = ["businessSupplierContract.ts", "BusinessSupplierManager.ts"];
  let foundRandomCall = false;
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    const hasMention = /Math\.random\(\)/.test(content);
    const isDocMention = /(Never|No|not)\s+`?Math\.random\(\)/i.test(content);
    if (hasMention && !isDocMention) foundRandomCall = true;
  }
  assert(!foundRandomCall, "M2: no Math.random() CALL exists anywhere in the new supplier contract files");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
