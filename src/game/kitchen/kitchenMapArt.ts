import type { CleanArea } from "@/game/restaurant/cleanliness";

/** Shared kitchen-map stage lookup for the restaurant map and cleanliness view. */
export type KitchenMapArtStage =
  | "humble"
  | "growing"
  | "established"
  | "neighborhood-cafe"
  | "flourishing-cafe"
  | "grand";

const KITCHEN_MAP_STAGES: Record<string, KitchenMapArtStage> = {
  "growing-kitchen": "growing",
  "established-kitchen": "established",
  "neighborhood-cafe": "neighborhood-cafe",
  "flourishing-cafe": "flourishing-cafe",
  "grand-kitchen": "grand",
};

export function kitchenMapArtStage(upgradeId: string | null | undefined): KitchenMapArtStage {
  return (upgradeId && KITCHEN_MAP_STAGES[upgradeId]) || "humble";
}

export function kitchenMapImageUrl(upgradeId: string | null | undefined): string {
  return `${import.meta.env.BASE_URL}restaurant-map/kitchen-upgrade-map-${kitchenMapArtStage(upgradeId)}.webp`;
}

export function cleanlinessRoomImageUrl(
  area: CleanArea,
  upgradeId: string | null | undefined,
): string {
  return `${import.meta.env.BASE_URL}cleanliness/interactive/${area}-${kitchenMapArtStage(upgradeId)}.webp`;
}
