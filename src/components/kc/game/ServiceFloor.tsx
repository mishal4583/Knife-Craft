import { useEffect, useId, useRef, useState } from "react";
import type { KitchenMapArtStage } from "@/game/kitchen/kitchenMapArt";
import {
  DELIVER_MS,
  FLOOR_PASS,
  FLOOR_SEATS,
  REACTION_FACE,
  REACT_MS,
  SIT_MS,
  inView,
  lookFor,
  partySpots,
  pathToSpot,
  walkFrames,
  walkMs,
  type FloorPoint,
  type PartySeat,
} from "@/game/restaurant/serviceFloor";
import { formatUsd } from "@/game/money";
import type { QualityLabel } from "@/types/game";
import { GuestPoses } from "../restaurantMap/GuestPoses";
import { KButton } from "../common/primitives";
import { CashVacuum } from "./CashVacuum";
import { useRolledNumber } from "./useRolledNumber";
import "./serviceFloor.css";

/**
 * The dining room around a service order (Transformation Phase B): the
 * customers walk in and sit, their real orders show in bubbles, and the plate
 * reaches the table after Serve. Presentation only — it never serves, pays or
 * advances anything: `onDone` hands control back to Preparation, which runs
 * the existing service actions.
 *
 * Parties (developer 2026-10-26): the service's customers come as a party of
 * 1–4 at one table (serviceFloor.ts `seatInParty`); each shows what they
 * ordered, the next member's order is already seated, and the whole party
 * leaves when the next one walks in.
 *
 *  - arrive:  walk in → sit → order bubbles → "Start cooking" (or a tap anywhere);
 *  - deliver: the plate goes from the pass to the member, then the face that
 *             follows the dish's real grade; then the pay and tip lie on the
 *             table as cash to swipe into the wallet.
 *
 * Taps can advance the arrival and serving beats; cash itself always needs a swipe.
 * Reduced Motion skips the walking animation, never the cash collection.
 */
export type FloorMode = "arrive" | "deliver";

const pct = (n: number) => `${Math.round(n * 100) / 100}%`;
const at = (p: FloorPoint) => {
  const v = inView(p);
  return { transform: `translate(${pct(v.x)},${pct(v.y)})` };
};
const walkKeyframes = (name: string, path: readonly FloorPoint[]) =>
  `@keyframes ${name}{${walkFrames(path)
    .map((f) => `${f.at}%{transform:translate(${pct(f.x)},${pct(f.y)})}`)
    .join("")}}`;
/** The gap between members walking in (a party walks in a short file). */
const FILE_GAP_MS = 380;

export function ServiceFloor({
  mode,
  stage,
  mapUrl,
  seat: partySeat,
  customer,
  line,
  dish,
  quality,
  cash,
  reducedMotion,
  onCashPieceCollected,
  onCashRemaining,
  onCashCollected,
  onBackToOrder,
  onDone,
}: {
  mode: FloorMode;
  stage: KitchenMapArtStage;
  mapUrl: string;
  /** This order's place in its party (serviceFloor.ts `seatInParty`). */
  seat: PartySeat;
  customer: { id: string; name: string; avatarEmoji: string };
  /** The customer's own line for this order. */
  line: string;
  dish: { emoji: string; name: string };
  /** The dish's real grade (deliver). */
  quality?: QualityLabel;
  /** Deliver: what the serve earned — left on the table as cash to collect. */
  cash?: { payCents: number; tipCents: number; credits: number };
  reducedMotion: boolean;
  onCashPieceCollected?: (cents: number, isTip: boolean) => void;
  onCashRemaining?: (cents: number) => void;
  onCashCollected?: () => void;
  /** Returns to the served-order card without discarding uncollected table cash. */
  onBackToOrder?: () => void;
  onDone: () => void;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { party, slot, arriving, leaving } = partySeat;
  const table = FLOOR_SEATS[stage][party.table];
  const spots = partySpots(table, party.size);
  const paths = spots.map((s) => pathToSpot(table, s));
  const walking = mode === "arrive" && arriving && !reducedMotion;
  const leavers =
    mode === "arrive" && arriving && leaving && !reducedMotion
      ? partySpots(FLOOR_SEATS[stage][leaving.table], leaving.size).map((s, i) => ({
          look: leaving.looks[i]!,
          face: leaving.served[i]?.face ?? "🙂",
          path: [...pathToSpot(FLOOR_SEATS[stage][leaving.table], s)].reverse(),
        }))
      : [];
  // The new party waits outside until the one leaving is through the door.
  const waitMs = leavers.length ? Math.max(...leavers.map((l) => walkMs(l.path))) : 0;
  const lastIn = walking ? Math.max(...paths.map((p, i) => walkMs(p) + i * FILE_GAP_MS)) : 0;
  const total = cash ? cash.payCents + cash.tipCents : 0;
  const [state, setState] = useState<"walking" | "seated" | "serving" | "reacting" | "cash">(
    mode === "arrive"
      ? walking
        ? "walking"
        : "seated"
      : reducedMotion
        ? total > 0
          ? "cash"
          : "reacting"
        : "serving",
  );
  const [remaining, setRemaining] = useState(total);
  const walletRef = useRef<HTMLSpanElement | null>(null);
  const shownCredits = useRolledNumber(cash?.credits ?? 0, reducedMotion);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    // Cash on the table is never abandoned: a tap during the plate / reaction
    // beats moves on to the cash, and the view closes only once it is all swept in.
    if (mode === "deliver" && total > 0 && remaining > 0) {
      if (state !== "cash") setState("cash");
      return;
    }
    if (state === "cash" && remaining > 0) return;
    done.current = true;
    onDone();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    const timers: number[] = [];
    const later = (fn: () => void, t: number) => timers.push(window.setTimeout(fn, t));
    if (walking) later(() => setState("seated"), waitMs + lastIn + SIT_MS);
    if (mode === "deliver") {
      if (reducedMotion) {
        if (total <= 0) later(() => finishRef.current(), 700);
      } else {
        later(() => setState("reacting"), DELIVER_MS);
        later(() => (total > 0 ? setState("cash") : finishRef.current()), DELIVER_MS + REACT_MS);
      }
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // One run per mount: the mode, seat and walk are fixed for this view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A tap anywhere: skip ahead — with cash on the table, sweep it all in first. */
  const tapAnywhere = () => {
    if (state === "cash") {
      if (remaining <= 0) finish();
      return;
    }
    if (mode === "deliver" && total > 0 && state !== "reacting") {
      setState("cash");
      return;
    }
    finish();
  };

  const passAt = inView(FLOOR_PASS);
  const mine = spots[slot]!;
  const plateAt = { x: mine.x, y: mine.y - 3.5 };
  const tableAt = inView(plateAt);
  const keyframes =
    paths.map((p, i) => walkKeyframes(`sfwalk${uid}_${i}`, p)).join("") +
    leavers.map((l, i) => walkKeyframes(`sfleave${uid}_${i}`, l.path)).join("") +
    `@keyframes sfplate${uid}{0%{transform:translate(${pct(passAt.x)},${pct(passAt.y)}) scale(.6);opacity:0}15%{opacity:1}100%{transform:translate(${pct(tableAt.x)},${pct(tableAt.y)}) scale(1);opacity:1}}` +
    `@keyframes sfgone${uid}{0%,85%{opacity:1}100%{opacity:0}}`;
  const sitting = state !== "walking";
  const face = quality ? REACTION_FACE[quality] : "🙂";
  const others = party.size - 1;
  // The cash piles up beside the chairs, one pile by each member's place (developer 2026-10-26:
  // "on the side of the table and chairs … spread across their seats"); a lone customer's to
  // the left of the table. Kept inside the view.
  const cashPiles = spots.map((s) => {
    const side = party.size > 1 && s.x > table.seat.x ? 1 : -1;
    const v = inView({ x: Math.min(77, Math.max(23, s.x + side * 7.5)), y: s.y - 2.5 });
    return { x: v.x, y: v.y };
  });

  return (
    <div
      className="sf absolute inset-0 z-[65] flex flex-col bg-walnut-dark"
      data-testid="service-floor"
      data-mode={mode}
      data-state={state}
      data-seat={party.table}
      data-party={party.size}
      role="dialog"
      aria-label={
        mode === "arrive"
          ? `${customer.name} orders ${dish.name}`
          : `Serving ${dish.name} to ${customer.name}`
      }
      onClick={tapAnywhere}
    >
      <style>{keyframes}</style>
      <div className="sf-stage relative min-h-0 flex-1">
        <div className="sf-view" aria-hidden={state === "cash" ? undefined : "true"}>
          <img className="sf-map" src={mapUrl} alt="" draggable={false} />
          <div className="sf-dim" />
          {/* Plates of the members already served stay on the table. */}
          {spots.map((s, i) =>
            i !== slot && party.served[i] ? (
              <div key={`plate${i}`} className="sf-layer" style={at({ x: s.x, y: s.y - 3.5 })}>
                <span className="sf-plate sf-plate--small">{party.served[i]!.emoji}</span>
              </div>
            ) : null,
          )}
          {mode === "deliver" ? (
            <div
              className="sf-layer"
              style={
                state === "serving"
                  ? { animation: `sfplate${uid} ${DELIVER_MS}ms ease-out both` }
                  : at(plateAt)
              }
            >
              <span className="sf-plate">{dish.emoji}</span>
            </div>
          ) : null}
          {leavers.map((l, i) => (
            <div
              key={`leave${i}`}
              className="sf-layer"
              {...(i === 0 ? { "data-testid": "service-floor-leaving" } : {})}
              style={{
                animation: `sfleave${uid}_${i} ${walkMs(l.path)}ms linear both, sfgone${uid} ${walkMs(l.path)}ms linear both`,
              }}
            >
              <div className="sf-person sf-pose-walk">
                <GuestPoses {...lookFor(l.look)} />
              </div>
              <div className="sf-face sf-face--small">{l.face}</div>
            </div>
          ))}
          {spots.map((s, i) => {
            const look = lookFor(party.looks[i]!);
            const isMe = i === slot;
            const theirs = party.dishes[i];
            const served = party.served[i];
            return (
              <div
                key={`m${i}`}
                className="sf-layer"
                style={
                  state === "walking"
                    ? {
                        animation: `sfwalk${uid}_${i} ${walkMs(paths[i]!)}ms linear ${waitMs + i * FILE_GAP_MS}ms both`,
                      }
                    : at(s)
                }
              >
                <div className={`sf-person ${sitting ? "sf-pose-sit" : "sf-pose-walk"}`}>
                  <GuestPoses outfit={look.outfit} hair={look.hair} />
                </div>
                {/* The outer box places the bubble / face; the inner one pops (anim-pop's
                    own transform would otherwise replace the placement). */}
                {isMe && state === "seated" ? (
                  <div className="sf-bubble" data-testid="service-floor-order">
                    <div className="sf-bubble-body anim-pop">
                      <span className="text-[26px] leading-none">{dish.emoji}</span>
                      <span className="sf-bubble-name">{dish.name}</span>
                    </div>
                  </div>
                ) : null}
                {isMe && (state === "reacting" || state === "cash") ? (
                  <div className="sf-face" data-testid="service-floor-face">
                    <div className="anim-pop">{face}</div>
                  </div>
                ) : null}
                {!isMe && sitting && served ? (
                  <div className="sf-face sf-face--small">{served.face}</div>
                ) : null}
                {!isMe && sitting && !served && theirs ? (
                  <div className="sf-bubble sf-bubble--small" data-testid="service-floor-waiting">
                    <div className="sf-bubble-body">
                      <span className="text-[16px] leading-none">{theirs.emoji}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {state === "cash" && cash ? (
            <div
              className="sf-cash absolute inset-0"
              data-testid="service-floor-cash"
              onClick={(e) => e.stopPropagation()}
            >
              <CashVacuum
                variant="table"
                anchors={cashPiles}
                payCents={cash.payCents}
                tipCents={cash.tipCents}
                walletRef={walletRef}
                reducedMotion={reducedMotion}
                onPieceCollected={(cents, isTip) => {
                  onCashPieceCollected?.(cents, isTip);
                }}
                onRemaining={(cents) => {
                  setRemaining(cents);
                  onCashRemaining?.(cents);
                }}
                onDone={() => {
                  onCashCollected?.();
                  window.setTimeout(() => finishRef.current(), 450);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
      {mode === "arrive" ? (
        <div className="relative z-10 rounded-t-[22px] border-t border-gold/40 bg-[linear-gradient(170deg,var(--color-ivory),var(--color-cream))] px-4 pb-4 pt-3 text-center shadow-lift">
          <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.2em] text-copper">
            {state === "walking"
              ? party.size > 1
                ? `🚪 A party of ${party.size}`
                : "🚪 A customer"
              : `${customer.avatarEmoji} ${customer.name}'s order${others > 0 ? ` · table of ${party.size}` : ""}`}
          </p>
          <p className="mt-1 font-display text-[20px] font-extrabold leading-tight text-walnut-dark">
            {dish.emoji} {dish.name}
          </p>
          <p className="mt-1 line-clamp-2 font-hand text-[16px] leading-snug text-walnut/80">
            “{line}”
          </p>
          <div className="mt-3">
            <KButton full variant="copper" onClick={finish}>
              🔪 Start cooking
            </KButton>
          </div>
        </div>
      ) : state === "cash" && cash ? (
        <div
          className="relative z-10 flex items-center justify-between gap-2 rounded-t-[22px] border-t border-gold/40 bg-[linear-gradient(170deg,var(--color-ivory),var(--color-cream))] px-4 pb-4 pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-0">
            <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.18em] text-copper">
              💵 Left on the table
            </p>
            <p className="font-ui text-[13px] font-extrabold text-walnut-dark">
              {formatUsd(cash.payCents)}
              {cash.tipCents > 0 ? ` + ${formatUsd(cash.tipCents)} tip` : ""}
            </p>
            <p className="font-hand text-[14px] text-olive">Swipe over the cash to collect it</p>
            <span
              ref={walletRef}
              className="mt-1 inline-block rounded-full bg-walnut/10 px-2 py-0.5 font-ui text-[12px] font-extrabold text-walnut-dark"
              data-testid="floor-wallet"
            >
              💵 {formatUsd(shownCredits)}
            </span>
          </div>
          {remaining <= 0 ? (
            <KButton className="h-12 shrink-0 px-3 text-[13px]" variant="copper" onClick={finish}>
              Continue
            </KButton>
          ) : (
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="rounded-full bg-walnut/10 px-3 py-2 font-ui text-[12px] font-extrabold text-walnut-dark">
                💵 {formatUsd(remaining)} left
              </span>
              {onBackToOrder ? (
                <button
                  type="button"
                  data-testid="cash-later"
                  className="press min-h-12 rounded-full border border-walnut/25 bg-ivory/80 px-4 font-ui text-[12.5px] font-extrabold text-walnut-dark"
                  onClick={onBackToOrder}
                >
                  Collect later
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <p className="relative z-10 pb-6 pt-2 text-center font-hand text-[17px] text-ivory/90">
          {state === "reacting" ? `${customer.name} digs in` : `Bringing it to ${customer.name}…`}
        </p>
      )}
    </div>
  );
}
