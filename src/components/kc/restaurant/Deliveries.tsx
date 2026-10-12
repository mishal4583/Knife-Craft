import { useEffect } from "react";
import { KButton, Panel } from "@/components/kc/common/primitives";
import { AudioManager } from "@/game/AudioManager";
import { Eyebrow } from "@/components/kc/common/Meters";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/game/SaveManager";
import { INGREDIENTS, type IngredientId } from "@/game/definitions";
import { getSupplyItem } from "@/game/business/businessSupplies";
import { formatUsd } from "@/game/money";
import { restaurantDayOf } from "@/game/restaurant/restaurantDay";
import {
  DELIVERIES_FROM,
  FRESH_DAYS,
  WEEK_DAYS,
  deliveredToday,
  deliveriesOf,
  nextDeliveryDay,
  tonightsOrder,
  type DeliveryKind,
  type DeliveryRecord,
} from "@/game/restaurant/deliveries";

const KIND_META: Record<DeliveryKind, { icon: string; title: string; line: string }> = {
  fresh: {
    icon: "🥬",
    title: "Fresh delivery",
    line: `Meat, fish, dairy, bread, fruit and veg for the next ${FRESH_DAYS} days — every 2 days.`,
  },
  weekly: {
    icon: "📦",
    title: "Weekly delivery",
    line: `Slow goods for ${WEEK_DAYS} days, plus a week of cleaning supplies — every Monday.`,
  },
};

const nameOf = (id: string) =>
  INGREDIENTS[id as IngredientId]?.name ?? getSupplyItem(id)?.name.split(" ·")[0] ?? id;

/**
 * Restaurant → Suppliers: the standing orders (deliveries.ts). Switch each on
 * or off; the order is worked out at closing from what the coming days need
 * (usable stock, fridge room) and arrives with the morning, at the Market's
 * price. The Market stays for instant buys. Read-only apart from the switch.
 */
export function StandingOrdersCard({
  save,
  level,
  onToggle,
}: {
  save: SaveData;
  level: number;
  onToggle: (kind: DeliveryKind, on: boolean) => void;
}) {
  const st = deliveriesOf(save);
  const today = restaurantDayOf(save).day;
  if (level < DELIVERIES_FROM)
    return (
      <Panel className="p-4" data-testid="standing-orders">
        <Eyebrow>🚚 Standing orders</Eyebrow>
        <p className="mt-1 font-ui text-[13.5px] text-walnut/70">
          Deliveries start at Level {DELIVERIES_FROM}.
        </p>
      </Panel>
    );
  const last = st.history.at(-1) ?? null;
  return (
    <Panel className="p-4" data-testid="standing-orders">
      <Eyebrow>🚚 Standing orders</Eyebrow>
      <p className="mt-1 font-ui text-[13px] text-walnut/70">
        Ordered at closing, delivered with the morning at the Market's price — only what the next
        days need.
      </p>
      <div className="mt-2 space-y-2">
        {(["fresh", "weekly"] as const).map((k) => {
          const meta = KIND_META[k];
          const next = nextDeliveryDay(k, today + 1);
          return (
            <div
              key={k}
              data-standing-order={k}
              data-on={st[k] ? "true" : "false"}
              className="flex items-center gap-2 rounded-2xl border border-walnut/12 bg-ivory/70 p-2"
            >
              <span className="text-[24px]" aria-hidden>
                {meta.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-ui text-[14px] font-extrabold text-walnut-dark">{meta.title}</p>
                <p className="font-ui text-[12px] leading-snug text-walnut/65">{meta.line}</p>
                <p className="font-ui text-[12px] font-bold text-walnut/70">
                  {st[k] ? `Next: Day ${next}` : "Off"}
                </p>
              </div>
              <KButton
                size="sm"
                variant={st[k] ? "sage" : "cream"}
                className="min-h-12 shrink-0"
                onClick={() => onToggle(k, !st[k])}
              >
                {st[k] ? "On ✓" : "Turn on"}
              </KButton>
            </div>
          );
        })}
      </div>
      {last ? (
        <p className="mt-2 font-ui text-[12.5px] text-walnut/70" data-testid="last-delivery">
          Last: Day {last.day} · {KIND_META[last.kind].title} · {last.lines.length} lines ·{" "}
          {formatUsd(last.cost)}
          {last.skipped.length ? ` · ${last.skipped.length} skipped` : ""}
        </p>
      ) : null}
    </Panel>
  );
}

/** The opening card's "Delivered this morning" (read-only). */
export function MorningDeliveries({ save }: { save: SaveData }) {
  const today = deliveredToday(save);
  const arrived = today.length > 0;
  // The delivery van's knock when the morning's order is on the card (W3).
  useEffect(() => {
    if (arrived) AudioManager.playSfx("delivery");
  }, [arrived]);
  if (today.length === 0) return null;
  return (
    <div
      className="mt-3 rounded-2xl border border-sage/40 bg-sage/10 p-2"
      data-testid="morning-deliveries"
    >
      {today.map((d: DeliveryRecord) => (
        <div key={d.id} className="font-ui text-[13px] text-walnut-dark">
          <p className="font-extrabold">
            🚚 {KIND_META[d.kind].title} arrived · {formatUsd(d.cost)}
          </p>
          <p className="text-[12.5px] text-walnut/70">
            {d.lines.map((l) => nameOf(l.id)).join(", ") || "Nothing needed"}
          </p>
          {d.skipped.length ? (
            <p className={cn("text-[12.5px] font-bold text-tomato")}>
              Not delivered (no cash or fridge room): {d.skipped.map(nameOf).join(", ")}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Closing Time: what tonight's standing orders will bring with the morning (read-only). */
export function TonightsOrder({ save, level }: { save: SaveData; level: number }) {
  const orders = tonightsOrder(save, level);
  if (orders.length === 0) return null;
  return (
    <div
      className="mt-3 rounded-2xl border border-walnut/15 bg-ivory/70 p-2"
      data-testid="tonights-order"
    >
      <p className="font-ui text-[12.5px] font-extrabold uppercase tracking-wide text-walnut/70">
        🚚 Tonight's order · arrives in the morning
      </p>
      {orders.map((o) => (
        <p key={o.kind} className="mt-1 font-ui text-[12.5px] text-walnut-dark">
          <span className="font-extrabold">{KIND_META[o.kind].title}:</span>{" "}
          {o.lines.map((l, i) => (
            <span key={l.id} data-order-line={l.id}>
              {i > 0 ? ", " : ""}
              {nameOf(l.id)}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
