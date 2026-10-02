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

/**
 * How a cook holds the knife over the board, seen from above: tip up and to
 * the right, handle toward the player's lower left (the "/" of a chef's
 * slicing grip). Every cut leans the knife toward this angle.
 */
const HAND_DEG = -40;
/** How far the knife may lean off a flat cut line (it mostly lies along it) and off a steep one. */
const FLAT_LEAN_MAX_DEG = 14;
const STEEP_LEAN_MIN_DEG = 30;
const STEEP_LEAN_MAX_DEG = 45;
/** Never turned so far that the sharp edge stops facing down the screen, toward the food. */
const EDGE_DOWN_LIMIT_DEG = -80;
/** The rock: at the top of a stroke the tip is raised this much about the handle-end pivot. */
export const STROKE_ROCK_DEG = 14;

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * The knife's rotation (radians) at the moment its edge goes through a cut
 * line at `lineAngleDeg`. The knife's local origin — the pivot every pose
 * turns about — is the heel of the edge beside the bolster, so it turns
 * around the handle end, never the blade's middle.
 *
 * - A flat cut (within 45° of horizontal): the blade lies nearly along the
 *   line, tip right, leaning up to 14° toward the hand angle.
 * - A steep cut (a vertical slice through a loaf): the blade crosses the
 *   line diagonally, 30°–45° off it (45° for a vertical cut). The handle
 *   is at the lower left and the tip is up and to the right, like the knife
 *   in a real slicing grip. It is never upright along the line, and never
 *   flat across it.
 *
 * The sharp edge (local +y) always faces down the screen, into the food.
 */
export function cutContactRot(lineAngleDeg: number): number {
  let a = ((lineAngleDeg % 180) + 180) % 180;
  if (a > 90) a -= 180; // (-90, 90]
  const steep = Math.abs(a) > 45;
  // The line's direction with the tip right (flat) or up (steep).
  const dir = steep ? (a <= 0 ? a : a - 180) : a;
  // A steep line always lies clockwise of the hand angle, so it leans
  // clockwise, at least 30°, so it is never nearly along the cut.
  const lean = steep
    ? Math.max(STEEP_LEAN_MIN_DEG, Math.min(STEEP_LEAN_MAX_DEG, HAND_DEG - dir))
    : Math.max(-FLAT_LEAN_MAX_DEG, Math.min(FLAT_LEAN_MAX_DEG, HAND_DEG - dir));
  return rad(Math.max(EDGE_DOWN_LIMIT_DEG, dir + lean));
}

/** Where the knife is drawn: its pivot (local origin, the heel of the edge) and rotation. */
export type KnifePose = { x: number; y: number; rot: number };

/**
 * One slicing stroke, at progress `k` (0 = poised above the food, 1 = the
 * edge through the cut; a little over 1 is the follow-through). This is
 * the motion of the tap cut (PreparationScene.runTapCut) and the coaching
 * ghost's TAP demonstration:
 *
 * - The cutting point of the edge travels from `from` (above the food) to
 *   `to` (on the cut line, just past it), so the sharp edge is what meets
 *   the ingredient.
 * - The knife rocks about the handle-end pivot: it starts with the tip
 *   raised STROKE_ROCK_DEG and comes down to `contactRot` (cutContactRot).
 * - At the same time it slides forward along its own length, a little under
 *   a quarter of the blade, so the cutting point moves from near the
 *   middle toward the heel. That is a slice, not a stab or a press.
 */
export function cutStrokePose(
  from: Pt,
  to: Pt,
  contactRot: number,
  tip: number,
  k: number,
): KnifePose {
  const rot = Math.max(rad(-85), contactRot - rad(STROKE_ROCK_DEG) * (1 - k));
  const along = tip * (0.62 - 0.22 * k);
  const cx = from.x + (to.x - from.x) * k;
  const cy = from.y + (to.y - from.y) * k;
  return { x: cx - Math.cos(rot) * along, y: cy - Math.sin(rot) * along, rot };
}

/** Where along the edge (px from the pivot) a swipe's knife meets the finger on a steep stroke. */
export function swipeContactAlong(tip: number): number {
  return tip * 0.5;
}

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
  // Spine: straight from the heel, then one smooth curve (horizontal where it
  // leaves the straight part — no step) down to the point.
  const spineCurve = quadraticPoints(spineBend, top, spineControlX, top, tip, tipY, 12);
  // Edge: flat from the heel to where the belly begins, then one smooth sweep
  // up to the point (again no kink where it starts).
  const bellyStart = Math.max(heel + (tip - heel) * 0.3, bellyControlX);
  const bellyPts = quadraticPoints(
    bellyStart,
    0,
    bellyStart + (tip - bellyStart) * 0.6,
    0,
    tip,
    tipY,
    16,
  );
  // The outline runs heel → spine → tip → back along the edge to the heel.
  const edgeToTip: Pt[] = [{ x: heel, y: 0 }, { x: bellyStart, y: 0 }, ...bellyPts];
  const belly = edgeToTip.slice(0, -1).reverse();

  // Bolster: a short metal block at the heel, as tall as the spine-side
  // part of the blade where the handle meets it.
  const handleH = Math.min(Math.max(bladeH * 0.56, width * 0.026), width * 0.05);
  const bolsterW = Math.max(5, handleLen * 0.07);
  const neckTop = top + bladeH * 0.04;
  const neckBottom = Math.min(neckTop + handleH * 1.08, -bladeH * 0.12);
  // A full bolster: the whole heel height, with a small finger guard just
  // below the edge, tapering back to the handle's neck.
  const bolster: Pt[] = [
    { x: heel + 1, y: top },
    { x: heel + 1 + bladeH * 0.06, y: top + bladeH * 0.5 },
    { x: heel + 1, y: bladeH * 0.06 },
    { x: heel - bolsterW * 0.4, y: bladeH * 0.08 },
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
    cuttingEdge: edgeToTip,
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
 * A thin band along a polyline, as a filled polygon: Phaser's WebGL stroke
 * breaks lines this thin into dots, a fill doesn't. `w` = band width (px),
 * laid on the side given by `side` (-1 = towards negative y).
 */
function band(pts: Pt[], w: number, side: 1 | -1): Pt[] {
  const shifted = pts.map((q, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    // Normal pointing to `side` in y.
    let nx = -(b.y - a.y) / len;
    let ny = (b.x - a.x) / len;
    if (ny * side < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { x: q.x + nx * w, y: q.y + ny * w };
  });
  return [...pts, ...shifted.reverse()];
}

/** Fills `pts` as an outline: the shape in `dark` grown by `w` px in every direction (no stroke). */
function outlineFill(
  g: Phaser.GameObjects.Graphics,
  pts: Pt[],
  w: number,
  dark: number,
  alpha: number,
) {
  g.fillStyle(dark, alpha);
  for (const [dx, dy] of [
    [w, 0],
    [-w, 0],
    [0, w],
    [0, -w],
  ] as const) {
    g.fillPoints(
      pts.map((q) => ({ x: q.x + dx, y: q.y + dy })),
      true,
    );
  }
}

/**
 * Paints the knife in `g`'s local space (the caller positions/rotates the
 * Graphics). `shadow` = the world-space drop-shadow offset already turned
 * into local space, or null for none. Only fills — no thin strokes.
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
  const line = Math.max(0.8, H * 0.03);

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
  outlineFill(g, p.handle, line, shade(visual.handleColor, -0.55), 0.9);
  g.fillStyle(shade(visual.handleColor, -0.18), 1);
  g.fillPoints(p.handle, true);
  const hTop = p.handle.slice(0, 15);
  const hMid = hTop.map((q, i) => ({
    x: q.x,
    y: (q.y + p.handle[p.handle.length - 1 - i]!.y) / 2,
  }));
  g.fillStyle(visual.handleColor, 1);
  g.fillPoints([...hTop, ...hMid.slice().reverse()], true);
  g.fillStyle(shade(visual.handleColor, 0.35), 0.6);
  g.fillPoints(band(move(hTop.slice(1, -2), { x: 0, y: H * 0.04 }), H * 0.05, 1), true);
  for (const f of [0.4, 0.66]) {
    g.fillStyle(shade(visual.handleColor, -0.32), 0.35);
    g.fillPoints(
      band(
        hTop.slice(2, -3).map((q, i) => ({
          x: q.x,
          y: q.y + (hMid[i + 2]!.y - q.y) * 2 * f + Math.sin(i * 0.9 + f * 7) * 0.5,
        })),
        Math.max(0.6, H * 0.02),
        1,
      ),
      true,
    );
  }
  for (const r of p.rivets) {
    g.fillStyle(shade(visual.rivetColor, -0.35), 1);
    g.fillCircle(r.x, r.y, p.rivetR + 0.6);
    g.fillStyle(visual.rivetColor, 1);
    g.fillCircle(r.x, r.y, p.rivetR);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(r.x - p.rivetR * 0.35, r.y - p.rivetR * 0.35, p.rivetR * 0.35);
  }

  // Blade — steel, a darker grind bevel along the edge, a sheen, a bright
  // honed edge and a lit spine.
  outlineFill(g, p.outline, line, shade(visual.bladeColor, -0.5), 0.9);
  g.fillStyle(visual.bladeColor, 1);
  g.fillPoints(p.outline, true);
  // Grind bevel: a band above the edge, narrowing to nothing at the point.
  const edgePts = p.cuttingEdge;
  const bevelTop = edgePts.map((q, i) => {
    const k = 1 - i / (edgePts.length - 1); // 1 at the heel → 0 at the point
    return { x: q.x, y: q.y - H * 0.3 * Math.min(1, k * 1.8) };
  });
  g.fillStyle(shade(visual.bladeColor, -0.13), 1);
  g.fillPoints([...edgePts, ...bevelTop.slice().reverse()], true);
  // The lit spine flat — along the straight part of the spine only.
  const sp0 = p.spine[0]!;
  const sp1 = p.spine[1]!;
  g.fillStyle(0xffffff, 0.2);
  g.fillRect(sp0.x + 1, sp0.y + line, sp1.x - sp0.x - 2, H * 0.16);
  // A diagonal sheen across the blade, inside the straight part.
  const sx = p.heel + (p.spineBend - p.heel) * 0.6;
  g.fillStyle(0xffffff, 0.13);
  g.fillPoints(
    [
      { x: sx, y: -H * 0.94 },
      { x: sx + H * 0.32, y: -H * 0.94 },
      { x: sx + H * 0.06, y: -H * 0.32 },
      { x: sx - H * 0.26, y: -H * 0.32 },
    ],
    true,
  );

  if (visual.pattern === "damascus") {
    for (let i = 0; i < 5; i++) {
      const y = -H * (0.38 + i * 0.11);
      const pts = quadraticPoints(
        p.heel + 4,
        y,
        (p.heel + p.spineBend) / 2,
        y + H * 0.06 * (i % 2 === 0 ? 1 : -1),
        p.spineBend,
        y,
        10,
      );
      g.fillStyle(i % 2 === 0 ? 0xffffff : 0x6f767e, 0.2);
      g.fillPoints(band([{ x: p.heel + 4, y }, ...pts], Math.max(0.7, H * 0.025), 1), true);
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

  // The honed edge: a bright line just inside the edge.
  g.fillStyle(visual.edgeHighlight, 0.9);
  g.fillPoints(band(edgePts, Math.max(1, H * 0.045), -1), true);

  // Bolster — polished metal, with a highlight on its upper half.
  outlineFill(g, p.bolster, line, shade(visual.bolsterColor, -0.5), 0.9);
  g.fillStyle(visual.bolsterColor, 1);
  g.fillPoints(p.bolster, true);
  const b = p.bolster;
  g.fillStyle(0xffffff, 0.35);
  g.fillPoints([b[0]!, b[1]!, { x: b[4]!.x, y: (b[4]!.y + b[5]!.y) / 2 }, b[5]!], true);
}
