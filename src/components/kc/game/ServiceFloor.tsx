import { useEffect, useId, useRef, useState } from "react";
import type { KitchenMapArtStage } from "@/game/kitchen/kitchenMapArt";
import {
  REACTION_FACE,
  REACT_MS,
  SIT_MS,
  BAG_MS,
  WAITER_LOOKS,
  floorGeo,
  inViewOf,
  lookFor,
  partyCompleteWith,
  partySpotsOf,
  pathToSpotOf,
  serveMsOf,
  waiterPathOf,
  waiterStandOf,
  walkFacing,
  walkFramesOf,
  walkMsOf,
  type FloorGeo,
  type FloorPoint,
  type PartySeat,
  type WaiterKind,
} from "@/game/restaurant/serviceFloor";
import { useLandscape } from "./layoutMode";
import { landscapeDiningArt } from "@/game/landscapeArt";
import type { QualityLabel } from "@/types/game";
import { GuestPoses } from "../restaurantMap/GuestPoses";
import { ambientDiners } from "@/game/restaurant/ambientDiners";
import { dishArtUrl } from "@/game/dishArt";
import { OrderArrivalCard } from "./OrderArrivalCard";
import { CustomerBust } from "@/components/kc/common/CustomerBust";
import { TableCash } from "../common/TableCash";
import { cashSpotBeside } from "@/game/restaurant/tableCash";
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
const at = (p: FloorPoint, g: FloorGeo) => {
  const v = inViewOf(p, g);
  return { transform: `translate(${pct(v.x)},${pct(v.y)})` };
};
/** The painted walker turns to face its way: one opacity track per direction (down, up, right, left), on the walk's own timing. */
const faceKeyframes = (name: string, path: readonly FloorPoint[], g: FloorGeo) => {
  const frames = walkFramesOf(path, g);
  const dirs = walkFacing(path);
  return (["down", "up", "r", "l"] as const)
    .map(
      (d) =>
        `@keyframes ${name}-${d}{${frames.map((f, i) => `${f.at}%{opacity:${dirs[i] === d ? 1 : 0}}`).join("")}}`,
    )
    .join("");
};
const walkKeyframes = (name: string, path: readonly FloorPoint[], g: FloorGeo) =>
  `@keyframes ${name}{${walkFramesOf(path, g)
    .map((f) => `${f.at}%{transform:translate(${pct(f.x)},${pct(f.y)})}`)
    .join("")}}`;
/** The gap between members walking in (a party walks in a short file). */
const FILE_GAP_MS = 380;
/** How long the served customer takes to walk out before the served card opens. */
const LEAVE_MS = 1300;

/**
 * A plate set on a table: the dish's own painting when it has one (`game/dishArt.ts`; the picture IS the plate, so the white disc is dropped), else the dish's icon on the white disc.
 */
function PlateFace({
  emoji,
  id,
  className,
}: {
  emoji: string;
  id: string | undefined;
  className: string;
}) {
  const art = dishArtUrl(id);
  return art ? (
    <span className={`${className} sf-plate--art`}>
      <img className="sf-plate-img" src={art} alt="" draggable={false} data-testid="sf-plate-art" />
    </span>
  ) : (
    <span className={className}>{emoji}</span>
  );
}

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
  cashier = false,
}: {
  mode: FloorMode;
  stage: KitchenMapArtStage;
  mapUrl: string;
  /** This order's place in its party (serviceFloor.ts `seatInParty`). */
  seat: PartySeat;
  customer: { id: string; name: string; avatarEmoji: string };
  /** The customer's own line for this order. */
  line: string;
  dish: { emoji: string; name: string; id?: string | undefined };
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
  /** Phase 10: a Cashier stands at the counter — takeaway customers order beside them and are handed the bag by them. */
  cashier?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { party, slot, arriving, leaving } = partySeat;
  // A landscape window shows the stage's wide dining picture and its own plan (developer 2026-11-20); portrait keeps the tall map's crop.
  const wide = useLandscape();
  const g = floorGeo(wide);
  /** Offsets measured on the tall map, scaled for the wide picture (its tables are twice as far from their chairs). */
  const k = wide ? 2 : 1;
  const seatsOf = g.seats(stage);
  const table = seatsOf[party.table];
  const spots = takeaway ? [g.takeaway(stage)] : partySpotsOf(table, party.size, g);
  const paths = takeaway ? [[g.takeaway(stage)]] : spots.map((s) => pathToSpotOf(table, s, g));
  // A takeaway customer is simply there at the counter (the tables are in the way of a walk to it).
  const walking = mode === "arrive" && arriving && !reducedMotion && !takeaway;
  const leavers =
    mode === "arrive" && arriving && leaving && !takeaway && !reducedMotion
      ? partySpotsOf(seatsOf[leaving.table], leaving.size, g).map((s, i) => ({
          look: leaving.looks[i]!,
          face: leaving.served[i]?.face ?? "🙂",
          path: [...pathToSpotOf(seatsOf[leaving.table], s, g)].reverse(),
        }))
      : [];
  // The new party waits outside until the one leaving is through the door.
  const waitMs = leavers.length ? Math.max(...leavers.map((l) => walkMsOf(l.path, g))) : 0;
  const lastIn = walking ? Math.max(...paths.map((p, i) => walkMsOf(p, g) + i * FILE_GAP_MS)) : 0;
  // Served together: every plate held back for the table arrives with this one, they all eat, and
  // when the party is complete they all walk out together.
  const deliverers = spots.map((_, i) => i === slot || !!party.held[i]);
  const partyLeaves = mode === "deliver" && partyCompleteWith(partySeat);
  // The waiter's walk from the pass: beside the table (or the customer at the door), and how long the beat takes.
  const stand = takeaway ? g.takeawayStand(stage) : waiterStandOf(table, g);
  const wPath = waiterPathOf(stand, g.pass(stage));
  const wWalkMs = walkMsOf(wPath, g);
  // With a Cashier the bag changes hands at the counter: nobody walks.
  const bagByCashier = takeaway && cashier;
  const deliverMs = bagByCashier ? BAG_MS : serveMsOf(stand, g.pass(stage), g);
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
    paths
      .map(
        (p, i) =>
          walkKeyframes(`sfwalk${uid}_${i}`, p, g) + faceKeyframes(`sfwalk${uid}_${i}`, p, g),
      )
      .join("") +
    leavers
      .map(
        (l, i) =>
          walkKeyframes(`sfleave${uid}_${i}`, l.path, g) +
          faceKeyframes(`sfleave${uid}_${i}`, l.path, g),
      )
      .join("") +
    paths
      .map(
        (p, i) =>
          walkKeyframes(`sfexit${uid}_${i}`, [...p].reverse(), g) +
          faceKeyframes(`sfexit${uid}_${i}`, [...p].reverse(), g),
      )
      .join("") +
    walkKeyframes(`sfwout${uid}`, wPath, g) +
    faceKeyframes(`sfwout${uid}`, wPath, g) +
    walkKeyframes(`sfwback${uid}`, [...wPath].reverse(), g) +
    faceKeyframes(`sfwback${uid}`, [...wPath].reverse(), g) +
    `@keyframes sfgone${uid}{0%,85%{opacity:1}100%{opacity:0}}`;
  const sitting = state !== "walking";
  const face = quality ? REACTION_FACE[quality] : "🙂";

  return (
    <div
      className="sf absolute inset-0 z-[65] flex flex-col bg-walnut-dark [container-type:size]"
      data-testid="service-floor"
      data-wide={wide ? "" : undefined}
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
      <div className="sf-stage relative min-h-0 flex-1 land:min-w-0">
        {/* The same crop of the painting, enlarged, blurred and darkened, fills what the view does not cover (a tall or a wide phone): no empty bands
            (developer 2026-11-16). A still layer behind the view; no one is drawn on it. */}
        <div className="sf-backdrop" aria-hidden="true">
          <img className="sf-map" src={mapUrl} alt="" draggable={false} />
        </div>
        <div className="sf-view" aria-hidden="true">
          <img
            className="sf-map"
            src={wide ? landscapeDiningArt(stage) : mapUrl}
            alt=""
            draggable={false}
          />
          <div className="sf-dim" />
          {/* The room's other diners (wide plan only, ambientDiners.ts): one guest in the front chair of about half the other tables. */}
          {wide
            ? ambientDiners(stage).map((d) => (
                <div key={d.id} className="sf-layer" data-testid="floor-diner" style={at(d.at, g)}>
                  <div className="sf-diner sf-pose-sit">
                    <GuestPoses {...lookFor(d.id)} />
                  </div>
                </div>
              ))
            : null}
          {/* Plates of the members already served stay on the table. */}
          {spots.map((s, i) =>
            i !== slot && party.served[i] ? (
              <div
                key={`plate${i}`}
                className="sf-layer"
                style={at({ x: s.x, y: s.y - 3.5 * k }, g)}
              >
                <PlateFace
                  emoji={party.served[i]!.emoji}
                  id={party.dishes[i]?.id}
                  className="sf-plate sf-plate--small"
                />
              </div>
            ) : null,
          )}
          {/* The waiter carries the plate (a tray of plates for a party) from the pass, sets it down, walks back. */}
          {cashier ? (
            <div className="sf-layer" data-testid="floor-cashier" style={at(g.cashier(stage), g)}>
              <div className="sf-person sf-pose-stand">
                <GuestPoses outfit="#3f5f8a" hair="#35271f" look="cashier" />
              </div>
              {mode === "deliver" && state !== "serving" ? (
                <div className="sf-face sf-face--small">🧾</div>
              ) : null}
            </div>
          ) : null}
          {mode === "deliver" && !reducedMotion && !bagByCashier ? (
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
                <GuestPoses
                  {...WAITER_LOOKS[waiter]}
                  face={{
                    name: state === "serving" ? `sfwout${uid}` : `sfwback${uid}`,
                    timing: `${wWalkMs}ms linear both`,
                  }}
                />
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
                    style={at(
                      { x: s.x + (takeaway ? 2.5 * k : 0), y: s.y - (takeaway ? 4.5 : 3.5) * k },
                      g,
                    )}
                  >
                    <PlateFace
                      emoji={takeaway ? "🛍️" : i === slot ? dish.emoji : party.held[i]!.emoji}
                      id={takeaway ? undefined : i === slot ? dish.id : party.dishes[i]?.id}
                      className="sf-plate"
                    />
                  </div>
                ) : null,
              )
            : null}
          {tableCash && tableCash.cents > 0 ? (
            <TableCash
              at={cashSpotBeside(stage, party.table, party.size, takeaway, g)}
              cents={tableCash.cents}
              onCollect={tableCash.onCollect}
              place={(p) => inViewOf(p, g)}
              tables={wide ? [seatsOf[0].table, seatsOf[1].table] : undefined}
              swipe
            />
          ) : null}
          {leavers.map((l, i) => (
            <div
              key={`leave${i}`}
              className="sf-layer"
              {...(i === 0 ? { "data-testid": "service-floor-leaving" } : {})}
              style={{
                animation: `sfleave${uid}_${i} ${walkMsOf(l.path, g)}ms linear both, sfgone${uid} ${walkMsOf(l.path, g)}ms linear both`,
              }}
            >
              <div className="sf-person sf-pose-walk">
                <GuestPoses
                  {...lookFor(l.look)}
                  face={{
                    name: `sfleave${uid}_${i}`,
                    timing: `${walkMsOf(l.path, g)}ms linear both`,
                  }}
                />
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
                        animation: `sfwalk${uid}_${i} ${walkMsOf(paths[i]!, g)}ms linear ${waitMs + i * FILE_GAP_MS}ms both`,
                      }
                    : state === "leaving" && partyLeaves
                      ? {
                          animation: `sfexit${uid}_${i} ${LEAVE_MS}ms linear ${i * FILE_GAP_MS}ms both, sfgone${uid} ${LEAVE_MS}ms linear ${i * FILE_GAP_MS}ms both`,
                        }
                      : at(s, g)
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
                  <GuestPoses
                    outfit={look.outfit}
                    hair={look.hair}
                    look={look.look}
                    face={
                      state === "walking"
                        ? {
                            name: `sfwalk${uid}_${i}`,
                            timing: `${walkMsOf(paths[i]!, g)}ms linear ${waitMs + i * FILE_GAP_MS}ms both`,
                          }
                        : state === "leaving" && partyLeaves
                          ? {
                              name: `sfexit${uid}_${i}`,
                              timing: `${LEAVE_MS}ms linear ${i * FILE_GAP_MS}ms both`,
                            }
                          : undefined
                    }
                  />
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
        // THE STARTING CARD (developer 2026-11-21, his mock-up): centred over the dining room in a wide window; under the picture on an upright phone (compact, no plate)
        <div
          className={
            wide
              ? "pointer-events-none absolute inset-x-0 top-[4.5cqh] z-10 flex justify-center px-2"
              : "relative z-10 flex justify-center px-2 pb-3 pt-1"
          }
        >
          <div className={wide ? "pointer-events-auto" : ""}>
            <OrderArrivalCard
              state={state === "walking" ? "walking" : "seated"}
              customerName={customer.name}
              partySize={party.size}
              takeaway={takeaway}
              dish={dish}
              line={line}
              onStart={finish}
              prepCook={prepCook && sitting ? prepCook : undefined}
              compact={!wide}
              bust={
                <CustomerBust
                  customerId={customer.id}
                  expression="neutral"
                  fallback={customer.avatarEmoji}
                  em={2}
                />
              }
              size={wide ? "clamp(8px, min(2.4cqh, 1.4cqw), 30px)" : "clamp(8px, 2.5cqw, 15px)"}
            />
          </div>
        </div>
      ) : (
        <p className="relative z-10 pb-6 pt-2 text-center font-hand text-[17px] text-ivory/90 land:absolute land:inset-x-0 land:bottom-0 land:pb-5 land:text-[19px] land:[text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
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
