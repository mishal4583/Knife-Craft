/**
 * THE BURGER FESTIVAL: its kitchen and its customers' orders. The menu grows with the pace, so a harder round also has more on the counter. Event 1's
 * five customers are scripted to teach one new thing at a time; every other round is drawn from the seed.
 */
import { makeSeededRand } from "../business/businessDeterministicRandom";
import type {
  CookerDef,
  FoodId,
  KitchenConfig,
  OrderItem,
  OrderSpec,
  Pace,
  RoundConfig,
  TrayDef,
} from "./types";

/** Cooking times at the first event, in milliseconds (every one is multiplied by the pace's cookSpeed). */
export const BURGER_COOK_MS: Partial<Record<FoodId, number>> = {
  patty: 3600,
  chicken: 4200,
  fries: 3800,
  cola: 1400,
  milkshake: 2000,
};

/** The tier each part of the menu joins at. */
export const BURGER_JOINS: Partial<Record<FoodId, number>> = {
  patty: 1,
  cheese: 1,
  lettuce: 1,
  cola: 1,
  fries: 1,
  tomato: 2,
  onion: 4,
  chicken: 5,
  milkshake: 6,
  pickles: 8,
};
export const MAX_TOPPINGS = 3;
/** From this tier a burger may carry two patties. */
export const DOUBLE_FROM_TIER = 7;

export const BURGER_POINTS: Partial<Record<FoodId, number>> = {
  bun: 40,
  patty: 60,
  chicken: 70,
  cheese: 15,
  lettuce: 10,
  tomato: 10,
  onion: 10,
  pickles: 10,
  fries: 40,
  cola: 30,
  milkshake: 40,
};

const TOPPINGS: readonly FoodId[] = ["cheese", "lettuce", "tomato", "onion", "pickles"];
/** The order the parts are listed and stacked in, bottom to top. */
export const STACK_ORDER: readonly FoodId[] = [
  "bun",
  "patty",
  "chicken",
  "cheese",
  "pickles",
  "onion",
  "tomato",
  "lettuce",
];

export const sortParts = (parts: readonly FoodId[]): FoodId[] =>
  [...parts].sort((a, b) => STACK_ORDER.indexOf(a) - STACK_ORDER.indexOf(b));

const on = (item: FoodId, tier: number) => (BURGER_JOINS[item] ?? 99) <= tier;

export function burgerKitchen(pace: Pace): KitchenConfig {
  const speed = (item: FoodId) => Math.round((BURGER_COOK_MS[item] ?? 0) * pace.cookSpeed);
  const times = (items: FoodId[]) =>
    Object.fromEntries(items.filter((i) => on(i, pace.tier)).map((i) => [i, speed(i)]));
  const cookers: CookerDef[] = [
    {
      id: "drink",
      cookMs: times(["cola", "milkshake"]),
      slots: 2,
      readyMs: Infinity,
      overMs: Infinity,
      serves: true,
    },
    {
      id: "fryer",
      cookMs: times(["fries"]),
      slots: 2,
      readyMs: pace.readyMs,
      overMs: pace.overMs,
      serves: true,
    },
    {
      id: "grill",
      cookMs: times(["patty", "chicken"]),
      slots: pace.grillSlots,
      readyMs: pace.readyMs,
      overMs: pace.overMs,
      serves: false,
    },
  ];
  const trays: TrayDef[] = [
    { item: "bun", to: "plate" },
    { item: "patty", to: "grill" },
    ...(on("chicken", pace.tier) ? [{ item: "chicken", to: "grill" } as TrayDef] : []),
    ...TOPPINGS.filter((t) => on(t, pace.tier)).map((t) => ({ item: t, to: "plate" }) as TrayDef),
    { item: "fries", to: "fryer" },
  ];
  const limits: KitchenConfig["limits"] = {
    patty: pace.tier >= DOUBLE_FROM_TIER ? 2 : 1,
    chicken: 1,
    ...Object.fromEntries(TOPPINGS.map((t) => [t, 1])),
  };
  return { cookers, plates: pace.plates, trays, base: "bun", limits, points: BURGER_POINTS };
}

const dish = (...parts: FoodId[]): OrderItem => ({
  kind: "dish",
  parts: sortParts(["bun", ...parts]),
});
const side = (item: FoodId): OrderItem => ({ kind: "side", item });

/** Event 1's customers: one new thing at a time. */
export const FIRST_ORDERS: readonly OrderSpec[] = [
  { items: [dish("patty")] },
  { items: [dish("patty", "cheese")] },
  { items: [dish("patty"), side("cola")] },
  { items: [dish("patty", "lettuce"), side("fries")] },
  { items: [dish("patty", "cheese", "lettuce"), side("fries"), side("cola")] },
];

export function burgerOrders(pace: Pace, seed: number): OrderSpec[] {
  if (pace.tier === 1) return [...FIRST_ORDERS];
  const rand = makeSeededRand(seed ^ 0x62757267);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
  const toppings = TOPPINGS.filter((t) => on(t, pace.tier));
  const drinks = (["cola", "milkshake"] as const).filter((d) => on(d, pace.tier));
  // at most three toppings: later events get harder through more customers and shorter times, not through endless tapping
  const mostToppings = Math.min(toppings.length, MAX_TOPPINGS, 1 + Math.floor((pace.tier - 1) / 4));
  return Array.from({ length: pace.orders }, (_, i) => {
    // the round warms up: the first customers want less than the last ones
    const along = pace.orders > 1 ? i / (pace.orders - 1) : 1;
    const chicken = on("chicken", pace.tier) && rand() < 0.3;
    const parts: FoodId[] = [chicken ? "chicken" : "patty"];
    if (!chicken && pace.tier >= DOUBLE_FROM_TIER && rand() < 0.15 + 0.15 * along)
      parts.push("patty");
    const wanted = Math.min(
      mostToppings,
      Math.floor(rand() * (1 + mostToppings * (0.6 + along * 0.4))),
    );
    const left = [...toppings];
    for (let k = 0; k < wanted && left.length; k++)
      parts.push(left.splice(Math.floor(rand() * left.length), 1)[0]!);
    const items: OrderItem[] = [dish(...parts)];
    const sideChance = Math.min(0.75, 0.2 + pace.tier * 0.025 + along * 0.2);
    if (i > 0 && rand() < sideChance) items.push(side(rand() < 0.55 ? "fries" : pick(drinks)));
    if (i > 1 && items.length === 2 && rand() < sideChance * 0.6) {
      const first = items[1] as { kind: "side"; item: FoodId };
      items.push(side(first.item === "fries" ? pick(drinks) : "fries"));
    }
    return { items };
  });
}

/** A Burger Festival round at a pace; the same pace and seed give the same round. */
export function burgerRound(pace: Pace, seed: number): RoundConfig {
  return { kitchen: burgerKitchen(pace), orders: burgerOrders(pace, seed), pace };
}
