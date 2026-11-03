import { useEffect, useRef, useState } from "react";
import {
  DONENESS_LINE,
  OVEN,
  breadFilter,
  donenessAt,
  donenessLabel,
  type Doneness,
  type TrayItem,
} from "@/game/cooking/ovenStep";
import { AudioManager } from "@/game/AudioManager";
import { KButton } from "../common/primitives";
import ovenWebm from "@/assets/video/oven-bread.webm";
import ovenMp4 from "@/assets/video/oven-bread.mp4";
import ovenPoster from "@/assets/video/oven-bread-poster.webp";

/** The film runs on its own clock; if it drifts further than this from the bake, it is moved back (seconds). */
const FILM_DRIFT_S = 0.25;
/** No film frame played this long after the oven opened: show the painted oven instead (the bake never waits for it). */
const FILM_START_TIMEOUT_MS = 3000;

/**
 * The oven (Transformation Phase C, ovenStep.ts): the tray slides in, the
 * bread browns, and the player takes it out — ideally in the golden window.
 * Presentation only: `onDone` hands back to Preparation, which shows the Knife
 * Report exactly as after the cooking film. The doneness picks a line, never
 * the grade, the score or the pay.
 *
 *  - placing (the tray slides in) → baking (doneness rises) → done (the line);
 *  - "Take it out" (or the bake ending by itself) finishes once; a second tap
 *    does nothing;
 *  - Reduced Motion: no sliding or glow, the same bake and button.
 *
 * Developer 2026-11-03: the oven window is a FILM of the bread baking (oven-bread.*): raw at first, gradually cooking, golden, and at the end
 * burnt, with the meter and "Take it out" under it. The film follows the bake clock (it is moved back if it drifts), so the golden frame
 * is on screen exactly while the golden window is open. No skip button, no tap-to-skip. If the film cannot play (an error, no frame in 3 s)
 * or the player prefers reduced motion, the painted oven with the emoji tray is shown instead and the bake plays the same.
 */
export function OvenStep({
  dish,
  tray,
  reducedMotion,
  onDone,
}: {
  dish: { emoji: string; name: string };
  /** What sits on the tray (`trayItemFor`): bread slices or a baguette. */
  tray: TrayItem;
  reducedMotion: boolean;
  onDone: () => void;
}) {
  const [state, setState] = useState<"placing" | "baking" | "done">(
    reducedMotion ? "baking" : "placing",
  );
  const [doneness, setDoneness] = useState(0);
  const [result, setResult] = useState<Doneness | null>(null);
  const filmRef = useRef<HTMLVideoElement | null>(null);
  const [filmFailed, setFilmFailed] = useState(false);
  const useFilm = !reducedMotion && !filmFailed;
  const bakeStart = useRef<number | null>(null);
  const finished = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const takeOut = (d: number) => {
    if (finished.current) return;
    finished.current = true;
    filmRef.current?.pause(); // the bread stays as it was when the player took it out
    const label = donenessLabel(d);
    setResult(label);
    setState("done");
    AudioManager.playSfx("bell");
    doneTimer.current = window.setTimeout(() => onDoneRef.current(), OVEN.RESULT_MS);
  };
  const doneTimer = useRef<number | null>(null);
  const takeOutRef = useRef(takeOut);
  takeOutRef.current = takeOut;

  useEffect(() => {
    // A fresh bake per mount (React StrictMode mounts twice in development).
    finished.current = false;
    let raf = 0;
    const placed = window.setTimeout(
      () => {
        setState((s) => (s === "placing" ? "baking" : s));
        bakeStart.current = performance.now();
        const tick = (now: number) => {
          if (finished.current) return;
          const d = donenessAt(now - (bakeStart.current ?? now));
          setDoneness(d);
          // The film's own time for this doneness: the way in, then the bake.
          const film = filmRef.current;
          if (film && !film.error) {
            const want = (OVEN.PLACE_MS + d * OVEN.BAKE_MS) / 1000;
            if (Math.abs(film.currentTime - want) > FILM_DRIFT_S) film.currentTime = want;
          }
          if (d >= 1) return takeOutRef.current(1);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      reducedMotion ? 0 : OVEN.PLACE_MS,
    );
    return () => {
      // Interrupted (a restart, leaving): nothing fires afterwards.
      finished.current = true;
      window.clearTimeout(placed);
      cancelAnimationFrame(raf);
      if (doneTimer.current !== null) window.clearTimeout(doneTimer.current);
    };
    // One bake per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The film starts with the oven; if it cannot play, the painted oven takes over (nothing else changes).
  useEffect(() => {
    if (reducedMotion) return;
    const film = filmRef.current;
    if (!film) return;
    let playing = false;
    const onPlaying = () => {
      playing = true;
    };
    const onError = () => setFilmFailed(true);
    film.addEventListener("playing", onPlaying);
    film.addEventListener("error", onError);
    film.muted = true;
    void film.play().catch(() => setFilmFailed(true));
    const giveUp = window.setTimeout(() => {
      if (!playing) setFilmFailed(true);
    }, FILM_START_TIMEOUT_MS);
    return () => {
      window.clearTimeout(giveUp);
      film.removeEventListener("playing", onPlaying);
      film.removeEventListener("error", onError);
    };
  }, [reducedMotion]);

  const zone = donenessLabel(doneness);
  const glow = state === "baking" && !reducedMotion ? 0.25 + doneness * 0.55 : 0.2;
  return (
    <div
      className="absolute inset-0 z-[55] flex flex-col items-center justify-center gap-4 bg-walnut-dark/[0.97] px-5 backdrop-blur-sm text-center"
      data-testid="oven-step"
      data-state={state}
      data-zone={result ?? zone}
      data-film={useFilm ? "on" : "off"}
      role="dialog"
      aria-label={`Baking ${dish.name}`}
    >
      <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.2em] text-gold">
        🔥 Into the oven
      </p>
      <p className="font-display text-[20px] font-extrabold leading-tight text-ivory">
        {dish.emoji} {dish.name}
      </p>
      {useFilm ? (
        // The film of the bread baking (4:5, cropped from the source so no logo is in it; no controls, no skip).
        <div
          className="relative w-full max-w-[300px] overflow-hidden rounded-[22px] border-4 border-[#2b211b] bg-[#1d1410] shadow-lift"
          style={{ aspectRatio: "4 / 5", maxHeight: "44vh" }}
          aria-hidden="true"
          data-testid="oven-film"
        >
          <video
            ref={filmRef}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="auto"
            poster={ovenPoster}
            disablePictureInPicture
            controlsList="nodownload noremoteplayback"
          >
            <source src={ovenWebm} type="video/webm" />
            <source src={ovenMp4} type="video/mp4" />
          </video>
        </div>
      ) : (
        /* The painted oven (when the film cannot play, or Reduced Motion): its window, the glow, the tray and the bread. */
        <div
          className="relative w-full max-w-[300px] overflow-hidden rounded-[22px] border-4 border-[#2b211b] bg-[#3a2a20] p-3 shadow-lift"
          aria-hidden="true"
        >
          <div className="relative h-[130px] overflow-hidden rounded-[14px] border-2 border-black/40 bg-[#1d1410]">
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at 50% 85%, rgba(255,140,40,${glow}), transparent 70%)`,
                transition: reducedMotion ? undefined : "background 300ms linear",
              }}
            />
            <div
              className="absolute inset-x-4 bottom-4 flex h-[46px] items-center justify-center gap-2 rounded-[6px] border-2 border-[#8c8c8c] bg-[#5b5b5b]"
              style={{
                transform: state === "placing" && !reducedMotion ? "translateX(-120%)" : "none",
                transition: reducedMotion ? undefined : `transform ${OVEN.PLACE_MS}ms ease-out`,
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="text-[28px] leading-none"
                  style={{ filter: breadFilter(doneness) }}
                  data-testid="oven-tray-item"
                >
                  {tray}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Doneness: the bar, its very thin golden window and the burnt tail. */}
      <div className="w-full max-w-[300px]">
        <div className="relative h-4 overflow-hidden rounded-full bg-ivory/15">
          <div
            className="absolute inset-y-0 bg-[#5a1f10]/55"
            style={{ left: `${OVEN.BURNT_FROM * 100}%`, right: 0 }}
          />
          <div
            className="absolute inset-y-0 bg-gold/80"
            style={{
              left: `${OVEN.GOLDEN_FROM * 100}%`,
              width: `${(OVEN.GOLDEN_TO - OVEN.GOLDEN_FROM) * 100}%`,
            }}
            data-testid="oven-window"
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#f5deb3,#d99a3a,#7a3e12)]"
            style={{ width: `${Math.round(doneness * 1000) / 10}%` }}
            data-testid="oven-doneness"
          />
        </div>
        <div className="relative mt-1 h-4 font-ui text-[11px] font-bold text-ivory/70">
          <span className="absolute left-0">Pale</span>
          <span
            className="absolute -translate-x-1/2 text-gold"
            style={{ left: `${((OVEN.GOLDEN_FROM + OVEN.GOLDEN_TO) / 2) * 100}%` }}
          >
            Golden
          </span>
          <span className="absolute right-0">Burnt</span>
        </div>
      </div>
      {state === "done" && result ? (
        <p className="anim-pop font-hand text-[22px] text-ivory" data-testid="oven-result">
          {DONENESS_LINE[result]}
        </p>
      ) : (
        <div className="w-full max-w-[300px]">
          <KButton
            full
            variant="copper"
            disabled={state !== "baking"}
            onClick={() => takeOut(doneness)}
          >
            🧤 Take it out
          </KButton>
        </div>
      )}
    </div>
  );
}
