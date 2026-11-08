import { useMemo, type CSSProperties, type ReactNode } from "react";
import {
  floorCast,
  speedOf,
  timeline,
  type FloorActor,
  type Frame,
} from "@/game/restaurant/floorLife";
import { CELL, PEOPLE_LOOKS, WORK_CELLS, type PeopleLook } from "@/game/restaurant/peopleLooks";
import type { SecondFloorState } from "@/game/restaurant/secondFloor";
import { GuestPoses } from "./GuestPoses";
import { PoseCell } from "./CharacterSprite";
import { usePeopleSheets } from "./peopleSheets";

/**
 * The Second Floor's idle animation (developer 2026-10-16): servers carry food
 * from the machines to the Pickup Counter, guests pick it up, eat and leave,
 * cleaners wipe the tables. The routes come from game/restaurant/floorLife.ts;
 * this view only turns them into CSS keyframes (transform and opacity only, no
 * library). Decorative: hidden from screen readers and never takes a tap.
 *
 * NPC realism (developer 2026-11-07): every person is a painted character (public/people/, peopleLooks.ts). Each actor is a stack of
 * poses (walk down / up / right / left, carrying, idle, seated and eating, the first-floor work poses) of which exactly one is
 * visible at a time, switched by keyframes from the route (the facing follows each stretch of the walk, the pose follows what the person
 * is doing at each stop). People nearer the bottom of the map are drawn in front (z-index follows y). A sheet that fails to load
 * leaves the old SVG puppet in its place.
 */
const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

/** Which carrying hands the person has: staff and the Second Floor's crew carry their tools; guests carry their food as a bubble. */
const isGuest = (l: PeopleLook | undefined) => !l || l.group === "guest" || l.group === "regular";

/** The pose layer shown on each stretch of a route, and whether the food bubble shows. */
type Step = { layer: string; food: boolean };

function stepsFor(actor: FloorActor, frames: Frame[], carrying: boolean[]): Step[] {
  const look = actor.look ? PEOPLE_LOOKS[actor.look] : undefined;
  const work = look ? WORK_CELLS[look.id] : undefined;
  const out: Step[] = [];
  let workIndex = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    const next = frames[i + 1] ?? frames[0]!;
    const dx = next.x - f.x;
    const dy = next.y - f.y;
    const food = carrying[i]! && isGuest(look);
    if (Math.hypot(dx, dy) < 0.001) {
      // Standing still: what the person is doing here.
      let layer = "idle";
      if (look?.id === "manager") layer = "sit";
      else if (f.pose === "sit") layer = isGuest(look) ? "eat" : "sit";
      else if (f.pose === "work" && work) layer = `work:${work[workIndex++ % work.length]!}`;
      else if (f.pose === "pick") layer = isGuest(look) ? "hand" : look?.work ? "work:4" : "idle";
      else if (f.pose === "drop") layer = look?.work ? "work:1" : "carry-idle";
      else if (f.pose === "clean")
        layer = work ? `work:${work[workIndex++ % work.length]!}` : "carry-idle";
      out.push({ layer, food });
      continue;
    }
    const side = Math.abs(dx) >= Math.abs(dy) * 0.8;
    const dir = side ? (dx > 0 ? "r" : "l") : dy > 0 ? "down" : "up";
    const carries = carrying[i]! && !isGuest(look) && side;
    out.push({ layer: `${carries ? "carry" : "walk"}-${dir}`, food });
  }
  return out;
}

/** What each layer shows (sheet, column, row, whether it walks, whether it is mirrored, whether it is the table cycle). */
function layerProps(
  key: string,
  guest = false,
): {
  sheet: "a" | "b";
  col: number;
  row: number;
  walk?: boolean;
  flip?: boolean;
  eat?: boolean;
  /** A seated guest seen from behind: they face the table, away from the camera (developer 2026-11-08). */
  back?: boolean;
} {
  if (key.startsWith("work:")) return { sheet: "b", col: Number(key.slice(5)), row: 0 };
  switch (key) {
    case "walk-down":
      return { sheet: "a", col: 0, row: 0, walk: true };
    case "walk-up":
      return { sheet: "a", col: 0, row: 1, walk: true };
    case "walk-r":
      return { sheet: "a", col: 0, row: 2, walk: true };
    case "walk-l":
      return { sheet: "a", col: 0, row: 2, walk: true, flip: true };
    case "carry-r":
      return { sheet: "a", col: 0, row: 3, walk: true };
    case "carry-l":
      return { sheet: "a", col: 0, row: 3, walk: true, flip: true };
    case "carry-idle":
      return { sheet: "a", col: CELL.carryIdle, row: 3 };
    case "hand":
      return { sheet: "a", col: CELL.hand, row: 3 };
    case "sit":
      return guest
        ? { sheet: "a", col: 1, row: 1, back: true }
        : { sheet: "a", col: CELL.seated, row: 0 };
    case "eat":
      return guest
        ? { sheet: "a", col: 1, row: 1, back: true, eat: true }
        : { sheet: "a", col: CELL.seated, row: 0, eat: true };
    default:
      return { sheet: "a", col: CELL.idle, row: 0 };
  }
}

function keyframesFor(actor: FloorActor, frames: Frame[], steps: Step[], layers: string[]): string {
  const k = `fl-${actor.id}`;
  // The map is a painted street scene: the nearer to the bottom, the more in front (z-index follows y).
  const move = frames
    .map(
      (f) =>
        `${f.at}%{transform:translate(${pct(f.x)},${pct(f.y)});z-index:${Math.round(f.y * 10)}}`,
    )
    .join("");
  // Discrete states hold until the next frame (step-end).
  const state = (on: (f: Frame, i: number) => boolean) =>
    frames.map((f, i) => `${f.at}%{opacity:${on(f, i) ? 1 : 0}}`).join("");
  const carrying = carryingOf(frames);
  const own = actor.look
    ? layers
        .map((layer, n) => `@keyframes ${k}-l${n}{${state((_, i) => steps[i]!.layer === layer)}}`)
        .join("") + `@keyframes ${k}-food{${state((_, i) => steps[i]!.food)}}`
    : "";
  return (
    `@keyframes ${k}-move{${move}}` +
    `@keyframes ${k}-here{${state((f) => f.pose !== "away")}}` +
    `@keyframes ${k}-sit{${state((f) => f.pose === "sit")}}` +
    `@keyframes ${k}-walk{${state((f) => f.pose !== "sit")}}` +
    `@keyframes ${k}-carry{${state((_, i) => carrying[i]!)}}` +
    own
  );
}

/** Carrying: from leaving a "pick" stop until leaving the next "drop" / "sit" stop (a cleaner or a cook at work holds their tool). */
function carryingOf(frames: Frame[]): boolean[] {
  const out: boolean[] = [];
  let holding = false;
  frames.forEach((f, i) => {
    const prev = frames[i - 1];
    if (prev?.pose === "pick") holding = true;
    if (prev && (prev.pose === "drop" || prev.pose === "sit")) holding = false;
    out.push(holding || f.pose === "clean" || f.pose === "work");
  });
  return out;
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
  const lines = useMemo(
    () =>
      cast.map((a) => {
        const t = timeline(a.stops, speedOf(a));
        const carrying = carryingOf(t.frames);
        const steps = stepsFor(a, t.frames, carrying);
        const layers = [...new Set(steps.map((s) => s.layer))];
        return { actor: a, ...t, steps, layers };
      }),
    [cast],
  );
  // Painted people load their sheets lazily; until a sheet is in, that person is not drawn (no flash of the old puppet).
  const looks = [...new Set(cast.flatMap((a) => (a.look ? [a.look] : [])))];
  const sheetA = usePeopleSheets(looks, "a");
  const sheetB = usePeopleSheets(
    looks.filter((l) => PEOPLE_LOOKS[l]?.work),
    "b",
  );
  if (lines.length === 0) return null;
  const css = lines.map((c) => keyframesFor(c.actor, c.frames, c.steps, c.layers)).join("");
  return (
    <div
      className="floor-life"
      aria-hidden="true"
      data-testid={testId}
      data-preview={preview ? "true" : undefined}
    >
      <style>{css}</style>
      {lines.map(({ actor, seconds, steps, layers }) => {
        const k = `fl-${actor.id}`;
        const timing = `${seconds}s ${actor.delay}s infinite both`;
        const info = actor.look ? PEOPLE_LOOKS[actor.look] : undefined;
        const failed =
          !!info && (sheetA(info.id) === "fail" || (info.work && sheetB(info.id) === "fail"));
        const loaded =
          !!info && !failed && sheetA(info.id) === "ok" && (!info.work || sheetB(info.id) === "ok");
        if (info && !failed && !loaded) return null; // still loading: nothing drawn yet
        const sprite = loaded;
        const sits = actor.stops.some((s) => s.pose === "sit");
        return (
          <div
            key={actor.id}
            className={`floor-actor floor-actor--${actor.kind}`}
            data-actor={actor.kind}
            data-look={sprite ? info?.id : undefined}
            style={{ animation: `${k}-move ${timing} linear, ${k}-here ${timing} step-end` }}
          >
            {sprite && info ? (
              <div
                className="floor-person floor-person--sprite"
                data-gender={info.gender}
                style={{ "--cs-scale": info.scale } as CSSProperties}
              >
                {layers.map((layer, n) => {
                  const p = layerProps(layer, actor.kind === "guest");
                  return (
                    <div
                      key={layer}
                      className="cs-layer"
                      data-pose={layer}
                      style={{ opacity: 0, animation: `${k}-l${n} ${timing} step-end` }}
                    >
                      <PoseCell
                        id={info.id}
                        sheet={p.sheet}
                        col={p.col}
                        row={p.row}
                        walk={!!p.walk}
                        flip={!!p.flip}
                        seconds={0.72 / info.speed}
                        className={
                          p.back
                            ? p.eat
                              ? "cs-back cs-back-eat"
                              : "cs-back"
                            : p.eat
                              ? "cs-eat"
                              : ""
                        }
                        style={p.eat ? { animationDelay: `${-(actor.delay % 16)}s` } : undefined}
                      />
                    </div>
                  );
                })}
                {actor.food ? (
                  <span
                    className={`floor-carry floor-carry--${actor.kind}`}
                    style={{ opacity: 0, animation: `${k}-food ${timing} step-end` }}
                  >
                    {actor.food}
                  </span>
                ) : null}
              </div>
            ) : (
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
            )}
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
