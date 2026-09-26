import { useState } from "react";
import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, ScreenHeader, Divider, Badge } from "../common/primitives";
import { BusinessCash } from "./BusinessCash";
import { BottomNav } from "../Kitchen";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { businessUnitCostFor, purchaseUnitFor } from "@/game/business/businessPricing";
import { formatUsd } from "@/game/business/businessCurrency";
import { inventoryValue, formatQuantity } from "@/game/business/businessInventory";
import type { PurchaseIngredientResult } from "@/game/business/BusinessInventoryManager";
import { getRefrigerator } from "@/game/business/refrigeratorDefinitions";
import {
  getInventoryUsedCapacity,
  getAvailableStorageCapacity,
} from "@/game/business/RefrigeratorManager";
import {
  perishabilityStateFor,
  shelfLifeForIngredient,
  type PerishabilityState,
} from "@/game/business/perishability";
import { businessDishRequirements } from "@/game/business/businessServiceCatalog";
import { effectiveUnitCost, isContractActive } from "@/game/business/businessSupplierContract";
import {
  eventForDay,
  eventAdjustedUnitCost,
  maxPurchaseQuantityFor,
} from "@/game/business/businessSupplierEvents";
import { staffUnitCostDiscount } from "@/game/business/businessStaff";
import {
  stockSpoilingTonight,
  makeableDishCount,
  supplierEventSummary,
} from "@/game/business/businessAlerts";
import { activeBusinessDishes } from "@/game/business/businessMenuActivation";
import {
  DEFAULT_PURCHASE_QUANTITY,
  stepPurchaseQuantity,
} from "@/game/business/businessPurchaseQuantity";

const PERISHABILITY_BADGE_TONE: Record<PerishabilityState, "cream" | "sage" | "copper" | "locked"> =
  {
    FRESH: "sage",
    AGING: "cream",
    NEAR_EXPIRY: "copper",
    EXPIRED: "locked",
  };

/**
 * BUSINESS_INVENTORY — Economy V3 Phase 2. Business Mode only; reuses
 * `INGREDIENTS`/`IngredientId` directly (no second ingredient list) and
 * `businessUnitCostFor` as the ONLY source of purchase prices (never a
 * literal number typed in this file).
 *
 * Economy V3 Phase 4 (Perishability) — each "On Hand" row now shows its
 * freshness state via the existing `Badge` primitive, reading
 * `perishabilityStateFor` directly (never recomputing age/threshold math
 * inline, so this screen can't drift from perishability.ts's own rules).
 */
export function BusinessInventory({
  go,
  save,
  purchaseIngredient,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  purchaseIngredient: (ingredientId: string, quantity: number) => PurchaseIngredientResult;
}) {
  const [quantities, setQuantities] = useState<Partial<Record<IngredientId, number>>>({});
  const [messages, setMessages] = useState<Partial<Record<IngredientId, string>>>({});

  const owned = Object.values(save.business.inventory).filter((entry) => !!entry);
  const totalValue = inventoryValue(save.business.inventory);
  const refrigerator = getRefrigerator(save.business.refrigerator.refrigeratorId);
  const used = getInventoryUsedCapacity(save.business.inventory);
  const available = getAvailableStorageCapacity(
    save.business.inventory,
    save.business.refrigerator.refrigeratorId,
  );
  const event = eventForDay(save.business.calendar.businessDay);
  const maxQuantity = maxPurchaseQuantityFor(event);
  const spoilingTonight = new Set(stockSpoilingTonight(save));
  // V3-16 player-experience audit: connect purchasing to the Active Menu —
  // what the menu needs is marked and listed first (catalog order kept
  // within each group); shelf life is shown before buying, not discovered
  // when stock spoils.
  const menuIngredients = new Set(
    activeBusinessDishes(save.business.menuActivation).flatMap((d) =>
      businessDishRequirements(d).map((r) => r.ingredientId),
    ),
  );
  const allIngredientIds = Object.keys(INGREDIENTS) as IngredientId[];
  const purchaseOrder = [
    ...allIngredientIds.filter((id) => menuIngredients.has(id)),
    ...allIngredientIds.filter((id) => !menuIngredients.has(id)),
  ];
  const makeable = makeableDishCount(save);

  function quantityFor(id: IngredientId): number {
    return quantities[id] ?? DEFAULT_PURCHASE_QUANTITY;
  }

  function adjustQuantity(id: IngredientId, direction: 1 | -1) {
    setQuantities((q) => ({ ...q, [id]: stepPurchaseQuantity(quantityFor(id), direction) }));
  }

  function handlePurchase(id: IngredientId) {
    const quantity = quantityFor(id);
    const result = purchaseIngredient(id, quantity);
    if (!result.ok) {
      const text =
        result.reason === "insufficientFunds"
          ? "Not quite enough cash for that purchase."
          : result.reason === "insufficientStorage"
            ? "Not enough refrigerator space for that much."
            : result.reason === "exceedsShortageLimit"
              ? "Today's shortage limits how much you can buy at once."
              : "That purchase couldn't be made.";
      setMessages((m) => ({ ...m, [id]: text }));
      return;
    }
    setMessages((m) => ({
      ...m,
      [id]: `Bought ${result.quantity} ${purchaseUnitFor(id)} for ${formatUsd(result.totalCost)}.`,
    }));
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(125,146,112,0.24),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Inventory"
          subtitle="what the restaurant has on hand"
          onBack={() => go("business")}
          right={<BusinessCash cents={save.credits} />}
        />

        <div className="px-4">
          <Panel tone="dark" className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold">
                  Total Inventory Value
                </p>
                <p className="font-display text-[22px] font-black leading-none text-ivory">
                  {formatUsd(totalValue)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold">
                  Current Cash
                </p>
                <p className="font-display text-[22px] font-black leading-none text-ivory">
                  {formatUsd(save.credits)}
                </p>
              </div>
            </div>
          </Panel>
        </div>

        {event ? (
          <div className="px-4 pt-3">
            <Panel tone="cream" className="p-3">
              <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
                {event.name}
              </p>
              <p className="font-hand text-[13px] text-walnut/60">
                {supplierEventSummary(
                  event,
                  isContractActive(
                    save.business.supplierContract,
                    save.business.calendar.businessDay,
                  ),
                )}
              </p>
            </Panel>
          </div>
        ) : null}

        <div className="px-4 pt-3">
          <Panel tone="cream" className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.2em] text-copper">
                  {refrigerator?.name ?? "Refrigerator"}
                </p>
                <p className="font-hand text-[13px] text-walnut/60">
                  {formatQuantity(used)} / {refrigerator?.capacity ?? 0} used ·{" "}
                  {formatQuantity(available)} available
                </p>
              </div>
              <button
                type="button"
                onClick={() => go("business-refrigerator")}
                className="press rounded-full border border-walnut/20 bg-ivory px-3 py-1.5 font-ui text-[11px] font-bold text-walnut-dark"
              >
                Manage →
              </button>
            </div>
          </Panel>
        </div>

        <div className="px-4 pt-4">
          <p className="mb-1 font-display text-[16px] font-black text-walnut-dark">On Hand</p>
          <p
            className={`mb-2 font-hand text-[13px] leading-snug ${makeable === 0 || spoilingTonight.size > 0 ? "text-copper" : "text-walnut/60"}`}
          >
            {makeable === 0
              ? "No dish on your menu can be made from usable stock — customers can't be served until you restock."
              : `${makeable} of the ${activeBusinessDishes(save.business.menuActivation).length} dishes on your menu can be made from usable stock.`}
            {spoilingTonight.size > 0
              ? ` ${spoilingTonight.size} item${spoilingTonight.size === 1 ? "" : "s"} will be discarded at End Business Day.`
              : ""}
          </p>
          {owned.length === 0 ? (
            <Panel className="p-4 text-center">
              <p className="font-hand text-[15px] text-walnut/60">
                Nothing in stock yet — buy some ingredients below.
              </p>
            </Panel>
          ) : (
            <div className="flex flex-col gap-2">
              {owned.map((entry) => {
                const state = perishabilityStateFor(
                  entry!.ingredientId,
                  entry!.purchaseDay,
                  save.business.calendar.businessDay,
                );
                return (
                  <Panel key={entry!.ingredientId} tone="cream" className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-[14px] font-black leading-tight text-walnut-dark">
                          {INGREDIENT_EMOJI[entry!.ingredientId]}{" "}
                          {INGREDIENTS[entry!.ingredientId].name}
                        </p>
                        <p className="font-hand text-[13px] leading-tight text-walnut/60">
                          {formatQuantity(entry!.quantity)} {purchaseUnitFor(entry!.ingredientId)} ·{" "}
                          {formatUsd(entry!.unitCost)}/{purchaseUnitFor(entry!.ingredientId)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <p className="font-ui text-[13px] font-bold text-copper">
                          {formatUsd(Math.round(entry!.quantity * entry!.unitCost))}
                        </p>
                        <Badge tone={PERISHABILITY_BADGE_TONE[state]}>
                          {state.replace("_", " ")}
                        </Badge>
                        {spoilingTonight.has(entry!.ingredientId) ? (
                          <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.1em] text-copper">
                            spoils tonight
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}
        </div>

        <Divider />

        <div className="px-4 pt-2">
          <p className="mb-2 font-display text-[16px] font-black text-walnut-dark">
            Purchase Ingredients
          </p>
          <p className="mb-2 font-hand text-[13px] leading-snug text-walnut/60">
            Ingredients your menu uses are listed first. Each one keeps only so many business days
            before it spoils at End Business Day.
          </p>
          <div className="flex flex-col gap-2">
            {purchaseOrder.map((id) => {
              const def = INGREDIENTS[id];
              const quantity = quantityFor(id);
              const eventCost = eventAdjustedUnitCost(businessUnitCostFor(id), event);
              const contractCost = event?.suspendsContractDiscount
                ? eventCost
                : effectiveUnitCost(
                    eventCost,
                    save.business.supplierContract,
                    save.business.calendar.businessDay,
                    quantity,
                  );
              const unitCost = staffUnitCostDiscount(contractCost, save.business.staff.hiredRoles);
              const totalCost = unitCost * quantity;
              const exceedsShortage = maxQuantity !== undefined && quantity > maxQuantity;
              const affordable =
                save.credits >= totalCost && quantity <= available && !exceedsShortage;
              const message = messages[id];
              return (
                <Panel key={id} tone="cream" className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-[14px] font-black leading-tight text-walnut-dark">
                        {INGREDIENT_EMOJI[id]} {def.name}
                      </p>
                      <p className="font-hand text-[13px] leading-tight text-walnut/60">
                        {formatUsd(unitCost)}/{purchaseUnitFor(id)} · keeps{" "}
                        {shelfLifeForIngredient(id)} days
                      </p>
                      {menuIngredients.has(id) ? (
                        <p className="font-ui text-[10px] font-extrabold uppercase tracking-[0.1em] text-olive">
                          On your menu
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => adjustQuantity(id, -1)}
                        className="press grid h-8 w-8 place-items-center rounded-full border border-walnut/20 bg-ivory font-ui font-black text-walnut-dark"
                        aria-label={`Decrease quantity for ${def.name}`}
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-ui text-[13px] font-bold text-walnut-dark">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustQuantity(id, 1)}
                        className="press grid h-8 w-8 place-items-center rounded-full border border-walnut/20 bg-ivory font-ui font-black text-walnut-dark"
                        aria-label={`Increase quantity for ${def.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <Divider />
                  {exceedsShortage ? (
                    <p className="mb-1.5 text-center font-hand text-[12px] text-copper">
                      Limited to {maxQuantity} today.
                    </p>
                  ) : null}
                  {message ? (
                    <p className="mb-1.5 text-center font-hand text-[13px] text-copper">
                      {message}
                    </p>
                  ) : null}
                  <KButton
                    full
                    variant={affordable ? "copper" : "ghost"}
                    onClick={() => handlePurchase(id)}
                  >
                    Buy {quantity} {purchaseUnitFor(id)} · {formatUsd(totalCost)}
                  </KButton>
                </Panel>
              );
            })}
          </div>
        </div>
      </div>
      <BottomNav active="business" go={go} />
    </div>
  );
}
