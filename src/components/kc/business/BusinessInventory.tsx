import { useState } from "react";
import type { ScreenId } from "../data";
import type { SaveData } from "@/game/SaveManager";
import { KButton, Panel, Badge } from "../common/primitives";
import { Bar, Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
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
import { notEnoughMoneyText } from "@/game/economy/wallet";
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

/** From this quantity on, the card phrases the balance as "You'll have $X remaining". */
const LARGE_PURCHASE_QUANTITY = 25;

/** A balance for the card: whole dollars when there are no cents ("$1,332"), else "$1,332.40". */
function balanceText(cents: number): string {
  return formatUsd(cents).replace(/\.00$/, "");
}

/** The ingredient registry's own categories, in shop order, with player-facing names. */
const GROUPS: Array<{ category: string; label: string; emoji: string }> = [
  { category: "Vegetable", label: "Vegetables", emoji: "🥕" },
  { category: "Fruit", label: "Fruit", emoji: "🍎" },
  { category: "Herb", label: "Herbs", emoji: "🌿" },
  { category: "Aromatic", label: "Aromatics", emoji: "🧄" },
  { category: "Bakery", label: "Bakery", emoji: "🥖" },
  { category: "Dairy", label: "Dairy & Tofu", emoji: "🧀" },
  { category: "Protein", label: "Protein", emoji: "🍗" },
];

/**
 * BUSINESS · INGREDIENTS tab (Economy V3 Phase 2 inventory, reorganised as
 * Market-style cards). Reuses `INGREDIENTS` (no second list) and the SAME
 * price chain the purchase itself uses — `businessUnitCostFor` → today's
 * supplier event → contract → staff discount — never a literal price.
 * Grouped by the registry's own `category`; within a group, what the
 * active menu needs comes first.
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
  const [group, setGroup] = useState<string>("all");

  const owned = Object.values(save.business.inventory).filter((entry) => !!entry);
  const totalValue = inventoryValue(save.business.inventory);
  const refrigerator = getRefrigerator(save.business.refrigerator.refrigeratorId);
  const capacity = refrigerator?.capacity ?? 0;
  const used = getInventoryUsedCapacity(save.business.inventory);
  const available = getAvailableStorageCapacity(
    save.business.inventory,
    save.business.refrigerator.refrigeratorId,
  );
  const event = eventForDay(save.business.calendar.businessDay);
  const maxQuantity = maxPurchaseQuantityFor(event);
  const spoilingTonight = new Set(stockSpoilingTonight(save));
  const menuIngredients = new Set(
    activeBusinessDishes(save.business.menuActivation).flatMap((d) =>
      businessDishRequirements(d).map((r) => r.ingredientId),
    ),
  );
  const allIngredientIds = Object.keys(INGREDIENTS) as IngredientId[];
  const makeable = makeableDishCount(save);
  const menuDishCount = activeBusinessDishes(save.business.menuActivation).length;

  function quantityFor(id: IngredientId): number {
    return quantities[id] ?? DEFAULT_PURCHASE_QUANTITY;
  }

  /** Today's unit price — the same chain the purchase itself runs (BusinessInventoryManager). */
  function unitCostFor(id: IngredientId, quantity: number): number {
    const eventCost = eventAdjustedUnitCost(businessUnitCostFor(id), event);
    const contractCost = event?.suspendsContractDiscount
      ? eventCost
      : effectiveUnitCost(
          eventCost,
          save.business.supplierContract,
          save.business.calendar.businessDay,
          quantity,
        );
    return staffUnitCostDiscount(contractCost, save.business.staff.hiredRoles);
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
          ? notEnoughMoneyText(unitCostFor(id, quantity) * quantity, save.credits)
          : result.reason === "insufficientStorage"
            ? "Not enough fridge space."
            : result.reason === "exceedsShortageLimit"
              ? "Today's shortage limits this."
              : "That purchase couldn't be made.";
      setMessages((m) => ({ ...m, [id]: text }));
      return;
    }
    setMessages((m) => ({
      ...m,
      [id]: `Bought ${result.quantity} ${purchaseUnitFor(id)} · ${formatUsd(result.totalCost)}`,
    }));
  }

  const groups = GROUPS.filter((g) => group === "all" || g.category === group);

  return (
    <div className="space-y-3">
      {/* Pantry status */}
      <Panel className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow>❄️ {refrigerator?.name ?? "Refrigerator"} space</Eyebrow>
          <span className="font-ui text-[12px] font-extrabold text-walnut-dark">
            {formatQuantity(used)} / {capacity}
          </span>
        </div>
        <div className="mt-2">
          <Bar fraction={capacity > 0 ? used / capacity : 0} tone="sage" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 font-ui text-[12px]">
          <p className="font-bold text-walnut/70">
            Stock value{" "}
            <span className="block font-display text-[16px] font-black text-walnut-dark">
              {formatUsd(totalValue)}
            </span>
          </p>
          <p className="text-right font-bold text-walnut/70">
            Space left{" "}
            <span className="block font-display text-[16px] font-black text-walnut-dark">
              {formatQuantity(available)}
            </span>
          </p>
        </div>
        <p
          className={cn(
            "mt-2 font-hand text-[14px] leading-snug",
            makeable === 0 || spoilingTonight.size > 0 ? "text-copper" : "text-walnut/65",
          )}
        >
          {makeable === 0
            ? "No dish on your menu can be made from your stock yet — buy what the menu needs (marked below)."
            : `${makeable} of your ${menuDishCount} menu dishes can be made from stock right now.`}
          {spoilingTonight.size > 0
            ? ` ${spoilingTonight.size} item${spoilingTonight.size === 1 ? "" : "s"} spoil${spoilingTonight.size === 1 ? "s" : ""} at End Business Day.`
            : ""}
        </p>
        <KButton
          full
          size="sm"
          variant="ghost"
          className="mt-2 h-12"
          onClick={() => go("business-refrigerator")}
        >
          Upgrade or repair the fridge →
        </KButton>
      </Panel>

      {event ? (
        <Panel tone="cream" className="p-3">
          <Eyebrow>🚚 Today · {event.name}</Eyebrow>
          <p className="font-hand text-[14px] text-walnut/65">
            {supplierEventSummary(
              event,
              isContractActive(save.business.supplierContract, save.business.calendar.businessDay),
            )}
          </p>
        </Panel>
      ) : null}

      {/* On hand */}
      {owned.length > 0 ? (
        <Panel className="p-4">
          <Eyebrow>🧺 On hand</Eyebrow>
          <div className="mt-1">
            {owned.map((entry) => {
              const state = perishabilityStateFor(
                entry!.ingredientId,
                entry!.purchaseDay,
                save.business.calendar.businessDay,
              );
              return (
                <div
                  key={entry!.ingredientId}
                  className="flex items-center gap-2 border-b border-walnut/10 py-2 last:border-b-0"
                >
                  <span className="text-[20px]">{INGREDIENT_EMOJI[entry!.ingredientId]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-ui text-[13px] font-extrabold text-walnut-dark">
                      {INGREDIENTS[entry!.ingredientId].name}
                    </span>
                    <span className="block font-hand text-[13px] text-walnut/60">
                      {formatQuantity(entry!.quantity)} {purchaseUnitFor(entry!.ingredientId)} ·{" "}
                      {formatUsd(Math.round(entry!.quantity * entry!.unitCost))}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <Badge tone={PERISHABILITY_BADGE_TONE[state]}>{state.replace("_", " ")}</Badge>
                    {spoilingTonight.has(entry!.ingredientId) ? (
                      <span className="font-ui text-[10px] font-extrabold uppercase text-copper">
                        spoils tonight
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      ) : (
        <Panel className="p-4 text-center">
          <p className="font-hand text-[15px] text-walnut/60">
            Nothing in stock yet — buy ingredients below.
          </p>
        </Panel>
      )}

      {/* Group filter */}
      <div
        className="-mx-4 flex gap-2 overflow-x-auto no-scrollbar px-4"
        aria-label="Ingredient groups"
      >
        {[{ category: "all", label: "All", emoji: "🧺" }, ...GROUPS].map((g) => (
          <button
            key={g.category}
            type="button"
            onClick={() => setGroup(g.category)}
            aria-pressed={group === g.category}
            className={cn(
              "press h-12 min-w-12 shrink-0 rounded-full border px-3.5 font-ui text-[12px] font-extrabold",
              group === g.category
                ? "wood border-walnut-dark/50 text-ivory"
                : "card-warm border-walnut/15 text-walnut-dark",
            )}
          >
            {g.emoji} {g.label}
          </button>
        ))}
      </div>

      {groups.map((g) => {
        const ids = allIngredientIds.filter((id) => INGREDIENTS[id].category === g.category);
        const ordered = [
          ...ids.filter((id) => menuIngredients.has(id)),
          ...ids.filter((id) => !menuIngredients.has(id)),
        ];
        if (ordered.length === 0) return null;
        return (
          <section key={g.category}>
            <p className="mb-2 mt-1 font-display text-[16px] font-black text-walnut-dark">
              {g.emoji} {g.label}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {ordered.map((id) => {
                const def = INGREDIENTS[id];
                const quantity = quantityFor(id);
                const unitCost = unitCostFor(id, quantity);
                const totalCost = unitCost * quantity;
                const exceedsShortage = maxQuantity !== undefined && quantity > maxQuantity;
                const canPay = save.credits >= totalCost;
                const affordable = canPay && quantity <= available && !exceedsShortage;
                const remaining = save.credits - totalCost;
                const stock = save.business.inventory[id]?.quantity ?? 0;
                const message = messages[id];
                return (
                  <article
                    key={id}
                    className="product-card flex flex-col rounded-[20px] border border-walnut/15 p-3 card-warm"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[34px] leading-none" aria-hidden>
                        {INGREDIENT_EMOJI[id]}
                      </span>
                      {menuIngredients.has(id) ? <Badge tone="sage">Menu</Badge> : null}
                    </div>
                    <p className="mt-1 font-display text-[14px] font-black leading-tight text-walnut-dark">
                      {def.name}
                    </p>
                    <p className="font-ui text-[12px] font-extrabold text-copper">
                      {formatUsd(unitCost)}
                      <span className="font-bold text-walnut/60">/{purchaseUnitFor(id)}</span>
                    </p>
                    <p className="font-hand text-[13px] leading-tight text-walnut/60">
                      In stock {formatQuantity(stock)} · keeps {shelfLifeForIngredient(id)} days
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => adjustQuantity(id, -1)}
                        className="press grid h-12 w-12 place-items-center rounded-full border border-walnut/20 bg-ivory font-ui text-[18px] font-black text-walnut-dark"
                        aria-label={`Decrease quantity for ${def.name}`}
                      >
                        −
                      </button>
                      <span className="font-ui text-[15px] font-extrabold text-walnut-dark">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustQuantity(id, 1)}
                        className="press grid h-12 w-12 place-items-center rounded-full border border-walnut/20 bg-ivory font-ui text-[18px] font-black text-walnut-dark"
                        aria-label={`Increase quantity for ${def.name}`}
                      >
                        +
                      </button>
                    </div>
                    {exceedsShortage ? (
                      <p className="mt-1 text-center font-hand text-[12px] text-copper">
                        Limited to {maxQuantity} today.
                      </p>
                    ) : null}
                    {message ? (
                      <p className="mt-1 text-center font-hand text-[12px] leading-tight text-copper">
                        {message}
                      </p>
                    ) : null}
                    <KButton
                      full
                      variant={affordable ? "copper" : "ghost"}
                      className="mt-auto h-12 px-2 text-[12px]"
                      onClick={() => handlePurchase(id)}
                    >
                      Buy {quantity} {purchaseUnitFor(id)} · {formatUsd(totalCost)}
                    </KButton>
                    {/* What the purchase does to the wallet, before the tap. */}
                    <p
                      className={cn(
                        "mt-1 text-center font-ui text-[11px] font-bold leading-tight",
                        canPay ? "text-walnut/65" : "text-copper",
                      )}
                    >
                      {!canPay
                        ? notEnoughMoneyText(totalCost, save.credits)
                        : quantity >= LARGE_PURCHASE_QUANTITY
                          ? `You'll have ${balanceText(remaining)} remaining`
                          : `${balanceText(save.credits)} → ${balanceText(remaining)}`}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
