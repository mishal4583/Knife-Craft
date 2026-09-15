/**
 * WATERMELON_TEXTURE — ported directly from knifecraft.html's actual
 * `SKIN.watermelon()` (source line 7851, the striped green rind shell)
 * AND `PAINT.watermelon()` ("WATERMELON, PEELED", source line 6929 — an
 * occurrence my first pass through this file missed because its comment
 * block and the function itself share one source line, which is on me,
 * not the file — the pale inner rind ring + red seeded flesh).
 * Watermelon is one of the source's exactly-three real peelable foods
 * (`peelable = SKIN && !SKIN_KEEP` — see knifecraft.html's own
 * peel-mechanics doc), and production's pre-existing generic
 * rub-to-peel system (`this.peeled`, same one Onion/Potato/Garlic
 * already use) now drives it directly: unpeeled paints ONLY the real
 * striped shell (fully opaque, no flesh anywhere), peeled paints ONLY
 * the real rind+flesh cross-section — a discrete swap on
 * `completePeel()`, not the source's continuous alpha fade, which
 * production's single-canvas-per-piece architecture has no equivalent
 * for.
 */
export function watermelonTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintWatermelonTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  // Watermelon has no `EllipseModOpts` of its own (a plain ellipse) —
  // this slot exists only so the call site can share EllipseRenderer's
  // one shared (ctx,rx,ry,margin,opts,peeled) signature with every other
  // ellipse ingredient; always undefined in practice.
  _opts?: unknown,
  peeled = false,
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const sil = () => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  };

  if (peeled) {
    // --- "WATERMELON, PEELED": the real pale inner rind + red seeded flesh ---
    const fleshRx = rx - 26;
    const fleshRy = ry - 26;
    const rg = ctx.createRadialGradient(cx, cy, rx * 0.2, cx, cy, rx * 0.95);
    rg.addColorStop(0, "#F3F8E4");
    rg.addColorStop(1, "#D6E4B4");
    ctx.fillStyle = rg;
    sil();
    ctx.fill();
    const fg = ctx.createRadialGradient(cx - rx * 0.1, cy - ry * 0.1, rx * 0.1, cx, cy, rx * 0.9);
    fg.addColorStop(0, "#F9576A");
    fg.addColorStop(0.6, "#EF3D52");
    fg.addColorStop(1, "#D22A3E");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(cx, cy, fleshRx, fleshRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, fleshRx, fleshRy, 0, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < 60; i++) {
      const a = i * 2.399963;
      const r = Math.sqrt(((i * 6151) % 73) / 73);
      ctx.fillStyle = i % 2 ? "rgba(255,255,240,0.06)" : "rgba(150,10,26,0.08)";
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * rx * 0.7 * r, cy + Math.sin(a) * ry * 0.7 * r, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 17; i++) {
      // seeds: sparse, individually rotated
      const a = i * 2.399963 + 0.6;
      const r = Math.sqrt(((i * 104729) % 31) / 31) * 0.74;
      const x = cx + Math.cos(a) * rx * r;
      const y = cy + Math.sin(a) * ry * r;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a * 1.3);
      ctx.fillStyle = "#241408";
      ctx.beginPath();
      ctx.ellipse(0, 0, 6.4, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,240,210,0.35)";
      ctx.beginPath();
      ctx.ellipse(-1.6, -0.8, 2.4, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(120,146,84,0.55)";
    ctx.lineWidth = 2.2;
    sil();
    ctx.stroke();
    return;
  }

  // --- SKIN.watermelon: the striped green rind shell (unpeeled, fully opaque) ---
  const base = ctx.createRadialGradient(
    cx - rx * 0.3,
    cy - ry * 0.36,
    rx * 0.08,
    cx,
    cy,
    rx * 1.16,
  );
  base.addColorStop(0, "#96C544");
  base.addColorStop(0.44, "#72A834");
  base.addColorStop(0.82, "#4A8A2C");
  base.addColorStop(1, "#255E22");
  ctx.fillStyle = base;
  sil();
  ctx.fill();

  ctx.save();
  sil();
  ctx.clip();
  const N = 11;
  const STEPS = 18;
  for (let i = 0; i < N; i++) {
    const fx = -0.94 + i * (1.88 / (N - 1));
    const rnd = (k: number) => ((i * 7919 + k * 104729) % 97) / 97;
    const w = (13 + 11 * rnd(3)) * (1 - 0.42 * Math.abs(fx));
    const bow = fx * 0.09;
    ctx.fillStyle = i % 2 ? "rgba(20,54,20,0.74)" : "rgba(26,64,26,0.56)";
    ctx.beginPath();
    for (let s = 0; s <= STEPS; s++) {
      const t = s / STEPS;
      const y = cy + (t * 2 - 1) * ry * 1.03;
      const cxs = cx + (fx + bow * Math.sin(t * Math.PI)) * rx;
      const hw = w * (0.3 + 0.7 * Math.sin(t * Math.PI)) * (0.7 + 0.6 * rnd(s + 1));
      if (s === 0) ctx.moveTo(cxs - hw, y);
      else ctx.lineTo(cxs - hw, y);
    }
    for (let s = STEPS; s >= 0; s--) {
      const t = s / STEPS;
      const y = cy + (t * 2 - 1) * ry * 1.03;
      const cxs = cx + (fx + bow * Math.sin(t * Math.PI)) * rx;
      const hw = w * (0.3 + 0.7 * Math.sin(t * Math.PI)) * (0.7 + 0.6 * rnd(s + 40));
      ctx.lineTo(cxs + hw, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "rgba(30,70,26,0.13)"; // matte rind grain, sparse
  for (let i = 0; i < 150; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 6151) % 89) / 89);
    ctx.beginPath();
    ctx.ellipse(
      cx + Math.cos(a) * rx * 0.94 * r,
      cy + Math.sin(a) * ry * 0.94 * r,
      2.6 + 2.2 * (((i * 104729) % 23) / 23),
      1.8 + 1.6 * (((i * 7919) % 17) / 17),
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const sheen = ctx.createRadialGradient(
    cx - rx * 0.34,
    cy - ry * 0.42,
    rx * 0.02,
    cx - rx * 0.3,
    cy - ry * 0.36,
    rx * 0.52,
  );
  sheen.addColorStop(0, "rgba(232,248,196,0.34)");
  sheen.addColorStop(1, "rgba(232,248,196,0)");
  ctx.fillStyle = sheen;
  sil();
  ctx.fill();
  const shade = ctx.createRadialGradient(
    cx,
    cy,
    rx * 0.62,
    cx + rx * 0.1,
    cy + ry * 0.16,
    rx * 1.06,
  );
  shade.addColorStop(0, "rgba(14,44,16,0)");
  shade.addColorStop(1, "rgba(12,40,14,0.46)");
  ctx.fillStyle = shade;
  sil();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(16,44,16,0.52)";
  ctx.lineWidth = 2.4;
  sil();
  ctx.stroke();
}
