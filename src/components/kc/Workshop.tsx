import type { KnifeDefinition } from "@/game/knives/knifeTypes";

/**
 * Phase 15 — the old standalone Workshop screen (buy + equip in one
 * place) is gone; its purchase half moved into Shop.tsx, its equip half
 * into Rack.tsx, both reusing KnifeManager exactly as this file always
 * did. KnifeGlyph (the real per-knife SVG silhouette) stays here and is
 * imported by both — it's genuinely reusable visual code, not a screen.
 */

function toHex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

/** amt in [-1,1] — positive lightens toward white, negative darkens toward black. Used to build a two-stop gradient from each knife's single visual.bladeColor/handleColor instead of a shared fixed gradient every knife used to reuse regardless of its own color (the old `tone` prop only changed a gradient ID, never an actual color). */
function shade(n: number, amt: number): string {
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

/**
 * A real per-knife silhouette (Phase 8) — built from the SAME blade-shape
 * construction PreparationScene.drawKnife() uses (heel -> straight spine
 * -> curve to tip -> curve back along the edge -> heel), just rendered as
 * an SVG path instead of Phaser Graphics. Previously this glyph was a
 * single fixed path with a `tone` prop that only ever changed a gradient
 * id — every knife looked identical. Now length/height/heel/tip/belly
 * genuinely vary per knife, so a paring knife reads as short and thin, a
 * cleaver as short and tall, a bread knife as long and straight.
 */
export function KnifeGlyph({ knife, size = 120 }: { knife: KnifeDefinition; size?: number }) {
  const shape = knife.animation.blade;
  const visual = knife.visual;
  const LEN_SCALE = 402;
  const H_SCALE = 470;
  const CENTER_Y = 55;

  const bladeLen = shape.bladeLenFrac * LEN_SCALE;
  const bladeH = shape.bladeHFrac * H_SCALE;
  const edge = bladeH * 0.5;
  const heel = shape.heelAt * bladeLen;
  const tip = shape.tipFrac * bladeLen;
  const spineBend = shape.spineBendFrac * bladeLen;
  const spineControlX = shape.spineControlXFrac * bladeLen;
  const bellyControlX = shape.bellyControlXFrac * bladeLen;
  const handleLen = shape.handleLenFrac * LEN_SCALE;
  const handleLeft = heel - 7 - handleLen;

  const offsetX = 120 - (handleLeft + tip) / 2;
  const X = (x: number) => offsetX + x;
  const topY = CENTER_Y + (-bladeH * 0.5 - edge);
  const ctrl1Y = CENTER_Y + (-bladeH * 0.4 - edge);
  const tipY = CENTER_Y + (bladeH * shape.tipRiseFrac - edge);
  const ctrl2Y = CENTER_Y + (bladeH * shape.bellyFrac - edge);
  const bottomY = CENTER_Y + (bladeH * 0.5 - edge);

  const bladePath =
    `M ${X(heel)} ${topY} L ${X(spineBend)} ${topY} ` +
    `Q ${X(spineControlX)} ${ctrl1Y} ${X(tip)} ${tipY} ` +
    `Q ${X(bellyControlX)} ${ctrl2Y} ${X(heel)} ${bottomY} Z`;

  const gradId = `blade-${knife.id}`;
  const handleGradId = `handle-${knife.id}`;

  const teeth =
    shape.serrated &&
    Array.from({ length: 10 }, (_, i) => {
      const t0 = 0.1 + (i / 10) * 0.78;
      const t1 = 0.1 + ((i + 0.6) / 10) * 0.78;
      const x0 = X(heel + (tip - heel) * t0);
      const x1 = X(heel + (tip - heel) * t1);
      const xm = (x0 + x1) / 2;
      return `M ${x0} ${bottomY} L ${xm} ${bottomY + bladeH * 0.16} L ${x1} ${bottomY} Z`;
    }).join(" ");

  return (
    <svg width={size} height={size * 0.42} viewBox="0 0 240 100" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(visual.bladeColor, 0.5)} />
          <stop offset="55%" stopColor={toHex(visual.bladeColor)} />
          <stop offset="100%" stopColor={shade(visual.bladeColor, -0.3)} />
        </linearGradient>
        <linearGradient id={handleGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(visual.handleColor, 0.25)} />
          <stop offset="100%" stopColor={shade(visual.handleColor, -0.3)} />
        </linearGradient>
      </defs>

      <path
        d={bladePath}
        fill={`url(#${gradId})`}
        stroke={shade(visual.bladeColor, -0.4)}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {teeth ? <path d={teeth} fill={toHex(visual.bladeColor)} /> : null}
      <line
        x1={X(heel)}
        y1={bottomY - bladeH * 0.06}
        x2={X(tip) - 2}
        y2={tipY + bladeH * 0.08}
        stroke={toHex(visual.edgeHighlight)}
        strokeWidth="1.4"
        opacity="0.55"
      />
      {visual.pattern === "damascus"
        ? [0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M ${X(heel)} ${topY + bladeH * (0.2 + i * 0.25)} Q ${X(spineControlX)} ${topY + bladeH * (0.05 + i * 0.25)} ${X(tip) - 6} ${tipY + bladeH * 0.15}`}
              fill="none"
              stroke={i % 2 === 0 ? "#ffffff" : "#7c828a"}
              strokeWidth="0.8"
              opacity="0.25"
            />
          ))
        : null}

      <rect
        x={X(heel - 7)}
        y={topY}
        width="7"
        height={bladeH}
        rx="1.5"
        fill={toHex(visual.bolsterColor)}
      />
      <path
        d={`M ${X(handleLeft)} ${CENTER_Y - bladeH * 0.45} h ${handleLen} a 10 10 0 0 1 0 ${bladeH * 0.9} h -${handleLen} a 10 10 0 0 1 0 -${bladeH * 0.9} z`}
        fill={`url(#${handleGradId})`}
      />
      <circle
        cx={X(handleLeft + handleLen * 0.3)}
        cy={CENTER_Y - edge}
        r="3"
        fill={toHex(visual.rivetColor)}
        opacity="0.85"
      />
      <circle
        cx={X(handleLeft + handleLen * 0.7)}
        cy={CENTER_Y - edge}
        r="3"
        fill={toHex(visual.rivetColor)}
        opacity="0.85"
      />
    </svg>
  );
}
