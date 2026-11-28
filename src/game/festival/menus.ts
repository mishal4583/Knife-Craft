/**
 * EVERY FESTIVAL'S MENU (developer 2026-11-28: "design for all the levels and build"). One kitchen shape serves all fifteen, so the stall's
 * sorted places, the stages' paces and the fairness proof hold for every one of them: a BASE on a plate, three MAINS cooked on the hot station,
 * five TOPPINGS and two SAUCES added cold, one SIDE from the second cooker and three DRINKS. Each food keeps its role's place on the counter,
 * joins the menu at its role's tier and is worth its role's points (menu.ts). Dishes are chosen so the steps are true to the food: toppings go
 * on AFTER cooking. PIZZA is the one exception and has its own step (`bake`): its toppings go on the raw dough, and the whole pizza goes into
 * the oven.
 */
import type { FoodId } from "./types";

/** A thing on a menu. `ms` is its cooking (or pouring) time at the first pace. */
export type Dish = { id: FoodId; name: string; ms?: number };

type Three = readonly [Dish, Dish, Dish];

export type FestivalMenu = {
  id: string;
  /** What a finished plate is called ("burger", "pizza"). */
  dish: string;
  base: Dish;
  /** The base with its article, for the hints ("a bun", "some dough"). */
  aBase: string;
  mains: Three;
  toppings: readonly [Dish, Dish, Dish, Dish, Dish];
  sauces: readonly [Dish, Dish];
  side: Dish;
  drinks: Three;
  /** The hot station's and the second cooker's names. */
  hot: string;
  fry: string;
  /** The order a plate's parts are drawn in, bottom to top (the base first is implied). */
  layers: readonly FoodId[];
  /** From the seventh tier a plate may carry two of the first main. */
  double?: boolean;
  /** Pizza: the mains are put on raw, and the whole dish is baked on the hot station for this long. */
  bake?: number;
  /** What every plate needs to be real food: one of each group (a pizza its sauce and its cheese, pasta its sauce), as soon as one is on the menu. */
  always?: readonly (readonly FoodId[])[];
  /** How far down its menu each stage goes (menu.ts JOINS). */
  stages: readonly [number, number, number];
};

const d = (id: FoodId, name: string, ms?: number): Dish =>
  ms === undefined ? { id, name } : { id, name, ms };

/** The toppings and sauces in their usual stacking order: the toppings first, the sauces on top. */
const onTop = (toppings: FestivalMenu["toppings"], sauces: FestivalMenu["sauces"]): FoodId[] =>
  [...toppings, ...sauces].map((f) => f.id);

type Draft = Omit<FestivalMenu, "layers" | "stages"> & Partial<Pick<FestivalMenu, "layers">>;
/** Every festival after the first starts part of the way down its menu: its food is new, the player is not. */
const menu = (draft: Draft): FestivalMenu => ({
  stages: [3, 6, 10],
  ...draft,
  layers: draft.layers ?? [...draft.mains.map((m) => m.id), ...onTop(draft.toppings, draft.sauces)],
});

const BURGER: FestivalMenu = {
  id: "burger",
  dish: "burger",
  base: d("bun", "Bun"),
  aBase: "a bun",
  mains: [d("patty", "Patty", 3600), d("chicken", "Chicken", 4200), d("veggie", "Veggie", 3800)],
  toppings: [
    d("cheese", "Cheese"),
    d("lettuce", "Lettuce"),
    d("tomato", "Tomato"),
    d("onion", "Onion"),
    d("pickles", "Pickles"),
  ],
  sauces: [d("ketchup", "Ketchup"), d("mustard", "Mustard")],
  side: d("fries", "Fries", 3800),
  drinks: [d("cola", "Cola", 1400), d("lemonade", "Lemonade", 1500), d("milkshake", "Shake", 2000)],
  hot: "Grill",
  fry: "Fryer",
  layers: [
    "patty",
    "chicken",
    "veggie",
    "cheese",
    "pickles",
    "onion",
    "tomato",
    "lettuce",
    "ketchup",
    "mustard",
  ],
  double: true,
  stages: [1, 5, 10],
};

export const FESTIVAL_MENUS: readonly FestivalMenu[] = [
  BURGER,
  menu({
    id: "pizza",
    dish: "pizza",
    base: d("dough", "Dough"),
    aBase: "some dough",
    mains: [d("pepperoni", "Pepperoni"), d("mushroom", "Mushroom"), d("ham", "Ham")],
    toppings: [
      d("mozzarella", "Mozzarella"),
      d("olives", "Olives"),
      d("pepper", "Peppers"),
      d("onion", "Onion"),
      d("basil", "Basil"),
    ],
    sauces: [d("pizza-sauce", "Tomato sauce"), d("pesto", "Pesto")],
    // (the sauce goes on the dough, then the cheese, then the rest)
    layers: [
      "pizza-sauce",
      "pesto",
      "mozzarella",
      "pepperoni",
      "ham",
      "mushroom",
      "pepper",
      "onion",
      "olives",
      "basil",
    ],
    side: d("wings", "Wings", 3800),
    drinks: [
      d("cola", "Cola", 1400),
      d("lemonade", "Lemonade", 1500),
      d("limonata", "Limonata", 2000),
    ],
    hot: "Oven",
    fry: "Fryer",
    bake: 4200,
    always: [["pizza-sauce", "pesto"], ["mozzarella"]],
  }),
  menu({
    id: "sandwich",
    dish: "sandwich",
    base: d("toast", "Toast"),
    aBase: "some toast",
    mains: [d("chicken", "Chicken", 4200), d("bacon", "Bacon", 3600), d("fried-egg", "Egg", 3800)],
    toppings: [
      d("cheese", "Cheese"),
      d("lettuce", "Lettuce"),
      d("tomato", "Tomato"),
      d("cucumber", "Cucumber"),
      d("pickles", "Pickles"),
    ],
    sauces: [d("mayo", "Mayo"), d("mustard", "Mustard")],
    side: d("crisps", "Crisps", 3800),
    drinks: [
      d("iced-tea", "Iced tea", 1400),
      d("orange-juice", "Orange", 1500),
      d("smoothie", "Smoothie", 2000),
    ],
    hot: "Griddle",
    fry: "Fryer",
    double: true,
  }),
  menu({
    id: "breakfast",
    dish: "breakfast",
    base: d("breakfast-plate", "Plate"),
    aBase: "a plate",
    mains: [
      d("pancake", "Pancake", 3600),
      d("waffle", "Waffle", 4200),
      d("french-toast", "French toast", 3800),
    ],
    toppings: [
      d("butter", "Butter"),
      d("strawberry", "Berries"),
      d("banana", "Banana"),
      d("blueberry", "Blueberry"),
      d("cream", "Cream"),
    ],
    sauces: [d("syrup", "Syrup"), d("choc-sauce", "Chocolate")],
    side: d("hash-browns", "Hash browns", 3800),
    drinks: [
      d("coffee", "Coffee", 1400),
      d("orange-juice", "Orange", 1500),
      d("milk", "Milk", 2000),
    ],
    hot: "Griddle",
    fry: "Fryer",
    double: true,
  }),
  menu({
    id: "street",
    dish: "wrap",
    base: d("flatbread", "Flatbread"),
    aBase: "a flatbread",
    mains: [
      d("shawarma", "Shawarma", 3600),
      d("kofta", "Kofta", 4200),
      d("halloumi", "Halloumi", 3800),
    ],
    toppings: [
      d("red-cabbage", "Cabbage"),
      d("lettuce", "Lettuce"),
      d("tomato", "Tomato"),
      d("cucumber", "Cucumber"),
      d("pickles", "Pickles"),
    ],
    sauces: [d("tahini", "Tahini"), d("chilli", "Chilli")],
    side: d("falafel", "Falafel", 3800),
    drinks: [
      d("ayran", "Ayran", 1400),
      d("mint-lemonade", "Mint", 1500),
      d("tamarind", "Tamarind", 2000),
    ],
    hot: "Grill",
    fry: "Fryer",
    double: true,
  }),
  menu({
    id: "asian",
    dish: "bowl",
    base: d("rice-bowl", "Rice bowl"),
    aBase: "a rice bowl",
    mains: [d("teriyaki", "Teriyaki", 3600), d("prawns", "Prawns", 4200), d("tofu", "Tofu", 3800)],
    toppings: [
      d("spring-onion", "Scallion"),
      d("carrot", "Carrot"),
      d("edamame", "Edamame"),
      d("cucumber", "Cucumber"),
      d("kimchi", "Kimchi"),
    ],
    sauces: [d("soy", "Soy"), d("sriracha", "Sriracha")],
    side: d("spring-rolls", "Spring rolls", 3800),
    drinks: [
      d("green-tea", "Green tea", 1400),
      d("lychee", "Lychee", 1500),
      d("bubble-tea", "Boba", 2000),
    ],
    hot: "Wok",
    fry: "Fryer",
  }),
  menu({
    id: "healthy",
    dish: "salad",
    base: d("salad-bowl", "Greens"),
    aBase: "a bowl of greens",
    mains: [d("chicken", "Chicken", 4200), d("salmon", "Salmon", 3600), d("tofu", "Tofu", 3800)],
    toppings: [
      d("feta", "Feta"),
      d("avocado", "Avocado"),
      d("tomato", "Tomato"),
      d("cucumber", "Cucumber"),
      d("sweetcorn", "Corn"),
    ],
    sauces: [d("lemon-dressing", "Lemon"), d("yogurt-dressing", "Yogurt")],
    side: d("sweet-fries", "Sweet fries", 3800),
    drinks: [
      d("water", "Water", 1400),
      d("orange-juice", "Orange", 1500),
      d("green-smoothie", "Green", 2000),
    ],
    hot: "Grill",
    fry: "Fryer",
  }),
  menu({
    id: "bbq",
    dish: "platter",
    base: d("bbq-board", "Platter"),
    aBase: "a platter",
    mains: [d("sausage", "Sausage", 3600), d("ribs", "Ribs", 4200), d("steak", "Steak", 3800)],
    toppings: [
      d("slaw", "Slaw"),
      d("beans", "Beans"),
      d("sweetcorn", "Corn"),
      d("onion", "Onion"),
      d("pickles", "Pickles"),
    ],
    sauces: [d("bbq-sauce", "BBQ"), d("hot-sauce", "Hot")],
    side: d("wedges", "Wedges", 3800),
    drinks: [
      d("iced-tea", "Iced tea", 1400),
      d("lemonade", "Lemonade", 1500),
      d("root-beer", "Root beer", 2000),
    ],
    hot: "Smoker",
    fry: "Fryer",
    double: true,
  }),
  menu({
    id: "pasta",
    dish: "pasta",
    base: d("pasta-bowl", "Bowl"),
    aBase: "a bowl",
    mains: [
      d("spaghetti", "Spaghetti", 3600),
      d("penne", "Penne", 4200),
      d("ravioli", "Ravioli", 3800),
    ],
    toppings: [
      d("marinara", "Marinara"),
      d("parmesan", "Parmesan"),
      d("mushroom", "Mushroom"),
      d("meatballs", "Meatballs"),
      d("basil", "Basil"),
    ],
    sauces: [d("pesto", "Pesto"), d("alfredo", "Alfredo")],
    layers: [
      "spaghetti",
      "penne",
      "ravioli",
      "marinara",
      "alfredo",
      "pesto",
      "mushroom",
      "meatballs",
      "parmesan",
      "basil",
    ],
    side: d("garlic-bread", "Garlic bread", 3800),
    drinks: [
      d("water", "Water", 1400),
      d("lemonade", "Lemonade", 1500),
      d("grape-juice", "Grape", 2000),
    ],
    hot: "Pot",
    fry: "Toaster",
    always: [["marinara", "pesto", "alfredo"]],
  }),
  menu({
    id: "seafood",
    dish: "plate",
    base: d("rice-plate", "Rice plate"),
    aBase: "a rice plate",
    mains: [
      d("salmon", "Salmon", 3600),
      d("prawns", "Prawns", 4200),
      d("white-fish", "White fish", 3800),
    ],
    toppings: [
      d("lemon", "Lemon"),
      d("lettuce", "Lettuce"),
      d("tomato", "Tomato"),
      d("sweetcorn", "Corn"),
      d("olives", "Olives"),
    ],
    sauces: [d("tartar", "Tartar"), d("garlic-butter", "Garlic butter")],
    side: d("calamari", "Calamari", 3800),
    drinks: [
      d("lemonade", "Lemonade", 1400),
      d("iced-tea", "Iced tea", 1500),
      d("coconut-water", "Coconut", 2000),
    ],
    hot: "Grill",
    fry: "Fryer",
  }),
  menu({
    id: "bakery",
    dish: "treat",
    base: d("cake-plate", "Cake plate"),
    aBase: "a cake plate",
    mains: [
      d("muffin", "Muffin", 3600),
      d("croissant", "Croissant", 4200),
      d("cinnamon-roll", "Cinnamon roll", 3800),
    ],
    toppings: [
      d("icing", "Icing"),
      d("strawberry", "Berries"),
      d("choc-chips", "Choc chips"),
      d("almonds", "Almonds"),
      d("sprinkles", "Sprinkles"),
    ],
    sauces: [d("choc-sauce", "Chocolate"), d("caramel", "Caramel")],
    side: d("cookies", "Cookies", 3800),
    drinks: [
      d("coffee", "Coffee", 1400),
      d("hot-chocolate", "Cocoa", 1500),
      d("milk", "Milk", 2000),
    ],
    hot: "Oven",
    fry: "Racks",
  }),
  menu({
    id: "indian",
    dish: "plate",
    base: d("thali", "Thali"),
    aBase: "a thali",
    mains: [
      d("dosa", "Dosa", 3600),
      d("paratha", "Paratha", 4200),
      d("paneer-tikka", "Paneer", 3800),
    ],
    toppings: [
      d("potato-masala", "Masala"),
      d("onion", "Onion"),
      d("tomato", "Tomato"),
      d("coriander", "Coriander"),
      d("curd", "Curd"),
    ],
    sauces: [d("mint-chutney", "Mint"), d("tamarind-chutney", "Tamarind")],
    side: d("samosa", "Samosa", 3800),
    drinks: [
      d("masala-chai", "Chai", 1400),
      d("nimbu-pani", "Nimbu", 1500),
      d("lassi", "Lassi", 2000),
    ],
    hot: "Tawa",
    fry: "Fryer",
  }),
  menu({
    id: "mexican",
    dish: "taco",
    base: d("tortilla", "Tortilla"),
    aBase: "a tortilla",
    mains: [
      d("carne-asada", "Carne asada", 3600),
      d("chicken", "Chicken", 4200),
      d("fajita-veg", "Fajita veg", 3800),
    ],
    toppings: [
      d("cheese", "Cheese"),
      d("lettuce", "Lettuce"),
      d("salsa", "Salsa"),
      d("guacamole", "Guacamole"),
      d("jalapeno", "Jalapeño"),
    ],
    sauces: [d("sour-cream", "Sour cream"), d("hot-sauce", "Hot")],
    side: d("nachos", "Nachos", 3800),
    drinks: [
      d("horchata", "Horchata", 1400),
      d("lime-soda", "Lime soda", 1500),
      d("agua-fresca", "Fresca", 2000),
    ],
    hot: "Grill",
    fry: "Fryer",
    double: true,
  }),
  menu({
    id: "gourmet",
    dish: "course",
    base: d("fine-plate", "Fine plate"),
    aBase: "a fine plate",
    mains: [
      d("steak", "Steak", 3600),
      d("salmon", "Salmon", 4200),
      d("scallops", "Scallops", 3800),
    ],
    toppings: [
      d("mash", "Mash"),
      d("asparagus", "Asparagus"),
      d("mushroom", "Mushroom"),
      d("cherry-tomato", "Tomatoes"),
      d("microgreens", "Greens"),
    ],
    sauces: [d("jus", "Jus"), d("garlic-butter", "Garlic butter")],
    side: d("truffle-fries", "Truffle fries", 3800),
    drinks: [
      d("water", "Water", 1400),
      d("grape-juice", "Grape", 1500),
      d("coffee", "Coffee", 2000),
    ],
    hot: "Pan",
    fry: "Fryer",
  }),
  menu({
    id: "championship",
    dish: "plate",
    base: d("champion-plate", "Gold plate"),
    aBase: "a gold plate",
    mains: [
      d("wagyu", "Wagyu", 3600),
      d("lobster", "Lobster", 4200),
      d("glazed-chicken", "Glazed chicken", 3800),
    ],
    toppings: [
      d("mash", "Mash"),
      d("asparagus", "Asparagus"),
      d("mushroom", "Mushroom"),
      d("cherry-tomato", "Tomatoes"),
      d("microgreens", "Greens"),
    ],
    sauces: [d("jus", "Jus"), d("gold-glaze", "Gold glaze")],
    side: d("golden-fries", "Golden fries", 3800),
    drinks: [
      d("water", "Water", 1400),
      d("lemonade", "Lemonade", 1500),
      d("milkshake", "Shake", 2000),
    ],
    hot: "Grill",
    fry: "Fryer",
  }),
];

export const menuOf = (id: string): FestivalMenu | undefined =>
  FESTIVAL_MENUS.find((m) => m.id === id);

export const BURGER_MENU = BURGER;

/** Every food of every menu, once each, with its name. */
export const MENU_FOODS: ReadonlyMap<FoodId, string> = new Map(
  FESTIVAL_MENUS.flatMap((m) =>
    [m.base, ...m.mains, ...m.toppings, ...m.sauces, m.side, ...m.drinks].map(
      (f) => [f.id, f.name] as const,
    ),
  ),
);
