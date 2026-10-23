import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { AudioManager } from "@/game/AudioManager";
import { reducedMotionOn } from "@/game/cashBurst";
import { getSupplyItem, type SupplyId } from "@/game/business/businessSupplies";
import {
  cleanedShare,
  nextStreak,
  scrubAmount,
  strengthOpacity,
  type DirtMark,
  type Point,
  type Stain,
} from "@/game/restaurant/cleaningDirt";
import {
  DISH_BRUSH,
  DISH_CLEAN_THRESHOLD,
  DISH_ORDER,
  DISH_ZOOM,
  DISH_PLATE,
  DISH_SCENE,
  dishMarks,
  dishSeed,
  dishShapeFor,
  dishStains,
  inDishSurface,
  type DishShape,
} from "@/game/restaurant/dishDirt";
import { KButton } from "../common/primitives";
import { CleaningFx } from "../business/cleaning/cleaningFx";
import { paintStain, stainReach } from "../business/cleaning/dirtArt";

const WIDTH = DISH_SCENE.width;
const HEIGHT = DISH_SCENE.height;
/** After "Squeaky clean!" the piece goes to the rack and the next one comes in. */
const SHINE_MS = 520;
const SLIDE_MS = 340;

const WASH_VISUAL_FRAMES: Record<
  DishShape,
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

function clipSurface(ctx: CanvasRenderingContext2D, shape: DishShape) {
  ctx.beginPath();
  if (shape === "plate") {
    ctx.ellipse(
      DISH_PLATE.x,
      DISH_PLATE.y,
      DISH_PLATE.rx - 5,
      DISH_PLATE.ry - 5,
      0,
      0,
      Math.PI * 2,
    );
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

/** One piece in the sink: its stains and how far each point is scrubbed (outside React state). */
type Piece = {
  stains: Stain[];
  marks: DirtMark[];
  wear: Float64Array;
  pointsLeft: number[];
  cleared: Uint8Array;
  alpha: Float64Array;
  fading: Map<number, number>;
  sprites: HTMLCanvasElement[];
  done: boolean;
};

function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibration on this device */
  }
}

/** What a finished piece earns on screen, by what it is. */
function cheerFor(shape: DishShape): string {
  if (shape === "glass" || shape === "jug") return "Crystal clear!";
  if (shape === "fork" || shape === "knife" || shape === "spoon") return "Shiny!";
  if (shape === "cup-set") return "Spotless!";
  return "Squeaky clean!";
}

export type SinkLine = { id: SupplyId; n: number };
export type WashResult = { ok: boolean; noSoap?: boolean };

/**
 * THE SINK (developer 2026-10-23: "cleaning and washing in a satisfying manner
 * produces more dopamine … make the dirt in the utensils more realistic").
 * The real pieces waiting after a service (`sinkLines`), one kind at a time,
 * each dirty the way it would really be (dishDirt: sauce splashes, baked-on
 * crust, grease film, crumbs, soup tide-marks, water spots, coffee rings —
 * the room cleaning's layered stains). Scrubbing wears each stain away where
 * the sponge passes (tough ones take more strokes), with suds, a sparkle and
 * a rising ping per stain, a combo for quick clears; past 90 % the last specks
 * wipe themselves, the piece shines ("Squeaky clean!") and goes to the drying
 * rack. Each kind finished is washed for real at once (`onWash` → the
 * cleanliness action "wash": dish soap, nothing breaks, no money), so closing
 * half-way keeps it; what's left is washed at the next START. Same feel
 * engine as the room cleaning (CleaningFx, paintStain, AudioManager);
 * Reduced Motion: no particles, no slides, no vibration.
 */
export function WashUpSink({
  lines,
  seed = 0,
  onWash,
  onBuySoap,
  onClose,
  noSoapAtStart = false,
}: {
  /** The sink when it opened (it stays fixed while you wash). */
  lines: readonly SinkLine[];
  /** The restaurant's wash count when the sink opened: every wash's dirt is fresh. */
  seed?: number;
  onWash: (id: SupplyId) => WashResult;
  onBuySoap?: (() => void) | undefined;
  onClose: () => void;
  /** No dish soap at all: the sink says so at once (nothing can be washed). */
  noSoapAtStart?: boolean;
}) {
  const [items] = useState(() =>
    [...lines]
      .map((l) => {
        const name = getSupplyItem(l.id)?.name ?? l.id;
        return {
          id: l.id,
          n: l.n,
          label: name.split(" · ")[0]!,
          icon: getSupplyItem(l.id)?.icon ?? "🍽️",
          shape: dishShapeFor(l.id, name),
        };
      })
      .sort((a, b) => DISH_ORDER[a.shape] - DISH_ORDER[b.shape]),
  );
  const [reduced] = useState(() => reducedMotionOn());
  const total = items.reduce((t, i) => t + i.n, 0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const spongeRef = useRef<HTMLSpanElement>(null);
  const fxRef = useRef<CleaningFx | null>(null);
  const pieceRef = useRef<Piece | null>(null);
  const rafRef = useRef(0);
  const timersRef = useRef(new Set<number>());
  const activePointerRef = useRef<number | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const streakRef = useRef({ count: 0, at: -Infinity });
  const bestRef = useRef(0);
  const startedAtRef = useRef(0);
  const completedRef = useRef(noSoapAtStart);
  const [scrubbing, setScrubbing] = useState(false);
  const [hasStartedWashing, setHasStartedWashing] = useState(false);
  const [phase, setPhase] = useState<"scrub" | "shine" | "leaving">("scrub");
  const [complete, setComplete] = useState(items.length === 0);
  const [noSoap, setNoSoap] = useState(noSoapAtStart);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [cleanedCount, setCleanedCount] = useState(0);
  const [washedPieces, setWashedPieces] = useState(0);
  const [progress, setProgress] = useState(0);
  const [streak, setStreak] = useState(0);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [summary, setSummary] = useState<{ best: number; secs: number } | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const activeItem = items[Math.min(activeItemIndex, Math.max(0, items.length - 1))] ?? {
    id: "dinner-plates" as SupplyId,
    n: 0,
    label: "Plate",
    icon: "🍽️",
    shape: "plate" as DishShape,
  };
  const shape = activeItem.shape;
  const spongeSize = shape === "plate" ? 72 : 60;
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
  };

  useEffect(() => {
    setPortalTarget(document.querySelector<HTMLElement>("[data-game-content]"));
  }, []);

  // The effects layer for the whole sink; everything is cleaned up on close.
  useEffect(() => {
    const fxCanvas = fxCanvasRef.current;
    if (!portalTarget || !fxCanvas || reduced) return;
    fxRef.current = new CleaningFx(fxCanvas, WIDTH, HEIGHT);
    const timers = timersRef.current;
    return () => {
      fxRef.current?.dispose();
      fxRef.current = null;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };
  }, [portalTarget, reduced]);

  // A new piece: its own dirt for this wash, painted once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!portalTarget || !canvas || complete || noSoap) return;
    const stains = dishStains(shape, dishSeed(seed + activeItemIndex * 13, activeItem.id));
    const marks = dishMarks(stains, shape);
    pieceRef.current = {
      stains,
      marks,
      wear: new Float64Array(marks.length),
      pointsLeft: stains.map((s) => marks.filter((m) => m.stain === s.id).length),
      cleared: new Uint8Array(stains.length),
      alpha: new Float64Array(stains.length).fill(1),
      fading: new Map(),
      sprites: stains.map(paintStain),
      done: false,
    };
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(WIDTH * ratio);
    canvas.height = Math.round(HEIGHT * ratio);
    draw();
    setProgress(0);
    setScrubbing(false);
    if (spongeRef.current) {
      spongeRef.current.style.left = shape === "plate" ? "68%" : "56%";
      spongeRef.current.style.top = shape === "plate" ? "64%" : "62%";
      spongeRef.current.style.opacity = "1";
    }
    // draw reads refs only; one piece is set up per index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalTarget, activeItemIndex, complete, noSoap]);

  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const pc = pieceRef.current;
    if (!canvas || !ctx || !pc) return;
    const ratio = canvas.width / WIDTH;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.save();
    clipSurface(ctx, shape);
    pc.stains.forEach((s, i) => {
      const sprite = pc.sprites[i];
      const a = pc.alpha[i]!;
      if (!sprite || a <= 0) return;
      const reach = stainReach(s);
      ctx.globalAlpha = a * strengthOpacity(s.strength);
      ctx.drawImage(sprite, s.x - reach, s.y - reach);
    });
    ctx.restore();
    canvas.dataset["cleared"] = String(pc.cleared.reduce((n, c) => n + c, 0));
    canvas.dataset["stains"] = String(pc.stains.length);
  }

  function requestDraw() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(function frame(t) {
      rafRef.current = 0;
      const pc = pieceRef.current;
      if (pc)
        for (const [i, start] of pc.fading) {
          const a = 1 - (t - start) / 240;
          pc.alpha[i] = Math.max(0, a);
          if (a <= 0) pc.fading.delete(i);
        }
      draw();
      if (pc?.fading.size) rafRef.current = requestAnimationFrame(frame);
    });
  }

  /** Wear a stain where the sponge passed: it fades there in proportion to the scrub. */
  function carve(index: number, from: Point, to: Point, radius: number, strength: number) {
    const pc = pieceRef.current;
    const s = pc?.stains[index];
    const ctx = pc?.sprites[index]?.getContext("2d");
    if (!s || !ctx) return;
    const reach = stainReach(s);
    const ox = s.x - reach;
    const oy = s.y - reach;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = Math.min(1, strength * 0.9);
    ctx.lineCap = "round";
    ctx.lineWidth = radius * 1.5;
    ctx.beginPath();
    if (from.x === to.x && from.y === to.y) {
      ctx.arc(to.x - ox, to.y - oy, radius * 0.75, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(from.x - ox, from.y - oy);
      ctx.lineTo(to.x - ox, to.y - oy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** A stain is gone: it fades, sparkles and pings (rising with the combo), a tiny buzz. */
  function clearStain(index: number, quiet = false) {
    const pc = pieceRef.current;
    if (!pc || pc.cleared[index]) return;
    pc.cleared[index] = 1;
    const t = performance.now();
    if (reduced) pc.alpha[index] = 0;
    else pc.fading.set(index, t);
    const s = pc.stains[index]!;
    if (!quiet) {
      streakRef.current = nextStreak(streakRef.current, t);
      bestRef.current = Math.max(bestRef.current, streakRef.current.count);
      setStreak(streakRef.current.count);
      AudioManager.playSparkle(streakRef.current.count);
      if (!reduced) buzz(10);
    }
    fxRef.current?.sparkle(s.x, s.y, quiet ? 1 : streakRef.current.count);
    requestDraw();
  }

  /** Clean enough: wash it for real, wipe the last specks, shine, then off to the rack. */
  function pieceDone() {
    const pc = pieceRef.current;
    if (!pc || pc.done) return;
    pc.done = true;
    const index = activeItemIndex;
    const result = onWash(activeItem.id);
    if (!result.ok) {
      completedRef.current = true;
      setNoSoap(Boolean(result.noSoap));
      return;
    }
    setWashedPieces((p) => p + activeItem.n);
    setCleanedCount(index + 1);
    const left = pc.stains.filter((s) => !pc.cleared[s.id]);
    const step = reduced ? 0 : 45;
    left.forEach((s, k) => later(() => clearStain(s.id, true), step * (k + 1)));
    later(
      () => {
        setProgress(100);
        setPhase("shine");
        AudioManager.playSfx("squeak");
        if (!reduced) buzz(24);
        const cx = WIDTH / 2;
        const cy = HEIGHT * 0.58;
        fxRef.current?.sparkle(cx, cy, 8);
        fxRef.current?.scrub("mop", cx, cy, 5);
        const key = performance.now();
        setToast({ text: `✨ ${cheerFor(shape)}`, key });
        later(() => setToast((t) => (t?.key === key ? null : t)), 1000);
      },
      step * (left.length + 1),
    );
    later(
      () => {
        if (index >= items.length - 1) {
          completedRef.current = true;
          setComplete(true);
          setPhase("scrub");
          setSummary({
            best: bestRef.current,
            secs: Math.round(
              (performance.now() - (startedAtRef.current || performance.now())) / 1000,
            ),
          });
          AudioManager.playSpotless();
          if (!reduced) buzz(40);
          for (const [x, y] of [
            [110, 120],
            [250, 120],
            [180, 200],
          ] as const)
            fxRef.current?.sparkle(x, y, 10);
          return;
        }
        setPhase("leaving");
        later(
          () => {
            activePointerRef.current = null;
            lastPointRef.current = null;
            setScrubbing(false);
            setPhase("scrub");
            setActiveItemIndex((i) => Math.min(i + 1, items.length - 1));
          },
          reduced ? 0 : SLIDE_MS,
        );
      },
      step * (left.length + 1) + (reduced ? 200 : SHINE_MS),
    );
  }

  /** The sponge follows the finger (in the sink's own pixels, whatever the piece's zoom). */
  function moveSponge(event: PointerEvent<HTMLElement>) {
    const sponge = spongeRef.current;
    const box = sponge?.parentElement?.getBoundingClientRect();
    if (!sponge || !box) return;
    sponge.style.left = `${event.clientX - box.left}px`;
    sponge.style.top = `${event.clientY - box.top}px`;
    sponge.style.opacity = "1";
  }

  function scrubSegment(start: Point, end: Point, first: boolean) {
    const pc = pieceRef.current;
    if (!pc || pc.done || completedRef.current) return;
    const stroke = first ? null : Math.hypot(end.x - start.x, end.y - start.y);
    const amount = scrubAmount(stroke);
    const radius = DISH_BRUSH[shape];
    const touched = new Set<number>();
    pc.marks.forEach((mark, i) => {
      if (pc.cleared[mark.stain]) return;
      const tough = pc.stains[mark.stain]!.toughness;
      if (pc.wear[i]! >= tough) return;
      if (distanceToSegmentSquared(mark.point, start, end) > radius ** 2) return;
      pc.wear[i] = Math.min(tough, pc.wear[i]! + amount);
      if (pc.wear[i]! >= tough) pc.pointsLeft[mark.stain]!--;
      touched.add(mark.stain);
    });
    if (touched.size) {
      if (!startedAtRef.current) startedAtRef.current = performance.now();
      for (const index of touched) {
        carve(index, start, end, radius, amount / pc.stains[index]!.toughness);
        if (pc.pointsLeft[index]! <= 0) clearStain(index);
      }
      requestDraw();
      AudioManager.playScrub("wet");
    }
    // Suds wherever the sponge works the piece (more on the dirt).
    if (touched.size || inDishSurface(end.x, end.y, shape))
      fxRef.current?.scrub(
        "sponge",
        end.x,
        end.y,
        touched.size ? Math.min(3, 1 + Math.floor((stroke ?? 0) / 10)) : 1,
      );
    const share = cleanedShare(pc.wear, pc.marks, pc.stains);
    setProgress((p) => {
      const next = Math.min(99, Math.round(share * 100));
      return next === p ? p : next;
    });
    if (share >= DISH_CLEAN_THRESHOLD) pieceDone();
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (completedRef.current || pieceRef.current?.done || phase !== "scrub") return;
    const surface = canvasRef.current;
    if (!surface) return;
    const point = positionFromEvent(event, surface);
    const grabbedSponge = event.currentTarget === spongeRef.current;
    if (!grabbedSponge && !inDishSurface(point.x, point.y, shape)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
    lastPointRef.current = point;
    setHasStartedWashing(true);
    setScrubbing(true);
    moveSponge(event);
    scrubSegment(point, point, true);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (activePointerRef.current !== event.pointerId || completedRef.current) return;
    event.preventDefault();
    const surface = canvasRef.current;
    if (!surface) return;
    const point = positionFromEvent(event, surface);
    moveSponge(event);
    scrubSegment(lastPointRef.current ?? point, point, false);
    lastPointRef.current = point;
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    lastPointRef.current = null;
    setScrubbing(false);
  }

  const surfaceClipPath =
    shape === "plate"
      ? "ellipse(25.6% 23.2% at 50% 58.9%)"
      : shape === "small-plate"
        ? "ellipse(17.5% 16% at 50% 59%)"
        : shape === "bowl"
          ? "ellipse(17% 14.5% at 50% 59%)"
          : shape === "fork" || shape === "knife" || shape === "spoon"
            ? "ellipse(8% 26% at 50% 59%)"
            : shape === "glass"
              ? "ellipse(11% 23% at 50% 58%)"
              : shape === "cup-set"
                ? "ellipse(16% 22% at 50% 59%)"
                : shape === "jug"
                  ? "ellipse(14% 25% at 50% 57%)"
                  : "ellipse(9% 15% at 50% 55%)";
  const visualFrame = WASH_VISUAL_FRAMES[shape];
  // Thin pieces are zoomed in around the basin's centre (scene units stay the same).
  const zoomStyle = {
    transform: DISH_ZOOM[shape] === 1 ? undefined : `scale(${DISH_ZOOM[shape]})`,
    transformOrigin: "50% 59%",
  };
  const status = noSoap
    ? "🧴 Out of dish soap — the rest waits for the next START"
    : complete
      ? `✨ Sink empty · ${washedPieces} pieces · nothing broke`
      : phase !== "scrub"
        ? `✓ ${activeItem.label} clean!`
        : scrubbing
          ? progress >= 60
            ? "Almost there…"
            : "Keep scrubbing…"
          : `🧽 Scrub the ${activeItem.label.toLowerCase()} · ×${activeItem.n}`;
  const pieceMotion = reduced
    ? ""
    : phase === "leaving"
      ? "translate-x-[115%] rotate-6 opacity-0 transition-[transform,opacity] duration-300 ease-in"
      : "animate-[dish-in_360ms_ease-out]";
  const iconOf = (id: SupplyId) => items.find((i) => i.id === id)?.icon ?? "🍽️";

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
            <p className="font-display text-[21px] font-black leading-tight">Dishwashing</p>
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
            const current = index === activeItemIndex && !complete && !noSoap && !done;
            return (
              <li
                key={item.id}
                data-wash-line={item.id}
                data-wash-state={done ? "done" : current ? "current" : "waiting"}
                aria-current={current ? "step" : undefined}
                className={
                  "min-w-0 rounded-xl border px-1.5 py-1.5 text-center font-ui text-[11px] font-bold transition-colors " +
                  (done
                    ? "border-olive/40 bg-[#718568] text-ivory"
                    : current
                      ? "border-[#b47b32] bg-[#f3d99c] text-walnut-dark"
                      : "border-walnut/15 bg-ivory/50 text-walnut/70")
                }
              >
                <span aria-hidden>{done ? "✓" : item.icon}</span>
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
              <div
                key={activeItemIndex}
                className={`absolute inset-0 ${pieceMotion}`}
                data-piece-phase={phase}
              >
                <div className="absolute inset-0" style={zoomStyle}>
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
                            <ellipse
                              cx="50"
                              cy="8"
                              rx="32"
                              ry="7"
                              fill="#f8fffb"
                              fillOpacity=".5"
                            />
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
                            <ellipse
                              cx="50"
                              cy="12"
                              rx="38"
                              ry="8"
                              fill="#f8fffb"
                              fillOpacity=".5"
                            />
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

                    {shape === "fork" || shape === "knife" ? (
                      <path
                        d="M20 48 V126"
                        fill="none"
                        stroke="#fffdf0"
                        strokeOpacity=".62"
                        strokeWidth="1.2"
                      />
                    ) : null}
                  </svg>
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
                  {phase === "shine" && !reduced ? (
                    // The clean piece catches the light: a bright band sweeps across it.
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-[3] animate-[dish-sweep_520ms_ease-out] bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,.85)_48%,transparent_62%)] bg-[length:250%_100%] mix-blend-screen"
                      style={{ clipPath: surfaceClipPath }}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
            <canvas
              ref={fxCanvasRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[4] h-full w-full"
              data-testid="wash-up-fx"
              style={zoomStyle}
            />
            {!complete && !noSoap && phase === "scrub" ? (
              <span
                aria-hidden="true"
                className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 select-none drop-shadow-md ${scrubbing && !reduced ? "scale-110 transition-transform duration-75" : ""}`}
                ref={spongeRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onLostPointerCapture={onPointerUp}
                style={{
                  left: shape === "plate" ? "68%" : "56%",
                  top: shape === "plate" ? "64%" : "62%",
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
            {streak >= 2 && phase === "scrub" && !complete ? (
              <span
                key={streak}
                className="anim-pop absolute left-2 top-2 z-20 rounded-full bg-gold px-2.5 py-1 font-ui text-[12.5px] font-black text-walnut-dark shadow-soft"
                data-testid="wash-up-combo"
                data-combo={streak}
              >
                ✨ Combo ×{streak}
              </span>
            ) : null}
            {toast ? (
              <span
                key={toast.key}
                className="anim-pop pointer-events-none absolute left-1/2 top-[14%] z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-ivory/95 px-4 py-1.5 font-display text-[17px] font-black text-walnut-dark shadow-lift"
                role="status"
                data-testid="wash-up-cheer"
              >
                {toast.text}
              </span>
            ) : null}
            {complete ? (
              <div
                className={`pointer-events-none absolute inset-0 grid place-items-center ${reduced ? "" : "animate-[dish-shine_700ms_ease-out]"}`}
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
              aria-label={`${progress}% ${activeItem.label.toLowerCase()} clean`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={progress}
              className="h-3 flex-1 overflow-hidden rounded-full bg-walnut/15"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#789270,#a8d4c8)] transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="w-10 text-right font-ui text-[12px] font-extrabold text-walnut/70">
              {progress}%
            </span>
          </div>
        ) : null}
        {/* The drying rack: each finished kind lands here. */}
        <div
          className="mt-2 flex min-h-9 flex-wrap items-center gap-1.5 rounded-2xl border border-walnut/10 bg-ivory/60 px-2 py-1.5"
          data-testid="wash-up-rack"
        >
          <span className="font-ui text-[11px] font-extrabold uppercase tracking-wide text-walnut/55">
            🧺 Rack
          </span>
          {items.slice(0, cleanedCount).map((item) => (
            <span
              key={item.id}
              className="anim-pop rounded-full border border-olive/30 bg-sage/15 px-2 py-0.5 font-ui text-[12px] font-extrabold text-olive"
            >
              {iconOf(item.id)} ×{item.n} ✓
            </span>
          ))}
          {cleanedCount === 0 ? (
            <span className="font-ui text-[11.5px] font-bold text-walnut/45">empty</span>
          ) : null}
        </div>
        {summary ? (
          <p
            className="mt-2 text-center font-ui text-[12.5px] font-extrabold text-walnut/70"
            data-testid="wash-up-summary"
          >
            {summary.best >= 2 ? `🔥 Best combo ×${summary.best} · ` : ""}⏱ {summary.secs}s
          </p>
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
        @keyframes dish-in {
          from { opacity: 0; transform: translateX(-60%) rotate(-8deg); }
          to { opacity: 1; transform: none; }
        }
        @keyframes dish-sweep {
          from { background-position: 120% 0; }
          to { background-position: -40% 0; }
        }
      `}</style>
    </div>
  );

  return portalTarget ? createPortal(modal, portalTarget) : null;
}
