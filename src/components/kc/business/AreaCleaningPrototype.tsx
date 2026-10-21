import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import type { CleanArea, TaskKind } from "@/game/restaurant/cleanliness";
import type { KitchenMapArtStage } from "@/game/kitchen/kitchenMapArt";
import {
  BRUSH_RADIUS,
  CLEAN_THRESHOLD,
  SCENE_SIZE,
  cleanedShare,
  makeStains,
  milestoneCrossed,
  nextStreak,
  scrubAmount,
  stainMarks,
  toolForTask,
  type CleaningToolId,
  type Point,
} from "@/game/restaurant/cleaningDirt";
import { AudioManager } from "@/game/AudioManager";
import { reducedMotionOn } from "@/game/cashBurst";
import { KButton } from "../common/primitives";
import { paintStain, stainReach } from "./cleaning/dirtArt";
import { CleaningFx } from "./cleaning/cleaningFx";

export type { CleaningToolId } from "@/game/restaurant/cleaningDirt";

const TASK_COPY: Partial<Record<TaskKind, { title: string; instruction: string }>> = {
  equipment: { title: "Clean the cooking equipment", instruction: "Scrub the sauce and splashes off the cooking line." },
  grease: { title: "Degrease the stove and fryer", instruction: "Scrape the grease off the cooktop. It takes a few rubs." },
  degrease: { title: "Degrease the hot equipment", instruction: "Scrape the cooktop until the grease is gone." },
  "deep-kitchen": { title: "Deep clean the kitchen", instruction: "Clean the cooking line, worktop and service equipment." },
  "sweep-line": { title: "Sweep the kitchen line", instruction: "Sweep the crumbs from the floor between the equipment." },
  tables: { title: "Wipe and sanitize the tables", instruction: "Wipe the rings and food off the tables." },
  floor: { title: "Sweep and mop the dining floor", instruction: "Mop the scuffs and footprints off the walkways." },
  spill: { title: "Clean up the spill", instruction: "Mop up the spilled drink and the splashes." },
  "mop-all": { title: "Mop the dining area", instruction: "Mop every scuff and footprint off the floor." },
  "deep-dining": { title: "Deep clean the dining area", instruction: "Clean the tables, floor edges and guest walkways." },
  toilet: { title: "Clean the toilet and urinal", instruction: "Brush the limescale out of the bowls." },
  "restroom-floor": { title: "Mop the restroom floor", instruction: "Mop the grime out of the tiles." },
  "restroom-disinfect": { title: "Disinfect the restroom", instruction: "Polish the water spots off the mirror and taps." },
  "deep-restroom": { title: "Deep clean the restroom", instruction: "Scrub the fixtures, floor and tile edges." },
};

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

const MILESTONE_COPY = ["Looking better!", "Halfway there!", "Almost spotless!"] as const;

/** How wide each tool works, and what it sounds like. */
function toolRadius(tool: CleaningToolId): number {
  if (tool === "mop" || tool === "broom") return BRUSH_RADIUS * 1.25;
  if (tool === "scraper" || tool === "toilet-brush") return BRUSH_RADIUS * 0.85;
  return BRUSH_RADIUS;
}
function toolTexture(tool: CleaningToolId): "wet" | "dry" | "brush" {
  if (tool === "broom") return "dry";
  if (tool === "scraper" || tool === "toilet-brush") return "brush";
  return "wet";
}

function distanceToSegmentSquared(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  if (!length) return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length));
  return (point.x - start.x - t * dx) ** 2 + (point.y - start.y - t * dy) ** 2;
}

const formatTime = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

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
  roomWide?: boolean | undefined;
  previewOnly?: boolean | undefined;
  onClose: () => void;
  onComplete: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const fxRef = useRef<CleaningFx | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const completeRef = useRef(false);
  const finishedRef = useRef(false);
  const progressRef = useRef(0);
  const timersRef = useRef(new Set<number>());
  const rafRef = useRef(0);
  const movesRef = useRef(0);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [gameViewport, setGameViewport] = useState({ width: 540, height: 960 });
  const [progress, setProgress] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [toolHint, setToolHint] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [phase, setPhase] = useState<"play" | "finale" | "spotless">("play");
  const [result, setResult] = useState<{ time: number; best: number } | null>(null);
  const [activeTool, setActiveTool] = useState<CleaningToolId>(() =>
    roomWide ? TOOLS[area][0]!.id : toolForTask(area, task),
  );
  const reduced = useMemo(() => reducedMotionOn(), []);
  const stains = useMemo(() => makeStains(area, task, stage, roomWide), [area, roomWide, stage, task]);
  const marks = useMemo(() => stainMarks(stains, area), [area, stains]);
  // Everything that changes per stroke lives here, outside React state.
  const play = useMemo(
    () => ({
      wear: new Float64Array(marks.length),
      pointsLeft: stains.map((s) => marks.filter((m) => m.stain === s.id).length),
      cleared: new Uint8Array(stains.length),
      alpha: new Float64Array(stains.length).fill(1),
      fading: new Map<number, number>(),
      sprites: [] as HTMLCanvasElement[],
      streak: { count: 0, at: -Infinity },
      best: 0,
      startedAt: 0,
    }),
    [marks, stains],
  );
  const [stainsLeft, setStainsLeft] = useState(stains.length);
  const copy = TASK_COPY[task];
  const dimensions = SCENE_SIZE[area];
  const roomTitle = area === "kitchen" ? "Kitchen" : area === "dining" ? "Dining area" : "Restroom";
  const stageWidthLimit = Math.max(180, Math.min(roomWide ? 448 : 436, gameViewport.width - 32));
  const stageHeightLimit = roomWide
    ? Math.max(210, Math.min(390, gameViewport.height * 0.42))
    : Math.max(220, gameViewport.height * 0.58);
  const stageScale = Math.min(stageWidthLimit / dimensions.width, stageHeightLimit / dimensions.height);
  const stageDisplay = { width: dimensions.width * stageScale, height: dimensions.height * stageScale };
  const availableTools = roomWide
    ? TOOLS[area]
    : TOOLS[area].filter((tool) => marks.some((mark) => mark.tool === tool.id));
  const cleaningTool = availableTools.find((tool) => tool.id === activeTool) ?? availableTools[0]!;
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
  };

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

  // Paint the stains once, set up the effects layer; clean everything up on close.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!portalTarget || !canvas) return;
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    play.sprites = stains.map(paintStain);
    draw();
    const fxCanvas = fxCanvasRef.current;
    if (fxCanvas && !reduced) fxRef.current = new CleaningFx(fxCanvas, dimensions.width, dimensions.height);
    const timers = timersRef.current;
    return () => {
      fxRef.current?.dispose();
      fxRef.current = null;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };
    // draw reads refs only; the stains are fixed for this cleaning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalTarget, stains, play, reduced]);

  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stains.forEach((s, i) => {
      const sprite = play.sprites[i];
      const a = play.alpha[i]!;
      if (!sprite || a <= 0) return;
      const reach = stainReach(s);
      ctx.globalAlpha = a;
      ctx.drawImage(sprite, s.x - reach, s.y - reach);
    });
    ctx.globalAlpha = 1;
    canvas.dataset["cleared"] = String(play.cleared.reduce((n, c) => n + c, 0));
  }

  // One frame loop for redraws and for stains fading out once they're gone.
  function requestDraw() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(function frame(t) {
      rafRef.current = 0;
      for (const [i, start] of play.fading) {
        const a = 1 - (t - start) / 260;
        play.alpha[i] = Math.max(0, a);
        if (a <= 0) play.fading.delete(i);
      }
      draw();
      if (play.fading.size) rafRef.current = requestAnimationFrame(frame);
    });
  }

  /** Wear a stain where the brush passed: it fades there in proportion to the scrub. */
  function carve(index: number, from: Point, to: Point, radius: number, strength: number) {
    const s = stains[index]!;
    const ctx = play.sprites[index]?.getContext("2d");
    if (!ctx) return;
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

  /** A stain is gone: it fades, sparkles and pings; quick clears build a streak. */
  function clearStain(index: number) {
    if (play.cleared[index]) return;
    play.cleared[index] = 1;
    const t = performance.now();
    if (reduced) play.alpha[index] = 0;
    else play.fading.set(index, t);
    play.streak = nextStreak(play.streak, t);
    play.best = Math.max(play.best, play.streak.count);
    setStreak(play.streak.count);
    const s = stains[index]!;
    fxRef.current?.sparkle(s.x, s.y, play.streak.count);
    AudioManager.playSparkle(play.streak.count);
    setStainsLeft(stains.length - play.cleared.reduce((n, c) => n + c, 0));
    requestDraw();
  }

  function setPct(pct: number) {
    const from = progressRef.current;
    if (pct === from) return;
    progressRef.current = pct;
    setProgress(pct);
    const m = milestoneCrossed(from, pct);
    if (m != null && pct < 100) {
      const key = performance.now();
      setToast({ text: MILESTONE_COPY[m]!, key });
      AudioManager.playComboMilestone(m);
      later(() => setToast((current) => (current?.key === key ? null : current)), 1100);
    }
  }

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onComplete();
  }

  /** Past the threshold: the last stains wipe themselves in a quick cascade, then "Spotless!". */
  function finale() {
    completeRef.current = true;
    setPhase("finale");
    setScrubbing(false);
    if (cursorRef.current) cursorRef.current.style.opacity = "0";
    const left = stains.filter((s) => !play.cleared[s.id]);
    const step = reduced ? 0 : 55;
    left.forEach((s, k) =>
      later(() => {
        marks.forEach((m, i) => {
          if (m.stain === s.id) play.wear[i] = s.toughness;
        });
        clearStain(s.id);
      }, step * (k + 1)),
    );
    later(
      () => {
        setPct(100);
        setResult({ time: performance.now() - (play.startedAt || performance.now()), best: play.best });
        setPhase("spotless");
        AudioManager.playSpotless();
        later(finish, reduced ? 1100 : 2400);
      },
      step * (left.length + 1) + (reduced ? 0 : 200),
    );
  }

  const scrubAt = (event: PointerEvent<HTMLCanvasElement>, from: Point | null) => {
    const canvas = canvasRef.current;
    if (!canvas || completeRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const current = {
      x: ((event.clientX - rect.left) / rect.width) * dimensions.width,
      y: ((event.clientY - rect.top) / rect.height) * dimensions.height,
    };
    moveCursor(event.clientX - rect.left, event.clientY - rect.top);
    const start = from ?? current;
    const stroke = from ? Math.hypot(current.x - from.x, current.y - from.y) : null;
    const amount = scrubAmount(stroke);
    const radius = toolRadius(activeTool);
    const touched = new Set<number>();
    marks.forEach((mark, index) => {
      if (mark.tool !== activeTool || play.cleared[mark.stain]) return;
      const tough = stains[mark.stain]!.toughness;
      if (play.wear[index]! >= tough) return;
      if (distanceToSegmentSquared(mark.point, start, current) > radius ** 2) return;
      play.wear[index] = Math.min(tough, play.wear[index]! + amount);
      if (play.wear[index]! >= tough) play.pointsLeft[mark.stain]!--;
      touched.add(mark.stain);
    });
    lastPointRef.current = current;
    if (touched.size) {
      if (!play.startedAt) play.startedAt = performance.now();
      for (const index of touched) {
        carve(index, start, current, radius, amount / stains[index]!.toughness);
        if (play.pointsLeft[index]! <= 0) clearStain(index);
      }
      requestDraw();
      AudioManager.playScrub(toolTexture(activeTool));
      fxRef.current?.scrub(activeTool, current.x, current.y, Math.min(3, 1 + Math.floor((stroke ?? 0) / 14)));
      setToolHint((hint) => (hint === null ? hint : null));
    } else if (roomWide) {
      const wrongTool = marks.find(
        (mark) =>
          mark.tool !== activeTool &&
          !play.cleared[mark.stain] &&
          distanceToSegmentSquared(mark.point, start, current) <= radius ** 2,
      );
      if (wrongTool) {
        const required = TOOLS[area].find((tool) => tool.id === wrongTool.tool);
        const hint = `Switch to ${required?.name.toLowerCase() ?? "the right tool"} for this mark.`;
        setToolHint((h) => (h === hint ? h : hint));
      }
    }
    const share = cleanedShare(play.wear, marks, stains);
    setPct(Math.min(99, Math.round(share * 100)));
    if (share >= CLEAN_THRESHOLD && !completeRef.current) finale();
  };

  /** The tool follows the finger, rocking as it scrubs. */
  function moveCursor(x: number, y: number) {
    const el = cursorRef.current;
    if (!el) return;
    movesRef.current++;
    const tilt = reduced ? -12 : -12 + Math.sin(movesRef.current * 0.9) * 14;
    el.style.opacity = "1";
    el.style.transform = `translate(${x}px, ${y}px) translate(-35%, -75%) rotate(${tilt}deg)`;
  }

  const handleDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || !event.isPrimary || completeRef.current) return;
    event.preventDefault();
    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    lastPointRef.current = null;
    setScrubbing(true);
    scrubAt(event, null);
  };
  const handleMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    scrubAt(event, lastPointRef.current);
  };
  const handleUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    lastPointRef.current = null;
    setScrubbing(false);
    if (cursorRef.current) cursorRef.current.style.opacity = "0";
  };

  const selectTool = (tool: CleaningToolId) => {
    setActiveTool(tool);
    setToolHint(null);
  };

  const roomTest = ROOM_CLEANING_TESTS.find((entry) => entry.area === area);
  const shine = progress / 100;
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
              {roomWide ? roomTest?.subtitle : copy?.instruction ?? `Scrub the dirt in the ${roomTitle.toLowerCase()}.`}
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
        ) : availableTools.length > 1 ? (
          <div className="flex shrink-0 justify-center gap-2 border-b border-[#e4d1ad] bg-[#f9edcf] px-2.5 py-2">
            {availableTools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => selectTool(tool.id)}
                aria-pressed={activeTool === tool.id}
                className={`flex min-h-12 items-center gap-1.5 rounded-xl border px-3 font-ui text-[12px] font-black ${activeTool === tool.id ? "border-[#a3602c] bg-[#6b3d20] text-[#fff4dc]" : "border-[#d9c39a] bg-[#fffaf0] text-walnut-dark"}`}
              >
                <span aria-hidden className="text-[18px]">{tool.icon}</span>
                {tool.name}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-2">
          <div
            className="relative shrink-0 overflow-hidden rounded-xl border border-[#89603e] bg-[#38261b] shadow-inner sm:rounded-2xl"
            style={{ ...stageDisplay, touchAction: "none", overscrollBehavior: "contain" }}
            data-testid="cleaning-stage"
          >
            <img
              src={image}
              alt={`${roomTitle} from the current restaurant map`}
              className="block h-full w-full select-none object-fill transition-[filter] duration-300"
              style={{ filter: `saturate(${0.82 + 0.18 * shine}) brightness(${0.92 + 0.1 * shine})` }}
              draggable={false}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full touch-none overscroll-contain"
              style={{ touchAction: "none", overscrollBehavior: "contain" }}
              onPointerDown={handleDown}
              onPointerMove={handleMove}
              onPointerUp={handleUp}
              onPointerCancel={handleUp}
              onLostPointerCapture={handleUp}
              data-testid="cleaning-dirt"
              data-stains={stains.length}
              aria-label={`Drag the ${cleaningTool.name} over the dirt in the ${roomTitle.toLowerCase()}`}
            />
            <canvas ref={fxCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" data-testid="cleaning-fx" aria-hidden />
            <span
              ref={cursorRef}
              className="pointer-events-none absolute left-0 top-0 text-[34px] leading-none opacity-0 drop-shadow-[0_3px_3px_rgba(40,20,5,.45)]"
              aria-hidden
            >
              {cleaningTool.icon}
            </span>
            {streak >= 2 && phase === "play" ? (
              <span
                key={streak}
                className="kc-clean-pop pointer-events-none absolute right-2 top-2 rounded-full border border-white/80 bg-[#6b3d20]/90 px-2.5 py-1 font-ui text-[13px] font-black text-[#ffe9b0] shadow"
                data-testid="cleaning-streak"
                data-streak={streak}
              >
                ✨ Streak ×{streak}
              </span>
            ) : null}
            {toast ? (
              <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
                <span key={toast.key} className="kc-clean-toast rounded-full bg-white/95 px-3 py-1 font-display text-[15px] font-black text-walnut-dark shadow" data-testid="cleaning-milestone">
                  {toast.text}
                </span>
              </div>
            ) : null}
            {!scrubbing && progress === 0 ? <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/70 bg-[#fff7e6]/95 px-2.5 py-1 font-ui text-[10px] font-extrabold text-walnut-dark shadow sm:bottom-3 sm:text-[12px]">{cleaningTool.icon} Scrub the dirt away</span> : null}
            {phase === "spotless" ? (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle,rgba(255,250,230,.55),rgba(255,250,230,0)_70%)]" data-testid="cleaning-spotless">
                <span className="kc-clean-sheen" aria-hidden />
                <div className="kc-clean-banner rounded-2xl border-2 border-[#e7c37a] bg-[#fffaf0]/95 px-5 py-3 text-center shadow-lg">
                  <p className="font-display text-[26px] font-black leading-none text-walnut-dark">✨ Spotless! ✨</p>
                  {result ? (
                    <p className="mt-1 font-ui text-[12px] font-bold text-walnut/70">
                      {formatTime(result.time)}
                      {result.best >= 2 ? ` · best streak ×${result.best}` : ""}
                    </p>
                  ) : null}
                  <KButton size="sm" variant="sage" className="mt-2 min-h-11 px-5" onClick={finish}>
                    Done ✓
                  </KButton>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="relative z-20 shrink-0 border-t border-[#e4d1ad] bg-[#fff3d9]/95 p-2.5 sm:p-3">
          <p className={`mb-1.5 flex min-h-[30px] items-center justify-center rounded-lg border px-2 py-1.5 text-center font-ui text-[10.5px] font-extrabold ${toolHint ? "border-[#d89d52]/60 bg-[#fff9e8] text-[#8e5423]" : "border-transparent bg-transparent text-transparent"}`} role="status" aria-live="polite">{toolHint ?? " "}</p>
          <div className="mb-1 flex items-center justify-between font-ui text-[12px] font-extrabold text-walnut-dark">
            <span data-testid="cleaning-stains-left">
              {stainsLeft > 0 ? `🧼 ${stainsLeft} ${stainsLeft === 1 ? "stain" : "stains"} left` : "✨ All clean"}
            </span>
            <span className="text-walnut/60">{cleaningTool.icon} {cleaningTool.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#d9c5a5]" role="progressbar" aria-label={`${roomTitle} cleaning progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className="kc-clean-bar h-full rounded-full transition-[width] duration-150" style={{ width: `${progress}%` }} />
            </div>
            <span className="w-10 text-right font-ui text-[12px] font-black text-walnut-dark">{progress}%</span>
          </div>
          <p className="mt-1 flex min-h-[30px] items-center justify-center text-center font-hand text-[12px] leading-tight text-walnut/70">
            {scrubbing
              ? "Keep scrubbing. Tough stains take a few rubs."
              : roomWide
                ? `${cleaningTool.name} · ${cleaningTool.use} · switch tools as needed`
                : `Rub with the ${cleaningTool.name.toLowerCase()} until each stain is gone.`}
          </p>
          <KButton full variant="cream" className="mt-2 min-h-10 rounded-xl text-[12px]" onClick={onClose} disabled={phase !== "play"}>{roomWide ? "Close practice" : "Cancel cleaning"}</KButton>
        </div>
      </section>
    </div>
  );

  return portalTarget ? createPortal(modal, portalTarget) : null;
}
