/**
 * CUSTOMER_TYPES — presentation-layer identities (brief §55: "names,
 * visual identity, dialogue, order preferences... NOT complicated
 * personality stats... no hidden satisfaction mathematics").
 *
 * A CustomerOrder carries a `basePayment` snapshot taken from the
 * recipe at generation time rather than looking the recipe up again at
 * payment time — so a later recipe-balance edit can never retroactively
 * change what an order already on the board is worth (§7 "payment
 * should be deterministic").
 */
import type { OrderStatus } from "../service/orderStateTypes";

export type CustomerDefinition = {
  id: string;
  name: string;
  avatarEmoji: string;
  /** Shown when this customer's order first appears on the board (§40). */
  greeting: string;
};

/**
 * Warm, non-numeric reactions (§6) — pooled and picked per completed
 * order, not tied to a specific customer or dish. Never a score, never
 * a rating: just one of these lines.
 */
export const CUSTOMER_REACTIONS: readonly string[] = [
  "Thank you!",
  "That looks wonderful.",
  "Perfect!",
  "This is exactly what I ordered.",
  "I'll definitely come back.",
  "Wonderful!",
  "That smells amazing.",
  "Just what I wanted.",
];

export type CustomerOrder = {
  id: string;
  customerId: string;
  recipeId: string;
  status: OrderStatus;
  /** Flat, deterministic payment for THIS order, copied from the recipe at generation time (§7). */
  basePayment: number;
  /** Short, actionable line for the chef-instruction HUD (§41), copied from the recipe at generation time. */
  chefInstruction: string;
  createdAt: number;
};
