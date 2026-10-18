/**
 * PERFORMANCE SAMPLE — the `performance_sample` analytics event (Playgama
 * telemetry guide v1.1). While the cutting board is on screen and the game
 * is not paused, frame times are measured locally and ONE aggregated sample
 * is sent about every 30 s, never one event per frame.
 *
 * Excluded from the sample: paused time (PauseManager — the Bridge's pause,
 * which also covers a hidden tab and ads, and the player's own pause) and any
 * frame gap over BACKGROUND_GAP_MS (requestAnimationFrame stops while the page
 * is hidden, so such a gap is the background, not a frozen frame). There is
 * no Page Visibility API here (preflight).
 *
 * `summarizeFrames` is pure, so QA checks the numbers without a browser.
 */
import { PauseManager } from "../PauseManager";
import { sendAnalyticsEvent, type AnalyticsData } from "../PlayablesSDK";

/** The Phaser scene's own target (GameBridge `fps.target`). */
export const TARGET_FPS = 60;
/** One sample per this much wall-clock time. */
export const SAMPLE_WINDOW_MS = 30_000;
/** A frame gap longer than this is the page in the background, not a stutter. */
export const BACKGROUND_GAP_MS = 2_000;
/** A window is sent only with this much play in it (a mostly paused one, or one cut short, is dropped). */
export const MIN_ACTIVE_MS = 5_000;

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i] ?? 0;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/** The sample's fields from one window's frame times (ms). */
export function summarizeFrames(
  frameTimes: readonly number[],
  windowMs: number,
  activeMs: number,
  targetFps = TARGET_FPS,
): AnalyticsData {
  const times = [...frameTimes].sort((a, b) => a - b);
  const fps = frameTimes.map((t) => (t > 0 ? 1000 / t : 0)).sort((a, b) => a - b);
  const over = (ms: number) => frameTimes.filter((t) => t > ms).length;
  return {
    target_fps: targetFps,
    window_ms: Math.round(windowMs),
    active_ms: Math.round(activeMs),
    frame_count: frameTimes.length,
    fps_avg: activeMs > 0 ? round1((frameTimes.length * 1000) / activeMs) : 0,
    fps_p10: round1(percentile(fps, 10)),
    frame_time_p50_ms: round1(percentile(times, 50)),
    frame_time_p95_ms: round1(percentile(times, 95)),
    frame_time_p99_ms: round1(percentile(times, 99)),
    frame_time_max_ms: round1(times[times.length - 1] ?? 0),
    frames_over_50ms: over(50),
    frames_over_100ms: over(100),
    frames_over_250ms: over(250),
    frames_over_500ms: over(500),
    frames_over_1000ms: over(1000),
  };
}

/**
 * Starts measuring (the Preparation screen calls it on mount) and returns
 * the stop function (its unmount), which sends the last window if it holds
 * at least MIN_ACTIVE_MS of play.
 */
export function startPerformanceSampling(): () => void {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    return () => {};
  }
  let frames: number[] = [];
  let activeMs = 0;
  // The window runs on the frames' own clock (rAF timestamps), set by the first frame.
  let windowStart: number | null = null;
  let last: number | null = null;
  let paused = PauseManager.isPaused();
  let raf = 0;
  let stopped = false;

  const flush = (now: number) => {
    const windowMs = windowStart === null ? 0 : now - windowStart;
    if (activeMs >= MIN_ACTIVE_MS) {
      sendAnalyticsEvent(
        "performance_sample",
        summarizeFrames(frames, windowMs, Math.min(activeMs, windowMs)),
      );
    }
    frames = [];
    activeMs = 0;
    windowStart = now;
  };

  const tick = (now: number) => {
    if (stopped) return;
    if (windowStart === null) windowStart = now;
    if (!paused && last !== null) {
      const dt = now - last;
      if (dt > 0 && dt <= BACKGROUND_GAP_MS) {
        frames.push(dt);
        activeMs += dt;
      }
    }
    last = paused ? null : now;
    if (now - windowStart >= SAMPLE_WINDOW_MS) flush(now);
    raf = window.requestAnimationFrame(tick);
  };
  raf = window.requestAnimationFrame(tick);

  const unsubscribe = PauseManager.subscribe((p) => {
    paused = p;
    if (p) last = null;
  });

  return () => {
    if (stopped) return;
    stopped = true;
    window.cancelAnimationFrame(raf);
    unsubscribe();
    flush(last ?? performance.now());
  };
}
