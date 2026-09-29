/**
 * INTERSTITIAL_POLICY — the one gate every interstitial passes through.
 *
 * Called only from explicit player actions at natural break points (never
 * from render or an effect), each with a stable `transitionId` naming that
 * one transition (e.g. "level-finish:level-12:<session>"). Rules, from
 * Playgama's monetization guide (docs/playgama): start "after the first
 * few levels", and keep interstitials "between 120 and 240 seconds" apart.
 *  - never before the player has completed INTERSTITIAL_MIN_COMPLETED_LEVELS
 *    campaign levels (the intro and first levels stay ad-free);
 *  - after that, any natural break may show one, as long as at least
 *    INTERSTITIAL_COOLDOWN_MS has passed since the last ad of ANY kind
 *    settled (so never straight after a rewarded ad), and never while one
 *    is active. Bridge's own minimumDelayBetweenInterstitial (120 s,
 *    playgama-bridge-config.json) is the platform-side floor;
 *  - a transitionId is handled at most once, so a re-render, a repeated
 *    click or navigating back and forth can't request the same ad twice.
 * State is per session, in memory — nothing is saved. A missing, failed or
 * unshown ad changes nothing: the caller has already moved on.
 */
import {
  INTERSTITIAL_PLACEMENT,
  interstitialAdsAvailable,
  isAdActive,
  lastAdSettledTime,
  requestInterstitialAd,
  type InterstitialPlacement,
} from "../PlayablesSDK";

export const INTERSTITIAL_MIN_COMPLETED_LEVELS = 3;
/** 150 s — inside Playgama's recommended 120–240 s between interstitials. */
export const INTERSTITIAL_COOLDOWN_MS = 150 * 1000;

export type InterstitialPolicyState = {
  /** transitionIds already handled this session. */
  handled: Set<string>;
};

export type InterstitialDecision =
  | { show: true }
  | {
      show: false;
      reason: "duplicate" | "tooEarly" | "cooldown" | "adActive" | "unavailable";
    };

export type InterstitialInput = {
  transitionId: string;
  completedLevels: number;
  now: number;
  lastAdSettledAt: number;
  adActive: boolean;
  available: boolean;
};

/** Pure decision + the state it leaves behind (the caller keeps the state). */
export function decideInterstitial(
  state: InterstitialPolicyState,
  input: InterstitialInput,
): { decision: InterstitialDecision; state: InterstitialPolicyState } {
  if (state.handled.has(input.transitionId)) {
    return { decision: { show: false, reason: "duplicate" }, state };
  }
  const handled = new Set(state.handled).add(input.transitionId);
  const no = (reason: Exclude<InterstitialDecision, { show: true }>["reason"]) => ({
    decision: { show: false as const, reason },
    state: { handled },
  });
  if (!input.available) return no("unavailable");
  // The first levels are the player's first impression: no ads yet.
  if (input.completedLevels < INTERSTITIAL_MIN_COMPLETED_LEVELS) return no("tooEarly");
  if (input.adActive) return no("adActive");
  if (input.lastAdSettledAt > 0 && input.now - input.lastAdSettledAt < INTERSTITIAL_COOLDOWN_MS) {
    return no("cooldown");
  }
  return { decision: { show: true }, state: { handled } };
}

let policyState: InterstitialPolicyState = { handled: new Set() };

/**
 * Records one natural transition and, if the policy allows, asks the Bridge
 * for an interstitial at `placement`. Fire-and-forget: never awaited by
 * navigation, never throws, returns the decision for QA.
 */
export function maybeShowInterstitial(
  transitionId: string,
  completedLevels: number,
  placement: InterstitialPlacement = INTERSTITIAL_PLACEMENT,
): InterstitialDecision {
  const { decision, state } = decideInterstitial(policyState, {
    transitionId,
    completedLevels,
    now: Date.now(),
    lastAdSettledAt: lastAdSettledTime(),
    adActive: isAdActive(),
    available: interstitialAdsAvailable(),
  });
  policyState = state;
  if (decision.show) void requestInterstitialAd(placement);
  return decision;
}
