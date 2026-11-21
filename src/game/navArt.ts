/**
 * The painted pictures of the left rail's three places (`public/nav/<id>.webp`, Codex, developer 2026-11-21: a chef's hat for the Kitchen, a crate of vegetables for the Market, a laid table for the Restaurant),
 * or none while a place has none (the rail then shows its icon). Written by `scripts/make-nav-assets.py`. Do not edit by hand.
 */
export const NAV_ART_IDS: ReadonlySet<string> = new Set<string>([
  "kitchen",
  "restaurant-map",
  "shop",
]);

export function navArtUrl(id: string): string | null {
  if (!NAV_ART_IDS.has(id)) return null;
  return `${import.meta.env?.BASE_URL ?? "/"}nav/${id}.webp`;
}
