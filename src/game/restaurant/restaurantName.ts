/**
 * RESTAURANT NAME (developer 2026-10-17: "ask the user to give the
 * restaurant name before the first level … and make it changeable at the
 * settings"). The player's own name for the restaurant, in
 * `SaveData.settings.restaurantName` (optional, like `measure`; no new
 * top-level field). Absent = never asked: the naming card shows once, after
 * the intro and before Level 1 (or on the next launch for an existing save).
 * Settings changes it at any time. Display only — no money, ledger or
 * progress reads it. Pure.
 */
import type { SaveData } from "../SaveManager";

export const DEFAULT_RESTAURANT_NAME = "Your Restaurant";
export const RESTAURANT_NAME_MAX = 24;
/** The map's old nameboard kept a name in plain localStorage (before it was saved). */
export const LEGACY_RESTAURANT_NAME_KEY = "knifecraft.restaurantName";

/** A name as the game stores it: single spaces, trimmed, at most RESTAURANT_NAME_MAX characters. */
export function cleanRestaurantName(raw: string): string {
  return [...raw.replace(/\s+/g, " ").trim()].slice(0, RESTAURANT_NAME_MAX).join("").trim();
}

/** The name to show: the player's, or the default before one is chosen. */
export function restaurantNameOf(save: Pick<SaveData, "settings">): string {
  const name = cleanRestaurantName(save.settings.restaurantName ?? "");
  return name || DEFAULT_RESTAURANT_NAME;
}

/** True until the player has named the restaurant (or kept the default) once. */
export function needsRestaurantName(save: Pick<SaveData, "settings">): boolean {
  return save.settings.restaurantName === undefined;
}

/** The save with the restaurant named `raw` (an empty name keeps the default). Only settings change. */
export function withRestaurantName(save: SaveData, raw: string): SaveData {
  const name = cleanRestaurantName(raw) || DEFAULT_RESTAURANT_NAME;
  if (save.settings.restaurantName === name) return save;
  return { ...save, settings: { ...save.settings, restaurantName: name } };
}
