/**
 * SERVICE_SUPPLIES — the restaurant's consumable supplies during a service
 * (Unified Restaurant phase G). Low-friction and automatic: nothing is
 * tapped during a service, the Pre-Service Check shows what's short, and only
 * what a service genuinely can't run without blocks it.
 *
 *  - DINE-IN (from the dine-in stage, L31): every order is served on a clean
 *    PLACE SETTING (a dinner plate, fork and knife — reusable tableware) and
 *    takes a NAPKIN. A used setting goes to WASHING; the wash-up after the
 *    service (and before the next one starts) washes them with DISH SOAP.
 *  - TAKEAWAY (from the takeaway stage, L71): a seeded share of a level's
 *    orders are takeaway; each uses one container and one bag (the same rule
 *    and priority lists as a Business order, `takePackagingForOrder`) and a
 *    napkin, and no place setting.
 *  - BOTTLES: dish soap and cleaning liquid are gallon bottles used a little
 *    at a time — soap by each wash-up, cleaning liquid by each closing
 *    wipe-down. The open bottle's level is a percentage; sealed bottles are
 *    the stock units bought in the Market. "~N services left" is
 *    (open % + 100 % × sealed bottles) ÷ the use per service.
 *
 * What blocks: a dine-in order with no clean place setting, a takeaway order
 * with no container or bag. Napkins, dish soap and cleaning liquid only
 * warn (dirty settings simply wait for soap; with too few clean ones the
 * check then asks for plates — or soap). When the wallet can't cover what
 * blocks, Grandma lends her spares (goods at cost 0, opt-in, no money, no
 * ledger — the pantry rule), so a service can never soft-lock.
 *
 * Replays use nothing (like stock). Every figure is in SERVICE_SUPPLY_RULES;
 * prices are the Market's own (Economy TODO #2–#6: not balanced here).
 * State: the optional `business.restaurantSupplies` (open bottles, settings
 * washing); stock is `business.supplies`. Pure; nothing reads
 * RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import {
  getSupplyItem,
  supplyPackPrice,
  type BusinessSuppliesState,
  type SupplyId,
} from "../business/businessSupplies";
import {
  ORDER_BAG_PRIORITY,
  ORDER_CONTAINER_PRIORITY,
  packagingOrdersCovered,
  supplyUnits,
  takeOne,
  takePackagingForOrder,
} from "../business/BusinessSuppliesManager";
import { makeSeededRand } from "../business/businessDeterministicRandom";
import { isSystemLive } from "./restaurantProgression";

/** Every number the restaurant's supplies use (configurable; not balanced — Economy TODO). */
export const SERVICE_SUPPLY_RULES = {
  /** One place setting = one of each (reusable tableware). */
  placeSetting: ["dinner-plates", "dinner-forks", "dinner-knives"] as readonly SupplyId[],
  napkin: "paper-napkins" as SupplyId,
  napkinsPerOrder: 1,
  /** % of a gallon bottle of dish soap one wash-up uses. */
  soapPerWashUp: 5,
  /** % of a gallon bottle of cleaning liquid one closing wipe-down uses. */
  cleanerPerClosing: 10,
  /** Share of a level's orders that are takeaway, once takeaway is open. */
  takeawayShare: 0.3,
  /** A bottle with this many services (or fewer) left is "low". */
  lowServicesLeft: 3,
} as const;

export type RestaurantSuppliesState = {
  /** What's left in the open dish-soap bottle, 0–100 (%). */
  soapPct: number;
  /** What's left in the open cleaning-liquid bottle, 0–100 (%). */
  cleanerPct: number;
  /** Place settings used and waiting to be washed. */
  washing: number;
};

export const DEFAULT_RESTAURANT_SUPPLIES: RestaurantSuppliesState = {
  soapPct: 0,
  cleanerPct: 0,
  washing: 0,
};

const pct = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
const whole = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

/** The save's state, defaulted and clamped (old saves and the classic game have none). */
export function restaurantSuppliesOf(save: SaveData): RestaurantSuppliesState {
  const raw = save.business.restaurantSupplies;
  return {
    soapPct: pct(raw?.soapPct),
    cleanerPct: pct(raw?.cleanerPct),
    washing: whole(raw?.washing),
  };
}

const withState = (
  save: SaveData,
  state: RestaurantSuppliesState,
  supplies: BusinessSuppliesState = save.business.supplies,
): SaveData => ({
  ...save,
  business: { ...save.business, supplies, restaurantSupplies: state },
});

// ── Orders: dine-in or takeaway ─────────────────────────────────────────

export type OrderService = "dine-in" | "takeaway";

/**
 * How the `index`-th order of level `levelNumber` is served (seeded: the same
 * for every player and every try), or null before the dine-in stage (no
 * supplies yet).
 */
export function orderServiceFor(levelNumber: number, index: number): OrderService | null {
  if (!isSystemLive("dine-in", levelNumber)) return null;
  if (!isSystemLive("takeaway", levelNumber)) return "dine-in";
  const roll = makeSeededRand(levelNumber * 104_729 + index * 7_907 + 13)();
  return roll < SERVICE_SUPPLY_RULES.takeawayShare ? "takeaway" : "dine-in";
}

// ── Bottles ─────────────────────────────────────────────────────────────

export type BottleId = "dish-soap" | "cleaning-liquid";

export type BottleView = {
  id: BottleId;
  /** The open bottle, 0–100 %. */
  openPct: number;
  /** Sealed bottles in stock. */
  spare: number;
  /** % used per service (soap: a wash-up; cleaning liquid: a closing). */
  usePer: number;
  /** Whole services the open + sealed bottles still cover. */
  servicesLeft: number;
  status: "ok" | "low" | "empty";
};

const perServiceOf = (id: BottleId) =>
  id === "dish-soap" ? SERVICE_SUPPLY_RULES.soapPerWashUp : SERVICE_SUPPLY_RULES.cleanerPerClosing;
const openOf = (state: RestaurantSuppliesState, id: BottleId) =>
  id === "dish-soap" ? state.soapPct : state.cleanerPct;

export function bottleView(save: SaveData, id: BottleId): BottleView {
  const openPct = openOf(restaurantSuppliesOf(save), id);
  const spare = supplyUnits(save.business.supplies, id);
  const usePer = perServiceOf(id);
  const servicesLeft = Math.floor((openPct + spare * 100) / usePer);
  return {
    id,
    openPct,
    spare,
    usePer,
    servicesLeft,
    status:
      servicesLeft === 0
        ? "empty"
        : servicesLeft <= SERVICE_SUPPLY_RULES.lowServicesLeft
          ? "low"
          : "ok",
  };
}

/**
 * Uses one service's worth from the open bottle, opening a sealed one when
 * the open bottle can't cover it (what's left in the old one is poured in).
 * Opening a bottle takes one stock unit and its cost basis (packaging
 * lifetime "used"), like any consumable. Not enough → nothing changes.
 */
export function drawFromBottle(save: SaveData, id: BottleId): { save: SaveData; ok: boolean } {
  const state = restaurantSuppliesOf(save);
  const use = perServiceOf(id);
  const open = openOf(state, id);
  const set = (next: number) =>
    id === "dish-soap" ? { ...state, soapPct: next } : { ...state, cleanerPct: next };
  if (open >= use) return { save: withState(save, set(open - use)), ok: true };
  const supplies = save.business.supplies;
  const took = takeOne(supplies.stock, id);
  if (!took) return { save, ok: false };
  const totals = supplies.lifetime.packaging;
  return {
    save: withState(save, set(Math.min(100, open + 100 - use)), {
      stock: took.stock,
      lifetime: {
        ...supplies.lifetime,
        packaging: {
          ...totals,
          unitsUsed: totals.unitsUsed + 1,
          usedCost: totals.usedCost + took.cost,
        },
      },
    }),
    ok: true,
  };
}

// ── Place settings ──────────────────────────────────────────────────────

/** Complete place settings owned (the scarcest of plate, fork, knife). */
export function settingsOwned(save: SaveData): number {
  return Math.min(
    ...SERVICE_SUPPLY_RULES.placeSetting.map((id) => supplyUnits(save.business.supplies, id)),
  );
}

/** Clean place settings ready to serve on. */
export function cleanSettings(save: SaveData): number {
  return Math.max(0, settingsOwned(save) - restaurantSuppliesOf(save).washing);
}

/**
 * The wash-up: every setting waiting is washed with one wash-up's soap.
 * Without enough soap they stay dirty (a warning — and, once too few are
 * clean, the check asks for soap or more settings). Runs after a service and
 * when the next one starts. Nothing to wash → no soap used.
 */
export function washUp(
  save: SaveData,
  levelNumber: number,
): { save: SaveData; washed: number; noSoap: boolean } {
  const state = restaurantSuppliesOf(save);
  if (!isSystemLive("dine-in", levelNumber) || state.washing === 0)
    return { save, washed: 0, noSoap: false };
  const soap = drawFromBottle(save, "dish-soap");
  if (!soap.ok) return { save, washed: 0, noSoap: true };
  return {
    save: withState(soap.save, { ...restaurantSuppliesOf(soap.save), washing: 0 }),
    washed: state.washing,
    noSoap: false,
  };
}

/** The closing wipe-down's cleaning liquid (from the dine-in stage). `ok` false: none left (a warning). */
export function closingWipeDown(
  save: SaveData,
  levelNumber: number,
): { save: SaveData; ok: boolean } {
  if (!isSystemLive("dine-in", levelNumber)) return { save, ok: true };
  return drawFromBottle(save, "cleaning-liquid");
}

// ── Serving ─────────────────────────────────────────────────────────────

/**
 * What one served order uses, automatically: dine-in a clean setting (→
 * washing) and a napkin; takeaway a container, a bag and a napkin. Whatever
 * isn't there is simply not used — serving never blocks here (the check
 * made sure before the service; a menu guest's button checks a setting).
 */
export function takeOrderSupplies(save: SaveData, service: OrderService | null): SaveData {
  if (!service) return save;
  let state = restaurantSuppliesOf(save);
  let supplies = save.business.supplies;
  if (service === "dine-in") {
    if (cleanSettings(save) > 0) state = { ...state, washing: state.washing + 1 };
  } else {
    supplies = takePackagingForOrder(supplies).supplies;
  }
  for (let i = 0; i < SERVICE_SUPPLY_RULES.napkinsPerOrder; i++) {
    const took = takeOne(supplies.stock, SERVICE_SUPPLY_RULES.napkin);
    if (!took) break;
    const totals = supplies.lifetime.packaging;
    supplies = {
      stock: took.stock,
      lifetime: {
        ...supplies.lifetime,
        packaging: {
          ...totals,
          unitsUsed: totals.unitsUsed + 1,
          usedCost: totals.usedCost + took.cost,
        },
      },
    };
  }
  return withState(save, state, supplies);
}

// ── The Pre-Service Check's supplies section ────────────────────────────

export type SupplyCheckRow = {
  /** The Market line to restock. */
  id: SupplyId;
  label: string;
  need: number;
  /** Ready to use now (place settings: clean, after the wash-up if there's soap). */
  have: number;
  /** Place settings only: still dirty (no soap to wash them). */
  dirty: number;
  missing: number;
  /** True: the service can't start without it. False: a warning. */
  blocking: boolean;
  /** Market packs that cover the missing units, and their cost. */
  packs: number;
  cost: number;
};

export type ServiceSuppliesCheck =
  | { applies: false }
  | {
      applies: true;
      dineIn: number;
      takeaway: number;
      rows: SupplyCheckRow[];
      soap: BottleView;
      cleaner: BottleView;
      /** Blocking rows all covered. */
      ready: boolean;
      /** What the blocking rows cost at the Market (whole packs). */
      missingCost: number;
      affordable: boolean;
    };

function row(
  save: SaveData,
  id: SupplyId,
  label: string,
  need: number,
  have: number,
  blocking: boolean,
  dirty = 0,
): SupplyCheckRow {
  const item = getSupplyItem(id)!;
  const missing = Math.max(0, need - have);
  const packs = missing > 0 ? Math.ceil(missing / item.packSize) : 0;
  return {
    id,
    label,
    need,
    have,
    dirty,
    missing,
    blocking,
    packs,
    cost: packs * supplyPackPrice(item),
  };
}

/**
 * The supplies a service needs for `services` (each order's dine-in /
 * takeaway; null entries use nothing), from the save alone. The wash-up
 * that runs at Start is counted in (its soap permitting).
 */
export function serviceSuppliesCheck(
  save: SaveData,
  levelNumber: number,
  services: readonly (OrderService | null)[],
): ServiceSuppliesCheck {
  if (!isSystemLive("dine-in", levelNumber)) return { applies: false };
  const washed = washUp(save, levelNumber).save;
  const dirty = restaurantSuppliesOf(washed).washing;
  const dineIn = services.filter((s) => s === "dine-in").length;
  const takeaway = services.filter((s) => s === "takeaway").length;
  const stock = washed.business.supplies;
  const rows: SupplyCheckRow[] = [];
  if (dineIn > 0) {
    for (const id of SERVICE_SUPPLY_RULES.placeSetting) {
      const item = getSupplyItem(id)!;
      rows.push(
        row(save, id, item.name, dineIn, Math.max(0, supplyUnits(stock, id) - dirty), true, dirty),
      );
    }
  }
  if (takeaway > 0) {
    const covered = packagingOrdersCovered(stock);
    rows.push(
      row(
        save,
        ORDER_CONTAINER_PRIORITY[0]!,
        "Takeaway containers",
        takeaway,
        covered.containers,
        true,
      ),
    );
    rows.push(row(save, ORDER_BAG_PRIORITY[0]!, "Takeaway bags", takeaway, covered.bags, true));
  }
  const orders = dineIn + takeaway;
  if (orders > 0)
    rows.push(
      row(
        save,
        SERVICE_SUPPLY_RULES.napkin,
        "Napkins",
        orders * SERVICE_SUPPLY_RULES.napkinsPerOrder,
        supplyUnits(stock, SERVICE_SUPPLY_RULES.napkin),
        false,
      ),
    );
  const missingCost = rows.filter((r) => r.blocking).reduce((n, r) => n + r.cost, 0);
  return {
    applies: true,
    dineIn,
    takeaway,
    rows,
    soap: bottleView(save, "dish-soap"),
    cleaner: bottleView(save, "cleaning-liquid"),
    ready: rows.every((r) => !r.blocking || r.missing === 0),
    missingCost,
    affordable: save.credits >= missingCost,
  };
}

/** True when the supplies alone should open the check (something blocks, or a bottle or the napkins ran out). */
export function suppliesNeedAttention(check: ServiceSuppliesCheck): boolean {
  if (!check.applies) return false;
  return (
    !check.ready ||
    check.soap.status === "empty" ||
    check.cleaner.status === "empty" ||
    check.rows.some((r) => !r.blocking && r.missing > 0)
  );
}

/**
 * Grandma's spares: ONLY when the wallet can't cover what blocks the
 * service, exactly the missing units of the blocking rows, at cost 0 (goods,
 * no money, no ledger — the pantry rule, Economy TODO #17). Null otherwise.
 */
export function grandmasSpares(save: SaveData, check: ServiceSuppliesCheck): SaveData | null {
  if (!check.applies || check.ready || check.affordable) return null;
  const stock = { ...save.business.supplies.stock };
  for (const r of check.rows) {
    if (!r.blocking || r.missing === 0) continue;
    const prev = stock[r.id] ?? { units: 0, costBasis: 0 };
    stock[r.id] = { units: prev.units + r.missing, costBasis: prev.costBasis };
  }
  return {
    ...save,
    business: { ...save.business, supplies: { ...save.business.supplies, stock } },
  };
}
