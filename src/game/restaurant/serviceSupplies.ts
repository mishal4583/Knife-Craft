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
 * blocks, a rewarded ad or supplier credit covers it (serviceCover.ts —
 * developer 2026-10-10: no more Grandma's spares), so a service can never
 * soft-lock.
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
import type { RecipeDefinition } from "../recipes/recipeTypes";
import { dishServiceFor } from "./dishService";

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
  /** Dish soap with this many washes (or fewer) left is "low" (a warning, never a block). */
  lowWashesLeft: 8,
  /** Cleaning liquid with this many closings (or fewer) left is "low". */
  lowClosingsLeft: 3,
  // ── Supplies plan B (developer 2026-10-10: "use everything when necessary") ──
  /** Every dine-in guest gets a glass of water. */
  waterGlass: "water-glasses" as SupplyId,
  /** The bar (from "A bigger restaurant · full management", L121): this share of guests orders a drink. */
  barFromLevel: 121,
  barShare: 0.25,
  /** An established restaurant (L161) serves coffee or tea: with every dessert, and this share of other guests. */
  coffeeFromLevel: 161,
  coffeeShare: 0.3,
  /** Steak is served with a steak knife from the first steak (L106). */
  steakKnifeFromLevel: 106,
  /** Two dine-in guests to a table, at most this many tables. */
  coversPerTable: 2,
  maxTables: 6,
  /** What each table has (durable, never used up): pieces per table, from a level. */
  tablePieces: [
    { id: "menu-stands" as SupplyId, perTable: 1, fromLevel: 31 },
    { id: "salt-pepper" as SupplyId, perTable: 2, fromLevel: 31 },
    { id: "napkin-holders" as SupplyId, perTable: 1, fromLevel: 31 },
    { id: "water-jugs" as SupplyId, perTable: 1, fromLevel: 46 },
  ],
  /** One in this many washed pieces breaks (seeded): plates, bowls and glasses; cutlery goes missing less often. */
  breakOneIn: { crockery: 60, cutlery: 120 },
  /** Dish soap: this % per piece washed, at least `soapPerWashUp` per wash-up. */
  soapPerPiece: 0.25,
  /** Messy dishes (curries, fried, skewers) take this many napkins. */
  napkinsMessy: 2,
} as const;

export type RestaurantSuppliesState = {
  /** What's left in the open dish-soap bottle, 0–100 (%). */
  soapPct: number;
  /** What's left in the open cleaning-liquid bottle, 0–100 (%). */
  cleanerPct: number;
  /** Covers (dine-in guests) whose tableware waits to be washed. */
  washing: number;
  /** Plan B: each tableware piece waiting to be washed (an older save's `washing` = plate + fork + knife). */
  dirty: Partial<Record<SupplyId, number>>;
  /** Pieces ever washed and broken (the breakage seed, and the restaurant's record). */
  washedTotal: number;
  brokenTotal: number;
};

export const DEFAULT_RESTAURANT_SUPPLIES: RestaurantSuppliesState = {
  soapPct: 0,
  cleanerPct: 0,
  washing: 0,
  dirty: {},
  washedTotal: 0,
  brokenTotal: 0,
};

const pct = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
const whole = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

/** The save's state, defaulted and clamped (old saves and the classic game have none). */
export function restaurantSuppliesOf(save: SaveData): RestaurantSuppliesState {
  const raw = save.business.restaurantSupplies as Partial<RestaurantSuppliesState> | undefined;
  const washing = whole(raw?.washing);
  const dirty: Partial<Record<SupplyId, number>> = {};
  if (raw?.dirty && typeof raw.dirty === "object") {
    for (const [id, n] of Object.entries(raw.dirty))
      if (getSupplyItem(id) && whole(n) > 0) dirty[id as SupplyId] = whole(n);
  } else if (washing > 0) {
    // An older save: `washing` place settings = that many plates, forks and knives.
    for (const id of SERVICE_SUPPLY_RULES.placeSetting) dirty[id] = washing;
  }
  return {
    soapPct: pct(raw?.soapPct),
    cleanerPct: pct(raw?.cleanerPct),
    washing,
    dirty,
    washedTotal: whole(raw?.washedTotal),
    brokenTotal: whole(raw?.brokenTotal),
  };
}

const dirtyOf = (state: RestaurantSuppliesState, id: SupplyId) => state.dirty[id] ?? 0;

/** A piece ready to serve on: owned and not waiting to be washed. */
export function cleanUnits(save: SaveData, id: SupplyId): number {
  return Math.max(
    0,
    supplyUnits(save.business.supplies, id) - dirtyOf(restaurantSuppliesOf(save), id),
  );
}

// ── Tableware by dish (supplies plan B) ─────────────────────────────────

/** A seeded 0–1 roll for one cover's extras (the same for every player and every try). */
const coverRoll = (levelNumber: number, cover: number, salt: number) =>
  makeSeededRand(levelNumber * 31_337 + cover * 977 + salt)();

/**
 * The tableware one dine-in guest eats from, by their dish (dishService.ts):
 * soups and curries a bowl and soup spoon; fruit a dessert plate and fork (a
 * teaspoon for cups); bread a side plate and knife; salads a plate and
 * fork; everything else plate, fork and knife — a steak knife for steak
 * from L106; shared boards an extra side plate. Every guest a water glass;
 * from L121 some order a drink at the bar (highball glass); from L161
 * coffee or tea (cup and saucer) with every dessert and for some others.
 * No recipe (an older caller) = the plain place setting.
 */
export function coverPiecesFor(
  recipe: RecipeDefinition | null | undefined,
  levelNumber: number,
  cover: number,
): SupplyId[] {
  const R = SERVICE_SUPPLY_RULES;
  if (!recipe) return [...R.placeSetting];
  const d = dishServiceFor(recipe);
  const pieces: SupplyId[] = d.cooking.includes("pot")
    ? ["soup-bowls", "soup-spoons"]
    : d.kind === "fruit"
      ? /\bcup\b/i.test(recipe.name)
        ? ["dessert-plates", "teaspoons"]
        : ["dessert-plates", "dessert-forks"]
      : d.kind === "bread"
        ? ["side-plates", "dinner-knives"]
        : d.kind === "salad"
          ? ["dinner-plates", "dinner-forks"]
          : [
              "dinner-plates",
              "dinner-forks",
              d.protein === "steak" && levelNumber >= R.steakKnifeFromLevel
                ? "steak-knives"
                : "dinner-knives",
            ];
  if (d.shared && !pieces.includes("side-plates")) pieces.push("side-plates");
  pieces.push(R.waterGlass);
  if (levelNumber >= R.barFromLevel && coverRoll(levelNumber, cover, 11) < R.barShare)
    pieces.push("highball-glasses");
  if (
    levelNumber >= R.coffeeFromLevel &&
    (d.kind === "fruit" || coverRoll(levelNumber, cover, 23) < R.coffeeShare)
  )
    pieces.push("coffee-tea-set");
  return pieces;
}

/** The napkins one order takes: two for messy dishes (curries, fried, skewers). */
export function napkinsFor(recipe: RecipeDefinition | null | undefined): number {
  return recipe && dishServiceFor(recipe).messy
    ? SERVICE_SUPPLY_RULES.napkinsMessy
    : SERVICE_SUPPLY_RULES.napkinsPerOrder;
}

/** True when every piece a guest's dish needs is clean now. */
export function cleanSettingFor(
  save: SaveData,
  recipe: RecipeDefinition | null | undefined,
  levelNumber: number,
  cover: number,
): boolean {
  const need = new Map<SupplyId, number>();
  for (const id of coverPiecesFor(recipe, levelNumber, cover))
    need.set(id, (need.get(id) ?? 0) + 1);
  return [...need].every(([id, n]) => cleanUnits(save, id) >= n);
}

/** Tables a service sets: two guests to a table (at most `maxTables`). */
export function tablesFor(covers: number): number {
  return Math.min(
    SERVICE_SUPPLY_RULES.maxTables,
    Math.ceil(covers / SERVICE_SUPPLY_RULES.coversPerTable),
  );
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
        : servicesLeft <=
            (id === "dish-soap"
              ? SERVICE_SUPPLY_RULES.lowWashesLeft
              : SERVICE_SUPPLY_RULES.lowClosingsLeft)
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
export function drawFromBottle(
  save: SaveData,
  id: BottleId,
  /** % of a bottle to use (default: one service's worth). */
  amount: number = perServiceOf(id),
): { save: SaveData; ok: boolean } {
  const state = restaurantSuppliesOf(save);
  const use = Math.min(100, Math.max(0, amount));
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

/** Clean place settings ready to serve on (plate + fork + knife). */
export function cleanSettings(save: SaveData): number {
  return Math.min(...SERVICE_SUPPLY_RULES.placeSetting.map((id) => cleanUnits(save, id)));
}

/** The soap one wash-up of `pieces` uses (% of a bottle). */
export function soapForPieces(pieces: number): number {
  return Math.max(
    SERVICE_SUPPLY_RULES.soapPerWashUp,
    Math.round(pieces * SERVICE_SUPPLY_RULES.soapPerPiece * 100) / 100,
  );
}

/** Whether washed piece number `n` (the restaurant's running count) of `id` breaks (seeded). */
function breaks(id: SupplyId, n: number): boolean {
  const group = getSupplyItem(id)?.group;
  const oneIn =
    group === "Cutlery"
      ? SERVICE_SUPPLY_RULES.breakOneIn.cutlery
      : group === "Crockery" || group === "Glassware & hollowware"
        ? SERVICE_SUPPLY_RULES.breakOneIn.crockery
        : 0;
  if (oneIn === 0) return false;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return makeSeededRand(n * 7_919 + h)() < 1 / oneIn;
}

/**
 * The wash-up: every piece waiting is washed — the soap scales with the
 * pieces (at least one wash-up's worth). Now and then a plate or glass
 * breaks, or a fork goes missing (seeded): it leaves the stock, so
 * tableware is restocked over time like any real restaurant's. Without
 * enough soap everything stays dirty (a warning — and, once too few are
 * clean, the check asks for soap or more). Runs after a service and when
 * the next one starts. Nothing to wash → no soap used.
 */
export function washUp(
  save: SaveData,
  levelNumber: number,
): {
  save: SaveData;
  washed: number;
  noSoap: boolean;
  /** Pieces that broke in this wash-up. */
  broken: SupplyId[];
} {
  const state = restaurantSuppliesOf(save);
  const pieces = Object.values(state.dirty).reduce((t, n) => t + (n ?? 0), 0);
  if (!isSystemLive("dine-in", levelNumber) || pieces === 0)
    return { save, washed: 0, noSoap: false, broken: [] };
  const soap = drawFromBottle(save, "dish-soap", soapForPieces(pieces));
  if (!soap.ok) return { save, washed: 0, noSoap: true, broken: [] };
  let supplies = soap.save.business.supplies;
  const broken: SupplyId[] = [];
  let count = state.washedTotal;
  for (const [id, n] of Object.entries(state.dirty) as [SupplyId, number][]) {
    for (let k = 0; k < n; k++) {
      count++;
      if (!breaks(id, count)) continue;
      const took = takeOne(supplies.stock, id);
      if (!took) continue;
      supplies = { ...supplies, stock: took.stock };
      broken.push(id);
    }
  }
  return {
    save: withState(
      soap.save,
      {
        ...restaurantSuppliesOf(soap.save),
        washing: 0,
        dirty: {},
        washedTotal: state.washedTotal + pieces,
        brokenTotal: state.brokenTotal + broken.length,
      },
      supplies,
    ),
    washed: pieces,
    noSoap: false,
    broken,
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
export function takeOrderSupplies(
  save: SaveData,
  service: OrderService | null,
  /** Plan B: the dish and its cover (level, index) — what the guest eats from; absent = a plain setting. */
  cover?: { recipe: RecipeDefinition; levelNumber: number; index: number },
): SaveData {
  if (!service) return save;
  let state = restaurantSuppliesOf(save);
  let supplies = save.business.supplies;
  if (service === "dine-in") {
    const pieces = coverPiecesFor(cover?.recipe, cover?.levelNumber ?? 0, cover?.index ?? 0);
    const dirty = { ...state.dirty };
    let used = false;
    for (const id of pieces) {
      if (supplyUnits(supplies, id) - (dirty[id] ?? 0) < 1) continue;
      dirty[id] = (dirty[id] ?? 0) + 1;
      used = true;
    }
    if (used) state = { ...state, dirty, washing: state.washing + 1 };
  } else {
    supplies = takePackagingForOrder(supplies).supplies;
  }
  for (let i = 0; i < napkinsFor(cover?.recipe); i++) {
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
  /** Plan B: optional tableware for the menu guests (never blocks, never opens the sheet). */
  guest?: boolean;
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
 * that runs at Start is counted in (its soap permitting — and the pieces
 * it may break). Plan B (`opts`): each dine-in order's own tableware by its
 * dish (`recipes`, aligned with `services`; covers numbered from
 * `firstCover`), and the tables set for those orders and the menu guests
 * (`guests`). Without `recipes` every dine-in order is a plain setting.
 */
export function serviceSuppliesCheck(
  save: SaveData,
  levelNumber: number,
  services: readonly (OrderService | null)[],
  opts: {
    recipes?: readonly (RecipeDefinition | null)[];
    guests?: number;
    firstCover?: number;
    /** The menu guests still to come (their dishes): optional rows, never blocking. */
    guestRecipes?: readonly RecipeDefinition[];
    /** The first guest's cover number (seeds their drink / coffee). */
    firstGuestCover?: number;
  } = {},
): ServiceSuppliesCheck {
  if (!isSystemLive("dine-in", levelNumber)) return { applies: false };
  const washed = washUp(save, levelNumber).save;
  const state = restaurantSuppliesOf(washed);
  const dineIn = services.filter((s) => s === "dine-in").length;
  const takeaway = services.filter((s) => s === "takeaway").length;
  const stock = washed.business.supplies;
  const rows: SupplyCheckRow[] = [];
  // Each dine-in guest's tableware, by their dish.
  const need = new Map<SupplyId, number>();
  services.forEach((service, i) => {
    if (service !== "dine-in") return;
    for (const id of coverPiecesFor(opts.recipes?.[i], levelNumber, (opts.firstCover ?? 0) + i))
      need.set(id, (need.get(id) ?? 0) + 1);
  });
  for (const [id, n] of need) {
    const item = getSupplyItem(id)!;
    const dirty = dirtyOf(state, id);
    rows.push(
      row(save, id, item.name, n, Math.max(0, supplyUnits(stock, id) - dirty), true, dirty),
    );
  }
  // The menu guests eat in too: what their dishes need beyond the orders' (optional).
  const guestNeed = new Map<SupplyId, number>();
  (opts.guestRecipes ?? []).forEach((recipe, g) => {
    for (const id of coverPiecesFor(recipe, levelNumber, (opts.firstGuestCover ?? 100) + g))
      guestNeed.set(id, (guestNeed.get(id) ?? 0) + 1);
  });
  for (const [id, n] of guestNeed) {
    const item = getSupplyItem(id)!;
    const clean = Math.max(0, supplyUnits(stock, id) - dirtyOf(state, id));
    const spare = Math.max(0, clean - (need.get(id) ?? 0));
    if (spare >= n) continue;
    // The orders' own row for it is short already: its Restock (a whole pack) comes first.
    if ((need.get(id) ?? 0) > clean) continue;
    rows.push({ ...row(save, id, `${item.name} · for menu guests`, n, spare, false), guest: true });
  }
  // The tables (durable pieces) for the orders and the menu guests.
  if (dineIn > 0 && opts.recipes) {
    const tables = tablesFor(dineIn + (opts.guests ?? 0));
    for (const t of SERVICE_SUPPLY_RULES.tablePieces) {
      if (levelNumber < t.fromLevel) continue;
      const item = getSupplyItem(t.id)!;
      rows.push(
        row(
          save,
          t.id,
          `${item.name} · ${tables} ${tables === 1 ? "table" : "tables"}`,
          tables * t.perTable,
          supplyUnits(stock, t.id),
          true,
        ),
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
  const napkins = services.reduce(
    (t, service, i) => (service ? t + napkinsFor(opts.recipes?.[i]) : t),
    0,
  );
  if (napkins > 0)
    rows.push(
      row(
        save,
        SERVICE_SUPPLY_RULES.napkin,
        "Napkins",
        napkins,
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
    check.rows.some((r) => !r.blocking && !r.guest && r.missing > 0)
  );
}
