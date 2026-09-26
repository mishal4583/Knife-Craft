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
  // Discrepancy #1's close-out: Pumpkin gains real Peel support — full-
  // body rind-vs-flesh color swap, same mandatory-first convention as
  // Onion/Potato (see EllipseRenderer.paint's own doc). `_hasCut` stays
  // unused: Pumpkin isn't a SKIN_KEEP ingredient (there's no separate
  // cut-face reveal here — Peel alone swaps the whole body).
  peeled = false,
  _hasCut = false,
  // `overhangGone` — see PreparationScene.ts's EllipseRenderer.paint own
  // doc. True once `this.cuts.length > 0`; gates the stem below, ported
  // from knifecraft.html's `paintPumpkinStem` (a short, thick, woody
  // stump past the crown well) so it sheds on the first cut. The source
  // draws this on a dedicated live "over" pass on top of every piece;
  // production has no such pass, so it's baked as ordinary pre-cut
  // cosmetic paint instead — same discrete-repaint convention every other
  // overhang ingredient in this file's sibling textures uses.
  overhangGone = false,
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
  // Unpeeled: the orange rind. Peeled: the exposed orange/yellow flesh
  // underneath — a paler, less saturated version of the same hue family
  // (never white/grey, still unmistakably pumpkin) — same lobe/scallop
  // silhouette and meridian-band structure either way (§4/§5 of this
  // task: only the outer skin color changes, not the geometry).
  if (!peeled) {
    body.addColorStop(0, "#FFC356");
    body.addColorStop(0.28, "#FBA22B");
    body.addColorStop(0.58, "#F3820F");
    body.addColorStop(0.84, "#E5750C");
    body.addColorStop(1, "#C85E06");
  } else {
    body.addColorStop(0, "#FFE9A8");
    body.addColorStop(0.28, "#FFD670");
    body.addColorStop(0.58, "#FCC246");
    body.addColorStop(0.84, "#F5AC2E");
    body.addColorStop(1, "#E0961E");
  }
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
  // would run a tan hairline straight across the green stem. Peeled: a
  // paler flesh-edge tone instead of the rind's own darker tan line.
  ctx.strokeStyle = peeled ? "rgba(214,140,40,0.26)" : "rgba(152,66,8,0.30)";
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

  // STEM — short, thick and woody, hanging past the crown well (the
  // overhang). Ported from paintPumpkinStem's spine/taper/wobble math;
  // the source draws this on a dedicated live "over" pass clear of the
  // silhouette clip, so it's drawn here unclipped too, after `sil`'s own
  // clip region above has been restored away.
  if (!overhangGone) {
    // Widths track food scale, exactly as the source's own `K = g.rx/152`
    // does (152 being the source's own authored rx for Pumpkin) — without
    // this the stem's absolute pixel widths (calibrated for that specific
    // authored size) read as a fat stub rather than a slender stem at
    // production's own (much smaller) rx.
    const K = rx / 152;
    const bx = cx + 4;
    const by = cy - ry * 0.94;
    const RISE = ry * 0.9;
    const LEAN = rx * 0.8;
    const spine: [number, number][] = [
      [bx, by],
      [bx + LEAN * 0.02, by - RISE * 0.46],
      [bx - LEAN * 0.4, by - RISE * 0.88],
      [bx - LEAN, by - RISE],
    ];
    const wid = [30 * K, 18.5 * K, 14 * K, 10.5 * K];
    const wob = (t: number, ph: number) =>
      1 +
      0.048 * Math.sin(t * 8.4 + ph) +
      0.028 * Math.sin(t * 15.1 + ph * 2.3) -
      0.018 * Math.sin(t * 23.7 + ph * 0.7);
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    const mid: [number, number, number][] = [];
    for (let s = 0; s <= 30; s++) {
      const t = s / 30;
      const u = 1 - t;
      const [x0, y0] = spine[0]!;
      const [x1, y1] = spine[1]!;
      const [x2, y2] = spine[2]!;
      const [x3, y3] = spine[3]!;
      const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
      const y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
      const dx = 3 * (u * u * (x1 - x0) + 2 * u * t * (x2 - x1) + t * t * (x3 - x2));
      const dy = 3 * (u * u * (y1 - y0) + 2 * u * t * (y2 - y1) + t * t * (y3 - y2));
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L;
      const ny = dx / L;
      const w =
        wid[0]! +
        (wid[3]! - wid[0]!) * Math.pow(t, 0.72) +
        17 * K * Math.pow(Math.max(0, 1 - t / 0.2), 2.2);
      const wl = w * wob(t, 0.4);
      const wr = w * wob(t, 2.9);
      left.push([x + nx * wl, y + ny * wl]);
      right.push([x - nx * wr, y - ny * wr]);
      mid.push([x, y, w]);
    }
    const jw = mid[0]![2];
    const ba = Math.atan2(mid[1]![1] - mid[0]![1], mid[1]![0] - mid[0]![0]);
    const stem = new Path2D();
    stem.moveTo(left[0]![0], left[0]![1]);
    for (const p of left) stem.lineTo(p[0], p[1]);
    for (let s = right.length - 1; s >= 0; s--) stem.lineTo(right[s]![0], right[s]![1]);
    stem.ellipse(bx, by, jw * 0.42, jw, ba, -Math.PI / 2, Math.PI / 2, true);
    stem.closePath();

    ctx.save();
    ctx.clip(sil);
    const sx0 = bx + jw * 0.3;
    const sy0 = by + jw * 0.62;
    const jg = ctx.createRadialGradient(sx0, sy0, 2, sx0, sy0, jw * 2.0);
    jg.addColorStop(0, "rgba(72,26,2,0.34)");
    jg.addColorStop(0.46, "rgba(92,34,4,0.17)");
    jg.addColorStop(1, "rgba(92,34,4,0)");
    ctx.fillStyle = jg;
    ctx.save();
    ctx.translate(sx0, sy0);
    ctx.scale(1, 0.46);
    ctx.translate(-sx0, -sy0);
    ctx.beginPath();
    ctx.arc(sx0, sy0, jw * 2.0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    const stg = ctx.createLinearGradient(bx - jw * 1.1, by - RISE, bx + jw * 1.2, by);
    stg.addColorStop(0, "#7C8A4E");
    stg.addColorStop(0.22, "#5E7238");
    stg.addColorStop(0.55, "#42562A");
    stg.addColorStop(0.82, "#374A24");
    stg.addColorStop(1, "#2E3F1F");
    ctx.fillStyle = stg;
    ctx.fill(stem);

    ctx.save();
    ctx.clip(stem);
    ctx.lineCap = "round";
    for (let k = 0; k < 6; k++) {
      const f0 = 0.09 + k * 0.165;
      const ph = 1.7 + k * 2.1;
      const amp = 0.02 + (0.014 * ((k * 37) % 5)) / 5;
      const lit = f0 < 0.42;
      const run = (off: number, col: string, wd: number) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = wd;
        ctx.beginPath();
        for (let s = 0; s < left.length; s++) {
          const t = s / (left.length - 1);
          const f = Math.min(0.97, Math.max(0.03, f0 + off + amp * Math.sin(t * 5.6 + ph)));
          const a = left[s]!;
          const b = right[s]!;
          const x = a[0] + (b[0] - a[0]) * f;
          const y = a[1] + (b[1] - a[1]) * f;
          if (s) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
      };
      run(
        0,
        `rgba(18,30,10,${(0.4 + (0.12 * ((k * 53) % 3)) / 3).toFixed(2)})`,
        3.2 + ((k * 29) % 3) * 0.8,
      );
      run(lit ? 0.05 : -0.05, lit ? "rgba(214,230,158,0.34)" : "rgba(126,148,80,0.26)", 2.1);
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(30,42,20,0.4)";
    ctx.lineWidth = 1.4;
    ctx.stroke(stem);
  }
}
