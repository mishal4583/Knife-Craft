/**
 * CLEANING_DIRT — the cleaning mini-game's dirt (developer 2026-10-21).
 *
 * Real stains on the room art's real surfaces instead of a scatter of dots:
 * sauce splashes and grease on the cooking line, coffee rings and stuck-on
 * food on the tables, crumbs, scuffs and footprints on the floors, a drink
 * puddle, limescale in the toilet, water spots on the mirror and taps. Each
 * stain has a tool and a toughness: a crumb goes in one sweep, baked-on
 * grease needs a few rubs and fades as you work it. Pure and seeded: the same
 * room, task, kitchen tier and `variant` always give the same dirt; the
 * Cleanliness tab passes a new variant after every clean (developer
 * 2026-10-22: "don't put the dirt in the same position and intensity"), so
 * each job lays fresh dirt. No save field, no money.
 */
import type { KitchenMapArtStage } from "../kitchen/kitchenMapArt";
import type { CleanArea, TaskKind } from "./cleanliness";

export type CleaningToolId =
  "sponge" | "cloth" | "scraper" | "broom" | "mop" | "toilet-brush" | "glass-cloth";

export type StainKind =
  | "sauce"
  | "smear"
  | "coffee-ring"
  | "crust"
  | "grease"
  | "crumbs"
  | "scuff"
  | "footprint"
  | "puddle"
  | "scale"
  | "water-spots"
  | "grime";

export type Point = { x: number; y: number };

export type Stain = {
  id: number;
  kind: StainKind;
  task: TaskKind;
  tool: CleaningToolId;
  x: number;
  y: number;
  /** Radius across the short side; `stretch` lengthens it along `angle` (grease streaks). */
  r: number;
  stretch: number;
  angle: number;
  seed: number;
  /** 0–1: how heavy this stain is (paint opacity and toughness vary with it). */
  strength: number;
  /** Scrub units each of its points takes (one firm stroke is about 1). */
  toughness: number;
};

/** A point the brush has to pass over; it belongs to one stain. */
export type DirtMark = { point: Point; task: TaskKind; tool: CleaningToolId; stain: number };

export const SCENE_SIZE: Record<CleanArea, { width: number; height: number }> = {
  // Every interactive room uses the same portrait 9:16 coordinate space as
  // the full-screen art. Keep image and canvas bounds identical so scrubbing
  // never drifts on mobile or desktop.
  kitchen: { width: 540, height: 960 },
  dining: { width: 540, height: 960 },
  restroom: { width: 540, height: 960 },
};

export const BRUSH_RADIUS = 30;
/** Share of the dirt that must be scrubbed; the rest is wiped in the finale. */
export const CLEAN_THRESHOLD = 0.9;
/** Stains cleared within this gap of each other build a streak. */
export const STREAK_WINDOW_MS = 900;
/** Progress (%) at which the game cheers the player on. */
export const CLEAN_MILESTONES = [25, 50, 75] as const;

export const TOUGHNESS: Record<StainKind, number> = {
  crumbs: 0.6,
  "water-spots": 0.7,
  scuff: 0.9,
  footprint: 1,
  smear: 1,
  sauce: 1.3,
  "coffee-ring": 1.3,
  grime: 1.4,
  puddle: 1.5,
  crust: 2,
  scale: 2,
  grease: 2.2,
};

type Zone = { x: number; y: number; w: number; h: number };
const rect = (x1: number, y1: number, x2: number, y2: number): Zone => ({
  x: x1,
  y: y1,
  w: x2 - x1,
  h: y2 - y1,
});

/**
 * Each tier's painted room, in scene coordinates (540×960), measured from the
 * art in public/cleanliness/interactive/ (2026-10-22): where the cooking line,
 * worktops and floor are; the tables; the toilets, sinks, mirror and floor.
 * The dirt goes on these surfaces only, so it sits on what would get dirty.
 */
type KitchenGeo = { line: Zone; islands: Zone[]; floor: Zone[] };
export const KITCHEN_GEO: Record<KitchenMapArtStage, KitchenGeo> = {
  humble: {
    line: rect(120, 70, 435, 205),
    islands: [rect(225, 262, 360, 470)],
    floor: [rect(160, 540, 420, 760), rect(170, 215, 225, 520), rect(360, 215, 420, 520)],
  },
  growing: {
    line: rect(80, 80, 500, 205),
    islands: [rect(182, 275, 390, 470)],
    floor: [rect(120, 540, 470, 780), rect(120, 230, 180, 520), rect(395, 230, 455, 520)],
  },
  established: {
    line: rect(140, 130, 435, 222),
    islands: [rect(210, 275, 360, 460)],
    floor: [rect(150, 530, 440, 780), rect(150, 240, 205, 520), rect(365, 240, 420, 520)],
  },
  "neighborhood-cafe": {
    line: rect(100, 110, 490, 205),
    islands: [rect(172, 245, 400, 352), rect(172, 362, 400, 480)],
    floor: [rect(140, 500, 460, 850), rect(120, 230, 165, 490)],
  },
  "flourishing-cafe": {
    line: rect(125, 115, 455, 215),
    islands: [rect(170, 285, 390, 405), rect(170, 495, 390, 605)],
    floor: [rect(160, 620, 440, 860), rect(160, 412, 440, 488)],
  },
  grand: {
    line: rect(112, 105, 468, 190),
    islands: [rect(165, 252, 412, 340), rect(165, 432, 412, 548)],
    floor: [rect(140, 570, 445, 830), rect(165, 350, 412, 425)],
  },
};

/** The dining tables' centres and half-size per tier. */
export const DINING_TABLES: Record<KitchenMapArtStage, { centers: Point[]; half: number }> = {
  humble: {
    centers: [
      { x: 268, y: 293 },
      { x: 268, y: 668 },
    ],
    half: 70,
  },
  growing: {
    centers: [
      { x: 165, y: 243 },
      { x: 378, y: 243 },
      { x: 270, y: 485 },
    ],
    half: 45,
  },
  established: {
    centers: [
      { x: 162, y: 252 },
      { x: 387, y: 252 },
      { x: 162, y: 527 },
      { x: 387, y: 527 },
    ],
    half: 50,
  },
  "neighborhood-cafe": {
    centers: [
      { x: 155, y: 217 },
      { x: 388, y: 217 },
      { x: 152, y: 463 },
      { x: 388, y: 463 },
      { x: 272, y: 708 },
    ],
    half: 48,
  },
  "flourishing-cafe": {
    centers: [
      { x: 143, y: 267 },
      { x: 397, y: 267 },
      { x: 143, y: 558 },
      { x: 397, y: 558 },
    ],
    half: 55,
  },
  grand: {
    centers: [100, 270, 440].flatMap((x) => [200, 417, 633].map((y) => ({ x, y }))),
    half: 38,
  },
};
/** The tables' centres per tier (kept for callers of the old name). */
export const DINING_TABLE_CENTERS: Record<KitchenMapArtStage, Point[]> = Object.fromEntries(
  Object.entries(DINING_TABLES).map(([k, v]) => [k, v.centers]),
) as Record<KitchenMapArtStage, Point[]>;

type RestroomGeo = { bowls: Zone[]; sinks: Zone; mirror: Zone; floor: Zone[] };
export const RESTROOM_GEO: Record<KitchenMapArtStage, RestroomGeo> = {
  humble: {
    bowls: [rect(100, 150, 162, 230), rect(258, 150, 320, 230), rect(402, 175, 450, 250)],
    sinks: rect(425, 375, 490, 545),
    mirror: rect(492, 340, 518, 560),
    floor: [rect(70, 340, 400, 860)],
  },
  growing: {
    bowls: [rect(92, 175, 156, 250), rect(215, 175, 278, 250), rect(330, 180, 378, 250)],
    sinks: rect(392, 278, 458, 470),
    mirror: rect(462, 270, 490, 480),
    floor: [rect(70, 330, 380, 870)],
  },
  established: {
    bowls: [rect(66, 160, 116, 265), rect(175, 160, 233, 255), rect(316, 160, 374, 255)],
    sinks: rect(400, 345, 482, 625),
    mirror: rect(485, 320, 508, 640),
    floor: [rect(70, 345, 390, 850)],
  },
  "neighborhood-cafe": {
    bowls: [rect(90, 135, 150, 240), rect(216, 135, 278, 240), rect(342, 140, 390, 245)],
    sinks: rect(426, 240, 490, 410),
    mirror: rect(494, 110, 528, 345),
    floor: [rect(70, 330, 410, 900)],
  },
  "flourishing-cafe": {
    bowls: [rect(86, 120, 130, 230), rect(202, 120, 255, 230), rect(318, 120, 370, 230)],
    sinks: rect(426, 215, 504, 420),
    mirror: rect(505, 200, 530, 430),
    floor: [rect(70, 300, 415, 900)],
  },
  grand: {
    bowls: [rect(92, 85, 150, 160), rect(222, 70, 268, 170), rect(324, 85, 384, 160)],
    sinks: rect(430, 285, 524, 540),
    mirror: rect(508, 140, 532, 280),
    floor: [rect(70, 310, 415, 920)],
  },
};

/* ── Phone landscape (developer 2026-10-22) ──────────────────────────────
   The 16:9 room paintings (public/landscape-art/cleaning/, 1672×940) in a
   960×540 scene, measured from the art like the portrait geometry above
   (2026-10-22). The views are three-quarter, so every surface is a list of
   boxes. Where a painting hides the toilets behind stall doors (bowls null),
   the toilet jobs keep the portrait room (landscapeCleaningSupports). */
export type CleanOrient = "portrait" | "landscape";
export const LAND_SCENE = { width: 960, height: 540 } as const;

type LandGeo = {
  kitchen: { line: Zone[]; islands: Zone[]; floor: Zone[] };
  dining: { tops: Zone[]; floor: Zone[] };
  restroom: { bowls: Zone[] | null; sinks: Zone[]; mirror: Zone[]; floor: Zone[] };
};
export const LAND_GEO: Record<KitchenMapArtStage, LandGeo> = {
  humble: {
    kitchen: {
      line: [rect(320, 118, 840, 160)],
      islands: [rect(290, 282, 515, 330)],
      floor: [rect(120, 210, 280, 460), rect(540, 225, 800, 460), rect(290, 455, 540, 530)],
    },
    dining: {
      tops: [rect(240, 215, 430, 310), rect(650, 255, 820, 360)],
      floor: [
        rect(55, 195, 230, 300),
        rect(450, 260, 610, 340),
        rect(200, 340, 640, 500),
        rect(560, 400, 820, 500),
      ],
    },
    restroom: {
      bowls: [rect(670, 245, 740, 295)],
      sinks: [rect(185, 165, 305, 220)],
      mirror: [rect(165, 30, 240, 150)],
      floor: [rect(330, 200, 520, 330), rect(150, 330, 520, 520), rect(800, 420, 950, 530)],
    },
  },
  growing: {
    kitchen: {
      line: [rect(330, 128, 770, 190)],
      islands: [rect(390, 225, 660, 320), rect(690, 150, 830, 180)],
      floor: [rect(110, 250, 360, 380), rect(690, 220, 930, 470), rect(380, 470, 680, 525)],
    },
    dining: {
      tops: [
        rect(300, 135, 425, 195),
        rect(195, 265, 350, 335),
        rect(680, 225, 825, 290),
        rect(610, 340, 770, 405),
      ],
      floor: [
        rect(40, 330, 170, 500),
        rect(444, 153, 640, 264),
        rect(167, 417, 375, 520),
        rect(380, 420, 600, 520),
      ],
    },
    restroom: {
      bowls: [rect(97, 195, 163, 255), rect(305, 167, 368, 230)],
      sinks: [rect(655, 190, 750, 225), rect(775, 255, 880, 295)],
      mirror: [rect(730, 20, 920, 200)],
      floor: [rect(130, 300, 480, 530), rect(480, 330, 680, 530), rect(300, 245, 410, 300)],
    },
  },
  established: {
    kitchen: {
      line: [rect(360, 165, 800, 215)],
      islands: [rect(270, 212, 640, 290)],
      floor: [rect(130, 300, 250, 450), rect(655, 300, 740, 470), rect(480, 505, 730, 535)],
    },
    dining: {
      tops: [
        rect(140, 205, 265, 250),
        rect(450, 130, 570, 172),
        rect(625, 100, 735, 128),
        rect(795, 165, 900, 200),
        rect(310, 310, 470, 375),
        rect(630, 248, 775, 298),
      ],
      floor: [
        rect(300, 195, 450, 280),
        rect(575, 170, 700, 245),
        rect(40, 300, 170, 340),
        rect(650, 440, 780, 535),
      ],
    },
    restroom: {
      bowls: [rect(127, 178, 170, 222), rect(265, 162, 315, 205), rect(410, 152, 455, 195)],
      sinks: [rect(660, 215, 740, 245), rect(755, 300, 850, 340)],
      mirror: [rect(750, 35, 900, 180)],
      floor: [rect(140, 280, 580, 525)],
    },
  },
  "neighborhood-cafe": {
    kitchen: {
      line: [rect(420, 150, 850, 190)],
      islands: [rect(235, 188, 495, 245), rect(570, 258, 870, 330)],
      floor: [rect(70, 300, 220, 480), rect(260, 350, 540, 520), rect(500, 250, 565, 350)],
    },
    dining: {
      tops: [
        rect(292, 90, 382, 115),
        rect(507, 125, 607, 155),
        rect(183, 162, 288, 200),
        rect(405, 215, 505, 255),
        rect(75, 260, 200, 310),
        rect(785, 260, 900, 305),
        rect(635, 390, 760, 455),
      ],
      floor: [
        rect(330, 320, 640, 385),
        rect(540, 200, 740, 280),
        rect(240, 250, 330, 330),
        rect(470, 420, 520, 520),
      ],
    },
    restroom: {
      bowls: null,
      sinks: [rect(625, 180, 700, 210), rect(700, 220, 780, 245), rect(780, 260, 860, 295)],
      mirror: [rect(690, 25, 895, 150)],
      floor: [rect(120, 300, 490, 525), rect(460, 250, 560, 300), rect(600, 470, 820, 530)],
    },
  },
  "flourishing-cafe": {
    kitchen: {
      line: [rect(70, 115, 520, 170)],
      islands: [rect(300, 210, 640, 275), rect(620, 325, 860, 380)],
      floor: [rect(175, 300, 290, 470), rect(640, 260, 740, 320), rect(300, 400, 610, 520)],
    },
    dining: {
      tops: [
        rect(45, 195, 165, 232),
        rect(128, 158, 222, 188),
        rect(185, 128, 268, 152),
        rect(378, 170, 478, 205),
        rect(552, 185, 655, 220),
        rect(315, 255, 440, 305),
        rect(520, 278, 655, 328),
        rect(842, 295, 948, 345),
      ],
      floor: [rect(700, 150, 785, 410), rect(610, 470, 770, 520), rect(300, 118, 375, 160)],
    },
    restroom: {
      bowls: null,
      sinks: [
        rect(695, 190, 760, 210),
        rect(725, 220, 790, 245),
        rect(760, 255, 820, 280),
        rect(795, 300, 860, 330),
      ],
      mirror: [rect(750, 30, 905, 180)],
      floor: [
        rect(170, 235, 660, 300),
        rect(170, 300, 330, 520),
        rect(540, 300, 660, 440),
        rect(330, 420, 860, 530),
      ],
    },
  },
  grand: {
    kitchen: {
      line: [rect(230, 128, 700, 175), rect(620, 140, 900, 190)],
      islands: [rect(300, 190, 600, 320)],
      floor: [rect(150, 260, 290, 520), rect(620, 260, 880, 330), rect(340, 420, 720, 530)],
    },
    dining: {
      tops: [
        rect(52, 197, 168, 233),
        rect(215, 113, 288, 133),
        rect(340, 145, 415, 165),
        rect(278, 227, 368, 255),
        rect(555, 145, 628, 165),
        rect(605, 227, 692, 255),
        rect(805, 198, 920, 242),
        rect(690, 113, 758, 133),
      ],
      floor: [
        rect(200, 315, 400, 355),
        rect(600, 315, 760, 355),
        rect(700, 275, 790, 325),
        rect(160, 275, 265, 325),
      ],
    },
    restroom: {
      bowls: null,
      sinks: [rect(530, 312, 600, 335), rect(620, 248, 680, 268), rect(672, 213, 718, 228)],
      mirror: [rect(470, 200, 550, 320), rect(575, 160, 630, 265), rect(635, 130, 685, 215)],
      floor: [
        rect(120, 380, 430, 530),
        rect(720, 280, 850, 440),
        rect(550, 470, 850, 535),
        rect(230, 300, 360, 360),
      ],
    },
  },
};

/** Whether this job has its landscape room (the toilets must be in view for the toilet jobs). */
export function landscapeCleaningSupports(
  area: CleanArea,
  task: TaskKind,
  stage: KitchenMapArtStage,
): boolean {
  if (area !== "restroom") return true;
  if (task === "toilet" || task === "deep-restroom") return LAND_GEO[stage].restroom.bowls !== null;
  return true;
}

/** The scene a cleaning is laid out in. */
export function cleanScene(
  area: CleanArea,
  orient: CleanOrient,
): { width: number; height: number } {
  return orient === "landscape" ? LAND_SCENE : SCENE_SIZE[area];
}

/** Where a task's dirt can be in the landscape painting (the same jobs as dirtZones). */
export function landDirtZones(area: CleanArea, task: TaskKind, stage: KitchenMapArtStage): Zone[] {
  const g = LAND_GEO[stage];
  if (area === "kitchen") {
    const k = g.kitchen;
    if (task === "sweep-line") return k.floor;
    if (task === "deep-kitchen") return [...k.line, ...k.islands, ...k.floor];
    if (task === "equipment") return [...k.line, ...k.islands];
    return k.line;
  }
  if (area === "dining") {
    const d = g.dining;
    if (task === "spill") {
      const c = landSpillCenter(stage);
      return [rect(c.x - 48, c.y - 30, c.x + 48, c.y + 30)];
    }
    if (task === "floor" || task === "mop-all") return d.floor;
    if (task === "tables") return d.tops;
    return [...d.floor, ...d.tops];
  }
  const r = g.restroom;
  if (task === "restroom-floor") return r.floor;
  if (task === "restroom-disinfect") return [...r.sinks, ...r.mirror];
  if (task === "toilet") return r.bowls ?? [];
  return [...(r.bowls ?? []), ...r.sinks, ...r.floor];
}

/** The landscape spill: the middle of the dining room's largest stretch of open floor. */
export function landSpillCenter(stage: KitchenMapArtStage): Point {
  const z = [...LAND_GEO[stage].dining.floor].sort((a, b) => b.w * b.h - a.w * a.h)[0]!;
  return { x: z.x + z.w / 2, y: z.y + z.h / 2 };
}

/** The room-wide practice's tasks per room. */
export const ROOM_TASKS: Record<CleanArea, readonly TaskKind[]> = {
  kitchen: ["equipment", "grease", "sweep-line"],
  dining: ["tables", "spill", "floor", "mop-all"],
  restroom: ["toilet", "restroom-floor", "restroom-disinfect"],
};

export function toolForTask(area: CleanArea, task: TaskKind): CleaningToolId {
  if (area === "kitchen") {
    if (task === "grease" || task === "degrease") return "scraper";
    if (task === "sweep-line") return "broom";
    if (task === "floor") return "mop";
    return "sponge";
  }
  if (area === "dining") {
    if (task === "floor" || task === "spill" || task === "mop-all") return "mop";
    if (task === "deep-dining") return "scraper";
    return "cloth";
  }
  if (task === "toilet" || task === "deep-restroom") return "toilet-brush";
  if (task === "restroom-floor") return "mop";
  return "sponge";
}

/** A small seeded generator (LCG). */
export function seeded(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Where a task's dirt can be: the surfaces of the tier's painting. */
export function dirtZones(area: CleanArea, task: TaskKind, stage: KitchenMapArtStage): Zone[] {
  if (area === "kitchen") {
    const g = KITCHEN_GEO[stage];
    if (task === "sweep-line") return g.floor;
    if (task === "deep-kitchen") return [g.line, ...g.islands, ...g.floor];
    if (task === "equipment") return [g.line, ...g.islands];
    return [g.line];
  }
  if (area === "dining") {
    const { centers, half } = DINING_TABLES[stage];
    // On the tabletops, inside their edges.
    const tops = centers.map(({ x, y }) =>
      rect(x - half * 0.62, y - half * 0.5, x + half * 0.62, y + half * 0.5),
    );
    // The open floor: the walkways inside the walls, off every table's rug (dark scuffs
    // vanish on a rug; developer 2026-10-22 "make the dirt more visible").
    const floor = diningWalkCells(stage);
    if (task === "spill") {
      const c = spillCenter(stage);
      return [rect(c.x - 48, c.y - 35, c.x + 48, c.y + 35)];
    }
    if (task === "floor" || task === "mop-all") return floor;
    if (task === "tables") return tops;
    // The deep clean: about a third of the picks on the tabletops, the rest on the floor.
    const topShare = Math.max(1, Math.round(floor.length / (2 * tops.length)));
    return [...floor, ...Array.from({ length: topShare }, () => tops).flat()];
  }
  const g = RESTROOM_GEO[stage];
  if (task === "restroom-floor") return g.floor;
  if (task === "restroom-disinfect") return [g.sinks, g.mirror];
  if (task === "toilet") return g.bowls;
  return [...g.bowls, g.sinks, ...g.floor];
}

/** Each dining tier's open floor inside its walls, planters and benches (scene px, from the art). */
export const DINING_WALK: Record<KitchenMapArtStage, Zone> = {
  humble: rect(45, 80, 495, 800),
  growing: rect(65, 95, 480, 790),
  established: rect(60, 110, 485, 730),
  "neighborhood-cafe": rect(55, 100, 480, 770),
  "flourishing-cafe": rect(55, 110, 485, 850),
  grand: rect(45, 110, 495, 840),
};

/** A table's rug, which the floor dirt stays off: about ±1.9 half across and ±1.55 half down. */
export function diningRug(c: Point, half: number): Zone {
  return rect(c.x - half * 1.9, c.y - half * 1.55, c.x + half * 1.9, c.y + half * 1.55);
}

const WALK_CELL = 24;
/** The walkway as cells clear of every rug. */
function diningWalkCells(stage: KitchenMapArtStage): Zone[] {
  const walk = DINING_WALK[stage];
  const { centers, half } = DINING_TABLES[stage];
  const rugs = centers.map((c) => diningRug(c, half));
  const cells: Zone[] = [];
  for (let y = walk.y; y + WALK_CELL <= walk.y + walk.h; y += WALK_CELL)
    for (let x = walk.x; x + WALK_CELL <= walk.x + walk.w; x += WALK_CELL) {
      const cell = rect(x, y, x + WALK_CELL, y + WALK_CELL);
      const onRug = rugs.some(
        (r) =>
          cell.x < r.x + r.w &&
          cell.x + cell.w > r.x &&
          cell.y < r.y + r.h &&
          cell.y + cell.h > r.y,
      );
      if (!onRug) cells.push(cell);
    }
  return cells;
}

/** The dining spill sits on the floor between the first two rows of tables. */
export function spillCenter(stage: KitchenMapArtStage): Point {
  const { centers, half } = DINING_TABLES[stage];
  const rows = [...new Set(centers.map(({ y }) => y))].sort((a, b) => a - b);
  const y = rows.length > 1 ? (rows[0]! + rows[1]!) / 2 : rows[0]! + half * 1.6;
  return { x: SCENE_SIZE.dining.width * 0.5, y };
}

/** The cooktop's grease streaks: three runs along the tier's cooking line. */
function greaseStreaks(
  stage: KitchenMapArtStage,
  orient: CleanOrient = "portrait",
): [number, number, number, number][] {
  const line = orient === "landscape" ? LAND_GEO[stage].kitchen.line[0]! : KITCHEN_GEO[stage].line;
  const x1 = line.x + line.w * 0.1;
  const x2 = line.x + line.w * 0.9;
  return [0.3, 0.55, 0.8].map((f, i) => {
    const y = line.y + line.h * f;
    const inset = i * line.w * 0.06;
    return [x1 + inset, y, x2 - inset, y];
  });
}

const pick = <T>(rnd: () => number, list: readonly T[]): T =>
  list[Math.floor(rnd() * list.length)]!;

function kindFor(
  area: CleanArea,
  task: TaskKind,
  tool: CleaningToolId,
  rnd: () => number,
): StainKind {
  if (task === "deep-kitchen") return pick(rnd, ["sauce", "smear", "grease"] as const);
  if (task === "deep-dining") return pick(rnd, ["crust", "coffee-ring", "scuff"] as const);
  if (task === "deep-restroom") return pick(rnd, ["scale", "grime", "water-spots"] as const);
  switch (tool) {
    case "broom":
      return "crumbs";
    case "scraper":
      return area === "kitchen" ? "grease" : "crust";
    case "toilet-brush":
      return "scale";
    case "glass-cloth":
      return "water-spots";
    case "mop":
      if (task === "spill") return "puddle";
      if (area === "restroom") return rnd() < 0.7 ? "grime" : "footprint";
      return rnd() < 0.6 ? "scuff" : "footprint";
    case "cloth":
      return area === "kitchen" ? "smear" : pick(rnd, ["coffee-ring", "sauce", "smear"] as const);
    case "sponge":
      if (area === "restroom") return "water-spots";
      return rnd() < 0.65 ? "sauce" : "smear";
  }
}

/** Stain sizes (scene px), sized to read on a phone with the whole room on screen (2026-10-22). */
const RADIUS: Record<StainKind, [number, number]> = {
  sauce: [11, 19],
  smear: [14, 23],
  "coffee-ring": [11, 14],
  crust: [8, 13],
  grease: [12, 19],
  crumbs: [12, 18],
  scuff: [15, 24],
  footprint: [11, 14],
  puddle: [9, 13],
  scale: [9, 15],
  "water-spots": [9, 14],
  grime: [14, 21],
};

function stainCount(area: CleanArea, task: TaskKind): number {
  if (task === "deep-kitchen" || task === "deep-dining" || task === "deep-restroom") return 26;
  if (task === "spill") return 6;
  if (area === "restroom") return task === "restroom-floor" ? 11 : task === "toilet" ? 8 : 12;
  return 18;
}

/** The room-wide practice mixes tools inside one task (as the old marks did). */
function variantTool(
  area: CleanArea,
  task: TaskKind,
  index: number,
  base: CleaningToolId,
  roomWide: boolean,
): CleaningToolId {
  if (!roomWide) return base;
  if (area === "kitchen" && task === "equipment" && index % 3 === 0) return "cloth";
  if (area === "kitchen" && task === "sweep-line" && index % 2 === 0) return "mop";
  if (area === "dining" && task === "tables" && index % 4 === 0) return "scraper";
  if (area === "dining" && task === "floor" && index % 2 === 0) return "broom";
  return base;
}

/** One task's stains, placed on its zones without piling on top of each other. */
function taskStains(
  area: CleanArea,
  task: TaskKind,
  stage: KitchenMapArtStage,
  roomWide: boolean,
  firstId: number,
  variant: number,
  orient: CleanOrient,
): Stain[] {
  const land = orient === "landscape";
  // Portrait keeps its exact seed; landscape lays its own dirt on its own painting.
  const rnd = seeded(hash(`${area}|${task}|${stage}|${variant}${land ? "|land" : ""}`));
  const zones = land ? landDirtZones(area, task, stage) : dirtZones(area, task, stage);
  const { width, height } = cleanScene(area, orient);
  const mirrors: readonly Zone[] = land
    ? LAND_GEO[stage].restroom.mirror
    : [RESTROOM_GEO[stage].mirror];
  const out: Stain[] = [];
  const base = toolForTask(area, task);
  const add = (s: Omit<Stain, "id" | "seed" | "toughness" | "strength">) => {
    const strength = rnd();
    out.push({
      ...s,
      id: firstId + out.length,
      seed: Math.floor(rnd() * 2 ** 31),
      strength,
      toughness: TOUGHNESS[s.kind] * strengthToughness(strength),
    });
  };

  // The spill: one big puddle with a few splashes around it.
  if (task === "spill") {
    const c = land ? landSpillCenter(stage) : spillCenter(stage);
    add({ kind: "puddle", task, tool: "mop", x: c.x, y: c.y, r: 30, stretch: 1.35, angle: -0.16 });
  }
  // The cooktop's grease runs in streaks.
  if (area === "kitchen" && (task === "grease" || task === "degrease")) {
    for (const [x1, y1, x2, y2] of greaseStreaks(stage, orient)) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      add({
        kind: "grease",
        task,
        tool: "scraper",
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        r: 10,
        stretch: len / 20,
        angle: Math.atan2(y2 - y1, x2 - x1),
      });
    }
  }
  // A few more or fewer stains each time (±20%).
  const target = Math.round(stainCount(area, task) * (0.8 + rnd() * 0.4));
  let guard = 0;
  while (out.length < target && guard++ < target * 30) {
    const tool = variantTool(area, task, out.length, base, roomWide);
    const kind = kindFor(area, task, tool, rnd);
    const [lo, hi] = RADIUS[kind];
    const r = lo + rnd() * (hi - lo);
    const zone = zones[Math.floor(rnd() * zones.length)]!;
    const x = Math.min(width - r, Math.max(r, zone.x + rnd() * zone.w));
    const y = Math.min(height - r, Math.max(r, zone.y + rnd() * zone.h));
    // Small zones (the toilet bowl, the taps) may share; elsewhere keep stains apart.
    const small = zone.w * zone.h < 4000 && !(zone.w === WALK_CELL && zone.h === WALK_CELL);
    const spacing = small ? 0.35 : 0.75;
    const crowded = out.some(
      (o) => Math.hypot(o.x - x, o.y - y) < (o.r * Math.max(1, o.stretch * 0.6) + r) * spacing,
    );
    if (crowded && guard < target * 25) continue;
    add({
      kind,
      task,
      tool:
        area === "restroom" && task === "restroom-disinfect"
          ? mirrors.includes(zone)
            ? "glass-cloth"
            : "sponge"
          : tool,
      x,
      y,
      r,
      stretch: kind === "footprint" ? 1.8 : kind === "scuff" ? 1.4 : 1,
      angle: kind === "footprint" ? -Math.PI / 2 + (rnd() - 0.5) * 1.2 : (rnd() - 0.5) * Math.PI,
    });
  }
  return out;
}

/** A stain's toughness factor from its strength: a light one ×0.75, a heavy one ×1.25. */
export function strengthToughness(strength: number): number {
  return 0.75 + 0.5 * Math.min(1, Math.max(0, strength));
}

/** A stain's paint opacity from its strength: a light one 70%, a heavy one full. */
export function strengthOpacity(strength: number): number {
  return 0.7 + 0.3 * Math.min(1, Math.max(0, strength));
}

/**
 * The stains for a cleaning (one task, or the whole room for the practice).
 * `variant` picks the layout: same variant, same dirt; another, fresh dirt.
 */
export function makeStains(
  area: CleanArea,
  task: TaskKind,
  stage: KitchenMapArtStage,
  roomWide = false,
  variant = 0,
  orient: CleanOrient = "portrait",
): Stain[] {
  const tasks = roomWide ? ROOM_TASKS[area] : [task];
  const out: Stain[] = [];
  for (const t of tasks)
    out.push(...taskStains(area, t, stage, roomWide, out.length, variant, orient));
  return out;
}

/**
 * The variant for a task's next cleaning, from the save: it changes after every clean
 * (`cleaned` counts them) and with the day the task came up, and stays the same if the
 * player closes the game and comes back to the same dirty task.
 */
export function cleaningVariant(cleaned: number, since: number, task: TaskKind): number {
  return hash(`${cleaned}|${since}|${task}`);
}

/** The points the brush has to cover for each stain: its middle and a ring inside its edge. */
export function stainMarks(
  stains: readonly Stain[],
  area: CleanArea,
  orient: CleanOrient = "portrait",
): DirtMark[] {
  const { width, height } = cleanScene(area, orient);
  return stains.flatMap((s) => {
    const long = s.r * s.stretch;
    const pts: Point[] = [{ x: s.x, y: s.y }];
    if (long > 13) {
      const rx = long * 0.6;
      const ry = s.r * 0.6;
      const around = Math.PI * (rx + ry);
      const n = Math.max(3, Math.round(around / 22));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const lx = Math.cos(a) * rx;
        const ly = Math.sin(a) * ry;
        pts.push({
          x: s.x + lx * Math.cos(s.angle) - ly * Math.sin(s.angle),
          y: s.y + lx * Math.sin(s.angle) + ly * Math.cos(s.angle),
        });
      }
    }
    return pts.map((p) => ({
      point: {
        x: Math.min(width - 1, Math.max(1, p.x)),
        y: Math.min(height - 1, Math.max(1, p.y)),
      },
      task: s.task,
      tool: s.tool,
      stain: s.id,
    }));
  });
}

/** How much one move of the brush scrubs: a firm stroke is about 1, a tap a little. */
export function scrubAmount(strokeLength: number | null): number {
  if (strokeLength == null) return 0.35;
  return Math.max(0.2, Math.min(1, strokeLength / 28));
}

/** 0 to 1: how clean the room is (each point counts by how much of its toughness is scrubbed). */
export function cleanedShare(
  wear: ArrayLike<number>,
  marks: readonly DirtMark[],
  stains: readonly Stain[],
): number {
  if (!marks.length) return 1;
  let sum = 0;
  for (let i = 0; i < marks.length; i++)
    sum += Math.min(1, (wear[i] ?? 0) / stains[marks[i]!.stain]!.toughness);
  return sum / marks.length;
}

/** The streak after a stain is cleared at `now`. */
export function nextStreak(prev: { count: number; at: number }, now: number) {
  return { count: now - prev.at <= STREAK_WINDOW_MS ? prev.count + 1 : 1, at: now };
}

/** The milestone (index into CLEAN_MILESTONES) crossed going from one % to another, if any. */
export function milestoneCrossed(fromPct: number, toPct: number): number | null {
  const i = CLEAN_MILESTONES.findIndex((m) => fromPct < m && toPct >= m);
  return i < 0 ? null : i;
}
