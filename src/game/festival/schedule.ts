/**
 * WHICH FESTIVALS ARE OPEN (developer 2026-11-27). Events 1-9 open when the player reaches their campaign level (a save already past it finds them
 * open). Events 10-15 open after the campaign, counted in Endless Restaurant orders: Seafood 4 orders after the campaign is complete, then each next one
 * 4 orders (the Championship 5) after the one before was FIRST PLAYED, so two never arrive together; a loss counts as played. Pure; it opens nothing
 * on its own and never blocks the campaign.
 */
import type { SaveData } from "../SaveManager";
import { isEndlessUnlocked } from "../daily/EndlessServiceManager";
import { restaurantLevelOf } from "../restaurant/restaurantMenu";
import { FESTIVAL_EVENTS, type FestivalEvent } from "./events";
import { festivalsOf, lifetimeOrdersOf } from "./state";

export type FestivalStatus =
  /** Opens at a campaign level. */
  | { state: "level"; level: number }
  /** Opens after the campaign. */
  | { state: "campaign" }
  /** Opens once the festival before has been played. */
  | { state: "previous"; previous: FestivalEvent }
  /** Opens after more Endless Restaurant orders. */
  | { state: "orders"; left: number }
  | { state: "open" };

export function festivalStatus(save: SaveData, event: FestivalEvent): FestivalStatus {
  if (event.unlock.kind === "level")
    return restaurantLevelOf(save.levelProgress) >= event.unlock.level
      ? { state: "open" }
      : { state: "level", level: event.unlock.level };
  const festivals = festivalsOf(save);
  // played once, open for good
  if (festivals.record[event.id]) return { state: "open" };
  if (!isEndlessUnlocked(save.levelProgress)) return { state: "campaign" };
  const previous = FESTIVAL_EVENTS[event.number - 2]!;
  const count = lifetimeOrdersOf(save);
  let from: number;
  if (previous.unlock.kind === "level") from = festivals.campaignDoneAtOrder ?? count;
  else {
    const played = festivals.record[previous.id];
    if (!played) return { state: "previous", previous };
    from = played.playedAtOrder ?? count;
  }
  const left = event.unlock.gap - Math.max(0, count - from);
  return left > 0 ? { state: "orders", left } : { state: "open" };
}

export const isFestivalOpen = (save: SaveData, event: FestivalEvent): boolean =>
  festivalStatus(save, event).state === "open";

/** An open festival that can be played and has never been: the one the Mini-games sheet points at. */
export const waitingFestival = (save: SaveData): FestivalEvent | undefined =>
  FESTIVAL_EVENTS.find(
    (e) => e.round && isFestivalOpen(save, e) && !festivalsOf(save).record[e.id],
  );
