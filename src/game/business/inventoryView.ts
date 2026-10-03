/**
 * INVENTORY_VIEW — the read-only view model behind the Inventory screen
 * (bottom bar → Inventory). It stores nothing and adds no rule: every figure
 * is read from the one inventory (`save.business.inventory`) through the
 * existing selectors —
 *
 *   items, freshness, zones, unknown ids   fridgeView.ts (which reads perishability.ts)
 *   status                                 inventoryStatus.ts (the one central rule)
 *   today's requirement                    inventoryAnalytics.menuDemand (perDay)
 *   running low / expiring / ready         lowStockItems / expiringSoon / menuReadiness
 *   fridge model, space                    fridgeStatus (RefrigeratorManager)
 *
 * Buying happens only in Market → Ingredients and fridge upgrades/repairs
 * only in Business → Equipment; this module has no actions.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import { purchaseUnitFor } from "./businessPricing";
import { normalizeQuantity } from "./businessInventory";
import { usableQuantity } from "./perishability";
import {
  ALL_INGREDIENT_IDS,
  expiringSoon,
  lowStockItems,
  menuDemand,
  menuReadiness,
} from "./inventoryAnalytics";
import { fridgeView, type FridgeView } from "./fridgeView";
import { inventoryStatusRank, type InventoryStatus } from "./inventoryStatus";
import type { PerishabilityState } from "./perishability";

export type { InventoryStatus } from "./inventoryStatus";

export type InventoryItemView = {
  ingredientId: IngredientId;
  name: string;
  /** The Market's ingredient group ("Vegetables", "Dairy & Tofu", …). */
  category: string;
  quantity: number;
  /** "lb" or "piece" — the purchase unit. */
  unit: string;
  /** Weighted-average price paid per unit, whole cents. */
  unitPrice: number;
  /** quantity × unitPrice, whole cents. */
  stockValue: number;
  /** Days left ÷ shelf life, 0–1. */
  freshness: number;
  freshnessState: PerishabilityState;
  daysRemaining: number;
  status: InventoryStatus;
  /** Active menu dishes that use it. */
  menuUses: string[];
  /** What today's customers are expected to use (menuDemand.perDay); absent when the menu doesn't use it. */
  todayRequirement?: number;
  /** Usable stock left after today's expected use, never below 0; absent when the menu doesn't use it. */
  afterToday?: number;
};

export type InventorySummaryView = {
  fridgeName: string;
  /** "Basic" / "Commercial" / "Professional". */
  fridgeShortName: string;
  used: number;
  capacity: number;
  available: number;
  stockValue: number;
  stocked: number;
  ingredientCount: number;
  runningLow: number;
  expiringSoon: number;
  readyDishes: number;
  menuDishes: number;
};

export type InventoryAttentionGroupId =
  "expired" | "spoils_today" | "critical" | "low" | "expiring";

export type InventoryAttentionGroup = {
  id: InventoryAttentionGroupId;
  title: string;
  marker: string;
  items: InventoryItemView[];
};

export type InventoryView = {
  summary: InventorySummaryView;
  fridge: FridgeView;
  items: InventoryItemView[];
  attention: InventoryAttentionGroup[];
  /** Count of items that need attention (every group). */
  attentionCount: number;
  /** Missing ingredients blocking menu dishes (menuReadiness.mostNeeded). */
  mostNeeded: Array<{ id: IngredientId; blocks: number }>;
  unknown: string[];
};

/** Needs Attention groups, most urgent first. Each item sits in the group of its own status. */
const ATTENTION_GROUPS: ReadonlyArray<Omit<InventoryAttentionGroup, "items">> = [
  { id: "expired", title: "Expired", marker: "🔴" },
  { id: "spoils_today", title: "Spoils tonight", marker: "🔴" },
  { id: "critical", title: "Running low", marker: "🟠" },
  { id: "low", title: "Low for today's menu", marker: "🟡" },
  { id: "expiring", title: "Expiring soon", marker: "🟠" },
];

export function inventoryView(save: SaveData): InventoryView {
  const fridge = fridgeView(save);
  const day = save.business.calendar.businessDay;
  const demand = menuDemand(save);
  const readiness = menuReadiness(save);

  const items: InventoryItemView[] = fridge.items.map((f) => {
    const need = demand.get(f.id)?.perDay;
    const onMenu = need !== undefined && need > 0;
    const usable = usableQuantity(save.business.inventory, f.id, day);
    return {
      ingredientId: f.id,
      name: f.name,
      category: f.group,
      quantity: f.quantity,
      unit: purchaseUnitFor(f.id),
      unitPrice: f.unitCost,
      stockValue: f.value,
      freshness: f.freshness,
      freshnessState: f.state,
      daysRemaining: f.daysLeft,
      status: f.status,
      menuUses: f.usedIn,
      ...(onMenu
        ? {
            todayRequirement: normalizeQuantity(need),
            afterToday: normalizeQuantity(Math.max(0, usable - need)),
          }
        : {}),
    };
  });

  const attention = ATTENTION_GROUPS.map((g) => ({
    ...g,
    items: items.filter((i) => i.status === g.id),
  })).filter((g) => g.items.length > 0);

  return {
    summary: {
      fridgeName: fridge.tier.name,
      fridgeShortName: fridge.tier.name.replace(/ Refrigerator$/, ""),
      used: fridge.used,
      capacity: fridge.capacity,
      available: fridge.available,
      stockValue: fridge.stockValue,
      stocked: items.length,
      ingredientCount: ALL_INGREDIENT_IDS.length,
      runningLow: lowStockItems(save).length,
      expiringSoon: expiringSoon(save).length,
      readyDishes: readiness.ready,
      menuDishes: readiness.total,
    },
    fridge,
    items,
    attention,
    attentionCount: attention.reduce((n, g) => n + g.items.length, 0),
    mostNeeded: readiness.mostNeeded,
    unknown: fridge.unknown,
  };
}

export type InventorySort = "status" | "quantity" | "freshness" | "value" | "name";

export const INVENTORY_SORTS: ReadonlyArray<{ id: InventorySort; label: string }> = [
  { id: "status", label: "Status" },
  { id: "quantity", label: "Quantity" },
  { id: "freshness", label: "Freshness" },
  { id: "value", label: "Value" },
  { id: "name", label: "Name" },
];

/** A sorted copy. "status" (the default) puts what needs attention first, then healthy stock. */
export function sortInventory(
  items: InventoryItemView[],
  sort: InventorySort,
): InventoryItemView[] {
  const byName = (a: InventoryItemView, b: InventoryItemView) => a.name.localeCompare(b.name);
  const compare: Record<InventorySort, (a: InventoryItemView, b: InventoryItemView) => number> = {
    status: (a, b) =>
      inventoryStatusRank(a.status) - inventoryStatusRank(b.status) ||
      a.daysRemaining - b.daysRemaining ||
      byName(a, b),
    quantity: (a, b) => b.quantity - a.quantity || byName(a, b),
    freshness: (a, b) => a.freshness - b.freshness || byName(a, b),
    value: (a, b) => b.stockValue - a.stockValue || byName(a, b),
    name: byName,
  };
  return [...items].sort(compare[sort]);
}
