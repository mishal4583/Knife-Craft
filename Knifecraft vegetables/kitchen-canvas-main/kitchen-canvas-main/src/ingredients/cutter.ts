/**
 * Cutting = geometry only. We never repaint an ingredient for a cut:
 * pieces are polygon groups that CLIP the cached ingredient rendering, so the
 * exposed cut face automatically shows whatever interior was painted there.
 */
import { bounds, centroid, polygonArea } from "./primitives";
import type { Geometry, Poly, Vec } from "./types";

export type CutLine = {
  /** A point on the line, unit space. */
  p: Vec;
  /** Line direction angle, radians. */
  angle: number;
};

export type Piece = {
  id: string;
  polys: Poly[];
  /** Plating offset applied at draw time (paint stays anchored to the source). */
  offset: Vec;
  rotation: number;
};

const EPS = 1e-9;

function signedSide(pt: Vec, line: CutLine) {
  const nx = -Math.sin(line.angle);
  const ny = Math.cos(line.angle);
  return (pt.x - line.p.x) * nx + (pt.y - line.p.y) * ny;
}

/** Sutherland–Hodgman half-plane clip. */
function clipHalf(poly: Poly, line: CutLine, keepPositive: boolean): Poly {
  const out: Poly = [];
  const sign = keepPositive ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const da = signedSide(a, line) * sign;
    const db = signedSide(b, line) * sign;
    if (da >= -EPS) out.push(a);
    if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

const MIN_AREA = 0.0008;

export function splitPieces(pieces: Piece[], line: CutLine): Piece[] {
  const next: Piece[] = [];
  pieces.forEach((piece, idx) => {
    const pos: Poly[] = [];
    const neg: Poly[] = [];
    for (const poly of piece.polys) {
      const a = clipHalf(poly, line, true);
      const b = clipHalf(poly, line, false);
      if (a.length > 2 && polygonArea(a) > MIN_AREA) pos.push(a);
      if (b.length > 2 && polygonArea(b) > MIN_AREA) neg.push(b);
    }
    if (pos.length) next.push({ ...piece, id: `${piece.id}-a${idx}`, polys: pos });
    if (neg.length) next.push({ ...piece, id: `${piece.id}-b${idx}`, polys: neg });
  });
  return next;
}

export function wholePiece(geometry: Geometry): Piece {
  return {
    id: "whole",
    polys: geometry.parts
      .slice()
      .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
      .map((p) => p.poly),
    offset: { x: 0, y: 0 },
    rotation: 0,
  };
}

export function explodeToLobes(piece: Piece): Piece[] {
  return piece.polys.map((poly, i) => ({
    id: `${piece.id}-lobe${i}`,
    polys: [poly],
    offset: piece.offset,
    rotation: piece.rotation,
  }));
}

export function applyCuts(
  geometry: Geometry,
  lines: CutLine[],
  opts: { separate?: boolean } = {},
): Piece[] {
  let pieces = [wholePiece(geometry)];
  for (const line of lines) pieces = splitPieces(pieces, line);
  if (opts.separate && lines.length) pieces = pieces.flatMap(explodeToLobes);
  return pieces.filter((p) => p.polys.length > 0);
}

/** Nudges pieces apart so the player can read each individual cut piece. */
export function plate(pieces: Piece[], spread = 0.18, rnd: () => number = Math.random): Piece[] {
  if (pieces.length <= 1) return pieces;
  const all = pieces.flatMap((p) => p.polys);
  const b = bounds(all);
  return pieces.map((piece) => {
    const c = centroid(piece.polys[0]!);
    const dx = c.x - b.cx;
    const dy = c.y - b.cy;
    const len = Math.hypot(dx, dy) || 1;
    return {
      ...piece,
      offset: {
        x: piece.offset.x + (dx / len) * spread * (0.7 + rnd() * 0.6),
        y: piece.offset.y + (dy / len) * spread * (0.7 + rnd() * 0.6),
      },
      rotation: piece.rotation + (rnd() - 0.5) * 0.18,
    };
  });
}
