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

const base = () => import.meta.env?.BASE_URL ?? "./";

export function landscapeSectionArt(section: LandscapeSection): string {
  return `${base()}landscape-art/sections/${section}.webp`;
}

/** A cleaning room's clean base for the tier, 1672×940 (the stains are drawn over it). */
export function landscapeCleaningArt(area: CleanArea, stage: KitchenMapArtStage): string {
  return `${base()}landscape-art/cleaning/${area}-${stage}.webp`;
}

/**
 * The second set of landscape pictures (Codex, developer 2026-11-19/20): each is the portrait picture in the middle with the same room painted to both sides (the mini-games, the story and the loading screen; the Kitchen and the maps are the true pictures below)
 * (`scripts/make-landscape-assets.py` builds them, 1440 x 810 webp). They load only in a wide window.
 */
export type LandscapeGameId =
  | "dessert-run"
  | "unload-the-van"
  | "car-park"
  | "sauce-mix"
  | "sauce-bottle"
  | "fridge-check"
  | "dishwashing"
  | "delivery-inspection"
  | "stockroom"
  | "fridge-sort";

/** The room round a mini-game's (or the sink's) 9:16 stage; the centre of the picture is dimmed to a dark well the stage sits in. */
export const landscapeGameArt = (id: LandscapeGameId): string =>
  `${base()}landscape-art/games/${id}.webp`;

/**
 * TRUE landscape pictures (Codex, developer 2026-11-20): composed wide from scratch, no portrait picture inside them. The Kitchen home and the cutting scene for a
 * kitchen skin ("skin-01" Humble … "skin-06" Grand), 1600 x 900.
 */
export const landscapeKitchenArt = (skin: string): string =>
  `${base()}landscape-art/true/kitchen-${skin.replace("skin-", "")}.webp`;

/** The restaurant floor plan for a kitchen stage, laid out wide (1920 x 1080). The rooms are in `restaurantMapZonesWide.ts`. */
export const landscapeMapArt = (stage: KitchenMapArtStage): string =>
  `${base()}landscape-art/true/map-${stage}.webp`;

/** The Second Floor food hall, laid out wide (1920 x 1080). */
export const landscapeSecondFloorArt = (): string => `${base()}landscape-art/true/second-floor.webp`;

/** The intro story scenes ("scene1" … "scene5", "scene3A/B/C"). */
export const landscapeStoryArt = (scene: string): string =>
  `${base()}landscape-art/story/${scene}.webp`;

/** The loading screen's room (index.html uses the same path in a media query). */
export const landscapeLoadingArt = (): string => `${base()}landscape-art/loading.webp`;
