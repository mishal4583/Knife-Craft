/**
 * PUMPKIN_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.pumpkin()` (source line 7398) against the real scalloped
 * `ellipse` geometry (`scallop`/`lobes` — see PUMPKIN_GEOMETRY's own doc
 * in definitions.ts, and `traceEllipsePath`/`makeEllipseSilhouette`'s own
 * `EllipseModOpts` doc in ingredientShapes.ts). Each of the 9 lobes is a
 * real meridian band (swept in latitude, not a flat crease line) with its
 * own gradient favoring the lit side, a wet gloss patch on lit ribs, a
 * soft/hard/lit seam trio between neighbours, a crown well the stem sits
 * down inside, and an underside vignette.
 */
import { traceEllipsePath, type EllipseModOpts } from "../ingredientShapes";

export function pumpkinTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintPumpkinTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  opts: EllipseModOpts = {},
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const scallop = opts.scallop ?? 0;
  const N = opts.lobes ?? 9;
  const LAT = 26;
  const sil = new Path2D();
  traceEllipsePath(sil, cx, cy, rx, ry, 0, opts);

  const body = ctx.createRadialGradient(
    cx - rx * 0.34,
    cy - ry * 0.54,
    rx * 0.06,
    cx + rx * 0.1,
    cy + ry * 0.3,
    rx * 1.24,
  );
  body.addColorStop(0, "#FFC356");
  body.addColorStop(0.28, "#FBA22B");
  body.addColorStop(0.58, "#F3820F");
  body.addColorStop(0.84, "#E5750C");
  body.addColorStop(1, "#C85E06");
  ctx.fillStyle = body;
  ctx.fill(sil);

  ctx.save();
  ctx.clip(sil);

  const vf = (u: number): number => {
    const uu = Math.max(-1, Math.min(1, u));
    return 1 + scallop * (1 - 0.62 * uu * uu) * Math.cos(2 * N * Math.asin(uu));
  };
  const uAt = (i: number): number => Math.sin(-Math.PI / 2 + (Math.PI * i) / N);
  const mer = (u: number): [number, number][] => {
    const p: [number, number][] = [];
    for (let k = 0; k <= LAT; k++) {
      const lat = -Math.PI / 2 + (Math.PI * k) / LAT;
      const c = Math.cos(lat);
      p.push([cx + rx * u * c, cy + ry * Math.sin(lat) * vf(u * c)]);
    }
    return p;
  };
  const M: [number, number][][] = [];
  for (let i = 0; i <= N; i++) M.push(mer(uAt(i)));

  for (let k = 0; k < N; k++) {
    const A = M[k]!;
    const B = M[k + 1]!;
    const p = new Path2D();
    p.moveTo(A[0]![0], A[0]![1]);
    for (const q of A) p.lineTo(q[0], q[1]);
    for (let i = B.length - 1; i >= 0; i--) p.lineTo(B[i]![0], B[i]![1]);
    p.closePath();
    const xa = cx + rx * uAt(k);
    const xb = cx + rx * uAt(k + 1);
    const uc = (uAt(k) + uAt(k + 1)) / 2;
    const lit = Math.max(0, 1 - Math.abs(uc + 0.4) / 1.12);
    const w = Math.max(7, xb - xa);
    const lg = ctx.createLinearGradient(xa, 0, xa + w, 0);
    lg.addColorStop(0, "rgba(152,62,4,0.34)");
    lg.addColorStop(0.16, "rgba(204,92,12,0.09)");
    lg.addColorStop(
      0.46,
      `rgba(255,${Math.round(192 + 42 * lit)},${Math.round(106 + 62 * lit)},${(0.07 + 0.23 * lit).toFixed(2)})`,
    );
    lg.addColorStop(0.78, "rgba(204,92,12,0.08)");
    lg.addColorStop(1, "rgba(152,62,4,0.36)");
    ctx.fillStyle = lg;
    ctx.fill(p);
    if (lit > 0.5) {
      // the photo's broad wet gloss: one patch per lit rib
      const gx = (xa + xb) / 2;
      const gy = cy - ry * 0.32;
      const rr = Math.max(13, w * 0.6);
      const sp = ctx.createRadialGradient(gx, gy, 1, gx, gy, rr);
      sp.addColorStop(0, `rgba(255,246,224,${(0.34 * lit).toFixed(2)})`);
      sp.addColorStop(1, "rgba(255,246,224,0)");
      ctx.fillStyle = sp;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.scale(1, 2.4);
      ctx.translate(-gx, -gy);
      ctx.beginPath();
      ctx.arc(gx, gy, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  for (let i = 1; i < N; i++) {
    // seam: soft shadow, hard crease, then a lit ridge
    const A = M[i]!;
    const line = (off: number, col: string, wd: number) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = wd;
      ctx.beginPath();
      for (let k = 0; k < A.length; k++) {
        const q = A[k]!;
        if (k) ctx.lineTo(q[0] + off, q[1]);
        else ctx.moveTo(q[0] + off, q[1]);
      }
      ctx.stroke();
    };
    line(0, "rgba(150,60,4,0.12)", 13);
    line(0, "rgba(138,54,4,0.32)", 2.8);
    if (uAt(i) < 0.36) line(-4.2, "rgba(255,220,158,0.26)", 2.2);
  }
  const sheen = ctx.createRadialGradient(
    cx - rx * 0.32,
    cy - ry * 0.46,
    2,
    cx - rx * 0.32,
    cy - ry * 0.46,
    rx * 0.72,
  );
  sheen.addColorStop(0, "rgba(255,226,170,0.26)");
  sheen.addColorStop(0.55, "rgba(255,226,170,0.10)");
  sheen.addColorStop(1, "rgba(255,226,170,0)");
  ctx.fillStyle = sheen;
  ctx.fill(sil);
  for (let i = 0; i < 70; i++) {
    // the photo's faint pale surface streaks
    const h1 = ((i * 7919) % 97) / 97;
    const h2 = ((i * 6151) % 89) / 89;
    ctx.strokeStyle = `rgba(255,238,206,${(0.04 + 0.06 * h2).toFixed(2)})`;
    ctx.lineWidth = 0.9;
    const x = cx + (h1 - 0.5) * rx * 1.9;
    const y = cy + (h2 - 0.5) * ry * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (h2 - 0.5) * 8, y + 10 + 16 * h1);
    ctx.stroke();
  }
  const wx = cx + 4; // the crown well the stem sits down inside
  const wy = cy - ry * 0.94;
  // ONE point owns the join: the well, the contact shadow, the flare
  // creases and the stem's first spine control all read from (wx,wy).
  const wg = ctx.createRadialGradient(wx, wy, 2, wx, wy, rx * 0.34);
  wg.addColorStop(0, "rgba(110,44,4,0.52)");
  wg.addColorStop(0.52, "rgba(134,56,6,0.22)");
  wg.addColorStop(1, "rgba(134,56,6,0)");
  ctx.fillStyle = wg;
  ctx.save();
  ctx.translate(wx, wy);
  ctx.scale(1, 0.4);
  ctx.translate(-wx, -wy);
  ctx.beginPath();
  ctx.arc(wx, wy, rx * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The shell's rim goes down HERE, before the stem: stroked last it
  // would run a tan hairline straight across the green stem.
  ctx.strokeStyle = "rgba(152,66,8,0.30)";
  ctx.lineWidth = 1.4;
  ctx.stroke(sil);
  const under = ctx.createLinearGradient(cx, cy + ry * 0.14, cx, cy + ry * 1.02);
  under.addColorStop(0, "rgba(120,46,4,0)");
  under.addColorStop(1, "rgba(120,46,4,0.32)");
  ctx.fillStyle = under;
  ctx.fill(sil);
  ctx.strokeStyle = "rgba(140,56,6,0.12)";
  ctx.lineWidth = 14;
  ctx.stroke(sil);
  ctx.restore();
}
