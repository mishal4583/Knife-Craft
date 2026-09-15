/** Generic, data-driven technique -> cut-line generation. No per-ingredient ifs. */
import { bounds } from "./primitives";
import type { CutLine } from "./cutter";
import type { Geometry, Technique } from "./types";

function parallelCuts(geometry: Geometry, count: number, axisAngle: number): CutLine[] {
  const b = bounds(geometry.parts.map((p) => p.poly));
  // Cut lines run perpendicular to the travel axis, marching across the body.
  const dirX = Math.cos(axisAngle);
  const dirY = Math.sin(axisAngle);
  const span = Math.abs((b.maxX - b.minX) * dirX) + Math.abs((b.maxY - b.minY) * dirY) || 1;
  const lines: CutLine[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1) - 0.5;
    lines.push({
      p: { x: b.cx + dirX * span * t, y: b.cy + dirY * span * t },
      angle: axisAngle + Math.PI / 2,
    });
  }
  return lines;
}

export function cutLinesFor(technique: Technique, geometry: Geometry): CutLine[] {
  const axis = geometry.longAxis;
  const cross = axis + Math.PI / 2;
  const b = bounds(geometry.parts.map((p) => p.poly));
  const center = { x: b.cx, y: b.cy };

  switch (technique) {
    case "Halve":
      return [{ p: center, angle: axis }];
    case "Slice":
      return parallelCuts(geometry, 5, axis);
    case "Rings":
      return parallelCuts(geometry, 6, axis);
    case "Julienne":
      return [...parallelCuts(geometry, 5, cross)];
    case "Dice":
      return [...parallelCuts(geometry, 4, axis), ...parallelCuts(geometry, 3, cross)];
    case "Chop":
      return [...parallelCuts(geometry, 3, axis), ...parallelCuts(geometry, 2, cross)];
    case "Rock Mince":
      return [...parallelCuts(geometry, 6, axis), ...parallelCuts(geometry, 5, cross)];
    case "Chiffonade":
      return parallelCuts(geometry, 9, cross);
    case "Radial": {
      const n = 8;
      const lines: CutLine[] = [];
      for (let i = 0; i < n / 2; i++) {
        lines.push({ p: center, angle: (i / (n / 2)) * Math.PI });
      }
      return lines;
    }
    case "Peel":
      return [];
    case "Smash":
      return [...parallelCuts(geometry, 2, axis + 0.6), ...parallelCuts(geometry, 2, cross + 0.4)];
    default:
      return [];
  }
}

export const plateSpreadFor: Partial<Record<Technique, number>> = {
  Halve: 0.16,
  Slice: 0.2,
  Rings: 0.2,
  Dice: 0.24,
  Chop: 0.22,
  Radial: 0.22,
  Chiffonade: 0.2,
  Julienne: 0.2,
  "Rock Mince": 0.26,
  Smash: 0.2,
};
