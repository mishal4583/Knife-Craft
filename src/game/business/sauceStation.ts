/**
 * SAUCE STATION — the rules of the "Mix it, whisk it, bottle it" mini-game (developer 2026-11-08; plan: docs/planning/SAUCE-STATION-MINIGAME-PLAN-2026-11-08.md).
 *
 * STAGE 1 MIX: a sauce is asked for. Pour pantry bottles and the dish's own produce into the bowl until the live colour matches the target swatch and the
 * thickness is in the band; then blend it by circling in the green speed zone (a dressing is EMULSIFIED this way: pour the oil too fast before it is
 * blended and it SPLITS). STAGE 2 BOTTLE: the batch is poured into bottles on a belt: hold to pour, release at the fill line; a spill wastes sauce.
 *
 * Pure rules: no I/O, no unseeded randomness (a small seeded generator), and NEVER any money, stock or ledger entry: the pantry is game-only and free
 * (the 57-ingredient registry has no oil, vinegar or cream, and stays the one source of ingredient definitions). The effects are the stars, Hype
 * (`addHype`, the same table as the other games), the Saucier pins and the Sauce Shelf (a bottle per sauce mastered with three stars).
 *
 * Every sauce is DEFINED by a reference recipe and its target colour and thickness are computed from that recipe, so every sauce can be made exactly
 * (the QA also searches it). State lives in `business.sauceStation` (optional; absent = nothing done yet) read through `sauceStationOf`.
 */
import type { SaveData } from "../SaveManager";
import { addHype } from "../restaurant/secondFloor";
import { HYPE_BY_STARS } from "./fridgeSort";
import {
  deltaE,
  hexToRgb,
  matchPercent,
  mixColors,
  rgbToHex,
  type ColorPart,
  type Rgb,
} from "./sauceColor";

// ── When it opens ────────────────────────────────────────────────────────────

/** The first level (developer 2026-11-10: before Level 20; Level 7 brings the Simple Garden Salad, so its dressings are the first two sauces). The shelf grows through the early levels: see SAUCES. */
export const SAUCE_FIRST_LEVEL = 7;
/** The sauce of a player's very first round. */
export const FIRST_SAUCE_ID = "lemon-dressing";
export const isSauceStationOpen = (level: number): boolean => level >= SAUCE_FIRST_LEVEL;
/** Rounds a day (the "Sauces 1/3" tag); after them, free practice. */
/**
 * The Sauce Station is a daily duty from this level (developer 2026-11-11: "I played more than 10 levels and the Sauce Station is still not mandatory"):
 * one round (or the Prep Cook, or the ad skip) before the day's first service. Level 7 to 9 are its free discovery.
 */
export const SAUCE_REQUIRED_FROM = 10;
export const MAX_ROUNDS_PER_DAY = 3;
/** The rewarded ad (developer 2026-11-10): three more rounds today, once a business day, only after the free ones are used. No money. */
export const SAUCE_AD_ROUNDS = 3;
export const MAX_PINS = 12;
export const PERFECTS_PER_PIN = 3;

// ── The pantry (game-only, free, never in the inventory) ─────────────────────

export type PantryKind = "oil" | "acid" | "liquid" | "cream" | "jar" | "spice" | "cube" | "produce";

export type PantryItem = {
  id: string;
  name: string;
  icon: string;
  kind: PantryKind;
  /** The colour it gives a mix, how strongly (0 = clear, 1 = a pure dye), how thick it is (0 = water, 1 = paste) and how much one scoop is. */
  color: string;
  tint: number;
  visc: number;
  scoop: number;
  /** Its picture: a cell of one of the art sheets (`public/business/sauce/<sheet>.webp`). */
  art: { sheet: string; cols: number; rows: number; cell: number };
};

const bottle = (cell: number) => ({ sheet: "pantry-bottles", cols: 3, rows: 2, cell });
const jar = (cell: number) => ({ sheet: "pantry-jars", cols: 3, rows: 2, cell });
const carton = (cell: number) => ({ sheet: "pantry-cartons", cols: 3, rows: 2, cell });
const extra = (cell: number) => ({ sheet: "pantry-extras", cols: 3, rows: 1, cell });
const spice = (cell: number) => ({ sheet: "spice-bowls", cols: 4, rows: 2, cell });
const heap = (cell: number) => ({ sheet: "produce-heaps", cols: 5, rows: 3, cell });

const P = (
  id: string,
  name: string,
  icon: string,
  kind: PantryKind,
  color: string,
  tint: number,
  visc: number,
  art: PantryItem["art"],
  scoop = 1,
): PantryItem => ({ id, name, icon, kind, color, tint, visc, scoop, art });

export const PANTRY: readonly PantryItem[] = [
  // Oils and vinegars
  P("olive-oil", "Olive oil", "🫒", "oil", "#B9A233", 0.35, 0.2, bottle(0)),
  P("veg-oil", "Vegetable oil", "🌻", "oil", "#E3C75A", 0.3, 0.2, bottle(1)),
  P("sesame-oil", "Sesame oil", "🥜", "oil", "#8A4A1A", 0.5, 0.22, bottle(2)),
  P("white-vinegar", "White vinegar", "🧪", "acid", "#E8F0E8", 0.05, 0.02, bottle(3)),
  P("wine-vinegar", "Wine vinegar", "🍷", "acid", "#6B1F2A", 0.5, 0.03, bottle(4)),
  P("soy", "Soy sauce", "🍶", "liquid", "#2A1409", 0.95, 0.1, bottle(5)),
  // Liquids and creams
  P("water", "Water", "💧", "liquid", "#BFE3EE", 0.02, 0, carton(5)),
  P("stock", "Stock", "🍲", "liquid", "#C9A36A", 0.5, 0.08, carton(2)),
  P("stock-cube", "Stock cube", "🧊", "cube", "#8F6B3E", 0.8, 0.5, extra(1)),
  P("milk", "Milk", "🥛", "cream", "#F7F4EA", 0.6, 0.1, carton(1)),
  P("cream", "Cream", "🍶", "cream", "#FBF6E6", 0.7, 0.35, carton(0)),
  P("coconut-milk", "Coconut milk", "🥥", "cream", "#F3EEDD", 0.65, 0.3, carton(3)),
  P("yogurt", "Yogurt", "🥣", "cream", "#F6F3EA", 0.65, 0.55, jar(5)),
  P("honey", "Honey", "🍯", "jar", "#E2A12A", 0.9, 0.75, jar(4)),
  P("passata", "Tomato passata", "🍅", "liquid", "#B3261B", 0.95, 0.45, carton(4)),
  P("chilli-sauce", "Chilli sauce", "🌶️", "liquid", "#C21F14", 0.95, 0.4, extra(0)),
  // Jars
  P("mayo", "Mayonnaise", "🥚", "jar", "#F4EACB", 0.75, 0.85, jar(0)),
  P("mustard", "Mustard", "🟡", "jar", "#D9AE22", 0.95, 0.7, jar(1)),
  P("tahini", "Tahini", "🫙", "jar", "#D8BC8C", 0.8, 0.8, jar(2)),
  P("peanut-butter", "Peanut butter", "🥜", "jar", "#A8743A", 0.9, 0.9, jar(3)),
  // Spices (a quarter of a scoop)
  P("salt", "Salt", "🧂", "spice", "#F5F5F0", 0.02, 0, spice(0), 0.25),
  P("pepper", "Pepper", "⚫", "spice", "#2B2B2B", 0.8, 0, spice(1), 0.25),
  P("paprika", "Paprika", "🌶️", "spice", "#C8431B", 1, 0, spice(2), 0.25),
  P("turmeric", "Turmeric", "🟠", "spice", "#E8A91B", 1, 0, spice(3), 0.25),
  P("cumin", "Cumin", "🟤", "spice", "#8A5B2E", 0.9, 0, spice(4), 0.25),
  P("curry-powder", "Curry powder", "🍛", "spice", "#CB8B25", 0.95, 0, spice(5), 0.25),
  P("chilli-flakes", "Chilli flakes", "🔴", "spice", "#B52214", 0.9, 0, spice(6), 0.25),
  P("sugar", "Sugar", "🍬", "spice", "#FAF8F0", 0.02, 0, spice(7), 0.25),
  // The dish's own produce (chopped heaps, with the real ingredient's name)
  P("tomato", "Tomato", "🍅", "produce", "#D8432A", 0.85, 0.5, heap(0)),
  P("onion", "Onion", "🧅", "produce", "#EBD9B2", 0.5, 0.35, heap(1)),
  P("garlic", "Garlic", "🧄", "produce", "#EFE3C0", 0.5, 0.55, heap(2)),
  P("chilli", "Chilli", "🌶️", "produce", "#C4281A", 0.8, 0.45, heap(3)),
  P("lemon", "Lemon", "🍋", "produce", "#F1DE6A", 0.6, 0.15, heap(4)),
  P("lime", "Lime", "🟢", "produce", "#9CCB4A", 0.6, 0.15, heap(5)),
  P("ginger", "Ginger", "🫚", "produce", "#D9B66A", 0.6, 0.6, heap(6)),
  P("cilantro", "Cilantro", "🌿", "produce", "#4F8A2B", 0.9, 0.4, heap(7)),
  P("basil", "Basil", "🌿", "produce", "#3E7A22", 0.95, 0.45, heap(8)),
  P("parsley", "Parsley", "🌿", "produce", "#55902F", 0.9, 0.4, heap(9)),
  P("mango", "Mango", "🥭", "produce", "#F2A42A", 0.9, 0.55, heap(10)),
  P("pineapple", "Pineapple", "🍍", "produce", "#F4D24A", 0.8, 0.4, heap(11)),
  P("corn", "Corn", "🌽", "produce", "#F0C52A", 0.85, 0.4, heap(12)),
  P("avocado", "Avocado", "🥑", "produce", "#8DB04A", 0.85, 0.7, heap(13)),
  P("potato", "Potato", "🥔", "produce", "#E9D79A", 0.6, 0.5, heap(14)),
];
export const PANTRY_BY_ID: Readonly<Record<string, PantryItem>> = Object.fromEntries(
  PANTRY.map((p) => [p.id, p]),
);

// ── The sauces ───────────────────────────────────────────────────────────────

export type Tool = "stir" | "whisk";
export type SauceDef = {
  id: string;
  name: string;
  icon: string;
  /** The level it is first asked for. */
  unlock: number;
  /** A dressing: oil poured too fast before it is blended SPLITS it. */
  emulsify: boolean;
  tool: Tool;
  vessel: "bowl" | "pan";
  /** Chunky sauces (salsas, guacamole) show floating pieces of these. */
  chunks?: readonly string[];
  /** The bottle it goes in (B03's six shapes: 0 classic, 1 squeeze, 2 wide jar, 3 swing-top, 4 cruet, 5 tasting) and its label shape (B05: 0-3). */
  bottle: number;
  label: number;
  /** The reference recipe: pantry id and scoops. */
  recipe: readonly (readonly [string, number])[];
};

const S = (
  id: string,
  name: string,
  icon: string,
  unlock: number,
  tool: Tool,
  vessel: "bowl" | "pan",
  bottleShape: number,
  recipe: readonly (readonly [string, number])[],
  opts: { emulsify?: boolean; chunks?: readonly string[]; label?: number } = {},
): SauceDef => ({
  id,
  name,
  icon,
  unlock,
  tool,
  vessel,
  emulsify: opts.emulsify ?? false,
  ...(opts.chunks ? { chunks: opts.chunks } : {}),
  bottle: bottleShape,
  label: opts.label ?? 0,
  recipe,
});

/** The 24 sauces, in the order of the Sauce Shelf (the icon of each is that cell of `sauce-icons.webp`). */
export const SAUCES: readonly SauceDef[] = [
  S("tomato-sauce", "Tomato Sauce", "🍅", 7, "stir", "pan", 0, [
    ["passata", 5],
    ["tomato", 1],
    ["onion", 1],
    ["basil", 1],
  ]),
  S(
    "lemon-dressing",
    "Lemon Dressing",
    "🍋",
    7,
    "whisk",
    "bowl",
    4,
    [
      ["olive-oil", 3],
      ["lemon", 2],
      ["water", 1],
      ["mustard", 1],
      ["salt", 0.25],
    ],
    { emulsify: true },
  ),
  S(
    "vinaigrette",
    "Vinaigrette",
    "🫒",
    7,
    "whisk",
    "bowl",
    4,
    [
      ["olive-oil", 4],
      ["wine-vinegar", 2],
      ["mustard", 1],
      ["honey", 1],
    ],
    { emulsify: true },
  ),
  S("french-onion-base", "French Onion Base", "🧅", 10, "stir", "pan", 2, [
    ["stock", 3],
    ["onion", 3],
    ["soy", 1],
    ["stock-cube", 1],
  ]),
  S("potato-veloute", "Potato Velouté", "🥔", 12, "whisk", "pan", 2, [
    ["milk", 3],
    ["potato", 3],
    ["cream", 1],
    ["stock", 1],
  ]),
  S("bechamel", "Béchamel", "🥛", 13, "whisk", "pan", 3, [
    ["milk", 5],
    ["cream", 2],
    ["salt", 0.25],
  ]),
  S("basil-pesto", "Basil Pesto", "🌿", 13, "stir", "bowl", 2, [
    ["basil", 4],
    ["olive-oil", 3],
    ["garlic", 1],
    ["salt", 0.25],
  ]),
  S(
    "mayonnaise",
    "Mayonnaise",
    "🥚",
    17,
    "whisk",
    "bowl",
    1,
    [
      ["veg-oil", 5],
      ["milk", 1],
      ["lemon", 1],
      ["mustard", 1],
      ["salt", 0.25],
    ],
    { emulsify: true },
  ),
  S(
    "garlic-aioli",
    "Garlic Aioli",
    "🧄",
    18,
    "whisk",
    "bowl",
    1,
    [
      ["veg-oil", 4],
      ["garlic", 2],
      ["lemon", 1],
      ["mustard", 1],
    ],
    { emulsify: true },
  ),
  S(
    "caesar-dressing",
    "Caesar Dressing",
    "🥗",
    20,
    "whisk",
    "bowl",
    4,
    [
      ["olive-oil", 3],
      ["yogurt", 2],
      ["garlic", 1],
      ["lemon", 1],
      ["mustard", 1],
    ],
    { emulsify: true },
  ),
  S("ranch", "Ranch", "🥛", 29, "whisk", "bowl", 1, [
    ["yogurt", 4],
    ["milk", 2],
    ["parsley", 1],
    ["garlic", 1],
  ]),
  S("curry-paste", "Curry Paste", "🍛", 31, "stir", "bowl", 2, [
    ["curry-powder", 1],
    ["turmeric", 0.5],
    ["garlic", 2],
    ["ginger", 2],
    ["chilli", 1],
    ["olive-oil", 1],
  ]),
  S("onion-tomato-masala", "Onion Tomato Masala", "🍅", 31, "stir", "pan", 2, [
    ["tomato", 3],
    ["onion", 2],
    ["ginger", 1],
    ["paprika", 1],
    ["cumin", 0.5],
    ["turmeric", 0.5],
  ]),
  S("garlic-ginger-paste", "Garlic & Ginger Paste", "🫚", 32, "stir", "bowl", 2, [
    ["garlic", 4],
    ["ginger", 3],
    ["veg-oil", 1],
    ["salt", 0.25],
  ]),
  S("mango-chutney", "Mango Chutney", "🥭", 33, "stir", "pan", 2, [
    ["mango", 4],
    ["onion", 1],
    ["chilli", 1],
    ["sugar", 1],
    ["wine-vinegar", 1],
    ["turmeric", 0.25],
  ]),
  S("mint-cilantro-chutney", "Mint & Cilantro Chutney", "🌿", 34, "stir", "bowl", 0, [
    ["cilantro", 4],
    ["lime", 2],
    ["chilli", 1],
    ["water", 1],
    ["salt", 0.25],
  ]),
  S("herb-tomato-base", "Herb & Tomato Base", "🍅", 39, "stir", "pan", 2, [
    ["parsley", 2],
    ["tomato", 3],
    ["garlic", 1],
    ["olive-oil", 1],
    ["passata", 1],
  ]),
  S(
    "fresh-tomato-salsa",
    "Fresh Tomato Salsa",
    "🍅",
    40,
    "stir",
    "bowl",
    2,
    [
      ["tomato", 4],
      ["onion", 1],
      ["chilli", 1],
      ["cilantro", 1],
      ["lime", 1],
    ],
    { chunks: ["tomato", "onion"] },
  ),
  S(
    "corn-tomato-salsa",
    "Corn & Tomato Salsa",
    "🌽",
    40,
    "stir",
    "bowl",
    2,
    [
      ["corn", 3],
      ["tomato", 3],
      ["onion", 1],
      ["lime", 1],
    ],
    { chunks: ["corn", "tomato"] },
  ),
  S(
    "pineapple-salsa",
    "Pineapple Salsa",
    "🍍",
    44,
    "stir",
    "bowl",
    2,
    [
      ["pineapple", 4],
      ["onion", 1],
      ["chilli", 1],
      ["lime", 1],
      ["cilantro", 1],
    ],
    { chunks: ["pineapple", "chilli"] },
  ),
  S(
    "guacamole",
    "Guacamole",
    "🥑",
    46,
    "stir",
    "bowl",
    2,
    [
      ["avocado", 4],
      ["lime", 1],
      ["onion", 1],
      ["tomato", 1],
      ["salt", 0.25],
    ],
    { chunks: ["avocado", "tomato"] },
  ),
  S(
    "chimichurri",
    "Chimichurri",
    "🌿",
    50,
    "whisk",
    "bowl",
    5,
    [
      ["parsley", 3],
      ["olive-oil", 3],
      ["wine-vinegar", 1],
      ["garlic", 1],
      ["chilli", 1],
    ],
    { emulsify: true },
  ),
  S("sweet-chili", "Sweet Chili", "🌶️", 58, "stir", "pan", 3, [
    ["chilli-sauce", 3],
    ["sugar", 1],
    ["white-vinegar", 1],
    ["garlic", 1],
    ["water", 2],
  ]),
  S("thai-basil-sauce", "Thai Basil Sauce", "🌿", 70, "stir", "pan", 0, [
    ["soy", 2],
    ["basil", 3],
    ["garlic", 1],
    ["chilli", 1],
    ["sugar", 0.5],
    ["stock", 1],
  ]),
];
export const SAUCE_BY_ID: Readonly<Record<string, SauceDef>> = Object.fromEntries(
  SAUCES.map((s) => [s.id, s]),
);
export const sauceIndex = (id: string): number => SAUCES.findIndex((s) => s.id === id);
export const unlockedSauces = (level: number): SauceDef[] =>
  SAUCES.filter((s) => level >= s.unlock);

// ── Mixing ───────────────────────────────────────────────────────────────────

/** What is in the bowl: scoops of each pantry id. */
export type Scoops = Readonly<Record<string, number>>;

export const volumeOf = (scoops: Scoops): number =>
  Object.values(scoops).reduce((s, v) => s + v, 0);

/** The colour and the plain thickness (volume-weighted) of what is in the bowl. */
export function mixOf(scoops: Scoops): { color: Rgb; hex: string; thick: number; volume: number } {
  const parts: ColorPart[] = [];
  let vol = 0;
  let visc = 0;
  for (const [id, v] of Object.entries(scoops)) {
    const it = PANTRY_BY_ID[id];
    if (!it || !(v > 0)) continue;
    parts.push({ color: hexToRgb(it.color), volume: v, tint: it.tint });
    vol += v;
    visc += v * it.visc;
  }
  const color = mixColors(parts);
  return { color, hex: rgbToHex(color), thick: vol > 0 ? visc / vol : 0, volume: vol };
}

/** Blending thickens a dressing (an emulsion is thicker than its parts) and chunks read thicker. */
export const EMULSION_THICKEN = 0.18;
export const CHUNKY_THICKEN = 0.05;
export function thickOf(scoops: Scoops, sauce: SauceDef, mixed: number): number {
  const base = mixOf(scoops).thick;
  return (
    base +
    (sauce.emulsify ? EMULSION_THICKEN * Math.min(1, mixed) : 0) +
    (sauce.chunks ? CHUNKY_THICKEN : 0)
  );
}

export const recipeScoops = (sauce: SauceDef): Scoops =>
  Object.fromEntries(sauce.recipe.map(([id, n]) => [id, n]));

/** The target of a sauce: the colour and the thickness of its reference recipe (so every sauce can be made exactly). */
export function targetOf(sauce: SauceDef): {
  color: Rgb;
  hex: string;
  thick: number;
  band: readonly [number, number];
} {
  const rs = recipeScoops(sauce);
  const m = mixOf(rs);
  const thick = thickOf(rs, sauce, 1);
  return {
    color: m.color,
    hex: m.hex,
    thick,
    band: [Math.max(0, thick - 0.09), Math.min(1, thick + 0.09)],
  };
}

/** The scoops of a sauce's pantry: its own items, then distractors (more of them in the harder tiers), in a seeded order. */
export function pantryFor(
  sauce: SauceDef,
  tierNumber: number,
  seed: number,
): { pantry: PantryItem[]; produce: PantryItem[] } {
  const need = sauce.recipe.map(([id]) => PANTRY_BY_ID[id]!);
  const own = need.filter((i) => i.kind !== "produce");
  const ownProduce = need.filter((i) => i.kind === "produce");
  const rand = rng(seed);
  const extras = shuffled(
    PANTRY.filter((p) => p.kind !== "produce" && !own.includes(p)),
    rand,
  );
  const wantPantry = [8, 9, 10, 10][Math.min(3, tierNumber - 1)]!;
  const pantry = shuffled([...own, ...extras.slice(0, Math.max(0, wantPantry - own.length))], rand);
  const extraProduce = shuffled(
    PANTRY.filter((p) => p.kind === "produce" && !ownProduce.includes(p)),
    rand,
  ).slice(0, tierNumber >= 3 ? 2 : tierNumber >= 2 ? 1 : 0);
  return { pantry, produce: [...ownProduce, ...extraProduce] };
}

// ── Difficulty by level ──────────────────────────────────────────────────────

export type SauceTier = {
  from: number;
  /** The most scoops the bowl holds. */
  cap: number;
  timeMs: number;
  /** "pips" = the reference recipe is shown, "list" = its ingredients only, "color" = the target only, "swatch" = the swatch alone. */
  help: "pips" | "list" | "color" | "swatch";
  /** How many times a round the Taste button shows the match (Infinity = always). */
  tastes: number;
  /** The colour tolerance is widened by this factor. */
  tolerance: number;
  /** Oil poured within 2 s that splits an unblended dressing. */
  oilLimit: number;
  /** Bottles on the belt, and how wide the fill target is (a share of a bottle). */
  bottles: number;
  window: number;
};

/**
 * Tighter clocks and colour tolerance (developer 2026-11-12, player reviews: "increase the toughness of the mini games"): the first tier is 65 s at x1.3 (was 75 s at
 * x1.5), then 62 / 58 / 54 s (was 70 / 65 / 60); the tiers still only get harder (sauce-station-qa D19).
 */
export const SAUCE_TIERS: readonly SauceTier[] = [
  {
    from: SAUCE_FIRST_LEVEL,
    cap: 9,
    timeMs: 65_000,
    help: "pips",
    tastes: Infinity,
    tolerance: 1.3,
    oilLimit: 2,
    bottles: 3,
    window: 0.25,
  },
  {
    from: 40,
    cap: 10,
    timeMs: 62_000,
    help: "list",
    tastes: 5,
    tolerance: 1.1,
    oilLimit: 1.4,
    bottles: 4,
    window: 0.18,
  },
  {
    from: 55,
    cap: 12,
    timeMs: 58_000,
    help: "color",
    tastes: 3,
    tolerance: 1,
    oilLimit: 1,
    bottles: 5,
    window: 0.13,
  },
  {
    from: 75,
    cap: 12,
    timeMs: 54_000,
    help: "swatch",
    tastes: 2,
    tolerance: 1,
    oilLimit: 1,
    bottles: 5,
    window: 0.1,
  },
];
export function tierAt(level: number): SauceTier {
  let t = SAUCE_TIERS[0]!;
  for (const x of SAUCE_TIERS) if (level >= x.from) t = x;
  return t;
}
export const tierNumberAt = (level: number): number => SAUCE_TIERS.indexOf(tierAt(level)) + 1;

// ── Blending (the whisk and the spoon) ───────────────────────────────────────

/** Turns per second that are in the green zone. */
export const WHISK_ZONE: Readonly<Record<Tool, readonly [number, number]>> = {
  whisk: [1.3, 2.6],
  stir: [0.6, 1.6],
};
export const BLEND_RATE = 0.35;
export const FAST_LOSS = 0.2;
export const BLENDED = 0.9;

export type Speed = "slow" | "zone" | "fast";
export function speedOf(tool: Tool, omega: number): Speed {
  const [lo, hi] = WHISK_ZONE[tool];
  return omega < lo ? "slow" : omega > hi ? "fast" : "zone";
}

/** The blend after `dt` seconds at `omega` turns a second: it rises in the zone, holds when slow and falls when too fast. */
export function blendStep(blend: number, tool: Tool, omega: number, dt: number): number {
  const s = speedOf(tool, omega);
  const next =
    s === "zone" ? blend + BLEND_RATE * dt : s === "fast" ? blend - FAST_LOSS * dt : blend;
  return Math.min(1, Math.max(0, next));
}

/**
 * An unblended dressing SPLITS when more oil than the tier allows goes in within two seconds while the blend is under 0.4: the blend drops to 0 and
 * the oil floats. `recentOil` = scoops of oil poured in the last two seconds.
 */
export function splits(
  recentOil: number,
  blend: number,
  tier: SauceTier,
  sauce: SauceDef,
): boolean {
  return sauce.emulsify && blend < 0.4 && recentOil > tier.oilLimit;
}

// ── Grading a mix ────────────────────────────────────────────────────────────

export type ThickState = "in" | "near" | "out";
export const thickState = (thick: number, band: readonly [number, number]): ThickState =>
  thick >= band[0] && thick <= band[1]
    ? "in"
    : thick >= band[0] - 0.1 && thick <= band[1] + 0.1
      ? "near"
      : "out";

export type MixResult = {
  de: number;
  match: number;
  colorStars: 0 | 1 | 2 | 3;
  thick: ThickState;
  stars: 0 | 1 | 2 | 3;
};

export function gradeMix(
  scoops: Scoops,
  sauce: SauceDef,
  blend: number,
  splitCount: number,
  tier: SauceTier,
): MixResult {
  const t = targetOf(sauce);
  const m = mixOf(scoops);
  const de = deltaE(m.color, t.color);
  const k = tier.tolerance;
  const colorStars = de <= 6 * k ? 3 : de <= 12 * k ? 2 : de <= 20 * k ? 1 : 0;
  const th = thickState(thickOf(scoops, sauce, blend), t.band);
  const blended = blend >= BLENDED;
  let stars: 0 | 1 | 2 | 3 = 0;
  if (colorStars >= 1 && blend >= 0.5) stars = 1;
  if (colorStars >= 2 && th !== "out" && blended) stars = 2;
  if (colorStars === 3 && th === "in" && blended && splitCount === 0) stars = 3;
  if (splitCount > 0 && stars === 3) stars = 2;
  return { de, match: matchPercent(de), colorStars, thick: th, stars };
}

// ── Bottling ─────────────────────────────────────────────────────────────────

/** Where the fill line is on a bottle (a share of its capacity). */
export const FILL_LINE = 0.9;
/** How fast it fills (bottle capacities a second): it eases in over the first second and a thick sauce is slower. */
export function pourRate(heldMs: number, thick: number): number {
  const ease = Math.min(1, 0.3 + heldMs / 1100);
  return 0.62 * ease * (1 - 0.4 * Math.min(1, thick));
}
/** What a released bottle scores: 1 on the line, less the further it is (0 at the edge of the tier's window); more than full is a spill. */
export function bottleScore(fill: number, window: number): { score: number; spill: number } {
  const spill = Math.max(0, fill - 1);
  const miss = Math.abs(fill - FILL_LINE);
  const score = spill > 0 ? Math.max(0, 0.25 - spill) : Math.max(0, 1 - miss / window);
  return { score, spill };
}
export type BottleRound = {
  scores: readonly number[];
  spill: number;
  bottles: number;
  filled: number;
};
/** Stars of the bottling: every bottle close to the line and nothing spilled = 3. */
export function bottleStars(r: BottleRound): 0 | 1 | 2 | 3 {
  if (r.scores.length === 0) return 0;
  const avg = r.scores.reduce((s, v) => s + v, 0) / r.bottles;
  if (avg >= 0.85 && r.spill <= 0.05 && r.filled >= r.bottles) return 3;
  if (avg >= 0.6 && r.filled >= r.bottles - 1) return 2;
  return avg >= 0.3 ? 1 : 0;
}

/** The round's stars: both stages 3 (or the mix 3 and the bottling 2) = 3; a skipped bottling can give at most 2. */
export function overallStars(mix: 0 | 1 | 2 | 3, bottling: 0 | 1 | 2 | 3 | null): 0 | 1 | 2 | 3 {
  if (bottling === null) return Math.min(2, mix) as 0 | 1 | 2;
  if (mix === 3 && bottling >= 2) return 3;
  return Math.min(2, Math.round((mix + bottling) / 2)) as 0 | 1 | 2;
}
export const SCORE_PER_STAR_POINT = 100;
export const roundScore = (de: number, mixSeconds: number, bottleAvg: number): number =>
  Math.round(Math.max(0, 600 - de * 15) + Math.max(0, 300 - mixSeconds * 4) + bottleAvg * 400);

// ── The seeded generator ─────────────────────────────────────────────────────

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let k = out.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1));
    [out[k], out[j]] = [out[j]!, out[k]!];
  }
  return out;
}
const hashOf = (...parts: number[]): number => {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h ^= p >>> 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

// ── State ────────────────────────────────────────────────────────────────────

export type SauceStationState = {
  /** One bit per sauce (the Sauce Shelf's order): mastered with three stars. */
  mastered?: number;
  best?: number;
  stars?: number;
  /** Three-star rounds (every 3 earn a pin). */
  perfect?: number;
  rounds?: number;
  streak?: number;
  /** The business day of `today`, and the rounds finished that day. */
  day?: number;
  today?: number;
  /** The rewarded ad's extra rounds (SAUCE_AD_ROUNDS) and the business day they were given for (one ad a day; a new day starts at 3 again). */
  extra?: number;
  extraDay?: number;
  /** Bit 1: the how-to tour was seen. */
  howto?: number;
  /** The business day the daily duty was met without a played round (the Prep Cook, or the ad skip). */
  doneDay?: number;
};

const whole = (v: unknown, max = Number.MAX_SAFE_INTEGER) =>
  Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));
const ALL_BITS = 2 ** SAUCES.length - 1;

export function sauceStationOf(save: SaveData): SauceStationState {
  const raw = save.business.sauceStation;
  return {
    mastered: whole(raw?.mastered, ALL_BITS),
    best: whole(raw?.best),
    stars: whole(raw?.stars),
    perfect: whole(raw?.perfect),
    rounds: whole(raw?.rounds),
    streak: whole(raw?.streak, 999),
    day: whole(raw?.day),
    today: whole(raw?.today, 99),
    extra: whole(raw?.extra, SAUCE_AD_ROUNDS),
    extraDay: whole(raw?.extraDay),
    howto: whole(raw?.howto, 1),
    doneDay: whole(raw?.doneDay),
  };
}
function withState(save: SaveData, state: SauceStationState): SaveData {
  return { ...save, business: { ...save.business, sauceStation: state } };
}
export const howtoSeen = (save: SaveData): boolean => (sauceStationOf(save).howto! & 1) !== 0;
export function withHowtoSeen(save: SaveData): SaveData {
  if (howtoSeen(save)) return save;
  return withState(save, {
    ...(save.business.sauceStation ?? {}),
    ...sauceStationOf(save),
    howto: 1,
  });
}
export const isMastered = (save: SaveData, sauceId: string): boolean => {
  const i = sauceIndex(sauceId);
  return i >= 0 && (sauceStationOf(save).mastered! & (1 << i)) !== 0;
};
export const masteredCount = (save: SaveData): number => {
  let n = 0;
  const m = sauceStationOf(save).mastered!;
  for (let i = 0; i < SAUCES.length; i++) if (m & (1 << i)) n++;
  return n;
};
export const pinsOf = (save: SaveData): number =>
  Math.min(MAX_PINS, Math.floor(sauceStationOf(save).perfect! / PERFECTS_PER_PIN));
export const hasPrepCook = (save: SaveData): boolean =>
  save.business.staff?.hiredRoles?.includes("prep-cook") ?? false;

/** The rounds today's reward covers: the free three, plus the ad's three when today's ad was watched. */
export function roundsAllowed(save: SaveData): number {
  const st = sauceStationOf(save);
  const day = save.business.calendar.businessDay;
  return MAX_ROUNDS_PER_DAY + (st.extraDay === day ? st.extra! : 0);
}
/** Rounds the player can still play for a reward today. */
export function roundsLeft(save: SaveData, level: number): number {
  if (!isSauceStationOpen(level)) return 0;
  const st = sauceStationOf(save);
  const day = save.business.calendar.businessDay;
  return Math.max(0, roundsAllowed(save) - (st.day === day ? st.today! : 0));
}
/** The "Sauces 1/3" tag. */
export function roundsTag(save: SaveData, level: number): { done: number; total: number } {
  const st = sauceStationOf(save);
  const day = save.business.calendar.businessDay;
  const done = st.day === day ? st.today! : 0;
  return { done, total: isSauceStationOpen(level) ? roundsAllowed(save) : 0 };
}
/** Whether the rewarded-ad offer may show: open, every free round used, and today's ad not watched yet. Never needed to progress. */
export function canOfferRoundsAd(save: SaveData, level: number): boolean {
  if (!isSauceStationOpen(level) || roundsLeft(save, level) > 0) return false;
  const st = sauceStationOf(save);
  return !(st.extraDay === save.business.calendar.businessDay && st.extra! > 0);
}
/** Grants the ad's extra rounds for today (only on the ad's `rewarded` state). Once a day: a second call changes nothing. No money, no stock, no ledger. */
export function withAdRounds(save: SaveData, level: number): SaveData {
  if (!canOfferRoundsAd(save, level)) return save;
  return withState(save, {
    ...(save.business.sauceStation ?? {}),
    ...sauceStationOf(save),
    extra: SAUCE_AD_ROUNDS,
    extraDay: save.business.calendar.businessDay,
  });
}

/**
 * The sauce of today's next round: one the player has unlocked, preferring one not mastered yet, seeded by the day and the round (so the same round is
 * the same sauce). Practice asks for any unlocked sauce by id instead.
 */
export function sauceOfTheDay(save: SaveData, level: number): SauceDef {
  const open = unlockedSauces(level);
  const st = sauceStationOf(save);
  const day = save.business.calendar.businessDay;
  const round = st.day === day ? st.today! : 0;
  // The very first round (developer 2026-11-10, plan FIRST-20-LEVELS-ENGAGEMENT-PLAN §4): always the Lemon Dressing: one pour, one whisk, no
  // tricks, so a new player wins once without reading anything.
  if ((st.rounds ?? 0) === 0) {
    const first = open.find((s) => s.id === FIRST_SAUCE_ID);
    if (first) return first;
  }
  const fresh = open.filter((s) => !isMastered(save, s.id));
  const pool = fresh.length > 0 ? fresh : open;
  const rand = rng(hashOf(day, round, level, st.rounds ?? 0));
  return pool[Math.floor(rand() * pool.length)]!;
}
export const roundSeed = (save: SaveData, level: number, salt = 0): number =>
  hashOf(save.business.calendar.businessDay, sauceStationOf(save).rounds ?? 0, level, salt);

// ── Finishing a round ────────────────────────────────────────────────────────

export type RoundOutcome = {
  sauceId: string;
  stars: 0 | 1 | 2 | 3;
  mixStars: 0 | 1 | 2 | 3;
  bottleStars: 0 | 1 | 2 | 3 | null;
  score: number;
  /** "Practice" rounds score and show stars but give nothing and keep nothing. */
  practice?: boolean;
};
export type RoundEffects = {
  hype: number;
  pin: boolean;
  newBest: boolean;
  streak: number;
  mastered: boolean;
};
export const NO_EFFECTS: RoundEffects = {
  hype: 0,
  pin: false,
  newBest: false,
  streak: 0,
  mastered: false,
};

/**
 * Applies a finished round: one more round today, the best score, the stars, the perfect rounds and the streak, the sauce mastered when it earned three
 * stars, and the Hype. Practice changes nothing. NEVER touches credits, inventory or the ledger.
 */
export function finishRound(
  save: SaveData,
  o: RoundOutcome,
): { save: SaveData; effects: RoundEffects } {
  if (o.practice) return { save, effects: NO_EFFECTS };
  const st = sauceStationOf(save);
  const day = save.business.calendar.businessDay;
  const perfect = st.perfect! + (o.stars === 3 ? 1 : 0);
  const pin =
    Math.min(MAX_PINS, Math.floor(perfect / PERFECTS_PER_PIN)) >
    Math.min(MAX_PINS, Math.floor(st.perfect! / PERFECTS_PER_PIN));
  const i = sauceIndex(o.sauceId);
  const wasMastered = i >= 0 && (st.mastered! & (1 << i)) !== 0;
  const mastered = o.stars === 3 && i >= 0 && !wasMastered;
  const newBest = o.score > st.best!;
  const streak = o.stars === 3 ? st.streak! + 1 : 0;
  const next: SauceStationState = {
    ...(save.business.sauceStation ?? {}),
    mastered: mastered ? st.mastered! | (1 << i) : st.mastered!,
    best: newBest ? o.score : st.best!,
    stars: st.stars! + o.stars,
    perfect,
    rounds: st.rounds! + 1,
    streak,
    day,
    today: (st.day === day ? st.today! : 0) + 1,
    howto: st.howto!,
  };
  const hype = HYPE_BY_STARS[o.stars];
  let out = withState(save, next);
  if (hype > 0) out = addHype(out, hype);
  return { save: out, effects: { hype, pin, newBest, streak, mastered } };
}

/** Today's duty is met: a rewarded round was played, or the Prep Cook / the ad skip covered it. */
export function sauceDutyDone(save: SaveData): boolean {
  const st = sauceStationOf(save);
  const day = save.business.calendar.businessDay;
  return st.doneDay === day || (st.day === day && st.today! > 0);
}
/** The Sauce Station is a duty now: from SAUCE_REQUIRED_FROM, once a business day, until it is done. */
export const sauceDue = (save: SaveData, level: number): boolean =>
  level >= SAUCE_REQUIRED_FROM && isSauceStationOpen(level) && !sauceDutyDone(save);
/** Marks today's duty met with no stars, Hype, pins, mastery or round count. No money, stock or ledger. */
export function coverSauceToday(save: SaveData): SaveData {
  if (sauceDutyDone(save)) return save;
  return withState(save, {
    ...(save.business.sauceStation ?? {}),
    ...sauceStationOf(save),
    doneDay: save.business.calendar.businessDay,
  });
}
/** The Prep Cook makes a batch on his own: it meets today's duty and counts as nothing else (no stars, Hype, pins, mastery or day count). */
export const autoSauce = (save: SaveData): SaveData => coverSauceToday(save);

// ── What the screen asks of the app ──────────────────────────────────────────

export type SauceStationAction =
  | { kind: "finish"; outcome: RoundOutcome }
  | { kind: "start"; sauceId: string; practice: boolean }
  | { kind: "skip" }
  | { kind: "auto" }
  | { kind: "howto" };
export type SauceStationResult = { ok: true; effects: RoundEffects } | { ok: false };
