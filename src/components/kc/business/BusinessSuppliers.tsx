import { useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, Badge } from "../common/primitives";
import { Bar, Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/business/businessCurrency";
import { getSupplier } from "@/game/economy/supplierDefinitions";
import { getAllContractOffers, isContractActive } from "@/game/business/businessSupplierContract";
import type {
  SignContractResult,
  CancelContractResult,
} from "@/game/business/BusinessSupplierManager";
import { supplierMarketToday, supplierEventSummary } from "@/game/business/businessAlerts";
import { SUPPLIER_EVENT_CATALOG } from "@/game/business/businessSupplierEvents";
import { getAvailableStorageCapacity } from "@/game/business/RefrigeratorManager";
import { formatQuantity } from "@/game/business/businessInventory";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { IngredientSupplier } from "../restaurant/IngredientSupplier";

const SUPPLIER_ICON: Record<string, string> = {
  "local-market": "🏪",
  "premium-supplier": "🧺",
  "wholesale-supplier": "🚚",
};

function pct(fraction: number, signed = false): string {
  const v = Math.round(fraction * 100);
  return signed && v > 0 ? `+${v}%` : v === 0 && signed ? "±0%" : `${v}%`;
}

/**
 * BUSINESS · SUPPLIERS tab (Economy V3 Phases 7–8). Contract terms only from
 * `getAllContractOffers` / `isContractActive`, today's prices and event only
 * from `supplierMarketToday` — never recomputed. Delivery time and quality
 * are stored contract details that no game system uses yet, so they're shown
 * "for reference" rather than as effects.
 */
export function BusinessSuppliers({
  save,
  signSupplierContract,
  cancelSupplierContract,
  selectSupplier,
}: {
  save: SaveData;
  signSupplierContract: (supplierId: string) => SignContractResult;
  cancelSupplierContract: () => CancelContractResult;
  /** Restaurant build: the ingredient supplier lives here (phase 7), not in the Market. */
  selectSupplier?: (id: string) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const currentDay = save.business.calendar.businessDay;
  const contract = save.business.supplierContract;
  const active = isContractActive(contract, currentDay);
  const market = supplierMarketToday(save);
  const freeStorage = getAvailableStorageCapacity(
    save.business.inventory,
    save.business.refrigerator.refrigeratorId,
  );
  const offers = getAllContractOffers();
  const maxDiscount = Math.max(...offers.map((o) => o.terms.discount));

  function handleSign(supplierId: string) {
    const result = signSupplierContract(supplierId);
    if (!result.ok) {
      setMessage(
        result.reason === "contractAlreadyActive"
          ? "You already have an active contract."
          : "That contract couldn't be signed.",
      );
      return;
    }
    setMessage(`Signed with ${getSupplier(result.supplierId)?.name ?? result.supplierId}.`);
  }

  function handleCancel() {
    const result = cancelSupplierContract();
    if (!result.ok) {
      setMessage(
        result.reason === "insufficientFunds"
          ? "Not quite enough cash to pay the cancellation fee."
          : "There's no active contract to cancel.",
      );
      return;
    }
    setMessage(
      result.fee > 0
        ? `Contract cancelled for a ${formatUsd(result.fee)} fee.`
        : "Contract cancelled.",
    );
  }

  return (
    <div className="space-y-3">
      {RESTAURANT_MODE && selectSupplier ? (
        <IngredientSupplier save={save} selectSupplier={selectSupplier} />
      ) : null}
      {/* Today's supplier conditions */}
      <Panel className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <Eyebrow>🌤️ Today's supplier conditions</Eyebrow>
          <span className="font-ui text-[12px] font-bold text-walnut/60">Day {currentDay}</span>
        </div>
        {market.event ? (
          <div className="mt-2 rounded-[14px] border border-gold/40 bg-gold/15 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-[16.5px] font-black text-walnut-dark">
                {market.event.name}
              </p>
              <Badge tone={market.event.priceModifier > 0 ? "copper" : "sage"}>
                {market.event.priceModifier === 0
                  ? "prices normal"
                  : pct(market.event.priceModifier, true)}
              </Badge>
            </div>
            <p className="mt-0.5 font-hand text-[15px] leading-snug text-walnut/70">
              {supplierEventSummary(market.event, active)}
              {market.event.maxPurchaseQuantity !== undefined
                ? ` Max ${market.event.maxPurchaseQuantity} per purchase.`
                : ""}
            </p>
          </div>
        ) : (
          <p className="mt-1.5 font-display text-[15.5px] font-black text-walnut-dark">
            ☀️ A quiet day — normal prices
          </p>
        )}
        <p className="mt-2 font-hand text-[14px] text-walnut/60">
          A {formatUsd(market.referenceBasePrice)} ingredient costs{" "}
          <b>{formatUsd(market.referencePriceToday)}</b> today before any contract discount.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Possible supplier events">
          {Object.values(SUPPLIER_EVENT_CATALOG).map((e) => (
            <span
              key={e.id}
              className={cn(
                "rounded-full border px-2 py-[3px] font-ui text-[11px] font-extrabold",
                market.event?.id === e.id
                  ? "border-copper/50 bg-gold/25 text-walnut-dark"
                  : "border-walnut/15 bg-cream/60 text-walnut/55",
              )}
            >
              {e.name}
              {e.priceModifier !== 0 ? ` ${pct(e.priceModifier, true)}` : ""}
            </span>
          ))}
        </div>
      </Panel>

      {message ? <p className="text-center font-hand text-[16px] text-copper">{message}</p> : null}

      {active ? (
        <Panel tone="dark" className="p-4">
          <div className="flex items-center justify-between">
            <Eyebrow dark>
              {SUPPLIER_ICON[contract!.supplierId] ?? "🚚"}{" "}
              {getSupplier(contract!.supplierId)?.name ?? contract!.supplierId}
            </Eyebrow>
            <Badge tone="sage">Active</Badge>
          </div>
          <p className="mt-1.5 font-hand text-[16px] text-ivory/85">
            {pct(contract!.discount)} off purchases of {contract!.minimumOrder}+ units ·{" "}
            {contract!.contractEndDay - currentDay} day
            {contract!.contractEndDay - currentDay === 1 ? "" : "s"} left
            {market.contractDiscountSuspended ? " · discount paused today" : ""}
          </p>
          <div className="mt-2">
            <Bar
              dark
              fraction={
                contract!.contractEndDay - currentDay > 0
                  ? (contract!.contractEndDay - currentDay) /
                    (offers.find((o) => o.supplierId === contract!.supplierId)?.terms
                      .contractLength ?? 1)
                  : 0
              }
            />
          </div>
          <KButton full variant="copper" className="mt-3" onClick={handleCancel}>
            Cancel contract
            {contract!.cancellationFee > 0
              ? ` · ${formatUsd(contract!.cancellationFee)}`
              : " · free"}
          </KButton>
        </Panel>
      ) : (
        <p className="font-hand text-[16px] leading-snug text-walnut/65">
          Sign with one supplier for a standing discount on ingredients — in exchange for a minimum
          order size and a cost to walk away early.
        </p>
      )}

      <div className="space-y-3">
        {offers.map(({ supplierId, terms }) => {
          const supplier = getSupplier(supplierId);
          const isCurrent = active && contract!.supplierId === supplierId;
          const todayPrice =
            market.offers.find((o) => o.supplierId === supplierId)?.effectivePrice ??
            market.referencePriceToday;
          return (
            <article
              key={supplierId}
              className={cn(
                "product-card rounded-[20px] border p-4 card-warm",
                isCurrent ? "border-olive/50" : "border-walnut/15",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-[36px] leading-none" aria-hidden>
                  {SUPPLIER_ICON[supplierId] ?? "🚚"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[17.5px] font-black leading-tight text-walnut-dark">
                    {supplier?.name ?? supplierId}
                  </p>
                  <p className="font-hand text-[14px] leading-tight text-walnut/60">
                    {formatUsd(market.referenceBasePrice)} item → {formatUsd(todayPrice)} today at{" "}
                    {terms.minimumOrder}+ units
                  </p>
                </div>
                {isCurrent ? <Badge tone="sage">Yours</Badge> : null}
              </div>

              <div className="mt-3">
                <div className="flex justify-between font-ui text-[12.5px] font-bold text-walnut/75">
                  <span>Discount</span>
                  <span className="font-extrabold text-walnut-dark">{pct(terms.discount)}</span>
                </div>
                <div className="mt-1">
                  <Bar fraction={maxDiscount > 0 ? terms.discount / maxDiscount : 0} tone="sage" />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-[12px] bg-cream/70 px-1 py-1.5">
                  <p className="font-ui text-[11px] font-bold text-walnut/55">Min. order</p>
                  <p className="font-ui text-[13.5px] font-extrabold text-walnut-dark">
                    {terms.minimumOrder}
                  </p>
                </div>
                <div className="rounded-[12px] bg-cream/70 px-1 py-1.5">
                  <p className="font-ui text-[11px] font-bold text-walnut/55">Contract</p>
                  <p className="font-ui text-[13.5px] font-extrabold text-walnut-dark">
                    {terms.contractLength} days
                  </p>
                </div>
                <div className="rounded-[12px] bg-cream/70 px-1 py-1.5">
                  <p className="font-ui text-[11px] font-bold text-walnut/55">Cancel</p>
                  <p className="font-ui text-[13.5px] font-extrabold text-walnut-dark">
                    {terms.cancellationFee > 0 ? formatUsd(terms.cancellationFee) : "Free"}
                  </p>
                </div>
              </div>
              <p className="mt-2 font-ui text-[11px] font-bold text-walnut/50">
                For reference: delivery{" "}
                {terms.deliveryTime === 0 ? "same day" : `${terms.deliveryTime} day`} · quality{" "}
                {pct(terms.qualityModifier, true)}
              </p>
              {terms.minimumOrder > freeStorage ? (
                <p className="mt-1 font-hand text-[14px] leading-snug text-copper">
                  A {terms.minimumOrder}-unit order needs that much free fridge space — you have{" "}
                  {formatQuantity(freeStorage)}.
                </p>
              ) : null}
              {!active ? (
                <KButton full className="mt-3" onClick={() => handleSign(supplierId)}>
                  Sign contract
                </KButton>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
