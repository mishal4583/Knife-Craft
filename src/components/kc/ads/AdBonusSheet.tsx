import { useRef } from "react";
import { KButton, Modal } from "../common/primitives";
import { formatUsd, formatUsdChange } from "@/game/money";
import type { AdBonusKind } from "@/game/ads/adBonuses";

/** Where the sheet is in its flow (App.tsx runs it; this only shows it). */
export type AdBonusPhase = "offer" | "waiting" | "done" | "failed";

/** One ad-bonus sheet's state, held by App. */
export type AdBonusSheetState = {
  kind: AdBonusKind;
  /** What the ad pays (cents); 0 when only the free gift is on offer (no ads). */
  amount: number;
  /** The daily gift's free part (cents). */
  free?: number;
  /** What the "Short by" offer is for. */
  item?: string;
  phase: AdBonusPhase;
  /** What landed in the wallet, once done. */
  granted?: number;
  failure?: "notRewarded" | "unavailable" | "capReached";
};

/** A tap that lands within this time of the sheet opening is ignored (never an ad by accident). */
export const ARM_MS = 600;

const COPY: Record<AdBonusKind, { icon: string; kicker: string; line: string }> = {
  floating_cash: { icon: "💰", kicker: "Found cash", line: "Watch a short ad to keep it" },
  level_double: { icon: "🎉", kicker: "Level bonus", line: "+50% on this level's reward" },
  shortfall: { icon: "🛒", kicker: "Almost there", line: "Get what you're missing" },
  floor_double: { icon: "🏬", kicker: "Second Floor ×2", line: "Collect it twice" },
  daily_gift: { icon: "🎁", kicker: "Daily gift", line: "A little something for today" },
};

/**
 * The one sheet for every ad bonus (ads/adBonuses.ts): it says what the ad
 * gives BEFORE the ad, the player chooses, and "added" shows only once App
 * has committed the reward. Closable unless an ad is on screen.
 */
export function AdBonusSheet({
  state,
  canClose,
  onWatch,
  onTakeFree,
  onClose,
}: {
  state: AdBonusSheetState;
  canClose: boolean;
  onWatch: () => void;
  /** The daily gift's free "Take" button. */
  onTakeFree?: () => void;
  onClose: () => void;
}) {
  const openedAt = useRef(performance.now());
  const armed = (fn: () => void) => () => {
    if (performance.now() - openedAt.current < ARM_MS) return;
    fn();
  };
  const copy = COPY[state.kind];
  const busy = state.phase === "waiting";
  const headline =
    state.kind === "daily_gift"
      ? formatUsd(state.free ?? 0)
      : state.kind === "shortfall"
        ? `Short by ${formatUsd(state.amount)}`
        : formatUsdChange(state.amount);
  return (
    <Modal open onClose={canClose ? onClose : () => {}}>
      {state.phase === "done" ? (
        <div className="text-center" data-testid="ad-bonus-done" data-ad-bonus={state.kind}>
          <p className="text-[36px] leading-none">🎉</p>
          <p className="mt-2 font-display text-[22px] font-black text-walnut-dark">
            {formatUsdChange(state.granted ?? 0)} added
          </p>
          <div className="mt-4">
            <KButton full onClick={onClose}>
              Continue
            </KButton>
          </div>
        </div>
      ) : (
        <div className="text-center" data-testid="ad-bonus-sheet" data-ad-bonus={state.kind}>
          <p className="text-[34px] leading-none" aria-hidden>
            {copy.icon}
          </p>
          <p className="mt-1 font-ui text-[11px] font-extrabold uppercase tracking-[0.2em] text-copper">
            {copy.kicker}
          </p>
          <p className="mt-1 font-display text-[22px] font-black leading-tight text-walnut-dark">
            {headline}
          </p>
          <p className="mt-1 font-hand text-[16px] leading-snug text-walnut/70">
            {state.item ? `${state.item} · ` : ""}
            {copy.line}
          </p>
          {state.phase === "failed" ? (
            <p
              className="mt-3 rounded-[12px] bg-walnut/8 px-3 py-2 font-ui text-[12.5px] font-bold text-walnut/80"
              data-testid="ad-bonus-failed"
            >
              {state.failure === "notRewarded"
                ? "🎬 The ad didn't finish · nothing added"
                : state.failure === "capReached"
                  ? "That's all for today · back tomorrow"
                  : "Ad unavailable · nothing added"}
            </p>
          ) : null}
          <div className="mt-4 space-y-2">
            {state.kind === "daily_gift" && onTakeFree ? (
              <KButton full variant="sage" disabled={busy} onClick={armed(onTakeFree)}>
                {`Take ${formatUsd(state.free ?? 0)}`}
              </KButton>
            ) : null}
            {state.amount > 0 && state.failure !== "capReached" ? (
              <KButton full disabled={busy} onClick={armed(onWatch)}>
                {busy
                  ? "Waiting for the ad…"
                  : state.kind === "daily_gift"
                    ? `📺 Watch · take ${formatUsd((state.free ?? 0) + state.amount)}`
                    : `📺 Watch · +${formatUsd(state.amount)}`}
              </KButton>
            ) : null}
            <KButton full variant="ghost" disabled={!canClose} onClick={onClose}>
              {busy ? "Keep playing" : state.kind === "daily_gift" ? "Later" : "No thanks"}
            </KButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
