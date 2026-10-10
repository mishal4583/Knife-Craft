/**
 * PLATFORM SDK — Playgama Bridge (v2) edition. The only file allowed to touch
 * `window.bridge`.
 *
 * The Bridge script is loaded from Playgama's CDN in index.html, ahead of the
 * game bundle, and `playgama-bridge-config.json` sits next to index.html. On
 * Playgama (and every platform Bridge supports) it routes these calls to the
 * host's own SDK; anywhere else it runs a mock platform with safe defaults.
 * If the script is missing entirely (unit tests, offline) every function here
 * degrades to a harmless local no-op, so the game never branches on it.
 *
 * Nothing may call the Bridge before `bridge.initialize()` resolves, so every
 * function waits on `platformReady()`; `startPlatform()` (main.tsx) kicks it
 * off at boot.
 */

type BridgeStateHandler<T> = (value: T) => void;

type Bridge = {
  initialize: () => Promise<void>;
  EVENT_NAME: {
    PAUSE_STATE_CHANGED: string;
    AUDIO_STATE_CHANGED: string;
    INTERSTITIAL_STATE_CHANGED: string;
    REWARDED_STATE_CHANGED: string;
  };
  platform: {
    id?: string;
    language?: string;
    isAudioEnabled: boolean;
    sendMessage: (message: string, options?: Record<string, string>) => unknown;
    on: (event: string, handler: BridgeStateHandler<boolean>) => void;
  };
  storage: {
    get: (keys: string[]) => Promise<Array<unknown>>;
    set: (keys: string[], values: unknown[]) => Promise<void>;
  };
  advertisement: {
    isInterstitialSupported: boolean;
    isRewardedSupported: boolean;
    showInterstitial: (placement?: string) => unknown;
    showRewarded: (placement?: string) => unknown;
    on: (event: string, handler: BridgeStateHandler<string>) => void;
    off?: (event: string, handler: BridgeStateHandler<string>) => void;
  };
};

declare global {
  interface Window {
    bridge?: Bridge;
  }
}

/**
 * Stable placement ids — one per ad SPOT, reused every time (never a
 * per-offer id). Each is listed under `advertisement.*.placements` in
 * public/playgama-bridge-config.json, so revenue can be split by spot.
 */
export const AD_PLACEMENT = {
  /** Interstitial after a finished level / session (level finish, Back to Kitchen, Next Level). */
  levelCompleted: "level_completed",
  /** Interstitial after closing a Business day. */
  businessDayEnd: "business_day_end",
  /** Rewarded: the Replay Bonus. */
  replayBonus: "replay_bonus",
  /** Rewarded: a free Rush Restock for a blocked Business order. */
  rushRestock: "rush_restock",
  /** Rewarded: the restaurant's Pre-Service Check — the missing ingredients, free. */
  serviceStock: "service_stock",
  /** Rewarded: the restaurant's Pre-Service Check — the missing supplies, free. */
  serviceSupplies: "service_supplies",
} as const;
export type InterstitialPlacement =
  typeof AD_PLACEMENT.levelCompleted | typeof AD_PLACEMENT.businessDayEnd;
export type RewardedPlacement =
  | typeof AD_PLACEMENT.replayBonus
  | typeof AD_PLACEMENT.rushRestock
  | typeof AD_PLACEMENT.serviceStock
  | typeof AD_PLACEMENT.serviceSupplies;
/** The defaults (also the config's placementFallback values). */
export const INTERSTITIAL_PLACEMENT: InterstitialPlacement = AD_PLACEMENT.levelCompleted;
export const REWARDED_PLACEMENT: RewardedPlacement = AD_PLACEMENT.replayBonus;

let readyPromise: Promise<Bridge | null> | null = null;
let bridgeInstance: Bridge | null = null;
let platformLanguage = "en";

/** Starts (once) and awaits Bridge initialization. Resolves null when no Bridge is present or it failed. */
export function platformReady(): Promise<Bridge | null> {
  if (readyPromise) return readyPromise;
  const b = typeof window !== "undefined" ? window.bridge : undefined;
  if (!b) {
    readyPromise = Promise.resolve(null);
    return readyPromise;
  }
  readyPromise = b
    .initialize()
    .then(() => {
      bridgeInstance = b;
      // Required step: read platform.language once after initialization. KnifeCraft
      // ships in English only, so its text stays English for every language.
      platformLanguage = typeof b.platform.language === "string" ? b.platform.language : "en";
      wireLifecycle(b);
      return b;
    })
    .catch(() => null);
  return readyPromise;
}

/** Called once at boot (main.tsx). */
export function startPlatform(): void {
  void platformReady();
}

/** The host platform's language (ISO 639-1). The game's text is English for every value. */
export function getPlatformLanguage(): string {
  return platformLanguage;
}

/** True once the Bridge is initialized (the game then saves through Bridge storage). */
export function hasPlatform(): boolean {
  return bridgeInstance !== null;
}

/** Sends `game_ready` once the game is interactive. Idempotent. */
let gameReadySent = false;
export function gameReady(): void {
  if (gameReadySent) return;
  gameReadySent = true;
  void platformReady().then((b) => b?.platform.sendMessage("game_ready"));
}

/* ── Level lifecycle messages (recommended by the Bridge platform docs) ── */

/**
 * `world` groups levels (a campaign chapter, "todays-special", "endless",
 * "business"); `level` is the level number (or the Business day). Sent as
 * Bridge's `{ world, level }` options, strings as in the docs' example.
 */
export type LevelContext = { world: string; level: string };

/** The level currently being played, or null between levels. */
let openLevel: LevelContext | null = null;
let levelPausedSent = false;

function sendPlatformMessage(message: string, ctx: LevelContext): void {
  void platformReady().then((b) => {
    try {
      void Promise.resolve(b?.platform.sendMessage(message, { ...ctx })).catch(() => {});
    } catch {
      // A platform that can't take the message is a silent no-op.
    }
  });
}

/** `level_started` — the player entered a level (campaign, Today's Special, Endless, a Business order). */
export function levelStarted(ctx: LevelContext): void {
  openLevel = { ...ctx };
  levelPausedSent = false;
  sendPlatformMessage("level_started", openLevel);
}

/** `level_completed` — the level open since levelStarted was finished. Once per start. */
export function levelCompleted(): void {
  if (!openLevel) return;
  sendPlatformMessage("level_completed", openLevel);
  openLevel = null;
  levelPausedSent = false;
}

/** `level_paused` — the player opened the in-game pause menu during a level. */
export function levelPaused(): void {
  if (!openLevel || levelPausedSent) return;
  levelPausedSent = true;
  sendPlatformMessage("level_paused", openLevel);
}

/** `level_resumed` — the player left the pause menu back into the level. */
export function levelResumed(): void {
  if (!openLevel || !levelPausedSent) return;
  levelPausedSent = false;
  sendPlatformMessage("level_resumed", openLevel);
}

/** Leaving a level without finishing it: no message (KnifeCraft has no fail state), just closes it. */
export function levelAbandoned(): void {
  openLevel = null;
  levelPausedSent = false;
}

/* ── Pause + audio (required: subscribe to both) ─────────────────────── */

const pauseCallbacks = new Set<() => void>();
const resumeCallbacks = new Set<() => void>();
const audioCallbacks = new Set<(enabled: boolean) => void>();

function wireLifecycle(b: Bridge): void {
  b.platform.on(b.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused) => {
    (isPaused ? pauseCallbacks : resumeCallbacks).forEach((cb) => cb());
  });
  b.platform.on(b.EVENT_NAME.AUDIO_STATE_CHANGED, (isEnabled) => {
    audioCallbacks.forEach((cb) => cb(!!isEnabled));
  });
  // The event only fires on later changes — apply the starting state now.
  const enabled = !!b.platform.isAudioEnabled;
  audioCallbacks.forEach((cb) => cb(enabled));
}

export function onPlatformPause(cb: () => void): void {
  pauseCallbacks.add(cb);
}

export function onPlatformResume(cb: () => void): void {
  resumeCallbacks.add(cb);
}

export function isAudioEnabled(): boolean {
  return bridgeInstance ? !!bridgeInstance.platform.isAudioEnabled : true;
}

export function onAudioEnabledChange(cb: (enabled: boolean) => void): void {
  audioCallbacks.add(cb);
  if (bridgeInstance) cb(!!bridgeInstance.platform.isAudioEnabled);
}

/* ── Storage (required: never localStorage directly) ─────────────────── */

export const SAVE_KEY = "knifecraft_save";

/** The save string from Bridge storage (null if none yet). Null when there is no Bridge. */
export async function loadCloudSave(): Promise<string | null> {
  const b = await platformReady();
  if (!b) return null;
  const [value] = await b.storage.get([SAVE_KEY]);
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

export async function saveCloudSave(data: string): Promise<void> {
  const b = await platformReady();
  if (!b) return;
  await b.storage.set([SAVE_KEY], [data]);
}

/** Scores: no Playgama leaderboard is configured for KnifeCraft, so this is a no-op. */
export function sendScore(value: number): void {
  void value;
}

/* ── Ads ─────────────────────────────────────────────────────────────────
 * Same rules as the YouTube build:
 *  - NO TIMEOUT ON THE REWARD. A reward is earned only when Bridge reports
 *    the rewarded ad's state `rewarded` — never because it closed or time passed.
 *  - One ad at a time (REQUEST LOCK), so a double tap can't open two.
 *  - A SCREEN BLOCK mutes and shields the game while the ad is up; if an ad
 *    never answers it is lifted after AD_UI_RELEASE_MS (never grants anything).
 *  - If an ad never even STARTS (no state change at all within
 *    AD_START_TIMEOUT_MS — e.g. the platform's own interval skipped it), the
 *    request ends as "not shown". Once an ad has started there is no limit.
 * Bridge fires the platform pause/audio events around ads; onAdActiveChange
 * lets PauseManager wake the game if a platform forgets to resume.
 */

export const AD_UI_RELEASE_MS = 120_000;
export const AD_START_TIMEOUT_MS = 30_000;

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

export function isAdActive(): boolean {
  return adBlocking;
}

export function isAdRequestPending(): boolean {
  return adInFlight;
}

export function lastAdSettledTime(): number {
  return lastAdSettledAt;
}

export function onAdActiveChange(cb: (active: boolean) => void): () => void {
  adActiveListeners.add(cb);
  return () => adActiveListeners.delete(cb);
}

export function interstitialAdsAvailable(): boolean {
  return !!bridgeInstance?.advertisement.isInterstitialSupported;
}

export function rewardedAdsAvailable(): boolean {
  return !!bridgeInstance?.advertisement.isRewardedSupported;
}

export type InterstitialResult = "requested" | "unavailable" | "busy" | "failed";

/** Shows an interstitial at a natural break. Never throws, never blocks the caller. */
export async function requestInterstitialAd(
  placement: InterstitialPlacement = INTERSTITIAL_PLACEMENT,
): Promise<InterstitialResult> {
  const b = bridgeInstance;
  if (!b || !b.advertisement.isInterstitialSupported) return "unavailable";
  if (adInFlight) return "busy";
  const ad = beginAd(true);
  const result = await new Promise<InterstitialResult>((resolve) => {
    let started = false;
    let done = false;
    const finish = (r: InterstitialResult) => {
      if (done) return;
      done = true;
      clearTimeout(noStart);
      b.advertisement.off?.(b.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onState);
      resolve(r);
    };
    const onState = (state: string) => {
      if (state === "loading" || state === "opened") started = true;
      else if (state === "closed") finish("requested");
      else if (state === "failed") finish("failed");
    };
    const noStart = setTimeout(() => {
      if (!started) finish("failed");
    }, AD_START_TIMEOUT_MS);
    b.advertisement.on(b.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onState);
    try {
      b.advertisement.showInterstitial(placement);
    } catch {
      finish("failed");
    }
  });
  ad.end();
  return result;
}

export type RewardedResult =
  | { status: "rewarded" }
  | { status: "not-rewarded" }
  | { status: "failed" }
  | { status: "busy" }
  | { status: "unavailable" };

/**
 * Shows the rewarded ad and waits — with no limit once it has started — for
 * Bridge's outcome: `rewarded` only when the state `rewarded` was reported
 * before the ad closed. `rewardId` is the game's own transaction id (for the
 * caller's ledger); the platform gets the stable placement of the spot
 * (AD_PLACEMENT), never a per-offer id.
 */
export async function requestRewardedAd(
  rewardId: string,
  placement: RewardedPlacement = REWARDED_PLACEMENT,
): Promise<RewardedResult> {
  void rewardId;
  const b = bridgeInstance;
  if (!b || !b.advertisement.isRewardedSupported) return { status: "unavailable" };
  if (adInFlight) return { status: "busy" };
  const ad = beginAd(false);
  const result = await new Promise<RewardedResult>((resolve) => {
    let started = false;
    let earned = false;
    let done = false;
    const finish = (r: RewardedResult) => {
      if (done) return;
      done = true;
      clearTimeout(noStart);
      b.advertisement.off?.(b.EVENT_NAME.REWARDED_STATE_CHANGED, onState);
      resolve(r);
    };
    const onState = (state: string) => {
      if (state === "loading" || state === "opened") started = true;
      else if (state === "rewarded") {
        started = true;
        earned = true;
      } else if (state === "closed") {
        finish(earned ? { status: "rewarded" } : { status: "not-rewarded" });
      } else if (state === "failed") {
        finish(earned ? { status: "rewarded" } : { status: "failed" });
      }
    };
    const noStart = setTimeout(() => {
      if (!started) finish({ status: "failed" });
    }, AD_START_TIMEOUT_MS);
    b.advertisement.on(b.EVENT_NAME.REWARDED_STATE_CHANGED, onState);
    try {
      b.advertisement.showRewarded(placement);
    } catch {
      finish({ status: "failed" });
    }
  });
  ad.end();
  return result;
}
