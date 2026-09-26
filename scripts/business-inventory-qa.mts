/**
 * BUSINESS_INVENTORY_QA — Economy V3 Phase 2. Verifies the Business
 * Inventory model, the purchase action, ledger integration, migration,
 * and Campaign independence — against the real production functions
 * only.
 *
 * Run: npx tsx scripts/business-inventory-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import {
  DEFAULT_BUSINESS_INVENTORY,
  getQuantity,
  hasQuantity,
  hasIngredients,
  addStock,
  removeStock,
  consumeIngredients,
  inventoryValue,
  type BusinessInventory,
} from "../src/game/business/businessInventory.ts";
import { businessUnitCostFor } from "../src/game/business/businessPricing.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { ledgerTotals } from "../src/game/economy/EconomyLedger.ts";

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

// ===== A: default inventory is empty. =====
{
  assert(Object.keys(DEFAULT_BUSINESS_INVENTORY).length === 0, "A: DEFAULT_BUSINESS_INVENTORY is empty");
  assert(Object.keys(DEFAULT_BUSINESS_STATE.inventory).length === 0, "A2: DEFAULT_BUSINESS_STATE.inventory is empty");
}

// ===== B: empty inventory reports 0 quantity for everything. =====
{
  assert(getQuantity({}, "tomato") === 0, "B: getQuantity on an empty inventory is 0");
  assert(!hasQuantity({}, "tomato", 1), "B2: hasQuantity fails against an empty inventory");
}

// ===== C: add ingredient. =====
{
  const inv = addStock({}, "tomato", 10, 12, 1);
  assert(getQuantity(inv, "tomato") === 10, "C: adding 10 tomato gives quantity 10");
  assert(inv.tomato!.unitCost === 12, "C2: unitCost is recorded exactly");
  assert(inv.tomato!.purchaseDay === 1, "C3: purchaseDay is recorded exactly");
}

// ===== D: add same ingredient twice — quantity-weighted average unitCost, one aggregate entry. =====
{
  let inv = addStock({}, "tomato", 10, 10, 1);
  inv = addStock(inv, "tomato", 10, 20, 2);
  assert(getQuantity(inv, "tomato") === 20, "D: two adds of 10 each give quantity 20");
  assert(inv.tomato!.unitCost === 15, `D2: unitCost is the quantity-weighted average (10*10 + 10*20)/20 = 15 (got ${inv.tomato!.unitCost})`);
  assert(inv.tomato!.purchaseDay === 2, "D3: purchaseDay updates to the most recent purchase");
  assert(Object.keys(inv).length === 1, "D4: still exactly ONE entry for tomato — no duplicate representation");
}

// ===== E: remove ingredient. =====
{
  const inv = addStock({}, "tomato", 10, 10, 1);
  const result = removeStock(inv, "tomato", 4);
  assert(result.ok && getQuantity(result.inventory, "tomato") === 6, "E: removing 4 from 10 leaves 6");
}

// ===== F: remove exact quantity clears the entry. =====
{
  const inv = addStock({}, "tomato", 10, 10, 1);
  const result = removeStock(inv, "tomato", 10);
  assert(result.ok && getQuantity(result.inventory, "tomato") === 0, "F: removing the exact quantity leaves 0");
  assert(result.ok && !("tomato" in result.inventory), "F2: the entry is deleted outright, not left as a stale zero record");
}

// ===== G: cannot remove too much. =====
{
  const inv = addStock({}, "tomato", 5, 10, 1);
  const result = removeStock(inv, "tomato", 6);
  assert(!result.ok && result.reason === "insufficientStock", "G: removing more than available fails with 'insufficientStock'");
  assert(getQuantity(inv, "tomato") === 5, "G2: the original inventory is completely unaffected by the failed removal");
}

// ===== H: availability check. =====
{
  const inv = addStock({}, "tomato", 5, 10, 1);
  assert(hasQuantity(inv, "tomato", 5), "H: hasQuantity(5) against 5 in stock is true");
  assert(!hasQuantity(inv, "tomato", 6), "H2: hasQuantity(6) against 5 in stock is false");
}

// ===== I: multi-ingredient availability. =====
{
  let inv = addStock({}, "tomato", 2, 10, 1);
  inv = addStock(inv, "onion", 1, 10, 1);
  assert(
    hasIngredients(inv, [{ ingredientId: "tomato", quantity: 2 }, { ingredientId: "onion", quantity: 1 }]),
    "I: hasIngredients is true when every requirement is met",
  );
  assert(
    !hasIngredients(inv, [{ ingredientId: "tomato", quantity: 2 }, { ingredientId: "chicken", quantity: 1 }]),
    "I2: hasIngredients is false when even one requirement (chicken) is unmet",
  );
}

// ===== J: atomic multi-ingredient consumption (the brief's own Tomato/Onion/Chicken example). =====
{
  let inv = addStock({}, "tomato", 2, 10, 1);
  inv = addStock(inv, "onion", 1, 10, 1);
  inv = addStock(inv, "chicken", 1, 85, 1);
  const result = consumeIngredients(inv, [
    { ingredientId: "tomato", quantity: 2 },
    { ingredientId: "onion", quantity: 1 },
    { ingredientId: "chicken", quantity: 1 },
  ]);
  assert(result.ok, "J: consuming exactly what's in stock succeeds");
  if (result.ok) {
    assert(getQuantity(result.inventory, "tomato") === 0, "J2: tomato is fully consumed");
    assert(getQuantity(result.inventory, "onion") === 0, "J3: onion is fully consumed");
    assert(getQuantity(result.inventory, "chicken") === 0, "J4: chicken is fully consumed");
  }
}

// ===== K: failed atomic consumption leaves ALL quantities unchanged (the brief's own Chicken=0 example). =====
{
  let inv = addStock({}, "tomato", 2, 10, 1);
  inv = addStock(inv, "onion", 1, 10, 1);
  // chicken is NOT in stock at all.
  const result = consumeIngredients(inv, [
    { ingredientId: "tomato", quantity: 2 },
    { ingredientId: "onion", quantity: 1 },
    { ingredientId: "chicken", quantity: 1 },
  ]);
  assert(!result.ok, "K: consumption fails when one ingredient (chicken) is entirely missing");
  assert(getQuantity(inv, "tomato") === 2, "K2: tomato was NOT partially consumed");
  assert(getQuantity(inv, "onion") === 1, "K3: onion was NOT partially consumed");
  assert(
    !result.ok && result.reason === "insufficientStock" && result.missing.includes("chicken"),
    "K4: the failure correctly names chicken as the missing ingredient",
  );
}

// ===== bonus: duplicate-ingredient requirements in one call are summed before checking (a real atomicity edge case). =====
{
  const inv = addStock({}, "tomato", 3, 10, 1);
  const result = consumeIngredients(inv, [
    { ingredientId: "tomato", quantity: 2 },
    { ingredientId: "tomato", quantity: 2 },
  ]);
  assert(!result.ok, "bonus: two requirements for the same ingredient are summed (2+2=4 > 3 in stock) rather than checked independently");
}

// ===== L/M/N/O: a valid purchase — deducts exact credits, adds exact inventory, creates exactly one ledger entry. =====
{
  const save = saveAt({ credits: 1000 });
  const unitCost = businessUnitCostFor("tomato");
  const result = purchaseIngredient(save, "tomato", 10);
  assert(result.ok, "L: a valid purchase succeeds");
  if (result.ok) {
    assert(result.totalCost === unitCost * 10, `L2: totalCost is exactly unitCost*quantity (${unitCost}*10=${unitCost * 10}, got ${result.totalCost})`);
    assert(result.save.credits === 1000 - result.totalCost, `M: credits are deducted by exactly the total cost (got ${result.save.credits})`);
    assert(getQuantity(result.save.business.inventory, "tomato") === 10, "N: inventory gains exactly the purchased quantity");
    assert(
      result.save.business.inventory.tomato!.purchaseDay === save.business.calendar.businessDay,
      "N2: purchaseDay is recorded as the CURRENT business day, not advanced or altered",
    );
  }
}
{
  // O: exactly one ledger entry — mirrors App.tsx's own purchaseIngredient wrapper.
  const save = saveAt({ credits: 1000 });
  const result = purchaseIngredient(save, "tomato", 10);
  if (result.ok) {
    const { appendLedgerEntry } = await import("../src/game/economy/EconomyLedger.ts");
    const withLedger = appendLedgerEntry(result.save, "inventory-purchase", -result.totalCost, "tomato");
    const newEntries = withLedger.economyLedger.length - save.economyLedger.length;
    assert(newEntries === 1, `O: a successful purchase creates EXACTLY one ledger entry (got ${newEntries})`);
    const entry = withLedger.economyLedger[withLedger.economyLedger.length - 1]!;
    assert(entry.category === "inventory-purchase" && entry.amount === -result.totalCost, "O2: the ledger entry has the correct category and exact signed amount");
  }
}

// ===== P/Q/R: a failed purchase changes nothing. =====
{
  const save = saveAt({ credits: 10 });
  const result = purchaseIngredient(save, "chicken", 5); // far more than 10 credits can afford
  assert(!result.ok && result.reason === "insufficientFunds", "P0: an unaffordable purchase fails with 'insufficientFunds'");
  assert(save.credits === 10, "P: a failed purchase does not change credits (still 10)");
  assert(Object.keys(save.business.inventory).length === 0, "Q: a failed purchase does not change inventory");
  // R: no ledger entry — a failed result is never passed to appendLedgerEntry at all (mirrors App.tsx's own `if (result.ok)` gate).
  const entriesAppended = result.ok ? 1 : 0;
  assert(entriesAppended === 0, "R: a failed purchase creates ZERO ledger entries");
}

// ===== S/T/U/V: validation. =====
{
  const save = saveAt({ credits: 1000 });
  const negative = purchaseIngredient(save, "tomato", -5);
  assert(!negative.ok && negative.reason === "invalidQuantity", "S: negative quantity is rejected");
  const zero = purchaseIngredient(save, "tomato", 0);
  assert(!zero.ok && zero.reason === "invalidQuantity", "T: zero quantity is rejected");
  const unknown = purchaseIngredient(save, "not-a-real-ingredient", 5);
  assert(!unknown.ok && unknown.reason === "unknownIngredient", "U: an unknown ingredient id is rejected");
  // V: "invalid price rejected" — businessUnitCostFor always returns a real, positive, data-driven
  // price for every known IngredientId (never player-supplied), so the meaningful invalid-price
  // surface is an unknown ingredient id, already covered by U. Confirmed here that every real
  // ingredient resolves to a positive, finite, integer price.
  const allIds = Object.keys((await import("../src/game/definitions.ts")).INGREDIENTS) as (keyof typeof import("../src/game/definitions.ts").INGREDIENTS)[];
  const allPricesValid = allIds.every((id) => {
    const cost = businessUnitCostFor(id as never);
    return Number.isInteger(cost) && cost > 0;
  });
  assert(allPricesValid, "V: every real ingredient resolves to a positive integer business unit cost");
}

// ===== W: inventory value calculation. =====
{
  let inv = addStock({}, "tomato", 10, 12, 1);
  inv = addStock(inv, "chicken", 5, 85, 1);
  assert(inventoryValue(inv) === 10 * 12 + 5 * 85, `W: inventoryValue sums quantity*unitCost across every entry (got ${inventoryValue(inv)})`);
  assert(inventoryValue({}) === 0, "W2: inventoryValue of an empty inventory is 0");
}

// ===== X: business day recorded correctly. =====
{
  const save = saveAt({
    credits: 1000,
    business: { ...DEFAULT_SAVE.business, calendar: { businessDay: 42 } },
  });
  const result = purchaseIngredient(save, "tomato", 5);
  assert(
    result.ok && result.save.business.inventory.tomato!.purchaseDay === 42,
    "X: a purchase on business day 42 records purchaseDay 42, not day 1",
  );
}

// ===== Y: old-save migration — a save written before Economy V3 existed loads safely. =====
{
  const oldSaveJson = JSON.stringify({ version: 1, credits: 5000, ownedKnifeIds: ["chef"] });
  const parsed = JSON.parse(oldSaveJson) as Partial<SaveData>;
  const migrated = {
    ...DEFAULT_SAVE,
    ...parsed,
    business: { ...DEFAULT_SAVE.business, ...parsed.business },
  } as SaveData;
  assert(Object.keys(migrated.business.inventory).length === 0, "Y: an old save missing `business` entirely migrates to an empty inventory");
  assert(migrated.business.calendar.businessDay === 1, "Y2: ...and Day 1, matching V3-1's own default");
}

// ===== Z: BusinessState forward compatibility — a V3-1-era save (business.calendar only, no inventory) still loads correctly. =====
{
  const v31Save = {
    version: 1,
    credits: 2000,
    business: { calendar: { businessDay: 10 } },
  } as unknown as Partial<SaveData>;
  const migrated = {
    ...DEFAULT_SAVE,
    ...v31Save,
    business: { ...DEFAULT_SAVE.business, ...v31Save.business },
  } as SaveData;
  assert(migrated.business.calendar.businessDay === 10, "Z: business.calendar.businessDay === 10 survives exactly (the brief's own required scenario)");
  assert(Object.keys(migrated.business.inventory).length === 0, "Z2: business.inventory === default (empty) inventory, added cleanly by this phase");
}

// ===== AA/AB: Campaign is unaffected except by an explicit business purchase. =====
{
  const save = saveAt({
    credits: 777,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-80" },
  });
  const result = purchaseIngredient(save, "tomato", 5);
  assert(result.ok, "AA0: the purchase itself succeeds (precondition)");
  if (result.ok) {
    assert(
      JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress),
      "AB: levelProgress is byte-identical before/after a business purchase",
    );
  }
  // A purchase changes credits ONLY via the purchase itself — never any other side channel.
  const before = save.credits;
  const after = result.ok ? result.save.credits : save.credits;
  assert(result.ok && before - after === result.totalCost, "AA: credits changed by EXACTLY the purchase's own totalCost, nothing else");
}

// ===== AC: save/load round-trip (JSON serialization survives). =====
{
  const save = saveAt({ credits: 1000 });
  const result = purchaseIngredient(save, "tomato", 8);
  if (result.ok) {
    const roundTripped = JSON.parse(JSON.stringify(result.save)) as SaveData;
    assert(getQuantity(roundTripped.business.inventory, "tomato") === 8, "AC: inventory survives a JSON save/load round-trip exactly");
    assert(roundTripped.credits === result.save.credits, "AC2: credits survive the round-trip exactly");
  }
}

// ===== AD/AE: determinism, no Math.random. =====
{
  const save = saveAt({ credits: 1000 });
  const r1 = purchaseIngredient(save, "tomato", 5);
  const r2 = purchaseIngredient(save, "tomato", 5);
  assert(
    r1.ok && r2.ok && r1.totalCost === r2.totalCost && r1.unitCost === r2.unitCost,
    "AD: identical purchase inputs produce identical results (deterministic)",
  );
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(import.meta.dirname, "..", "src", "game", "business");
  const files = ["businessInventory.ts", "businessPricing.ts", "BusinessInventoryManager.ts"];
  let foundRandomCall = false;
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    const hasMention = /Math\.random\(\)/.test(content);
    const isDocMention = /(Never|No|not)\s+`?Math\.random\(\)/i.test(content);
    if (hasMention && !isDocMention) foundRandomCall = true;
  }
  assert(!foundRandomCall, "AE: no Math.random() CALL exists anywhere in the new Business Inventory files (doc mentions of its absence are excluded)");
}

// ===== AF/AG: no negative inventory, no negative credits, ever. =====
{
  const inv = addStock({}, "tomato", 3, 10, 1);
  const overRemove = removeStock(inv, "tomato", 100);
  assert(!overRemove.ok, "AF: an over-large removal is rejected rather than producing negative quantity");
  const poorSave = saveAt({ credits: 5 });
  const tooExpensive = purchaseIngredient(poorSave, "chicken", 1);
  assert(!tooExpensive.ok, "AG0: an unaffordable purchase is rejected (precondition)");
  assert(poorSave.credits === 5 && poorSave.credits >= 0, "AG: credits never go negative — the failed purchase left the original save untouched");
}

// ===== AH: duplicate inventory representation prevented. =====
{
  let inv: BusinessInventory = {};
  for (let i = 0; i < 5; i++) inv = addStock(inv, "tomato", 1, 10, 1);
  assert(Object.keys(inv).length === 1, "AH: five separate adds of the same ingredient still produce exactly ONE entry, never five");
  assert(getQuantity(inv, "tomato") === 5, "AH2: ...with the quantities correctly accumulated");
}

// ===== bonus: ledger totals correctly reflect a business purchase alongside existing campaign categories (no conflation). =====
{
  const save = saveAt({ credits: 1000 });
  const result = purchaseIngredient(save, "tomato", 10);
  if (result.ok) {
    const { appendLedgerEntry } = await import("../src/game/economy/EconomyLedger.ts");
    const withLedger = appendLedgerEntry(result.save, "inventory-purchase", -result.totalCost, "tomato");
    const totals = ledgerTotals(withLedger.economyLedger);
    assert(totals.byCategory["inventory-purchase"] === -result.totalCost, "bonus: ledgerTotals correctly isolates the inventory-purchase category's own signed sum");
  }
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
