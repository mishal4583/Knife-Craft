import { useMemo } from "react";
import { staffCast } from "@/game/restaurant/staffLife";
import { MapCast } from "./FloorLife";

/**
 * The first floor's hired staff at work (developer 2026-10-16): routes from
 * game/restaurant/staffLife.ts, drawn by the same MapCast as the Second Floor.
 * Decorative: aria-hidden, never takes a tap.
 */
export function StaffLife({
  hiredRoles,
  preview = false,
}: {
  hiredRoles: readonly string[];
  preview?: boolean;
}) {
  const key = [...hiredRoles].sort().join();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the hired roles
  const cast = useMemo(() => staffCast(hiredRoles), [key]);
  return <MapCast cast={cast} testId="staff-life" preview={preview} />;
}
