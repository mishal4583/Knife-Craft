/**
 * RUSH RESTOCK — the one-tap emergency restock for a blocked Business
 * order. When the current customer's dish is missing ingredients, the
 * player can buy EXACTLY the shortfall for that one dish without visiting
 * the Market:
 *
 *  - "cash": today's normal Market unit price (`todaysUnitCost`, the same
 *    pricing the Market uses) plus RUSH_RESTOCK_FEE, rounded to the cent.
 *  - "ad":   free, after a rewarded ad (App.tsx runs the ad; this file only
 *    applies the result). Unlimited — the player chooses ad or cash.
 *
 * This file holds the fee, the types and the pure helpers. The purchase
 * itself lives with the Market's own in BusinessInventoryManager.ts
 * (`rushRestockPlan` / `rushRestock`) — the one Business manager that
 * stocks ingredients and charges for them — and App.tsx records the cash
 * restock through the same ledger step as a Market purchase.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";

/** Rush Restock costs this much more than today's Market price. */
export const RUSH_RESTOCK_FEE = 0.25;

export type RushRestockPayment = "cash" | "ad";

export type RushRestockLine = {
  ingredientId: IngredientId;
  /** Whole units bought. */
  quantity: number;
  /** Today's Market unit price, before the rush fee. */
  marketUnitCost: number;
  /** What one unit costs with the rush fee (cash). */
  rushUnitCost: number;
  /** quantity × rushUnitCost. */
  rushTotal: number;
};

export type RushRestockPlan = {
  lines: RushRestockLine[];
  totalQuantity: number;
  /** What paying cash costs in total. */
  cashCost: number;
  /** What the same units cost in the Market (for showing the fee). */
  marketCost: number;
};

export type RushRestockFailure =
  | "notBlocked"
  | "insufficientFunds"
  | "insufficientStorage"
  | "exceedsShortageLimit"
  | "wouldNotUnblock";

export type RushRestockResult =
  | {
      ok: true;
      save: SaveData;
      payment: RushRestockPayment;
      lines: RushRestockLine[];
      /** Credits actually spent: the cash cost, or 0 for an ad restock. */
      totalCost: number;
    }
  | { ok: false; reason: RushRestockFailure };

/** What the Rush Restock buttons report back (App.tsx's rushRestockCurrentOrder). */
export type RushRestockOutcome =
  | { ok: true; payment: RushRestockPayment; totalCost: number }
  | {
      ok: false;
      reason:
        RushRestockFailure | "notRewarded" | "adUnavailable" | "adFailed" | "busy" | "orderChanged";
    };

/** A fresh id for one rewarded-ad request. Contains no user data. */
export function newRushRestockRewardId(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
  return `knifecraft-rush-restock-${uuid}`;
}

/** The rush price of one unit: today's Market price + RUSH_RESTOCK_FEE, whole cents. */
export function rushUnitCost(marketUnitCost: number): number {
  return Math.round(marketUnitCost * (1 + RUSH_RESTOCK_FEE));
}
