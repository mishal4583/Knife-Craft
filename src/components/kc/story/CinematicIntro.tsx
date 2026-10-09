import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { PauseManager } from "@/game/PauseManager";
import {
  INTRO_OUTRO,
  INTRO_SCENES,
  INTRO_SKIP_AFTER_MS,
  introTimeline,
  sceneAt,
  stepAt,
  tapTarget,
  type CinematicLine,
  type IntroScene,
  type IntroSceneId,
} from "@/game/story/introCinematic";
import type { StoryEndReason } from "./StoryOverlay";
import scene1 from "@/assets/story/intro-1-key.webp";
import scene2 from "@/assets/story/intro-2-kitchen.webp";
import scene3A from "@/assets/story/intro-3a-clean.webp";
import scene3B from "@/assets/story/intro-3b-repair.webp";
import scene3C from "@/assets/story/intro-3c-restore.webp";
import scene4 from "@/assets/story/intro-4-chef.webp";
import scene5 from "@/assets/story/intro-5-first-order.webp";

/**
 * CINEMATIC_INTRO — plays the opening film (introCinematic.ts) over the
 * Level 1 that App has already mounted underneath, then fades into it.
 *
 * One controller: a single requestAnimationFrame clock (`elapsed`, film
 * ms) drives everything — which scene and subtitle show, the SKIP control,
 * the outro and the end. No per-beat timers.
 *  - The clock stops while the platform pauses the game (PauseManager) and
 *    all CSS animations freeze with it (`kc-cine-paused`). Main-thread
 *    stalls and background tabs don't advance it (MAX_FRAME_MS).
 *  - It never enters a scene whose image hasn't decoded yet (waits up to
 *    IMAGE_WAIT_MAX_MS); images load one after another, Scene 1 first.
 *  - A tap moves the clock to the next subtitle or scene — one step per
 *    tap, ignored for MIN_TAP_MS after a step appears. Taps never end the
 *    film; only SKIP does.
 *  - Finishing and skipping share one latched completion path (`finish`),
 *    so onDone runs exactly once.
 *
 * Presentation: CSS transform/opacity only (styles.css `kc-cine-*`), with a
 * `prefers-reduced-motion` fallback (no camera moves, plain fades).
 */
const SCENE_IMAGES: Record<IntroSceneId, string> = {
  scene1,
  scene2,
  scene3A,
  scene3B,
  scene3C,
  scene4,
  scene5,
};

/** A tap this soon after a step appears is ignored (the tail of the tap that advanced to it). */
const MIN_TAP_MS = 250;
/** Longest the clock waits for a scene's image before moving on without it. */
const IMAGE_WAIT_MAX_MS = 2500;
/**
 * Longest frame the clock counts. The film runs on time the player actually
 * saw: when the main thread stalls (Level 1 boots underneath while Scene 1
 * plays) the film waits instead of jumping ahead and eating a subtitle, and
 * a backgrounded tab resumes where it left off.
 */
const MAX_FRAME_MS = 100;

type View = { step: number; outro: boolean; skip: boolean };

export function CinematicIntro({ onDone }: { onDone: (reason: StoryEndReason) => void }) {
  const timeline = useMemo(() => introTimeline(), []);
  const [loaded, setLoaded] = useState<boolean[]>(() => INTRO_SCENES.map(() => false));
  const [view, setView] = useState<View>({ step: 0, outro: false, skip: false });
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);

  const elapsedRef = useRef(0);
  const loadedRef = useRef(loaded);
  const pausedRef = useRef(false);
  const doneRef = useRef(false);
  const stepRef = useRef(0);
  const stepShownAtRef = useRef(0);
  const waitRef = useRef({ scene: -1, ms: 0 });
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Latched on the first completion (natural end OR skip) and never reset.
  function finish(reason: StoryEndReason) {
    if (doneRef.current) return;
    doneRef.current = true;
    setEnded(true);
    onDoneRef.current(reason);
  }

  /** Moves the clock to `elapsed` and publishes what that shows. */
  function seek(elapsed: number) {
    elapsedRef.current = elapsed;
    if (elapsed >= timeline.total) {
      finish("finished");
      return;
    }
    const step = stepAt(timeline, elapsed);
    if (step !== stepRef.current) {
      stepRef.current = step;
      stepShownAtRef.current = performance.now();
    }
    const outro = elapsed >= timeline.outroAt;
    const skip = elapsed >= INTRO_SKIP_AFTER_MS;
    setView((v) =>
      v.step === step && v.outro === outro && v.skip === skip ? v : { step, outro, skip },
    );
  }

  // Images: one at a time in film order, so Scene 1 arrives first.
  useEffect(() => {
    let alive = true;
    const load = (i: number) => {
      const scene = INTRO_SCENES[i];
      if (!scene || !alive) return;
      const img = new Image();
      img.src = SCENE_IMAGES[scene.id];
      const done = () => {
        if (!alive) return;
        setLoaded((prev) => prev.map((v, j) => v || j === i));
        load(i + 1);
      };
      // A failed image counts as loaded: the film goes on without it.
      img.decode().then(done, done);
    };
    load(0);
    return () => {
      alive = false;
    };
  }, []);

  // Platform pause freezes the clock and every animation.
  useEffect(
    () =>
      PauseManager.subscribe((p) => {
        pausedRef.current = p;
        setPaused(p);
      }),
    [],
  );

  // The clock.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(Math.max(0, now - last), MAX_FRAME_MS);
      last = now;
      if (!pausedRef.current && !doneRef.current) {
        let next = elapsedRef.current + dt;
        const s = sceneAt(timeline, next);
        if (!loadedRef.current[s]) {
          const wait = waitRef.current;
          if (wait.scene !== s) waitRef.current = { scene: s, ms: 0 };
          if (waitRef.current.ms < IMAGE_WAIT_MAX_MS) {
            waitRef.current.ms += dt;
            // Hold on the previous scene (or the plate, before Scene 1).
            next = s === 0 ? 0 : Math.max(elapsedRef.current, timeline.sceneStarts[s]! - 1);
          }
        }
        if (next !== elapsedRef.current) seek(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one clock for the component's lifetime
  }, []);

  function onTap() {
    if (doneRef.current || pausedRef.current || !loadedRef.current[0]) return;
    if (performance.now() - stepShownAtRef.current < MIN_TAP_MS) return;
    const target = tapTarget(timeline, elapsedRef.current);
    if (target !== null) seek(target);
  }

  if (ended) return null;

  const step = timeline.steps[view.step]!;
  const current = step.scene;
  const layers = [current - 1, current].filter((i) => i >= 0 && loaded[i]);
  const lastScene = INTRO_SCENES.length - 1;

  // A gap keeps the line that just ended on screen, fading out.
  const prev = timeline.steps[view.step - 1];
  const lineStep =
    step.line !== null ? step : prev && prev.scene === current && prev.line !== null ? prev : null;
  const line = lineStep ? INTRO_SCENES[lineStep.scene]!.lines[lineStep.line!]! : null;

  return (
    <div
      role="dialog"
      aria-label="Intro"
      data-intro-scene={INTRO_SCENES[current]!.id}
      className={cn(
        "absolute inset-0 z-50 select-none overflow-hidden bg-[linear-gradient(180deg,var(--color-ivory),var(--color-cream))]",
        view.outro && "kc-cine-outro pointer-events-none",
        paused && "kc-cine-paused",
      )}
      style={
        view.outro
          ? {
              animationDuration: `${INTRO_OUTRO.ms - INTRO_OUTRO.fadeDelayMs}ms`,
              animationDelay: `${INTRO_OUTRO.fadeDelayMs}ms`,
            }
          : undefined
      }
      onClick={onTap}
    >
      {layers.map((i) => (
        <CinematicImage
          key={INTRO_SCENES[i]!.id}
          scene={INTRO_SCENES[i]!}
          src={SCENE_IMAGES[INTRO_SCENES[i]!.id]}
          pushToGameplay={view.outro && i === lastScene}
        />
      ))}

      <CinematicDialogue line={line} leaving={step.line === null} />

      {view.skip && !view.outro ? (
        <button
          type="button"
          aria-label="Skip intro"
          onClick={(e) => {
            e.stopPropagation();
            finish("skipped");
          }}
          className="kc-cine-skip absolute right-1 top-1 z-10 flex h-[52px] min-w-[52px] items-center justify-center px-2"
        >
          <span className="rounded-full bg-black/25 px-3 py-1.5 font-ui text-[12.5px] font-extrabold uppercase tracking-[0.16em] text-[#fff6e6]/85">
            Skip <span aria-hidden>›</span>
          </span>
        </button>
      ) : null}
    </div>
  );
}

/** One painted scene: crossfades in, then a slow camera move (and holds its last frame). */
function CinematicImage({
  scene,
  src,
  pushToGameplay,
}: {
  scene: IntroScene;
  src: string;
  pushToGameplay: boolean;
}) {
  const camera = {
    "--kc-cam-from": scene.camera.from,
    "--kc-cam-to": scene.camera.to,
    animationDuration: `${scene.camera.ms}ms`,
    transformOrigin: scene.camera.origin,
  } as CSSProperties;
  const push = {
    "--kc-cine-push": INTRO_OUTRO.transform,
    animationDuration: `${INTRO_OUTRO.ms}ms`,
    transformOrigin: INTRO_OUTRO.origin,
  } as CSSProperties;
  return (
    <div
      className="kc-cine-in absolute inset-0 overflow-hidden"
      style={{ animationDuration: `${scene.crossfadeMs}ms` }}
    >
      <div className={cn("absolute inset-0", pushToGameplay && "kc-cine-push")} style={push}>
        <img
          src={src}
          alt={scene.alt}
          draggable={false}
          className="kc-cine-camera absolute inset-0 h-full w-full object-cover"
          style={camera}
        />
        {scene.lightUp ? (
          <div
            className="kc-cine-light absolute inset-0 bg-[#fff1cf]"
            style={{ animationDuration: `${scene.duration}ms` }}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Cinematic subtitle near the bottom, over a soft gradient (never a panel over the art). */
function CinematicDialogue({ line, leaving }: { line: CinematicLine | null; leaving: boolean }) {
  const showing = !!line && !leaving;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0" aria-live="polite">
      <div
        className="absolute inset-x-0 bottom-0 h-[36%] min-h-[200px] bg-[linear-gradient(180deg,transparent,rgba(24,13,6,0.55)_45%,rgba(24,13,6,0.82))] transition-opacity duration-300"
        style={{ opacity: showing ? 1 : 0 }}
      />
      {line ? (
        <div
          key={`${line.speaker ?? ""}:${line.text}`}
          className={cn(
            "relative px-6 pb-[max(env(safe-area-inset-bottom),32px)] text-center",
            leaving ? "kc-cine-line-out" : "kc-cine-line",
          )}
        >
          {line.speaker ? (
            <p
              className={cn(
                "font-ui text-[13.5px] font-extrabold uppercase tracking-[0.2em] [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]",
                line.speaker === "CHEF" ? "text-[#f3d98a]" : "text-[#cfe3c4]",
              )}
            >
              {line.speaker}
            </p>
          ) : null}
          <p className="mx-auto mt-1 max-w-[440px] font-hand text-[31px] font-bold leading-tight text-[#fff6e6] [text-shadow:0_2px_10px_rgba(0,0,0,0.75)]">
            {line.text}
          </p>
        </div>
      ) : null}
    </div>
  );
}
