/**
 * THE TEMPORARY FOOD ART (foodLooks.ts): flat, softly lit shapes for every food the Codex kit has not painted yet. One drawing of a piece is used
 * everywhere (the pan, the plate, the order bubble, the cooker, the basket), so what an order shows is what stands on the counter. Plain SVG:
 * no pictures are fetched.
 */
import type { SlotPhase } from "@/game/festival/types";
import type { Look } from "./foodLooks";
import { INK, SHINE, mix, piece } from "./foodShapes";
import { isBaseShape } from "./layerSizes";

const drawn = (
  look: Look,
  color = look.color,
  accent = look.accent ?? mix(look.color, "#000000", 0.28),
) => piece(look.shape, color, accent);

/**
 * One layer of a drawn plate, centred on `y` in the 400-wide square: a base spreads the whole width, what goes on it lies a little inside, and
 * a sauce is a zigzag poured over (never its bottle).
 */
export function DrawnLayer({ look, y }: { look: Look; y: number }) {
  if (look.shape === "bottle")
    return (
      <path
        d={`M84 ${y + 6} q24 -46 48 -4 t48 -2 t48 -4 t48 2 t40 -10`}
        fill="none"
        stroke={look.color}
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 3px 2px rgba(60, 26, 4, 0.6))" }}
      />
    );
  const k = isBaseShape(look.shape) ? 3.9 : 3.0;
  return <g transform={`translate(${200 - 50 * k} ${y - 32 * k}) scale(${k})`}>{drawn(look)}</g>;
}

/** One piece on its own: an order's little picture, a side or a drink, a sauce bottle. */
export function DrawnChip({ look, className }: { look: Look; className?: string | undefined }) {
  return (
    <svg viewBox="0 0 100 60" className={className} aria-hidden="true" focusable="false">
      {drawn(look)}
    </svg>
  );
}

/** A metal pan with the food in it, in the shape of the painted pans (200 x 133). A sauce is its bottle, as the painted sauces are. */
export function DrawnPan({ look, className }: { look: Look; className?: string | undefined }) {
  if (look.shape === "bottle" || look.shape === "cup")
    return <DrawnChip look={look} className={className} />;
  const whole = ["flat", "slice", "plate", "bowl", "board", "disc", "crepe"].includes(look.shape);
  return (
    <svg
      viewBox="0 0 200 133"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M14 8 H186 Q196 8 197 18 L199 112 Q199 126 185 126 H15 Q1 126 1 112 L3 18 Q4 8 14 8 Z"
        fill="#c9ced3"
        stroke="#6d747b"
        strokeWidth="2.5"
      />
      <path
        d="M20 17 H180 Q188 17 189 25 L190 106 Q190 115 180 115 H20 Q10 115 10 106 L11 25 Q12 17 20 17 Z"
        fill="#8f969d"
      />
      <path d="M22 20 H178" stroke="#eef1f4" strokeWidth="3" strokeLinecap="round" />
      {(whole
        ? [
            [18, 30, 0.86],
            [96, 30, 0.86],
            [57, 52, 0.86],
          ]
        : [
            [12, 18, 0.98],
            [92, 18, 0.98],
            [12, 56, 0.98],
            [92, 56, 0.98],
          ]
      ).map(([x, y, k]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${k})`}>
          {drawn(look)}
        </g>
      ))}
    </svg>
  );
}

/** The cooking colours: raw turning to cooked, darker once overcooked, charred once burnt. */
function cookedColors(look: Look, phase: SlotPhase, progress: number) {
  const cooked = look.color;
  const raw = look.raw ?? mix(look.color, "#f2d9c8", 0.55);
  const color =
    phase === "burnt"
      ? "#2e1c12"
      : phase === "cooking"
        ? mix(raw, cooked, (progress - 0.15) / 0.8)
        : phase === "over"
          ? mix(cooked, "#3a1c0a", 0.4)
          : cooked;
  const accent = phase === "burnt" ? "#140a05" : mix(color, "#000000", 0.3);
  return { color, accent };
}

/** A main cooking on the hot station. */
export function DrawnMeat({
  look,
  phase,
  progress,
  className,
}: {
  look: Look;
  phase: SlotPhase;
  progress: number;
  className: string;
}) {
  const { color, accent } = cookedColors(look, phase, progress);
  return (
    <span aria-hidden="true" className={`fest-art ${className}`}>
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" focusable="false">
        {drawn(look, color, accent)}
      </svg>
    </span>
  );
}

/** A side in its wire basket, from raw to golden to burnt. */
export function DrawnBasket({
  look,
  phase,
  progress,
  className,
}: {
  look: Look;
  phase: SlotPhase;
  progress: number;
  className: string;
}) {
  const { color, accent } = cookedColors(look, phase, progress);
  return (
    <span aria-hidden="true" className={`fest-art ${className}`}>
      <svg viewBox="0 0 100 124" preserveAspectRatio="xMidYMid meet" focusable="false">
        <path d="M44 4 h12 v28 h-12 Z" fill="#d83a22" stroke={INK} strokeWidth="1.6" />
        <path
          d="M8 44 H92 L84 112 Q50 122 16 112 Z"
          fill="rgba(60,40,20,0.35)"
          stroke="#d9dde2"
          strokeWidth="4"
        />
        {[62, 80].map((y, i) => (
          <g key={y} transform={`translate(${i ? 6 : 0} ${y - 24})`}>
            {drawn(look, color, accent)}
          </g>
        ))}
        <path
          d="M12 72 H88 M15 94 H85 M30 46 L33 115 M50 46 V117 M70 46 L67 115"
          stroke="#eef1f4"
          strokeWidth="1.6"
          opacity="0.75"
        />
        <ellipse cx="50" cy="44" rx="43" ry="8" fill="none" stroke="#eef1f4" strokeWidth="4" />
      </svg>
    </span>
  );
}

/** What a pot, a wok or a pan looks like on its ring, under the food (the grill's own rings need nothing). */
export function Cookware({ kind }: { kind: "pot" | "wok" | "pan" | "tawa" }) {
  const body =
    kind === "pot"
      ? "#b9c1c9"
      : kind === "wok"
        ? "#3d3f45"
        : kind === "tawa"
          ? "#2c2a2a"
          : "#4a4440";
  return (
    <svg
      viewBox="0 0 100 70"
      preserveAspectRatio="none"
      className="fest-cookware"
      aria-hidden="true"
      focusable="false"
    >
      {kind === "pot" ? (
        <path d="M2 34 h10 M88 34 h10" stroke="#6d747b" strokeWidth="7" strokeLinecap="round" />
      ) : (
        <path d="M86 40 L100 30" stroke="#2a1a10" strokeWidth="7" strokeLinecap="round" />
      )}
      <ellipse
        cx="50"
        cy="44"
        rx="42"
        ry={kind === "tawa" ? 18 : 24}
        fill={body}
        stroke={INK}
        strokeWidth="2"
      />
      <ellipse
        cx="50"
        cy="40"
        rx="37"
        ry={kind === "tawa" ? 15 : 19}
        fill={kind === "pot" ? "#7fb4cf" : "rgba(255,255,255,0.08)"}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/** A brick oven over the cooker's box: its mouth covers the four places. */
export function Oven() {
  return (
    <svg
      viewBox="0 0 100 76"
      preserveAspectRatio="none"
      className="fest-ovenart"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 74 V26 Q6 2 50 2 Q94 2 97 26 V74 Z"
        fill="#a8481f"
        stroke="#5a230c"
        strokeWidth="1.4"
      />
      <g stroke="#e8b48a" strokeWidth="0.7" opacity="0.8">
        <path d="M6 20 H94 M4 32 H10 M90 32 H96 M4 46 H8 M92 46 H96 M4 60 H8 M92 60 H96" />
        <path d="M24 9 V20 M50 3 V12 M76 9 V20 M37 12 V20 M63 12 V20" />
      </g>
      <path
        d="M9 70 V32 Q14 15 50 15 Q86 15 91 32 V70 Z"
        fill="#241008"
        stroke="#ffb347"
        strokeWidth="1.2"
      />
      <ellipse cx="50" cy="68" rx="38" ry="5" fill="#ff7a1c" opacity="0.35" />
      <path d="M9 43 H91" stroke="#6d5a4c" strokeWidth="1.2" />
      <rect x="1" y="70" width="98" height="5" rx="2" fill="#7a3416" />
    </svg>
  );
}
