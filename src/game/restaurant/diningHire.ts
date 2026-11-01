/**
 * WHO CAN BE HIRED (Phase 10, developer 2026-11-01). Two separate things, both read-only (App does the hiring:
 * one wallet debit and one ledger entry each). Pure; no save field.
 *
 *  - THE STARTING TEAM: the Server and the Cashier (the billing staff), hired for good in the first shop with the
 *    opening cash that pays their fees (config/startingTeam.ts). `teamOffers` lists who is still to hire; the card
 *    in the Market disappears once both are on the team.
 *  - THE CLEANERS BY THE HOUR: one per area (kitchen, dining, restroom), a small button on the restaurant map. Hired
 *    for the rest of today, paid up front for the hours left at an hourly wage that grows with the restaurant, gone
 *    the next day (cleanliness.ts `hireHourlyCleaner`). Nothing about them is shown on the dining floor or on the
 *    Cleanliness page: they are for a player who is tired or does not like cleaning.
 */
import type { SaveData } from "../SaveManager";
import { STARTING_TEAM_ROLES } from "../config/startingTeam";
import { BUSINESS_STAFF_CATALOG } from "../business/businessStaff";
import {
  AREA_META,
  CLEAN_AREAS,
  areaCovered,
  hoursLeftToday,
  hourlyCleanerWage,
  isCleanlinessLive,
  type CleanArea,
} from "./cleanliness";
import { staffHireFee, staffHireFrom } from "./staffRequirements";

export type TeamOffer = {
  role: (typeof STARTING_TEAM_ROLES)[number];
  icon: string;
  name: string;
  /** What they do, in a few words. */
  job: string;
  /** The one-time hiring fee, whole cents. */
  fee: number;
  affordable: boolean;
};

const TEAM_META: Record<TeamOffer["role"], { icon: string; job: string }> = {
  server: { icon: "🤵", job: "Carries the food to the tables" },
  cashier: { icon: "🧾", job: "Makes the bills, takes the parcel orders, counts the till" },
};

/** The starting team still to hire, from the first shop (empty once both are on the team). */
export function teamOffers(save: SaveData, levelNumber: number): TeamOffer[] {
  const out: TeamOffer[] = [];
  for (const role of STARTING_TEAM_ROLES) {
    const fee = staffHireFee(role);
    if (fee === null || levelNumber < staffHireFrom(role)) continue;
    if (save.business.staff.hiredRoles.includes(role)) continue;
    out.push({
      role,
      icon: TEAM_META[role].icon,
      name: BUSINESS_STAFF_CATALOG[role].name,
      job: TEAM_META[role].job,
      fee,
      affordable: save.credits >= fee,
    });
  }
  return out;
}

export type CleanerSlot = {
  area: CleanArea;
  icon: string;
  label: string;
  /** Someone already cleans this area today (an hourly Cleaner, the permanent or the day Cleaner). */
  onShift: boolean;
  /** The hourly wage now, the hours left today, and what hiring costs (wage × hours), whole cents. */
  wage: number;
  hours: number;
  price: number;
  affordable: boolean;
};

/** The three areas' cleaner buttons for the restaurant map (none before cleaning starts). */
export function cleanerSlots(save: SaveData, levelNumber: number): CleanerSlot[] {
  if (!isCleanlinessLive(levelNumber)) return [];
  const hours = hoursLeftToday(save, levelNumber);
  const wage = hourlyCleanerWage(levelNumber);
  return CLEAN_AREAS.map((area) => ({
    area,
    icon: AREA_META[area].icon,
    label: `${AREA_META[area].title} cleaner`,
    onShift: areaCovered(save, area),
    wage,
    hours,
    price: wage * hours,
    affordable: save.credits >= wage * hours,
  }));
}
