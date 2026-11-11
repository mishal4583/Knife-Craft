import { kitchenMapImageUrl } from "./kitchen/kitchenMapArt";

/**
 * WARM THE NEXT SCREEN'S PICTURES (developer 2026-11-11: screens must not show their content before their pictures). Once the app is up and idle,
 * the big pictures of the sections a player visits most (the Market's header, the stockroom banners, the restaurant map, the second floor) are
 * fetched and decoded in the background, so by the time the screen opens they are in the cache and ScreenReveal has nothing to wait for.
 * It only fetches files that already ship with the game (no new network requests to other sites), once each, with low priority.
 */
const shopArt = import.meta.glob("/src/assets/shop-mobile/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const warmed = new Set<string>();

/** Fetches and decodes each picture once. Safe to call again with the same list. */
export function warmPictures(urls: readonly string[]): void {
  if (typeof Image === "undefined") return;
  // Browser tests switch warming off to watch a screen wait for pictures that really are not there yet.
  if ((window as Window & { __kcNoWarm?: boolean }).__kcNoWarm) return;
  for (const url of urls) {
    if (!url || warmed.has(url)) continue;
    warmed.add(url);
    const img = new Image();
    img.decoding = "async";
    (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "low";
    img.src = url;
    void img.decode?.().catch(() => undefined);
  }
}

/** The pictures worth warming for a player at this point: the current kitchen map, the stockroom banners, the Market art, the second floor when open. */
export function sectionPictures(opts: {
  kitchenUpgradeId: string | null | undefined;
  secondFloorOpen: boolean;
}): string[] {
  const base = import.meta.env.BASE_URL;
  return [
    kitchenMapImageUrl(opts.kitchenUpgradeId),
    `${base}inventory/stockroom-banner.webp`,
    `${base}inventory/ingredients-stockroom.webp`,
    `${base}inventory/supplies-stockroom.webp`,
    ...Object.values(shopArt),
    ...(opts.secondFloorOpen ? [`${base}restaurant-map/second-floor.webp`] : []),
  ];
}

/** Runs `fn` when the browser is idle (or after `fallbackMs`), so warming never competes with the screen the player is looking at. */
export function whenIdle(fn: () => void, fallbackMs = 1500): () => void {
  if (typeof window === "undefined") return () => undefined;
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: fallbackMs * 2 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(fn, fallbackMs);
  return () => window.clearTimeout(t);
}
