/**
 * LEVEL_EARNINGS — what a campaign level paid for its orders, for the Level
 * Complete notice (Level 1–10 UX pass: "order payout, completion reward,
 * total"). Display only: read from the ledger the serves already wrote —
 * never recomputed, never paid.
 *
 * A level's paid orders are `levelProgress.paidOrders[levelId]` (recipe ids,
 * oldest first); each paid order wrote ONE "campaign-settlement" entry with
 * its recipe id. The newest unused matching entry is taken for each one, so
 * an order paid on an earlier try (the level was left and retried) still
 * counts. Returns null when an entry can't be found (the ledger keeps the
 * latest 200 entries), so the notice then shows the completion reward only
 * rather than a wrong total.
 */
import type { SaveData } from "../SaveManager";
import { paidOrdersFor } from "./paidOrders";

export function levelOrderEarnings(save: SaveData, levelId: string): number | null {
  const recipes = paidOrdersFor(save.levelProgress, levelId);
  if (recipes.length === 0) return 0;
  const used = new Set<number>();
  let total = 0;
  for (const recipeId of recipes) {
    let found = -1;
    for (let i = save.economyLedger.length - 1; i >= 0; i--) {
      const e = save.economyLedger[i]!;
      if (!used.has(i) && e.category === "campaign-settlement" && e.description === recipeId) {
        found = i;
        break;
      }
    }
    if (found < 0) return null;
    used.add(found);
    total += save.economyLedger[found]!.amount;
  }
  return total;
}
