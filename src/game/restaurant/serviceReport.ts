/**
 * THE RESTAURANT'S NUMBERS (supplies plan Phase D, developer 2026-10-10:
 * "the gamers should feel like they are actually working and managing a
 * real restaurant and they should feel proud after successfully
 * progressing their restaurant").
 *
 * After each service (a first completion, App.completeCampaignLevel, after
 * the wash-up) `closeServiceReport` reads what the service did from the
 * running totals the supplies already keep (`restaurantSupplies`: covers
 * served, takeaway orders, pieces packed, washed, broken) — the difference
 * since the last report — and whether it was SPOTLESS: from dine-in (L31)
 * a service is spotless when the wash-up had soap, nothing is left dirty
 * and the cleaning liquid isn't empty. Spotless services build a streak;
 * the record keeps the best. The last service's hygiene is what the
 * restaurant inspector (L91+, businessInspection) looks at, and a streak
 * of SPOTLESS_QUALITY_STREAK adds SPOTLESS_QUALITY_PCT to the quality
 * share (restaurantEconomy.restaurantQualityBonusPct).
 *
 * Stored in `business.restaurantRecord` (optional; read through
 * `restaurantRecordOf`, which clamps). No money, no ledger. Nothing reads
 * RESTAURANT_MODE; no randomness.
 */
import type { SaveData } from "../SaveManager";
import { isSystemLive } from "./restaurantProgression";
import { bottleView, restaurantSuppliesOf } from "./serviceSupplies";
import { isSpotless, type ServiceHygiene } from "./hygiene";

export { hygieneIssue, isSpotless, type ServiceHygiene } from "./hygiene";

export type RestaurantRecord = {
  /** Services reported (first completions in the restaurant). */
  services: number;
  /** Spotless services ever, the current streak and the best. */
  spotless: number;
  streak: number;
  bestStreak: number;
  /** The supplies' running totals at the last report (the next report is the difference). */
  at: { covers: number; takeaway: number; packed: number; washed: number; broken: number };
  /** The last service's hygiene (null before dine-in). */
  lastHygiene: ServiceHygiene | null;
};

export const SPOTLESS_QUALITY_STREAK = 3;
/** A fraction of the order pay, like every quality share (0.01 = 1 %). */
export const SPOTLESS_QUALITY_PCT = 0.01;

const whole = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;

export const DEFAULT_RESTAURANT_RECORD: RestaurantRecord = {
  services: 0,
  spotless: 0,
  streak: 0,
  bestStreak: 0,
  at: { covers: 0, takeaway: 0, packed: 0, washed: 0, broken: 0 },
  lastHygiene: null,
};

/** The save's record (clamped; defaults when absent). */
export function restaurantRecordOf(save: SaveData): RestaurantRecord {
  const raw = save.business.restaurantRecord as Partial<RestaurantRecord> | undefined;
  if (!raw || typeof raw !== "object") return DEFAULT_RESTAURANT_RECORD;
  const at = (raw.at ?? {}) as Partial<RestaurantRecord["at"]>;
  const h = raw.lastHygiene as Partial<ServiceHygiene> | null | undefined;
  const streak = whole(raw.streak);
  return {
    services: whole(raw.services),
    spotless: whole(raw.spotless),
    streak,
    bestStreak: Math.max(streak, whole(raw.bestStreak)),
    at: {
      covers: whole(at.covers),
      takeaway: whole(at.takeaway),
      packed: whole(at.packed),
      washed: whole(at.washed),
      broken: whole(at.broken),
    },
    lastHygiene:
      h && typeof h === "object"
        ? { soap: h.soap !== false, cleaner: h.cleaner !== false, dirtyLeft: whole(h.dirtyLeft) }
        : null,
  };
}

/** What one service did. `spotless` null before dine-in (nothing to keep clean yet). */
export type ServiceReport = {
  covers: number;
  takeaway: number;
  packed: number;
  washed: number;
  broken: number;
  spotless: boolean | null;
  hygiene: ServiceHygiene | null;
  streak: number;
  /** This service set a new best streak. */
  newBest: boolean;
};

/**
 * Closes one service's report: the difference since the last report, the
 * hygiene after the wash-up (`noSoap` from `washUp`), the streak. Call it
 * after the service's wash-up.
 */
export function closeServiceReport(
  save: SaveData,
  levelNumber: number,
  noSoap: boolean,
): { save: SaveData; report: ServiceReport } {
  const rec = restaurantRecordOf(save);
  const sup = restaurantSuppliesOf(save);
  const now = {
    covers: sup.coversTotal,
    takeaway: sup.takeawayTotal,
    packed: sup.packedTotal,
    washed: sup.washedTotal,
    broken: sup.brokenTotal,
  };
  const diff = (k: keyof typeof now) => Math.max(0, now[k] - rec.at[k]);
  const hygiene: ServiceHygiene | null = isSystemLive("dine-in", levelNumber)
    ? {
        soap: !noSoap,
        cleaner: bottleView(save, "cleaning-liquid").status !== "empty",
        dirtyLeft: Object.values(sup.dirty).reduce((t, n) => t + (n ?? 0), 0),
      }
    : null;
  const spotless = hygiene ? isSpotless(hygiene) : null;
  const streak = spotless === null ? rec.streak : spotless ? rec.streak + 1 : 0;
  const next: RestaurantRecord = {
    services: rec.services + 1,
    spotless: rec.spotless + (spotless ? 1 : 0),
    streak,
    bestStreak: Math.max(rec.bestStreak, streak),
    at: now,
    lastHygiene: hygiene,
  };
  return {
    save: { ...save, business: { ...save.business, restaurantRecord: next } },
    report: {
      covers: diff("covers"),
      takeaway: diff("takeaway"),
      packed: diff("packed"),
      washed: diff("washed"),
      broken: diff("broken"),
      spotless,
      hygiene,
      streak,
      newBest: streak > rec.bestStreak && streak > 1,
    },
  };
}

/** Level Complete's lines for a report (empty when there's nothing to say). */
export function serviceReportLines(r: ServiceReport): string[] {
  const parts: string[] = [];
  if (r.covers > 0) parts.push(`🍽️ ${r.covers} ${r.covers === 1 ? "guest" : "guests"} served`);
  if (r.takeaway > 0)
    parts.push(`🥡 ${r.takeaway} takeaway${r.packed > 0 ? ` (${r.packed} pieces packed)` : ""}`);
  if (r.washed > 0) parts.push(`🧼 ${r.washed} washed`);
  const lines = parts.length ? [parts.join(" · ")] : [];
  if (r.spotless === true)
    lines.push(`✨ Spotless service · ${r.streak} in a row${r.newBest ? " — your best yet!" : ""}`);
  else if (r.spotless === false && r.hygiene) {
    const why = [
      !r.hygiene.soap ? "no dish soap" : null,
      r.hygiene.dirtyLeft > 0 ? `${r.hygiene.dirtyLeft} dirty pieces left` : null,
      !r.hygiene.cleaner ? "no cleaning liquid" : null,
    ].filter(Boolean);
    lines.push(`🧽 Not spotless: ${why.join(", ")} — the streak starts again`);
  }
  return lines;
}

/** The quality share a spotless streak adds (restaurantQualityBonusPct). */
export function spotlessQualityPct(save: SaveData): number {
  return restaurantRecordOf(save).streak >= SPOTLESS_QUALITY_STREAK ? SPOTLESS_QUALITY_PCT : 0;
}
