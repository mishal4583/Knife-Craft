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
function greaseStreaks(stage: KitchenMapArtStage): [number, number, number, number][] {
  const { line } = KITCHEN_GEO[stage];
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
): Stain[] {
  const rnd = seeded(hash(`${area}|${task}|${stage}|${variant}`));
  const zones = dirtZones(area, task, stage);
  const { width, height } = SCENE_SIZE[area];
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
    const c = spillCenter(stage);
    add({ kind: "puddle", task, tool: "mop", x: c.x, y: c.y, r: 30, stretch: 1.35, angle: -0.16 });
  }
  // The cooktop's grease runs in streaks.
  if (area === "kitchen" && (task === "grease" || task === "degrease")) {
    for (const [x1, y1, x2, y2] of greaseStreaks(stage)) {
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
          ? zone === RESTROOM_GEO[stage].mirror
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
): Stain[] {
  const tasks = roomWide ? ROOM_TASKS[area] : [task];
  const out: Stain[] = [];
  for (const t of tasks) out.push(...taskStains(area, t, stage, roomWide, out.length, variant));
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
export function stainMarks(stains: readonly Stain[], area: CleanArea): DirtMark[] {
  const { width, height } = SCENE_SIZE[area];
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
