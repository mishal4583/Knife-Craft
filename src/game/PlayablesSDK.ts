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
  engagement?: { sendScore?: (score: { value: number }) => Promise<void> };
  /** YouTube-provided ads (the only ads a Playable may show). */
  ads?: {
    /** Resolves when the request completes; makes NO guarantee an ad was shown — never reward on it. */
    requestInterstitialAd?: () => Promise<void>;
    /** Resolves `true` only if the player earned the reward, `false` if not; rejects if the request failed. */
    requestRewardedAd?: (rewardId: string) => Promise<boolean>;
  };
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

/** Call once the game is actually interactive. Idempotent: the Kitchen (a returning player's first screen) and Preparation (a new player's first screen) both call it; only the first call reaches YouTube. */
let gameReadySent = false;
export function gameReady(): void {
  if (gameReadySent) return;
  gameReadySent = true;
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

/**
 * Reports the player's score to YouTube. KnifeCraft's one score dimension is
 * CAMPAIGN LEVELS COMPLETED (0–250): it only ever grows, so YouTube's "highest
 * score" is always the player's real progress. Integer only; failures are
 * ignored (never affects the game).
 */
export function sendScore(value: number): void {
  const send = sdk()?.engagement?.sendScore;
  if (typeof send !== "function" || !Number.isSafeInteger(value) || value < 0) return;
  try {
    void Promise.resolve(send.call(sdk()!.engagement, { value })).catch(() => undefined);
  } catch {
    // an SDK error must never interrupt play
  }
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

/* ── YouTube ads ───────────────────────────────────────────────────────
 * The only ad code in the game. Ads exist only inside the real Playables
 * environment (IN_PLAYABLES_ENV) with the ads API present — anywhere else
 * both functions report "unavailable" and nothing is shown or granted.
 *
 * NO TIMEOUT ON THE REWARD. YouTube reports a rewarded ad's result only
 * after the player closes the ad, and real ads run 15–30 s or more, so a
 * reward is earned only when requestRewardedAd() itself resolves exactly
 * `true` — however long that takes. (A short timeout here is exactly the
 * bug that shipped in another game: the timer answered "no reward" first,
 * the real `true` arrived later with nothing listening, and the player was
 * sent back to the same ad prompt. Test suites use instant fake ads, so
 * only a long-ad test catches it — see scripts/playables-ads-qa.mts.)
 *
 * Two separate things are tracked while an ad request is open:
 *  - the REQUEST LOCK (`adInFlight`): one ad at a time, so a double tap,
 *    re-render or navigation can't open two ads or two reward flows. For a
 *    rewarded ad it is held until YouTube answers, so a late `true` is
 *    still received and committed.
 *  - the SCREEN BLOCK (`adBlocking`, what isAdActive() reports): mutes the
 *    game and shields input while the ad is on screen. If YouTube never
 *    answers at all, it is released after AD_UI_RELEASE_MS so the game can
 *    never be soft-locked behind a dead request. That release NEVER grants
 *    anything; for an interstitial it also frees the request lock.
 * When the block ends (answer or release), onAdActiveChange(false) fires —
 * PauseManager uses it to wake the game if YouTube paused it for the ad
 * but never sent the matching resume.
 */

/** Only guards a request that never answers — far longer than any real ad. Never used to decide a reward. */
export const AD_UI_RELEASE_MS = 120_000;

let adInFlight = false;
let adBlocking = false;
let lastAdSettledAt = 0;
const adActiveListeners = new Set<(active: boolean) => void>();

function setAdBlocking(active: boolean): void {
  if (adBlocking === active) return;
  adBlocking = active;
  if (!active) lastAdSettledAt = Date.now();
  adActiveListeners.forEach((l) => l(active));
}

/**
 * Opens the lock + screen block for one request and returns its release
 * functions. `releaseUi` is armed on a timer only as the dead-request guard.
 */
function beginAd(releaseLockOnTimeout: boolean): { end: () => void } {
  adInFlight = true;
  setAdBlocking(true);
  let ended = false;
  const guard = setTimeout(() => {
    if (ended) return;
    setAdBlocking(false);
    if (releaseLockOnTimeout) adInFlight = false;
  }, AD_UI_RELEASE_MS);
  return {
    end: () => {
      if (ended) return;
      ended = true;
      clearTimeout(guard);
      adInFlight = false;
      setAdBlocking(false);
    },
  };
}

/** True while a YouTube ad is (as far as we know) on screen — the game mutes and blocks input meanwhile. */
export function isAdActive(): boolean {
  return adBlocking;
}

/** True while an ad request is still waiting for YouTube's answer (even after the screen block was released). */
export function isAdRequestPending(): boolean {
  return adInFlight;
}

/** Epoch ms when the most recent ad stopped blocking the screen (0 = none this session) — for "never right after another ad". */
export function lastAdSettledTime(): number {
  return lastAdSettledAt;
}

export function onAdActiveChange(cb: (active: boolean) => void): () => void {
  adActiveListeners.add(cb);
  return () => adActiveListeners.delete(cb);
}

export function interstitialAdsAvailable(): boolean {
  return typeof sdk()?.ads?.requestInterstitialAd === "function";
}

export function rewardedAdsAvailable(): boolean {
  return typeof sdk()?.ads?.requestRewardedAd === "function";
}

export type InterstitialResult = "requested" | "unavailable" | "busy" | "failed";

/** Asks YouTube for an interstitial. Never throws and never blocks the caller's flow: gameplay continues whatever happens. */
export async function requestInterstitialAd(): Promise<InterstitialResult> {
  const request = sdk()?.ads?.requestInterstitialAd;
  if (typeof request !== "function") return "unavailable";
  if (adInFlight) return "busy";
  const ad = beginAd(true);
  try {
    await request.call(sdk()!.ads);
    return "requested";
  } catch {
    return "failed";
  } finally {
    ad.end();
  }
}

export type RewardedResult =
  | { status: "rewarded" }
  | { status: "not-rewarded" }
  | { status: "failed" }
  | { status: "busy" }
  | { status: "unavailable" };

/**
 * Asks YouTube for a rewarded ad and waits — with no time limit — for its
 * answer. `rewarded` is returned ONLY when the SDK resolved with exactly
 * `true`; `false`, a non-boolean, a rejection or a missing API are all "no
 * reward". The caller commits the reward itself, after this returns.
 */
export async function requestRewardedAd(rewardId: string): Promise<RewardedResult> {
  const request = sdk()?.ads?.requestRewardedAd;
  if (typeof request !== "function") return { status: "unavailable" };
  if (adInFlight) return { status: "busy" };
  const ad = beginAd(false);
  try {
    const earned: unknown = await request.call(sdk()!.ads, rewardId);
    return earned === true ? { status: "rewarded" } : { status: "not-rewarded" };
  } catch {
    return { status: "failed" };
  } finally {
    ad.end();
  }
}
