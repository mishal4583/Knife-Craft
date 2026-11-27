/**
 * The Festival Competition's pictures (public/festival, cut by scripts/make-festival-assets.py from the developer's Codex art) and the names its
 * words use. Rival chefs use the game's own portraits (game/chefArt.ts). Every picture the festival names is listed here (ALL_ART), and
 * festival-save-qa checks that each one exists and that no other file is shipped.
 */
import type { FoodId } from "@/game/festival/types";

export const festivalUrl = (name: string) => `${import.meta.env.BASE_URL}festival/${name}.webp`;
export const gameUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;

/** The customers drawn in four moods, each one person. */
export const PEOPLE = [
  "elderly-woman",
  "office-man",
  "student-woman",
  "tourist-man",
  "teen-girl",
  "family-dad",
] as const;
export const MOODS = ["happy", "neutral", "impatient", "excited"] as const;
export type Mood = (typeof MOODS)[number];
export const personUrl = (look: number, mood: Mood) =>
  festivalUrl(`people/${PEOPLE[look % PEOPLE.length]}-${mood}`);

/** The mood a waiting customer shows for the patience left (0-1). */
export const moodFor = (left: number): Mood =>
  left > 0.6 ? "happy" : left > 0.3 ? "neutral" : "impatient";

export const FOOD_NAMES: Record<FoodId, string> = {
  bun: "Bun",
  patty: "Patty",
  chicken: "Chicken",
  veggie: "Veggie",
  cheese: "Cheese",
  lettuce: "Lettuce",
  tomato: "Tomato",
  onion: "Onion",
  pickles: "Pickles",
  ketchup: "Ketchup",
  mustard: "Mustard",
  fries: "Fries",
  cola: "Cola",
  lemonade: "Lemonade",
  milkshake: "Shake",
};

export const STATION_ART = {
  grill: "burger/station-grill",
  board: "burger/station-board",
  plate: "burger/station-plate",
  fryer: "burger/station-fryer",
  bin: "burger/station-bin",
  blender: "burger/station-blender",
} as const;

/** The drink machine's taps (the shake has the blender instead) and what stands under them. */
export const TAP_ART: Partial<Record<FoodId, string>> = {
  cola: "burger/tap-cola",
  lemonade: "burger/tap-lemonade",
};
export const CUP_EMPTY = "burger/cup-empty";

/** A finished side or drink. */
export const SIDE_ART: Partial<Record<FoodId, string>> = {
  fries: "burger/fries",
  cola: "burger/cup-cola",
  lemonade: "burger/cup-lemonade",
  milkshake: "burger/milkshake",
};

/** What the player taps to start something. */
export const TRAY_ART: Partial<Record<FoodId, string>> = {
  bun: "burger/tray-bun",
  patty: "burger/tray-patty",
  chicken: "burger/tray-chicken",
  veggie: "burger/tray-veggie",
  cheese: "burger/tray-cheese",
  lettuce: "burger/tray-lettuce",
  tomato: "burger/tray-tomato",
  onion: "burger/tray-onion",
  pickles: "burger/tray-pickles",
  ketchup: "burger/tray-ketchup",
  mustard: "burger/tray-mustard",
  fries: "burger/tray-fries",
};

/** The little pictures under the burger in an order bubble: the meat and each topping. */
export const CHIP_ART: Partial<Record<FoodId, string>> = {
  patty: "burger/chip-patty",
  chicken: "burger/chip-chicken",
  veggie: "burger/chip-veggie",
  cheese: "burger/chip-cheese",
  lettuce: "burger/chip-lettuce",
  tomato: "burger/chip-tomato",
  onion: "burger/chip-onion",
  pickles: "burger/chip-pickles",
  ketchup: "burger/chip-ketchup",
  mustard: "burger/chip-mustard",
};

/** The meats on the grill, in each state. */
export const MEATS: readonly FoodId[] = ["patty", "chicken", "veggie"];
export const MEAT_STATES = ["raw", "cooking", "cooked", "burnt"] as const;
export type MeatState = (typeof MEAT_STATES)[number];
export const meatArt = (item: FoodId, state: MeatState) => `burger/meat-${item}-${state}`;

export const BASKET_ART = {
  raw: "burger/basket-raw",
  golden: "burger/basket-golden",
  burnt: "burger/basket-burnt",
} as const;

export type LayerId = Exclude<FoodId, "fries" | "cola" | "lemonade" | "milkshake"> | "lid";
/**
 * The burger's layers. Each picture is a square with the layer in its middle, as wide as the square. `height` is how much of a 400-high square the
 * layer covers, and `thick` how far it raises what is stacked on it (tuned so the burgers look like burgers: scratch stack tests, 2026-11-27).
 */
export const LAYERS: Record<LayerId, { height: number; thick: number }> = {
  bun: { height: 170, thick: 46 },
  patty: { height: 256, thick: 56 },
  chicken: { height: 188, thick: 44 },
  veggie: { height: 247, thick: 56 },
  cheese: { height: 181, thick: 12 },
  pickles: { height: 183, thick: 16 },
  onion: { height: 163, thick: 14 },
  tomato: { height: 168, thick: 28 },
  lettuce: { height: 163, thick: 22 },
  ketchup: { height: 54, thick: 14 },
  mustard: { height: 42, thick: 14 },
  lid: { height: 265, thick: 96 },
};
export const layerArt = (id: LayerId) => `burger/layer-${id}`;

export const BACKDROP_ART = { wide: "burger/backdrop-wide", tall: "burger/backdrop-tall" } as const;
/** Where the wooden counter's front edge is painted on the upright backdrop, as a part of its height. */
export const TALL_COUNTER_EDGE = 0.445;

export const UI_ART = {
  trophy: "ui/trophy",
  firstTrophy: "ui/first-trophy",
  confetti: "ui/confetti",
  star: "ui/star",
  hand: "ui/hand",
  heartFull: "ui/heart-full",
  heartEmpty: "ui/heart-empty",
  ready: "ui/ready",
  warning: "ui/warning",
  trash: "ui/trash",
  lock: "ui/lock",
  smoke: "ui/smoke",
  patience: "ui/power-patience",
  instant: "ui/power-instant",
  freeze: "ui/power-freeze",
} as const;

const peopleArt = PEOPLE.flatMap((who) => MOODS.map((mood) => `people/${who}-${mood}`));
const kitchenArt: readonly string[] = [
  ...Object.values(STATION_ART),
  ...Object.values(TAP_ART),
  CUP_EMPTY,
  ...Object.values(SIDE_ART),
  ...Object.values(TRAY_ART),
  ...Object.values(CHIP_ART),
  ...MEATS.flatMap((m) => MEAT_STATES.map((s) => meatArt(m, s))),
  ...Object.values(BASKET_ART),
  ...(Object.keys(LAYERS) as LayerId[]).map(layerArt),
];

/** Every picture in public/festival. */
export const ALL_ART: readonly string[] = [
  ...kitchenArt,
  ...Object.values(BACKDROP_ART),
  ...Object.values(UI_ART),
  ...peopleArt,
];

/** What a round shows, fetched before its first customer. */
export const ROUND_ART: readonly string[] = [
  ...kitchenArt,
  ...peopleArt,
  UI_ART.star,
  UI_ART.hand,
  UI_ART.heartFull,
  UI_ART.heartEmpty,
  UI_ART.ready,
  UI_ART.warning,
  UI_ART.trash,
  UI_ART.lock,
  UI_ART.smoke,
  UI_ART.patience,
  UI_ART.instant,
  UI_ART.freeze,
  UI_ART.firstTrophy,
  UI_ART.confetti,
];
