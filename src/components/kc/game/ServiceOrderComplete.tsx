import { foodFromStock } from "@/game/restaurant/restaurantEconomy";
import { useState } from "react";
import { KButton, Panel } from "../common/primitives";
import { CurrencyPill } from "../common/Indicators";
import { BusinessPaymentLines } from "../business/BusinessPaymentLines";
import type {
  BusinessCustomerPayment,
  BusinessCustomersToday,
} from "@/game/business/BusinessServiceManager";
import { formatUsd, formatUsdChange } from "@/game/money";
import type { ServiceOrder } from "@/game/service/ServiceManager";
import type { SettlementResult } from "@/game/economy/economyTypes";
import type { KnifeDefinition } from "@/game/knives/knifeTypes";
import type { BoardDefinition } from "@/game/boards/boardTypes";
import { getSupplier } from "@/game/economy/supplierDefinitions";
import { STAFF_CATALOG } from "@/game/economy/staffDefinitions";

type ServeResult = {
  coinsAwarded: number;
  reaction: string;
  settlement?: SettlementResult | undefined;
  isReplay?: boolean;
  /** Business Mode only — the menu price × willingness-to-pay breakdown behind `coinsAwarded` (Economy V3 Phase 16). */
  businessPayment?: BusinessCustomerPayment;
  /** Business Mode only — today's customer count after this serve (order frequency, Economy V3 Phase 16). */
  businessCustomers?: BusinessCustomersToday;
};

/**
 * Economy V2 Phase 9 — a small, collapsible breakdown of a genuine
 * (non-replay) settlement, built ENTIRELY from `SettlementResult`'s own
 * already-computed fields (EconomySettlement.ts is the single source of
 * truth — see that module's own doc) plus static catalog lookups for
 * display names (supplier/staff — the exact same pattern Shop.tsx
 * already uses for its own catalog rows). No formula, cap, or magnitude
 * is recalculated here.
 */
function SettlementBreakdown({
  settlement,
  knife,
  board,
  selectedSupplierId,
  ownedStaffIds,
  knifeSharpnessValue,
}: {
  settlement: SettlementResult;
  knife?: KnifeDefinition;
  board?: BoardDefinition;
  selectedSupplierId?: string;
  ownedStaffIds?: readonly string[];
  knifeSharpnessValue?: number;
}) {
  const supplier = selectedSupplierId ? getSupplier(selectedSupplierId) : undefined;
  const staffNames = (ownedStaffIds ?? [])
    .map((id) => STAFF_CATALOG.find((s) => s.id === id)?.name)
    .filter((n): n is string => !!n);

  return (
    <details className="mt-3 text-left">
      <summary className="cursor-pointer text-center font-ui text-[12px] font-extrabold uppercase tracking-[0.16em] text-copper">
        Settlement Breakdown
      </summary>
      <div className="mt-2 space-y-1.5 rounded-[14px] bg-cream/70 p-3 font-ui text-[12.5px] font-bold text-walnut/80">
        <Row label="Recipe Earnings" value={settlement.revenue} />
        <Row label="Quality Bonus" value={settlement.qualityBonus} />
        <div className="my-1 h-px bg-walnut/10" />
        {foodFromStock(settlement) ? (
          // Unified Restaurant: the ingredients came from your own stock, paid in the Market.
          <p className="text-walnut/60">Ingredients · from your stock (paid in the Market)</p>
        ) : (
          <Row label="Ingredient COGS" value={-settlement.finalCOGS} />
        )}
        {supplier ? (
          <Row label={`Supplier · ${supplier.name}`} value={settlement.supplierCOGSAdjustment} />
        ) : null}
        {settlement.equipmentCOGSSavings > 0 ? (
          <Row
            label={`Equipment · ${[knife?.name, board?.name].filter(Boolean).join(" / ")}`}
            value={settlement.equipmentCOGSSavings}
          />
        ) : null}
        {settlement.sharpnessCOGSPenalty !== 0 ? (
          <Row
            label={`Sharpness${knifeSharpnessValue !== undefined ? ` · ${Math.round(knifeSharpnessValue)}/100` : ""}`}
            value={-settlement.sharpnessCOGSPenalty}
          />
        ) : null}
        {settlement.staffCOGSSavings > 0 && staffNames.length > 0 ? (
          <Row label={`Staff · ${staffNames.join(", ")}`} value={settlement.staffCOGSSavings} />
        ) : null}
        <div className="my-1 h-px bg-walnut/10" />
        <Row label="Net Result" value={settlement.netResult} strong />
      </div>
    </details>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between text-walnut-dark" : "flex justify-between"}>
      <span className="truncate pr-2">{label}</span>
      <span className={value < 0 ? "text-copper" : "text-olive"}>{formatUsdChange(value)}</span>
    </div>
  );
}

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
 * running credits total, PLUS (Economy V2 Phase 9) an optional
 * collapsible settlement breakdown when this serve actually computed
 * one (campaign/batch-group only — plain Restaurant Service never
 * passes `settlement`, so its screen is completely unchanged).
 */
export function ServiceOrderComplete({
  serviceOrder,
  credits,
  onServe,
  onNextOrder,
  onRetry,
  onExit,
  nextLabel = "Next Customer",
  knife,
  board,
  selectedSupplierId,
  ownedStaffIds,
  knifeSharpnessValue,
  isBusinessOrder = false,
  extraAction,
}: {
  serviceOrder: ServiceOrder;
  credits: number;
  /** Returns null if the order somehow isn't READY yet (defensive — the button that calls this is only shown once RECIPE_COMPLETED has already fired). */
  onServe: () => ServeResult | null;
  /** Advances the queue (current->recent, next->current, new next) and remounts Preparation for the new current order — OR, for a campaign level whose `requiredOrders` this serve just satisfied, finishes the level instead (App.tsx decides which; this component just shows whichever `nextLabel` App.tsx passes). */
  onNextOrder: () => void;
  onRetry: () => void;
  onExit: () => void;
  /** Phase 3 — "Next Customer" for an open-ended service queue, or "Finish Level" for a campaign level session that's about to complete. */
  nextLabel?: string;
  /** Economy V2 Phase 9 — display-only context for SettlementBreakdown, all optional (absent entirely for plain Restaurant Service). */
  knife?: KnifeDefinition;
  board?: BoardDefinition;
  selectedSupplierId?: string;
  ownedStaffIds?: readonly string[];
  knifeSharpnessValue?: number;
  /** Economy V3 Phase 14, Checkpoint 3 — additive, defaults to false so every existing caller (plain Restaurant Service, campaign-service, batch-group) renders byte-identical to before. When true, shows the payment/running-total in real USD (`formatUsd`/`BusinessCash`) instead of "Kitchen Coins"/`CurrencyPill` — a Business order's `coinsAwarded` is already real US cents (what the customer paid: menu price × the popularity modifier), never KnifeCraft's coin currency. */
  isBusinessOrder?: boolean;
  /** Unified Restaurant: an optional second action after a serve (a menu guest). Absent everywhere else. */
  extraAction?: { label: string; onClick: () => void; disabled?: boolean } | undefined;
}) {
  const [served, setServed] = useState<ServeResult | null>(null);
  const { customer, recipe } = serviceOrder;

  function handleServe() {
    const result = onServe();
    if (result) setServed(result);
  }

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-walnut-dark/55 backdrop-blur-[3px]">
      <Panel tone="cream" className="anim-pop w-[82%] p-6 text-center">
        <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.24em] text-copper">
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
            {/* Economy V2 Phase 9 §11 — a replay must read as unambiguously
                economically-zero, never inferred from coinsAwarded === 0
                (a genuine settlement can also floor at 0, rarely). */}
            {served.isReplay ? (
              <p className="mt-3 font-ui text-[12px] font-extrabold uppercase tracking-[0.16em] text-walnut/50">
                Replay — no money earned, no campaign economy progress
              </p>
            ) : isBusinessOrder && served.businessPayment ? (
              <div className="mt-3">
                <BusinessPaymentLines payment={served.businessPayment} paid />
              </div>
            ) : served.coinsAwarded > 0 ? (
              <p className="mt-3 font-hand text-[20px] text-olive">
                {formatUsdChange(served.coinsAwarded)}
              </p>
            ) : null}
            <div className="mt-2 flex justify-center">
              <CurrencyPill amount={credits} />
            </div>
            {served.settlement ? (
              <SettlementBreakdown
                settlement={served.settlement}
                {...(knife ? { knife } : {})}
                {...(board ? { board } : {})}
                {...(selectedSupplierId !== undefined ? { selectedSupplierId } : {})}
                {...(ownedStaffIds ? { ownedStaffIds } : {})}
                {...(knifeSharpnessValue !== undefined ? { knifeSharpnessValue } : {})}
              />
            ) : null}
            {isBusinessOrder && served.businessCustomers ? (
              <p className="mt-3 font-ui text-[12px] font-bold uppercase tracking-[0.14em] text-walnut/60">
                Customers today {served.businessCustomers.served} /{" "}
                {served.businessCustomers.target} served
              </p>
            ) : null}
            {isBusinessOrder && served.businessCustomers?.complete ? (
              <p className="mt-1 font-hand text-[16px] leading-snug text-walnut/70">
                Today's customers are complete. No more customers will arrive today.
              </p>
            ) : null}
            <div className="mt-5 space-y-2">
              {isBusinessOrder && served.businessCustomers?.complete ? null : (
                <KButton full onClick={onNextOrder}>
                  {nextLabel}
                </KButton>
              )}
              {extraAction ? (
                <KButton
                  full
                  variant="sage"
                  className="h-auto min-h-12 py-2 leading-tight"
                  disabled={!!extraAction.disabled}
                  onClick={extraAction.onClick}
                >
                  {extraAction.label}
                </KButton>
              ) : null}
              <KButton full variant="ghost" onClick={onExit}>
                {isBusinessOrder ? "Back to Service" : "Back to Orders"}
              </KButton>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 font-hand text-[17px] text-walnut/70">
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
                {isBusinessOrder ? "Back to Service" : "Back to Orders"}
              </KButton>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
