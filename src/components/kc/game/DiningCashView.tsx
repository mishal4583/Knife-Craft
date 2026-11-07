import type { CSSProperties } from "react";
import type { KitchenMapArtStage } from "@/game/kitchen/kitchenMapArt";
import {
  FLOOR_SEATS,
  cashierSpot,
  inView,
  lookFor,
  partySpots,
  takeawaySpot,
  type FloorPoint,
  type PartySeat,
} from "@/game/restaurant/serviceFloor";
import { GuestPoses } from "../restaurantMap/GuestPoses";
import { TableCash } from "../common/TableCash";
import { cashSpotBeside } from "@/game/restaurant/tableCash";
import "./serviceFloor.css";

const pct = (n: number) => `${Math.round(n * 100) / 100}%`;
const at = (p: FloorPoint): CSSProperties => {
  const v = inView(p);
  return { transform: `translate(${pct(v.x)},${pct(v.y)})` };
};
const pin = (p: FloorPoint): CSSProperties => {
  const v = inView(p);
  return { left: pct(v.x), top: pct(v.y) };
};

/**
 * The dining room behind the Served card (developer 2026-11-01: "the cash showed on the table but can't be
 * collected like in the idle games, and suddenly the Collect cash button shows up"; and "nothing came up to clean
 * the table after each customer, no tissue refill"). The room the customer just left stays on screen above the
 * card: the cash lies on the tables and one tap on a pile collects it (the same as the Collect cash button), the
 * table the party left shows its dirty plates — tap it to wipe — and the napkin holders show when they run low —
 * tap to refill. A Cashier stands at the counter. The party still waiting for its other plates stays seated.
 * Presentation only.
 */
export function DiningCashView({
  stage,
  mapUrl,
  seat,
  cents,
  onCollect,
  takeaway = false,
  cashier = false,
  dirty = false,
  onWipe,
  napkinsLow = false,
  onRefill,
}: {
  stage: KitchenMapArtStage;
  mapUrl: string;
  /** This order's place at its party's table (null: nobody is shown). */
  seat: PartySeat | null;
  /** The cash lying on the tables now. */
  cents: number;
  onCollect: () => void;
  /** A takeaway customer stands at the counter instead of sitting at a table. */
  takeaway?: boolean;
  /** A Cashier is on the team: they stand at the service counter. */
  cashier?: boolean;
  /** The party's table is dirty (not wiped yet): tap it to wipe. */
  dirty?: boolean;
  onWipe?: (() => void) | undefined;
  /** The napkin holders are low: tap to refill. */
  napkinsLow?: boolean;
  onRefill?: (() => void) | undefined;
}) {
  const party = seat?.party ?? null;
  const table = FLOOR_SEATS[stage][party?.table ?? 0];
  const spots =
    party && !party.left ? (takeaway ? [takeawaySpot(stage)] : partySpots(table, party.size)) : [];
  const care = (dirty && onWipe) || (napkinsLow && onRefill);
  return (
    <div className="sf relative h-full w-full bg-walnut-dark" data-testid="dining-cash-view">
      <div className="sf-stage relative h-full min-h-0">
        <div className="sf-view touch-none" aria-hidden="true">
          <img className="sf-map" src={mapUrl} alt="" draggable={false} />
          <div className="sf-dim" />
          {cashier ? (
            <div className="sf-layer" style={at(cashierSpot(stage))}>
              <div className="sf-person sf-pose-stand">
                <GuestPoses outfit="#3f5f8a" hair="#35271f" look="cashier" />
              </div>
            </div>
          ) : null}
          {party
            ? spots.map((s, i) => (
                <div key={`m${i}`} className="sf-layer" style={at(s)}>
                  <div className={`sf-person ${takeaway ? "sf-pose-stand" : "sf-pose-sit"}`}>
                    <GuestPoses {...lookFor(party.looks[i]!)} />
                  </div>
                </div>
              ))
            : null}
          {cents > 0 ? (
            <TableCash
              {...(party
                ? { at: cashSpotBeside(stage, party.table, party.size, takeaway) }
                : { stage })}
              cents={cents}
              onCollect={onCollect}
              place={inView}
              swipe
            />
          ) : null}
          {dirty && onWipe && party && !takeaway ? (
            <button
              type="button"
              data-testid="dirty-table"
              aria-label="Wipe the dirty table"
              className="press absolute z-[16] grid min-h-12 min-w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-copper/95 text-[22px] leading-none shadow-lift ring-2 ring-ivory/80"
              style={pin({ x: table.table.x, y: table.table.y - 1 })}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onWipe();
              }}
            >
              🍽️
              <span className="absolute -bottom-1 -right-1 text-[16px]">🧽</span>
            </button>
          ) : null}
          {napkinsLow && onRefill && party && !takeaway ? (
            <button
              type="button"
              data-testid="napkins-low"
              aria-label="Refill the napkin holders"
              className="press absolute z-[16] grid min-h-12 min-w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-tomato/90 text-[22px] leading-none shadow-lift ring-2 ring-ivory/80"
              style={pin({ x: table.table.x + 6, y: table.table.y - 1 })}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRefill();
              }}
            >
              🧻
            </button>
          ) : null}
        </div>
        <p
          className="pointer-events-none absolute inset-x-0 bottom-1 z-[15] text-center font-hand text-[16px] text-ivory/95 [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]"
          data-testid="dining-cash-hint"
        >
          {cents > 0
            ? "👆 Tap or swipe the cash to collect it"
            : care
              ? dirty
                ? "👆 Tap the dirty table to wipe it"
                : "👆 Tap the napkins to refill them"
              : "✓ Cash collected"}
        </p>
      </div>
    </div>
  );
}
