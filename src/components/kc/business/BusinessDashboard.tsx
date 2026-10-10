import { ENDLESS_RESTAURANT_NAME, businessDayAllowed } from "@/game/restaurant/endlessRestaurant";
import { RESTAURANT_MODE } from "@/game/config/restaurantMode";
import { restaurantLevelOf } from "@/game/restaurant/restaurantMenu";
import { useMemo, useState, type ReactNode } from "react";
import type { ScreenId } from "../data";
import { restaurantDayOf, todaysServices } from "@/game/restaurant/restaurantDay";
import { RushRestockActions } from "./RushRestockActions";
import type { RushRestockOutcome, RushRestockPayment } from "@/game/business/businessRushRestock";
import type { SaveData } from "@/game/SaveManager";
import type { ServiceSession } from "@/game/service/ServiceManager";
import { KButton, Panel, ScreenHeader, Divider, Stars } from "../common/primitives";
import {
  Bar,
  Eyebrow,
  MoneyBars,
  MoneyLegend,
  StackedBar,
  MONEY_COLORS,
  type MoneyGroup,
} from "../common/Meters";
import { BottomNav } from "../Kitchen";
import { BUSINESS_TAB_SCREEN, type BusinessTab } from "./businessTabs";
import { BusinessCash } from "./BusinessCash";
import { BusinessRefrigerator } from "./BusinessRefrigerator";
import { OperationsAnalytics, TodayAtAGlance } from "./BusinessAnalytics";
import { BusinessStaff } from "./BusinessStaff";
import { BusinessSuppliers } from "./BusinessSuppliers";
import { BusinessMenu } from "./BusinessMenu";
import { BusinessInspections } from "./BusinessInspections";
import { BusinessFinance } from "./BusinessFinance";
import { BusinessHistory } from "./BusinessHistory";
import { BusinessCleanliness } from "./BusinessCleanliness";
import {
  CLEANING_FROM_LEVEL,
  cleanlinessOf,
  type CleanlinessAction,
  type CleanlinessActionResult,
} from "@/game/restaurant/cleanliness";
import { cn } from "@/lib/utils";
import { dayOfWeekFor, businessWeekFor } from "@/game/business/businessCalendar";
import { formatQuantity } from "@/game/business/businessInventory";
import { getSupplier } from "@/game/economy/supplierDefinitions";
import type { InspectionReport } from "@/game/business/businessInspection";
import type { InspectionFineResult } from "@/game/business/businessInspectionFines";
import type { PerformMaintenanceResult } from "@/game/business/businessMaintenance";
import type { BuyStaffResult } from "@/game/economy/StaffManager";
import type { PurchaseRefrigeratorResult } from "@/game/business/RefrigeratorManager";
import type { SetMenuPriceResult } from "@/game/business/BusinessMenuManager";
import type { SetDishActiveResult } from "@/game/business/businessMenuActivation";
import type {
  SignContractResult,
  CancelContractResult,
} from "@/game/business/BusinessSupplierManager";
import { formatUsd } from "@/game/business/businessCurrency";
import type { DailyPnL } from "@/game/business/BusinessFinanceManager";
import type { PopularityDayBreakdown } from "@/game/business/PopularityManager";
import { businessDishForRecipeId } from "@/game/business/businessServiceCatalog";
import {
  BASE_CUSTOMERS_PER_DAY,
  businessCustomerPayment,
  businessCustomersToday,
  businessOrderAvailability,
} from "@/game/business/BusinessServiceManager";
import { INGREDIENTS } from "@/game/definitions";
import {
  businessAlertsFor,
  previewBusinessDayClose,
  type BusinessAlert,
  type BusinessAlertSeverity,
} from "@/game/business/businessAlerts";
import { DEFAULT_REFRIGERATOR_ID } from "@/game/business/refrigeratorDefinitions";
import { EndlessDayEvents } from "./EndlessDayEvents";
import { usesRestaurantDemand } from "@/game/restaurant/endlessDemand";
import { ENDLESS_STARS_PER_DAY, type DayStars } from "@/game/restaurant/restaurantStanding";
import {
  popularityMood,
  popularityStars,
  restaurantProgress,
} from "@/game/progression/restaurantProgress";

export type AdvanceDayResult = {
  spoiledQuantity: number;
  spoiledValue: number;
  spoiledIngredientIds: string[];
  popularityDelta: number;
  popularityScore: number;
  popularityBreakdown: PopularityDayBreakdown;
  expiredSupplierId: string | null;
  payrollPaid: number;
  staffLaidOff: string[];
  inspectionReport: InspectionReport;
  inspectionFine: InspectionFineResult;
  dailyPnL: DailyPnL;
  /** Endless Restaurant days only (restaurant build): the day's stars — status, never money. */
  endlessStars?: DayStars;
  /** Endless Restaurant: Today's Special's bonus paid at this End Business Day (cents). */
  todaysSpecialBonus?: number;
};

const TABS: Array<{ id: BusinessTab; label: string; emoji: string }> = [
  { id: "overview", label: "Overview", emoji: "📊" },
  { id: "equipment", label: "Equipment", emoji: "❄️" },
  { id: "staff", label: "Staff", emoji: "🧑‍🍳" },
  { id: "suppliers", label: "Suppliers", emoji: "🚚" },
  { id: "menu", label: "Menu", emoji: "🍽️" },
  { id: "operations", label: "Operations", emoji: "📋" },
  // Restaurant build, from CLEANING_FROM_LEVEL (filtered in the component).
  { id: "cleanliness", label: "Cleanliness", emoji: "🧹" },
];

const SEVERITY_ICON: Record<BusinessAlertSeverity, string> = {
  critical: "⛔",
  warning: "⚠️",
  info: "ℹ️",
  ok: "✓",
};

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
}

/** Costs = revenue − operating profit: everything the existing DailyPnL deducts (ingredients used, staff, repairs, supplier fees, other, fines). */
function costsOf(pnl: DailyPnL): number {
  return pnl.revenue - pnl.operatingProfit;
}

/**
 * BUSINESS — Business Mode as one Market-style screen with seven tabs.
 *
 * Presentation only. Every number comes from an existing source:
 *  - "today" = `previewBusinessDayClose(save)` — the SAME pure
 *    `endBusinessDay` the End Business Day button runs, so today's revenue,
 *    costs (incl. tonight's pay and any fine) and profit are exactly what
 *    closing now would record;
 *  - "last day" = the persisted `business.finance.lastDailyPnL`;
 *  - popularity + its factors = the save's score and the preview's own
 *    `popularityBreakdown`;
 *  - rank = Restaurant Progress's `restaurantProgress(save)`;
 *  - customers = `businessCustomersToday(save)`.
 * The save keeps no per-day history, so the performance chart compares the
 * last completed day with today instead of drawing an invented trend.
 */
export function BusinessDashboard({
  go,
  save,
  tab,
  onAdvanceDay,
  businessServiceSession,
  purchaseRefrigerator,
  performRefrigeratorMaintenance,
  setMenuPrice,
  setBusinessDishActive,
  signSupplierContract,
  cancelSupplierContract,
  selectSupplier,
  hireStaff,
  fireStaff,
  buyStaff,
  rushRestock,
  rushAdAvailable,
  cleanlinessAction,
}: {
  go: (s: ScreenId) => void;
  save: SaveData;
  tab: BusinessTab;
  onAdvanceDay: () => AdvanceDayResult;
  businessServiceSession: ServiceSession | null;
  purchaseRefrigerator: (refrigeratorId: string) => PurchaseRefrigeratorResult;
  performRefrigeratorMaintenance: () => PerformMaintenanceResult;
  setMenuPrice: (recipeId: string, price: number) => SetMenuPriceResult;
  setBusinessDishActive: (dishId: string, active: boolean) => SetDishActiveResult;
  signSupplierContract: (supplierId: string) => SignContractResult;
  cancelSupplierContract: () => CancelContractResult;
  /** Restaurant build: the ingredient supplier is chosen on the Suppliers tab (phase 7). */
  selectSupplier: (id: string) => void;
  /** A role or (restaurant build) a specialist chef id; only `ok` is read. */
  hireStaff: (role: string) => { ok: boolean };
  fireStaff: (role: string) => { ok: boolean };
  buyStaff: (id: string) => BuyStaffResult;
  rushRestock: (payment: RushRestockPayment) => Promise<RushRestockOutcome>;
  rushAdAvailable: boolean;
  /** Restaurant → Cleanliness (restaurant/cleanliness.ts); absent = no Cleanliness tab. */
  cleanlinessAction?: (action: CleanlinessAction) => CleanlinessActionResult | null;
}) {
  const [dayResult, setDayResult] = useState<AdvanceDayResult | null>(null);
  const [repairMessage, setRepairMessage] = useState<string | null>(null);
  const preview = useMemo(() => previewBusinessDayClose(save), [save]);
  const order = businessServiceSession?.current;
  const currentOrderRef = order ? { orderId: order.order.id, recipeId: order.recipe.id } : null;
  const alerts = useMemo(
    () => businessAlertsFor(save, currentOrderRef),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentOrderRef is rebuilt every render; its identity is fully described by these two fields
    [save, currentOrderRef?.orderId, currentOrderRef?.recipeId],
  );
  const needsAttention = alerts.filter((a) => a.severity !== "ok");

  function endDay() {
    setRepairMessage(null);
    setDayResult(onAdvanceDay());
  }

  function runAlertAction(alert: BusinessAlert) {
    if (!alert.action) return;
    if (alert.action.kind === "navigate") {
      go(alert.action.screen);
      return;
    }
    // Rush Restock renders its own buttons (RushRestockActions), never this one.
    if (alert.action.kind === "rush-restock") return;
    const result = performRefrigeratorMaintenance();
    setRepairMessage(
      result.ok
        ? `Refrigerator repaired for ${formatUsd(result.cost)} — back to 100/100.`
        : result.reason === "insufficientFunds"
          ? "Not enough cash for the repair yet."
          : "The refrigerator doesn't need a repair.",
    );
  }

  const shared = { save, go, preview, businessServiceSession, dayResult, endDay };
  // Cleanliness & Maintenance: restaurant build, the whole section from its level.
  const cleanlinessOpen =
    RESTAURANT_MODE &&
    !!cleanlinessAction &&
    restaurantLevelOf(save.levelProgress) >= CLEANING_FROM_LEVEL;
  const tabs = cleanlinessOpen ? TABS : TABS.filter((t) => t.id !== "cleanliness");

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="absolute inset-0 bg-[radial-gradient(90%_50%_at_50%_0%,rgba(216,168,78,0.28),transparent_60%)]" />
      <div className="relative h-full overflow-y-auto no-scrollbar pb-24">
        <ScreenHeader
          title={RESTAURANT_MODE ? "Restaurant" : "Business"}
          subtitle={RESTAURANT_MODE ? "your back office" : "your restaurant"}
          onBack={() => go("kitchen")}
          right={<BusinessCash cents={save.credits} />}
        />

        <nav
          className={cn(
            "category-tabs grid gap-2 px-4",
            tabs.length > 6 ? "grid-cols-4" : "grid-cols-3",
          )}
          aria-label="Business sections"
        >
          {tabs.map((item) => {
            const active = tab === item.id;
            const badgeCount =
              item.id === "operations"
                ? needsAttention.length
                : item.id === "cleanliness"
                  ? cleanlinessOf(save).tasks.length
                  : 0;
            const badge = badgeCount > 0;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => go(BUSINESS_TAB_SCREEN[item.id])}
                className={cn(
                  "press relative flex h-[60px] flex-col items-center justify-center gap-0.5 rounded-[18px] border px-0.5",
                  active
                    ? "wood border-walnut-dark/50 text-ivory shadow-soft"
                    : "card-warm border-walnut/15 text-walnut-dark",
                )}
              >
                <span className="text-[19px] leading-none" aria-hidden>
                  {item.emoji}
                </span>
                <span className="font-ui text-[11px] font-extrabold leading-tight">
                  {item.label}
                </span>
                {badge ? (
                  <span
                    className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-copper px-1 font-ui text-[10px] font-black text-ivory"
                    data-tab-badge={item.id}
                  >
                    {badgeCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="px-4 pt-4">
          {tab === "overview" ? (
            <Overview {...shared} needsAttention={needsAttention.length} />
          ) : null}
          {tab === "equipment" ? (
            <BusinessRefrigerator
              go={go}
              save={save}
              purchaseRefrigerator={purchaseRefrigerator}
              performRefrigeratorMaintenance={performRefrigeratorMaintenance}
            />
          ) : null}
          {tab === "staff" ? (
            <BusinessStaff
              save={save}
              hireStaff={hireStaff}
              fireStaff={fireStaff}
              buyStaff={buyStaff}
            />
          ) : null}
          {tab === "suppliers" ? (
            <BusinessSuppliers
              save={save}
              signSupplierContract={signSupplierContract}
              cancelSupplierContract={cancelSupplierContract}
              selectSupplier={selectSupplier}
            />
          ) : null}
          {tab === "menu" ? (
            <BusinessMenu
              save={save}
              setMenuPrice={setMenuPrice}
              setBusinessDishActive={setBusinessDishActive}
              {...(RESTAURANT_MODE
                ? { restaurantLevel: restaurantLevelOf(save.levelProgress) }
                : {})}
            />
          ) : null}
          {tab === "cleanliness" && cleanlinessAction ? (
            <BusinessCleanliness go={go} save={save} cleanlinessAction={cleanlinessAction} />
          ) : null}
          {tab === "operations" ? (
            <Operations
              {...shared}
              alerts={alerts}
              repairMessage={repairMessage}
              onAlertAction={runAlertAction}
              rushRestock={rushRestock}
              rushAdAvailable={rushAdAvailable}
            />
          ) : null}
        </div>

        <p className="px-8 pb-2 pt-5 text-center font-hand text-[15px] text-walnut/45">
          {RESTAURANT_MODE
            ? "One restaurant, one wallet: every level you cook is a service here."
            : "Business runs on its own calendar and shares your one wallet with the kitchen."}
        </p>
      </div>
      <BottomNav active="business" go={go} />
    </div>
  );
}

type Shared = {
  save: SaveData;
  go: (s: ScreenId) => void;
  preview: ReturnType<typeof previewBusinessDayClose>;
  businessServiceSession: ServiceSession | null;
  dayResult: AdvanceDayResult | null;
  endDay: () => void;
};

/* ════════════════════════ OVERVIEW ════════════════════════ */

function Overview({
  save,
  go,
  preview,
  businessServiceSession,
  dayResult,
  endDay,
  needsAttention,
}: Shared & { needsAttention: number }) {
  const today = preview.dailyPnL;
  const revenue = today.revenue;
  const costs = costsOf(today);
  const profit = today.operatingProfit;
  const last = save.business.finance.lastDailyPnL;
  const popularity = save.business.popularity.score;
  const { businessDay } = save.business.calendar;

  // Unified Restaurant before Level 250 (audit 2026-10-08): the campaign IS
  // the restaurant, so the Overview shows ITS day (services, money since the
  // day opened) — not the Endless Restaurant's Business Day, its popularity
  // forecast or "end the day" figures, which can't be used yet.
  if (!businessDayAllowed(RESTAURANT_MODE, save.levelProgress)) {
    return (
      <div className="space-y-3">
        <CampaignDayCard save={save} go={go} />
        <RankCard save={save} go={go} />
        <OneRestaurantNote />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <RestaurantHealth
        day={businessDay}
        popularity={popularity}
        revenue={revenue}
        costs={costs}
        profit={profit}
        needsAttention={needsAttention}
        onAttention={() => go(BUSINESS_TAB_SCREEN.operations)}
      />
      {/* Endless Restaurant only: today's events (renders nothing on any other day). */}
      <EndlessDayEvents save={save} compact />
      <KpiCards
        revenue={revenue}
        costs={costs}
        profit={profit}
        popularity={popularity}
        last={last}
      />
      <TodayAtAGlance save={save} today={today} />
      <PerformanceCard today={today} last={last} />
      <PopularityCard
        popularity={popularity}
        breakdown={preview.popularityBreakdown}
        delta={preview.popularityDelta}
        projected={preview.popularityScore}
      />
      <RankCard save={save} go={go} />
      <MoneyBreakdown pnl={today} />
      {businessDayAllowed(RESTAURANT_MODE, save.levelProgress) ? (
        <>
          <BusinessDayCard save={save} businessServiceSession={businessServiceSession} />
          {dayResult ? <DaySummary result={dayResult} day={businessDay - 1} go={go} /> : null}
          <Milestones save={save} />
          <DayActions
            save={save}
            go={go}
            businessServiceSession={businessServiceSession}
            endDay={endDay}
          />
        </>
      ) : (
        <OneRestaurantNote />
      )}
    </div>
  );
}

function RestaurantHealth({
  day,
  popularity,
  revenue,
  costs,
  profit,
  needsAttention,
  onAttention,
}: {
  day: number;
  popularity: number;
  revenue: number;
  costs: number;
  profit: number;
  needsAttention: number;
  onAttention: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-walnut-dark/50 wood p-4 shadow-lift">
      <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,247,232,0.28),transparent_70%)]" />
      <div className="relative">
        <div className="flex items-baseline justify-between gap-2">
          <Eyebrow dark>🏆 Restaurant health</Eyebrow>
          <span className="font-ui text-[12px] font-bold uppercase tracking-[0.12em] text-ivory/60">
            Week {businessWeekFor(day)}
          </span>
        </div>
        <p className="mt-1 font-display text-[24px] font-black leading-none text-ivory">
          Business Day {day}{" "}
          <span className="font-hand text-[18px] font-normal text-ivory/70">
            {dayOfWeekFor(day)}
          </span>
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Stars n={popularityStars(popularity)} size={16} />
          <span className="font-ui text-[12.5px] font-extrabold text-ivory">
            Popularity {popularity} / 100
          </span>
        </div>
        <div className="mt-1.5">
          <Bar fraction={popularity / 100} tone="sage" dark />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["Revenue", revenue],
              ["Costs", costs],
              ["Profit", profit],
            ] as const
          ).map(([label, v]) => (
            <div key={label} className="rounded-[14px] bg-ivory/10 px-1 py-2">
              <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.12em] text-ivory/60">
                {label}
              </p>
              <p className="font-display text-[16.5px] font-black leading-tight text-ivory">
                {formatUsd(v)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 font-hand text-[15px] leading-snug text-ivory/75">
          {profit > 0
            ? "Today is profitable so far."
            : revenue === 0
              ? "No customers served yet today — open the restaurant to start earning."
              : "Today's costs are ahead of revenue so far."}{" "}
          Includes tonight's staff pay.
        </p>
        {needsAttention > 0 ? (
          <button
            type="button"
            onClick={onAttention}
            className="press mt-2 flex h-12 w-full items-center justify-between rounded-[14px] border border-gold/40 bg-gold/15 px-3 font-ui text-[12.5px] font-extrabold text-gold"
          >
            <span>
              ⚠️ {needsAttention} thing{needsAttention === 1 ? "" : "s"} need
              {needsAttention === 1 ? "s" : ""} attention
            </span>
            <span>Operations →</span>
          </button>
        ) : (
          <p className="mt-2 font-ui text-[12.5px] font-extrabold text-ivory/80">
            ✓ Nothing needs your attention right now
          </p>
        )}
      </div>
    </div>
  );
}

function Trend({ now, before }: { now: number; before: number | null }) {
  if (before === null)
    return <span className="font-ui text-[11px] font-bold text-walnut/45">first day</span>;
  const diff = now - before;
  if (diff === 0)
    return <span className="font-ui text-[11px] font-bold text-walnut/45">same as last day</span>;
  return (
    <span
      className={cn("font-ui text-[11px] font-extrabold", diff > 0 ? "text-olive" : "text-copper")}
    >
      {diff > 0 ? "▲" : "▼"} {formatUsd(Math.abs(diff))} vs last day
    </span>
  );
}

function KpiCards({
  revenue,
  costs,
  profit,
  popularity,
  last,
}: {
  revenue: number;
  costs: number;
  profit: number;
  popularity: number;
  last: DailyPnL | null;
}) {
  const cards: Array<{ icon: string; label: string; value: string; sub: ReactNode }> = [
    {
      icon: "💰",
      label: "Revenue",
      value: formatUsd(revenue),
      sub: <Trend now={revenue} before={last?.revenue ?? null} />,
    },
    {
      icon: "📉",
      label: "Costs",
      value: formatUsd(costs),
      sub: <Trend now={costs} before={last ? costsOf(last) : null} />,
    },
    {
      icon: "📈",
      label: "Profit",
      value: formatUsd(profit),
      sub: <Trend now={profit} before={last?.operatingProfit ?? null} />,
    },
    {
      icon: "⭐",
      label: "Popularity",
      value: `${popularity} / 100`,
      sub: (
        <span className="font-ui text-[11px] font-bold text-walnut/55">
          {"★".repeat(popularityStars(popularity))}
          {"☆".repeat(5 - popularityStars(popularity))}
        </span>
      ),
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-[20px] border border-walnut/15 p-3 card-warm">
          <p className="font-ui text-[12px] font-extrabold text-walnut/65">
            <span aria-hidden>{c.icon}</span> {c.label}
          </p>
          <p className="mt-0.5 font-display text-[19px] font-black leading-tight text-walnut-dark">
            {c.value}
          </p>
          <div className="mt-0.5">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

function PerformanceCard({ today, last }: { today: DailyPnL; last: DailyPnL | null }) {
  const groups: MoneyGroup[] = [
    ...(last
      ? [
          {
            label: "Last day",
            revenue: last.revenue,
            costs: costsOf(last),
            profit: last.operatingProfit,
          },
        ]
      : []),
    {
      label: "Today so far",
      revenue: today.revenue,
      costs: costsOf(today),
      profit: today.operatingProfit,
    },
  ];
  return (
    <Panel className="p-4">
      <Eyebrow>📈 Business performance</Eyebrow>
      <div className="mt-2">
        <MoneyBars groups={groups} />
      </div>
      <MoneyLegend />
      <p className="mt-2 font-hand text-[14px] leading-snug text-walnut/60">
        {last
          ? "Your last completed day next to today (today includes tonight's staff pay). The game keeps your last day's results, not a longer history."
          : "Today so far. After your first End Business Day, that day appears here next to today."}
      </p>
    </Panel>
  );
}

function PopularityCard({
  popularity,
  breakdown,
  delta,
  projected,
}: {
  popularity: number;
  breakdown: PopularityDayBreakdown;
  delta: number;
  projected: number;
}) {
  const factors: Array<[string, number]> = [
    ["Service today", breakdown.service],
    ["Menu, staff & fridge", breakdown.operations],
    ["Inspection", breakdown.inspection],
    ["Settling toward 50", breakdown.pull],
  ];
  return (
    <Panel className="p-4">
      <div className="flex items-baseline justify-between">
        <Eyebrow>⭐ Restaurant popularity</Eyebrow>
        <p className="font-display text-[22px] font-black text-walnut-dark">
          {popularity}
          <span className="font-hand text-[15px] font-normal text-walnut/60"> / 100</span>
        </p>
      </div>
      <div className="mt-1">
        <Stars n={popularityStars(popularity)} size={18} />
      </div>
      <div className="mt-2">
        <Bar fraction={popularity / 100} tone="sage" />
      </div>
      <p className="mt-2 font-display text-[14.5px] font-black leading-snug text-walnut-dark">
        {popularityMood(popularity)}
      </p>
      <p className="mt-2 font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-walnut/55">
        If you end the day now: {signed(delta)} → {projected}
      </p>
      <div className="mt-1 space-y-1">
        {factors.map(([label, v]) => (
          <div key={label} className="flex items-center justify-between font-ui text-[12.5px]">
            <span className="font-bold text-walnut/70">{label}</span>
            <span
              className={cn(
                "font-extrabold",
                v > 0 ? "text-olive" : v < 0 ? "text-copper" : "text-walnut/45",
              )}
            >
              {signed(v)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 font-hand text-[13px] leading-snug text-walnut/50">
        Popularity sets how many customers come tomorrow.
      </p>
    </Panel>
  );
}

function RankCard({ save, go }: { save: SaveData; go: (s: ScreenId) => void }) {
  const p = restaurantProgress(save);
  return (
    <Panel tone="cream" className="p-4">
      <Eyebrow>🏆 Restaurant rank</Eyebrow>
      <p className="mt-1 font-display text-[19px] font-black leading-tight text-walnut-dark">
        {p.rank.title}
      </p>
      <div className="mt-2">
        <Bar fraction={p.rank.fraction} />
      </div>
      <p className="mt-1.5 font-ui text-[12.5px] font-bold text-walnut/70">
        Level {p.campaignComplete ? p.level.total : p.level.current} / {p.level.total}
        {p.nextRank
          ? ` · Next: ${p.nextRank.title} at Lv ${p.nextRank.levelRequired}`
          : " · every rank reached"}
      </p>
      <KButton full variant="cream" className="mt-3" onClick={() => go("rack")}>
        View Restaurant Progress →
      </KButton>
    </Panel>
  );
}

function MoneyBreakdown({ pnl }: { pnl: DailyPnL }) {
  const segments = [
    { label: "Ingredients used", value: pnl.cogs, color: "var(--color-sage)" },
    { label: "Staff pay", value: pnl.staffCost, color: "var(--color-copper)" },
    { label: "Repairs", value: pnl.maintenanceCost, color: "var(--color-walnut)" },
    { label: "Supplier fees", value: pnl.supplierCost, color: "var(--color-gold)" },
    { label: "Inspection fines", value: pnl.inspectionFines, color: "var(--color-tomato)" },
    { label: "Other", value: pnl.otherOperatingCost, color: "var(--color-olive)" },
  ];
  const costs = costsOf(pnl);
  return (
    <Panel className="p-4">
      <Eyebrow>🧾 Where your money goes · today</Eyebrow>
      {costs > 0 ? (
        <div className="mt-2">
          <StackedBar segments={segments} />
        </div>
      ) : (
        <p className="mt-1.5 font-hand text-[15px] text-walnut/60">
          No costs yet today — hire staff, serve orders or buy supplies and they'll show here.
        </p>
      )}
      <Divider />
      <div className="space-y-0.5 font-ui text-[13.5px]">
        <div className="flex justify-between font-bold text-walnut/75">
          <span>Revenue</span>
          <span style={{ color: MONEY_COLORS.revenue }}>{formatUsd(pnl.revenue)}</span>
        </div>
        <div className="flex justify-between font-bold text-walnut/75">
          <span>− Costs</span>
          <span style={{ color: MONEY_COLORS.costs }}>{formatUsd(costs)}</span>
        </div>
        <div className="flex justify-between border-t border-walnut/15 pt-1 font-black text-walnut-dark">
          <span>= Profit</span>
          <span>{formatUsd(pnl.operatingProfit)}</span>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Unified Restaurant (RESTAURANT_MODE) before Level 250: there is ONE
 * restaurant — the campaign — so there is no separate Business Day to open.
 * Its menu orders, stock, supplies, staff and day all run in the campaign's
 * services; the Endless Restaurant (this Business engine) opens after L250.
 */
/** The campaign restaurant's day: its services (done / to come) and the money it has made since it opened. */
function CampaignDayCard({ save, go }: { save: SaveData; go: (s: ScreenId) => void }) {
  const d = restaurantDayOf(save);
  const next = restaurantLevelOf(save.levelProgress);
  const services = todaysServices(save, next);
  const since = d.opened && d.openingCredits !== null ? save.credits - d.openingCredits : null;
  return (
    <div
      className="relative overflow-hidden rounded-[26px] border border-walnut-dark/50 wood p-4 shadow-lift"
      data-testid="campaign-day"
    >
      <Eyebrow dark>🍽️ Your restaurant today</Eyebrow>
      <p className="mt-1 font-display text-[24px] font-black leading-none text-ivory">
        Day {d.day}
        <span className="ml-2 font-hand text-[18px] font-normal text-gold/90">
          {d.closingDue ? "closing time" : d.opened ? "open" : "opens with your next level"}
        </span>
      </p>
      <ul className="mt-2 space-y-1">
        {services.map((sv) => (
          <li key={sv.name} className="font-ui text-[13.5px] font-bold text-ivory/90">
            {sv.done ? "✓" : "•"} {sv.name} · Level {sv.levelNumber}
          </li>
        ))}
      </ul>
      {since !== null ? (
        <p className="mt-2 font-ui text-[13.5px] font-extrabold text-gold">
          Since opening: {since >= 0 ? "+" : "−"}
          {formatUsd(Math.abs(since))}
        </p>
      ) : null}
      <KButton variant="copper" full className="mt-3 min-h-12" onClick={() => go("kitchen")}>
        {d.closingDue ? "Close the restaurant →" : "Play the next service →"}
      </KButton>
    </div>
  );
}

function OneRestaurantNote() {
  return (
    <Panel className="p-4">
      <div data-testid="one-restaurant-note">
        <Eyebrow>🍽️ One restaurant</Eyebrow>
        <p className="mt-1 font-hand text-[16px] leading-snug text-walnut-dark">
          Your restaurant runs through the campaign: every level is a service, with menu orders,
          stock, supplies and staff. Play the next level from the Kitchen.
        </p>
        <p className="mt-1 font-ui text-[12.5px] font-bold text-walnut/60">
          🔒 The {ENDLESS_RESTAURANT_NAME} — open-ended days with everything you built — opens after
          Level 250.
        </p>
      </div>
    </Panel>
  );
}

function BusinessDayCard({
  save,
  businessServiceSession,
}: {
  save: SaveData;
  businessServiceSession: ServiceSession | null;
}) {
  const customers = businessCustomersToday(save);
  const order = businessServiceSession?.current;
  const dish = order ? businessDishForRecipeId(order.recipe.id) : undefined;
  const popularity = save.business.popularity.score;
  return (
    <Panel className="p-4">
      <Eyebrow>
        🍽️ {RESTAURANT_MODE ? ENDLESS_RESTAURANT_NAME : "Business"} Day{" "}
        {save.business.calendar.businessDay}
      </Eyebrow>
      <div className="mt-2 flex items-baseline justify-between font-ui text-[12.5px] font-bold text-walnut/75">
        <span>Customers Today</span>
        <span className="font-extrabold text-walnut-dark">
          {customers.served} / {customers.target} served
        </span>
      </div>
      <div className="mt-1">
        <Bar
          fraction={customers.target > 0 ? customers.served / customers.target : 0}
          tone="sage"
        />
      </div>
      <div className="mt-3 flex items-baseline justify-between font-ui text-[12.5px] font-bold text-walnut/75">
        <span>Popularity</span>
        <span className="font-extrabold text-walnut-dark">{popularity} / 100</span>
      </div>
      <div className="mt-1">
        <Bar fraction={popularity / 100} />
      </div>
      <p className="mt-2 font-hand text-[14px] leading-snug text-walnut/60">
        {usesRestaurantDemand(save) ? (
          // Endless Restaurant: the target (businessCustomersToday) comes from the restaurant's
          // demand, today's events and the team's capacity — not the classic popularity formula.
          <>
            Today's expected customers: {customers.target} — set by your popularity, menu and
            today's events, up to what your team can serve. {customers.remaining} remaining.
          </>
        ) : (
          <>
            Today's target: popularity {customers.popularity}/100 ×{" "}
            {customers.multiplier.toFixed(2)} of {BASE_CUSTOMERS_PER_DAY} base customers ={" "}
            {customers.target}. {customers.remaining} remaining.
          </>
        )}
      </p>
      {customers.complete ? (
        <p className="mt-1 font-hand text-[16px] leading-snug text-walnut/75">
          Today's customers are complete. No more customers will arrive today — end the day when
          you're ready.
        </p>
      ) : order && dish ? (
        (() => {
          const availability = businessOrderAvailability(save, dish);
          const payment = businessCustomerPayment(save, dish);
          return (
            <div className="mt-2 rounded-[14px] bg-cream/70 p-3">
              <p className="font-hand text-[16px] leading-snug text-walnut-dark">
                {order.customer.avatarEmoji} {order.customer.name} is waiting for <b>{dish.name}</b>{" "}
                — pays {formatUsd(payment.customerPays)}.
              </p>
              <p
                className={cn(
                  "mt-0.5 font-hand text-[14px]",
                  availability.available ? "text-olive" : "text-copper",
                )}
              >
                {availability.available
                  ? "✓ All ingredients in stock."
                  : `Missing ${availability.missing.map((id) => INGREDIENTS[id]?.name ?? id).join(", ")} — restock to accept it.`}
              </p>
            </div>
          );
        })()
      ) : (
        <p className="mt-1 font-hand text-[15px] leading-snug text-walnut/65">
          The restaurant is closed. Open it to take real orders.
        </p>
      )}
    </Panel>
  );
}

function DayActions({
  save,
  go,
  businessServiceSession,
  endDay,
}: {
  save: SaveData;
  go: (s: ScreenId) => void;
  businessServiceSession: ServiceSession | null;
  endDay: () => void;
}) {
  const customers = businessCustomersToday(save);
  const hasOrder = !!businessServiceSession?.current;
  return (
    <div className="space-y-2">
      <KButton
        full
        size="lg"
        variant={customers.complete ? "cream" : "wood"}
        onClick={() => go("business-service")}
      >
        🍽️{" "}
        {hasOrder
          ? "Go to Service →"
          : RESTAURANT_MODE
            ? `Open the ${ENDLESS_RESTAURANT_NAME} →`
            : "Open Restaurant →"}
      </KButton>
      <KButton full size="lg" variant={customers.complete ? "wood" : "cream"} onClick={endDay}>
        End Business Day →
      </KButton>
    </div>
  );
}

function Milestones({ save }: { save: SaveData }) {
  const b = save.business;
  const ledger = save.economyLedger;
  const hadStaff =
    b.staff.hiredRoles.length > 0 || ledger.some((e) => e.category === "business-staff-salary");
  const items: Array<{ label: string; done: boolean }> = [
    { label: "First ingredients bought", done: b.finance.lifetime.inventoryPurchaseCost > 0 },
    { label: "First order served", done: b.finance.lifetime.orderCount > 0 },
    { label: "First Business Day completed", done: b.calendar.businessDay > 1 },
    { label: "First staff member on the team", done: hadStaff },
    {
      label: "Refrigerator upgraded",
      done: b.refrigerator.refrigeratorId !== DEFAULT_REFRIGERATOR_ID,
    },
    { label: "A full week open (Day 8)", done: b.calendar.businessDay > 7 },
    { label: "Popularity 75 or higher right now", done: b.popularity.score >= 75 },
    { label: "25 orders served", done: b.finance.lifetime.orderCount >= 25 },
  ];
  const done = items.filter((i) => i.done).length;
  return (
    <Panel className="p-4">
      <div className="flex items-baseline justify-between">
        <Eyebrow>🎯 Restaurant milestones</Eyebrow>
        <span className="font-ui text-[12.5px] font-extrabold text-walnut-dark">
          {done} / {items.length}
        </span>
      </div>
      <div className="mt-2">
        <Bar fraction={done / items.length} tone="sage" />
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((m) => (
          <li
            key={m.label}
            className={cn(
              "flex items-center gap-2 font-ui text-[13.5px]",
              m.done ? "font-extrabold text-walnut-dark" : "font-bold text-walnut/45",
            )}
          >
            <span aria-hidden className="w-5 text-center">
              {m.done ? "✓" : "○"}
            </span>
            {m.label}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function DaySummary({
  result,
  day,
  go,
}: {
  result: AdvanceDayResult;
  day: number;
  go: (s: ScreenId) => void;
}) {
  const pnl = result.dailyPnL;
  return (
    <Panel tone="cream" className="p-4">
      <Eyebrow>✅ Day {day} closed</Eyebrow>
      <div className="mt-2">
        <MoneyBars
          groups={[
            {
              label: `Day ${day}`,
              revenue: pnl.revenue,
              costs: costsOf(pnl),
              profit: pnl.operatingProfit,
            },
          ]}
        />
      </div>
      <MoneyLegend />
      <div className="mt-2 space-y-0.5 font-ui text-[12.5px] font-bold text-walnut/75">
        <div className="flex justify-between">
          <span>Popularity</span>
          <span className="font-extrabold text-walnut-dark">
            {signed(result.popularityDelta)} → {result.popularityScore}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Inspection</span>
          <span className="font-extrabold text-walnut-dark">
            {result.inspectionReport.overall}
            {result.inspectionFine.finePaid > 0
              ? ` · fine ${formatUsd(result.inspectionFine.finePaid)}`
              : ""}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Spoiled</span>
          <span className="font-extrabold text-walnut-dark">
            {result.spoiledQuantity > 0
              ? `${formatQuantity(result.spoiledQuantity)} units · ${formatUsd(result.spoiledValue)}`
              : "nothing"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Closing cash</span>
          <span className="font-extrabold text-walnut-dark">{formatUsd(pnl.closingCash)}</span>
        </div>{" "}
        {result.todaysSpecialBonus ? (
          <div className="flex justify-between" data-testid="day-special-bonus">
            <span>Today's Special bonus</span>
            <span className="font-extrabold text-walnut-dark">
              +{formatUsd(result.todaysSpecialBonus)}
            </span>
          </div>
        ) : null}
        {result.endlessStars ? (
          <div className="flex justify-between" data-testid="day-stars">
            <span>Stars</span>
            <span className="font-extrabold text-walnut-dark">
              {"★".repeat(result.endlessStars.stars)}
              {"☆".repeat(ENDLESS_STARS_PER_DAY - result.endlessStars.stars)} ·{" "}
              {[
                result.endlessStars.profitable ? "profitable" : null,
                result.endlessStars.busy ? "busy" : null,
                result.endlessStars.clean ? "clean" : null,
              ]
                .filter(Boolean)
                .join(", ") || "none today"}
            </span>
          </div>
        ) : null}
      </div>
      {result.staffLaidOff.length > 0 ? (
        <p className="mt-1 font-hand text-[15px] text-copper">
          Pay couldn't be covered — the whole team was let go.
        </p>
      ) : null}
      {result.expiredSupplierId ? (
        <p className="mt-1 font-hand text-[15px] text-copper">
          Your contract with{" "}
          {getSupplier(result.expiredSupplierId)?.name ?? result.expiredSupplierId} ended.
        </p>
      ) : null}
      <KButton
        full
        size="sm"
        variant="ghost"
        className="mt-3 h-12"
        onClick={() => go(BUSINESS_TAB_SCREEN.operations)}
      >
        Full results in Operations →
      </KButton>
    </Panel>
  );
}

/* ════════════════════════ OPERATIONS ════════════════════════ */

function Operations({
  save,
  go,
  preview,
  businessServiceSession,
  dayResult,
  endDay,
  alerts,
  repairMessage,
  onAlertAction,
  rushRestock,
  rushAdAvailable,
}: Shared & {
  alerts: BusinessAlert[];
  repairMessage: string | null;
  onAlertAction: (a: BusinessAlert) => void;
  rushRestock: (payment: RushRestockPayment) => Promise<RushRestockOutcome>;
  rushAdAvailable: boolean;
}) {
  const blockedOrder = businessServiceSession?.current;
  const blockedDish = blockedOrder ? businessDishForRecipeId(blockedOrder.recipe.id) : undefined;
  const actionable = alerts.filter((a) => a.severity !== "ok");
  const allClear = alerts.filter((a) => a.severity === "ok");
  const pnl = preview.dailyPnL;
  return (
    <div className="space-y-3">
      {/* What needs attention */}
      <Panel className="p-4">
        <Eyebrow>📋 What needs attention</Eyebrow>
        {repairMessage ? (
          <p className="mt-2 font-hand text-[15px] text-olive">{repairMessage}</p>
        ) : null}
        {actionable.length === 0 ? (
          <p className="mt-1.5 font-hand text-[16px] text-olive">
            ✓ Nothing needs your attention right now.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {actionable.map((alert) => (
              <div
                key={alert.key}
                className={cn(
                  "rounded-[14px] border p-3",
                  alert.severity === "critical" || alert.severity === "warning"
                    ? "border-copper/30 bg-gold/10"
                    : "border-walnut/10 bg-cream/60",
                )}
              >
                <p className="font-ui text-[13.5px] font-extrabold text-walnut-dark">
                  {SEVERITY_ICON[alert.severity]} {alert.title}
                </p>
                <p className="mt-0.5 font-hand text-[15px] leading-snug text-walnut/70">
                  {alert.detail}
                </p>
                {alert.action?.kind === "rush-restock" ? (
                  blockedDish ? (
                    <RushRestockActions
                      save={save}
                      dish={blockedDish}
                      go={go}
                      rushRestock={rushRestock}
                      rushAdAvailable={rushAdAvailable}
                    />
                  ) : null
                ) : alert.action ? (
                  <KButton
                    full
                    variant={alert.action.kind === "repair-refrigerator" ? "copper" : "cream"}
                    className="mt-2"
                    onClick={() => onAlertAction(alert)}
                  >
                    {alert.action.label}
                    {alert.action.kind === "navigate" ? " →" : ""}
                  </KButton>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {allClear.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {allClear.map((a) => (
              <span
                key={a.key}
                className="rounded-full border border-olive/30 bg-sage/15 px-2 py-[3px] font-ui text-[12px] font-extrabold text-olive"
              >
                ✓ {a.title}
              </span>
            ))}
          </div>
        ) : null}
      </Panel>

      {/* Actions + what closing now does */}
      <Panel className="p-4">
        <Eyebrow>🍽️ Today's service</Eyebrow>
        <BusinessDayCardInline save={save} />
        <div className="mt-3 space-y-2">
          <KButton full onClick={() => go("business-service")}>
            🍽️ {businessServiceSession?.current ? "Go to Service →" : "Open Restaurant →"}
          </KButton>
        </div>
        <Divider />
        <p className="font-ui text-[12.5px] font-extrabold text-walnut-dark">
          If you end the day now
        </p>
        <div className="mt-1 space-y-0.5 font-ui text-[12.5px] font-bold text-walnut/75">
          <div className="flex justify-between">
            <span>Staff pay</span>
            <span className="font-extrabold text-walnut-dark">
              {preview.staffLaidOff.length > 0
                ? "can't be paid — team let go"
                : preview.payrollPaid > 0
                  ? `−${formatUsd(preview.payrollPaid)}`
                  : "none"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Spoilage</span>
            <span className="font-extrabold text-walnut-dark">
              {preview.spoiledQuantity > 0
                ? `${formatQuantity(preview.spoiledQuantity)} units (${formatUsd(preview.spoiledValue)})`
                : "nothing spoils"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Inspection</span>
            <span className="font-extrabold text-walnut-dark">
              {preview.inspectionReport.overall}
              {preview.inspectionFine.fineAmount > 0
                ? ` · fine ${formatUsd(preview.inspectionFine.fineAmount)}`
                : " · no fine"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Popularity</span>
            <span className="font-extrabold text-walnut-dark">
              {signed(preview.popularityDelta)} → {preview.popularityScore}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Day's profit</span>
            <span className="font-extrabold text-walnut-dark">
              {formatUsd(pnl.operatingProfit)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Closing cash</span>
            <span className="font-extrabold text-walnut-dark">{formatUsd(pnl.closingCash)}</span>
          </div>
        </div>
        {preview.expiredSupplierId ? (
          <p className="mt-1 font-hand text-[14px] text-walnut/60">
            Your {getSupplier(preview.expiredSupplierId)?.name ?? preview.expiredSupplierId}{" "}
            contract ends tonight.
          </p>
        ) : null}
        {businessDayAllowed(RESTAURANT_MODE, save.levelProgress) ? (
          <KButton full size="lg" className="mt-3" onClick={endDay}>
            End Business Day →
          </KButton>
        ) : (
          <p className="mt-3 font-hand text-[15px] leading-snug text-walnut/70">
            Your restaurant's day ends at closing time after its services. The open-ended{" "}
            {ENDLESS_RESTAURANT_NAME} opens after Level 250.
          </p>
        )}
      </Panel>

      {dayResult ? (
        <DaySummary result={dayResult} day={save.business.calendar.businessDay - 1} go={go} />
      ) : null}

      <BusinessInspections save={save} />
      <BusinessFinance save={save} />
      <BusinessHistory save={save} />
      <OperationsAnalytics save={save} />
    </div>
  );
}

function BusinessDayCardInline({ save }: { save: SaveData }) {
  const customers = businessCustomersToday(save);
  return (
    <>
      <div className="mt-2 flex items-baseline justify-between font-ui text-[12.5px] font-bold text-walnut/75">
        <span>Customers Today</span>
        <span className="font-extrabold text-walnut-dark">
          {customers.served} / {customers.target} served
        </span>
      </div>
      <div className="mt-1">
        <Bar
          fraction={customers.target > 0 ? customers.served / customers.target : 0}
          tone="sage"
        />
      </div>
    </>
  );
}
