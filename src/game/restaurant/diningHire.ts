/**
 * DINING HIRE (Phase 9E, developer 2026-11-01): the people you can hire right now from the side of the dining
 * area, so the offer disappears once they are hired.
 *
 *  - the SERVER, from Level 3 (`staffHireFrom`), for the existing one-time hiring fee (staffRequirements.ts);
 *  - the three CLEANERS BY THE HOUR, one per area (kitchen, dining, restroom), from the level cleaning starts:
 *    one shift hour of the Cleaner's hourly wage each, only for the service on screen (cleanliness.ts).
 *
 * Read-only: App does the hiring (one wallet debit and one ledger entry each). Pure; no save field.
 */
import type { SaveData } from "../SaveManager";
import {
  AREA_META,
  CLEAN_AREAS,
  areaCovered,
  hourlyCleanerPrice,
  isCleanlinessLive,
  type CleanArea,
} from "./cleanliness";
import { staffHireFee, staffHireFrom } from "./staffRequirements";

export type DiningHireId = "server" | `cleaner-${CleanArea}`;

export type DiningOffer = {
  id: DiningHireId;
  icon: string;
  label: string;
  /** Whole cents. */
  price: number;
  /** "once" for the Server's hiring fee, "hour" for an hourly Cleaner. */
  per: "once" | "hour";
  affordable: boolean;
};

/** The offers for service `levelNumber` (the Server first, then the three Cleaners). */
export function diningOffers(save: SaveData, levelNumber: number): DiningOffer[] {
  const offers: DiningOffer[] = [];
  const fee = staffHireFee("server");
  if (
    fee !== null &&
    !save.business.staff.hiredRoles.includes("server") &&
    levelNumber >= staffHireFrom("server")
  )
    offers.push({
      id: "server",
      icon: "🤵",
      label: "Server",
      price: fee,
      per: "once",
      affordable: save.credits >= fee,
    });
  if (isCleanlinessLive(levelNumber)) {
    const price = hourlyCleanerPrice();
    for (const area of CLEAN_AREAS)
      if (!areaCovered(save, area))
        offers.push({
          id: `cleaner-${area}`,
          icon: AREA_META[area].icon,
          label: `${AREA_META[area].title} cleaner`,
          price,
          per: "hour",
          affordable: save.credits >= price,
        });
  }
  return offers;
}

/** The area of a cleaner offer id, or null for the Server. */
export const areaOfOffer = (id: DiningHireId): CleanArea | null =>
  id === "server" ? null : (id.slice("cleaner-".length) as CleanArea);
