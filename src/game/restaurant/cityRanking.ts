/**
 * CITY RANKING (developer 2026-10-09): "add some mock restaurants and
 * implement a ranking — gradually progress to the top 1 restaurant after
 * completing the campaign."
 *
 * The city's restaurant guide: 49 made-up rival restaurants and the
 * player's. A restaurant's standing is its reputation in points. The
 * player's comes from the campaign services it has completed
 * (`REPUTATION_PER_LEVEL` each, 10,000 at Level 250), plus its Endless
 * stars after that. Each rival is passed by completing one particular
 * level — early ones come quickly, the last ones slowly — and the top
 * restaurant only at Level 250, so finishing the campaign is #1.
 *
 * Pure and derived from the save: nothing is stored, nothing moves money.
 */
import type { SaveData } from "../SaveManager";
import { LAST_CAMPAIGN_LEVEL } from "./restaurantProgression";

export const REPUTATION_PER_LEVEL = 40;
/** Endless stars add a little reputation after the campaign (you are #1 by then). */
export const REPUTATION_PER_ENDLESS_STAR = 5;
/** How quickly the early rivals fall (> 1: early ones come faster, the top ones slower). */
const PASS_CURVE = 1.35;

export type Rival = {
  id: string;
  name: string;
  emoji: string;
  cuisine: string;
  district: string;
};

/** Weakest first: RIVALS[0] is passed first, the last one (the city's best) at Level 250. */
const RIVAL_LIST: readonly Rival[] = [
  {
    id: "corner-toast",
    name: "Corner Toast Co.",
    emoji: "🍞",
    cuisine: "Café",
    district: "Old Market",
  },
  {
    id: "noodle-nook",
    name: "Noodle Nook",
    emoji: "🍜",
    cuisine: "Noodles",
    district: "Station Row",
  },
  { id: "sunny-side", name: "Sunny Side Diner", emoji: "🍳", cuisine: "Diner", district: "Harbor" },
  {
    id: "pita-pocket",
    name: "The Pita Pocket",
    emoji: "🥙",
    cuisine: "Street food",
    district: "Old Market",
  },
  {
    id: "bean-there",
    name: "Bean There Café",
    emoji: "☕",
    cuisine: "Café",
    district: "University",
  },
  { id: "salad-days", name: "Salad Days", emoji: "🥗", cuisine: "Salads", district: "Riverside" },
  {
    id: "the-soup-pot",
    name: "The Soup Pot",
    emoji: "🍲",
    cuisine: "Soups",
    district: "Old Market",
  },
  { id: "taco-hut", name: "Taco Hut", emoji: "🌮", cuisine: "Mexican", district: "Station Row" },
  {
    id: "mamas-kitchen",
    name: "Mama's Kitchen",
    emoji: "🥘",
    cuisine: "Home cooking",
    district: "Hillside",
  },
  {
    id: "curry-corner",
    name: "Curry Corner",
    emoji: "🍛",
    cuisine: "Indian",
    district: "Spice Lane",
  },
  {
    id: "little-bistro",
    name: "The Little Bistro",
    emoji: "🥖",
    cuisine: "French",
    district: "Riverside",
  },
  {
    id: "wok-n-roll",
    name: "Wok 'n' Roll",
    emoji: "🥡",
    cuisine: "Chinese",
    district: "Station Row",
  },
  {
    id: "green-fork",
    name: "The Green Fork",
    emoji: "🌿",
    cuisine: "Vegetarian",
    district: "University",
  },
  {
    id: "pasta-fresca",
    name: "Pasta Fresca",
    emoji: "🍝",
    cuisine: "Italian",
    district: "Hillside",
  },
  { id: "harbor-grill", name: "Harbor Grill", emoji: "🐟", cuisine: "Seafood", district: "Harbor" },
  {
    id: "olive-and-fig",
    name: "Olive & Fig",
    emoji: "🫒",
    cuisine: "Mediterranean",
    district: "Riverside",
  },
  { id: "seoul-food", name: "Seoul Food", emoji: "🥢", cuisine: "Korean", district: "Spice Lane" },
  {
    id: "bangkok-bowl",
    name: "Bangkok Bowl",
    emoji: "🍤",
    cuisine: "Thai",
    district: "Station Row",
  },
  {
    id: "the-copper-pan",
    name: "The Copper Pan",
    emoji: "🍽️",
    cuisine: "Bistro",
    district: "Old Market",
  },
  { id: "casa-verde", name: "Casa Verde", emoji: "🌶️", cuisine: "Mexican", district: "Hillside" },
  {
    id: "maple-and-sage",
    name: "Maple & Sage",
    emoji: "🍁",
    cuisine: "Farm-to-table",
    district: "Hillside",
  },
  {
    id: "spice-route",
    name: "The Spice Route",
    emoji: "🧆",
    cuisine: "Middle Eastern",
    district: "Spice Lane",
  },
  {
    id: "luigis",
    name: "Luigi's Trattoria",
    emoji: "🍕",
    cuisine: "Italian",
    district: "Old Market",
  },
  {
    id: "blue-anchor",
    name: "The Blue Anchor",
    emoji: "⚓",
    cuisine: "Seafood",
    district: "Harbor",
  },
  { id: "zen-garden", name: "Zen Garden", emoji: "🍣", cuisine: "Japanese", district: "Riverside" },
  {
    id: "the-rustic-table",
    name: "The Rustic Table",
    emoji: "🪵",
    cuisine: "Country",
    district: "Hillside",
  },
  {
    id: "saffron-house",
    name: "Saffron House",
    emoji: "🌼",
    cuisine: "Indian",
    district: "Spice Lane",
  },
  {
    id: "petit-jardin",
    name: "Le Petit Jardin",
    emoji: "🌷",
    cuisine: "French",
    district: "Riverside",
  },
  {
    id: "golden-ladle",
    name: "The Golden Ladle",
    emoji: "🥄",
    cuisine: "Soups & stews",
    district: "Old Market",
  },
  { id: "hanami", name: "Hanami", emoji: "🌸", cuisine: "Japanese", district: "University" },
  { id: "aegean-blue", name: "Aegean Blue", emoji: "🐙", cuisine: "Greek", district: "Harbor" },
  {
    id: "jade-dragon",
    name: "Jade Dragon",
    emoji: "🐉",
    cuisine: "Chinese",
    district: "Spice Lane",
  },
  {
    id: "hearth-and-ember",
    name: "Hearth & Ember",
    emoji: "🔥",
    cuisine: "Wood-fired",
    district: "Hillside",
  },
  {
    id: "la-cantina",
    name: "La Cantina Real",
    emoji: "🫔",
    cuisine: "Mexican",
    district: "Station Row",
  },
  {
    id: "the-orchard",
    name: "The Orchard Room",
    emoji: "🍎",
    cuisine: "Seasonal",
    district: "Riverside",
  },
  {
    id: "marigold",
    name: "Marigold",
    emoji: "🏵️",
    cuisine: "Modern Indian",
    district: "Spice Lane",
  },
  {
    id: "silver-birch",
    name: "Silver Birch",
    emoji: "🌲",
    cuisine: "Nordic",
    district: "University",
  },
  {
    id: "trattoria-sole",
    name: "Trattoria del Sole",
    emoji: "☀️",
    cuisine: "Italian",
    district: "Hillside",
  },
  {
    id: "kimchi-house",
    name: "Kimchi House",
    emoji: "🥬",
    cuisine: "Korean",
    district: "Station Row",
  },
  {
    id: "the-velvet-spoon",
    name: "The Velvet Spoon",
    emoji: "🍷",
    cuisine: "Fine dining",
    district: "Old Market",
  },
  {
    id: "lotus-and-lime",
    name: "Lotus & Lime",
    emoji: "🍋",
    cuisine: "Thai",
    district: "Riverside",
  },
  {
    id: "the-iron-chef",
    name: "The Iron Skillet",
    emoji: "🍳",
    cuisine: "Chef's table",
    district: "Harbor",
  },
  {
    id: "cedar-and-salt",
    name: "Cedar & Salt",
    emoji: "🧂",
    cuisine: "Coastal",
    district: "Harbor",
  },
  {
    id: "chez-margaux",
    name: "Chez Margaux",
    emoji: "🥂",
    cuisine: "French",
    district: "Riverside",
  },
  {
    id: "kaiseki-mori",
    name: "Kaiseki Mori",
    emoji: "🍱",
    cuisine: "Japanese",
    district: "University",
  },
  {
    id: "the-grand-larder",
    name: "The Grand Larder",
    emoji: "🏛️",
    cuisine: "Grand brasserie",
    district: "Old Market",
  },
  { id: "aurora", name: "Aurora", emoji: "✨", cuisine: "Tasting menu", district: "Hillside" },
  {
    id: "the-crown-kitchen",
    name: "The Crown Kitchen",
    emoji: "👑",
    cuisine: "Modern classics",
    district: "Riverside",
  },
  {
    id: "maison-lumiere",
    name: "Maison Lumière",
    emoji: "🌟",
    cuisine: "Haute cuisine",
    district: "Old Market",
  },
];

/** The level whose completion passes each rival: strictly rising, the last at Level 250. */
function passLevels(count: number): number[] {
  const levels: number[] = [];
  for (let k = 0; k < count; k++) {
    const curve = Math.round(LAST_CAMPAIGN_LEVEL * Math.pow((k + 1) / count, PASS_CURVE));
    levels.push(Math.min(LAST_CAMPAIGN_LEVEL, Math.max(curve, (levels[k - 1] ?? 0) + 1)));
  }
  levels[count - 1] = LAST_CAMPAIGN_LEVEL;
  return levels;
}

export type RankedRival = Rival & {
  /** The rival's reputation (points). */
  reputation: number;
  /** Completing this campaign level passes it. */
  passedAtLevel: number;
};

const PASS_LEVELS = passLevels(RIVAL_LIST.length);

/** The city's other restaurants, weakest first. A rival sits just below the reputation its level brings. */
export const RIVALS: readonly RankedRival[] = RIVAL_LIST.map((r, k) => ({
  ...r,
  passedAtLevel: PASS_LEVELS[k]!,
  reputation: PASS_LEVELS[k]! * REPUTATION_PER_LEVEL - 10 - (k % 3) * 5,
}));

/** Every restaurant in the guide, the player's included. */
export const CITY_RESTAURANTS = RIVALS.length + 1;

/** Campaign services completed (distinct campaign levels). */
export function completedCampaignLevels(save: Pick<SaveData, "levelProgress">): number {
  return new Set(save.levelProgress.completedLevelIds.filter((id) => /^level-\d+$/.test(id))).size;
}

/** The player's reputation after `completed` campaign levels (and `endlessStars` after Level 250). */
export function reputationFor(completed: number, endlessStars = 0): number {
  return completed * REPUTATION_PER_LEVEL + endlessStars * REPUTATION_PER_ENDLESS_STAR;
}

export type CityRanking = {
  /** 1 = the city's best. */
  rank: number;
  total: number;
  reputation: number;
  /** The rival just above (the next to pass), or null at #1. */
  next: RankedRival | null;
  /** The rival just below (the last one passed), or null at the bottom. */
  passed: RankedRival | null;
  /** 0–1 of the way from the last rival passed to the next one. */
  fraction: number;
  /** The whole guide, best first; `player: true` marks the player's restaurant. */
  table: ReadonlyArray<{
    rank: number;
    reputation: number;
    player: boolean;
    rival: RankedRival | null;
  }>;
};

/** The guide after `completed` campaign levels. */
export function cityRankingAt(completed: number, endlessStars = 0): CityRanking {
  const reputation = reputationFor(completed, endlessStars);
  const above = RIVALS.filter((r) => r.reputation >= reputation);
  const below = RIVALS.filter((r) => r.reputation < reputation);
  const next = above[0] ?? null; // weakest of those still ahead
  const passed = below[below.length - 1] ?? null;
  const lo = passed?.reputation ?? 0;
  const fraction = next ? Math.min(1, Math.max(0, (reputation - lo) / (next.reputation - lo))) : 1;
  const rows = [
    ...RIVALS.map((r) => ({
      reputation: r.reputation,
      player: false,
      rival: r as RankedRival | null,
    })),
    { reputation, player: true, rival: null },
  ]
    // Best first; a tie goes to the rival (you pass it only by beating it).
    .sort((a, b) => b.reputation - a.reputation || Number(a.player) - Number(b.player))
    .map((row, i) => ({ ...row, rank: i + 1 }));
  return {
    rank: above.length + 1,
    total: CITY_RESTAURANTS,
    reputation,
    next,
    passed,
    fraction,
    table: rows,
  };
}

/** The save's city ranking. */
export function cityRanking(save: SaveData): CityRanking {
  return cityRankingAt(completedCampaignLevels(save), save.business.endlessStars?.total ?? 0);
}

/** What one more completed level changes: the old and new rank and the rivals passed. */
export function rankChange(
  before: Pick<SaveData, "levelProgress">,
  after: Pick<SaveData, "levelProgress">,
): { from: number; to: number; passed: RankedRival[] } | null {
  const a = completedCampaignLevels(before);
  const b = completedCampaignLevels(after);
  if (b <= a) return null;
  const from = cityRankingAt(a).rank;
  const to = cityRankingAt(b).rank;
  if (to >= from) return null;
  const passed = RIVALS.filter(
    (r) => r.reputation >= reputationFor(a) && r.reputation < reputationFor(b),
  ).reverse();
  return { from, to, passed };
}
