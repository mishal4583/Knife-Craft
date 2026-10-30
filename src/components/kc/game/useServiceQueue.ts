import { useEffect, useRef, useState } from "react";
import { PauseManager } from "@/game/PauseManager";
import {
  startQueue,
  stepQueue,
  syncQueue,
  type Arrival,
  type QueueState,
  type ServiceProgress,
} from "@/game/restaurant/serviceFlow";

/**
 * The service clock (Phase 2, restaurant/serviceFlow.ts): runs the door queue with animation
 * frames while `running` (serviceClockRuns: the service screen, serving, nothing else) and the
 * game is not paused (PauseManager: pause menu, ads). The browser stops frames for a hidden tab,
 * so the clock stops too; a frame is clamped to 250 ms, so coming back is never a burst.
 * A new `key` (another level) starts a new queue; a null key (the player left the service) keeps
 * the queue frozen, so coming back to the same service resumes it where it was. The queue
 * follows `progress` (who has been served), so it is right after a reload. Re-renders only when
 * what the door shows changes.
 */
export function useServiceQueue(args: {
  key: string | null;
  schedule: readonly Arrival[];
  levelNumber: number;
  running: boolean;
  patiencePaused: boolean;
  progress: ServiceProgress;
}): QueueState | null {
  const { key, schedule, levelNumber, running, patiencePaused, progress } = args;
  const ref = useRef<{ key: string | null; q: QueueState | null }>({ key: null, q: null });
  const [, setTick] = useState(0);
  const [gamePaused, setGamePaused] = useState(() => PauseManager.isPaused());
  useEffect(() => PauseManager.subscribe(setGamePaused), []);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  if (key && ref.current.key !== key) {
    ref.current = { key, q: syncQueue(startQueue(schedule, levelNumber), progress) };
  } else if (key && ref.current.q) {
    ref.current.q = syncQueue(ref.current.q, progress);
  }
  const live = !!key && running && !gamePaused;

  useEffect(() => {
    if (!live || !ref.current.q) return;
    let last = performance.now();
    let frame = 0;
    const view = (q: QueueState) =>
      q.guests.map((g) => `${g.arrival.id}:${g.state}:${Math.floor(g.waitedMs / 5000)}`).join();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      const before = ref.current.q;
      if (before) {
        const after = syncQueue(stepQueue(before, dt, { patiencePaused }), progressRef.current);
        ref.current.q = after;
        if (view(after) !== view(before)) setTick((t) => t + 1);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [live, patiencePaused, key]);

  return key ? ref.current.q : null;
}
