import { useSyncExternalStore } from "react";

/**
 * The portrait-only screens that are mounted (see `PortraitOnly.tsx`), each with the landscape picture to show round its stage (or none). A list, not a flag, so two
 * screens mounted for a moment while one replaces another never leave the shell in the wrong mode; the latest one decides the picture.
 */
type Entry = { art: string | null };
let entries: Entry[] = [];
let snapshot: { active: boolean; art: string | null } = { active: false, art: null };
const listeners = new Set<() => void>();
const emit = () => {
  const last = entries[entries.length - 1];
  snapshot = { active: entries.length > 0, art: last?.art ?? null };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** A portrait-only screen came on; returns what to call when it goes away. */
export function registerPortraitOnly(art: string | null): () => void {
  const e: Entry = { art };
  entries = [...entries, e];
  emit();
  return () => {
    entries = entries.filter((x) => x !== e);
    emit();
  };
}

/** Whether any portrait-only screen is on, and the picture to put behind its stage. */
export function usePortraitOnly(): { active: boolean; art: string | null } {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
