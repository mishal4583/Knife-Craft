/**
 * USD CURRENCY QA — the whole game uses ONE currency, US dollars.
 *
 *  A. The one formatter (money.ts) — exact expected strings.
 *  B. Campaign prices are the old numbers read as dollars (Santoku $350.00…).
 *  C. Blacksmith + sharpening costs (one full-price path, no video discount).
 *  D. Campaign rewards/settlement are the old numbers read as dollars —
 *     checked against the whole-dollar formulas for every one of the 250 levels.
 *  E. Business Mode amounts are unchanged (already cents).
 *  F. Save migration v1 → v2: Campaign-only, Business-only and mixed wallets,
 *     ledger history, Endless counter, never twice, save → reload round trip.
 *  G. No coin/cent wording or bare money numbers left in player-facing UI.
 *  H. Ledger reconciliation after mixed activity.
 *
 * Run: npx tsx scripts/usd-currency-qa.mts
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
import path from "node:path";
import { dollars, formatUsd, formatUsdChange } from "../src/game/money.ts";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import { migrateMoneyToUsd, USD_SAVE_VERSION } from "../src/game/economy/usdMigration.ts";
import { KNIFE_CATALOG } from "../src/game/knives/knifeDefinitions.ts";
import { BOARD_CATALOG } from "../src/game/boards/boardDefinitions.ts";
import { STAFF_CATALOG } from "../src/game/economy/staffDefinitions.ts";
import { buyKnife } from "../src/game/knives/KnifeManager.ts";
import { upgradeCost, upgradeKnife } from "../src/game/knives/blacksmith.ts";
import { SHARPEN_COST } from "../src/game/economy/sharpness.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import { completeLevel, DEFAULT_LEVEL_PROGRESS } from "../src/game/levels/LevelManager.ts";
import { computeSettlement } from "../src/game/economy/EconomySettlement.ts";
import { recipePay } from "../src/game/recipes/recipePay.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { createCustomerOrder } from "../src/game/service/CustomerOrderManager.ts";
import { DAILY_ORDER_BONUS_COINS } from "../src/game/daily/DailyOrderManager.ts";
import { ENDLESS_DAILY_COIN_CAP } from "../src/game/daily/EndlessServiceManager.ts";
import { appendLedgerEntry, ledgerTotals } from "../src/game/economy/EconomyLedger.ts";
import { REFRIGERATOR_CATALOG } from "../src/game/business/refrigeratorDefinitions.ts";

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

// ===== A: formatter =====
{
  const cases: Array<[number, string]> = [
    [0, "$0.00"], [dollars(61), "$61.00"], [dollars(80), "$80.00"], [21519, "$215.19"],
    [dollars(350), "$350.00"], [dollars(2200), "$2,200.00"], [dollars(12450), "$12,450.00"], [dollars(461526), "$461,526.00"],
  ];
  for (const [cents, want] of cases) assert(formatUsd(cents) === want, `A: ${cents} → ${want} (got ${formatUsd(cents)})`);
  assert(formatUsdChange(dollars(223)) === "+$223.00" && formatUsdChange(-dollars(350)) === "−$350.00", "A2: signed changes read +$223.00 / −$350.00");
  assert(dollars(2.49) === 249 && dollars(0.1 + 0.2) === 30 && formatUsd(dollars(215.19)) === "$215.19", "A3: money-safe — no float drift ($215.19 stays $215.19, 0.1+0.2 → $0.30)");
}

// ===== B: Campaign prices =====
{
  const knife = (id: string) => KNIFE_CATALOG.find((k) => k.id === id)!.price;
  assert(formatUsd(knife("santoku")) === "$350.00" && formatUsd(knife("obsidian")) === "$2,200.00", "B: Santoku $350.00, Obsidian Knife $2,200.00");
  const oldKnives: Record<string, number> = { chef: 0, santoku: 350, paring: 500, nakiri: 700, bread: 850, cleaver: 1100, damascus: 1800, obsidian: 2200 };
  assert(KNIFE_CATALOG.every((k) => k.price === dollars(oldKnives[k.id]!)), "B2: every knife is its old price read as dollars");
  const oldBoards: Record<string, number> = { walnut: 0, maple: 300, herb: 500, marble: 750, darkoak: 1000, copper: 1500, butcherblock: 1800, seafoodslate: 2000 };
  assert(BOARD_CATALOG.every((b) => b.price === dollars(oldBoards[b.id]!)), "B3: every board is its old price read as dollars");
  assert(STAFF_CATALOG.map((s) => formatUsd(s.price)).join(" ") === "$3,000.00 $6,000.00 $4,000.00", "B4: staff $3,000 / $6,000 / $4,000");
  assert(DEFAULT_SAVE.credits === dollars(1240) && formatUsd(DEFAULT_SAVE.credits) === "$1,240.00", "B5: a new player starts with $1,240.00");
  const s: SaveData = { ...structuredClone(DEFAULT_SAVE), credits: dollars(350), levelProgress: { ...DEFAULT_SAVE.levelProgress, highestUnlockedLevelId: "level-10" } };
  const r = buyKnife(s, "santoku");
  assert(r.ok && r.save.credits === 0, "B6: $350.00 buys the Santoku exactly, landing on $0.00");
  const short = buyKnife({ ...s, credits: dollars(349.99) }, "santoku");
  assert(!short.ok, "B7: $349.99 is not enough");
}

// ===== C: Blacksmith / sharpening =====
{
  assert([1, 2, 3, 4].map((l) => formatUsd(upgradeCost(l)!)).join(" ") === "$80.00 $160.00 $280.00 $450.00", "C: Blacksmith steps $80 / $160 / $280 / $450");
  assert(upgradeCost.length === 1, "C2: there is no discounted (video) price path — every upgrade is its listed dollar price");
  assert(formatUsd(SHARPEN_COST) === "$50.00", "C3: sharpening costs $50.00");
  const s: SaveData = { ...structuredClone(DEFAULT_SAVE), credits: dollars(80) };
  const up = upgradeKnife(s, "chef", "speed");
  assert(up.ok && up.save.credits === 0 && up.cost === dollars(80), "C4: an $80 upgrade takes exactly $80.00");
}

// ===== D: Campaign rewards + settlement are the old numbers read as dollars =====
{
  let progress = { ...DEFAULT_LEVEL_PROGRESS };
  let allExact = true;
  for (const level of LEVELS) {
    const r = completeLevel(level.id, progress);
    if (r.isFirstCompletion && r.rewardCoins !== level.reward.coins * 100) allExact = false;
    progress = r.progress;
  }
  assert(allExact, "D: all 250 level rewards pay their old amount as dollars (61 → $61.00)");
  const lvl1 = LEVELS[0]!;
  assert(formatUsdChange(completeLevel(lvl1.id, { ...DEFAULT_LEVEL_PROGRESS }).rewardCoins) === `+$${lvl1.reward.coins}.00`, `D2: Level 1 reward reads +$${lvl1.reward.coins}.00`);
  let settleExact = true;
  let checked = 0;
  for (const recipe of CAMPAIGN_RECIPES) {
    for (const chapter of [1, 12, 25]) {
      for (const score of [40, 75, 95]) {
        const st = computeSettlement(recipe, chapter, score);
        checked++;
        if (st.revenue !== dollars(recipePay(recipe, chapter))) settleExact = false;
        if (st.netResult !== st.revenue - st.finalCOGS + st.qualityBonus && st.netResult !== 0) settleExact = false;
        if (st.revenue % 100 !== 0 || st.finalCOGS % 100 !== 0 || st.qualityBonus % 100 !== 0) settleExact = false;
      }
    }
  }
  assert(settleExact, `D3: ${checked} settlements — revenue is recipePay in dollars, every amount is whole dollars, net = revenue − COGS + bonus`);
  const order = createCustomerOrder("c1", CAMPAIGN_RECIPES[0]!, 3);
  assert(order.basePayment === dollars(recipePay(CAMPAIGN_RECIPES[0]!, 3)), "D4: an order's payment is its recipe pay in dollars");
  assert(formatUsd(DAILY_ORDER_BONUS_COINS) === "$50.00" && formatUsd(ENDLESS_DAILY_COIN_CAP) === "$600.00", "D5: Daily bonus $50.00, Endless daily limit $600.00");
}

// ===== E: Business unchanged (already cents) =====
{
  const fridge = REFRIGERATOR_CATALOG.map((f) => f.price);
  assert(fridge.every((p) => Number.isInteger(p)) && formatUsd(fridge[0]!) === formatUsd(REFRIGERATOR_CATALOG[0]!.price), "E: Business prices are used as-is (integer cents)");
  assert(/export \{ formatUsd \} from "\.\.\/money";/.test(read("src/game/business/businessCurrency.ts")), "E2: Business screens use the same single formatter");
}

// ===== F: save migration =====
{
  const v1 = (credits: number, extra: Partial<SaveData> = {}): SaveData => ({ ...structuredClone(DEFAULT_SAVE), version: 1, credits, ...extra });
  const campaignOnly = migrateMoneyToUsd(v1(350));
  assert(campaignOnly.credits === dollars(350) && formatUsd(campaignOnly.credits) === "$350.00" && campaignOnly.version === USD_SAVE_VERSION, "F: Campaign-only old save 350 → $350.00");
  const biz = structuredClone(DEFAULT_SAVE.business);
  biz.finance.lifetime.revenue = 21519;
  const businessOnly = migrateMoneyToUsd(v1(21519, { business: biz }));
  assert(businessOnly.credits === 21519 && formatUsd(businessOnly.credits) === "$215.19", "F2: money earned in Business (21519 cents) stays $215.19");
  const biz2 = structuredClone(DEFAULT_SAVE.business);
  biz2.finance.lifetime.revenue = 5000;
  biz2.finance.lifetime.inventoryPurchaseCost = 1200;
  const mixed = migrateMoneyToUsd(v1(1000 + 3800, { business: biz2 }));
  assert(mixed.credits === dollars(1000) + 3800 && formatUsd(mixed.credits) === "$1,038.00", "F3: mixed wallet — 1,000 Campaign → $1,000.00 plus $38.00 Business net = $1,038.00");
  const twice = migrateMoneyToUsd(campaignOnly);
  assert(twice === campaignOnly, "F4: an already-migrated save is never converted twice");
  const withLedger = migrateMoneyToUsd(v1(500, {
    economyLedger: [
      { id: "a", timestamp: 1, category: "completion-reward", amount: 223, description: "level-10" },
      { id: "b", timestamp: 2, category: "knife-purchase", amount: -350, description: "santoku" },
      { id: "c", timestamp: 3, category: "business-revenue", amount: 21519, description: "dish" },
    ],
    endless: { date: "2026-09-25", coinsEarnedToday: 120 },
  }));
  assert(withLedger.economyLedger.map((e) => formatUsdChange(e.amount)).join(" ") === "+$223.00 −$350.00 +$215.19", "F5: ledger history converts per entry: +$223.00 / −$350.00 / +$215.19");
  assert(withLedger.economyLedger.length === 3 && withLedger.economyLedger.map((e) => e.id).join() === "a,b,c", "F6: no ledger entry added, removed or duplicated");
  assert(withLedger.endless.coinsEarnedToday === dollars(120), "F7: Endless 'earned today' converts too ($120.00)");
  // Real SaveManager: old save → load → save → reload.
  const old = { ...v1(21519), knifeUpgrades: { chef: { sharpness: 3, speed: 1, handling: 2 } }, ownedKnifeIds: ["chef", "santoku"] };
  localStorage.setItem("knifecraft.save.v1", JSON.stringify(old));
  const loaded = await SaveManager.load();
  assert(loaded.version === 2 && formatUsd(loaded.credits) === "$21,519.00", `F8: a Campaign-earned old wallet of 21,519 loads as $21,519.00 (got ${formatUsd(loaded.credits)})`);
  assert(JSON.stringify(loaded.knifeUpgrades) === JSON.stringify(old.knifeUpgrades) && loaded.ownedKnifeIds.length === 2, "F9: knives and Blacksmith progress untouched");
  await SaveManager.save(loaded);
  const raw = JSON.parse(localStorage.getItem("knifecraft.save.v1")!) as SaveData;
  assert(raw.version === 2 && raw.credits === loaded.credits && migrateMoneyToUsd(raw).credits === loaded.credits, "F10: save → reload keeps exactly the same dollar amount (no second conversion)");
}

// ===== G: no coin/cent wording or bare money in player-facing UI =====
{
  const uiFiles = ["src/App.tsx", ...fs.readdirSync(path.resolve(ROOT, "src/components/kc"), { recursive: true }).map(String).filter((f) => f.endsWith(".tsx")).map((f) => `src/components/kc/${f.replace(/\\/g, "/")}`)];
  const offenders: string[] = [];
  for (const f of uiFiles) {
    read(f).split("\n").forEach((line, i) => {
      const t = line.trim();
      if (/^(\/\/|\*|\/\*|\{\/\*)/.test(t)) return;
      if (/["'`>][^"'`<]*(?<![.\w])(Café Coins?|Kitchen Coins?|[Cc]oins|coin cap|cents)\b/.test(line)) offenders.push(`${f}:${i + 1}`);
      if (/\{[a-zA-Z.]+\}c\b|\}c Completion|formatCoins|toLocaleString\(\)\}/.test(line)) offenders.push(`${f}:${i + 1}`);
    });
  }
  assert(offenders.length === 0, `G: no "coins"/"cents" text or bare money numbers in the UI${offenders.length ? " — " + offenders.join(", ") : ""}`);
  const prim = read("src/components/kc/common/primitives.tsx");
  assert(/export function Coin\(\{ n \}: \{ n: number \}\)[\s\S]*?\$\s*<\/span>\s*\{formatUsd\(n\)\}/.test(prim), "G2: the wallet chip on every screen shows $ + formatUsd");
  assert(/\{formatUsd\(amount\)\}/.test(read("src/components/kc/common/Indicators.tsx")), "G3: reward pills show formatUsd");
}

// ===== H: ledger reconciliation (opening + signed ledger = closing) =====
{
  let s: SaveData = { ...structuredClone(DEFAULT_SAVE), economyLedger: [] };
  const opening = s.credits;
  const moves: Array<[Parameters<typeof appendLedgerEntry>[1], number]> = [
    ["completion-reward", dollars(223)], ["knife-purchase", -dollars(350)], ["blacksmith-upgrade", -dollars(80)], ["business-revenue", 21519], ["inventory-purchase", -4567],
  ];
  for (const [cat, amt] of moves) s = appendLedgerEntry({ ...s, credits: s.credits + amt }, cat, amt, cat);
  const t = ledgerTotals(s.economyLedger);
  assert(opening + t.netCashFlow === s.credits, `H: opening ${formatUsd(opening)} + ledger ${formatUsdChange(t.netCashFlow)} = closing ${formatUsd(s.credits)}`);
}

console.log(failures === 0 ? "\nUSD CURRENCY QA: ALL PASS" : `\nUSD CURRENCY QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
