/**
 * THE CHEF'S RECORD (the "Chef Pride" plan, developer 2026-11-23: recognition for Gen Z, "the game knows I'm getting better").
 *
 * What the player has actually done in the kitchen, remembered so the game can say so: their perfect cuts, their longest combo, their fastest
 * plate, their runs of clean and Masterful plates and how a service's average accuracy compares with the last one. It is the ONE place those
 * personal bests live; the Knife Report, the Level Complete card, the titles and the optional dares (later phases) all read it.
 *
 * Rules (CLAUDE.md §7, and the plan's guardrails):
 *  - Stored in `business.chefRecord` (optional; read through `chefRecordOf`, which clamps). No new top-level save field.
 *  - Presentation only: no money, no ledger, no wallet. Nothing here reads RESTAURANT_MODE, the clock or Math.random.
 *  - Every line the player is shown is TRUE of that player's own data: "news" exists only when a number beat a real earlier mark (never a first
 *    plate, never an equal), and it carries the real numbers. There is no population claim ("only 8% of chefs...") because the game has no population data.
 *  - Law 4 (the plate is the score): the near-miss line is words ("A hair from Masterful"), never digits.
 */
import type { SaveData } from "../SaveManager";
import { GRADE_THRESHOLDS } from "../CutEvaluator";
import type { QualityLabel } from "@/types/game";

/** Today's optional dare (skillChallenges.ts): the calendar day it belongs to, which dare, what the player did with it and how far it got. */
export type ChallengeState = {
  day: string;
  id: string;
  state: "accepted" | "declined" | "won";
  progress: number;
};

/** The last finished league week (restaurant/cityLeague.ts): its league, where the player finished among the ten, whether it earned a promotion, and whether the player was told. */
export type LeagueResult = {
  week: string;
  tier: number;
  rank: number;
  points: number;
  promoted: boolean;
  shown: boolean;
};

/** The local weekly league (restaurant/cityLeague.ts): the week it is counting (the Monday's date), the league (0-4), this week's points and the last finished week. */
export type LeagueState = {
  week: string;
  tier: number;
  points: number;
  last: LeagueResult | null;
};

export type ChefRecord = {
  /** Plates finished (every kind of run counts). */
  plates: number;
  /** Perfect cuts landed, ever, and the most in one plate. */
  perfectCuts: number;
  bestPerfects: number;
  /** The longest combo of any plate. */
  bestCombo: number;
  /** Plates at "Masterful" (95+), ever. */
  masterful: number;
  /** The current and the best run of plates at "Clean" (85+) or better, and of "Masterful" plates, in a row. */
  runClean: number;
  bestRunClean: number;
  runMasterful: number;
  bestRunMasterful: number;
  /** The fastest finished plate, in ms (0 = none yet). Only a plate that ran unpaused counts. */
  fastestMs: number;
  /** Plates at Clean (85+) or better finished in under QUICK_MS, ever. Still counted and saved (a known field is never dropped), but since the Batch 4 audit the Speed title reads `fastestMs`, not this. */
  quickClean: number;
  /** Services recorded here, the best average plate accuracy of a service (0-100), the last one, and the most perfect cuts in one service. */
  services: number;
  bestServiceAccuracy: number;
  lastServiceAccuracy: number;
  bestServicePerfects: number;
  /** Today's dare, or null (the dare of another day is ignored). Dares won, ever (the dares ladder). */
  challenge: ChallengeState | null;
  daresWon: number;
  /** Dinner Rushes cleared, ever (restaurant/dinnerRush.ts: 0 or 1 today; the Rush Hour badge reads it). */
  rushes: number;
  /** The local weekly city league, or null before the first points. */
  league: LeagueState | null;
  /** Short markers of what was already announced (`title:…`, `rival:…`): each line shows once. Kept short. */
  seen: string[];
};

/** What one finished plate tells the record (collected in Preparation). */
export type RunStats = {
  /** The plate's score, 0-100. */
  score: number;
  /** Perfect cuts landed in this plate, and its longest combo. */
  perfects: number;
  bestCombo: number;
  /** Cuts made, and the time the plate took in ms (0 = unknown, e.g. the game was paused). */
  cuts: number;
  ms: number;
  /** True when the hired Prep Cook cut this plate (Auto): the run has no hand-cut perfect cuts to speak of. Used by the shift card only; never saved. */
  byCook?: boolean;
};

/** What one finished service tells the record. */
export type ServiceStats = {
  /** Plates served and their average score, 0-100. */
  orders: number;
  accuracy: number;
  /** Perfect cuts landed across the service. */
  perfects: number;
};

/** Something this plate or service beat: a real earlier mark. */
export type RecordNews = { kind: "perfects" | "combo" | "speed" | "accuracy"; text: string };

export const CLEAN_FROM = 85;
/** A plate under this many ms, at Clean or better, counts as a quick plate (Speed title). */
export const QUICK_MS = 30000;
export const MASTERFUL_FROM = 95;
/** A plate shorter than this is not a fair "fastest" (a smash or a peel only). */
export const MIN_FAST_MS = 4000;
/** How many announced markers are kept. */
export const SEEN_KEPT = 60;
/** A plate this close under the next grade reads as a near miss (in score points). */
export const NEAR_MISS_POINTS = 4;

const whole = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
const pct = (v: unknown) => Math.min(100, whole(v));

export const DEFAULT_CHEF_RECORD: ChefRecord = {
  plates: 0,
  perfectCuts: 0,
  bestPerfects: 0,
  bestCombo: 0,
  masterful: 0,
  runClean: 0,
  bestRunClean: 0,
  runMasterful: 0,
  bestRunMasterful: 0,
  fastestMs: 0,
  quickClean: 0,
  services: 0,
  bestServiceAccuracy: 0,
  lastServiceAccuracy: 0,
  bestServicePerfects: 0,
  challenge: null,
  daresWon: 0,
  rushes: 0,
  league: null,
  seen: [],
};

/** The save's chef record (clamped; defaults when absent). */
export function chefRecordOf(save: SaveData): ChefRecord {
  return clampChefRecord(save.business.chefRecord);
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function clampLeague(raw: unknown): LeagueState | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Partial<Record<keyof LeagueState, unknown>>;
  if (typeof l.week !== "string" || !DAY_KEY.test(l.week)) return null;
  const lr = l.last as Partial<Record<keyof LeagueResult, unknown>> | null | undefined;
  const last: LeagueResult | null =
    lr && typeof lr === "object" && typeof lr.week === "string" && DAY_KEY.test(lr.week)
      ? {
          week: lr.week,
          tier: Math.min(4, whole(lr.tier)),
          rank: Math.min(10, Math.max(1, whole(lr.rank))),
          points: whole(lr.points),
          promoted: lr.promoted === true,
          shown: lr.shown === true,
        }
      : null;
  return { week: l.week, tier: Math.min(4, whole(l.tier)), points: whole(l.points), last };
}

function clampChallenge(raw: unknown): ChallengeState | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<Record<keyof ChallengeState, unknown>>;
  if (typeof c.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(c.day)) return null;
  if (typeof c.id !== "string" || c.id.length === 0 || c.id.length > 32) return null;
  if (c.state !== "accepted" && c.state !== "declined" && c.state !== "won") return null;
  return { day: c.day, id: c.id, state: c.state, progress: Math.min(99, whole(c.progress)) };
}

/** Clamps any stored shape to a valid record (old saves, hand-edited saves). */
export function clampChefRecord(raw: unknown): ChefRecord {
  if (!raw || typeof raw !== "object") return DEFAULT_CHEF_RECORD;
  const r = raw as Partial<Record<keyof ChefRecord, unknown>>;
  const runClean = whole(r.runClean);
  const runMasterful = whole(r.runMasterful);
  const perfectCuts = whole(r.perfectCuts);
  return {
    plates: whole(r.plates),
    perfectCuts,
    bestPerfects: Math.min(perfectCuts, whole(r.bestPerfects)),
    bestCombo: whole(r.bestCombo),
    masterful: whole(r.masterful),
    runClean,
    bestRunClean: Math.max(runClean, whole(r.bestRunClean)),
    runMasterful,
    bestRunMasterful: Math.max(runMasterful, whole(r.bestRunMasterful)),
    fastestMs: whole(r.fastestMs),
    quickClean: whole(r.quickClean),
    services: whole(r.services),
    bestServiceAccuracy: pct(r.bestServiceAccuracy),
    lastServiceAccuracy: pct(r.lastServiceAccuracy),
    bestServicePerfects: whole(r.bestServicePerfects),
    challenge: clampChallenge(r.challenge),
    daresWon: whole(r.daresWon),
    rushes: whole(r.rushes),
    league: clampLeague(r.league),
    seen: Array.isArray(r.seen)
      ? r.seen.filter((s): s is string => typeof s === "string").slice(-SEEN_KEPT)
      : [],
  };
}

/** The record after one finished plate. */
export function recordRun(rec: ChefRecord, run: RunStats): ChefRecord {
  const score = pct(run.score);
  const clean = score >= CLEAN_FROM;
  const masterful = score >= MASTERFUL_FROM;
  const perfects = whole(run.perfects);
  const runClean = clean ? rec.runClean + 1 : 0;
  const runMasterful = masterful ? rec.runMasterful + 1 : 0;
  const ms = whole(run.ms);
  const fair = ms >= MIN_FAST_MS && whole(run.cuts) >= 3;
  return {
    ...rec,
    plates: rec.plates + 1,
    perfectCuts: rec.perfectCuts + perfects,
    bestPerfects: Math.max(rec.bestPerfects, perfects),
    bestCombo: Math.max(rec.bestCombo, whole(run.bestCombo)),
    masterful: rec.masterful + (masterful ? 1 : 0),
    runClean,
    bestRunClean: Math.max(rec.bestRunClean, runClean),
    runMasterful,
    bestRunMasterful: Math.max(rec.bestRunMasterful, runMasterful),
    fastestMs: fair && (rec.fastestMs === 0 || ms < rec.fastestMs) ? ms : rec.fastestMs,
    quickClean: rec.quickClean + (fair && clean && ms < QUICK_MS ? 1 : 0),
  };
}

/** The record after one finished service (its average accuracy and perfect cuts). */
export function recordService(rec: ChefRecord, service: ServiceStats): ChefRecord {
  if (whole(service.orders) <= 0) return rec;
  const accuracy = pct(service.accuracy);
  return {
    ...rec,
    services: rec.services + 1,
    bestServiceAccuracy: Math.max(rec.bestServiceAccuracy, accuracy),
    lastServiceAccuracy: accuracy,
    bestServicePerfects: Math.max(rec.bestServicePerfects, whole(service.perfects)),
  };
}

/**
 * The best plate the chef ever cooked (0-100): the plan's `bestPlate` (audit Batch 4, developer 2026-11-23). It is DERIVED, not saved: the recipe book already keeps the best
 * score of every dish (`recipeProgress[id].best`, written on every finished campaign plate), so a second copy in `chefRecord` would only be able to disagree with it, and
 * the save gets no new field. Business-service plates keep no recipe record (CLAUDE.md §10), so they are not in it. A damaged or missing book reads 0.
 */
export function bestPlateOf(save: SaveData): number {
  let best = 0;
  for (const entry of Object.values(save.recipeProgress ?? {})) {
    const v = entry?.best;
    if (typeof v === "number" && Number.isFinite(v))
      best = Math.max(best, Math.min(100, Math.floor(v)));
  }
  return best;
}

/** The save with one plate recorded. */
export function applyRun(save: SaveData, run: RunStats): SaveData {
  return {
    ...save,
    business: { ...save.business, chefRecord: recordRun(chefRecordOf(save), run) },
  };
}

/** The save with one service recorded. */
export function applyService(save: SaveData, service: ServiceStats): SaveData {
  return {
    ...save,
    business: { ...save.business, chefRecord: recordService(chefRecordOf(save), service) },
  };
}

/** `38 s` for a plate time. */
export function secondsText(ms: number): string {
  return `${Math.round(ms / 1000)} s`;
}

/**
 * What this plate beat. News needs a real earlier mark to beat (a first plate sets the mark, it is not "a record") and must be strictly better;
 * the text carries the real numbers.
 */
export function runNews(before: ChefRecord, run: RunStats): RecordNews[] {
  const news: RecordNews[] = [];
  const perfects = whole(run.perfects);
  if (before.bestPerfects > 0 && perfects > before.bestPerfects)
    news.push({ kind: "perfects", text: `Most perfect cuts in a plate: ${perfects}` });
  const combo = whole(run.bestCombo);
  if (before.bestCombo > 0 && combo > before.bestCombo)
    news.push({ kind: "combo", text: `Longest combo yet: ${combo}` });
  const ms = whole(run.ms);
  if (
    before.fastestMs > 0 &&
    ms >= MIN_FAST_MS &&
    whole(run.cuts) >= 3 &&
    ms < before.fastestMs &&
    Math.round(ms / 1000) < Math.round(before.fastestMs / 1000)
  )
    news.push({ kind: "speed", text: `Fastest plate yet: ${secondsText(ms)}` });
  return news;
}

/** What this service beat: its average accuracy against the last service's and against the best. */
export function serviceNews(before: ChefRecord, service: ServiceStats): RecordNews[] {
  if (whole(service.orders) <= 0 || before.services <= 0) return [];
  const accuracy = pct(service.accuracy);
  if (before.lastServiceAccuracy > 0 && accuracy > before.lastServiceAccuracy)
    return [
      {
        kind: "accuracy",
        text:
          accuracy > before.bestServiceAccuracy
            ? `Your most accurate service yet: ${accuracy}%`
            : `Accuracy up from ${before.lastServiceAccuracy}% to ${accuracy}%`,
      },
    ];
  return [];
}

/** The next grade up from a score, or null at the top. */
function nextGradeAbove(score: number): { label: QualityLabel; from: number } | null {
  const above = GRADE_THRESHOLDS.filter(([t]) => t > score).sort((a, b) => a[0] - b[0])[0];
  return above ? { label: above[1], from: above[0] } : null;
}

/**
 * Near-miss framing, in words only (Law 4: the plate is the score): a plate a few points under the next grade says so. Null otherwise
 * (and never for "Learning" up to "Rustic": that gap is not a near miss, it is a first step).
 */
export function nearMiss(score: number): string | null {
  const s = pct(score);
  if (s < 70) return null;
  const next = nextGradeAbove(s);
  if (!next) return null;
  return next.from - s <= NEAR_MISS_POINTS ? `A hair from ${next.label}. One more try?` : null;
}

/** Marks an announcement as shown (kept short). */
export function markSeen(rec: ChefRecord, id: string): ChefRecord {
  if (rec.seen.includes(id)) return rec;
  return { ...rec, seen: [...rec.seen, id].slice(-SEEN_KEPT) };
}

export const hasSeen = (rec: ChefRecord, id: string): boolean => rec.seen.includes(id);
