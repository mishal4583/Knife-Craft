/**
 * ONE KITCHEN SHAPE FOR EVERY FESTIVAL: the counter and the customers of any menu (menus.ts) at a pace. The roles decide when a food joins and what it
 * is worth, the same in every festival, so a stage is as hard in one festival as in another of the same pace. Customers are drawn from the seed; the
 * Burger Festival's draws are the ones it has always had (proved by festival-rules-qa), and a new festival's are its own.
 */
import { makeSeededRand } from "../business/businessDeterministicRandom";
import { BURGER_MENU, FESTIVAL_MENUS, type Dish, type FestivalMenu } from "./menus";
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

/** The fifteen places of a counter, in the order the pans stand. */
export const ROLES = [
  "base",
  "main1",
  "main2",
  "main3",
  "top1",
  "top2",
  "top3",
  "top4",
  "top5",
  "sauce1",
  "sauce2",
  "side",
  "drink1",
  "drink2",
  "drink3",
] as const;
export type Role = (typeof ROLES)[number];

/** The tier each place joins the menu at. */
export const JOINS: Readonly<Record<Role, number>> = {
  base: 1,
  main1: 1,
  main2: 5,
  main3: 9,
  top1: 1,
  top2: 1,
  top3: 2,
  top4: 4,
  top5: 8,
  sauce1: 3,
  sauce2: 10,
  side: 1,
  drink1: 1,
  drink2: 4,
  drink3: 6,
};

export const POINTS: Readonly<Record<Role, number>> = {
  base: 40,
  main1: 60,
  main2: 70,
  main3: 60,
  top1: 15,
  top2: 10,
  top3: 10,
  top4: 10,
  top5: 10,
  sauce1: 5,
  sauce2: 5,
  side: 40,
  drink1: 30,
  drink2: 30,
  drink3: 40,
};

export const MAX_TOPPINGS = 3;
/** From this tier a plate of a `double` menu may carry two of its first main. */
export const DOUBLE_FROM_TIER = 7;
/** How often a required group gives its second or third choice instead of its first. */
const OTHER_CHOICE = 0.35;

export const dishesOf = (m: FestivalMenu): Readonly<Record<Role, Dish>> => ({
  base: m.base,
  main1: m.mains[0],
  main2: m.mains[1],
  main3: m.mains[2],
  top1: m.toppings[0],
  top2: m.toppings[1],
  top3: m.toppings[2],
  top4: m.toppings[3],
  top5: m.toppings[4],
  sauce1: m.sauces[0],
  sauce2: m.sauces[1],
  side: m.side,
  drink1: m.drinks[0],
  drink2: m.drinks[1],
  drink3: m.drinks[2],
});

export const roleOf = (m: FestivalMenu, food: FoodId): Role | undefined => {
  const dishes = dishesOf(m);
  return ROLES.find((r) => dishes[r].id === food);
};

/** A food's place on the counter, named after the Burger Festival's food in the same role (the layouts are drawn for those). */
export const placeOf = (m: FestivalMenu, food: FoodId): FoodId => {
  const role = roleOf(m, food);
  return role ? dishesOf(BURGER_MENU)[role].id : food;
};

/** The menu's own food for a place (the other way round from placeOf). */
export const foodAt = (m: FestivalMenu, place: FoodId): FoodId => {
  const role = roleOf(BURGER_MENU, place);
  return role ? dishesOf(m)[role].id : place;
};

/** One order of every menu's parts, the Burger's first: two lists of the same parts always sort alike. */
const EVERY_STACK: readonly FoodId[] = [
  ...new Set(FESTIVAL_MENUS.flatMap((m) => [m.base.id, ...m.layers])),
];
const rankIn = (order: readonly FoodId[]) => (a: FoodId, b: FoodId) =>
  order.indexOf(a) - order.indexOf(b) || a.localeCompare(b);

/** The parts bottom to top: as the menu draws them, or (with no menu) in the one order used to compare two plates. */
export const sortParts = (parts: readonly FoodId[], m?: FestivalMenu): FoodId[] =>
  [...parts].sort(rankIn(m ? [m.base.id, ...m.layers] : EVERY_STACK));

const isOn = (role: Role, tier: number) => JOINS[role] <= tier;

export function menuKitchen(m: FestivalMenu, pace: Pace): KitchenConfig {
  const dishes = dishesOf(m);
  const on = (role: Role) => isOn(role, pace.tier);
  const speed = (ms: number) => Math.round(ms * pace.cookSpeed);
  const times = (roles: readonly Role[]) =>
    Object.fromEntries(roles.filter(on).map((r) => [dishes[r].id, speed(dishes[r].ms ?? 0)]));
  const idsOf = (roles: readonly Role[]) => roles.filter(on).map((r) => dishes[r].id);
  const drinkRoles = ["drink1", "drink2", "drink3"] as const;
  const mainRoles = ["main1", "main2", "main3"] as const;
  const topRoles = ["top1", "top2", "top3", "top4", "top5", "sauce1", "sauce2"] as const;
  const drinks = idsOf(drinkRoles);
  const cookers: CookerDef[] = [
    {
      id: "drink",
      cookMs: times(drinkRoles),
      slots: drinks.length,
      perSlot: drinks,
      readyMs: Infinity,
      overMs: Infinity,
      serves: true,
    },
    {
      id: "fryer",
      cookMs: times(["side"]),
      slots: 2,
      readyMs: pace.readyMs,
      overMs: pace.overMs,
      serves: true,
    },
    {
      id: "grill",
      // (a pizza oven bakes the whole dish, which is named by its base)
      cookMs: m.bake ? { [m.base.id]: speed(m.bake) } : times(mainRoles),
      slots: pace.grillSlots,
      readyMs: pace.readyMs,
      overMs: pace.overMs,
      serves: false,
      ...(m.bake ? { bake: true } : {}),
    },
  ];
  const trays: TrayDef[] = [
    { item: m.base.id, to: "plate" },
    ...idsOf(mainRoles).map((item): TrayDef => ({ item, to: m.bake ? "plate" : "grill" })),
    ...idsOf(topRoles).map((item): TrayDef => ({ item, to: "plate" })),
    { item: m.side.id, to: "fryer" },
  ];
  const double = m.double && pace.tier >= DOUBLE_FROM_TIER;
  const limits: KitchenConfig["limits"] = {
    ...Object.fromEntries(mainRoles.map((r, i) => [dishes[r].id, i === 0 && double ? 2 : 1])),
    ...Object.fromEntries(topRoles.map((r) => [dishes[r].id, 1])),
  };
  return {
    cookers,
    plates: pace.plates,
    trays,
    base: m.base.id,
    limits,
    points: Object.fromEntries(ROLES.map((r) => [dishes[r].id, POINTS[r]])),
    words: { dish: m.dish, base: m.base.name, aBase: m.aBase, hot: m.hot, fry: m.fry },
  };
}

const plated = (m: FestivalMenu, ...parts: FoodId[]): OrderItem => ({
  kind: "dish",
  parts: sortParts([m.base.id, ...parts], m),
});
const side = (item: FoodId): OrderItem => ({ kind: "side", item });

/** A first-ever round's five scripted customers: one new thing at a time. */
export const firstOrders = (m: FestivalMenu): OrderSpec[] => {
  const main = m.mains[0].id;
  const [first, second] = [m.toppings[0].id, m.toppings[1].id];
  const drink = m.drinks[0].id;
  return [
    { items: [plated(m, main)] },
    { items: [plated(m, main, first)] },
    { items: [plated(m, main), side(drink)] },
    { items: [plated(m, main, second), side(m.side.id)] },
    { items: [plated(m, main, first, second), side(m.side.id), side(drink)] },
  ];
};

/** Each festival's draws are its own; the Burger Festival's stay the ones it was built with. */
const seedOf = (m: FestivalMenu) =>
  m.id === "burger"
    ? 0x62757267
    : [...m.id].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) | 0, 0x66657374);

export function menuOrders(m: FestivalMenu, pace: Pace, seed: number): OrderSpec[] {
  if (pace.tier === 1) return firstOrders(m);
  const rand = makeSeededRand(seed ^ seedOf(m));
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
  const dishes = dishesOf(m);
  const on = (role: Role) => isOn(role, pace.tier);
  const idsOf = (roles: readonly Role[]) => roles.filter(on).map((r) => dishes[r].id);
  const always = (m.always ?? []).map((group) => group.filter((food) => on(roleOf(m, food)!)));
  const required = new Set((m.always ?? []).flat());
  const toppings = idsOf(["top1", "top2", "top3", "top4", "top5", "sauce1", "sauce2"]).filter(
    (t) => !required.has(t),
  );
  const drinks = idsOf(["drink1", "drink2", "drink3"]);
  // at most three toppings of choice (fewer where some are always on): later events get harder through more customers and shorter times, not
  // through endless tapping
  const mostToppings = Math.min(
    toppings.length,
    MAX_TOPPINGS - (m.always?.length ?? 0),
    1 + Math.floor((pace.tier - 1) / 4),
  );
  return Array.from({ length: pace.orders }, (_, i) => {
    // the round warms up: the first customers want less than the last ones
    const along = pace.orders > 1 ? i / (pace.orders - 1) : 1;
    const second = on("main2") && rand() < 0.3;
    const third = !second && on("main3") && rand() < 0.2;
    const parts: FoodId[] = [second ? dishes.main2.id : third ? dishes.main3.id : dishes.main1.id];
    if (
      m.double &&
      !second &&
      !third &&
      pace.tier >= DOUBLE_FROM_TIER &&
      rand() < 0.15 + 0.15 * along
    )
      parts.push(dishes.main1.id);
    for (const group of always) {
      if (!group.length) continue;
      parts.push(group.length > 1 && rand() < OTHER_CHOICE ? pick(group.slice(1)) : group[0]!);
    }
    const wanted = Math.min(
      mostToppings,
      Math.floor(rand() * (1 + mostToppings * (0.6 + along * 0.4))),
    );
    const left = [...toppings];
    for (let k = 0; k < wanted && left.length; k++)
      parts.push(left.splice(Math.floor(rand() * left.length), 1)[0]!);
    const items: OrderItem[] = [plated(m, ...parts)];
    const sideChance = Math.min(0.75, 0.2 + pace.tier * 0.025 + along * 0.2);
    if (i > 0 && rand() < sideChance) items.push(side(rand() < 0.55 ? m.side.id : pick(drinks)));
    if (i > 1 && items.length === 2 && rand() < sideChance * 0.6) {
      const first = items[1] as { kind: "side"; item: FoodId };
      items.push(side(first.item === m.side.id ? pick(drinks) : m.side.id));
    }
    return { items };
  });
}

/** A festival's round at a pace; the same menu, pace and seed give the same round. */
export function menuRound(m: FestivalMenu, pace: Pace, seed: number): RoundConfig {
  return { kitchen: menuKitchen(m, pace), orders: menuOrders(m, pace, seed), pace };
}
