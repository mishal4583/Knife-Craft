/**
 * BUSINESS_ORDER_FREQUENCY_QA — Economy V3 Phase 16, order frequency.
 * Customers per Business Day =
 *   round(BASE_CUSTOMERS_PER_DAY × orderFrequencyMultiplierFor(start-of-day popularity))
 * — 4 / 6 / 8 / 10 / 12 at popularity 0 / 25 / 50 / 75 / 100. Once today's
 * customers are served the counter closes: no new order, no preparation, no
 * payment, no stock use, no ledger entry. Verifies, against the real
 * production functions:
 *   A. formula        B. daily snapshot      C. serving count
 *   D. daily limit    E. availability gate   F. WTP interaction
 *   G. reload         H. End Business Day    I. Campaign isolation (+ V2 freeze)
 *   J. ledger         K. determinism         U. UI / App wiring
 *
 * Run: npx tsx scripts/business-order-frequency-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { addStock, getQuantity } from "../src/game/business/businessInventory.ts";
import { BUSINESS_DISH_CATALOG, getBusinessDish } from "../src/game/business/businessDishCatalog.ts";
import {
  BASE_CUSTOMERS_PER_DAY,
  businessCustomersToday,
  businessServiceSessionForToday,
  businessCustomerPayment,
  businessOrderAvailability,
  nextCustomerDestination,
  recordBusinessServiceComponents,
  serveBusinessOrder,
  advanceBusinessServiceSession,
  createBusinessServiceSession,
} from "../src/game/business/BusinessServiceManager.ts";
import { businessDishForRecipeId } from "../src/game/business/businessServiceCatalog.ts";
import { makeSeededRand, businessServiceSeedFor } from "../src/game/business/businessDeterministicRandom.ts";
import { orderFrequencyMultiplierFor, willingnessToPayMultiplierFor } from "../src/game/business/DemandManager.ts";
import { setDishActive } from "../src/game/business/businessMenuActivation.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import type { ServiceSession } from "../src/game/service/ServiceManager.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => fs.readFileSync(path.resolve(ROOT, rel), "utf8");

// A Garden-Salad-only restaurant (tomato + cucumber + carrot, 1 each, 100c/unit -> COGS 300c), so every
// generated customer is servable from the fixture stock.
const SALAD = getBusinessDish("biz-garden-salad")!;
function saladOnly(score: number, credits = 100_000): SaveData {
  let save: SaveData = {
    ...DEFAULT_SAVE,
    credits,
    economyLedger: [],
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, popularity: { score } },
  };
  for (const d of BUSINESS_DISH_CATALOG) {
    if (d.id === SALAD.id) continue;
    const r = setDishActive(save, d.id, false);
    if (r.ok) save = r.save;
  }
  let inv = addStock({}, "tomato", 13, 100, 1);
  inv = addStock(inv, "cucumber", 13, 100, 1);
  inv = addStock(inv, "carrot", 13, 100, 1);
  return { ...save, business: { ...save.business, inventory: inv } };
}

type Served = { dishId: string; customer: string; orderId: string; paid: number };
/** The App.tsx flow for one Business Day: open the counter (businessServiceSessionForToday), then serve ->
 *  one ledger entry -> Next Customer, until the counter closes or `limit` serves. */
function playDay(start: SaveData, limit = 99) {
  let save = start;
  const rand = makeSeededRand(businessServiceSeedFor(save.business.calendar.businessDay));
  let session: ServiceSession | null = businessServiceSessionForToday(save, rand);
  const served: Served[] = [];
  while (session?.current && served.length < limit) {
    const r = serveBusinessOrder(recordBusinessServiceComponents(session, 80), save, rand);
    if (!r) break;
    served.push({ dishId: r.dish.id, customer: session.current.customer.name, orderId: session.current.order.id, paid: r.amountCharged });
    save = appendLedgerEntry(r.save, "business-revenue", r.amountCharged, r.dish.id);
    session = businessCustomersToday(save).complete
      ? null
      : advanceBusinessServiceSession(r.session, rand, save.business.menuActivation);
  }
  return { save, served, session };
}

// ===== A: formula. =====
{
  assert(BASE_CUSTOMERS_PER_DAY === 8, "A: BASE_CUSTOMERS_PER_DAY = 8");
  for (const [score, target] of [[0, 4], [25, 6], [50, 8], [75, 10], [100, 12]] as const) {
    const c = businessCustomersToday(saladOnly(score));
    assert(c.target === target && c.multiplier === orderFrequencyMultiplierFor(score) && c.served === 0 && c.remaining === target && !c.complete, `A2: popularity ${score} -> ×${c.multiplier.toFixed(2)} -> ${target} customers`);
  }
  let monotone = true;
  let exact = true;
  let prev = 0;
  for (let p = 0; p <= 100; p++) {
    const t = businessCustomersToday(saladOnly(p)).target;
    if (t < prev || t < 4 || t > 12) monotone = false;
    if (t !== Math.round(8 * orderFrequencyMultiplierFor(p))) exact = false;
    prev = t;
  }
  assert(monotone && exact, "A3: every popularity 0..100 gives a whole-customer target in [4, 12], never decreasing as popularity rises");
  const odd = (score: unknown) => businessCustomersToday({ ...saladOnly(50), business: { ...saladOnly(50).business, popularity: { score: score as number } } });
  assert(odd(-30).target === 4 && odd(250).target === 12 && odd(NaN).target === 8 && odd("x").target === 8, "A4: unsafe popularity reads safely (clamped; NaN/non-number -> 50), never a NaN target");
}

// ===== B: daily snapshot. =====
{
  const start = saladOnly(50);
  const before = businessCustomersToday(start);
  const day = playDay(start, 3);
  const during = businessCustomersToday(day.save);
  assert(during.target === before.target && during.popularity === 50 && during.served === 3, "B: serving during the day never moves popularity or the day's target (8 before, 8 after 3 serves)");
  const writers = fs.readdirSync(path.resolve(ROOT, "src"), { recursive: true } as { recursive: true })
    .map(String).filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => /popularity:\s*\{\s*score:/.test(read(path.join("src", f))) && !/DEFAULT_POPULARITY_STATE\s*[:=]/.test(read(path.join("src", f))))
    .map((f) => f.replace(/\\/g, "/")).sort();
  const callers = fs.readdirSync(path.resolve(ROOT, "src"), { recursive: true } as { recursive: true })
    .map(String).filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => /applyPopularityDelta\(/.test(read(path.join("src", f))) && !f.endsWith("PopularityManager.ts"));
  assert(JSON.stringify(writers) === JSON.stringify(["game/business/BusinessDayManager.ts", "game/business/PopularityManager.ts"]) && callers.length === 0, `B2: popularity is written only at End Business Day (BusinessDayManager; PopularityManager.applyPopularityDelta has no callers) — so the score read mid-day IS the start-of-day score (${writers.join(", ")})`);
  const closed = endBusinessDay(day.save);
  assert(businessCustomersToday(day.save).target === 8 && closed.popularityScore !== 50 && businessCustomersToday(closed.save).target === Math.round(8 * orderFrequencyMultiplierFor(closed.popularityScore)), `B3: the popularity change at End Business Day (50 -> ${closed.popularityScore}) sets the NEXT day's target, not the day just closed`);
}

// ===== C: serving count. =====
for (const [score, target] of [[0, 4], [50, 8], [100, 12]] as const) {
  const start = saladOnly(score);
  assert(start.business.finance.dailyAccumulator.ordersServed === 0, `C: 0 served at the start of the day (popularity ${score})`);
  let save = start;
  const rand = makeSeededRand(1);
  let session: ServiceSession | null = businessServiceSessionForToday(save, rand);
  let ok = true;
  let n = 0;
  for (let i = 0; i < 20 && session?.current; i++) {
    const r = serveBusinessOrder(recordBusinessServiceComponents(session, 80), save, rand);
    if (!r) break;
    n++;
    if (r.save.business.finance.dailyAccumulator.ordersServed !== save.business.finance.dailyAccumulator.ordersServed + 1) ok = false;
    save = r.save;
    session = advanceBusinessServiceSession(r.session, rand, save.business.menuActivation);
  }
  assert(ok && n === target && save.business.finance.dailyAccumulator.ordersServed === target, `C2: popularity ${score}: each serve adds exactly 1, and exactly ${target} serves succeed — never more (got ${n})`);
}

// ===== D: the daily limit. =====
{
  const full = playDay(saladOnly(50));
  const s = full.save;
  const today = businessCustomersToday(s);
  assert(full.served.length === 8 && today.complete && today.remaining === 0 && full.session === null, "D: at 8/8 the day is complete and the counter has no current customer");
  assert(businessServiceSessionForToday(s, makeSeededRand(9)) === null, "D2: opening the counter / Next Customer at 8/8 creates no order (no session at all — never a placeholder order)");
  // Even a READY order smuggled in from elsewhere cannot be served past the limit.
  const smuggled = recordBusinessServiceComponents(businessServiceSessionForToday(saladOnly(50), makeSeededRand(9))!, 80);
  const refused = serveBusinessOrder(smuggled, s, makeSeededRand(9));
  assert(refused === null, "D3: serveBusinessOrder refuses a 9th order at 8/8");
  assert(s.credits === full.save.credits && getQuantity(s.business.inventory, "tomato") === 13 - 8 && s.economyLedger.filter((e) => e.category === "business-revenue").length === 8, "D4: no payment, no ingredient consumed, no 9th revenue entry");
  const app = read("src/App.tsx");
  const fn = (name: string) => app.slice(app.indexOf(`function ${name}(`), app.indexOf("\n  }\n", app.indexOf(`function ${name}(`)));
  assert(/businessCustomersToday\(save\)\.complete/.test(fn("enterBusinessPreparation")), "D5: App — Start Preparing is refused once today's customers are complete (no preparation starts)");
  assert(/businessCustomersToday\(save\)\.complete[\s\S]*setBusinessServiceSession\(null\)[\s\S]*return;[\s\S]*advanceBusinessServiceSessionImpl/.test(fn("advanceBusinessServiceQueue")), "D6: App — Next Customer at the limit closes the queue before any new order is generated");
  assert(/businessServiceSessionForToday\(save, businessRand\(\)\)/.test(fn("startBusinessService")), "D7: App — Open the Counter goes through businessServiceSessionForToday (null when complete)");
}

// ===== E: the ingredient check is never bypassed. =====
{
  let save = saladOnly(50);
  save = { ...save, business: { ...save.business, inventory: addStock(addStock({}, "tomato", 5, 100, 1), "cucumber", 5, 100, 1) } }; // no carrot
  const session = businessServiceSessionForToday(save, makeSeededRand(4))!;
  assert(!businessCustomersToday(save).complete && !businessOrderAvailability(save, SALAD).available && nextCustomerDestination(save, session) === "service", "E: with customers remaining but a missing ingredient, Next Customer still routes to the Service screen");
  assert(serveBusinessOrder(recordBusinessServiceComponents(session, 80), save, makeSeededRand(4)) === null && getQuantity(save.business.inventory, "tomato") === 5, "E2: order frequency never lets an unstocked order be served; no stock is touched");
}

// ===== F: frequency sets the count, WTP sets the payment — never double-applied. =====
for (const score of [0, 50, 100]) {
  const day = playDay(saladOnly(score));
  const pay = businessCustomerPayment(saladOnly(score), SALAD).customerPays;
  const menuPrice = businessCustomerPayment(saladOnly(score), SALAD).menuPrice;
  const expected = Math.round((menuPrice * Math.round(willingnessToPayMultiplierFor(score) * 100)) / 100);
  const count = businessCustomersToday(saladOnly(score)).target;
  assert(day.served.length === count && day.served.every((x) => x.paid === expected) && pay === expected, `F: popularity ${score}: ${count} customers (frequency), each paying ${expected}c = menu ${menuPrice}c × ${willingnessToPayMultiplierFor(score)} (WTP only — no ×${orderFrequencyMultiplierFor(score)} in the payment)`);
  assert(day.save.business.finance.dailyAccumulator.revenue === count * expected, `F2: today's revenue = ${count} × ${expected}c exactly`);
}

// ===== G: reload. =====
{
  const part = playDay(saladOnly(50), 3);
  const reloaded = JSON.parse(JSON.stringify(part.save)) as SaveData;
  const a = businessCustomersToday(part.save);
  const b = businessCustomersToday(reloaded);
  assert(JSON.stringify(a) === JSON.stringify(b) && b.served === 3 && b.target === 8 && b.remaining === 5, "G: target 8, 3 served, 5 remaining survive a save/reload unchanged");
  const rand = makeSeededRand(businessServiceSeedFor(reloaded.business.calendar.businessDay));
  const resumed = businessServiceSessionForToday(reloaded, rand)!;
  // Without resuming, a reload would rebuild the day's queue from its seed and greet the day's FIRST customer
  // again; businessServiceSessionForToday skips the 3 positions already served.
  const naive = createBusinessServiceSession(makeSeededRand(businessServiceSeedFor(1)), reloaded.business.menuActivation);
  assert(naive.current?.customer.name === part.served[0]!.customer && resumed.current?.customer.name !== part.served[0]!.customer, `G2: after reload the counter resumes past the served customers — a naive restart would greet ${part.served[0]!.customer} again, the resumed queue greets ${resumed.current?.customer.name}`);
  const rest = playDay(reloaded);
  const all = [...part.served, ...rest.served];
  assert(rest.served.length === 5 && new Set(all.map((x) => x.orderId)).size === 8 && businessCustomersToday(rest.save).complete, "G3: after reload exactly the 5 remaining customers are served (8 distinct orders in total) — reload grants no extra customers");
}

// ===== H: End Business Day. =====
{
  const day = playDay(saladOnly(30));
  assert(day.served.length === 6, "H: popularity 30 -> 6 customers served on day 1");
  const closed = endBusinessDay(day.save);
  const next = businessCustomersToday(closed.save);
  assert(closed.save.business.finance.dailyAccumulator.ordersServed === 0 && next.served === 0 && closed.save.business.calendar.businessDay === 2, "H2: End Business Day resets ordersServed for the new day");
  assert(next.popularity === closed.popularityScore && next.target === Math.round(8 * orderFrequencyMultiplierFor(closed.popularityScore)) && next.target !== 6, `H3: day 2's target comes from day 2's starting popularity (${closed.popularityScore} -> ${next.target} customers, was 6)`);
}

// ===== I: Campaign isolation + V2 freeze. =====
{
  const start = { ...saladOnly(50), levelProgress: DEFAULT_SAVE.levelProgress, recipeProgress: { "camp-garlic-bread": { best: 91 } } as never };
  const day = playDay(start);
  const closed = endBusinessDay(day.save).save;
  const nonBusiness = (x: SaveData) => JSON.stringify(Object.fromEntries(Object.entries({ ...x, economy: { ...x.economy, lifetime: {} } }).filter(([k]) => !["business", "credits", "economyLedger"].includes(k))));
  assert(nonBusiness(day.save) === nonBusiness(start) && nonBusiness(closed) === nonBusiness(start), "I: a full Business Day (to the customer limit) and its close change no Campaign field");
  for (const f of ["src/game/service/ServiceManager.ts", "src/game/service/CustomerOrderManager.ts", "src/game/economy/EconomySettlement.ts", "src/game/recipes/recipePay.ts"]) {
    assert(!/orderFrequency|BASE_CUSTOMERS_PER_DAY|businessCustomersToday/.test(read(f)), `I2: ${f} has no order-frequency reference — Campaign/shared order logic unchanged`);
  }
  const users = fs.readdirSync(path.resolve(ROOT, "src"), { recursive: true } as { recursive: true })
    .map(String).filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => /orderFrequencyMultiplierFor\(/.test(read(path.join("src", f))))
    .map((f) => f.replace(/\\/g, "/")).sort();
  assert(JSON.stringify(users) === JSON.stringify(["game/business/BusinessServiceManager.ts", "game/business/DemandManager.ts"]), `I3: orderFrequencyMultiplierFor is defined once and applied at exactly one place (${users.join(", ")})`);
  const v2 = spawnSync("npx", ["tsx", JSON.stringify(path.resolve(import.meta.dirname, "economy-v2-campaign-simulation.mts"))], { encoding: "utf8", shell: true });
  const honest = v2.stdout.slice(v2.stdout.indexOf("SIMULATION HONEST"), v2.stdout.indexOf("Total net campaign result") + 60);
  const has = (label: string, value: string) => new RegExp(`${label}:\\s*${value}(?![\\d,])`).test(honest);
  assert(v2.status === 0 && has("Gross recipe revenue", "\\$165,140\\.00") && has("Level-completion rewards", "\\$77,581\\.00") && has("Total COGS", "\\$37,620\\.00") && has("Total quality bonuses", "\\$3,315\\.00") && has("Total net campaign result", "\\$208,416\\.00"), "I4: Economy V2 freeze exact — $165,140.00 / $77,581.00 / $37,620.00 / $3,315.00 / $208,416.00 (V2.5 completion rewards)");
}

// ===== J: ledger. =====
{
  const day = playDay(saladOnly(75));
  const rev = day.save.economyLedger.filter((e) => e.category === "business-revenue");
  assert(day.served.length === 10 && rev.length === 10 && rev.every((e, i) => e.amount === day.served[i]!.paid) && day.save.economyLedger.length === 10, "J: exactly one revenue entry per served order (10 at popularity 75), each for the amount paid, and nothing else");
  const opening = saladOnly(75).credits;
  assert(opening + rev.reduce((s, e) => s + e.amount, 0) === day.save.credits, "J2: opening cash + revenue entries = closing cash");
  const refused = serveBusinessOrder(recordBusinessServiceComponents(businessServiceSessionForToday(saladOnly(75), makeSeededRand(2))!, 80), day.save, makeSeededRand(2));
  assert(refused === null && day.save.economyLedger.length === 10, "J3: reaching the limit creates no ledger entry");
  const app = read("src/App.tsx");
  const adv = app.slice(app.indexOf("function advanceBusinessServiceQueue("), app.indexOf("\n  }\n", app.indexOf("function advanceBusinessServiceQueue(")));
  assert(!/appendLedgerEntry|persist\(/.test(adv), "J4: Next Customer (including at the limit) never writes the ledger or the save");
}

// ===== K: determinism. =====
{
  const a = playDay(saladOnly(60));
  const b = playDay(JSON.parse(JSON.stringify(saladOnly(60))) as SaveData);
  // Order ids embed Date.now() + a global counter (shared CustomerOrderManager, unchanged) — unique, never
  // reproducible — so determinism is checked on the customer sequence itself: who, what, and what they paid.
  const sig = (d: typeof a) => JSON.stringify(d.served.map((x) => [x.customer, x.dishId, x.paid]));
  assert(a.served.length === 9 && sig(a) === sig(b), "K: same save + same seed + same Business Day -> the same customer sequence (9 customers at popularity 60)");
  const mid = playDay(saladOnly(60), 4).save;
  const r1 = businessServiceSessionForToday(mid, makeSeededRand(businessServiceSeedFor(1)))!;
  const r2 = businessServiceSessionForToday(JSON.parse(JSON.stringify(mid)) as SaveData, makeSeededRand(businessServiceSeedFor(1)))!;
  const who = (x: ServiceSession) => JSON.stringify([x.current?.customer.name, x.current?.recipe.id, x.next?.customer.name, x.next?.recipe.id]);
  assert(who(r1) === who(r2) && businessDishForRecipeId(r1.current!.recipe.id)?.id === SALAD.id, "K2: the resumed queue after a reload is itself deterministic");
}

// ===== U: UI wording / wiring. =====
{
  const service = read("src/components/kc/business/BusinessService.tsx");
  const dash = read("src/components/kc/business/BusinessDashboard.tsx");
  const card = read("src/components/kc/game/ServiceOrderComplete.tsx");
  assert(/Customers Today/.test(service) && /served/.test(service) && /remaining/.test(service) && /Today's customers are complete\./.test(service) && /No more customers will arrive today/.test(service), "U: the Service screen shows Customers Today (served / target, remaining) and the completion message");
  assert(/Customers Today/.test(dash) && /Today's target/.test(dash) && /BASE_CUSTOMERS_PER_DAY/.test(dash) && /Today's customers are complete\./.test(dash), "U2: the Dashboard shows today's target and explains it (popularity × multiplier of the base)");
  assert(/businessCustomers\?\.complete \? null/.test(card) && /No more customers will arrive today/.test(card), "U3: the served card hides Next Customer once today's customers are complete");
}

console.log(failures === 0 ? "\nBUSINESS ORDER FREQUENCY QA: ALL PASS" : `\nBUSINESS ORDER FREQUENCY QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
