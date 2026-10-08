/**
 * RESTAURANT_ATTENTION — Inventory's "⚠️ NEEDS ATTENTION" for the whole
 * restaurant (developer 2026-10-05 §8): one list across ingredients,
 * supplies, tableware, takeaway packaging, cleaning supplies, fridge space
 * and staff, most urgent first, each with what to do about it. Examples:
 *   "Tomato — 3 remaining (next service needs 5)"
 *   "Napkins — 18 remaining"
 *   "Dish soap — ~8 washes remaining"
 *   "Cleaning liquid — ~2 closings remaining"
 *
 * The restock RECOMMENDATION is the next service's own Pre-Service Check
 * (servicePlanFor — the same tickets, menu guests' active-menu dishes are
 * covered by the stock rows of the dishes they order when served): what it
 * is missing, in Market units and at the Market's price. So Inventory never
 * guesses — it shows exactly what the check would ask for.
 *
 * Read-only (the Inventory rule): every figure comes from the save and the
 * existing systems. Pure; nothing reads RESTAURANT_MODE.
 */
import { formatStockAmount, marketUnitLabel, measureOf } from "../business/measure";
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import { INGREDIENTS } from "../definitions";
import { formatQuantity } from "../business/businessInventory";
import { getLevel, isCompleted } from "../levels/LevelManager";
import { levelNumber } from "../levels/levelMastery";
import type { SupplyId } from "../business/businessSupplies";
import { supplyUnits } from "../business/BusinessSuppliesManager";
import { servicePlanFor } from "./preServiceCheck";
import { bottleView, SERVICE_SUPPLY_RULES } from "./serviceSupplies";
import { fridgeUsage } from "./fridgeUsage";
import { isSystemLive, menuGuestsPerService } from "./restaurantProgression";

/** Napkins are "low" below this many services' worth (configurable). */
export const NAPKIN_LOW_SERVICES = 3;

export type AttentionRow = {
  id: string;
  kind: "ingredient" | "supply" | "bottle" | "fridge" | "staff";
  /** "urgent": the next service can't start without it; "low": it will run out soon. */
  severity: "urgent" | "low";
  text: string;
  action:
    | { to: "ingredient"; id: IngredientId; quantity: number }
    | { to: "supply"; id: SupplyId }
    | { to: "fridge" }
    | { to: "staff" };
};

export type RestaurantAttention = {
  /** The level whose service is next (null once the campaign is complete). */
  nextLevel: number | null;
  rows: AttentionRow[];
  /** What the next service's check would ask to buy, at the Market's price (whole cents). */
  recommendedCost: number;
};

const severityOrder = { urgent: 0, low: 1 } as const;

export function restaurantAttention(save: SaveData): RestaurantAttention {
  const rows: AttentionRow[] = [];
  const level = getLevel(save.levelProgress.highestUnlockedLevelId);
  const plan =
    level && !isCompleted(level.id, save.levelProgress) ? servicePlanFor(save, level) : null;
  const n = plan?.levelNumber ?? levelNumber(save.levelProgress.highestUnlockedLevelId);
  let recommendedCost = 0;
  const measure = measureOf(save);

  if (plan?.check.applies) {
    for (const r of plan.check.missingRows) {
      rows.push({
        id: `ingredient:${r.ingredientId}`,
        kind: "ingredient",
        severity: "urgent",
        text: `${INGREDIENTS[r.ingredientId].name} — ${formatStockAmount(r.ingredientId, r.usable, measure)} remaining (Level ${plan.levelNumber} needs ${formatStockAmount(r.ingredientId, r.needed, measure)})`,
        action: { to: "ingredient", id: r.ingredientId, quantity: r.buyUnits },
      });
      recommendedCost += r.quote?.totalCost ?? 0;
    }
  }
  if (plan?.supplies.applies) {
    for (const r of plan.supplies.rows) {
      if (r.missing === 0) continue;
      rows.push({
        id: `supply:${r.id}`,
        kind: "supply",
        severity: r.blocking ? "urgent" : "low",
        text: `${r.label} — ${r.have} remaining (Level ${plan.levelNumber} needs ${r.need})`,
        action: { to: "supply", id: r.id },
      });
      recommendedCost += r.cost;
    }
  }
  if (plan) {
    // Phase N: the menu guests' stock — optional, so "low", and not in the recommended cost.
    for (const g of plan.guests.rows)
      if (!rows.some((r) => r.id === `ingredient:${g.ingredientId}`))
        rows.push({
          id: `guest:${g.ingredientId}`,
          kind: "ingredient",
          severity: "low",
          text: `${INGREDIENTS[g.ingredientId].name} — ${g.buyUnits} ${marketUnitLabel(g.ingredientId, measure, g.buyUnits)} more for today's menu guests (optional)`,
          action: { to: "ingredient", id: g.ingredientId, quantity: g.buyUnits },
        });
    for (const r of plan.staff.filter((x) => !x.met))
      rows.push({
        id: `staff:${r.id}`,
        kind: "staff",
        severity: "urgent",
        text: `${r.title} needed for Level ${plan.levelNumber}`,
        action: { to: "staff" },
      });
  }

  if (isSystemLive("dine-in", n)) {
    const napkins = supplyUnits(save.business.supplies, SERVICE_SUPPLY_RULES.napkin);
    const perService =
      Math.max(1, menuGuestsPerService(n) + 1) * SERVICE_SUPPLY_RULES.napkinsPerOrder;
    if (
      napkins < perService * NAPKIN_LOW_SERVICES &&
      !rows.some((r) => r.id === "supply:paper-napkins")
    )
      rows.push({
        id: "supply:paper-napkins",
        kind: "supply",
        severity: "low",
        text: `Napkins — ${napkins} remaining`,
        action: { to: "supply", id: "paper-napkins" },
      });
    for (const [id, per] of [
      ["dish-soap", "wash"],
      ["cleaning-liquid", "closing"],
    ] as const) {
      const b = bottleView(save, id);
      if (b.status === "ok") continue;
      rows.push({
        id: `bottle:${id}`,
        kind: "bottle",
        severity: "low",
        text:
          b.status === "empty"
            ? `${id === "dish-soap" ? "Dish soap" : "Cleaning liquid"} — empty`
            : `${id === "dish-soap" ? "Dish soap" : "Cleaning liquid"} — ~${b.servicesLeft} ${per}${b.servicesLeft === 1 ? "" : per === "wash" ? "es" : "s"} remaining`,
        action: { to: "supply", id },
      });
    }
  }

  if (isSystemLive("fridge-freshness", n)) {
    const f = fridgeUsage(save);
    if (f.status !== "ok")
      rows.push({
        id: "fridge",
        kind: "fridge",
        severity: f.status === "full" ? "urgent" : "low",
        text: `Fridge ${f.status === "full" ? "full" : "nearly full"} — ${f.used} / ${f.capacity} units, ${f.free} free`,
        action: { to: "fridge" },
      });
  }

  rows.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return { nextLevel: plan?.levelNumber ?? null, rows, recommendedCost };
}
