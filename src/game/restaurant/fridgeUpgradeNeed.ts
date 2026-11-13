/**
 * THE BIGGER FRIDGE, BEFORE THE KITCHEN GETS STUCK (developer 2026-11-13: "before the game is about to get stuck, when the player has the money,
 * ask him to buy the new fridge and make it mandatory; if he doesn't have the full money, watch a video to get a discount").
 *
 * Since the prep batch the fridge fills with what services leave over, and a player who never upgrades is stopped around Level 46. The
 * Pre-Service Check now sees it coming:
 *
 *  - "full": today's missing food does not fit the fridge;
 *  - "soon": after today's shopping and service, what one of the next two services must buy would not fit (their own orders, against the
 *    shelf as it will be then: what is on it now, plus the purchases, minus what is used).
 *
 * In both cases the next fridge up is offered ON the check, with one button:
 *
 *  - the wallet covers it (and, for "soon", today's food as well): the purchase is REQUIRED, START waits for it;
 *  - the wallet is short by no more than the ad's discount (25 %): a rewarded ad takes the discount off. The ad pays the discount as ONE
 *    "rewarded-ad" ledger entry and the fridge is bought at its full price in the same save (one "refrigerator-purchase" entry), so the
 *    wallet and the ledger agree. Once a day, only on `rewarded`, never needed: a player who cannot or will not is covered by the
 *    supplier (`serviceCover.fridgeStuckFor`), as before;
 *  - neither: the card only says how much is missing; nothing is blocked by it.
 *
 * Pure. No new save field: today's ad is read from the ledger, like the other ad bonuses.
 */
import type { SaveData } from "../SaveManager";
import type { LevelDefinition } from "../levels/levelTypes";
import type { RecipeDefinition } from "../recipes/recipeTypes";
import type { RefrigeratorDefinition } from "../business/refrigeratorTypes";
import { REFRIGERATOR_CATALOG } from "../business/refrigeratorDefinitions";
import type { IngredientId } from "../definitions";
import { getRefrigeratorCapacity, purchaseRefrigerator } from "../business/RefrigeratorManager";
import { marketUnitsCovering, measureOf, stockForMarketUnits } from "../business/measure";
import { normalizeQuantity } from "../business/businessInventory";
import { appendLedgerEntry } from "../economy/EconomyLedger";
import { dailyKeyFor } from "../daily/DailyOrderManager";
import { getLevel } from "../levels/LevelManager";
import { orderRequirements, serviceUsesStock, type ServiceStockCheck } from "./campaignStock";
import { sumRequirements } from "./recipeRequirements";
import { rollServiceTickets, savedTicketsFor } from "./serviceTickets";

/** The services after this one that must still fit. */
export const FRIDGE_LOOKAHEAD_LEVELS = 2;
/** What the rewarded ad takes off the fridge's price. */
export const FRIDGE_AD_DISCOUNT_SHARE = 0.25;
/** One discount ad a day. */
export const FRIDGE_AD_DAILY_CAP = 1;
export const FRIDGE_AD_ID_PREFIX = "knifecraft-fridge-discount-";

export type FridgeNeed = {
  reason: "full" | "soon";
  /** The next fridge up. */
  fridge: RefrigeratorDefinition;
  capacity: number;
  price: number;
  /** "soon": the first coming level that would not fit, and the units it needs against the room left. */
  atLevel: number;
  needUnits: number;
  roomLeft: number;
  /** The wallet covers the fridge's full price. */
  canPay: boolean;
  /** The wallet covers it and the purchase must be made before the service starts. */
  required: boolean;
  /** The ad's discount in cents (0 when it is not on offer: the wallet covers the price, is too far away, or today's ad is used). */
  adDiscount: number;
  /** What the wallet still lacks for the full price (0 when it covers it). */
  shortBy: number;
};

/** The next fridge up from the one owned, or null at the top. */
export function nextFridgeUp(save: SaveData): RefrigeratorDefinition | null {
  const capacity = getRefrigeratorCapacity(save.business.refrigerator.refrigeratorId);
  return (
    REFRIGERATOR_CATALOG.filter((f) => f.capacity > capacity).sort(
      (a, b) => a.capacity - b.capacity,
    )[0] ?? null
  );
}

/** The ad's discount on `price`: whole dollars. */
export function fridgeAdDiscount(price: number): number {
  return Math.floor((price * FRIDGE_AD_DISCOUNT_SHARE) / 100) * 100;
}

/** The fridge units a service's own orders take when all of it is bought (whole Market units, the player's measure). */
export function serviceFridgeUnits(
  save: SaveData,
  levelNumber: number,
  tickets: readonly RecipeDefinition[],
): number {
  const measure = measureOf(save);
  return normalizeQuantity(
    sumRequirements(
      tickets.flatMap((recipe) => orderRequirements(save, recipe, "factor", levelNumber)),
    ).reduce(
      (sum, r) =>
        sum +
        stockForMarketUnits(
          r.ingredientId,
          marketUnitsCovering(r.ingredientId, r.quantity, measure),
          measure,
        ),
      0,
    ),
  );
}

export function fridgeAdsToday(save: SaveData, now: Date): number {
  const today = dailyKeyFor(now);
  return save.economyLedger.filter(
    (e) =>
      e.category === "rewarded-ad" &&
      !!e.description?.startsWith(FRIDGE_AD_ID_PREFIX) &&
      dailyKeyFor(new Date(e.timestamp)) === today,
  ).length;
}

/** A level's own orders: the saved tickets, else the ones it will roll (the roll is seeded by the level, so they are the same). */
function ticketsOf(save: SaveData, level: LevelDefinition): RecipeDefinition[] {
  return savedTicketsFor(save.levelProgress, level) ?? rollServiceTickets(level);
}

/**
 * The bigger fridge this service asks for, or null (room enough, no bigger fridge, or stock is not used yet).
 * `check` is the Pre-Service Check's own stock check of `levelNumber`.
 */
export function fridgeNeedFor(
  save: SaveData,
  levelNumber: number,
  check: ServiceStockCheck,
  now: Date,
): FridgeNeed | null {
  if (!check.applies || !serviceUsesStock(levelNumber)) return null;
  const fridge = nextFridgeUp(save);
  if (!fridge) return null;
  const capacity = getRefrigeratorCapacity(save.business.refrigerator.refrigeratorId);

  let reason: FridgeNeed["reason"] | null = null;
  let atLevel = levelNumber;
  let needUnits = check.storageNeeded;
  let roomLeft = check.storageFree;
  if (check.storageNeeded > check.storageFree) reason = "full";
  else {
    // The shelf as it will be: what is there now, plus today's purchases, minus what today's orders use; then each coming service buys what
    // it lacks (whole Market units) and uses its own. The first one whose purchases do not fit is where the kitchen would be stuck.
    const measure = measureOf(save);
    const shelf = new Map<IngredientId, number>();
    for (const [id, entry] of Object.entries(save.business.inventory))
      if (entry && entry.quantity > 0) shelf.set(id as IngredientId, entry.quantity);
    for (const r of check.rows)
      shelf.set(
        r.ingredientId,
        Math.max(
          0,
          (shelf.get(r.ingredientId) ?? 0) +
            stockForMarketUnits(r.ingredientId, r.buyUnits, measure) -
            r.needed,
        ),
      );
    const usedOf = () => [...shelf.values()].reduce((sum, q) => sum + q, 0);
    for (let n = levelNumber + 1; n <= levelNumber + FRIDGE_LOOKAHEAD_LEVELS; n++) {
      const level = getLevel(`level-${n}`);
      if (!level || !serviceUsesStock(n)) continue;
      const needs = sumRequirements(
        ticketsOf(save, level).flatMap((recipe) => orderRequirements(save, recipe, "factor", n)),
      );
      const buys = needs.map((r) => {
        const have = shelf.get(r.ingredientId) ?? 0;
        const missing = normalizeQuantity(Math.max(0, r.quantity - have));
        return stockForMarketUnits(
          r.ingredientId,
          marketUnitsCovering(r.ingredientId, missing, measure),
          measure,
        );
      });
      const buy = normalizeQuantity(buys.reduce((sum, q) => sum + q, 0));
      const room = normalizeQuantity(Math.max(0, capacity - usedOf()));
      if (buy > room) {
        reason = "soon";
        atLevel = n;
        needUnits = buy;
        roomLeft = room;
        break;
      }
      needs.forEach((r, i) =>
        shelf.set(
          r.ingredientId,
          Math.max(0, (shelf.get(r.ingredientId) ?? 0) + buys[i]! - r.quantity),
        ),
      );
    }
  }
  if (!reason) return null;

  const price = fridge.price;
  const canPay = save.credits >= price;
  // "soon": today's food comes first, the fridge is required only when the wallet covers both.
  const required =
    reason === "full" ? canPay : save.credits >= price + (check.ready ? 0 : check.missingCost);
  const shortBy = Math.max(0, price - save.credits);
  const discount = fridgeAdDiscount(price);
  const adDiscount =
    !canPay && shortBy <= discount && fridgeAdsToday(save, now) < FRIDGE_AD_DAILY_CAP
      ? discount
      : 0;
  return {
    reason,
    fridge,
    capacity,
    price,
    atLevel,
    needUnits,
    roomLeft,
    canPay,
    required,
    adDiscount,
    shortBy,
  };
}

/** A fresh id for one fridge-discount ad (never sent as a placement: the placement is the fixed `fridge_discount`). */
export function newFridgeDiscountRewardId(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
  return `${FRIDGE_AD_ID_PREFIX}${uuid}`;
}

export type FridgeBuyResult =
  | { ok: true; save: SaveData; fridgeId: string; price: number; discount: number }
  | { ok: false; reason: "noNeed" | "insufficientFunds" | "alreadyClaimed" | "failed" };

/**
 * Buys the needed fridge from the check. `rewardId` set = the discount ad was watched to the end (call it only after Bridge reported
 * `rewarded`, on the latest save): the discount is credited as one "rewarded-ad" entry and the fridge bought at its full price, in ONE new
 * save, or nothing changes. The ledger entries are written here; the caller records the capital expenditure and saves.
 */
export function buyNeededFridge(
  save: SaveData,
  need: FridgeNeed | null,
  rewardId: string | null,
): FridgeBuyResult {
  if (!need) return { ok: false, reason: "noNeed" };
  let base = save;
  let discount = 0;
  if (rewardId) {
    if (need.adDiscount <= 0) return { ok: false, reason: "noNeed" };
    if (!rewardId.startsWith(FRIDGE_AD_ID_PREFIX)) return { ok: false, reason: "failed" };
    if (save.economyLedger.some((e) => e.description === rewardId))
      return { ok: false, reason: "alreadyClaimed" };
    discount = need.adDiscount;
    base = appendLedgerEntry(
      { ...save, credits: save.credits + discount },
      "rewarded-ad",
      discount,
      rewardId,
    );
  }
  const bought = purchaseRefrigerator(base, need.fridge.id);
  if (!bought.ok)
    return { ok: false, reason: bought.reason === "insufficientFunds" ? bought.reason : "failed" };
  return {
    ok: true,
    save: appendLedgerEntry(bought.save, "refrigerator-purchase", -bought.price, need.fridge.id),
    fridgeId: need.fridge.id,
    price: bought.price,
    discount,
  };
}
