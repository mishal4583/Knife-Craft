import { useState } from "react";
import { KButton } from "../common/primitives";
import { formatUsd } from "@/game/money";
import type { SaveData } from "@/game/SaveManager";
import type { ScreenId } from "../data";
import type { BusinessDish } from "@/game/business/businessDishCatalog";
import {
  RUSH_RESTOCK_FEE,
  type RushRestockOutcome,
  type RushRestockPayment,
} from "@/game/business/businessRushRestock";
import { rushRestockPlan } from "@/game/business/BusinessInventoryManager";

/**
 * Rush Restock buttons for a blocked order — shown wherever a blocked
 * order is (the Operations "What needs attention" card and the Service
 * screen). Display only: the prices come from `rushRestockPlan`, the
 * action runs in App.tsx (`rushRestockCurrentOrder`). The ad option only
 * appears when the platform can show a rewarded ad.
 */
export function RushRestockActions({
  save,
  dish,
  go,
  rushRestock,
  rushAdAvailable,
}: {
  save: SaveData;
  dish: BusinessDish;
  go: (s: ScreenId) => void;
  rushRestock: (payment: RushRestockPayment) => Promise<RushRestockOutcome>;
  rushAdAvailable: boolean;
}) {
  const [busy, setBusy] = useState<RushRestockPayment | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const planned = rushRestockPlan(save, dish);
  const market = (
    <KButton full variant="ghost" onClick={() => go("business-inventory")}>
      Go to Market →
    </KButton>
  );
  if (!planned.ok) {
    return (
      <div className="mt-2 space-y-2">
        {planned.reason === "exceedsShortageLimit" ? (
          <p className="font-hand text-[13px] leading-snug text-copper">
            Today's supplier shortage limits purchases — buy what you can in the Market.
          </p>
        ) : null}
        {market}
      </div>
    );
  }
  const { plan } = planned;
  const canAfford = save.credits >= plan.cashCost;

  async function run(payment: RushRestockPayment) {
    if (busy) return;
    setBusy(payment);
    setMessage(null);
    try {
      const outcome = await rushRestock(payment);
      setMessage(outcomeMessage(outcome));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <KButton
        full
        variant="copper"
        disabled={!canAfford || !!busy}
        onClick={() => void run("cash")}
      >
        ⚡ Rush Restock · {formatUsd(plan.cashCost)}
      </KButton>
      {rushAdAvailable ? (
        <KButton full variant="sage" disabled={!!busy} onClick={() => void run("ad")}>
          {busy === "ad" ? "Loading ad…" : "🎬 Watch Ad · Restock Free"}
        </KButton>
      ) : null}
      <p className="text-center font-hand text-[13px] leading-snug text-walnut/65">
        {canAfford
          ? `Market price ${formatUsd(plan.marketCost)} + ${Math.round(RUSH_RESTOCK_FEE * 100)}% rush fee — buys only what this order needs.`
          : `Rush Restock costs ${formatUsd(plan.cashCost)} — you have ${formatUsd(save.credits)}.`}
      </p>
      {message ? (
        <p className="text-center font-hand text-[14px] leading-snug text-copper">{message}</p>
      ) : null}
      {market}
    </div>
  );
}

function outcomeMessage(outcome: RushRestockOutcome): string | null {
  if (outcome.ok) return null; // the order unblocks; the card goes away
  switch (outcome.reason) {
    case "insufficientFunds":
      return "Not enough cash for a Rush Restock.";
    case "insufficientStorage":
      return "Your refrigerator is full — make room or upgrade it first.";
    case "exceedsShortageLimit":
      return "Today's supplier shortage limits purchases — try the Market.";
    case "wouldNotUnblock":
      return "Old stock of this ingredient has expired, so a restock wouldn't free this order. It's cleared at End Business Day.";
    case "notRewarded":
      return "The ad didn't finish, so nothing was restocked. You can try again.";
    case "busy":
    case "adUnavailable":
    case "adFailed":
      return "Ad unavailable right now. Nothing was restocked.";
    case "notBlocked":
    case "orderChanged":
      return null;
  }
}
