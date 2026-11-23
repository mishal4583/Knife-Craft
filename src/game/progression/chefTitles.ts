/**
 * THE CHEF'S TITLES (the "Chef Pride" plan, Phase 3a, developer 2026-11-23: "what kind of chef am I?").
 *
 * Six IDENTITIES, each with four earned tiers, valued from play the game already keeps (nothing here is bought, nothing pays money):
 *   Precision          perfect cuts, ever (chefRecord)
 *   Speed              plates at Clean or better finished under 30 s (chefRecord `quickClean`)
 *   Organizer          Fridge Sort crates finished with three stars (fridgeSort)
 *   Cleanliness        spotless services (restaurantRecord)
 *   Customer Favourite the restaurant's popularity, 0-100 (businessPopularity)
 *   Restaurateur       places climbed in the city ranking (cityRanking)
 *
 * They are registered as BADGE-ONLY achievements (`reward: 0`, ids `ach-chef-<identity>-<target>`, see achievements.ts), so they show in the Achievements list and
 * the Progress card without touching the achievement economy or the campaign money target. The title the player WEARS is derived, never stored: the highest tier
 * earned (ties by the fixed identity order above). Which titles were already announced is kept as short markers in `chefRecord.seen` (`title:<identity>:<target>`),
 * so each is announced once. Pure and deterministic: no clock, no random, no wallet.
 *
 * The tier names and thresholds are drafts for the developer to tune after the first release's data (Phase 7): change them in `CHEF_IDENTITIES` only.
 */
import type { SaveData } from "../SaveManager";
import { fridgeSortOf } from "../business/fridgeSort";
import { chefRecordOf, hasSeen, markSeen } from "../restaurant/chefRecord";
import { cityRanking } from "../restaurant/cityRanking";
import { restaurantRecordOf } from "../restaurant/serviceReport";

export type ChefIdentityId =
  "precision" | "speed" | "organizer" | "cleanliness" | "favourite" | "restaurateur";

export type ChefTier = { target: number; title: string };

export type ChefIdentity = {
  id: ChefIdentityId;
  /** "Precision": the identity's name. */
  name: string;
  icon: string;
  /** What the value counts ("perfect cuts"). */
  unit: string;
  /** The achievement group it lists under. */
  group: "Restaurant" | "Kitchen" | "Service" | "Business";
  /** One short line for the Achievements card ("Land 100 perfect cuts."). */
  describe: (target: number) => string;
  /** Four tiers, easiest first. */
  tiers: readonly [ChefTier, ChefTier, ChefTier, ChefTier];
  value: (save: SaveData) => number;
};

/** The Progress card and the Kitchen chip open with this level (the plates before it are the first lessons). */
export const CHEF_TITLES_FROM_LEVEL = 3;

export const CHEF_IDENTITIES: readonly ChefIdentity[] = [
  {
    id: "precision",
    name: "Precision",
    icon: "🔪",
    unit: "perfect cuts",
    group: "Kitchen",
    describe: (t) => `Land ${t} perfect cuts.`,
    tiers: [
      { target: 25, title: "Steady Hand" },
      { target: 100, title: "Precision Chef" },
      { target: 300, title: "Master of the Edge" },
      { target: 800, title: "Knife Legend" },
    ],
    value: (s) => chefRecordOf(s).perfectCuts,
  },
  {
    id: "speed",
    name: "Speed",
    icon: "⚡",
    unit: "quick plates",
    group: "Kitchen",
    describe: (t) => `Finish ${t} Clean plates in under 30 seconds.`,
    tiers: [
      { target: 10, title: "Quick Hands" },
      { target: 40, title: "Line Sprinter" },
      { target: 120, title: "Speed Chef" },
      { target: 300, title: "Lightning Chef" },
    ],
    value: (s) => chefRecordOf(s).quickClean,
  },
  {
    id: "organizer",
    name: "Organizer",
    icon: "📦",
    unit: "perfect crates",
    group: "Business",
    describe: (t) => `Finish ${t} Fridge Sort crates with three stars.`,
    tiers: [
      { target: 5, title: "Tidy Shelves" },
      { target: 20, title: "Stock Keeper" },
      { target: 60, title: "Master Organizer" },
      { target: 150, title: "Pantry Legend" },
    ],
    value: (s) => fridgeSortOf(s).perfect ?? 0,
  },
  {
    id: "cleanliness",
    name: "Cleanliness",
    icon: "✨",
    unit: "spotless services",
    group: "Service",
    describe: (t) => `Finish ${t} spotless services.`,
    tiers: [
      { target: 5, title: "Clean Counter" },
      { target: 20, title: "Spotless Chef" },
      { target: 60, title: "Hygiene Hero" },
      { target: 150, title: "Sparkle Legend" },
    ],
    value: (s) => restaurantRecordOf(s).spotless,
  },
  {
    id: "favourite",
    name: "Customer Favourite",
    icon: "💛",
    unit: "popularity",
    group: "Service",
    describe: (t) => `Reach popularity ${t} out of 100.`,
    tiers: [
      { target: 65, title: "Local Favourite" },
      { target: 80, title: "Crowd Pleaser" },
      { target: 92, title: "Town Darling" },
      { target: 100, title: "Beloved" },
    ],
    value: (s) => s.business.popularity?.score ?? 0,
  },
  {
    id: "restaurateur",
    name: "Restaurateur",
    icon: "🏆",
    unit: "places climbed",
    group: "Restaurant",
    describe: (t) => `Climb ${t} places in the city ranking.`,
    tiers: [
      { target: 25, title: "Rising Name" },
      { target: 40, title: "Known Chef" },
      { target: 47, title: "Executive Chef" },
      { target: 49, title: "Legendary Restaurateur" },
    ],
    // Last place is 0 places climbed; #1 of 50 is 49.
    value: (s) => {
      const c = cityRanking(s);
      return Math.max(0, c.total - c.rank);
    },
  },
];

export const identityById = (id: string): ChefIdentity | undefined =>
  CHEF_IDENTITIES.find((i) => i.id === id);

/** The achievement id of one tier. */
export const titleAchievementId = (id: ChefIdentityId, target: number): string =>
  `ach-chef-${id}-${target}`;

/** The marker kept in `chefRecord.seen` once a tier was announced. */
export const titleSeenId = (id: ChefIdentityId, target: number): string => `title:${id}:${target}`;

export type IdentityStatus = {
  identity: ChefIdentity;
  value: number;
  /** How many tiers are earned (0-4). */
  tier: number;
  /** The earned title, or null before the first tier. */
  title: string | null;
  /** The next tier, or null when all four are earned. */
  next: ChefTier | null;
  /** 0-1 progress towards the next tier (1 once all four are earned). */
  fraction: number;
};

/** Where the player stands in one identity. */
export function identityStatus(save: SaveData, identity: ChefIdentity): IdentityStatus {
  const value = Math.max(0, Math.floor(identity.value(save)));
  const tier = identity.tiers.filter((t) => value >= t.target).length;
  const next = identity.tiers[tier] ?? null;
  const base = tier > 0 ? identity.tiers[tier - 1]!.target : 0;
  return {
    identity,
    value,
    tier,
    title: tier > 0 ? identity.tiers[tier - 1]!.title : null,
    next,
    fraction: next ? Math.min(1, Math.max(0, (value - base) / (next.target - base))) : 1,
  };
}

/** Every identity's standing, in the fixed identity order. */
export const chefTitleStatus = (save: SaveData): IdentityStatus[] =>
  CHEF_IDENTITIES.map((i) => identityStatus(save, i));

/**
 * The title the player wears: the highest tier earned in any identity (ties go to the identity listed first); null before the first one.
 * Derived, never stored.
 */
export function leadingTitle(save: SaveData): IdentityStatus | null {
  let best: IdentityStatus | null = null;
  for (const s of chefTitleStatus(save)) if (s.tier > 0 && (!best || s.tier > best.tier)) best = s;
  return best;
}

/**
 * The title to chase: of the identities that still have a tier to earn, the one furthest along its next tier (ties by identity order). Null when every
 * tier of every identity is earned.
 */
export function nextTitleGoal(save: SaveData): IdentityStatus | null {
  let best: IdentityStatus | null = null;
  for (const s of chefTitleStatus(save))
    if (s.next && (!best || s.fraction > best.fraction)) best = s;
  return best;
}

export type EarnedTitle = { identity: ChefIdentityId; target: number; title: string; tier: number };

/** Every tier the player has earned that was not announced yet, easiest first. */
export function unseenTitles(save: SaveData): EarnedTitle[] {
  const rec = chefRecordOf(save);
  const out: EarnedTitle[] = [];
  for (const s of chefTitleStatus(save))
    s.identity.tiers.forEach((t, i) => {
      if (i < s.tier && !hasSeen(rec, titleSeenId(s.identity.id, t.target)))
        out.push({ identity: s.identity.id, target: t.target, title: t.title, tier: i + 1 });
    });
  return out;
}

/**
 * Announces what was earned: the save with every earned tier marked as seen, and the ONE title to celebrate (the highest tier among the unseen; the first in
 * identity order on a tie), or null when nothing new. A player who already earned several (an old save) is told about the best one, not all of them.
 */
export function announceTitles(save: SaveData): { save: SaveData; headline: EarnedTitle | null } {
  const fresh = unseenTitles(save);
  if (fresh.length === 0) return { save, headline: null };
  let rec = chefRecordOf(save);
  for (const f of fresh) rec = markSeen(rec, titleSeenId(f.identity, f.target));
  const headline = fresh.reduce((a, b) => (b.tier > a.tier ? b : a));
  return { save: { ...save, business: { ...save.business, chefRecord: rec } }, headline };
}
