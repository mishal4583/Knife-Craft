import { useState } from "react";
import { KButton } from "@/components/kc/common/primitives";
import { cn } from "@/lib/utils";
import type { RecipeDefinition } from "@/game/recipes/recipeTypes";
import type { IngredientId } from "@/game/definitions";
import { INGREDIENTS } from "@/game/definitions";
import { INGREDIENT_EMOJI } from "@/game/knives/knifeDefinitions";
import { formatQuantity } from "@/game/business/businessInventory";
import {
  formatStockAmount,
  itemCountText,
  marketUnitLabel,
  type Measure,
} from "@/game/business/measure";
import { QUICK_RESTOCK_FEE, type QuickRestockPlan } from "@/game/restaurant/quickRestock";
import { formatUsd } from "@/game/money";
import type { ServiceStockCheck, StockRow } from "@/game/restaurant/campaignStock";
import type { DayService } from "@/game/restaurant/restaurantDay";
import type {
  OrderService,
  ServiceSuppliesCheck,
  SupplyCheckRow,
} from "@/game/restaurant/serviceSupplies";
import type { SupplyId } from "@/game/business/businessSupplies";
import { getSupplyItem, packsText } from "@/game/business/businessSupplies";
import { SupplyBottle } from "./SupplyBottle";
import type { RestaurantNews } from "@/game/restaurant/restaurantNews";
import type { StaffRequirement } from "@/game/restaurant/staffRequirements";
import type { FridgeUsage } from "@/game/restaurant/fridgeUsage";
import type { KitLine } from "@/game/restaurant/restaurantMigration";
import type { DayStock, GuestStock } from "@/game/restaurant/preServiceCheck";
import { getSupplyItem as supplyItemOf } from "@/game/business/businessSupplies";

/**
 * PRE_SERVICE_CHECK (Unified Restaurant spec §6, §24–25) — shown before a
 * campaign service ONLY when something needs attention (missing or
 * expired stock). Everything comes from the save through
 * `serviceStockCheck`; this sheet keeps no state of its own.
 *
 *  - today's orders (the rolled tickets still to serve);
 *  - each ingredient: need / usable, ✓ or what's missing, with RESTOCK →
 *    the Market preselecting that ingredient (Market stays the only place
 *    ingredients are bought);
 *  - expired stock: THROW OUT EXPIRED (recorded as waste, no money);
 *  - what the missing stock costs against the wallet, and fridge space;
 *  - only when the wallet can't cover it: Grandma's pantry (free, the
 *    missing items only, never automatic);
 *  - START SERVICE once everything is ready.
 *
 * Phase 5: it is also the day's OPENING card. When a level opens a new
 * restaurant day it always shows ("Day N · Opening time", the day's services
 * by name and level) and its button opens the restaurant; before Level 15
 * there is no stock to check, so it is only the opening card.
 *
 * Phase G (from dine-in, L31): a Supplies section — clean place settings,
 * takeaway containers and bags (from L71), napkins, and the dish-soap and
 * cleaning-liquid bottles. Only missing settings / packaging block START;
 * napkins and bottles warn. Restock → the Market's Supplies on that line;
 * when the wallet can't cover what blocks, Grandma lends her spares.
 */
export function PreServiceCheck({
  levelNumber,
  day,
  credits,
  tickets,
  check,
  opening,
  onStart,
  onRestock,
  onThrowOutExpired,
  onUsePantry,
  onUpgradeFridge,
  onClose,
  services = [],
  supplies = { applies: false },
  onRestockSupply = () => {},
  onBorrowSpares = () => {},
  news = null,
  staff = [],
  onHireStaff = () => {},
  fridge = null,
  welcome = null,
  guests = null,
  onRestockGuest = () => {},
  dayStock = null,
  onRestockDay = () => {},
  measure = "lb",
  quickRestock = null,
  onQuickRestock = () => {},
  onBuyAllInMarket = null,
  firstRestock = false,
}: {
  levelNumber: number;
  day: number;
  credits: number;
  tickets: readonly RecipeDefinition[];
  check: ServiceStockCheck;
  /** Today's services when this level opens the day; null mid-day. */
  opening: DayService[] | null;
  onStart: () => void;
  onRestock: (ingredientId: IngredientId) => void;
  onThrowOutExpired: () => void;
  onUsePantry: () => void;
  onUpgradeFridge: () => void;
  onClose: () => void;
  /** Each ticket's dine-in / takeaway (phase G). */
  services?: readonly (OrderService | null)[];
  supplies?: ServiceSuppliesCheck;
  onRestockSupply?: (id: SupplyId) => void;
  onBorrowSpares?: () => void;
  /** What's new at this level and what's coming. */
  news?: RestaurantNews | null;
  /** This service's staff requirements; an unmet one blocks START. */
  staff?: readonly StaffRequirement[];
  onHireStaff?: () => void;
  /** The fridge's fill, from the fridge stage (L21); null before. */
  fridge?: FridgeUsage | null;
  /** Phase M: the starter crate an existing save received (shown until a service starts). */
  welcome?: readonly KitLine[] | null;
  /** Today's menu guests and their optional stock (never blocks START). */
  guests?: GuestStock | null;
  onRestockGuest?: (ingredientId: IngredientId, units: number) => void;
  /** Final economy pass: the whole day's stock (optional — never blocks START). */
  dayStock?: DayStock | null;
  onRestockDay?: (ingredientId: IngredientId, units: number) => void;
  /** Settings: weighed ingredients in lb or kg. */
  measure?: Measure;
  /** Quick restock: exactly the missing stock now, at a higher price (quickRestock.ts). */
  quickRestock?: QuickRestockPlan | null;
  onQuickRestock?: () => void;
  /** "Buy everything in the Market →": the Market's plan on Today (normal prices, audit 2026-10-08). */
  onBuyAllInMarket?: (() => void) | null;
  /** The player has never bought an ingredient: Grandma walks them through the first restock. */
  firstRestock?: boolean;
}) {
  // Optional sections start folded so START and what blocks it stay in view.
  const [showGuests, setShowGuests] = useState(false);
  const [showDay, setShowDay] = useState(false);
  const stock = check.applies ? check : null;
  const sup = supplies.applies ? supplies : null;
  const fridgeShort = !!stock && stock.storageNeeded > stock.storageFree;
  const canStart =
    (!stock || (stock.ready && !stock.rows.some((r) => r.expired > 0 && r.usable < r.needed))) &&
    (!sup || sup.ready) &&
    staff.every((r) => r.met);
  const staffMissing = staff.filter((r) => !r.met);
  /** What blocks START, for its label: stock or supplies first, otherwise staff. */
  const stockOrSuppliesShort =
    (!!stock && (!stock.ready || stock.rows.some((r) => r.expired > 0 && r.usable < r.needed))) ||
    (!!sup && !sup.ready);
  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center"
      data-testid="pre-service-check"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-walnut-dark/45 backdrop-blur-[2px]"
      />
      <div className="anim-up relative m-3 flex max-h-[calc(100%-24px)] w-[calc(100%-24px)] flex-col rounded-[26px] border border-walnut/20 bg-[linear-gradient(170deg,var(--color-ivory),var(--color-cream))] shadow-lift">
        <div className="px-5 pb-2 pt-4">
          <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-walnut/20" />
          <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-[0.14em] text-walnut/60">
            Day {day} · {opening ? "Opening time" : `Level ${levelNumber}`}
          </p>
          <p className="font-display text-[22px] font-black text-walnut-dark">
            {opening ? `Good morning! Day ${day}` : "Pre-Service Check"}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          {welcome ? <WelcomeCrate kit={welcome} /> : null}
          {news &&
          (news.systems.length > 0 ||
            news.dishes.length > 0 ||
            news.cuisines.length > 0 ||
            news.comingUp.length > 0) ? (
            <NewsCard news={news} />
          ) : null}
          {opening ? (
            <div
              className="mb-2 rounded-2xl border border-walnut/15 bg-ivory/70 p-3"
              data-testid="psc-opening"
            >
              <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
                Today's services
              </p>
              <ul className="mt-1 space-y-0.5">
                {opening.map((s) => (
                  <li key={s.name} className="font-ui text-[14.5px] font-bold text-walnut-dark">
                    {s.name} · Level {s.levelNumber}
                  </li>
                ))}
              </ul>
              <p className="mt-1 font-ui text-[12.5px] text-walnut/70">
                After the last service it's closing time: clean up and count the day.
              </p>
            </div>
          ) : null}
          <p className="mt-1 font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
            {opening ? `Level ${levelNumber} · today's orders` : "Today's orders"}
          </p>
          <ul className="mt-1 space-y-0.5" data-testid="psc-orders">
            {tickets.map((r, i) => (
              <li key={`${r.id}-${i}`} className="font-ui text-[14.5px] font-bold text-walnut-dark">
                {r.name}
                {services[i] === "takeaway" ? (
                  <span className="font-ui text-[12.5px] font-extrabold text-copper">
                    {" "}
                    · 🥡 takeaway
                  </span>
                ) : null}
              </li>
            ))}
          </ul>

          {stock && !stock.ready && firstRestock ? (
            <div
              className="mt-3 rounded-2xl border-2 border-copper/60 bg-gold/15 p-3"
              data-testid="psc-first-restock"
            >
              <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-copper">
                👵 Grandma's first shopping trip
              </p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 font-ui text-[13.5px] font-bold text-walnut-dark">
                <li>Tap 🛒 Buy everything in the Market below.</li>
                <li>In the Market, tap Buy all — it buys what today's services need.</li>
                <li>Tap ↩ Back to the Pre-Service Check, then start the service.</li>
              </ol>
              <p className="mt-1 font-hand text-[16px] leading-snug text-walnut/75">
                “Buy before you cook, and only what you'll use — fresh food doesn't wait.”
              </p>
            </div>
          ) : null}

          {stock ? (
            <>
              <p className="mt-3 font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
                Ingredients
              </p>
              <ul className="mt-1 divide-y divide-walnut/10" data-testid="psc-ingredients">
                {stock.rows.map((row) => (
                  <IngredientRow
                    key={row.ingredientId}
                    row={row}
                    measure={measure}
                    onRestock={onRestock}
                  />
                ))}
              </ul>
            </>
          ) : null}

          {staff.length > 0 ? (
            <>
              <p className="mt-3 font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
                Staff for this service
              </p>
              <ul className="mt-1 divide-y divide-walnut/10" data-testid="psc-staff">
                {staff.map((r) => (
                  <li
                    key={r.id}
                    className="flex min-h-12 items-center gap-2 py-1.5"
                    data-psc-staff={r.id}
                    data-psc-status={r.met ? "ok" : "missing"}
                  >
                    <span className="text-[20px]" aria-hidden>
                      {r.kind === "specialist" ? "👩‍🍳" : "🧑‍🍳"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-ui text-[14.5px] font-bold text-walnut-dark">{r.title}</p>
                      <p
                        className={cn(
                          "font-ui text-[12.5px]",
                          r.met ? "text-walnut/60" : "text-tomato",
                        )}
                      >
                        {r.why}
                      </p>
                    </div>
                    {r.met ? (
                      <span className="font-ui text-[13.5px] font-extrabold text-sage">
                        ✓ On staff
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {staffMissing.length > 0 ? (
                <KButton
                  size="sm"
                  variant="copper"
                  className="mt-2 h-auto min-h-12 py-2 leading-tight"
                  onClick={onHireStaff}
                >
                  Hire {staffMissing.map((r) => r.title).join(", ")} → Staff (free to hire)
                </KButton>
              ) : null}
            </>
          ) : null}

          {fridge && fridge.status !== "ok" ? (
            <div
              className="mt-3 rounded-2xl border border-tomato/30 bg-tomato/10 p-3"
              data-testid="psc-fridge"
              data-fridge-status={fridge.status}
            >
              <p className="font-ui text-[13.5px] font-bold text-walnut-dark">
                {fridge.status === "full" ? "⛔ Fridge full" : "⚠️ Fridge nearly full"} ·{" "}
                {fridge.used} / {fridge.capacity} units
              </p>
              <p className="font-ui text-[12.5px] text-walnut/70">
                {fridge.free} units of space left. Use what you have, throw out expired food, or
                upgrade the refrigerator.
              </p>
              <KButton
                size="sm"
                variant="ghost"
                className="mt-2 min-h-12"
                onClick={onUpgradeFridge}
              >
                Manage fridge →
              </KButton>
            </div>
          ) : null}

          {sup ? (
            <>
              <p className="mt-3 font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
                Supplies · {sup.dineIn} dine-in
                {sup.takeaway > 0 ? ` · ${sup.takeaway} takeaway` : ""}
              </p>
              <ul className="mt-1 divide-y divide-walnut/10" data-testid="psc-supplies">
                {sup.rows.map((row) => (
                  <SupplyRow key={row.id} row={row} onRestock={onRestockSupply} />
                ))}
              </ul>
              <div className="divide-y divide-walnut/10" data-testid="psc-bottles">
                <SupplyBottle
                  bottle={sup.soap}
                  per="wash"
                  onRestock={() => onRestockSupply("dish-soap")}
                />
                <SupplyBottle
                  bottle={sup.cleaner}
                  per="closing"
                  onRestock={() => onRestockSupply("cleaning-liquid")}
                />
              </div>
              {!sup.ready ? (
                <div
                  className="mt-2 rounded-2xl border border-walnut/15 bg-ivory/70 p-3"
                  data-testid="psc-supplies-summary"
                >
                  <p className="font-ui text-[13.5px] font-bold text-walnut-dark">
                    The service can't start without these · {formatUsd(sup.missingCost)}
                  </p>
                  {!sup.affordable ? (
                    <>
                      <p className="mt-1 font-ui text-[13.5px] font-bold text-tomato">
                        Not enough money — need {formatUsd(sup.missingCost - credits)} more.
                      </p>
                      <KButton
                        size="sm"
                        variant="sage"
                        className="mt-2 h-auto min-h-12 py-2 leading-tight"
                        onClick={onBorrowSpares}
                      >
                        🧺 Borrow Grandma's spares (free, just what's missing)
                      </KButton>
                      <p className="mt-1 font-ui text-[12.5px] text-walnut/70">
                        Emergency Service: this service's orders earn their pay but no quality
                        bonus.
                      </p>
                    </>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          {stock && guests && guests.dishes.length > 0 ? (
            <div className="mt-3" data-testid="psc-guests">
              <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
                🍽️ Menu guests today · optional
              </p>
              <p className="font-ui text-[12.5px] text-walnut/70">
                {guests.dishes.join(", ")} — they order after your own orders.
                {guests.rows.length === 0 ? " ✓ Stocked for every guest." : " Stock for them:"}
              </p>
              {guests.rows.length > 0 ? (
                <KButton
                  size="sm"
                  variant="ghost"
                  className="mt-1 min-h-12"
                  onClick={() => setShowGuests((v) => !v)}
                >
                  {showGuests ? "Hide" : `Show ${guests.rows.length} ingredients`}
                </KButton>
              ) : null}
              {guests.rows.length > 0 && showGuests ? (
                <ul className="mt-1 divide-y divide-walnut/10">
                  {guests.rows.map((row) => (
                    <li
                      key={row.ingredientId}
                      className="flex min-h-12 items-center gap-2 py-1.5"
                      data-psc-guest-ingredient={row.ingredientId}
                    >
                      <span className="text-[20px]" aria-hidden>
                        {INGREDIENT_EMOJI[row.ingredientId]}
                      </span>
                      <p className="min-w-0 flex-1 font-ui text-[14.5px] font-bold text-walnut-dark">
                        {INGREDIENTS[row.ingredientId].name}
                      </p>
                      <KButton
                        size="sm"
                        variant="ghost"
                        className="min-h-12"
                        onClick={() => onRestockGuest(row.ingredientId, row.buyUnits)}
                      >
                        Restock {row.buyUnits}{" "}
                        {marketUnitLabel(row.ingredientId, measure, row.buyUnits)} ·{" "}
                        {formatUsd(row.cost)}
                      </KButton>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {stock && dayStock && dayStock.rows.length > 0 ? (
            <div
              className="mt-3 rounded-2xl border border-walnut/15 bg-ivory/70 p-3"
              data-testid="psc-day-stock"
            >
              <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
                🗓️ Stock the whole day · optional
              </p>
              <p className="font-ui text-[12.5px] text-walnut/70">
                Everything for today's {dayStock.levels.length} services (Levels{" "}
                {dayStock.levels.join(", ")}) in one go: {formatQuantity(dayStock.totalUnits)} units
                · {formatUsd(dayStock.totalCost)}
                {dayStock.bulkSaving > 0
                  ? ` · the bulk price saves ${formatUsd(dayStock.bulkSaving)}`
                  : ""}
                .
              </p>
              <p
                className={cn(
                  "mt-1 font-ui text-[12.5px] font-bold",
                  dayStock.fits ? "text-olive" : "text-copper",
                )}
              >
                {dayStock.fits
                  ? `✓ Fits your fridge (${formatQuantity(dayStock.storageFree)} units free).`
                  : `Needs ${formatQuantity(dayStock.totalUnits)} units — your fridge has ${formatQuantity(dayStock.storageFree)} free. Keep stocking service by service, or get a bigger fridge.`}
              </p>
              {dayStock.fits ? (
                <KButton
                  size="sm"
                  variant="ghost"
                  className="mt-1 min-h-12"
                  onClick={() => setShowDay((v) => !v)}
                >
                  {showDay ? "Hide" : `Show ${dayStock.rows.length} ingredients`}
                </KButton>
              ) : null}
              {dayStock.fits && showDay ? (
                <ul className="mt-1 divide-y divide-walnut/10">
                  {dayStock.rows.map((row) => (
                    <li
                      key={row.ingredientId}
                      className="flex min-h-12 items-center gap-2 py-1.5"
                      data-psc-day-ingredient={row.ingredientId}
                    >
                      <span className="text-[20px]" aria-hidden>
                        {INGREDIENT_EMOJI[row.ingredientId]}
                      </span>
                      <p className="min-w-0 flex-1 font-ui text-[14.5px] font-bold text-walnut-dark">
                        {INGREDIENTS[row.ingredientId].name}
                      </p>
                      <KButton
                        size="sm"
                        variant="ghost"
                        className="min-h-12"
                        onClick={() => onRestockDay(row.ingredientId, row.buyUnits)}
                      >
                        Restock {row.buyUnits}{" "}
                        {marketUnitLabel(row.ingredientId, measure, row.buyUnits)} ·{" "}
                        {formatUsd(row.cost)}
                      </KButton>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {stock?.hasExpired ? (
            <div className="mt-3 rounded-2xl border border-tomato/30 bg-tomato/10 p-3">
              <p className="font-ui text-[13.5px] font-bold text-walnut-dark">
                Some stock has expired and can't be served.
              </p>
              <KButton
                size="sm"
                variant="ghost"
                className="mt-2 min-h-12"
                onClick={onThrowOutExpired}
              >
                🗑 Throw Out Expired
              </KButton>
            </div>
          ) : null}

          {stock && !stock.ready ? (
            <div
              className="mt-3 rounded-2xl border border-walnut/15 bg-ivory/70 p-3"
              data-testid="psc-summary"
            >
              <p className="font-ui text-[13.5px] font-bold text-walnut-dark">
                Missing: {stock.missingRows.length}{" "}
                {stock.missingRows.length === 1 ? "item" : "items"} · {formatUsd(stock.missingCost)}
              </p>
              <p className="font-ui text-[12.5px] text-walnut/70">You have {formatUsd(credits)}.</p>
              {onBuyAllInMarket && stock.affordable ? (
                <KButton
                  size="sm"
                  variant="sage"
                  full
                  className="mt-2 h-auto min-h-12 py-2 leading-tight"
                  onClick={onBuyAllInMarket}
                >
                  🛒 Buy everything in the Market →
                </KButton>
              ) : null}
              {quickRestock && quickRestock.affordable ? (
                <div
                  className="mt-2 rounded-2xl border border-copper/40 bg-gold/10 p-2.5"
                  data-testid="psc-quick-restock"
                >
                  <KButton
                    size="sm"
                    variant="copper"
                    full
                    className="h-auto min-h-12 py-2 leading-tight"
                    disabled={!quickRestock.fits}
                    onClick={onQuickRestock}
                  >
                    ⚡ Quick restock here · {formatUsd(quickRestock.totalCost)}
                  </KButton>
                  <p
                    className="mt-1.5 font-ui text-[12.5px] font-bold leading-snug text-copper"
                    data-testid="psc-quick-warning"
                  >
                    ⚠️ The same stock costs {formatUsd(quickRestock.extraCost)} more than in the
                    Market (+{Math.round(QUICK_RESTOCK_FEE * 100)}%). Buying in the Market before
                    the service saves it.
                  </p>
                  {!quickRestock.fits ? (
                    <p className="mt-1 font-ui text-[12.5px] font-bold text-tomato">
                      Not enough fridge space for it ({formatQuantity(quickRestock.storageFree)}{" "}
                      units free).
                    </p>
                  ) : null}
                </div>
              ) : null}
              {!stock.affordable ? (
                <>
                  <p className="mt-1 font-ui text-[13.5px] font-bold text-tomato">
                    Not enough money — need {formatUsd(stock.missingCost - credits)} more.
                  </p>
                  <KButton size="sm" variant="sage" className="mt-2 min-h-12" onClick={onUsePantry}>
                    🧺 Use Grandma's pantry (free, this service only)
                  </KButton>
                  <p
                    className="mt-1 font-ui text-[12.5px] text-walnut/70"
                    data-testid="psc-emergency-note"
                  >
                    Emergency Service: this service's orders earn their pay but no quality bonus.
                    Stocking up yourself is better.
                  </p>
                </>
              ) : null}
              {fridgeShort ? (
                <>
                  <p className="mt-1 font-ui text-[13.5px] font-bold text-tomato">
                    Your refrigerator is full: this needs {stock.storageNeeded} units,{" "}
                    {stock.storageFree} free.
                  </p>
                  <KButton
                    size="sm"
                    variant="ghost"
                    className="mt-2 min-h-12"
                    onClick={onUpgradeFridge}
                  >
                    Manage fridge →
                  </KButton>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-walnut/10 px-5 py-3">
          <KButton variant="ghost" className="min-h-12" onClick={onClose}>
            Back
          </KButton>
          <KButton full className="min-h-12" disabled={!canStart} onClick={onStart}>
            {canStart
              ? opening
                ? "OPEN THE RESTAURANT"
                : "START SERVICE"
              : stockOrSuppliesShort
                ? "Restock to start"
                : "Hire staff to start"}
          </KButton>
        </div>
      </div>
    </div>
  );
}

function IngredientRow({
  row,
  measure,
  onRestock,
}: {
  row: StockRow;
  measure: Measure;
  onRestock: (id: IngredientId) => void;
}) {
  const ok = row.missing === 0;
  const count = itemCountText(row.ingredientId, row.needed);
  return (
    <li
      className="flex min-h-12 items-center gap-2 py-1.5"
      data-psc-ingredient={row.ingredientId}
      data-psc-status={ok ? "ok" : "missing"}
    >
      <span className="text-[20px]" aria-hidden>
        {INGREDIENT_EMOJI[row.ingredientId]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-ui text-[14.5px] font-bold text-walnut-dark">
          {INGREDIENTS[row.ingredientId].name}
        </p>
        <p className={cn("font-ui text-[12.5px]", ok ? "text-walnut/60" : "text-tomato")}>
          Need {formatStockAmount(row.ingredientId, row.needed, measure)}
          {count ? ` (${count})` : ""} · have{" "}
          {formatStockAmount(row.ingredientId, row.usable, measure)}
          {row.expired > 0
            ? ` (+${formatStockAmount(row.ingredientId, row.expired, measure)} expired)`
            : ""}
        </p>
      </div>
      {ok ? (
        <span className="font-ui text-[13.5px] font-extrabold text-sage">✓ Ready</span>
      ) : (
        <KButton
          size="sm"
          variant="copper"
          className="min-h-12"
          onClick={() => onRestock(row.ingredientId)}
        >
          Restock {row.buyUnits} {marketUnitLabel(row.ingredientId, measure, row.buyUnits)} ·{" "}
          {formatUsd(row.quote?.totalCost ?? 0)}
        </KButton>
      )}
    </li>
  );
}

/** Phase M: what an existing save found when it moved into the unified restaurant. */
function WelcomeCrate({ kit }: { kit: readonly KitLine[] }) {
  const lines = kit.map((k) =>
    k.kind === "ingredient"
      ? `${k.units} ${INGREDIENTS[k.id].name}`
      : `${k.units.toLocaleString("en-US")} × ${supplyItemOf(k.id)?.name ?? k.id}`,
  );
  return (
    <div
      className="mb-2 rounded-2xl border border-olive/40 bg-[linear-gradient(170deg,var(--color-ivory),rgba(120,140,60,0.12))] p-3"
      data-testid="psc-welcome"
    >
      <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-olive">
        🎁 Welcome to your restaurant
      </p>
      <p className="font-hand text-[17px] leading-snug text-walnut">
        “Your kitchen is a real restaurant now — stock, supplies and a team. I packed you a starter
        crate so you can keep cooking.” — Grandma
      </p>
      <p className="mt-1 font-ui text-[12.5px] text-walnut/70">
        Free, once: {lines.join(" · ")}. After this, the Market is where you restock.
      </p>
    </div>
  );
}

function NewsCard({ news }: { news: RestaurantNews }) {
  const fresh = news.systems.length > 0 || news.dishes.length > 0 || news.cuisines.length > 0;
  return (
    <div
      className="mb-2 rounded-2xl border border-copper/30 bg-[linear-gradient(170deg,var(--color-ivory),rgba(214,160,90,0.12))] p-3"
      data-testid="psc-news"
    >
      <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-copper">
        📰 {fresh ? "New at your restaurant" : "Coming up"}
      </p>
      {news.systems.map((s) => (
        <div key={s.id} className="mt-1" data-news-system={s.id}>
          <p className="font-ui text-[14.5px] font-extrabold text-walnut-dark">{s.title}</p>
          <p className="font-hand text-[17px] leading-snug text-walnut">“{s.intro}”</p>
        </div>
      ))}
      {news.chain ? (
        <p
          className="mt-1 font-ui text-[12.5px] font-bold text-walnut-dark"
          data-testid="psc-chain"
        >
          {news.chain.join(" → ")}
        </p>
      ) : null}
      {news.cuisines.map((c) => (
        <p key={c.name} className="mt-1 font-ui text-[13.5px] font-bold text-walnut-dark">
          🌍 {c.name} cuisine opens{c.specialist ? ` · needs the ${c.specialist}` : ""}
        </p>
      ))}
      {news.dishes.length > 0 ? (
        <div className="mt-1" data-testid="psc-news-dishes">
          <p className="font-ui text-[13.5px] font-bold text-walnut-dark">
            🍽️ New on the menu: {news.dishes.map((d) => d.name).join(", ")}
          </p>
          {news.dishWhy ? (
            <p className="font-ui text-[12.5px] text-walnut/70">{news.dishWhy}</p>
          ) : null}
        </div>
      ) : null}
      {news.comingUp.length > 0 ? (
        <ul className="mt-1 space-y-0.5" data-testid="psc-coming-up">
          {news.comingUp.map((c) => (
            <li key={`${c.level}-${c.text}`} className="font-ui text-[12.5px] text-walnut/70">
              Level {c.level}: {c.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SupplyRow({ row, onRestock }: { row: SupplyCheckRow; onRestock: (id: SupplyId) => void }) {
  const ok = row.missing === 0;
  const item = getSupplyItem(row.id);
  return (
    <li
      className="flex min-h-12 items-center gap-2 py-1.5"
      data-psc-supply={row.id}
      data-psc-status={ok ? "ok" : row.blocking ? "missing" : "warning"}
    >
      <span className="text-[20px]" aria-hidden>
        {item?.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-ui text-[14.5px] font-bold text-walnut-dark">{row.label}</p>
        <p
          className={cn(
            "font-ui text-[12.5px]",
            ok ? "text-walnut/60" : row.blocking ? "text-tomato" : "text-copper",
          )}
        >
          Need {row.need} · have {row.have}
          {row.dirty > 0 ? ` (+${row.dirty} waiting for soap)` : ""}
          {!ok && !row.blocking ? " · ⚠️ guests go without" : ""}
        </p>
      </div>
      {ok ? (
        <span className="font-ui text-[13.5px] font-extrabold text-sage">✓ Ready</span>
      ) : (
        <KButton
          size="sm"
          variant={row.blocking ? "copper" : "ghost"}
          className="min-h-12"
          onClick={() => onRestock(row.id)}
        >
          Restock {item ? packsText(item, row.packs) : row.packs} · {formatUsd(row.cost)}
        </KButton>
      )}
    </li>
  );
}
