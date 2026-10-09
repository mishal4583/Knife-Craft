import { formatUsd } from "@/game/business/businessCurrency";
import type { BusinessCustomerPayment } from "@/game/business/BusinessServiceManager";

/**
 * BUSINESS_PAYMENT_LINES — Economy V3 Phase 16 (willingness-to-pay). The
 * one display of "Menu Price × Customer Modifier = Customer Pays", used by
 * the Service screen (before serving) and the served card (after). Shows
 * only the figures `businessCustomerPayment` already computed — never a
 * second calculation.
 */
export function BusinessPaymentLines({
  payment,
  paid = false,
}: {
  payment: BusinessCustomerPayment;
  /** true on the served card ("Customer Paid"), false before serving ("Customer Pays"). */
  paid?: boolean;
}) {
  const rows: [string, string][] = [
    ["Menu Price", formatUsd(payment.menuPrice)],
    ["Popularity", `${payment.popularity}/100`],
    ["Customer Modifier", `×${payment.multiplier.toFixed(2)}`],
  ];
  return (
    <div className="w-full">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between py-0.5">
          <p className="font-ui text-[12px] font-bold uppercase tracking-[0.14em] text-walnut/60">
            {label}
          </p>
          <p className="font-ui text-[13.5px] font-bold tabular-nums text-walnut/80">{value}</p>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-walnut/15 pt-1">
        <p className="font-ui text-[12px] font-extrabold uppercase tracking-[0.14em] text-walnut-dark">
          {paid ? "Customer Paid" : "Customer Pays"}
        </p>
        <p className="font-display text-[18px] font-black text-walnut-dark">
          {formatUsd(payment.customerPays)}
        </p>
      </div>
    </div>
  );
}
