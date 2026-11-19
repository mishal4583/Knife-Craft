/**
 * A fresh start after a screen's code could not be fetched (developer 2026-11-17: "Open for service" showed "The game hit a snag" and
 * Reload did nothing, three times, right after a new version went out).
 *
 * Every release renames the lazily loaded chunks. A phone that still holds the previous index.html (the host lets browsers keep it for
 * a few minutes, and a plain reload can be answered from that copy) asks for chunk files that are gone, so the same failure repeats on
 * every reload. Loading the page under a different query string cannot be answered from that copy, so the browser gets the current
 * index.html and the current chunk names. The save lives in Bridge storage, not in the URL, so nothing is lost.
 */
const AUTO_EVERY_MS = 60_000;

/** True for the errors a lazily loaded screen throws when its file is missing or the network dropped. */
export function isChunkLoadError(error: unknown): boolean {
  const text = `${(error as Error | undefined)?.name ?? ""} ${(error as Error | undefined)?.message ?? ""}`;
  return /dynamically imported module|importing a module script failed|failed to fetch|loading chunk|chunkloaderror|error loading dynamically/i.test(
    text,
  );
}

/**
 * Loads the page again under a new query string. Automatic callers (`force` false) do it at most once a minute (the last try is read back from the `fresh` parameter of the address), so a chunk that is
 * really missing cannot loop; the button the player taps (`force` true) always does it. Returns whether it navigated.
 */
export function reloadFresh(force = false): boolean {
  const url = new URL(window.location.href);
  // The time of the last try lives in the page's own `fresh` parameter (no sessionStorage, cookie or other storage: Playgama 3.2.1).
  const last = Number(url.searchParams.get("fresh") ?? 0);
  if (!force && Number.isFinite(last) && Date.now() - last < AUTO_EVERY_MS) return false;
  url.searchParams.set("fresh", String(Date.now()));
  window.location.replace(url.toString());
  return true;
}
