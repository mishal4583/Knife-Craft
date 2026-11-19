/**
 * INTERSTITIAL_POLICY — the one gate every interstitial request passes through.
 *
 * RULE CHANGE (developer 2026-11-19, Playgama Bridge Required step 7 and the self-check "the game times them itself"): the game used to add its own
 * timers and counters here (none before 3 completed levels, 150 s between ads). Playgama's rule is: call `showInterstitial()` at every natural pause,
 * "do not add your own timers or counters: Bridge decides when an ad is actually shown, including the delay before the first one and the interval
 * between them" (`playgama-bridge-config.json` keeps the platform default delay). So this gate no longer counts levels or seconds.
 *
 * Called only from explicit player actions at natural break points (never from render or an effect), each with a stable `transitionId` naming that
 * one transition (e.g. "level-finish:level-12:<session>"). It only guards against mistakes, never against frequency:
 *  - a transitionId is handled at most once, so a re-render, a repeated click or navigating back and forth can't request the same ad twice;
 *  - never while another ad is active (the Bridge would refuse it anyway);
 *  - never without the platform's ads API.
 * State is per session, in memory — nothing is saved. A missing, failed, skipped or unshown ad changes nothing: the caller has already moved on.
 */
import {
  INTERSTITIAL_PLACEMENT,
  interstitialAdsAvailable,
  isAdActive,
  requestInterstitialAd,
  type InterstitialPlacement,
} from "../PlayablesSDK";

export type InterstitialPolicyState = {
  /** transitionIds already handled this session. */
  handled: Set<string>;
};

export type InterstitialDecision =
  | { show: true }
  | {
      show: false;
      reason: "duplicate" | "adActive" | "unavailable";
    };

export type InterstitialInput = {
  transitionId: string;
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
  if (input.adActive) return no("adActive");
  return { decision: { show: true }, state: { handled } };
}

let policyState: InterstitialPolicyState = { handled: new Set() };

/**
 * Records one natural transition and asks the Bridge for an interstitial at `placement`; the Bridge decides whether and when it really shows.
 * Fire-and-forget: never awaited by navigation, never throws, returns the decision for QA.
 */
export function maybeShowInterstitial(
  transitionId: string,
  placement: InterstitialPlacement = INTERSTITIAL_PLACEMENT,
): InterstitialDecision {
  const { decision, state } = decideInterstitial(policyState, {
    transitionId,
    adActive: isAdActive(),
    available: interstitialAdsAvailable(),
  });
  policyState = state;
  if (decision.show) void requestInterstitialAd(placement);
  return decision;
}
