import { useSyncExternalStore } from "react";

/**
 * The portrait-only screens that are mounted (see `PortraitOnly.tsx`), each with the landscape picture to show round its stage (or none). A list, not a flag, so two
 * screens mounted for a moment while one replaces another never leave the shell in the wrong mode; the latest one decides the picture.
 */
type Entry = { art: string | null; wideOnly: boolean };
let entries: Entry[] = [];
let snapshot: { active: boolean; art: string | null; wideOnly: boolean } = {
  active: false,
  art: null,
  wideOnly: false,
};
const listeners = new Set<() => void>();
const emit = () => {
  const last = entries[entries.length - 1];
  // `wideOnly`: only a window as wide as a landscape layout gets the 9:16 box (the Kitchen and the maps); every screen mounted must ask for it
  snapshot = {
    active: entries.length > 0,
    art: last?.art ?? null,
    wideOnly: entries.length > 0 && entries.every((x) => x.wideOnly),
  };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** A portrait-only screen came on; returns what to call when it goes away. */
export function registerPortraitOnly(art: string | null, wideOnly = false): () => void {
  const e: Entry = { art, wideOnly };
  entries = [...entries, e];
  emit();
  return () => {
    entries = entries.filter((x) => x !== e);
    emit();
  };
}

/** Whether any portrait-only screen is on, and the picture to put behind its stage. */
export function usePortraitOnly(): { active: boolean; art: string | null; wideOnly: boolean } {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
