/**
 * GARLIC_TEXTURE — paints a single garlic clove into a raw 2D canvas,
 * same technique as carrotTexture.ts/cucumberTexture.ts. A real clove is
 * a teardrop, not an oval — rounded at the root end, tapering to a
 * pointed tip — so garlic uses the SAME taper silhouette factory carrot
 * and cucumber already share (see ingredientShapes.ts's
 * makeTaperSilhouette / PreparationScene.taperGeometry), just with its
 * own geometry (GARLIC_GEOMETRY in definitions.ts): a rounded base
 * tapering to a real point, much smaller overall than carrot.
 *
 * Two paint variants share one function, same pattern as before:
 * `peeled=false` (papery tan/violet-blushed outer skin, longitudinal
 * striations) and `peeled=true` (smooth ivory clove, once Peel's
 * coverage threshold is reached). Smash doesn't need a third texture
 * variant — it visually flattens the already-peeled piece via a scale
 * tween (see PreparationScene.runSmash), not a repaint.
 */

export function garlicTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

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

/** Traces the clove outline (with `pad` outward offset) into an already-`beginPath()`'d context. */
export function traceGarlicPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  rBig: number,
  rSmall: number,
  buttRound: number,
  tipRound: number,
  pad: number,
): void {
  const N = 80;
  const xa = cx - rx;
  const xb = cx + rx;
  const h = (x: number) => taperH(x, cx, rx, rBig, rSmall, buttRound, tipRound);
  ctx.moveTo(xa - pad, cy);
  for (let i = 0; i <= N; i++) {
    const x = xa + ((xb - xa) * i) / N;
    const hh = h(x);
    ctx.lineTo(x, cy - (hh > 0 ? hh + pad : 0));
  }
  ctx.lineTo(xb + pad, cy);
  for (let i = N; i >= 0; i--) {
    const x = xa + ((xb - xa) * i) / N;
    const hh = h(x);
    ctx.lineTo(x, cy + (hh > 0 ? hh + pad : 0));
  }
  ctx.closePath();
}

export function paintGarlicTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  rBig: number,
  rSmall: number,
  buttRound: number,
  tipRound: number,
  margin: number,
  peeled: boolean,
): void {
  const cx = rx + margin;
  const cy = rBig + margin;
  const w = cx * 2;
  const h = cy * 2;
  const s = rx / 66;
  const hAt = (x: number) => taperH(x, cx, rx, rBig, rSmall, buttRound, tipRound);

  ctx.clearRect(0, 0, w, h);

  ctx.beginPath();
  traceGarlicPath(ctx, cx, cy, rx, rBig, rSmall, buttRound, tipRound, 0);

  if (!peeled) {
    // Papery tan/violet-tinged outer skin, base to tip.
    const rg = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy);
    rg.addColorStop(0, "#E7D6BC");
    rg.addColorStop(0.45, "#EFE3CC");
    rg.addColorStop(0.85, "#D9C093");
    rg.addColorStop(1, "#B99964");
    ctx.fillStyle = rg;
    ctx.fill();
  } else {
    const rg = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy);
    rg.addColorStop(0, "#FFFDF6");
    rg.addColorStop(0.45, "#FBF4E2");
    rg.addColorStop(0.85, "#F0E5C6");
    rg.addColorStop(1, "#DDCB9C");
    ctx.fillStyle = rg;
    ctx.fill();
  }

  ctx.save();
  ctx.beginPath();
  traceGarlicPath(ctx, cx, cy, rx, rBig, rSmall, buttRound, tipRound, 0);
  ctx.clip();

  if (!peeled) {
    // Papery longitudinal striations, base to tip.
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = "#8A6B45";
    ctx.lineWidth = 1 * s;
    for (let i = 1; i < 8; i++) {
      const fy = -1 + (2 * i) / 8;
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.92, cy + fy * rBig * 0.85);
      for (let px = 0; px <= 1; px += 0.1) {
        const x = cx - rx * 0.92 + rx * 1.7 * px;
        const localH = hAt(x);
        ctx.lineTo(x, cy + fy * localH * 0.85);
      }
      ctx.stroke();
    }
    // A faint violet blush near the base, common on real cloves.
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = "#9C6E9E";
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.45, cy, rx * 0.35, rBig * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    // Smooth ivory clove — a firm highlight instead of papery striations.
    ctx.globalAlpha = 0.4;
    const hg = ctx.createRadialGradient(
      cx - rx * 0.25,
      cy - rBig * 0.35,
      1,
      cx - rx * 0.25,
      cy - rBig * 0.35,
      rx * 0.45,
    );
    hg.addColorStop(0, "#FFFFFF");
    hg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.25, cy - rBig * 0.35, rx * 0.4, rBig * 0.32, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // A faint vertical seam line, base to tip — cloves keep a subtle
    // ridge even once peeled.
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#B99964";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.9, cy);
    ctx.lineTo(cx + rx * 0.85, cy);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // A soft core shadow toward the pointed tip — the clove reads as
  // rounder/fuller near the root, flatter near the tip.
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = "#5A4326";
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.55, cy, rx * 0.35, rSmall * 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();

  // A thin darker rind just inside the true skin.
  ctx.strokeStyle = peeled ? "rgba(180,150,100,0.22)" : "rgba(120,90,55,0.3)";
  ctx.lineWidth = Math.max(1.2, rBig * 0.07);
  ctx.beginPath();
  traceGarlicPath(ctx, cx, cy, rx, rBig, rSmall, buttRound, tipRound, -ctx.lineWidth * 0.5);
  ctx.stroke();

  // A small root disc at the wide (base) end, either state.
  ctx.fillStyle = peeled ? "rgba(210,190,150,0.5)" : "rgba(150,120,80,0.55)";
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.86, cy, 3.2 * s, hAt(cx - rx * 0.9) * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
}
