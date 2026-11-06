/**
 * HIRE WHEN THE GAME NEEDS THEM (developer 2026-11-07: "when the food is prepared and there is no server, tell the player to hire
 * the server; after the guest has eaten and there is no one to bill, ask for a cashier"). The first service offers the two
 * permanent hires of the starting team at the moment each one is missing:
 *
 *   - the SERVER, when the plate is ready to go out to the table (otherwise the cook carries it);
 *   - the CASHIER, when the guest has eaten and the bill is due.
 *
 * Both are the same paid, permanent hires as everywhere (App.hireStaff: one wallet debit, one "staff-purchase" ledger entry,
 * the fee from the opening cash, config/startingTeam.ts); nothing here moves money. There is no "not now" (developer 2026-11-07:
 * "they need to be hired anyway"): hiring never blocks, because a short wallet puts the fee on supplier credit, and from the second
 * service the Pre-Service Check requires both anyway (staffRequirements.ts). Pure; no save field.
 */
import type { SaveData } from "../SaveManager";
import { teamOffers, type TeamOffer } from "./diningHire";

/** The Market's "Hire your team" card is for a player who put the hires off: it shows from this level. */
export const TEAM_CARD_FROM = 2;

export type ServiceHireRole = "server" | "cashier";

export type ServiceHirePrompt = {
  role: ServiceHireRole;
  name: string;
  fee: number;
  affordable: boolean;
  /** The line the game says when the moment comes. */
  title: string;
  /** What the hire changes, in a few words. */
  gain: string;
};

const WORDS: Record<ServiceHireRole, { title: string; gain: string }> = {
  server: {
    title: "The plate is ready, but nobody can carry it out.",
    gain: "A Server carries every plate to the tables, for good.",
  },
  cashier: {
    title: "The guest has eaten, but nobody is at the till.",
    gain: "A Cashier makes every bill and counts the till, for good.",
  },
};

const prompt = (o: TeamOffer): ServiceHirePrompt => ({
  role: o.role,
  name: o.name,
  fee: o.fee,
  affordable: o.affordable,
  ...WORDS[o.role],
});

/** The hires still to make for this save at this level (the Server, then the Cashier), ready for the service to show. */
export function serviceHirePrompts(
  save: SaveData,
  levelNumber: number,
): Partial<Record<ServiceHireRole, ServiceHirePrompt>> {
  const out: Partial<Record<ServiceHireRole, ServiceHirePrompt>> = {};
  for (const o of teamOffers(save, levelNumber)) out[o.role] = prompt(o);
  return out;
}
