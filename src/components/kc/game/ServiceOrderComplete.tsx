import { foodFromStock } from "@/game/restaurant/restaurantEconomy";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AudioManager } from "@/game/AudioManager";
import { reducedMotionOn } from "@/game/cashBurst";
import { CashVacuum } from "./CashVacuum";
import { useRolledNumber } from "./useRolledNumber";
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
import type { QualityLabel } from "@/types/game";
import {
  PERSONALITIES,
  personalityReaction,
  type PersonalityId,
} from "@/game/customers/personalities";
import { TIER_INFO, type PresentationTier } from "@/game/signatureDishes";

type ServeResult = {
  coinsAwarded: number;
  reaction: string;
  settlement?: SettlementResult | undefined;
  isReplay?: boolean;
  /** Phase 2 (C3): the customer tip credited with this payment, in cents (0 or absent: none). */
  tip?: number;
  /** Phase 2 (C2): the dish grade, from the same score its pay was computed from; the customer reaction follows it. */
  quality?: QualityLabel;
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
          <p className="text-walnut/60">🥕 Ingredients · from your stock</p>
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
 * Same "no stars, no percentage" law as OrderComplete — the only numbers
 * shown here are the coin payment and the running credits total, PLUS
 * (Economy V2 Phase 9) an optional collapsible settlement breakdown when
 * this serve actually computed one (campaign/batch-group only — plain
 * Restaurant Service never passes `settlement`, so its screen is
 * completely unchanged).
 *
 * Phase 2 (developer decision 2026-10-21) lifts this screen's old "no
 * tip" rule: a campaign order can now earn a customer tip (collected with
 * the order pay; economy/customerTips.ts has the rule), shown here
 * as its own line. It also adds the serve celebration: the payment sound
 * on the real payment, the customer reacting to the dish's grade, and the
 * payment as cash on the counter (CashVacuum). Each bill or coin is credited
 * only when physically swept into the wallet. Serve is
 * latched to one call per screen, so a double tap can never serve, pay or
 * tip twice.
 */
export function ServiceOrderComplete({
  hidden = false,
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
  personality = null,
  prep,
  plateTier = null,
  bookNote,
  onCustomerMoment,
  cashAtTable = false,
  onCollectCash,
  onCashPieceCollected,
  onCashRemaining,
  onCashCollected,
  cashRemainingOverride,
}: {
  /** Keeps the served result mounted while a temporary cash-at-table view is open. */
  hidden?: boolean;
  serviceOrder: ServiceOrder;
  credits: number;
  /** Returns null if the order somehow isn't READY yet (defensive — the button that calls this is only shown once RECIPE_COMPLETED has already fired). */
  onServe: () => ServeResult | null;
  /** Advances the queue (current->recent, next->current, new next) and remounts Preparation for the new current order — OR, for a campaign level whose `requiredOrders` this serve just satisfied, finishes the level instead (App.tsx decides which; this component just shows whichever `nextLabel` App.tsx passes). */
  onNextOrder: () => void;
  onRetry: () => void;
  onExit: () => void;
  /** Phase 3 — "Next Customer" for an open-ended service queue, (the last customer of a level completes it behind the scenes; there is no Finish Level button). */
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
  /** Phase 4 (B): this order's special customer, if any (customers/personalities.ts) — their reaction line and mood; the money is the normal settlement. */
  personality?: { id: PersonalityId; nth: number } | null;
  /** Phase 4 (B4): the Regular's measured prep time and par (cosmetic). */
  prep?: { ms: number; parMs: number };
  /** Phase 4 (A/C): this plate's presentation tier (from this run's score) — a label only. */
  plateTier?: PresentationTier | null;
  /** Phase 4 (A7): the recipe-book page this dish wrote (BookPageNote), shown before Serve — part of the card. */
  bookNote?: ReactNode;
  /** Phase 6: a special customer's reaction at Serve (for its Kitchen Moment) — once, on the real serve. */
  onCustomerMoment?: (c: { line: string; reveal?: string }) => void;
  /**
   * The dining room shows this payment as cash on the customer's table (ServiceFloor,
   * developer 2026-10-26), swept in there — the card only says it was collected.
   */
  cashAtTable?: boolean;
  /** Takes the cash left on the table into the wallet in one tap (developer 2026-10-30: no swipe screen). */
  onCollectCash?: () => void;
  /** Cash pieces move into the wallet only after a real swipe collects them. */
  onCashPieceCollected?: (cents: number, isTip: boolean) => void;
  onCashRemaining?: (cents: number) => void;
  onCashCollected?: () => void;
  cashRemainingOverride?: number;
}) {
  const [served, setServed] = useState<ServeResult | null>(null);
  const { customer, recipe } = serviceOrder;
  // Cash remains outside the wallet until each physical piece is swept in.
  const [localRemaining, setLocalRemaining] = useState(0);
  const [serveError, setServeError] = useState(false);
  const remaining = cashRemainingOverride ?? localRemaining;
  const walletRef = useRef<HTMLSpanElement | null>(null);
  const [reduced] = useState(() => reducedMotionOn());
  const shownCredits = useRolledNumber(credits, reduced);
  // One serve per screen: a second tap that lands before React re-renders
  // must not call onServe again (C1, "prevent double-clicking").
  const serveLatch = useRef(false);
  // Phase 4 (C4): the same for moving on — "Next Customer"
  // advances the queue (or finishes the level) exactly once per screen.
  const nextLatch = useRef(false);
  function nextOnce() {
    if (nextLatch.current) return;
    nextLatch.current = true;
    onNextOrder();
  }

  function handleServe() {
    if (serveLatch.current) return;
    serveLatch.current = true;
    setServeError(false);
    const result = onServe();
    if (!result) {
      setServeError(true);
      serveLatch.current = false;
      return;
    }
    const paid = result.isReplay ? 0 : result.coinsAwarded + (result.tip ?? 0);
    setLocalRemaining(paid);
    setServed(result);
    if (paid === 0) onCashCollected?.();
    if (personality) {
      const said = personalityReaction(personality, result.quality, prep);
      onCustomerMoment?.({ line: said.line, ...(said.reveal ? { reveal: said.reveal } : {}) });
    }
    // The payment sound on the payment itself (C1); the tip's own after it.
    if (paid > 0) AudioManager.playSfx("till");
    if ((result.tip ?? 0) > 0) window.setTimeout(() => AudioManager.playTip(), 320);
  }
  const tip = served && !served.isReplay ? (served.tip ?? 0) : 0;
  const paidCents = served && !served.isReplay ? served.coinsAwarded : 0;
  // Phase 4 (B9): a special customer reacts in their own words to the same
  // grade (and the Regular to his wait); everyone else as before.
  const special =
    served && personality ? personalityReaction(personality, served.quality, prep) : null;
  const reaction = special
    ? special.mood
    : served?.quality === "Masterful"
      ? "cheer"
      : served?.quality === "Clean"
        ? "nod"
        : null;
  // Phase 4 (C3): after Serve the card fills in in order — the customer's
  // reaction, then the payment, the tip, the cash — a beat apart (none with
  // Reduced Motion).
  const stage = (ms: number) => (reduced ? undefined : ({ animationDelay: `${ms}ms` } as const));

  return (
    <div
      className={`absolute inset-0 z-50 grid place-items-center bg-walnut-dark/55 backdrop-blur-[3px]${hidden ? " hidden" : ""}`}
    >
      <Panel
        tone="cream"
        className="anim-pop max-h-[calc(100%-12px)] w-[82%] land:max-w-[560px] overflow-y-auto overscroll-contain p-6 text-center [@media(max-height:640px)]:px-5 [@media(max-height:640px)]:py-4"
      >
        <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.24em] text-copper">
          {served ? "Served" : "Order Ready"}
          {/* Phase 4 (A/C): the plate's presentation tier, on the same line. */}
          {plateTier ? (
            <span data-testid="plate-tier" data-tier={plateTier}>
              {" "}
              · {TIER_INFO[plateTier].icon} {TIER_INFO[plateTier].name}
            </span>
          ) : null}
        </p>
        <p className="mt-1 font-display text-[24px] font-black leading-tight tracking-tight text-walnut-dark [@media(max-height:640px)]:text-[21px]">
          {recipe.name}
        </p>
        {/* Phase 2 (C2): the customer reacts to the dish's own grade (the
            score its pay came from) — a cheer and a clap for Masterful, a
            nod for Clean, nothing extra otherwise. Once, on serve. */}
        <p className="font-hand text-[18px] text-olive" data-testid="service-customer">
          <span
            className={
              (reaction === "cheer" ? "kc-cheer" : reaction === "nod" ? "kc-nod" : "") +
              // Phase 4 (B5/B7): the Mystery Guest is a silhouette until served; Bruno is big.
              (personality?.id === "mystery-customer" && !served ? " kc-silhouette" : "") +
              (personality?.id === "giant-eater" ? " inline-block text-[1.45em] leading-none" : "")
            }
            data-testid={personality ? "special-customer" : undefined}
            data-customer={personality?.id}
          >
            {customer.avatarEmoji}
          </span>
          {personality ? (
            <span className="ml-0.5 text-[0.8em]" aria-hidden="true">
              {PERSONALITIES[personality.id].badge}
            </span>
          ) : null}{" "}
          {customer.name}
          {reaction === "cheer" ? (
            // The clap rides inside the chip: name, avatar and chip stay on one
            // line at 320 px, so a tip line still fits on a 320×568 screen.
            <span
              className="anim-pop ml-1.5 inline-block whitespace-nowrap rounded-full bg-copper/10 px-2 py-0.5 align-middle font-ui text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-copper"
              data-testid="customer-reaction"
            >
              <span className="kc-cheer" aria-hidden="true">
                👏
              </span>{" "}
              Exceptional!
            </span>
          ) : null}
        </p>

        {served ? (
          <>
            <p
              className="kc-stage mt-2 font-hand text-[20px] leading-snug text-walnut-dark [@media(max-height:640px)]:text-[18px]"
              data-testid="customer-line"
              style={stage(0)}
            >
              {special?.reveal ? (
                <span
                  className="font-ui text-[13px] font-extrabold text-copper"
                  data-testid="mystery-reveal"
                >
                  It was {special.reveal}!{" "}
                </span>
              ) : null}
              {special ? special.line : `"${served.reaction}"`}
            </p>
            {/* Economy V2 Phase 9 §11 — a replay must read as unambiguously
                economically-zero, never inferred from coinsAwarded === 0
                (a genuine settlement can also floor at 0, rarely). */}
            {served.isReplay ? (
              <p className="mt-3 font-ui text-[12px] font-extrabold uppercase tracking-[0.16em] text-walnut/50">
                🔁 Replay · no money earned
              </p>
            ) : isBusinessOrder && served.businessPayment ? (
              <div className="mt-3">
                <BusinessPaymentLines payment={served.businessPayment} paid />
              </div>
            ) : served.coinsAwarded > 0 ? (
              <p
                className="kc-stage mt-3 font-hand text-[20px] text-olive [@media(max-height:640px)]:mt-2"
                style={stage(180)}
              >
                {formatUsdChange(served.coinsAwarded)}
              </p>
            ) : null}
            {/* Phase 2 (C3): the tip, as its own line under the order pay. */}
            {tip > 0 ? (
              <p
                className="kc-stage font-ui text-[13px] font-extrabold uppercase tracking-[0.14em] text-copper"
                data-testid="tip-line"
                style={stage(360)}
              >
                💸 Tip {formatUsdChange(tip)}
              </p>
            ) : null}
            {/* Phase 2 (B2/B3): the payment (and tip) as cash to sweep in. */}
            {paidCents + tip > 0 && cashAtTable ? (
              <p
                className="mt-2 font-ui text-[12px] font-extrabold uppercase tracking-[0.16em] text-olive"
                data-testid={remaining > 0 ? "cash-prompt" : "cash-collected"}
              >
                {remaining > 0 ? `💵 ${formatUsd(remaining)} on the table` : "✓ Cash collected"}
              </p>
            ) : paidCents + tip > 0 ? (
              <div className="kc-stage" style={stage(520)}>
                <CashVacuum
                  payCents={paidCents}
                  tipCents={tip}
                  walletRef={walletRef}
                  reducedMotion={reduced}
                  {...(onCashPieceCollected ? { onPieceCollected: onCashPieceCollected } : {})}
                  onRemaining={(cents) => {
                    setLocalRemaining(cents);
                    onCashRemaining?.(cents);
                  }}
                  {...(onCashCollected ? { onDone: onCashCollected } : {})}
                />
              </div>
            ) : null}
            <div className="mt-1 flex items-center justify-center gap-1">
              <span ref={walletRef} data-testid="wallet-pill" data-credits={credits}>
                <CurrencyPill amount={shownCredits} />
              </span>
              {remaining > 0 && !cashAtTable ? (
                <span className="font-hand text-[14px] text-olive">
                  Swipe the cash to collect it
                </span>
              ) : null}
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
                ✓ Today's customers are complete. 🌙 End the day when ready.
              </p>
            ) : null}
            <div className="mt-5 space-y-2 [@media(max-height:640px)]:mt-3">
              {cashAtTable && remaining > 0 && onCollectCash ? (
                <KButton full variant="sage" onClick={onCollectCash}>
                  💵 Collect cash
                </KButton>
              ) : null}
              {isBusinessOrder && served.businessCustomers?.complete ? null : (
                <KButton full onClick={nextOnce}>
                  {nextLabel}
                </KButton>
              )}
              {extraAction ? (
                <KButton
                  full
                  variant="sage"
                  className="h-auto min-h-12 py-2 leading-tight [@media(max-height:640px)]:text-[12.5px]"
                  disabled={!!extraAction.disabled}
                  onClick={extraAction.onClick}
                >
                  {extraAction.label}
                </KButton>
              ) : null}
              <KButton full variant="ghost" onClick={onExit}>
                {isBusinessOrder ? "Back to Service" : "Back to Kitchen"}
              </KButton>
            </div>
          </>
        ) : (
          <>
            {bookNote}
            <p className="mt-2 font-hand text-[17px] text-walnut/70">
              Everything's prepared — {customer.name} is waiting.
            </p>
            {serveError ? (
              <p role="alert" className="mt-2 font-ui text-[13px] font-bold text-red-700">
                Couldn’t serve this order. Check the required ingredients in Market and try again.
              </p>
            ) : null}
            <div className="mt-5 space-y-2">
              <KButton full variant="green" size="lg" onClick={handleServe}>
                Serve to {customer.name}
              </KButton>
              <KButton full variant="cream" onClick={onRetry}>
                Prepare Again
              </KButton>
              <KButton full variant="ghost" onClick={onExit}>
                {isBusinessOrder ? "Back to Service" : "Back to Kitchen"}
              </KButton>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
