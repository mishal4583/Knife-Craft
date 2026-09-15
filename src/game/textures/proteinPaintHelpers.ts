/**
 * PROTEIN_PAINT_HELPERS — ported verbatim from knifecraft.html's shared
 * protein paint helpers (`PAINT._region`/`_taperStroke`/`_thread`,
 * source `:8130` onward — "Both proteins live on the same rails, and
 * both needed the same three things the first pass faked with loops of
 * single strokes"). Used by chickenTexture.ts/steakTexture.ts/
 * salmonTexture.ts ONLY — no existing production ingredient's painter
 * imports this file. `PAINT._railAt` itself is `makeFilletRailAt` in
 * ingredientShapes.ts (it needs the fillet rail internals; these three
 * only need that closure as a black box, exactly like the source's own
 * split).
 *
 * All three proteins hash their variation off the loop index — never
 * `Math.random` — so the same fillet renders identically every time.
 * `filletHash(i,m)` is that one hash, ported verbatim from the source's
 * repeated inline `((i*2654435761) % m)/m`.
 */

/** Deterministic per-index pseudo-random in [0,1) — ported verbatim, never `Math.random`. */
export function filletHash(i: number, m: number): number {
  return ((i * 2654435761) % m) / m;
}

/**
 * A region between two v-functions over an s-range: the only way to
 * tone one muscle group (steak's eye/side, salmon's loin/belly) without
 * toning the rest of the body, and it follows the rails, so it can
 * never spill outside the silhouette. Ported verbatim from `PAINT._region`.
 */
export function filletRegion(
  at: (s: number, v: number) => [number, number],
  s0: number,
  s1: number,
  vTop: (s: number) => number,
  vBot: (s: number) => number,
  n = 48,
): Path2D {
  const p = new Path2D();
  for (let i = 0; i <= n; i++) {
    const s = s0 + (s1 - s0) * (i / n);
    const q = at(s, vTop(s));
    if (i === 0) p.moveTo(q[0], q[1]);
    else p.lineTo(q[0], q[1]);
  }
  for (let i = n; i >= 0; i--) {
    const s = s0 + (s1 - s0) * (i / n);
    const q = at(s, vBot(s));
    p.lineTo(q[0], q[1]);
  }
  p.closePath();
  return p;
}

/**
 * A tapered stroke: drawn as short segments whose width and alpha
 * follow an envelope, so both ends fade to nothing — a constant-width
 * stroke with round caps is what made an earlier pass's marbling read
 * as rice grains. Ported verbatim from `PAINT._taperStroke`.
 */
export function filletTaperStroke(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  rgb: string,
  aMax: number,
  wMax: number,
  env?: (t: number) => number,
): void {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const e = env ? env(t) : Math.sin(Math.PI * t);
    ctx.strokeStyle = `rgba(${rgb},${(aMax * e).toFixed(3)})`;
    ctx.lineWidth = Math.max(0.35, wMax * (0.35 + 0.65 * e));
    ctx.beginPath();
    ctx.moveTo(pts[i]![0], pts[i]![1]);
    ctx.lineTo(pts[i + 1]![0], pts[i + 1]![1]);
    ctx.stroke();
  }
}

/**
 * A marbling/mottle thread in rail space: a wandering polyline, hashed
 * off the loop index so it meanders the way fat between muscle bundles
 * (steak) or fine tone breakup (salmon) does. Ported verbatim from
 * `PAINT._thread`.
 */
export function filletThread(
  at: (s: number, v: number) => [number, number],
  s0: number,
  v0: number,
  dir: number,
  len: number,
  turn: number,
  steps: number,
): [number, number][] {
  const pts: [number, number][] = [];
  let s = s0;
  let v = v0;
  let a = dir;
  for (let i = 0; i <= steps; i++) {
    pts.push(at(s, Math.max(0, Math.min(1, v))));
    a += turn * (((i * 2654435761) % 17) / 17 - 0.5);
    s += (len / steps) * Math.cos(a);
    v += (len / steps) * Math.sin(a) * 2.0; // v is normalized, so it moves faster
  }
  return pts;
}
