export type Knife = {
  id: string;
  name: string;
  tagline: string;
  traits: string[];
  stars: number;
  level: number;
  sharpness: number;
  weight: number;
  control: number;
  owned: boolean;
  unlockLevel?: number;
  price?: number;
  blade: string;
  handle: string;
};

export const KNIVES: Knife[] = [
  {
    id: "chef",
    name: "Chef's Knife",
    tagline: "The one you reach for",
    traits: ["Balanced", "Versatile", "Reliable"],
    stars: 5,
    level: 3,
    sharpness: 78,
    weight: 62,
    control: 84,
    owned: true,
    blade: "Carbon steel",
    handle: "Walnut",
  },
  {
    id: "santoku",
    name: "Santoku",
    tagline: "Three virtues, one blade",
    traits: ["Light", "Precise", "Quiet"],
    stars: 4,
    level: 2,
    sharpness: 84,
    weight: 44,
    control: 90,
    owned: true,
    blade: "Hammered steel",
    handle: "Magnolia",
  },
  {
    id: "nakiri",
    name: "Nakiri",
    tagline: "Made for the garden",
    traits: ["Flat edge", "Clean", "Vegetal"],
    stars: 4,
    level: 2,
    sharpness: 80,
    weight: 50,
    control: 88,
    owned: true,
    blade: "Blue steel",
    handle: "Chestnut",
  },
  {
    id: "paring",
    name: "Paring Knife",
    tagline: "Small work, close hands",
    traits: ["Nimble", "Detail", "Gentle"],
    stars: 3,
    level: 1,
    sharpness: 70,
    weight: 22,
    control: 94,
    owned: true,
    blade: "Stainless",
    handle: "Beech",
  },
  {
    id: "cleaver",
    name: "Cleaver",
    tagline: "Confident and heavy",
    traits: ["Weighty", "Bold", "Steady"],
    stars: 4,
    level: 1,
    sharpness: 66,
    weight: 92,
    control: 58,
    owned: false,
    unlockLevel: 9,
    price: 260,
    blade: "Forged iron",
    handle: "Rosewood",
  },
  {
    id: "boning",
    name: "Boning Knife",
    tagline: "Follows every curve",
    traits: ["Flexible", "Slim", "Patient"],
    stars: 3,
    level: 1,
    sharpness: 74,
    weight: 34,
    control: 80,
    owned: false,
    unlockLevel: 12,
    price: 320,
    blade: "Spring steel",
    handle: "Olive wood",
  },
  {
    id: "damascus",
    name: "Damascus Knife",
    tagline: "Folded sixty-four times",
    traits: ["Rippled", "Keen", "Heirloom"],
    stars: 5,
    level: 1,
    sharpness: 96,
    weight: 58,
    control: 92,
    owned: false,
    unlockLevel: 18,
    price: 980,
    blade: "Damascus fold",
    handle: "Burl & brass",
  },
];

export type Board = {
  id: string;
  name: string;
  material: string;
  note: string;
  owned: boolean;
  requirement?: string;
  price?: number;
  tone: [string, string, string];
};

export const BOARDS: Board[] = [
  {
    id: "oak",
    name: "Classic Oak",
    material: "European oak",
    note: "Where every chef begins.",
    owned: true,
    tone: ["#C69C6D", "#A97C50", "#8A6238"],
  },
  {
    id: "walnut",
    name: "Walnut",
    material: "Black walnut",
    note: "Deep grain, warm hush.",
    owned: true,
    tone: ["#8A5B36", "#6B4226", "#4B2D19"],
  },
  {
    id: "maple",
    name: "Maple",
    material: "Hard maple",
    note: "Pale and forgiving.",
    owned: true,
    tone: ["#E5C99A", "#D3B080", "#B99263"],
  },
  {
    id: "bamboo",
    name: "Bamboo",
    material: "Pressed bamboo",
    note: "Light as morning.",
    owned: false,
    requirement: "Prepare 10 salads",
    price: 140,
    tone: ["#DCC58F", "#C3A76B", "#A98F5E"],
  },
  {
    id: "olive",
    name: "Olive Wood",
    material: "Mediterranean olive",
    note: "No two boards alike.",
    owned: false,
    requirement: "Unlock at Chef Level 10",
    price: 240,
    tone: ["#D9C08A", "#B99A61", "#8F7642"],
  },
  {
    id: "marble",
    name: "Marble",
    material: "Carrara marble",
    note: "Cool under the palm.",
    owned: false,
    requirement: "Unlock at Chef Level 14",
    price: 420,
    tone: ["#F2EDE4", "#DCD5C8", "#BDB4A4"],
  },
  {
    id: "hinoki",
    name: "Japanese Hinoki",
    material: "Kiso cypress",
    note: "Smells faintly of rain.",
    owned: false,
    requirement: "Complete the Sushi chapter",
    price: 560,
    tone: ["#F0DFBC", "#DCC79C", "#C0A97C"],
  },
  {
    id: "festival",
    name: "Festival Board",
    material: "Painted birch",
    note: "Seasonal. Hand-painted.",
    owned: false,
    requirement: "Autumn Market event",
    price: 700,
    tone: ["#E0A96D", "#C9563D", "#7D9270"],
  },
];

export type Recipe = {
  id: string;
  name: string;
  category: string;
  difficulty: number;
  ingredients: string[];
  techniques: string[];
  best: number | null;
  done: boolean;
  emoji: string;
  note: string;
};

export const RECIPE_CATEGORIES = [
  "Breakfast",
  "Salads",
  "Vegetables",
  "Bakery",
  "Pasta",
  "Sushi",
  "Desserts",
];

export const RECIPES: Recipe[] = [
  {
    id: "garden-salad",
    name: "Garden Salad",
    category: "Salads",
    difficulty: 1,
    ingredients: ["Tomato", "Cucumber", "Onion"],
    techniques: ["Slice", "Dice"],
    best: 96,
    done: true,
    emoji: "🥗",
    note: "The café's quiet bestseller.",
  },
  {
    id: "morning-toast",
    name: "Morning Toast Board",
    category: "Breakfast",
    difficulty: 1,
    ingredients: ["Sourdough", "Avocado", "Radish"],
    techniques: ["Slice", "Fan"],
    best: 88,
    done: true,
    emoji: "🍞",
    note: "Served before the shutters go up.",
  },
  {
    id: "ratatouille",
    name: "Summer Ratatouille",
    category: "Vegetables",
    difficulty: 3,
    ingredients: ["Courgette", "Aubergine", "Tomato"],
    techniques: ["Slice", "Batonnet"],
    best: 74,
    done: false,
    emoji: "🍆",
    note: "Patience is the seasoning.",
  },
  {
    id: "herb-focaccia",
    name: "Herb Focaccia",
    category: "Bakery",
    difficulty: 2,
    ingredients: ["Rosemary", "Olive", "Sea salt"],
    techniques: ["Chiffonade"],
    best: null,
    done: false,
    emoji: "🫓",
    note: "Dimple the dough, then breathe.",
  },
  {
    id: "pasta-primavera",
    name: "Pasta Primavera",
    category: "Pasta",
    difficulty: 3,
    ingredients: ["Carrot", "Pepper", "Basil"],
    techniques: ["Julienne", "Chiffonade"],
    best: null,
    done: false,
    emoji: "🍝",
    note: "Locked until julienne is steady.",
  },
  {
    id: "sakura-roll",
    name: "Sakura Roll",
    category: "Sushi",
    difficulty: 4,
    ingredients: ["Cucumber", "Salmon", "Nori"],
    techniques: ["Precision slice"],
    best: null,
    done: false,
    emoji: "🍣",
    note: "One clean pull of the blade.",
  },
  {
    id: "fruit-tart",
    name: "Stone Fruit Tart",
    category: "Desserts",
    difficulty: 2,
    ingredients: ["Peach", "Fig", "Mint"],
    techniques: ["Fan slice"],
    best: 81,
    done: false,
    emoji: "🍑",
    note: "Thin enough to see light through.",
  },
];

export const MILESTONES = [
  { label: "Tomato slicing", done: true },
  { label: "Basic dicing", done: true },
  { label: "Garden Salad", done: true },
  { label: "Chiffonade", done: true },
  { label: "Julienne", done: false, at: "Level 8" },
  { label: "Nakiri mastery", done: false, at: "Level 10" },
  { label: "Walnut Board", done: false, at: "Level 11" },
  { label: "Sushi chapter", done: false, at: "Level 15" },
];

export const DECOR_CATEGORIES = [
  "Plants",
  "Lights",
  "Shelves",
  "Pans",
  "Clocks",
  "Curtains",
  "Coffee",
  "Herbs",
  "Signs",
  "Tableware",
];

export const DECOR_ITEMS = [
  { id: "d1", name: "Window Fern", cat: "Plants", price: 60, owned: true, glyph: "🌿" },
  { id: "d2", name: "Potted Basil", cat: "Herbs", price: 40, owned: true, glyph: "🪴" },
  { id: "d3", name: "Brass Pendant", cat: "Lights", price: 180, owned: false, glyph: "💡" },
  { id: "d4", name: "Copper Pan Set", cat: "Pans", price: 220, owned: false, glyph: "🍳" },
  { id: "d5", name: "Station Clock", cat: "Clocks", price: 130, owned: false, glyph: "🕰️" },
  { id: "d6", name: "Linen Curtain", cat: "Curtains", price: 90, owned: true, glyph: "🪟" },
  { id: "d7", name: "Espresso Bar", cat: "Coffee", price: 340, owned: false, glyph: "☕" },
  { id: "d8", name: "Painted Sign", cat: "Signs", price: 150, owned: false, glyph: "🪧" },
  { id: "d9", name: "Stoneware Set", cat: "Tableware", price: 200, owned: false, glyph: "🍽️" },
  { id: "d10", name: "Oak Shelf", cat: "Shelves", price: 110, owned: false, glyph: "🗄️" },
];

export const ACHIEVEMENTS = [
  { name: "First Slice", desc: "Cut your very first tomato", done: true },
  { name: "Steady Hand", desc: "Five perfect cuts in a row", done: true },
  { name: "Morning Regular", desc: "Prep on seven different days", done: true },
  { name: "Board Collector", desc: "Own five cutting boards", done: false },
  { name: "Quiet Mastery", desc: "Score 100% on any prep", done: false },
];

export type ScreenId =
  | "gameplay"
  | "kitchen"
  | "progression"
  | "workshop"
  | "knives"
  | "boards"
  | "recipes"
  | "recipe-detail"
  | "journal"
  | "daily"
  | "shop"
  | "decor"
  | "settings";