/**
 * RADISH_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.radish()` (source line 6812) against the real `taper` geometry —
 * a DAIKON: pale skin, root scars/hairs riding the taper, an inset bright
 * flesh band, and pale ribbed leaf-stalks fanning off the shoulder, each
 * carrying a lobed daikon-leaf blade (paint only, past the silhouette —
 * no cut/span/piece sees it).
 */
import { traceTaperPath, taperY, taperH, type TaperPaintOpts } from "./carrotTexture";

// The leaf crown (cosmetic overhang past the shoulder, source pixel
// constants unscaled) reaches well past rx — see cornTexture.ts's own
// doc for why growing the canvas to fit it would be wasted memory:
// PreparationScene's piece-rendering pipeline crops every piece,
// including the whole uncut ingredient, to the COLLISION silhouette's
// own rx/rBig bounds, so the crown is painted (faithful to the source)
// but never reaches the screen.
export function radishTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

export function paintRadishTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  rBig: number,
  rSmall: number,
  buttRound: number,
  tipRound: number,
  margin: number,
  opts: TaperPaintOpts = {},
): void {
  const cx = rx + margin;
  const cy = rBig + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const taperCurve = opts.taperCurve ?? 1;
  const spine = opts.spine ?? 0;
  const spineRx = opts.spineRx ?? rx;
  const yc = (x: number) => taperY(x, cx, cy, spine, spineRx);
  const hAt = (x: number) => taperH(x, cx, rx, rBig, rSmall, buttRound, tipRound, taperCurve);
  const sil = (rrx: number, rrBig: number, rrSmall: number, pad: number) => {
    ctx.beginPath();
    traceTaperPath(ctx, cx, cy, rrx, rrBig, rrSmall, buttRound, tipRound, pad, opts);
  };

  const skin = ctx.createLinearGradient(cx, cy - rBig, cx, cy + rBig);
  skin.addColorStop(0, "#F7F8EE");
  skin.addColorStop(0.3, "#E6E8D8");
  skin.addColorStop(0.64, "#CFD2BE");
  skin.addColorStop(1, "#B7BAA4");
  ctx.fillStyle = skin;
  sil(rx, rBig, rSmall, 0);
  ctx.fill();

  ctx.save();
  sil(rx, rBig, rSmall, 0);
  ctx.clip();
  const lit = ctx.createLinearGradient(cx - rx * 0.5, cy - rBig, cx + rx * 0.3, cy - rBig * 0.1);
  lit.addColorStop(0, "rgba(255,255,255,0.42)");
  lit.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = lit;
  sil(rx, rBig, rSmall, 0);
  ctx.fill(); // specular kept to the upper shoulder only

  for (let i = 0; i < 16; i++) {
    // root scars: short arcs across the body
    const t = 0.06 + i * 0.058;
    const x = cx - rx + t * rx * 2;
    const h = hAt(x);
    if (h <= 0) continue;
    ctx.strokeStyle = i % 2 ? "rgba(150,152,130,0.22)" : "rgba(120,124,100,0.16)";
    ctx.lineWidth = i % 3 ? 1.1 : 1.6;
    ctx.beginPath();
    ctx.moveTo(x, yc(x) - h * 0.86);
    ctx.quadraticCurveTo(x + 5, yc(x), x, yc(x) + h * 0.86);
    ctx.stroke();
    if (i % 4 === 1) {
      // a few root hairs off the underside
      ctx.strokeStyle = "rgba(160,162,140,0.42)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yc(x) + h * 0.8);
      ctx.quadraticCurveTo(x + 7, yc(x) + h * 1.02, x + 3, yc(x) + h * 1.18);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; // fibre line, along the lit flank
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.86, cy - rBig * 0.34);
  ctx.quadraticCurveTo(cx, cy - rBig * 0.4, cx + rx * 0.9, cy - rSmall * 0.3);
  ctx.stroke();
  ctx.restore();

  const fleshRBig = rBig - 24; // cut faces read clearly brighter than skin
  const fleshRSmall = Math.max(3, rSmall - 24 * 0.6);
  ctx.save();
  sil(rx, rBig, rSmall, 0);
  ctx.clip();
  const fg = ctx.createLinearGradient(cx, cy - rBig, cx, cy + rBig);
  fg.addColorStop(0, "#FFFFFF");
  fg.addColorStop(0.5, "#FCFCF7");
  fg.addColorStop(1, "#F4F5EC");
  ctx.fillStyle = fg;
  sil(rx - 24, fleshRBig, fleshRSmall, 0);
  ctx.fill();
  ctx.restore();

  // LEAF TOPS, past the crown — paint only, never part of the silhouette.
  // Pale ribbed stalks fanning out of the shoulder, each carrying a lobed
  // blade (a lobed daikon leaf, not a smooth spade).
  const bx = cx - rx * 0.94;
  const by = cy;
  const leaves: [number, number, number, number][] = [
    [-0.92, 104, 13, 1],
    [-0.52, 124, 15, 0],
    [-0.14, 132, 16, 1],
    [0.26, 120, 15, 0],
    [0.66, 98, 13, 1],
  ];
  for (const [a, len, w, dark] of leaves) {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(Math.PI + a);
    const st = ctx.createLinearGradient(0, -w * 0.5, len, w * 0.5);
    st.addColorStop(0, "#EFF3DC");
    st.addColorStop(0.5, "#CFE0A4");
    st.addColorStop(1, "#9CC066");
    ctx.strokeStyle = st;
    ctx.lineWidth = w * 0.42;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.52, -w * 0.3, len * 0.72, -w * 0.1);
    ctx.stroke();
    ctx.save();
    ctx.translate(len * 0.72, -w * 0.1);
    const blade = new Path2D();
    blade.moveTo(0, 0);
    blade.bezierCurveTo(len * 0.1, -w * 1.5, len * 0.3, -w * 1.9, len * 0.44, -w * 0.5);
    blade.bezierCurveTo(len * 0.34, -w * 0.2, len * 0.4, w * 1.4, len * 0.24, w * 1.1);
    blade.bezierCurveTo(len * 0.12, w * 1.7, len * 0.04, w * 0.9, 0, 0);
    blade.closePath();
    const lg = ctx.createLinearGradient(0, -w, len * 0.4, w);
    if (dark) {
      lg.addColorStop(0, "#4E8232");
      lg.addColorStop(1, "#2F5A1E");
    } else {
      lg.addColorStop(0, "#65A03F");
      lg.addColorStop(1, "#3E7228");
    }
    ctx.fillStyle = lg;
    ctx.fill(blade);
    ctx.strokeStyle = "rgba(28,58,18,0.32)";
    ctx.lineWidth = 1;
    ctx.stroke(blade);
    ctx.strokeStyle = "rgba(216,238,170,0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(len * 0.02, 0);
    ctx.quadraticCurveTo(len * 0.22, w * 0.1, len * 0.4, -w * 0.35);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(150,152,130,0.40)";
  ctx.lineWidth = 1.6;
  sil(rx, rBig, rSmall, 0);
  ctx.stroke();
}
