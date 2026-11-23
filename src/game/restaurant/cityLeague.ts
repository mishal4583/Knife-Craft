/**
 * THE CITY LEAGUE (the "Chef Pride" plan, Phase 5, developer 2026-11-23: "weekly competition, Bronze to Diamond", LOCAL: the player's restaurant against the city's rivals).
 *
 * Every week (Monday to Sunday of the device's calendar) the player earns LEAGUE POINTS from real play and competes with nine of the city's 49 rival restaurants for a place
 * in a table of ten. Finish in the top three and the league goes up one (Bronze, Silver, Gold, Platinum, Diamond; Apprentice Chef to Legendary Chef). THERE IS NO DEMOTION and
 * no penalty: a poor or an empty week keeps the league as it was.
 *
 * It is a contest against the game's restaurants, never against other players, and the card says so: there is no server and no fake player data. The rivals' weekly points
 * come from a fixed formula (a seeded generator over the week, the league and the rival), scaled to the player's league so the contest is always fair and never impossible;
 * they build up through the week in step with the days, so the table moves while the week goes on.
 *
 * Points: 1 for a perfect cut, 2 for a plate at Clean or better, 10 for a finished service, 15 more when it was spotless. The week the player started counting is kept in
 * `chefRecord.league`; a week that has ended is settled (its result kept in `league.last`) the next time the league is looked at. No money, no ledger, no ad.
 *
 * The league names, weights and the rivals' scale are drafts for the developer to tune after real data (docs/planning/CHEF-PRIDE-MEASUREMENT-2026-11-23.md): change them here
 * only. Pure and deterministic: the day key is a parameter (the caller reads the calendar), no clock, no random, no wallet.
 */
import { hashString } from "../daily/DailyOrderManager";
import { makeSeededRand } from "../business/businessDeterministicRandom";
import { CLEAN_FROM, type ChefRecord, type LeagueResult, type LeagueState } from "./chefRecord";
import { RIVALS, type RankedRival } from "./cityRanking";

/** The league opens with this level. */
export const LEAGUE_FROM_LEVEL = 10;
/** A table of ten: the player and nine of the city's restaurants. */
export const LEAGUE_SIZE = 10;
/** Finishing at this place or better goes up a league. */
export const PROMOTION_RANK = 3;

export type League = {
  tier: number;
  /** "Bronze" */
  name: string;
  /** "Apprentice Chef" */
  identity: string;
  /** What a typical rival earns in a week of this league (the scale of their points). */
  rivalBase: number;
};

export const LEAGUES: readonly League[] = [
  { tier: 0, name: "Bronze", identity: "Apprentice Chef", rivalBase: 100 },
  { tier: 1, name: "Silver", identity: "Skilled Chef", rivalBase: 160 },
  { tier: 2, name: "Gold", identity: "Master Chef", rivalBase: 240 },
  { tier: 3, name: "Platinum", identity: "Executive Chef", rivalBase: 340 },
  { tier: 4, name: "Diamond", identity: "Legendary Chef", rivalBase: 480 },
];

/** A rival earns between this share and that share of the league's base in a week. */
export const RIVAL_SPREAD: readonly [number, number] = [0.55, 1.35];

export const POINTS = { perfectCut: 1, cleanPlate: 2, service: 10, spotless: 15 } as const;

// ── Weeks ────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};

/** The Monday of the week a calendar day ("YYYY-MM-DD") is in, as a day key. */
export function weekStartOf(dayKey: string): string {
  const d = dateOf(dayKey);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return keyOf(d);
}

/** 1 (Monday) to 7 (Sunday). */
export function dayOfWeek(dayKey: string): number {
  return ((dateOf(dayKey).getDay() + 6) % 7) + 1;
}

// ── The rivals ───────────────────────────────────────────────────────────────

/** The nine rival restaurants of a week and a league: a seeded draw of distinct rivals, the same every time for the same week and league. */
export function weekRivals(week: string, tier: number): RankedRival[] {
  const rand = makeSeededRand(hashString(`league:${week}:${tier}`));
  const pool = [...RIVALS];
  const out: RankedRival[] = [];
  while (out.length < LEAGUE_SIZE - 1 && pool.length > 0) {
    const i = Math.floor(rand() * pool.length);
    out.push(pool.splice(i, 1)[0]!);
  }
  return out;
}

/** What a rival earns in the WHOLE week: the league's base scaled by a seeded share (always the same for the same week, league and rival). */
export function rivalWeekPoints(week: string, tier: number, rivalId: string): number {
  const rand = makeSeededRand(hashString(`league-points:${week}:${tier}:${rivalId}`));
  const [lo, hi] = RIVAL_SPREAD;
  return Math.round(
    LEAGUES[Math.min(tier, LEAGUES.length - 1)]!.rivalBase * (lo + rand() * (hi - lo)),
  );
}

export type Standing = { id: string; name: string; emoji: string; points: number; player: boolean };

/**
 * The table of a week at a given day: the player and the nine rivals, best first. A rival's points build up through the week in step with the days (a seventh each day,
 * the whole of it by Sunday); `final` makes it the finished week's table. Ties go to the rival.
 */
export function weekTable(
  week: string,
  tier: number,
  playerPoints: number,
  dayKey: string | "final",
): Standing[] {
  const share = dayKey === "final" ? 1 : dayOfWeek(dayKey) / 7;
  const rows: Standing[] = weekRivals(week, tier).map((r) => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    points: Math.round(rivalWeekPoints(week, tier, r.id) * share),
    player: false,
  }));
  rows.push({
    id: "player",
    name: "You",
    emoji: "🧑‍🍳",
    points: Math.max(0, Math.floor(playerPoints)),
    player: true,
  });
  return rows.sort((a, b) => b.points - a.points || Number(a.player) - Number(b.player));
}

export const playerRankIn = (table: Standing[]): number => table.findIndex((r) => r.player) + 1;

// ── The player's week ────────────────────────────────────────────────────────

/** A fresh state for the week of this day. */
const fresh = (week: string, tier: number, last: LeagueResult | null): LeagueState => ({
  week,
  tier,
  points: 0,
  last,
});

/**
 * Settles a week that has ended: the finished table gives the player's place; the top three go up a league (never down); the result is kept in `last` (not shown yet)
 * and the new week starts empty. A week the player earned nothing in leaves no result (nothing to show) and changes no league.
 */
export function settleLeague(rec: ChefRecord, dayKey: string): ChefRecord {
  const state = rec.league;
  const week = weekStartOf(dayKey);
  if (!state || state.week === week) return rec;
  if (state.points <= 0) return { ...rec, league: fresh(week, state.tier, state.last) };
  const rank = playerRankIn(weekTable(state.week, state.tier, state.points, "final"));
  const promoted = rank <= PROMOTION_RANK && state.tier < LEAGUES.length - 1;
  const last: LeagueResult = {
    week: state.week,
    tier: state.tier,
    rank,
    points: state.points,
    promoted,
    shown: false,
  };
  return { ...rec, league: fresh(week, promoted ? state.tier + 1 : state.tier, last) };
}

/** Adds league points earned now (settling an ended week first). Nothing below the league's level, nothing for zero. */
export function addLeaguePoints(
  rec: ChefRecord,
  dayKey: string,
  level: number,
  points: number,
): ChefRecord {
  if (level < LEAGUE_FROM_LEVEL || points <= 0) return rec;
  const settled = settleLeague(rec, dayKey);
  const week = weekStartOf(dayKey);
  const state = settled.league ?? fresh(week, 0, null);
  return { ...settled, league: { ...state, week, points: state.points + Math.floor(points) } };
}

/** The league points one finished plate earns. */
export const pointsForPlate = (plate: { score: number; perfects: number }): number =>
  Math.max(0, Math.floor(plate.perfects)) * POINTS.perfectCut +
  (plate.score >= CLEAN_FROM ? POINTS.cleanPlate : 0);

/** The league points one finished service earns. */
export const pointsForService = (service: { spotless: boolean }): number =>
  POINTS.service + (service.spotless ? POINTS.spotless : 0);

// ── What the player sees ─────────────────────────────────────────────────────

export type LeagueView = {
  league: League;
  week: string;
  points: number;
  rank: number;
  table: Standing[];
  /** The league above, or null at the top. */
  next: League | null;
  /** The points that would earn third place today (the player's goal), or null when already there. */
  toPromotion: number | null;
};

/** The league as the player meets it today, or null before Level 10. A week that ended is settled first (pass the settled record). */
export function leagueView(rec: ChefRecord, dayKey: string, level: number): LeagueView | null {
  if (level < LEAGUE_FROM_LEVEL) return null;
  const settled = settleLeague(rec, dayKey);
  const week = weekStartOf(dayKey);
  const state = settled.league ?? fresh(week, 0, null);
  const league = LEAGUES[Math.min(state.tier, LEAGUES.length - 1)]!;
  const table = weekTable(week, state.tier, state.week === week ? state.points : 0, dayKey);
  const rank = playerRankIn(table);
  const third = table.filter((r) => !r.player)[PROMOTION_RANK - 1];
  return {
    league,
    week,
    points: state.week === week ? state.points : 0,
    rank,
    table,
    next: LEAGUES[league.tier + 1] ?? null,
    toPromotion:
      rank <= PROMOTION_RANK || !third
        ? null
        : Math.max(1, third.points - (state.week === week ? state.points : 0) + 1),
  };
}

/** The last week's result the player has not been told about yet, or null. */
export const pendingLeagueResult = (rec: ChefRecord): LeagueResult | null =>
  rec.league?.last && !rec.league.last.shown ? rec.league.last : null;

/** The record with the last result marked as told. */
export function markLeagueShown(rec: ChefRecord): ChefRecord {
  if (!rec.league?.last || rec.league.last.shown) return rec;
  return { ...rec, league: { ...rec.league, last: { ...rec.league.last, shown: true } } };
}
