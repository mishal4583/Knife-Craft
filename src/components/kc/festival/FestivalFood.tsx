/**
 * The food as the festival shows it: a plate stacked layer by layer, so the plate and the order bubble show exactly the same thing whatever is on it;
 * the pans; meat and sides that change as they cook (one picture fading into the next, on one crop, so nothing moves); the drink machines; and the
 * little pictures in an order. A food the Codex Burger kit painted uses its picture; every other is drawn (foodLooks.ts, DrawnFood.tsx) until its
 * own picture arrives.
 */
import type { FoodId, SlotPhase } from "@/game/festival/types";
import {
  BASKET_ART,
  CHIP_ART,
  CUP_EMPTY,
  LAYERS,
  MEATS,
  SIDE_ART,
  STATION_ART,
  TRAY_ART,
  festivalUrl,
  layerArt,
  meatArt,
  type LayerId,
  type MeatState,
} from "./festivalArt";
import { DrawnBasket, DrawnChip, DrawnLayer, DrawnMeat, DrawnPan } from "./DrawnFood";
import { FOOD_LOOKS } from "./foodLooks";
import { machinePicture } from "./festivalFoodParts";
import { layerSize } from "./layerSizes";

const MEAT_LAYERS = new Set<FoodId>(["patty", "chicken", "veggie"]);

/** How far apart a burger still being built holds its layers, so every part on the plate can be seen. */
export const OPEN_SPREAD = 1.7;

const isPaintedLayer = (id: FoodId): id is LayerId => id in LAYERS;
const sizeOf = (id: FoodId) => (isPaintedLayer(id) ? LAYERS[id] : layerSize(FOOD_LOOKS[id]!));

/**
 * A dish drawn bottom to top from its parts (the base first). `lid` puts the top bun on a burger: an order shows it, and a plate shows it once
 * somebody wants it exactly so, which is the sign to serve. `spread` holds the layers apart. It keeps one width; a tall one is shrunk to fit its box,
 * standing on its bottom edge.
 */
export function DishStack({
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
  // only a burger has a lid
  const ids: FoodId[] = [...parts, ...(lid && parts[0] === "bun" ? ["lid"] : [])];
  if (!ids.length) return null;
  const centres = ids.reduce<number[]>(
    (done, id, i) =>
      done.concat(
        i === 0 ? 0 : done[i - 1]! + ((sizeOf(ids[i - 1]!).thick + sizeOf(id).thick) / 2) * spread,
      ),
    [],
  );
  const top = Math.max(...ids.map((id, i) => centres[i]! + sizeOf(id).height / 2));
  const bottom = Math.max(...ids.map((id, i) => sizeOf(id).height / 2 - centres[i]!));
  return (
    <svg
      viewBox={`0 ${-top} 400 ${top + bottom}`}
      preserveAspectRatio="xMidYMax meet"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {ids.map((id, i) =>
        isPaintedLayer(id) ? (
          <image
            key={`${id}-${i}`}
            href={festivalUrl(layerArt(id))}
            x="0"
            y={-centres[i]! - 200}
            width="400"
            height="400"
            className={over && MEAT_LAYERS.has(id) ? "fest-darker" : undefined}
          />
        ) : (
          <DrawnLayer key={`${id}-${i}`} look={FOOD_LOOKS[id]!} y={-centres[i]!} />
        ),
      )}
    </svg>
  );
}

/** The pan a food is taken from (a sauce: its bottle). */
export function TrayPicture({ item, className }: { item: FoodId; className: string }) {
  const art = TRAY_ART[item];
  return art ? (
    <img src={festivalUrl(art)} alt="" draggable={false} className={className} />
  ) : (
    <DrawnPan look={FOOD_LOOKS[item]!} className={className} />
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

/** A main on the hot station: raw, browning, cooked, darker once overcooked, charred once burnt. */
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
  if (!MEATS.includes(item))
    return (
      <DrawnMeat look={FOOD_LOOKS[item]!} phase={phase} progress={progress} className={className} />
    );
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

/** A side in its basket, from pale to golden to burnt. */
export function Basket({
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
  if (item !== "fries")
    return (
      <DrawnBasket
        look={FOOD_LOOKS[item]!}
        phase={phase}
        progress={progress}
        className={className}
      />
    );
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

/** The painted blender holds a pink shake (hue 350): turned toward another drink's colour; a pale drink takes the colour out. */
function tintOfBlend(color: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const high = Math.max(r, g, b);
  const spread = high - Math.min(r, g, b);
  if (spread < 0.2) return `saturate(0.15) brightness(${high > 0.75 ? 1.15 : 0.9})`;
  const hue =
    high === r
      ? ((g - b) / spread + 6) % 6
      : high === g
        ? (b - r) / spread + 2
        : (r - g) / spread + 4;
  return `hue-rotate(${Math.round(hue * 60 - 350)}deg)${high < 0.6 ? " brightness(0.8)" : ""}`;
}

/** A drink machine: a tap with its cup filling under it, or the blender, which shakes while it blends and then shows the finished drink. */
export function DrinkMachine({
  drink,
  place,
  pouring,
  phase,
  progress = 0,
}: {
  drink: FoodId;
  /** Which of the three machines, left to right (0-2). */
  place: number;
  /** Something is in it. */
  pouring: boolean;
  phase: SlotPhase | null;
  progress?: number;
}) {
  const machine = machinePicture(drink, place);
  const full = SIDE_ART[drink];
  const look = FOOD_LOOKS[drink];
  if (machine === STATION_ART.blender) {
    const done = pouring && phase !== "cooking";
    const className = `fest-blender ${pouring && !done ? "fest-blending" : ""}`;
    if (done)
      return full ? (
        <img src={festivalUrl(full)} alt="" draggable={false} className={className} />
      ) : (
        <DrawnChip look={look!} className={className} />
      );
    return (
      <>
        <img
          src={festivalUrl(machine)}
          alt=""
          draggable={false}
          className={className}
          style={look ? { filter: tintOfBlend(look.color) } : undefined}
        />
        {/* what is in this blender, shown by a little cup beside its name */}
        {look ? <DrawnChip look={look} className="fest-drinktag" /> : null}
      </>
    );
  }
  const level = !pouring ? 0 : phase === "cooking" ? progress : 1;
  return (
    // the whole machine, in the picture's own shape, so the cup stands in its tray under the tap in every box
    <span className="fest-machine">
      <img src={festivalUrl(machine)} alt="" draggable={false} className="fest-tap" />
      {look ? (
        // a drawn drink: its colour in the machine's window
        <span aria-hidden="true" className="fest-tapwindow" style={{ background: look.color }} />
      ) : null}
      <span aria-hidden="true" className={`fest-art fest-cup ${pouring ? "" : "fest-cup-waiting"}`}>
        <img src={festivalUrl(CUP_EMPTY)} alt="" draggable={false} />
        {pouring && full ? (
          // the full cup shows from the bottom up as it fills
          <img
            src={festivalUrl(full)}
            alt=""
            draggable={false}
            style={{ clipPath: `inset(${(1 - level) * 100}% 0 0 0)` }}
          />
        ) : null}
        {pouring && !full ? (
          <span
            className="fest-drawncup"
            style={{ clipPath: `inset(${(1 - level) * 100}% 0 0 0)` }}
          >
            <DrawnChip look={look!} />
          </span>
        ) : null}
      </span>
    </span>
  );
}

/** A part or a side as it appears in an order. */
export function FoodPicture({ item, className }: { item: FoodId; className?: string }) {
  const name = SIDE_ART[item] ?? CHIP_ART[item];
  if (name) return <img src={festivalUrl(name)} alt="" draggable={false} className={className} />;
  const look = FOOD_LOOKS[item];
  return look ? <DrawnChip look={look} className={className} /> : null;
}
