/** Which portrait (public/business/staff-portraits/) shows a staff role or specialist chef — presentation only. */
const PORTRAIT: Record<string, string> = {
  "prep-cook": "prep-cook",
  "line-cook": "line-cook",
  "head-chef": "head-chef",
  server: "server",
  cleaner: "cleaner",
  manager: "manager",
  "mexican-chef": "specialist-mexican",
  "indian-chef": "specialist-indian",
  "mediterranean-chef": "specialist-mediterranean",
  "asian-chef": "specialist-asian",
};

export function staffPortraitFile(id: string): string | undefined {
  return PORTRAIT[id];
}

/**
 * The emoji shown for a role with no portrait yet, or when the picture cannot load. The Cashier has no portrait file yet (not generated,
 * see docs/planning/FRIDGE-SORT-CODEX-PROMPTS-2026-11-03.md, A22): add `cashier: "cashier"` to PORTRAIT above (and ROLE_PORTRAIT in
 * BusinessStaff.tsx) together with `public/business/staff-portraits/cashier.webp`, never before the file exists (that would be a 404).
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
