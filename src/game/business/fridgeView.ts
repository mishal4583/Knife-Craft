/**
 * FRIDGE_VIEW — the read-only display adapter behind the physical
 * refrigerator on the Inventory screen (`kc/inventory/fridge/PhysicalFridge`).
 * It turns state that already exists into "what sits where in the fridge":
 *
 *   stock, value, paid price   business.inventory (one aggregate entry per ingredient)
 *   freshness                  perishability.ts (weighted purchaseDay vs the Business Day)
 *   low stock                  inventoryAnalytics.lowStockItems (today's menu demand)
 *   used in                    inventoryAnalytics.activeDishesUsing (the active menu)
 *   tier, capacity, used       refrigeratorDefinitions + RefrigeratorManager
 *   condition                  business.equipmentCondition (businessMaintenance)
 *
 * It stores nothing, prices nothing and buys nothing: the fridge's only
 * actions navigate (restock → Market → Ingredients, upgrade/repair →
 * Business → Equipment). Freshness is the aggregate entry's — one item per
 * ingredient, never invented batches.
 */
import type { SaveData } from "../SaveManager";
import { INGREDIENTS, type IngredientId } from "../definitions";
import { REFRIGERATOR_CATALOG } from "./refrigeratorDefinitions";
import {
  ageInDays,
  perishabilityStateFor,
  shelfLifeForIngredient,
  type PerishabilityState,
} from "./perishability";
import { conditionBandFor, type ConditionBand } from "./businessEquipmentCondition";
import { maintenanceStatusFor, type MaintenanceStatus } from "./businessMaintenance";
import { inventoryStatusFor, type InventoryStatus } from "./inventoryStatus";
import {
  INGREDIENT_GROUPS,
  activeDishesUsing,
  fridgeStatus,
  lowStockItems,
  type MenuInEffect,
} from "./inventoryAnalytics";

/**
 * The design handoff (refrigerator-claude-handoff, `fridgeData.ts`) used its
 * own kebab-case ingredient ids. Every one maps explicitly to a production
 * IngredientId; `fridge-view-qa` checks the map covers all 57 both ways, so
 * nothing from the handoff is dropped or guessed.
 */
export const HANDOFF_INGREDIENT_ID_MAP: Readonly<Record<string, IngredientId>> = {
  tomato: "tomato",
  carrot: "carrot",
  cucumber: "cucumber",
  onion: "onion",
  potato: "potato",
  mushroom: "mushroom",
  "bell-pepper": "pepper",
  zucchini: "zucchini",
  eggplant: "eggplant",
  broccoli: "broccoli",
  corn: "corn",
  celery: "celery",
  lettuce: "lettuce",
  cabbage: "cabbage",
  cauliflower: "cauliflower",
  spinach: "spinach",
  asparagus: "asparagus",
  radish: "radish",
  beetroot: "beetroot",
  "sweet-potato": "sweetpotato",
  "green-bean": "greenbean",
  fennel: "fennel",
  artichoke: "artichoke",
  "pea-pod": "peapod",
  pumpkin: "pumpkin",
  turnip: "turnip",
  "green-chili": "chilli",
  "green-onion": "springonion",
  strawberry: "strawberry",
  apple: "apple",
  orange: "orange",
  lemon: "lemon",
  avocado: "avocado",
  pear: "pear",
  peach: "peach",
  pineapple: "pineapple",
  watermelon: "watermelon",
  mango: "mango",
  kiwi: "kiwi",
  pomegranate: "pomegranate",
  grapes: "grapes",
  coconut: "coconut",
  lime: "lime",
  basil: "basil",
  parsley: "parsley",
  cilantro: "cilantro",
  garlic: "garlic",
  ginger: "ginger",
  bread: "bread",
  baguette: "baguette",
  cheddar: "cheddar",
  mozzarella: "mozzarella",
  butter: "butter",
  tofu: "tofu",
  chicken: "chicken",
  ribeye: "steak",
  salmon: "salmon",
};

export type FridgeZoneId =
  | "dairy"
  | "vegetables"
  | "protein"
  | "fruit-drawer"
  | "greens-drawer"
  | "door-butter"
  | "door-aromatics";

export type FridgeZone = {
  id: FridgeZoneId;
  label: string;
  icon: string;
  place: "shelf" | "drawer" | "door";
};

/**
 * Where things go in a real reach-in, top to bottom: dairy on the top shelf,
 * vegetables in the middle, raw meat and fish low (below anything ready to
 * eat), fruit and greens in the crisper drawers, butter and aromatics in the
 * door. The game has no eggs, sauces or oils, so there is no egg tray or
 * sauce rack.
 */
export const FRIDGE_ZONES: readonly FridgeZone[] = [
  { id: "dairy", label: "Dairy & Tofu", icon: "🧀", place: "shelf" },
  { id: "vegetables", label: "Vegetables", icon: "🥕", place: "shelf" },
  { id: "protein", label: "Meat, Fish & Bread", icon: "🥩", place: "shelf" },
  { id: "fruit-drawer", label: "Fruit", icon: "🍎", place: "drawer" },
  { id: "greens-drawer", label: "Greens & Herbs", icon: "🌿", place: "drawer" },
  { id: "door-butter", label: "Butter", icon: "🧈", place: "door" },
  { id: "door-aromatics", label: "Aromatics", icon: "🧄", place: "door" },
];

const LEAFY: ReadonlySet<IngredientId> = new Set<IngredientId>(["lettuce", "spinach"]);

/** The zone an ingredient is shown in — from the registry's own category. */
export function fridgeZoneFor(id: IngredientId): FridgeZoneId {
  if (id === "butter") return "door-butter";
  if (id === "chilli") return "door-aromatics";
  if (LEAFY.has(id)) return "greens-drawer";
  switch (INGREDIENTS[id].category) {
    case "Dairy":
      return "dairy";
    case "Protein":
    case "Bakery":
      return "protein";
    case "Fruit":
      return "fruit-drawer";
    case "Herb":
      return "greens-drawer";
    case "Aromatic":
      return "door-aromatics";
    default:
      return "vegetables";
  }
}

/** The category tabs: All + the Market's own ingredient groups (INGREDIENT_GROUPS). */
export function fridgeGroupLabel(id: IngredientId): string {
  const category = INGREDIENTS[id].category;
  return INGREDIENT_GROUPS.find((g) => g.category === category)?.label ?? category;
}

export type FridgeAttentionReason = "expired" | "spoils-tonight" | "expiring" | "low";

export type FridgeItem = {
  id: IngredientId;
  name: string;
  group: string;
  zone: FridgeZoneId;
  quantity: number;
  /** The aggregate entry's weighted-average price paid, whole cents per unit. */
  unitCost: number;
  /** quantity × unitCost, whole cents. */
  value: number;
  state: PerishabilityState;
  shelfLife: number;
  /** Business Days until it expires: 1 = spoils at End Business Day tonight, 0 = expired. */
  daysLeft: number;
  /** daysLeft / shelfLife, 0–1 — the label's freshness bar. */
  freshness: number;
  /** The central stock status (inventoryStatus.ts). */
  status: InventoryStatus;
  attention: FridgeAttentionReason | null;
  usedIn: string[];
};

export type FridgeAttention = {
  id: IngredientId;
  name: string;
  reason: FridgeAttentionReason;
  /** Usable/on-hand quantity. */
  quantity: number;
  daysLeft: number | null;
};

export type FridgeTier = {
  id: string;
  name: string;
  /** The catalog's own line ("A two-door reach-in, built for a busier kitchen."). */
  description: string;
  capacity: number;
  price: number;
  approxCubicFeet: number;
  /** 0 = Basic, 1 = Commercial, 2 = Professional (catalog order). */
  rank: number;
};

export type FridgeView = {
  tier: FridgeTier;
  nextTier: FridgeTier | null;
  tiers: FridgeTier[];
  used: number;
  capacity: number;
  available: number;
  usage: number;
  stockValue: number;
  condition: number;
  conditionBand: ConditionBand;
  maintenance: MaintenanceStatus;
  /**
   * The cooling status line: "Refrigerated", "Needs service" or "Broken",
   * straight from the maintenance status. Deliberately not a temperature —
   * the game models fridge condition, not degrees.
   */
  cooling: string;
  items: FridgeItem[];
  zones: Array<{ zone: FridgeZone; items: FridgeItem[] }>;
  attention: FridgeAttention[];
  /** Inventory keys the registry doesn't know — listed, never silently dropped. */
  unknown: string[];
};

export const FRIDGE_COOLING_LABEL: Record<MaintenanceStatus, string> = {
  OPERATIONAL: "Refrigerated",
  NEEDS_SERVICE: "Needs service",
  BROKEN: "Broken",
};

const ATTENTION_ORDER: Record<FridgeAttentionReason, number> = {
  expired: 0,
  "spoils-tonight": 1,
  expiring: 2,
  low: 3,
};

function tierOf(rank: number): FridgeTier {
  const def = REFRIGERATOR_CATALOG[rank]!;
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    capacity: def.capacity,
    price: def.price,
    approxCubicFeet: def.approxCubicFeet,
    rank,
  };
}

/** The fridge tag's attention marker, from the one central status (inventoryStatus.ts). */
const ATTENTION_FOR_STATUS: Record<InventoryStatus, FridgeAttentionReason | null> = {
  expired: "expired",
  spoils_today: "spoils-tonight",
  critical: "low",
  expiring: "expiring",
  low: "low",
  healthy: null,
};

/** `menu`: the menu in effect (inventoryAnalytics.MenuInEffect); the Business menu by default. */
export function fridgeView(save: SaveData, menu?: MenuInEffect): FridgeView {
  const business = save.business;
  const day = business.calendar.businessDay;
  const fridge = fridgeStatus(save);
  const rank = Math.max(
    0,
    REFRIGERATOR_CATALOG.findIndex((r) => r.id === business.refrigerator.refrigeratorId),
  );
  const tiers = REFRIGERATOR_CATALOG.map((_, i) => tierOf(i));
  const low = new Map(lowStockItems(save, menu).map((l) => [l.id, l]));

  const items: FridgeItem[] = [];
  const unknown: string[] = [];
  for (const [key, entry] of Object.entries(business.inventory)) {
    if (!entry || entry.quantity <= 0) continue;
    const id = entry.ingredientId;
    if (!(key in INGREDIENTS) || !(id in INGREDIENTS)) {
      unknown.push(key);
      continue;
    }
    const shelfLife = shelfLifeForIngredient(id);
    const daysLeft = Math.max(0, shelfLife - ageInDays(entry.purchaseDay, day));
    const status = inventoryStatusFor(daysLeft, low.get(id));
    items.push({
      id,
      name: INGREDIENTS[id].name,
      group: fridgeGroupLabel(id),
      zone: fridgeZoneFor(id),
      quantity: entry.quantity,
      unitCost: entry.unitCost,
      value: Math.round(entry.quantity * entry.unitCost),
      state: perishabilityStateFor(id, entry.purchaseDay, day),
      shelfLife,
      daysLeft,
      freshness: shelfLife > 0 ? Math.min(1, daysLeft / shelfLife) : 0,
      status,
      attention: ATTENTION_FOR_STATUS[status],
      usedIn: activeDishesUsing(save, id, menu).map((d) => d.name),
    });
  }
  items.sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name));

  const attention: FridgeAttention[] = items
    .filter((i) => i.attention !== null)
    .map((i) => ({
      id: i.id,
      name: i.name,
      reason: i.attention!,
      quantity: i.quantity,
      daysLeft: i.daysLeft,
    }));
  attention.sort(
    (a, b) =>
      ATTENTION_ORDER[a.reason] - ATTENTION_ORDER[b.reason] ||
      (a.daysLeft ?? 99) - (b.daysLeft ?? 99) ||
      a.name.localeCompare(b.name),
  );

  const condition = business.equipmentCondition.refrigeratorCondition;
  const maintenance = maintenanceStatusFor(condition);
  return {
    tier: tiers[rank]!,
    nextTier: tiers[rank + 1] ?? null,
    tiers,
    used: fridge.used,
    capacity: fridge.capacity,
    available: fridge.available,
    usage: fridge.usage,
    stockValue: fridge.stockValue,
    condition,
    conditionBand: conditionBandFor(condition),
    maintenance,
    cooling: FRIDGE_COOLING_LABEL[maintenance],
    items,
    zones: FRIDGE_ZONES.map((zone) => ({
      zone,
      items: items.filter((i) => i.zone === zone.id),
    })),
    attention,
    unknown,
  };
}
