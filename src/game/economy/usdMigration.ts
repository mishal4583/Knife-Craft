/**
 * USD_MIGRATION — save version 1 → 2: the one-time move to the game's single
 * US-dollar currency (see src/game/money.ts).
 *
 * In a version-1 save the one wallet integer mixed two scales:
 *   - everything earned or spent in Campaign (level rewards, settlements,
 *     knives, boards, staff, sharpening, the Blacksmith, the starting
 *     balance) was in whole units that now mean WHOLE DOLLARS;
 *   - everything earned or spent in Business Mode was already in CENTS.
 *
 * Business Mode's own lifetime totals (finance.lifetime — a complete
 * running record of every Business cash movement, independent of the
 * 200-entry ledger window) give the exact Business part of the balance, so
 * the wallet splits cleanly:
 *
 *   businessNet  = lifetime revenue − every lifetime Business expense (cents)
 *   campaignPart = oldCredits − businessNet                 (whole dollars)
 *   newCredits   = campaignPart × 100 + businessNet          (cents)
 *
 * A save that never touched Business keeps its whole balance as dollars
 * (350 → $350.00); money a save made in Business stays exactly what it was
 * ($215.19 stays $215.19). Ledger history is converted entry by entry the
 * same way (Campaign categories × 100, Business categories unchanged), and
 * so is Endless Service's "earned today" counter (Campaign money). Nothing
 * is added, removed or duplicated, and `version: 2` means it never runs
 * twice.
 */
import type { SaveData } from "../SaveManager";
import { businessLedgerEntries } from "../business/BusinessFinanceManager";

export const USD_SAVE_VERSION = 2;

export function migrateMoneyToUsd(save: SaveData): SaveData {
  if (save.version >= USD_SAVE_VERSION) return save;
  const lifetime = save.business.finance.lifetime;
  const businessNet =
    lifetime.revenue -
    lifetime.inventoryPurchaseCost -
    lifetime.staffCost -
    lifetime.maintenanceCost -
    lifetime.supplierCost -
    lifetime.inspectionFines -
    lifetime.capitalExpenditure;
  const campaignPart = save.credits - businessNet;
  // Never negative (economic-safety rule) — only reachable by a save whose
  // Business earnings were spent on Campaign items and the lifetime record is partial.
  const credits = Math.max(0, campaignPart * 100 + businessNet);
  const economyLedger = save.economyLedger.map((entry) =>
    businessLedgerEntries([entry]).length === 1 ? entry : { ...entry, amount: entry.amount * 100 },
  );
  return {
    ...save,
    version: USD_SAVE_VERSION,
    credits,
    economyLedger,
    endless: { ...save.endless, coinsEarnedToday: save.endless.coinsEarnedToday * 100 },
  };
}
