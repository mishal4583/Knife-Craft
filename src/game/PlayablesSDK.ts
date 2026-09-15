/**
 * PLAYABLES_SDK — the only file allowed to touch `window.ytgame` directly.
 *
 * `window.ytgame` is defined by the SDK script tag in index.html (loaded
 * before any game code — see index.html). We never create, wrap, or
 * replace that global; we only read it, and only after checking it
 * actually exists. Outside YouTube (local dev, `npm run preview`, a
 * plain browser tab) `window.ytgame` is undefined and every method here
 * degrades to a harmless local no-op so the rest of the app never has
 * to branch on "am I inside YouTube?".
 */

type YtGameSystem = {
  isAudioEnabled?: () => boolean;
  onAudioEnabledChange?: (cb: (enabled: boolean) => void) => void;
  onPause?: (cb: () => void) => void;
  onResume?: (cb: () => void) => void;
};

type YtGameApi = {
  /**
   * The SDK script (loaded in index.html — see comment there) defines
   * `window.ytgame` unconditionally, in any browser tab, whether or not
   * the page is actually embedded as a YouTube Playable. This flag is
   * the SDK's own signal for that distinction — it's `false` in a plain
   * browser tab and `true` only inside the real Playables iframe.
   * Checking mere `window.ytgame` existence (as an earlier version of
   * this file did) is wrong: it routes every local dev/preview session
   * into the cloud-save branch, where `game.saveData`/`loadData` are
   * absent and every save silently no-ops instead of falling back to
   * localStorage.
   */
  IN_PLAYABLES_ENV?: boolean;
  game?: {
    firstFrameReady?: () => void;
    gameReady?: () => void;
    loadData?: () => Promise<string | null> | string | null;
    saveData?: (data: string) => Promise<void> | void;
  };
  system?: YtGameSystem;
};

declare global {
  interface Window {
    ytgame?: YtGameApi;
  }
}

function sdk(): YtGameApi | null {
  if (typeof window === "undefined" || !window.ytgame?.IN_PLAYABLES_ENV) return null;
  return window.ytgame;
}

export const isInsideYouTube = (): boolean => sdk() !== null;

/** Call once the first visible frame (loading state) is on screen. */
export function firstFrameReady(): void {
  sdk()?.game?.firstFrameReady?.();
}

/** Call once — and only once — the game is actually interactive. */
export function gameReady(): void {
  sdk()?.game?.gameReady?.();
}

/**
 * YouTube is the authoritative lifecycle source: no `document.hidden` /
 * `visibilitychange` listener anywhere in this codebase. Outside YouTube
 * these simply never fire, which is correct — there is no second pause
 * system waiting to take over.
 */
export function onPlatformPause(cb: () => void): void {
  sdk()?.system?.onPause?.(cb);
}

export function onPlatformResume(cb: () => void): void {
  sdk()?.system?.onResume?.(cb);
}

export function isAudioEnabled(): boolean {
  const s = sdk();
  if (!s?.system?.isAudioEnabled) return true; // sane default outside YouTube
  return s.system.isAudioEnabled();
}

export function onAudioEnabledChange(cb: (enabled: boolean) => void): void {
  sdk()?.system?.onAudioEnabledChange?.(cb);
}

export async function loadCloudSave(): Promise<string | null> {
  const s = sdk();
  if (!s?.game?.loadData) return null;
  const result = await s.game.loadData();
  return result ?? null;
}

export async function saveCloudSave(data: string): Promise<void> {
  const s = sdk();
  if (!s?.game?.saveData) return;
  await s.game.saveData(data);
}
