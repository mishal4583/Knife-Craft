import { useState } from "react";
import { KButton } from "../common/primitives";
import { formatUsd } from "@/game/money";
import type { CoverOffer } from "@/game/restaurant/serviceCover";
import { InfoTip } from "@/components/kc/common/InfoTip";

/** What App answers when the player asked for an ad (App.coverServiceWithAd). */
export type CoverAdOutcome =
  | { ok: true }
  | { ok: false; reason: "notRewarded" | "adUnavailable" | "adFailed" | "busy" | "nothingToCover" };

/**
 * The Pre-Service Check's way through when the wallet can't pay for what a
 * service is short of (from Level 3; serviceCover.ts). Display only — App
 * runs both actions.
 *
 *  - 🎬 Watch an ad: shown whenever the platform can show a rewarded ad.
 *  - 💳 Supplier credit: shown when no ad can be shown, or after the ad
 *    didn't finish or failed — so the service can always start.
 */
export function CoverActions({
  offer,
  adAvailable,
  onWatchAd,
  onCredit,
  what,
}: {
  offer: CoverOffer;
  adAvailable: boolean;
  onWatchAd: () => Promise<CoverAdOutcome>;
  onCredit: () => void;
  /** "ingredients" / "supplies", for the button text. */
  what: string;
}) {
  const [busy, setBusy] = useState(false);
  const [adFailed, setAdFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const showCredit = !adAvailable || adFailed;

  async function watch() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const outcome = await onWatchAd();
      if (!outcome.ok) {
        setAdFailed(true);
        setMessage(
          outcome.reason === "notRewarded"
            ? "🎬 The ad didn't finish · nothing arrived"
            : outcome.reason === "nothingToCover"
              ? null
              : "🎬 No ad right now · use 💳 supplier credit",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2" data-testid={`psc-cover-${offer.part}`}>
      {adAvailable ? (
        <KButton
          full
          variant="sage"
          className="h-auto min-h-12 py-2 leading-tight"
          disabled={busy}
          onClick={() => void watch()}
        >
          {busy ? "Loading ad…" : `🎬 Watch an ad · ${what} free`}
        </KButton>
      ) : null}
      {showCredit ? (
        <>
          <KButton
            full
            variant="copper"
            className="h-auto min-h-12 py-2 leading-tight"
            disabled={busy}
            onClick={onCredit}
          >
            💳 Supplier credit · {formatUsd(offer.creditCost)}
          </KButton>
          <p
            className="flex items-center gap-1.5 font-ui text-[12.5px] leading-snug text-walnut/70"
            data-testid={`psc-credit-note-${offer.part}`}
          >
            🚚 Delivered now · ↩ repaid from next earnings
            <InfoTip label="About supplier credit">
              The supplier delivers now; {formatUsd(offer.creditCost)} is paid back automatically
              from your next earnings.
            </InfoTip>
          </p>
        </>
      ) : null}
      {message ? (
        <p className="font-ui text-[12.5px] font-bold leading-snug text-copper">{message}</p>
      ) : null}
    </div>
  );
}
