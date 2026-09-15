/**
 * CARROT_TEXTURE — paints the carrot into a raw 2D canvas, ported from
 * knifecraft.html's `PAINT.carrot()` and the taper silhouette's `trace()`
 * (`SILS.taper`, `taperH`) — a horizontal taper: crown (flat cut face) at
 * the left, tip running out to a point at the right. Same technique as
 * tomatoTexture.ts: real Canvas 2D gradients/clip, one shared texture that
 * every piece later windows into via a clip path (see pieceTexture.ts).
 */

/** Optional taperCurve/spine — see ingredientShapes.ts's TaperCurveOpts for the exact port rationale (defaults are an exact identity: every pre-existing straight taper is bit-for-bit unaffected). */
export type TaperPaintOpts = { taperCurve?: number; spine?: number; spineRx?: number };

export function taperH(
  x: number,
  cx: number,
  rx: number,
  rBig: number,
  rSmall: number,
  buttRound: number,
  tipRound: number,
  taperCurve: number,
): number {
  const x0 = cx - rx;
  const x1 = cx + rx;
  if (x < x0 || x > x1) return 0;
  const t = (x - x0) / (2 * rx);
  const base = rSmall + (rBig - rSmall) * Math.pow(1 - t, taperCurve);
  const capL = rBig * buttRound;
  const capR = rSmall * tipRound;
  if (x < x0 + capL) {
    const k = (x0 + capL - x) / capL;
    return base * Math.sqrt(Math.max(0, 1 - k * k));
  }
  if (x > x1 - capR) {
    const k = (x - (x1 - capR)) / capR;
    return base * Math.sqrt(Math.max(0, 1 - k * k));
  }
  return base;
}

export function taperY(x: number, cx: number, cy: number, spine: number, spineRx: number): number {
  if (!spine) return cy;
  const t = Math.max(0, Math.min(1, (x - (cx - spineRx)) / (2 * spineRx)));
  return cy - spine * Math.sin(Math.PI * t);
}

export function carrotTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

/** Traces the taper outline (with `pad` outward offset) into an already-`beginPath()`'d context. */
export function traceTaperPath(
  ctx: CanvasPath,
  cx: number,
  cy: number,
  rx: number,
  rBig: number,
  rSmall: number,
  buttRound: number,
  tipRound: number,
  pad: number,
  opts: TaperPaintOpts = {},
): void {
  const taperCurve = opts.taperCurve ?? 1;
  const spine = opts.spine ?? 0;
  const spineRx = opts.spineRx ?? rx;
  const N = 96;
  const xa = cx - rx;
  const xb = cx + rx;
  const h = (x: number) => taperH(x, cx, rx, rBig, rSmall, buttRound, tipRound, taperCurve);
  const yc = (x: number) => taperY(x, cx, cy, spine, spineRx);
  ctx.moveTo(xa - pad, yc(xa));
  for (let i = 0; i <= N; i++) {
    const x = xa + ((xb - xa) * i) / N;
    const hh = h(x);
    ctx.lineTo(x, yc(x) - (hh > 0 ? hh + pad : 0));
  }
  ctx.lineTo(xb + pad, yc(xb));
  for (let i = N; i >= 0; i--) {
    const x = xa + ((xb - xa) * i) / N;
    const hh = h(x);
    ctx.lineTo(x, yc(x) + (hh > 0 ? hh + pad : 0));
  }
  ctx.closePath();
}

export function paintCarrotTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  rBig: number,
  rSmall: number,
  buttRound: number,
  tipRound: number,
  margin: number,
): void {
  const cx = rx + margin;
  const cy = rBig + margin;
  const w = cx * 2;
  const h = cy * 2;
  const hAt = (x: number) => taperH(x, cx, rx, rBig, rSmall, buttRound, tipRound, 1);

  ctx.clearRect(0, 0, w, h);

  ctx.beginPath();
  traceTaperPath(ctx, cx, cy, rx, rBig, rSmall, buttRound, tipRound, 0);
  const gr = ctx.createLinearGradient(cx, cy - rBig, cx, cy + rBig);
  gr.addColorStop(0, "#F5A24A");
  gr.addColorStop(0.42, "#E4822F");
  gr.addColorStop(1, "#C0631E");
  ctx.fillStyle = gr;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  traceTaperPath(ctx, cx, cy, rx, rBig, rSmall, buttRound, tipRound, 0);
  ctx.clip();

  // Ridges: a suggestion, not corrugation.
  ctx.strokeStyle = "rgba(132,60,12,0.09)";
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 11; i++) {
    const x = cx - rx + (2 * rx * i) / 12;
    const rh = hAt(x);
    ctx.beginPath();
    ctx.moveTo(x, cy - rh);
    ctx.quadraticCurveTo(x + 8, cy, x, cy + rh);
    ctx.stroke();
  }

  // A soft warm core running the length of the root.
  const core = ctx.createLinearGradient(cx, cy - rBig * 0.4, cx, cy + rBig * 0.4);
  core.addColorStop(0, "rgba(255,214,158,0.36)");
  core.addColorStop(1, "rgba(255,214,158,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.86, cy - rBig * 0.3);
  ctx.lineTo(cx + rx * 0.9, cy - rSmall * 0.34);
  ctx.lineTo(cx + rx * 0.9, cy + rSmall * 0.34);
  ctx.lineTo(cx - rx * 0.86, cy + rBig * 0.3);
  ctx.closePath();
  ctx.fill();

  // The trimmed crown face — topped, not torn.
  ctx.fillStyle = "rgba(120,52,8,0.18)";
  ctx.beginPath();
  ctx.ellipse(cx - rx + 5, cy, 5, rBig * 0.93, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
