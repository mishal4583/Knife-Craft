/**
 * ECONOMY V2.5 SIMULATION — the full 250-level campaign with every
 * purchase, driven by the REAL production functions:
 *
 *  - per-level income: economy-v2-campaign-simulation.mts's `simulateCampaign`
 *    (real order settlements + LevelManager.completeLevel's paid reward);
 *  - purchases: KnifeManager.buyKnife, BoardManager.buyBoard,
 *    StaffManager.buyStaff, blacksmith.upgradeKnife,
 *    KitchenUpgradeManager.purchaseKitchenUpgrade,
 *    RefrigeratorManager.purchaseRefrigerator, sharpness.sharpenKnife;
 *  - milestone rewards + the Family Legacy: milestoneRewards.grantEarnedMilestoneRewards;
 *  - a Business day: BusinessDayManager.endBusinessDay.
 *
 * Every step records the ledger entry App.tsx would, and checks that the
 * wallet moved by exactly the signed sum of the new entries and never went
 * below $0. Exported so economy-v25-qa.mts can assert on the same runs.
 *
 * Run: npx tsx scripts/economy-v25-simulation.mts
 */
import { pathToFileURL } from "node:url";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { LEVELS } from "../src/game/levels/levelDefinitions.ts";
import {
  DEFAULT_LEVEL_PROGRESS,
  completeLevel,
  isCompleted,
} from "../src/game/levels/LevelManager.ts";
import { appendLedgerEntry } from "../src/game/economy/EconomyLedger.ts";
import type { LedgerCategory } from "../src/game/economy/ledgerTypes.ts";
import { KNIFE_CATALOG } from "../src/game/knives/knifeDefinitions.ts";
import { BOARD_CATALOG } from "../src/game/boards/boardDefinitions.ts";
import { STAFF_CATALOG } from "../src/game/economy/staffDefinitions.ts";
import { KITCHEN_UPGRADE_CATALOG } from "../src/game/kitchen/kitchenUpgradeDefinitions.ts";
import { REFRIGERATOR_CATALOG } from "../src/game/business/refrigeratorDefinitions.ts";
import { buyKnife } from "../src/game/knives/KnifeManager.ts";
import { buyBoard } from "../src/game/boards/BoardManager.ts";
import { buyStaff } from "../src/game/economy/StaffManager.ts";
import {
  BLACKSMITH_STATS,
  getKnifeUpgrades,
  upgradeCost,
  upgradeKnife,
} from "../src/game/knives/blacksmith.ts";
import { purchaseKitchenUpgrade } from "../src/game/kitchen/KitchenUpgradeManager.ts";
import { purchaseRefrigerator } from "../src/game/business/RefrigeratorManager.ts";
import {
  getKnifeSharpness,
  sharpenKnife,
  sharpnessLossFor,
  SHARPEN_COST,
} from "../src/game/economy/sharpness.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { getRecipe } from "../src/game/recipes/recipeDefinitions.ts";
import { endBusinessDay } from "../src/game/business/BusinessDayManager.ts";
import { hireStaff } from "../src/game/business/BusinessStaffManager.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import {
  advanceBusinessServiceSession,
  businessCustomersToday,
  businessOrderAvailability,
  createBusinessServiceSession,
  recordBusinessServiceComponents,
  serveBusinessOrder,
} from "../src/game/business/BusinessServiceManager.ts";
import {
  businessDishRequirements,
  businessDishForRecipeId,
} from "../src/game/business/businessServiceCatalog.ts";
import {
  makeSeededRand,
  businessServiceSeedFor,
} from "../src/game/business/businessDeterministicRandom.ts";
import { usableQuantity } from "../src/game/business/perishability.ts";
import { getAvailableStorageCapacity } from "../src/game/business/RefrigeratorManager.ts";
import {
  eventForDay,
  maxPurchaseQuantityFor,
} from "../src/game/business/businessSupplierEvents.ts";
import { setDishActive } from "../src/game/business/businessMenuActivation.ts";
import { BUSINESS_DISH_CATALOG } from "../src/game/business/businessDishCatalog.ts";
import {
  recordInventoryPurchase,
  recordMaintenanceCost,
} from "../src/game/business/BusinessFinanceManager.ts";
import {
  maintenanceStatusFor,
  performRefrigeratorMaintenance,
} from "../src/game/business/businessMaintenance.ts";
import { grantEarnedMilestoneRewards } from "../src/game/progression/milestoneRewards.ts";
import { formatUsd } from "../src/game/money.ts";
import { simulateCampaign, type LevelResult } from "./economy-v2-campaign-simulation.mts";

const HONEST = 75;

export type Step = { label: string; before: number; after: number; ledgerDelta: number };

export type RunReport = {
  name: string;
  start: number;
  final: number;
  minCash: number;
  income: number;
  spending: number;
  byCategory: Record<string, number>;
  negativeEver: boolean;
  reconcileFailures: string[];
  everythingOwned: boolean;
  missing: string[];
  save: SaveData;
  cashAtLevel: number[];
  /** Level at which each knife/board/staff/kitchen tier was bought (buyEverything runs). */
  boughtAtLevel: Record<string, number>;
};

/** Mirrors App.tsx: the manager returns a new save; App records the ledger entry. */
function record(
  run: Tracker,
  label: string,
  before: SaveData,
  after: SaveData,
  category: LedgerCategory | null,
  amount: number,
  description?: string,
): SaveData {
  const next = category ? appendLedgerEntry(after, category, amount, description) : after;
  run.check(label, before, next);
  return next;
}

class Tracker {
  minCash = Number.POSITIVE_INFINITY;
  income = 0;
  spending = 0;
  byCategory: Record<string, number> = {};
  negativeEver = false;
  reconcileFailures: string[] = [];
  check(label: string, before: SaveData, after: SaveData) {
    const seen = new Set(before.economyLedger.map((e) => e.id));
    const added = after.economyLedger.filter((e) => !seen.has(e.id));
    const ledgerDelta = added.reduce((s, e) => s + e.amount, 0);
    const delta = after.credits - before.credits;
    if (ledgerDelta !== delta)
      this.reconcileFailures.push(`${label}: wallet ${delta} vs ledger ${ledgerDelta}`);
    for (const e of added) {
      this.byCategory[e.category] = (this.byCategory[e.category] ?? 0) + e.amount;
      if (e.amount > 0) this.income += e.amount;
      else this.spending -= e.amount;
    }
    if (after.credits < 0 || !Number.isInteger(after.credits)) this.negativeEver = true;
    this.minCash = Math.min(this.minCash, after.credits);
  }
}

function recipeLossForLevel(levelIndex: number, orders: number): number {
  const level = LEVELS[levelIndex]!;
  const ids = level.batchGroupRecipeIds ?? level.recipePoolIds ?? [level.recipeId];
  const recipes = ids.map((id) => getCampaignRecipe(id) ?? getRecipe(id)).filter((r) => !!r);
  if (recipes.length === 0) return 0;
  const avg = recipes.reduce((s, r) => s + sharpnessLossFor(r!), 0) / recipes.length;
  return avg * orders;
}

type BuyAttempt = {
  label: string;
  run: (
    s: SaveData,
  ) => { save: SaveData; cost: number; category: LedgerCategory; id: string } | null;
};

/** Everything purchasable, in the order a keen player buys it. */
export function buyAttempts(): BuyAttempt[] {
  const attempts: BuyAttempt[] = [];
  for (const k of KNIFE_CATALOG.filter((k) => k.price > 0)) {
    attempts.push({
      label: `knife ${k.id}`,
      run: (s) => {
        const r = buyKnife(s, k.id);
        return r.ok
          ? { save: r.save, cost: s.credits - r.save.credits, category: "knife-purchase", id: k.id }
          : null;
      },
    });
  }
  for (const b of BOARD_CATALOG.filter((b) => b.price > 0)) {
    attempts.push({
      label: `board ${b.id}`,
      run: (s) => {
        const r = buyBoard(b.id, s);
        return r.ok
          ? { save: r.save, cost: s.credits - r.save.credits, category: "board-purchase", id: b.id }
          : null;
      },
    });
  }
  for (const st of STAFF_CATALOG) {
    attempts.push({
      label: `staff ${st.id}`,
      run: (s) => {
        const r = buyStaff(s, st.id);
        return r.ok
          ? {
              save: r.save,
              cost: s.credits - r.save.credits,
              category: "staff-purchase",
              id: st.id,
            }
          : null;
      },
    });
  }
  for (const u of KITCHEN_UPGRADE_CATALOG.filter((u) => u.price > 0)) {
    attempts.push({
      label: `kitchen ${u.id}`,
      run: (s) => {
        const r = purchaseKitchenUpgrade(s, u.id);
        return r.ok
          ? { save: r.save, cost: r.price, category: "kitchen-investment-purchase", id: u.id }
          : null;
      },
    });
  }
  attempts.push({
    label: "blacksmith",
    run: (s) => {
      // The cheapest available step across every owned knife.
      let best: { knifeId: string; stat: (typeof BLACKSMITH_STATS)[number]; cost: number } | null =
        null;
      for (const knifeId of s.ownedKnifeIds) {
        const levels = getKnifeUpgrades(s, knifeId);
        for (const stat of BLACKSMITH_STATS) {
          const cost = upgradeCost(levels[stat]);
          if (cost !== null && (!best || cost < best.cost)) best = { knifeId, stat, cost };
        }
      }
      if (!best) return null;
      const r = upgradeKnife(s, best.knifeId, best.stat);
      return r.ok
        ? { save: r.save, cost: r.cost, category: "blacksmith-upgrade", id: best.knifeId }
        : null;
    },
  });
  for (const f of REFRIGERATOR_CATALOG.filter((f) => f.price > 0)) {
    attempts.push({
      label: `fridge ${f.id}`,
      run: (s) => {
        // Only ever an upgrade (the game also allows switching down when empty).
        const current = REFRIGERATOR_CATALOG.find(
          (x) => x.id === s.business.refrigerator.refrigeratorId,
        );
        if (current && current.capacity >= f.capacity) return null;
        const r = purchaseRefrigerator(s, f.id);
        return r.ok
          ? { save: r.save, cost: r.price, category: "refrigerator-purchase", id: f.id }
          : null;
      },
    });
  }
  return attempts;
}

function buyEverythingAffordable(
  run: Tracker,
  save: SaveData,
  filter: (label: string) => boolean = () => true,
): SaveData {
  const attempts = buyAttempts().filter((a) => filter(a.label));
  for (let guard = 0; guard < 500; guard++) {
    let bought = false;
    for (const a of attempts) {
      const r = a.run(save);
      if (!r) continue;
      save = record(run, a.label, save, r.save, r.category, -r.cost, r.id);
      save = payMilestones(run, save);
      bought = true;
      break;
    }
    if (!bought) break;
  }
  return save;
}

function payMilestones(run: Tracker, save: SaveData): SaveData {
  const g = grantEarnedMilestoneRewards(save);
  if (g.granted.length)
    run.check(`milestones ${g.granted.map((m) => m.id).join(",")}`, save, g.save);
  return g.save;
}

/** The six-dish menu a simulated Business player runs (everything else off the menu). */
export const BUSINESS_FOCUS_MENU = [
  "biz-garden-salad",
  "biz-tomato-bruschetta",
  "biz-garlic-bread",
  "biz-potato-curry",
  "biz-spinach-curry",
  "biz-greek-lemon-chicken",
];

export function focusBusinessMenu(save: SaveData): SaveData {
  for (const dish of BUSINESS_DISH_CATALOG) {
    if (BUSINESS_FOCUS_MENU.includes(dish.id)) continue;
    const r = setDishActive(save, dish.id, false);
    if (r.ok) save = r.save;
  }
  return save;
}

function needTotals(dishId: string): Array<[string, number]> {
  const dish = BUSINESS_DISH_CATALOG.find((d) => d.id === dishId)!;
  const m = new Map<string, number>();
  for (const r of businessDishRequirements(dish))
    m.set(r.ingredientId, (m.get(r.ingredientId) ?? 0) + r.quantity);
  return [...m];
}

/**
 * One real Business day played the way a sensible player does: repair the
 * fridge when it stops being operational, serve today's customers (the
 * popularity-driven target), buying just the stock each order needs, then
 * close the day (payroll + inspection fine). Every movement is recorded
 * like App.tsx records it. Returns the new save and the customers served.
 */
export function playBusinessDay(save: SaveData): { save: SaveData; served: number } {
  if (
    maintenanceStatusFor(save.business.equipmentCondition.refrigeratorCondition) !== "OPERATIONAL"
  ) {
    const r = performRefrigeratorMaintenance(save);
    if (r.ok)
      save = recordMaintenanceCost(
        appendLedgerEntry(r.save, "refrigerator-maintenance", -r.cost),
        r.cost,
      );
  }
  const day = save.business.calendar.businessDay;
  const rand = makeSeededRand(businessServiceSeedFor(day));
  let session = createBusinessServiceSession(rand, save.business.menuActivation);
  let served = 0;
  const target = businessCustomersToday(save).target;
  while (served < target && session.current) {
    const dish = businessDishForRecipeId(session.current.recipe.id)!;
    if (!businessOrderAvailability(save, dish).available) {
      const cap = maxPurchaseQuantityFor(eventForDay(day));
      for (const [id, need] of needTotals(dish.id)) {
        const have = usableQuantity(save.business.inventory, id as never, day);
        if (have >= need) continue;
        let qty = Math.max(3, Math.ceil(need - have));
        if (cap !== undefined) qty = Math.min(qty, cap);
        qty = Math.min(
          qty,
          Math.floor(
            getAvailableStorageCapacity(
              save.business.inventory,
              save.business.refrigerator.refrigeratorId,
            ),
          ),
        );
        if (qty <= 0) continue;
        const r = purchaseIngredient(save, id, qty);
        if (r.ok)
          save = recordInventoryPurchase(
            appendLedgerEntry(r.save, "inventory-purchase", -r.totalCost, id),
            r.totalCost,
          );
      }
      if (!businessOrderAvailability(save, dish).available) break;
    }
    const result = serveBusinessOrder(recordBusinessServiceComponents(session, 80), save, rand);
    if (!result) break;
    save = appendLedgerEntry(result.save, "business-revenue", result.amountCharged, result.dish.id);
    served++;
    session = advanceBusinessServiceSession(result.session, rand, save.business.menuActivation);
  }
  const end = endBusinessDay(save);
  save = appendLedgerEntry(
    appendLedgerEntry(end.save, "business-staff-salary", -end.payrollPaid),
    "inspection-fine",
    -end.inspectionFine.finePaid,
  );
  return { save, served };
}

/** Hires Business staff (no wallet movement at hiring — wages are paid at each day's close). */
export function hireBusinessStaff(save: SaveData, roles: readonly string[]): SaveData {
  for (const role of roles) {
    const r = hireStaff(save, role as never);
    if (r.ok) save = r.save;
  }
  return save;
}

/** What a finished player would still need to buy (empty = owns everything). */
export function missingPurchases(save: SaveData): string[] {
  const missing: string[] = [];
  for (const k of KNIFE_CATALOG)
    if (!save.ownedKnifeIds.includes(k.id)) missing.push(`knife ${k.id}`);
  for (const b of BOARD_CATALOG)
    if (!save.ownedBoardIds.includes(b.id)) missing.push(`board ${b.id}`);
  for (const s of STAFF_CATALOG)
    if (!save.ownedStaffIds.includes(s.id)) missing.push(`staff ${s.id}`);
  for (const u of KITCHEN_UPGRADE_CATALOG)
    if (!save.ownedKitchenUpgradeIds.includes(u.id)) missing.push(`kitchen ${u.id}`);
  for (const k of KNIFE_CATALOG) {
    const lv = getKnifeUpgrades(save, k.id);
    for (const stat of BLACKSMITH_STATS)
      if (upgradeCost(lv[stat]) !== null) missing.push(`blacksmith ${k.id}.${stat}`);
  }
  const top = REFRIGERATOR_CATALOG[REFRIGERATOR_CATALOG.length - 1]!;
  if (save.business.refrigerator.refrigeratorId !== top.id) missing.push(`fridge ${top.id}`);
  return missing;
}

export type CampaignOptions = {
  name: string;
  /** Buy everything as soon as it's unlocked and affordable. */
  buyEverything: boolean;
  /** Supplier for the whole run (Wholesale is free: -10% ingredient cost). */
  supplierId?: string;
  /** Close one real Business day after Level 10 (the "first Business day" milestone). */
  runBusinessDay: boolean;
  startCredits?: number;
  /** Continue an existing save (already loaded + migrated) instead of a new one. */
  startSave?: SaveData;
  /** Only buy what this accepts (labels as in `buyAttempts`: "knife x", "kitchen y", "blacksmith", …). */
  buyFilter?: (label: string) => boolean;
  /** From Level 10 on, play one full Business day (playBusinessDay) after every Nth level. */
  businessEvery?: number;
  /** Business staff hired before the first played Business day. */
  businessStaff?: readonly string[];
};

/**
 * One full campaign. Income per level comes from `simulateCampaign` for
 * the staff the player owns at that point (four real runs: none, +Prep
 * Assistant, +Quality Chef, all three) — so staff effects count from the
 * moment each is hired. Equipment specialisation bonuses are left out
 * (neutral), which makes the result slightly conservative.
 */
export function runCampaign(opts: CampaignOptions): RunReport {
  const staffOrder = ["prep-assistant", "quality-chef", "kitchen-assistant"];
  const runs = new Map<string, LevelResult[]>();
  const runFor = (owned: readonly string[]) => {
    const key = staffOrder.filter((id) => owned.includes(id)).join(",");
    if (!runs.has(key)) {
      runs.set(
        key,
        simulateCampaign(
          HONEST,
          false,
          DEFAULT_LEVEL_PROGRESS,
          undefined,
          undefined,
          undefined,
          key ? key.split(",") : undefined,
          opts.supplierId,
        ).results,
      );
    }
    return runs.get(key)!;
  };

  const run = new Tracker();
  let save: SaveData = opts.startSave ?? {
    ...DEFAULT_SAVE,
    credits: opts.startCredits ?? DEFAULT_SAVE.credits,
    economyLedger: [],
    selectedSupplierId: opts.supplierId ?? DEFAULT_SAVE.selectedSupplierId,
  };
  const start = save.credits;
  run.minCash = start;
  const cashAtLevel: number[] = [];
  const boughtAtLevel: Record<string, number> = {};
  let progress = save.levelProgress ?? DEFAULT_LEVEL_PROGRESS;
  let businessStarted = false;

  LEVELS.forEach((level, i) => {
    if (isCompleted(level.id, progress)) {
      cashAtLevel.push(save.credits);
      return;
    }
    const result = runFor(save.ownedStaffIds)[i]!;
    // Settlement income and the completion reward, recorded like App.tsx.
    const settlement = result.netResult - result.levelCompletionReward;
    const completion = completeLevel(level.id, progress);
    progress = completion.progress;
    let next: SaveData = { ...save, credits: save.credits + settlement, levelProgress: progress };
    next = appendLedgerEntry(next, "campaign-settlement", settlement, level.id);
    next = { ...next, credits: next.credits + completion.rewardCoins };
    next = appendLedgerEntry(next, "completion-reward", completion.rewardCoins, level.id);
    run.check(`level ${level.id}`, save, next);
    save = next;

    // The equipped knife wears with every order; sharpen at 50.
    const loss = recipeLossForLevel(i, result.orderCount);
    const knife = save.equippedKnifeId;
    const sharp = Math.max(0, getKnifeSharpness(save, knife) - loss);
    save = { ...save, knifeSharpness: { ...save.knifeSharpness, [knife]: sharp } };
    if (sharp < 50 && save.credits >= SHARPEN_COST) {
      const r = sharpenKnife(save, knife);
      if (r.ok) save = record(run, "sharpen", save, r.save, "sharpening", -SHARPEN_COST, knife);
    }

    save = payMilestones(run, save);
    if (opts.runBusinessDay && i === 9) {
      const day = endBusinessDay(save);
      let next2 = appendLedgerEntry(day.save, "business-staff-salary", -day.payrollPaid);
      next2 = appendLedgerEntry(next2, "inspection-fine", -day.inspectionFine.finePaid);
      run.check("business day", save, next2);
      save = payMilestones(run, next2);
    }
    if (opts.businessEvery && i >= 9 && (i + 1) % opts.businessEvery === 0) {
      if (!businessStarted) {
        save = hireBusinessStaff(focusBusinessMenu(save), opts.businessStaff ?? []);
        businessStarted = true;
      }
      const before = save;
      save = playBusinessDay(save).save;
      run.check(`business day after ${level.id}`, before, save);
      save = payMilestones(run, save);
    }
    if (opts.buyEverything) {
      const owned = (s: SaveData) =>
        new Set([
          ...s.ownedKnifeIds.map((id) => `knife ${id}`),
          ...s.ownedBoardIds.map((id) => `board ${id}`),
          ...s.ownedStaffIds.map((id) => `staff ${id}`),
          ...s.ownedKitchenUpgradeIds.map((id) => `kitchen ${id}`),
        ]);
      const had = owned(save);
      save = buyEverythingAffordable(run, save, opts.buyFilter);
      for (const label of owned(save)) if (!had.has(label)) boughtAtLevel[label] = i + 1;
    }
    cashAtLevel.push(save.credits);
  });

  const missing = missingPurchases(save);
  return {
    name: opts.name,
    start,
    final: save.credits,
    minCash: run.minCash,
    income: run.income,
    spending: run.spending,
    byCategory: run.byCategory,
    negativeEver: run.negativeEver,
    reconcileFailures: run.reconcileFailures,
    everythingOwned: missing.length === 0,
    missing,
    save,
    cashAtLevel,
    boughtAtLevel,
  };
}

export const fmt = (c: number) => formatUsd(Math.round(c));

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const reports = [
    runCampaign({
      name: "A. Normal player (Local Market, buys everything)",
      buyEverything: true,
      runBusinessDay: false,
    }),
    runCampaign({
      name: "B. Completionist (Wholesale, buys everything, Business day)",
      buyEverything: true,
      supplierId: "wholesale-supplier",
      runBusinessDay: true,
    }),
    runCampaign({ name: "Saver (buys nothing)", buyEverything: false, runBusinessDay: false }),
  ];
  for (const r of reports) {
    console.log(`\n${r.name}`);
    console.log(
      `  start ${fmt(r.start)} → final ${fmt(r.final)} | income ${fmt(r.income)} | spending ${fmt(r.spending)} | min cash ${fmt(r.minCash)}`,
    );
    console.log(
      `  negative ever: ${r.negativeEver} | reconcile failures: ${r.reconcileFailures.length} | owns everything: ${r.everythingOwned}${r.missing.length ? " missing " + r.missing.slice(0, 6).join(", ") : ""}`,
    );
    console.log(
      "  by category: " +
        Object.entries(r.byCategory)
          .map(([k, v]) => `${k} ${fmt(v)}`)
          .join(" · "),
    );
    console.log(
      "  cash after L20/50/100/150/200/249/250: " +
        [19, 49, 99, 149, 199, 248, 249].map((i) => fmt(r.cashAtLevel[i]!)).join(" / "),
    );
  }
}
