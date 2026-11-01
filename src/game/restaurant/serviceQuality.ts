/**
 * SERVICE QUALITY (Phase 8C, developer 2026-11-01: "service quality, shown"): the star rating of ONE service and
 * the short list of the last services. It is a REPORT first: the player sees which part cost a star.
 *
 *   ★ 1..5 = 1 + 4 × (points won ÷ points possible) over the parts the service had:
 *     dishes   0..2   the average grade of the plates: Masterful 2, Clean 1, weaker 0
 *     waits    0..1   nobody walked out and the average wait stayed under half the patience
 *     clean    0..1   the service was spotless
 *
 *  - From dine-in (L31) only; before it there is no report and the early game stays gentle (plan D-6).
 *  - Never money: no tip, price or pay reads it. What it feeds is small and capped: the day's popularity
 *    (`serviceQualityDelta`, +1 for a day averaging 4+ stars, −1 for 2 or less) and the report itself.
 *  - Turned-away guests are counted and shown (plan D-8) but never cost a star.
 *  - Stored in `business.restaurantDay.serviceResults` (optional, the last RESULTS_KEPT), read through `serviceResultsOf`.
 *
 * Pure: no React, no wallet, no ledger, no randomness. Reads `save.business.restaurantDay` raw so the popularity
 * module can use it without importing restaurantDay.ts (which imports it).
 */
import type { SaveData } from "../SaveManager";

export const RESULTS_KEPT = 7;

export type ServiceResult = {
  /** The campaign service (level number) this is the report of. */
  level: number;
  /** 1..5. */
  stars: number;
  /** The parts: points won (null: the service had none of that part). */
  dishes: number | null;
  waits: number | null;
  clean: number | null;
  /** Guests served (level orders, menu guests, walk-ins) and guests who walked out of the queue. */
  covers: number;
  walkedOut: number;
  /** Guests the room or team could not take (shown, never penalised). */
  turnedAway: number;
  /** Average wait at the door in whole seconds (null: no queue clock). */
  avgWaitSec: number | null;
};

export const PART_MAX = { dishes: 2, waits: 1, clean: 1 } as const;

export type RatingInput = {
  /** Preparation scores (0..100) of the plates served. */
  scores: readonly number[];
  walkedOut: number;
  /** Door waits of the guests served, in ms, and their patience (null: no queue clock, e.g. one at a time). */
  waitsMs: readonly number[];
  patienceMs: number | null;
  /** The service's hygiene verdict (null before dine-in). */
  spotless: boolean | null;
};

/** The grade points of an average preparation score (CutEvaluator's thresholds: 95 Masterful, 85 Clean). */
export function dishPoints(avgScore: number): number {
  return avgScore >= 95 ? 2 : avgScore >= 85 ? 1 : 0;
}

/** The star rating and its parts; null when the service had no part to judge. */
export function rateService(
  input: RatingInput,
): Pick<ServiceResult, "stars" | "dishes" | "waits" | "clean" | "avgWaitSec"> | null {
  const avgScore = input.scores.length
    ? input.scores.reduce((a, b) => a + b, 0) / input.scores.length
    : null;
  const avgWaitMs = input.waitsMs.length
    ? input.waitsMs.reduce((a, b) => a + b, 0) / input.waitsMs.length
    : 0;
  const clock = input.patienceMs !== null && Number.isFinite(input.patienceMs);
  const dishes = avgScore === null ? null : dishPoints(avgScore);
  const waits = !clock
    ? null
    : input.walkedOut === 0 && avgWaitMs <= (input.patienceMs as number) / 2
      ? 1
      : 0;
  const clean = input.spotless === null ? null : input.spotless ? 1 : 0;
  let won = 0;
  let possible = 0;
  if (dishes !== null) {
    won += dishes;
    possible += PART_MAX.dishes;
  }
  if (waits !== null) {
    won += waits;
    possible += PART_MAX.waits;
  }
  if (clean !== null) {
    won += clean;
    possible += PART_MAX.clean;
  }
  if (possible === 0) return null;
  return {
    stars: 1 + Math.round((4 * won) / possible),
    dishes,
    waits,
    clean,
    avgWaitSec: clock ? Math.round(avgWaitMs / 1000) : null,
  };
}

const whole = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
const part = (v: unknown, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : null;

/** The save's kept results (clamped; old saves have none). */
export function serviceResultsOf(save: SaveData): ServiceResult[] {
  const raw = (save.business.restaurantDay as { serviceResults?: unknown } | undefined)
    ?.serviceResults;
  if (!Array.isArray(raw)) return [];
  const out: ServiceResult[] = [];
  for (const r of raw as Partial<ServiceResult>[]) {
    if (!r || typeof r !== "object" || !whole(r.level)) continue;
    out.push({
      level: whole(r.level),
      stars: Math.min(5, Math.max(1, whole(r.stars))),
      dishes: part(r.dishes, PART_MAX.dishes),
      waits: part(r.waits, PART_MAX.waits),
      clean: part(r.clean, PART_MAX.clean),
      covers: whole(r.covers),
      walkedOut: whole(r.walkedOut),
      turnedAway: whole(r.turnedAway),
      avgWaitSec: typeof r.avgWaitSec === "number" ? whole(r.avgWaitSec) : null,
    });
  }
  return out.slice(-RESULTS_KEPT);
}

/** `results` with `next` added (a service is reported once: a later report of the same service replaces it). */
export function withServiceResult(
  results: readonly ServiceResult[],
  next: ServiceResult,
): ServiceResult[] {
  return [...results.filter((r) => r.level !== next.level), next].slice(-RESULTS_KEPT);
}

/** The save with `result` kept in the day state (no change when the day state does not exist yet). */
export function withRecordedResult(save: SaveData, result: ServiceResult): SaveData {
  const day = save.business.restaurantDay;
  if (!day) return save;
  return {
    ...save,
    business: {
      ...save.business,
      restaurantDay: {
        ...day,
        serviceResults: withServiceResult(serviceResultsOf(save), result),
      },
    },
  };
}

/** The services of the day that opened with `openingLevel`, from the kept results. */
export function dayResults(save: SaveData): ServiceResult[] {
  const opening = (save.business.restaurantDay as { openingLevel?: number | null } | undefined)
    ?.openingLevel;
  return opening === null || opening === undefined
    ? []
    : serviceResultsOf(save).filter((r) => r.level >= opening);
}

/** The day's popularity nudge: +1 for a day averaging 4+ stars, −1 for 2 or less, else 0 (and 0 without results). */
export function serviceQualityDelta(save: SaveData): number {
  const day = dayResults(save);
  if (day.length === 0) return 0;
  const avg = day.reduce((a, r) => a + r.stars, 0) / day.length;
  return avg >= 4 ? 1 : avg <= 2 ? -1 : 0;
}

/** Stars as text: "★★★★☆". */
export const starsText = (n: number) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

const tick = (n: number | null, max: number) => (n === null ? "–" : n >= max ? "✓" : "✗");

/** The Service Report's lines on the closing card (short: numbers and icons; the tip last). */
export function serviceResultLines(r: ServiceResult): string[] {
  const facts = [
    `🍽️ ${r.covers} served`,
    r.walkedOut > 0 ? `🚪 ${r.walkedOut} left` : null,
    r.turnedAway > 0 ? `🙁 ${r.turnedAway} turned away` : null,
    r.avgWaitSec !== null ? `⏱️ ${r.avgWaitSec}s wait` : null,
  ].filter((x): x is string => !!x);
  const tip = serviceTip(r);
  return [
    `⭐ Service ${starsText(r.stars)} · Dishes ${tick(r.dishes, PART_MAX.dishes)} · Waits ${tick(r.waits, PART_MAX.waits)} · Clean ${tick(r.clean, PART_MAX.clean)}`,
    facts.join(" · "),
    ...(tip ? [`💡 ${tip}`] : []),
  ];
}

/** The report's tip for next time: the one thing that cost the most, or null when nothing did. */
export function serviceTip(r: ServiceResult): string | null {
  if (r.walkedOut > 0)
    return `${r.walkedOut} ${r.walkedOut === 1 ? "guest" : "guests"} left the queue — a Server or Line Cook shortens the wait.`;
  if (r.turnedAway > 0)
    return `${r.turnedAway} ${r.turnedAway === 1 ? "guest" : "guests"} turned away — more staff or a bigger kitchen seats them.`;
  if (r.clean === 0) return "A spotless service pulls in an extra guest next time.";
  if (r.dishes !== null && r.dishes < PART_MAX.dishes)
    return "Cleaner cuts earn the higher grades — Masterful plates make the stars.";
  return null;
}
