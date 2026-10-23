import { useState, type ReactNode } from "react";
import { KButton } from "@/components/kc/common/primitives";
import { cn } from "@/lib/utils";
import { InfoTip, StatChip } from "@/components/kc/common/InfoTip";
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
import { getSupplyItem, packsText, supplyPackPrice } from "@/game/business/businessSupplies";
import type { ToolRow, ToolsCheck } from "@/game/restaurant/kitchenTools";
import { SupplyBottle } from "./SupplyBottle";
import { CoverActions, type CoverAdOutcome } from "./CoverActions";
import type { CoverOffer, CoverPart } from "@/game/restaurant/serviceCover";
import type { RestaurantNews } from "@/game/restaurant/restaurantNews";
import type { StaffRequirement } from "@/game/restaurant/staffRequirements";
import type { FridgeUsage } from "@/game/restaurant/fridgeUsage";
import type { KitLine } from "@/game/restaurant/restaurantMigration";
import type { DayStock, GuestStock } from "@/game/restaurant/preServiceCheck";
import { getSupplyItem as supplyItemOf } from "@/game/business/businessSupplies";

function RoutineStatus({
  icon,
  label,
  detail,
  tone,
  onClick,
  testId,
}: {
  icon: string;
  label: string;
  detail: string;
  tone: "ready" | "attention";
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      data-status={tone}
      className={cn(
        "press relative min-h-[58px] rounded-xl border px-2 py-1.5 pr-5 text-left",
        tone === "attention" ? "border-copper/25 bg-gold/10" : "border-olive/15 bg-ivory/70",
      )}
    >
      <span className="block font-ui text-[11.5px] font-extrabold text-walnut-dark">
        <span aria-hidden>{icon} </span>
        {label}
      </span>
      <span
        className={cn(
          "mt-0.5 block font-ui text-[11px] leading-tight",
          tone === "attention" ? "font-bold text-copper" : "text-walnut/65",
        )}
      >
        {detail}
      </span>
      <span
        className="absolute right-2 top-1/2 -translate-y-1/2 font-ui text-[16px] font-black text-walnut/35"
        aria-hidden
      >
        ›
      </span>
    </button>
  );
}

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
 *  - only when the wallet can't cover it (from Level 3): 🎬 watch an ad
 *    for the missing items, or 💳 supplier credit when no ad can be shown
 *    (serviceCover.ts — developer 2026-10-10);
 *  - START SERVICE once everything is ready.
 *
 * Phase 5: it is also the day's OPENING card. When a level opens a new
 * restaurant day it always shows ("Day N · Opening time", the day's services
 * by name and level) and its button opens the restaurant; from Level 3 it
 * also checks ingredients before the service starts.
 *
 * Phase G (from dine-in, L31): a Supplies section — clean place settings,
 * takeaway containers and bags (from L71), napkins, and the dish-soap and
 * cleaning-liquid bottles. Only missing settings / packaging block START;
 * napkins and bottles warn. Restock → the Market's Supplies on that line;
 * when the wallet can't cover what blocks, an ad or supplier credit.
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
  onUpgradeFridge,
  onClose,
  services = [],
  supplies = { applies: false },
  onRestockSupply = () => {},
  cover = null,
  adAvailable = false,
  onCoverWithAd = async () => ({ ok: false, reason: "nothingToCover" }),
  onCoverWithCredit = () => {},
  owed = 0,
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
  onDismissFirstRestock = () => {},
  onRestockFridge = () => {},
  canBuy = true,
  tools = { applies: false },
  toolsSoon = [],
  firstShoppingList = false,
  onBuyTool = () => {},
  cleaningOpen = 0,
  openingChores = 0,
  onOpenCleanliness = () => {},
  chores = null,
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
  onUpgradeFridge: () => void;
  onClose: () => void;
  /** Each ticket's dine-in / takeaway (phase G). */
  services?: readonly (OrderService | null)[];
  supplies?: ServiceSuppliesCheck;
  onRestockSupply?: (id: SupplyId) => void;
  /** From Level 3: what an ad or supplier credit would cover when the wallet can't pay (serviceCover.ts). */
  cover?: {
    stock: CoverOffer | null;
    supplies: CoverOffer | null;
    tools?: CoverOffer | null;
  } | null;
  /** The platform can show a rewarded ad now. */
  adAvailable?: boolean;
  onCoverWithAd?: (part: CoverPart) => Promise<CoverAdOutcome>;
  onCoverWithCredit?: (part: CoverPart) => void;
  /** What the restaurant owes its supplier (supplierCredit.ts), cents. */
  owed?: number;
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
  /** The first service using purchased ingredients (Level 3, firstRestock.ts). */
  firstRestock?: boolean;
  /** Persist the player's dismissal of the one-time first-stock explainer. */
  onDismissFirstRestock?: () => void;
  /**
   * False before the Market sells ingredients (Level 3, firstLevels.ts).
   */
  canBuy?: boolean;
  onRestockFridge?: (ingredientId: IngredientId, units: number) => void;
  /** Kitchen tools today's dishes and the menu need (kitchenTools.ts, from Level 10). */
  tools?: ToolsCheck;
  /** Tools the next levels will ask for, not owned yet. */
  toolsSoon?: readonly { id: SupplyId; level: number; why: string }[];
  /** Level 10: Grandma's first shopping list. */
  firstShoppingList?: boolean;
  /** Buy → the Market's Culinary section on that tool, with the packs preset. */
  onBuyTool?: (id: SupplyId, packs: number) => void;
  /** Cleanliness & Maintenance: cleaning tasks still open (never blocks START; it costs the spotless streak). */
  cleaningOpen?: number;
  /** Opening-phase chores, counted in the day-start overview. */
  openingChores?: number;
  onOpenCleanliness?: () => void;
  /** A real restaurant's day: the phase's checklist (ShiftChecklist), never blocking. */
  chores?: ReactNode;
}) {
  // Optional sections start folded so START and what blocks it stay in view.
  const [showGuests, setShowGuests] = useState(false);
  const [showDay, setShowDay] = useState(false);
  const stock = check.applies ? check : null;
  const sup = supplies.applies ? supplies : null;
  const kit = tools.applies ? tools : null;
  const fridgeShort = !!stock && stock.storageNeeded > stock.storageFree;
  const canStart =
    (!stock || (stock.ready && !stock.rows.some((r) => r.expired > 0 && r.usable < r.needed))) &&
    (!sup || sup.ready) &&
    (!kit || kit.ready) &&
    staff.every((r) => r.met);
  const staffMissing = staff.filter((r) => !r.met);
  const urgentIngredientRows = stock?.missingRows.length ?? 0;
  const lowForDayRows = dayStock?.rows.length ?? 0;
  const expiredRows = stock?.rows.filter((r) => r.expired > 0).length ?? 0;
  const urgentSupplyRows = sup?.rows.filter((r) => r.missing > 0 && r.blocking).length ?? 0;
  const lowSupplyRows = sup?.rows.filter((r) => r.missing > 0 && !r.blocking).length ?? 0;
  const lowBottleCount = sup
    ? Number(sup.soap.status !== "ok") + Number(sup.cleaner.status !== "ok")
    : 0;
  const missingTools = kit?.rows.filter((r) => r.missing > 0).length ?? 0;
  const openCleaningTasks = cleaningOpen + openingChores;
  const routineNeedsAttention = [
    urgentIngredientRows > 0 || lowForDayRows > 0 || expiredRows > 0,
    urgentSupplyRows > 0 || lowSupplyRows > 0 || lowBottleCount > 0,
    missingTools > 0,
    staffMissing.length > 0,
    !!fridge && fridge.status !== "ok",
    openCleaningTasks > 0,
  ].filter(Boolean).length;
  const jumpToRoutineSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  /** What blocks START, for its label: stock or supplies first, otherwise staff. */
  const stockOrSuppliesShort =
    (!!stock && (!stock.ready || stock.rows.some((r) => r.expired > 0 && r.usable < r.needed))) ||
    (!!sup && !sup.ready) ||
    (!!kit && !kit.ready);
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
      <div className="anim-up relative m-3 flex max-h-[calc(100%-24px)] w-[calc(100%-24px)] flex-col rounded-[26px] land:max-w-[680px] border border-walnut/20 bg-[linear-gradient(170deg,var(--color-ivory),var(--color-cream))] shadow-lift">
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
          {opening ? (
            <section
              className={cn(
                "mb-3 rounded-2xl border p-3",
                routineNeedsAttention > 0
                  ? "border-gold/50 bg-gold/10"
                  : "border-olive/25 bg-sage/10",
              )}
              data-testid="psc-daily-routine"
            >
              <div className="flex items-start gap-2">
                <span className="text-[22px]" aria-hidden>
                  🌅
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-display text-[16px] font-black text-walnut-dark">
                    Today’s opening routine
                    <InfoTip label="About the opening routine">
                      Refill only what today needs. Cleaning and optional stock top-ups never block
                      the start.
                    </InfoTip>
                  </p>
                  <p className="font-ui text-[12px] leading-snug text-walnut/70">
                    {routineNeedsAttention > 0
                      ? `⚠️ ${routineNeedsAttention} to check`
                      : "✓ All ready"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-1 font-ui text-[10.5px] font-extrabold",
                    routineNeedsAttention > 0
                      ? "bg-gold/30 text-walnut-dark"
                      : "bg-sage/20 text-olive",
                  )}
                >
                  {routineNeedsAttention > 0 ? "CHECK" : "READY"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <RoutineStatus
                  icon="🥕"
                  label="Ingredients"
                  detail={
                    stock
                      ? urgentIngredientRows > 0
                        ? `${urgentIngredientRows} urgent${lowForDayRows > 0 ? ` · ${lowForDayRows} short` : ""}`
                        : lowForDayRows > 0
                          ? `${lowForDayRows} low today`
                          : expiredRows > 0
                            ? `🗑️ ${expiredRows} expired`
                            : "✓ Ready"
                      : "— Not needed"
                  }
                  tone={
                    urgentIngredientRows > 0 || lowForDayRows > 0 || expiredRows > 0
                      ? "attention"
                      : "ready"
                  }
                  onClick={() =>
                    jumpToRoutineSection(
                      urgentIngredientRows > 0 || expiredRows > 0
                        ? "psc-ingredients"
                        : "psc-day-stock",
                    )
                  }
                  testId="psc-routine-ingredients"
                />
                <RoutineStatus
                  icon="📦"
                  label="Service supplies"
                  detail={
                    sup
                      ? urgentSupplyRows > 0
                        ? `${urgentSupplyRows} urgent${lowSupplyRows + lowBottleCount > 0 ? ` · ${lowSupplyRows + lowBottleCount} low` : ""}`
                        : lowSupplyRows + lowBottleCount > 0
                          ? `${lowSupplyRows + lowBottleCount} low today`
                          : "✓ Enough"
                      : "— Not needed"
                  }
                  tone={
                    urgentSupplyRows > 0 || lowSupplyRows > 0 || lowBottleCount > 0
                      ? "attention"
                      : "ready"
                  }
                  onClick={() => jumpToRoutineSection("psc-supplies")}
                  testId="psc-routine-supplies"
                />
                <RoutineStatus
                  icon="🍳"
                  label="Kitchen tools"
                  detail={
                    kit ? (missingTools > 0 ? `${missingTools} to buy` : "✓ Ready") : "— Not needed"
                  }
                  tone={missingTools > 0 ? "attention" : "ready"}
                  onClick={() => jumpToRoutineSection("psc-tools")}
                  testId="psc-routine-tools"
                />
                <RoutineStatus
                  icon="👥"
                  label="Team"
                  detail={
                    staff.length > 0
                      ? staffMissing.length > 0
                        ? `${staffMissing.length} to hire`
                        : "✓ Ready"
                      : "— Not needed"
                  }
                  tone={staffMissing.length > 0 ? "attention" : "ready"}
                  onClick={() => jumpToRoutineSection("psc-staff")}
                  testId="psc-routine-staff"
                />
                <RoutineStatus
                  icon="❄️"
                  label="Cold storage"
                  detail={
                    fridge
                      ? fridge.status === "full"
                        ? `Full · ${fridge.used}/${fridge.capacity}`
                        : fridge.status === "nearly-full"
                          ? `Nearly full · ${fridge.free} free`
                          : `✓ ${fridge.free} free`
                      : "✓ OK"
                  }
                  tone={!!fridge && fridge.status !== "ok" ? "attention" : "ready"}
                  onClick={() => jumpToRoutineSection("psc-fridge")}
                  testId="psc-routine-fridge"
                />
                <RoutineStatus
                  icon="🧹"
                  label="Cleaning"
                  detail={
                    openCleaningTasks > 0
                      ? `${openCleaningTasks} task${openCleaningTasks === 1 ? "" : "s"}`
                      : "✓ Clean"
                  }
                  tone={openCleaningTasks > 0 ? "attention" : "ready"}
                  onClick={() =>
                    jumpToRoutineSection(openingChores > 0 ? "psc-opening-chores" : "psc-cleaning")
                  }
                  testId="psc-routine-cleaning"
                />
              </div>
            </section>
          ) : null}
          {owed > 0 ? (
            <p
              className="mb-2 rounded-2xl border border-copper/30 bg-gold/10 px-3 py-2 font-ui text-[12.5px] font-bold text-walnut-dark"
              data-testid="psc-owed"
            >
              💳 Owed {formatUsd(owed)} · repaid from your next earnings
            </p>
          ) : null}
          {/* Who this service still needs, first — the sheet can be long and
              the staff rows sit further down (developer 2026-10-09). */}
          {staffMissing.length > 0 ? (
            <div
              className="mb-2 rounded-2xl border border-tomato/30 bg-tomato/10 p-3"
              data-testid="psc-staff-needed"
            >
              <p className="font-ui text-[13.5px] font-extrabold text-walnut-dark">
                👥 To hire · 🆓 free
              </p>
              <NameChips names={staffMissing.map((r) => r.title)} />
            </div>
          ) : null}
          {kit && !kit.ready ? (
            <div
              className="mb-2 rounded-2xl border border-tomato/30 bg-tomato/10 p-3"
              data-testid="psc-tools-needed"
            >
              <p className="font-ui text-[13.5px] font-extrabold text-walnut-dark">
                🍳 Tools to buy · 🔁 once
              </p>
              <NameChips names={kit.rows.filter((r) => r.missing > 0).map((r) => r.label)} />
            </div>
          ) : null}
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
                🌙 Then closing: clean up & count the day
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

          {stock && firstRestock ? (
            <div
              className="mt-3 rounded-2xl border-2 border-copper/60 bg-gold/15 p-3"
              data-testid="psc-first-restock"
              data-ready={stock.ready || undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-copper">
                  {stock.ready ? "Your first stock check" : "Buy ingredients for service"}
                </p>
                <button
                  type="button"
                  aria-label="Dismiss first stock check tip"
                  onClick={onDismissFirstRestock}
                  className="press -mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[18px] font-black leading-none text-copper/70 hover:bg-gold/25"
                >
                  ×
                </button>
              </div>
              {stock.ready ? (
                <p className="mt-1 font-ui text-[13.5px] font-bold text-walnut-dark">
                  ✓ All in the fridge · start the service
                </p>
              ) : (
                <ol className="mt-1 list-decimal space-y-0.5 pl-5 font-ui text-[13.5px] font-bold text-walnut-dark">
                  <li>🛒 Buy everything in the Market</li>
                  <li>Tap Buy all</li>
                  <li>↩ Back here, then start</li>
                </ol>
              )}
              <p className="mt-1 font-hand text-[16px] leading-snug text-walnut/75">
                “Buy only what you'll use — fresh food doesn't wait.”
              </p>
            </div>
          ) : null}

          {stock ? (
            <>
              <p className="mt-3 font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
                Ingredients
              </p>
              <ul
                id="psc-ingredients"
                className="mt-1 divide-y divide-walnut/10"
                data-testid="psc-ingredients"
              >
                {stock.rows.map((row) => (
                  <IngredientRow
                    key={row.ingredientId}
                    row={row}
                    measure={measure}
                    onRestock={canBuy ? onRestock : null}
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
              <ul id="psc-staff" className="mt-1 divide-y divide-walnut/10" data-testid="psc-staff">
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
                      <p className="flex items-center gap-1.5 font-ui text-[14.5px] font-bold text-walnut-dark">
                        {r.title}
                        <InfoTip label={`Why a ${r.title}`}>{r.why}</InfoTip>
                      </p>
                      {r.met ? null : (
                        <p className="font-ui text-[12.5px] font-bold text-tomato">Needed</p>
                      )}
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
                  {staffMissing.length <= 2
                    ? `Hire ${staffMissing.map((r) => r.title).join(", ")} → Staff · free`
                    : `Hire ${staffMissing.length} → Staff · free`}
                </KButton>
              ) : null}
            </>
          ) : null}

          {fridge && fridge.status !== "ok" ? (
            <div
              className="mt-3 rounded-2xl border border-tomato/30 bg-tomato/10 p-3"
              id="psc-fridge"
              data-testid="psc-fridge"
              data-fridge-status={fridge.status}
            >
              <p className="font-ui text-[13.5px] font-bold text-walnut-dark">
                {fridge.status === "full" ? "⛔ Fridge full" : "⚠️ Fridge nearly full"} ·{" "}
                {fridge.used} / {fridge.capacity} units
              </p>
              <p className="flex items-center gap-1.5 font-ui text-[12.5px] text-walnut/70">
                ❄️ {fridge.free} free
                <InfoTip label="How to make room">
                  Use what you have, throw out expired food, or upgrade the refrigerator.
                </InfoTip>
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

          {chores}
          {cleaningOpen > 0 ? (
            <div
              className="mt-3 flex items-center gap-2 rounded-2xl border border-gold/50 bg-gold/15 p-2"
              id="psc-cleaning"
              data-testid="psc-cleaning"
            >
              <span className="text-[22px]" aria-hidden>
                🧹
              </span>
              <p className="min-w-0 flex-1 font-ui text-[13px] font-bold leading-snug text-walnut-dark">
                {cleaningOpen} to clean · keeps you ✨ spotless
              </p>
              <KButton
                size="sm"
                variant="cream"
                className="min-h-12 shrink-0"
                onClick={onOpenCleanliness}
              >
                Clean ›
              </KButton>
            </div>
          ) : null}

          {firstShoppingList ? (
            <FirstShoppingList soon={toolsSoon} credits={credits} onBuy={onBuyTool} />
          ) : null}

          {kit && kit.rows.length > 0 ? (
            <div id="psc-tools" data-testid="psc-tools">
              <p className="mt-3 font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
                🍳 Kitchen tools · today's dishes
              </p>
              <ul className="mt-1 divide-y divide-walnut/10">
                {kit.rows
                  .filter((row) => row.missing > 0)
                  .map((row) => (
                    <ToolRowItem key={row.id} row={row} onBuy={onBuyTool} />
                  ))}
              </ul>
              {kit.rows.some((r) => r.missing === 0) ? (
                // A count, the names one tap away (developer 2026-10-23: no long lists).
                <details className="mt-1" data-testid="psc-tools-ready">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center font-ui text-[12.5px] font-extrabold text-sage">
                    ✓ {kit.rows.filter((r) => r.missing === 0).length} tools ready ▸
                  </summary>
                  <NameChips
                    names={kit.rows
                      .filter((r) => r.missing === 0)
                      .map((r) => (r.need > 1 ? `${r.label} × ${r.need}` : r.label))}
                  />
                </details>
              ) : null}
              {!kit.ready ? (
                <div
                  className="mt-2 rounded-2xl border border-walnut/15 bg-ivory/70 p-3"
                  data-testid="psc-tools-summary"
                >
                  <p className="font-ui text-[13.5px] font-bold text-walnut-dark">
                    ⛔ Needed to cook · {formatUsd(kit.missingCost)}
                  </p>
                  {!kit.affordable ? (
                    <>
                      <p className="mt-1 font-ui text-[13.5px] font-bold text-tomato">
                        Not enough money — need {formatUsd(kit.missingCost - credits)} more.
                      </p>
                      {cover?.tools ? (
                        <CoverActions
                          offer={cover.tools}
                          adAvailable={adAvailable}
                          onWatchAd={() => onCoverWithAd("tools")}
                          onCredit={() => onCoverWithCredit("tools")}
                          what="tools"
                        />
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {!firstShoppingList && toolsSoon.length > 0 ? (
            <p
              className="mt-2 font-ui text-[12.5px] leading-snug text-walnut/70"
              data-testid="psc-tools-soon"
            >
              🔜 Coming up:{" "}
              {toolsSoon
                .map((t) => `${getSupplyItem(t.id)?.name ?? t.id} (Level ${t.level})`)
                .join(" · ")}
            </p>
          ) : null}

          {sup ? (
            <>
              <p className="mt-3 font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
                Supplies · {sup.dineIn} dine-in
                {sup.takeaway > 0 ? ` · ${sup.takeaway} takeaway` : ""}
              </p>
              <ul
                id="psc-supplies"
                className="mt-1 divide-y divide-walnut/10"
                data-testid="psc-supplies"
              >
                {sup.rows.map((row) => (
                  <SupplyRow
                    key={`${row.id}${row.guest ? "-guest" : ""}`}
                    row={row}
                    onRestock={onRestockSupply}
                  />
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
                    ⛔ Needed to start · {formatUsd(sup.missingCost)}
                  </p>
                  {!sup.affordable ? (
                    <>
                      <p className="mt-1 font-ui text-[13.5px] font-bold text-tomato">
                        Not enough money — need {formatUsd(sup.missingCost - credits)} more.
                      </p>
                      {cover?.supplies ? (
                        <CoverActions
                          offer={cover.supplies}
                          adAvailable={adAvailable}
                          onWatchAd={() => onCoverWithAd("supplies")}
                          onCredit={() => onCoverWithCredit("supplies")}
                          what="supplies"
                        />
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          {stock && guests && guests.dishes.length > 0 ? (
            <div className="mt-3" data-testid="psc-guests">
              <p className="flex items-center gap-1.5 font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
                🍽️ Menu guests today · optional
                <InfoTip label="About menu guests">
                  Menu guests order from your menu after your own orders. Stocking for them is
                  optional — each one served pays the menu price.
                </InfoTip>
              </p>
              <p className="font-ui text-[12.5px] text-walnut/70">
                {guests.dishes.join(", ")}
                {guests.rows.length === 0 ? " · ✓ all stocked" : ""}
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
              id="psc-day-stock"
              data-testid="psc-day-stock"
            >
              <p className="flex items-center gap-1.5 font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/60">
                🗓️ Stock the whole day · optional
                <InfoTip label="About stocking the whole day">
                  Everything for today's {dayStock.levels.length} services (Levels{" "}
                  {dayStock.levels.join(", ")}) in one go, at the bulk price.
                </InfoTip>
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <StatChip icon="🍽️">{dayStock.levels.length} services</StatChip>
                <StatChip icon="📦">{formatQuantity(dayStock.totalUnits)} units</StatChip>
                <StatChip icon="💵">{formatUsd(dayStock.totalCost)}</StatChip>
                {dayStock.bulkSaving > 0 ? (
                  <StatChip icon="🏷️" tone="sage">
                    −{formatUsd(dayStock.bulkSaving)}
                  </StatChip>
                ) : null}
              </div>
              <p
                className={cn(
                  "mt-1 font-ui text-[12.5px] font-bold",
                  dayStock.fits ? "text-olive" : "text-copper",
                )}
              >
                {dayStock.fits
                  ? `✓ Fits · ❄️ ${formatQuantity(dayStock.storageFree)} free`
                  : `❄️ Too big · ${formatQuantity(dayStock.storageFree)} of ${formatQuantity(dayStock.totalUnits)} free · stock per service`}
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
                🗑️ Expired stock can't be served
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
                {stock.missingRows.length === 1 ? "item" : "items"}
                {canBuy ? ` · ${formatUsd(stock.missingCost)}` : ""}
              </p>
              <p className="font-ui text-[12.5px] text-walnut/70">
                💵 You have {formatUsd(credits)}
              </p>
              {canBuy && onBuyAllInMarket && stock.affordable ? (
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
              {canBuy && quickRestock && quickRestock.affordable ? (
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
                    ⚠️ {formatUsd(quickRestock.extraCost)} more than in the Market (+
                    {Math.round(QUICK_RESTOCK_FEE * 100)}%)
                  </p>
                  <p
                    className="mt-1 font-ui text-[12px] leading-snug text-walnut/70"
                    data-testid="psc-quick-covers"
                  >
                    🎯 This service only
                    {quickRestock.lines.length > 0
                      ? ` · ${quickRestock.lines.length} item${quickRestock.lines.length === 1 ? "" : "s"}`
                      : ""}{" "}
                    <InfoTip label="What Quick restock buys">
                      It buys exactly this service's missing ingredients — not extra stock for menu
                      guests or later services. Buying in the Market before the service is cheaper.
                    </InfoTip>
                  </p>
                  {!quickRestock.fits ? (
                    <p className="mt-1 font-ui text-[12.5px] font-bold text-tomato">
                      Not enough fridge space for it ({formatQuantity(quickRestock.storageFree)}{" "}
                      units free).
                    </p>
                  ) : null}
                </div>
              ) : null}
              {canBuy && !stock.affordable ? (
                <>
                  <p className="mt-1 font-ui text-[13.5px] font-bold text-tomato">
                    Not enough money — need {formatUsd(stock.missingCost - credits)} more.
                  </p>
                  {cover?.stock ? (
                    <CoverActions
                      offer={cover.stock}
                      adAvailable={adAvailable}
                      onWatchAd={() => onCoverWithAd("stock")}
                      onCredit={() => onCoverWithCredit("stock")}
                      what="ingredients"
                    />
                  ) : null}
                </>
              ) : null}
              {fridgeShort ? (
                <>
                  <p className="mt-1 font-ui text-[13.5px] font-bold text-tomato">
                    ❄️ Fridge full · needs {stock.storageNeeded}, {stock.storageFree} free
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
          {!canStart && !stockOrSuppliesShort && staffMissing.length > 0 ? (
            // Only staff is missing: the button hires (Restaurant → Staff), naming who.
            <KButton
              full
              variant="copper"
              className="h-auto min-h-12 py-2 leading-tight"
              onClick={onHireStaff}
            >
              {/* Two names at most on the button; more is a count (developer 2026-10-23). */}
              {staffMissing.length <= 2
                ? `Hire ${staffMissing.map((r) => r.title).join(" & ")} →`
                : `Hire ${staffMissing.length} → 👥`}
            </KButton>
          ) : (
            <KButton full className="min-h-12" disabled={!canStart} onClick={onStart}>
              {canStart
                ? opening
                  ? "OPEN THE RESTAURANT"
                  : "START SERVICE"
                : stockOrSuppliesShort
                  ? "Restock to start"
                  : "Hire staff to start"}
            </KButton>
          )}
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
  onRestock: ((id: IngredientId) => void) | null;
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
          📦 {formatStockAmount(row.ingredientId, row.usable, measure)} /{" "}
          {formatStockAmount(row.ingredientId, row.needed, measure)}
          {count ? ` (${count})` : ""}
          {row.expired > 0
            ? ` (+${formatStockAmount(row.ingredientId, row.expired, measure)} expired)`
            : ""}
        </p>
      </div>
      {ok ? (
        <span className="font-ui text-[13.5px] font-extrabold text-sage">✓ Ready</span>
      ) : !onRestock ? (
        <span className="font-ui text-[13.5px] font-extrabold text-tomato">✗ Missing</span>
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
  const lines = kit
    .filter((k) => k.kind === "supply")
    .map((k) => `${k.units.toLocaleString("en-US")} × ${supplyItemOf(k.id)?.name ?? k.id}`);
  return (
    <div
      className="mb-2 rounded-2xl border border-olive/40 bg-[linear-gradient(170deg,var(--color-ivory),rgba(120,140,60,0.12))] p-3"
      data-testid="psc-welcome"
    >
      <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-olive">
        🎁 Welcome to your restaurant
      </p>
      <p className="font-hand text-[17px] leading-snug text-walnut">
        “Your kitchen is ready. Buy each service's ingredients in the Market.”
      </p>
      {lines.length > 0 ? (
        <p className="mt-1 font-ui text-[12.5px] text-walnut/70">
          🎁 Free, once: {lines.join(" · ")}
        </p>
      ) : null}
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
            🍽️ New on the menu
            {news.dishWhy ? (
              <>
                {" "}
                <InfoTip label="Why these dishes">{news.dishWhy}</InfoTip>
              </>
            ) : null}
          </p>
          <NameChips names={news.dishes.map((d) => d.name)} />
        </div>
      ) : null}
      {news.comingUp.length > 0 ? (
        <ul className="mt-1 space-y-0.5" data-testid="psc-coming-up">
          {news.comingUp.map((c) => (
            <li
              key={`${c.level}-${c.text}`}
              className="flex items-center gap-1.5 font-ui text-[12.5px] font-bold text-walnut/75"
            >
              <span className="rounded-full bg-copper/15 px-1.5 text-[11px] font-black text-copper">
                Lv {c.level}
              </span>
              <span className="min-w-0 flex-1">{c.short}</span>
              <InfoTip label={`About Level ${c.level}`}>{c.text}</InfoTip>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** One kitchen tool the dishes need: need / have, why, and Buy → the Market. */
function ToolRowItem({
  row,
  onBuy,
}: {
  row: ToolRow;
  onBuy: (id: SupplyId, packs: number) => void;
}) {
  const ok = row.missing === 0;
  const item = getSupplyItem(row.id);
  return (
    <li
      className="flex min-h-12 items-center gap-2 py-1.5"
      data-psc-tool={row.id}
      data-psc-status={ok ? "ok" : "missing"}
    >
      <span className="text-[20px]" aria-hidden>
        {row.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-ui text-[14.5px] font-bold text-walnut-dark">
          <span>
            {row.label}
            {row.need > 1 ? ` × ${row.need}` : ""}
          </span>
          <InfoTip label={`Why the ${row.label}`}>{row.why}</InfoTip>
        </p>
        <p
          className={cn(
            "font-ui text-[12.5px] leading-snug",
            ok ? "text-walnut/60" : "text-tomato",
          )}
        >
          {ok ? `You have ${row.have}` : `Need ${row.need} · have ${row.have}`}
        </p>
      </div>
      {ok ? (
        <span className="font-ui text-[13.5px] font-extrabold text-sage">✓</span>
      ) : (
        <KButton
          size="sm"
          variant="copper"
          className="min-h-12"
          onClick={() => onBuy(row.id, row.packs)}
        >
          Buy {item ? packsText(item, row.packs) : row.packs} · {formatUsd(row.cost)}
        </KButton>
      )}
    </li>
  );
}

/**
 * Level 10: the culinary-tool section opens. The first shopping list — the
 * kitchen tools the next ten levels will ask for, with Buy buttons. It
 * never blocks Level 10's START (only the levels that cook with them do).
 */
function FirstShoppingList({
  soon,
  credits,
  onBuy,
}: {
  soon: readonly { id: SupplyId; level: number; why: string }[];
  credits: number;
  onBuy: (id: SupplyId, packs: number) => void;
}) {
  const total = soon.reduce((t, x) => {
    const item = getSupplyItem(x.id);
    return t + (item ? supplyPackPrice(item) : 0);
  }, 0);
  return (
    <div
      className="mt-2 rounded-2xl border border-copper/30 bg-gold/10 p-3"
      data-testid="psc-shopping-list"
    >
      <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-copper">
        👵 Your first shopping list
      </p>
      <p className="mt-0.5 font-hand text-[15.5px] leading-snug text-walnut">
        “Real dishes need real tools — buy them before we cook.”
      </p>
      {soon.length === 0 ? (
        <p className="mt-1 font-ui text-[12.5px] font-bold text-sage">
          ✓ Every tool coming up is yours
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-walnut/10">
          {soon.map((x) => {
            const item = getSupplyItem(x.id);
            return (
              <li
                key={x.id}
                className="flex min-h-12 items-center gap-2 py-1.5"
                data-shopping-tool={x.id}
              >
                <span className="text-[20px]" aria-hidden>
                  {item?.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-ui text-[14.5px] font-bold text-walnut-dark">
                    <span>{item?.name}</span>
                    <InfoTip label={`Why the ${item?.name ?? "tool"}`}>{x.why}</InfoTip>
                  </p>
                  <p className="font-ui text-[12.5px] font-bold leading-snug text-copper">
                    Level {x.level}
                  </p>
                </div>
                <KButton
                  size="sm"
                  variant="ghost"
                  className="min-h-12"
                  onClick={() => onBuy(x.id, 1)}
                >
                  Buy · {item ? formatUsd(supplyPackPrice(item)) : ""}
                </KButton>
              </li>
            );
          })}
        </ul>
      )}
      {soon.length > 0 ? (
        <p className="mt-1 font-ui text-[12.5px] text-walnut/70">
          All of it: {formatUsd(total)} · you have {formatUsd(credits)}
        </p>
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
      data-psc-guest={row.guest ? "" : undefined}
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
          📦 {row.have} / {row.need}
          {row.dirty > 0 ? ` · 🫧 ${row.dirty} dirty` : ""}
          {!ok && item ? ` · ${packsText(item, row.packs)}` : ""}
          {!ok && !row.blocking ? (
            <>
              {" · "}
              <span title={row.guest ? "Some guests can't be seated" : "Some guests go without"}>
                ⚠️ {row.guest ? "🪑" : "short"}
              </span>
            </>
          ) : null}
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
          Restock · {formatUsd(row.cost)}
        </KButton>
      )}
    </li>
  );
}

/** A list of names as small chips (who to hire, which tools), instead of a long sentence. */
function NameChips({ names }: { names: readonly string[] }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {names.map((n) => (
        <span
          key={n}
          className="rounded-full border border-walnut/15 bg-ivory/80 px-2 py-0.5 font-ui text-[12px] font-bold text-walnut-dark"
        >
          {n}
        </span>
      ))}
    </div>
  );
}
