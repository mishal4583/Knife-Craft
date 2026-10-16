import { useMemo } from "react";
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
    carrying.push(holding || (actor.kind === "cleaner" && f.pose === "clean"));
  });
  return (
    `@keyframes ${k}-move{${move}}` +
    `@keyframes ${k}-here{${state((f) => f.pose !== "away")}}` +
    `@keyframes ${k}-sit{${state((f) => f.pose === "sit")}}` +
    `@keyframes ${k}-walk{${state((f) => f.pose !== "sit")}}` +
    `@keyframes ${k}-carry{${state((_, i) => carrying[i]!)}}`
  );
}

export function FloorLife({ floor, earning }: { floor: SecondFloorState; earning: boolean }) {
  // The cast only changes when the stations or the team change (not every clock tick).
  const key = `${Object.keys(floor.stations).sort().join()}|${floor.servers ?? 0}|${floor.cleaners ?? 0}`;
  const cast = useMemo(
    () => floorCast(floor).map((a) => ({ actor: a, ...timeline(a.stops) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures what the cast reads
    [key],
  );
  if (cast.length === 0) return null;
  const css = cast.map((c) => keyframesFor(c.actor, c.frames)).join("");
  return (
    <div className="floor-life" aria-hidden="true" data-testid="floor-life">
      <style>{css}</style>
      {cast.map(({ actor, seconds }) => {
        const k = `fl-${actor.id}`;
        const timing = `${seconds}s ${actor.delay}s infinite`;
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
              {actor.kind === "guest" ? (
                <div
                  className="floor-pose"
                  style={{ opacity: 0, animation: `${k}-sit ${timing} step-end` }}
                >
                  <SitOnly outfit={actor.outfit} hair={actor.hair} />
                </div>
              ) : null}
              {actor.kind !== "guest" ? <span className="floor-cap" /> : null}
              <span
                className={`floor-carry floor-carry--${actor.kind}`}
                style={{ opacity: 0, animation: `${k}-carry ${timing} step-end` }}
              >
                {actor.food}
              </span>
            </div>
          </div>
        );
      })}
      {earning ? (
        <span className="floor-life-coin" data-testid="floor-life-coin">
          +$
        </span>
      ) : null}
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
