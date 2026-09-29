/**
 * MILESTONE REWARDS — Economy V2.5. The 22 restaurant milestones the
 * Progress screen already tracked (all derived from the save: levels
 * completed, knives owned, kitchen tiers built, the first Blacksmith
 * upgrade, the first staff hire, the first Business day) now each pay a
 * one-time reward. The last one, finishing Level 250, is the FAMILY
 * LEGACY: $50,000.
 *
 * Source of truth = the ledger. A milestone has been paid exactly when the
 * ledger holds a "milestone-reward" (or, for the finale, "family-legacy")
 * entry whose description is that milestone's id. No extra save field; the
 * ledger keeps these entries forever (EconomyLedger never trims them — at
 * most 22 exist), so reloading, replaying Level 250, recomputing progress
 * or any number of calls can never pay one twice.
 *
 * `grantEarnedMilestoneRewards` is pure and idempotent: it pays every
 * reached-but-unpaid milestone (credits + one ledger entry each) and
 * returns the save unchanged when there is nothing to pay. App.tsx runs it
 * on every persist, so a milestone is paid the moment it is reached — and
 * an older save that had already reached some is paid for them once, on
 * its next save.
 */
import type { SaveData } from "../SaveManager";
import { dollars } from "../money";
import { getLevels, isCompleted } from "../levels/LevelManager";
import { levelNumber } from "../levels/levelMastery";
import { KITCHEN_UPGRADE_CATALOG } from "../kitchen/kitchenUpgradeDefinitions";
import { KNIFE_CATALOG } from "../knives/knifeDefinitions";
import { getKnifeUpgrades, knifeLevel } from "../knives/blacksmith";
import { appendLedgerEntry } from "../economy/EconomyLedger";
import type { LedgerCategory } from "../economy/ledgerTypes";

/** The ledger category of every ordinary milestone reward. */
export const MILESTONE_REWARD_CATEGORY: LedgerCategory = "milestone-reward";
/** The ledger category of the one-time Level 250 Family Legacy. */
export const FAMILY_LEGACY_CATEGORY: LedgerCategory = "family-legacy";
export const FAMILY_LEGACY_ID = "campaign-complete";
export const FAMILY_LEGACY_REWARD = dollars(50_000);

/** What a milestone check can read — every field derived from the save. */
type MilestoneFacts = {
  completed: number;
  totalLevels: number;
  reachedLevel: number;
  finalChapterStart: number;
  kitchenTiersOwned: number;
  blacksmithSteps: number;
  businessDaysRun: number;
  staffHired: number;
  ownedKnifeIds: readonly string[];
};

export type MilestoneDefinition = {
  id: string;
  label: string;
  /** Reward in wallet cents, paid once. */
  reward: number;
  /** Campaign-gated milestones show the level they're reached at. */
  atLevel?: number;
  done: (f: MilestoneFacts) => boolean;
};

const levels = getLevels();
const TOTAL_LEVELS = levels.length;
const HALFWAY = Math.ceil(TOTAL_LEVELS / 2);
const FINAL_CHAPTER = Math.max(...levels.map((l) => l.chapter));
const FINAL_CHAPTER_START = Math.min(
  ...levels.filter((l) => l.chapter === FINAL_CHAPTER).map((l) => levelNumber(l.id)),
);
const FIRST_KITCHEN_UPGRADE = KITCHEN_UPGRADE_CATALOG.find((u) => u.unlockLevel > 1)!;
const LAST_KITCHEN_LEVEL = Math.max(...KITCHEN_UPGRADE_CATALOG.map((u) => u.unlockLevel));

/** Knife milestones pay more for the later, pricier blades. */
const KNIFE_MILESTONE_REWARD: Record<string, number> = {
  santoku: dollars(100),
  paring: dollars(150),
  nakiri: dollars(200),
  bread: dollars(250),
  cleaver: dollars(300),
  damascus: dollars(400),
  obsidian: dollars(500),
};

const levelsMilestone = (n: number, reward: number): MilestoneDefinition => ({
  id: `levels-${n}`,
  label: `Completed ${n} levels`,
  reward,
  atLevel: n,
  done: (f) => f.completed >= n,
});

/** Display order = the Progress screen's own order. */
export const MILESTONES: readonly MilestoneDefinition[] = [
  {
    id: "first-dish",
    label: "First dish served",
    reward: dollars(100),
    atLevel: 1,
    done: (f) => f.completed >= 1,
  },
  levelsMilestone(10, dollars(250)),
  levelsMilestone(25, dollars(500)),
  levelsMilestone(50, dollars(1_000)),
  {
    id: "first-kitchen-upgrade",
    label: `First kitchen upgrade — ${FIRST_KITCHEN_UPGRADE.name}`,
    reward: dollars(1_500),
    atLevel: FIRST_KITCHEN_UPGRADE.unlockLevel,
    done: (f) => f.kitchenTiersOwned >= 2,
  },
  {
    id: "first-blacksmith-upgrade",
    label: "First Blacksmith upgrade",
    reward: dollars(150),
    done: (f) => f.blacksmithSteps >= 1,
  },
  {
    id: "first-business-day",
    label: "First Business day completed",
    reward: dollars(300),
    done: (f) => f.businessDaysRun >= 1,
  },
  {
    id: "first-staff",
    label: "First staff member hired",
    reward: dollars(500),
    done: (f) => f.staffHired >= 1,
  },
  ...KNIFE_CATALOG.filter((k) => k.unlockLevel > 1).map((k): MilestoneDefinition => ({
    id: `knife-${k.id}`,
    label: `${k.name} in your kit`,
    reward: KNIFE_MILESTONE_REWARD[k.id] ?? dollars(100),
    atLevel: k.unlockLevel,
    done: (f) => f.ownedKnifeIds.includes(k.id),
  })),
  levelsMilestone(100, dollars(3_000)),
  {
    id: "halfway",
    label: "Halfway through the campaign",
    reward: dollars(4_000),
    atLevel: HALFWAY,
    done: (f) => f.completed >= HALFWAY,
  },
  levelsMilestone(150, dollars(5_000)),
  levelsMilestone(200, dollars(7_500)),
  {
    id: "every-kitchen-stage",
    label: "Every kitchen stage built",
    reward: dollars(7_500),
    atLevel: LAST_KITCHEN_LEVEL,
    done: (f) => f.kitchenTiersOwned >= KITCHEN_UPGRADE_CATALOG.length,
  },
  {
    id: "final-chapter",
    label: `Final chapter reached (Chapter ${FINAL_CHAPTER})`,
    reward: dollars(5_000),
    atLevel: FINAL_CHAPTER_START,
    done: (f) => f.reachedLevel >= f.finalChapterStart,
  },
  {
    id: FAMILY_LEGACY_ID,
    label: `Campaign complete (${TOTAL_LEVELS} levels) — Family Legacy`,
    reward: FAMILY_LEGACY_REWARD,
    atLevel: TOTAL_LEVELS,
    done: (f) => f.completed >= f.totalLevels,
  },
];

/** Every milestone's reward, the Family Legacy included. */
export const MILESTONE_REWARD_TOTAL = MILESTONES.reduce((s, m) => s + m.reward, 0);

function factsFor(save: SaveData): MilestoneFacts {
  const progress = save.levelProgress;
  return {
    completed: levels.filter((l) => isCompleted(l.id, progress)).length,
    totalLevels: TOTAL_LEVELS,
    reachedLevel: levelNumber(progress.highestUnlockedLevelId),
    finalChapterStart: FINAL_CHAPTER_START,
    kitchenTiersOwned: KITCHEN_UPGRADE_CATALOG.filter((u) =>
      save.ownedKitchenUpgradeIds.includes(u.id),
    ).length,
    blacksmithSteps: save.ownedKnifeIds.reduce(
      (s, id) => s + knifeLevel(getKnifeUpgrades(save, id)) - 1,
      0,
    ),
    businessDaysRun: Math.max(0, save.business.calendar.businessDay - 1),
    staffHired: save.ownedStaffIds.length,
    ownedKnifeIds: save.ownedKnifeIds,
  };
}

const categoryFor = (m: MilestoneDefinition): LedgerCategory =>
  m.id === FAMILY_LEGACY_ID ? FAMILY_LEGACY_CATEGORY : MILESTONE_REWARD_CATEGORY;

/** The ids of every milestone the ledger shows as already paid. */
export function paidMilestoneIds(save: SaveData): Set<string> {
  return new Set(
    save.economyLedger
      .filter(
        (e) =>
          (e.category === MILESTONE_REWARD_CATEGORY || e.category === FAMILY_LEGACY_CATEGORY) &&
          !!e.description,
      )
      .map((e) => e.description!),
  );
}

export type MilestoneStatus = MilestoneDefinition & { reached: boolean; paid: boolean };

/** Every milestone with whether it is reached and whether its reward has been paid. */
export function milestoneStatuses(save: SaveData): MilestoneStatus[] {
  const facts = factsFor(save);
  const paid = paidMilestoneIds(save);
  return MILESTONES.map((m) => ({ ...m, reached: m.done(facts), paid: paid.has(m.id) }));
}

/** Total milestone rewards already paid (ledger-exact — these entries are never trimmed). */
export function milestoneRewardsPaid(save: SaveData): { milestones: number; familyLegacy: number } {
  let milestones = 0;
  let familyLegacy = 0;
  for (const e of save.economyLedger) {
    if (e.category === MILESTONE_REWARD_CATEGORY) milestones += e.amount;
    else if (e.category === FAMILY_LEGACY_CATEGORY) familyLegacy += e.amount;
  }
  return { milestones, familyLegacy };
}

/**
 * Pays every reached, unpaid milestone: credits rise by exactly its reward
 * and one ledger entry records it. Idempotent — calling it again (or on a
 * reload) pays nothing more. Returns the same `save` object when nothing
 * is due.
 */
export function grantEarnedMilestoneRewards(save: SaveData): {
  save: SaveData;
  granted: MilestoneDefinition[];
} {
  const due = milestoneStatuses(save).filter((m) => m.reached && !m.paid);
  if (due.length === 0) return { save, granted: [] };
  let next = save;
  for (const m of due) {
    next = appendLedgerEntry(
      { ...next, credits: next.credits + m.reward },
      categoryFor(m),
      m.reward,
      m.id,
    );
  }
  return { save: next, granted: due };
}
