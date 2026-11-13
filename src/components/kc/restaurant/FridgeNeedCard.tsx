import { useState } from "react";
import { KButton } from "../common/primitives";
import { InfoTip } from "@/components/kc/common/InfoTip";
import { formatUsd } from "@/game/money";
import type { FridgeNeed } from "@/game/restaurant/fridgeUpgradeNeed";
import type { CoverAdOutcome } from "./CoverActions";

/**
 * The Pre-Service Check's "bigger fridge" card (restaurant/fridgeUpgradeNeed.ts, developer 2026-11-13). Display only; App buys.
 *
 *  - the wallet covers it: one Buy button (the purchase is required when `need.required`);
 *  - short by no more than the ad's discount: "Watch · 25% off", saying the price before the ad;
 *  - else: how much is missing, and the way to the fridge screen.
 */
export function FridgeNeedCard({
  need,
  adAvailable,
  onBuy,
  onBuyWithAd,
  onManage,
}: {
  need: FridgeNeed;
  adAvailable: boolean;
  onBuy: () => boolean;
  onBuyWithAd: () => Promise<CoverAdOutcome>;
  onManage: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const adPrice = need.price - need.adDiscount;
  const adOffer = need.adDiscount > 0 && adAvailable;

  async function watch() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const outcome = await onBuyWithAd();
      if (!outcome.ok && outcome.reason !== "nothingToCover")
        setMessage(
          outcome.reason === "notRewarded"
            ? "🎬 The ad didn't finish · no discount"
            : "🎬 No ad right now · try again later",
        );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mb-2 rounded-2xl border border-tomato/30 bg-tomato/10 p-3"
      id="psc-fridge-need"
      data-testid="psc-fridge-need"
      data-reason={need.reason}
      data-required={need.required ? "1" : "0"}
    >
      <p className="flex items-center gap-1.5 font-ui text-[13.5px] font-extrabold text-walnut-dark">
        ❄️ {need.required ? "Bigger fridge needed" : "Fridge too small"}
        <InfoTip label="Why a bigger fridge">
          {need.reason === "full"
            ? `Today's food needs ${need.needUnits} units and only ${need.roomLeft} are free.`
            : `A service coming up needs ${need.needUnits} units and only about ${need.roomLeft} will be free.`}{" "}
          The {need.fridge.name} holds {need.fridge.capacity} (yours holds {need.capacity}). Bought
          once, it stays.
        </InfoTip>
      </p>
      <p className="font-ui text-[12.5px] text-walnut/70">
        {need.fridge.name} · {need.capacity} → {need.fridge.capacity} units
      </p>
      {need.canPay ? (
        <KButton
          full
          variant="copper"
          className="mt-2 h-auto min-h-12 py-2 leading-tight"
          data-testid="psc-fridge-buy"
          onClick={() => {
            if (!onBuy()) setMessage("Could not buy it · open the fridge screen");
          }}
        >
          Buy · {formatUsd(need.price)}
        </KButton>
      ) : (
        <>
          <p className="mt-1 font-ui text-[12.5px] font-bold text-tomato">
            {formatUsd(need.price)} · {formatUsd(need.shortBy)} short
          </p>
          {adOffer ? (
            <KButton
              full
              variant="sage"
              className="mt-2 h-auto min-h-12 py-2 leading-tight"
              data-testid="psc-fridge-ad"
              disabled={busy}
              onClick={() => void watch()}
            >
              {busy ? "Loading ad…" : `🎬 Watch · 25% off · ${formatUsd(adPrice)}`}
            </KButton>
          ) : null}
          <KButton size="sm" variant="ghost" className="mt-2 min-h-12" onClick={onManage}>
            See fridges →
          </KButton>
        </>
      )}
      {message ? (
        <p className="mt-1 font-ui text-[12.5px] font-bold leading-snug text-copper">{message}</p>
      ) : null}
    </div>
  );
}
