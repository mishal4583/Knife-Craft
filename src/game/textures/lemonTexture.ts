/**
 * LEMON_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.lemon()` (source line 5603) against the real `ellipse` geometry.
 * Three concentric layers via inset ellipses: golden rind with a
 * deterministic peel-pore scatter (kept to the outer band only), a white
 * PITH ring (the load-bearing layer — without it a cut reads as melon,
 * not citrus), then radial-segment flesh with juice-vesicle lines and a
 * bright membrane between each of the 9 segments, plus a small central
 * pith dot and one soft highlight.
 */
export function lemonTextureSize(rx: number, ry: number, margin: number): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintLemonTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const sil = (rrx: number, rry: number) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rrx, rry, 0, 0, Math.PI * 2);
  };

  const rind = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.36, rx * 0.16, cx, cy, rx * 1.1);
  rind.addColorStop(0, "#F9E066");
  rind.addColorStop(0.58, "#EFC732");
  rind.addColorStop(1, "#C99A1E");
  ctx.fillStyle = rind;
  sil(rx, ry);
  ctx.fill();

  ctx.save();
  sil(rx, ry);
  ctx.clip(); // peel pores, kept to the outer band only
  ctx.fillStyle = "rgba(150,112,16,0.16)";
  for (let i = 0; i < 120; i++) {
    const a = i * 2.399963; // golden angle: even, deterministic scatter
    const r = 0.8 + 0.19 * (((i * 7919) % 97) / 97);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const pithRx = rx - 11; // the white layer — without it a cut reads as melon
  const pithRy = ry - 11;
  ctx.fillStyle = "#FBF6DE";
  sil(pithRx, pithRy);
  ctx.fill();

  const fleshRx = rx - 17;
  const fleshRy = ry - 17;
  const fg = ctx.createRadialGradient(cx - rx * 0.2, cy - ry * 0.24, rx * 0.1, cx, cy, rx * 0.9);
  fg.addColorStop(0, "#FDF3B4");
  fg.addColorStop(0.7, "#F8E68C");
  fg.addColorStop(1, "#EFD669");
  ctx.fillStyle = fg;
  sil(fleshRx, fleshRy);
  ctx.fill();

  ctx.save();
  sil(fleshRx, fleshRy);
  ctx.clip();
  const SEG = 9;
  for (let s = 0; s < SEG; s++) {
    const a0 = (s / SEG) * Math.PI * 2 + 0.22;
    ctx.strokeStyle = "rgba(255,255,255,0.20)"; // juice vesicles within the segment
    ctx.lineWidth = 1;
    for (let k = 1; k <= 5; k++) {
      const a = a0 + ((Math.PI * 2) / SEG) * (k / 6);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rx * 0.14, cy + Math.sin(a) * ry * 0.14);
      ctx.lineTo(cx + Math.cos(a) * rx * 0.8, cy + Math.sin(a) * ry * 0.8);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(252,248,222,0.92)"; // the membrane between segments
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a0) * rx * 0.06, cy + Math.sin(a0) * ry * 0.06);
    ctx.lineTo(cx + Math.cos(a0) * rx * 0.94, cy + Math.sin(a0) * ry * 0.94);
    ctx.stroke();
  }
  ctx.fillStyle = "#FCF8E2";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.1, ry * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.28;
  const hg = ctx.createRadialGradient(
    cx - rx * 0.34,
    cy - ry * 0.4,
    2,
    cx - rx * 0.34,
    cy - ry * 0.4,
    rx * 0.44,
  );
  hg.addColorStop(0, "#FFFDF0");
  hg.addColorStop(1, "rgba(255,253,240,0)");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.34, cy - ry * 0.4, rx * 0.4, ry * 0.28, -0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
