/**
 * ACHIEVEMENTS — the one reward system the player sees (economy plan,
 * developer 2026-10-16). Every achievement is derived from real, saved
 * progress; each one pays a set reward ONCE, collected in the Achievements
 * tab ("Collect $X"), so the completionist reaches the campaign's money
 * target from the tab instead of the levels alone.
 *
 *  - The old milestone rewards (milestoneRewards.ts) ARE achievements here,
 *    with their own ids and amounts, so nothing already paid pays again.
 *    The Family Legacy (Level 150) stays automatic, with its banner.
 *  - New achievements use "ach-" ids so they never collide with a milestone.
 *  - Claimed = `SaveData.economy.claimedMilestoneIds` (the existing record —
 *    no new save field) or a "milestone-reward" ledger entry with the id.
 *  - Collecting credits the wallet, writes ONE ledger entry and marks the
 *    id claimed; it is all-or-nothing and can never pay twice.
 */
import type { SaveData } from "../SaveManager";
import { appendLedgerEntry } from "../economy/EconomyLedger";
import { dollars } from "../money";
import { restaurantProgress } from "./restaurantProgress";
import {
  FAMILY_LEGACY_ID,
  MILESTONE_REWARD_CATEGORY,
  milestoneStatuses,
  paidMilestoneIds,
} from "./milestoneRewards";
import { endlessStarsOf } from "../restaurant/restaurantStanding";
import { restaurantRecordOf } from "../restaurant/serviceReport";
import { restaurantSuppliesOf } from "../restaurant/serviceSupplies";

export type AchievementGroup = "Restaurant" | "Kitchen" | "Service" | "Business";

export type Achievement = {
  id: string;
  group: AchievementGroup;
  icon: string;
  title: string;
  description: string;
  value: number;
  target: number;
  unit: string;
  /** Cents paid once when collected (0 = a badge only). */
  reward: number;
  reached: boolean;
  claimed: boolean;
  /** Paid automatically (the Family Legacy) — never through Collect. */
  automatic: boolean;
};

type Tier = { target: number; reward: number; title?: string };
type Ladder = {
  key: string;
  group: AchievementGroup;
  icon: string;
  unit: string;
  title: (t: number) => string;
  description: (t: number) => string;
  tiers: (total: number) => Tier[];
  value: (save: SaveData) => number;
};

const D = dollars;

/** The new achievement ladders and their rewards (economy plan 2026-10-16). */
const LADDERS: readonly Ladder[] = [
  {
    key: "recipes",
    group: "Kitchen",
    icon: "🍲",
    unit: "recipes",
    title: (t) => `${t} recipes cooked`,
    description: (t) => `Cook ${t} different campaign recipes.`,
    tiers: (total) => [
      { target: 10, reward: D(200) },
      { target: 25, reward: D(500) },
      { target: 50, reward: D(1_500) },
      { target: 100, reward: D(3_000) },
      { target: 150, reward: D(5_000) },
      { target: total, reward: D(8_000), title: "Full recipe book" },
    ],
    value: (s) => restaurantProgress(s).recipes.cooked,
  },
  {
    key: "knives",
    group: "Kitchen",
    icon: "🔪",
    unit: "knives",
    title: (t) => `${t} knives owned`,
    description: (t) => `Own ${t} knives.`,
    tiers: (total) => [
      { target: 3, reward: D(300) },
      { target: total, reward: D(4_000), title: "Knife collector" },
    ],
    value: (s) => restaurantProgress(s).knivesOwned,
  },
  {
    key: "boards",
    group: "Kitchen",
    icon: "🪵",
    unit: "boards",
    title: (t) => `${t} cutting boards owned`,
    description: (t) => `Own ${t} cutting boards.`,
    tiers: (total) => [
      { target: 3, reward: D(300) },
      { target: total, reward: D(3_000), title: "Board collector" },
    ],
    value: (s) => restaurantProgress(s).boardsOwned,
  },
  {
    key: "kitchens",
    group: "Kitchen",
    icon: "🏠",
    unit: "stages",
    title: (t) => `Kitchen stage ${t}`,
    description: (t) => `Reach kitchen stage ${t}.`,
    tiers: () => [
      { target: 2, reward: D(2_000) },
      { target: 4, reward: D(5_000) },
    ],
    value: (s) => restaurantProgress(s).kitchen.stages.filter((st) => st.reached).length,
  },
  {
    key: "services",
    group: "Service",
    icon: "🍽️",
    unit: "services",
    title: (t) => `${t} services served`,
    description: (t) => `Complete ${t} restaurant services.`,
    tiers: () => [
      { target: 25, reward: D(500) },
      { target: 50, reward: D(1_500) },
      { target: 100, reward: D(4_000) },
      { target: 150, reward: D(6_000) },
    ],
    value: (s) => restaurantRecordOf(s).services,
  },
  {
    key: "spotless",
    group: "Service",
    icon: "✨",
    unit: "spotless services",
    title: (t) => (t === 1 ? "Spotless service" : `${t} spotless services`),
    description: (t) =>
      `Finish ${t} ${t === 1 ? "service" : "services"} with every hygiene check passed.`,
    tiers: () => [
      { target: 1, reward: D(100) },
      { target: 10, reward: D(600) },
      { target: 25, reward: D(1_000) },
      { target: 50, reward: D(2_500) },
      { target: 100, reward: D(5_000) },
    ],
    value: (s) => restaurantRecordOf(s).spotless,
  },
  {
    key: "streak",
    group: "Service",
    icon: "🧼",
    unit: "service streak",
    title: (t) => `${t} spotless in a row`,
    description: (t) => `Keep the restaurant spotless for ${t} services in a row.`,
    tiers: () => [
      { target: 3, reward: D(150) },
      { target: 7, reward: D(300) },
      { target: 25, reward: D(1_000) },
      { target: 50, reward: D(2_500) },
      { target: 100, reward: D(5_000) },
    ],
    value: (s) => restaurantRecordOf(s).bestStreak,
  },
  {
    key: "washed",
    group: "Service",
    icon: "🫧",
    unit: "pieces washed",
    title: (t) => `${t.toLocaleString("en-US")} pieces washed`,
    description: (t) => `Wash ${t.toLocaleString("en-US")} pieces of restaurant tableware.`,
    tiers: () => [
      { target: 100, reward: D(500) },
      { target: 500, reward: D(1_500) },
      { target: 1_000, reward: D(3_000) },
      { target: 2_000, reward: D(5_000) },
    ],
    value: (s) => restaurantSuppliesOf(s).washedTotal,
  },
  {
    key: "covers",
    group: "Service",
    icon: "🧑‍🍳",
    unit: "guests served",
    title: (t) => `${t} dine-in guests`,
    description: (t) => `Serve ${t} dine-in guests.`,
    tiers: () => [
      { target: 100, reward: D(1_000) },
      { target: 250, reward: D(2_500) },
      { target: 500, reward: D(5_000) },
    ],
    value: (s) => restaurantSuppliesOf(s).coversTotal,
  },
  {
    key: "days",
    group: "Business",
    icon: "🌙",
    unit: "days run",
    title: (t) => `${t} restaurant days`,
    description: (t) => `Run the restaurant for ${t} business days.`,
    tiers: () => [
      { target: 10, reward: D(1_000) },
      { target: 20, reward: D(2_500) },
    ],
    value: (s) => restaurantProgress(s).business.daysRun,
  },
  {
    key: "daily",
    group: "Business",
    icon: "📅",
    unit: "day streak",
    title: (t) => `${t}-day daily order streak`,
    description: (t) => `Complete the daily order ${t} days in a row.`,
    tiers: () => [
      { target: 3, reward: D(300) },
      { target: 7, reward: D(700) },
    ],
    value: (s) => s.dailyOrder?.streak ?? 0,
  },
  {
    key: "endless",
    group: "Business",
    icon: "⭐",
    unit: "stars",
    title: () => "Endless excellence",
    description: () => "Earn 100 stars in the Endless Restaurant.",
    tiers: () => [{ target: 100, reward: D(10_000) }],
    value: (s) => endlessStarsOf(s).total,
  },
];

/** Which group an old milestone shows in. */
function milestoneGroup(id: string): AchievementGroup {
  if (id.startsWith("knife-") || id.includes("kitchen") || id.includes("blacksmith"))
    return "Kitchen";
  if (id.includes("business") || id.includes("staff")) return "Business";
  if (id === "first-dish") return "Service";
  return "Restaurant";
}

function milestoneIcon(id: string): string {
  if (id.startsWith("knife-")) return "🔪";
  if (id === FAMILY_LEGACY_ID) return "🏆";
  if (id.includes("kitchen")) return "🏠";
  if (id.includes("blacksmith")) return "⚒️";
  if (id.includes("staff")) return "🧑‍🍳";
  if (id.includes("business")) return "🌙";
  if (id === "first-dish") return "🍽️";
  return "🗺️";
}

function claimedIds(save: SaveData): Set<string> {
  const set = new Set(save.economy?.claimedMilestoneIds ?? []);
  for (const id of paidMilestoneIds(save)) set.add(id);
  return set;
}

/** Every achievement: the merged milestones first, then the ladders. */
export function achievementsFor(save: SaveData): Achievement[] {
  const claimed = claimedIds(save);
  const out: Achievement[] = milestoneStatuses(save).map((m) => ({
    id: m.id,
    group: milestoneGroup(m.id),
    icon: milestoneIcon(m.id),
    title: m.label,
    description:
      m.id === FAMILY_LEGACY_ID
        ? "Paid automatically when the last campaign level is done."
        : "A campaign milestone.",
    value: m.reached ? 1 : 0,
    target: 1,
    unit: "",
    reward: m.reward,
    reached: m.reached,
    claimed: m.claimed || claimed.has(m.id),
    automatic: m.id === FAMILY_LEGACY_ID,
  }));
  const p = restaurantProgress(save);
  const totals: Record<string, number> = {
    recipes: p.recipes.total,
    knives: p.knives.length,
    boards: p.boards.length,
  };
  for (const ladder of LADDERS) {
    const value = Math.max(0, ladder.value(save));
    const seen = new Set<number>();
    for (const tier of ladder.tiers(totals[ladder.key] ?? 0)) {
      if (tier.target <= 0 || seen.has(tier.target)) continue;
      seen.add(tier.target);
      const id = `ach-${ladder.key}-${tier.target}`;
      out.push({
        id,
        group: ladder.group,
        icon: ladder.icon,
        title: tier.title ?? ladder.title(tier.target),
        description: ladder.description(tier.target),
        value,
        target: tier.target,
        unit: ladder.unit,
        reward: tier.reward,
        reached: value >= tier.target,
        claimed: claimed.has(id),
        automatic: false,
      });
    }
  }
  return out;
}

/** Earned, not yet collected, and paid through Collect. */
export function collectable(save: SaveData): Achievement[] {
  return achievementsFor(save).filter(
    (a) => a.reached && !a.claimed && !a.automatic && a.reward > 0,
  );
}

/** Cents waiting to be collected in the tab. */
export function collectableTotal(save: SaveData): number {
  return collectable(save).reduce((t, a) => t + a.reward, 0);
}

export type CollectResult =
  | { ok: true; save: SaveData; amount: number }
  | { ok: false; reason: "unknown" | "notReached" | "claimed" | "automatic" };

/** Collects one achievement's reward: credit + ONE ledger entry + claimed. */
export function collectAchievement(save: SaveData, id: string): CollectResult {
  const a = achievementsFor(save).find((x) => x.id === id);
  if (!a) return { ok: false, reason: "unknown" };
  if (a.automatic) return { ok: false, reason: "automatic" };
  if (!a.reached) return { ok: false, reason: "notReached" };
  if (a.claimed || a.reward <= 0) return { ok: false, reason: "claimed" };
  const credited = appendLedgerEntry(
    { ...save, credits: save.credits + a.reward },
    MILESTONE_REWARD_CATEGORY,
    a.reward,
    a.id,
  );
  return {
    ok: true,
    amount: a.reward,
    save: {
      ...credited,
      economy: {
        ...credited.economy,
        claimedMilestoneIds: [...credited.economy.claimedMilestoneIds, a.id],
      },
    },
  };
}

/** Collects everything waiting (the sims' active player; one entry per achievement). */
export function collectAllAchievements(save: SaveData): { save: SaveData; amount: number } {
  let next = save;
  let amount = 0;
  for (const a of collectable(save)) {
    const r = collectAchievement(next, a.id);
    if (r.ok) {
      next = r.save;
      amount += r.amount;
    }
  }
  return { save: next, amount };
}
