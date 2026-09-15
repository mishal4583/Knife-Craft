/**
 * CHEF_TYPES — cuisine progression beats (brief §26). A chef is NOT a
 * stat modifier: no speed/payment/happiness bonus is ever attached to
 * one (§26 explicitly forbids it). Unlocking a chef only:
 *   - opens that cuisine's recipe pool to the order generator,
 *   - shows a short introduction (dialogue + portrait), and
 *   - adds cookbook/story flavor.
 * Chefs fire on their own cuisine-arc cadence, independent of THE LAST
 * WISH's milestone clock (§27/§28 — the two must never collide/stack).
 */
import type { CuisineId } from "../cuisines/cuisineTypes";

export type ChefDefinition = {
  id: CuisineId;
  name: string;
  title: string;
  cuisineId: CuisineId;
  /** Campaign level number at which this chef introduces themself (§26). */
  unlockLevel: number;
  portraitEmoji: string;
  introLine: string;
};
