/** Which portrait (public/business/staff-portraits/) shows a staff role or specialist chef — presentation only. */
const PORTRAIT: Record<string, string> = {
  "prep-cook": "prep-cook",
  "line-cook": "line-cook",
  "head-chef": "head-chef",
  server: "server",
  cleaner: "floor-cleaner",
  manager: "manager",
  cashier: "cashier",
  "mexican-chef": "specialist-mexican",
  "indian-chef": "specialist-indian",
  "mediterranean-chef": "specialist-mediterranean",
  "asian-chef": "specialist-asian",
};

export function staffPortraitFile(id: string): string | undefined {
  return PORTRAIT[id];
}

/**
 * The Second Floor's two Floor Cleaners (max 2, restaurant/secondFloor.ts FLOOR_STAFF) are two different people (developer 2026-11-07:
 * "add the cleaner's assets"): the first hire is the woman with the broom and dustpan, the second the man with the same tools
 * (Cleaner Assets/F01). The Floor Server has one portrait. One mapping, read by every screen that shows the floor team.
 */
export function floorStaffPortraitFile(role: "server" | "cleaner", index = 0): string {
  return role === "cleaner" && index >= 1 ? "floor-cleaner-male" : `floor-${role}`;
}

/**
 * "A Cleaner for today" (the day cleaner, hired for one day for a fee or an ad) is the man with the mop and the yellow bucket, thumbs up
 * (Cleaner Assets/F02): a different person from the Cleaner on the team (the woman, `floor-cleaner`).
 */
export const DAY_CLEANER_PORTRAIT = "cleaner-today";

/**
 * The emoji shown when a role's picture cannot load (offline, a missing file) or a role has no portrait (every hireable role has one now,
 * the Cashier's added 2026-11-04).
 */
const FALLBACK_EMOJI: Record<string, string> = {
  server: "🤵",
  cleaner: "🧹",
  cashier: "🧾",
  manager: "📋",
};
export function staffFallbackEmoji(id: string, specialist = false): string {
  return FALLBACK_EMOJI[id] ?? (specialist ? "👩‍🍳" : "🧑‍🍳");
}
