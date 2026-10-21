/**
 * CLEANING_DIRT — the cleaning mini-game's dirt (developer 2026-10-21).
 *
 * Real stains on the room art's real surfaces instead of a scatter of dots:
 * sauce splashes and grease on the cooking line, coffee rings and stuck-on
 * food on the tables, crumbs, scuffs and footprints on the floors, a drink
 * puddle, limescale in the toilet, water spots on the mirror and taps. Each
 * stain has a tool and a toughness: a crumb goes in one sweep, baked-on
 * grease needs a few rubs and fades as you work it. Pure and seeded: the same
 * room, task and kitchen tier always give the same dirt. No save, no money.
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
  /** Scrub units each of its points takes (one firm stroke is about 1). */
  toughness: number;
};

/** A point the brush has to pass over; it belongs to one stain. */
export type DirtMark = { point: Point; task: TaskKind; tool: CleaningToolId; stain: number };

export const SCENE_SIZE: Record<CleanArea, { width: number; height: number }> = {
  kitchen: { width: 510, height: 520 },
  dining: { width: 555, height: 370 },
  restroom: { width: 510, height: 340 },
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

export const DINING_TABLE_CENTERS: Record<KitchenMapArtStage, Point[]> = {
  humble: [
    { x: 145, y: 220 },
    { x: 410, y: 220 },
  ],
  growing: [
    { x: 145, y: 88 },
    { x: 410, y: 88 },
    { x: 278, y: 270 },
  ],
  established: [
    { x: 145, y: 88 },
    { x: 410, y: 88 },
    { x: 145, y: 230 },
    { x: 410, y: 230 },
  ],
  "neighborhood-cafe": [
    { x: 145, y: 90 },
    { x: 410, y: 90 },
    { x: 88, y: 282 },
    { x: 278, y: 282 },
    { x: 470, y: 282 },
  ],
  "flourishing-cafe": [
    { x: 145, y: 88 },
    { x: 410, y: 88 },
    { x: 145, y: 232 },
    { x: 410, y: 232 },
  ],
  grand: [
    { x: 105, y: 80 },
    { x: 280, y: 80 },
    { x: 455, y: 80 },
    { x: 105, y: 190 },
    { x: 280, y: 190 },
    { x: 455, y: 190 },
    { x: 105, y: 300 },
    { x: 280, y: 300 },
    { x: 455, y: 300 },
  ],
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

type Zone = { x: number; y: number; w: number; h: number };

/** Where a task's dirt can be: the surfaces of the room's painting. */
export function dirtZones(area: CleanArea, task: TaskKind, stage: KitchenMapArtStage): Zone[] {
  const dimensions = SCENE_SIZE[area];
  if (area === "kitchen") {
    if (task === "sweep-line")
      return [
        { x: 86, y: 190, w: 48, h: 270 },
        { x: 378, y: 190, w: 42, h: 235 },
        { x: 168, y: 375, w: 210, h: 38 },
      ];
    if (task === "deep-kitchen")
      return [
        { x: 95, y: 75, w: 330, h: 125 },
        { x: 150, y: 185, w: 245, h: 175 },
      ];
    if (task === "equipment")
      return [
        { x: 95, y: 75, w: 330, h: 125 },
        { x: 170, y: 205, w: 205, h: 125 },
      ];
    return [{ x: 105, y: 95, w: 315, h: 105 }];
  }
  if (area === "dining") {
    const tables = DINING_TABLE_CENTERS[stage];
    const tableZones = tables.flatMap(({ x, y }) => [
      { x: x - 42, y: y - 32, w: 84, h: 12 },
      { x: x - 42, y: y + 20, w: 84, h: 12 },
      { x: x - 42, y: y - 20, w: 12, h: 40 },
      { x: x + 30, y: y - 20, w: 12, h: 40 },
    ]);
    const rows = [...new Set(tables.map(({ y }) => y))].sort((a, b) => a - b);
    const last = rows[rows.length - 1] ?? 185;
    const floorZones = [
      ...rows.slice(0, -1).map((row, i) => ({
        x: 12,
        y: row + 45,
        w: 531,
        h: Math.max(20, rows[i + 1]! - row - 90),
      })),
      { x: 12, y: last + 48, w: 531, h: Math.max(20, dimensions.height - last - 48) },
      { x: 12, y: 35, w: 44, h: dimensions.height - 70 },
      { x: 500, y: 35, w: 43, h: dimensions.height - 70 },
    ];
    if (task === "spill") {
      const c = spillCenter(stage);
      return [{ x: c.x - 48, y: c.y - 35, w: 95, h: 70 }];
    }
    if (task === "floor" || task === "mop-all") return floorZones;
    if (task === "tables") return tableZones;
    return [...floorZones, ...tableZones];
  }
  if (task === "restroom-floor")
    return [
      { x: 112, y: 142, w: 258, h: 145 },
      { x: 285, y: 254, w: 115, h: 44 },
    ];
  if (task === "restroom-disinfect")
    return [
      { x: 444, y: 70, w: 34, h: 96 }, // mirror
      { x: 386, y: 105, w: 43, h: 42 }, // upper sink and tap
      { x: 386, y: 184, w: 43, h: 42 }, // lower sink and tap
    ];
  if (task === "toilet")
    return [
      { x: 96, y: 58, w: 62, h: 63 }, // toilet bowl and rim
      { x: 225, y: 57, w: 38, h: 50 }, // urinal bowl
    ];
  return [
    { x: 90, y: 55, w: 178, h: 70 },
    { x: 382, y: 102, w: 51, h: 126 },
  ];
}

/** The dining spill sits between the first two rows of tables. */
export function spillCenter(stage: KitchenMapArtStage): Point {
  const rows = [...new Set(DINING_TABLE_CENTERS[stage].map(({ y }) => y))].sort((a, b) => a - b);
  const last = rows[rows.length - 1] ?? 185;
  return {
    x: SCENE_SIZE.dining.width * 0.52,
    y: rows.length > 1 ? (rows[0]! + rows[1]!) / 2 : Math.max(70, last - 120),
  };
}

/** The cooktop's grease streaks (kitchen grease tasks). */
const GREASE_STREAKS: readonly [number, number, number, number][] = [
  [140, 120, 216, 128],
  [250, 150, 345, 136],
  [180, 176, 265, 169],
];

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

const RADIUS: Record<StainKind, [number, number]> = {
  sauce: [8, 15],
  smear: [11, 18],
  "coffee-ring": [8, 11],
  crust: [6, 10],
  grease: [10, 16],
  crumbs: [9, 14],
  scuff: [12, 19],
  footprint: [9, 11],
  puddle: [7, 10],
  scale: [7, 12],
  "water-spots": [7, 11],
  grime: [11, 17],
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
): Stain[] {
  const rnd = seeded(hash(`${area}|${task}|${stage}`));
  const zones = dirtZones(area, task, stage);
  const { width, height } = SCENE_SIZE[area];
  const out: Stain[] = [];
  const base = toolForTask(area, task);
  const add = (s: Omit<Stain, "id" | "seed" | "toughness">) =>
    out.push({
      ...s,
      id: firstId + out.length,
      seed: Math.floor(rnd() * 2 ** 31),
      toughness: TOUGHNESS[s.kind],
    });

  // The spill: one big puddle with a few splashes around it.
  if (task === "spill") {
    const c = spillCenter(stage);
    add({ kind: "puddle", task, tool: "mop", x: c.x, y: c.y, r: 30, stretch: 1.35, angle: -0.16 });
  }
  // The cooktop's grease runs in streaks.
  if (area === "kitchen" && (task === "grease" || task === "degrease")) {
    for (const [x1, y1, x2, y2] of GREASE_STREAKS) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      add({
        kind: "grease",
        task,
        tool: "scraper",
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        r: 8,
        stretch: len / 16,
        angle: Math.atan2(y2 - y1, x2 - x1),
      });
    }
  }
  const target = stainCount(area, task);
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
    const spacing = zone.w * zone.h < 4000 ? 0.35 : 0.75;
    const crowded = out.some(
      (o) => Math.hypot(o.x - x, o.y - y) < (o.r * Math.max(1, o.stretch * 0.6) + r) * spacing,
    );
    if (crowded && guard < target * 25) continue;
    add({
      kind,
      task,
      tool:
        area === "restroom" && task === "restroom-disinfect"
          ? x >= 440
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

/** The stains for a cleaning (one task, or the whole room for the practice). */
export function makeStains(
  area: CleanArea,
  task: TaskKind,
  stage: KitchenMapArtStage,
  roomWide = false,
): Stain[] {
  const tasks = roomWide ? ROOM_TASKS[area] : [task];
  const out: Stain[] = [];
  for (const t of tasks) out.push(...taskStains(area, t, stage, roomWide, out.length));
  return out;
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
