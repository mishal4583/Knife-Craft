/**
 * BREAD_TEXTURE — paints the loaf into a raw 2D canvas, same technique as
 * cucumberTexture.ts/zucchiniTexture.ts. Bread reuses cucumberTexture.ts's
 * `traceCucumberPath` DIRECTLY for its silhouette/piece-clipping (see
 * PreparationScene's taper dispatch) — same near-uniform-width blunt-
 * capsule family (BREAD_GEOMETRY mirrors CUCUMBER_GEOMETRY's cap-rounding
 * ratios, just much stubbier/thicker), so this file only needs its own
 * size/paint functions, not a second trace function.
 *
 * Reference-photo pass: a pale sandwich/pan loaf — browned top scored with
 * knife lines, pale golden sides, NO visible white crumb patch anywhere on
 * the whole loaf. No crumb-reveal layer at all this time (an earlier pass
 * tried a soft graduated blend, but any visible pale patch here shows on
 * the whole/uncut sprite too — this engine shares one canvas between the
 * whole loaf and every cut piece, see pieceTexture.ts) — the loaf reads as
 * entirely crust, with score-line and mottling detail instead of an
 * exposed interior.
 */

function taperH(
  x: number,
  cx: number,
  rx: number,
  rBig: number,
  rSmall: number,
  buttRound: number,
  tipRound: number,
): number {
  const x0 = cx - rx;
  const x1 = cx + rx;
  if (x < x0 || x > x1) return 0;
  const base = rBig + (rSmall - rBig) * ((x - x0) / (2 * rx));
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

export function breadTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

export function paintBreadTexture(
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
  const s = rx / 150;
  const hAt = (x: number) => taperH(x, cx, rx, rBig, rSmall, buttRound, tipRound);

  // Reuses traceCucumberPath's exact math (imported by PreparationScene
  // for the real silhouette/clip) — a local copy here would drift; this
  // file only needs the SAME outline for its own fill/clip calls, so it
  // rebuilds the identical path inline rather than importing across
  // texture files for a single trace call.
  const tracePath = (pad: number) => {
    const N = 96;
    const xa = cx - rx;
    const xb = cx + rx;
    ctx.moveTo(xa - pad, cy);
    for (let i = 0; i <= N; i++) {
      const x = xa + ((xb - xa) * i) / N;
      const hh = hAt(x);
      ctx.lineTo(x, cy - (hh > 0 ? hh + pad : 0));
    }
    ctx.lineTo(xb + pad, cy);
    for (let i = N; i >= 0; i--) {
      const x = xa + ((xb - xa) * i) / N;
      const hh = hAt(x);
      ctx.lineTo(x, cy + (hh > 0 ? hh + pad : 0));
    }
    ctx.closePath();
  };

  ctx.clearRect(0, 0, w, h);

  // Crust — a warm, fairly even golden-tan (pan-loaf top, not a dark
  // rustic crust) fading a touch paler toward the outer edge, where the
  // loaf's paler, barely-browned pan-sides would show.
  ctx.beginPath();
  tracePath(0);
  const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  gr.addColorStop(0, "#D79A52");
  gr.addColorStop(0.72, "#CB8A40");
  gr.addColorStop(1, "#E8C48A");
  ctx.fillStyle = gr;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  tracePath(0);
  ctx.clip();

  // Faint mottled bake variation — real crust is never a flat gradient.
  for (let i = 0; i < 9; i++) {
    const jx = seededJitter(i * 3.3);
    const jy = seededJitter(i * 4.7 + 2);
    const x = cx + jx * rx * 0.8;
    const rowH = hAt(x);
    if (rowH <= 4) continue;
    const y = cy + jy * rowH * 0.78;
    const r = (8 + Math.abs(seededJitter(i * 6.1)) * 12) * s;
    const darker = seededJitter(i * 8.9) > 0.1;
    ctx.fillStyle = darker ? "rgba(112,66,26,0.12)" : "rgba(240,196,132,0.16)";
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, jx * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft glossy highlight suggesting the domed top's sheen.
  ctx.save();
  const hg = ctx.createRadialGradient(
    cx - rx * 0.15,
    cy - rBig * 0.55,
    0,
    cx - rx * 0.15,
    cy - rBig * 0.55,
    rx * 0.65,
  );
  hg.addColorStop(0, "rgba(255,255,255,0.18)");
  hg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hg;
  ctx.fillRect(cx - rx, cy - rBig, rx * 2, rBig * 1.3);
  ctx.restore();

  ctx.restore();

  // Pale rim — a thin lighter band right at the outline, standing in for
  // the loaf's paler, barely-browned pan-touching sides.
  ctx.strokeStyle = "rgba(238,206,150,0.55)";
  ctx.lineWidth = Math.max(2, rBig * 0.12);
  ctx.beginPath();
  tracePath(-ctx.lineWidth * 0.7);
  ctx.stroke();

  ctx.strokeStyle = "rgba(90,58,26,0.35)";
  ctx.lineWidth = Math.max(1.4, rBig * 0.06);
  ctx.beginPath();
  tracePath(-ctx.lineWidth * 0.5);
  ctx.stroke();
}

/** A tiny deterministic pseudo-random in [-1,1], seeded by index — avoids Math.random() re-painting differently every layout() call for the same geometry (no other texture file in this project uses Math.random, for the same reason). */
function seededJitter(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}
