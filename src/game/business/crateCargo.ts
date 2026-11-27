import type { CrateIngredient } from "./crateDispatch";

/**
 * Unload the Van's CARGO (developer 2026-11-27: "instead of repeated ingredients add our 50+ ingredients ... culinary and cutlery items, parcel items", aligned with what the restaurant orders;
 * plan docs/planning/UNLOAD-THE-VAN-CARGO-PLAN-2026-11-27.md). 140 items whose pictures the game already has, in 11 door colours. A board's SHAPE (grid, crates, doors, trapped crates) is built
 * from the level and the seed alone (crateDispatch.ts); this module only chooses WHICH item each door's colour carries, so orders can never make a level easier or harder.
 * Pure: no save, no money, no random (the restaurant's wishes come in from restaurant/vanWishes.ts).
 */

export const CARGO_FAMILIES = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "brown",
  "cream",
  "pink",
  "cardboard",
] as const;
export type CargoFamily = (typeof CARGO_FAMILIES)[number];

/** The colour of a family's doors and crates. */
export const FAMILY_COLORS: Record<CargoFamily, string> = {
  red: "#E5483E",
  orange: "#F59A28",
  yellow: "#F2C230",
  green: "#5BB84A",
  teal: "#2FB5A0",
  blue: "#3F8EE8",
  purple: "#9A5BD0",
  brown: "#8E5E38",
  cream: "#F6F1E4",
  pink: "#EC7BA6",
  cardboard: "#B98046",
};
/** Two families that never share a board: they could be taken for each other. */
const NEVER_TOGETHER: ReadonlyArray<readonly [CargoFamily, CargoFamily]> = [["brown", "cardboard"]];

/** Where a picture is: the ingredient pictures, the Sauce Station's pantry products, or the supplies. */
export type CargoSource = "ingredient" | "pantry" | "supply";
export type CargoItem = { id: string; name: string; family: CargoFamily; source: CargoSource };

/** `"id=Name, id=Name"` into items of one family and source. */
const items = (family: CargoFamily, source: CargoSource, list: string): CargoItem[] =>
  list.split(",").map((entry) => {
    const [id, name] = entry.split("=").map((s) => s.trim()) as [string, string];
    return { id, name, family, source };
  });

export const CARGO_ITEMS: readonly CargoItem[] = [
  ...items(
    "red",
    "ingredient",
    "apple=Apples, tomato=Tomatoes, strawberry=Strawberries, pepper=Bell peppers, pomegranate=Pomegranates, watermelon=Watermelon, radish=Radishes",
  ),
  ...items(
    "red",
    "pantry",
    "chilli-sauce=Chilli sauce, passata=Passata, paprika=Paprika, chilli-flakes=Chilli flakes",
  ),
  ...items(
    "orange",
    "ingredient",
    "carrot=Carrots, orange=Oranges, mango=Mangoes, pumpkin=Pumpkins, sweetpotato=Sweet potatoes, peach=Peaches",
  ),
  ...items("orange", "pantry", "turmeric=Turmeric, curry-powder=Curry powder"),
  ...items(
    "yellow",
    "ingredient",
    "lemon=Lemons, cheddar=Cheddar, corn=Sweetcorn, pineapple=Pineapples, butter=Butter",
  ),
  ...items("yellow", "pantry", "mustard=Mustard, honey=Honey, veg-oil=Vegetable oil"),
  ...items(
    "green",
    "ingredient",
    "lettuce=Lettuce, cabbage=Cabbages, broccoli=Broccoli, spinach=Spinach, basil=Basil, parsley=Parsley, cilantro=Cilantro, cucumber=Cucumbers, zucchini=Zucchini, avocado=Avocados, asparagus=Asparagus, artichoke=Artichokes, celery=Celery, greenbean=Green beans, peapod=Pea pods, springonion=Spring onions, chilli=Green chillies, kiwi=Kiwis, lime=Limes, pear=Pears",
  ),
  ...items("green", "pantry", "olive-oil=Olive oil"),
  ...items(
    "teal",
    "supply",
    "stock-pot=Stock pots, saucepans=Saucepans, frying-pans=Frying pans, saute-pans=Sauté pans, sheet-pans=Sheet pans, mixing-bowls=Mixing bowls, measuring-cups=Measuring cups, kitchen-scales=Kitchen scales, thermometers=Thermometers, oven-mitts=Oven mitts, tongs=Tongs, spatulas=Spatulas, ladles=Ladles, whisks=Whisks, peelers=Peelers, graters=Graters, skimmers=Skimmers, dinner-forks=Dinner forks, dinner-knives=Dinner knives, steak-knives=Steak knives, soup-spoons=Soup spoons, dinner-plates=Dinner plates, soup-bowls=Soup bowls, water-glasses=Water glasses, highball-glasses=Tall glasses, coffee-tea-set=Coffee cups, water-jugs=Water jugs, salt-pepper=Salt and pepper, napkin-holders=Napkin holders, menu-stands=Menu stands",
  ),
  ...items(
    "blue",
    "supply",
    "dish-soap=Dish soap, cleaning-liquid=Cleaning liquid, floor-cleaner=Floor cleaner, disinfectant=Disinfectant, hand-soap=Hand soap, sponges-cloths=Cleaning cloths, mop-bucket=Mop buckets, brooms=Brooms, toilet-brushes=Toilet brushes, toilet-paper=Toilet paper, paper-towels=Paper towels, bin-liners=Bin liners",
  ),
  ...items(
    "purple",
    "ingredient",
    "eggplant=Eggplants, grapes=Grapes, beetroot=Beetroot, turnip=Turnips",
  ),
  ...items("purple", "pantry", "wine-vinegar=Wine vinegar"),
  ...items(
    "brown",
    "ingredient",
    "potato=Potatoes, onion=Onions, mushroom=Mushrooms, ginger=Ginger, coconut=Coconuts, bread=Bread, baguette=Baguettes",
  ),
  ...items(
    "brown",
    "pantry",
    "cumin=Cumin, peanut-butter=Peanut butter, soy=Soy sauce, sesame-oil=Sesame oil, stock=Stock, stock-cube=Stock cubes",
  ),
  ...items(
    "cream",
    "ingredient",
    "garlic=Garlic, cauliflower=Cauliflowers, fennel=Fennel, mozzarella=Mozzarella, tofu=Tofu",
  ),
  ...items(
    "cream",
    "pantry",
    "milk=Milk, yogurt=Yogurt, cream=Cream, coconut-milk=Coconut milk, mayo=Mayonnaise, tahini=Tahini, sugar=Sugar, salt=Salt, white-vinegar=White vinegar",
  ),
  ...items("pink", "ingredient", "chicken=Chicken, steak=Steak, salmon=Salmon"),
  ...items(
    "cardboard",
    "supply",
    "kraft-boxes=Take-out boxes, burger-boxes=Burger boxes, paper-bags=Paper bags, carry-bags=Carry bags, foil-containers=Foil containers, microwave-containers=Food tubs, thali-containers=Meal trays, food-wrap=Food wrap, deli-sheets=Deli sheets, tamper-labels=Seal labels, cutlery-packs=Cutlery packs, paper-napkins=Napkins, tissues=Tissues, wet-wipes=Wet wipes, toothpicks=Toothpicks",
  ),
];

const BY_ID = new Map(CARGO_ITEMS.map((c) => [c.id, c]));
export const CARGO_BY_FAMILY = Object.fromEntries(
  CARGO_FAMILIES.map((f) => [f, CARGO_ITEMS.filter((c) => c.family === f)]),
) as unknown as Record<CargoFamily, readonly CargoItem[]>;
export const cargoItem = (id: string): CargoItem | undefined => BY_ID.get(id);
export const cargoName = (id: string): string => BY_ID.get(id)?.name ?? id;

/** The kinds of crate painted for the van (public/business/cratedispatch/skin-<kind>.webp, laid over the door's colour). */
export const CRATE_SKINS = [
  "produce",
  "pantry",
  "cold",
  "parcel",
  "tableware",
  "cleaning",
] as const;
export type CrateSkin = (typeof CRATE_SKINS)[number];
/** What travels chilled: the meat and fish, and the dairy. */
const COLD_CHAIN = new Set([
  "chicken",
  "steak",
  "salmon",
  "milk",
  "yogurt",
  "cream",
  "butter",
  "cheddar",
  "mozzarella",
]);
/** The crate an item travels in. It is only a look: crates of every kind move the same way. */
export function crateSkinOf(id: string): CrateSkin {
  if (COLD_CHAIN.has(id)) return "cold";
  const item = BY_ID.get(id);
  if (item?.family === "cardboard") return "parcel";
  if (item?.family === "teal") return "tableware";
  if (item?.family === "blue") return "cleaning";
  return item?.source === "pantry" ? "pantry" : "produce";
}

/** Supplies the van shows as their near-twin (five pictures too alike to tell apart are left out). */
const SAME_AS: Record<string, string> = {
  "dessert-forks": "dinner-forks",
  teaspoons: "soup-spoons",
  "dessert-plates": "dinner-plates",
  "side-plates": "dinner-plates",
  "storage-containers": "microwave-containers",
};
/** The van's item for a restaurant ingredient or supply id, or null when the van has none. */
export const cargoIdOf = (id: string): string | null => {
  const mapped = SAME_AS[id] ?? id;
  return BY_ID.has(mapped) ? mapped : null;
};

/** What the restaurant would like on the van, each list in order of importance (restaurant/vanWishes.ts reads it from the save). */
export type CargoWishes = {
  /** Delivered or bought today. */
  delivered: readonly string[];
  /** What the next service is short of. */
  needed: readonly string[];
  /** What the next service uses. */
  menu: readonly string[];
  /** What the player's dishes are made of. */
  yours: readonly string[];
};
export const NO_WISHES: CargoWishes = { delivered: [], needed: [], menu: [], yours: [] };

export type CargoTag = "delivered" | "needed";
/** What one door (and its crates) carries. */
export type CargoDoor = { item: string; family: CargoFamily; tag?: CargoTag };

function mix(...parts: number[]): () => number {
  let a = 0x2545f491;
  for (const p of parts) a = Math.imul(a ^ (p >>> 0), 0x9e3779b1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Which item each door carries. What the restaurant waits for takes at most HALF the doors (rounded up), so the rest of the catalogue (tools, tableware, parcels, cleaning and the other foods)
 * keeps turning up even when the fridge is empty and everything is "needed" (the developer's first wish: not the same few again and again). Today's deliveries come first, then what the next
 * service is short of, starting at a different place of that list on each level and day and moving on with each of the van's trips; up to half of the doors left come from the service's and
 * the player's dishes; the rest from the whole catalogue. Several wanted items of one colour take turns, one a trip.
 */
export function dressDoors(
  slots: readonly CrateIngredient[],
  wishes: CargoWishes,
  ctx: { level: number; seed: number; trip: number },
): Partial<Record<CrateIngredient, CargoDoor>> {
  const rand = mix(ctx.seed, ctx.level, 0x6361);
  /** A colour's wanted items from the lists given, first listed first, without repeats. */
  const wanted = (lists: readonly (readonly string[])[]) => {
    const byFamily = new Map<CargoFamily, string[]>();
    for (const list of lists)
      for (const raw of list) {
        const id = cargoIdOf(raw);
        if (!id) continue;
        const family = BY_ID.get(id)!.family;
        const had = byFamily.get(family) ?? [];
        if (!had.includes(id)) byFamily.set(family, [...had, id]);
      }
    return byFamily;
  };
  const pressing = wanted([wishes.delivered, wishes.needed]);
  const dishes = wanted([wishes.menu, wishes.yours]);

  const chosen: Array<{ family: CargoFamily; from: "pressing" | "dishes" | "catalogue" }> = [];
  const take = (family: CargoFamily, from: (typeof chosen)[number]["from"]) => {
    if (chosen.some((c) => c.family === family)) return false;
    if (
      NEVER_TOGETHER.some(
        ([a, b]) =>
          (family === a && chosen.some((c) => c.family === b)) ||
          (family === b && chosen.some((c) => c.family === a)),
      )
    )
      return false;
    chosen.push({ family, from });
    return true;
  };
  const doors = slots.length;
  const forRestaurant = Math.ceil(doors / 2);
  const today = [...wanted([wishes.delivered]).keys()];
  for (const family of today) if (chosen.length < forRestaurant) take(family, "pressing");
  // the rest of the list starts at a place of its own for the level and day (the same on every trip of that day), and each trip moves on
  const rest = [...pressing.keys()].filter((family) => !today.includes(family));
  const place = rest.length
    ? Math.floor(mix(ctx.seed - ctx.trip, ctx.level, 0x7265)() * rest.length)
    : 0;
  const perTrip = Math.max(1, forRestaurant - chosen.length);
  for (let k = 0; k < rest.length && chosen.length < forRestaurant; k++)
    take(rest[(place + ctx.trip * perTrip + k) % rest.length]!, "pressing");
  const fromDishes = Math.floor((doors - chosen.length) / 2);
  const dishFamilies = [...dishes.keys()];
  const start = dishFamilies.length ? Math.floor(rand() * dishFamilies.length) : 0;
  for (
    let k = 0, got = 0;
    k < dishFamilies.length && got < fromDishes && chosen.length < doors;
    k++
  )
    if (take(dishFamilies[(start + k) % dishFamilies.length]!, "dishes")) got++;
  const turn = Math.floor(rand() * CARGO_FAMILIES.length);
  for (let k = 0; k < CARGO_FAMILIES.length && chosen.length < doors; k++)
    take(CARGO_FAMILIES[(turn + k) % CARGO_FAMILIES.length]!, "catalogue");

  const picked: CargoDoor[] = chosen.map(({ family, from }) => {
    let item: string;
    if (from === "pressing") {
      const list = pressing.get(family)!;
      item = list[ctx.trip % list.length]!;
    } else if (from === "dishes") {
      const list = dishes.get(family)!;
      item = list[(Math.floor(rand() * list.length) + ctx.trip) % list.length]!;
    } else {
      const list = CARGO_BY_FAMILY[family];
      item = list[(Math.floor(rand() * list.length) + ctx.trip) % list.length]!.id;
    }
    const tag: CargoTag | undefined = wishes.delivered.some((w) => cargoIdOf(w) === item)
      ? "delivered"
      : wishes.needed.some((w) => cargoIdOf(w) === item)
        ? "needed"
        : undefined;
    return tag ? { item, family, tag } : { item, family };
  });
  // which door gets which colour is shuffled, so a needed item is not always at the same door
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [picked[i], picked[j]] = [picked[j]!, picked[i]!];
  }
  return Object.fromEntries(slots.map((slot, i) => [slot, picked[i]!])) as Partial<
    Record<CrateIngredient, CargoDoor>
  >;
}
