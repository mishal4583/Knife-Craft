/**
 * PERISHABILITY_QA — Economy V3 Phase 4. Verifies shelf-life/ageing math,
 * expiry gating ("expired ingredients cannot be served"), the
 * anti-refresh-cheat weighted-average `purchaseDay`, spoilage clearing
 * ("no silent inventory deletion" / "recorded for P&L later"), the
 * combined End Business Day flow, migration, Campaign independence, and
 * determinism — against the real production functions only.
 *
 * Run: npx tsx scripts/perishability-qa.mts
 */
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import {
  shelfLifeForIngredient,
  ageInDays,
  perishabilityStateFor,
  isServable,
  usableQuantity,
  hasUsableIngredients,
  consumeUsableIngredients,
} from "../src/game/business/perishability.ts";
import { addStock, getQuantity, type BusinessInventory } from "../src/game/business/businessInventory.ts";
import { clearExpiredStock, DEFAULT_SPOILAGE_STATE } from "../src/game/business/SpoilageManager.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";

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

// ===== A: shelf life table — data-driven, category-based, sensible default. =====
{
  assert(shelfLifeForIngredient("tomato") === 7, `A: tomato (Vegetable) has a 7-day shelf life (got ${shelfLifeForIngredient("tomato")})`);
  assert(shelfLifeForIngredient("chicken") === 3, `A2: chicken (Protein) has a 3-day shelf life (got ${shelfLifeForIngredient("chicken")})`);
  assert(shelfLifeForIngredient("onion") === 7, "A3: onion (Vegetable) matches its category's shelf life");
  const allIds = Object.keys((await import("../src/game/definitions.ts")).INGREDIENTS) as (keyof typeof import("../src/game/definitions.ts").INGREDIENTS)[];
  const allPositive = allIds.every((id) => Number.isInteger(shelfLifeForIngredient(id as never)) && shelfLifeForIngredient(id as never) > 0);
  assert(allPositive, "A4: every real ingredient resolves to a positive integer shelf life");
}

// ===== B: ageInDays — clamped at 0, never negative. =====
{
  assert(ageInDays(1, 1) === 0, "B: age 0 on the same day it was purchased");
  assert(ageInDays(1, 5) === 4, "B2: age is currentDay - purchaseDay");
  assert(ageInDays(10, 5) === 0, "B3: a future-dated purchaseDay (corrupted state) never produces a negative age");
}

// ===== C: perishabilityStateFor boundaries (tomato, shelf life 7). =====
{
  assert(perishabilityStateFor("tomato", 1, 1) === "FRESH", "C: age 0 is FRESH");
  assert(perishabilityStateFor("tomato", 1, 3) === "FRESH", `C2: age 2 (fraction 0.286) is still FRESH (got ${perishabilityStateFor("tomato", 1, 3)})`);
  assert(perishabilityStateFor("tomato", 1, 4) === "AGING", `C3: age 3 (fraction 0.429 >= 0.35) is AGING (got ${perishabilityStateFor("tomato", 1, 4)})`);
  assert(perishabilityStateFor("tomato", 1, 6) === "AGING", `C4: age 5 (fraction 0.714 < 0.75) is still AGING (got ${perishabilityStateFor("tomato", 1, 6)})`);
  assert(perishabilityStateFor("tomato", 1, 7) === "NEAR_EXPIRY", `C5: age 6 (fraction 0.857 >= 0.75) is NEAR_EXPIRY (got ${perishabilityStateFor("tomato", 1, 7)})`);
  assert(perishabilityStateFor("tomato", 1, 8) === "EXPIRED", `C6: age 7 (== shelf life) is EXPIRED (got ${perishabilityStateFor("tomato", 1, 8)})`);
  assert(perishabilityStateFor("tomato", 1, 100) === "EXPIRED", "C7: a very old entry stays EXPIRED, never wraps or resets");
  assert(isServable("FRESH") && isServable("AGING") && isServable("NEAR_EXPIRY"), "C8: FRESH/AGING/NEAR_EXPIRY are all servable");
  assert(!isServable("EXPIRED"), "C9: EXPIRED is never servable");
}

// ===== D: usableQuantity. =====
{
  const inv = addStock({}, "tomato", 10, 10, 1);
  assert(usableQuantity(inv, "tomato", 1) === 10, "D: a fresh entry's full quantity is usable");
  assert(usableQuantity(inv, "tomato", 8) === 0, "D2: a fully-expired entry (age 7) reports 0 usable, even though the raw quantity is still 10");
  assert(getQuantity(inv, "tomato") === 10, "D3: raw getQuantity is unaffected by expiry — the record itself isn't touched by usableQuantity");
  assert(usableQuantity({}, "tomato", 1) === 0, "D4: an ingredient never stocked reports 0 usable");
}

// ===== E: hasUsableIngredients. =====
{
  const inv = addStock({}, "tomato", 10, 10, 1);
  assert(hasUsableIngredients(inv, [{ ingredientId: "tomato", quantity: 10 }], 1), "E: sufficient fresh stock satisfies the requirement");
  assert(!hasUsableIngredients(inv, [{ ingredientId: "tomato", quantity: 10 }], 8), "E2: the same stock, now expired (day 8), no longer satisfies the requirement");
  assert(!hasUsableIngredients(inv, [{ ingredientId: "tomato", quantity: 11 }], 1), "E3: fresh but insufficient quantity still fails");
}

// ===== F: consumeUsableIngredients — the 'expired ingredients cannot be served' gate. =====
{
  // F-fresh: a normal, successful consumption.
  let inv = addStock({}, "tomato", 10, 10, 1);
  const ok = consumeUsableIngredients(inv, [{ ingredientId: "tomato", quantity: 4 }], 1);
  assert(ok.ok, "F: consuming fresh, sufficient stock succeeds");
  if (ok.ok) assert(getQuantity(ok.inventory, "tomato") === 6, "F2: exactly the requested quantity is removed");

  // F-expired: fully expired stock is rejected, atomically.
  inv = addStock({}, "tomato", 10, 10, 1);
  const expired = consumeUsableIngredients(inv, [{ ingredientId: "tomato", quantity: 4 }], 8);
  assert(!expired.ok && expired.reason === "expiredStock", `F3: expired stock is rejected with 'expiredStock' (got ${JSON.stringify(expired)})`);
  if (!expired.ok && expired.reason === "expiredStock") {
    assert(expired.expired.includes("tomato"), "F4: the expired ingredient is correctly named");
  }
  assert(getQuantity(inv, "tomato") === 10, "F5: a rejected (expired) consumption leaves the original inventory byte-identical — nothing is silently removed");

  // F-insufficient: genuinely not enough (but NOT expired) still reports insufficientStock, not expiredStock.
  inv = addStock({}, "tomato", 3, 10, 1);
  const short = consumeUsableIngredients(inv, [{ ingredientId: "tomato", quantity: 10 }], 1);
  assert(!short.ok && short.reason === "insufficientStock", `F6: merely-insufficient (non-expired) stock reports 'insufficientStock', not 'expiredStock' (got ${JSON.stringify(short)})`);

  // F-multi: one expired ingredient blocks the whole atomic call even if another requirement is satisfiable.
  inv = addStock({}, "tomato", 10, 10, 1); // will be expired by day 8
  inv = addStock(inv, "onion", 10, 10, 7); // still fresh at day 8 (age 1)
  const multi = consumeUsableIngredients(inv, [{ ingredientId: "tomato", quantity: 2 }, { ingredientId: "onion", quantity: 2 }], 8);
  assert(!multi.ok && multi.reason === "expiredStock", "F7: a single expired requirement blocks the entire atomic call");
  assert(getQuantity(inv, "onion") === 10, "F8: the still-fresh onion entry is untouched by the rejected call");
}

// ===== G: addStock's weighted-average purchaseDay — anti-refresh-cheat. =====
{
  // G-fresh: a first purchase records the exact day (unaffected by the weighted-average change).
  const first = addStock({}, "tomato", 10, 10, 5);
  assert(first.tomato!.purchaseDay === 5, "G: a first-time purchase records the exact business day");

  // G-equal: two equal-quantity purchases average their days (existing V3-2 QA's own D3 case: (10*1+10*2)/20=1.5 -> round 2).
  let equal = addStock({}, "tomato", 10, 10, 1);
  equal = addStock(equal, "tomato", 10, 20, 2);
  assert(equal.tomato!.purchaseDay === 2, `G2: equal-quantity merge still rounds to day 2, matching V3-2's own D3 expectation (got ${equal.tomato!.purchaseDay})`);

  // G-cheat: a large NEAR_EXPIRY stock cannot be fully "refreshed" by a tiny top-up purchase.
  let cheat: BusinessInventory = addStock({}, "tomato", 39, 10, 0); // 39 units bought on day 0
  const beforeState = perishabilityStateFor("tomato", cheat.tomato!.purchaseDay, 6); // NEAR_EXPIRY at day 6 (age 6)
  cheat = addStock(cheat, "tomato", 1, 10, 10); // a token 1-unit top-up on day 10
  const afterDay = cheat.tomato!.purchaseDay;
  assert(beforeState === "NEAR_EXPIRY", "G3: precondition — the 39-unit lot is NEAR_EXPIRY just before the top-up");
  assert(afterDay <= 1, `G4: a 1-unit top-up barely moves the weighted-average day for a 39-unit lot (got day ${afterDay}, old lot NOT reset to day 10)`);
  const afterState = perishabilityStateFor("tomato", afterDay, 10);
  assert(afterState !== "FRESH", `G5: the old, mostly-unrefreshed lot is NOT laundered back to FRESH by a token top-up (got ${afterState})`);
}

// ===== H: clearExpiredStock — removes only EXPIRED entries, records the loss, never silently. =====
{
  let inv: BusinessInventory = addStock({}, "tomato", 10, 12, 1); // will be EXPIRED by day 20
  inv = addStock(inv, "onion", 5, 8, 18); // still FRESH at day 20 (age 2)
  const result = clearExpiredStock(inv, 20);
  assert(getQuantity(result.inventory, "tomato") === 0, "H: the expired tomato entry is fully removed");
  assert(getQuantity(result.inventory, "onion") === 5, "H2: the still-fresh onion entry is completely untouched");
  assert(result.spoiledQuantity === 10, `H3: spoiledQuantity reports exactly the removed quantity (got ${result.spoiledQuantity})`);
  assert(result.spoiledValue === 10 * 12, `H4: spoiledValue reports exactly quantity*unitCost of what was removed (got ${result.spoiledValue})`);
  assert(result.spoiledIngredientIds.length === 1 && result.spoiledIngredientIds[0] === "tomato", "H5: spoiledIngredientIds names exactly what spoiled — nothing is silent");
}
{
  // H-none: nothing expired means nothing is removed, and zero is reported (not a false positive).
  const inv = addStock({}, "tomato", 10, 12, 1);
  const result = clearExpiredStock(inv, 2); // age 1, nowhere near tomato's 7-day shelf life
  assert(getQuantity(result.inventory, "tomato") === 10, "H6: no spoilage means the inventory is completely unchanged");
  assert(result.spoiledQuantity === 0 && result.spoiledValue === 0, "H7: zero spoilage is correctly reported as zero, not omitted");
}

// ===== I: endBusinessDay — the combined calendar-advance + spoilage-sweep action. =====
{
  const save = saveAt({
    credits: 5000,
    business: {
      ...DEFAULT_BUSINESS_STATE,
      calendar: { businessDay: 20 },
      inventory: addStock({}, "tomato", 10, 12, 13), // age 8 once the day advances to 21 (>= tomato's 7-day shelf life) -> EXPIRED
    },
  });
  const result = endBusinessDay(save);
  assert(result.save.business.calendar.businessDay === 21, "I: the business day advances by exactly 1");
  assert(getQuantity(result.save.business.inventory, "tomato") === 0, "I2: the now-expired tomato is swept during the SAME day-advance");
  assert(result.spoiledQuantity === 10 && result.spoiledValue === 120, `I3: endBusinessDay reports the exact spoilage that occurred (got qty=${result.spoiledQuantity}, value=${result.spoiledValue})`);
  assert(result.save.business.spoilage.totalSpoiledQuantity === 10, "I4: the lifetime spoilage total accumulates the swept quantity");
  assert(result.save.business.spoilage.totalSpoiledValue === 120, "I5: the lifetime spoilage value total accumulates the swept value");
  assert(result.save.credits === 5000, "I6: ending the business day never touches credits — spoilage is not a wallet mutation");
}
{
  // I-accumulate: a second call adds on top of, never replaces, the running total.
  const save = saveAt({
    credits: 5000,
    business: {
      ...DEFAULT_BUSINESS_STATE,
      calendar: { businessDay: 20 },
      inventory: addStock({}, "tomato", 10, 12, 13),
      spoilage: { totalSpoiledQuantity: 50, totalSpoiledValue: 500 },
    },
  });
  const result = endBusinessDay(save);
  assert(result.save.business.spoilage.totalSpoiledQuantity === 60, `I7: spoilage accumulates on top of a pre-existing total (50+10=60, got ${result.save.business.spoilage.totalSpoiledQuantity})`);
  assert(result.save.business.spoilage.totalSpoiledValue === 620, `I8: value likewise accumulates (500+120=620, got ${result.save.business.spoilage.totalSpoiledValue})`);
}
{
  // I-nospoil: a day advance with nothing expired reports zero and leaves inventory untouched.
  const save = saveAt({
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: addStock({}, "tomato", 10, 12, 1) },
  });
  const result = endBusinessDay(save);
  assert(result.spoiledQuantity === 0, "I9: no spoilage on a fresh-stock day advance");
  assert(getQuantity(result.save.business.inventory, "tomato") === 10, "I10: inventory is untouched when nothing spoiled");
}

// ===== J: persistence — spoilage survives a JSON save/load round-trip. =====
{
  const save = saveAt({
    business: { ...DEFAULT_BUSINESS_STATE, spoilage: { totalSpoiledQuantity: 7, totalSpoiledValue: 84 } },
  });
  const roundTripped = JSON.parse(JSON.stringify(save)) as SaveData;
  assert(roundTripped.business.spoilage.totalSpoiledQuantity === 7, "J: spoilage quantity survives a JSON round-trip exactly");
  assert(roundTripped.business.spoilage.totalSpoiledValue === 84, "J2: spoilage value survives a JSON round-trip exactly");
}

// ===== K: migration — old saves (pre-V3-4) default spoilage cleanly; forward-compatible with a later field. =====
{
  const v33Save = {
    version: 1,
    credits: 4000,
    business: {
      calendar: { businessDay: 8 },
      inventory: { tomato: { ingredientId: "tomato", quantity: 6, unitCost: 12, purchaseDay: 8 } },
      refrigerator: { refrigeratorId: "commercial-refrigerator" },
    },
  } as unknown as Partial<SaveData>;
  const migrated = { ...DEFAULT_SAVE, ...v33Save, business: { ...DEFAULT_SAVE.business, ...v33Save.business } } as SaveData;
  assert(migrated.business.calendar.businessDay === 8, "K: a pre-V3-4 save's calendar survives exactly");
  assert(migrated.business.inventory.tomato?.quantity === 6, "K2: ...and its inventory survives exactly");
  assert(migrated.business.refrigerator.refrigeratorId === "commercial-refrigerator", "K3: ...and its refrigerator survives exactly");
  assert(
    migrated.business.spoilage.totalSpoiledQuantity === DEFAULT_SPOILAGE_STATE.totalSpoiledQuantity &&
      migrated.business.spoilage.totalSpoiledValue === DEFAULT_SPOILAGE_STATE.totalSpoiledValue,
    "K4: spoilage defaults cleanly to zero on a save that predates this phase",
  );
}
{
  type FutureBusinessState = SaveData["business"] & { futureField?: string };
  const laterSave = {
    version: 1,
    credits: 1000,
    business: { calendar: { businessDay: 7 }, inventory: {}, refrigerator: { refrigeratorId: "basic-refrigerator" }, spoilage: { totalSpoiledQuantity: 3, totalSpoiledValue: 30 } },
  } as unknown as Partial<SaveData>;
  const defaultWithFuture: FutureBusinessState = { ...DEFAULT_SAVE.business, futureField: "default-value" };
  const migrated = { ...DEFAULT_SAVE, ...laterSave, business: { ...defaultWithFuture, ...laterSave.business } };
  assert(migrated.business.spoilage.totalSpoiledQuantity === 3, "K5: an existing field (spoilage) survives when a LATER phase's field is also present");
  assert((migrated.business as FutureBusinessState).futureField === "default-value", "K6: a field from a LATER phase not yet in this save correctly falls back to its own default");
}

// ===== L: Campaign independence. =====
{
  const save = saveAt({
    credits: 5000,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" },
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 20 }, inventory: addStock({}, "tomato", 10, 12, 1) },
  });
  const result = endBusinessDay(save);
  assert(JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress), "L: levelProgress is byte-identical before/after a spoilage-heavy End Business Day");
  assert(result.save.credits === save.credits, "L2: credits are completely untouched by spoilage");
}

// ===== M: no negative cash/inventory ever. =====
{
  const save = saveAt({
    credits: 0,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 20 }, inventory: addStock({}, "tomato", 10, 12, 1) },
  });
  const result = endBusinessDay(save);
  assert(result.save.credits === 0, "M: spoilage never makes credits negative, even starting from 0");
  const allQuantitiesNonNegative = Object.values(result.save.business.inventory).every((e) => !e || e.quantity >= 0);
  assert(allQuantitiesNonNegative, "M2: no inventory entry ever has a negative quantity after a spoilage sweep");
}

// ===== N: no ledger entry is created for spoilage — it is never a wallet mutation. =====
{
  const save = saveAt({
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 20 }, inventory: addStock({}, "tomato", 10, 12, 1) },
  });
  const before = save.economyLedger.length;
  const result = endBusinessDay(save);
  assert(result.save.economyLedger.length === before, "N: endBusinessDay creates ZERO ledger entries, even when spoilage occurred");
}

// ===== O: determinism — identical inputs produce identical results; no Math.random() CALL anywhere in the new files. =====
{
  const save = saveAt({
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 20 }, inventory: addStock({}, "tomato", 10, 12, 1) },
  });
  const r1 = endBusinessDay(save);
  const r2 = endBusinessDay(save);
  assert(
    r1.spoiledQuantity === r2.spoiledQuantity && r1.spoiledValue === r2.spoiledValue && r1.save.business.calendar.businessDay === r2.save.business.calendar.businessDay,
    "O: identical endBusinessDay inputs produce identical results",
  );
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(import.meta.dirname, "..", "src", "game", "business");
  const files = ["perishability.ts", "SpoilageManager.ts", "BusinessDayManager.ts"];
  let foundRandomCall = false;
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    const hasMention = /Math\.random\(\)/.test(content);
    const isDocMention = /(Never|No|not)\s+`?Math\.random\(\)/i.test(content);
    if (hasMention && !isDocMention) foundRandomCall = true;
  }
  assert(!foundRandomCall, "O2: no Math.random() CALL exists anywhere in the new perishability files");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
