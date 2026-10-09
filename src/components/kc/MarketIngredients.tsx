import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { restaurantQuote } from "@/game/restaurant/restaurantEconomy";
import { supplierPriceNote } from "@/game/restaurant/restaurantBackOffice";
import { getSelectedSupplierId } from "@/game/economy/SupplierManager";
import { BulkPresets } from "./BulkPresets";
import { ingredientBulkDiscount } from "@/game/restaurant/bulkBuying";
import { MarketPlanPanel } from "./MarketPlanPanel";
import { useEffect, useRef, useState } from "react";
import { Badge, KButton, Panel } from "./common/primitives";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { formatUsd } from "@/game/money";
import { formatQuantity } from "@/game/business/businessInventory";
import {
  formatStockAmount,
  marketUnitCountText,
  marketUnitLabel,
  measureOf,
  stepMarketQuantity,
} from "@/game/business/measure";
import { shelfLifeForIngredient } from "@/game/business/perishability";
import {
  purchaseQuote,
  type PurchaseIngredientResult,
} from "@/game/business/BusinessInventoryManager";
import { eventForDay } from "@/game/business/businessSupplierEvents";
import { isContractActive } from "@/game/business/businessSupplierContract";
import { getSupplier } from "@/game/economy/supplierDefinitions";
import { supplierEventSummary } from "@/game/business/businessAlerts";
import { isHired } from "@/game/business/businessStaff";
import {
  ALL_INGREDIENT_IDS,
  INGREDIENT_GROUPS,
  activeDishesUsing,
  fridgeStatus,
} from "@/game/business/inventoryAnalytics";
import { notEnoughMoneyText } from "@/game/economy/wallet";
import {
  DEFAULT_PURCHASE_QUANTITY,
  stepPurchaseQuantity,
} from "@/game/business/businessPurchaseQuantity";

/** From this quantity on, the card phrases the balance as "You'll have $X remaining". */
const LARGE_PURCHASE_QUANTITY = 25;

/** A balance for the card: whole dollars when there are no cents ("$1,332"), else "$1,332.40". */
function balanceText(cents: number): string {
  return formatUsd(cents).replace(/\.00$/, "");
}

function fridgeSpaceText(available: number): string {
  return `You have ${formatQuantity(available)} unit${available === 1 ? "" : "s"} of fridge space left.`;
}

/**
 * MARKET · INGREDIENTS — the one place Business stock is bought. Every
 * price, verdict and wallet line comes from `purchaseQuote`, the same
 * decision `purchaseIngredient` makes (today's supplier event → the active
 * contract → a hired Prep Cook), so the card never promises what the tap
 * won't do. Inventory (bottom bar) only monitors this stock.
 */
export function MarketIngredients({
  save,
  purchaseIngredient,
  purchaseIngredients,
  focusId,
  focusQuantity = null,
  focusPlan = false,
  setNotice,
  onChangeSupplier,
}: {
  save: SaveData;
  purchaseIngredient: (ingredientId: string, quantity: number) => PurchaseIngredientResult;
  /** Restaurant build: the plan's "Buy all" (App.purchaseIngredients). */
  purchaseIngredients?: (lines: ReadonlyArray<{ ingredientId: string; quantity: number }>) => {
    bought: number;
    skipped: number;
    totalCost: number;
  };
  /** Preselected by a Business → Market link: its group opens and the card scrolls into view. */
  focusId: IngredientId | null;
  /** The focused card's starting quantity (a Pre-Service Check's exact shortfall). */
  focusQuantity?: number | null;
  /** Opened from the Pre-Service Check's "Buy everything in the Market": the plan opens on Today. */
  focusPlan?: boolean;
  setNotice: (text: string) => void;
  /** Restaurant build: opens Restaurant → Suppliers, where the ingredient supplier is chosen (phase 7). */
  onChangeSupplier?: () => void;
}) {
  const [quantities, setQuantities] = useState<Partial<Record<IngredientId, number>>>(() =>
    focusId && focusQuantity ? { [focusId]: focusQuantity } : {},
  );
  const [messages, setMessages] = useState<Partial<Record<IngredientId, string>>>({});
  const [group, setGroup] = useState<string>(
    focusId ? (INGREDIENTS[focusId]?.category ?? "all") : "all",
  );
  const focusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "center" });
  }, []);

  const day = save.business.calendar.businessDay;
  const event = eventForDay(day);
  const contract = save.business.supplierContract;
  const contractActive = isContractActive(contract, day);
  const prepCook = isHired(save.business.staff, "prep-cook");
  const fridge = fridgeStatus(save);
  // Restaurant build: weighed ingredients in the player's lb / kg (Settings); classic: lb.
  const measure = RESTAURANT_MODE ? measureOf(save) : "lb";

  /** − / +: the restaurant steps by ¼ for weighed goods (business/measure.ts); classic whole units. */
  const stepFor = (id: IngredientId, q: number, dir: 1 | -1) =>
    RESTAURANT_MODE ? stepMarketQuantity(id, q, dir) : stepPurchaseQuantity(q, dir);

  function quantityFor(id: IngredientId): number {
    // Restaurant: one lb / kg / piece to start (a plate uses a 0.3 lb tomato); classic: 5.
    return quantities[id] ?? (RESTAURANT_MODE ? 1 : DEFAULT_PURCHASE_QUANTITY);
  }

  /** Unified Restaurant: the restaurant's price (bulk discount + Campaign Supplier), the same App's purchase charges. */
  const quoteFor = (id: IngredientId, quantity: number) =>
    RESTAURANT_MODE ? restaurantQuote(save, id, quantity) : purchaseQuote(save, id, quantity);

  function handlePurchase(id: IngredientId) {
    const quantity = quantityFor(id);
    const quote = quoteFor(id, quantity);
    const result = purchaseIngredient(id, quantity);
    if (!result.ok) {
      const text =
        result.reason === "insufficientFunds"
          ? notEnoughMoneyText(quote.totalCost, save.credits)
          : result.reason === "insufficientStorage"
            ? `Not enough fridge space. ${fridgeSpaceText(quote.availableStorage)}`
            : result.reason === "exceedsShortageLimit"
              ? `Today's shortage limits a purchase to ${formatStockAmount(id, quote.maxQuantity ?? 0, measure)}.`
              : "That purchase couldn't be made.";
      setMessages((m) => ({ ...m, [id]: text }));
      return;
    }
    const bought = `Bought ${result.quantity} ${marketUnitLabel(id, measure, result.quantity)} ${INGREDIENTS[id].name} · ${formatUsd(result.totalCost)}`;
    setMessages((m) => ({ ...m, [id]: bought }));
    setNotice(`${bought}. It's in your Business fridge.`);
  }

  const groups = INGREDIENT_GROUPS.filter((g) => group === "all" || g.category === group);

  return (
    <div className="space-y-3">
      {RESTAURANT_MODE ? (
        <MarketPlanPanel
          save={save}
          purchaseIngredient={purchaseIngredient}
          {...(purchaseIngredients ? { purchaseIngredients } : {})}
          setNotice={setNotice}
          focused={focusPlan}
        />
      ) : null}
      <Panel className="p-3">
        <div className="flex items-center justify-between gap-2 font-ui text-[12.5px] font-extrabold text-walnut-dark">
          <span>❄️ {fridge.name}</span>
          <span data-testid="market-fridge">
            {formatQuantity(fridge.used)} / {fridge.capacity} used ·{" "}
            {formatQuantity(fridge.available)} free
          </span>
        </div>
        {RESTAURANT_MODE ? (
          <>
            <p className="mt-1 font-hand text-[15px] leading-snug text-walnut/65">
              Stock bought here goes into your restaurant fridge; every order you cook uses it.
            </p>
            <div
              className="mt-2 flex flex-wrap items-center justify-between gap-2"
              data-testid="market-supplier"
            >
              <span className="font-ui text-[12px] font-bold text-walnut/70">
                🚚 Supplier: {getSupplier(getSelectedSupplierId(save))?.name ?? "Local Market"}
                {supplierPriceNote(save)}
              </span>
              {onChangeSupplier ? (
                <KButton size="md" variant="ghost" onClick={onChangeSupplier}>
                  Change supplier →
                </KButton>
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-1 font-hand text-[15px] leading-snug text-walnut/65">
            Stock bought here goes into your Business fridge for Business orders. Campaign recipes
            pay for their ingredients automatically as you cook.
          </p>
        )}
        {contractActive && contract ? (
          <p className="mt-1 font-ui text-[12px] font-bold text-walnut/70">
            📜 {getSupplier(contract.supplierId)?.name ?? "Supplier"} contract: −
            {Math.round(contract.discount * 100)}% on {contract.minimumOrder}+ of one ingredient
            {event?.suspendsContractDiscount ? " (paused today)" : ""}.
          </p>
        ) : null}
        {prepCook ? (
          <p className="font-ui text-[12px] font-bold text-walnut/70">
            🧑‍🍳 Your Prep Cook's discount is included in every price.
          </p>
        ) : null}
      </Panel>

      {event ? (
        <Panel tone="cream" className="p-3">
          <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.12em] text-copper">
            🚚 Today · {event.name}
          </p>
          <p className="font-hand text-[15px] leading-snug text-walnut/65">
            {supplierEventSummary(event, contractActive)}
          </p>
        </Panel>
      ) : null}

      <div
        className="-mx-4 flex gap-2 overflow-x-auto no-scrollbar px-4"
        aria-label="Ingredient groups"
      >
        {[{ category: "all", label: "All", emoji: "🧺" }, ...INGREDIENT_GROUPS].map((g) => (
          <button
            key={g.category}
            type="button"
            onClick={() => setGroup(g.category)}
            aria-pressed={group === g.category}
            className={cn(
              "press h-12 min-w-12 shrink-0 rounded-full border px-3.5 font-ui text-[12.5px] font-extrabold",
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
        const ids = ALL_INGREDIENT_IDS.filter((id) => INGREDIENTS[id].category === g.category);
        if (ids.length === 0) return null;
        return (
          <section key={g.category}>
            <p className="mb-2 mt-1 font-display text-[16.5px] font-black text-walnut-dark">
              {g.emoji} {g.label}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {ids.map((id) => {
                const def = INGREDIENTS[id];
                const quantity = quantityFor(id);
                const quote = quoteFor(id, quantity);
                const unit = marketUnitLabel(id, measure, quantity);
                const perUnit = marketUnitLabel(id, measure, 1);
                const count = marketUnitCountText(id, measure);
                const stock = save.business.inventory[id]?.quantity ?? 0;
                const dishes = activeDishesUsing(save, id).length;
                const message = messages[id];
                const focused = id === focusId;
                return (
                  <article
                    key={id}
                    ref={focused ? focusRef : undefined}
                    data-ingredient={id}
                    className={cn(
                      "product-card flex flex-col rounded-[20px] border p-3 card-warm",
                      focused ? "border-copper ring-2 ring-copper/60" : "border-walnut/15",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[34px] leading-none" aria-hidden>
                        {INGREDIENT_EMOJI[id]}
                      </span>
                      {stock > 0 ? (
                        <Badge tone="sage">{formatStockAmount(id, stock, measure)} in stock</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 font-display text-[14.5px] font-black leading-tight text-walnut-dark">
                      {def.name}
                    </p>
                    <p className="font-ui text-[12.5px] font-extrabold text-copper">
                      {formatUsd(quote.unitCost)}
                      <span className="font-bold text-walnut/60">/{perUnit}</span>
                    </p>
                    {count ? (
                      <p
                        className="font-ui text-[12px] font-bold leading-tight text-walnut/55"
                        data-testid="unit-count"
                      >
                        {count}
                      </p>
                    ) : null}
                    <p className="font-hand text-[14px] leading-tight text-walnut/60">
                      Keeps {shelfLifeForIngredient(id)} days
                      {dishes > 0 ? ` · ${dishes} menu dish${dishes === 1 ? "" : "es"}` : ""}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setQuantities((q) => ({ ...q, [id]: stepFor(id, quantity, -1) }))
                        }
                        className="press grid h-12 w-12 place-items-center rounded-full border border-walnut/20 bg-ivory font-ui text-[18px] font-black text-walnut-dark"
                        aria-label={`Decrease quantity for ${def.name}`}
                      >
                        −
                      </button>
                      <span className="font-ui text-[15.5px] font-extrabold text-walnut-dark">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setQuantities((q) => ({ ...q, [id]: stepFor(id, quantity, 1) }))
                        }
                        className="press grid h-12 w-12 place-items-center rounded-full border border-walnut/20 bg-ivory font-ui text-[18px] font-black text-walnut-dark"
                        aria-label={`Increase quantity for ${def.name}`}
                      >
                        +
                      </button>
                    </div>
                    {RESTAURANT_MODE ? (
                      <BulkPresets
                        value={quantity}
                        label={marketUnitLabel(id, measure, 2)}
                        discountFor={(q) => ingredientBulkDiscount(id, q, measure)}
                        onPick={(q) => setQuantities((qs) => ({ ...qs, [id]: q }))}
                      />
                    ) : null}
                    {quote.bulkDiscount > 0 ? (
                      <p
                        className="mt-1 text-center font-ui text-[12px] font-bold text-olive"
                        data-testid="bulk-saving"
                      >
                        Bulk −{Math.round(quote.bulkDiscount * 100)}% · saves{" "}
                        {formatUsd(quote.listTotal - quote.totalCost)}
                      </p>
                    ) : null}
                    {message ? (
                      <p className="mt-1 text-center font-hand text-[13px] leading-tight text-copper">
                        {message}
                      </p>
                    ) : null}
                    <KButton
                      full
                      variant={quote.verdict === "ok" ? "copper" : "ghost"}
                      className="mt-auto h-12 px-2 text-[12.5px]"
                      onClick={() => handlePurchase(id)}
                    >
                      Buy {quantity} {unit} · {formatUsd(quote.totalCost)}
                    </KButton>
                    {/* What the purchase does, before the tap — the same verdict the purchase makes. */}
                    <p
                      className={cn(
                        "wallet-line mt-1 text-center font-ui text-[12px] font-bold leading-tight",
                        quote.verdict === "ok" ? "text-walnut/65" : "text-copper",
                      )}
                    >
                      {quote.verdict === "exceedsShortageLimit"
                        ? `Limited to ${formatStockAmount(id, quote.maxQuantity ?? 0, measure)} today.`
                        : quote.verdict === "insufficientFunds"
                          ? notEnoughMoneyText(quote.totalCost, save.credits)
                          : quote.verdict === "insufficientStorage"
                            ? `Not enough fridge space. ${fridgeSpaceText(quote.availableStorage)}`
                            : quantity >= LARGE_PURCHASE_QUANTITY
                              ? `You'll have ${balanceText(quote.remainingCredits)} remaining`
                              : `${balanceText(save.credits)} → ${balanceText(quote.remainingCredits)}`}
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
