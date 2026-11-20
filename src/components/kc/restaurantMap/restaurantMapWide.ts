import { useEffect, useState, type RefObject } from "react";
import type { KitchenMapArtStage } from "@/game/kitchen/kitchenMapArt";
import type { HotspotZoneConfig, NormalizedRect } from "./restaurantMap";
import { RESTAURANT_MAP_ZONES } from "./restaurantMapZones";
import { STAGE_TABLES_WIDE } from "@/game/restaurant/guestWalk";

/**
 * THE WIDE RESTAURANT MAP (developer 2026-11-20): in a landscape window the map is a true landscape floor plan (1920 x 1080, Codex, `TL-restaurant-0N-<stage>.png`),
 * not the tall portrait plan. Every figure below is a percent of that 1920 x 1080 picture, measured on each stage's own picture (the six plans share one layout
 * but their walls move a little): the room walls, the blank name signs (found by colour detection of the cream signboards) and the entrance. The painted fridge of each stage is left as it is (the tall plan's fridge drawing is not laid over it). The portrait map keeps `restaurantMapZones.ts` untouched.
 */
export const WIDE_MAP_RATIO = 16 / 9;

/** Where the walls are on one stage's picture. */
type Walls = {
  /** Vertical walls between the six top rooms: left edge, 5 walls, right edge. */
  top: [number, number, number, number, number, number, number];
  /** Bottom of the top row (= top of the kitchen / take-away / restroom row). */
  topY: number;
  /** The wall between the kitchen and the take-away room. */
  kitchenWall: number;
  /** The wall between the take-away room and the restroom. */
  restroomWall: number;
  /** Top of the service counter strip (the bottom of take-away and restroom). */
  serviceY: number;
  /** Top of the bottom row (office and dining room) = bottom of the kitchen and service strip. */
  diningY: number;
  /** The wall between the office and the dining room. */
  officeWall: number;
  /** The front wall (bottom of the office and dining room). */
  frontY: number;
};

const WALLS: Record<KitchenMapArtStage, Walls> = {
  humble: {
    top: [3, 24, 40, 56, 71.5, 84.5, 97],
    topY: 25.5,
    kitchenWall: 43.5,
    restroomWall: 73.5,
    serviceY: 47,
    diningY: 57,
    officeWall: 21,
    frontY: 83,
  },
  growing: {
    top: [3, 23, 40.5, 55.5, 72, 86, 97],
    topY: 25,
    kitchenWall: 48,
    restroomWall: 75,
    serviceY: 46.5,
    diningY: 57,
    officeWall: 20,
    frontY: 84,
  },
  established: {
    top: [3, 21.5, 38, 53.5, 70, 85.5, 97],
    topY: 25.5,
    kitchenWall: 45,
    restroomWall: 71.5,
    serviceY: 47.5,
    diningY: 57,
    officeWall: 20,
    frontY: 84,
  },
  "neighborhood-cafe": {
    top: [3, 23.5, 39, 53.5, 70, 84.5, 97],
    topY: 25,
    kitchenWall: 45.5,
    restroomWall: 72.5,
    serviceY: 45,
    diningY: 56.5,
    officeWall: 20,
    frontY: 84,
  },
  "flourishing-cafe": {
    top: [3, 24, 41, 55, 72, 85, 97],
    topY: 25.5,
    kitchenWall: 43,
    restroomWall: 71.5,
    serviceY: 45.5,
    diningY: 57,
    officeWall: 20.5,
    frontY: 84,
  },
  grand: {
    top: [3, 22, 37, 52, 70, 85, 97],
    topY: 24,
    kitchenWall: 47.5,
    restroomWall: 74,
    serviceY: 45,
    diningY: 57,
    officeWall: 19.5,
    frontY: 84,
  },
};

/**
 * The twelve blank name signs of each picture, [x, y, w, h], in this order: Inventory, Refrigerator, Staff, Knife & Equipment, Blacksmith, Cleaning Supplies,
 * Kitchen, Take Away, Restroom, Service Counter, Office, Dining Area.
 */
const SIGNS: Record<KitchenMapArtStage, readonly (readonly [number, number, number, number])[]> = {
  humble: [
    [10.3, 5.6, 9.3, 3.0],
    [27.7, 5.6, 9.1, 2.9],
    [44.4, 5.7, 7.4, 2.8],
    [59.4, 5.6, 8.9, 3.0],
    [75.2, 5.7, 7.4, 2.8],
    [88.2, 5.6, 6.7, 2.9],
    [19.9, 27.9, 10.3, 3.0],
    [53.1, 27.9, 11.5, 3.0],
    [81.2, 28.1, 9.5, 2.8],
    [61.0, 49.0, 11.8, 3.0],
    [8.5, 59.9, 8.0, 2.9],
    [52.6, 60.4, 10.8, 2.9],
  ],
  growing: [
    [8.4, 4.4, 10.8, 2.9],
    [27.2, 4.4, 9.8, 2.9],
    [44.7, 4.4, 8.2, 2.9],
    [59.0, 4.4, 9.8, 2.9],
    [75.0, 4.4, 8.8, 2.9],
    [89.3, 4.4, 5.9, 2.9],
    [21.5, 28.4, 9.0, 2.9],
    [55.5, 28.4, 10.9, 3.0],
    [82.3, 28.6, 8.8, 2.9],
    [57.5, 47.1, 10.2, 2.9],
    [5.5, 58.2, 9.3, 3.1],
    [53.0, 57.8, 12.2, 2.8],
  ],
  established: [
    [9.7, 5.7, 8.4, 2.8],
    [26.5, 5.8, 6.8, 2.7],
    [43.1, 5.8, 6.0, 2.7],
    [59.4, 5.8, 6.7, 2.7],
    [74.3, 5.8, 6.3, 2.7],
    [88.0, 5.6, 6.0, 2.9],
    [22.1, 28.6, 9.4, 2.9],
    [54.8, 28.7, 10.3, 2.8],
    [80.1, 28.6, 10.0, 2.8],
    [65.4, 49.5, 9.0, 2.9],
    [7.3, 59.7, 7.8, 2.7],
    [53.3, 59.5, 9.4, 2.9],
  ],
  "neighborhood-cafe": [
    [9.8, 3.9, 10.2, 3.1],
    [27.9, 3.9, 8.5, 3.1],
    [42.9, 3.9, 7.9, 3.1],
    [57.3, 3.9, 9.6, 3.1],
    [73.4, 3.9, 7.7, 3.1],
    [86.1, 3.9, 7.1, 3.1],
    [21.9, 26.4, 9.9, 3.1],
    [54.5, 26.4, 10.9, 3.1],
    [81.2, 26.4, 8.5, 3.1],
    [64.4, 47.3, 11.4, 3.1],
    [7.4, 57.9, 8.8, 3.2],
    [53.5, 57.3, 10.5, 3.1],
  ],
  "flourishing-cafe": [
    [9.4, 5.9, 10.6, 2.8],
    [28.5, 5.8, 8.6, 2.9],
    [44.2, 5.9, 7.8, 2.8],
    [59.3, 6.0, 9.2, 2.7],
    [74.8, 5.9, 7.4, 2.8],
    [87.5, 5.9, 7.5, 2.8],
    [19.3, 28.0, 9.8, 2.7],
    [50.7, 28.0, 13.9, 2.7],
    [79.8, 28.0, 10.5, 2.7],
    [64.8, 46.8, 10.1, 2.6],
    [7.2, 58.9, 9.1, 2.5],
    [49.3, 58.8, 11.8, 2.6],
  ],
  grand: [
    [8.6, 4.9, 8.0, 2.7],
    [26.0, 4.9, 7.2, 2.7],
    [41.3, 5.2, 6.7, 2.4],
    [56.9, 5.2, 8.2, 2.5],
    [74.0, 5.2, 6.9, 2.5],
    [88.4, 5.0, 6.1, 2.7],
    [24.9, 26.0, 8.5, 2.8],
    [56.5, 25.9, 9.4, 2.9],
    [81.2, 26.1, 9.9, 2.7],
    [66.2, 46.7, 12.9, 2.6],
    [7.1, 57.1, 8.5, 3.0],
    [53.0, 57.4, 8.6, 2.8],
  ],
};

const ROOM_ORDER = [
  "inventory",
  "refrigerator",
  "staff",
  "knifeEquipment",
  "blacksmith",
  "cleaning",
  "kitchen",
  "takeaway",
  "restroom",
  "service",
  "office",
  "dining",
] as const;

const rect = (x0: number, y0: number, x1: number, y1: number): NormalizedRect => ({
  x: x0,
  y: y0,
  w: x1 - x0,
  h: y1 - y0,
});

/** Every room's tap area on one stage's wide picture. */
export function wideRoomBounds(stage: KitchenMapArtStage): Record<string, NormalizedRect> {
  const w = WALLS[stage];
  const [l, a, b, c, d, e, r] = w.top;
  return {
    inventory: rect(l, 2, a, w.topY),
    refrigerator: rect(a, 2, b, w.topY),
    staff: rect(b, 2, c, w.topY),
    knifeEquipment: rect(c, 2, d, w.topY),
    blacksmith: rect(d, 2, e, w.topY),
    cleaning: rect(e, 2, r, w.topY),
    kitchen: rect(l, w.topY, w.kitchenWall, w.diningY - 0.5),
    takeaway: rect(w.kitchenWall, w.topY, w.restroomWall, w.serviceY),
    restroom: rect(w.restroomWall, w.topY, r, w.serviceY),
    service: rect(w.kitchenWall, w.serviceY, r, w.diningY - 0.5),
    office: rect(l, w.diningY, w.officeWall, w.frontY),
    dining: rect(w.officeWall, w.diningY, r, w.frontY),
  };
}

/** The zone list of the wide map: the same rooms and rules as the portrait map (restaurantMapZones.ts) with this stage's own boxes; the Blacksmith corner is in the picture, so it is a room here. */
export function wideZones(stage: KitchenMapArtStage): HotspotZoneConfig[] {
  const rooms = wideRoomBounds(stage);
  const signs = SIGNS[stage];
  return ROOM_ORDER.map((id, i) => {
    const zone = RESTAURANT_MAP_ZONES.find((z) => z.id === id)!;
    const s = signs[i]!;
    return {
      ...zone,
      roomBounds: rooms[id]!,
      bannerBounds: { x: s[0], y: s[1], w: s[2], h: s[3] },
    };
  });
}

/** The player's restaurant name board: on the front wall above the entrance doors. */
export const WIDE_NAMEBOARD: Record<KitchenMapArtStage, NormalizedRect> = {
  humble: { x: 41, y: 82.4, w: 18, h: 2.6 },
  growing: { x: 41, y: 83.4, w: 18, h: 2.6 },
  established: { x: 41, y: 83.4, w: 18, h: 2.6 },
  "neighborhood-cafe": { x: 41, y: 83.4, w: 18, h: 2.6 },
  "flourishing-cafe": { x: 41, y: 83.4, w: 18, h: 2.6 },
  grand: { x: 41, y: 83.4, w: 18, h: 2.6 },
};

/** The two dining tables the cash piles lie on in the wide map: the two seated (not booth) tables nearest the front door, the left one first. */
export function wideCashTables(
  stage: KitchenMapArtStage,
): [{ x: number; y: number }, { x: number; y: number }] {
  const near = STAGE_TABLES_WIDE[stage]
    .filter((t) => !t.booth)
    .map((t) => ({ x: t.x, y: t.y, d: Math.hypot(t.x - 49.5, (t.y - 90) * 0.6) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 2)
    .sort((a, b) => a.x - b.x)
    .map((t) => ({ x: t.x, y: t.y }));
  return [near[0]!, near[1]!];
}

/**
 * The WHOLE 16:9 plan inside a viewport, nothing cropped (developer 2026-11-21: "make sure the entrance area and the outdoor area are included properly and do not crop any portion"):
 * the largest 16:9 box that fits, centred. A window that is not 16:9 has margins on two sides; `MapEdgeFill` carries the garden on over them (never a bar). Shared by the restaurant map and
 * the Second Floor. (It used to COVER the window and cropped up to 11 % off the bottom, the entrance and the garden.)
 */
export function wideFit(vp: { w: number; h: number }) {
  const k = Math.min(vp.w / 1920, vp.h / 1080);
  const sw = 1920 * k;
  const sh = sw / WIDE_MAP_RATIO;
  return { sw, sh, left: (vp.w - sw) / 2, top: (vp.h - sh) / 2 };
}

/** The size of an element, kept up to date (0 x 0 until measured, or while `active` is false). */
export function useBoxSize(ref: RefObject<HTMLElement | null>, active: boolean) {
  const [vp, setVp] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const measure = () => setVp({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, active]);
  return vp;
}

/**
 * The Second Floor's rooms on the wide picture (`TL-second-floor.png`, 1920 x 1080), map percent: each station, the Pickup Counter, the stairs and the seating
 * area, with the blank signboard of each (found by colour detection; the stairs have none).
 */
export const WIDE_SF_ZONES: readonly {
  id:
    | "pizza"
    | "coffee"
    | "drinks"
    | "iceCream"
    | "burger"
    | "hotFood"
    | "pickup"
    | "stairs"
    | "seating";
  room: NormalizedRect;
  banner: NormalizedRect;
  signed: boolean;
}[] = [
  {
    id: "pizza",
    room: { x: 4, y: 1.5, w: 22, h: 28.5 },
    banner: { x: 10.6, y: 4.6, w: 12.7, h: 3.7 },
    signed: true,
  },
  {
    id: "coffee",
    room: { x: 26, y: 1.5, w: 24.6, h: 28.5 },
    banner: { x: 34.1, y: 4.5, w: 12.9, h: 3.8 },
    signed: true,
  },
  {
    id: "drinks",
    room: { x: 50.6, y: 1.5, w: 22.6, h: 28.5 },
    banner: { x: 56.2, y: 4.5, w: 12.8, h: 3.8 },
    signed: true,
  },
  {
    id: "iceCream",
    room: { x: 73.2, y: 1.5, w: 23.8, h: 28.5 },
    banner: { x: 79, y: 4.5, w: 13.1, h: 3.8 },
    signed: true,
  },
  {
    id: "burger",
    room: { x: 3, y: 31, w: 28.5, h: 24 },
    banner: { x: 10.9, y: 33.2, w: 13.4, h: 3.3 },
    signed: true,
  },
  {
    id: "hotFood",
    room: { x: 34, y: 31, w: 26.5, h: 24 },
    banner: { x: 40.6, y: 33.3, w: 13.1, h: 3.3 },
    signed: true,
  },
  {
    id: "pickup",
    room: { x: 61, y: 31, w: 23, h: 24 },
    banner: { x: 66.9, y: 33.4, w: 11.5, h: 3.5 },
    signed: true,
  },
  {
    id: "stairs",
    room: { x: 84.5, y: 31, w: 12.5, h: 24 },
    banner: { x: 86, y: 33.5, w: 9.5, h: 3.3 },
    signed: false,
  },
  {
    id: "seating",
    room: { x: 3, y: 56, w: 94, h: 32 },
    banner: { x: 43.1, y: 57, w: 13.8, h: 3.5 },
    signed: true,
  },
];

/** Where the cash lies on the wide Pickup Counter. */
export const WIDE_SF_CASH_AT = { x: 72, y: 49.5 };

/** A VIP guest's spot (the tall plan's `goldenOfSlot` x 14-77, y 36-58) moved into the wide plan's seating area. */
export const wideGoldenSpot = (g: { x: number; y: number }) => ({
  x: g.x,
  y: 63 + (g.y - 36) * 0.9,
});
