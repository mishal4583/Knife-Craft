/**
 * CORN_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.corn()` (source line 6023) against the real `taper` geometry.
 * A cosmetic stalk stub off the butt (drawn first so the cob's own edge
 * covers the joint — sheds on the first cut, never seen by any cut/span/
 * piece). The identity is entirely the kernel lattice — staggered rows
 * that RIDE THE TAPER (`taperH`/`taperY`, same trick Celery's ribs use):
 * a flat grid on a narrowing cob would put whole kernels outside the
 * silhouette and get bitten in half by the clip, reading as a lattice
 * printed on a cob rather than kernels wrapped around one.
 */
import { traceTaperPath, taperH, taperY, type TaperPaintOpts } from "./carrotTexture";

// The stalk stub (source pixel constants, unscaled) reaches past rx —
// PreparationScene's own piece-rendering pipeline (pieceBounds/
// regionGeom in CutGeometry.ts) crops every piece, including the whole
// uncut ingredient, to the COLLISION silhouette's own rx/rBig bounds
// (never wider), so a canvas grown to fit the stub would only waste
// memory on pixels no piece image can ever sample. The stub is still
// painted here (faithful to the source, harmless), it just never
// reaches the screen — exactly as true of the source's own "no cut,
// span, or piece sees it" framing, for a different reason.
export function cornTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

const TONE = ["#FFF3AC", "#FCE68C", "#F5D66E", "#E4C158", "#C9A344", "#AC8A38"];

export function paintCornTexture(
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
  const h = (x: number) => taperH(x, cx, rx, rBig, rSmall, buttRound, tipRound, taperCurve);
  const y = (x: number) => taperY(x, cx, cy, spine, spineRx);
  const sil = (pad: number) => {
    ctx.beginPath();
    traceTaperPath(ctx, cx, cy, rx, rBig, rSmall, buttRound, tipRound, pad, opts);
  };

  // Stalk stub off the butt — cosmetic overhang, like celery's crown: no
  // cut/span/piece sees it, and it sheds on the first cut. Drawn first so
  // the cob's own edge covers the joint.
  {
    const bx = cx - rx * 0.96;
    const L = 44;
    const h0 = 17;
    const h1 = 11;
    const dy = 5;
    const p = new Path2D();
    p.moveTo(bx, cy - h0);
    p.quadraticCurveTo(bx - L * 0.55, cy - h1 * 1.1 + dy * 0.5, bx - L, cy - h1 + dy);
    p.quadraticCurveTo(bx - L * 1.06, cy + dy, bx - L, cy + h1 + dy);
    p.quadraticCurveTo(bx - L * 0.55, cy + h1 * 1.1 + dy * 0.5, bx, cy + h0);
    p.closePath();
    const sg = ctx.createLinearGradient(bx, cy - h0, bx, cy + h0);
    sg.addColorStop(0, "#A9C566");
    sg.addColorStop(0.42, "#8CAF4C");
    sg.addColorStop(1, "#5E8232");
    ctx.fillStyle = sg;
    ctx.fill(p);
    ctx.strokeStyle = "rgba(70,98,38,0.55)";
    ctx.lineWidth = 1.8;
    ctx.stroke(p);
  }

  const cob = ctx.createLinearGradient(cx, cy - rBig, cx, cy + rBig);
  cob.addColorStop(0, "#E8CE7C");
  cob.addColorStop(0.42, "#D8B75E");
  cob.addColorStop(1, "#A98A42");
  ctx.fillStyle = cob;
  sil(0);
  ctx.fill();

  ctx.save();
  sil(0);
  ctx.clip();
  const COLS = 17;
  const ROWS = 7;
  const kw = ((rx * 2) / COLS) * 0.5;
  const kh = ((rBig * 2) / ROWS) * 0.54;
  for (let r = 0; r < ROWS; r++) {
    const fy = (r + 0.5) / ROWS;
    const shade = Math.min(1, Math.abs(fy - 0.32) * 1.75); // lit band high on the barrel, falls to both rims
    for (let i = 0; i < COLS; i++) {
      const fx = (i + 0.5 + (r % 2 ? 0.5 : 0)) / COLS;
      const x = cx - rx + fx * rx * 2;
      // Rows ride the TAPER, as celery's ribs do. Half-height at this x
      // sets both the row's y and the kernel's size.
      const hh = h(x);
      if (hh <= 0) continue;
      const sq = hh / rBig;
      const yy = y(x) - hh + fy * hh * 2;
      const seed = (r * 131 + i * 7919) % 97;
      const ti = Math.max(
        0,
        Math.min(TONE.length - 1, Math.round(shade * (TONE.length - 1) + ((seed % 5) - 2) * 0.35)),
      );
      ctx.fillStyle = TONE[ti]!;
      ctx.beginPath();
      ctx.ellipse(
        x,
        yy,
        kw * (0.94 + (seed % 7) / 70),
        kh * sq * (0.94 + (seed % 5) / 60),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = `rgba(255,252,224,${(0.34 - shade * 0.22).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(
        x - kw * 0.26,
        yy - kh * sq * 0.3,
        kw * 0.42,
        kh * sq * 0.38,
        -0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.strokeStyle = "rgba(140,102,30,0.22)"; // the gap between kernels
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, yy, kw, kh * sq, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const shade = ctx.createLinearGradient(cx, cy - rBig, cx, cy + rBig);
  shade.addColorStop(0, "rgba(120,88,26,0.22)");
  shade.addColorStop(0.34, "rgba(120,88,26,0)");
  shade.addColorStop(1, "rgba(120,88,26,0.30)");
  ctx.fillStyle = shade;
  sil(0);
  ctx.fill(); // barrel roundness, over the lattice
  const ends = ctx.createLinearGradient(cx - rx, cy, cx - rx * 0.8, cy);
  ends.addColorStop(0, "rgba(246,236,196,0.66)");
  ends.addColorStop(1, "rgba(246,236,196,0)");
  ctx.fillStyle = ends;
  sil(0);
  ctx.fill(); // pale cob stub, butt end
  ctx.restore();

  ctx.strokeStyle = "rgba(146,106,32,0.38)";
  ctx.lineWidth = 1.8;
  sil(0);
  ctx.stroke();
}
