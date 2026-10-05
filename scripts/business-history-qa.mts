/**
 * BUSINESS HISTORY QA — the 30-day restaurant history (task #10,
 * business/businessDayHistory.ts): the latest 30 completed days, each copied
 * from that day's own settlement (End Business Day's DailyPnL + its order
 * count), stored in the optional `business.finance.history`.
 *
 *  H1 first day: one record, equal to the day's DailyPnL (revenue, costs,
 *     profit, waste, purchases, cash) and its orders; average order value.
 *  H2 several days: oldest first, consecutive day numbers.
 *  H3 30 days: exactly 30 kept.  H4 the 31st drops the oldest.
 *  H5 save → load (the real SaveManager) keeps it.
 *  H6 an existing save without history loads with an empty history, money,
 *     ledger and lifetime untouched; no ledger entry is turned into a record.
 *  H7 wallet and ledger are exactly what they'd be without the history
 *     (End Business Day with 0 vs 30 stored days: same credits, same ledger).
 *  H8 restaurant build: the specialist chefs' wages, paid right after End
 *     Business Day, are added to that day's wages, costs, profit and cash.
 *  H9 a malformed stored history is cleaned on load (bad records dropped,
 *     latest 30 kept).  H10 wiring: one writer (closeBusinessDay), the
 *     Operations tab shows it, nothing in the module moves money.
 *
 * Run: npx tsx scripts/business-history-qa.mts
 */
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import fs from "node:fs";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import { playDay } from "./restaurant-endless-qa.mts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import {
  HISTORY_DAYS,
  dayHistoryOf,
  dayRecordFrom,
  sanitizeDayHistory,
  type BusinessDayRecord,
} from "../src/game/business/businessDayHistory.ts";
import { paySpecialists } from "../src/game/restaurant/staffRequirements.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const STORAGE_KEY = "knifecraft.save.v1";
async function loadRaw(raw: object): Promise<SaveData> {
  memoryStore.clear();
  memoryStore.set(STORAGE_KEY, JSON.stringify(raw));
  (SaveManager as unknown as { cache: SaveData | null }).cache = null;
  return SaveManager.load();
}
const start = (): SaveData => ({
  ...(structuredClone(DEFAULT_SAVE) as SaveData),
  credits: 2_000_000,
});
function days(n: number, from = start()): SaveData {
  let s = from;
  for (let i = 0; i < n; i++) s = playDay(s).save;
  return s;
}

console.log("H1. The first day");
{
  const s0 = start();
  // Run the day through playDay, but keep the day's own P&L from End Business Day.
  const s1 = playDay(s0).save;
  const h = dayHistoryOf(s1);
  const pnl = s1.business.finance.lastDailyPnL!;
  const r = h[0]!;
  assert(dayHistoryOf(s0).length === 0, "H1a: a new save has an empty history");
  assert(
    h.length === 1 &&
      r.day === 1 &&
      r.revenue === pnl.revenue &&
      r.goodsUsed === pnl.cogs &&
      r.staffWages === pnl.staffCost &&
      r.inspectionFines === pnl.inspectionFines &&
      r.profit === pnl.operatingProfit &&
      r.profit === r.revenue - r.totalCosts &&
      r.waste === pnl.spoilageValue &&
      r.ingredientPurchases === pnl.inventoryPurchaseCost &&
      r.netCash === pnl.netCashChange &&
      r.ordersServed > 0 &&
      r.customersServed === r.ordersServed &&
      r.averageOrderValue === Math.round(r.revenue / r.ordersServed),
    `H1b: one record, copied from the day's settlement — Day 1: ${r.ordersServed} orders, revenue ${r.revenue}¢, costs ${r.totalCosts}¢, profit ${r.profit}¢`,
  );
  const empty = dayRecordFrom(3, pnl, 0);
  assert(empty.averageOrderValue === null, "H1c: no orders → no average order value");
}

console.log("H2–H4. Several days, 30 days, the 31st");
{
  const three = days(3);
  const h3 = dayHistoryOf(three);
  assert(
    h3.length === 3 && h3.map((d) => d.day).join() === "1,2,3",
    "H2: three days, oldest first, consecutive day numbers",
  );
  const thirty = days(30);
  assert(
    dayHistoryOf(thirty).length === HISTORY_DAYS && dayHistoryOf(thirty)[0]!.day === 1,
    "H3: 30 days are all kept",
  );
  const thirtyOne = playDay(thirty).save;
  const h31 = dayHistoryOf(thirtyOne);
  assert(
    h31.length === 30 && h31[0]!.day === 2 && h31[29]!.day === 31,
    "H4: the 31st day drops the oldest (days 2–31 kept)",
  );

  console.log("H5. Save and load");
  await SaveManager.save(thirtyOne);
  (SaveManager as unknown as { cache: SaveData | null }).cache = null;
  const back = await SaveManager.load();
  assert(
    JSON.stringify(dayHistoryOf(back)) === JSON.stringify(h31) &&
      back.credits === thirtyOne.credits,
    "H5: the history survives save → load unchanged",
  );

  console.log("H7. Wallet and ledger unchanged by the history");
  const withHistory = endBusinessDay(thirty).save;
  const noHistory = endBusinessDay({
    ...thirty,
    business: { ...thirty.business, finance: { ...thirty.business.finance, history: undefined } },
  }).save;
  assert(
    withHistory.credits === noHistory.credits &&
      JSON.stringify(withHistory.economyLedger) === JSON.stringify(noHistory.economyLedger) &&
      JSON.stringify(withHistory.business.finance.lastDailyPnL) ===
        JSON.stringify(noHistory.business.finance.lastDailyPnL) &&
      JSON.stringify(withHistory.business.finance.lifetime) ===
        JSON.stringify(noHistory.business.finance.lifetime),
    "H7: End Business Day gives the same credits, ledger, P&L and lifetime totals with or without a stored history",
  );
}

console.log("H6. An existing save without history");
{
  const old = days(2);
  const stripped = JSON.parse(JSON.stringify(old)) as SaveData;
  delete (stripped.business.finance as { history?: unknown }).history;
  const loaded = await loadRaw(stripped);
  assert(
    dayHistoryOf(loaded).length === 0 &&
      loaded.credits === old.credits &&
      loaded.economyLedger.length === old.economyLedger.length &&
      JSON.stringify(loaded.business.finance.lifetime) ===
        JSON.stringify(old.business.finance.lifetime),
    "H6: loads with an empty history; money, ledger and lifetime totals untouched (no record built from old entries)",
  );
  const next = playDay(loaded).save;
  assert(dayHistoryOf(next).length === 1, "H6b: its next completed day starts the history");
}

console.log("H8. Specialist chefs' wages (restaurant build)");
{
  const s = days(1);
  const at95 = {
    ...s,
    levelProgress: {
      ...s.levelProgress,
      currentLevelId: "level-95",
      highestUnlockedLevelId: "level-95",
      completedLevelIds: Array.from({ length: 94 }, (_, i) => `level-${i + 1}`),
    },
    business: { ...s.business, restaurantStaff: { specialists: ["indian-chef"] } },
  } as SaveData;
  const before = dayHistoryOf(at95).at(-1)!;
  const paid = paySpecialists(at95, 95);
  const after = dayHistoryOf(paid.save).at(-1)!;
  assert(
    paid.paid > 0 &&
      after.staffWages === before.staffWages + paid.paid &&
      after.totalCosts === before.totalCosts + paid.paid &&
      after.profit === before.profit - paid.paid &&
      after.netCash === before.netCash - paid.paid &&
      after.profit === after.revenue - after.totalCosts &&
      paid.save.credits === at95.credits - paid.paid,
    `H8: the ${paid.paid}¢ specialist wage is part of that day's wages, costs, profit and cash`,
  );
  const none = paySpecialists(start(), 95);
  assert(dayHistoryOf(none.save).length === 0, "H8b: no record → nothing to add to");
}

console.log("H9. A malformed stored history");
{
  const good = dayHistoryOf(days(1))[0]!;
  const many: BusinessDayRecord[] = Array.from({ length: 35 }, (_, i) => ({ ...good, day: i + 1 }));
  const raw = [...many, { day: "x" }, null, { ...good, revenue: Number.NaN }];
  const clean = sanitizeDayHistory(raw)!;
  assert(
    clean.length === 30 && clean[0]!.day === 6 && clean.every((d) => Number.isFinite(d.revenue)),
    "H9: bad records dropped, the latest 30 kept",
  );
  assert(
    sanitizeDayHistory(undefined) === undefined && sanitizeDayHistory("nope") === undefined,
    "H9b: none stored → none",
  );
}

console.log("H10. Wiring");
{
  const fin = fs.readFileSync("src/game/business/BusinessFinanceManager.ts", "utf8");
  const mod = fs
    .readFileSync("src/game/business/businessDayHistory.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const dash = fs.readFileSync("src/components/kc/business/BusinessDashboard.tsx", "utf8");
  const writers = (fin.match(/withDayRecord\(/g) ?? []).length;
  assert(
    writers === 1 && /history: withDayRecord\(save\.business\.finance\.history, record\)/.test(fin),
    "H10a: closeBusinessDay is the one writer",
  );
  assert(
    !/appendLedgerEntry|debitWallet|credits:|Math\.random|RESTAURANT_MODE/.test(mod),
    "H10b: the module moves no money and writes no ledger entry",
  );
  assert(
    /<BusinessHistory save=\{save\} \/>/.test(dash),
    "H10c: Restaurant → Operations shows the history",
  );
}

console.log(
  failures ? `BUSINESS HISTORY QA: ${failures} FAILURE(S)` : "BUSINESS HISTORY QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
