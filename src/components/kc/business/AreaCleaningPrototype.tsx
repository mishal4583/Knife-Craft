import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import type { CleanArea, TaskKind } from "@/game/restaurant/cleanliness";
import type { KitchenMapArtStage } from "@/game/kitchen/kitchenMapArt";
import { KButton } from "../common/primitives";

const BRUSH_RADIUS = 30;
const CLEAN_THRESHOLD = 0.9;
const SCENE_SIZE: Record<CleanArea, { width: number; height: number }> = {
  kitchen: { width: 510, height: 520 },
  dining: { width: 555, height: 370 },
  restroom: { width: 510, height: 340 },
};

type Point = { x: number; y: number };

const DINING_TABLE_CENTERS: Record<KitchenMapArtStage, Point[]> = {
  humble: [{ x: 145, y: 220 }, { x: 410, y: 220 }],
  growing: [{ x: 145, y: 88 }, { x: 410, y: 88 }, { x: 278, y: 270 }],
  established: [{ x: 145, y: 88 }, { x: 410, y: 88 }, { x: 145, y: 230 }, { x: 410, y: 230 }],
  "neighborhood-cafe": [
    { x: 145, y: 90 }, { x: 410, y: 90 },
    { x: 88, y: 282 }, { x: 278, y: 282 }, { x: 470, y: 282 },
  ],
  "flourishing-cafe": [{ x: 145, y: 88 }, { x: 410, y: 88 }, { x: 145, y: 232 }, { x: 410, y: 232 }],
  grand: [
    { x: 105, y: 80 }, { x: 280, y: 80 }, { x: 455, y: 80 },
    { x: 105, y: 190 }, { x: 280, y: 190 }, { x: 455, y: 190 },
    { x: 105, y: 300 }, { x: 280, y: 300 }, { x: 455, y: 300 },
  ],
};

const TASK_COPY: Partial<Record<TaskKind, { title: string; instruction: string }>> = {
  equipment: { title: "Clean the cooking equipment", instruction: "Scrub the cooking line and prep station." },
  grease: { title: "Degrease the stove and fryer", instruction: "Work over the greasy cooktop marks." },
  degrease: { title: "Degrease the hot equipment", instruction: "Scrub the cooktop until the grease is gone." },
  "deep-kitchen": { title: "Deep clean the kitchen", instruction: "Clean the cooking line, worktop and service equipment." },
  "sweep-line": { title: "Sweep the kitchen line", instruction: "Sweep the marked floor lanes between the equipment." },
  tables: { title: "Wipe and sanitize the tables", instruction: "Wipe the marked table tops before the next service." },
  floor: { title: "Sweep and mop the dining floor", instruction: "Clean the marked walkways between the tables." },
  spill: { title: "Clean up the spill", instruction: "Wipe up the spill, then clean the surrounding floor." },
  "mop-all": { title: "Mop the dining area", instruction: "Work across the dining floor and clear every marked patch." },
  "deep-dining": { title: "Deep clean the dining area", instruction: "Clean the tables, floor edges and guest walkways." },
  toilet: { title: "Clean the toilet and urinal", instruction: "Scrub the marked fixtures and leave them sanitary." },
  "restroom-floor": { title: "Mop the restroom floor", instruction: "Wipe the marks from the tiled floor." },
  "restroom-disinfect": { title: "Disinfect the restroom", instruction: "Clean the fixtures and tiled floor before opening." },
  "deep-restroom": { title: "Deep clean the restroom", instruction: "Scrub the fixtures, floor and tile edges." },
};

export type CleaningToolId = "sponge" | "cloth" | "scraper" | "broom" | "mop" | "toilet-brush" | "glass-cloth";
type DirtMark = { point: Point; task: TaskKind; tool: CleaningToolId };

export const ROOM_CLEANING_TESTS: readonly {
  area: CleanArea;
  task: TaskKind;
  title: string;
  subtitle: string;
  dirtCount: number;
  toolCount: number;
}[] = [
  { area: "kitchen", task: "equipment", title: "Kitchen close-down", subtitle: "Grease · food splashes · prep crumbs", dirtCount: 3, toolCount: 5 },
  { area: "dining", task: "tables", title: "Dining reset", subtitle: "Crumbs · drink spill · floor marks", dirtCount: 3, toolCount: 4 },
  { area: "restroom", task: "toilet", title: "Restroom refresh", subtitle: "Fixture scale · sink spots · floor grime", dirtCount: 3, toolCount: 4 },
];

const TOOLS: Record<CleanArea, readonly { id: CleaningToolId; icon: string; name: string; use: string }[]> = {
  kitchen: [
    { id: "sponge", icon: "🧽", name: "Sponge", use: "food splashes" },
    { id: "cloth", icon: "🧻", name: "Sanitizer cloth", use: "prep surfaces" },
    { id: "scraper", icon: "🪒", name: "Grill scraper", use: "baked-on grease" },
    { id: "broom", icon: "🧹", name: "Broom", use: "dry crumbs" },
    { id: "mop", icon: "🪣", name: "Floor mop", use: "wet floor marks" },
  ],
  dining: [
    { id: "cloth", icon: "🧻", name: "Table cloth", use: "table smears" },
    { id: "scraper", icon: "🪒", name: "Table scraper", use: "stuck-on food" },
    { id: "broom", icon: "🧹", name: "Broom", use: "dry crumbs" },
    { id: "mop", icon: "🪣", name: "Floor mop", use: "drink spills" },
  ],
  restroom: [
    { id: "toilet-brush", icon: "🪥", name: "Toilet brush", use: "toilet bowl" },
    { id: "sponge", icon: "🧽", name: "Detail sponge", use: "sink and taps" },
    { id: "glass-cloth", icon: "✨", name: "Glass cloth", use: "mirror spots" },
    { id: "mop", icon: "🪣", name: "Restroom mop", use: "floor grime" },
  ],
};

const ROOM_TASKS: Record<CleanArea, readonly TaskKind[]> = {
  kitchen: ["equipment", "grease", "sweep-line"],
  dining: ["tables", "spill", "floor", "mop-all"],
  restroom: ["toilet", "restroom-floor", "restroom-disinfect"],
};

function toolForTask(area: CleanArea, task: TaskKind): CleaningToolId {
  if (area === "kitchen") {
    if (task === "grease" || task === "degrease") return "scraper";
    if (task === "sweep-line") return "broom";
    if (task === "floor") return "mop";
    if (task === "deep-kitchen") return "sponge";
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

function makeRoomDirt(area: CleanArea, stage: KitchenMapArtStage): DirtMark[] {
  return ROOM_TASKS[area].flatMap((task) => {
    const taskPoints = area === "restroom" && task === "restroom-disinfect"
      ? (() => {
          let seed = 91273;
          const random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
          };
          const zones = [
            { x: 444, y: 70, w: 34, h: 96 }, // mirror water spots
            { x: 386, y: 105, w: 43, h: 42 }, // upper sink and tap
            { x: 386, y: 184, w: 43, h: 42 }, // lower sink and tap
          ];
          return Array.from({ length: 36 }, (_, index) => {
            const zone = zones[index < 12 ? 0 : index < 24 ? 1 : 2]!;
            return { x: zone.x + random() * zone.w, y: zone.y + random() * zone.h };
          });
        })()
      : makeDirt(area, task, stage);
    return taskPoints.map((point, index) => {
      let tool = toolForTask(area, task);
      if (area === "kitchen" && task === "equipment" && index % 3 === 0) tool = "cloth";
      if (area === "kitchen" && task === "sweep-line" && index % 2 === 0) tool = "mop";
      if (area === "dining" && task === "tables" && index % 4 === 0) tool = "scraper";
      if (area === "dining" && task === "floor" && index % 2 === 0) tool = "broom";
      if (area === "restroom" && task === "restroom-disinfect") tool = point.x >= 440 ? "glass-cloth" : "sponge";
      return { point, task, tool };
    });
  });
}

function distanceToSegmentSquared(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  if (!length) return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length));
  return (point.x - start.x - t * dx) ** 2 + (point.y - start.y - t * dy) ** 2;
}

function makeDirt(area: CleanArea, task: TaskKind, stage: KitchenMapArtStage): Point[] {
  const rand = (seed: number) => {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  };
  const random = rand(task.split("").reduce((n, char) => n + char.charCodeAt(0), 712));
  const dimensions = SCENE_SIZE[area];
  const tableZones = DINING_TABLE_CENTERS[stage].flatMap(({ x, y }) => [
    { x: x - 42, y: y - 32, w: 84, h: 12 },
    { x: x - 42, y: y + 20, w: 84, h: 12 },
    { x: x - 42, y: y - 20, w: 12, h: 40 },
    { x: x + 30, y: y - 20, w: 12, h: 40 },
  ]);
  const tableRows = [...new Set(DINING_TABLE_CENTERS[stage].map(({ y }) => y))].sort((a, b) => a - b);
  const lastTableRow = tableRows[tableRows.length - 1] ?? 185;
  const spillCenter = {
    x: dimensions.width * 0.52,
    y: tableRows.length > 1 ? (tableRows[0]! + tableRows[1]!) / 2 : Math.max(70, lastTableRow - 120),
  };
  const floorZones = [
    ...tableRows.slice(0, -1).map((row, index) => ({
      x: 12,
      y: row + 45,
      w: 531,
      h: Math.max(20, tableRows[index + 1]! - row - 90),
    })),
    { x: 12, y: lastTableRow + 48, w: 531, h: Math.max(20, dimensions.height - lastTableRow - 48) },
    { x: 12, y: 35, w: 44, h: dimensions.height - 70 },
    { x: 500, y: 35, w: 43, h: dimensions.height - 70 },
  ];
  const zones = area === "kitchen"
      ? task === "sweep-line"
        ? [
            { x: 86, y: 190, w: 48, h: 270 },
            { x: 378, y: 190, w: 42, h: 235 },
            { x: 168, y: 375, w: 210, h: 38 },
          ]
        : task === "deep-kitchen"
      ? [{ x: 95, y: 75, w: 330, h: 125 }, { x: 150, y: 185, w: 245, h: 175 }]
      : task === "equipment"
        ? [{ x: 95, y: 75, w: 330, h: 125 }, { x: 170, y: 205, w: 205, h: 125 }]
        : [{ x: 105, y: 95, w: 315, h: 105 }]
    : area === "dining"
      ? task === "spill"
        ? [{ x: spillCenter.x - 48, y: spillCenter.y - 35, w: 95, h: 70 }]
        : task === "floor" || task === "mop-all"
          ? floorZones
          : task === "tables"
            ? tableZones
            : [...floorZones, ...tableZones]
      : task === "restroom-floor"
        ? [
            { x: 112, y: 142, w: 258, h: 145 },
            { x: 285, y: 254, w: 115, h: 44 },
          ]
        : task === "restroom-disinfect"
          ? [
              { x: 444, y: 70, w: 34, h: 96 },
              { x: 386, y: 105, w: 43, h: 42 },
              { x: 386, y: 184, w: 43, h: 42 },
            ]
        : task === "toilet"
          ? [
              { x: 96, y: 58, w: 62, h: 63 }, // toilet bowl and rim
              { x: 225, y: 57, w: 38, h: 50 }, // urinal bowl
            ]
          : [{ x: 90, y: 55, w: 178, h: 70 }, { x: 382, y: 102, w: 51, h: 126 }];
  const markCount = task === "deep-kitchen" || task === "deep-dining" || task === "deep-restroom"
    ? 170
    : area === "restroom"
      ? task === "restroom-floor" ? 40 : task === "toilet" ? 32 : 36
      : 120;
  const marks = Array.from({ length: markCount }, () => {
    const zone = zones[Math.floor(random() * zones.length)]!;
    return { x: zone.x + random() * zone.w, y: zone.y + random() * zone.h };
  });
  if (area === "kitchen" && (task === "grease" || task === "degrease" || task === "deep-kitchen")) {
    [[140, 120, 216, 128], [250, 150, 345, 136], [180, 176, 265, 169]].forEach(([x1, y1, x2, y2]) => {
      for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        marks.push({ x: x1! + (x2! - x1!) * t, y: y1! + (y2! - y1!) * t });
      }
    });
  }
  // Give isolated dining spills and restroom fixtures a believable, focused stain cluster.
  if (area === "dining" && task === "spill") {
    marks.push(...Array.from({ length: 28 }, () => ({ x: spillCenter.x + (random() - 0.5) * 48, y: spillCenter.y + (random() - 0.5) * 32 })));
  }
  return marks;
}

function drawDirt(canvas: HTMLCanvasElement, points: Point[], task: TaskKind, area: CleanArea, stage: KitchenMapArtStage) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = SCENE_SIZE[area];
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  if (area === "restroom") {
    points.forEach((point, index) => {
      const radius = task === "restroom-disinfect" ? 3.5 + (index % 3) * 0.7 : 3.7 + (index % 3) * 0.65;
      if (task === "restroom-disinfect") {
        const mirrorSpot = point.x >= 440;
        ctx.fillStyle = mirrorSpot ? "rgba(225, 237, 231, .54)" : "rgba(175, 198, 190, .56)";
        ctx.beginPath();
        ctx.ellipse(point.x, point.y, radius * 1.25, radius * 0.82, ((index % 5) - 2) * 0.12, 0, Math.PI * 2);
        ctx.fill();
        if (index % 3 === 0) {
          ctx.strokeStyle = mirrorSpot ? "rgba(245, 248, 237, .84)" : "rgba(224, 235, 223, .76)";
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius * 1.3, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (task === "toilet") {
        ctx.fillStyle = `rgba(${index % 2 ? "146, 107, 64" : "190, 158, 111"}, .62)`;
        ctx.beginPath();
        ctx.ellipse(point.x, point.y, radius * 1.05, radius * 0.62, ((index % 5) - 2) * 0.16, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = "rgba(91, 70, 50, .44)";
        ctx.lineWidth = Math.max(2.2, radius * 0.76);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(point.x - radius * 1.2, point.y + radius * 0.3);
        ctx.lineTo(point.x + radius * 1.1, point.y - radius * 0.35);
        ctx.stroke();
      }
    });
    return;
  }
  points.forEach((point, index) => {
    const size = 3 + ((index * 7) % 7);
    let stainColor = "rgba(90, 55, 29, .64)";
    if (area === "restroom" && task === "restroom-floor") stainColor = "rgba(91, 82, 67, .36)";
    else if (area === "restroom") stainColor = "rgba(90, 71, 53, .48)";
    else if (area === "dining" && task === "spill") stainColor = "rgba(151, 65, 28, .64)";
    else if (area === "dining" && task === "tables") stainColor = "rgba(122, 77, 43, .42)";
    else if ((area === "dining" && (task === "floor" || task === "mop-all")) || (area === "kitchen" && task === "sweep-line")) {
      stainColor = "rgba(91, 82, 67, .38)";
    } else if (task === "grease" || task === "degrease") stainColor = "rgba(61, 34, 16, .8)";
    ctx.fillStyle = stainColor;
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, size * 1.45, size, (index % 9) * 0.2, 0, Math.PI * 2);
    ctx.fill();
  });
  // Longer grease smears make the stove task read as a wipe-down, not random speckles.
  if (area === "kitchen" && (task === "grease" || task === "degrease" || task === "deep-kitchen")) {
    ctx.strokeStyle = "rgba(76, 43, 20, .5)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    [[140, 120, 216, 128], [250, 150, 345, 136], [180, 176, 265, 169]].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1!, y1!);
      ctx.quadraticCurveTo((x1! + x2!) / 2, y1! - 8, x2!, y2!);
      ctx.stroke();
    });
  }
  if (area === "dining" && task === "spill") {
    const rows = [...new Set(DINING_TABLE_CENTERS[stage].map(({ y }) => y))].sort((a, b) => a - b);
    const lastRow = rows[rows.length - 1] ?? 185;
    const spillY = rows.length > 1 ? (rows[0]! + rows[1]!) / 2 : Math.max(70, lastRow - 120);
    ctx.fillStyle = "rgba(151, 65, 28, .42)";
    ctx.beginPath();
    ctx.ellipse(width * 0.52, spillY, 28, 17, -0.16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRoomDirt(canvas: HTMLCanvasElement, marks: DirtMark[], area: CleanArea) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = SCENE_SIZE[area];
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  marks.forEach(({ point, task, tool }, index) => {
    const radius = area === "restroom"
      ? task === "restroom-disinfect" ? 3.5 + (index % 3) * 0.7
        : task === "toilet" ? 3.7 + (index % 3) * 0.65
          : 3.8 + (index % 4) * 0.6
      : 3.2 + ((index * 7) % 8) * 0.72;
    const greasy = task === "grease" || task === "degrease";
    const liquid = task === "spill";
    const dryFloor = task === "floor" || task === "sweep-line" || task === "mop-all" || task === "restroom-floor";
    const restroom = area === "restroom";
    const foodResidue = task === "equipment" || task === "tables";
    const waterSpots = restroom && task === "restroom-disinfect";
    const mineralScale = restroom && task === "toilet";
    if (restroom) {
      ctx.save();
      if (waterSpots) {
        const mirrorSpot = tool === "glass-cloth";
        ctx.fillStyle = mirrorSpot ? "rgba(225, 237, 231, .54)" : "rgba(175, 198, 190, .56)";
        ctx.beginPath();
        ctx.ellipse(point.x, point.y, radius * 1.25, radius * 0.82, ((index % 5) - 2) * 0.12, 0, Math.PI * 2);
        ctx.fill();
        if (index % 3 === 0) {
          ctx.strokeStyle = mirrorSpot ? "rgba(245, 248, 237, .84)" : "rgba(224, 235, 223, .76)";
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius * 1.3, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (mineralScale) {
        ctx.fillStyle = `rgba(${index % 2 ? "146, 107, 64" : "190, 158, 111"}, .62)`;
        ctx.beginPath();
        ctx.ellipse(point.x, point.y, radius * 1.05, radius * 0.62, ((index % 5) - 2) * 0.16, 0, Math.PI * 2);
        ctx.fill();
      } else if (dryFloor) {
        ctx.strokeStyle = "rgba(91, 70, 50, .44)";
        ctx.lineWidth = Math.max(2.2, radius * 0.76);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(point.x - radius * 1.2, point.y + radius * 0.3);
        ctx.lineTo(point.x + radius * 1.1, point.y - radius * 0.35);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    ctx.fillStyle = greasy
      ? `rgba(62, 32, 13, ${0.62 + (index % 3) * 0.08})`
      : liquid
        ? `rgba(${index % 2 ? "133, 52, 33" : "105, 57, 29"}, .68)`
        : waterSpots
          ? `rgba(${index % 2 ? "166, 187, 183" : "210, 220, 211"}, .58)`
          : mineralScale
            ? `rgba(${index % 2 ? "157, 132, 91" : "190, 164, 120"}, .48)`
        : dryFloor
          ? `rgba(70, 60, 50, ${restroom ? ".38" : ".42"})`
          : restroom
            ? `rgba(${index % 3 ? "140, 124, 99" : "178, 158, 126"}, .46)`
            : foodResidue
              ? `rgba(${index % 3 ? "145, 67, 35" : "177, 102, 47"}, .58)`
              : `rgba(${index % 3 ? "128, 69, 33" : "171, 104, 47"}, .55)`;
    ctx.beginPath();
    ctx.ellipse(
      point.x,
      point.y,
      radius * (liquid ? 1.8 : 1.35),
      radius * (liquid ? 1.15 : 0.72),
      ((index % 7) - 3) * 0.13,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    if (liquid && index % 5 === 0) {
      ctx.beginPath();
      ctx.arc(point.x + radius * 1.2, point.y - radius * 0.45, radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    if (waterSpots && index % 4 === 0) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * 1.35, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(238, 244, 232, .7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
  // Long oily wipe marks distinguish baked-on cookline grease from food crumbs.
  if (area === "kitchen") {
    ctx.strokeStyle = "rgba(68, 35, 14, .55)";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    [[140, 120, 216, 128], [250, 150, 345, 136], [180, 176, 265, 169]].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1!, y1!);
      ctx.quadraticCurveTo((x1! + x2!) / 2, y1! - 8, x2!, y2!);
      ctx.stroke();
    });
  }
}

export function AreaCleaningPrototype({
  area,
  task,
  stage,
  image,
  roomWide = false,
  previewOnly = false,
  onClose,
  onComplete,
}: {
  area: CleanArea;
  task: TaskKind;
  stage: KitchenMapArtStage;
  image: string;
  roomWide?: boolean;
  previewOnly?: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activePointerRef = useRef<number | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const wipedRef = useRef(new Set<number>());
  const completeRef = useRef(false);
  const progressRef = useRef(0);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [gameViewport, setGameViewport] = useState({ width: 540, height: 960 });
  const [progress, setProgress] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [toolHint, setToolHint] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<CleaningToolId>(() =>
    roomWide ? TOOLS[area][0]!.id : toolForTask(area, task),
  );
  const points = useMemo(() => makeDirt(area, task, stage), [area, stage, task]);
  const roomMarks = useMemo(() => makeRoomDirt(area, stage), [area, stage]);
  const marks = useMemo<DirtMark[]>(
    () => roomWide
      ? roomMarks
      : points.map((point) => ({
          point,
          task,
          tool: area === "restroom" && task === "restroom-disinfect"
            ? point.x >= 440 ? "glass-cloth" : "sponge"
            : toolForTask(area, task),
        })),
    [area, points, roomMarks, roomWide, task],
  );
  const copy = TASK_COPY[task];
  const dimensions = SCENE_SIZE[area];
  const roomTitle = area === "kitchen" ? "Kitchen" : area === "dining" ? "Dining area" : "Restroom";
  const stageWidthLimit = Math.max(180, Math.min(roomWide ? 448 : 436, gameViewport.width - 32));
  const stageHeightLimit = roomWide ? Math.max(210, Math.min(390, gameViewport.height * 0.42)) : Number.POSITIVE_INFINITY;
  const stageScale = Math.min(stageWidthLimit / dimensions.width, stageHeightLimit / dimensions.height);
  const stageDisplay = { width: dimensions.width * stageScale, height: dimensions.height * stageScale };
  const availableTools = roomWide
    ? TOOLS[area]
    : TOOLS[area].filter((tool) => marks.some((mark) => mark.tool === tool.id));
  const cleaningTool = availableTools.find((tool) => tool.id === activeTool) ?? availableTools[0]!;
  const totalMarks = marks.length;

  useEffect(() => {
    const target = document.querySelector<HTMLElement>("[data-game-content]");
    setPortalTarget(target);
    if (!target) return;
    const measure = () => setGameViewport({ width: target.clientWidth || 540, height: target.clientHeight || 960 });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!portalTarget || !canvas) return;
    if (roomWide) drawRoomDirt(canvas, roomMarks, area);
    else drawDirt(canvas, points, task, area, stage);
  }, [area, points, portalTarget, roomMarks, roomWide, stage, task]);

  const erase = (event: PointerEvent<HTMLCanvasElement>, from: Point | null) => {
    const canvas = canvasRef.current;
    if (!canvas || completeRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const current = { x: ((event.clientX - rect.left) / rect.width) * dimensions.width, y: ((event.clientY - rect.top) / rect.height) * dimensions.height };
    const start = from ?? current;
    const ctx = canvas.getContext("2d");
    const radius = activeTool === "mop" || activeTool === "broom" ? BRUSH_RADIUS * 1.25 : activeTool === "scraper" || activeTool === "toilet-brush" ? BRUSH_RADIUS * 0.85 : BRUSH_RADIUS;
    const hitIndices = marks.flatMap((mark, index) =>
      !wipedRef.current.has(index) && mark.tool === activeTool && distanceToSegmentSquared(mark.point, start, current) <= radius ** 2
        ? [index]
        : [],
    );
    if (hitIndices.length && ctx) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      for (const index of hitIndices) {
        const { point } = marks[index]!;
        ctx.beginPath();
        ctx.ellipse(point.x, point.y, radius * 0.92, radius * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    hitIndices.forEach((index) => wipedRef.current.add(index));
    const pct = Math.min(100, Math.round((wipedRef.current.size / totalMarks) * 100));
    if (pct !== progressRef.current) {
      progressRef.current = pct;
      setProgress(pct);
    }
    if (!hitIndices.length && roomWide) {
      const wrongTool = marks.find((mark) =>
        mark.tool !== activeTool && distanceToSegmentSquared(mark.point, start, current) <= radius ** 2,
      );
      if (wrongTool) {
        const required = TOOLS[area].find((tool) => tool.id === wrongTool.tool);
        const hint = `Switch to ${required?.name.toLowerCase() ?? "the right tool"} for this mark.`;
        setToolHint((current) => current === hint ? current : hint);
      }
    } else if (hitIndices.length) {
      setToolHint((current) => current === null ? current : null);
    }
    lastPointRef.current = current;
    if (pct / 100 >= CLEAN_THRESHOLD && !completeRef.current) {
      completeRef.current = true;
      progressRef.current = 100;
      setProgress(100);
      window.setTimeout(onComplete, 180);
    }
  };

  const handleDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    lastPointRef.current = null;
    setScrubbing(true);
    erase(event, null);
  };
  const handleMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    erase(event, lastPointRef.current);
  };
  const handleUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    lastPointRef.current = null;
    setScrubbing(false);
  };

  const selectTool = (tool: CleaningToolId) => {
    setActiveTool(tool);
    setToolHint(null);
  };

  const roomTest = ROOM_CLEANING_TESTS.find((entry) => entry.area === area);
  const modal = (
    <div
      className="absolute inset-0 z-[100] flex min-h-0 items-stretch justify-stretch overflow-hidden bg-[#1b100a]/85 p-0 backdrop-blur-sm"
      style={{ touchAction: "none", overscrollBehavior: "contain" }}
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border border-[#d5a65a] bg-[#fff3d9]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`clean-title-${area}`}
        data-testid={`${area}-cleaning-prototype`}
      >
        <header className="relative z-20 flex shrink-0 items-center gap-2.5 border-b border-[#dfc79e] bg-[linear-gradient(135deg,#fff9e9,#f0d7a9)] px-3 py-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#6b3d20] text-[22px] text-[#fff2d6] shadow">{area === "kitchen" ? "👨‍🍳" : area === "dining" ? "🍽️" : "🚻"}</span>
          <div className="min-w-0 flex-1">
            <h2 id={`clean-title-${area}`} className="font-display text-[18px] font-black leading-tight text-walnut-dark">
              {roomWide ? roomTest?.title : copy?.title ?? `Clean the ${roomTitle.toLowerCase()}`}
            </h2>
            <p className="mt-0.5 truncate font-ui text-[11.5px] font-semibold text-walnut/75">
              {roomWide ? roomTest?.subtitle : copy?.instruction ?? `Scrub the marked surfaces in the ${roomTitle.toLowerCase()}.`}
            </p>
            {previewOnly ? <span className="mt-1 inline-flex rounded-full bg-[#788a70]/15 px-2 py-0.5 font-ui text-[10px] font-black uppercase tracking-wide text-olive">Practice · no save or supplies</span> : null}
          </div>
          <button type="button" onClick={onClose} aria-label={`Close ${roomTitle.toLowerCase()} cleaning`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-walnut/15 bg-white/65 font-ui text-xl font-black text-walnut-dark">×</button>
        </header>
        {previewOnly ? <span className="sr-only" data-testid="cleaning-test-mode">Practice only. Progress and supplies are not saved.</span> : null}
        {roomWide ? (
          <div className="shrink-0 border-b border-[#e4d1ad] bg-[#f9edcf] px-2.5 py-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="font-ui text-[10px] font-black uppercase tracking-[.12em] text-walnut/65">Choose equipment</span>
              <span className="font-ui text-[10px] font-semibold text-walnut/60">Match tool to mess</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 min-[360px]:grid-cols-3">
              {availableTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => selectTool(tool.id)}
                  aria-pressed={activeTool === tool.id}
                  className={`flex min-h-[48px] items-center gap-1.5 rounded-xl border px-1.5 py-1 text-left shadow-sm transition ${activeTool === tool.id ? "border-[#a3602c] bg-[#6b3d20] text-[#fff4dc] ring-1 ring-[#d7a85a]" : "border-[#d9c39a] bg-[#fffaf0] text-walnut-dark hover:bg-white"}`}
                >
                  <span className="shrink-0 text-[18px]" aria-hidden>{tool.icon}</span>
                  <span className="min-w-0"><span className="block truncate font-ui text-[11px] font-black leading-tight">{tool.name}</span><span className={`block truncate font-ui text-[10px] leading-tight ${activeTool === tool.id ? "text-[#f4d8a1]" : "text-walnut/60"}`}>{tool.use}</span></span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="relative mx-auto my-2 shrink-0 overflow-hidden rounded-xl border border-[#89603e] bg-[#38261b] shadow-inner sm:my-3 sm:rounded-2xl" style={{ ...stageDisplay, touchAction: "none", overscrollBehavior: "contain" }}>
          <img src={image} alt={`${roomTitle} from the current restaurant map`} className="block h-full w-full select-none object-fill" draggable={false} />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none overscroll-contain" style={{ touchAction: "none", overscrollBehavior: "contain" }} onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp} onLostPointerCapture={handleUp} aria-label={`Drag the ${cleaningTool.name} over matching marks in the ${roomTitle.toLowerCase()}`} />
          {!scrubbing && progress === 0 ? <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/70 bg-[#fff7e6]/95 px-2.5 py-1 font-ui text-[10px] font-extrabold text-walnut-dark shadow sm:bottom-3 sm:text-[12px]">{cleaningTool.icon} Drag over matching marks</span> : null}
        </div>
        <div className="relative z-20 mt-auto shrink-0 border-t border-[#e4d1ad] bg-[#fff3d9]/95 p-2.5 sm:p-3">
          <p className={`mb-1.5 flex min-h-[30px] items-center justify-center rounded-lg border px-2 py-1.5 text-center font-ui text-[10.5px] font-extrabold ${toolHint ? "border-[#d89d52]/60 bg-[#fff9e8] text-[#8e5423]" : "border-transparent bg-transparent text-transparent"}`} role="status" aria-live="polite">{toolHint ?? " "}</p>
          <div className="flex items-center gap-2">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#d9c5a5]" role="progressbar" aria-label={`${roomTitle} cleaning progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className="h-full rounded-full bg-sage transition-[width] duration-100" style={{ width: `${progress}%` }} />
            </div>
            <span className="w-9 text-right font-ui text-[12px] font-black text-walnut-dark">{progress}%</span>
          </div>
          <p className="mt-1 flex min-h-[30px] items-center justify-center text-center font-hand text-[12px] leading-tight text-walnut/70">
            {scrubbing ? "Keep working across the matching marks…" : roomWide ? `${cleaningTool.name} · ${cleaningTool.use} · switch tools as needed` : `Use the ${cleaningTool.name.toLowerCase()} to clear the marks.`}
          </p>
          <KButton full variant="cream" className="mt-2 min-h-10 rounded-xl text-[12px]" onClick={onClose}>{roomWide ? "Close practice" : "Cancel cleaning"}</KButton>
        </div>
      </section>
    </div>
  );

  return portalTarget ? createPortal(modal, portalTarget) : null;
}
