import { useEffect, useRef, useState } from "react";
import { PauseManager } from "@/game/PauseManager";
import { PausableCountdown } from "@/game/story/pausableCountdown";

/** True while the game is paused (PauseManager), for freezing CSS animations. */
export function usePaused(): boolean {
  const [paused, setPaused] = useState(() => PauseManager.isPaused());
  useEffect(() => PauseManager.subscribe(setPaused), []);
  return paused;
}

/**
 * Calls `onFire` after `ms` of UNPAUSED time. Re-armed whenever `key`
 * changes; `ms === null` arms nothing. Stops with PauseManager and keeps
 * the time that was left.
 */
export function usePausableTimeout(onFire: () => void, ms: number | null, key: unknown): void {
  const fireRef = useRef(onFire);
  useEffect(() => {
    fireRef.current = onFire;
  });
  useEffect(() => {
    if (ms === null) return;
    const countdown = new PausableCountdown(ms, () => fireRef.current());
    // subscribe() reports the current state at once: running unless paused.
    const unsubscribe = PauseManager.subscribe((p) => (p ? countdown.pause() : countdown.resume()));
    return () => {
      unsubscribe();
      countdown.cancel();
    };
  }, [key, ms]);
}
