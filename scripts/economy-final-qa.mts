/**
 * ECONOMY FINAL QA — the final rebalance + save-migration fix. Every check
 * drives the real production functions (SaveManager.load, the purchase
 * managers, milestoneRewards, economyMigration, restaurantProgress,
 * EndlessServiceManager, the Business day) — no second economy engine.
 *
 *  A. Level reward scaling — one central function; level data untouched.
 *  B. Purchase affordability — exact balance, $0.01 short, "Not enough money".
 *  C. No negative balance — the save funnel, and every simulated profile.
 *  D. Kitchen migration — old saves keep their tiers, are never charged;
 *     double-click and reload during a purchase.
 *  E. Milestone migration — completed vs claimed; no ~$85k windfall.
 *  F. Duplicate migration prevention — loading an old save 10×.
 *  G. Level 250 — $50,000, unscaled, once (replay, reload).
 *  H. Endless Service — locked until Level 250, then pays, capped per day.
 *  I. Progress accounting — the Progress figures match the ledger.
 *  J. Historical accounting — an old save shows what actually happened.
 *  K. Simulation — Normal, Completionist, Aggressive Spender, Existing Save.
 *
 * Run: npx tsx scripts/economy-final-qa.mts
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

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import {
  DEFAULT_LEVEL_PROGRESS,
  completeLevel,
  isCompleted,
} from "../src/game/levels/LevelManager.ts";
import {
  LEVEL_REWARD_SCHEDULE,
  levelRewardPercent,
  paidLevelReward,
} from "../src/game/levels/levelRewards.ts";
import { appendLedgerEntry, MAX_LEDGER_ENTRIES } from "../src/game/economy/EconomyLedger.ts";
import { notEnoughMoneyText, walletInvariantViolation } from "../src/game/economy/wallet.ts";
import { ECONOMY_VERSION, lifetimeTotal } from "../src/game/economy/economyState.ts";
import { dollars } from "../src/game/money.ts";
import { KNIFE_CATALOG } from "../src/game/knives/knifeDefinitions.ts";
import { BOARD_CATALOG } from "../src/game/boards/boardDefinitions.ts";
import { STAFF_CATALOG } from "../src/game/economy/staffDefinitions.ts";
import { buyKnife } from "../src/game/knives/KnifeManager.ts";
import { buyBoard } from "../src/game/boards/BoardManager.ts";
import { buyStaff } from "../src/game/economy/StaffManager.ts";
import { upgradeCost, upgradeKnife } from "../src/game/knives/blacksmith.ts";
import { KITCHEN_UPGRADE_CATALOG } from "../src/game/kitchen/kitchenUpgradeDefinitions.ts";
import { purchaseKitchenUpgrade } from "../src/game/kitchen/KitchenUpgradeManager.ts";
import { REFRIGERATOR_CATALOG } from "../src/game/business/refrigeratorDefinitions.ts";
import { purchaseRefrigerator } from "../src/game/business/RefrigeratorManager.ts";
import { ALL_STAFF_ROLES } from "../src/game/business/businessStaff.ts";
import { migrateEconomy } from "../src/game/progression/economyMigration.ts";
import {
  FAMILY_LEGACY_ID,
  FAMILY_LEGACY_REWARD,
  MILESTONES,
  grantEarnedMilestoneRewards,
  milestoneStatuses,
} from "../src/game/progression/milestoneRewards.ts";
import { restaurantProgress } from "../src/game/progression/restaurantProgress.ts";
import {
  ENDLESS_DAILY_COIN_CAP,
  applyEndlessEarn,
  endlessPool,
  isEndlessUnlocked,
  pickEndlessLevel,
} from "../src/game/daily/EndlessServiceManager.ts";
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
const STORAGE_KEY = "knifecraft.save.v1";
const allLevelIds = LEVELS.map((l) => l.id);
const progressThrough = (n: number) => {
  let progress = DEFAULT_LEVEL_PROGRESS;
  for (const l of LEVELS.slice(0, n)) progress = completeLevel(l.id, progress).progress;
  return progress;
};
const freshSave = (extra: Partial<SaveData> = {}): SaveData => ({
  ...structuredClone(DEFAULT_SAVE),
  economyLedger: [],
  ...extra,
});
/** Loads a raw stored save the way the game does (a fresh SaveManager cache each time). */
async function loadRaw(raw: unknown): Promise<SaveData> {
  if (raw !== undefined) memoryStore.set(STORAGE_KEY, JSON.stringify(raw));
  (SaveManager as unknown as { cache: SaveData | null }).cache = null;
  const loaded = await SaveManager.load();
  await new Promise((r) => setTimeout(r, 0)); // let the migration write-back land
  return loaded;
}
/** Mirrors App.tsx's load path after SaveManager.load: pay reached, unclaimed milestones once. */
async function appLoad(raw?: unknown): Promise<{ save: SaveData; paid: number }> {
  const loaded = await loadRaw(raw);
  const g = grantEarnedMilestoneRewards(loaded);
  if (g.save !== loaded) await SaveManager.save(g.save);
  return { save: g.save, paid: g.save.credits - loaded.credits };
}
const count = (s: SaveData, category: string) =>
  s.economyLedger.filter((e) => e.category === category);
const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const kitchenIdsUpTo = (level: number) =>
  KITCHEN_UPGRADE_CATALOG.filter((u) => u.unlockLevel <= level).map((u) => u.id);

/** An old save as a pre-V2.5 build wrote it: version 2, no `economy`, no milestone entries. */
function oldRawSave(level: number, credits: number, extra: Record<string, unknown> = {}) {
  const progress = progressThrough(level);
  return {
    ...structuredClone(DEFAULT_SAVE),
    economy: undefined,
    version: 2,
    credits,
    economyLedger: [],
    levelProgress: progress,
    ownedKnifeIds: KNIFE_CATALOG.filter((k) => k.unlockLevel <= level).map((k) => k.id),
    ownedBoardIds: BOARD_CATALOG.filter((b) => b.unlockLevel <= level).map((b) => b.id),
    ownedStaffIds: STAFF_CATALOG.filter((s) => s.unlockLevel <= level)
      .slice(0, 2)
      .map((s) => s.id),
    ownedKitchenUpgradeIds: ["humble-kitchen"],
    equippedKitchenUpgradeId: "humble-kitchen",
    knifeUpgrades: { chef: { sharpness: 3, speed: 2 } },
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
    ...extra,
  };
}

// ========== A. Level reward scaling ==========
console.log("A. Level reward scaling");
{
  let unchanged = false;
  try {
    // 5e4d7e9 is the last commit that edited the level data (before Economy V2.5).
    execSync("git diff --quiet 5e4d7e9 -- src/game/levels/levelDefinitions.ts", {
      stdio: "ignore",
    });
    unchanged = true;
  } catch {
    unchanged = false;
  }
  assert(unchanged, "A1: the 250 level definitions (reward.coins) are unchanged");
  const pctOk = LEVELS.every((l, i) => {
    const n = i + 1;
    const row = LEVEL_REWARD_SCHEDULE.find((r) => n >= r.from && n <= r.to)!;
    return (
      levelRewardPercent(l) === row.percent &&
      paidLevelReward(l) === dollars(Math.round((l.reward.coins * row.percent) / 100))
    );
  });
  assert(pctOk, "A2: every level pays reward.coins × its schedule percent (paidLevelReward)");
  assert(
    levelRewardPercent(LEVELS[249]!) === 100,
    "A3: Level 250's own level reward is not reduced",
  );
  let progress = DEFAULT_LEVEL_PROGRESS;
  let payoutMatches = true;
  for (const l of LEVELS) {
    const r = completeLevel(l.id, progress);
    if (r.rewardCoins !== paidLevelReward(l)) payoutMatches = false;
    progress = r.progress;
  }
  assert(
    payoutMatches,
    "A4: the level-completion payout equals paidLevelReward for all 250 levels",
  );
  // Every screen that shows a level reward reads the same function.
  const readers = [
    "src/App.tsx",
    "src/components/kc/Kitchen.tsx",
    "src/components/kc/Journal.tsx",
    "src/game/ads/replayBonus.ts",
    "src/game/progression/restaurantProgress.ts",
  ];
  // Code lines only (a comment may mention reward.coins).
  const code = (f: string) =>
    readFileSync(f, "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
  const direct = readers.filter((f) => /reward\.coins/.test(code(f)));
  const via = readers.filter((f) => /paidLevelReward/.test(readFileSync(f, "utf8")));
  assert(
    direct.length === 0 && via.length === readers.length,
    `A5: payout, Kitchen, Journal, Replay Bonus and Progress all use paidLevelReward (direct reward.coins reads: ${direct.join(", ") || "none"})`,
  );
}

// ========== B. Purchase affordability ==========
console.log("B. Purchase affordability");
{
  const at = (credits: number, level = 250) =>
    freshSave({ credits, levelProgress: progressThrough(level) });
  const knife = KNIFE_CATALOG.find((k) => k.price > 0)!;
  const board = BOARD_CATALOG.find((b) => b.price > 0)!;
  const staff = STAFF_CATALOG[0]!;
  const kitchen = KITCHEN_UPGRADE_CATALOG.find((u) => u.price > 0)!;
  const fridge = REFRIGERATOR_CATALOG.find((f) => f.price > 0)!;
  const smith = upgradeCost(1)!;
  const cases: Array<[string, number, (s: SaveData) => { ok: boolean; save?: SaveData }]> = [
    [`knife ${knife.id}`, knife.price, (s) => buyKnife(s, knife.id)],
    [`board ${board.id}`, board.price, (s) => buyBoard(board.id, s)],
    [`staff ${staff.id}`, staff.price, (s) => buyStaff(s, staff.id)],
    [`kitchen ${kitchen.id}`, kitchen.price, (s) => purchaseKitchenUpgrade(s, kitchen.id)],
    [`fridge ${fridge.id}`, fridge.price, (s) => purchaseRefrigerator(s, fridge.id)],
    ["Blacksmith step 1", smith, (s) => upgradeKnife(s, "chef", "sharpness")],
  ];
  for (const [label, price, buy] of cases) {
    const exact = buy(at(price));
    const short = at(price - 1);
    const refused = buy(short);
    assert(
      exact.ok && exact.save!.credits === 0 && !refused.ok && short.credits === price - 1,
      `B1: ${label} (${fmt(price)}) — exact balance buys it and leaves $0.00; $0.01 short is refused, nothing charged`,
    );
  }
  assert(
    notEnoughMoneyText(dollars(35_000), dollars(27_450)) ===
      "Not enough money — need $7,550.00 more.",
    `B2: insufficient funds reads "${notEnoughMoneyText(dollars(35_000), dollars(27_450))}"`,
  );
  const grand = KITCHEN_UPGRADE_CATALOG.find((u) => u.id === "grand-kitchen")!;
  const s = freshSave({
    credits: dollars(27_450),
    levelProgress: progressThrough(120),
    ownedKitchenUpgradeIds: KITCHEN_UPGRADE_CATALOG.filter((u) => u.id !== grand.id).map(
      (u) => u.id,
    ),
  });
  const r = purchaseKitchenUpgrade(s, grand.id);
  assert(
    !r.ok && r.reason === "insufficientFunds",
    "B3: $27,450 can't buy the $35,000 Grand Kitchen — blocked, never −$7,550",
  );
}

// ========== C. No negative balance ==========
console.log("C. No negative balance");
{
  assert(
    walletInvariantViolation({ credits: -1 }) !== null &&
      walletInvariantViolation({ credits: 0 }) === null,
    "C1: a negative wallet is invalid, $0 is valid",
  );
  let refused = false;
  try {
    await SaveManager.save(freshSave({ credits: -755_000 }));
  } catch {
    refused = true;
  }
  assert(refused, "C2: SaveManager.save refuses to write a negative balance");
}

// ========== D. Kitchen migration + purchase edge cases ==========
console.log("D. Kitchen migration");
{
  const raw = oldRawSave(95, dollars(4_321));
  const { save: s, paid } = await appLoad(raw);
  assert(
    kitchenIdsUpTo(95).every((id) => s.ownedKitchenUpgradeIds.includes(id)) &&
      s.ownedKitchenUpgradeIds.length === 6 &&
      s.equippedKitchenUpgradeId === "grand-kitchen",
    "D1: an old save at Level 95 keeps all six kitchen stages its level had earned",
  );
  assert(
    s.credits === dollars(4_321) &&
      paid === 0 &&
      count(s, "kitchen-investment-purchase").length === 0,
    `D2: …not charged for them, balance unchanged (${fmt(s.credits)})`,
  );
  const again = purchaseKitchenUpgrade(s, "grand-kitchen");
  assert(
    !again.ok && again.reason === "alreadyOwned",
    "D3: an owned kitchen can't be bought again",
  );

  // Double-click: App.buildKitchenUpgrade reads saveRef.current, which persist updates synchronously.
  const app = readFileSync("src/App.tsx", "utf8");
  const handler = app.slice(app.indexOf("function buildKitchenUpgrade"));
  assert(
    /const current = saveRef\.current;/.test(handler.slice(0, 400)),
    "D4: the Build handler reads the latest save (saveRef), not the render closure",
  );
  let ref = freshSave({ credits: dollars(50_000), levelProgress: progressThrough(30) });
  const click = () => {
    const r = purchaseKitchenUpgrade(ref, "growing-kitchen");
    if (r.ok)
      ref = appendLedgerEntry(r.save, "kitchen-investment-purchase", -r.price, "growing-kitchen");
    return r.ok;
  };
  const clicks = [click(), click()];
  assert(
    clicks[0] &&
      !clicks[1] &&
      ref.credits === dollars(30_000) &&
      count(ref, "kitchen-investment-purchase").length === 1,
    "D5: a double click builds Growing Kitchen once — $20,000 charged once, one ledger entry",
  );

  // Reload during a purchase: the purchase is one atomic save — before it lands nothing changed.
  memoryStore.clear();
  const before = freshSave({ credits: dollars(20_000), levelProgress: progressThrough(30) });
  await SaveManager.save(before);
  const inFlight = purchaseKitchenUpgrade(before, "growing-kitchen");
  const reloadedMid = await loadRaw(undefined);
  assert(
    inFlight.ok &&
      reloadedMid.credits === dollars(20_000) &&
      reloadedMid.ownedKitchenUpgradeIds.length === 1,
    "D6: reload before the purchase is saved — money and kitchen both unchanged (no half purchase)",
  );
  if (inFlight.ok)
    await SaveManager.save(
      appendLedgerEntry(
        inFlight.save,
        "kitchen-investment-purchase",
        -inFlight.price,
        "growing-kitchen",
      ),
    );
  const reloadedAfter = await loadRaw(undefined);
  assert(
    reloadedAfter.credits === 0 &&
      reloadedAfter.ownedKitchenUpgradeIds.includes("growing-kitchen") &&
      count(reloadedAfter, "kitchen-investment-purchase").length === 1,
    "D7: reload after it is saved — both applied, once",
  );
}

// ========== E. Milestone migration ==========
console.log("E. Milestone migration");
{
  // An old save that finished the campaign: every reached milestone waived, no windfall.
  const raw = oldRawSave(250, dollars(10_000));
  const { save: s, paid } = await appLoad(raw);
  const reached = milestoneStatuses(s).filter((m) => m.reached);
  const windfall = sumOf(reached.map((m) => m.reward));
  assert(
    paid === 0 &&
      s.credits === dollars(10_000) &&
      count(s, "milestone-reward").length === 0 &&
      count(s, "family-legacy").length === 0,
    `E1: an old finished save gets no automatic windfall (the ${fmt(windfall)} its ${reached.length} reached milestones are worth is NOT paid)`,
  );
  assert(
    reached.every((m) => m.claimed && m.waived && !m.paid) &&
      s.economy.waivedMilestoneIds.includes(FAMILY_LEGACY_ID),
    "E2: completed ≠ claimed: each reached milestone is recorded as claimed (waived), explicitly",
  );
  // A milestone already PAID before (a ledger entry) stays paid, not waived, and isn't paid again.
  const rawPaid = oldRawSave(12, dollars(900), {
    economyLedger: [
      {
        id: "old-1",
        timestamp: 1,
        category: "milestone-reward",
        amount: 10_000,
        description: "first-dish",
      },
    ],
  });
  const { save: p, paid: p2 } = await appLoad(rawPaid);
  const firstDish = milestoneStatuses(p).find((m) => m.id === "first-dish")!;
  assert(
    firstDish.paid &&
      !firstDish.waived &&
      firstDish.claimed &&
      p2 === 0 &&
      count(p, "milestone-reward").length === 1,
    "E3: a milestone the old save was already paid for stays paid (not waived) and isn't paid again",
  );
  // After migration, a NEW milestone pays once.
  let next = completeLevel(
    LEVELS[24]!.id,
    completeLevel(LEVELS[12]!.id, p.levelProgress).progress,
  ).progress;
  for (const l of LEVELS.slice(12, 25)) next = completeLevel(l.id, next).progress;
  const g = grantEarnedMilestoneRewards({ ...p, levelProgress: next });
  const g2 = grantEarnedMilestoneRewards(g.save);
  assert(
    g.granted.some((m) => m.id === "levels-25") && g2.granted.length === 0,
    "E4: a milestone reached after the migration is paid once (Level 25), then never again",
  );
  // A current-economy save with a milestone completed but NOT claimed (closed before saving) → paid once.
  const unclaimed = freshSave({ credits: 0, levelProgress: progressThrough(10) });
  const u = grantEarnedMilestoneRewards(unclaimed);
  assert(
    u.granted
      .map((m) => m.id)
      .sort()
      .join() === ["first-dish", "levels-10"].sort().join() &&
      u.save.economy.claimedMilestoneIds.includes("levels-10") &&
      grantEarnedMilestoneRewards(u.save).granted.length === 0,
    "E5: completed-but-unclaimed milestones are paid once and marked claimed",
  );
  const claimed = freshSave({
    levelProgress: progressThrough(10),
    economy: { ...DEFAULT_SAVE.economy, claimedMilestoneIds: ["first-dish", "levels-10"] },
  });
  assert(
    grantEarnedMilestoneRewards(claimed).granted.length === 0,
    "E6: an already-claimed milestone is never paid (even without its ledger entry)",
  );
}

// ========== F. Duplicate migration prevention ==========
console.log("F. Duplicate migration prevention");
{
  const raw = oldRawSave(160, dollars(12_345));
  const results: SaveData[] = [];
  for (let i = 0; i < 10; i++) results.push((await appLoad(raw)).save);
  assert(
    results.every(
      (r) =>
        r.credits === dollars(12_345) &&
        JSON.stringify(r.economy) === JSON.stringify(results[0]!.economy) &&
        r.economyLedger.length === 0,
    ),
    "F1: the same old save loaded 10 times: same balance, same claims, no payment",
  );
  const persisted = JSON.parse(memoryStore.get(STORAGE_KEY)!) as SaveData;
  assert(
    persisted.economy?.version === ECONOMY_VERSION && persisted.version === 3,
    "F2: the migration is written back on load (economy version 1) — it runs once",
  );
  const loads: SaveData[] = [];
  for (let i = 0; i < 10; i++) loads.push((await appLoad(undefined)).save);
  assert(
    loads.every((r) => r.credits === dollars(12_345) && r.economyLedger.length === 0),
    "F3: reloading the migrated save 10 more times changes nothing",
  );
  const m = results[0]!;
  assert(
    migrateEconomy(m, true) === m,
    "F4: migrateEconomy on a migrated save returns it unchanged",
  );
}

// ========== G. Level 250 ==========
console.log("G. Level 250 Final Reward");
{
  memoryStore.clear();
  const at249 = grantEarnedMilestoneRewards(
    freshSave({ credits: 0, levelProgress: progressThrough(249) }),
  ).save;
  assert(
    !milestoneStatuses(at249).find((m) => m.id === FAMILY_LEGACY_ID)!.reached &&
      count(at249, "family-legacy").length === 0,
    "G1: nothing before Level 250",
  );
  const done = completeLevel(LEVELS[249]!.id, at249.levelProgress);
  const withReward = appendLedgerEntry(
    { ...at249, credits: at249.credits + done.rewardCoins, levelProgress: done.progress },
    "completion-reward",
    done.rewardCoins,
    LEVELS[249]!.id,
  );
  const g = grantEarnedMilestoneRewards(withReward);
  const legacy = count(g.save, "family-legacy");
  assert(
    FAMILY_LEGACY_REWARD === dollars(50_000) &&
      legacy.length === 1 &&
      legacy[0]!.amount === dollars(50_000) &&
      done.rewardCoins === paidLevelReward(LEVELS[249]!),
    `G2: completing Level 250 pays its level reward (${fmt(done.rewardCoins)}) + the $50,000 Final Reward, unscaled, as 'family-legacy'`,
  );
  const replay = completeLevel(LEVELS[249]!.id, done.progress);
  assert(
    replay.rewardCoins === 0 &&
      grantEarnedMilestoneRewards({ ...g.save, levelProgress: replay.progress }).granted.length ===
        0,
    "G3: replaying Level 250 pays nothing and no second Final Reward",
  );
  await SaveManager.save(g.save);
  const reloaded = await appLoad(undefined);
  assert(
    reloaded.paid === 0 && count(reloaded.save, "family-legacy").length === 1,
    "G4: reload after Level 250 — still exactly one Final Reward",
  );
  // Reload DURING the finale: Level 250 saved complete but the reward not yet granted → paid once on load.
  memoryStore.clear();
  await SaveManager.save(withReward);
  const first = await appLoad(undefined);
  const second = await appLoad(undefined);
  assert(
    count(first.save, "family-legacy").length === 1 &&
      first.paid >= dollars(50_000) &&
      second.paid === 0 &&
      count(second.save, "family-legacy").length === 1,
    "G5: reload between completing Level 250 and saving its reward — paid once on load, never again",
  );
  let busy = second.save;
  for (let i = 0; i < MAX_LEDGER_ENTRIES + 50; i++)
    busy = appendLedgerEntry({ ...busy, credits: busy.credits + 100 }, "daily-reward", 100);
  assert(
    grantEarnedMilestoneRewards(busy).granted.length === 0,
    "G6: 250 later transactions can't make it payable again",
  );
}

// ========== H. Endless Service ==========
console.log("H. Endless Service");
{
  const p249 = progressThrough(249);
  const p250 = progressThrough(250);
  assert(
    !isEndlessUnlocked(p249) &&
      endlessPool(p249).length === 0 &&
      pickEndlessLevel(p249, 0) === null,
    "H1: Endless Service is locked at Level 249 (nothing to play, nothing to earn)",
  );
  assert(
    isEndlessUnlocked(p250) && endlessPool(p250).length > 0,
    `H2: it unlocks after Level 250 (${endlessPool(p250).length} service levels in the rotation)`,
  );
  // One day of Endless: each completion pays its level's paid reward, recorded as endless-revenue.
  let s = freshSave({ credits: 0, levelProgress: p250 });
  const now = new Date();
  const payouts: number[] = [];
  for (let i = 0; i < 12; i++) {
    const level = pickEndlessLevel(p250, i)!;
    const { earned, endless } = applyEndlessEarn(s.endless, paidLevelReward(level), now);
    s = appendLedgerEntry(
      { ...s, endless, credits: s.credits + earned },
      "endless-revenue",
      earned,
      level.id,
    );
    payouts.push(earned);
  }
  assert(
    s.credits === ENDLESS_DAILY_COIN_CAP &&
      payouts[0]! > 0 &&
      lifetimeTotal(s.economy, "endless-revenue") === ENDLESS_DAILY_COIN_CAP,
    `H3: Endless payout — repeatable, recorded, capped at ${fmt(ENDLESS_DAILY_COIN_CAP)}/day (${payouts
      .filter((p) => p > 0)
      .map(fmt)
      .join(", ")})`,
  );
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const t = applyEndlessEarn(s.endless, paidLevelReward(pickEndlessLevel(p250, 0)!), tomorrow);
  assert(t.earned > 0, "H4: the next day it pays again");
  const firstPass = endlessPool(p250).map((l) => paidLevelReward(l));
  assert(
    firstPass[firstPass.length - 1]! > firstPass[0]!,
    `H5: payouts rise through the rotation (${fmt(firstPass[0]!)} → ${fmt(firstPass[firstPass.length - 1]!)})`,
  );
}

// ========== K. Simulation (runs first: I and J read its saves) ==========
console.log("K. Economy simulation — four profiles");
const normal = runCampaign({
  name: "Normal",
  buyEverything: true,
  // Important upgrades: knives, boards and every kitchen stage; no Blacksmith, fridge or campaign staff.
  buyFilter: (label) => /^(knife|board|kitchen) /.test(label),
  runBusinessDay: false,
  businessEvery: 5,
});
const completionist = runCampaign({
  name: "Completionist",
  buyEverything: true,
  supplierId: "wholesale-supplier",
  runBusinessDay: false,
  businessEvery: 10,
});
const aggressive = runCampaign({
  name: "Aggressive Spender",
  buyEverything: true,
  runBusinessDay: false,
  businessEvery: 3,
  businessStaff: ALL_STAFF_ROLES,
});
memoryStore.clear();
const oldRaw = oldRawSave(120, dollars(18_500));
const existingLoaded = (await appLoad(oldRaw)).save;
const existing = runCampaign({
  name: "Existing Save",
  buyEverything: true,
  runBusinessDay: false,
  businessEvery: 10,
  startSave: existingLoaded,
});
const profiles: Array<[RunReport, string]> = [
  [normal, "knives, boards, all kitchens; a Business day every 5 levels"],
  [completionist, "owns everything, all milestones; Business every 10 levels"],
  [aggressive, "buys everything the moment it can; all Business staff; Business every 3 levels"],
  [existing, "pre-V2.5 save at L120 ($18,500), migrated, then buys everything"],
];
for (const [r] of profiles) {
  assert(
    !r.negativeEver && r.minCash >= 0 && r.reconcileFailures.length === 0,
    `K1: ${r.name} — never below $0 (min ${fmt(r.minCash)}), every step reconciles with the ledger`,
  );
  assert(
    allLevelIds.every((id) => isCompleted(id, r.save.levelProgress)),
    `K2: ${r.name} — all 250 levels completed (no purchase is ever required to progress)`,
  );
  assert(
    count(r.save, "family-legacy").length === 1 && isEndlessUnlocked(r.save.levelProgress),
    `K3: ${r.name} — one $50,000 Final Reward, Endless Service unlocked`,
  );
  const ids = r.save.economyLedger
    .filter((e) => e.category === "milestone-reward")
    .map((e) => e.description);
  assert(new Set(ids).size === ids.length, `K4: ${r.name} — no milestone paid twice`);
}
assert(
  completionist.final >= dollars(100_000) && completionist.final <= dollars(150_000),
  `K5: the completionist ends at ${fmt(completionist.final)} — inside $100,000–$150,000`,
);
assert(
  completionist.everythingOwned &&
    milestoneStatuses(completionist.save).every((m) => m.reached && m.paid),
  `K6: the completionist owns everything and every milestone was reached and paid (${completionist.missing.join(", ") || "nothing missing"})`,
);
assert(
  existingLoaded.credits === dollars(18_500) &&
    count(existing.save, "kitchen-investment-purchase").length === 0 &&
    existing.byCategory["kitchen-investment-purchase"] === undefined,
  "K7: the existing save lost no money at migration and was never charged for its kitchens",
);
const aggressiveBiz = aggressive.save.business.finance.lifetime;
assert(
  aggressive.save.credits >= 0 && aggressiveBiz.revenue > 0,
  `K8: the aggressive spender's Business (all staff) never pushed it into debt (Business revenue ${fmt(aggressiveBiz.revenue)})`,
);

// ========== I. Progress accounting ==========
console.log("I. Progress screen accounting");
{
  const r = completionist;
  const pr = restaurantProgress(r.save);
  const cat = (c: string) => r.byCategory[c] ?? 0;
  assert(
    r.save.economyLedger.length <= MAX_LEDGER_ENTRIES + MILESTONES.length + 20 &&
      pr.money.levelRewards === cat("completion-reward"),
    `I1: "Level rewards earned" ${fmt(pr.money.levelRewards)} = every completion reward actually paid (the ledger itself keeps only its last ${MAX_LEDGER_ENTRIES})`,
  );
  const invested = -(
    cat("knife-purchase") +
    cat("board-purchase") +
    cat("staff-purchase") +
    cat("blacksmith-upgrade") +
    cat("kitchen-investment-purchase") +
    cat("refrigerator-purchase")
  );
  assert(
    pr.money.restaurantInvestment === invested && invested > dollars(135_000),
    `I2: "Invested in your restaurant" ${fmt(pr.money.restaurantInvestment)} = what was actually spent (kitchens $135,000 included)`,
  );
  assert(
    pr.money.milestoneRewards === cat("milestone-reward") &&
      pr.money.familyLegacy === dollars(50_000) &&
      pr.familyLegacy.paid &&
      !pr.familyLegacy.waived &&
      pr.campaignComplete,
    "I3: milestone rewards and the Final Reward match the ledger; campaign complete",
  );
  assert(
    pr.money.businessRevenue === r.save.business.finance.lifetime.revenue &&
      pr.money.businessRevenue === cat("business-revenue"),
    `I4: Business revenue ${fmt(pr.money.businessRevenue)} = Business Mode's lifetime revenue = the ledger`,
  );
  assert(
    pr.historySince === "start",
    "I5: a save started under V2.5 has complete history ('start')",
  );
  // Business payout: one played day moves the wallet by exactly its ledger entries.
  const day = playBusinessDay(focusBusinessMenu(freshSave({ credits: dollars(500) })));
  const net = sumOf(day.save.economyLedger.map((e) => e.amount));
  assert(
    day.served > 0 &&
      day.save.credits === dollars(500) + net &&
      count(day.save, "business-revenue").length === day.served,
    `I6: Business payout — ${day.served} customers served, wallet moved by exactly the ledger (${fmt(net)})`,
  );
}

// ========== J. Historical accounting (old save) ==========
console.log("J. Historical reward accounting");
{
  const s = existingLoaded;
  const pr = restaurantProgress(s);
  const completed = LEVELS.slice(0, 120);
  const actuallyPaid = sumOf(completed.map((l) => dollars(l.reward.coins)));
  const atTodaysRates = sumOf(completed.map((l) => paidLevelReward(l)));
  assert(
    pr.money.levelRewards === actuallyPaid && actuallyPaid !== atTodaysRates,
    `J1: an old save's "Level rewards earned" is what it was actually paid (${fmt(actuallyPaid)} at the old 100%), not today's rates (${fmt(atTodaysRates)})`,
  );
  const ownedPrices =
    sumOf(KNIFE_CATALOG.filter((k) => s.ownedKnifeIds.includes(k.id)).map((k) => k.price)) +
    sumOf(BOARD_CATALOG.filter((b) => s.ownedBoardIds.includes(b.id)).map((b) => b.price)) +
    sumOf(STAFF_CATALOG.filter((m) => s.ownedStaffIds.includes(m.id)).map((m) => m.price)) +
    sumOf([1, 2].map((l) => upgradeCost(l)!)) +
    upgradeCost(1)!;
  assert(
    pr.money.restaurantInvestment === ownedPrices &&
      lifetimeTotal(s.economy, "kitchen-investment-purchase") === 0,
    `J2: its restaurant investment is what it actually spent (${fmt(ownedPrices)}) — the six kitchens it got free count $0`,
  );
  assert(
    pr.historySince === "migration" && pr.money.milestoneRewards === 0,
    "J3: its history is marked as reconstructed at the migration; no milestone money was invented",
  );
  const rates = pr.money.rewardCurve[pr.money.rewardCurve.length - 1]!.cumulative;
  assert(
    rates === atTodaysRates,
    "J4: the chart (labelled 'at today's rates') is the only current-rate figure, kept separate",
  );
}

// ========== Table ==========
console.log(
  "\nPROFILE | START CASH | TOTAL INCOME | TOTAL SPENDING | FINAL CASH | NEGATIVE? | NOTES",
);
for (const [r, note] of profiles) {
  console.log(
    `${r.name} | ${fmt(r.start)} | ${fmt(r.income)} | ${fmt(r.spending)} | ${fmt(r.final)} | ${r.negativeEver ? "YES" : "no"} | ${note}; min ${fmt(r.minCash)}`,
  );
}
console.log("\nCash after level (10 / 20 / 30 / 50 / 70 / 90 / 120 / 160 / 200 / 249 / 250):");
for (const [r] of profiles)
  console.log(
    `  ${r.name}: ` +
      [9, 19, 29, 49, 69, 89, 119, 159, 199, 248, 249]
        .map((i) => fmt(r.cashAtLevel[i]!))
        .join(" / "),
  );
console.log("\nLevel each kitchen stage was built:");
for (const [r] of profiles)
  console.log(
    `  ${r.name}: ` +
      KITCHEN_UPGRADE_CATALOG.filter((u) => u.price > 0)
        .map(
          (u) =>
            `${u.name} L${r.boughtAtLevel[`kitchen ${u.id}`] ?? (r.save.ownedKitchenUpgradeIds.includes(u.id) ? "(owned)" : "—")}`,
        )
        .join(", "),
  );
console.log("\nBusiness (lifetime):");
for (const [r] of profiles) {
  const b = r.save.business.finance.lifetime;
  const days = r.save.business.calendar.businessDay - 1;
  const costs =
    b.inventoryPurchaseCost + b.staffCost + b.maintenanceCost + b.supplierCost + b.inspectionFines;
  console.log(
    `  ${r.name}: ${days} days · revenue ${fmt(b.revenue)} · costs ${fmt(costs)} · net ${fmt(b.revenue - costs)} (${fmt(days ? (b.revenue - costs) / days : 0)}/day)`,
  );
}
console.log(
  failures === 0 ? "\nECONOMY FINAL QA: ALL PASS" : `\nECONOMY FINAL QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
