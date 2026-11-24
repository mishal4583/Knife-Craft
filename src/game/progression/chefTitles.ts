/**
 * THE CHEF'S TITLES (the "Chef Pride" plan, Phase 3a, developer 2026-11-23: "what kind of chef am I?").
 *
 * Six IDENTITIES, each with four earned tiers, valued from play the game already keeps (nothing here is bought, nothing pays money). Audit Batch 4 (developer
 * 2026-11-23) brought each one to the plan's own inputs:
 *   Precision          perfect cuts (chefRecord `perfectCuts`) AND plates of 95% or better, "Masterful" (chefRecord `masterful`)
 *   Speed              the fastest fair plate ever (chefRecord `fastestMs`); a tier is "a plate under N seconds"
 *   Organizer          Fridge Sort crates finished with three stars (fridgeSort)
 *   Cleanliness        spotless services (restaurantRecord) AND the best run of spotless services in a row (`bestStreak`)
 *   Customer Favourite the restaurant's popularity, 0-100 (businessPopularity) AND the tips customers have left, ever (economy lifetime `customer-tip`)
 *   Restaurateur       places climbed in the city ranking (cityRanking); the top tier ALSO needs lifetime Endless stars (endlessStarsOf)
 * A tier may carry a second requirement (`also`): it is earned only when BOTH are met, and the card says which one is missing.
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
import { endlessStarsOf } from "../restaurant/restaurantStanding";
import { formatUsd } from "../money";

export type ChefIdentityId =
  "precision" | "speed" | "organizer" | "cleanliness" | "favourite" | "restaurateur";

/** A second condition of a tier: `have(save)` must reach `need` (shown as "<label> <have> of <need>"). */
export type ChefRequirement = {
  label: string;
  need: number;
  have: (save: SaveData) => number;
  /** How a number reads ("$25.00", default: the plain number). */
  show?: (n: number) => string;
};

export type ChefTier = { target: number; title: string; also?: ChefRequirement };

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
  /** Where the player stands towards `next`, one short line ("34 s now, goal under 25 s"); the default is "<value> of <target> <unit>". */
  progress?: (save: SaveData, value: number, next: ChefTier) => string;
  /** Four tiers, easiest first. */
  tiers: readonly [ChefTier, ChefTier, ChefTier, ChefTier];
  value: (save: SaveData) => number;
};

/** The Progress card and the Kitchen chip open with this level (the plates before it are the first lessons). */
export const CHEF_TITLES_FROM_LEVEL = 3;

/**
 * Speed's inputs. The identity machinery reads "bigger is better", but a plate time is "smaller is better": the Speed value is therefore how far the fastest fair plate is
 * UNDER `SPEED_CEILING_S` whole seconds, and a tier's target is `SPEED_CEILING_S - N` for "a plate under N seconds". With whole seconds floored, a plate of 59.999 s is under 60
 * and one of exactly 60.000 s is not. No plate yet (fastestMs 0) is 0, which earns nothing.
 */
export const SPEED_CEILING_S = 90;
/** The plate-time goals, in seconds, easiest first ("a plate under N s"). */
export const SPEED_GOALS_S = [60, 40, 25, 15] as const;
const speedTarget = (underSeconds: number) => SPEED_CEILING_S - underSeconds;
export const speedValue = (fastestMs: number): number =>
  Number.isFinite(fastestMs) && fastestMs > 0
    ? Math.max(0, SPEED_CEILING_S - 1 - Math.floor(fastestMs / 1000))
    : 0;
/** "34 s", the fastest fair plate, or null before one. */
const fastestText = (save: SaveData): string | null => {
  const ms = chefRecordOf(save).fastestMs;
  return ms > 0 ? `${Math.round(ms / 1000)} s` : null;
};

/** Lifetime Endless stars the top Restaurateur tier asks for (a draft for the developer to tune): about ten good days of the open-ended restaurant. */
export const LEGEND_STARS = 30;
const CLEAN_STREAK_BY_TIER: Record<number, number> = { 5: 2, 20: 5, 60: 10, 150: 20 };
const TIPS_BY_TIER: Record<number, string> = { 65: "$25", 80: "$100", 92: "$400", 100: "$1,200" };

const MASTERFUL_BY_TIER: Record<number, number> = { 25: 3, 100: 10, 300: 30, 800: 100 };
const masterful = (need: number): ChefRequirement => ({
  label: "plates of 95%+",
  need,
  have: (s) => chefRecordOf(s).masterful,
});
const bestStreakOf = (s: SaveData) => restaurantRecordOf(s).bestStreak;
const tipsOf = (s: SaveData) => Math.max(0, Math.floor(s.economy?.lifetime?.["customer-tip"] ?? 0));
const starsOf = (s: SaveData) => endlessStarsOf(s).total;

const streak = (need: number): ChefRequirement => ({
  label: "best streak",
  need,
  have: bestStreakOf,
});
const tips = (dollars: number): ChefRequirement => ({
  label: "tips",
  need: dollars * 100,
  have: tipsOf,
  show: (cents) => formatUsd(cents).replace(/\.00$/, ""),
});
const endlessStars = (need: number): ChefRequirement => ({
  label: "Endless stars",
  need,
  have: starsOf,
});

export const CHEF_IDENTITIES: readonly ChefIdentity[] = [
  {
    id: "precision",
    name: "Precision",
    icon: "🔪",
    unit: "perfect cuts",
    group: "Kitchen",
    // Audit Batch 4: the plan's "perfect cuts + plates at 95 or more": every tier needs plates of 95% or better (Masterful) as well as perfect cuts.
    describe: (t) =>
      `Land ${t} perfect cuts and ${MASTERFUL_BY_TIER[t] ?? 0} plates of 95% or better.`,
    tiers: [
      { target: 25, title: "Steady Hand", also: masterful(3) },
      { target: 100, title: "Precision Chef", also: masterful(10) },
      { target: 300, title: "Master of the Edge", also: masterful(30) },
      { target: 800, title: "Knife Legend", also: masterful(100) },
    ],
    value: (s) => chefRecordOf(s).perfectCuts,
  },
  {
    id: "speed",
    name: "Speed",
    icon: "⚡",
    unit: "seconds under 90",
    group: "Kitchen",
    // Audit Batch 4: the fastest plate (chefRecord.fastestMs), not a count of quick Clean plates.
    describe: (t) => `Finish a plate in under ${SPEED_CEILING_S - t} seconds.`,
    tiers: [
      { target: speedTarget(SPEED_GOALS_S[0]), title: "Quick Hands" },
      { target: speedTarget(SPEED_GOALS_S[1]), title: "Line Sprinter" },
      { target: speedTarget(SPEED_GOALS_S[2]), title: "Speed Chef" },
      { target: speedTarget(SPEED_GOALS_S[3]), title: "Lightning Chef" },
    ],
    value: (s) => speedValue(chefRecordOf(s).fastestMs),
    progress: (s, _v, next) => {
      const now = fastestText(s);
      const goal = `under ${SPEED_CEILING_S - next.target} s`;
      return now ? `Fastest plate ${now}, goal ${goal}` : `No fast plate yet, goal ${goal}`;
    },
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
    describe: (t) =>
      `Finish ${t} spotless services, ${CLEAN_STREAK_BY_TIER[t] ?? 0} in a row at best.`,
    tiers: [
      { target: 5, title: "Clean Counter", also: streak(2) },
      { target: 20, title: "Spotless Chef", also: streak(5) },
      { target: 60, title: "Hygiene Hero", also: streak(10) },
      { target: 150, title: "Sparkle Legend", also: streak(20) },
    ],
    value: (s) => restaurantRecordOf(s).spotless,
  },
  {
    id: "favourite",
    name: "Customer Favourite",
    icon: "💛",
    unit: "popularity",
    group: "Service",
    describe: (t) => `Reach popularity ${t} and ${TIPS_BY_TIER[t] ?? ""} in tips.`,
    tiers: [
      { target: 65, title: "Local Favourite", also: tips(25) },
      { target: 80, title: "Crowd Pleaser", also: tips(100) },
      { target: 92, title: "Town Darling", also: tips(400) },
      { target: 100, title: "Beloved", also: tips(1200) },
    ],
    value: (s) => s.business.popularity?.score ?? 0,
  },
  {
    id: "restaurateur",
    name: "Restaurateur",
    icon: "🏆",
    unit: "places climbed",
    group: "Restaurant",
    describe: (t) =>
      t >= 49
        ? `Reach #1 in the city and earn ${LEGEND_STARS} Endless stars.`
        : `Climb ${t} places in the city ranking.`,
    tiers: [
      { target: 25, title: "Rising Name" },
      { target: 40, title: "Known Chef" },
      { target: 47, title: "Executive Chef" },
      { target: 49, title: "Legendary Restaurateur", also: endlessStars(LEGEND_STARS) },
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

/** True when `tier` is earned: its main value is reached AND, if it has one, its second requirement. */
export function tierEarned(save: SaveData, value: number, tier: ChefTier): boolean {
  return value >= tier.target && (!tier.also || tier.also.have(save) >= tier.also.need);
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

/** Where the player stands in one identity. Tiers are earned in order: a later tier counts only when every earlier one is earned. */
export function identityStatus(save: SaveData, identity: ChefIdentity): IdentityStatus {
  const value = Math.max(0, Math.floor(identity.value(save)));
  let tier = 0;
  while (tier < identity.tiers.length && tierEarned(save, value, identity.tiers[tier]!)) tier++;
  const next = identity.tiers[tier] ?? null;
  const base = tier > 0 ? identity.tiers[tier - 1]!.target : 0;
  const main = next ? clamp01((value - base) / (next.target - base)) : 1;
  // The bar is full only when BOTH requirements of the next tier are met.
  const second = next?.also ? clamp01(next.also.have(save) / next.also.need) : 1;
  return {
    identity,
    value,
    tier,
    title: tier > 0 ? identity.tiers[tier - 1]!.title : null,
    next,
    fraction: next ? Math.min(main, second) : 1,
  };
}

/**
 * One short line for the card: where the player stands towards the next tier, with the second requirement when the tier has one
 * ("120 of 300 perfect cuts", "Fastest plate 34 s, goal under 25 s", "12 of 20 spotless services · best streak 3 of 5").
 */
export function identityProgressText(save: SaveData, status: IdentityStatus): string {
  const { identity, next, value } = status;
  if (!next) return "Every tier earned";
  const base = identity.progress
    ? identity.progress(save, value, next)
    : `${value} of ${next.target} ${identity.unit}`;
  if (!next.also) return base;
  const show = next.also.show ?? String;
  return `${base} · ${next.also.label} ${show(Math.min(next.also.have(save), next.also.need))} of ${show(next.also.need)}`;
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
