import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { floorStaffPortraitFile } from "../business/staffPortraits";

/**
 * The Second Floor team's portraits (developer 2026-11-03): the Floor Server (a waiter with a tray) and the Floor Cleaner (broom and
 * dustpan), 320 px WebP in `public/business/staff-portraits/`, the same size and place as the other staff portraits. The emoji
 * (`fallback`) shows if the picture cannot load.
 */
export function FloorStaffFace({
  role,
  index = 0,
  fallback,
  className,
}: {
  role: "server" | "cleaner";
  /** Which hire (0 = the first, 1 = the second): the two Floor Cleaners are two people (staffPortraits.ts floorStaffPortraitFile). */
  index?: number;
  fallback: ReactNode;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <img
      src={`${import.meta.env.BASE_URL}business/staff-portraits/${floorStaffPortraitFile(role, index)}.webp`}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
      decoding="async"
      data-floor-staff-face={role}
      data-floor-staff-index={index}
      onError={() => setFailed(true)}
      className={cn("inline-block rounded-[18px] object-cover", className)}
    />
  );
}
