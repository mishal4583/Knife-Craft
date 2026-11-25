import { useState, type ReactNode } from "react";
import type { SaveData } from "@/game/SaveManager";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/business/businessCurrency";
import {
  HISTORY_DAYS,
  dayHistoryOf,
  type BusinessDayRecord,
} from "@/game/business/businessDayHistory";
import { Art, PIcon, ProgressCard, ValuePill } from "../progress/ProgressKit";

/** A cost with a minus sign, or plain zero when there was none. */
const cost = (amount: number) => (amount > 0 ? `−${formatUsd(amount)}` : formatUsd(0));

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 font-ui text-[12.5px] font-bold text-walnut/70">
      <span>{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

/** A tear-off calendar page with the day written on it: the painted page (RB-icons-b) or a drawn one until it exists. */
function DatePage({ n }: { n: number }) {
  return (
    <span className="relative grid h-9 w-9 shrink-0 place-items-center" aria-hidden>
      <Art
        name="biz:icons-b/date-page"
        className="absolute inset-0 h-full w-full"
        fallback={
          <span className="absolute inset-0 overflow-hidden rounded-lg border border-[#c9a15a] bg-white shadow-sm">
            <span className="block h-2.5 bg-[#d9473a]" />
          </span>
        }
      />
      <span className="relative mt-1.5 font-display text-[13px] font-black leading-none text-walnut-dark">
        {n}
      </span>
    </span>
  );
}

/**
 * BUSINESS · OPERATIONS → History (task #10): the latest 30 completed days,
 * newest first, read from `business.finance.history` (businessDayHistory.ts —
 * copied from each day's settlement). A plain list; tapping a day shows its
 * breakdown. Read-only.
 *
 * Painted (developer 2026-11-25, Business UI design picture 10): a walnut-ribbon card, a chip row of the totals, a brown table head and zebra rows with a date
 * page, the revenue, an orders pill and a profit pill (pink when negative).
 */
export function BusinessHistory({ save }: { save: SaveData }) {
  const history = dayHistoryOf(save);
  const [open, setOpen] = useState<number | null>(null);
  const days = [...history].reverse();
  const totals = history.reduce(
    (t, d) => ({
      revenue: t.revenue + d.revenue,
      costs: t.costs + d.totalCosts,
      profit: t.profit + d.profit,
      orders: t.orders + d.ordersServed,
    }),
    { revenue: 0, costs: 0, profit: 0, orders: 0 },
  );
  return (
    <div data-testid="business-history">
      <ProgressCard
        dark
        title={`Last ${HISTORY_DAYS} days`}
        icon={<PIcon name="icons-c/calendar" fallback="📅" size={30} />}
        className="pt-10"
      >
        <Art
          name="biz:decor-b/chart-easel"
          className="pointer-events-none absolute right-3 top-0 hidden h-16 w-auto @min-[720px]:block"
        />
        {days.length === 0 ? (
          <p className="font-hand text-[15px] text-walnut/60">
            📅 No day closed yet · last {HISTORY_DAYS} kept
          </p>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-ui text-[13px] font-bold leading-snug text-walnut/75 @min-[720px]:pr-28">
              <Chip icon={<PIcon name="icons-a/bars" fallback="📊" size={22} />}>
                {days.length} day{days.length === 1 ? "" : "s"}
              </Chip>
              <Chip icon={<PIcon name="icons-a/coins" fallback="💰" size={22} />}>
                {formatUsd(totals.revenue)} revenue
              </Chip>
              <Chip icon={<PIcon name="icons-b/box" fallback="📦" size={22} />}>
                {formatUsd(totals.costs)} costs
              </Chip>
              <Chip icon={<PIcon name="icons-a/chart-trend" fallback="📈" size={22} />}>
                {formatUsd(totals.profit)} profit
              </Chip>
              <Chip icon={<PIcon name="icons-c/cloche" fallback="🔔" size={22} />}>
                {totals.orders} orders
              </Chip>
            </p>
            <div
              className="bz-thead mt-3 hidden min-h-11 grid-cols-4 items-center px-4 font-display text-[15px] font-black @min-[620px]:grid"
              aria-hidden
            >
              <span className="flex items-center gap-2">
                <PIcon name="icons-c/calendar" fallback="📅" size={24} /> Day
              </span>
              <span className="flex items-center gap-2">
                <PIcon name="icons-a/coins" fallback="💰" size={24} /> Revenue
              </span>
              <span className="flex items-center gap-2">
                <PIcon name="icons-c/cloche" fallback="🔔" size={24} /> Orders
              </span>
              <span className="flex items-center gap-2">
                <PIcon name="icons-a/chart-trend" fallback="📈" size={24} /> Profit
              </span>
            </div>
            <div className="mt-2 space-y-1">
              {days.map((d, i) => (
                <DayRow
                  key={d.day}
                  d={d}
                  zebra={i % 2 === 1}
                  open={open === d.day}
                  onToggle={() => setOpen(open === d.day ? null : d.day)}
                />
              ))}
            </div>
          </>
        )}
      </ProgressCard>
    </div>
  );
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  );
}

function DayRow({
  d,
  zebra,
  open,
  onToggle,
}: {
  d: BusinessDayRecord;
  zebra: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn("rounded-[14px]", zebra ? "bg-[#f3dfb6]/55" : "bg-[#fff6e6]/70")}
      data-history-day={d.day}
    >
      <button
        type="button"
        className="grid min-h-12 w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 px-3 py-1 text-left font-ui text-[13.5px] font-bold text-walnut-dark @min-[620px]:grid-cols-4"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="flex items-center gap-2.5 font-display text-[16px] font-black">
          <DatePage n={d.day} />
          Day {d.day}
        </span>
        <span
          className={cn(
            "justify-self-end rounded-full px-3 py-0.5 text-center font-extrabold tabular-nums @min-[620px]:order-4 @min-[620px]:justify-self-start",
            d.profit < 0 ? "bg-[#f9d3cd] text-[#a3261c]" : "bg-[#dcebc3] text-[#2f6b1f]",
          )}
        >
          {formatUsd(d.profit)}
        </span>
        <span className="font-extrabold tabular-nums @min-[620px]:order-2">
          {formatUsd(d.revenue)}
        </span>
        <span className="justify-self-end @min-[620px]:order-3 @min-[620px]:justify-self-start">
          <ValuePill className="min-h-7 px-2.5 text-[12.5px]">
            <PIcon name="icons-b/people" fallback="👥" size={18} />
            {d.ordersServed} order{d.ordersServed === 1 ? "" : "s"}
          </ValuePill>
        </span>
      </button>
      {open ? (
        <div className="space-y-0.5 px-3 pb-2">
          <Line label="Revenue" value={formatUsd(d.revenue)} />
          <Line label="Customers served" value={String(d.customersServed)} />
          <Line
            label="Average order"
            value={d.averageOrderValue === null ? "—" : formatUsd(d.averageOrderValue)}
          />
          <Line label="Ingredients & packaging used" value={cost(d.goodsUsed)} />
          <Line label="Staff wages" value={cost(d.staffWages)} />
          <Line label="Repairs" value={cost(d.maintenance)} />
          <Line label="Supplier fees" value={cost(d.supplierFees)} />
          <Line label="Inspection fines" value={cost(d.inspectionFines)} />
          {d.otherOperating ? <Line label="Other costs" value={cost(d.otherOperating)} /> : null}
          <Line label="Total costs" value={cost(d.totalCosts)} />
          <Line label="Profit" value={formatUsd(d.profit)} />
          <Line label="Waste (spoiled or thrown out)" value={formatUsd(d.waste)} />
          <Line
            label="Bought: ingredients · packaging · equipment"
            value={`${formatUsd(d.ingredientPurchases)} · ${formatUsd(d.packagingPurchases)} · ${formatUsd(d.equipmentPurchases)}`}
          />
          <Line label="Cash moved" value={formatUsd(d.netCash)} />
        </div>
      ) : null}
    </div>
  );
}
