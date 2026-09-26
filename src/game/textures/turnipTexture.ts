/**
 * TURNIP_TEXTURE — ported directly from knifecraft.html's actual
 * `SKIN.turnip()` (source line 7568) — the source's PERMANENT skin layer,
 * which is genuinely the whole visible root (a separate, undocumented
 * "TURNIP BASE"/`PAINT.turnip()` exists at line 7481, but its own comment
 * says it's just the ivory ground SKIN.turnip paints over, never seen on
 * its own — so this, not that, is the real ported visual). The magenta
 * cap is NOT a gradient stop (a hard/soft stop reads as a printed band):
 * five nested wobbly washes at rising opacity ramp to near-solid at the
 * crown and fade to nothing by the waist, over fine vertical striations,
 * a sheen, a glare, and a base shade.
 *
 * The source's taproot + leaf stalks are a bezier-ribbon system drawn
 * PAST the silhouette (source's own SKIN.turnip, line ~9109) — the
 * prototype's declared overhang for Turnip (`geom.overhang`), so it now
 * ships here too, ported directly from that same bezier/profile math,
 * gated on `overhangGone` (see PreparationScene.ts's EllipseRenderer.paint
 * own doc) so it sheds on the first cut. The crown scar the stalks leave
 * (permanent, inside the silhouette) is unaffected.
 *
 * Discrepancy #1's close-out: `peeled` gates the magenta crown wash — the
 * one part of this paint that's genuinely the outer skin. Unpeeled shows
 * all four washes (the crown-to-waist magenta cap); peeled skips them
 * entirely, leaving the same pale ivory base gradient bare as the clean
 * inner flesh (§4: "lighter clean inner flesh, preserve root shape") —
 * same convention as Onion/Potato's own mandatory-first full-body swap.
 */
export function turnipTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintTurnipTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  // Turnip has no `EllipseModOpts` of its own — this slot exists only so
  // the call site can share EllipseRenderer.paint's one (ctx,rx,ry,
  // margin,opts,peeled,hasCut,overhangGone) signature with every other
  // ellipse ingredient.
  _opts?: unknown,
  // Discrepancy #1's close-out: Turnip gains real Peel support —
  // mandatory-first, same convention as Onion/Potato (see
  // EllipseRenderer.paint's own doc). `_hasCut` stays unused: Turnip
  // isn't a SKIN_KEEP ingredient — Peel alone swaps the whole body.
  peeled = false,
  _hasCut = false,
  // `overhangGone` — see PreparationScene.ts's EllipseRenderer.paint own
  // doc. True once `this.cuts.length > 0`; gates the taproot + leaf
  // stalks below so they actually shed on the first cut.
  overhangGone = false,
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const sil = () => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  };

  const base = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
  base.addColorStop(0, "#F8F1E3");
  base.addColorStop(0.52, "#F7ECDB");
  base.addColorStop(0.84, "#EFE0C6");
  base.addColorStop(1, "#E2CFAE");
  ctx.fillStyle = base;
  sil();
  ctx.fill();

  ctx.save();
  sil();
  ctx.clip();

  // everything above a wandering line at height fraction k (of ry, from center)
  const capTo = (k: number): Path2D => {
    const p = new Path2D();
    const N = 48;
    const X = rx + 10;
    p.moveTo(cx - X, cy - ry - 10);
    p.lineTo(cx + X, cy - ry - 10);
    for (let i = N; i >= 0; i--) {
      const u = -1 + (2 * i) / N;
      const yb =
        cy + ry * (k + 0.085 * Math.sin(u * 3.3 + 1.2) + 0.045 * Math.sin(u * 6.7 + 0.3) + 0.3 * u);
      p.lineTo(cx + X * u, yb);
    }
    p.closePath();
    return p;
  };
  const wash = (k: number, rgb: string, a0: number) => {
    // solid at the crown, gone by its own boundary
    const lg = ctx.createLinearGradient(cx, cy - ry * 1.02, cx, cy + ry * k);
    lg.addColorStop(0, `rgba(${rgb},${a0})`);
    lg.addColorStop(0.55, `rgba(${rgb},${(a0 * 0.72).toFixed(2)})`);
    lg.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = lg;
    ctx.fill(capTo(k));
  };
  // The magenta cap IS the outer skin — a real peeled turnip's crown has
  // none of it, just the clean pale flesh the base gradient above already
  // paints (§4: "lighter clean inner flesh, preserve root shape").
  if (!peeled) {
    wash(0.3, "190,58,146", 0.6);
    wash(0.14, "186,50,142", 0.54);
    wash(-0.08, "176,42,134", 0.46);
    wash(-0.44, "150,34,120", 0.32);
  }

  ctx.lineWidth = 1.4; // fine vertical striations, both zones
  for (let i = 0; i < 46; i++) {
    const u = -0.94 + (1.88 * ((i * 7919) % 97)) / 97;
    const x = cx + rx * u;
    const hh = ((i * 6151) % 89) / 89;
    const y0 = cy - ry * (0.9 - 0.62 * hh);
    const y1 = y0 + ry * (0.16 + 0.26 * hh);
    ctx.strokeStyle = y0 < cy - ry * 0.06 ? "rgba(255,240,250,0.07)" : "rgba(202,168,112,0.09)";
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.quadraticCurveTo(x + 2, (y0 + y1) / 2, x, y1);
    ctx.stroke();
  }
  const sheen = ctx.createRadialGradient(
    cx - rx * 0.36,
    cy - ry * 0.46,
    2,
    cx - rx * 0.36,
    cy - ry * 0.46,
    rx * 0.76,
  );
  sheen.addColorStop(0, "rgba(255,244,252,0.34)");
  sheen.addColorStop(0.5, "rgba(255,244,252,0.12)");
  sheen.addColorStop(1, "rgba(255,244,252,0)");
  ctx.fillStyle = sheen;
  sil();
  ctx.fill();
  const gl = ctx.createLinearGradient(cx + rx * 0.3, cy - ry * 0.52, cx + rx * 0.66, cy + ry * 0.1);
  gl.addColorStop(0, "rgba(255,246,252,0)");
  gl.addColorStop(0.5, "rgba(255,246,252,0.26)");
  gl.addColorStop(1, "rgba(255,246,252,0)");
  ctx.fillStyle = gl;
  sil();
  ctx.fill();
  const shade = ctx.createLinearGradient(
    cx - rx * 0.4,
    cy + ry * 0.34,
    cx - rx * 0.1,
    cy + ry * 1.02,
  );
  shade.addColorStop(0, "rgba(122,96,58,0)");
  shade.addColorStop(1, "rgba(122,96,58,0.30)");
  ctx.fillStyle = shade;
  sil();
  ctx.fill();
  ctx.restore();

  const bx = cx + 26;
  const by = cy - ry * 0.93;

  // TAPROOT + GREENS, past the outline — the overhang. Ported from
  // SKIN.turnip's own bezier-ribbon taproot and leaf/stalk system.
  if (!overhangGone) {
    const rP: [number, number][] = [
      [cx - 6, cy + ry * 0.96],
      [cx - 12, cy + ry * 1.12],
      [cx - 30, cy + ry * 1.2],
      [cx - 56, cy + ry * 1.42],
    ];
    const rL: [number, number][] = [];
    const rR: [number, number][] = [];
    const rPt: [number, number][] = [];
    for (let s = 0; s <= 20; s++) {
      const t = s / 20;
      const u = 1 - t;
      const [x0, y0] = rP[0]!;
      const [x1, y1] = rP[1]!;
      const [x2, y2] = rP[2]!;
      const [x3, y3] = rP[3]!;
      const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
      const y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
      const dx = 3 * (u * u * (x1 - x0) + 2 * u * t * (x2 - x1) + t * t * (x3 - x2));
      const dy = 3 * (u * u * (y1 - y0) + 2 * u * t * (y2 - y1) + t * t * (y3 - y2));
      const L = Math.hypot(dx, dy) || 1;
      const w = 10 * Math.pow(1 - t, 1.4) + 1.1;
      rL.push([x - (dy / L) * w, y + (dx / L) * w]);
      rR.push([x + (dy / L) * w, y - (dx / L) * w]);
      rPt.push([x, y]);
    }
    const rt = new Path2D();
    rt.moveTo(rL[0]![0], rL[0]![1]);
    for (const p of rL) rt.lineTo(p[0], p[1]);
    for (let s = rR.length - 1; s >= 0; s--) rt.lineTo(rR[s]![0], rR[s]![1]);
    rt.closePath();
    const rg2 = ctx.createLinearGradient(cx - 40, cy + ry * 1.3, cx + 6, cy + ry * 0.8);
    rg2.addColorStop(0, "#DCCDA8");
    rg2.addColorStop(0.55, "#EFE3C8");
    rg2.addColorStop(1, "#F7EEDA");
    ctx.fillStyle = rg2;
    ctx.fill(rt);
    ctx.strokeStyle = "rgba(168,142,100,0.42)";
    ctx.lineWidth = 1;
    ctx.stroke(rt);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(182,158,116,0.55)";
    ctx.lineWidth = 0.9;
    for (const [k, a] of [
      [9, 2.2],
      [13, 2.7],
      [16, 1.8],
    ] as const) {
      const p = rPt[k]!;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[0] + Math.cos(a) * 10, p[1] + Math.sin(a) * 10);
      ctx.stroke();
    }

    const leaf = (x: number, y: number, ang: number, len: number, wid: number) => {
      const N = 30;
      const pts: [number, number][] = [];
      const prof = (t: number) => Math.sin(Math.PI * Math.pow(t, 0.9)) * Math.min(1, t / 0.16);
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        pts.push([
          t * len,
          -prof(t) *
            wid *
            (1 + 0.15 * Math.sin(t * Math.PI * 5.5) + 0.07 * Math.sin(t * Math.PI * 9 + 1.1)),
        ]);
      }
      for (let i = N; i >= 0; i--) {
        const t = i / N;
        pts.push([
          t * len,
          prof(t) *
            wid *
            (1 + 0.15 * Math.sin(t * Math.PI * 5.5 + 2.3) + 0.07 * Math.sin(t * Math.PI * 9 + 0.4)),
        ]);
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      const p = new Path2D();
      pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])));
      p.closePath();
      const lg = ctx.createLinearGradient(0, -wid, len, wid);
      lg.addColorStop(0, "#BEDA7C");
      lg.addColorStop(0.55, "#96C356");
      lg.addColorStop(1, "#7CAC40");
      ctx.fillStyle = lg;
      ctx.fill(p);
      ctx.strokeStyle = "rgba(78,114,36,0.40)";
      ctx.lineWidth = 1.1;
      ctx.stroke(p);
      ctx.save();
      ctx.clip(p);
      ctx.strokeStyle = "rgba(238,248,206,0.55)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      ctx.strokeStyle = "rgba(112,150,58,0.38)";
      ctx.lineWidth = 1;
      for (let k = 1; k <= 5; k++) {
        const t = k / 6;
        const pw = prof(t) * wid * 0.9;
        ctx.beginPath();
        ctx.moveTo(t * len, 0);
        ctx.lineTo(t * len + len * 0.14, -pw);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(t * len, 0);
        ctx.lineTo(t * len + len * 0.14, pw);
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    };

    const stalk = (qx: number, qy: number, ex: number, ey: number, w: number) => {
      for (const [lw, col] of [
        [w + 2.2, "rgba(96,126,44,0.45)"],
        [w, null],
      ] as const) {
        if (col) ctx.strokeStyle = col;
        else {
          const sg = ctx.createLinearGradient(bx, by, ex, ey);
          sg.addColorStop(0, "#DCE7AE");
          sg.addColorStop(0.5, "#BAD37E");
          sg.addColorStop(1, "#9CC160");
          ctx.strokeStyle = sg;
        }
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(qx, qy, ex, ey);
        ctx.stroke();
      }
    };
    stalk(bx + 40, by - 46, bx + 58, by - 62, 8.5);
    stalk(bx + 52, by - 16, bx + 92, by - 14, 8);
    stalk(bx + 26, by - 58, bx + 34, by - 84, 7.2);
    leaf(bx + 58, by - 62, -0.62, 54, 22);
    leaf(bx + 92, by - 14, -0.12, 50, 20);
    leaf(bx + 34, by - 84, -1.02, 48, 19);
  }

  // the tan crown scar the leaf stalks leave from — permanent, inside the silhouette
  ctx.save();
  sil();
  ctx.clip();
  const scar = ctx.createRadialGradient(bx, by + 2, 1, bx, by + 2, 17);
  scar.addColorStop(0, "rgba(198,166,110,0.70)");
  scar.addColorStop(0.62, "rgba(186,152,98,0.34)");
  scar.addColorStop(1, "rgba(186,152,98,0)");
  ctx.fillStyle = scar;
  ctx.beginPath();
  ctx.ellipse(bx, by + 2, 17, 9, -0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Unpeeled: a magenta-tinted rind edge. Peeled: a neutral tan edge —
  // no skin color left to tint it.
  ctx.strokeStyle = peeled ? "rgba(168,140,96,0.24)" : "rgba(150,90,140,0.26)";
  ctx.lineWidth = 1.4;
  sil();
  ctx.stroke();
}
