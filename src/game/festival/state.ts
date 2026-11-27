/**
 * THE FESTIVALS' SAVE (developer 2026-11-27: the one new field was approved): `business.festivals`, optional, so an old save needs no migration. It keeps
 * each festival's record, when its last stage was won, and where the count of services after the campaign starts. No money: nothing here touches the
 * wallet or the ledger, and playing a festival again can never pay anything.
 */
import type { SaveData } from "../SaveManager";
import { isEndlessUnlocked } from "../daily/EndlessServiceManager";
import { FESTIVAL_STAGES } from "./events";

export type FestivalRecord = {
  plays: number;
  wins: number;
  best: number;
  stars: number;
  /** The highest stage won (0: none yet): the next one is open. */
  cleared: number;
  /** `servicesOf` when its third stage was first won: the next festival opens FESTIVAL_WAIT_SERVICES after it. */
  wonAt?: number;
  /** Written by the first build's schedule and no longer read; kept, never dropped. */
  playedAtOrder?: number;
};

const MOST_STAGES = 15;

export type FestivalsState = {
  v: 1;
  record: Record<string, FestivalRecord>;
  /** The lifetime order count when the campaign was complete and the Endless Restaurant served its first order. */
  campaignDoneAtOrder?: number;
};

const whole = (n: unknown, max = Number.MAX_SAFE_INTEGER): number =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0;
const optional = (n: unknown): number | undefined =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;

/** The festivals of a save: empty when it has none or the value is damaged. */
export function festivalsOf(save: SaveData): FestivalsState {
  const raw = save.business.festivals as Partial<FestivalsState> | undefined;
  const record: Record<string, FestivalRecord> = {};
  if (raw?.record && typeof raw.record === "object")
    for (const [id, r] of Object.entries(raw.record)) {
      if (!r || typeof r !== "object") continue;
      const wonAt = optional(r.wonAt);
      const playedAtOrder = optional(r.playedAtOrder);
      record[id] = {
        plays: whole(r.plays),
        wins: whole(r.wins),
        best: whole(r.best),
        stars: whole(r.stars, 3),
        cleared: whole(r.cleared, MOST_STAGES),
        ...(wonAt === undefined ? {} : { wonAt }),
        ...(playedAtOrder === undefined ? {} : { playedAtOrder }),
      };
    }
  const done = optional(raw?.campaignDoneAtOrder);
  return { v: 1, record, ...(done === undefined ? {} : { campaignDoneAtOrder: done }) };
}

/** The menu orders served in the restaurant's whole life (the count the Business P&L already keeps). */
export const lifetimeOrdersOf = (save: SaveData): number =>
  whole(save.business.finance?.lifetime?.orderCount);

/**
 * The services played so far, one count that only grows: the campaign levels completed, then (after the campaign) the orders of the Endless Restaurant,
 * counted from the first one.
 */
export function servicesOf(save: SaveData): number {
  const campaign = new Set(save.levelProgress.completedLevelIds).size;
  const from = festivalsOf(save).campaignDoneAtOrder;
  return from === undefined || !isEndlessUnlocked(save.levelProgress)
    ? campaign
    : campaign + Math.max(0, lifetimeOrdersOf(save) - from);
}

const withFestivals = (save: SaveData, festivals: FestivalsState): SaveData => ({
  ...save,
  business: { ...save.business, festivals },
});

/** The stage the player is on: the one after the highest won, up to the event's last. */
export const stageToPlay = (save: SaveData, eventId: string, stages: number): number =>
  Math.min(stages, (festivalsOf(save).record[eventId]?.cleared ?? 0) + 1);

/** A finished round (never a round that was left): counted, with the best score and stars kept, and its stage cleared when it was won. */
export function recordFestivalRound(
  save: SaveData,
  eventId: string,
  round: { score: number; stars: number; won: boolean; stage?: number },
): SaveData {
  const state = festivalsOf(save);
  const before = state.record[eventId];
  const cleared = Math.max(
    before?.cleared ?? 0,
    round.won ? whole(round.stage ?? 1, MOST_STAGES) : 0,
  );
  // the third stage, won now for the first time: the next festival's wait starts here
  const wonAt =
    before?.wonAt ??
    ((before?.cleared ?? 0) < FESTIVAL_STAGES && cleared >= FESTIVAL_STAGES
      ? servicesOf(save)
      : undefined);
  return withFestivals(save, {
    ...state,
    record: {
      ...state.record,
      [eventId]: {
        plays: (before?.plays ?? 0) + 1,
        wins: (before?.wins ?? 0) + (round.won ? 1 : 0),
        best: Math.max(before?.best ?? 0, whole(round.score)),
        stars: Math.max(before?.stars ?? 0, whole(round.stars, 3)),
        cleared,
        ...(wonAt === undefined ? {} : { wonAt }),
        ...(before?.playedAtOrder === undefined ? {} : { playedAtOrder: before.playedAtOrder }),
      },
    },
  });
}

/** Remembers, once, where the after-campaign count starts: `countBefore` is the order count before the first Endless Restaurant order. */
export function withFestivalBaseline(save: SaveData, countBefore: number): SaveData {
  const state = festivalsOf(save);
  if (state.campaignDoneAtOrder !== undefined) return save;
  return withFestivals(save, { ...state, campaignDoneAtOrder: whole(countBefore) });
}
