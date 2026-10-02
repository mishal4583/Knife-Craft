/**
 * The knife in its own local space — the ONE geometry and painter the real
 * knife (PreparationScene.drawKnife) and the coaching ghost (coachGhost.ts)
 * are both drawn from. Local x runs heel → tip; local y = 0 is the cutting
 * edge (what rides the seam), the blade body is above it (negative y), and
 * the bolster and handle sit behind the heel (x < heel), the handle's top in
 * line with the spine the way a real knife is made.
 */
import type Phaser from "phaser";
import type { KnifeBladeShape, KnifeVisual } from "../knives/knifeTypes";

export type Pt = { x: number; y: number };

/** A short quadratic-bezier polyline — Phaser Graphics has no native curveTo, so curves are sampled. */
export function quadraticPoints(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  steps: number,
): Pt[] {
  const pts: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
      y: mt * mt * y0 + 2 * mt * t * cy + t * t * y1,
    });
  }
  return pts;
}

export type KnifeProfile = {
  bladeLen: number;
  bladeH: number;
  handleLen: number;
  heel: number;
  spineBend: number;
  tip: number;
  /** Half the blade height: the shift that puts the cutting edge on local y = 0. */
  edge: number;
  /** Closed blade outline: heel → straight spine → curve to the tip → curved edge back to the heel. */
  outline: Pt[];
  /** The cutting edge alone, heel → tip. */
  cuttingEdge: Pt[];
  /** The spine alone, heel → tip. */
  spine: Pt[];
  /** Closed outlines of the metal bolster and the handle. */
  bolster: Pt[];
  handle: Pt[];
  /** Rivet centres along the handle. */
  rivets: Pt[];
  rivetR: number;
};

/** `width` = the scene width the blade fractions are measured against. */
export function knifeProfile(shape: KnifeBladeShape, width: number): KnifeProfile {
  const bladeLen = shape.bladeLenFrac * width;
  const bladeH = shape.bladeHFrac * width;
  const handleLen = shape.handleLenFrac * width;
  const heel = shape.heelAt * bladeLen;
  const spineBend = shape.spineBendFrac * bladeLen;
  const spineControlX = shape.spineControlXFrac * bladeLen;
  const tip = shape.tipFrac * bladeLen;
  const bellyControlX = shape.bellyControlXFrac * bladeLen;
  const edge = bladeH * 0.5;
  const top = -bladeH * 0.5 - edge; // = -bladeH: the spine line
  const tipY = bladeH * shape.tipRiseFrac - edge;
  const spineCurve = quadraticPoints(
    spineBend,
    top + bladeH * 0.1,
    spineControlX,
    top + bladeH * 0.1,
    tip,
    tipY,
    8,
  );
  const belly = quadraticPoints(
    tip,
    tipY,
    bellyControlX,
    bladeH * shape.bellyFrac - edge,
    heel,
    bladeH * 0.5 - edge,
    10,
  );

  // Bolster: a short metal block at the heel, as tall as the spine-side
  // part of the blade where the handle meets it.
  const handleH = Math.min(Math.max(bladeH * 0.56, width * 0.026), width * 0.05);
  const bolsterW = Math.max(5, handleLen * 0.07);
  const neckTop = top + bladeH * 0.04;
  const neckBottom = Math.min(neckTop + handleH * 1.08, -bladeH * 0.12);
  const bolster: Pt[] = [
    { x: heel + 1, y: top },
    { x: heel + 1, y: Math.min(neckBottom + bladeH * 0.12, -1) },
    { x: heel - bolsterW, y: neckBottom },
    { x: heel - bolsterW, y: neckTop },
  ];

  // Handle: narrow at the neck, a palm swell, a rounded butt.
  const hx0 = heel - bolsterW;
  const hx1 = hx0 - handleLen;
  const cy = neckTop + handleH * 0.5;
  const half = (t: number) =>
    handleH * 0.5 * (0.86 + 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
  const N = 14;
  const topPts: Pt[] = [];
  const botPts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = hx0 + (hx1 - hx0) * t * 0.94;
    // The top stays nearly in line with the spine; the swell is mostly underneath.
    topPts.push({ x, y: cy - half(t) * 0.92 });
    botPts.push({ x, y: cy + half(t) * 1.08 });
  }
  const buttR = half(1);
  const butt: Pt[] = [];
  const bx = hx0 + (hx1 - hx0) * 0.94;
  for (let i = 1; i < 8; i++) {
    const a = -Math.PI / 2 - (Math.PI * i) / 8;
    butt.push({ x: bx + Math.cos(a) * buttR * 0.9, y: cy + Math.sin(a) * buttR });
  }
  const handle = [...topPts, ...butt, ...botPts.reverse()];
  const rivets = [0.26, 0.52, 0.78].map((t) => ({ x: hx0 + (hx1 - hx0) * t, y: cy }));

  return {
    bladeLen,
    bladeH,
    handleLen,
    heel,
    spineBend,
    tip,
    edge,
    outline: [{ x: heel, y: top }, { x: spineBend, y: top }, ...spineCurve, ...belly],
    cuttingEdge: [{ x: tip, y: tipY }, ...belly].reverse(),
    spine: [{ x: heel, y: top }, { x: spineBend, y: top }, ...spineCurve],
    bolster,
    handle,
    rivets,
    rivetR: Math.max(1.4, handleH * 0.11),
  };
}

/** `c` lightened (amount > 0, toward white) or darkened (amount < 0, toward black). */
export function shade(c: number, amount: number): number {
  const ch = (v: number) =>
    Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount)) & 255;
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}

/**
 * Paints the knife in `g`'s local space (the caller positions/rotates the
 * Graphics). `shadow` = the world-space drop-shadow offset already turned
 * into local space, or null for none.
 */
export function paintKnife(
  g: Phaser.GameObjects.Graphics,
  p: KnifeProfile,
  shape: KnifeBladeShape,
  visual: KnifeVisual,
  shadow: Pt | null,
): void {
  const H = p.bladeH;
  const move = (pts: Pt[], d: Pt) => pts.map((q) => ({ x: q.x + d.x, y: q.y + d.y }));

  // Soft shadow on the board.
  if (shadow) {
    for (const [k, a] of [
      [1, 0.1],
      [0.6, 0.12],
    ] as const) {
      const d = { x: shadow.x * k, y: shadow.y * k };
      g.fillStyle(0x2a1a0e, a);
      g.fillPoints(move(p.handle, d), true);
      g.fillPoints(move(p.outline, d), true);
    }
  }

  // Handle — wood, darker underside, a highlight along the top, grain.
  g.fillStyle(shade(visual.handleColor, -0.18), 1);
  g.fillPoints(p.handle, true);
  const hTop = p.handle.slice(0, 15);
  const hMid = hTop.map((q, i) => ({
    x: q.x,
    y: (q.y + p.handle[p.handle.length - 1 - i]!.y) / 2,
  }));
  g.fillStyle(visual.handleColor, 1);
  g.fillPoints([...hTop, ...hMid.slice().reverse()], true);
  g.lineStyle(Math.max(1, H * 0.05), shade(visual.handleColor, 0.35), 0.75);
  g.strokePoints(move(hTop.slice(1, -2), { x: 0, y: H * 0.05 }), false);
  g.lineStyle(1, shade(visual.handleColor, -0.3), 0.35);
  for (const f of [0.38, 0.62]) {
    g.strokePoints(
      hTop.slice(2, -3).map((q, i) => ({
        x: q.x,
        y: q.y + (hMid[i + 2]!.y - q.y) * 2 * f + Math.sin(i * 0.9 + f * 7) * 0.6,
      })),
      false,
    );
  }
  g.lineStyle(1, shade(visual.handleColor, -0.5), 0.8);
  g.strokePoints(p.handle, true);
  for (const r of p.rivets) {
    g.fillStyle(shade(visual.rivetColor, -0.35), 1);
    g.fillCircle(r.x, r.y, p.rivetR + 0.6);
    g.fillStyle(visual.rivetColor, 1);
    g.fillCircle(r.x, r.y, p.rivetR);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(r.x - p.rivetR * 0.35, r.y - p.rivetR * 0.35, p.rivetR * 0.35);
  }

  // Blade — steel, a darker grind bevel along the edge, a sheen, a bright
  // honed edge and a crisp spine.
  g.fillStyle(visual.bladeColor, 1);
  g.fillPoints(p.outline, true);
  const bevelH = H * 0.3;
  const bevel = [
    ...p.cuttingEdge,
    ...p.cuttingEdge
      .slice()
      .reverse()
      .map((q, i, arr) => {
        // The bevel narrows to nothing at the tip.
        const k = 1 - i / (arr.length - 1);
        return { x: q.x, y: q.y - bevelH * Math.min(1, k * 1.6) };
      }),
  ];
  g.fillStyle(shade(visual.bladeColor, -0.14), 1);
  g.fillPoints(bevel, true);
  // Upper flat catches the light.
  g.fillStyle(0xffffff, 0.16);
  g.fillPoints(
    [
      ...p.spine.slice(0, -2),
      ...p.spine
        .slice(0, -2)
        .reverse()
        .map((q) => ({ x: q.x, y: q.y + H * 0.22 })),
    ],
    true,
  );
  // A diagonal sheen across the blade.
  const sx = p.heel + (p.tip - p.heel) * 0.42;
  g.fillStyle(0xffffff, 0.14);
  g.fillPoints(
    [
      { x: sx, y: -H * 0.96 },
      { x: sx + H * 0.34, y: -H * 0.96 },
      { x: sx + H * 0.06, y: -H * 0.06 },
      { x: sx - H * 0.28, y: -H * 0.06 },
    ],
    true,
  );

  if (visual.pattern === "damascus") {
    for (let i = 0; i < 5; i++) {
      const y = -H * (0.25 + i * 0.14);
      const pts = quadraticPoints(
        p.heel + 4,
        y,
        (p.heel + p.tip) / 2,
        y + H * 0.12 * (i % 2 === 0 ? 1 : -1),
        p.tip * 0.9,
        y * 0.5,
        10,
      );
      g.lineStyle(1, i % 2 === 0 ? 0xffffff : 0x6f767e, 0.18);
      g.strokePoints([{ x: p.heel + 4, y }, ...pts], false);
    }
  }

  if (shape.serrated) {
    const teeth = 14;
    const toothH = H * 0.13;
    g.fillStyle(shade(visual.bladeColor, -0.1), 1);
    for (let i = 0; i < teeth; i++) {
      const t0 = 0.06 + (i / teeth) * 0.82;
      const t1 = 0.06 + ((i + 0.6) / teeth) * 0.82;
      const x0 = p.heel + (p.tip - p.heel) * t0;
      const x1 = p.heel + (p.tip - p.heel) * t1;
      g.fillTriangle(x0, 0, (x0 + x1) / 2, toothH, x1, 0);
    }
  }

  // The honed edge and the spine.
  g.lineStyle(1.6, visual.edgeHighlight, 0.95);
  g.strokePoints(p.cuttingEdge, false);
  g.lineStyle(1.2, shade(visual.bladeColor, 0.45), 0.9);
  g.strokePoints(move(p.spine, { x: 0, y: 1 }), false);
  g.lineStyle(1, shade(visual.bladeColor, -0.45), 0.85);
  g.strokePoints(p.outline, true);

  // Bolster — polished metal.
  g.fillStyle(visual.bolsterColor, 1);
  g.fillPoints(p.bolster, true);
  g.fillStyle(0xffffff, 0.35);
  g.fillPoints(
    [
      p.bolster[0]!,
      { x: p.bolster[0]!.x, y: p.bolster[0]!.y + H * 0.18 },
      { x: p.bolster[3]!.x, y: p.bolster[3]!.y + H * 0.14 },
      p.bolster[3]!,
    ],
    true,
  );
  g.lineStyle(1, shade(visual.bolsterColor, -0.45), 0.9);
  g.strokePoints(p.bolster, true);
}
