import { useSyncExternalStore } from "react";

/**
 * The count of mounted portrait-only screens (see `PortraitOnly.tsx`). A counter, not a flag, so two screens mounted for a moment while one replaces
 * another never leave the shell in the wrong mode.
 */
let mounted = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** A portrait-only screen came on (+1) or went away (-1). */
export function countPortraitOnly(delta: 1 | -1) {
  mounted += delta;
  emit();
}

/** True while any portrait-only screen is on. */
export function usePortraitOnlyActive(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => mounted > 0,
    () => false,
  );
}
