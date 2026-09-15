import { useState } from "react";
import { KButton, Panel } from "../common/primitives";
import { CurrencyPill } from "../common/Indicators";
import type { ServiceOrder } from "@/game/service/ServiceManager";

/**
 * SERVICE_ORDER_COMPLETE — Phase 2's restaurant-loop completion screen.
 * A sibling of OrderComplete.tsx, not a replacement: campaign/daily/
 * endless sessions keep using OrderComplete exactly as before (§16 of
 * the Phase 2 brief — "touch existing minimally"). This screen exists
 * because the service loop needs one thing OrderComplete deliberately
 * doesn't do — an explicit SERVE action, with payment held back until
 * the player takes it (§16/§18: "do not automatically serve the order
 * immediately when preparation completes").
 *
 * Same "no stars, no percentage, no tip" law as OrderComplete — the
 * only numbers ever shown here are the flat coin payment and the
 * running credits total.
 */
export function ServiceOrderComplete({
  serviceOrder,
  credits,
  onServe,
  onNextOrder,
  onRetry,
  onExit,
}: {
  serviceOrder: ServiceOrder;
  credits: number;
  /** Returns null if the order somehow isn't READY yet (defensive — the button that calls this is only shown once RECIPE_COMPLETED has already fired). */
  onServe: () => { coinsAwarded: number; reaction: string } | null;
  /** Advances the queue (current->recent, next->current, new next) and remounts Preparation for the new current order. */
  onNextOrder: () => void;
  onRetry: () => void;
  onExit: () => void;
}) {
  const [served, setServed] = useState<{ coinsAwarded: number; reaction: string } | null>(null);
  const { customer, recipe } = serviceOrder;

  function handleServe() {
    const result = onServe();
    if (result) setServed(result);
  }

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-walnut-dark/55 backdrop-blur-[3px]">
      <Panel tone="cream" className="anim-pop w-[82%] p-6 text-center">
        <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.24em] text-copper">
          {served ? "Served" : "Order Ready"}
        </p>
        <p className="mt-1 font-display text-[24px] font-black tracking-tight text-walnut-dark">
          {recipe.name}
        </p>
        <p className="font-hand text-[18px] text-olive">
          {customer.avatarEmoji} {customer.name}
        </p>

        {served ? (
          <>
            <p className="mt-2 font-hand text-[20px] text-walnut-dark">"{served.reaction}"</p>
            {served.coinsAwarded > 0 ? (
              <p className="mt-3 font-hand text-[20px] text-olive">
                +{served.coinsAwarded} Kitchen Coins
              </p>
            ) : null}
            <div className="mt-2 flex justify-center">
              <CurrencyPill amount={credits} />
            </div>
            <div className="mt-5 space-y-2">
              <KButton full onClick={onNextOrder}>
                Next Customer
              </KButton>
              <KButton full variant="ghost" onClick={onExit}>
                Back to Kitchen
              </KButton>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 font-hand text-[16px] text-walnut/70">
              Everything's prepared — {customer.name} is waiting.
            </p>
            <div className="mt-5 space-y-2">
              <KButton full onClick={handleServe}>
                Serve to {customer.name}
              </KButton>
              <KButton full variant="cream" onClick={onRetry}>
                Prepare Again
              </KButton>
              <KButton full variant="ghost" onClick={onExit}>
                Back to Kitchen
              </KButton>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
