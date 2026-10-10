/**
 * BUSINESS_SUPPLIES — the restaurant's non-food stock, bought in the
 * Market and monitored in Inventory → Supplies. A separately authorized
 * extension of the shipped Business Mode, not an Economy V3 phase (see
 * docs/ECONOMY_V3_MASTER_SPEC.md §25):
 *
 * - **Culinary smallwares** (back of house): cookware, prep utensils,
 *   bakeware/storage, measuring/safety.
 * - **Tableware** (front of house): flatware, crockery, glassware,
 *   table accessories.
 * - **Takeaway packaging**: containers, boxes/wraps, bags, hygiene
 *   (napkins, tissues, and — Unified Restaurant phase G — dish soap and
 *   cleaning liquid, used a little at a time from an open bottle).
 *
 * Deliberately NOT ingredients: nothing here is in `INGREDIENTS`, goes in
 * the refrigerator, spoils, or uses fridge capacity. Prep knives and
 * cutting boards stay in the Market's own Knives / Cutting Boards
 * sections; dinner and steak knives here are tableware.
 *
 * PRICES. Each line's `retailPackCents` is a real U.S. foodservice price
 * for that exact pack, recorded with its source product page and
 * retrieval date (WebstaurantStore, retrieved 2026-10-02). The game price
 * applies the SAME documented rule as Business ingredients
 * (businessPricing.ts / master spec §24): ~65% of retail
 * (SUPPLY_WHOLESALE_FACTOR), in whole US cents. The retail price is the
 * documented comparator for "saved vs. retail" — a display metric derived
 * from purchases, never extra money.
 *
 * ACCOUNTING. Smallwares and tableware are durable equipment (capital,
 * like the refrigerator); they are never used up. Packaging is a
 * consumable stock asset: one container and one carry bag are used per
 * served Business order (BusinessSuppliesManager.takePackagingForOrder),
 * and only then does its cost become COGS.
 */

export type SupplySection = "culinary" | "service" | "packaging" | "cleaning";

export type SupplyId =
  | "stock-pot"
  | "saucepans"
  | "frying-pans"
  | "saute-pans"
  | "tongs"
  | "spatulas"
  | "ladles"
  | "whisks"
  | "peelers"
  | "graters"
  | "skimmers"
  | "sheet-pans"
  | "mixing-bowls"
  | "storage-containers"
  | "measuring-cups"
  | "kitchen-scales"
  | "thermometers"
  | "oven-mitts"
  | "dinner-forks"
  | "dessert-forks"
  | "dinner-knives"
  | "steak-knives"
  | "teaspoons"
  | "soup-spoons"
  | "dinner-plates"
  | "side-plates"
  | "soup-bowls"
  | "dessert-plates"
  | "water-glasses"
  | "highball-glasses"
  | "coffee-tea-set"
  | "water-jugs"
  | "salt-pepper"
  | "napkin-holders"
  | "menu-stands"
  | "microwave-containers"
  | "foil-containers"
  | "thali-containers"
  | "kraft-boxes"
  | "burger-boxes"
  | "food-wrap"
  | "deli-sheets"
  | "paper-bags"
  | "carry-bags"
  | "tissues"
  | "paper-napkins"
  | "wet-wipes"
  | "cutlery-packs"
  | "toothpicks"
  | "tamper-labels"
  | "dish-soap"
  | "cleaning-liquid"
  // Cleaning (restaurant build, Cleanliness & Maintenance — developer 2026-10-10)
  | "floor-cleaner"
  | "disinfectant"
  | "hand-soap"
  | "toilet-paper"
  | "paper-towels"
  | "sponges-cloths"
  | "bin-liners"
  | "mop-bucket"
  | "brooms"
  | "toilet-brushes";

export type SupplyItem = {
  id: SupplyId;
  name: string;
  section: SupplySection;
  group: string;
  icon: string;
  /** Units in one pack (what one "Buy" adds to stock). */
  packSize: number;
  /** What one unit is: singular / plural. */
  unit: [string, string];
  /** The real retail price of one pack, US cents (the comparator for "saved vs. retail"). */
  retailPackCents: number;
  /** Where that price came from. */
  source: { product: string; url: string };
};

/** The date every `retailPackCents` was read from its source page. */
export const SUPPLY_PRICES_RETRIEVED = "2026-10-02";

/** The documented restaurant-procurement rule shared with Business ingredients (master spec §24): ~65% of retail. */
export const SUPPLY_WHOLESALE_FACTOR = 0.65;

export const SUPPLY_SECTIONS: Record<
  SupplySection,
  { title: string; short: string; kicker: string; emoji: string; groups: string[] }
> = {
  culinary: {
    title: "Culinary & Kitchen Smallwares",
    short: "Smallwares",
    kicker: "Back of house",
    emoji: "🍳",
    groups: ["Cookware", "Prep utensils", "Bakeware & storage", "Measuring & safety"],
  },
  service: {
    title: "Cutlery, Crockery & Tableware",
    short: "Tableware",
    kicker: "Front of house",
    emoji: "🍽️",
    groups: ["Cutlery", "Crockery", "Glassware & hollowware", "Table accessories"],
  },
  packaging: {
    title: "Parcel & Takeaway Supplies",
    short: "Takeaway",
    kicker: "Packaging",
    emoji: "📦",
    groups: ["Containers", "Boxes & wraps", "Bags & carriers", "Securing & hygiene"],
  },
  // Restaurant build only (RESTAURANT_SUPPLY_SECTION_ORDER): the Cleanliness screen's supplies.
  cleaning: {
    title: "Cleaning & Hygiene Supplies",
    short: "Cleaning",
    kicker: "Housekeeping",
    emoji: "🧹",
    groups: ["Chemicals", "Restroom", "Cloths & liners", "Tools"],
  },
};

/** The classic build's sections (Business Mode); the cleaning lines are restaurant-only. */
export const SUPPLY_SECTION_ORDER: readonly SupplySection[] = ["culinary", "service", "packaging"];

/** The restaurant build's sections: the classic three + Cleaning (Cleanliness & Maintenance). */
export const RESTAURANT_SUPPLY_SECTION_ORDER: readonly SupplySection[] = [
  ...SUPPLY_SECTION_ORDER,
  "cleaning",
];

const W = "https://www.webstaurantstore.com/";
const piece: [string, string] = ["piece", "pieces"];

export const SUPPLY_CATALOG: readonly SupplyItem[] = [
  // ---- Culinary smallwares: Cookware ----
  {
    id: "stock-pot",
    name: "Stock pot · 20 qt",
    section: "culinary",
    group: "Cookware",
    icon: "🍲",
    packSize: 1,
    unit: piece,
    retailPackCents: 5899,
    source: {
      product: "Vigor SS1 Series 20 Qt. Stainless Steel Aluminum-Clad Stock Pot with Cover",
      url: `${W}vigor-20-qt-heavy-duty-stainless-steel-aluminum-clad-stock-pot-with-cover/473SSPOT20.html`,
    },
  },
  {
    id: "saucepans",
    name: "Saucepan · 3 qt",
    section: "culinary",
    group: "Cookware",
    icon: "🥘",
    packSize: 1,
    unit: piece,
    retailPackCents: 2549,
    source: {
      product: "Vigor SS1 Series 3 Qt. Stainless Steel Saucier Pan with Cover",
      url: `${W}vigor-3-qt-stainless-steel-saucier-pan-with-aluminum-clad-bottom/473SSAUCIER3.html`,
    },
  },
  {
    id: "frying-pans",
    name: "Fry pan · 10 in",
    section: "culinary",
    group: "Cookware",
    icon: "🍳",
    packSize: 1,
    unit: piece,
    retailPackCents: 934,
    source: {
      product: 'Choice 10" Aluminum Fry Pan',
      url: `${W}choice-10-aluminum-fry-pan/407FRYPAN.html`,
    },
  },
  {
    id: "saute-pans",
    name: "Sauté pan · 5 qt",
    section: "culinary",
    group: "Cookware",
    icon: "🍳",
    packSize: 1,
    unit: piece,
    retailPackCents: 4099,
    source: {
      product: "Vigor SS1 Series 5 Qt. Stainless Steel Saute Pan with Lid and Helper Handle",
      url: `${W}5-qt-stainless-steel-saute-pan-with-lid-and-helper-handle/922SSAU5.html`,
    },
  },
  // ---- Culinary smallwares: Prep utensils ----
  {
    id: "tongs",
    name: "Utility tongs · 12 in",
    section: "culinary",
    group: "Prep utensils",
    icon: "🥢",
    packSize: 1,
    unit: piece,
    retailPackCents: 499,
    source: {
      product: 'Choice 12" Heavy-Duty One-Piece Stainless Steel Scalloped Tongs',
      url: `${W}tong-12-utility-s-s-hd-1pc-scallop-nsf/407OPUT12.html`,
    },
  },
  {
    id: "spatulas",
    name: "High-heat turner · 12 in",
    section: "culinary",
    group: "Prep utensils",
    icon: "🥄",
    packSize: 1,
    unit: piece,
    retailPackCents: 561,
    source: {
      product: 'TableCraft H3905GY 12" High Heat Flexible Silicone Slotted Spatula / Turner',
      url: `${W}tablecraft-h3905gy-12-high-heat-gray-flexible-silicone-slotted-spatula-turner/808H3905GY.html`,
    },
  },
  {
    id: "ladles",
    name: "Ladle · 8 oz",
    section: "culinary",
    group: "Prep utensils",
    icon: "🥄",
    packSize: 1,
    unit: piece,
    retailPackCents: 399,
    source: {
      product: "Choice 8 oz. One-Piece Stainless Steel Ladle",
      url: `${W}choice-8-oz-one-piece-stainless-steel-ladle/407OPL8.html`,
    },
  },
  {
    id: "whisks",
    name: "Piano whisk · 12 in",
    section: "culinary",
    group: "Prep utensils",
    icon: "〰️",
    packSize: 1,
    unit: piece,
    retailPackCents: 449,
    source: {
      product: 'Choice 12" Stainless Steel Piano Whip / Whisk',
      url: `${W}choice-12-stainless-steel-piano-whip-whisk/407PW12.html`,
    },
  },
  {
    id: "peelers",
    name: "Vegetable peeler",
    section: "culinary",
    group: "Prep utensils",
    icon: "🥕",
    packSize: 1,
    unit: piece,
    retailPackCents: 319,
    source: {
      product: 'Choice 6" Smooth Vegetable Peeler with Stainless Steel Blade',
      url: `${W}choice-6-smooth-vegetable-peeler-with-stainless-steel-blade/407PVSSM2.html`,
    },
  },
  {
    id: "graters",
    name: "Box grater · 4-sided",
    section: "culinary",
    group: "Prep utensils",
    icon: "🧀",
    packSize: 1,
    unit: piece,
    retailPackCents: 499,
    source: {
      product: 'Choice 9" 4-Sided Stainless Steel Box Grater',
      url: `${W}choice-9-4-sided-stainless-steel-box-grater/4074SDGTR.html`,
    },
  },
  {
    id: "skimmers",
    name: "Fine mesh skimmers · 5 in",
    section: "culinary",
    group: "Prep utensils",
    icon: "🥄",
    packSize: 6,
    unit: piece,
    retailPackCents: 2094,
    source: {
      product: 'Choice 5" Square Fine Mesh Reinforced Skimmer ($3.49 each, sold in 6s)',
      url: `${W}skimmer-square-nickel-plated-metal-sqr-fine-mesh-reinf-5/407SKMSQ5.html`,
    },
  },
  // ---- Culinary smallwares: Bakeware & storage ----
  {
    id: "sheet-pans",
    name: "Sheet pan · full size",
    section: "culinary",
    group: "Bakeware & storage",
    icon: "▤",
    packSize: 1,
    unit: piece,
    retailPackCents: 699,
    source: {
      product: 'Choice Full Size 18" x 26" 19 Gauge Aluminum Bun / Sheet Pan',
      url: `${W}choice-full-size-18-x-26-19-gauge-wire-in-rim-aluminum-bun-pan-sheet-pan/407BUNFULL.html`,
    },
  },
  {
    id: "mixing-bowls",
    name: "Mixing bowl · 5 qt",
    section: "culinary",
    group: "Bakeware & storage",
    icon: "🥣",
    packSize: 1,
    unit: piece,
    retailPackCents: 279,
    source: {
      product: "Choice 5 Qt. Standard Stainless Steel Mixing Bowl",
      url: `${W}choice-5-qt-standard-stainless-steel-mixing-bowl/407SSMXB5.html`,
    },
  },
  {
    id: "storage-containers",
    name: "Storage container + lid · 4 qt",
    section: "culinary",
    group: "Bakeware & storage",
    icon: "🫙",
    packSize: 1,
    unit: ["set", "sets"],
    retailPackCents: 698,
    source: {
      product:
        "Choice 4 Qt. Clear Square Polycarbonate Food Storage Container ($5.99) + Choice 2/4 Qt. lid ($0.99)",
      url: `${W}choice-4-qt-clear-square-polycarbonate-food-storage-container-with-green-gradations/176SQRCL4.html`,
    },
  },
  // ---- Culinary smallwares: Measuring & safety ----
  {
    id: "measuring-cups",
    name: "Measuring cup set · 4 pc",
    section: "culinary",
    group: "Measuring & safety",
    icon: "◫",
    packSize: 1,
    unit: ["set", "sets"],
    retailPackCents: 549,
    source: {
      product: "Choice 4-Piece Stainless Steel Measuring Cup Set with Wire Handles",
      url: `${W}choice-4-piece-stainless-steel-measuring-cup-set-with-wire-handles/4074PCMCWH.html`,
    },
  },
  {
    id: "kitchen-scales",
    name: "Digital portion scale · 11 lb",
    section: "culinary",
    group: "Measuring & safety",
    icon: "⚖️",
    packSize: 1,
    unit: piece,
    retailPackCents: 2349,
    source: {
      product: "Taylor 1020NFS 11 lb. Digital Portion Control Scale",
      url: `${W}taylor-1020nfs-11-lb-digital-portion-control-scale-for-dry-and-liquid-measuring/6081020NFS.html`,
    },
  },
  {
    id: "thermometers",
    name: "Probe thermometer",
    section: "culinary",
    group: "Measuring & safety",
    icon: "🌡️",
    packSize: 1,
    unit: piece,
    retailPackCents: 779,
    source: {
      product: 'Choice 5" Digital Pocket Probe Thermometer',
      url: `${W}choice-5-digital-pocket-probe-thermometer-58-572-degrees-fahrenheit/914DRT450.html`,
    },
  },
  {
    id: "oven-mitts",
    name: "Oven mitts · 15 in",
    section: "culinary",
    group: "Measuring & safety",
    icon: "🧤",
    packSize: 1,
    unit: ["pair", "pairs"],
    retailPackCents: 599,
    source: {
      product: 'Choice 15" Flame Retardant Oven Mitts',
      url: `${W}choice-15-flame-retardant-conventional-style-oven-mitts/160FLAME15.html`,
    },
  },
  // ---- Tableware: Cutlery ----
  {
    id: "dinner-forks",
    name: "Dinner forks",
    section: "service",
    group: "Cutlery",
    icon: "🍴",
    packSize: 12,
    unit: piece,
    retailPackCents: 699,
    source: {
      product: 'Choice Milton 7 5/8" 18/0 Stainless Steel Dinner Fork - 12/Pack',
      url: `${W}choice-milton-7-5-8-18-0-stainless-steel-medium-weight-dinner-fork-pack/267270005M.html`,
    },
  },
  {
    id: "dessert-forks",
    name: "Salad / dessert forks",
    section: "service",
    group: "Cutlery",
    icon: "🍴",
    packSize: 12,
    unit: piece,
    retailPackCents: 459,
    source: {
      product: 'Choice Milton 6 1/2" 18/0 Stainless Steel Salad Fork - 12/Pack',
      url: `${W}choice-milton-6-1-2-18-0-stainless-steel-medium-weight-salad-fork-pack/267270006M.html`,
    },
  },
  {
    id: "dinner-knives",
    name: "Dinner knives",
    section: "service",
    group: "Cutlery",
    icon: "🔪",
    packSize: 12,
    unit: piece,
    retailPackCents: 999,
    source: {
      product: 'Choice Milton 9" 18/0 Stainless Steel Dinner Knife - 12/Pack',
      url: `${W}choice-milton-8-7-8-18-0-stainless-steel-medium-weight-dinner-knife-case/267270008.html`,
    },
  },
  {
    id: "steak-knives",
    name: "Steak knives",
    section: "service",
    group: "Cutlery",
    icon: "🔪",
    packSize: 12,
    unit: piece,
    retailPackCents: 629,
    source: {
      product: 'Choice 4 3/8" Steak Knife with Natural Wood Euro Handle - 12/Case',
      url: `${W}choice-4-3-8-stainless-steel-steak-knife-with-natural-wood-euro-handle-and-pointed-tip-case/17630111.html`,
    },
  },
  {
    id: "teaspoons",
    name: "Teaspoons",
    section: "service",
    group: "Cutlery",
    icon: "🥄",
    packSize: 12,
    unit: piece,
    retailPackCents: 429,
    source: {
      product: 'Choice Milton 6 5/8" 18/0 Stainless Steel Teaspoon - 12/Pack',
      url: `${W}choice-milton-6-5-8-18-0-stainless-steel-medium-weight-teaspoon-pack/267270001M.html`,
    },
  },
  {
    id: "soup-spoons",
    name: "Soup spoons",
    section: "service",
    group: "Cutlery",
    icon: "🥄",
    packSize: 12,
    unit: piece,
    retailPackCents: 549,
    source: {
      product: 'Choice Milton 6 3/8" 18/0 Stainless Steel Bouillon Spoon - 12/Pack',
      url: `${W}choice-milton-6-3-8-18-0-stainless-steel-medium-weight-bouillon-spoon-pack/267270002M.html`,
    },
  },
  // ---- Tableware: Crockery ----
  {
    id: "dinner-plates",
    name: "Dinner plates · 10½ in",
    section: "service",
    group: "Crockery",
    icon: "🍽️",
    packSize: 12,
    unit: piece,
    retailPackCents: 5699,
    source: {
      product: 'Acopa 10 1/2" Round Bright White Coupe Stoneware Plate - 12/Case',
      url: `${W}acopa-10-1-2-round-bright-white-coupe-china-plate-case/303BWCOP16.html`,
    },
  },
  {
    id: "side-plates",
    name: "Side plates · 7¼ in",
    section: "service",
    group: "Crockery",
    icon: "🍽️",
    packSize: 36,
    unit: piece,
    retailPackCents: 6799,
    source: {
      product: 'Acopa 7 1/4" Round Bright White Coupe Stoneware Plate - 36/Case',
      url: `${W}acopa-7-1-4-round-bright-white-coupe-stoneware-plate-case/303BWCOP7.html`,
    },
  },
  {
    id: "soup-bowls",
    name: "Soup / pasta bowls · 16 oz",
    section: "service",
    group: "Crockery",
    icon: "🥣",
    packSize: 12,
    unit: piece,
    retailPackCents: 7299,
    source: {
      product: "Acopa 16 oz. Bright White Wide Rim Stoneware Soup and Pasta Bowl - 12/Case",
      url: `${W}acopa-16-oz-bright-white-wide-rim-rolled-edge-rim-china-soup-and-pasta-bowl-case/303BWREB16.html`,
    },
  },
  {
    id: "dessert-plates",
    name: "Dessert plates · 8 in",
    section: "service",
    group: "Crockery",
    icon: "🍽️",
    packSize: 6,
    unit: piece,
    retailPackCents: 2199,
    source: {
      product: 'Acopa 8" Round Bright White Coupe Stoneware Plate - 6/Pack',
      url: `${W}acopa-8-round-bright-white-coupe-china-plate-pack/999BWCOP22.html`,
    },
  },
  // ---- Tableware: Glassware & hollowware ----
  {
    id: "water-glasses",
    name: "Water glasses · 12 oz",
    section: "service",
    group: "Glassware & hollowware",
    icon: "🥛",
    packSize: 12,
    unit: piece,
    retailPackCents: 1849,
    source: {
      product: "Acopa Straight Up 12 oz. Rocks / Double Old Fashioned Glass - 12/Case",
      url: `${W}acopa-12-oz-double-rocks-old-fashioned-glass-case/5535611R.html`,
    },
  },
  {
    id: "highball-glasses",
    name: "Highball glasses · 12 oz",
    section: "service",
    group: "Glassware & hollowware",
    icon: "🥤",
    packSize: 12,
    unit: piece,
    retailPackCents: 2599,
    source: {
      product: "Acopa Radiance 12 oz. Highball Glass - 12/Case",
      url: `${W}acopa-radiance-12-oz-high-ball-glass-case/5539012HB.html`,
    },
  },
  {
    id: "coffee-tea-set",
    name: "Coffee cups + saucers · 7 oz",
    section: "service",
    group: "Glassware & hollowware",
    icon: "☕",
    packSize: 36,
    unit: ["set", "sets"],
    retailPackCents: 7948,
    source: {
      product:
        'Acopa 7 oz. Bright White Stackable Stoneware Cup - 36/Case ($40.49) + Acopa 6" Saucer - 36/Case ($38.99)',
      url: `${W}acopa-7-oz-bright-white-rolled-edge-stackable-china-cup-case/303BWRESTKC7.html`,
    },
  },
  {
    id: "water-jugs",
    name: "Water pitcher · 60 oz",
    section: "service",
    group: "Glassware & hollowware",
    icon: "🫗",
    packSize: 1,
    unit: piece,
    retailPackCents: 349,
    source: {
      product: "Choice 60 oz. Clear SAN Plastic Beverage Pitcher",
      url: `${W}choice-60-oz-clear-san-plastic-beverage-pitcher/999SAN60CLR.html`,
    },
  },
  // ---- Tableware: Table accessories ----
  {
    id: "salt-pepper",
    name: "Salt & pepper shakers",
    section: "service",
    group: "Table accessories",
    icon: "🧂",
    packSize: 4,
    unit: ["shaker", "shakers"],
    retailPackCents: 769,
    source: {
      product: "TableCraft 163S&P 1.5 oz. Glass Salt and Pepper Shaker - 4/Pack",
      url: `${W}tablecraft-163sp-1-5-oz-nostalgia-glass-salt-and-pepper-shaker-with-stainless-steel-top-case/808163SP6DZ.html`,
    },
  },
  {
    id: "napkin-holders",
    name: "Napkin dispenser",
    section: "service",
    group: "Table accessories",
    icon: "🧻",
    packSize: 1,
    unit: piece,
    retailPackCents: 499,
    source: {
      product: "Choice Stainless Steel Low-Fold Napkin Dispenser",
      url: `${W}choice-stainless-steel-low-fold-napkin-dispenser/176NDLSS.html`,
    },
  },
  {
    id: "menu-stands",
    name: "Menu / card holder · 8 in",
    section: "service",
    group: "Table accessories",
    icon: "📋",
    packSize: 1,
    unit: piece,
    retailPackCents: 169,
    source: {
      product: 'Choice 8" Chrome Menu / Card Holder',
      url: `${W}choice-8-chrome-menu-card-holder/176CH8RB.html`,
    },
  },
  // ---- Takeaway: Containers ----
  {
    id: "microwave-containers",
    name: "Microwavable containers + lids · 32 oz",
    section: "packaging",
    group: "Containers",
    icon: "🥡",
    packSize: 150,
    unit: piece,
    retailPackCents: 2799,
    source: {
      product: "Choice 32 oz. Black Round Microwavable Container with Lid - 150/Case",
      url: `${W}choice-32-oz-black-7-1-4-round-microwavable-heavyweight-container-with-lid-case/129MCR32B.html`,
    },
  },
  {
    id: "foil-containers",
    name: "Foil containers + lids · 2¼ lb",
    section: "packaging",
    group: "Containers",
    icon: "🥡",
    packSize: 250,
    unit: piece,
    retailPackCents: 6699,
    source: {
      product: "Choice 2.25 lb. Oblong Foil Take-Out Container with Board Lid - 250/Case",
      url: `${W}choice-2-25-lb-oblong-take-out-container-with-board-lid-case/612LOB225LBC.html`,
    },
  },
  {
    id: "thali-containers",
    name: "3-compartment meal trays + lids",
    section: "packaging",
    group: "Containers",
    icon: "🍱",
    packSize: 150,
    unit: piece,
    retailPackCents: 6149,
    source: {
      product:
        "Choice 36 oz. Black 3-Compartment Rectangular Microwavable Container with Lid - 150/Case",
      url: `${W}choice-32-oz-black-9-3-4-x-7-1-4-x-2-3-compartment-rectangular-microwavable-heavy-weight-container-with-lid-case/129MCS323CB.html`,
    },
  },
  // ---- Takeaway: Boxes & wraps ----
  {
    id: "kraft-boxes",
    name: "Kraft take-out boxes · #8",
    section: "packaging",
    group: "Boxes & wraps",
    icon: "📦",
    packSize: 300,
    unit: piece,
    retailPackCents: 4349,
    source: {
      product: "Choice Kraft Microwavable Folded Paper #8 Take-Out Container - 300/Case",
      url: `${W}choice-6-x-4-5-8-x-2-1-2-kraft-microwavable-folded-paper-8-take-out-container-case/795PTOKFT8.html`,
    },
  },
  {
    id: "burger-boxes",
    name: "Burger clamshells · 4 in",
    section: "packaging",
    group: "Boxes & wraps",
    icon: "🍔",
    packSize: 500,
    unit: piece,
    retailPackCents: 5249,
    source: {
      product: '4" x 4" x 3" White Paper Clamshell Take-Out Container - 500/Case',
      url: `${W}4-x-4-x-3-white-paper-clamshell-take-out-container-case/1509080.html`,
    },
  },
  {
    id: "food-wrap",
    name: "Deli wrap paper · 12×12",
    section: "packaging",
    group: "Boxes & wraps",
    icon: "📄",
    packSize: 1000,
    unit: ["sheet", "sheets"],
    retailPackCents: 2049,
    source: {
      product: 'Choice 12" x 12" White Basket Liner / Deli Wrap - 1,000/Pack',
      url: `${W}choice-12-x-12-white-basket-liner-deli-wrap-pack/9993003536WH.html`,
    },
  },
  {
    id: "deli-sheets",
    name: "Kraft deli sheets · 12×12",
    section: "packaging",
    group: "Boxes & wraps",
    icon: "📄",
    packSize: 1000,
    unit: ["sheet", "sheets"],
    retailPackCents: 2299,
    source: {
      product: 'Choice 12" x 12" Natural Kraft Basket Liner / Deli Wrap - 1,000/Pack',
      url: `${W}choice-12-x-12-natural-kraft-basket-liner-deli-wrap-case/1503003536.html`,
    },
  },
  // ---- Takeaway: Bags & carriers ----
  {
    id: "paper-bags",
    name: "Kraft paper bags with handles",
    section: "packaging",
    group: "Bags & carriers",
    icon: "🛍️",
    packSize: 250,
    unit: ["bag", "bags"],
    retailPackCents: 4649,
    source: {
      product: 'Choice 10" x 6 3/4" x 12" Natural Kraft Paper Shopping Bag with Handles - 250/Case',
      url: `${W}choice-10-x-6-3-4-x-12-natural-kraft-paper-shopping-bag-with-handles-case/433BR10712C.html`,
    },
  },
  {
    id: "carry-bags",
    name: "Plastic carry-out bags",
    section: "packaging",
    group: "Bags & carriers",
    icon: "🛍️",
    packSize: 1000,
    unit: ["bag", "bags"],
    retailPackCents: 2649,
    source: {
      product:
        'Choice 1/6 Standard Size White "Thank You" Medium-Duty Plastic T-Shirt Bag - 1,000/Case',
      url: `${W}1-6-size-59-mil-white-thank-you-plastic-t-shirt-bag-case/433NHT101H.html`,
    },
  },
  // ---- Takeaway: Securing & hygiene ----
  {
    id: "tissues",
    name: "Tissue cubes · 90 sheets",
    section: "packaging",
    group: "Securing & hygiene",
    icon: "🧻",
    packSize: 36,
    unit: ["box", "boxes"],
    retailPackCents: 3099,
    source: {
      product: "Choice 90 Sheet 2-Ply Facial Tissue Cube - 36/Case",
      url: `${W}choice-2-ply-facial-tissue-cube-case/5002FCCUBE.html`,
    },
  },
  {
    id: "paper-napkins",
    name: "Paper napkins · 1-ply",
    section: "packaging",
    group: "Securing & hygiene",
    icon: "🧻",
    packSize: 4000,
    unit: ["napkin", "napkins"],
    retailPackCents: 1399,
    source: {
      product: "Choice 1-Ply White Beverage / Cocktail Napkin - 4,000/Case",
      url: `${W}choice-1-ply-white-beverage-cocktail-napkin-case/5001BNAP.html`,
    },
  },
  {
    id: "wet-wipes",
    name: "Moist towelettes",
    section: "packaging",
    group: "Securing & hygiene",
    icon: "🫧",
    packSize: 1000,
    unit: ["wipe", "wipes"],
    retailPackCents: 1849,
    source: {
      product: '4" x 6" Lemon Scented Moist Towelette / Wet Nap - 1,000/Case',
      url: `${W}4-x-6-lemon-scented-moist-towelette-wet-nap-case/433WETEC.html`,
    },
  },
  {
    id: "cutlery-packs",
    name: "Wrapped cutlery kits",
    section: "packaging",
    group: "Securing & hygiene",
    icon: "🥢",
    packSize: 250,
    unit: ["kit", "kits"],
    retailPackCents: 1449,
    source: {
      product: "Choice Medium Weight White Wrapped Plastic Cutlery Set with Napkin - 250/Case",
      url: `${W}choice-individually-wrapped-medium-weight-white-plastic-cutlery-set-with-napkin-case/346WKFSNM.html`,
    },
  },
  {
    id: "toothpicks",
    name: "Wrapped toothpicks",
    section: "packaging",
    group: "Securing & hygiene",
    icon: "📍",
    packSize: 1000,
    unit: piece,
    retailPackCents: 769,
    source: {
      product: 'Choice 2 1/2" Plain Plastic Wrapped Round Toothpicks - 1,000/Box',
      url: `${W}choice-2-1-2-plain-plastic-wrapped-round-toothpicks-in-dispenser-box-box/500WWTPPLAS.html`,
    },
  },
  {
    id: "tamper-labels",
    name: "Tamper-evident labels",
    section: "packaging",
    group: "Securing & hygiene",
    icon: "🏷️",
    packSize: 250,
    unit: ["label", "labels"],
    retailPackCents: 789,
    source: {
      product: 'Choice TamperSafe 3" x 1" White Paper Tamper-Evident Label - 250/Roll',
      url: `${W}tampersafe-1-x-3-white-paper-tamper-evident-label-roll/322TE1X3WPA.html`,
    },
  },
  // ---- Takeaway: Securing & hygiene — cleaning (Unified Restaurant phase G) ----
  // Bottles: the restaurant uses them a little at a time (restaurant/serviceSupplies.ts).
  // These two prices were read from WebstaurantStore's own listing on 2026-10-04 (search
  // index; the product page itself could not be opened from the build machine) — re-check
  // them in the economy pass (docs/ECONOMY_TODO.md #3, #4).
  {
    id: "dish-soap",
    name: "Dish soap · pot & pan",
    section: "packaging",
    group: "Securing & hygiene",
    icon: "🧴",
    packSize: 4,
    unit: ["gallon bottle", "gallon bottles"],
    retailPackCents: 5099,
    source: {
      product: "Noble Pan Pro I 1 Gallon / 128 oz. Concentrated Pot & Pan Soap - 4/Case",
      url: `${W}noble-chemical-pan-pro-i-1-gallon-128-oz-pot-pan-soap-case/147PANPROI1G.html`,
    },
  },
  {
    id: "cleaning-liquid",
    name: "Cleaning liquid · all-purpose",
    section: "packaging",
    group: "Securing & hygiene",
    icon: "🧽",
    packSize: 4,
    unit: ["gallon bottle", "gallon bottles"],
    retailPackCents: 5149,
    source: {
      product:
        "Noble 1 Gallon / 128 oz. All Surf All Purpose Concentrated Liquid Cleaner (Non-Butyl) - 4/Case",
      url: `${W}noble-chemical-1-gallon-128-oz-all-surf-all-purpose-liquid-cleaner-non-butyl-case/147ALLSURF1G.html`,
    },
  },
  // ---- Cleaning (restaurant build, Cleanliness & Maintenance — developer 2026-10-10) ----
  // Prices read from WebstaurantStore's listings on 2026-10-10 (search index).
  {
    id: "floor-cleaner",
    name: "Floor cleaner · no-rinse",
    section: "cleaning",
    group: "Chemicals",
    icon: "🪣",
    packSize: 4,
    unit: ["gallon bottle", "gallon bottles"],
    retailPackCents: 10249,
    source: {
      product: "Noble Eco Step and Shine 1 Gallon Concentrated No Rinse Floor Cleaner - 4/Case",
      url: `${W}noble-eco-step-and-shine-1-gallon-concentrated-no-rinse-floor-cleaner-case/147ENZFC1G.html`,
    },
  },
  {
    id: "disinfectant",
    name: "Sanitizer / disinfectant spray",
    section: "cleaning",
    group: "Chemicals",
    icon: "🧪",
    packSize: 12,
    unit: ["spray bottle", "spray bottles"],
    retailPackCents: 5599,
    source: {
      product: "Bacoff 32 fl. oz. Ready-to-Use Sanitizer / Disinfectant - 12/Case",
      url: `${W}bacoff-32-oz-sanitizer-disinfectant-case/146BACOFFQT.html`,
    },
  },
  {
    id: "hand-soap",
    name: "Hand soap refill",
    section: "cleaning",
    group: "Restroom",
    icon: "🧼",
    packSize: 4,
    unit: ["gallon refill", "gallon refills"],
    retailPackCents: 7849,
    source: {
      product:
        "Softsoap CPC61036482CT 1 Gallon Refreshing Clean Scent Liquid Hand Soap Refill - 4/Case",
      url: `${W}softsoap-cpc61036482ct-1-gallon-refreshing-clean-scent-liquid-hand-soap-refill-case/13BCPCA61036482.html`,
    },
  },
  {
    id: "toilet-paper",
    name: "Toilet paper · jumbo roll",
    section: "cleaning",
    group: "Restroom",
    icon: "🧻",
    packSize: 12,
    unit: ["roll", "rolls"],
    retailPackCents: 2549,
    source: {
      product: "Lavex 2-Ply 720' Universal Jumbo Toilet Paper Roll with 9\" Diameter - 12/Case",
      url: `${W}lavex-universal-2-ply-jumbo-720-toilet-paper-roll-with-9-diameter-case/5002TPJ.html`,
    },
  },
  {
    id: "paper-towels",
    name: "Paper hand towels · multifold",
    section: "cleaning",
    group: "Restroom",
    icon: "📃",
    packSize: 4000,
    unit: ["towel", "towels"],
    retailPackCents: 2649,
    source: {
      product: "Lavex Janitorial Multifold Paper Towels - 4000/Case",
      url: `${W}lavex-janitorial-white-m-fold-multifold-towel-case/500MFT.html`,
    },
  },
  {
    id: "sponges-cloths",
    name: "Microfiber cleaning cloths",
    section: "cleaning",
    group: "Cloths & liners",
    icon: "🧽",
    packSize: 10,
    unit: ["cloth", "cloths"],
    retailPackCents: 1390,
    source: {
      product:
        'Unger ME40J SmartColor MicroWipe 16" x 16" Yellow UltraLite Microfiber Cleaning Cloth - 10/Case',
      url: `${W}unger-me40j-smartcolor-microwipe-16-x-16-yellow-ultralite-microfiber-cleaning-cloth-pack/905ME40J.html`,
    },
  },
  {
    id: "bin-liners",
    name: "Bin liners · 33 gallon",
    section: "cleaning",
    group: "Cloths & liners",
    icon: "🗑️",
    packSize: 500,
    unit: ["liner", "liners"],
    retailPackCents: 4499,
    source: {
      product:
        'Lavex 33 Gallon 13 Micron 33" x 40" High Density Janitorial Can Liner / Trash Bag - 500/Case',
      url: `${W}33-gallon-13-micron-33-x-40-olympian-high-density-can-liner-trash-bag-case/502334013CL.html`,
    },
  },
  {
    id: "mop-bucket",
    name: "Mop bucket & wringer",
    section: "cleaning",
    group: "Tools",
    icon: "🪣",
    packSize: 1,
    unit: piece,
    retailPackCents: 4624,
    source: {
      product: "Lavex 35 Qt. Yellow Mop Bucket & Side Press Wringer Combo",
      url: `${W}lavex-janitorial-35-qt-yellow-mop-bucket-side-press-wringer-combo/274MOPBCKTYE.html`,
    },
  },
  {
    id: "brooms",
    name: "Lobby broom & dustpan",
    section: "cleaning",
    group: "Tools",
    icon: "🧹",
    packSize: 1,
    unit: ["set", "sets"],
    retailPackCents: 1999,
    source: {
      product: 'Lavex 12" Closed-Lid Lobby Dust Pan with Broom',
      url: `${W}lavex-janitorial-12-closed-lid-lobby-dust-pan-with-broom/697LDP12CLKT.html`,
    },
  },
  {
    id: "toilet-brushes",
    name: "Toilet brush & caddy",
    section: "cleaning",
    group: "Tools",
    icon: "🚽",
    packSize: 1,
    unit: piece,
    retailPackCents: 699,
    source: {
      product: 'Lavex 14" White Toilet Bowl Brush with Caddy',
      url: `${W}lavex-janitorial-14-white-toilet-bowl-brush-with-caddy/697TBB14CDDY.html`,
    },
  },
];

/** Lines used a little at a time from an open bottle (restaurant/serviceSupplies.ts), never one per order. */
export const BOTTLE_SUPPLY_IDS: readonly SupplyId[] = ["dish-soap", "cleaning-liquid"];

export function isBottleSupply(item: SupplyItem): boolean {
  return BOTTLE_SUPPLY_IDS.includes(item.id);
}

const BY_ID = new Map<string, SupplyItem>(SUPPLY_CATALOG.map((item) => [item.id, item]));

export function getSupplyItem(id: string): SupplyItem | undefined {
  return BY_ID.get(id);
}

/** The game's price for one pack, whole US cents: the retail pack price × SUPPLY_WHOLESALE_FACTOR. */
export function supplyPackPrice(item: SupplyItem): number {
  return Math.round(item.retailPackCents * SUPPLY_WHOLESALE_FACTOR);
}

/** The cleaning section's durable tools (never used up, like smallwares). */
export const CLEANING_TOOL_IDS: readonly SupplyId[] = ["mop-bucket", "brooms", "toilet-brushes"];

/** Durable equipment (smallwares, tableware, cleaning tools) is capital and never used up; packaging and cleaning consumables are consumable stock assets. */
export function isConsumableSupply(item: SupplyItem): boolean {
  return (
    item.section === "packaging" ||
    (item.section === "cleaning" && !CLEANING_TOOL_IDS.includes(item.id))
  );
}

export function unitLabel(item: SupplyItem, n: number): string {
  return n === 1 ? item.unit[0] : item.unit[1];
}

/** What `packs` Market packs of a line are, in words: "1 pack of 12", "2 packs of 500", "1 bottle" (audit 2026-10-08: "Restock 1" hid that 1 was a case). */
export function packsText(item: SupplyItem, packs: number): string {
  if (item.packSize === 1) return `${packs} ${unitLabel(item, packs)}`;
  return `${packs} ${packs === 1 ? "pack" : "packs"} of ${item.packSize.toLocaleString("en-US")}`;
}

/** Units on hand and what was actually paid for exactly those units (whole cents). */
export type SupplyStock = { units: number; costBasis: number };

/** Lifetime figures per section — bookkeeping only, never money. */
export type SupplySectionTotals = {
  /** Cash spent on this section's purchases (the same amounts as their ledger entries). */
  spent: number;
  /** What the same packs cost at retail — the comparator for "saved vs. retail". */
  retailValue: number;
  purchases: number;
  /** Packaging only: units used by served Business orders, and their cost (COGS). */
  unitsUsed: number;
  usedCost: number;
};

export type BusinessSuppliesState = {
  stock: Partial<Record<SupplyId, SupplyStock>>;
  lifetime: Record<SupplySection, SupplySectionTotals>;
};

const ZERO_TOTALS: SupplySectionTotals = {
  spent: 0,
  retailValue: 0,
  purchases: 0,
  unitsUsed: 0,
  usedCost: 0,
};

export function defaultSuppliesState(): BusinessSuppliesState {
  return {
    stock: {},
    lifetime: {
      culinary: { ...ZERO_TOTALS },
      service: { ...ZERO_TOTALS },
      packaging: { ...ZERO_TOTALS },
      cleaning: { ...ZERO_TOTALS },
    },
  };
}

export const DEFAULT_SUPPLIES_STATE: BusinessSuppliesState = defaultSuppliesState();

const wholeNonNegative = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

/**
 * The ONE migration for `business.supplies` (SaveManager.load). A save from
 * before supplies existed opens with empty stock. A stored state keeps every
 * known item and total. Unknown item ids are dropped (they could never be
 * shown or used), and any malformed number becomes 0, so stock and money
 * can never be negative.
 */
export function migrateBusinessSuppliesState(stored: unknown): BusinessSuppliesState {
  const out = defaultSuppliesState();
  if (!stored || typeof stored !== "object") return out;
  const raw = stored as Partial<BusinessSuppliesState>;
  if (raw.stock && typeof raw.stock === "object") {
    for (const [id, entry] of Object.entries(raw.stock)) {
      if (!BY_ID.has(id) || !entry || typeof entry !== "object") continue;
      const units = wholeNonNegative((entry as SupplyStock).units);
      if (units === 0) continue;
      out.stock[id as SupplyId] = {
        units,
        costBasis: wholeNonNegative((entry as SupplyStock).costBasis),
      };
    }
  }
  if (raw.lifetime && typeof raw.lifetime === "object") {
    for (const section of RESTAURANT_SUPPLY_SECTION_ORDER) {
      const t = (raw.lifetime as Partial<Record<SupplySection, Partial<SupplySectionTotals>>>)[
        section
      ];
      if (!t || typeof t !== "object") continue;
      out.lifetime[section] = {
        spent: wholeNonNegative(t.spent),
        retailValue: wholeNonNegative(t.retailValue),
        purchases: wholeNonNegative(t.purchases),
        unitsUsed: wholeNonNegative(t.unitsUsed),
        usedCost: wholeNonNegative(t.usedCost),
      };
    }
  }
  return out;
}
