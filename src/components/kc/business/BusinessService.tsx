import type { ScreenId } from "../data";
import { RushRestockActions } from "./RushRestockActions";
import type { RushRestockOutcome, RushRestockPayment } from "@/game/business/businessRushRestock";
import type { SaveData } from "@/game/SaveManager";
import type { ServiceSession } from "@/game/service/ServiceManager";
import { KButton, Panel, ScreenHeader, Divider, Badge } from "../common/primitives";
import { BusinessCash } from "./BusinessCash";
import { formatUsd } from "@/game/business/businessCurrency";
import { BottomNav } from "../Kitchen";
import { getCampaignRecipe } from "@/game/recipes/campaignRecipes";
import { INGREDIENTS } from "@/game/definitions";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import type { IngredientId } from "@/game/definitions";
import {
  businessDishForRecipeId,
  businessDishRequirements,
} from "@/game/business/businessServiceCatalog";
import { usableQuantity } from "@/game/business/perishability";
import { formatQuantity } from "@/game/business/businessInventory";
import { displayMeasure, formatStockAmount } from "@/game/business/measure";
import { realCogsFor } from "@/game/business/BusinessFinanceManager";
import { orderCompletedDelta } from "@/game/business/PopularityManager";
import {
  BASE_CUSTOMERS_PER_DAY,
  businessCustomerPayment,
  businessCustomersToday,
  businessOrderAvailability,
} from "@/game/business/BusinessServiceManager";
import { BusinessPaymentLines } from "./BusinessPaymentLines";
import { EndlessDayEvents } from "./EndlessDayEvents";
import { usesRestaurantDemand } from "@/game/restaurant/endlessDemand";

const FLOW_STEPS = [
  "Order",
  "Ingredients",
  "Prepare",
  "Serve",
  "Payment",
  "Popularity at close",
] as const;

/**
 * BUSINESS_SERVICE — Economy V3 Phase 14, Checkpoint 3. Business Mode's
 * own "open the counter" screen: shows the current generated order (a
 * real Business Dish, never an internal recipe id/prep-step name), its
 * live current menu price (read from the SAME `businessDishPrice` the
 * Menu screen itself shows — never a second pricing computation) with
 * the popularity modifier and what the customer pays
 * (`businessCustomerPayment`, the function serveBusinessOrder charges), and
 * whether Business Inventory can currently fulfill it.
 *
 * This is the checkpoint's own explicit "ingredient availability check"
 * gate made visible: "Start Preparing" is only enabled once the dish's
 * real ingredient requirements are actually in usable (non-expired)
 * stock — an unavailable order is never accepted into the real,
 * existing Preparation gameplay (App.tsx's `enterBusinessPreparation`
 * re-checks this same gate again immediately before entering, so this
 * screen is a courtesy, not the only enforcement point).
 */
export function BusinessService({
  go,
  save,
  businessServiceSession,
  onStartService,
  onEnterPreparation,
  rushRestock,
  rushAdAvailable,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  businessServiceSession: ServiceSession | null;
  onStartService: () => void;
  onEnterPreparation: () => void;
  rushRestock: (payment: RushRestockPayment) => Promise<RushRestockOutcome>;
  rushAdAvailable: boolean;
}) {
  const order = businessServiceSession?.current;
  const dish = order ? businessDishForRecipeId(order.recipe.id) : undefined;
  // Menu price × willingness-to-pay — the same function serveBusinessOrder charges with.
  const payment = dish ? businessCustomerPayment(save, dish) : null;
  // Order frequency — today's customer allowance (derived from start-of-day popularity).
  const customers = businessCustomersToday(save);
  const customerPays = payment?.customerPays ?? 0;
  const availability = dish ? businessOrderAvailability(save, dish) : null;
  const emoji = dish ? (getCampaignRecipe(dish.sourceRecipeId)?.emoji ?? "🍽️") : "🍽️";
  const businessDay = save.business.calendar.businessDay;
  const requirements = dish ? businessDishRequirements(dish) : [];
  const needTotals = new Map<IngredientId, number>();
  for (const r of requirements) {
    needTotals.set(r.ingredientId, (needTotals.get(r.ingredientId) ?? 0) + r.quantity);
  }
  const needs = [...needTotals];
  // The same real-cost function serveBusinessOrder charges as COGS — never a second estimate.
  const cogs = realCogsFor(save.business.inventory, requirements);
  const stepIndex = !order ? 0 : availability?.available ? 2 : 1;

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(216,168,78,0.28),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title="Service"
          subtitle="open the counter, serve real customers"
          onBack={() => go("business")}
          right={<BusinessCash cents={save.credits} />}
        />

        <div className="px-4 pt-2">
          <Panel className="mb-3 p-3">
            <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
              {FLOW_STEPS.map((step, i) => (
                <span key={step} className="flex items-center gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 font-ui text-[11.5px] font-extrabold uppercase tracking-[0.1em] ${i === stepIndex ? "bg-copper text-ivory" : i < stepIndex ? "text-olive" : "text-walnut/45"}`}
                  >
                    {i < stepIndex ? "✓ " : ""}
                    {step}
                  </span>
                  {i < FLOW_STEPS.length - 1 ? (
                    <span className="text-[11.5px] text-walnut/35">→</span>
                  ) : null}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-center font-hand text-[15px] leading-snug text-walnut/60">
              The customer pays your menu price × a popularity modifier, and that payment is the
              revenue recorded. Serving uses the stock. A day with service earns +
              {orderCompletedDelta({ onTime: true })} popularity at close. Served today:{" "}
              {save.business.finance.dailyAccumulator.ordersServed ?? 0} · Revenue today:{" "}
              {formatUsd(save.business.finance.dailyAccumulator.revenue)}.
            </p>
          </Panel>
          <Panel className="mb-3 p-3">
            <div className="flex items-center justify-between">
              <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-[0.14em] text-walnut/60">
                Customers Today
              </p>
              <p className="font-display text-[17px] font-black text-walnut-dark">
                {customers.served} / {customers.target} served
              </p>
            </div>
            <p className="font-hand text-[15px] leading-snug text-walnut/60">
              {usesRestaurantDemand(save) ? (
                // Endless Restaurant: the target (businessCustomersToday) comes from the
                // restaurant's demand, today's events and the team's capacity — not popularity alone.
                <>
                  {customers.remaining} remaining · Today's expected customers: {customers.target} —
                  set by your popularity, menu and today's events, up to what your team can serve.
                </>
              ) : (
                <>
                  {customers.remaining} remaining · popularity {customers.popularity}/100 brings{" "}
                  {customers.target} customers today (×{customers.multiplier.toFixed(2)} of{" "}
                  {BASE_CUSTOMERS_PER_DAY}).
                </>
              )}
            </p>
          </Panel>
          <EndlessDayEvents save={save} />
          {customers.complete ? (
            <Panel className="p-4 text-center">
              <p className="font-display text-[18px] font-black text-walnut-dark">
                Today's customers are complete.
              </p>
              <p className="mt-1 font-hand text-[16px] leading-snug text-walnut/70">
                No more customers will arrive today. End the Business Day from the Dashboard.
              </p>
              <Divider />
              <KButton full onClick={() => go("business")}>
                Go to Dashboard →
              </KButton>
            </Panel>
          ) : !order || !dish ? (
            <Panel className="p-4 text-center">
              <p className="font-hand text-[17px] leading-snug text-walnut/70">
                Nobody's waiting yet. Open the counter to take your first real order.
              </p>
              <Divider />
              <KButton full onClick={onStartService}>
                Open the Counter →
              </KButton>
            </Panel>
          ) : (
            <Panel className="p-4">
              <p className="font-ui text-[11.5px] font-extrabold uppercase tracking-[0.2em] text-copper">
                {order.customer.avatarEmoji} {order.customer.name} wants
              </p>
              <p className="mt-1.5 font-display text-[20px] font-black leading-tight text-walnut-dark">
                {emoji} {dish.name}
              </p>
              <p className="font-hand text-[15px] leading-tight text-walnut/60">
                {dish.description}
              </p>
              <Divider />
              {payment ? <BusinessPaymentLines payment={payment} /> : null}
              {requirements.length > 0 ? (
                <div className="mt-1">
                  {needs.map(([id, need]) => {
                    const have = usableQuantity(save.business.inventory, id, businessDay);
                    return (
                      <div key={id} className="flex items-center justify-between py-0.5">
                        <span className="font-hand text-[16px] text-walnut/70">
                          {INGREDIENT_EMOJI[id] ?? ""} {INGREDIENTS[id]?.name ?? id}
                        </span>
                        <span
                          className={`font-ui text-[13.5px] font-bold tabular-nums ${have >= need ? "text-olive" : "text-copper"}`}
                        >
                          {have >= need ? "✓" : "✗"} need{" "}
                          {formatStockAmount(id, need, displayMeasure())} · have{" "}
                          {formatStockAmount(id, have, displayMeasure())}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {availability?.available ? (
                <p className="mt-1 font-hand text-[15px] leading-snug text-walnut/60">
                  Food cost {formatUsd(cogs)} from your stock → margin{" "}
                  {formatUsd(customerPays - cogs)} on this plate.
                </p>
              ) : null}
              <Divider />
              {availability?.available ? (
                <>
                  <p className="mb-2 text-center font-hand text-[16px] text-olive">
                    Everything's in stock. Ready when you are.
                  </p>
                  <KButton full onClick={onEnterPreparation}>
                    Start Preparing →
                  </KButton>
                </>
              ) : (
                <>
                  <p className="mb-2 text-center font-hand text-[16px] text-copper">
                    Missing:{" "}
                    {(availability && !availability.available ? availability.missing : [])
                      .map((id) => `${INGREDIENT_EMOJI[id] ?? ""} ${INGREDIENTS[id]?.name ?? id}`)
                      .join(", ")}
                    . Restock before this order can be accepted.
                  </p>
                  {dish ? (
                    <RushRestockActions
                      save={save}
                      dish={dish}
                      go={go}
                      rushRestock={rushRestock}
                      rushAdAvailable={rushAdAvailable}
                    />
                  ) : null}
                </>
              )}
              <div className="mt-3 flex justify-center">
                <Badge tone="sage">One order at a time — same real Preparation gameplay</Badge>
              </div>
            </Panel>
          )}
        </div>
      </div>
      <BottomNav active="business" go={go} />
    </div>
  );
}
