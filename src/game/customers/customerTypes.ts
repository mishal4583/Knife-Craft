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
  /** Flat, deterministic payment for THIS order, copied from the recipe at generation time (§7). Still used for Preparation's pre-serve payout preview (Preparation.tsx's `view.rewardCoins`) — the ACTUAL amount credited at serve time may differ once Economy V2 settlement is wired in (see ServiceManager.ts's serve functions and App.tsx's serveCampaignOrder/serveBatchGroupViewedOrder), same as any other settlement breakdown field never re-deriving the preview. */
  basePayment: number;
  /**
   * Economy V2 payout wiring — the 0-100 preparation score for THIS
   * order, stamped once its components are recorded (recordAllComponents/
   * recordBatchGroupComponents, called from App.tsx's recordCampaignServiceResult/
   * recordBatchGroupResult/recordServiceResult) and read back at serve
   * time (serveCurrentOrder/serveBatchGroupOrder) to compute the real
   * settlement (EconomySettlement.computeSettlement). `null` until then —
   * an order is never served before its components are recorded, so a
   * genuinely PAID order's score is never null in practice.
   */
  preparationScore: number | null;
  /** Short, actionable line for the chef-instruction HUD (§41), copied from the recipe at generation time. */
  chefInstruction: string;
  createdAt: number;
};
