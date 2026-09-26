/**
 * REFRIGERATOR_STORAGE_QA — Economy V3 Phase 3. Verifies the refrigerator
 * catalog, capacity math, storage-integrated purchase flow, ledger
 * integration, migration, and Campaign independence — against the real
 * production functions only.
 *
 * Economy V3 Phase 14 stale-precondition fix: refrigerator prices were
 * recalibrated from prototype "coins" (4000/10000) to real-world USD
 * cents (200,000/480,000 — see refrigeratorDefinitions.ts's own doc).
 * Several test setups used a `credits` value that was comfortably
 * affordable under the OLD prices but is no longer enough under the new
 * ones — this is exactly the "a previously-passing precondition goes
 * stale when a later phase correctly recalibrates a real number" case;
 * each affected test's own `credits` and expected `price`/deduction
 * values are updated below to the new real numbers, preserving the
 * test's original intent (a purchase that was always meant to succeed
 * still succeeds; one meant to fail on insufficient funds still fails).
 *
 * Run: npx tsx scripts/refrigerator-storage-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import {
  REFRIGERATOR_CATALOG,
  DEFAULT_REFRIGERATOR_ID,
  getRefrigerator,
} from "../src/game/business/refrigeratorDefinitions.ts";
import {
  getInventoryUsedCapacity,
  getAvailableStorageCapacity,
  canStoreQuantity,
  purchaseRefrigerator,
} from "../src/game/business/RefrigeratorManager.ts";
import { addStock, type BusinessInventory } from "../src/game/business/businessInventory.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { appendLedgerEntry, ledgerTotals } from "../src/game/economy/EconomyLedger.ts";

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

// ===== A/B: default refrigerator exists, default capacity is correct. =====
{
  assert(DEFAULT_BUSINESS_STATE.refrigerator.refrigeratorId === DEFAULT_REFRIGERATOR_ID, "A: DEFAULT_BUSINESS_STATE starts with the default refrigerator id");
  assert(DEFAULT_SAVE.business.refrigerator.refrigeratorId === "basic-refrigerator", "A2: DEFAULT_SAVE's own refrigerator is 'basic-refrigerator'");
  const def = getRefrigerator(DEFAULT_REFRIGERATOR_ID);
  assert(!!def && def.capacity === 40, `B: the default (Basic) refrigerator's capacity is 40 (got ${def?.capacity})`);
  assert(!!def && def.price === 0, "B2: the default (Basic) refrigerator is free — never charged automatically");
}

// ===== C/D: refrigerator definition lookup, unknown refrigerator rejected. =====
{
  assert(REFRIGERATOR_CATALOG.length === 3, `C: exactly 3 refrigerator tiers exist (got ${REFRIGERATOR_CATALOG.length})`);
  assert(getRefrigerator("commercial-refrigerator")?.capacity === 80, "C2: Commercial Refrigerator capacity is 80");
  assert(getRefrigerator("professional-refrigerator")?.capacity === 140, "C3: Professional Refrigerator capacity is 140");
  assert(getRefrigerator("not-a-real-fridge") === undefined, "D: an unknown refrigerator id resolves to undefined");
  const result = purchaseRefrigerator(saveAt({ credits: 100000 }), "not-a-real-fridge");
  assert(!result.ok && result.reason === "unknownRefrigerator", "D2: purchasing an unknown refrigerator id is rejected");
}

// ===== E/F/G: capacity calculation. =====
{
  let inv: BusinessInventory = {};
  inv = addStock(inv, "tomato", 10, 10, 1);
  inv = addStock(inv, "chicken", 5, 85, 1);
  assert(getInventoryUsedCapacity(inv) === 15, `E: getInventoryUsedCapacity sums every entry's quantity (got ${getInventoryUsedCapacity(inv)})`);
  assert(getInventoryUsedCapacity({}) === 0, "F: an empty inventory uses 0 capacity");
  assert(getAvailableStorageCapacity(inv, "basic-refrigerator") === 40 - 15, `G: getAvailableStorageCapacity is capacity - used (40-15=25, got ${getAvailableStorageCapacity(inv, "basic-refrigerator")})`);
}

// ===== H/I/J: empty / partial / full capacity. =====
{
  assert(getAvailableStorageCapacity({}, "basic-refrigerator") === 40, "H: an empty refrigerator has its full capacity available");
  let inv: BusinessInventory = addStock({}, "tomato", 20, 10, 1);
  assert(getAvailableStorageCapacity(inv, "basic-refrigerator") === 20, "I: partial capacity (20/40 used) reports 20 available");
  inv = addStock(inv, "onion", 20, 10, 1);
  assert(getAvailableStorageCapacity(inv, "basic-refrigerator") === 0, "J: exactly-full capacity (40/40 used) reports 0 available");
}

// ===== K/L: purchase fits exactly / exceeds capacity. =====
{
  const save = saveAt({ credits: 100000 });
  const exact = purchaseIngredient(save, "tomato", 40); // fills the entire 40-capacity Basic fridge exactly
  assert(exact.ok, "K: a purchase that fits exactly (40 into a 40-capacity fridge) succeeds");
  const over = purchaseIngredient(save, "tomato", 41);
  assert(!over.ok && over.reason === "insufficientStorage", "L: a purchase that exceeds capacity (41 into 40) is rejected with 'insufficientStorage'");
}

// ===== M/N/O: failed over-capacity purchase changes nothing. =====
{
  const save = saveAt({ credits: 100000 });
  const result = purchaseIngredient(save, "tomato", 41);
  assert(!result.ok, "M0: the over-capacity purchase fails (precondition)");
  assert(save.credits === 100000, "M: credits are unchanged after a failed over-capacity purchase");
  assert(Object.keys(save.business.inventory).length === 0, "N: inventory is unchanged after a failed over-capacity purchase");
  const entriesAppended = result.ok ? 1 : 0;
  assert(entriesAppended === 0, "O: no ledger entry is created for a failed over-capacity purchase");
}

// ===== P/Q/R: refrigerator purchase succeeds, deducts exact cost, creates exactly one ledger entry. =====
{
  const save = saveAt({ credits: 1_000_000 });
  const result = purchaseRefrigerator(save, "commercial-refrigerator");
  assert(result.ok, "P: a valid refrigerator purchase succeeds");
  if (result.ok) {
    assert(result.price === 200_000, `Q0: the reported price matches the catalog (200,000c = $2,000, got ${result.price})`);
    assert(result.save.credits === 1_000_000 - 200_000, `Q: credits are deducted by exactly the refrigerator's price (got ${result.save.credits})`);
    assert(result.save.business.refrigerator.refrigeratorId === "commercial-refrigerator", "Q2: business.refrigerator updates to the new refrigerator id");
    const withLedger = appendLedgerEntry(result.save, "refrigerator-purchase", -result.price, "commercial-refrigerator");
    const newEntries = withLedger.economyLedger.length - save.economyLedger.length;
    assert(newEntries === 1, `R: a successful refrigerator purchase creates EXACTLY one ledger entry (got ${newEntries})`);
  }
}

// ===== S: failed refrigerator purchase leaves state unchanged. =====
{
  const save = saveAt({ credits: 100 });
  const result = purchaseRefrigerator(save, "professional-refrigerator");
  assert(!result.ok && result.reason === "insufficientFunds", "S0: an unaffordable refrigerator purchase fails (precondition)");
  assert(save.credits === 100, "S: credits are unchanged after a failed refrigerator purchase");
  assert(save.business.refrigerator.refrigeratorId === "basic-refrigerator", "S2: business.refrigerator is unchanged after a failed purchase");
}

// ===== T/U: upgrade preserves inventory, increases available capacity. =====
{
  let save = saveAt({ credits: 1_000_000 });
  save = { ...save, business: { ...save.business, inventory: addStock(save.business.inventory, "tomato", 30, 10, 1) } };
  const before = getAvailableStorageCapacity(save.business.inventory, save.business.refrigerator.refrigeratorId);
  const result = purchaseRefrigerator(save, "commercial-refrigerator");
  assert(result.ok, "T0: the upgrade succeeds (precondition — 80 capacity comfortably fits 30 used)");
  if (result.ok) {
    assert(
      JSON.stringify(result.save.business.inventory) === JSON.stringify(save.business.inventory),
      "T: the upgrade leaves inventory byte-identical — nothing is deleted",
    );
    const after = getAvailableStorageCapacity(result.save.business.inventory, result.save.business.refrigerator.refrigeratorId);
    assert(after > before, `U: available capacity increases after the upgrade (before=${before}, after=${after})`);
  }
}

// ===== V: invalid downgrade rejected. =====
{
  let save = saveAt({ credits: 10000, business: { ...DEFAULT_SAVE.business, refrigerator: { refrigeratorId: "commercial-refrigerator" } } });
  save = { ...save, business: { ...save.business, inventory: addStock(save.business.inventory, "tomato", 60, 10, 1) } }; // 60 used, fits in Commercial (80) but not Basic (40)
  const downgrade = purchaseRefrigerator(save, "basic-refrigerator");
  assert(!downgrade.ok && downgrade.reason === "invalidDowngrade", "V: downgrading to a refrigerator too small for current stock is rejected");
  assert(save.business.refrigerator.refrigeratorId === "commercial-refrigerator", "V2: the refrigerator is unchanged after the rejected downgrade");
}

// ===== W: cannot create negative available capacity. =====
{
  // Simulates a corrupted/edge-case save where inventory exceeds the current refrigerator's capacity.
  let inv: BusinessInventory = addStock({}, "tomato", 100, 10, 1); // 100 > Basic's 40
  assert(getAvailableStorageCapacity(inv, "basic-refrigerator") === 0, "W: available capacity floors at 0, never negative, even when inventory exceeds capacity");
  assert(getInventoryUsedCapacity(inv) === 100, "W2: the inventory itself is NOT altered just because it exceeds capacity — used capacity still reports the true 100");
}

// ===== X: old V3-1 save migration (calendar only). =====
{
  const v31Save = { version: 1, credits: 2000, business: { calendar: { businessDay: 10 } } } as unknown as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...v31Save, business: { ...DEFAULT_SAVE.business, ...v31Save.business } } as SaveData;
  assert(migrated.business.calendar.businessDay === 10, "X: a V3-1-era save's calendar.businessDay survives exactly");
  assert(migrated.business.refrigerator.refrigeratorId === "basic-refrigerator", "X2: refrigerator defaults cleanly to Basic on a save that predates this phase");
  assert(Object.keys(migrated.business.inventory).length === 0, "X3: inventory defaults cleanly too");
}

// ===== Y: V3-2 save migration (calendar + inventory, no refrigerator). =====
{
  const v32Save = {
    version: 1,
    credits: 3000,
    business: { calendar: { businessDay: 5 }, inventory: { tomato: { ingredientId: "tomato", quantity: 12, unitCost: 20, purchaseDay: 5 } } },
  } as unknown as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...v32Save, business: { ...DEFAULT_SAVE.business, ...v32Save.business } } as SaveData;
  assert(migrated.business.calendar.businessDay === 5, "Y: a V3-2-era save's calendar survives exactly");
  assert(migrated.business.inventory.tomato?.quantity === 12, "Y2: ...and its inventory survives exactly");
  assert(migrated.business.refrigerator.refrigeratorId === "basic-refrigerator", "Y3: refrigerator defaults cleanly to Basic on a save that predates this phase");
}

// ===== Z: V3-3 save round-trip (JSON serialization survives). =====
{
  const save = saveAt({ credits: 10000 });
  const result = purchaseRefrigerator(save, "commercial-refrigerator");
  if (result.ok) {
    const roundTripped = JSON.parse(JSON.stringify(result.save)) as SaveData;
    assert(roundTripped.business.refrigerator.refrigeratorId === "commercial-refrigerator", "Z: refrigerator survives a JSON save/load round-trip exactly");
  }
}

// ===== AA: forward-compatible BusinessState migration (a hypothetical later field). =====
{
  type FutureBusinessState = SaveData["business"] & { futureField?: string };
  const laterSave = { version: 1, credits: 1000, business: { calendar: { businessDay: 7 }, inventory: {}, refrigerator: { refrigeratorId: "commercial-refrigerator" } } } as unknown as Partial<SaveData>;
  const defaultWithFuture: FutureBusinessState = { ...DEFAULT_SAVE.business, futureField: "default-value" };
  const migrated = { ...DEFAULT_SAVE, ...laterSave, business: { ...defaultWithFuture, ...laterSave.business } };
  assert(migrated.business.refrigerator.refrigeratorId === "commercial-refrigerator", "AA: an existing field (refrigerator) survives when a LATER phase's field is also present");
  assert((migrated.business as FutureBusinessState).futureField === "default-value", "AA2: a field from a LATER phase not yet in this save correctly falls back to its own default");
}

// ===== AB/AC: Campaign independence. =====
{
  const save = saveAt({ credits: 1_000_000, levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" } });
  const result = purchaseRefrigerator(save, "commercial-refrigerator");
  assert(result.ok, "AC0: the refrigerator purchase succeeds (precondition)");
  if (result.ok) {
    assert(JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress), "AB: levelProgress is byte-identical before/after a refrigerator purchase");
    assert(save.credits - result.save.credits === result.price, "AC: credits changed by EXACTLY the refrigerator's own price, nothing else");
  }
}

// ===== AD/AE: determinism, no Math.random. =====
{
  const save = saveAt({ credits: 1_000_000 });
  const r1 = purchaseRefrigerator(save, "commercial-refrigerator");
  const r2 = purchaseRefrigerator(save, "commercial-refrigerator");
  assert(r1.ok && r2.ok && r1.price === r2.price, "AD: identical refrigerator purchase inputs produce identical results");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(import.meta.dirname, "..", "src", "game", "business");
  const files = ["refrigeratorTypes.ts", "refrigeratorDefinitions.ts", "RefrigeratorManager.ts"];
  let foundRandomCall = false;
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    const hasMention = /Math\.random\(\)/.test(content);
    const isDocMention = /(Never|No|not)\s+`?Math\.random\(\)/i.test(content);
    if (hasMention && !isDocMention) foundRandomCall = true;
  }
  assert(!foundRandomCall, "AE: no Math.random() CALL exists anywhere in the new refrigerator files");
}

// ===== AF/AG: no negative inventory, no negative credits. =====
{
  const save = saveAt({ credits: 100000 });
  const over = purchaseIngredient(save, "tomato", 41);
  assert(!over.ok, "AF0: the over-capacity purchase is rejected (precondition)");
  assert(getInventoryUsedCapacity(save.business.inventory) >= 0, "AF: used capacity is never negative");
  const poor = purchaseRefrigerator(saveAt({ credits: 0 }), "commercial-refrigerator");
  assert(!poor.ok && poor.reason === "insufficientFunds", "AG0: an unaffordable refrigerator purchase is rejected (precondition)");
  assert(!poor.ok, "AG: credits never go negative — a failed refrigerator purchase never touches the save");
}

// ===== AH: no inventory deletion during upgrade (repeat, explicit). =====
{
  let save = saveAt({ credits: 1_000_000 });
  save = { ...save, business: { ...save.business, inventory: addStock(save.business.inventory, "chicken", 20, 85, 1) } };
  const upgraded = purchaseRefrigerator(save, "professional-refrigerator");
  assert(upgraded.ok && upgraded.save.business.inventory.chicken?.quantity === 20, "AH: chicken stock (20 units) survives a refrigerator upgrade unchanged");
}

// ===== AI: ledger reconciliation across an inventory purchase + a refrigerator purchase. =====
{
  const startingCredits = 20000;
  let save = saveAt({ credits: startingCredits });
  const invResult = purchaseIngredient(save, "tomato", 10);
  if (invResult.ok) {
    save = appendLedgerEntry(invResult.save, "inventory-purchase", -invResult.totalCost, "tomato");
  }
  const fridgeResult = purchaseRefrigerator(save, "commercial-refrigerator");
  if (fridgeResult.ok) {
    save = appendLedgerEntry(fridgeResult.save, "refrigerator-purchase", -fridgeResult.price, "commercial-refrigerator");
  }
  const totals = ledgerTotals(save.economyLedger);
  const expectedEnding = startingCredits + totals.netCashFlow;
  assert(save.credits === expectedEnding, `AI: startingCredits(${startingCredits}) + netCashFlow(${totals.netCashFlow}) === endingCredits(${save.credits}) across an inventory purchase + a refrigerator purchase (expected ${expectedEnding})`);
}

// ===== AJ: multiple purchases correctly consume capacity. =====
{
  const save = saveAt({ credits: 100000 });
  let current = save;
  const r1 = purchaseIngredient(current, "tomato", 15);
  assert(r1.ok, "AJ0: first purchase (15) succeeds");
  if (r1.ok) current = r1.save;
  const r2 = purchaseIngredient(current, "onion", 15);
  assert(r2.ok, "AJ1: second purchase (15, total 30/40) succeeds");
  if (r2.ok) current = r2.save;
  const r3 = purchaseIngredient(current, "chicken", 15); // would bring total to 45 > 40
  assert(!r3.ok && r3.reason === "insufficientStorage", "AJ: a third purchase that would push total usage past capacity (30+15=45 > 40) is correctly rejected");
  assert(getInventoryUsedCapacity(current.business.inventory) === 30, "AJ2: used capacity correctly reflects only the two successful purchases (30)");
}

// ===== AK: exact capacity boundary. =====
{
  const save = saveAt({ credits: 100000 });
  const r1 = purchaseIngredient(save, "tomato", 40);
  assert(r1.ok, "AK: purchasing exactly the full capacity (40) succeeds");
  if (r1.ok) {
    assert(getAvailableStorageCapacity(r1.save.business.inventory, r1.save.business.refrigerator.refrigeratorId) === 0, "AK2: available capacity is exactly 0 after filling to the boundary");
    const r2 = purchaseIngredient(r1.save, "onion", 1);
    assert(!r2.ok && r2.reason === "insufficientStorage", "AK3: even a single additional unit is rejected once the boundary is reached");
  }
}

// ===== AL/AM/AN: funds vs capacity combinations. =====
{
  // AL: insufficient funds + sufficient capacity -> insufficientFunds.
  const poorButRoomy = saveAt({ credits: 10 });
  const al = purchaseIngredient(poorButRoomy, "chicken", 1);
  assert(!al.ok && al.reason === "insufficientFunds", "AL: insufficient funds + sufficient capacity correctly fails with 'insufficientFunds'");

  // AM: sufficient funds + insufficient capacity -> insufficientStorage.
  let richButFull = saveAt({ credits: 100000 });
  richButFull = { ...richButFull, business: { ...richButFull.business, inventory: addStock(richButFull.business.inventory, "tomato", 40, 10, 1) } };
  const am = purchaseIngredient(richButFull, "onion", 1);
  assert(!am.ok && am.reason === "insufficientStorage", "AM: sufficient funds + insufficient capacity correctly fails with 'insufficientStorage'");

  // AN: both insufficient -> funds is checked first (documented, deterministic precedence).
  let poorAndFull = saveAt({ credits: 5 });
  poorAndFull = { ...poorAndFull, business: { ...poorAndFull.business, inventory: addStock(poorAndFull.business.inventory, "tomato", 40, 10, 1) } };
  const an = purchaseIngredient(poorAndFull, "chicken", 5);
  assert(!an.ok && an.reason === "insufficientFunds", "AN: both insufficient funds AND insufficient capacity — funds is checked first, deterministically");
}

// ===== AO: corrupted over-capacity save handled safely. =====
{
  // Simulates a save where inventory (via some hypothetical prior state) already exceeds the current refrigerator's capacity.
  let corrupted = saveAt({ credits: 10000 });
  corrupted = { ...corrupted, business: { ...corrupted.business, inventory: addStock(corrupted.business.inventory, "tomato", 100, 10, 1) } };
  assert(getInventoryUsedCapacity(corrupted.business.inventory) === 100, "AO0: the corrupted save genuinely has 100 units stored (over the 40 capacity)");
  assert(getAvailableStorageCapacity(corrupted.business.inventory, corrupted.business.refrigerator.refrigeratorId) === 0, "AO: available capacity is safely 0, never negative");
  const attemptedPurchase = purchaseIngredient(corrupted, "onion", 1);
  assert(!attemptedPurchase.ok && attemptedPurchase.reason === "insufficientStorage", "AO2: further purchases are blocked until the storage issue is resolved");
  assert(getInventoryUsedCapacity(corrupted.business.inventory) === 100, "AO3: the existing (over-capacity) stock is NOT deleted or altered — it's preserved exactly as-is");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
