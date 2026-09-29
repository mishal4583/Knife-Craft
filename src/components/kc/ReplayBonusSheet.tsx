import { KButton, Modal } from "./common/primitives";
import { formatUsd, formatUsdChange } from "@/game/money";
import type { ReplayBonusFailure, ReplayBonusPhase } from "@/game/ads/replayBonus";

/**
 * The Replay Bonus offer after a replayed Campaign level. Display only:
 * App.tsx runs the ad/commit flow. "Reward Granted" is shown ONLY when
 * `claimed` is true — and `claimed` is read from the save's ledger
 * (isReplayBonusClaimed), never from "the ad closed".
 */
export function ReplayBonusSheet({
  amount,
  phase,
  failure,
  claimed,
  leftToday,
  canClose,
  onWatch,
  onClose,
}: {
  amount: number;
  phase: ReplayBonusPhase;
  failure: ReplayBonusFailure | null;
  claimed: boolean;
  leftToday: number;
  /** False only while an ad is on screen. */
  canClose: boolean;
  onWatch: () => void;
  onClose: () => void;
}) {
  const busy = phase === "REQUESTING_AD" || phase === "REWARD_COMMITTING";
  return (
    <Modal open onClose={onClose}>
      {claimed ? (
        <div className="text-center" data-testid="replay-bonus-granted">
          <p className="text-[36px] leading-none">🎉</p>
          <p className="mt-2 font-display text-[22px] font-black text-walnut-dark">
            Reward Granted! {formatUsdChange(amount)}
          </p>
          <p className="mt-1 font-hand text-[16px] text-walnut/70">
            Your Replay Bonus is in your wallet.
          </p>
          <div className="mt-4">
            <KButton full onClick={onClose}>
              Continue
            </KButton>
          </div>
        </div>
      ) : (
        <div className="text-center" data-testid="replay-bonus-offer">
          <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
            Level replayed
          </p>
          <p className="mt-1 font-display text-[20px] font-black leading-tight text-walnut-dark">
            Replay Bonus · {formatUsd(amount)}
          </p>
          <p className="mt-1 font-hand text-[15px] leading-snug text-walnut/70">
            Replays don't pay — but you can watch a short ad to earn a bonus for this one.
          </p>
          {phase === "REQUESTING_AD" && canClose ? (
            <p className="mt-3 rounded-[12px] bg-walnut/8 px-3 py-2 font-ui text-[12px] font-bold text-walnut/80">
              Still waiting for the ad. You can keep playing — if the ad finishes, your bonus is
              added automatically.
            </p>
          ) : null}
          {phase === "FAILED" && failure ? (
            <p
              className="mt-3 rounded-[12px] bg-walnut/8 px-3 py-2 font-ui text-[12px] font-bold text-walnut/80"
              data-testid="replay-bonus-failed"
            >
              {failureMessage(failure)}
            </p>
          ) : null}
          <div className="mt-4 space-y-2">
            {failure === "dailyCapReached" || failure === "alreadyClaimed" ? null : (
              <KButton full disabled={busy} onClick={onWatch}>
                {phase === "REQUESTING_AD"
                  ? "Waiting for the ad…"
                  : phase === "REWARD_COMMITTING"
                    ? "Adding your bonus…"
                    : "Watch Ad → Earn Replay Bonus"}
              </KButton>
            )}
            <KButton full variant="ghost" disabled={!canClose} onClick={onClose}>
              {busy ? "Keep playing" : "No thanks"}
            </KButton>
          </div>
          <p className="mt-2 font-ui text-[10px] font-bold text-walnut/50">
            {leftToday} Replay Bonus{leftToday === 1 ? "" : "es"} left today
          </p>
        </div>
      )}
    </Modal>
  );
}

function failureMessage(failure: ReplayBonusFailure): string {
  switch (failure) {
    case "notRewarded":
      return "The ad didn't finish, so no reward was granted. You can try again.";
    case "dailyCapReached":
      return "You've used today's Replay Bonuses. Come back tomorrow!";
    case "alreadyClaimed":
      return "This Replay Bonus was already added to your wallet.";
    case "saveFailed":
      return "Your bonus couldn't be saved, so no reward was granted. Try again later.";
    case "busy":
    case "adUnavailable":
    case "adFailed":
    case "commitMismatch":
      return "Ad unavailable. No reward was granted. Try again later.";
  }
}

/** Covers the whole game while a platform ad is in flight, so no tap reaches anything underneath. */
export function AdPlayingShield() {
  return (
    <div
      className="absolute inset-0 z-[60] bg-walnut-dark/30"
      aria-hidden
      data-testid="ad-shield"
      onPointerDownCapture={(e) => e.stopPropagation()}
    />
  );
}
