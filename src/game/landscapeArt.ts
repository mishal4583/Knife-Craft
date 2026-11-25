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
 * The wide rooms of the mini-games (Codex, developer 2026-11-20): composed wide from scratch, with a calm middle for the game's board. 1600 x 900 webp, wide windows only.
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

const GAME_FILE: Record<LandscapeGameId, string> = {
  "dessert-run": "dessert-run",
  "unload-the-van": "unload-the-van",
  "car-park": "car-park",
  "sauce-mix": "sauce-station-mix",
  "sauce-bottle": "sauce-station-bottle",
  "fridge-check": "fridge-check",
  dishwashing: "dishwashing",
  "delivery-inspection": "delivery-inspection",
  stockroom: "stockroom",
  "fridge-sort": "fridge-sort",
};

/** The room of a mini-game (or the sink): it fills the whole wide window behind the game. */
export const landscapeGameArt = (id: LandscapeGameId): string =>
  `${base()}landscape-art/true/game-${GAME_FILE[id]}.webp`;

/**
 * TRUE landscape pictures (Codex, developer 2026-11-20): composed wide from scratch, no portrait picture inside them. The Kitchen home and the cutting scene for a
 * kitchen skin ("skin-01" Humble … "skin-06" Grand), 1600 x 900.
 */
export const landscapeKitchenArt = (skin: string): string =>
  `${base()}landscape-art/true/kitchen-${skin.replace("skin-", "")}.webp`;

/** The restaurant floor plan for a kitchen stage, laid out wide (1920 x 1080). The rooms are in `restaurantMapZonesWide.ts`. */
export const landscapeMapArt = (stage: KitchenMapArtStage): string =>
  `${base()}landscape-art/true/map-${stage}.webp`;

/**
 * The margins of a wide map (developer 2026-11-24: "the both sides of the restaurant map are not filled in properly"): when the window is not 16:9 the garden carries on around the picture.
 * Four small pictures per map, made once by scripts/make-map-margins.py from the picture's own outdoor material: `left` / `right` are MAP_MARGIN.x wide and 1080 tall, `top` / `bottom` are
 * (1920 + 2 x MAP_MARGIN.x) wide and MAP_MARGIN.y tall and carry the corners. `name` is a kitchen stage or "second-floor".
 */
export type MapMarginName = KitchenMapArtStage | "second-floor";
export const MAP_MARGIN = { x: 360, y: 220 } as const;
export const landscapeMapMarginArt = (
  name: MapMarginName,
  side: "left" | "right" | "top" | "bottom",
): string => `${base()}landscape-art/true/margins/${name}-${side}.webp`;

/** The Second Floor food hall, laid out wide (1920 x 1080). */
export const landscapeSecondFloorArt = (): string =>
  `${base()}landscape-art/true/second-floor.webp`;

/** The seven intro scenes ("scene1" ... "scene5", "scene3A/B/C"), composed wide (1600 x 900). */
export const landscapeStoryArt = (scene: string): string =>
  `${base()}landscape-art/true/story-${scene}.webp`;

/** The loading screen's room (index.html uses the same path in a media query). */
export const landscapeLoadingArt = (): string => `${base()}landscape-art/true/loading.webp`;

/** The dining room shown while a customer is served, for a kitchen stage (1920 x 1080). */
export const landscapeDiningArt = (stage: KitchenMapArtStage): string => {
  const n =
    ["humble", "growing", "established", "neighborhood-cafe", "flourishing-cafe", "grand"].indexOf(
      stage,
    ) + 1;
  return `${base()}landscape-art/true/dining-0${Math.max(1, n)}.webp`;
};

/** The wide background of a cooking film: the film's frame is its middle, drawn over it at the same scale (CookingClip, OvenStep). */
export type ClipId =
  | "chef-cooking"
  | "chef-salad"
  | "chef-fruit"
  | "chef-plating"
  | "chef-curry"
  | "chef-bread"
  | "oven-bread";
export const landscapeClipArt = (id: ClipId): string =>
  `${base()}landscape-art/true/clip-${id}.webp`;
