import { useState } from "react";
import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, ScreenHeader, Divider, Badge } from "../common/primitives";
import { BusinessCash } from "./BusinessCash";
import { formatUsd } from "@/game/business/businessCurrency";
import { BottomNav } from "../Kitchen";
import { getSupplier } from "@/game/economy/supplierDefinitions";
import { getAllContractOffers, isContractActive } from "@/game/business/businessSupplierContract";
import type {
  SignContractResult,
  CancelContractResult,
} from "@/game/business/BusinessSupplierManager";
import { supplierMarketToday, supplierEventSummary } from "@/game/business/businessAlerts";
import { getAvailableStorageCapacity } from "@/game/business/RefrigeratorManager";
import { formatQuantity } from "@/game/business/businessInventory";

/**
 * BUSINESS_SUPPLIERS — Economy V3 Phase 7. Business Mode only; reuses
 * the EXISTING `supplierDefinitions.ts` catalog directly (no second
 * supplier list) and `businessSupplierContract.ts`'s own
 * `getAllContractOffers`/`isContractActive` as the ONLY source of
 * contract terms/state shown here — never recomputed inline.
 */
export function BusinessSuppliers({
  go,
  save,
  signSupplierContract,
  cancelSupplierContract,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  signSupplierContract: (supplierId: string) => SignContractResult;
  cancelSupplierContract: () => CancelContractResult;
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
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(125,146,112,0.24),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Suppliers"
          subtitle="sourcing deals for the restaurant"
          onBack={() => go("business")}
          right={<BusinessCash cents={save.credits} />}
        />

        {message ? (
          <p className="px-4 pt-2 text-center font-hand text-[14px] text-copper">{message}</p>
        ) : null}

        <div className="px-4 pt-3">
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
                Today's Market · Day {currentDay}
              </p>
              {market.contractDiscountSuspended ? (
                <Badge tone="copper">Discount suspended</Badge>
              ) : null}
            </div>
            <p className="mt-1.5 font-display text-[15px] font-black text-walnut-dark">
              {market.event ? market.event.name : "Quiet day — no supplier event"}
            </p>
            {market.event ? (
              <p className="font-hand text-[14px] leading-snug text-walnut/65">
                {supplierEventSummary(market.event, active)}
                {market.event.maxPurchaseQuantity !== undefined
                  ? ` Max ${market.event.maxPurchaseQuantity} units per purchase.`
                  : ""}
              </p>
            ) : null}
            <p className="mt-1 font-hand text-[13px] text-walnut/55">
              A {formatUsd(market.referenceBasePrice)} ingredient costs{" "}
              {formatUsd(market.referencePriceToday)} today before any contract discount.
            </p>
            {active ? (
              <p className="mt-1 font-ui text-[12px] font-bold text-walnut-dark">
                With your contract (at {contract!.minimumOrder}+ units):{" "}
                {formatUsd(
                  market.offers.find((o) => o.isCurrent)?.effectivePrice ??
                    market.referencePriceToday,
                )}
                {market.contractDiscountSuspended ? " — discount not applied today" : ""}
              </p>
            ) : null}
          </Panel>
        </div>

        {active ? (
          <div className="px-4 pt-3">
            <Panel tone="dark" className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold">
                  {getSupplier(contract!.supplierId)?.name ?? contract!.supplierId}
                </p>
                <Badge tone="sage">Active</Badge>
              </div>
              <p className="mt-1.5 font-hand text-[14px] text-ivory/80">
                {Math.round(contract!.discount * 100)}% off purchases of {contract!.minimumOrder}+
                units, {contract!.contractEndDay - currentDay} day
                {contract!.contractEndDay - currentDay === 1 ? "" : "s"} left.
              </p>
              <p className="mt-1 font-hand text-[13px] text-ivory/60">
                Cancelling early costs {formatUsd(contract!.cancellationFee)}.
              </p>
              <Divider />
              <KButton full variant="copper" onClick={handleCancel}>
                Cancel Contract
              </KButton>
            </Panel>
          </div>
        ) : (
          <div className="px-4 pt-3">
            <p className="mb-2 font-hand text-[14px] leading-snug text-walnut/60">
              Sign with a supplier for a standing discount on ingredient purchases, in exchange for
              a minimum order size and a real cost to walk away early.
            </p>
            <div className="flex flex-col gap-2">
              {getAllContractOffers().map(({ supplierId, terms }) => {
                const supplier = getSupplier(supplierId);
                return (
                  <Panel key={supplierId} tone="cream" className="p-3">
                    <p className="font-display text-[14px] font-black leading-tight text-walnut-dark">
                      {supplier?.name ?? supplierId}
                    </p>
                    <Divider />
                    <p className="font-ui text-[12px] font-bold text-copper">
                      {Math.round(terms.discount * 100)}% off orders of {terms.minimumOrder}+ units
                    </p>
                    {terms.minimumOrder > freeStorage ? (
                      <p className="font-hand text-[12px] leading-snug text-copper">
                        A {terms.minimumOrder}-unit order needs {terms.minimumOrder} units of free
                        refrigerator space — you have {formatQuantity(freeStorage)} free right now.
                      </p>
                    ) : null}
                    <p className="font-hand text-[12px] text-walnut/60">
                      Today: a {formatUsd(market.referenceBasePrice)} ingredient would cost{" "}
                      {formatUsd(
                        market.offers.find((o) => o.supplierId === supplierId)?.effectivePrice ??
                          market.referencePriceToday,
                      )}{" "}
                      at {terms.minimumOrder}+ units
                      {market.event?.suspendsContractDiscount ? " (discount suspended today)" : ""}.
                    </p>
                    <p className="font-hand text-[12px] text-walnut/60">
                      {terms.contractLength}-day contract ·{" "}
                      {terms.cancellationFee > 0
                        ? `${formatUsd(terms.cancellationFee)} to cancel early`
                        : "no cancellation fee"}
                    </p>
                    <KButton full className="mt-2" onClick={() => handleSign(supplierId)}>
                      Sign Contract
                    </KButton>
                  </Panel>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <BottomNav active="business" go={go} />
    </div>
  );
}
