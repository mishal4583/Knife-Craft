import { useState } from "react";
import type { SaveData } from "@/game/SaveManager";
import { Panel } from "../common/primitives";
import { Eyebrow } from "../common/Meters";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/game/business/businessCurrency";
import {
  HISTORY_DAYS,
  dayHistoryOf,
  type BusinessDayRecord,
} from "@/game/business/businessDayHistory";

/** A cost with a minus sign, or plain zero when there was none. */
const cost = (amount: number) => (amount > 0 ? `−${formatUsd(amount)}` : formatUsd(0));

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 font-ui text-[13.5px] font-bold text-walnut/70">
      <span>{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

/**
 * BUSINESS · OPERATIONS → History (task #10): the latest 30 completed days,
 * newest first, read from `business.finance.history` (businessDayHistory.ts —
 * copied from each day's settlement). A plain list; tapping a day shows its
 * breakdown. Read-only.
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
      <Panel className="p-4">
        <Eyebrow>📅 Last {HISTORY_DAYS} days</Eyebrow>
        {days.length === 0 ? (
          <p className="mt-1 font-hand text-[16px] text-walnut/60">
            No business day has ended yet — each completed day is kept here (the latest{" "}
            {HISTORY_DAYS}).
          </p>
        ) : (
          <>
            <p className="mt-1 font-hand text-[15px] leading-snug text-walnut/60">
              {days.length} day{days.length === 1 ? "" : "s"}: {formatUsd(totals.revenue)} revenue ·{" "}
              {formatUsd(totals.costs)} costs · {formatUsd(totals.profit)} profit · {totals.orders}{" "}
              orders
            </p>
            <div className="mt-2 space-y-1">
              {days.map((d) => (
                <DayRow
                  key={d.day}
                  d={d}
                  open={open === d.day}
                  onToggle={() => setOpen(open === d.day ? null : d.day)}
                />
              ))}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function DayRow({
  d,
  open,
  onToggle,
}: {
  d: BusinessDayRecord;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-[12px] bg-cream/60" data-history-day={d.day}>
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left font-ui text-[13.5px] font-bold text-walnut-dark"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="font-extrabold">Day {d.day}</span>
        <span className="tabular-nums text-walnut/70">
          {formatUsd(d.revenue)} · {d.ordersServed} order{d.ordersServed === 1 ? "" : "s"}
        </span>
        <span
          className={cn("tabular-nums font-extrabold", d.profit < 0 ? "text-copper" : "text-olive")}
        >
          {formatUsd(d.profit)}
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
