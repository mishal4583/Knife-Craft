/**
 * INTERSTITIAL_POLICY — the one gate every interstitial passes through.
 *
 * Called only from explicit player actions at natural break points (never
 * from render or an effect), each with a stable `transitionId` naming that
 * one transition (e.g. "level-finish:level-12:<session>"). Rules:
 *  - never before the player has completed INTERSTITIAL_MIN_COMPLETED_LEVELS
 *    campaign levels;
 *  - at most one ad every INTERSTITIAL_EVERY_N_TRANSITIONS eligible transitions;
 *  - at least INTERSTITIAL_COOLDOWN_MS since the last ad of ANY kind settled
 *    (so never straight after a rewarded ad), and never while one is active;
 *  - a transitionId is handled at most once, so a re-render, a repeated
 *    click or navigating back and forth can't request the same ad twice.
 * State is per session, in memory — nothing is saved. A missing, failed or
 * unshown ad changes nothing: the caller has already moved on.
 */
import {
  interstitialAdsAvailable,
  isAdActive,
  lastAdSettledTime,
  requestInterstitialAd,
} from "../PlayablesSDK";

export const INTERSTITIAL_MIN_COMPLETED_LEVELS = 10;
export const INTERSTITIAL_EVERY_N_TRANSITIONS = 3;
export const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000;

export type InterstitialPolicyState = {
  /** Eligible transitions counted since the last ad (or session start). */
  transitionsSinceAd: number;
  /** transitionIds already handled this session. */
  handled: Set<string>;
};

export type InterstitialDecision =
  | { show: true }
  | {
      show: false;
      reason: "duplicate" | "tooEarly" | "frequency" | "cooldown" | "adActive" | "unavailable";
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
  const no = (
    reason: Exclude<InterstitialDecision, { show: true }>["reason"],
    counted: boolean,
  ) => ({
    decision: { show: false as const, reason },
    state: { handled, transitionsSinceAd: state.transitionsSinceAd + (counted ? 1 : 0) },
  });
  if (!input.available) return no("unavailable", false);
  // The first levels are the player's first impression: no ads, and they don't count.
  if (input.completedLevels < INTERSTITIAL_MIN_COMPLETED_LEVELS) return no("tooEarly", false);
  const count = state.transitionsSinceAd + 1;
  if (count < INTERSTITIAL_EVERY_N_TRANSITIONS) return no("frequency", true);
  if (input.adActive) return no("adActive", true);
  if (input.lastAdSettledAt > 0 && input.now - input.lastAdSettledAt < INTERSTITIAL_COOLDOWN_MS) {
    return no("cooldown", true);
  }
  return { decision: { show: true }, state: { handled, transitionsSinceAd: 0 } };
}

let policyState: InterstitialPolicyState = { transitionsSinceAd: 0, handled: new Set() };

/**
 * Records one natural transition and, if the policy allows, asks YouTube
 * for an interstitial. Fire-and-forget: never awaited by navigation, never
 * throws, returns the decision for QA.
 */
export function maybeShowInterstitial(
  transitionId: string,
  completedLevels: number,
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
  if (decision.show) void requestInterstitialAd();
  return decision;
}
