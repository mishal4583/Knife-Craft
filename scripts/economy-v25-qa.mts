/**
 * ECONOMY V2.5 QA — "Final Wealth" rebalance. Every check drives the real
 * production functions (no second economy engine).
 *
 *  A. Completionist / normal / saver campaigns (economy-v25-simulation.mts):
 *     the completionist's final cash lands in $100k–$120k, owning everything.
 *  B. Wallet safety: never negative, exact-balance and over-balance
 *     expenses, many expenses at $0, "simultaneous" purchases, the save
 *     funnel refusing a negative wallet.
 *  C. Family Legacy + milestone rewards: paid once, survive reload, never
 *     duplicated (replay, re-grant, ledger trimming).
 *  D. Recurring caps: Replay Bonus ≤ $200 × 3/day, Endless ≤ $600/day,
 *     Today's Special $50/day.
 *  E. Poor player and $0 player: the campaign stays playable and pays; a
 *     $0 player recovers through Endless + Today's Special.
 *  F. Business: never debt (payroll/fines/repairs/stock at $0), a
 *     365-day run per profile, and recovery from $0 with outside income.
 *
 * Run: npx tsx scripts/economy-v25-qa.mts
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

import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import { DEFAULT_BUSINESS_STATE } from "../src/game/business/businessTypes.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import { DEFAULT_LEVEL_PROGRESS, completeLevel } from "../src/game/levels/LevelManager.ts";
import { LEVEL_REWARD_SCHEDULE, paidLevelReward } from "../src/game/levels/levelRewards.ts";
import { appendLedgerEntry, MAX_LEDGER_ENTRIES } from "../src/game/economy/EconomyLedger.ts";
import { debitWallet, walletInvariantViolation } from "../src/game/economy/wallet.ts";
import { dollars } from "../src/game/money.ts";
import { KNIFE_CATALOG } from "../src/game/knives/knifeDefinitions.ts";
import { buyKnife } from "../src/game/knives/KnifeManager.ts";
import { buyBoard } from "../src/game/boards/BoardManager.ts";
import { buyStaff } from "../src/game/economy/StaffManager.ts";
import { upgradeKnife } from "../src/game/knives/blacksmith.ts";
import { sharpenKnife } from "../src/game/economy/sharpness.ts";
import { KITCHEN_UPGRADE_CATALOG } from "../src/game/kitchen/kitchenUpgradeDefinitions.ts";
import {
  migrateKitchenDevelopment,
  purchaseKitchenUpgrade,
} from "../src/game/kitchen/KitchenUpgradeManager.ts";
import { purchaseRefrigerator } from "../src/game/business/RefrigeratorManager.ts";
import { performRefrigeratorMaintenance } from "../src/game/business/businessMaintenance.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { cancelContract, signContract } from "../src/game/business/BusinessSupplierManager.ts";
import { hireStaff } from "../src/game/business/BusinessStaffManager.ts";
import { ALL_STAFF_ROLES, dailyPayroll } from "../src/game/business/businessStaff.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import { migrateEconomy } from "../src/game/progression/economyMigration.ts";
import { LEGACY_ECONOMY_STATE } from "../src/game/economy/economyState.ts";
import {
  FAMILY_LEGACY_ID,
  FAMILY_LEGACY_REWARD,
  MILESTONES,
  MILESTONE_REWARD_TOTAL,
  grantEarnedMilestoneRewards,
  paidMilestoneIds,
} from "../src/game/progression/milestoneRewards.ts";
import {
  REPLAY_BONUS_DAILY_CAP,
  REPLAY_BONUS_MAX,
  commitReplayBonus,
  newReplayBonusRewardId,
  replayBonusAmount,
  replayBonusesLeftToday,
} from "../src/game/ads/replayBonus.ts";
import {
  ENDLESS_DAILY_COIN_CAP,
  applyEndlessEarn,
} from "../src/game/daily/EndlessServiceManager.ts";
import {
  DAILY_ORDER_BONUS_COINS,
  claimDaily,
  hasClaimedToday,
} from "../src/game/daily/DailyOrderManager.ts";
import {
  fmt,
  focusBusinessMenu,
  playBusinessDay,
  runCampaign,
  type RunReport,
} from "./economy-v25-simulation.mts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
type Row = {
  scenario: string;
  start: number;
  income: number;
  expenses: number;
  final: number;
  min: number;
  negative: boolean;
  deadlock: string;
};
const table: Row[] = [];
const fromRun = (r: RunReport, deadlock = "no"): Row => ({
  scenario: r.name,
  start: r.start,
  income: r.income,
  expenses: r.spending,
  final: r.final,
  min: r.minCash,
  negative: r.negativeEver,
  deadlock,
});
const completedSave = (n: number, extra: Partial<SaveData> = {}): SaveData => {
  let progress = DEFAULT_LEVEL_PROGRESS;
  for (const l of LEVELS.slice(0, n)) progress = completeLevel(l.id, progress).progress;
  return { ...structuredClone(DEFAULT_SAVE), economyLedger: [], levelProgress: progress, ...extra };
};

// ========== A. Campaign runs ==========
console.log("A. Campaign — completionist, normal, saver");
const completionist = runCampaign({
  name: "Completionist → L250 + every purchase",
  buyEverything: true,
  supplierId: "wholesale-supplier",
  runBusinessDay: true,
});
const normal = runCampaign({
  name: "Normal player → L250, buys everything",
  buyEverything: true,
  runBusinessDay: false,
});
const saver = runCampaign({
  name: "Saver → L250, buys nothing",
  buyEverything: false,
  runBusinessDay: false,
});
const zeroStart = runCampaign({
  name: "$0 start → L250, buys everything",
  buyEverything: true,
  runBusinessDay: false,
  startCredits: 0,
});
table.push(fromRun(completionist), fromRun(normal), fromRun(saver), fromRun(zeroStart));
assert(
  completionist.final >= dollars(100_000) && completionist.final <= dollars(120_000),
  `A1 (18): completionist final cash ${fmt(completionist.final)} is inside the $100,000–$120,000 target`,
);
assert(
  completionist.everythingOwned,
  `A2 (17): the completionist owns every knife, board, staff member, Blacksmith step, kitchen tier and fridge (${completionist.missing.join(", ") || "nothing missing"})`,
);
assert(
  completionist.byCategory["family-legacy"] === FAMILY_LEGACY_REWARD &&
    completionist.byCategory["milestone-reward"] === MILESTONE_REWARD_TOTAL - FAMILY_LEGACY_REWARD,
  `A3: every milestone paid exactly once (${fmt(completionist.byCategory["milestone-reward"] ?? 0)}) + Family Legacy ${fmt(FAMILY_LEGACY_REWARD)}`,
);
assert(
  completionist.byCategory["kitchen-investment-purchase"] === -dollars(135_000),
  "A4: Restaurant Development costs exactly $135,000 in total",
);
assert(
  normal.final >= dollars(100_000) && normal.final <= dollars(150_000) && normal.everythingOwned,
  `A5: a normal player who buys everything also ends inside the acceptable range (${fmt(normal.final)})`,
);
for (const r of [completionist, normal, saver, zeroStart]) {
  assert(
    !r.negativeEver && r.minCash >= 0,
    `A6 (1): ${r.name} — never below $0 (min ${fmt(r.minCash)})`,
  );
  assert(
    r.reconcileFailures.length === 0,
    `A7: ${r.name} — every step: wallet change === signed new ledger entries`,
  );
}
assert(
  zeroStart.everythingOwned && zeroStart.final > dollars(100_000),
  `A8 (13): starting from $0 the campaign is fully playable and still ends with everything and ${fmt(zeroStart.final)}`,
);
assert(
  LEVEL_REWARD_SCHEDULE[0]!.percent === 100 &&
    LEVEL_REWARD_SCHEDULE.at(-1)!.percent === 100 &&
    LEVELS.every((l) => paidLevelReward(l) > 0 && paidLevelReward(l) <= dollars(l.reward.coins)),
  "A9: every level still pays a positive completion reward, never more than its stored reward (100% for L1–20 and L250)",
);

// ========== B. Wallet safety ==========
console.log("B. Wallet safety");
{
  const s = { ...structuredClone(DEFAULT_SAVE), credits: dollars(350) };
  const exact = debitWallet(s, dollars(350));
  assert(
    exact.ok && exact.save.credits === 0,
    "B1 (2): an expense of exactly the balance is allowed and leaves $0",
  );
  const over = debitWallet(s, dollars(350) + 1);
  assert(
    !over.ok && over.reason === "insufficientFunds",
    "B2 (3): an expense one cent over the balance is refused",
  );
  assert(
    !debitWallet(s, -100).ok && !debitWallet(s, 0.5).ok,
    "B3: negative or fractional expenses are refused",
  );
  const lvl = { levelProgress: { ...s.levelProgress, highestUnlockedLevelId: "level-250" } };
  const santokuExact = buyKnife({ ...s, ...lvl, credits: dollars(350) }, "santoku");
  assert(
    santokuExact.ok && santokuExact.save.credits === 0,
    "B4 (2): buying the $350 Santoku with exactly $350 leaves $0",
  );
  const zero = { ...completedSave(250), credits: 0, ...lvl };
  const attempts = [
    buyKnife(zero, "santoku"),
    buyBoard("maple", zero),
    buyStaff(zero, "prep-assistant"),
    upgradeKnife(zero, "chef", "speed"),
    sharpenKnife(zero, "chef"),
    purchaseKitchenUpgrade(zero, "growing-kitchen"),
    purchaseRefrigerator(zero, "commercial-refrigerator"),
    purchaseIngredient(zero, "carrot", 1),
  ];
  assert(
    attempts.every((a) => !a.ok),
    `B5 (4): at $0 every paid action is refused (${attempts.length} tried)`,
  );
  assert(zero.credits === 0, "B6 (4): … and the wallet is still exactly $0");
  // "Simultaneous": two purchases decided on the same snapshot, applied in turn from the latest save.
  const pair = { ...s, ...lvl, credits: dollars(1_000) };
  const first = buyKnife(pair, "damascus"); // $1,800 — not affordable
  const a = buyKnife(pair, "cleaver"); // $1,100 — not affordable either
  const b = buyKnife({ ...pair, credits: dollars(1_500) }, "cleaver");
  const second = b.ok ? buyKnife(b.save, "bread") : null; // $850 after $1,100 from $1,500
  assert(
    !first.ok && !a.ok && b.ok && second !== null && !second.ok && b.save.credits === dollars(400),
    "B7 (12): two expenses in a row never overdraw — the second is judged on the updated balance and refused",
  );
  assert(
    walletInvariantViolation({ credits: -1 }) !== null &&
      walletInvariantViolation({ credits: 0 }) === null &&
      walletInvariantViolation({ credits: 1.5 }) !== null,
    "B8: the wallet invariant rejects -1 and fractions, accepts $0",
  );
  let refused = false;
  try {
    await SaveManager.save({ ...structuredClone(DEFAULT_SAVE), credits: -1 });
  } catch {
    refused = true;
  }
  assert(refused, "B9 (1): SaveManager refuses to persist a negative wallet");
}

// ========== C. Family Legacy + milestones ==========
console.log("C. Family Legacy + milestones");
{
  const at249 = completedSave(249);
  const g249 = grantEarnedMilestoneRewards(at249);
  assert(
    !paidMilestoneIds(g249.save).has(FAMILY_LEGACY_ID),
    "C1: no Family Legacy before Level 250",
  );
  const done = completeLevel(LEVELS[249]!.id, g249.save.levelProgress);
  const after250 = grantEarnedMilestoneRewards({ ...g249.save, levelProgress: done.progress });
  const legacyEntries = (s: SaveData) =>
    s.economyLedger.filter((e) => e.category === "family-legacy");
  assert(
    legacyEntries(after250.save).length === 1 &&
      legacyEntries(after250.save)[0]!.amount === dollars(50_000) &&
      after250.save.credits ===
        g249.save.credits +
          dollars(50_000) +
          after250.granted
            .filter((m) => m.id !== FAMILY_LEGACY_ID)
            .reduce((t, m) => t + m.reward, 0),
    "C2 (5): completing Level 250 pays the $50,000 Family Legacy once, recorded as 'family-legacy'",
  );
  const again = grantEarnedMilestoneRewards(after250.save);
  assert(
    again.save === after250.save && again.granted.length === 0,
    "C3 (7): granting again pays nothing",
  );
  const replay = completeLevel(LEVELS[249]!.id, done.progress);
  assert(
    !replay.isFirstCompletion &&
      replay.rewardCoins === 0 &&
      grantEarnedMilestoneRewards({ ...after250.save, levelProgress: replay.progress }).granted
        .length === 0,
    "C4 (7): replaying Level 250 pays nothing and no second Family Legacy",
  );
  memoryStore.clear();
  await SaveManager.save(after250.save);
  (SaveManager as unknown as { cache: SaveData | null }).cache = null;
  const reloaded = await SaveManager.load();
  const onReload = grantEarnedMilestoneRewards(reloaded);
  assert(
    onReload.granted.length === 0 &&
      legacyEntries(onReload.save).length === 1 &&
      reloaded.credits === after250.save.credits,
    "C5 (6): after save + reload the Family Legacy is still recorded and nothing is paid again",
  );
  // A busy ledger (way past the 200-entry window) must not forget a paid milestone.
  let busy = onReload.save;
  for (let i = 0; i < MAX_LEDGER_ENTRIES + 60; i++)
    busy = appendLedgerEntry({ ...busy, credits: busy.credits + 100 }, "daily-reward", 100);
  assert(
    busy.economyLedger.length <= MAX_LEDGER_ENTRIES + MILESTONES.length &&
      legacyEntries(busy).length === 1 &&
      grantEarnedMilestoneRewards(busy).granted.length === 0,
    "C6 (7, 8): after 260 more transactions the ledger still holds every milestone payment — none can be paid twice",
  );
  const milestoneIds = busy.economyLedger
    .filter((e) => e.category === "milestone-reward")
    .map((e) => e.description);
  assert(
    new Set(milestoneIds).size === milestoneIds.length,
    "C7 (8): each milestone reward appears once",
  );
  // An existing (pre-V2.5) save that had already finished Level 250 finished it before the
  // Final Reward existed: the one-time economy migration marks it claimed (waived) — no
  // retroactive $50,000 windfall — and nothing is paid on later loads either.
  const oldFinished = migrateEconomy(
    migrateKitchenDevelopment({ ...completedSave(250), version: 2, economy: LEGACY_ECONOMY_STATE }),
    true,
  );
  const oldGrant = grantEarnedMilestoneRewards(oldFinished);
  assert(
    legacyEntries(oldGrant.save).length === 0 &&
      oldGrant.granted.length === 0 &&
      oldFinished.economy.waivedMilestoneIds.includes(FAMILY_LEGACY_ID) &&
      oldGrant.save.credits === completedSave(250).credits,
    "C8: an older save that had already finished Level 250 gets no retroactive Final Reward (waived by the one-time migration), never later either",
  );
  assert(
    MILESTONES.filter((m) => m.id === FAMILY_LEGACY_ID).length === 1 &&
      MILESTONE_REWARD_TOTAL === dollars(88_200),
    `C9: 22 milestones worth ${fmt(MILESTONE_REWARD_TOTAL)} in total, the $50,000 Family Legacy included`,
  );
}

// ========== D. Recurring income caps ==========
console.log("D. Recurring income caps");
{
  assert(
    LEVELS.every((l) => replayBonusAmount(l) <= REPLAY_BONUS_MAX) &&
      REPLAY_BONUS_MAX === dollars(200) &&
      replayBonusAmount(LEVELS[249]!) === dollars(200),
    "D1 (9): the Replay Bonus never exceeds $200 (Level 250 → $200)",
  );
  const now = new Date();
  let s = { ...completedSave(250), credits: 0 };
  const paid: number[] = [];
  for (let i = 0; i < 5; i++) {
    const offer = {
      levelId: "level-250",
      rewardId: newReplayBonusRewardId("level-250"),
      amount: replayBonusAmount(LEVELS[249]!),
    };
    const r = commitReplayBonus(s, offer, now);
    if (r.ok) {
      paid.push(r.save.credits - s.credits);
      s = r.save;
    }
  }
  assert(
    paid.length === REPLAY_BONUS_DAILY_CAP &&
      replayBonusesLeftToday(s, now) === 0 &&
      s.credits === dollars(600),
    `D2 (10): 3 Replay Bonuses per day, $600 at most (paid ${paid.length}, ${fmt(s.credits)})`,
  );
  let endless = structuredClone(DEFAULT_SAVE).endless;
  let earnedToday = 0;
  for (let i = 0; i < 6; i++) {
    const r = applyEndlessEarn(endless, paidLevelReward(LEVELS[249]!), now);
    earnedToday += r.earned;
    endless = JSON.parse(JSON.stringify(r.endless)); // survives a save/reload round trip
  }
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const nextDay = applyEndlessEarn(endless, paidLevelReward(LEVELS[249]!), tomorrow);
  assert(
    ENDLESS_DAILY_COIN_CAP === dollars(600) &&
      earnedToday === dollars(600) &&
      nextDay.earned === dollars(600),
    "D3 (11): Endless pays at most $600 per day (persisted across reloads), and the cap resets the next day",
  );
  let daily = structuredClone(DEFAULT_SAVE).dailyOrder;
  let dailyPaid = 0;
  for (let i = 0; i < 3; i++) {
    if (!hasClaimedToday(daily, now)) dailyPaid += DAILY_ORDER_BONUS_COINS;
    daily = claimDaily(daily, now);
  }
  assert(
    DAILY_ORDER_BONUS_COINS === dollars(50) && dailyPaid === dollars(50),
    "D4 (12): Today's Special pays $50 once per day",
  );
  table.push({
    scenario: "Daily ceiling after L250 (Replay + Endless + Special)",
    start: 0,
    income: dollars(600 + 600 + 50),
    expenses: 0,
    final: dollars(1_250),
    min: 0,
    negative: false,
    deadlock: "no",
  });
}

// ========== E. Poor and $0 players ==========
console.log("E. Poor player and $0 player");
{
  const zero = { ...completedSave(0), credits: 0 };
  const first = completeLevel(LEVELS[0]!.id, zero.levelProgress);
  assert(
    first.rewardCoins === paidLevelReward(LEVELS[0]!) && first.rewardCoins > 0,
    "E1 (13): at $0 a campaign level can be played and pays its reward (no purchase needed to play)",
  );
  // $0 after the campaign: Endless + Today's Special rebuild cash within a day.
  const now = new Date();
  const endless = applyEndlessEarn(
    structuredClone(DEFAULT_SAVE).endless,
    paidLevelReward(LEVELS[99]!),
    now,
  );
  const recovered = endless.earned + DAILY_ORDER_BONUS_COINS;
  assert(
    recovered > 0 && recovered >= dollars(50),
    `E2 (14): a $0 player earns ${fmt(recovered)} on day one from Endless + Today's Special (no purchase needed)`,
  );
  table.push({
    scenario: "$0 player — one day of Endless + Today's Special",
    start: 0,
    income: recovered,
    expenses: 0,
    final: recovered,
    min: 0,
    negative: false,
    deadlock: "no",
  });
}

// ========== F. Business ==========
console.log("F. Business — no debt, 365 days, recovery");
function businessYear(opts: {
  name: string;
  startCash: number;
  hires: readonly string[];
  outsideIncomePerDay: number;
  days?: number;
}) {
  let save: SaveData = {
    ...structuredClone(DEFAULT_SAVE),
    credits: opts.startCash,
    economyLedger: [],
    business: { ...DEFAULT_BUSINESS_STATE },
  };
  save = focusBusinessMenu(save);
  for (const role of opts.hires) {
    const r = hireStaff(save, role);
    if (r.ok) save = r.save;
  }
  let min = save.credits;
  let income = 0;
  let expenses = 0;
  let zeroDays = 0;
  let longestZeroServe = 0;
  let zeroServeStreak = 0;
  let negative = false;
  let reconcile = 0;
  const days = opts.days ?? 365;
  for (let d = 1; d <= days; d++) {
    const before = save.credits;
    const ids = new Set(save.economyLedger.map((e) => e.id));
    // Outside income (Endless/Today's Special) — the recovery path; recorded like App.tsx.
    if (opts.outsideIncomePerDay > 0)
      save = appendLedgerEntry(
        { ...save, credits: save.credits + opts.outsideIncomePerDay },
        "endless-revenue",
        opts.outsideIncomePerDay,
      );
    // One real Business day, played as a sensible player plays it (repairs, today's customers).
    const played = playBusinessDay(save);
    save = played.save;
    const served = played.served;
    const added = save.economyLedger.filter((e) => !ids.has(e.id));
    if (before + added.reduce((t, e) => t + e.amount, 0) !== save.credits) reconcile++;
    for (const e of added) {
      if (e.amount > 0) income += e.amount;
      else expenses -= e.amount;
    }
    if (save.credits < 0 || !Number.isInteger(save.credits)) negative = true;
    min = Math.min(min, save.credits);
    if (save.credits === 0) zeroDays++;
    zeroServeStreak = served === 0 ? zeroServeStreak + 1 : 0;
    longestZeroServe = Math.max(longestZeroServe, zeroServeStreak);
  }
  // Dead end = still unable to serve anyone at the end of the year.
  const deadlocked = zeroServeStreak >= 30;
  return {
    name: opts.name,
    start: opts.startCash,
    final: save.credits,
    min,
    income,
    expenses,
    zeroDays,
    longestZeroServe,
    negative,
    reconcile,
    deadlocked,
    save,
  };
}
{
  // 15: no debt at $0 — payroll, fines, repairs, stock, contract fees.
  let s: SaveData = {
    ...structuredClone(DEFAULT_SAVE),
    credits: 0,
    business: { ...DEFAULT_BUSINESS_STATE },
  };
  for (const role of ALL_STAFF_ROLES) {
    const r = hireStaff(s, role);
    if (r.ok) s = r.save;
  }
  const end = endBusinessDay(s);
  assert(
    dailyPayroll(s.business.staff.hiredRoles) > 0 &&
      end.payrollPaid === 0 &&
      end.save.credits === 0 &&
      end.staffLaidOff.length === ALL_STAFF_ROLES.length,
    "F1 (15): at $0 the day's payroll can't be paid — staff are laid off, cash stays $0 (no debt)",
  );
  const broken = {
    ...s,
    business: { ...s.business, equipmentCondition: { refrigeratorCondition: 5 } },
  };
  assert(
    !performRefrigeratorMaintenance(broken).ok && !purchaseIngredient(s, "carrot", 1).ok,
    "F2 (15): at $0 a repair and a stock purchase are refused, not put on credit",
  );
  const signed = signContract({ ...s, credits: dollars(50) }, "wholesale-supplier");
  const cancel = signed.ok ? cancelContract(signed.save) : null;
  assert(
    signed.ok &&
      signed.save.credits === dollars(50) &&
      cancel !== null &&
      !cancel.ok &&
      cancel.reason === "insufficientFunds",
    "F3 (15): with $50, cancelling a Wholesale contract ($120 fee) is refused — the fee is never put on credit, cash stays $50",
  );
  // Payroll at exactly the balance is paid and leaves $0; one cent short lays staff off instead.
  let staffed: SaveData = {
    ...structuredClone(DEFAULT_SAVE),
    business: { ...DEFAULT_BUSINESS_STATE },
  };
  const r0 = hireStaff(staffed, "line-cook");
  if (r0.ok) staffed = r0.save;
  const wage = dailyPayroll(staffed.business.staff.hiredRoles);
  const exactPay = endBusinessDay({ ...staffed, credits: wage });
  const shortPay = endBusinessDay({ ...staffed, credits: wage - 1 });
  assert(
    exactPay.payrollPaid === wage &&
      exactPay.save.credits === 0 &&
      exactPay.staffLaidOff.length === 0 &&
      shortPay.payrollPaid === 0 &&
      shortPay.save.credits === wage - 1 &&
      shortPay.staffLaidOff.length === 1,
    `F7 (2, 3): payroll of exactly the balance (${fmt(wage)}) is paid and leaves $0; one cent short pays nothing and lays the cook off (no debt)`,
  );
}
const years = [
  businessYear({
    name: "Business 365 d — $3,000 start, no staff",
    startCash: dollars(3_000),
    hires: [],
    outsideIncomePerDay: 0,
  }),
  businessYear({
    name: "Business 365 d — $3,000 start, all 6 staff",
    startCash: dollars(3_000),
    hires: ALL_STAFF_ROLES,
    outsideIncomePerDay: 0,
  }),
  businessYear({
    name: "Business 365 d — poor ($100), no staff",
    startCash: dollars(100),
    hires: [],
    outsideIncomePerDay: 0,
  }),
  businessYear({
    name: "Business 365 d — $0 + Endless/Special income",
    startCash: 0,
    hires: [],
    outsideIncomePerDay: dollars(650),
  }),
];
for (const y of years) {
  assert(!y.negative && y.min >= 0, `F4 (16): ${y.name} — never below $0 (min ${fmt(y.min)})`);
  assert(
    y.reconcile === 0,
    `F5: ${y.name} — every day reconciles (opening + signed ledger = closing)`,
  );
  table.push({
    scenario: y.name,
    start: y.start,
    income: y.income,
    expenses: y.expenses,
    final: y.final,
    min: y.min,
    negative: y.negative,
    deadlock: y.deadlocked ? "Business idle — needs outside income" : "no",
  });
}
const recovery = years[3]!;
assert(
  !recovery.deadlocked && recovery.final > 0,
  `F6 (14): a $0 player with Endless/Today's Special income keeps Business running all year (final ${fmt(recovery.final)})`,
);

// ========== Table ==========
console.log("\nSCENARIO | START | INCOME | EXPENSES | FINAL | MIN CASH | NEGATIVE? | DEADLOCK?");
for (const r of table) {
  console.log(
    `${r.scenario} | ${fmt(r.start)} | ${fmt(r.income)} | ${fmt(r.expenses)} | ${fmt(r.final)} | ${fmt(r.min)} | ${r.negative ? "YES" : "no"} | ${r.deadlock}`,
  );
}
console.log(
  failures === 0 ? "\nECONOMY V2.5 QA: ALL PASS" : `\nECONOMY V2.5 QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
