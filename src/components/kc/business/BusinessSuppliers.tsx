import { InfoTip } from "../common/InfoTip";
import { StandingOrdersCard } from "../restaurant/Deliveries";
import type { DeliveryKind } from "@/game/restaurant/deliveries";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import { useState, type ReactNode } from "react";
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
import {
  supplierEventGlance,
  supplierMarketToday,
  supplierEventSummary,
} from "@/game/business/businessAlerts";
import { SUPPLIER_EVENT_CATALOG } from "@/game/business/businessSupplierEvents";
import { getAvailableStorageCapacity } from "@/game/business/RefrigeratorManager";
import { formatQuantity } from "@/game/business/businessInventory";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { IngredientSupplier } from "../restaurant/IngredientSupplier";
import { supplierCreditOf } from "@/game/restaurant/supplierCredit";
import { Art, GlossBar, PIcon, ProgressCard, ValuePill } from "../progress/ProgressKit";

const SUPPLIER_ICON: Record<string, string> = {
  "local-market": "🏪",
  "premium-supplier": "🧺",
  "wholesale-supplier": "🚚",
};

/** The painted supplier pictures and the card decoration of each contract (RB-icons-a, RB-decor-a). */
const SUPPLIER_ART: Record<string, { icon: string; deco: string }> = {
  "local-market": { icon: "biz:icons-a/local-market", deco: "biz:decor-a/stall-tomatoes" },
  "wholesale-supplier": { icon: "biz:icons-a/wholesale-truck", deco: "biz:decor-a/warehouse" },
  "premium-supplier": { icon: "biz:icons-a/premium-basket", deco: "biz:decor-a/tomato-bag" },
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
  setStandingOrder,
}: {
  save: SaveData;
  signSupplierContract: (supplierId: string) => SignContractResult;
  cancelSupplierContract: () => CancelContractResult;
  /** Restaurant build: the ingredient supplier lives here (phase 7), not in the Market. */
  selectSupplier?: (id: string) => void;
  /** Restaurant build: the standing orders (restaurant/deliveries.ts). */
  setStandingOrder?: (kind: DeliveryKind, on: boolean) => void;
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
      {RESTAURANT_MODE && setStandingOrder ? (
        <StandingOrdersCard
          save={save}
          level={restaurantLevelOf(save.levelProgress)}
          onToggle={setStandingOrder}
        />
      ) : null}
      {RESTAURANT_MODE && supplierCreditOf(save).taken > 0 ? (
        <SupplierCreditCard save={save} />
      ) : null}
      {/* Today's supplier conditions */}
      <ProgressCard
        title="Today's supplier conditions"
        icon={<PIcon name="icons-c/calendar" fallback="🌤️" size={26} />}
        right={
          <span className="flex items-center gap-1.5">
            <ValuePill className="min-h-8 text-[13px]">
              <PIcon name="icons-c/calendar" fallback="📅" size={20} />
              Day {currentDay}
            </ValuePill>
            <InfoTip label="Possible supplier events">
              <span className="block font-ui text-[12px] font-bold">Possible supplier events</span>
              {Object.values(SUPPLIER_EVENT_CATALOG).map((e) => (
                <span
                  key={e.id}
                  className={cn(
                    "mt-1 block font-ui text-[12px] font-bold",
                    market.event?.id === e.id ? "text-copper" : "text-walnut/70",
                  )}
                >
                  {e.name}
                  {e.priceModifier !== 0 ? ` ${pct(e.priceModifier, true)}` : ""}
                </span>
              ))}
            </InfoTip>
          </span>
        }
        className="pt-10"
      >
        <Art
          name="biz:decor-a/stall-ghost"
          className="pointer-events-none absolute bottom-1 right-3 hidden h-24 w-auto @min-[620px]:block"
        />
        {market.event ? (
          <div className="relative rounded-[16px] border border-gold/40 bg-gold/15 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-[17px] font-black text-walnut-dark">
                {market.event.name}
              </p>
              <ValuePill tone={market.event.priceModifier > 0 ? "gold" : "green"}>
                {market.event.priceModifier === 0
                  ? "prices normal"
                  : pct(market.event.priceModifier, true)}
              </ValuePill>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 font-ui text-[12.5px] font-bold text-walnut/75">
              <span className="min-w-0 flex-1">{supplierEventGlance(market.event, active)}</span>
              <InfoTip label={`About ${market.event.name}`}>
                {supplierEventSummary(market.event, active)}
                {market.event.maxPurchaseQuantity !== undefined
                  ? ` Max ${market.event.maxPurchaseQuantity} per purchase.`
                  : ""}
              </InfoTip>
            </p>
          </div>
        ) : (
          <p className="relative flex items-center gap-2 font-display text-[18px] font-black text-walnut-dark">
            <PIcon name="biz:icons-a/sun" fallback="☀️" size={30} />A quiet day — normal prices
          </p>
        )}
        <p
          className="relative mt-3 flex items-center gap-2 font-ui text-[13px] font-bold text-walnut/70"
          title="Before any contract discount"
        >
          <ValuePill className="text-[13.5px]">
            <PIcon name="biz:icons-a/price-tag" fallback="🏷️" size={22} />
            {formatUsd(market.referenceBasePrice)} → <b>{formatUsd(market.referencePriceToday)}</b>{" "}
            today
          </ValuePill>
        </p>
      </ProgressCard>

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
          📜 1 contract · 🏷️ discount · 📦 minimum · 💸 cancel fee
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
            <ProgressCard
              key={supplierId}
              className={cn("pt-4 @min-[620px]:pt-4", isCurrent && "bz-hot")}
              data-contract={supplierId}
            >
              <Art
                name={SUPPLIER_ART[supplierId]?.deco ?? "biz:decor-a/stall-tomatoes"}
                className="pointer-events-none absolute right-3 top-1 hidden h-20 w-auto @min-[620px]:block"
              />
              <div className="relative flex items-center gap-3">
                <PIcon
                  name={SUPPLIER_ART[supplierId]?.icon ?? "biz:icons-a/local-market"}
                  fallback={SUPPLIER_ICON[supplierId] ?? "🚚"}
                  size={56}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-display text-[20px] font-black leading-tight text-walnut-dark">
                    {supplier?.name ?? supplierId}
                    <InfoTip label={`About the ${supplier?.name ?? supplierId} contract`}>
                      {pct(terms.discount)} off purchases of {terms.minimumOrder}+ units for{" "}
                      {terms.contractLength} days. Cancelling costs{" "}
                      {terms.cancellationFee > 0 ? formatUsd(terms.cancellationFee) : "nothing"}.
                    </InfoTip>
                  </p>
                  <p className="font-hand text-[15px] leading-tight text-walnut/65">
                    {formatUsd(market.referenceBasePrice)} item → {formatUsd(todayPrice)} today at{" "}
                    {terms.minimumOrder}+ units
                  </p>
                </div>
                {isCurrent ? (
                  <ValuePill tone="green" className="min-h-10 px-3 uppercase">
                    <PIcon name="icons-c/tick" fallback="✓" size={20} />
                    Yours
                  </ValuePill>
                ) : null}
              </div>

              <div className="relative mt-3 flex items-center gap-3">
                <span className="font-display text-[15px] font-black text-walnut-dark">
                  Discount
                </span>
                <GlossBar
                  fraction={maxDiscount > 0 ? terms.discount / maxDiscount : 0}
                  tone="green"
                  height={14}
                  label="Discount"
                />
                <ValuePill className="shrink-0">{pct(terms.discount)}</ValuePill>
              </div>

              <div className="relative mt-3 grid grid-cols-3 gap-2">
                <ContractFact
                  icon={<PIcon name="biz:icons-a/cart" fallback="🛒" size={32} />}
                  label="Min. order"
                  value={String(terms.minimumOrder)}
                />
                <ContractFact
                  icon={<PIcon name="icons-c/calendar" fallback="📅" size={32} />}
                  label="Contract"
                  value={`${terms.contractLength} days`}
                />
                <ContractFact
                  icon={<PIcon name="biz:icons-a/cancel-circle" fallback="❌" size={32} />}
                  label="Cancel"
                  value={terms.cancellationFee > 0 ? formatUsd(terms.cancellationFee) : "Free"}
                />
              </div>
              <p className="relative mt-2 flex items-center gap-1.5 font-ui text-[12px] font-bold text-walnut/60">
                <PIcon name="icons-a/sparkles" fallback="✨" size={18} />
                For reference: delivery{" "}
                {terms.deliveryTime === 0 ? "same day" : `${terms.deliveryTime} day`} · quality{" "}
                {pct(terms.qualityModifier, true)}
              </p>
              {terms.minimumOrder > freeStorage ? (
                <p className="relative mt-1 font-hand text-[14px] leading-snug text-copper">
                  ❄️ Needs {terms.minimumOrder} free · you have {formatQuantity(freeStorage)}
                </p>
              ) : null}
              {!active ? (
                <KButton full className="relative mt-3" onClick={() => handleSign(supplierId)}>
                  Sign contract
                </KButton>
              ) : null}
            </ProgressCard>
          );
        })}
      </div>
    </div>
  );
}

/** One of the three facts of a contract (minimum order, length, cancel fee): a cream tile with a painted icon. */
function ContractFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-[#ebd2a0] bg-[linear-gradient(180deg,#fffaf0,#fcefd6)] px-2 py-1.5">
      {icon}
      <span className="min-w-0 text-left leading-tight">
        <span className="block font-ui text-[12px] font-bold text-walnut/60">{label}</span>
        <span className="block font-display text-[15px] font-black text-walnut-dark">{value}</span>
      </span>
    </div>
  );
}

/**
 * Supplier credit (developer 2026-10-10; restaurant/supplierCredit.ts): goods
 * taken on credit when a service was short and couldn't be paid for, repaid
 * automatically from the next earnings. Read-only.
 */
function SupplierCreditCard({ save }: { save: SaveData }) {
  const c = supplierCreditOf(save);
  return (
    <Panel className="p-4">
      <span data-testid="supplier-credit-card" />
      <Eyebrow>💳 Supplier credit</Eyebrow>
      <p className="mt-1 font-display text-[18px] font-black text-walnut-dark">
        {c.owed > 0 ? `You owe ${formatUsd(c.owed)}` : "Nothing owed"}
      </p>
      <p className="mt-0.5 font-ui text-[12.5px] text-walnut/70">
        {c.owed > 0
          ? "Repaid automatically from your next level's earnings."
          : "Everything taken on credit has been repaid."}{" "}
        Taken so far {formatUsd(c.taken)} · repaid {formatUsd(c.repaid)}.
      </p>
    </Panel>
  );
}
