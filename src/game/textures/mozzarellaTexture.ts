/**
 * MOZZARELLA_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.mozzarella()` (source line 6210) against the real `taper`
 * geometry. A hand-formed ovoline, not a featureless sphere: broad soft
 * FOLDS sweeping around the belly where the curd was gathered, low BUMPS
 * between them, each painted as a shadow/light PAIR (never a stroked
 * line — a fold is a change in the surface, not a mark on it), a pinched
 * KNOT at the narrow end (a small proud cap of curd, not a radiating
 * crease glyph), and two specular highlights for the "wet" cue.
 */
import { traceTaperPath, taperY, taperH, type TaperPaintOpts } from "./carrotTexture";

export function mozzarellaTextureSize(
  rx: number,
  rBig: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (rBig + margin) * 2 };
}

export function paintMozzarellaTexture(
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
  const ry = rBig;
  const taperCurve = opts.taperCurve ?? 1;
  const spine = opts.spine ?? 0;
  const spineRx = opts.spineRx ?? rx;
  const yc = (x: number) => taperY(x, cx, cy, spine, spineRx);
  const hAt = (x: number) => taperH(x, cx, rx, rBig, rSmall, buttRound, tipRound, taperCurve);
  const sil = (rrx: number, rrBig: number, rrSmall: number, pad: number) => {
    ctx.beginPath();
    traceTaperPath(ctx, cx, cy, rrx, rrBig, rrSmall, buttRound, tipRound, pad, opts);
  };

  const skin = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, rx * 0.1, cx, cy, rx * 1.1);
  skin.addColorStop(0, "#FFFFFB");
  skin.addColorStop(0.5, "#F7F5EA");
  skin.addColorStop(0.86, "#E4E1D0");
  skin.addColorStop(1, "#CDCAB6");
  ctx.fillStyle = skin;
  sil(rx, rBig, rSmall, 0);
  ctx.fill();

  const curdRBig = rBig - 14;
  const curdRSmall = Math.max(3, rSmall - 14 * 0.6);
  const cg = ctx.createRadialGradient(cx - rx * 0.14, cy - ry * 0.1, rx * 0.06, cx, cy, rx * 0.96);
  cg.addColorStop(0, "#FDFCF4");
  cg.addColorStop(0.62, "#F4F2E6");
  cg.addColorStop(1, "#E7E4D4");
  ctx.save();
  sil(rx, rBig, rSmall, 0);
  ctx.clip();
  ctx.fillStyle = cg;
  sil(rx - 14, curdRBig, curdRSmall, 0);
  ctx.fill();

  ctx.save();
  sil(rx - 14, curdRBig, curdRSmall, 0);
  ctx.clip();

  const foldAt = (
    fx: number,
    fy: number,
    len: number,
    ang: number,
    curveAmt: number,
    str: number,
  ) => {
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(ang);
    const half = len / 2;
    const th = Math.abs(curveAmt);
    const lobe = (offY: number, stops: [number, string][], hh: number) => {
      const gr = ctx.createLinearGradient(0, offY - hh, 0, offY + hh);
      stops.forEach(([o, col]) => gr.addColorStop(o, col));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(0, offY, half, hh, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    lobe(
      th * 0.34,
      [
        [0, "rgba(198,193,169,0)"],
        [0.5, `rgba(198,193,169,${0.26 * str})`],
        [1, "rgba(198,193,169,0)"],
      ],
      th * 0.85,
    );
    lobe(
      -th * 0.52,
      [
        [0, "rgba(255,255,252,0)"],
        [0.5, `rgba(255,255,252,${0.44 * str})`],
        [1, "rgba(255,255,252,0)"],
      ],
      th * 0.7,
    );
    ctx.restore();
  };
  foldAt(cx - rx * 0.26, cy + ry * 0.16, rx * 1.2, -0.22, ry * 0.34, 1.0);
  foldAt(cx + rx * 0.1, cy + ry * 0.52, rx * 1.0, -0.1, ry * 0.26, 0.78);
  foldAt(cx - rx * 0.1, cy - ry * 0.44, rx * 1.05, 0.14, ry * 0.24, 0.66);

  const bump = (bx: number, by: number, rr: number, rot: number, str: number) => {
    // low knobs between the folds
    const lo = ctx.createRadialGradient(bx + rr * 0.34, by + rr * 0.4, rr * 0.05, bx, by, rr);
    lo.addColorStop(0, `rgba(198,193,169,${0.26 * str})`);
    lo.addColorStop(1, "rgba(198,193,169,0)");
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(rot);
    ctx.translate(-bx, -by);
    ctx.fillStyle = lo;
    ctx.beginPath();
    ctx.ellipse(bx, by, rr, rr * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    const hi = ctx.createRadialGradient(
      bx - rr * 0.3,
      by - rr * 0.34,
      rr * 0.04,
      bx - rr * 0.2,
      by - rr * 0.22,
      rr * 0.8,
    );
    hi.addColorStop(0, `rgba(255,255,252,${0.52 * str})`);
    hi.addColorStop(1, "rgba(255,255,252,0)");
    ctx.fillStyle = hi;
    ctx.beginPath();
    ctx.ellipse(bx, by, rr, rr * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  bump(cx - rx * 0.44, cy - ry * 0.16, rx * 0.3, -0.24, 1.0);
  bump(cx + rx * 0.1, cy - ry * 0.02, rx * 0.26, 0.3, 0.82);
  bump(cx - rx * 0.1, cy + ry * 0.44, rx * 0.22, -0.1, 0.7);
  bump(cx + rx * 0.4, cy + ry * 0.22, rx * 0.18, 0.44, 0.6);

  for (let i = 0; i < 14; i++) {
    // whey pockets: small, wet, irregular
    const a = i * 2.399963 + 0.8;
    const r = Math.sqrt(((i * 6151) % 61) / 61);
    const x = cx + Math.cos(a) * rx * 0.58 * r;
    const y = cy + Math.sin(a) * ry * 0.58 * r;
    const rad = 2.0 + 2.6 * (((i * 104729) % 23) / 23);
    ctx.fillStyle = "rgba(222,218,196,0.24)";
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * 0.68, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,252,0.32)";
    ctx.beginPath();
    ctx.ellipse(x - rad * 0.28, y - rad * 0.26, rad * 0.46, rad * 0.32, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(228,224,202,0.18)";
  for (let i = 0; i < 56; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 7919) % 67) / 67);
    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(a) * rx * 0.74 * r,
      cy + Math.sin(a) * ry * 0.74 * r,
      1.5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();

  // THE KNOT at the narrow end — a small CAP of curd sitting proud of the
  // body: one soft crescent shadow across the neck with a lit dome beyond
  // it. Painted inside the silhouette: no span, no piece, no cut sees it.
  const kx = cx + rx * 0.66;
  const ky = yc(kx);
  const kh = hAt(kx) || ry * 0.5;
  ctx.save();
  sil(rx, rBig, rSmall, 0);
  ctx.clip();
  const neck = ctx.createLinearGradient(kx - rx * 0.16, ky, kx + rx * 0.1, ky);
  neck.addColorStop(0, "rgba(206,201,178,0)");
  neck.addColorStop(0.55, "rgba(200,195,171,0.34)");
  neck.addColorStop(1, "rgba(206,201,178,0)");
  ctx.fillStyle = neck;
  ctx.beginPath();
  ctx.ellipse(kx - rx * 0.03, ky, rx * 0.16, kh * 0.98, -0.12, 0, Math.PI * 2);
  ctx.fill();
  const cap = ctx.createRadialGradient(
    kx + rx * 0.16,
    ky - kh * 0.3,
    4,
    kx + rx * 0.2,
    ky,
    rx * 0.3,
  );
  cap.addColorStop(0, "rgba(255,255,253,0.70)");
  cap.addColorStop(0.6, "rgba(255,255,252,0.22)");
  cap.addColorStop(1, "rgba(255,255,252,0)");
  ctx.fillStyle = cap;
  sil(rx, rBig, rSmall, 0);
  ctx.fill();
  ctx.restore();

  const wet = ctx.createRadialGradient(
    cx - rx * 0.36,
    cy - ry * 0.42,
    rx * 0.02,
    cx - rx * 0.32,
    cy - ry * 0.38,
    rx * 0.34,
  );
  wet.addColorStop(0, "rgba(255,255,255,0.92)");
  wet.addColorStop(0.42, "rgba(255,255,255,0.30)");
  wet.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = wet;
  sil(rx, rBig, rSmall, 0);
  ctx.fill(); // tight specular — the "wet" cue

  const wet2 = ctx.createRadialGradient(
    cx + rx * 0.3,
    cy + ry * 0.34,
    rx * 0.04,
    cx + rx * 0.28,
    cy + ry * 0.32,
    rx * 0.42,
  );
  wet2.addColorStop(0, "rgba(255,255,250,0.34)");
  wet2.addColorStop(1, "rgba(255,255,250,0)");
  ctx.fillStyle = wet2;
  sil(rx, rBig, rSmall, 0);
  ctx.fill(); // bounce light, opposite side

  const rim = ctx.createRadialGradient(cx, cy, rx * 0.74, cx, cy, rx * 1.02);
  rim.addColorStop(0, "rgba(188,184,162,0)");
  rim.addColorStop(1, "rgba(188,184,162,0.34)");
  ctx.fillStyle = rim;
  sil(rx, rBig, rSmall, 0);
  ctx.fill();

  ctx.strokeStyle = "rgba(176,172,150,0.40)";
  ctx.lineWidth = 1.6;
  sil(rx, rBig, rSmall, 0);
  ctx.stroke();
}
