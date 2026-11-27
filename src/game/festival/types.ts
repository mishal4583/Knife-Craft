/**
 * THE FESTIVAL FAST FOOD COMPETITION (developer 2026-11-27; plan and decisions: docs/planning/FESTIVAL-COMPETITION-PHASE0-2026-11-27.md).
 * The shapes the rules work on. Everything under game/festival is pure: no React, no wallet, no clock, no Math.random (a seed decides a round), so a
 * round can be replayed exactly and proved winnable by a simulated player (bot.ts). The festival uses no Business Inventory and moves no money.
 */

export type FoodId =
  | "bun"
  | "patty"
  | "chicken"
  | "veggie"
  | "cheese"
  | "lettuce"
  | "tomato"
  | "onion"
  | "pickles"
  | "ketchup"
  | "mustard"
  | "fries"
  | "cola"
  | "lemonade"
  | "milkshake";

export type CookerId = "grill" | "fryer" | "drink";

export type CookerDef = {
  id: CookerId;
  /** What it makes, and how long each thing takes. */
  cookMs: Partial<Record<FoodId, number>>;
  slots: number;
  /** A machine for one thing each (the drink taps and the shake blender): spot i only ever makes perSlot[i]. */
  perSlot?: readonly FoodId[];
  /** After cooking: how long the food is at its best, then how long it is overcooked before it is burnt. `Infinity`: it never spoils (a poured drink). */
  readyMs: number;
  overMs: number;
  /** true: what it makes is served by itself (a side or a drink). false: it goes onto a plate (a patty). */
  serves: boolean;
};

/** Something the player taps to start with: it goes to a plate, or raw into a cooker. */
export type TrayDef = { item: FoodId; to: "plate" | CookerId };

export type KitchenConfig = {
  cookers: readonly CookerDef[];
  plates: number;
  trays: readonly TrayDef[];
  /** Every plate starts with this (the bun). */
  base: FoodId;
  /** How many of each thing one plate takes (besides the base, which it takes once). */
  limits: Partial<Record<FoodId, number>>;
  points: Partial<Record<FoodId, number>>;
};

/** One thing a customer wants: an assembled plate with exactly these parts (sorted), or a side / drink. */
export type OrderItem = { kind: "dish"; parts: readonly FoodId[] } | { kind: "side"; item: FoodId };
export type OrderSpec = { items: readonly OrderItem[] };

/** How hard a round is: the events' ramp (tiers.ts). */
export type Pace = {
  tier: number;
  /** Customers in the round, and how many wait at once. */
  orders: number;
  atOnce: number;
  patienceMs: number;
  /** The gap before the next customer walks up while someone is already waiting (an empty counter fills at once). */
  arriveMs: number;
  /** Multiplies every cooking time. */
  cookSpeed: number;
  readyMs: number;
  overMs: number;
  grillSlots: number;
  plates: number;
  /** The rival's final score, as a share of a fast simulated player's. */
  rivalShare: number;
  /** Visible stumbles in the rival's round. */
  rivalSlips: number;
  /** The accuracy the second and third stars ask for (0-1). */
  accuracyGoal: number;
};

export type RoundConfig = {
  kitchen: KitchenConfig;
  orders: readonly OrderSpec[];
  pace: Pace;
};

export type Quality = "good" | "over";
export type Slot = { item: FoodId; t: number } | null;
export type SlotPhase = "cooking" | "ready" | "over" | "burnt";
export type PlatePart = { item: FoodId; quality: Quality };
export type Plate = readonly PlatePart[];

export type Wanted = {
  item: OrderItem;
  done: boolean;
  /** How well it was made, once delivered. */
  quality?: Quality;
};

export type Customer = {
  /** Its place in the round (0-based): also which face it wears. */
  id: number;
  seat: number;
  wants: readonly Wanted[];
  patience: number;
  max: number;
};

export type PowerId = "patience" | "instant" | "freeze";

export type RoundState = {
  /** Milliseconds of play (paused time is never added). */
  now: number;
  /** The next order to walk up, and when it may. */
  next: number;
  nextAt: number;
  customers: readonly Customer[];
  cookers: Partial<Record<CookerId, readonly Slot[]>>;
  plates: readonly Plate[];
  selected: number;
  score: number;
  /** Orders served in a row. */
  combo: number;
  bestCombo: number;
  served: number;
  lost: number;
  /** Cooked things that ended (delivered, burnt or binned), and how many of them were delivered at their best. */
  cooked: number;
  perfect: number;
  /** Things burnt or thrown away. */
  wasted: number;
  powers: Readonly<Record<PowerId, number>>;
  frozenMs: number;
  done: boolean;
};

export type Action =
  | { kind: "tray"; item: FoodId }
  | { kind: "cooker"; cooker: CookerId; slot: number }
  | { kind: "plate"; plate: number }
  | { kind: "bin" }
  | { kind: "power"; power: PowerId };

export type GameEvent =
  | { type: "arrive"; seat: number; id: number }
  | { type: "cooking"; cooker: CookerId; slot: number }
  | { type: "ready"; cooker: CookerId; slot: number }
  | { type: "burnt"; cooker: CookerId; slot: number }
  | { type: "placed"; plate: number; item: FoodId }
  | { type: "delivered"; seat: number }
  | { type: "served"; seat: number; id: number; points: number; combo: number }
  | { type: "left"; seat: number; id: number }
  | { type: "binned" }
  | { type: "power"; power: PowerId }
  /** A tap that did nothing, and why, in a few words. */
  | { type: "hint"; text: string };

export type Step = { state: RoundState; events: readonly GameEvent[] };
