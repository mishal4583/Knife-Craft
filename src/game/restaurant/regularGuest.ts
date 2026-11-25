/**
 * THE REGULAR GUEST (developer 2026-11-25, the first-20-levels engagement plan row 13: "a regular with a face", "is back tomorrow"). From Level 13 one named guest, Sofia, is the
 * FIRST guest of every level the player plays for the first time: the same painted face, a greeting that remembers the visit, and a "regular" mark on the order card. It is a
 * reason to come back and a face to look for, nothing more: the dish, the pay, the stock and the score are exactly what the level's ticket says.
 *
 * Pure rules, NO SAVE FIELD: the visit number is the level number (Level 13 is her first visit), so there is nothing to store, nothing to migrate and nothing a missed day can
 * lose. Only a first play of a level uses her (a replay keeps its random guests, and a retry that already served a plate keeps the guest who ordered it). The swap happens on the
 * `ServiceSession` after it is built (`withRegularGuest`), so the order generator and its random sequence are untouched.
 */
import { CUSTOMERS } from "../customers/customerDefinitions";
import type { CustomerDefinition } from "../customers/customerTypes";
import type { ServiceSession } from "../service/ServiceManager";

/** The first level she visits. */
export const REGULAR_FROM_LEVEL = 13;
/** Her roster id (the painted portraits live under public/people/<id>/; her roster name is Sofia). */
export const REGULAR_ID = "priya";

/** What she says on each visit; the first is her first time, then they repeat in order. Short, warm, never about money. */
export const REGULAR_GREETINGS: readonly string[] = [
  "First time here. I have a good feeling about this place.",
  "Back again, chef! The usual, please.",
  "You remembered me!",
  "I told my friends about this place.",
  "Same time tomorrow, I think.",
  "Nobody cuts like you do. Surprise me!",
];

/** Her visit number on a level (1 on Level 13), or 0 when she does not come yet. */
export function regularVisit(levelNumber: number): number {
  const n = Math.floor(levelNumber);
  return n >= REGULAR_FROM_LEVEL ? n - REGULAR_FROM_LEVEL + 1 : 0;
}

/** What she says on a visit (1-based): the first is special, the rest cycle. */
export function regularGreeting(visit: number): string {
  if (visit <= 1) return REGULAR_GREETINGS[0]!;
  const rest = REGULAR_GREETINGS.slice(1);
  return rest[(visit - 2) % rest.length]!;
}

/** She as this level's guest, or null before Level 13 or when she is not on the roster. */
export function regularCustomer(levelNumber: number): CustomerDefinition | null {
  const visit = regularVisit(levelNumber);
  if (visit <= 0) return null;
  const base = CUSTOMERS.find((c) => c.id === REGULAR_ID);
  if (!base) return null;
  return { ...base, greeting: regularGreeting(visit), regularVisit: visit };
}

/** A different roster guest for the order after hers, so Sofia is never two guests in a row (a fixed, deterministic pick). */
function someoneElse(than: string): CustomerDefinition {
  const i = CUSTOMERS.findIndex((c) => c.id === than);
  return CUSTOMERS[(i + 1) % CUSTOMERS.length]!;
}

/**
 * The session with Sofia as the guest of its first order. Unchanged when it is a replay, when a plate was already served (a retry), when there is no current order, or before
 * Level 13. If the next order happened to roll her too, it gets someone else.
 */
export function withRegularGuest(session: ServiceSession, levelNumber: number): ServiceSession {
  const guest = regularCustomer(levelNumber);
  if (!guest || !session.current || session.isReplay || session.completedCount !== 0) {
    return session;
  }
  const next =
    session.next && session.next.customer.id === guest.id
      ? {
          ...session.next,
          customer: someoneElse(guest.id),
          order: { ...session.next.order, customerId: someoneElse(guest.id).id },
        }
      : session.next;
  return {
    ...session,
    current: {
      ...session.current,
      customer: guest,
      order: { ...session.current.order, customerId: guest.id },
    },
    next,
  };
}

/** The line on the card of the level that introduces her (a first completion of Level 13); null on every other level. */
export function regularIntroNote(finishedLevel: number): string | null {
  if (finishedLevel !== REGULAR_FROM_LEVEL) return null;
  const base = CUSTOMERS.find((c) => c.id === REGULAR_ID);
  return base ? `⭐ ${base.name} liked it and will be back` : null;
}
