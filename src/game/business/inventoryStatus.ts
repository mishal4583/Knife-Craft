/**
 * INVENTORY_STATUS — the ONE place a stocked ingredient's status is
 * decided, for the Inventory screen (inventoryView.ts) and the physical
 * fridge's tags (fridgeView.ts). It adds no threshold of its own: every
 * input comes from an existing rule.
 *
 *   expired / spoils today / expiring   Business Days left from perishability.ts
 *                                       (1 = spoils at End Business Day tonight,
 *                                       ≤ EXPIRING_SOON_DAYS = expiring soon)
 *   low                                 inventoryAnalytics.lowStockItems: usable stock
 *                                       below what today's customers are expected to use
 *   critical                            a low item that can't cover even one average
 *                                       order (lowStockItems' own dishesLeft < 1)
 *   healthy                             none of the above
 *
 * Order of precedence (most urgent first) is the order of INVENTORY_STATUSES.
 */
import { EXPIRING_SOON_DAYS, type LowStockItem } from "./inventoryAnalytics";

export const INVENTORY_STATUSES = [
  "expired",
  "spoils_today",
  "critical",
  "expiring",
  "low",
  "healthy",
] as const;

export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export function inventoryStatusFor(
  daysLeft: number,
  low: LowStockItem | undefined,
): InventoryStatus {
  if (daysLeft <= 0) return "expired";
  if (daysLeft === 1) return "spoils_today";
  if (low && low.dishesLeft < 1) return "critical";
  if (daysLeft <= EXPIRING_SOON_DAYS) return "expiring";
  if (low) return "low";
  return "healthy";
}

/** Sort key: 0 = most urgent. */
export function inventoryStatusRank(status: InventoryStatus): number {
  return INVENTORY_STATUSES.indexOf(status);
}

/** Label and marker for each status — never colour alone (the marker and the word always show). */
export const INVENTORY_STATUS_META: Record<
  InventoryStatus,
  { label: string; marker: string; tone: "sage" | "gold" | "copper" | "tomato" }
> = {
  expired: { label: "Expired", marker: "🔴", tone: "tomato" },
  spoils_today: { label: "Spoils tonight", marker: "🔴", tone: "tomato" },
  critical: { label: "Critical", marker: "🟠", tone: "copper" },
  expiring: { label: "Expiring", marker: "🟠", tone: "copper" },
  low: { label: "Low", marker: "🟡", tone: "gold" },
  healthy: { label: "Healthy", marker: "🟢", tone: "sage" },
};
