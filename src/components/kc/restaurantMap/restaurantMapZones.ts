import type { HotspotZoneConfig } from './restaurantMap';
import { BUSINESS_MENU_FIRST_LEVEL } from '@/game/restaurant/restaurantProgression';

/**
 * Screen targets and coordinates for KnifeCraft Restaurant Map.
 * The Blacksmith entry remains in this full configuration for integration compatibility,
 * while RESTAURANT_MAP_DISPLAY_ZONES exposes only the 11 rooms visible in the current artwork.
 * Uses normalized percentages (0 - 100) for resolution-independent precision.
 */
export const RESTAURANT_MAP_ZONES: HotspotZoneConfig[] = [
  {
    id: 'inventory',
    targetScreen: 'inventory',
    name: 'Inventory',
    subName: 'Dry Storage',
    category: 'storage',
    icon: '📦',
    description: 'Bulk raw ingredients, spices, and dried pantry supplies.',
    roomBounds: { x: 3.8, y: 1.8, w: 32.2, h: 16.8 },
    bannerBounds: { x: 4.8, y: 3.4, w: 23.2, h: 3.8 },
    unlockLevel: 3,
    unlockDescription: 'Inventory opens at Level 3.'
  },
  {
    id: 'refrigerator',
    targetScreen: 'business-refrigerator',
    name: 'Refrigerator',
    subName: 'Cold Storage',
    category: 'storage',
    icon: '❄️',
    description: 'Perishable meats, fresh vegetables, seafood, and dairy chilled at peak freshness.',
    roomBounds: { x: 35.5, y: 1.8, w: 31.0, h: 16.8 },
    bannerBounds: { x: 39.4, y: 3.5, w: 22.1, h: 3.6 },
    unlockLevel: 21,
    unlockDescription: 'Unlocks at Level 21 (Cold Storage Upgrade).'
  },
  {
    id: 'staff',
    targetScreen: 'business-staff',
    name: 'Staff Area',
    subName: 'Lockers & Break',
    category: 'management',
    icon: '👥',
    description: 'Manage sous-chefs, line cooks, dishwashers, and service staff stamina.',
    roomBounds: { x: 66.0, y: 1.8, w: 30.5, h: 16.8 },
    bannerBounds: { x: 69.4, y: 3.2, w: 25.5, h: 3.7 },
    unlockLevel: 41,
    unlockDescription: 'Unlocks at Level 41 (Restaurant Team Expansion).'
  },
  {
    id: 'knifeEquipment',
    targetScreen: 'shop',
    name: 'Knife & Equipment',
    subName: 'Cutting Station',
    category: 'crafting',
    icon: '🔪',
    description: 'Equip, hone, and customize chef knives, cleavers, and cutting boards.',
    roomBounds: { x: 44.5, y: 18.0, w: 36.0, h: 16.5 },
    bannerBounds: { x: 55.0, y: 19.2, w: 25.5, h: 4.0 },
    unlockLevel: 7,
    unlockDescription: 'The Market opens at Level 7.'
  },
  {
    id: 'blacksmith',
    targetScreen: 'shop',
    name: 'Blacksmith',
    subName: 'Workshop & Forging',
    category: 'crafting',
    icon: '🔨',
    description: 'Forge blade Damascus patterns, refine hardness, and sharpen edge angles.',
    roomBounds: { x: 26.5, y: 18.0, w: 22.5, h: 18.5 },
    bannerBounds: { x: 27.4, y: 19.4, w: 18.0, h: 3.9 },
    unlockLevel: 10,
    unlockDescription: 'Unlocks at Level 10 (Blacksmith Forge).'
  },
  {
    id: 'kitchen',
    targetScreen: 'kitchen',
    name: 'Kitchen Area',
    subName: 'Order Board & Prep',
    category: 'prep',
    icon: '🍳',
    description: 'Active commercial stoves, boiling stations, prep line, and live ticket orders.',
    roomBounds: { x: 3.8, y: 18.0, w: 41.2, h: 30.2 },
    bannerBounds: { x: 21.0, y: 29.2, w: 15.5, h: 3.4 },
    unlockLevel: 1,
    unlockDescription: 'Main culinary prep station.'
  },
  {
    id: 'cleaning',
    targetScreen: 'shop-supplies',
    name: 'Cleaning Supplies',
    subName: 'Janitorial & Sanitation',
    category: 'facility',
    icon: '🧼',
    description: 'Sanitizers, microfiber towels, floor buffers, and dishwashing detergents.',
    roomBounds: { x: 80.0, y: 18.0, w: 16.2, h: 15.5 },
    bannerBounds: { x: 81.1, y: 18.8, w: 16.0, h: 4.1 },
    unlockLevel: 10,
    unlockDescription: 'Cleaning supplies are available in the Market.'
  },
  {
    id: 'takeaway',
    targetScreen: 'shop-supplies',
    name: 'Take Away / Parcel',
    subName: 'Packaging Station',
    category: 'service',
    icon: '🛍️',
    description: 'Package bento boxes, seal meal bags, and fulfill delivery pickup couriers.',
    roomBounds: { x: 48.5, y: 34.0, w: 32.0, h: 14.2 },
    bannerBounds: { x: 50.5, y: 35.2, w: 27.0, h: 4.0 },
    unlockLevel: 71,
    unlockDescription: 'Unlocks at Level 71 (Delivery & Express Orders).'
  },
  {
    id: 'restroom',
    targetScreen: 'business-cleanliness',
    name: 'Restroom',
    subName: 'Guest & Staff Amenities',
    category: 'facility',
    icon: '🚻',
    description: 'Guest restrooms maintained with pristine cleanliness, soap, and fresh amenities.',
    roomBounds: { x: 80.0, y: 33.0, w: 17.2, h: 18.0 },
    bannerBounds: { x: 81.3, y: 34.5, w: 15.3, h: 4.6 },
    unlockLevel: 10,
    unlockDescription: 'Restroom care is part of Restaurant Cleanliness.'
  },
  {
    id: 'office',
    targetScreen: 'business',
    name: 'Manager / Office',
    subName: 'Business Management',
    category: 'management',
    icon: '📊',
    description: 'Menu pricing, supplier contracts, daily profit reports, and business licenses.',
    roomBounds: { x: 3.8, y: 53.4, w: 26.2, h: 24.0 },
    bannerBounds: { x: 4.6, y: 54.5, w: 21.7, h: 3.9 },
    unlockLevel: BUSINESS_MENU_FIRST_LEVEL,
    unlockDescription: `Business opens at Level ${BUSINESS_MENU_FIRST_LEVEL}.`
  },
  {
    id: 'service',
    targetScreen: 'business-service',
    name: 'Service Counter',
    subName: 'Order Pickup & Expo',
    category: 'service',
    icon: '🛎️',
    description: 'Food runner pick-up window, plate garnishing, order bells, and cashier POS.',
    roomBounds: { x: 30.5, y: 48.2, w: 50.5, h: 5.8 },
    bannerBounds: { x: 45.0, y: 49.7, w: 21.8, h: 3.6 },
    unlockLevel: BUSINESS_MENU_FIRST_LEVEL,
    unlockDescription: `Business service opens at Level ${BUSINESS_MENU_FIRST_LEVEL}.`
  },
  {
    id: 'dining',
    targetScreen: 'business-menu',
    name: 'Dining Area',
    subName: 'Seating & Atmosphere',
    category: 'service',
    icon: '🍽️',
    description: 'Guest tables, booths, ambient lighting, customer dining satisfaction.',
    roomBounds: { x: 30.5, y: 53.4, w: 67.0, h: 25.8 },
    bannerBounds: { x: 46.2, y: 66.0, w: 21.0, h: 3.8 },
    unlockLevel: 31,
    unlockDescription: 'Dine-in service begins at Level 31.'
  }
];

/** Visible map destinations; Blacksmith remains in the full config for integration compatibility. */
export const RESTAURANT_MAP_DISPLAY_ZONES = RESTAURANT_MAP_ZONES.filter(
  (zone) => zone.id !== 'blacksmith'
);

/**
 * Returns whether a zone is unlocked for the given player level
 */
export function isZoneUnlocked(zone: HotspotZoneConfig, playerLevel: number): boolean {
  return playerLevel >= zone.unlockLevel;
}

/**
 * Returns a zone config by ID
 */
export function getZoneConfig(zoneId: string): HotspotZoneConfig | undefined {
  return RESTAURANT_MAP_ZONES.find((z) => z.id === zoneId);
}

/** A map room is open at this level (StaffLife: the Server needs the dining room, the cashier the counter). */
export function mapRoomOpen(zoneId: string, playerLevel: number): boolean {
  const zone = getZoneConfig(zoneId);
  return !!zone && isZoneUnlocked(zone, playerLevel);
}
