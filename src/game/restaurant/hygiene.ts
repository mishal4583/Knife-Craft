/**
 * A service's hygiene (supplies plan D) — kept apart from serviceReport.ts
 * with no runtime imports, so the Business inspection can read it without
 * pulling the restaurant modules in.
 */
import type { SaveData } from "../SaveManager";

export type ServiceHygiene = {
  /** The wash-up had dish soap (or there was nothing to wash). */
  soap: boolean;
  /** The cleaning liquid isn't empty. */
  cleaner: boolean;
  /** Tableware pieces still dirty after the wash-up. */
  dirtyLeft: number;
  /** Cleanliness & Maintenance: cleaning tasks still open when the service started (absent = none). */
  openTasks?: number;
  /** …and the areas they were in. */
  areas?: string[];
};

/** Whether a service with this hygiene was spotless. */
export const isSpotless = (h: ServiceHygiene) =>
  h.soap && h.cleaner && h.dirtyLeft === 0 && !((h.openTasks ?? 0) > 0);

/**
 * The inspector's look at the restaurant's last service (L91+ inspections):
 * null when it was spotless or there's no record (Business Mode saves);
 * otherwise what was wrong.
 */
export function hygieneIssue(save: SaveData): string | null {
  const h = save.business.restaurantRecord?.lastHygiene as
    Partial<ServiceHygiene> | null | undefined;
  if (!h || typeof h !== "object") return null;
  const dirtyLeft =
    typeof h.dirtyLeft === "number" && Number.isFinite(h.dirtyLeft) ? Math.max(0, h.dirtyLeft) : 0;
  const why = [
    h.soap === false ? "dishes washed without soap" : null,
    dirtyLeft > 0 ? `${Math.floor(dirtyLeft)} dirty pieces left in the sink` : null,
    h.cleaner === false ? "no cleaning liquid for the wipe-down" : null,
    typeof h.openTasks === "number" && h.openTasks > 0
      ? `${Math.floor(h.openTasks)} cleaning ${h.openTasks === 1 ? "task" : "tasks"} left undone${
          Array.isArray(h.areas) && h.areas.length ? ` (${h.areas.join(", ")})` : ""
        }`
      : null,
  ].filter(Boolean);
  return why.length ? `Hygiene: ${why.join(", ")}.` : null;
}
