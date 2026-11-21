/**
 * The painted pictures of the left rail's three places (`public/nav/<id>.webp`, Codex: a chef's hat for the Kitchen, a crate of vegetables for the Market, a laid table for the Restaurant),
 * or null while a place has none yet (the rail then shows its icon). Add an id here when its file is in `public/nav/`. Prompts: docs/planning/KITCHEN-HOME-CODEX-PROMPTS-2026-11-21.md.
 */
export const NAV_ART_IDS: ReadonlySet<string> = new Set<string>([]);

export function navArtUrl(id: string): string | null {
  if (!NAV_ART_IDS.has(id)) return null;
  return `${import.meta.env?.BASE_URL ?? "/"}nav/${id}.webp`;
}
