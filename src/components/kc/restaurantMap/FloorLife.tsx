import { useMemo, type ReactNode } from "react";
import { floorCast, timeline, type FloorActor, type Frame } from "@/game/restaurant/floorLife";
import type { SecondFloorState } from "@/game/restaurant/secondFloor";
import { GuestPoses } from "./GuestPoses";

/**
 * The Second Floor's idle animation (developer 2026-10-16): servers carry food
 * from the machines to the Pickup Counter, guests pick it up, eat and leave,
 * cleaners wipe the tables. The routes come from game/restaurant/floorLife.ts;
 * this view only turns them into CSS keyframes (transform and opacity only, no
 * library). Decorative: hidden from screen readers and never takes a tap.
 */
const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

function keyframesFor(actor: FloorActor, frames: Frame[]): string {
  const k = `fl-${actor.id}`;
  const move = frames.map((f) => `${f.at}%{transform:translate(${pct(f.x)},${pct(f.y)})}`).join("");
  // Discrete states hold until the next frame (step-end).
  const state = (on: (f: Frame, i: number) => boolean) =>
    frames.map((f, i) => `${f.at}%{opacity:${on(f, i) ? 1 : 0}}`).join("");
  // Carrying: from leaving a "pick" stop until leaving the next "drop" / "sit" stop.
  const carrying: boolean[] = [];
  let holding = false;
  frames.forEach((f, i) => {
    const prev = frames[i - 1];
    if (prev?.pose === "pick") holding = true;
    if (prev && (prev.pose === "drop" || prev.pose === "sit")) holding = false;
    carrying.push(holding || f.pose === "clean" || f.pose === "work");
  });
  return (
    `@keyframes ${k}-move{${move}}` +
    `@keyframes ${k}-here{${state((f) => f.pose !== "away")}}` +
    `@keyframes ${k}-sit{${state((f) => f.pose === "sit")}}` +
    `@keyframes ${k}-walk{${state((f) => f.pose !== "sit")}}` +
    `@keyframes ${k}-carry{${state((_, i) => carrying[i]!)}}`
  );
}

export function FloorLife({
  floor,
  earning,
  preview = false,
}: {
  floor: SecondFloorState;
  earning: boolean;
  preview?: boolean;
}) {
  // The cast only changes when the stations or the team change (not every clock tick).
  const key = `${Object.keys(floor.stations).sort().join()}|${floor.servers ?? 0}|${floor.cleaners ?? 0}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures what the cast reads
  const cast = useMemo(() => floorCast(floor), [key]);
  return (
    <MapCast cast={cast} testId="floor-life" preview={preview}>
      {earning ? (
        <span className="floor-life-coin" data-testid="floor-life-coin">
          +$
        </span>
      ) : null}
    </MapCast>
  );
}

/**
 * Draws any cast of map people (both floors share it): each actor's route
 * becomes CSS keyframes. Nothing is drawn for an empty cast.
 */
export function MapCast({
  cast,
  testId,
  preview = false,
  children,
}: {
  cast: readonly FloorActor[];
  testId: string;
  preview?: boolean;
  children?: ReactNode;
}) {
  const lines = useMemo(() => cast.map((a) => ({ actor: a, ...timeline(a.stops) })), [cast]);
  if (lines.length === 0) return null;
  const css = lines.map((c) => keyframesFor(c.actor, c.frames)).join("");
  return (
    <div
      className="floor-life"
      aria-hidden="true"
      data-testid={testId}
      data-preview={preview ? "true" : undefined}
    >
      <style>{css}</style>
      {lines.map(({ actor, seconds }) => {
        const k = `fl-${actor.id}`;
        const timing = `${seconds}s ${actor.delay}s infinite`;
        const sits = actor.stops.some((s) => s.pose === "sit");
        return (
          <div
            key={actor.id}
            className={`floor-actor floor-actor--${actor.kind}`}
            data-actor={actor.kind}
            style={{ animation: `${k}-move ${timing} linear, ${k}-here ${timing} step-end` }}
          >
            <div className="floor-person">
              <div className="floor-pose" style={{ animation: `${k}-walk ${timing} step-end` }}>
                <WalkOnly outfit={actor.outfit} hair={actor.hair} />
              </div>
              {sits ? (
                <div
                  className="floor-pose"
                  style={{ opacity: 0, animation: `${k}-sit ${timing} step-end` }}
                >
                  <SitOnly outfit={actor.outfit} hair={actor.hair} />
                </div>
              ) : null}
              {actor.kind !== "guest" && actor.kind !== "manager" ? (
                <span className="floor-cap" />
              ) : null}
              {actor.food ? (
                <span
                  className={`floor-carry floor-carry--${actor.kind}`}
                  style={{ opacity: 0, animation: `${k}-carry ${timing} step-end` }}
                >
                  {actor.food}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
      {children}
    </div>
  );
}

/** GuestPoses draws both poses; each wrapper shows one of them. */
function WalkOnly({ outfit, hair }: { outfit: string; hair: string }) {
  return (
    <div className="floor-pose-walk">
      <GuestPoses outfit={outfit} hair={hair} />
    </div>
  );
}
function SitOnly({ outfit, hair }: { outfit: string; hair: string }) {
  return (
    <div className="floor-pose-sit">
      <GuestPoses outfit={outfit} hair={hair} />
    </div>
  );
}
