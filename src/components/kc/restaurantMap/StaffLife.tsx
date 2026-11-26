import { useEffect, useMemo } from "react";
import type { TaskKind } from "@/game/restaurant/cleanliness";
import { CLEANING_SECONDS, staffCast, type StaffLifeContext } from "@/game/restaurant/staffLife";
import { withDishes } from "@/game/restaurant/mapDishes";
import { MapCast } from "./FloorLife";

/**
 * The first floor's staff at work (developer 2026-10-16): routes from
 * game/restaurant/staffLife.ts, drawn by the same MapCast as the Second Floor.
 * Decorative (aria-hidden, never takes a tap) — except that the Cleaner's
 * restroom job is real: after CLEANING_SECONDS on it, `onCleanerDone` asks the
 * game to clean that task (cleanTask by the Cleaner, its real supplies).
 */
export function StaffLife({
  hiredRoles,
  context,
  preview = false,
  dishIds,
  onCleanerDone,
}: {
  hiredRoles: readonly string[];
  context: StaffLifeContext;
  preview?: boolean;
  /** The dishes the Server carries (mapDishes.ts). */
  dishIds?: readonly string[] | undefined;
  onCleanerDone?: ((job: TaskKind) => void) | undefined;
}) {
  const key = `${[...hiredRoles].sort().join()}|${context.stage}|${context.diningOpen}|${context.serviceOpen}|${context.cleanerJob}|${context.cleanerToday ?? false}|${context.wide ?? false}|${(dishIds ?? []).join()}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures what the cast reads
  const cast = useMemo(() => withDishes(staffCast(hiredRoles, context), dishIds ?? []), [key]);
  const job = context.cleanerJob;
  const cleanerOnMap = cast.some((a) => a.kind === "cleaner");
  useEffect(() => {
    // The preview only draws; a real job is cleaned once its time is up.
    if (!job || !cleanerOnMap || preview || !onCleanerDone) return;
    const t = window.setTimeout(() => onCleanerDone(job), CLEANING_SECONDS * 1000);
    return () => window.clearTimeout(t);
  }, [job, cleanerOnMap, preview, onCleanerDone]);
  return <MapCast cast={cast} testId="staff-life" preview={preview} />;
}
