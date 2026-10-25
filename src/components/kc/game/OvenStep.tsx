import { useEffect, useRef, useState } from "react";
import {
  DONENESS_LINE,
  OVEN,
  breadFilter,
  donenessAt,
  donenessLabel,
  type Doneness,
} from "@/game/cooking/ovenStep";
import { AudioManager } from "@/game/AudioManager";
import { KButton } from "../common/primitives";

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
 */
export function OvenStep({
  dish,
  reducedMotion,
  onDone,
}: {
  dish: { emoji: string; name: string };
  reducedMotion: boolean;
  onDone: () => void;
}) {
  const [state, setState] = useState<"placing" | "baking" | "done">(
    reducedMotion ? "baking" : "placing",
  );
  const [doneness, setDoneness] = useState(0);
  const [result, setResult] = useState<Doneness | null>(null);
  const bakeStart = useRef<number | null>(null);
  const finished = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const takeOut = (d: number) => {
    if (finished.current) return;
    finished.current = true;
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

  const zone = donenessLabel(doneness);
  const glow = state === "baking" && !reducedMotion ? 0.25 + doneness * 0.55 : 0.2;
  return (
    <div
      className="absolute inset-0 z-[55] flex flex-col items-center justify-center gap-4 bg-walnut-dark/90 px-5 text-center"
      data-testid="oven-step"
      data-state={state}
      data-zone={result ?? zone}
      role="dialog"
      aria-label={`Baking ${dish.name}`}
    >
      <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.2em] text-gold">
        🔥 Into the oven
      </p>
      <p className="font-display text-[20px] font-extrabold leading-tight text-ivory">
        {dish.emoji} {dish.name}
      </p>
      {/* The oven: its window, the glow, the tray and the bread. */}
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
              >
                🍞
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Doneness: the bar and its golden window. */}
      <div className="w-full max-w-[300px]">
        <div className="relative h-4 overflow-hidden rounded-full bg-ivory/15">
          <div
            className="absolute inset-y-0 bg-gold/45"
            style={{
              left: `${OVEN.GOLDEN_FROM * 100}%`,
              width: `${(OVEN.GOLDEN_TO - OVEN.GOLDEN_FROM) * 100}%`,
            }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#f5deb3,#d99a3a,#7a3e12)]"
            style={{ width: `${Math.round(doneness * 1000) / 10}%` }}
            data-testid="oven-doneness"
          />
        </div>
        <div className="mt-1 flex justify-between font-ui text-[11px] font-bold text-ivory/70">
          <span>Pale</span>
          <span className="text-gold">Golden</span>
          <span>Toasty</span>
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
