/**
 * ZUCCHINI_TEXTURE — paints the zucchini into a raw 2D canvas, same
 * technique as cucumberTexture.ts. Zucchini reuses cucumberTexture.ts's
 * `traceCucumberPath` DIRECTLY for its silhouette/piece-clipping (see
 * PreparationScene's taper dispatch) — same near-uniform-width blunt-
 * capsule family (ZUCCHINI_GEOMETRY mirrors CUCUMBER_GEOMETRY's cap-
 * rounding ratios), so this file only needs its own size/paint functions,
 * not a second trace function. Darker green skin with pale fleck
 * speckling (zucchini's own characteristic mottled skin, unlike
 * cucumber's smoother rind) and a paler seedy core band.
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

export function zucchiniTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

export function paintZucchiniTexture(
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
  const s = rx / 190;
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

  ctx.beginPath();
  tracePath(0);
  const gr = ctx.createLinearGradient(cx, cy - rBig, cx, cy + rBig);
  gr.addColorStop(0, "#4C7A34");
  gr.addColorStop(0.45, "#335C22");
  gr.addColorStop(1, "#213E16");
  ctx.fillStyle = gr;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  tracePath(0);
  ctx.clip();

  // Pale fleck speckling — zucchini's own mottled skin, unlike cucumber's smoother rind.
  ctx.fillStyle = "rgba(214,232,180,0.35)";
  const flecks = Math.max(14, Math.round((rx * 2) / (rBig * 0.6)));
  for (let i = 0; i < flecks; i++) {
    const x = cx - rx * 0.85 + (rx * 1.7 * ((i * 53) % flecks)) / flecks;
    const rh = hAt(x);
    if (rh <= 2) continue;
    const fy = cy + seededJitter(i) * rh * 0.75;
    ctx.beginPath();
    ctx.ellipse(x, fy, 2.4 * s, 1.6 * s, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Faint longitudinal ridges.
  ctx.strokeStyle = "rgba(20,36,12,0.12)";
  ctx.lineWidth = 1.4;
  for (let i = 1; i < 10; i++) {
    const x = cx - rx + (2 * rx * i) / 11;
    const rh = hAt(x);
    ctx.beginPath();
    ctx.moveTo(x, cy - rh);
    ctx.quadraticCurveTo(x + 6, cy, x, cy + rh);
    ctx.stroke();
  }

  // The pale seedy core, running the full length.
  const core = ctx.createLinearGradient(cx, cy - rBig * 0.42, cx, cy + rBig * 0.42);
  core.addColorStop(0, "rgba(240,245,210,0)");
  core.addColorStop(0.5, "rgba(240,245,210,0.8)");
  core.addColorStop(1, "rgba(240,245,210,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.86, cy - rBig * 0.42);
  ctx.lineTo(cx + rx * 0.88, cy - rSmall * 0.42);
  ctx.lineTo(cx + rx * 0.88, cy + rSmall * 0.42);
  ctx.lineTo(cx - rx * 0.86, cy + rBig * 0.42);
  ctx.closePath();
  ctx.fill();

  // Soft glossy highlight, upper side.
  ctx.save();
  ctx.globalAlpha = 0.18;
  const hg = ctx.createLinearGradient(cx, cy - rBig * 0.7, cx, cy - rBig * 0.15);
  hg.addColorStop(0, "rgba(255,255,255,0.9)");
  hg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hg;
  ctx.fillRect(cx - rx, cy - rBig, rx * 2, rBig * 1.1);
  ctx.restore();

  ctx.restore();

  ctx.strokeStyle = "rgba(18,32,10,0.3)";
  ctx.lineWidth = Math.max(1.5, rBig * 0.09);
  ctx.beginPath();
  tracePath(-ctx.lineWidth * 0.5);
  ctx.stroke();

  // Trimmed ends.
  ctx.fillStyle = "rgba(16,28,8,0.18)";
  for (const x of [cx - rx + 4, cx + rx - 4]) {
    ctx.beginPath();
    ctx.ellipse(x, cy, 4, rBig * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A tiny deterministic pseudo-random in [-1,1], seeded by index — avoids Math.random() re-painting differently every layout() call for the same geometry (no other texture file in this project uses Math.random, for the same reason). */
function seededJitter(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}
