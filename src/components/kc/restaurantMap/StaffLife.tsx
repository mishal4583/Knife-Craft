import { useMemo } from "react";
import type { KitchenMapArtStage } from "@/game/kitchen/kitchenMapArt";
import { staffCast } from "@/game/restaurant/staffLife";
import { MapCast } from "./FloorLife";

/**
 * The first floor's hired staff at work (developer 2026-10-16): routes from
 * game/restaurant/staffLife.ts, drawn by the same MapCast as the Second Floor.
 * Decorative: aria-hidden, never takes a tap.
 */
export function StaffLife({
  hiredRoles,
  service = false,
  stage = "humble",
  preview = false,
}: {
  hiredRoles: readonly string[];
  /** The service counter is open (its cashier is shown). */
  service?: boolean;
  /** The kitchen stage whose map art is shown (each has its own measured spots). */
  stage?: KitchenMapArtStage;
  preview?: boolean;
}) {
  const key = `${[...hiredRoles].sort().join()}|${service}|${stage}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the hired roles
  const cast = useMemo(() => staffCast(hiredRoles, service, stage), [key]);
  return <MapCast cast={cast} testId="staff-life" preview={preview} />;
}
