import { useEffect, useRef, useState } from "react";
import { PrepRushBridge, type PrepRushEvent } from "@/game/PrepRushBridge";
import { PauseManager } from "@/game/PauseManager";
import { AudioManager } from "@/game/AudioManager";
import {
  EMPTY_STATS,
  PREP_RUSH,
  recordRushScore,
  rushSessionBest,
  type RushStats,
} from "@/game/prepRush";
import { IconButton } from "../common/Buttons";
import { KButton, Panel } from "../common/primitives";
import type { ScreenId } from "../data";

type Phase = "intro" | "playing" | "results";

/**
 * PREP_RUSH screen — Phase 3 (B). Intro → run → results, with Replay and
 * Back to Orders; a pause panel mid-run. It owns one PrepRushBridge for
 * its lifetime and leaves nothing behind: leaving stops the run, resumes
 * PauseManager (a paused exit must never leave the next screen frozen —
 * the same rule as Preparation's pause menu) and tears the game down.
 * No save, no money: only this session's best score (prepRush.ts).
 */
export function PrepRush({ go }: { go: (s: ScreenId) => void }) {
  const [bridge] = useState(() => new PrepRushBridge());
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [stats, setStats] = useState<RushStats>(EMPTY_STATS);
  const [msLeft, setMsLeft] = useState<number>(PREP_RUSH.DURATION_MS);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ stats: RushStats; best: number; isNew: boolean } | null>(
    null,
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    bridge.mount(el);
    const unsubscribe = bridge.subscribe((event: PrepRushEvent) => {
      if (event.type === "STATS") {
        setStats(event.payload.stats);
        setMsLeft(event.payload.msLeft);
      } else if (event.type === "ENDED") {
        setStats(event.payload.stats);
        setMsLeft(0);
        setResult({ stats: event.payload.stats, ...recordRushScore(event.payload.stats.score) });
        setPhase("results");
      }
    });
    const unsubscribePause = PauseManager.subscribe(setPaused);
    return () => {
      unsubscribe();
      unsubscribePause();
      bridge.stop();
      PauseManager.resume();
      bridge.destroy();
    };
  }, [bridge]);

  function startRun() {
    PauseManager.resume();
    setResult(null);
    setStats(EMPTY_STATS);
    setMsLeft(PREP_RUSH.DURATION_MS);
    setPhase("playing");
    AudioManager.playSfx("tap");
    bridge.start();
  }

  function exit() {
    bridge.stop();
    PauseManager.resume();
    go("board");
  }

  const seconds = Math.ceil(msLeft / 1000);
  const missesLeft = PREP_RUSH.MAX_MISSES - stats.missed;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[linear-gradient(180deg,#f3e3c4,#e6cc9f)]"
      data-testid="prep-rush"
      data-phase={phase}
    >
      <div
        ref={containerRef}
        className="absolute inset-x-0 top-[13%] z-10 h-[80%] touch-none"
        data-testid="prep-rush-viewport"
      />

      {/* HUD: always laid out so nothing jumps when the run starts. */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-start gap-2 px-3 pt-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 font-ui text-[12.5px] font-extrabold text-walnut-dark">
          <span
            className="rounded-full bg-ivory/85 px-2.5 py-1 shadow-soft"
            data-testid="rush-score"
          >
            ⭐ {stats.score}
          </span>
          <span
            className="rounded-full bg-ivory/85 px-2.5 py-1 shadow-soft"
            data-testid="rush-time"
          >
            ⏱ {seconds}s
          </span>
          <span
            className="rounded-full bg-ivory/85 px-2.5 py-1 shadow-soft"
            data-testid="rush-misses"
            aria-label={`${missesLeft} misses left`}
          >
            {"❤️".repeat(Math.max(0, missesLeft))}
            {"🤍".repeat(Math.min(PREP_RUSH.MAX_MISSES, stats.missed))}
          </span>
          {stats.combo >= 2 ? (
            <span
              className="rounded-full bg-gold/90 px-2.5 py-1 text-walnut-dark shadow-soft"
              data-testid="rush-combo"
            >
              ×{stats.combo}
            </span>
          ) : null}
        </div>
        {phase === "playing" ? (
          <IconButton label="Pause" tone="dark" onClick={() => PauseManager.pause()}>
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
              <rect x="6" y="4" width="4" height="16" rx="1.6" fill="currentColor" />
              <rect x="14" y="4" width="4" height="16" rx="1.6" fill="currentColor" />
            </svg>
          </IconButton>
        ) : null}
      </div>

      {phase === "intro" ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-walnut-dark/35 px-4 backdrop-blur-[2px]">
          <Panel
            tone="cream"
            className="anim-pop w-full max-w-[340px] p-5 text-center"
            data-testid="rush-intro"
          >
            <p className="text-[40px] leading-none">🏃‍♂️🔪</p>
            <p className="mt-2 font-display text-[24px] font-black leading-tight text-walnut-dark">
              Prep Rush
            </p>
            <p className="mt-1 font-hand text-[16px] leading-snug text-walnut/70">
              Ingredients ride the belt — swipe through them before they fall off the end.
            </p>
            <ul className="mt-3 space-y-1 text-left font-ui text-[12.5px] font-bold text-walnut/80">
              <li>🔪 Swipe through the middle for a clean cut (+{PREP_RUSH.POINTS.CLEAN})</li>
              <li>👆 A tap cuts too, just not cleanly</li>
              <li>
                🔥 Every {PREP_RUSH.POINTS.COMBO_EVERY} in a row: +{PREP_RUSH.POINTS.COMBO_BONUS}
              </li>
              <li>
                ⏱ {PREP_RUSH.DURATION_MS / 1000}s, or {PREP_RUSH.MAX_MISSES} misses and it's over
              </li>
            </ul>
            <p className="mt-3 font-hand text-[14px] text-walnut/55">
              Just for fun — no money, no stock, no progress.
            </p>
            <div className="mt-4 space-y-2">
              <KButton full size="lg" onClick={startRun}>
                Start Rush
              </KButton>
              <KButton full variant="ghost" onClick={exit}>
                Back to Orders
              </KButton>
            </div>
          </Panel>
        </div>
      ) : null}

      {phase === "playing" && paused ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-walnut-dark/40 backdrop-blur-[3px]">
          <Panel
            tone="cream"
            className="anim-pop w-[74%] max-w-[320px] p-5 text-center"
            data-testid="rush-paused"
          >
            <p className="font-display text-[22px] font-black text-walnut-dark">Paused</p>
            <p className="mt-1 font-hand text-[17px] text-walnut/70">the belt will wait</p>
            <div className="mt-4 space-y-2">
              <KButton full onClick={() => PauseManager.resume()}>
                Resume
              </KButton>
              <KButton full variant="cream" onClick={startRun}>
                Restart Rush
              </KButton>
              <KButton full variant="ghost" onClick={exit}>
                Back to Orders
              </KButton>
            </div>
          </Panel>
        </div>
      ) : null}

      {phase === "results" && result ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-walnut-dark/35 px-4 backdrop-blur-[2px]">
          <Panel
            tone="cream"
            className="anim-pop w-full max-w-[340px] p-5 text-center"
            data-testid="rush-results"
          >
            <p className="font-display text-[22px] font-black text-walnut-dark">
              {result.stats.missed >= PREP_RUSH.MAX_MISSES ? "Belt overflow!" : "Time's up!"}
            </p>
            <p
              className="mt-1 font-display text-[40px] font-black leading-none text-copper"
              data-testid="rush-final-score"
            >
              {result.stats.score}
            </p>
            <p className="font-hand text-[15px] text-walnut/65" data-testid="rush-best">
              {result.isNew ? "🏆 New best this session!" : `Best this session: ${result.best}`}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-1.5 font-ui text-[12.5px] font-bold text-walnut/80">
              <span className="rounded-xl bg-ivory/70 py-1.5">
                🥗 {result.stats.prepared} prepared
              </span>
              <span className="rounded-xl bg-ivory/70 py-1.5">✨ {result.stats.clean} clean</span>
              <span className="rounded-xl bg-ivory/70 py-1.5">🗑️ {result.stats.missed} missed</span>
              <span className="rounded-xl bg-ivory/70 py-1.5">
                🔥 best ×{result.stats.bestCombo}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              <KButton full size="lg" onClick={startRun}>
                Replay
              </KButton>
              <KButton full variant="ghost" onClick={exit}>
                Back to Orders
              </KButton>
            </div>
          </Panel>
        </div>
      ) : null}

      {phase === "intro" && rushSessionBest() > 0 ? (
        <p className="absolute inset-x-0 bottom-3 z-30 text-center font-hand text-[15px] text-ivory">
          Best this session: {rushSessionBest()}
        </p>
      ) : null}
    </div>
  );
}
