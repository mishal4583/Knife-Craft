/**
 * ECONOMY MIGRATION — the one-time move of a save written before Economy
 * V2.5 (`economy.version` 0) onto the V2.5 rules. Run by SaveManager.load,
 * after the USD and kitchen migrations. Idempotent: a save at
 * ECONOMY_VERSION is returned unchanged, so loading the same old save any
 * number of times migrates it once and pays nothing.
 *
 * It never takes anything away: balance, levels, knives, boards, staff,
 * Blacksmith levels, kitchen tiers, Business and story state are untouched.
 * It changes only `SaveData.economy`:
 *
 * 1. Milestones — every milestone the save had ALREADY reached is claimed
 *    without payment (`waivedMilestoneIds`); only milestones reached from
 *    now on pay. An already-paid milestone (a ledger entry) stays claimed as
 *    paid. So an old save gets no retroactive windfall, and nothing can be
 *    paid twice.
 * 2. Lifetime totals — reconstructed from what the save records, never
 *    recalculated with the new rules:
 *      completion rewards  old saves: each completed level paid its stored
 *                          reward in full (the pre-V2.5 rule) — exact.
 *                          (A save already on V2.5 rules, i.e. save version
 *                          3 without `economy`, used paidLevelReward.)
 *      knives/boards/staff  the price of each owned item (prices never
 *                          changed) — exact.
 *      Blacksmith          the cost of every step each knife has taken — exact.
 *      kitchen development old saves: $0 — their tiers were free. Version-3
 *                          saves: the price of each owned tier above the first.
 *      refrigerator, Business revenue and costs
 *                          Business Mode's own lifetime totals — exact
 *                          (or "partial" where Business already said so).
 *      milestone/final rewards
 *                          the never-trimmed ledger entries — exact.
 *      everything else     (campaign settlements, daily/Endless income, ad
 *                          rewards, sharpening) the ledger's recent window
 *                          only — a lower bound, which is why
 *                          `lifetimeSince` becomes "migration".
 */
import type { SaveData } from "../SaveManager";
import type { LedgerCategory } from "../economy/ledgerTypes";
import { ECONOMY_VERSION } from "../economy/economyState";
import { dollars } from "../money";
import { getLevels, isCompleted } from "../levels/LevelManager";
import { paidLevelReward } from "../levels/levelRewards";
import { KNIFE_CATALOG } from "../knives/knifeDefinitions";
import { BOARD_CATALOG } from "../boards/boardDefinitions";
import { STAFF_CATALOG } from "../economy/staffDefinitions";
import { KITCHEN_UPGRADE_CATALOG } from "../kitchen/kitchenUpgradeDefinitions";
import {
  BLACKSMITH_STATS,
  MIN_UPGRADE_LEVEL,
  getKnifeUpgrades,
  upgradeCost,
} from "../knives/blacksmith";
import { milestoneStatuses, paidMilestoneIds } from "./milestoneRewards";

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

/** Every Blacksmith step the save's knives have taken, priced. */
function blacksmithSpent(save: SaveData): number {
  let spent = 0;
  for (const id of save.ownedKnifeIds) {
    const levels = getKnifeUpgrades(save, id);
    for (const stat of BLACKSMITH_STATS) {
      for (let l = MIN_UPGRADE_LEVEL; l < levels[stat]; l++) spent += upgradeCost(l) ?? 0;
    }
  }
  return spent;
}

/**
 * @param savedBeforeV25 true when the save was written by a pre-V2.5 build
 *   (its stored `version` was below 3): its level rewards were paid in full
 *   and its kitchen tiers were free.
 */
export function migrateEconomy(save: SaveData, savedBeforeV25: boolean): SaveData {
  if ((save.economy?.version ?? 0) >= ECONOMY_VERSION) return save;
  const completed = getLevels().filter((l) => isCompleted(l.id, save.levelProgress));
  const paid = paidMilestoneIds(save);
  const waived = milestoneStatuses(save)
    .filter((m) => m.reached && !paid.has(m.id))
    .map((m) => m.id);

  // Start from the ledger window, then replace every category that can be
  // reconstructed exactly.
  const lifetime: Partial<Record<LedgerCategory, number>> = {};
  for (const e of save.economyLedger) lifetime[e.category] = (lifetime[e.category] ?? 0) + e.amount;
  const exact: Partial<Record<LedgerCategory, number>> = {
    "completion-reward": sum(
      completed.map((l) => (savedBeforeV25 ? dollars(l.reward.coins) : paidLevelReward(l))),
    ),
    "knife-purchase": -sum(
      KNIFE_CATALOG.filter((k) => save.ownedKnifeIds.includes(k.id)).map((k) => k.price),
    ),
    "board-purchase": -sum(
      BOARD_CATALOG.filter((b) => save.ownedBoardIds.includes(b.id)).map((b) => b.price),
    ),
    "staff-purchase": -sum(
      STAFF_CATALOG.filter((m) => save.ownedStaffIds.includes(m.id)).map((m) => m.price),
    ),
    "blacksmith-upgrade": -blacksmithSpent(save),
    "kitchen-investment-purchase": savedBeforeV25
      ? 0
      : -sum(
          KITCHEN_UPGRADE_CATALOG.filter((u) => save.ownedKitchenUpgradeIds.includes(u.id)).map(
            (u) => u.price,
          ),
        ),
  };
  const business = save.business.finance.lifetime;
  Object.assign(exact, {
    "refrigerator-purchase": -business.capitalExpenditure,
    "business-revenue": business.revenue,
    "inventory-purchase": -business.inventoryPurchaseCost,
    "business-staff-salary": -business.staffCost,
    "refrigerator-maintenance": -business.maintenanceCost,
    "supplier-contract-cancellation": -business.supplierCost,
    "inspection-fine": -business.inspectionFines,
  } satisfies Partial<Record<LedgerCategory, number>>);
  for (const [category, value] of Object.entries(exact) as [LedgerCategory, number][]) {
    if (value === 0) delete lifetime[category];
    else lifetime[category] = value;
  }

  return {
    ...save,
    economy: {
      version: ECONOMY_VERSION,
      claimedMilestoneIds: [...new Set([...paid, ...waived])],
      waivedMilestoneIds: waived,
      lifetime,
      lifetimeSince: "migration",
    },
  };
}
