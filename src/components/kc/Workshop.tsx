import type { KnifeDefinition } from "@/game/knives/knifeTypes";
import { knifeProfile, type Pt } from "@/game/scenes/knifeProfile";

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
 * A real per-knife picture for the Market and Progress — the SAME geometry
 * the game draws the knife from (scenes/knifeProfile.ts: blade outline,
 * cutting edge, spine, bolster, tapered handle, rivets), rendered as SVG
 * with gradients, scaled to fit. A paring knife reads as short and slim, a
 * cleaver as short and tall, a bread knife as long with a toothed edge.
 */
export function KnifeGlyph({ knife, size = 120 }: { knife: KnifeDefinition; size?: number }) {
  const shape = knife.animation.blade;
  const visual = knife.visual;
  const p = knifeProfile(shape, 540);
  const all = [...p.outline, ...p.handle, ...p.bolster];
  const minX = Math.min(...all.map((q) => q.x));
  const maxX = Math.max(...all.map((q) => q.x));
  const minY = Math.min(...all.map((q) => q.y));
  const maxY = Math.max(...all.map((q) => q.y));
  // Fit into the 240×100 view box with a margin, centred.
  const k = Math.min(224 / (maxX - minX), 84 / (maxY - minY));
  const ox = 120 - ((minX + maxX) / 2) * k;
  const oy = 50 - ((minY + maxY) / 2) * k;
  const pt = (q: Pt) => `${(ox + q.x * k).toFixed(1)} ${(oy + q.y * k).toFixed(1)}`;
  const path = (pts: Pt[], close = true) => `M ${pts.map(pt).join(" L ")}${close ? " Z" : ""}`;
  const H = p.bladeH;
  const bevel = [
    ...p.cuttingEdge,
    ...p.cuttingEdge
      .slice()
      .reverse()
      .map((q, i, arr) => ({
        x: q.x,
        y: q.y - H * 0.3 * Math.min(1, (1 - i / (arr.length - 1)) * 1.6),
      })),
  ];
  const sx = p.heel + (p.tip - p.heel) * 0.42;
  const sheen = [
    { x: sx, y: -H * 0.96 },
    { x: sx + H * 0.34, y: -H * 0.96 },
    { x: sx + H * 0.06, y: -H * 0.06 },
    { x: sx - H * 0.28, y: -H * 0.06 },
  ];
  const teeth = shape.serrated
    ? Array.from({ length: 14 }, (_, i) => {
        const x0 = p.heel + (p.tip - p.heel) * (0.06 + (i / 14) * 0.82);
        const x1 = p.heel + (p.tip - p.heel) * (0.06 + ((i + 0.6) / 14) * 0.82);
        return path([
          { x: x0, y: 0 },
          { x: (x0 + x1) / 2, y: H * 0.13 },
          { x: x1, y: 0 },
        ]);
      }).join(" ")
    : null;

  const gradId = `blade-${knife.id}`;
  const handleGradId = `handle-${knife.id}`;

  return (
    <svg width={size} height={size * 0.42} viewBox="0 0 240 100" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(visual.bladeColor, 0.45)} />
          <stop offset="55%" stopColor={toHex(visual.bladeColor)} />
          <stop offset="100%" stopColor={shade(visual.bladeColor, -0.25)} />
        </linearGradient>
        <linearGradient id={handleGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(visual.handleColor, 0.3)} />
          <stop offset="55%" stopColor={toHex(visual.handleColor)} />
          <stop offset="100%" stopColor={shade(visual.handleColor, -0.35)} />
        </linearGradient>
      </defs>
      <path
        d={path(p.handle)}
        fill={`url(#${handleGradId})`}
        stroke={shade(visual.handleColor, -0.5)}
        strokeWidth="1"
      />
      {p.rivets.map((r, i) => (
        <circle
          key={i}
          cx={ox + r.x * k}
          cy={oy + r.y * k}
          r={Math.max(1.6, p.rivetR * k)}
          fill={toHex(visual.rivetColor)}
          stroke={shade(visual.rivetColor, -0.4)}
          strokeWidth="0.6"
        />
      ))}
      <path
        d={path(p.outline)}
        fill={`url(#${gradId})`}
        stroke={shade(visual.bladeColor, -0.45)}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d={path(bevel)} fill={shade(visual.bladeColor, -0.14)} opacity="0.9" />
      <path d={path(sheen)} fill="#ffffff" opacity="0.18" />
      {visual.pattern === "damascus"
        ? [0, 1, 2, 3].map((i) => {
            const y = -H * (0.28 + i * 0.16);
            return (
              <path
                key={i}
                d={path(
                  [
                    { x: p.heel + 4, y },
                    { x: (p.heel + p.tip) / 2, y: y + H * 0.1 * (i % 2 ? -1 : 1) },
                    { x: p.tip * 0.9, y: y * 0.5 },
                  ],
                  false,
                )}
                fill="none"
                stroke={i % 2 === 0 ? "#ffffff" : "#7c828a"}
                strokeWidth="0.8"
                opacity="0.3"
              />
            );
          })
        : null}
      {teeth ? <path d={teeth} fill={shade(visual.bladeColor, -0.1)} /> : null}
      <path
        d={path(p.cuttingEdge, false)}
        fill="none"
        stroke={toHex(visual.edgeHighlight)}
        strokeWidth="1.3"
      />
      <path
        d={path(p.bolster)}
        fill={toHex(visual.bolsterColor)}
        stroke={shade(visual.bolsterColor, -0.45)}
        strokeWidth="0.8"
      />
    </svg>
  );
}
