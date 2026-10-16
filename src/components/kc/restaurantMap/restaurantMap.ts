import type { ScreenId } from "../data";

/** Map-only zone IDs. Destinations always use real game routes. */

export type RestaurantZoneId =
  | 'inventory'
  | 'refrigerator'
  | 'staff'
  | 'knifeEquipment'
  | 'blacksmith'
  | 'kitchen'
  | 'cleaning'
  | 'takeaway'
  | 'office'
  | 'restroom'
  | 'service'
  | 'dining';

/**
 * Normalized percentage coordinates (0 to 100)
 * ensures resolution-independent precision across all viewports.
 */
export interface NormalizedRect {
  /** Left offset percentage (0 - 100) */
  x: number;
  /** Top offset percentage (0 - 100) */
  y: number;
  /** Width percentage (0 - 100) */
  w: number;
  /** Height percentage (0 - 100) */
  h: number;
}

export interface HotspotZoneConfig {
  id: RestaurantZoneId;
  targetScreen: ScreenId;
  name: string;
  subName: string;
  category: 'prep' | 'crafting' | 'storage' | 'service' | 'management' | 'facility';
  icon: string;
  description: string;
  /** Entire room interactive bounds (percentage of map) */
  roomBounds: NormalizedRect;
  /** Signpost/banner focal point for touch & indicator centering (percentage) */
  bannerBounds: NormalizedRect;
  /** KnifeCraft campaign unlock level requirement */
  unlockLevel: number;
  /** Human-readable unlock requirement text */
  unlockDescription?: string;
  /** If a specific condition or feature flag is required */
  requiresFeatureFlag?: string;
}

export interface RestaurantMapProps {
  /** Current campaign / player level */
  playerLevel: number;
  /** Selected kitchen art stage in the QA preview. */
  kitchenMapImage?: string;
  /** Selected cold-storage equipment stage in the QA preview. */
  fridgeTier?: 'basic' | 'commercial' | 'professional';
  /** Optional restaurant name supplied by the host game's saved player data. */
  restaurantName?: string;
  /** Called when the player edits the entrance sign. */
  onRestaurantNameChange?: (name: string) => void;
  /** Active selected screen if any */
  currentScreen?: ScreenId;
  /** Navigation callback to open a real game route from this map zone. */
  onNavigateToScreen: (screen: ScreenId, zoneId: RestaurantZoneId) => void;
  /** The Settings → Reduced motion preference. */
  reducedMotion?: boolean;
  /** The staff drawn at work on the map (StaffLife), and whether it is the testing preview. */
  staffOnMap?: {
    roles: readonly string[];
    context: import('@/game/restaurant/staffLife').StaffLifeContext;
    preview: boolean;
  };
  /** The Cleaner finished a real restroom job on the map (the game cleans that task). */
  onCleanerDone?: (job: import('@/game/restaurant/cleanliness').TaskKind) => void;
  /** Live, derived count of open attention items for each map room. */
  attentionCounts?: Partial<Record<RestaurantZoneId, number>>;
  /** Contextual emoji pictograms for every active issue type in a map room. */
  attentionSymbols?: Partial<Record<RestaurantZoneId, string[]>>;
  /** Optional callback when a locked hotspot is tapped */
  onLockedZoneClick?: (zone: HotspotZoneConfig) => void;
  /** Optional custom URL for the WebP map asset */
  mapWebpUrl?: string;
  /** Optional custom URL for the fallback JPG map asset */
  mapJpgUrl?: string;
  /** Optional custom CSS class name */
  className?: string;
}
