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
  walkFrames,
  walkMs,
  type FloorPoint,
} from "@/game/restaurant/serviceFloor";
import type { QualityLabel } from "@/types/game";
import { GuestPoses } from "../restaurantMap/GuestPoses";
import { KButton } from "../common/primitives";
import "./serviceFloor.css";

/**
 * The dining room around a service order (Transformation Phase B): the
 * customer walks in and sits, their real order shows in a bubble, and the
 * plate reaches their table after Serve. The previous customer, if one just
 * left, walks out from the other table at the same time. Presentation only —
 * it never serves, pays or advances anything: `onDone` hands control back to
 * Preparation, which runs the existing service actions.
 *
 *  - arrive:  walk in → sit → order bubble → "Start cooking" (or a tap anywhere);
 *  - deliver: the plate goes from the pass to the table, then the face that
 *             follows the dish's real grade; ends by itself.
 *
 * Any tap skips ahead, once. Reduced Motion: no walking, the end state at once.
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

export function ServiceFloor({
  mode,
  stage,
  mapUrl,
  seatIndex,
  customer,
  line,
  dish,
  quality,
  departing,
  reducedMotion,
  onDone,
}: {
  mode: FloorMode;
  stage: KitchenMapArtStage;
  mapUrl: string;
  seatIndex: 0 | 1;
  customer: { id: string; name: string; avatarEmoji: string };
  /** The customer's own line for this order. */
  line: string;
  dish: { emoji: string; name: string };
  /** The dish's real grade (deliver). */
  quality?: QualityLabel;
  /** The customer who just left (arrive only): they walk out from their seat. */
  departing?: { customerId: string; seatIndex: 0 | 1; face: string } | null;
  reducedMotion: boolean;
  onDone: () => void;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const seat = FLOOR_SEATS[stage][seatIndex];
  const walking = mode === "arrive" && !reducedMotion;
  const ms = walking ? walkMs(seat.path) : 0;
  const [state, setState] = useState<"walking" | "seated" | "serving" | "reacting">(
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
  const leaver =
    mode === "arrive" && departing && departing.seatIndex !== seatIndex && !reducedMotion
      ? { ...departing, seat: FLOOR_SEATS[stage][departing.seatIndex] }
      : null;
  const leavePath = leaver ? [...leaver.seat.path].reverse() : [];
  // The new customer waits outside until the one leaving is through the door.
  const waitMs = leaver ? walkMs(leavePath) : 0;

  useEffect(() => {
    const timers: number[] = [];
    const later = (fn: () => void, t: number) => timers.push(window.setTimeout(fn, t));
    if (walking) later(() => setState("seated"), waitMs + ms + SIT_MS);
    if (mode === "deliver") {
      if (reducedMotion) later(() => finishRef.current(), 700);
      else {
        later(() => setState("reacting"), DELIVER_MS);
        later(() => finishRef.current(), DELIVER_MS + REACT_MS);
      }
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // One run per mount: the mode, seat and walk are fixed for this view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const look = lookFor(customer.id);
  const passAt = inView(FLOOR_PASS);
  const tableAt = inView(seat.table);
  const keyframes =
    walkKeyframes(`sfwalk${uid}`, seat.path) +
    (leaver ? walkKeyframes(`sfleave${uid}`, leavePath) : "") +
    `@keyframes sfplate${uid}{0%{transform:translate(${pct(passAt.x)},${pct(passAt.y)}) scale(.6);opacity:0}15%{opacity:1}100%{transform:translate(${pct(tableAt.x)},${pct(tableAt.y)}) scale(1);opacity:1}}` +
    `@keyframes sfgone${uid}{0%,85%{opacity:1}100%{opacity:0}}`;
  const sitting = state !== "walking";
  const face = quality ? REACTION_FACE[quality] : "🙂";

  return (
    <div
      className="sf absolute inset-0 z-[65] flex flex-col bg-walnut-dark"
      data-testid="service-floor"
      data-mode={mode}
      data-state={state}
      data-seat={seatIndex}
      role="dialog"
      aria-label={
        mode === "arrive"
          ? `${customer.name} orders ${dish.name}`
          : `Serving ${dish.name} to ${customer.name}`
      }
      onClick={finish}
    >
      <style>{keyframes}</style>
      <div className="sf-stage relative min-h-0 flex-1">
        <div className="sf-view" aria-hidden="true">
          <img className="sf-map" src={mapUrl} alt="" draggable={false} />
          <div className="sf-dim" />
          {mode === "deliver" ? (
            <div
              className="sf-layer"
              style={
                state === "reacting"
                  ? at(seat.table)
                  : { animation: `sfplate${uid} ${DELIVER_MS}ms ease-out both` }
              }
            >
              <span className="sf-plate">{dish.emoji}</span>
            </div>
          ) : null}
          {leaver ? (
            <div
              className="sf-layer"
              data-testid="service-floor-leaving"
              style={{
                animation: `sfleave${uid} ${walkMs(leavePath)}ms linear both, sfgone${uid} ${walkMs(leavePath)}ms linear both`,
              }}
            >
              <div className="sf-person sf-pose-walk">
                <GuestPoses {...lookFor(leaver.customerId)} />
              </div>
              <div className="sf-face sf-face--small">{leaver.face}</div>
            </div>
          ) : null}
          <div
            className="sf-layer"
            style={
              state === "walking"
                ? { animation: `sfwalk${uid} ${ms}ms linear ${waitMs}ms both` }
                : at(seat.seat)
            }
          >
            <div className={`sf-person ${sitting ? "sf-pose-sit" : "sf-pose-walk"}`}>
              <GuestPoses outfit={look.outfit} hair={look.hair} />
            </div>
            {/* The outer box places the bubble / face; the inner one pops (anim-pop's
                own transform would otherwise replace the placement). */}
            {state === "seated" ? (
              <div className="sf-bubble" data-testid="service-floor-order">
                <div className="sf-bubble-body anim-pop">
                  <span className="text-[26px] leading-none">{dish.emoji}</span>
                  <span className="sf-bubble-name">{dish.name}</span>
                </div>
              </div>
            ) : null}
            {state === "reacting" ? (
              <div className="sf-face" data-testid="service-floor-face">
                <div className="anim-pop">{face}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {mode === "arrive" ? (
        <div className="relative z-10 rounded-t-[22px] border-t border-gold/40 bg-[linear-gradient(170deg,var(--color-ivory),var(--color-cream))] px-4 pb-4 pt-3 text-center shadow-lift">
          <p className="font-ui text-[11px] font-extrabold uppercase tracking-[0.2em] text-copper">
            {state === "walking"
              ? "🚪 A customer"
              : `${customer.avatarEmoji} ${customer.name}'s order`}
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
      ) : (
        <p className="relative z-10 pb-6 pt-2 text-center font-hand text-[17px] text-ivory/90">
          {state === "reacting" ? `${customer.name} digs in` : `Bringing it to ${customer.name}…`}
        </p>
      )}
    </div>
  );
}
