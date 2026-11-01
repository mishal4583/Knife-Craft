import { useEffect, useId, useRef, useState } from "react";
import type { KitchenMapArtStage } from "@/game/kitchen/kitchenMapArt";
import {
  FLOOR_SEATS,
  REACTION_FACE,
  REACT_MS,
  SIT_MS,
  TAKEAWAY_SPOT,
  TAKEAWAY_STAND,
  WAITER_LOOKS,
  inView,
  lookFor,
  partySpots,
  partyCompleteWith,
  pathToSpot,
  serveMs,
  takeawayPath,
  waiterPath,
  waiterStand,
  walkFrames,
  walkMs,
  type FloorPoint,
  type PartySeat,
  type WaiterKind,
} from "@/game/restaurant/serviceFloor";
import { formatUsd } from "@/game/money";
import type { QualityLabel } from "@/types/game";
import { GuestPoses } from "../restaurantMap/GuestPoses";
import { KButton } from "../common/primitives";
import type { DiningHireId, DiningOffer } from "@/game/restaurant/diningHire";
import { TableCash } from "../common/TableCash";
import { AUTO_SERVE_MS } from "@/game/restaurant/prepCookAuto";
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
 *  - deliver: a waiter carries the plate from the pass to the table (Phase 9B: the Server when one is
 *             hired, else the cook), sets it down and walks back; then the face that follows the dish's
 *             real grade, then the customer walks out and the served card opens by itself (developer
 *             2026-10-30: no cash screen — the cash waits on the table, collected from the served card
 *             in one tap).
 *  - takeaway (Phase 9C): the customer never sits: they wait just inside the door, the waiter hands over
 *             a bag, and they walk out with it.
 *
 * Taps can advance the arrival and serving beats. Reduced Motion skips the walking.
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
/** How long the served customer takes to walk out before the served card opens. */
const LEAVE_MS = 1300;

export function ServiceFloor({
  mode,
  stage,
  mapUrl,
  seat: partySeat,
  customer,
  line,
  dish,
  quality,
  reducedMotion,
  onDone,
  prepCook,
  tableCash,
  takeaway = false,
  waiter = "cook",
  hire,
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
  reducedMotion: boolean;
  onDone: () => void;
  /** A hired Prep Cook (prepCookAuto.ts), offered on the arrival card: cut this order, or switch Auto. */
  prepCook?: { auto: boolean; onCut: () => void; onAuto: () => void };
  /** The cash lying on the tables (economy/pendingCash.ts): shown as piles; one tap collects it. */
  tableCash?: { cents: number; onCollect: () => void };
  /** A customer who takes a parcel (orderServiceFor): no table, a bag at the door. */
  takeaway?: boolean;
  /** Who carries the plate: a hired Server, otherwise the cook. */
  waiter?: WaiterKind;
  /** Phase 9E: who can be hired from the side of the dining area now; an offer is gone once the person is hired. */
  hire?: { offers: DiningOffer[]; onHire: (id: DiningHireId) => void };
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { party, slot, arriving, leaving } = partySeat;
  const table = FLOOR_SEATS[stage][party.table];
  const spots = takeaway ? [TAKEAWAY_SPOT] : partySpots(table, party.size);
  const paths = takeaway ? [takeawayPath()] : spots.map((s) => pathToSpot(table, s));
  const walking = mode === "arrive" && arriving && !reducedMotion;
  const leavers =
    mode === "arrive" && arriving && leaving && !takeaway && !reducedMotion
      ? partySpots(FLOOR_SEATS[stage][leaving.table], leaving.size).map((s, i) => ({
          look: leaving.looks[i]!,
          face: leaving.served[i]?.face ?? "🙂",
          path: [...pathToSpot(FLOOR_SEATS[stage][leaving.table], s)].reverse(),
        }))
      : [];
  // The new party waits outside until the one leaving is through the door.
  const waitMs = leavers.length ? Math.max(...leavers.map((l) => walkMs(l.path))) : 0;
  const lastIn = walking ? Math.max(...paths.map((p, i) => walkMs(p) + i * FILE_GAP_MS)) : 0;
  // Served together: every plate held back for the table arrives with this one, they all eat, and
  // when the party is complete they all walk out together.
  const deliverers = spots.map((_, i) => i === slot || !!party.held[i]);
  const partyLeaves = mode === "deliver" && partyCompleteWith(partySeat);
  // The waiter's walk from the pass: beside the table (or the customer at the door), and how long the beat takes.
  const stand = takeaway ? TAKEAWAY_STAND : waiterStand(table);
  const wPath = waiterPath(stand);
  const wWalkMs = walkMs(wPath);
  const deliverMs = serveMs(stand);
  const [state, setState] = useState<"walking" | "seated" | "serving" | "reacting" | "leaving">(
    mode === "arrive" ? (walking ? "walking" : "seated") : reducedMotion ? "reacting" : "serving",
  );
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
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
      // The plate arrives, the customer reacts, walks out, and the served card opens.
      if (reducedMotion) {
        later(() => finishRef.current(), REACT_MS);
      } else {
        later(() => setState("reacting"), deliverMs);
        if (partyLeaves) {
          later(() => setState("leaving"), deliverMs + REACT_MS);
          later(
            () => finishRef.current(),
            deliverMs + REACT_MS + LEAVE_MS + FILE_GAP_MS * spots.length,
          );
        } else later(() => finishRef.current(), deliverMs + REACT_MS);
      }
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // One run per mount: the mode, seat and walk are fixed for this view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto: once the customer has sat, the Prep Cook takes the order by itself.
  useEffect(() => {
    if (!prepCook?.auto || state !== "seated" || mode !== "arrive") return;
    const t = window.setTimeout(prepCook.onCut, AUTO_SERVE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCut only reads the order's own state
  }, [prepCook?.auto, state, mode]);

  /** A tap anywhere: skip ahead. */
  const tapAnywhere = () => {
    finish();
  };

  const keyframes =
    paths.map((p, i) => walkKeyframes(`sfwalk${uid}_${i}`, p)).join("") +
    leavers.map((l, i) => walkKeyframes(`sfleave${uid}_${i}`, l.path)).join("") +
    paths.map((p, i) => walkKeyframes(`sfexit${uid}_${i}`, [...p].reverse())).join("") +
    walkKeyframes(`sfwout${uid}`, wPath) +
    walkKeyframes(`sfwback${uid}`, [...wPath].reverse()) +
    `@keyframes sfgone${uid}{0%,85%{opacity:1}100%{opacity:0}}`;
  const sitting = state !== "walking";
  const face = quality ? REACTION_FACE[quality] : "🙂";
  const others = party.size - 1;

  return (
    <div
      className="sf absolute inset-0 z-[65] flex flex-col bg-walnut-dark"
      data-testid="service-floor"
      data-mode={mode}
      data-state={state}
      data-seat={party.table}
      data-service={takeaway ? "takeaway" : "dine-in"}
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
        {mode === "arrive" && hire && hire.offers.length > 0 ? (
          <div
            className="absolute right-2 top-2 z-20 flex flex-col gap-1.5"
            data-testid="dining-hire"
            onClick={(e) => e.stopPropagation()}
          >
            {hire.offers.map((o) => (
              <button
                key={o.id}
                type="button"
                data-hire={o.id}
                disabled={!o.affordable}
                aria-label={`Hire ${o.label} for ${formatUsd(o.price)}${o.per === "hour" ? " an hour" : ""}`}
                className="flex min-h-12 min-w-[3.25rem] flex-col items-center justify-center rounded-2xl border border-gold/50 bg-walnut-dark/85 px-2 py-1 font-ui text-ivory shadow-soft active:scale-95 disabled:opacity-50"
                onClick={() => hire.onHire(o.id)}
              >
                <span className="text-[20px] leading-none">{o.icon}</span>
                <span className="text-[10.5px] font-extrabold leading-tight">
                  {formatUsd(o.price)}
                  {o.per === "hour" ? "/h" : ""}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="sf-view" aria-hidden="true">
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
          {/* The waiter carries the plate (a tray of plates for a party) from the pass, sets it down, walks back. */}
          {mode === "deliver" && !reducedMotion ? (
            <div
              className="sf-layer"
              data-testid="service-floor-waiter"
              data-waiter={waiter}
              style={
                state === "serving"
                  ? { animation: `sfwout${uid} ${wWalkMs}ms linear both` }
                  : {
                      animation: `sfwback${uid} ${wWalkMs}ms linear both, sfgone${uid} ${wWalkMs}ms linear both`,
                    }
              }
            >
              <div className="sf-person sf-pose-walk">
                <GuestPoses {...WAITER_LOOKS[waiter]} />
              </div>
              {state === "serving" ? (
                <div className="sf-carry">
                  {spots.map((_, i) =>
                    deliverers[i] ? (
                      <span key={i}>{i === slot ? dish.emoji : party.held[i]!.emoji}</span>
                    ) : null,
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
          {/* Once it is set down: the plate on the table, or the bag in the takeaway customer's hand. */}
          {mode === "deliver" && (state !== "serving" || reducedMotion)
            ? spots.map((s, i) =>
                deliverers[i] ? (
                  <div
                    key={`serve${i}`}
                    className="sf-layer"
                    style={at({ x: s.x + (takeaway ? 2.5 : 0), y: s.y - (takeaway ? 4.5 : 3.5) })}
                  >
                    <span className="sf-plate">
                      {takeaway ? "🛍️" : i === slot ? dish.emoji : party.held[i]!.emoji}
                    </span>
                  </div>
                ) : null,
              )
            : null}
          {tableCash && tableCash.cents > 0 ? (
            <TableCash
              stage={stage}
              cents={tableCash.cents}
              onCollect={tableCash.onCollect}
              place={inView}
              first={party.table === 0 ? 1 : 0}
            />
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
                    : state === "leaving" && partyLeaves
                      ? {
                          animation: `sfexit${uid}_${i} ${LEAVE_MS}ms linear ${i * FILE_GAP_MS}ms both, sfgone${uid} ${LEAVE_MS}ms linear ${i * FILE_GAP_MS}ms both`,
                        }
                      : at(s)
                }
              >
                <div
                  className={`sf-person ${
                    state === "leaving" && partyLeaves
                      ? "sf-pose-walk"
                      : sitting
                        ? takeaway
                          ? "sf-pose-stand"
                          : "sf-pose-sit"
                        : "sf-pose-walk"
                  }`}
                >
                  <GuestPoses outfit={look.outfit} hair={look.hair} />
                </div>
                {/* The outer box places the bubble / face; the inner one pops (anim-pop's
                    own transform would otherwise replace the placement). */}
                {isMe && state === "seated" ? (
                  <div className="sf-bubble" data-testid="service-floor-order">
                    <div className="sf-bubble-body anim-pop">
                      <span className="text-[26px] leading-none">{dish.emoji}</span>
                      <span className="sf-bubble-name">
                        {takeaway ? "🥡 " : ""}
                        {dish.name}
                      </span>
                    </div>
                  </div>
                ) : null}
                {deliverers[i] && (state === "reacting" || state === "leaving") ? (
                  <div
                    className="sf-face"
                    {...(isMe ? { "data-testid": "service-floor-face" } : {})}
                  >
                    <div className="anim-pop">{isMe ? face : party.held[i]!.face}</div>
                  </div>
                ) : null}
                {!isMe && !deliverers[i] && sitting && served ? (
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
        </div>
      </div>
      {mode === "arrive" ? (
        <div className="relative z-10 rounded-t-[22px] border-t border-gold/40 bg-[linear-gradient(170deg,var(--color-ivory),var(--color-cream))] px-4 pb-4 pt-3 text-center shadow-lift">
          <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.2em] text-copper">
            {state === "walking"
              ? takeaway
                ? "🚪 A takeaway customer"
                : party.size > 1
                  ? `🚪 A party of ${party.size}`
                  : "🚪 A customer"
              : takeaway
                ? `${customer.avatarEmoji} ${customer.name} · 🥡 To go`
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
            {prepCook && sitting ? (
              <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                <KButton full variant="sage" onClick={prepCook.onCut}>
                  👨‍🍳 Prep Cook cuts it
                </KButton>
                <KButton full variant={prepCook.auto ? "green" : "cream"} onClick={prepCook.onAuto}>
                  {prepCook.auto ? "Auto: on" : "Auto: off"}
                </KButton>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="relative z-10 pb-6 pt-2 text-center font-hand text-[17px] text-ivory/90">
          {state === "reacting"
            ? takeaway
              ? `${customer.name} takes the bag`
              : `${partyCompleteWith(partySeat) && party.size > 1 ? "The table" : customer.name} digs in`
            : state === "leaving"
              ? `${party.size > 1 && !takeaway ? "The table" : customer.name} heads out`
              : takeaway
                ? `Handing ${customer.name} the bag…`
                : `Bringing it to ${party.size > 1 ? "the table" : customer.name}…`}
        </p>
      )}
    </div>
  );
}
