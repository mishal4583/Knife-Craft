/**
 * THE FIRST DINNER RUSH (developer 2026-11-26, the first-20-levels engagement plan row 18: "first Dinner Rush: a surge of guests, a bonus for serving them all"; the developer chose
 * the opt-in version: Hype and a badge, no money, no timer). The evening service already pulls an extra guest (`guestDemand.ts`, the "hour" part of the pull, from the level dine-in
 * opens); what was missing was the MOMENT. The first Dinner service at or after `DINNER_RUSH.fromLevel` is announced as a rush, and clearing it (every guest of the service served and
 * nobody walked out) pays Hype and the "Rush Hour Hero" badge, once.
 *
 *  - NO new guests, queue, stock rule or arrival: the guests are the service's own (`serviceGuestPlan`), so the Pre-Service Check, the Pace card and the stock plan stay as they are.
 *  - It is optional by nature: Finish Level is always there, and a service that is not cleared loses nothing (the rush simply stays for the next Dinner).
 *  - NEVER money, stock or the ledger (the frozen economy baseline cannot move); the Hype is the Second Floor's meter, the same Hype the milestone chests give.
 *  - ONE memory, no new top-level save field: `business.chefRecord.rushes` (a counter, like `daresWon`; the `seen` list keeps only 60 markers and could drop one).
 * Pure; the app adds the Hype with `addHype` and shows the card.
 */
import type { SaveData } from "../SaveManager";
import { chefRecordOf } from "./chefRecord";
import { serviceGuestPlan } from "./menuGuests";
import { serviceNameAt } from "./guestDemand";
import type { Celebration } from "./celebrations";

export const DINNER_RUSH = {
  /** The first level that can bring it. */
  fromLevel: 18,
  /** The meal that is the rush. */
  service: "Dinner",
  /** A rush needs at least this many guests (a table of one is not a rush). */
  minGuests: 2,
  /** Hype for clearing it (the chests give 15 to 40). */
  hype: 30,
} as const;

export type DinnerRush = { guests: number };

/**
 * The Dinner Rush of service `n`, or null: only a FIRST play of the level, from `fromLevel`, when the service is the Dinner, the guests are at least `minGuests`, and the restaurant has
 * not cleared one yet.
 */
export function dinnerRushFor(save: SaveData, n: number, firstPlay: boolean): DinnerRush | null {
  if (!firstPlay || n < DINNER_RUSH.fromLevel) return null;
  if (chefRecordOf(save).rushes > 0) return null;
  if (serviceNameAt(save, n) !== DINNER_RUSH.service) return null;
  const guests = serviceGuestPlan(save, n).total;
  return guests >= DINNER_RUSH.minGuests ? { guests } : null;
}

/**
 * Cleared: every guest was served (the saved count of handled guests reached them all) AND nobody walked out. A guest who walks out is counted as handled in the save (so the next one is
 * offered), which is why the walk-outs are asked for separately; with no door queue to ask (a reload in the middle of the service) it is never cleared.
 */
export function rushCleared(rush: DinnerRush, handled: number, walkedOut: number | null): boolean {
  return walkedOut !== null && walkedOut === 0 && handled >= rush.guests;
}

/** The save with the rush cleared: the counter up by one (so it never comes again) and the Hype added by the caller. */
export function withRushCleared(save: SaveData): SaveData {
  const rec = chefRecordOf(save);
  return {
    ...save,
    business: { ...save.business, chefRecord: { ...rec, rushes: rec.rushes + 1 } },
  };
}

/** The Congratulations card of a cleared rush; lines of a ranking climb or a chest are appended so none is lost. */
export function dinnerRushCelebration(extra: readonly string[] = []): Celebration {
  return {
    kind: "rush",
    emoji: "🔥",
    title: "Dinner Rush cleared!",
    lines: [`⚡ +${DINNER_RUSH.hype} Hype`, "🏅 Rush Hour Hero", ...extra],
    paige: "Every guest served and not one walked out. That is how a restaurant is run!",
    pose: "cheer",
  };
}

/** The guest button's label while the rush is on: the same dish line, led by the rush and its count. */
export function rushLabel(number: number, total: number): string {
  return `🔥 Rush ${number}/${total}`;
}
