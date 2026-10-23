import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { AudioManager } from "@/game/AudioManager";
import { getSupplyItem, type SupplyId } from "@/game/business/businessSupplies";
import { KButton } from "../common/primitives";

const WIDTH = 360;
const HEIGHT = 280;
const PLATE = { x: 180, y: 165, rx: 92, ry: 65 };
const BRUSH_RADIUS = 28;
const CLEAN_THRESHOLD = 1;
const ITEM_CHANGE_DELAY_MS = 140;
const TABLEWARE_ITEMS = [
  { id: "dinner-plates", label: "Dinner plate", shape: "plate" },
  { id: "dinner-forks", label: "Dinner fork", shape: "fork" },
  { id: "dinner-knives", label: "Dinner knife", shape: "knife" },
  { id: "side-plates", label: "Side plate", shape: "small-plate" },
  { id: "soup-bowls", label: "Soup bowl", shape: "bowl" },
  { id: "soup-spoons", label: "Soup spoon", shape: "spoon" },
  { id: "dessert-plates", label: "Dessert plate", shape: "small-plate" },
  { id: "dessert-forks", label: "Dessert fork", shape: "fork" },
  { id: "teaspoons", label: "Teaspoon", shape: "spoon" },
  { id: "steak-knives", label: "Steak knife", shape: "knife" },
  { id: "water-glasses", label: "Water glass", shape: "glass" },
  { id: "highball-glasses", label: "Highball glass", shape: "glass" },
  { id: "coffee-tea-set", label: "Coffee cup & saucer", shape: "cup-set" },
  { id: "water-jugs", label: "Water jug", shape: "jug" },
  { id: "salt-pepper", label: "Salt & pepper shakers", shape: "shakers" },
] as const;
type WashShape = (typeof TABLEWARE_ITEMS)[number]["shape"];
const WASH_VISUAL_FRAMES: Record<
  WashShape,
  {
    viewBox: string;
    left: string;
    top: string;
    width: string;
    height: string;
    horizontal?: boolean;
  }
> = {
  plate: { viewBox: "0 0 360 280", left: "0%", top: "0%", width: "100%", height: "100%" },
  "small-plate": { viewBox: "0 0 120 90", left: "33%", top: "43%", width: "34%", height: "32%" },
  bowl: { viewBox: "0 0 120 100", left: "31%", top: "39%", width: "38%", height: "36%" },
  fork: { viewBox: "0 0 40 140", left: "44.5%", top: "34%", width: "11%", height: "48%" },
  knife: { viewBox: "0 0 40 140", left: "45%", top: "34%", width: "10%", height: "48%" },
  spoon: { viewBox: "0 0 40 140", left: "44.5%", top: "34%", width: "11%", height: "48%" },
  glass: { viewBox: "0 0 100 140", left: "42%", top: "36%", width: "16%", height: "43%" },
  "cup-set": { viewBox: "0 0 120 140", left: "35%", top: "36%", width: "30%", height: "42%" },
  jug: { viewBox: "0 0 120 160", left: "36%", top: "31%", width: "28%", height: "50%" },
  shakers: { viewBox: "0 0 120 140", left: "36%", top: "36%", width: "28%", height: "43%" },
};

type Point = { x: number; y: number };
type DirtSample = Point & { dirty: boolean; color: string; radius: number; seed: number };

function inSurface(x: number, y: number, shape: WashShape) {
  if (shape === "plate") {
    const nx = (x - PLATE.x) / (PLATE.rx - 7);
    const ny = (y - PLATE.y) / (PLATE.ry - 7);
    return nx * nx + ny * ny <= 0.96;
  }
  if (shape === "small-plate" || shape === "bowl") {
    const rx = shape === "small-plate" ? 63 : 60;
    const ry = shape === "small-plate" ? 44 : 40;
    return ((x - 180) / rx) ** 2 + ((y - 165) / ry) ** 2 <= 1;
  }
  if (shape === "fork") {
    const inTines =
      y >= 100 && y <= 132 && [166, 173, 180, 187].some((left) => x >= left && x <= left + 5);
    const inHead = y >= 126 && y <= 151 && x >= 163 && x <= 197;
    const inHandle = y >= 145 && y <= 229 && x >= 176 && x <= 184;
    const handleEnd = ((x - 180) / 6) ** 2 + ((y - 220) / 9) ** 2 <= 1;
    return inTines || inHead || inHandle || handleEnd;
  }
  if (shape === "knife") {
    const bladeHalfWidth =
      y < 147
        ? 3 + Math.max(0, y - 100) * (11 / 47)
        : y < 157
          ? 14 + (y - 147) * 0.2
          : Math.max(8, 16 - (y - 157) * 1.3);
    const inBlade = y >= 100 && y <= 163 && Math.abs(x - 180) <= bladeHalfWidth;
    const inHandle = y >= 160 && y <= 228 && x >= 174 && x <= 186;
    const handleEnd = ((x - 180) / 7) ** 2 + ((y - 222) / 8) ** 2 <= 1;
    return inBlade || inHandle || handleEnd;
  }
  if (shape === "spoon") {
    const spoonBowl = ((x - 180) / 14) ** 2 + ((y - 117) / 17) ** 2 <= 1;
    const handle = y >= 130 && y <= 222 && x >= 176 && x <= 184;
    const handleEnd = ((x - 180) / 5) ** 2 + ((y - 221) / 8) ** 2 <= 1;
    return spoonBowl || handle || handleEnd;
  }
  if (shape === "glass") {
    const rim = y >= 103 && y <= 117 && x >= 157 && x <= 203;
    const bodyHalfWidth = 22 - Math.max(0, y - 112) * 0.055;
    const body = y >= 112 && y <= 207 && Math.abs(x - 180) <= bodyHalfWidth;
    const base = y >= 205 && y <= 219 && x >= 163 && x <= 197;
    return rim || body || base;
  }
  if (shape === "cup-set") {
    const cup = y >= 128 && y <= 178 && x >= 150 && x <= 210;
    const handle = ((x - 211) / 12) ** 2 + ((y - 145) / 18) ** 2 <= 1 && x >= 205;
    const saucer = ((x - 180) / 46) ** 2 + ((y - 194) / 13) ** 2 <= 1;
    return cup || handle || saucer;
  }
  const jugBody = y >= 110 && y <= 207 && x >= 148 && x <= 209;
  const jugNeck = y >= 101 && y <= 126 && x >= 163 && x <= 197;
  const jugHandle = ((x - 211) / 13) ** 2 + ((y - 157) / 25) ** 2 <= 1 && x >= 205;
  if (shape === "jug") return jugBody || jugNeck || jugHandle;
  const leftShaker = y >= 128 && y <= 190 && x >= 148 && x <= 174;
  const leftCap = y >= 117 && y <= 134 && x >= 153 && x <= 170;
  const rightShaker = y >= 128 && y <= 190 && x >= 186 && x <= 212;
  const rightCap = y >= 117 && y <= 134 && x >= 190 && x <= 207;
  return leftShaker || leftCap || rightShaker || rightCap;
}

function dirtSamplesFor(shape: WashShape): DirtSample[] {
  // A stable pattern makes every reset consistent and progress depend on
  // unique dirty spots rather than pointer distance or repeated strokes.
  const points: DirtSample[] = [];
  let index = 0;
  const bounds =
    shape === "plate"
      ? { minX: 88, maxX: 272, minY: 96, maxY: 236, step: 9 }
      : shape === "small-plate"
        ? { minX: 110, maxX: 250, minY: 115, maxY: 215, step: 6 }
        : shape === "bowl"
          ? { minX: 100, maxX: 260, minY: 105, maxY: 225, step: 6 }
          : shape === "fork" || shape === "knife" || shape === "spoon"
            ? { minX: 158, maxX: 202, minY: 96, maxY: 236, step: 4 }
            : shape === "glass"
              ? { minX: 145, maxX: 215, minY: 95, maxY: 230, step: 5 }
              : shape === "cup-set"
                ? { minX: 130, maxX: 230, minY: 100, maxY: 215, step: 5 }
                : shape === "jug"
                  ? { minX: 135, maxX: 225, minY: 90, maxY: 230, step: 5 }
                  : shape === "shakers"
                    ? { minX: 140, maxX: 220, minY: 112, maxY: 200, step: 4 }
                    : { minX: 115, maxX: 245, minY: 88, maxY: 230, step: 5 };
  for (let y = bounds.minY; y <= bounds.maxY; y += bounds.step) {
    for (let x = bounds.minX; x <= bounds.maxX; x += bounds.step) {
      const seed = Math.abs(Math.sin((index + 1) * 78.233) * 43758.5453) % 1;
      const pointX = x;
      const pointY = y;
      if (!inSurface(pointX, pointY, shape)) {
        index += 1;
        continue;
      }
      if (seed > (shape === "plate" ? 0.2 : 0.28)) {
        const residueColors =
          shape === "glass" || shape === "jug"
            ? ["#e7f4ef", "#b9d8d3", "#d3e6e2"]
            : shape === "shakers"
              ? ["#f0eadb", "#ddd6c5", "#ece2c8"]
              : shape === "cup-set"
                ? ["#9a582e", "#b4713c", "#754326"]
                : ["#c44824", "#df7730", "#d9ad43", "#963c25"];
        points.push({
          x: pointX,
          y: pointY,
          dirty: true,
          color: residueColors[Math.floor(seed * residueColors.length)]!,
          radius: 1.3 + seed * 1.9,
          seed,
        });
      }
      index += 1;
    }
  }
  return points;
}

function drawSoapBubbles(ctx: CanvasRenderingContext2D, samples: DirtSample[]) {
  if (samples.length === 0) return;
  const bubbleCount = Math.min(34, Math.max(14, Math.round(samples.length / 6)));
  const stride = Math.max(1, Math.floor(samples.length / bubbleCount));
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for (
    let i = 0, bubble = 0;
    i < samples.length && bubble < bubbleCount;
    i += stride, bubble += 1
  ) {
    const point = samples[i]!;
    const radius = 2.2 + point.seed * 2.2;
    ctx.globalAlpha = 0.48 + point.seed * 0.28;
    ctx.fillStyle = "rgba(190, 231, 239, .18)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = "rgba(246, 255, 255, .9)";
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(255, 255, 255, .96)";
    ctx.beginPath();
    ctx.arc(
      point.x - radius * 0.32,
      point.y - radius * 0.34,
      Math.max(0.65, radius * 0.18),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

const DIRT_SAMPLES: Record<WashShape, DirtSample[]> = {
  plate: dirtSamplesFor("plate"),
  "small-plate": dirtSamplesFor("small-plate"),
  bowl: dirtSamplesFor("bowl"),
  fork: dirtSamplesFor("fork"),
  knife: dirtSamplesFor("knife"),
  spoon: dirtSamplesFor("spoon"),
  glass: dirtSamplesFor("glass"),
  "cup-set": dirtSamplesFor("cup-set"),
  jug: dirtSamplesFor("jug"),
  shakers: dirtSamplesFor("shakers"),
};

function clipSurface(ctx: CanvasRenderingContext2D, shape: WashShape) {
  ctx.beginPath();
  if (shape === "plate") {
    ctx.ellipse(PLATE.x, PLATE.y, PLATE.rx - 5, PLATE.ry - 5, 0, 0, Math.PI * 2);
  } else if (shape === "small-plate") {
    ctx.ellipse(180, 165, 63, 44, 0, 0, Math.PI * 2);
  } else if (shape === "bowl") {
    ctx.ellipse(180, 165, 60, 40, 0, 0, Math.PI * 2);
  } else if (shape === "fork") {
    ctx.roundRect(166, 99, 5, 35, 2);
    ctx.roundRect(173, 99, 5, 35, 2);
    ctx.roundRect(180, 99, 5, 35, 2);
    ctx.roundRect(187, 99, 5, 35, 2);
    ctx.roundRect(163, 126, 34, 24, 8);
    ctx.roundRect(176, 143, 8, 78, 4);
    ctx.ellipse(180, 220, 6, 8, 0, 0, Math.PI * 2);
  } else if (shape === "knife") {
    ctx.moveTo(178, 100);
    ctx.quadraticCurveTo(180, 96, 183, 102);
    ctx.lineTo(194, 147);
    ctx.quadraticCurveTo(196, 157, 188, 163);
    ctx.lineTo(187, 220);
    ctx.quadraticCurveTo(180, 232, 173, 220);
    ctx.lineTo(172, 163);
    ctx.quadraticCurveTo(164, 157, 166, 147);
    ctx.closePath();
  } else if (shape === "spoon") {
    ctx.ellipse(180, 117, 14, 17, 0, 0, Math.PI * 2);
    ctx.roundRect(176, 130, 8, 92, 4);
    ctx.ellipse(180, 221, 5, 8, 0, 0, Math.PI * 2);
  } else if (shape === "glass") {
    ctx.ellipse(180, 111, 22, 7, 0, 0, Math.PI * 2);
    ctx.moveTo(158, 112);
    ctx.lineTo(165, 204);
    ctx.quadraticCurveTo(180, 213, 195, 204);
    ctx.lineTo(202, 112);
    ctx.closePath();
    ctx.roundRect(163, 207, 34, 8, 4);
  } else if (shape === "cup-set") {
    ctx.ellipse(180, 194, 46, 13, 0, 0, Math.PI * 2);
    ctx.roundRect(150, 117, 60, 66, 8);
    ctx.ellipse(211, 148, 12, 18, 0, 0, Math.PI * 2);
  } else if (shape === "jug") {
    ctx.roundRect(148, 119, 61, 101, 12);
    ctx.roundRect(163, 101, 34, 22, 4);
    ctx.ellipse(212, 158, 14, 26, 0, 0, Math.PI * 2);
  } else if (shape === "shakers") {
    ctx.roundRect(148, 128, 26, 62, 8);
    ctx.roundRect(153, 117, 17, 17, 3);
    ctx.roundRect(186, 128, 26, 62, 8);
    ctx.roundRect(190, 117, 17, 17, 3);
  } else {
    ctx.ellipse(180, 158, 62, 67, 0, 0, Math.PI * 2);
  }
  ctx.clip();
}

function drawDirt(canvas: HTMLCanvasElement, shape: WashShape) {
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(WIDTH * ratio);
  canvas.height = Math.round(HEIGHT * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  clipSurface(ctx, shape);
  const samples = DIRT_SAMPLES[shape];

  // Give each material the residue it would realistically collect. The marks
  // stay on this clipped canvas, so the sponge removes every type consistently.
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const foodSoiled =
    shape === "plate" ||
    shape === "small-plate" ||
    shape === "bowl" ||
    shape === "fork" ||
    shape === "knife" ||
    shape === "spoon";
  if (shape === "plate" || shape === "small-plate" || shape === "bowl") {
    ctx.strokeStyle = "rgba(196, 63, 28, .78)";
    ctx.lineWidth = shape === "plate" ? 4 : 3;
    ctx.beginPath();
    ctx.moveTo(109, 150);
    ctx.bezierCurveTo(125, 126, 148, 123, 164, 139);
    ctx.bezierCurveTo(177, 153, 192, 162, 211, 150);
    ctx.stroke();
    ctx.strokeStyle = "rgba(225, 128, 43, .76)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(131, 183);
    ctx.bezierCurveTo(150, 171, 162, 175, 179, 184);
    ctx.bezierCurveTo(197, 194, 216, 188, 228, 174);
    ctx.stroke();
    ctx.strokeStyle = "rgba(218, 163, 50, .72)";
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(122, 165);
    ctx.quadraticCurveTo(151, 147, 181, 158);
    ctx.stroke();
  } else if (foodSoiled) {
    ctx.strokeStyle = "rgba(196, 63, 28, .72)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(176, 126);
    ctx.bezierCurveTo(184, 140, 176, 151, 183, 164);
    ctx.bezierCurveTo(188, 174, 177, 184, 184, 198);
    ctx.stroke();
    ctx.strokeStyle = "rgba(225, 128, 43, .7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(184, 143);
    ctx.quadraticCurveTo(178, 157, 183, 169);
    ctx.stroke();
  } else if (shape === "cup-set") {
    // A light coffee / tea ring inside the cup, with a small run down the bowl.
    ctx.strokeStyle = "rgba(128, 72, 36, .7)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(180, 132, 19, 4, 0, Math.PI * 0.08, Math.PI * 0.92);
    ctx.stroke();
    ctx.strokeStyle = "rgba(159, 100, 53, .56)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(166, 136);
    ctx.quadraticCurveTo(169, 148, 166, 155);
    ctx.stroke();
  } else if (shape === "glass" || shape === "jug") {
    // Clear drinkware gets water spots and drying streaks, never food splatter.
    ctx.strokeStyle = "rgba(237, 250, 246, .82)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(170, 126);
    ctx.quadraticCurveTo(175, 150, 171, 168);
    ctx.moveTo(188, 151);
    ctx.quadraticCurveTo(185, 166, 188, 179);
    ctx.stroke();
    ctx.strokeStyle = "rgba(181, 215, 208, .78)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(181, 189, 5, 3, 0.2, 0, Math.PI * 2);
    ctx.ellipse(192, 134, 3.3, 2.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape === "shakers") {
    // Seasoning jars get light handling smudges and a little salt dust.
    ctx.strokeStyle = "rgba(118, 105, 83, .34)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(161, 159, 7, 13, -0.2, Math.PI * 1.1, Math.PI * 1.9);
    ctx.ellipse(199, 159, 7, 13, 0.2, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = "rgba(250, 245, 224, .92)";
    for (const [x, y] of [
      [158, 178],
      [165, 183],
      [195, 177],
      [202, 182],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Anything else gets light handling smudges.
    ctx.strokeStyle = "rgba(104, 110, 101, .44)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(163, 153, 10, 15, -0.25, Math.PI * 1.08, Math.PI * 1.9);
    ctx.ellipse(196, 173, 12, 8, 0.12, Math.PI * 1.1, Math.PI * 1.85);
    ctx.stroke();
  }
  for (const point of samples) {
    ctx.globalAlpha = 0.58 + point.seed * 0.32;
    ctx.fillStyle = point.color;
    ctx.beginPath();
    ctx.ellipse(
      point.x,
      point.y,
      point.radius,
      point.radius * (0.56 + point.seed * 0.3),
      point.seed * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  if (foodSoiled) {
    // Tiny herb flecks and sauce drops are restricted to items used for food.
    ctx.globalAlpha = 0.9;
    for (const [x, y, rotation] of [
      [143, 142, -0.4],
      [211, 178, 0.6],
      [173, 193, -0.2],
    ] as const) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = "#66813d";
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.4, 1.3, 0, 0, Math.PI * 2);
      ctx.ellipse(2.8, 1.8, 2.4, 1, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const [x, y, rx, ry] of [
      [119, 166, 4, 2.3],
      [232, 148, 3.5, 2],
      [194, 202, 3, 1.8],
    ] as const) {
      ctx.fillStyle = "rgba(190, 54, 24, .88)";
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawSoapBubbles(ctx, samples);
  ctx.restore();
}

function distanceToSegmentSquared(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  if (!length) return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length),
  );
  const x = start.x + t * dx;
  const y = start.y + t * dy;
  return (point.x - x) ** 2 + (point.y - y) ** 2;
}

function positionFromEvent(event: PointerEvent<HTMLElement>, surface: HTMLElement): Point {
  const rect = surface.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
  };
}

/** Which picture a sink line uses: the known tableware, then by its name (a plate by default). */
function shapeFor(id: SupplyId): WashShape {
  const known = TABLEWARE_ITEMS.find((t) => t.id === id);
  if (known) return known.shape;
  const name = (getSupplyItem(id)?.name ?? id).toLowerCase();
  if (/glass|tumbler|goblet/.test(name)) return "glass";
  if (/fork/.test(name)) return "fork";
  if (/knife|knives/.test(name)) return "knife";
  if (/spoon/.test(name)) return "spoon";
  if (/bowl/.test(name)) return "bowl";
  if (/cup|mug|saucer/.test(name)) return "cup-set";
  if (/jug|pitcher|carafe/.test(name)) return "jug";
  if (/shaker|salt|pepper/.test(name)) return "shakers";
  if (/side|dessert|bread|small/.test(name)) return "small-plate";
  return "plate";
}

export type SinkLine = { id: SupplyId; n: number };
export type WashResult = { ok: boolean; noSoap?: boolean };

/**
 * THE SINK (developer 2026-10-23: dishwashing back in the game, integrated).
 * The real pieces waiting after a service (`sinkLines`), one kind at a time:
 * scrub the plate, fork or glass clean and that line is washed by hand
 * (`onWash` → the cleanliness action "wash": dish soap, nothing breaks, no
 * money). Each line is saved as it is finished, so closing half-way keeps
 * what was washed; what's left is washed automatically at the next START.
 * Art and scrubbing from the 2026-10 dishwashing prototype.
 */
export function WashUpSink({
  lines,
  onWash,
  onBuySoap,
  onClose,
  reducedMotion = false,
  noSoapAtStart = false,
}: {
  /** The sink when it opened (it stays fixed while you wash). */
  lines: readonly SinkLine[];
  onWash: (id: SupplyId) => WashResult;
  onBuySoap?: (() => void) | undefined;
  onClose: () => void;
  reducedMotion?: boolean;
  /** No dish soap at all: the sink says so at once (nothing can be washed). */
  noSoapAtStart?: boolean;
}) {
  const [items] = useState(() =>
    lines.map((l) => ({
      id: l.id,
      n: l.n,
      label: (getSupplyItem(l.id)?.name ?? l.id).split(" · ")[0]!,
      shape: shapeFor(l.id),
    })),
  );
  const total = items.reduce((t, i) => t + i.n, 0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spongeRef = useRef<HTMLSpanElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressValueRef = useRef<HTMLSpanElement>(null);
  const activePointerRef = useRef<number | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const cleanedSamplesRef = useRef(new Set<number>());
  const progressRef = useRef(0);
  const completedRef = useRef(noSoapAtStart);
  const surfaceFinishedRef = useRef(false);
  const advanceTimerRef = useRef<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [hasStartedWashing, setHasStartedWashing] = useState(false);
  const [itemFinished, setItemFinished] = useState(false);
  const [complete, setComplete] = useState(items.length === 0);
  const [noSoap, setNoSoap] = useState(noSoapAtStart);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [cleanedCount, setCleanedCount] = useState(0);
  const [washedPieces, setWashedPieces] = useState(0);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const activeItem = items[Math.min(activeItemIndex, Math.max(0, items.length - 1))] ?? {
    id: "dinner-plates" as SupplyId,
    n: 0,
    label: "Plate",
    shape: "plate" as WashShape,
  };
  const spongeSize = 72;

  const updateProgress = useCallback(
    (value: number) => {
      if (progressRef.current === value) return;
      progressRef.current = value;
      if (progressFillRef.current) progressFillRef.current.style.width = `${value}%`;
      if (progressValueRef.current) progressValueRef.current.textContent = `${value}%`;
      progressBarRef.current?.setAttribute("aria-valuenow", String(value));
      progressBarRef.current?.setAttribute(
        "aria-label",
        `${value}% ${activeItem.label.toLowerCase()} clean`,
      );
    },
    [activeItem.label],
  );

  useEffect(() => {
    setPortalTarget(document.querySelector<HTMLElement>("[data-game-content]"));
  }, []);

  useEffect(() => {
    if (!portalTarget || !canvasRef.current || complete) return;
    drawDirt(canvasRef.current, activeItem.shape);
    cleanedSamplesRef.current = new Set();
    surfaceFinishedRef.current = false;
    updateProgress(0);
    setItemFinished(false);
    setScrubbing(false);
    if (spongeRef.current) {
      spongeRef.current.style.left = activeItem.shape === "plate" ? "68%" : "50%";
      spongeRef.current.style.top = activeItem.shape === "plate" ? "64%" : "59%";
      spongeRef.current.style.opacity = "1";
    }
  }, [portalTarget, activeItemIndex, activeItem.shape, complete, updateProgress]);

  useEffect(
    () => () => {
      if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
    },
    [],
  );

  function moveSponge(point: Point) {
    const sponge = spongeRef.current;
    if (!sponge) return;
    sponge.style.left = `${(point.x / WIDTH) * 100}%`;
    sponge.style.top = `${(point.y / HEIGHT) * 100}%`;
    sponge.style.opacity = "1";
  }

  const brushRadius = activeItem.shape === "plate" ? BRUSH_RADIUS : 18;

  function eraseAlong(start: Point, end: Point) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.save();
    clipSurface(ctx, activeItem.shape);
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushRadius * 2;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(end.x, end.y, brushRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** A kind scrubbed clean: wash that line for real, then the next one. */
  function finishItem() {
    const result = onWash(activeItem.id);
    if (!result.ok) {
      completedRef.current = true;
      setNoSoap(Boolean(result.noSoap));
      return;
    }
    setWashedPieces((p) => p + activeItem.n);
    setCleanedCount(activeItemIndex + 1);
    setItemFinished(true);
    AudioManager.playSfx("squeak");
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (activeItemIndex >= items.length - 1) {
      completedRef.current = true;
      setComplete(true);
      AudioManager.playSfx("levelComplete");
      return;
    }
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      activePointerRef.current = null;
      lastPointRef.current = null;
      setScrubbing(false);
      setActiveItemIndex((index) => Math.min(index + 1, items.length - 1));
    }, ITEM_CHANGE_DELAY_MS);
  }

  function scrubSegment(start: Point, end: Point) {
    eraseAlong(start, end);
    const radiusSquared = brushRadius * brushRadius;
    const samples = DIRT_SAMPLES[activeItem.shape];
    for (let i = 0; i < samples.length; i += 1) {
      if (cleanedSamplesRef.current.has(i)) continue;
      if (distanceToSegmentSquared(samples[i]!, start, end) <= radiusSquared)
        cleanedSamplesRef.current.add(i);
    }
    const next = samples.length ? cleanedSamplesRef.current.size / samples.length : 1;
    updateProgress(Math.min(100, Math.floor(next * 100)));
    if (next >= CLEAN_THRESHOLD && !surfaceFinishedRef.current && !completedRef.current) {
      surfaceFinishedRef.current = true;
      updateProgress(100);
      finishItem();
    }
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (completedRef.current || surfaceFinishedRef.current) return;
    const surface = canvasRef.current;
    if (!surface) return;
    const point = positionFromEvent(event, surface);
    const grabbedSponge = event.currentTarget === spongeRef.current;
    if (!grabbedSponge && !inSurface(point.x, point.y, activeItem.shape)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
    lastPointRef.current = point;
    setHasStartedWashing(true);
    setScrubbing(true);
    moveSponge(point);
    scrubSegment(point, point);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (
      activePointerRef.current !== event.pointerId ||
      completedRef.current ||
      surfaceFinishedRef.current
    )
      return;
    event.preventDefault();
    const surface = canvasRef.current;
    if (!surface) return;
    const point = positionFromEvent(event, surface);
    moveSponge(point);
    scrubSegment(lastPointRef.current ?? point, point);
    lastPointRef.current = point;
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    lastPointRef.current = null;
    setScrubbing(false);
  }

  const surfaceClipPath =
    activeItem.shape === "plate"
      ? "ellipse(25.6% 23.2% at 50% 58.9%)"
      : activeItem.shape === "small-plate"
        ? "ellipse(17.5% 16% at 50% 59%)"
        : activeItem.shape === "bowl"
          ? "ellipse(17% 14.5% at 50% 59%)"
          : activeItem.shape === "fork" ||
              activeItem.shape === "knife" ||
              activeItem.shape === "spoon"
            ? "ellipse(8% 26% at 50% 59%)"
            : activeItem.shape === "glass"
              ? "ellipse(11% 23% at 50% 58%)"
              : activeItem.shape === "cup-set"
                ? "ellipse(16% 22% at 50% 59%)"
                : activeItem.shape === "jug"
                  ? "ellipse(14% 25% at 50% 57%)"
                  : "ellipse(9% 15% at 50% 55%)";
  const visualFrame = WASH_VISUAL_FRAMES[activeItem.shape];
  const status = noSoap
    ? "🧴 Out of dish soap — the rest waits for the next START"
    : complete
      ? `✨ Sink empty · ${washedPieces} pieces · nothing broke`
      : itemFinished
        ? `✓ ${activeItem.label} clean!`
        : scrubbing
          ? `Keep scrubbing…`
          : `🧽 Scrub the ${activeItem.label.toLowerCase()} · ×${activeItem.n}`;

  const modal = (
    <div
      className="absolute inset-0 z-[110] flex items-center justify-center bg-walnut-dark/75 p-3 backdrop-blur-[6px]"
      data-testid="wash-up-sink"
    >
      <section
        aria-label="Wash-up"
        aria-modal="true"
        role="dialog"
        className="flex max-h-[calc(100%-24px)] w-[min(420px,100%)] flex-col overflow-y-auto rounded-[28px] border border-[#d6b16c] bg-[linear-gradient(165deg,#fff8e9,#f1dfbd)] p-4 text-walnut-dark shadow-lift land:max-w-[640px]"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <header className="flex items-start gap-3">
          <span aria-hidden className="text-[25px] leading-tight">
            🫧
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[21px] font-black leading-tight">Wash-up</p>
            <p className="mt-0.5 font-ui text-[12.5px] font-bold text-walnut/65">
              🍽️ {total} in the sink · 🧽 by hand, nothing breaks
            </p>
          </div>
          <button
            type="button"
            aria-label="Close the sink"
            onClick={onClose}
            className="press grid h-12 w-12 shrink-0 place-items-center rounded-full border border-walnut/15 bg-ivory font-ui text-[20px] font-black shadow-soft"
          >
            ×
          </button>
        </header>

        <ol
          aria-label="What's in the sink"
          className="mt-2 grid grid-cols-3 gap-1.5"
          data-testid="wash-up-lines"
        >
          {items.map((item, index) => {
            const done = index < cleanedCount;
            const current = index === activeItemIndex && !complete && !noSoap;
            return (
              <li
                key={item.id}
                data-wash-line={item.id}
                data-wash-state={done ? "done" : current ? "current" : "waiting"}
                aria-current={current ? "step" : undefined}
                className={
                  "min-w-0 rounded-xl border px-1.5 py-1.5 text-center font-ui text-[11px] font-bold " +
                  (done
                    ? "border-olive/40 bg-[#718568] text-ivory"
                    : current
                      ? "border-[#b47b32] bg-[#f3d99c] text-walnut-dark"
                      : "border-walnut/15 bg-ivory/50 text-walnut/70")
                }
              >
                <span aria-hidden>{done ? "✓" : current ? "●" : "○"}</span>
                <span className="block truncate">{item.label}</span>
                <span className="block text-[11px] font-black">×{item.n}</span>
              </li>
            );
          })}
        </ol>

        <div className="mt-3 rounded-[24px] border border-[#c08b43] bg-[linear-gradient(145deg,#5b341d,#211710)] p-2 shadow-inner">
          <div
            className="relative mx-auto w-full overflow-hidden rounded-[22px]"
            style={{ aspectRatio: `${WIDTH} / ${HEIGHT}`, maxWidth: WIDTH }}
          >
            <img
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full select-none object-cover"
              draggable={false}
              src={`${import.meta.env.BASE_URL}dishwashing/premium-sink.webp`}
            />
            {!complete && !noSoap ? (
              <svg
                aria-hidden="true"
                viewBox={visualFrame.viewBox}
                preserveAspectRatio="none"
                className="pointer-events-none absolute"
                style={{
                  left: visualFrame.left,
                  top: visualFrame.top,
                  width: visualFrame.width,
                  height: visualFrame.height,
                  filter: "drop-shadow(1px 3px 2px rgba(40,20,8,.52))",
                }}
              >
                <defs>
                  <linearGradient id="wash-metal" x1="0" x2="1">
                    <stop stopColor="#716c62" />
                    <stop offset=".22" stopColor="#f8f3df" />
                    <stop offset=".48" stopColor="#a8a394" />
                    <stop offset=".72" stopColor="#fffbed" />
                    <stop offset="1" stopColor="#6b675f" />
                  </linearGradient>
                  <linearGradient id="wash-gold" x1="0" x2="1">
                    <stop stopColor="#8c5d1e" />
                    <stop offset=".2" stopColor="#d6a33d" />
                    <stop offset=".42" stopColor="#fff0a1" />
                    <stop offset=".6" stopColor="#bc842d" />
                    <stop offset=".82" stopColor="#f4d875" />
                    <stop offset="1" stopColor="#8a5d1e" />
                  </linearGradient>
                  <linearGradient id="wash-ceramic" x1="0" y1="0" x2=".8" y2="1">
                    <stop stopColor="#fff9e9" />
                    <stop offset=".58" stopColor="#e9dcc1" />
                    <stop offset="1" stopColor="#c8b493" />
                  </linearGradient>
                  <linearGradient id="wash-glass" x1="0" x2="1">
                    <stop stopColor="#c6e2df" stopOpacity=".28" />
                    <stop offset=".28" stopColor="#fff" stopOpacity=".8" />
                    <stop offset=".58" stopColor="#91c1bd" stopOpacity=".24" />
                    <stop offset=".86" stopColor="#fff" stopOpacity=".76" />
                    <stop offset="1" stopColor="#9ecac6" stopOpacity=".42" />
                  </linearGradient>
                  <linearGradient id="wash-wood" x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor="#d8a465" />
                    <stop offset=".42" stopColor="#9a6338" />
                    <stop offset="1" stopColor="#58351f" />
                  </linearGradient>
                </defs>
                {activeItem.shape === "plate" ? (
                  <g>
                    <ellipse cx="180" cy="171" rx="99" ry="70" fill="rgba(18,13,9,.42)" />
                    <ellipse
                      cx="180"
                      cy="162"
                      rx="96"
                      ry="68"
                      fill="#81501f"
                      stroke="#4b301b"
                      strokeWidth="2"
                    />
                    <ellipse
                      cx="180"
                      cy="160"
                      rx="91"
                      ry="64"
                      fill="url(#wash-ceramic)"
                      stroke="#d9a74f"
                      strokeWidth="3"
                    />
                    <ellipse
                      cx="180"
                      cy="159"
                      rx="76"
                      ry="53"
                      fill="#f5ead5"
                      stroke="#fffaf0"
                      strokeWidth="2.5"
                    />
                    <ellipse
                      cx="180"
                      cy="158"
                      rx="65"
                      ry="43"
                      fill="#e9dcc4"
                      stroke="#d7bd8c"
                      strokeWidth="2"
                    />
                    <ellipse
                      cx="180"
                      cy="157"
                      rx="59"
                      ry="37"
                      fill="#f6eddd"
                      stroke="#fffaf1"
                      strokeWidth="2"
                    />
                    <path
                      d="M111 153 Q120 112 159 101"
                      fill="none"
                      stroke="#fff"
                      strokeOpacity=".72"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M203 211 Q239 201 249 177"
                      fill="none"
                      stroke="#fff"
                      strokeOpacity=".56"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </g>
                ) : activeItem.shape === "small-plate" ? (
                  <g>
                    <ellipse
                      cx="60"
                      cy="45"
                      rx={activeItem.id === "side-plates" ? 55 : 60}
                      ry={activeItem.id === "side-plates" ? 39 : 42}
                      fill="url(#wash-ceramic)"
                      stroke="#a87538"
                      strokeWidth="3"
                    />
                    <ellipse
                      cx="60"
                      cy="45"
                      rx={activeItem.id === "side-plates" ? 47 : 52}
                      ry={activeItem.id === "side-plates" ? 31 : 34}
                      fill="none"
                      stroke="#fffdf4"
                      strokeWidth="2"
                    />
                    <ellipse
                      cx="60"
                      cy="45"
                      rx={activeItem.id === "side-plates" ? 39 : 43}
                      ry={activeItem.id === "side-plates" ? 24 : 26}
                      fill="none"
                      stroke="#d5b878"
                      strokeWidth="1.5"
                    />
                  </g>
                ) : activeItem.shape === "bowl" ? (
                  <g>
                    <path
                      d="M8 22 Q60 16 112 22 L101 67 Q91 88 60 92 Q29 88 19 67Z"
                      fill="url(#wash-ceramic)"
                      stroke="#a87538"
                      strokeWidth="3"
                    />
                    <ellipse
                      cx="60"
                      cy="23"
                      rx="52"
                      ry="15"
                      fill="#fff9e9"
                      stroke="#a87538"
                      strokeWidth="3"
                    />
                    <ellipse
                      cx="60"
                      cy="24"
                      rx="43"
                      ry="10"
                      fill="#d8c8a7"
                      stroke="#fffdf4"
                      strokeWidth="2"
                    />
                    <path
                      d="M24 67 Q60 83 96 67"
                      fill="none"
                      stroke="#fffdf4"
                      strokeOpacity=".8"
                      strokeWidth="3"
                    />
                  </g>
                ) : activeItem.shape === "fork" ? (
                  <g
                    fill="url(#wash-metal)"
                    stroke="#716b60"
                    strokeWidth=".8"
                    strokeLinejoin="round"
                  >
                    {activeItem.id === "dessert-forks" ? (
                      <>
                        <rect x="7" y="2" width="6" height="31" rx="3" />
                        <rect x="17" y="2" width="6" height="31" rx="3" />
                        <rect x="27" y="2" width="6" height="31" rx="3" />
                        <path d="M7 25 H33 V30 Q33 40 20 43 Q7 40 7 30Z" />
                      </>
                    ) : (
                      <>
                        <rect x="5" y="2" width="5" height="31" rx="2.5" />
                        <rect x="13" y="2" width="5" height="31" rx="2.5" />
                        <rect x="22" y="2" width="5" height="31" rx="2.5" />
                        <rect x="30" y="2" width="5" height="31" rx="2.5" />
                        <path d="M5 25 H35 V30 Q35 40 20 43 Q5 40 5 30Z" />
                      </>
                    )}
                    <path d="M16 40 H24 V125 Q24 137 20 137 Q16 137 16 125Z" />
                  </g>
                ) : activeItem.shape === "knife" ? (
                  <g
                    fill="url(#wash-metal)"
                    stroke="#716b60"
                    strokeWidth=".8"
                    strokeLinejoin="round"
                  >
                    <path d="M20 2 C10 9 5 20 6 33 C7 43 12 49 17 51 L13 123 Q13 137 20 137 Q27 137 27 123 L23 51 C28 49 33 43 34 33 C35 20 30 9 20 2Z" />
                    {activeItem.id === "steak-knives" ? (
                      <path
                        d="M17 52 L13 122 Q20 128 27 122 L23 52Z"
                        fill="#8d6842"
                        stroke="#5b3922"
                      />
                    ) : null}
                  </g>
                ) : activeItem.shape === "spoon" ? (
                  <g fill="url(#wash-metal)" stroke="#716b60" strokeWidth="1">
                    <ellipse
                      cx="20"
                      cy="22"
                      rx={activeItem.id === "soup-spoons" ? 15 : 11}
                      ry={activeItem.id === "soup-spoons" ? 19 : 15}
                    />
                    <path d="M17 37 H23 L24 125 Q24 137 20 137 Q16 137 16 125Z" />
                    <ellipse
                      cx="20"
                      cy="23"
                      rx={activeItem.id === "soup-spoons" ? 9 : 7}
                      ry={activeItem.id === "soup-spoons" ? 13 : 10}
                      fill="none"
                      stroke="#fffdf0"
                      strokeOpacity=".7"
                    />
                  </g>
                ) : activeItem.shape === "glass" ? (
                  <g fill="url(#wash-glass)" stroke="#9ab8b1" strokeWidth="2">
                    {activeItem.id === "highball-glasses" ? (
                      <>
                        <path d="M18 8 H82 L77 123 Q50 132 23 123Z" />
                        <ellipse cx="50" cy="8" rx="32" ry="7" fill="#f8fffb" fillOpacity=".5" />
                        <path d="M23 123 Q50 132 77 123 L79 130 Q50 140 21 130Z" />
                        <path
                          d="M30 20 L34 111"
                          fill="none"
                          stroke="#fff"
                          strokeOpacity=".8"
                          strokeWidth="4"
                        />
                      </>
                    ) : (
                      <>
                        <path d="M12 12 H88 L80 111 Q50 124 20 111Z" />
                        <ellipse cx="50" cy="12" rx="38" ry="8" fill="#f8fffb" fillOpacity=".5" />
                        <path d="M20 113 Q50 121 80 113 L84 121 Q50 132 16 121Z" />
                        <path
                          d="M25 25 L31 100"
                          fill="none"
                          stroke="#fff"
                          strokeOpacity=".8"
                          strokeWidth="4"
                        />
                      </>
                    )}
                  </g>
                ) : activeItem.shape === "cup-set" ? (
                  <g fill="url(#wash-ceramic)" stroke="#a87538" strokeWidth="2.5">
                    <ellipse cx="60" cy="119" rx="49" ry="14" />
                    <ellipse
                      cx="60"
                      cy="119"
                      rx="39"
                      ry="8"
                      fill="none"
                      stroke="#fffdf4"
                      strokeWidth="2"
                    />
                    <path d="M27 32 H84 L79 91 Q55 104 32 91Z" />
                    <ellipse cx="55.5" cy="32" rx="28.5" ry="8" fill="#fff9e9" />
                    <path d="M84 43 Q112 41 108 65 Q105 82 82 77" fill="none" strokeWidth="7" />
                    <path
                      d="M36 42 V82"
                      fill="none"
                      stroke="#fff"
                      strokeOpacity=".8"
                      strokeWidth="4"
                    />
                  </g>
                ) : activeItem.shape === "jug" ? (
                  <g
                    fill="url(#wash-glass)"
                    stroke="#8fa99b"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  >
                    <path d="M31 27 H89 L84 121 Q80 137 48 137 Q22 134 20 118 L17 48 Q17 38 31 37Z" />
                    <path d="M31 27 Q50 13 77 24 L89 27 L82 38 H31Z" fill="#e8d4a9" />
                    <path d="M86 47 Q114 42 113 70 Q111 95 84 91" fill="none" strokeWidth="8" />
                    <path
                      d="M33 50 V112"
                      fill="none"
                      stroke="#fff"
                      strokeOpacity=".75"
                      strokeWidth="5"
                    />
                  </g>
                ) : activeItem.shape === "shakers" ? (
                  <g stroke="#8e7551" strokeWidth="2.5" strokeLinejoin="round">
                    <rect x="20" y="43" width="29" height="66" rx="9" fill="url(#wash-glass)" />
                    <path
                      d="M25 43 V34 Q25 29 30 29 H39 Q44 29 44 34 V43Z"
                      fill="url(#wash-metal)"
                    />
                    <rect x="71" y="43" width="29" height="66" rx="9" fill="url(#wash-glass)" />
                    <path
                      d="M76 43 V34 Q76 29 81 29 H90 Q95 29 95 34 V43Z"
                      fill="url(#wash-metal)"
                    />
                    <path
                      d="M25 56 V96 M76 56 V96"
                      fill="none"
                      stroke="#fff"
                      strokeOpacity=".76"
                      strokeWidth="4"
                    />
                    <circle cx="34.5" cy="77" r="5" fill="#f3ead3" stroke="#b39a6e" />
                    <circle cx="85.5" cy="77" r="5" fill="#a9b278" stroke="#7f8959" />
                  </g>
                ) : null}
                {activeItem.shape === "fork" || activeItem.shape === "knife" ? (
                  <path
                    d="M20 48 V126"
                    fill="none"
                    stroke="#fffdf0"
                    strokeOpacity=".62"
                    strokeWidth="1.2"
                  />
                ) : null}
              </svg>
            ) : null}
            <canvas
              ref={canvasRef}
              aria-label={`Dirty ${activeItem.label.toLowerCase()}. Press and scrub across it to clean it.`}
              data-testid="wash-up-surface"
              className="absolute inset-0 z-[2] h-full w-full cursor-grab active:cursor-grabbing"
              onLostPointerCapture={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{ touchAction: "none", clipPath: surfaceClipPath }}
            />
            {!complete && !noSoap ? (
              <span
                aria-hidden="true"
                className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 select-none drop-shadow-md ${scrubbing && !reducedMotion ? "scale-110 transition-transform duration-75" : ""}`}
                ref={spongeRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onLostPointerCapture={onPointerUp}
                style={{
                  left: activeItem.shape === "plate" ? "68%" : "50%",
                  top: activeItem.shape === "plate" ? "64%" : "59%",
                  width: spongeSize,
                  height: spongeSize,
                  touchAction: "none",
                  cursor: scrubbing ? "grabbing" : "grab",
                }}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 96 96"
                  width={spongeSize}
                  height={spongeSize}
                  style={{ overflow: "visible" }}
                >
                  <defs>
                    <linearGradient id="dish-sponge-yellow" x1="0" y1="0" x2="0.8" y2="1">
                      <stop stopColor="#ffe174" />
                      <stop offset=".55" stopColor="#f7b936" />
                      <stop offset="1" stopColor="#d98923" />
                    </linearGradient>
                    <pattern
                      id="dish-sponge-pores"
                      width="11"
                      height="11"
                      patternUnits="userSpaceOnUse"
                    >
                      <circle cx="3" cy="3" r="1.2" fill="#fff1b5" opacity=".62" />
                      <circle cx="8" cy="8" r="1.6" fill="#a96724" opacity=".28" />
                    </pattern>
                    <filter id="dish-sponge-shadow" x="-40%" y="-40%" width="180%" height="180%">
                      <feDropShadow
                        dx="0"
                        dy="3"
                        stdDeviation="3"
                        floodColor="#20130d"
                        floodOpacity=".55"
                      />
                    </filter>
                  </defs>
                  <g transform="rotate(-25 43 48)" filter="url(#dish-sponge-shadow)">
                    <rect
                      x="17"
                      y="28"
                      width="55"
                      height="42"
                      rx="10"
                      fill="#14765d"
                      stroke="#075440"
                      strokeWidth="3"
                    />
                    <rect
                      x="17"
                      y="20"
                      width="55"
                      height="42"
                      rx="10"
                      fill="url(#dish-sponge-yellow)"
                      stroke="#a96120"
                      strokeWidth="2.5"
                    />
                    <rect
                      x="19"
                      y="22"
                      width="51"
                      height="38"
                      rx="8"
                      fill="url(#dish-sponge-pores)"
                    />
                    <path
                      d="M24 28q15-8 31-2"
                      fill="none"
                      stroke="#fff6d4"
                      strokeOpacity=".66"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </g>
                  {!hasStartedWashing ? (
                    <path
                      d="M65 61V44c0-4 6-4 6 0v9-15c0-4 6-4 6 0v15-11c0-4 6-4 6 0v13l2-7c2-5 7-3 6 1l-3 15c-1 6-5 10-11 10h-4c-6 0-10-3-13-8l-5-8c-2-4 3-7 6-4l4 7Z"
                      fill="#fffdf8"
                      stroke="#3d281b"
                      strokeWidth="3.5"
                      strokeLinejoin="round"
                    />
                  ) : null}
                </svg>
              </span>
            ) : null}
            {complete ? (
              <div
                className={`pointer-events-none absolute inset-0 grid place-items-center ${reducedMotion ? "" : "animate-[dish-shine_700ms_ease-out]"}`}
              >
                <span
                  aria-hidden="true"
                  className="rounded-full bg-white/60 px-4 py-2 text-[30px] text-gold shadow-soft"
                >
                  ✨
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <p
          className="mt-3 rounded-2xl border border-[#d5ae6c] bg-[linear-gradient(135deg,#fff8e8,#f2dfbd)] px-3 py-2 text-center font-ui text-[14px] font-extrabold text-[#50331f]"
          role="status"
          data-testid="wash-up-status"
        >
          {status}
        </p>
        {!complete && !noSoap ? (
          <div className="mt-2 flex items-center gap-3">
            <div
              ref={progressBarRef}
              aria-label={`0% ${activeItem.label.toLowerCase()} clean`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={0}
              className="h-3 flex-1 overflow-hidden rounded-full bg-walnut/15"
              role="progressbar"
            >
              <div
                ref={progressFillRef}
                className="h-full w-0 rounded-full bg-[linear-gradient(90deg,#789270,#a8b47c)]"
              />
            </div>
            <span
              ref={progressValueRef}
              className="w-10 text-right font-ui text-[12px] font-extrabold text-walnut/70"
            >
              0%
            </span>
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-end gap-2">
          {noSoap && onBuySoap ? (
            <KButton size="sm" variant="copper" className="min-h-12" onClick={onBuySoap}>
              🛒 Dish soap
            </KButton>
          ) : null}
          {complete || noSoap ? (
            <KButton size="sm" variant="sage" className="min-h-12" onClick={onClose}>
              ✓ Done
            </KButton>
          ) : (
            <p className="flex-1 font-ui text-[12px] font-bold text-walnut/60">
              {cleanedCount} / {items.length} · 🔁 the rest washes at the next START
            </p>
          )}
        </div>
      </section>
      <style>{`
        @keyframes dish-shine {
          from { opacity: 0; transform: scale(.8); }
          55% { opacity: 1; transform: scale(1.08); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );

  return portalTarget ? createPortal(modal, portalTarget) : null;
}
