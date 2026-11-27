/**
 * The food as the festival shows it (the developer's Codex Burger kit): a burger stacked layer by layer, so the plate and the order bubble show
 * exactly the same thing whatever is on it; meat and fries that change as they cook (one picture fading into the next, on one crop, so nothing
 * moves); the drink machines; and the little pictures in an order.
 */
import type { FoodId, SlotPhase } from "@/game/festival/types";
import {
  BASKET_ART,
  CHIP_ART,
  CUP_EMPTY,
  LAYERS,
  SIDE_ART,
  STATION_ART,
  TAP_ART,
  festivalUrl,
  layerArt,
  meatArt,
  type LayerId,
  type MeatState,
} from "./festivalArt";

const MEAT_LAYERS = new Set<LayerId>(["patty", "chicken", "veggie"]);

/** How far apart a burger still being built holds its layers, so every part on the plate can be seen. */
export const OPEN_SPREAD = 1.7;

/**
 * A burger drawn bottom to top from its parts (the bun first). `lid` puts the top bun on: an order shows it, and a plate shows it once somebody
 * wants it exactly so, which is the sign to serve. `spread` holds the layers apart. It keeps one width; a tall one is shrunk to fit its box,
 * standing on its bottom edge.
 */
export function BurgerStack({
  parts,
  lid = false,
  over = false,
  spread = 1,
  className,
}: {
  parts: readonly FoodId[];
  lid?: boolean;
  over?: boolean;
  spread?: number;
  className?: string | undefined;
}) {
  const ids = [...parts, ...(lid && parts.length ? ["lid"] : [])] as LayerId[];
  if (!ids.length) return null;
  const centres = ids.reduce<number[]>(
    (done, id, i) =>
      done.concat(
        i === 0 ? 0 : done[i - 1]! + ((LAYERS[ids[i - 1]!].thick + LAYERS[id].thick) / 2) * spread,
      ),
    [],
  );
  const top = Math.max(...ids.map((id, i) => centres[i]! + LAYERS[id].height / 2));
  const bottom = Math.max(...ids.map((id, i) => LAYERS[id].height / 2 - centres[i]!));
  return (
    <svg
      viewBox={`0 ${-top} 400 ${top + bottom}`}
      preserveAspectRatio="xMidYMax meet"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {ids.map((id, i) => (
        <image
          key={`${id}-${i}`}
          href={festivalUrl(layerArt(id))}
          x="0"
          y={-centres[i]! - 200}
          width="400"
          height="400"
          className={over && MEAT_LAYERS.has(id) ? "fest-darker" : undefined}
        />
      ))}
    </svg>
  );
}

/** How far a picture has faded in, from `from` to `to` of the cooking. */
const fade = (progress: number, from: number, to: number) =>
  Math.max(0, Math.min(1, (progress - from) / (to - from)));

/** Pictures laid exactly on one another, each as see-through as it should be. */
function Layers({
  pictures,
  className,
}: {
  pictures: readonly (readonly [name: string, opacity: number])[];
  className: string;
}) {
  return (
    <span aria-hidden="true" className={`fest-art ${className}`}>
      {pictures.map(([name, opacity]) => (
        <img key={name} src={festivalUrl(name)} alt="" draggable={false} style={{ opacity }} />
      ))}
    </span>
  );
}

/** A piece of meat on the grill: raw, browning, cooked, darker once overcooked, charred once burnt. */
export function Meat({
  item,
  phase,
  progress = 0,
  className = "",
}: {
  item: FoodId;
  phase: SlotPhase;
  progress?: number;
  className?: string;
}) {
  const show = (state: MeatState, opacity = 1) => [meatArt(item, state), opacity] as const;
  const pictures =
    phase === "burnt"
      ? [show("burnt")]
      : phase !== "cooking"
        ? [show("cooked")]
        : progress < 0.5
          ? [show("raw"), show("cooking", fade(progress, 0.15, 0.5))]
          : [show("cooking"), show("cooked", fade(progress, 0.6, 1))];
  return (
    <Layers pictures={pictures} className={`${className} ${phase === "over" ? "fest-over" : ""}`} />
  );
}

/** Fries in their basket, from pale to golden to burnt. */
export function Basket({
  phase,
  progress = 0,
  className = "",
}: {
  phase: SlotPhase;
  progress?: number;
  className?: string;
}) {
  const pictures: (readonly [string, number])[] =
    phase === "burnt"
      ? [[BASKET_ART.burnt, 1]]
      : phase === "cooking"
        ? [
            [BASKET_ART.raw, 1],
            [BASKET_ART.golden, fade(progress, 0.3, 1)],
          ]
        : [[BASKET_ART.golden, 1]];
  return (
    <Layers pictures={pictures} className={`${className} ${phase === "over" ? "fest-over" : ""}`} />
  );
}

/** A drink machine: the tap with its cup filling under it, or the blender, which shakes while it blends and then shows the finished shake. */
export function DrinkMachine({
  drink,
  pouring,
  phase,
  progress = 0,
}: {
  drink: FoodId;
  /** Something is in it. */
  pouring: boolean;
  phase: SlotPhase | null;
  progress?: number;
}) {
  const tap = TAP_ART[drink];
  const full = SIDE_ART[drink]!;
  if (!tap) {
    const done = pouring && phase !== "cooking";
    return (
      <img
        src={festivalUrl(done ? full : STATION_ART.blender)}
        alt=""
        draggable={false}
        className={`fest-blender ${pouring && !done ? "fest-blending" : ""}`}
      />
    );
  }
  const level = !pouring ? 0 : phase === "cooking" ? progress : 1;
  return (
    // the whole machine, in the picture's own shape, so the cup stands in its tray under the tap in every box
    <span className="fest-machine">
      <img src={festivalUrl(tap)} alt="" draggable={false} className="fest-tap" />
      <span aria-hidden="true" className={`fest-art fest-cup ${pouring ? "" : "fest-cup-waiting"}`}>
        <img src={festivalUrl(CUP_EMPTY)} alt="" draggable={false} />
        {pouring ? (
          // the full cup shows from the bottom up as it fills
          <img
            src={festivalUrl(full)}
            alt=""
            draggable={false}
            style={{ clipPath: `inset(${(1 - level) * 100}% 0 0 0)` }}
          />
        ) : null}
      </span>
    </span>
  );
}

/** A part or a side as it appears in an order. */
export function FoodPicture({ item, className }: { item: FoodId; className?: string }) {
  const name = SIDE_ART[item] ?? CHIP_ART[item];
  return name ? (
    <img src={festivalUrl(name)} alt="" draggable={false} className={className} />
  ) : null;
}
