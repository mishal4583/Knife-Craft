/**
 * THE DAILY DARE (the "Chef Pride" plan, Phase 3b, developer 2026-11-23: "you probably can't do this"): ONE optional challenge a day that tests the player's skill.
 *
 * Rules (the plan's guardrails):
 *  - OPT-IN. Nothing starts until the player takes the dare; "Not today" just hides it for the day. No penalty, no streak, no deadline beyond the calendar day.
 *  - The dare of the day is picked by a fixed hash of the calendar day among the dares the player has unlocked, so everyone sees the same dare that day.
 *  - Winning pays a BADGE only (a step on the "dares won" ladder, progression/achievements.ts): no money, no ledger, no ad.
 *  - It never blocks anything: a failed or ignored dare changes nothing else.
 *
 * Dares (rules are exact; "plate" = a finished Knife Report, "service" = a finished level, "day" = a business day that closes):
 *   No Mercy Prep   5 plates in a row at Clean (85+) or better, counted from the moment the dare is taken
 *   Perfect Chef    3 Masterful plates (95+) in a row, counted from the moment the dare is taken
 *   Speed Demon     one plate of 6+ cuts at Clean or better in under 30 s of unpaused time
 *   Zero Waste      close a business day with no spoiled stock (from the fridge-and-freshness level)
 *   Clean Freak     finish a spotless service (from dine-in)
 * "Kitchen Chaos" (several orders at once) is deferred: the game does not measure it yet.
 *
 * Pure and deterministic: the day key is a parameter (the caller reads the calendar), no clock, no random, no wallet. State lives in `chefRecord.challenge`.
 */
import { hashString } from "../daily/DailyOrderManager";
import {
  CLEAN_FROM,
  MASTERFUL_FROM,
  MIN_FAST_MS,
  QUICK_MS,
  type ChefRecord,
  type ChallengeState,
} from "./chefRecord";
import { restaurantSystem } from "./restaurantProgression";

/** Dares open with this level (the first plates are the first lessons). */
export const DARES_FROM_LEVEL = 6;

export type DareId = "no-mercy" | "perfect-chef" | "speed-demon" | "zero-waste" | "clean-freak";
export type DareHook = "plate" | "service" | "day";

export type Dare = {
  id: DareId;
  icon: string;
  title: string;
  /** What to do, a few words. */
  ask: string;
  /** The playful line the dare is offered with. */
  say: string;
  /** Steps to win (plates in a row, or 1 for a single feat). */
  goal: number;
  /** "plates in a row", "" for a single feat. */
  unit: string;
  fromLevel: number;
  hook: DareHook;
};

export const DARES: readonly Dare[] = [
  {
    id: "no-mercy",
    icon: "⚔️",
    title: "No Mercy Prep",
    ask: "Cook 5 Clean plates in a row.",
    say: "Think you're ready for this? Five clean plates, no slips.",
    goal: 5,
    unit: "plates in a row",
    fromLevel: DARES_FROM_LEVEL,
    hook: "plate",
  },
  {
    id: "perfect-chef",
    icon: "🌟",
    title: "Perfect Chef",
    ask: "Cook 3 Masterful plates in a row.",
    say: "This kitchen isn't for beginners. Three Masterful plates?",
    goal: 3,
    unit: "plates in a row",
    fromLevel: DARES_FROM_LEVEL,
    hook: "plate",
  },
  {
    id: "speed-demon",
    icon: "⚡",
    title: "Speed Demon",
    ask: "Finish one Clean plate in under 30 seconds.",
    say: "Let's see what you've got. Thirty seconds on the clock.",
    goal: 1,
    unit: "",
    fromLevel: DARES_FROM_LEVEL,
    hook: "plate",
  },
  {
    id: "zero-waste",
    icon: "♻️",
    title: "Zero Waste",
    ask: "Close the day with no spoiled stock.",
    say: "Every ingredient has a job. Waste nothing today.",
    goal: 1,
    unit: "",
    fromLevel: restaurantSystem("fridge-freshness").firstLevel,
    hook: "day",
  },
  {
    id: "clean-freak",
    icon: "✨",
    title: "Clean Freak",
    ask: "Finish a spotless service.",
    say: "Your record is waiting to be broken. Leave it spotless.",
    goal: 1,
    unit: "",
    fromLevel: restaurantSystem("dine-in").firstLevel,
    hook: "service",
  },
];

export const dareById = (id: string): Dare | undefined => DARES.find((d) => d.id === id);

/** The dares open at this level, in the fixed list order. */
export const eligibleDares = (level: number): Dare[] =>
  level >= DARES_FROM_LEVEL ? DARES.filter((d) => level >= d.fromLevel) : [];

/** The dare of this calendar day: the same for everyone, drawn from what the player has unlocked. Null before Level 6. */
export function pickDare(dayKey: string, level: number): Dare | null {
  const pool = eligibleDares(level);
  return pool.length ? pool[hashString(`dare:${dayKey}`) % pool.length]! : null;
}

export type DareStatus = "offered" | "accepted" | "declined" | "won";
export type DareView = { dare: Dare; status: DareStatus; progress: number };

/** Today's dare as the player meets it, or null (before Level 6, or no dare unlocked). A state from another day is ignored. */
export function dareToday(rec: ChefRecord, dayKey: string, level: number): DareView | null {
  const c = rec.challenge;
  if (c && c.day === dayKey) {
    const dare = dareById(c.id);
    if (dare && level >= dare.fromLevel && level >= DARES_FROM_LEVEL)
      return { dare, status: c.state, progress: Math.min(c.progress, dare.goal) };
  }
  const dare = pickDare(dayKey, level);
  return dare ? { dare, status: "offered", progress: 0 } : null;
}

const withChallenge = (rec: ChefRecord, challenge: ChallengeState | null): ChefRecord => ({
  ...rec,
  challenge,
});

/** The player takes today's dare (only an offered one). */
export function takeDare(rec: ChefRecord, dayKey: string, level: number): ChefRecord {
  const v = dareToday(rec, dayKey, level);
  if (!v || v.status !== "offered") return rec;
  return withChallenge(rec, { day: dayKey, id: v.dare.id, state: "accepted", progress: 0 });
}

/** "Not today": the dare is hidden for the rest of the day (only an offered one). Nothing else changes. */
export function declineDare(rec: ChefRecord, dayKey: string, level: number): ChefRecord {
  const v = dareToday(rec, dayKey, level);
  if (!v || v.status !== "offered") return rec;
  return withChallenge(rec, { day: dayKey, id: v.dare.id, state: "declined", progress: 0 });
}

export type DareResult = {
  rec: ChefRecord;
  /** The dare won by this step, or null. */
  won: Dare | null;
};

function advance(rec: ChefRecord, view: DareView, progress: number): DareResult {
  const day = rec.challenge!.day;
  if (progress >= view.dare.goal)
    return {
      rec: {
        ...withChallenge(rec, { day, id: view.dare.id, state: "won", progress: view.dare.goal }),
        daresWon: rec.daresWon + 1,
      },
      won: view.dare,
    };
  return {
    rec: withChallenge(rec, { day, id: view.dare.id, state: "accepted", progress }),
    won: null,
  };
}

/** The plate facts a dare reads. */
export type DarePlate = { score: number; cuts: number; ms: number };

/** What the accepted plate dare does with one finished plate (null = this dare does not read plates, or none is accepted today). */
function plateProgress(view: DareView, p: DarePlate): number | null {
  switch (view.dare.id) {
    case "no-mercy":
      return p.score >= CLEAN_FROM ? view.progress + 1 : 0;
    case "perfect-chef":
      return p.score >= MASTERFUL_FROM ? view.progress + 1 : 0;
    case "speed-demon":
      return p.score >= CLEAN_FROM && p.cuts >= 6 && p.ms >= MIN_FAST_MS && p.ms < QUICK_MS
        ? 1
        : view.progress;
    default:
      return null;
  }
}

/** One finished plate. */
export function advanceDareOnPlate(
  rec: ChefRecord,
  dayKey: string,
  level: number,
  plate: DarePlate,
): DareResult {
  const view = dareToday(rec, dayKey, level);
  if (!view || view.status !== "accepted") return { rec, won: null };
  const next = plateProgress(view, plate);
  if (next === null) return { rec, won: null };
  return advance(rec, view, next);
}

/** One finished service. */
export function advanceDareOnService(
  rec: ChefRecord,
  dayKey: string,
  level: number,
  service: { spotless: boolean },
): DareResult {
  const view = dareToday(rec, dayKey, level);
  if (!view || view.status !== "accepted" || view.dare.id !== "clean-freak")
    return { rec, won: null };
  return service.spotless ? advance(rec, view, 1) : { rec, won: null };
}

/** One business day that closed. */
export function advanceDareOnDay(
  rec: ChefRecord,
  dayKey: string,
  level: number,
  day: { noWaste: boolean },
): DareResult {
  const view = dareToday(rec, dayKey, level);
  if (!view || view.status !== "accepted" || view.dare.id !== "zero-waste")
    return { rec, won: null };
  return day.noWaste ? advance(rec, view, 1) : { rec, won: null };
}

/**
 * The line the Knife Report adds for an accepted plate dare, BEFORE the plate is saved (a preview of what `advanceDareOnPlate` will do):
 * the win, the progress, or a broken run. Null when no plate dare is accepted today or the plate changed nothing.
 */
export function dareReportLine(
  rec: ChefRecord,
  dayKey: string,
  level: number,
  plate: DarePlate,
): string | null {
  const view = dareToday(rec, dayKey, level);
  if (!view || view.status !== "accepted") return null;
  const next = plateProgress(view, plate);
  if (next === null) return null;
  if (next >= view.dare.goal) return `Dare won: ${view.dare.title}!`;
  if (view.dare.goal === 1) return null;
  if (next > view.progress) return `Dare: ${next} of ${view.dare.goal} ${view.dare.unit}`;
  return view.progress > 0 ? `Dare: the run ended at ${view.progress}. Try again?` : null;
}

/** The small progress text of a dare ("2 of 5 plates in a row"), or "". */
export function dareProgressText(v: DareView): string {
  return v.dare.goal > 1 ? `${v.progress} of ${v.dare.goal} ${v.dare.unit}` : "";
}
