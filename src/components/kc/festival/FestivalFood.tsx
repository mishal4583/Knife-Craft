/**
 * The food as the festival draws it: a burger stacked layer by layer (so the plate and the order bubble show exactly the same thing, whatever is on it),
 * the raw and cooking food on the stations, and the drinks. Plain shapes on purpose (developer 2026-11-27, Phase 2a); the Codex Burger kit replaces
 * them. Colours say the state: pink raw, brown ready, dark overcooked, black burnt.
 */
import type { FoodId, SlotPhase } from "@/game/festival/types";
import { FOOD_PICTURES, festivalUrl } from "./festivalArt";

const LAYER_HEIGHT: Partial<Record<FoodId, number>> = {
  bun: 12,
  patty: 12,
  chicken: 13,
  cheese: 6,
  pickles: 6,
  onion: 6,
  tomato: 7,
  lettuce: 8,
};

/** One layer of a burger, in a 100-wide box whose top is `y`. */
function Layer({ item, y, over }: { item: FoodId; y: number; over?: boolean }) {
  switch (item) {
    case "bun":
      return (
        <g>
          <rect x="8" y={y} width="84" height="12" rx="6" fill="#d8913f" />
          <rect x="10" y={y} width="80" height="4" rx="2" fill="#f4c374" />
        </g>
      );
    case "patty":
      return (
        <g>
          <rect x="6" y={y} width="88" height="12" rx="6" fill={over ? "#3b2010" : "#7a3f1c"} />
          {[24, 42, 60, 76].map((x) => (
            <rect key={x} x={x} y={y + 2} width="4" height="8" rx="2" fill="#46220f" />
          ))}
        </g>
      );
    case "chicken":
      return (
        <path
          d={`M8 ${y + 11} Q4 ${y + 4} 14 ${y + 3} Q20 ${y - 2} 30 ${y + 2} Q40 ${y - 3} 50 ${y + 2} Q62 ${y - 2} 72 ${y + 3} Q84 ${y - 1} 90 ${y + 4} Q97 ${y + 8} 90 ${y + 12} Q50 ${y + 16} 8 ${y + 11} Z`}
          fill={over ? "#8a4d12" : "#e8982c"}
        />
      );
    case "cheese":
      return (
        <path
          d={`M7 ${y} H93 V${y + 5} L82 ${y + 5} L77 ${y + 13} L72 ${y + 5} L36 ${y + 5} L31 ${y + 11} L26 ${y + 5} H7 Z`}
          fill="#f9c52e"
        />
      );
    case "pickles":
      return (
        <g fill="#8fa326" stroke="#5f7016" strokeWidth="1">
          {[22, 44, 66, 82].map((x) => (
            <ellipse key={x} cx={x} cy={y + 3} rx="11" ry="3.5" />
          ))}
        </g>
      );
    case "onion":
      return (
        <g fill="none" stroke="#a43f92" strokeWidth="2.6">
          {[24, 50, 76].map((x) => (
            <ellipse key={x} cx={x} cy={y + 3} rx="13" ry="3.4" />
          ))}
        </g>
      );
    case "tomato":
      return (
        <g>
          <rect x="9" y={y} width="39" height="7" rx="3.5" fill="#e0402c" />
          <rect x="52" y={y} width="39" height="7" rx="3.5" fill="#e0402c" />
        </g>
      );
    case "lettuce":
      return (
        <path
          d={`M3 ${y + 4} Q10 ${y - 3} 18 ${y + 3} Q26 ${y - 3} 35 ${y + 3} Q44 ${y - 3} 52 ${y + 3} Q61 ${y - 3} 70 ${y + 3} Q79 ${y - 3} 87 ${y + 3} Q93 ${y - 2} 97 ${y + 4} Q86 ${y + 12} 50 ${y + 9} Q14 ${y + 12} 3 ${y + 4} Z`}
          fill="#7cc23e"
          stroke="#4f8f1f"
          strokeWidth="1"
        />
      );
    default:
      return null;
  }
}

/**
 * A burger drawn bottom to top from its parts (the bun first). `lid` puts the top bun on: an order shows it, and a plate shows it once somebody
 * wants it exactly so, which is the sign to serve.
 */
export function BurgerStack({
  parts,
  lid = false,
  over = false,
  className,
}: {
  parts: readonly FoodId[];
  lid?: boolean;
  over?: boolean;
  className?: string;
}) {
  let y = 66;
  const layers = parts.map((item, i) => {
    y -= (LAYER_HEIGHT[item] ?? 8) - (i === 0 ? 0 : 1);
    return <Layer key={`${item}-${i}`} item={item} y={y} over={over} />;
  });
  const top = lid ? y - 24 : y;
  return (
    <svg
      viewBox={`0 ${Math.min(top, 20) - 2} 100 ${68 - Math.min(top, 20) + 2}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {layers}
      {lid && parts.length > 0 ? (
        <g>
          <path
            d={`M8 ${y + 1} Q8 ${y - 23} 50 ${y - 23} Q92 ${y - 23} 92 ${y + 1} Z`}
            fill="#e59a3c"
          />
          <path
            d={`M14 ${y - 8} Q22 ${y - 20} 46 ${y - 20}`}
            stroke="#f8c67a"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          {[
            [34, 14],
            [50, 18],
            [66, 13],
            [43, 8],
            [60, 7],
            [76, 6],
          ].map(([x, dy]) => (
            <ellipse key={`${x}-${dy}`} cx={x} cy={y - dy!} rx="2.6" ry="1.7" fill="#fff0cf" />
          ))}
        </g>
      ) : null}
    </svg>
  );
}

const meatColour = (item: FoodId, phase: SlotPhase, progress: number): string => {
  const raw = item === "chicken" ? [240, 190, 170] : [229, 122, 122];
  const done = item === "chicken" ? [224, 143, 38] : [122, 63, 28];
  if (phase === "burnt") return "#1b110c";
  if (phase === "over") return item === "chicken" ? "#8a4d12" : "#43230f";
  const t = phase === "cooking" ? Math.max(0, Math.min(1, progress)) : 1;
  return `rgb(${raw.map((c, i) => Math.round(c + (done[i]! - c) * t)).join(",")})`;
};

/** A patty or a chicken fillet lying on the grill (or raw in its tray). */
export function Meat({
  item,
  phase,
  progress = 0,
  className,
}: {
  item: FoodId;
  phase: SlotPhase | "raw";
  progress?: number;
  className?: string;
}) {
  const colour =
    phase === "raw" ? meatColour(item, "cooking", 0) : meatColour(item, phase, progress);
  const marks = phase !== "raw" && (phase !== "cooking" || progress > 0.55);
  return (
    <svg viewBox="0 0 100 70" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="50" cy="42" rx="42" ry="22" fill="rgba(0,0,0,.28)" />
      <ellipse cx="50" cy="38" rx="42" ry="24" fill={colour} />
      <ellipse cx="50" cy="33" rx="36" ry="17" fill="rgba(255,255,255,.12)" />
      {marks ? (
        <g stroke="rgba(25,8,0,.55)" strokeWidth="4" strokeLinecap="round">
          <path d="M26 34 L46 20" />
          <path d="M36 50 L68 26" />
          <path d="M58 54 L78 40" />
        </g>
      ) : (
        <g fill="rgba(255,255,255,.35)">
          <circle cx="34" cy="34" r="3" />
          <circle cx="58" cy="30" r="2.4" />
          <circle cx="66" cy="44" r="3" />
          <circle cx="44" cy="48" r="2" />
        </g>
      )}
    </svg>
  );
}

/** Fries in the basket, from pale to golden to burnt. */
export function FryerFries({
  phase,
  progress = 0,
  className,
}: {
  phase: SlotPhase | "raw";
  progress?: number;
  className?: string;
}) {
  const colour =
    phase === "burnt"
      ? "#241408"
      : phase === "over"
        ? "#8a4a0c"
        : phase === "ready"
          ? "#f4b822"
          : `rgb(${Math.round(244 - 0 * progress)},${Math.round(226 - 40 * progress)},${Math.round(165 - 130 * progress)})`;
  const sticks = [
    [14, 16, -18],
    [26, 8, -8],
    [38, 14, 5],
    [50, 6, -4],
    [62, 12, 9],
    [74, 8, 16],
    [32, 22, 14],
    [58, 22, -12],
  ];
  return (
    <svg viewBox="0 0 100 70" className={className} aria-hidden="true" focusable="false">
      {sticks.map(([x, y, turn]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width="9"
          height="44"
          rx="3"
          fill={colour}
          stroke="rgba(120,70,10,.5)"
          strokeWidth="1"
          transform={`rotate(${turn} ${x! + 4} ${y! + 22})`}
        />
      ))}
    </svg>
  );
}

/** A cup filling at the tap (level 0-1). */
export function Cup({
  drink,
  level = 1,
  className,
}: {
  drink: FoodId;
  level?: number;
  className?: string | undefined;
}) {
  const liquid = drink === "milkshake" ? "#f2849f" : "#6b2e12";
  const full = Math.max(0, Math.min(1, level));
  const top = 76 - 54 * full;
  return (
    <svg viewBox="0 0 64 84" className={className} aria-hidden="true" focusable="false">
      <rect x="35" y="2" width="6" height="34" rx="2" fill="#d8392f" transform="rotate(14 38 20)" />
      <path d="M12 20 H52 L47 78 H17 Z" fill="rgba(255,255,255,.55)" />
      {full > 0 ? (
        <path
          d={`M${12 + (5 * (top - 20)) / 58} ${top} H${52 - (5 * (top - 20)) / 58} L47 78 H17 Z`}
          fill={liquid}
        />
      ) : null}
      {full >= 1 ? (
        <ellipse
          cx="32"
          cy="22"
          rx="19"
          ry={drink === "milkshake" ? 8 : 3}
          fill={drink === "milkshake" ? "#fff3ee" : "#b8662c"}
        />
      ) : null}
      <path d="M12 20 H52 L47 78 H17 Z" fill="none" stroke="#8a5a34" strokeWidth="2.5" />
    </svg>
  );
}

/** A thing as it appears in an order bubble or on a tray: its painted picture, or the drawn cup. */
export function FoodPicture({ item, className }: { item: FoodId; className?: string }) {
  const picture = FOOD_PICTURES[item];
  return picture ? (
    <img src={festivalUrl(picture)} alt="" draggable={false} className={className} />
  ) : (
    <Cup drink={item} className={className} />
  );
}
