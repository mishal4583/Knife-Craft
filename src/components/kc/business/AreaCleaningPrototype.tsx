import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import type { CleanArea, TaskKind } from "@/game/restaurant/cleanliness";
import type { KitchenMapArtStage } from "@/game/kitchen/kitchenMapArt";
import {
  BRUSH_RADIUS,
  CLEAN_THRESHOLD,
  ROOM_TASKS,
  cleanScene,
  cleanedShare,
  landscapeCleaningSupports,
  makeStains,
  strengthOpacity,
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
import { CleaningToolIcon } from "./cleaning/CleaningToolIcon";
import { TOOL_LOOK } from "./cleaning/toolLook";
import { useLandscape } from "../game/layoutMode";
import { landscapeCleaningArt } from "@/game/landscapeArt";

export type { CleaningToolId } from "@/game/restaurant/cleaningDirt";

const TASK_COPY: Partial<Record<TaskKind, { title: string; instruction: string }>> = {
  equipment: {
    title: "Clean the cooking equipment",
    instruction: "Scrub the sauce and splashes off the cooking line.",
  },
  grease: {
    title: "Degrease the stove and fryer",
    instruction: "Scrape the grease off the cooktop. It takes a few rubs.",
  },
  degrease: {
    title: "Degrease the hot equipment",
    instruction: "Scrape the cooktop until the grease is gone.",
  },
  "deep-kitchen": {
    title: "Deep clean the kitchen",
    instruction: "Clean the cooking line, worktop and service equipment.",
  },
  "sweep-line": {
    title: "Sweep the kitchen line",
    instruction: "Sweep the crumbs from the floor between the equipment.",
  },
  "wipe-boards": {
    title: "Wipe down the boards and counters",
    instruction: "Wipe the day's juice and crumbs off every worktop.",
  },
  "clear-tables": {
    title: "Clear and reset the dining room",
    instruction: "Wipe every table clean for tomorrow.",
  },
  tables: {
    title: "Wipe and sanitize the tables",
    instruction: "Wipe the rings and food off the tables.",
  },
  floor: {
    title: "Sweep and mop the dining floor",
    instruction: "Mop the scuffs and footprints off the walkways.",
  },
  spill: { title: "Clean up the spill", instruction: "Mop up the spilled drink and the splashes." },
  "mop-all": {
    title: "Mop the dining area",
    instruction: "Mop every scuff and footprint off the floor.",
  },
  "deep-dining": {
    title: "Deep clean the dining area",
    instruction: "Clean the tables, floor edges and guest walkways.",
  },
  toilet: {
    title: "Clean the toilet and urinal",
    instruction: "Brush the limescale out of the bowls.",
  },
  "restroom-floor": {
    title: "Mop the restroom floor",
    instruction: "Mop the grime out of the tiles.",
  },
  "restroom-disinfect": {
    title: "Disinfect the restroom",
    instruction: "Polish the water spots off the mirror and taps.",
  },
  "deep-restroom": {
    title: "Deep clean the restroom",
    instruction: "Scrub the fixtures, floor and tile edges.",
  },
};

export const ROOM_CLEANING_TESTS: readonly {
  area: CleanArea;
  task: TaskKind;
  title: string;
  subtitle: string;
  dirtCount: number;
  toolCount: number;
}[] = [
  {
    area: "kitchen",
    task: "equipment",
    title: "Kitchen close-down",
    subtitle: "Grease · food splashes · prep crumbs",
    dirtCount: 3,
    toolCount: 5,
  },
  {
    area: "dining",
    task: "tables",
    title: "Dining reset",
    subtitle: "Crumbs · drink spill · floor marks",
    dirtCount: 3,
    toolCount: 4,
  },
  {
    area: "restroom",
    task: "toilet",
    title: "Restroom refresh",
    subtitle: "Fixture scale · sink spots · floor grime",
    dirtCount: 3,
    toolCount: 4,
  },
];

type ToolEntry = { id: CleaningToolId; name: string; use: string };
const tool = (id: CleaningToolId, use: string): ToolEntry => ({
  id,
  name: TOOL_LOOK[id].name,
  use,
});
const TOOLS: Record<CleanArea, readonly ToolEntry[]> = {
  kitchen: [
    tool("sponge", "food splashes"),
    tool("cloth", "worktops"),
    tool("scraper", "baked-on grease"),
    tool("broom", "dry crumbs"),
    tool("mop", "wet floor marks"),
  ],
  dining: [
    tool("cloth", "table rings and smears"),
    tool("scraper", "stuck-on food"),
    tool("broom", "dry crumbs"),
    tool("mop", "spills and scuffs"),
  ],
  restroom: [
    tool("toilet-brush", "toilet bowls"),
    tool("sponge", "sinks and taps"),
    tool("glass-cloth", "the mirror"),
    tool("mop", "floor grime"),
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
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length),
  );
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
  variant = 0,
  onClose,
  onComplete,
}: {
  area: CleanArea;
  task: TaskKind;
  stage: KitchenMapArtStage;
  image: string;
  roomWide?: boolean | undefined;
  previewOnly?: boolean | undefined;
  /** Which dirt layout (cleaningVariant): a new one after every clean. */
  variant?: number | undefined;
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
  /** A tool the player should switch to (its button glows). */
  const [suggest, setSuggest] = useState<CleaningToolId | null>(null);
  /** Where to rub next: shown at the start and after a few idle seconds (scene coordinates). */
  const [guide, setGuide] = useState<{ x: number; y: number; tool: CleaningToolId } | null>(null);
  const idleRef = useRef(0);
  const [activeTool, setActiveTool] = useState<CleaningToolId>(() =>
    roomWide ? TOOLS[area][0]!.id : toolForTask(area, task),
  );
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const reduced = useMemo(() => reducedMotionOn(), []);
  // Phone landscape (developer 2026-10-22): the room's 16:9 painting with its own dirt, when
  // that painting shows the job (cleaningDirt.ts LAND_GEO). Chosen once per cleaning, so
  // turning the phone mid-scrub keeps the dirt and the progress.
  const landscape = useLandscape();
  const [orient] = useState<"portrait" | "landscape">(() =>
    landscape &&
    (roomWide ? ROOM_TASKS[area] : [task]).every((t) => landscapeCleaningSupports(area, t, stage))
      ? "landscape"
      : "portrait",
  );
  const roomImage = orient === "landscape" ? landscapeCleaningArt(area, stage) : image;
  const stains = useMemo(
    () => makeStains(area, task, stage, roomWide, variant, orient),
    [area, roomWide, stage, task, variant, orient],
  );
  const marks = useMemo(() => stainMarks(stains, area, orient), [area, stains, orient]);
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
  const dimensions = cleanScene(area, orient);
  const roomTitle = area === "kitchen" ? "Kitchen" : area === "dining" ? "Dining area" : "Restroom";
  const stageHeightLimit = Math.max(320, gameViewport.height);
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
    const measure = () => {
      setGameViewport({ width: target.clientWidth || 540, height: target.clientHeight || 960 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Paint the stains once, set up the effects layer; clean everything up on close.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!portalTarget || !canvas) return;
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    play.sprites = stains.map(paintStain);
    draw();
    setGuide(nextGuide(activeToolRef.current));
    const fxCanvas = fxCanvasRef.current;
    if (fxCanvas && !reduced)
      fxRef.current = new CleaningFx(fxCanvas, dimensions.width, dimensions.height);
    const timers = timersRef.current;
    return () => {
      fxRef.current?.dispose();
      fxRef.current = null;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      window.clearTimeout(idleRef.current);
    };
    // draw reads refs only; the stains are fixed for this cleaning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalTarget, stains, play, reduced]);

  /** The next stain to point at: one the current tool cleans if any, else any left. */
  function nextGuide(toolNow: CleaningToolId) {
    const left = stains.filter((st) => !play.cleared[st.id]);
    const pickOne = left.find((st) => st.tool === toolNow) ?? left[0];
    return pickOne ? { x: pickOne.x, y: pickOne.y, tool: pickOne.tool } : null;
  }
  /** After 3.5 s without a scrub, point at a stain that's left (and its tool). */
  function armIdleGuide() {
    window.clearTimeout(idleRef.current);
    idleRef.current = window.setTimeout(() => {
      if (completeRef.current) return;
      const g = nextGuide(activeToolRef.current);
      setGuide(g);
      if (g && g.tool !== activeToolRef.current) setSuggest(g.tool);
    }, 3500);
  }

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
      ctx.globalAlpha = a * strengthOpacity(s.strength);
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
    // No cheer once the finale has started: "Spotless!" is the last word.
    if (m != null && pct < 100 && !completeRef.current) {
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
    window.clearTimeout(idleRef.current);
    setGuide(null);
    setSuggest(null);
    setToast(null);
    setToolHint(null);
    setPhase("finale");
    setScrubbing(false);
    if (cursorRef.current) cursorRef.current.style.opacity = "0";
    const left = stains.filter((s) => !play.cleared[s.id]);
    const step = reduced ? 0 : 55;
    left.forEach((s, k) =>
      later(
        () => {
          marks.forEach((m, i) => {
            if (m.stain === s.id) play.wear[i] = s.toughness;
          });
          clearStain(s.id);
        },
        step * (k + 1),
      ),
    );
    later(
      () => {
        setPct(100);
        setResult({
          time: performance.now() - (play.startedAt || performance.now()),
          best: play.best,
        });
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
      fxRef.current?.scrub(
        activeTool,
        current.x,
        current.y,
        Math.min(3, 1 + Math.floor((stroke ?? 0) / 14)),
      );
      setToolHint((hint) => (hint === null ? hint : null));
      setSuggest((t) => (t === null ? t : null));
      setGuide((g) => (g === null ? g : null));
      armIdleGuide();
    } else {
      // Rubbing a mark with the wrong tool: say which tool it needs and light that button.
      const wrongTool = marks.find(
        (mark) =>
          mark.tool !== activeTool &&
          !play.cleared[mark.stain] &&
          distanceToSegmentSquared(mark.point, start, current) <= radius ** 2,
      );
      if (wrongTool) {
        const hint = `Use the ${TOOL_LOOK[wrongTool.tool].name.toLowerCase()} here`;
        setToolHint((h) => (h === hint ? h : hint));
        setSuggest((t) => (t === wrongTool.tool ? t : wrongTool.tool));
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

  const selectTool = (next: CleaningToolId) => {
    setActiveTool(next);
    setToolHint(null);
    setSuggest(null);
    setGuide((g) => (g ? nextGuide(next) : g));
  };

  const roomTest = ROOM_CLEANING_TESTS.find((entry) => entry.area === area);
  const shine = progress / 100;
  const pctOf = (v: number, total: number) => `${(v / total) * 100}%`;
  const modal = (
    <div
      className="absolute inset-0 z-[100] flex min-h-0 items-stretch justify-stretch overflow-hidden bg-[#1b100a]/85 p-0 backdrop-blur-sm"
      style={{ touchAction: "none", overscrollBehavior: "contain" }}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        // Landscape: the room on the left at full height; the title, tools and progress in a
        // column on the right.
        className="relative mx-auto flex h-full w-full max-w-[560px] min-h-0 flex-col overflow-hidden bg-[#fff3d9] shadow-[0_24px_90px_rgba(0,0,0,.5)] ring-1 ring-[#d5a65a] land:grid land:max-w-none land:grid-cols-[minmax(0,1fr)_232px] land:grid-rows-[auto_minmax(0,1fr)]"
        data-orient-scene={orient}
        style={{ maxHeight: stageHeightLimit }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`clean-title-${area}`}
        data-testid={`${area}-cleaning-prototype`}
      >
        {/* Header: what this cleaning is, and the way out. */}
        <header className="relative z-20 flex shrink-0 items-center gap-2.5 border-b border-[#dfc79e]/70 bg-[linear-gradient(135deg,rgba(255,249,233,.97),rgba(240,215,169,.94))] px-3 py-2 shadow-sm land:col-start-2 land:row-start-1 land:gap-2 land:border-l land:px-2.5">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#6b3d20] text-[24px] text-[#fff2d6] shadow land:hidden"
            aria-hidden
          >
            {area === "kitchen" ? "🍳" : area === "dining" ? "🍽️" : "🚻"}
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={`clean-title-${area}`}
              className="font-display text-[18px] font-black leading-tight text-walnut-dark land:text-[16px]"
            >
              {roomWide ? roomTest?.title : (copy?.title ?? `Clean the ${roomTitle.toLowerCase()}`)}
            </h2>
            <p className="mt-0.5 truncate font-ui text-[12px] font-semibold text-walnut/75">
              {roomWide
                ? roomTest?.subtitle
                : (copy?.instruction ?? `Scrub the dirt in the ${roomTitle.toLowerCase()}.`)}
            </p>
            {previewOnly ? (
              <span className="mt-1 inline-flex rounded-full bg-[#788a70]/15 px-2 py-0.5 font-ui text-[11px] font-black uppercase tracking-wide text-olive">
                Practice · no save or supplies
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${roomTitle.toLowerCase()} cleaning`}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-walnut/15 bg-white/70 font-ui text-xl font-black text-walnut-dark"
          >
            ×
          </button>
        </header>
        {previewOnly ? (
          <span className="sr-only" data-testid="cleaning-test-mode">
            Practice only. Progress and supplies are not saved.
          </span>
        ) : null}

        {/* The room, fitted whole between the header and the tools (nothing covers the dirt). */}
        <div
          className="relative min-h-0 flex-1 bg-[#2a1b12] land:col-start-1 land:row-span-2 land:row-start-1"
          style={{ containerType: "size" }}
        >
          <div
            className="absolute left-1/2 top-1/2 overflow-hidden bg-[#38261b] ring-1 ring-[#89603e]"
            style={{
              width: `min(100cqw, calc(100cqh * ${dimensions.width} / ${dimensions.height}))`,
              aspectRatio: `${dimensions.width} / ${dimensions.height}`,
              transform: "translate(-50%, -50%)",
              touchAction: "none",
              overscrollBehavior: "contain",
            }}
            data-testid="cleaning-stage"
          >
            <img
              src={roomImage}
              alt={`${roomTitle} from the current restaurant map`}
              className="block h-full w-full select-none object-fill transition-[filter] duration-300"
              style={{
                filter: `saturate(${0.82 + 0.18 * shine}) brightness(${0.92 + 0.1 * shine})`,
              }}
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
              aria-label={`Drag the ${cleaningTool.name.toLowerCase()} over the dirt in the ${roomTitle.toLowerCase()}`}
            />
            <canvas
              ref={fxCanvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
              data-testid="cleaning-fx"
              aria-hidden
            />
            {/* Where to rub: a pulsing ring and the tool rubbing over it. */}
            {guide && phase === "play" && !scrubbing ? (
              <span
                className="pointer-events-none absolute"
                style={{
                  left: pctOf(guide.x, dimensions.width),
                  top: pctOf(guide.y, dimensions.height),
                }}
                data-testid="cleaning-guide"
                data-tool={guide.tool}
                aria-hidden
              >
                <span className="kc-clean-ring absolute -left-7 -top-7 h-14 w-14 rounded-full border-[3px] border-white/90 shadow-[0_0_14px_rgba(255,236,170,.9)]" />
                <span className="kc-clean-ghost absolute -left-2 -top-9 drop-shadow-[0_3px_3px_rgba(40,20,5,.45)]">
                  <CleaningToolIcon tool={guide.tool} size={38} />
                </span>
              </span>
            ) : null}
            {/* The tool in the hand follows the finger, rocking as it scrubs. */}
            <span
              ref={cursorRef}
              className="pointer-events-none absolute left-0 top-0 leading-none opacity-0 drop-shadow-[0_3px_3px_rgba(40,20,5,.45)]"
              aria-hidden
            >
              <CleaningToolIcon tool={cleaningTool.id} size={46} />
            </span>
            {streak >= 2 && phase === "play" ? (
              <span
                key={streak}
                className="kc-clean-pop pointer-events-none absolute right-2 top-2 rounded-full border border-white/80 bg-[#6b3d20]/90 px-3 py-1 font-ui text-[14px] font-black text-[#ffe9b0] shadow"
                data-testid="cleaning-streak"
                data-streak={streak}
              >
                ✨ Streak ×{streak}
              </span>
            ) : null}
            {toast ? (
              <div className="pointer-events-none absolute inset-x-0 top-[12%] flex justify-center">
                <span
                  key={toast.key}
                  className="kc-clean-toast rounded-full bg-white/95 px-4 py-1.5 font-display text-[17px] font-black text-walnut-dark shadow"
                  data-testid="cleaning-milestone"
                >
                  {toast.text}
                </span>
              </div>
            ) : null}
            {phase === "spotless" ? (
              <div
                className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle,rgba(255,250,230,.6),rgba(255,250,230,0)_70%)]"
                data-testid="cleaning-spotless"
              >
                <span className="kc-clean-sheen" aria-hidden />
                <div className="kc-clean-banner rounded-2xl border-2 border-[#e7c37a] bg-[#fffaf0]/95 px-5 py-3 text-center shadow-lg">
                  <p className="font-display text-[28px] font-black leading-none text-walnut-dark">
                    ✨ Spotless! ✨
                  </p>
                  {result ? (
                    <p className="mt-1 font-ui text-[13px] font-bold text-walnut/70">
                      ⏱ {formatTime(result.time)}
                      {result.best >= 2 ? ` · 🔥 best streak ×${result.best}` : ""}
                    </p>
                  ) : null}
                  <KButton variant="sage" className="mt-2 min-h-12 px-6" onClick={finish}>
                    Done ✓
                  </KButton>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Tools and progress, below the room. */}
        <div className="relative z-20 shrink-0 border-t border-[#dfc79e]/80 bg-[linear-gradient(0deg,rgba(255,243,217,1),rgba(255,247,230,.98))] px-2.5 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 land:col-start-2 land:row-start-2 land:flex land:min-h-0 land:flex-col land:justify-end land:overflow-y-auto land:border-l land:border-t-0">
          {availableTools.length > 1 ? (
            <div
              className="mb-1.5 flex justify-center gap-1.5"
              role="group"
              aria-label="Cleaning tools"
            >
              {availableTools.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTool(t.id)}
                  aria-pressed={activeTool === t.id}
                  data-tool={t.id}
                  data-suggested={suggest === t.id || undefined}
                  title={`${t.name} · ${t.use}`}
                  className={`relative flex min-h-12 min-w-12 flex-1 basis-0 flex-col items-center justify-center rounded-xl border px-1 py-1 shadow-sm transition ${
                    activeTool === t.id
                      ? "border-[#a3602c] bg-[#6b3d20] text-[#fff4dc] ring-2 ring-[#d7a85a]"
                      : "border-[#d9c39a] bg-[#fffaf0] text-walnut-dark"
                  } ${suggest === t.id ? "kc-clean-suggest" : ""}`}
                >
                  <CleaningToolIcon tool={t.id} size={26} />
                  <span className="mt-0.5 max-w-full truncate font-ui text-[11px] font-black leading-tight">
                    {t.name}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {toolHint ? (
            <p
              className="mb-1 flex min-h-6 items-center justify-center gap-1 rounded-lg border border-[#d89d52]/60 bg-[#fff9e8] px-2 py-1 text-center font-ui text-[12px] font-extrabold text-[#8e5423]"
              role="status"
              aria-live="polite"
            >
              {suggest ? <CleaningToolIcon tool={suggest} size={18} /> : null}
              {toolHint}
            </p>
          ) : null}
          <div className="mb-1 flex items-center justify-between font-ui text-[12px] font-extrabold text-walnut-dark">
            <span data-testid="cleaning-stains-left">
              {stainsLeft > 0
                ? `🫧 ${stainsLeft} ${stainsLeft === 1 ? "stain" : "stains"} left`
                : "✨ All clean"}
            </span>
            <span className="flex items-center gap-1 text-walnut/70">
              <CleaningToolIcon tool={cleaningTool.id} size={18} />
              {cleaningTool.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-3 flex-1 overflow-hidden rounded-full bg-[#d9c5a5]"
              role="progressbar"
              aria-label={`${roomTitle} cleaning progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="kc-clean-bar h-full rounded-full transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="w-11 text-right font-ui text-[13px] font-black text-walnut-dark">
              {progress}%
            </span>
          </div>
          <p className="mt-1 flex min-h-5 items-center justify-center text-center font-hand text-[14px] leading-tight text-walnut/70">
            {phase !== "play"
              ? "✨ Sparkling!"
              : scrubbing
                ? "Keep scrubbing · tough stains take a few rubs"
                : progress === 0
                  ? `Drag the ${cleaningTool.name.toLowerCase()} over the dirt`
                  : `${cleaningTool.name} · ${cleaningTool.use}`}
          </p>
        </div>
      </section>
    </div>
  );

  return portalTarget ? createPortal(modal, portalTarget) : null;
}
