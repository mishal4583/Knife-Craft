/**
 * HOW A FOOD IS DRAWN WHILE IT HAS NO PAINTED PICTURE (developer 2026-11-28: the fourteen new festivals are playable before their art): a shape and
 * its colours, drawn by DrawnFood.tsx for the pan, the plate, the order bubble and the cooker. A food that the Burger kit painted (festivalArt.ts) is
 * not listed: it uses its picture. festival-menus-qa: every food of every menu has a picture or a look, never both. The pictures to paint are
 * listed in docs/planning/FESTIVAL-ALL-ART-CODEX-PROMPTS-2026-11-28.md.
 */
import type { FoodId } from "@/game/festival/types";

export type Shape =
  // bases
  | "flat"
  | "slice"
  | "plate"
  | "bowl"
  | "board"
  // cooked things
  | "disc"
  | "fillet"
  | "sausages"
  | "ribs"
  | "prawns"
  | "balls"
  | "cubes"
  | "strips"
  | "egg"
  | "waffle"
  | "noodles"
  | "tubes"
  | "squares"
  | "muffin"
  | "croissant"
  | "swirl"
  | "crepe"
  | "claw"
  // toppings
  | "rounds"
  | "rings"
  | "leaves"
  | "shreds"
  | "beads"
  | "mound"
  | "spears"
  | "crumbs"
  | "wedge"
  // sides
  | "sticks"
  | "chips"
  | "pyramids"
  | "cookie"
  // sauces and drinks
  | "bottle"
  | "cup";

export type Look = {
  shape: Shape;
  color: string;
  /** A second colour: a skin, a centre, a crust. */
  accent?: string;
  /** What it looks like raw, for the things that are cooked. */
  raw?: string;
};

const look = (shape: Shape, color: string, accent?: string, raw?: string): Look => ({
  shape,
  color,
  ...(accent ? { accent } : {}),
  ...(raw ? { raw } : {}),
});

export const FOOD_LOOKS: Readonly<Record<FoodId, Look>> = {
  // pizza
  dough: look("flat", "#f3dca8", "#e0b977"),
  pepperoni: look("rounds", "#b8331f", "#8c1f12"),
  mushroom: look("rounds", "#d9bd97", "#9a734d"),
  ham: look("strips", "#ec9aa0", "#c96a74"),
  mozzarella: look("rounds", "#fff7dd", "#f0dfae"),
  olives: look("rings", "#2f3320", "#59603a"),
  pepper: look("strips", "#3f9a3a", "#d8432a"),
  basil: look("leaves", "#3f8f34", "#2b6b24"),
  "pizza-sauce": look("bottle", "#c8321d"),
  pesto: look("bottle", "#5e8f2a"),
  wings: look("sticks", "#d8902f", "#a85d14", "#efd6a8"),
  limonata: look("cup", "#f6c244"),
  // sandwich
  toast: look("slice", "#e7b563", "#a96a24"),
  bacon: look("strips", "#a8432a", "#f2c8a2", "#e8a49a"),
  "fried-egg": look("egg", "#fffdf4", "#f5b31c", "#f4e8b0"),
  cucumber: look("rounds", "#cfe9a0", "#4c8a2c"),
  mayo: look("bottle", "#f6efd2"),
  crisps: look("chips", "#f0c34a", "#c98e1e", "#f6e7b8"),
  "iced-tea": look("cup", "#b4621c"),
  "orange-juice": look("cup", "#f59a14"),
  smoothie: look("cup", "#c64f86"),
  // breakfast
  "breakfast-plate": look("plate", "#f7f2e8", "#d9b878"),
  pancake: look("disc", "#d99338", "#a8621c", "#f6e3ae"),
  waffle: look("waffle", "#d8942f", "#9a5d15", "#f2dc9c"),
  "french-toast": look("slice", "#d58a2c", "#8e5214", "#f3e0a6"),
  butter: look("wedge", "#ffe071", "#e8bd2c"),
  strawberry: look("beads", "#d9283a", "#8f1420"),
  banana: look("rounds", "#fbeaa8", "#d8b54a"),
  blueberry: look("beads", "#4256a8", "#26346e"),
  cream: look("mound", "#fffaf0", "#e8ddc8"),
  syrup: look("bottle", "#9a5312"),
  "choc-sauce": look("bottle", "#4e2a14"),
  "hash-browns": look("pyramids", "#d69a2e", "#9a6414", "#efd9a0"),
  coffee: look("cup", "#5a3116"),
  milk: look("cup", "#f6f1e6"),
  // street food
  flatbread: look("flat", "#e9c585", "#b9843c"),
  shawarma: look("strips", "#a5591f", "#e0a050", "#e3a58e"),
  kofta: look("sausages", "#7a3b17", "#4e220b", "#c66f64"),
  halloumi: look("cubes", "#e9b45a", "#a86a1c", "#f8efd6"),
  "red-cabbage": look("shreds", "#7d2f7e", "#b35cb4"),
  tahini: look("bottle", "#d8bd86"),
  chilli: look("bottle", "#b3220f"),
  falafel: look("balls", "#9a6a24", "#5f3f12", "#a9b45a"),
  ayran: look("cup", "#eef0e8"),
  "mint-lemonade": look("cup", "#a5d65a"),
  tamarind: look("cup", "#7a3d1e"),
  // asian
  "rice-bowl": look("bowl", "#fbf8ef", "#a8322a"),
  teriyaki: look("cubes", "#8a3f16", "#c9762c", "#e6a890"),
  prawns: look("prawns", "#f08a52", "#c9501c", "#b9b4ae"),
  tofu: look("cubes", "#e9bd62", "#b07c20", "#f8f2de"),
  "spring-onion": look("rings", "#6fae3a", "#e4f2c4"),
  carrot: look("shreds", "#f08a1e", "#c8640c"),
  edamame: look("beads", "#78b53c", "#4c8620"),
  kimchi: look("shreds", "#cf4519", "#f29a3c"),
  soy: look("bottle", "#3a1d0c"),
  sriracha: look("bottle", "#d23312"),
  "spring-rolls": look("sausages", "#d9942c", "#9a5f12", "#f0e2b8"),
  "green-tea": look("cup", "#9fb83a"),
  lychee: look("cup", "#f3c9d4"),
  "bubble-tea": look("cup", "#b98a5e"),
  // healthy
  "salad-bowl": look("bowl", "#7fb43f", "#e8dcc2"),
  salmon: look("fillet", "#ec8248", "#f8c7a0", "#f2a184"),
  feta: look("crumbs", "#fdfaf0", "#ddd6c2"),
  avocado: look("wedge", "#b6d35a", "#476a1c"),
  sweetcorn: look("beads", "#f5c822", "#c99a0c"),
  "lemon-dressing": look("bottle", "#e8d646"),
  "yogurt-dressing": look("bottle", "#f1ece0"),
  "sweet-fries": look("sticks", "#e0701c", "#a84a0c", "#f0a45c"),
  water: look("cup", "#bfe4f2"),
  "green-smoothie": look("cup", "#6d9f2c"),
  // bbq
  "bbq-board": look("board", "#a8672e", "#6e3d14"),
  sausage: look("sausages", "#8e3d18", "#541f08", "#d98a7c"),
  ribs: look("ribs", "#7f2c10", "#f0dcc0", "#cf7a6e"),
  steak: look("fillet", "#6e2f16", "#3f180a", "#c4463e"),
  slaw: look("shreds", "#dfe9b8", "#a7c46a"),
  beans: look("beads", "#a8481e", "#702a0c"),
  "bbq-sauce": look("bottle", "#6e2410"),
  "hot-sauce": look("bottle", "#c4280e"),
  wedges: look("sticks", "#e2a53a", "#a86c14", "#f3e0a8"),
  "root-beer": look("cup", "#4a2210"),
  // pasta
  "pasta-bowl": look("bowl", "#f6efe0", "#2f6f8f"),
  spaghetti: look("noodles", "#f0c64a", "#c99a1e", "#f6e6a4"),
  penne: look("tubes", "#eec04a", "#bd8c18", "#f4e29c"),
  ravioli: look("squares", "#eec55c", "#c0902a", "#f5e4a8"),
  marinara: look("mound", "#c2301a", "#8a1c0c"),
  parmesan: look("crumbs", "#f8e7a8", "#d8bd62"),
  meatballs: look("balls", "#7e3718", "#4c1c08"),
  alfredo: look("bottle", "#f3e8c4"),
  "garlic-bread": look("slice", "#e0a63c", "#8e9a3a", "#f2dca0"),
  "grape-juice": look("cup", "#6a2670"),
  // seafood
  "rice-plate": look("plate", "#fbf7e6", "#4a86a8"),
  "white-fish": look("fillet", "#efd9ac", "#b9813a", "#e9e2da"),
  lemon: look("rounds", "#fbe34a", "#d8b60c"),
  tartar: look("bottle", "#eae4bc"),
  "garlic-butter": look("bottle", "#f2cc45"),
  calamari: look("rings", "#e2a844", "#f8e4b4", "#ecdfd6"),
  "coconut-water": look("cup", "#e6efe2"),
  // bakery
  "cake-plate": look("plate", "#fff2f4", "#d98aa0"),
  muffin: look("muffin", "#c8812c", "#7d4a14", "#f2d89c"),
  croissant: look("croissant", "#d88f2a", "#8f5410", "#f4e2b0"),
  "cinnamon-roll": look("swirl", "#d2913c", "#7a3f10", "#f3dfb2"),
  icing: look("mound", "#ffd9e4", "#f0a8bd"),
  "choc-chips": look("beads", "#4a2410", "#2c1406"),
  almonds: look("crumbs", "#e9c690", "#a97a3c"),
  sprinkles: look("crumbs", "#f0559a", "#3fa0e8"),
  caramel: look("bottle", "#c8811c"),
  cookies: look("cookie", "#d1923c", "#4a2410", "#f0d9a4"),
  "hot-chocolate": look("cup", "#6b3a1e"),
  // indian
  thali: look("plate", "#d9dde0", "#8d949a"),
  dosa: look("crepe", "#d58d26", "#8e5410", "#f5ead0"),
  paratha: look("disc", "#d99a3e", "#8e5a16", "#f4e4bc"),
  "paneer-tikka": look("cubes", "#e0761c", "#8e3c08", "#f8e6cc"),
  "potato-masala": look("mound", "#eab52a", "#a8780c"),
  coriander: look("leaves", "#4f9a34", "#31701f"),
  curd: look("mound", "#fbfaf2", "#dedac8"),
  "mint-chutney": look("bottle", "#4f8a20"),
  "tamarind-chutney": look("bottle", "#6e2e12"),
  samosa: look("pyramids", "#d89a30", "#9a6210", "#f1e0b4"),
  "masala-chai": look("cup", "#bd8250"),
  "nimbu-pani": look("cup", "#e4e86a"),
  lassi: look("cup", "#f8e7bc"),
  // mexican
  tortilla: look("flat", "#eed49a", "#c99a52"),
  "carne-asada": look("strips", "#74311a", "#c06a2c", "#c4554a"),
  "fajita-veg": look("strips", "#e0551c", "#3f9a2c", "#9acb62"),
  salsa: look("mound", "#d0301a", "#f0a02c"),
  guacamole: look("mound", "#8cab32", "#587a14"),
  jalapeno: look("rings", "#3f8a24", "#cfe49a"),
  "sour-cream": look("bottle", "#f8f5e8"),
  nachos: look("chips", "#eaa82a", "#b87408", "#f5dd9c"),
  horchata: look("cup", "#eadfc6"),
  "lime-soda": look("cup", "#b8e25a"),
  "agua-fresca": look("cup", "#e8546a"),
  // gourmet and the championship
  "fine-plate": look("plate", "#fbfbf8", "#b8b2a4"),
  scallops: look("balls", "#e2a35a", "#f8e6cc", "#f4ece2"),
  mash: look("mound", "#f8e9b0", "#d8c270"),
  asparagus: look("spears", "#6a9a2c", "#436a14"),
  "cherry-tomato": look("balls", "#e0321c", "#9a1808"),
  microgreens: look("leaves", "#79b83c", "#4f8a1c"),
  jus: look("bottle", "#4e140c"),
  "truffle-fries": look("sticks", "#e8b534", "#6e5412", "#f5e4a6"),
  "champion-plate": look("plate", "#fff6d6", "#d8a420"),
  wagyu: look("fillet", "#7a2c18", "#e8b49a", "#c43a3c"),
  lobster: look("claw", "#e2481a", "#a82a08", "#6e5a52"),
  "glazed-chicken": look("fillet", "#c9711c", "#8a420a", "#f0bfa6"),
  "gold-glaze": look("bottle", "#e0ac14"),
  "golden-fries": look("sticks", "#f2c12a", "#c28e08", "#f8e8a8"),
};
