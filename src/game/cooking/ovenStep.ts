/**
 * OVEN STEP — Transformation Phase C (developer 2026-10-25): the first
 * interactive cooking step, prototyped on one oven recipe (Phase D: six bread
 * dishes). After the cut, instead of the passive cooking film, the tray goes
 * into the oven, the bread browns, and the player takes it out.
 *
 * PRESENTATION ONLY (by decision — no approval to change the economy or the
 * grade): the doneness the player lands on picks a line ("Golden and crisp!")
 * and nothing else. The dish's score, grade, pay, tip and stock are the ones
 * the cut already produced; this module never reads or writes them. There is
 * no failure: left alone, the tray comes out by itself at "extra toasty".
 *
 * Pure: time in, doneness out. The view (OvenStep.tsx) drives the clock.
 */

/**
 * The recipes that use the oven step (every order of them: campaign, menu guest, Business).
 * Phase D (developer 2026-10-25): the five bread dishes that bake as slices on the tray.
 * Phase E (developer 2026-10-25): the four baguette dishes, on a baguette tray
 * (`trayItemFor`). The gratin and the cold Peach & Cheddar Board never use it
 * (dishService still tags the board "oven" through its baguette).
 */
export const OVEN_STEP_RECIPES: readonly string[] = [
  "camp-garlic-bread", // L5
  "camp-tomato-basil-toast", // L6
  "camp-mushroom-bruschetta", // L7
  "camp-bruschetta-for-the-house", // L12
  "camp-family-antipasto-for-two", // L15
  "camp-bruschetta-trio", // L17
  // Phase E: baguette dishes (🥖 on the tray).
  "camp-avocado-baguette-toast", // L47
  "camp-baguette-rounds",
  "camp-baguette-cheddar-rounds",
  "camp-baguette-crostini-prep",
];

/** The oven recipes baked as a baguette (Phase E); every other oven recipe bakes bread slices. */
export const BAGUETTE_TRAY_RECIPES: readonly string[] = [
  "camp-avocado-baguette-toast",
  "camp-baguette-rounds",
  "camp-baguette-cheddar-rounds",
  "camp-baguette-crostini-prep",
];

export type TrayItem = "🥖" | "🍞";

/** What sits on the oven tray for `recipeId`: a baguette for the baguette dishes, bread otherwise. */
export const trayItemFor = (recipeId: string): TrayItem =>
  BAGUETTE_TRAY_RECIPES.includes(recipeId) ? "🥖" : "🍞";

export const ovenStepFor = (recipeId: string): boolean => OVEN_STEP_RECIPES.includes(recipeId);

export const OVEN = {
  /** The tray sliding in. */
  PLACE_MS: 600,
  /** From raw to the end of the bake (doneness 0 → 1). */
  BAKE_MS: 5200,
  /** The golden window, in doneness. */
  GOLDEN_FROM: 0.55,
  GOLDEN_TO: 0.8,
  /** How long the result line stays before the Knife Report. */
  RESULT_MS: 1100,
} as const;

export type Doneness = "pale" | "golden" | "toasty";

/** Doneness 0–1 after `ms` of baking (clamped). */
export function donenessAt(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(1, ms / OVEN.BAKE_MS);
}

export function donenessLabel(d: number): Doneness {
  if (d < OVEN.GOLDEN_FROM) return "pale";
  if (d <= OVEN.GOLDEN_TO) return "golden";
  return "toasty";
}

/** The line shown when the tray comes out — words only, no score. */
export const DONENESS_LINE: Readonly<Record<Doneness, string>> = {
  pale: "A touch pale — still tasty.",
  golden: "Golden and crisp!",
  toasty: "Extra toasty!",
};

/** The bread's colour on the tray: a brightness/sepia filter from raw to dark. */
export function breadFilter(d: number): string {
  const x = Math.max(0, Math.min(1, d));
  return `sepia(${(0.15 + x * 0.75).toFixed(2)}) saturate(${(1 + x * 0.8).toFixed(2)}) brightness(${(1.15 - x * 0.5).toFixed(2)})`;
}
