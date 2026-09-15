/**
 * Cluster primitive: multiple disconnected / overlapping lobes with gaps,
 * varied sizes and irregular positioning. Used by herbs and by broccoli.
 *
 * Minimal extension for broccoli: `spine` + `attachStems` let a cluster be
 * distributed along an arc (a crown) and emit connecting stems, instead of
 * only scattering lobes in a disc. This stays generic — any crowned cluster
 * ingredient (cauliflower, dill) can reuse it.
 */
import { capsule, irregularOval, resample } from "./primitives";
import type { GeometryPart, Poly, Vec } from "./types";
import { lerp, range } from "./rng";

export type ClusterOptions = {
  count: number;
  /** Lobe radius range. */
  minR: number;
  maxR: number;
  rnd: () => number;
  /** Scatter area when no spine is given. */
  center?: Vec;
  spreadX?: number;
  spreadY?: number;
  /** Distribute lobes along this open path (e.g. a crown arc). */
  spine?: Poly;
  /** Perpendicular jitter around the spine. */
  jitter?: number;
  wobble?: number;
  lobes?: number;
  /** Emit a stem from `stemOrigin` to each lobe. */
  attachStems?: boolean;
  stemOrigin?: Vec;
  stemWidth?: number;
  kind?: GeometryPart["kind"];
  idPrefix?: string;
  /**
   * Custom lobe shape (defaults to irregularOval). Lets ingredients like
   * basil/parsley reuse this scatter/spine placement + stem logic with a
   * leaf silhouette instead of an oval.
   */
  shape?: (args: {
    pos: Vec;
    length: number;
    width: number;
    rot: number;
    rnd: () => number;
    index: number;
  }) => Poly;
  /** width/length ratio fed to `shape` (ignored for the default oval lobe). */
  widthRatio?: number;
  /** Rotate each lobe away from this point instead of a random angle. */
  faceFrom?: Vec;
  rotJitter?: number;
};

export function cluster(opts: ClusterOptions): GeometryPart[] {
  const {
    count,
    minR,
    maxR,
    rnd,
    center = { x: 0, y: 0 },
    spreadX = 0.6,
    spreadY = 0.5,
    spine,
    jitter = 0.08,
    wobble = 0.18,
    lobes = 7,
    attachStems = false,
    stemOrigin,
    stemWidth = 0.035,
    kind = "floret",
    idPrefix = "lobe",
    shape,
    widthRatio = 0.8,
    faceFrom,
    rotJitter = 0.5,
  } = opts;

  const path = spine ? resample(spine, Math.max(count, 8)) : null;
  const parts: GeometryPart[] = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    let pos: Vec;
    if (path) {
      const p = path[Math.min(path.length - 1, Math.round(t * (path.length - 1)))]!;
      pos = {
        x: p.x + range(rnd, -jitter, jitter),
        y: p.y + range(rnd, -jitter, jitter),
      };
    } else {
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd());
      pos = { x: center.x + Math.cos(a) * spreadX * rr, y: center.y + Math.sin(a) * spreadY * rr };
    }
    const r = lerp(minR, maxR, rnd() ** 1.4);

    if (attachStems && stemOrigin) {
      const mid: Vec = {
        x: lerp(stemOrigin.x, pos.x, 0.55) + range(rnd, -0.03, 0.03),
        y: lerp(stemOrigin.y, pos.y, 0.55),
      };
      parts.push({
        id: `${idPrefix}-stem-${i}`,
        kind: "stem",
        poly: capsule(stemOrigin, mid, stemWidth * range(rnd, 0.8, 1.3)),
        z: 0,
      });
      parts.push({
        id: `${idPrefix}-stem-b-${i}`,
        kind: "stem",
        poly: capsule(mid, pos, stemWidth * range(rnd, 0.6, 1.0)),
        z: 1,
      });
    }

    const rot = faceFrom
      ? Math.atan2(pos.y - faceFrom.y, pos.x - faceFrom.x) + range(rnd, -rotJitter, rotJitter)
      : rnd() * Math.PI;

    const poly = shape
      ? shape({
          pos,
          length: r * 2 * range(rnd, 0.9, 1.15),
          width: r * 2 * widthRatio * range(rnd, 0.85, 1.15),
          rot,
          rnd,
          index: i,
        })
      : irregularOval(
          pos.x,
          pos.y,
          r * range(rnd, 0.85, 1.2),
          r * range(rnd, 0.75, 1.1),
          rnd,
          wobble,
          lobes,
          rot,
          44,
        );

    parts.push({
      id: `${idPrefix}-${i}`,
      kind,
      poly,
      z: 2 + rnd(),
    });
  }
  return parts;
}
