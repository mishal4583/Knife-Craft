/**
 * BUSINESS_SERVICE_QA — Economy V3 Phase 14, Checkpoint 3. Verifies the
 * Business Mode order/service/revenue pipeline
 * (BusinessServiceManager.ts/businessServiceCatalog.ts/
 * businessDeterministicRandom.ts): order generation reuses the EXISTING
 * ServiceManager/OrderGenerator/CustomerOrderManager machinery
 * (never a second engine); the accept-time ingredient-availability gate;
 * the real, existing Preparation gameplay driving an order to READY
 * (recordAllComponents, reused directly); atomic inventory consumption +
 * revenue + popularity on a successful serve; the "pays exactly once"
 * guard inherited for free from CustomerOrderManager.payOrder; live
 * (never captured-at-generation-time) menu pricing; deterministic,
 * seeded order generation; and Campaign/Economy V2 isolation — against
 * the real production functions only.
 *
 * Run: npx tsx scripts/business-service-qa.mts
 */
import { willingnessToPayMultiplierFor } from "../src/game/business/DemandManager.ts";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { addStock, getQuantity } from "../src/game/business/businessInventory.ts";
import {
  createBusinessServiceSession,
  advanceBusinessServiceSession,
  recordBusinessServiceComponents,
  serveBusinessOrder,
  businessOrderAvailability,
} from "../src/game/business/BusinessServiceManager.ts";
import {
  businessServicePool,
  businessDishForRecipeId,
  businessDishRequirements,
} from "../src/game/business/businessServiceCatalog.ts";
import { makeSeededRand, businessServiceSeedFor } from "../src/game/business/businessDeterministicRandom.ts";
import { getBusinessDish, businessDishPrice, BUSINESS_DISH_CATALOG } from "../src/game/business/businessDishCatalog.ts";
import { appendLedgerEntry, ledgerTotals } from "../src/game/economy/EconomyLedger.ts";

let failures = 0;
// Economy V3 Phase 16 (WTP, intentional rule change): a Business customer pays menu price ×
// willingnessToPayMultiplierFor(popularity), rounded once to cents. These scenarios run at the
// default popularity 50, so the exact expected payment is:
const WTP_HUNDREDTHS_AT_50 = Math.round(willingnessToPayMultiplierFor(50) * 100);
const customerPaysAt50 = (menuPrice: number) => Math.round((menuPrice * WTP_HUNDREDTHS_AT_50) / 100);

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

// The fixed test dish for every scenario below: Garlic Bread, whose
// source recipe (camp-garlic-bread) needs bread x1 (Bakery, 5-day shelf
// life) and garlic x2 (Aromatic, 12-day shelf life, non-deduped across
// its two components) — a real two-ingredient dish, letting the
// "one expired ingredient blocks the whole atomic order even though the
// other is fine" case be tested honestly.
const DISH = getBusinessDish("biz-garlic-bread")!;
const RECIPE_ID = DISH.sourceRecipeId; // "camp-garlic-bread"

function fullyStockedInventory(day: number) {
  let inv = addStock({}, "bread", 10, 225, day);
  inv = addStock(inv, "garlic", 10, 350, day);
  return inv;
}

/** Drives a fresh session's CURRENT order all the way to a genuinely READY Garlic Bread order — by construction (createBusinessServiceSession draws from the full 35-dish pool, not just this one), this loops a small, bounded number of times using a seed known to land on it quickly; deterministic and finite (never infinite — bounded by the pool size). */
function sessionReadyForGarlicBread(save: SaveData) {
  for (let seed = 1; seed < 200; seed++) {
    let session = createBusinessServiceSession(makeSeededRand(seed));
    if (session.current?.recipe.id !== RECIPE_ID) continue;
    session = recordBusinessServiceComponents(session, 80);
    if (session.current?.order.status === "READY") return session;
  }
  throw new Error("QA precondition failed: no seed under 200 produced a READY Garlic Bread order");
}

// ===== A: valid order — dish/recipe resolve, requirements are real, availability is true with full stock. =====
{
  assert(!!DISH, "A: precondition — biz-garlic-bread resolves in the catalog");
  assert(businessDishForRecipeId(RECIPE_ID)?.id === DISH.id, "A2: businessDishForRecipeId reverse-maps back to the same dish");
  const reqs = businessDishRequirements(DISH);
  assert(reqs.length === 2 && reqs[0]!.ingredientId === "bread" && reqs[1]!.ingredientId === "garlic", `A3: camp-garlic-bread's 3 components (bread, garlic peel + smash) are 2 prepared items — the garlic is peeled and smashed as ONE set of cloves (got ${reqs.length})`);
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  assert(businessOrderAvailability(save, DISH).available, "A4: a fully-stocked inventory reports the order as available");
}

// ===== B: unavailable ingredient — never stocked at all. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: {} } });
  const availability = businessOrderAvailability(save, DISH);
  assert(!availability.available, "B: an empty inventory reports the order as unavailable");
  if (!availability.available) {
    assert(availability.missing.includes("bread") && availability.missing.includes("garlic"), `B2: missing lists both real ingredients (got ${JSON.stringify(availability.missing)})`);
  }
}

// ===== C: expired ingredient — bread expired (5-day shelf life, bought day 1, now day 10), garlic still fresh; the whole order is unavailable. =====
{
  let inv = addStock({}, "bread", 10, 225, 1); // age 9 at day 10 -> EXPIRED (shelf life 5)
  inv = addStock(inv, "garlic", 10, 350, 9); // age 1 at day 10 -> fresh (shelf life 12)
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 10 }, inventory: inv } });
  const availability = businessOrderAvailability(save, DISH);
  assert(!availability.available, "C: expired bread makes the order unavailable even though garlic is fresh");
  const served = serveBusinessOrder(sessionReadyForGarlicBread(save), save, Math.random);
  assert(served === null, "C2: serveBusinessOrder refuses an order whose stock is expired");
  assert(getQuantity(save.business.inventory, "garlic") === 10, "C3: the still-fresh garlic entry is completely untouched by the refused attempt");
}

// ===== D: insufficient inventory — genuinely not enough (not expired). =====
{
  let inv = addStock({}, "bread", 10, 225, 1);
  // A Garlic Bread draws one garlic serving, 0.025 lb (realistic portions, ingredientMeasures.ts) — 0.02 lb is genuinely short.
  inv = addStock(inv, "garlic", 0.02, 350, 1);
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: inv } });
  assert(!businessOrderAvailability(save, DISH).available, "D: insufficient (but fresh) garlic stock makes the order unavailable");
  const served = serveBusinessOrder(sessionReadyForGarlicBread(save), save, Math.random);
  assert(served === null, "D2: serveBusinessOrder refuses an order it can't fully satisfy");
  assert(getQuantity(save.business.inventory, "bread") === 10, "D3: the sufficient bread entry is untouched by the refused attempt (atomic — nothing partially consumed)");
}

// ===== E: successful preparation — recordBusinessServiceComponents (the real, existing organization/quality pipeline) drives the order to READY. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const session = sessionReadyForGarlicBread(save);
  assert(session.current?.order.status === "READY", "E: recording every real component drives the order's status to READY");
}

// ===== F: failed preparation — an order that hasn't been prepared yet (status not READY) can never be served, no matter how available the ingredients are. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  let session = createBusinessServiceSession(makeSeededRand(businessServiceSeedFor(1)));
  // Deliberately skip recordBusinessServiceComponents — the order is still ACTIVE/PREPARING, never READY.
  assert(session.current?.order.status !== "READY", "F: precondition — an unrecorded order is not READY");
  const served = serveBusinessOrder(session, save, Math.random);
  assert(served === null, "F2: serveBusinessOrder refuses an order that was never actually prepared, even with full stock available");
  assert(save.credits === DEFAULT_SAVE.credits, "F3: no credits move for an unprepared order");
}

// ===== G: successful serve — the one atomic transaction: correct price charged, correct reaction, correct new save. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const session = sessionReadyForGarlicBread(save);
  const price = businessDishPrice(save.business.menu, DISH);
  const result = serveBusinessOrder(session, save, Math.random);
  assert(result !== null, "G: a genuinely READY, fully-stocked order serves successfully");
  if (result) {
    assert(result.amountCharged === customerPaysAt50(price) && result.payment.menuPrice === price && result.payment.customerPays === result.amountCharged, `G2: the amount charged is exactly the current menu price × the popularity-50 modifier (got ${result.amountCharged}, expected ${customerPaysAt50(price)})`);
    assert(typeof result.reaction === "string" && result.reaction.length > 0, "G3: a real customer reaction line is returned");
    assert(result.save.credits === 1000 + customerPaysAt50(price), `G4: credits increase by exactly the amount charged (got ${result.save.credits})`);
    assert(getQuantity(result.save.business.inventory, "bread") === 9.75, "G5: bread inventory decreases by exactly a quarter loaf");
    assert(getQuantity(result.save.business.inventory, "garlic") === 9.975, "G6: garlic inventory decreases by exactly 0.025 lb — the peel and the smash are the same cloves, drawn once");
    assert(result.dish.id === DISH.id, "G7: the result names the correct Business Dish");
  }
}

// ===== H: canceled order (never served) — an order that reaches READY but is never actually served leaves inventory/credits completely untouched. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  sessionReadyForGarlicBread(save); // reaches READY, but the caller never calls serveBusinessOrder on it
  assert(save.credits === 1000, "H: reaching READY without serving never touches credits");
  assert(getQuantity(save.business.inventory, "bread") === 10, "H2: ...nor inventory");
}

// ===== I: repeated serve clicks — a second serve attempt on the already-served session's own returned state pays nothing further. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const session = sessionReadyForGarlicBread(save);
  const first = serveBusinessOrder(session, save, Math.random);
  assert(first !== null, "I: precondition — the first serve succeeds");
  if (first) {
    const second = serveBusinessOrder(first.session, first.save, Math.random);
    assert(second === null, "I2: a second serve attempt on the same (now COMPLETED) order refuses — no double payment");
  }
}

// ===== J: reload before service — BusinessServiceManager is pure: identical (save, session) inputs never mutate either argument, and re-deriving availability/requirements repeatedly is side-effect-free (mirrors what a reload before serving actually loses: nothing, since nothing was ever mutated). =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const beforeInventoryJson = JSON.stringify(save.business.inventory);
  const beforeCredits = save.credits;
  businessOrderAvailability(save, DISH);
  businessOrderAvailability(save, DISH);
  businessDishRequirements(DISH);
  assert(JSON.stringify(save.business.inventory) === beforeInventoryJson, "J: repeated availability checks never mutate the save's inventory");
  assert(save.credits === beforeCredits, "J2: ...nor its credits — a reload before any serve loses nothing because nothing was ever touched");
}

// ===== K: reload after service — a JSON round-trip of the post-serve save preserves the exact credits/inventory/popularity, and the restored session can never be re-served. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const session = sessionReadyForGarlicBread(save);
  const result = serveBusinessOrder(session, save, Math.random)!;
  const reloaded = JSON.parse(JSON.stringify(result.save)) as SaveData;
  assert(reloaded.credits === result.save.credits, "K: credits survive a JSON round-trip exactly");
  assert(getQuantity(reloaded.business.inventory, "bread") === getQuantity(result.save.business.inventory, "bread"), "K2: inventory survives a JSON round-trip exactly");
  const reservedAfterReload = serveBusinessOrder(result.session, reloaded, Math.random);
  assert(reservedAfterReload === null, "K3: the already-COMPLETED order can never be re-served after a reload — no duplicate payment");
}

// ===== L: navigation away and back — viewing the same order/session repeatedly (as the BusinessService screen's own re-renders would) is idempotent and never mutates state. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const session = createBusinessServiceSession(makeSeededRand(businessServiceSeedFor(1)));
  const view1 = session.current ? businessDishForRecipeId(session.current.recipe.id) : undefined;
  const view2 = session.current ? businessDishForRecipeId(session.current.recipe.id) : undefined;
  assert(view1?.id === view2?.id, "L: viewing the current order repeatedly (navigate away and back) always resolves to the same dish");
  const statusBefore = session.current?.order.status;
  businessOrderAvailability(save, DISH);
  businessOrderAvailability(save, DISH);
  assert(session.current?.order.status === statusBefore, "L2: repeated availability/view lookups never advance the order's own status as a side effect");
}

// ===== M: replay of a completed order — a stale reference to an already-COMPLETED order can never be fed back into serveBusinessOrder for a second payment. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const session = sessionReadyForGarlicBread(save);
  const result = serveBusinessOrder(session, save, Math.random)!;
  // Simulate "replay": construct a session whose `current` is deliberately pointed back at the already-COMPLETED order.
  const replaySession = { ...result.session, current: result.session.current };
  const replayed = serveBusinessOrder(replaySession, result.save, Math.random);
  assert(replayed === null, "M: an already-COMPLETED order can never be replayed for a second payment");
}

// ===== N: changed menu price — the price actually charged is read LIVE from save.business.menu at serve time, never captured earlier. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const originalPrice = businessDishPrice(save.business.menu, DISH);
  const session = sessionReadyForGarlicBread(save);
  // The player changes the menu price AFTER the order was generated/prepared, but BEFORE serving.
  const repricedSave = { ...save, business: { ...save.business, menu: { ...save.business.menu, [RECIPE_ID]: originalPrice + 500 } } };
  const result = serveBusinessOrder(session, repricedSave, Math.random)!;
  assert(result.amountCharged === customerPaysAt50(originalPrice + 500), `N: the serve charges from the CURRENT (changed) menu price, not the price at order-generation time (got ${result.amountCharged}, expected ${customerPaysAt50(originalPrice + 500)})`);
}

// ===== O: popularity effect — Economy V3 Phase 16 popularity model D2 (intentional rule change): a serve NO LONGER moves popularity immediately; it counts toward today's ordersServed, and End Business Day applies one bounded daily service score. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const startingScore = save.business.popularity.score;
  const session = sessionReadyForGarlicBread(save);
  const result = serveBusinessOrder(session, save, Math.random)!;
  assert(result.popularityDelta === 0, `O: a successful serve reports no immediate popularity delta under D2 (got ${result.popularityDelta})`);
  assert(result.save.business.popularity.score === startingScore, `O2: popularity is unchanged in the returned save (got ${result.save.business.popularity.score}, expected ${startingScore})`);
  assert(result.save.business.finance.dailyAccumulator.ordersServed === save.business.finance.dailyAccumulator.ordersServed + 1, `O3: the serve increments today's ordersServed by exactly 1 (got ${result.save.business.finance.dailyAccumulator.ordersServed})`);
}

// ===== P: deterministic order generation — the same seed always produces the same first order; never Math.random() directly. =====
{
  const seed = businessServiceSeedFor(5);
  const sessionA = createBusinessServiceSession(makeSeededRand(seed));
  const sessionB = createBusinessServiceSession(makeSeededRand(seed));
  assert(sessionA.current?.recipe.id === sessionB.current?.recipe.id, "P: the same seed produces the same first generated order");
  assert(sessionA.next?.recipe.id === sessionB.next?.recipe.id, "P2: ...and the same second (next) order too");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(import.meta.dirname, "..", "src", "game", "business");
  for (const file of ["BusinessServiceManager.ts", "businessServiceCatalog.ts", "businessDeterministicRandom.ts"]) {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    const hasCall = /Math\.random\(\)/.test(content);
    const isDocMention = /(never|no|not)\s+`?Math\.random\(\)/i.test(content);
    assert(!(hasCall && !isDocMention), `P3: no Math.random() CALL exists in ${file}`);
  }
}

// ===== Q: inventory atomicity — a multi-ingredient dish where one ingredient is short leaves BOTH ingredients completely untouched (never a partial consumption). =====
{
  let inv = addStock({}, "bread", 10, 225, 1);
  inv = addStock(inv, "garlic", 0.02, 350, 1); // short: the dish needs 0.025 lb (one garlic serving)
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: inv } });
  const session = sessionReadyForGarlicBread(save);
  const result = serveBusinessOrder(session, save, Math.random);
  assert(result === null, "Q: precondition — the short order is refused");
  assert(getQuantity(save.business.inventory, "bread") === 10, "Q2: bread (which WAS sufficient) is not partially consumed either");
  assert(getQuantity(save.business.inventory, "garlic") === 0.02, "Q3: garlic remains at its original (short) quantity — atomic, never partially drawn down");
}

// ===== R: revenue atomicity — exactly one credits movement per successful serve, equal to the menu price, never split, never doubled. =====
{
  const save = saveAt({ credits: 500, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const price = businessDishPrice(save.business.menu, DISH);
  const session = sessionReadyForGarlicBread(save);
  const result = serveBusinessOrder(session, save, Math.random)!;
  assert(result.save.credits - save.credits === customerPaysAt50(price), `R: credits move by exactly one customer payment (${customerPaysAt50(price)}), got a delta of ${result.save.credits - save.credits}`);
}

// ===== S: ledger atomicity — the caller's own appendLedgerEntry("business-revenue", ...) call (mirroring App.tsx's serveActiveBusinessOrder) produces exactly one entry, and it reconciles with the credits change. =====
{
  const save = saveAt({ credits: 500, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const session = sessionReadyForGarlicBread(save);
  const result = serveBusinessOrder(session, save, Math.random)!;
  const withLedger = appendLedgerEntry(result.save, "business-revenue", result.amountCharged, result.dish.id);
  assert(withLedger.economyLedger.length === save.economyLedger.length + 1, "S: exactly one new ledger entry is created for a successful serve");
  const newEntry = withLedger.economyLedger[withLedger.economyLedger.length - 1]!;
  assert(newEntry.category === "business-revenue" && newEntry.amount === result.amountCharged, "S2: the entry is categorized 'business-revenue' with the exact charged amount");
  const totals = ledgerTotals(withLedger.economyLedger);
  assert(save.credits + totals.netCashFlow === withLedger.credits, `S3: Opening Cash + Signed Ledger Cash Flow == Closing Cash (${save.credits} + ${totals.netCashFlow} == ${withLedger.credits})`);
}

// ===== T: Campaign isolation — a Business serve never touches levelProgress/recipeProgress's CAMPAIGN bookkeeping or any Campaign-only save field. =====
{
  const save = saveAt({
    credits: 500,
    levelProgress: { ...DEFAULT_LEVEL_PROGRESS, highestUnlockedLevelId: "level-90" },
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) },
  });
  const session = sessionReadyForGarlicBread(save);
  const result = serveBusinessOrder(session, save, Math.random)!;
  assert(JSON.stringify(result.save.levelProgress) === JSON.stringify(save.levelProgress), "T: levelProgress is byte-identical before/after a Business serve");
  assert(JSON.stringify(result.save.recipeProgress) === JSON.stringify(save.recipeProgress), "T2: recipeProgress is untouched by serveBusinessOrder itself (App.tsx's recordBusinessServiceResult is a SEPARATE call, mirroring every other service mode)");
}

// ===== U: no negative credits — a Business serve only ever adds credits (revenue, never COGS at sale time), so a zero-credit save never goes negative. =====
{
  const save = saveAt({ credits: 0, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const session = sessionReadyForGarlicBread(save);
  const result = serveBusinessOrder(session, save, Math.random)!;
  assert(result.save.credits >= 0, `U: credits never go negative from a serve (got ${result.save.credits})`);
  assert(result.save.credits > 0, "U2: a successful serve from 0 credits is strictly positive afterward (revenue-only, never a charge)");
}

// ===== V: no negative inventory — consumption never drives any entry's quantity below 0. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const session = sessionReadyForGarlicBread(save);
  const result = serveBusinessOrder(session, save, Math.random)!;
  const allNonNegative = Object.values(result.save.business.inventory).every((e) => !e || e.quantity >= 0);
  assert(allNonNegative, "V: no inventory entry is ever negative after a successful serve");
}

// ===== W: no duplicate payment — combines I/K: any second attempt on an already-PAID order, from any state (fresh session ref, post-reload), yields zero additional coinsAwarded. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const session = sessionReadyForGarlicBread(save);
  const first = serveBusinessOrder(session, save, Math.random)!;
  const second = serveBusinessOrder(first.session, first.save, Math.random);
  const third = serveBusinessOrder(first.session, first.save, Math.random);
  assert(second === null && third === null, "W: every subsequent serve attempt on an already-paid order returns null — zero additional payment, no matter how many times it's retried");
}

// ===== X: no duplicate ledger entry — the caller only ever appends a ledger entry when serveBusinessOrder returns non-null, so a refused repeat serve creates no second entry. =====
{
  const save = saveAt({ credits: 1000, business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const session = sessionReadyForGarlicBread(save);
  const first = serveBusinessOrder(session, save, Math.random)!;
  let ledgered = appendLedgerEntry(first.save, "business-revenue", first.amountCharged, first.dish.id);
  const countAfterFirst = ledgered.economyLedger.length;
  const second = serveBusinessOrder(first.session, ledgered, Math.random);
  if (second) {
    // Defensive — should never actually happen (see W), but proves the caller's own "only append when non-null" discipline even if it did.
    ledgered = appendLedgerEntry(second.save, "business-revenue", second.amountCharged, second.dish.id);
  }
  assert(second === null, "X: precondition — the repeat attempt is refused (shares W's guarantee)");
  assert(ledgered.economyLedger.length === countAfterFirst, "X2: no second ledger entry is ever created for a refused repeat serve");
}

// ===== extra: the full 35-dish Business pool round-trips through businessServicePool/businessDishForRecipeId with no gaps. =====
{
  const pool = businessServicePool();
  assert(pool.length === BUSINESS_DISH_CATALOG.length, `extra: businessServicePool has one shadow recipe per catalog dish (got ${pool.length}, expected ${BUSINESS_DISH_CATALOG.length})`);
  const allResolve = pool.every((r) => !!businessDishForRecipeId(r.id));
  assert(allResolve, "extra2: every pool recipe's id resolves back to a real Business Dish");
  const namesMatchDishes = BUSINESS_DISH_CATALOG.every((d) => pool.find((r) => r.id === d.sourceRecipeId)?.name === d.name);
  assert(namesMatchDishes, "extra3: every shadow recipe's display name is its Business Dish's real culinary name, never the underlying Campaign recipe's own name");
}

// ===== extra: advanceBusinessServiceSession mirrors advanceServiceSession exactly — a no-op unless CURRENT is genuinely COMPLETED. =====
{
  const save = saveAt({ business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: fullyStockedInventory(1) } });
  const session = createBusinessServiceSession(makeSeededRand(businessServiceSeedFor(1)));
  const advanced = advanceBusinessServiceSession(session, makeSeededRand(businessServiceSeedFor(1)));
  assert(advanced === session, "extra4: advancing a session whose current order isn't COMPLETED yet is a genuine no-op");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
