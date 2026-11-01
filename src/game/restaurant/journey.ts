/**
 * THE JOURNEY (Phase 7A, developer 2026-10-31: the hybrid — "levels hidden, milestones shown"): the 100
 * milestones that become the player-facing progression, laid over the 148 hidden services.
 *
 *  - The service ladder (`levelProgress`, `levelNumber`, `restaurantLevelOf`) stays the engine's clock: every
 *    unlock, price, pay and story still reads it. Nothing here changes a rule, a price or a save.
 *  - A milestone ENDS at an anchor service. The natural anchors are the real unlock events (systems, staff,
 *    specialist chefs, kitchen ranks, techniques, menu, day length, house guests, chores, chapters, story);
 *    the longest stretches are then split (the longest first, at the middle) until there are 100.
 *  - Service n belongs to the milestone whose anchor is the first one at or after n. Every service is kept.
 *  - Derived from `levelProgress` only: no save field, no migration, old saves read. Pure, no randomness.
 *
 * Named `journey` because "milestone" already means the old reward system (progression/milestoneRewards.ts,
 * now the achievements). The player just sees "Milestones".
 *
 * `scripts/level-disposition.mts` prints this table for every level; `journey-qa` keeps the two in step.
 */
import type { SaveData } from "../SaveManager";
import {
  CAMPAIGN_150_CHAPTERS,
  CAMPAIGN_150_CHAPTER_TITLES,
  CAMPAIGN_150_TECHNIQUE_FIRST_USE_LEVEL,
  campaignChapterOf,
} from "../levels/campaignSelection";
import { CAFE_MILESTONES } from "../cafe/cafeDefinitions";
import { LEVELS } from "../levels/levelDefinitions";
import {
  CLOSING_CHORES,
  DAY_SCHEDULE,
  LAST_CAMPAIGN_LEVEL,
  MENU_GUESTS_SCHEDULE,
  MENU_UNLOCKS,
  RESTAURANT_SYSTEMS,
} from "./restaurantProgression";
import { SPECIALIST_CHEFS, STAFF_RULES } from "./staffRequirements";

/** How many milestones the journey has (developer 2026-10-31, D-7: keep 100). */
export const MILESTONE_COUNT = 100;
/** The finale story's service (mask bit in `SaveData.story`). */
const FINALE_STORY_LEVEL = 75;

export type MilestoneKind = "Unlock" | "Practice" | "Story";

export type Milestone = {
  /** 1..100, in play order. */
  no: number;
  /** The first and last hidden service of this milestone (finishing `to` completes it). */
  from: number;
  to: number;
  kind: MilestoneKind;
  name: string;
  /** Other things that open at the same anchor. */
  also: string[];
  /** The cuisine chapter (1..13) of the anchor service, and its title. */
  chapter: number;
  chapterTitle: string;
};

type Ev = { prio: number; label: string };

/** Labels that repeat along the road; they are told apart by the service they end on. */
const GENERIC = new Set(["New dishes on the menu"]);

/** "line-cook" → "Line Cook". */
const title = (s: string) =>
  s.replace(
    /(^|[\s-])([a-z])/g,
    (_, a: string, b: string) => `${a === "-" ? " " : a}${b.toUpperCase()}`,
  );

/** Every real unlock event, by service: the catalogs' own levels, nothing invented. */
export function unlockEvents(): Map<number, Ev[]> {
  const events = new Map<number, Ev[]>();
  const add = (level: number, prio: number, label: string) => {
    if (level < 1 || level > LAST_CAMPAIGN_LEVEL) return;
    const list = events.get(level) ?? [];
    list.push({ prio, label });
    events.set(level, list);
  };
  for (const c of CAMPAIGN_150_CHAPTERS)
    add(c.firstLevel, 2, c.firstLevel === 1 ? "Open the restaurant" : `Welcome to ${c.title}`);
  for (const s of RESTAURANT_SYSTEMS)
    if (s.firstLevel > 1 || s.id === "restaurant-day") add(s.firstLevel, 3, s.title);
  for (const c of SPECIALIST_CHEFS) add(c.firstLevel, 4, `Hire the ${title(c.id)}`);
  for (const r of STAFF_RULES) add(r.fromLevel, 5, `Hire a ${title(r.role)}`);
  for (const c of CAFE_MILESTONES) add(c.levelRequired, 6, c.title);
  for (const [t, n] of Object.entries(CAMPAIGN_150_TECHNIQUE_FIRST_USE_LEVEL))
    add(n, 7, `Learn the ${t.replace(/([A-Z])/g, " $1").toLowerCase()} cut`);
  for (const u of MENU_UNLOCKS) add(u.level, 8, "New dishes on the menu");
  for (const d of DAY_SCHEDULE)
    if (d.fromLevel > 1) add(d.fromLevel, 8, `Longer days: ${d.services.length} services`);
  for (const d of MENU_GUESTS_SCHEDULE)
    if (d.fromLevel > 1) add(d.fromLevel, 9, `More house guests (${d.guests})`);
  for (const c of CLOSING_CHORES)
    if (c.fromLevel > 1) add(c.fromLevel, 9, `New closing chore: ${c.label}`);
  add(FINALE_STORY_LEVEL, 1, "The Finale story");
  add(LAST_CAMPAIGN_LEVEL, 1, "The Last Page story and the Endless Restaurant");
  return events;
}

function build(): { milestones: Milestone[]; natural: number } {
  const events = unlockEvents();
  const anchors = new Set<number>(events.keys());
  anchors.add(LAST_CAMPAIGN_LEVEL);
  const natural = anchors.size;
  const sorted = () => [...anchors].sort((a, b) => a - b);
  while (anchors.size < MILESTONE_COUNT) {
    const a = sorted();
    let best = -1;
    let bestLen = 1;
    for (let i = 0; i < a.length; i++) {
      const len = a[i]! - (a[i - 1] ?? 0);
      if (len > bestLen) {
        bestLen = len;
        best = i;
      }
    }
    if (best < 0) break;
    anchors.add((a[best - 1] ?? 0) + Math.floor(bestLen / 2));
  }
  const milestones = sorted().map((to, i, all): Milestone => {
    const from = (all[i - 1] ?? 0) + 1;
    const evs = (events.get(to) ?? []).slice().sort((a, b) => a.prio - b.prio);
    const unique = [...new Map(evs.map((e) => [e.label, e])).values()];
    const chapter = campaignChapterOf(to);
    const chapterTitle = CAMPAIGN_150_CHAPTER_TITLES[chapter] ?? "";
    // The service the milestone ends on (service titles are unique): a Practice milestone is named after it, and a
    // generic label ("New dishes on the menu") gets it too, so no two milestones read the same.
    const service = LEVELS[to - 1]?.title ?? `Service ${to}`;
    let name = unique[0]?.label;
    if (!name) name = service;
    else if (GENERIC.has(name)) name = `${name} · ${service}`;
    return {
      no: i + 1,
      from,
      to,
      kind: unique.some((e) => e.prio === 1) ? "Story" : unique.length ? "Unlock" : "Practice",
      name,
      also: unique.slice(1).map((e) => e.label),
      chapter,
      chapterTitle,
    };
  });
  return { milestones, natural };
}

const built = build();
export const MILESTONES: readonly Milestone[] = built.milestones;
/** How many of them come straight from unlock events (the rest are Practice milestones). */
export const NATURAL_MILESTONES = built.natural;

/** The milestone service `level` belongs to (levels past the last belong to the last). */
export function milestoneOf(level: number): Milestone {
  const n = Math.max(1, Math.round(level));
  return MILESTONES.find((m) => n <= m.to) ?? MILESTONES[MILESTONES.length - 1]!;
}

export type Journey = {
  /** Milestones finished, of MILESTONE_COUNT. */
  done: number;
  total: number;
  /** The milestone being worked on; null once all are done (the Endless Restaurant is next). */
  current: Milestone | null;
  /** Services still to finish in the current milestone. */
  servicesLeft: number;
  /** The milestone after it. */
  next: Milestone | null;
  /** The chapter of the current milestone (the last chapter when finished), with its milestones done / total. */
  chapter: { no: number; title: string; done: number; total: number };
};

const completedLevels = (save: SaveData): Set<number> =>
  new Set(
    save.levelProgress.completedLevelIds.flatMap((id) => {
      const m = /^level-(\d+)$/.exec(id);
      return m ? [Number(m[1])] : [];
    }),
  );

/** Where the player is on the journey, from the finished services only. */
export function journeyOf(save: SaveData): Journey {
  const done = completedLevels(save);
  const finished = (m: Milestone) => {
    for (let n = m.from; n <= m.to; n++) if (!done.has(n)) return false;
    return true;
  };
  const doneCount = MILESTONES.filter(finished).length;
  const current = MILESTONES.find((m) => !finished(m)) ?? null;
  const at = current ?? MILESTONES[MILESTONES.length - 1]!;
  let servicesLeft = 0;
  if (current) for (let n = current.from; n <= current.to; n++) if (!done.has(n)) servicesLeft++;
  const inChapter = MILESTONES.filter((m) => m.chapter === at.chapter);
  return {
    done: doneCount,
    total: MILESTONES.length,
    current,
    servicesLeft,
    next: current ? (MILESTONES[current.no] ?? null) : null,
    chapter: {
      no: at.chapter,
      title: at.chapterTitle,
      done: inChapter.filter(finished).length,
      total: inChapter.length,
    },
  };
}
