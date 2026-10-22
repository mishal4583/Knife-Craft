/**
 * LANDSCAPE_ART — the 16:9 backdrops for phone landscape (public/landscape-art/,
 * LANDSCAPE_ART_CLAUDE.md; developer 2026-10-22: "there are landscape images …
 * take that and integrate"). Portrait keeps its own art; these load only when
 * the game is on its side.
 */
import type { KitchenMapArtStage } from "./kitchen/kitchenMapArt";
import type { CleanArea } from "./restaurant/cleanliness";

export type LandscapeSection =
  | "kitchen"
  | "inventory"
  | "market"
  | "business"
  | "restaurant"
  | "staff"
  | "suppliers"
  | "menu"
  | "operations"
  | "equipment";

const base = () => import.meta.env.BASE_URL;

export function landscapeSectionArt(section: LandscapeSection): string {
  return `${base()}landscape-art/sections/${section}.webp`;
}

/** A cleaning room's clean base for the tier, 1672×940 (the stains are drawn over it). */
export function landscapeCleaningArt(area: CleanArea, stage: KitchenMapArtStage): string {
  return `${base()}landscape-art/cleaning/${area}-${stage}.webp`;
}
