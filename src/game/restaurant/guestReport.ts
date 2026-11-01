/**
 * GUEST REPORT (Phase 8D): what the Pace card tells about guests — read-only, derived, nothing stored.
 * The next service's numbers as parts the player can read ("4 + 1 seat + 3 pull → 8 served, 1 turned away"),
 * and the last service's star report. A separate module so the pure rules (guestDemand, serviceQuality,
 * menuGuests) stay free of each other's imports.
 */
import type { SaveData } from "../SaveManager";
import { restaurantLevelOf } from "./restaurantMenu";
import { serviceGuestPlan } from "./menuGuests";
import { serviceResultsOf, type ServiceResult } from "./serviceQuality";

export type NextServiceGuests = {
  /** The next service's number. */
  level: number;
  /** The meal ("Lunch", …) when known. */
  service: string | null;
  base: number;
  seats: number;
  /** The pull's parts (reputation, menu, hour, spotless) and their total. */
  pull: { reputation: number; menu: number; hour: number; spotless: number; total: number };
  /** Menu guests plus the walk-in the service takes, and the guests it cannot take. */
  served: number;
  turnedAway: number;
};

/** The next service's guests, or null before the menu opens (no guests yet). */
export function nextServiceGuests(save: SaveData): NextServiceGuests | null {
  const level = restaurantLevelOf(save.levelProgress);
  const plan = serviceGuestPlan(save, level);
  if (plan.base <= 0) return null;
  return {
    level,
    service: plan.service,
    base: plan.base,
    seats: plan.seats,
    pull: plan.pull,
    served: plan.total,
    turnedAway: plan.turnedAwayTotal,
  };
}

/** The newest star report, or null. */
export function lastServiceResult(save: SaveData): ServiceResult | null {
  return serviceResultsOf(save).at(-1) ?? null;
}

/** The pull's parts as short chips: only the ones that pull. */
export function pullChips(p: NextServiceGuests["pull"]): string[] {
  return [
    p.reputation > 0 ? `⭐ Reputation +${p.reputation}` : null,
    p.menu > 0 ? "📖 Menu +1" : null,
    p.hour > 0 ? "🔔 Rush +1" : null,
    p.spotless > 0 ? "✨ Spotless +1" : null,
  ].filter((x): x is string => !!x);
}
