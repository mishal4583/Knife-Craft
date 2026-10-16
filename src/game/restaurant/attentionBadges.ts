import { collectable } from "../progression/achievements";
import type { SaveData } from "../SaveManager";
import { businessAlertsFor } from "../business/businessAlerts";
import { restaurantAttention } from "./restaurantAttention";
import { areaView, isCleanlinessLive, STRIP_SUPPLIES, supplyGauge } from "./cleanliness";
import { levelNumber } from "../levels/levelMastery";
import type { ScreenId } from "@/components/kc/data";
import type { RestaurantZoneId } from "@/components/kc/restaurantMap/restaurantMap";
import type { SupplyId } from "../business/businessSupplies";
import { getSupplyItem } from "../business/businessSupplies";
import { INGREDIENT_EMOJI } from "../knives/knifeDefinitions";

export type AttentionBadges = {
  nav: Partial<Record<ScreenId, number>>;
  map: Partial<Record<RestaurantZoneId, number>>;
  /** Issue-specific pictograms to pair with each active map alert. */
  mapSymbols: Partial<Record<RestaurantZoneId, string[]>>;
};

const add = <K extends string>(target: Partial<Record<K, number>>, key: K, count: number) => {
  if (count > 0) target[key] = count;
};
const CLEANING_SUPPLIES = new Set<SupplyId>([
  ...STRIP_SUPPLIES,
  "dish-soap",
  "cleaning-liquid",
]);

function uniqueSymbols(symbols: readonly string[]): string[] {
  return [...new Set(symbols)];
}

function supplySymbol(id: SupplyId): string {
  if (id === "toilet-paper" || id === "paper-towels" || id === "paper-napkins") return "🧻";
  if (id === "hand-soap") return "🧼";
  if (id === "floor-cleaner" || id === "brooms") return "🧹";
  if (id === "mop-bucket") return "🪣";
  if (id === "sponges-cloths") return "🧽";
  if (id === "bin-liners") return "🗑️";
  if (id === "toilet-brushes") return "🚽";
  return getSupplyItem(id)?.icon ?? "📦";
}

function inspectionSymbols(detail: string): string[] {
  const categories: [string, string][] = [
    ["Food Storage", "🥫"],
    ["Ingredient Expiry", "⏳"],
    ["Refrigerator Condition", "❄️"],
    ["Equipment Condition", "🔧"],
    ["Kitchen Cleanliness", "🧽"],
    ["Food Safety", "🧼"],
    ["Staff Compliance", "👥"],
  ];
  return categories.filter(([label]) => detail.includes(label)).map(([, symbol]) => symbol);
}

/** Compact, read-only counts for navigation. Every count is derived from live save state. */
export function attentionBadgesFor(save: SaveData): AttentionBadges {
  const nav: Partial<Record<ScreenId, number>> = {};
  const map: Partial<Record<RestaurantZoneId, number>> = {};
  const mapSymbols: Partial<Record<RestaurantZoneId, string[]>> = {};
  const attention = restaurantAttention(save);
  const allBusiness = businessAlertsFor(save);
  const business = allBusiness.filter(
    (alert) => alert.severity === "critical" || alert.severity === "warning",
  );
  const inventoryBusiness = allBusiness.filter(
    (alert) =>
      alert.severity !== "ok" &&
      (alert.key.startsWith("spoil-tonight:") ||
        alert.key.startsWith("near-expiry:") ||
        alert.key === "no-dishes" ||
        alert.key.startsWith("order-blocked:")),
  );
  const level = levelNumber(save.levelProgress.highestUnlockedLevelId);

  const stockCount = attention.rows.length;
  const marketCount = attention.rows.filter(
    (row) => row.kind === "ingredient" || row.kind === "supply" || row.kind === "bottle",
  ).length;
  const alreadyFlaggedSupplies = new Set(
    attention.rows.flatMap((row) => (row.action.to === "supply" ? [row.action.id] : [])),
  );
  const lowCleaningSupplies = [...CLEANING_SUPPLIES].filter(
    (id) => supplyGauge(save, id).low && !alreadyFlaggedSupplies.has(id),
  ).length;
  const staffCount =
    attention.rows.filter((row) => row.kind === "staff").length +
    business.filter((alert) => alert.key.startsWith("payroll-")).length;
  const fridgeCount =
    attention.rows.filter((row) => row.kind === "fridge").length +
    business.filter((alert) => alert.key.startsWith("fridge:")).length;
  const businessCount = business.length + attention.rows.filter((row) => row.kind === "staff").length;

  let kitchenCount = 0;
  let diningCount = 0;
  let restroomCount = 0;
  let kitchenSymbols: string[] = [];
  let diningSymbols: string[] = [];
  let restroomSymbols: string[] = [];
  if (isCleanlinessLive(level)) {
    const kitchen = areaView(save, "kitchen", level);
    const dining = areaView(save, "dining", level);
    const restroom = areaView(save, "restroom", level);
    kitchenCount = kitchen.tasks.length;
    diningCount = dining.tasks.length;
    diningCount += attention.rows.filter(
      (row) => row.kind === "supply" && row.action.to === "supply" && row.action.id === "paper-napkins",
    ).length;
    restroomCount = restroom.tasks.length;
    // Refill consumables are a restroom attention item even before a scheduled paper check.
    restroomCount += ["toilet-paper", "paper-towels", "hand-soap"].filter(
      (id) => supplyGauge(save, id as Parameters<typeof supplyGauge>[1]).low,
    ).length;
    kitchenSymbols = uniqueSymbols(kitchen.tasks.map((task) => task.rule.icon));
    diningSymbols = uniqueSymbols([
      ...dining.tasks.map((task) => task.rule.icon),
      ...attention.rows
        .filter((row) => row.kind === "supply" && row.action.to === "supply" && row.action.id === "paper-napkins")
        .map(() => "🧻"),
    ]);
    restroomSymbols = uniqueSymbols([
      ...restroom.tasks.map((task) => task.rule.icon),
      ...(["toilet-paper", "paper-towels", "hand-soap"] as const)
        .filter((id) => supplyGauge(save, id).low)
        .map(supplySymbol),
    ]);
  }

  const cleaningSupplyCount =
    attention.rows.filter(
      (row) =>
        row.kind === "bottle" ||
        (row.kind === "supply" && row.action.to === "supply" && CLEANING_SUPPLIES.has(row.action.id)),
    ).length + lowCleaningSupplies;
  const serviceCount = business.filter(
    (alert) => alert.key === "no-dishes" || alert.key.startsWith("order-blocked:"),
  ).length;

  add(nav, "kitchen", kitchenCount);
  add(nav, "inventory", stockCount + lowCleaningSupplies + inventoryBusiness.length);
  add(nav, "shop", marketCount + lowCleaningSupplies);
  add(nav, "business", businessCount);
  add(
    nav,
    "restaurant-map",
    kitchenCount + diningCount + restroomCount + businessCount + stockCount + lowCleaningSupplies,
  );

  add(map, "inventory", stockCount + inventoryBusiness.length);
  if (stockCount + inventoryBusiness.length > 0) {
    mapSymbols.inventory = uniqueSymbols([
      ...attention.rows.map((row) =>
        row.action.to === "supply" ? supplySymbol(row.action.id) :
          row.action.to === "fridge" ? "❄️" :
            row.action.to === "staff" ? "👥" : INGREDIENT_EMOJI[row.action.id],
      ),
      ...inventoryBusiness.map((alert) =>
        alert.key.startsWith("spoil-tonight:") || alert.key.startsWith("near-expiry:")
          ? "⏳"
          : alert.key.startsWith("order-blocked:")
            ? "🚫"
            : "🍽️",
      ),
    ]);
  }
  add(map, "refrigerator", fridgeCount);
  if (fridgeCount > 0) {
    mapSymbols.refrigerator = uniqueSymbols([
      ...(attention.rows.some((row) => row.kind === "fridge") ? ["❄️"] : []),
      ...business.filter((alert) => alert.key.startsWith("fridge:")).map(() => "🛠️"),
    ]);
  }
  add(map, "staff", staffCount);
  if (staffCount > 0) {
    mapSymbols.staff = uniqueSymbols([
      ...(attention.rows.some((row) => row.kind === "staff") ? ["👥"] : []),
      ...business.filter((alert) => alert.key.startsWith("payroll-")).map(() => "💰"),
    ]);
  }
  add(map, "kitchen", kitchenCount);
  if (kitchenCount > 0) mapSymbols.kitchen = kitchenSymbols.length ? kitchenSymbols : ["🧽"];
  add(map, "cleaning", cleaningSupplyCount);
  if (cleaningSupplyCount > 0) {
    mapSymbols.cleaning = uniqueSymbols([
      ...attention.rows.flatMap((row) => {
        if (row.kind === "bottle") return ["🧴"];
        if (row.kind === "supply" && row.action.to === "supply" && CLEANING_SUPPLIES.has(row.action.id)) {
          return [supplySymbol(row.action.id)];
        }
        return [];
      }),
      ...[...CLEANING_SUPPLIES]
        .filter((id) => supplyGauge(save, id).low && !alreadyFlaggedSupplies.has(id))
        .map(supplySymbol),
    ]);
  }
  add(map, "restroom", restroomCount);
  if (restroomCount > 0) mapSymbols.restroom = restroomSymbols.length ? restroomSymbols : ["🚽"];
  add(map, "dining", diningCount);
  if (diningCount > 0) mapSymbols.dining = diningSymbols.length ? diningSymbols : ["🧹"];
  add(map, "service", serviceCount);
  if (serviceCount > 0) {
    mapSymbols.service = uniqueSymbols(
      business
        .filter((alert) => alert.key === "no-dishes" || alert.key.startsWith("order-blocked:"))
        .map((alert) => (alert.key.startsWith("order-blocked:") ? "🚫" : "🍽️")),
    );
  }
  add(map, "office", businessCount);
  if (businessCount > 0) {
    mapSymbols.office = uniqueSymbols([
      ...business.flatMap((alert) => {
        if (alert.key.startsWith("inspection:")) {
          const icons = inspectionSymbols(alert.detail);
          return icons.length ? icons : ["🧾"];
        }
        return [
          alert.key.startsWith("spoil-tonight:") || alert.key.startsWith("near-expiry:") ? "⏳" :
            alert.key.startsWith("fridge:") ? "🛠️" :
              alert.key.startsWith("payroll-") ? "💰" :
                alert.key.startsWith("supplier-event:") ? "🚚" :
                  alert.key === "no-dishes" || alert.key.startsWith("order-blocked:") ? "🍽️" : "⚠️",
        ];
      }),
      ...attention.rows.filter((row) => row.kind === "staff").map(() => "👥"),
    ]);
  }

  // Achievement rewards waiting to be collected (progression/achievements.ts).
  add(nav, "rack", collectable(save).length);

  return { nav, map, mapSymbols };
}
