/**
 * WHICH FESTIVALS ARE OPEN. RULE CHANGE (developer 2026-11-28: "the final 3rd round unlocks the next festival round and playable only after 10 serves or
 * levels"): the first opens at campaign level 10; every other one when the third stage of the festival before has been won AND 10 more services have been
 * played since (campaign levels, then Endless Restaurant orders: state.ts `servicesOf`). A festival once played stays open. Pure; it opens nothing on its
 * own and never blocks the campaign.
 */
import type { SaveData } from "../SaveManager";
import { restaurantLevelOf } from "../restaurant/restaurantMenu";
import {
  FESTIVAL_EVENTS,
  FESTIVAL_STAGES,
  FESTIVAL_WAIT_SERVICES,
  type FestivalEvent,
} from "./events";
import { festivalsOf, servicesOf } from "./state";

export type FestivalStatus =
  /** Opens at a campaign level. */
  | { state: "level"; level: number }
  /** Opens after the third stage of the festival before is won. */
  | { state: "previous"; previous: FestivalEvent }
  /** That is won: opens after more services. */
  | { state: "services"; left: number }
  | { state: "open" };

export function festivalStatus(save: SaveData, event: FestivalEvent): FestivalStatus {
  if (event.unlock.kind === "level")
    return restaurantLevelOf(save.levelProgress) >= event.unlock.level
      ? { state: "open" }
      : { state: "level", level: event.unlock.level };
  const festivals = festivalsOf(save);
  // played once, open for good
  if (festivals.record[event.id]) return { state: "open" };
  const previous = FESTIVAL_EVENTS[event.number - 2]!;
  const won = festivals.record[previous.id];
  if (!won || won.cleared < FESTIVAL_STAGES) return { state: "previous", previous };
  // (a save that won it before the count was kept has waited long enough)
  const left = FESTIVAL_WAIT_SERVICES - Math.max(0, servicesOf(save) - (won.wonAt ?? 0));
  return left > 0 ? { state: "services", left } : { state: "open" };
}

export const isFestivalOpen = (save: SaveData, event: FestivalEvent): boolean =>
  festivalStatus(save, event).state === "open";

/** An open festival that can be played and has never been: the one the Mini-games sheet points at. */
export const waitingFestival = (save: SaveData): FestivalEvent | undefined =>
  FESTIVAL_EVENTS.find(
    (e) => e.round && isFestivalOpen(save, e) && !festivalsOf(save).record[e.id],
  );
