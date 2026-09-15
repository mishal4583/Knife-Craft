/**
 * Reusable geometry primitives. Every primitive returns a closed polygon in
 * unit space so the cutter can treat all ingredients identically.
 */
import type { Poly, Vec } from "./types";
import { lerp } from "./rng";

export const v = (x: number, y: number): Vec => ({ x, y });

export function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot = 0,
  segments = 48,
): Poly {
  const out: Poly = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push({
      x: cx + x * Math.cos(rot) - y * Math.sin(rot),
      y: cy + x * Math.sin(rot) + y * Math.cos(rot),
    });
  }
  return out;
}

/** Slightly lumpy oval — organic bodies (lemon, potato, floret). */
export function irregularOval(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rnd: () => number,
  wobble = 0.08,
  lobes = 5,
  rot = 0,
  segments = 56,
): Poly {
  const phases: number[] = [];
  const amps: number[] = [];
  for (let i = 0; i < 3; i++) {
    phases.push(rnd() * Math.PI * 2);
    amps.push(wobble * (1 - i * 0.3) * (0.6 + rnd() * 0.6));
  }
  const out: Poly = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    let k = 1;
    for (let h = 0; h < 3; h++) {
      k += Math.sin(a * (lobes + h * 2) + phases[h]!) * amps[h]!;
    }
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    out.push({
      x: cx + x * Math.cos(rot) - y * Math.sin(rot),
      y: cy + x * Math.sin(rot) + y * Math.cos(rot),
    });
  }
  return out;
}

/**
 * Leaf blade: tapers to a point at both the petiole base and the tip, widest
 * roughly a third of the way up. Shared by basil/parsley — ingredient
 * character comes from the opts (broad+smooth for basil, small+ruffled for
 * parsley), not from separate shape code per herb.
 */
export function leaf(
  cx: number,
  cy: number,
  length: number,
  width: number,
  rot: number,
  rnd: () => number,
  opts: {
    /** Lower = the blade widens out faster near the base. */
    baseRound?: number;
    /** Higher = a sharper, more pointed tip. */
    tipSharp?: number;
    /** Ruffled/serrated-edge amplitude (0 = smooth basil-like edge). */
    serration?: number;
    serrFreq?: number;
    /** Independent left/right width scale for natural asymmetry. */
    asym?: number;
    /** Slow undulation along the blade, on top of serration. */
    wobble?: number;
    segments?: number;
  } = {},
): Poly {
  const {
    baseRound = 0.65,
    tipSharp = 1.7,
    serration = 0,
    serrFreq = 10,
    asym = 0.06,
    wobble = 0.03,
    segments = 40,
  } = opts;
  const tStar = baseRound / (baseRound + tipSharp);
  const peak = tStar ** baseRound * (1 - tStar) ** tipSharp;
  const serrPhase = rnd() * Math.PI * 2;
  const wobblePhase = rnd() * Math.PI * 2;
  const leftK = 1 + (rnd() - 0.5) * asym * 2;
  const rightK = 1 + (rnd() - 0.5) * asym * 2;
  const top: Poly = [];
  const bottom: Poly = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let hw = (width * (t ** baseRound * (1 - t) ** tipSharp)) / peak;
    if (serration) hw *= 1 + serration * Math.sin(t * serrFreq * Math.PI + serrPhase);
    hw *= 1 + wobble * Math.sin(t * Math.PI * 2.4 + wobblePhase);
    const x = t * length;
    top.push({ x, y: hw * leftK });
    bottom.push({ x, y: -hw * rightK });
  }
  const local = [...top, ...bottom.reverse()];
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  return local.map((p) => ({
    x: cx + p.x * cosR - p.y * sinR,
    y: cy + p.x * sinR + p.y * cosR,
  }));
}

/** Stadium shape between two points. Also used as `stem`. */
export function capsule(a: Vec, b: Vec, r: number, segments = 20): Poly {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ang = Math.atan2(dy, dx);
  const out: Poly = [];
  for (let i = 0; i <= segments; i++) {
    const t = ang - Math.PI / 2 + (i / segments) * Math.PI;
    out.push({ x: b.x + Math.cos(t) * r, y: b.y + Math.sin(t) * r });
  }
  for (let i = 0; i <= segments; i++) {
    const t = ang + Math.PI / 2 + (i / segments) * Math.PI;
    out.push({ x: a.x + Math.cos(t) * r, y: a.y + Math.sin(t) * r });
  }
  return out;
}

export const stem = capsule;

/** Chaikin smoothing — turns a coarse outline into soft handcrafted curves. */
export function smooth(poly: Poly, iterations = 2): Poly {
  let pts = poly;
  for (let it = 0; it < iterations; it++) {
    const next: Poly = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const q = pts[(i + 1) % pts.length]!;
      next.push({ x: lerp(p.x, q.x, 0.25), y: lerp(p.y, q.y, 0.25) });
      next.push({ x: lerp(p.x, q.x, 0.75), y: lerp(p.y, q.y, 0.75) });
    }
    pts = next;
  }
  return pts;
}

/** Rounded polygon from corner points (rounding via smoothing passes). */
export function roundedPolygon(points: Poly, rounding = 2): Poly {
  return smooth(points, Math.max(1, Math.min(4, rounding)));
}

export function roundedRect(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rounding = 2,
  jitter = 0,
  rnd?: () => number,
): Poly {
  const hw = w / 2;
  const hh = h / 2;
  const j = () => (rnd && jitter ? (rnd() - 0.5) * jitter : 0);
  const base: Poly = [];
  const push = (x: number, y: number) => base.push({ x: x + j(), y: y + j() });
  const steps = 4;
  for (let i = 0; i < steps; i++) push(lerp(-hw, hw, i / steps), -hh);
  for (let i = 0; i < steps; i++) push(hw, lerp(-hh, hh, i / steps));
  for (let i = 0; i < steps; i++) push(lerp(hw, -hw, i / steps), hh);
  for (let i = 0; i < steps; i++) push(-hw, lerp(hh, -hh, i / steps));
  return roundedPolygon(base, rounding).map((p) => ({ x: p.x + cx, y: p.y + cy }));
}

/** Pie wedge, used for citrus segments and radial detailing. */
export function wedge(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  segments = 12,
): Poly {
  const out: Poly = [{ x: cx, y: cy }];
  for (let i = 0; i <= segments; i++) {
    const a = lerp(a0, a1, i / segments);
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

/** Annulus as a single even-odd path pair (outer, reversed inner). */
export function ring(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  segments = 48,
): [Poly, Poly] {
  return [
    ellipse(cx, cy, rOuter, rOuter, 0, segments),
    ellipse(cx, cy, rInner, rInner, 0, segments).reverse(),
  ];
}

/** Variable-width tube around a spine — curved organic bodies (eggplant). */
export function tube(spine: Poly, radiusAt: (t: number) => number, segments = 40): Poly {
  const pts = resample(spine, segments);
  const left: Poly = [];
  const right: Poly = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
    const r = radiusAt(i / (pts.length - 1));
    left.push({ x: p.x + Math.cos(ang) * r, y: p.y + Math.sin(ang) * r });
    right.push({ x: p.x - Math.cos(ang) * r, y: p.y - Math.sin(ang) * r });
  }
  return smooth([...left, ...right.reverse()], 1);
}

export function resample(poly: Poly, count: number): Poly {
  const lens: number[] = [0];
  for (let i = 1; i < poly.length; i++) {
    lens.push(lens[i - 1]! + dist(poly[i - 1]!, poly[i]!));
  }
  const total = lens[lens.length - 1]! || 1;
  const out: Poly = [];
  for (let i = 0; i < count; i++) {
    const target = (i / (count - 1)) * total;
    let j = 1;
    while (j < lens.length - 1 && lens[j]! < target) j++;
    const t = (target - lens[j - 1]!) / Math.max(1e-6, lens[j]! - lens[j - 1]!);
    out.push({
      x: lerp(poly[j - 1]!.x, poly[j]!.x, t),
      y: lerp(poly[j - 1]!.y, poly[j]!.y, t),
    });
  }
  return out;
}

export function bezierSpine(a: Vec, c1: Vec, c2: Vec, b: Vec, steps = 24): Poly {
  const out: Poly = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    out.push({
      x: mt ** 3 * a.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t ** 3 * b.x,
      y: mt ** 3 * a.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t ** 3 * b.y,
    });
  }
  return out;
}

export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

export function centroid(poly: Poly): Vec {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

export function polygonArea(poly: Poly): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** Shrinks a polygon toward its centroid — used to derive skin/flesh bands. */
export function inset(poly: Poly, amount: number): Poly {
  const c = centroid(poly);
  return poly.map((p) => {
    const d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
    const k = Math.max(0.02, (d - amount) / d);
    return { x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k };
  });
}

export function bounds(polys: Poly[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of polys)
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}
