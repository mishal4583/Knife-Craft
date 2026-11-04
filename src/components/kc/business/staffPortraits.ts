/** Which portrait (public/business/staff-portraits/) shows a staff role or specialist chef — presentation only. */
const PORTRAIT: Record<string, string> = {
  "prep-cook": "prep-cook",
  "line-cook": "line-cook",
  "head-chef": "head-chef",
  server: "server",
  cleaner: "cleaner",
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
