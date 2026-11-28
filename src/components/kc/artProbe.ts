import { useEffect, useState } from "react";

/**
 * Painted pieces that are drawn only once they have arrived: each file (by its URL) is probed once and remembered, so a piece that is
 * missing (or has not arrived yet) can be drawn by a plain CSS look instead, and nothing paints in half-way. A screen warms its files before
 * it is opened. Used by the Mini-games screen (minigamesArt.ts) and Paige's notebook (assistant/notebookArt.ts). Presentation only.
 */
const known = new Map<string, boolean>();
const failedAt = new Map<string, number>();
const RETRY_MS = 8000;
const pending = new Set<string>();
const listeners = new Set<() => void>();

function probe(url: string) {
  if (pending.has(url) || typeof Image === "undefined") return;
  // a file that came back missing (a flaky connection at the warm-up) is tried again, but not on every render
  if (known.get(url) === true) return;
  if (known.has(url) && Date.now() - (failedAt.get(url) ?? 0) < RETRY_MS) return;
  pending.add(url);
  const img = new Image();
  img.decoding = "async";
  const done = (ok: boolean) => {
    pending.delete(url);
    known.set(url, ok);
    if (!ok) failedAt.set(url, Date.now());
    listeners.forEach((f) => f());
  };
  img.onload = () => done(true);
  img.onerror = () => done(false);
  img.src = url;
}

/** Starts fetching every file, ahead of the screen that shows them. */
export function warmArt(urls: readonly string[]): void {
  urls.forEach(probe);
}

/** Whether each file is here: `here(url)`. Re-renders the caller as files arrive. */
export function useArtFiles(urls: readonly string[]): (url: string) => boolean {
  const [, tick] = useState(0);
  const key = urls.join(",");
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    listeners.add(f);
    urls.forEach(probe);
    // a probe that finished between this render and this effect would otherwise go unheard
    if (urls.some((u) => known.has(u))) f();
    return () => {
      listeners.delete(f);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (url: string) => known.get(url) === true;
}
