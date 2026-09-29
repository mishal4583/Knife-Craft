/**
 * BUSINESS_WTP_QA — Economy V3 Phase 16, willingness-to-pay (WTP).
 * A Business customer pays:
 *   customerPays = roundToCents(menuPrice × willingnessToPayMultiplierFor(clamp(popularity, 0, 100)))
 * applied only in BusinessServiceManager.serveBusinessOrder (via
 * businessCustomerPayment). Verifies, against the real production functions:
 *   A. exact multipliers at 0/20/40/50/60/80/100
 *   B. exact payments at representative prices (incl. half-cent cases)
 *   C/D/E. popularity 0 / 50 / 100 pay 90% / 105% / 120% of menu price
 *   F. a $0 dish stays $0
 *   G. payment happens exactly once
 *   H. exactly one business-revenue ledger entry
 *   I. Finance revenue receives the customer payment
 *   J. COGS is unchanged by WTP
 *   K. the menu price itself is unchanged
 *   L. popularity is clamped / unsafe values are safe
 *   M. determinism
 *   N. D2 unchanged (serve doesn't move popularity; ordersServed +1; close moves it)
 *   O. end-of-day P&L stays internally consistent
 *   P. Campaign / shared payment path untouched
 *   Q. exact Economy V2 freeze
 *   U. UI text no longer calls the customer payment "the menu price"
 *
 * Run: npx tsx scripts/business-wtp-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { addStock, getQuantity } from "../src/game/business/businessInventory.ts";
import { getBusinessDish, businessDishPrice } from "../src/game/business/businessDishCatalog.ts";
import {
  createBusinessServiceSession,
  recordBusinessServiceComponents,
  serveBusinessOrder,
  businessCustomerPayment,
  popularityForPayment,
} from "../src/game/business/BusinessServiceManager.ts";
import { makeSeededRand } from "../src/game/business/businessDeterministicRandom.ts";
import { willingnessToPayMultiplierFor } from "../src/game/business/DemandManager.ts";
import { setMenuPrice } from "../src/game/business/BusinessMenuManager.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import { endOfDayPopularity } from "../src/game/business/PopularityManager.ts";
import { serveCurrentOrder, createServiceSession, recordAllComponents } from "../src/game/service/ServiceManager.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
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

// Garden Salad: tomato + cucumber + carrot, 1 each; stocked at 100c/unit -> real COGS 300c per plate.
const SALAD = getBusinessDish("biz-garden-salad")!;
const SALAD_RECIPE = SALAD.sourceRecipeId;

function stocked(score: number, overrides: Partial<SaveData> = {}, menu: Record<string, number> = {}): SaveData {
  let inv = addStock({}, "tomato", 20, 100, 1);
  inv = addStock(inv, "cucumber", 20, 100, 1);
  inv = addStock(inv, "carrot", 20, 100, 1);
  return {
    ...DEFAULT_SAVE,
    credits: 10_000,
    economyLedger: [],
    ...overrides,
    business: { ...DEFAULT_BUSINESS_STATE, calendar: { businessDay: 1 }, inventory: inv, menu, popularity: { score } },
  };
}

function readySalad(): ServiceSession {
  for (let seed = 1; seed < 400; seed++) {
    const s = createBusinessServiceSession(makeSeededRand(seed));
    if (s.current?.recipe.id === SALAD_RECIPE) return recordBusinessServiceComponents(s, 80);
  }
  throw new Error("QA precondition failed: no seed produced a Garden Salad order");
}

/** Mirrors App.tsx's serveActiveBusinessOrder: the pure serve, then the one ledger append of result.amountCharged. */
function serveViaApp(save: SaveData) {
  const r = serveBusinessOrder(readySalad(), save, makeSeededRand(1));
  if (!r) return null;
  return { r, save: appendLedgerEntry(r.save, "business-revenue", r.amountCharged, r.dish.id) };
}

function withPrice(save: SaveData, price: number): SaveData {
  const r = setMenuPrice(save, SALAD_RECIPE, price);
  if (!r.ok) throw new Error("QA precondition failed: price not set");
  return r.save;
}

// ===== A: exact multipliers. =====
{
  const expected: [number, number][] = [[0, 0.9], [20, 0.96], [40, 1.02], [50, 1.05], [60, 1.08], [80, 1.14], [100, 1.2]];
  for (const [score, m] of expected) {
    const p = businessCustomerPayment(stocked(score), SALAD);
    assert(willingnessToPayMultiplierFor(score) === m && p.multiplier === m && p.popularity === score, `A: popularity ${score} -> ×${m.toFixed(2)} (the existing function, read unchanged)`);
  }
}

// ===== B: exact payments at representative prices (round to cents once, half-up). =====
{
  const cases: [number, number, number, string][] = [
    [667, 50, 700, "$6.67 × 1.05 = $7.0035 -> $7.00"],
    [667, 0, 600, "$6.67 × 0.90 = $6.003 -> $6.00"],
    [667, 100, 800, "$6.67 × 1.20 = $8.004 -> $8.00"],
    [810, 50, 851, "$8.10 × 1.05 = $8.505 -> $8.51 (half-up)"],
    [1000, 20, 960, "$10.00 × 0.96 = $9.60"],
    [1999, 60, 2159, "$19.99 × 1.08 = $21.5892 -> $21.59"],
    [1075, 12, 1011, "$10.75 × 0.94 = $10.105 -> $10.11 (exact half-cent; naive floating point gives $10.10)"],
    [50, 75, 57, "$0.50 × 1.13 = $0.565 -> $0.57 (exact half-cent; naive floating point gives $0.56)"],
    [1, 50, 1, "$0.01 × 1.05 -> $0.01"],
  ];
  for (const [price, score, pays, label] of cases) {
    const p = businessCustomerPayment(withPrice(stocked(score), price), SALAD);
    assert(p.menuPrice === price && p.customerPays === pays, `B: ${label} (got ${p.customerPays})`);
  }
}

// ===== C / D / E: popularity 0, 50, 100 through a REAL serve. =====
for (const [score, pct, tag] of [[0, 90, "C"], [50, 105, "D"], [100, 120, "E"]] as const) {
  for (const price of [1000, 2000, 667]) {
    const served = serveViaApp(withPrice(stocked(score), price))!;
    const exact = Math.round((price * pct) / 100);
    assert(served.r.amountCharged === exact && served.save.credits === 10_000 + exact, `${tag}: popularity ${score} pays ${pct}% of a ${price}c menu price = ${exact}c (got ${served.r.amountCharged})`);
  }
}

// ===== F: a $0 dish stays $0. =====
for (const score of [0, 50, 100]) {
  const save = withPrice(stocked(score), 0);
  const served = serveViaApp(save)!;
  assert(!!served && served.r.payment.menuPrice === 0 && served.r.amountCharged === 0 && served.save.credits === save.credits, `F: a $0 dish at popularity ${score} is served for $0 — cash unchanged`);
  assert(served.save.business.finance.dailyAccumulator.revenue === 0 && served.save.business.finance.dailyAccumulator.ordersServed === 1, `F2: the $0 serve records $0 revenue and still counts as served (popularity ${score})`);
}

// ===== G: payment happens exactly once. =====
{
  const save = stocked(80);
  const first = serveBusinessOrder(readySalad(), save, makeSeededRand(1))!;
  const again = serveBusinessOrder(first.session, first.save, makeSeededRand(1));
  assert(first.session.current?.order.status !== "READY" && again === null, "G: the same order can't be served (or paid) a second time");
  assert(first.save.credits - save.credits === first.amountCharged, "G2: credits moved by exactly one customer payment");
}

// ===== H: exactly one business-revenue ledger entry, for the customer payment. =====
{
  const served = serveViaApp(stocked(60))!;
  const rev = served.save.economyLedger.filter((e) => e.category === "business-revenue");
  assert(rev.length === 1 && rev[0]!.amount === served.r.payment.customerPays && served.save.economyLedger.length === 1, `H: exactly one business-revenue entry of ${served.r.payment.customerPays}c and nothing else`);
  const app = fs.readFileSync(path.resolve(import.meta.dirname, "..", "src", "App.tsx"), "utf8");
  const sites = app.match(/appendLedgerEntry\([^)]*"business-revenue"[^)]*\)/g) ?? [];
  assert(sites.length === 1 && /"business-revenue", result\.amountCharged,/.test(sites[0]!), `H2: App.tsx appends business-revenue at exactly one call site, from result.amountCharged (found ${sites.length})`);
}

// ===== I: Finance receives the customer payment. =====
{
  const save = withPrice(stocked(100), 1500);
  const served = serveViaApp(save)!;
  const f = served.save.business.finance;
  assert(served.r.amountCharged === 1800 && f.dailyAccumulator.revenue === 1800 && f.lifetime.revenue - save.business.finance.lifetime.revenue === 1800 && f.lifetime.orderCount - save.business.finance.lifetime.orderCount === 1, "I: today's and lifetime revenue both gain exactly the 1800c customer payment ($15.00 × 1.20)");
}

// ===== J: COGS is unchanged by WTP. =====
{
  const lo = serveViaApp(stocked(0))!;
  const hi = serveViaApp(stocked(100))!;
  assert(lo.r.cogsCharged === 300 && hi.r.cogsCharged === 300 && lo.save.business.finance.dailyAccumulator.cogs === hi.save.business.finance.dailyAccumulator.cogs, "J: COGS is 300c (real ingredient cost) at popularity 0 and 100 alike");
  assert(JSON.stringify(lo.save.business.inventory) === JSON.stringify(hi.save.business.inventory) && getQuantity(lo.save.business.inventory, "tomato") === 19, "J2: inventory consumption is identical regardless of the multiplier");
  assert(lo.r.amountCharged !== hi.r.amountCharged, "J3: only the customer payment differs");
}

// ===== K: the menu price itself is unchanged. =====
{
  const save = withPrice(stocked(90), 1234);
  const served = serveViaApp(save)!;
  assert(JSON.stringify(served.save.business.menu) === JSON.stringify(save.business.menu) && businessDishPrice(served.save.business.menu, SALAD) === 1234 && served.r.payment.menuPrice === 1234, "K: the menu price stays 1234c — only what the customer pays is multiplied");
}

// ===== L: popularity clamped; unsafe values are safe. =====
{
  const at = (score: unknown) => businessCustomerPayment({ ...stocked(50), business: { ...stocked(50).business, popularity: { score: score as number } } }, SALAD);
  assert(at(-20).customerPays === at(0).customerPays && at(-20).popularity === 0, "L: a negative popularity pays exactly like 0");
  assert(at(150).customerPays === at(100).customerPays && at(150).popularity === 100, "L2: popularity above 100 pays exactly like 100");
  assert(at(-Infinity).popularity === 0 && at(Infinity).popularity === 100, "L3: ±Infinity clamp to 0 / 100");
  for (const bad of [NaN, undefined, null, "80", {}]) {
    const p = at(bad);
    assert(Number.isFinite(p.customerPays) && Number.isInteger(p.customerPays) && p.popularity === 50 && p.multiplier === willingnessToPayMultiplierFor(50), `L4: unsafe popularity ${typeof bad === "string" ? JSON.stringify(bad) : bad !== null && typeof bad === "object" ? "{}" : String(bad)} falls back to the default 50 — a finite whole-cent payment`);
  }
  assert(popularityForPayment(42.6) === 43 && popularityForPayment(NaN) === 50, "L5: fractional scores round like the existing clamp; NaN falls back to 50");
  const corrupt = { ...stocked(50), business: { ...stocked(50).business, popularity: { score: NaN } } };
  const served = serveViaApp(corrupt)!;
  assert(Number.isFinite(served.save.credits) && served.save.credits === corrupt.credits + served.r.amountCharged, "L6: a corrupt saved popularity can't corrupt cash on a real serve");
  const noPop = { ...stocked(50), business: { ...stocked(50).business, popularity: undefined as never } };
  assert(Number.isFinite(businessCustomerPayment(noPop, SALAD).customerPays), "L7: a save with no popularity object at all still pays a finite amount");
}

// ===== M: determinism. =====
{
  const a = serveViaApp(withPrice(stocked(37), 1111))!;
  const b = serveViaApp(JSON.parse(JSON.stringify(withPrice(stocked(37), 1111))) as SaveData)!;
  assert(a.r.amountCharged === b.r.amountCharged && JSON.stringify(a.r.payment) === JSON.stringify(b.r.payment), `M: same popularity + same menu price -> the same payment (${a.r.amountCharged}c), also after a save/reload round-trip`);
}

// ===== N: D2 unchanged. =====
{
  const save = stocked(70);
  const served = serveViaApp(save)!;
  assert(served.r.popularityDelta === 0 && served.save.business.popularity.score === 70, "N: serving does not change popularity");
  assert(served.save.business.finance.dailyAccumulator.ordersServed === 1, "N2: ordersServed increments exactly once");
  const expected = endOfDayPopularity(served.save, endBusinessDay(served.save).inspectionReport.overall, 1);
  const closed = endBusinessDay(served.save);
  assert(closed.popularityScore === expected.score && closed.popularityBreakdown.service === 3, "N3: popularity changes only at End Business Day, by the unchanged D2 formula");
}

// ===== O: end-of-day P&L stays internally consistent with WTP revenue. =====
{
  let save = withPrice(stocked(80), 1500);
  const opening = save.credits;
  const payments: number[] = [];
  for (let i = 0; i < 3; i++) {
    const s = serveViaApp(save)!;
    payments.push(s.r.amountCharged);
    save = s.save;
  }
  const end = endBusinessDay(save);
  const p = end.dailyPnL;
  const revenueLedger = save.economyLedger.filter((e) => e.category === "business-revenue").reduce((a, e) => a + e.amount, 0);
  assert(payments.every((x) => x === 1710) && p.revenue === 3 * 1710 && revenueLedger === p.revenue, "O: P&L revenue = the three 1710c customer payments = the revenue ledger entries");
  assert(p.cogs === 900 && p.grossProfit === p.revenue - p.cogs && p.operatingProfit === p.grossProfit - p.staffCost - p.maintenanceCost - p.supplierCost - p.otherOperatingCost - p.inspectionFines, "O2: COGS 900c; gross and operating profit follow the unchanged P&L formulas");
  const closedSave = appendLedgerEntry(appendLedgerEntry(end.save, "business-staff-salary", -end.payrollPaid), "inspection-fine", -end.inspectionFine.finePaid);
  const ledgerSum = closedSave.economyLedger.reduce((a, e) => a + e.amount, 0);
  assert(opening + ledgerSum === closedSave.credits && p.openingCash === opening, "O3: opening cash + signed ledger = closing cash");
}

// ===== P: Campaign / shared payment path untouched. =====
{
  const recipe = getCampaignRecipe("camp-garlic-bread")!;
  let session = createServiceSession("qa-campaign", [recipe], makeSeededRand(3));
  session = recordAllComponents(session, 80);
  const paid = serveCurrentOrder(session, makeSeededRand(3), 321);
  assert(!!paid && paid.coinsAwarded === 321, "P: the shared serveCurrentOrder still pays exactly the amount it is given (no multiplier inside it)");
  const shared = ["src/game/service/ServiceManager.ts", "src/game/service/CustomerOrderManager.ts", "src/game/economy/EconomySettlement.ts", "src/game/recipes/recipePay.ts"];
  for (const f of shared) {
    const file = path.resolve(import.meta.dirname, "..", f);
    const src = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    assert(src.length > 0 && !/willingnessToPay|DemandManager|businessCustomerPayment/.test(src), `P2: ${f} has no WTP reference — Campaign/shared payment logic is not multiplied`);
  }
  const users = [...fs.readdirSync(path.resolve(import.meta.dirname, "..", "src"), { recursive: true }) as string[]]
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => /willingnessToPayMultiplierFor\(/.test(fs.readFileSync(path.resolve(import.meta.dirname, "..", "src", f), "utf8")))
    .map((f) => f.replace(/\\/g, "/"));
  assert(JSON.stringify(users.sort()) === JSON.stringify(["game/business/BusinessServiceManager.ts", "game/business/DemandManager.ts"]), `P3: willingnessToPayMultiplierFor is defined once and called from exactly one place (${users.join(", ")})`);
  const campaign = { ...stocked(100), levelProgress: DEFAULT_SAVE.levelProgress, recipeProgress: { "camp-garlic-bread": { best: 91 } } as never };
  const after = serveViaApp(campaign)!;
  const nonBusiness = (x: SaveData) => JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k]) => !["business", "credits", "economyLedger"].includes(k))));
  assert(nonBusiness(after.save) === nonBusiness(campaign), "P4: a WTP serve changes no Campaign field");
}

// ===== Q: exact Economy V2 freeze. =====
{
  const v2 = spawnSync("npx", ["tsx", JSON.stringify(path.resolve(import.meta.dirname, "economy-v2-campaign-simulation.mts"))], { encoding: "utf8", shell: true });
  const honest = v2.stdout.slice(v2.stdout.indexOf("SIMULATION HONEST"), v2.stdout.indexOf("Total net campaign result") + 60);
  const has = (label: string, value: string) => new RegExp(`${label}:\\s*${value}(?![\\d,])`).test(honest);
  assert(v2.status === 0 && has("Gross recipe revenue", "\\$165,140\\.00") && has("Level-completion rewards", "\\$77,581\\.00") && has("Total COGS", "\\$37,620\\.00") && has("Total quality bonuses", "\\$3,315\\.00") && has("Total net campaign result", "\\$208,416\\.00"), "Q: Economy V2 freeze exact — $165,140.00 / $77,581.00 / $37,620.00 / $3,315.00 / $208,416.00 (V2.5 completion rewards)");
}

// ===== U: UI wording — the customer payment is never called simply "the menu price". =====
{
  const read = (f: string) => fs.readFileSync(path.resolve(import.meta.dirname, "..", "src", "components", "kc", f), "utf8");
  const ui = ["business/BusinessService.tsx", "business/BusinessMenu.tsx", "business/BusinessDashboard.tsx", "game/ServiceOrderComplete.tsx"].map(read).join("\n");
  assert(!/pays your menu price and|at your menu prices\./i.test(ui), "U: no Business screen says serving 'pays your menu price'");
  assert(/BusinessPaymentLines payment=\{payment\}/.test(read("business/BusinessService.tsx")) && /BusinessPaymentLines payment=\{served\.businessPayment\} paid/.test(read("game/ServiceOrderComplete.tsx")), "U2: the Service screen and the served card both show Menu Price × Modifier = Customer Pays");
  const lines = read("business/BusinessPaymentLines.tsx");
  assert(["Menu Price", "Popularity", "Customer Modifier", "Customer Pays", "Customer Paid"].every((t) => lines.includes(t)), "U3: the breakdown names Menu Price, Popularity, Customer Modifier and Customer Pays/Paid");
}

console.log(failures === 0 ? "\nBUSINESS WTP QA: ALL PASS" : `\nBUSINESS WTP QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
