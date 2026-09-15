/**
 * COCONUT_TEXTURE — ported directly from knifecraft.html's actual
 * `SKIN.coconut()` (source line 7992, the fibrous brown husk) AND
 * `PAINT.coconut()` (source line 7230, the de-husked white meat).
 * Coconut is one of the source's exactly-three real peelable foods
 * (`peelable = SKIN && !SKIN_KEEP` — see knifecraft.html's own
 * peel-mechanics doc), and production's pre-existing generic
 * rub-to-peel system (`this.peeled`, same one Onion/Potato/Garlic
 * already use) now drives it directly: unpeeled paints ONLY the real
 * fibrous husk (no meat anywhere), peeled paints ONLY the real white
 * meat (no husk anywhere) — a discrete swap on `completePeel()`, not
 * the source's continuous alpha fade, which production's
 * single-canvas-per-piece architecture has no equivalent for.
 */
export function coconutTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintCoconutTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  // Coconut has no `EllipseModOpts` of its own (a plain ellipse) — this
  // slot exists only so the call site can share EllipseRenderer's one
  // shared (ctx,rx,ry,margin,opts,peeled) signature with every other
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
    // --- PAINT.coconut: the real de-husked white meat ---
    const meat = ctx.createRadialGradient(
      cx - rx * 0.3,
      cy - ry * 0.36,
      rx * 0.06,
      cx + rx * 0.1,
      cy + ry * 0.18,
      rx * 1.24,
    );
    meat.addColorStop(0, "#FFFFFF");
    meat.addColorStop(0.4, "#FCFBF8");
    meat.addColorStop(0.74, "#F1EFE9");
    meat.addColorStop(0.92, "#DEDBD1");
    meat.addColorStop(1, "#C9C5B9");
    ctx.fillStyle = meat;
    sil();
    ctx.fill();

    ctx.save();
    sil();
    ctx.clip();
    for (let i = 0; i < 120; i++) {
      // waxy mottle: barely there, kills the dead flat
      const a = i * 2.399963;
      const r = Math.sqrt(((i * 6151) % 89) / 89);
      const x = cx + Math.cos(a) * rx * 0.92 * r;
      const y = cy + Math.sin(a) * ry * 0.92 * r;
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.30)" : "rgba(206,200,186,0.14)";
      ctx.beginPath();
      ctx.ellipse(x, y, rx * 0.055, ry * 0.04, a, 0, Math.PI * 2);
      ctx.fill();
    }
    const sheen = ctx.createRadialGradient(
      cx - rx * 0.34,
      cy - ry * 0.4,
      rx * 0.04,
      cx - rx * 0.2,
      cy - ry * 0.24,
      rx * 0.78,
    );
    sheen.addColorStop(0, "rgba(255,255,255,0.85)");
    sheen.addColorStop(0.55, "rgba(255,255,255,0.24)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    sil();
    ctx.fill();
    const shade = ctx.createLinearGradient(cx, cy + ry * 0.2, cx + rx * 0.35, cy + ry * 1.05);
    shade.addColorStop(0, "rgba(176,172,158,0)");
    shade.addColorStop(1, "rgba(150,146,132,0.34)");
    ctx.fillStyle = shade;
    sil();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(158,152,138,0.40)";
    ctx.lineWidth = 1.6;
    sil();
    ctx.stroke();
    return;
  }

  // --- SKIN.coconut: the fibrous brown coir husk (unpeeled) ---
  const base = ctx.createRadialGradient(
    cx - rx * 0.3,
    cy - ry * 0.38,
    rx * 0.1,
    cx + rx * 0.08,
    cy + ry * 0.14,
    rx * 1.26,
  );
  base.addColorStop(0, "#C99659");
  base.addColorStop(0.34, "#B37D43");
  base.addColorStop(0.7, "#94612F");
  base.addColorStop(0.9, "#74461F");
  base.addColorStop(1, "#552F11");
  ctx.fillStyle = base;
  sil();
  ctx.fill();

  ctx.save();
  sil();
  ctx.clip();
  ctx.lineCap = "round";
  for (let i = 0; i < 1500; i++) {
    const h1 = ((i * 7919) % 997) / 997;
    const h2 = ((i * 6151) % 991) / 991;
    const h3 = ((i * 104729) % 983) / 983;
    const h4 = ((i * 911) % 977) / 977;
    const rr = Math.sqrt(h1) * 0.995;
    const aa = h2 * Math.PI * 2;
    const x = cx + Math.cos(aa) * rx * rr;
    const y = cy + Math.sin(aa) * ry * rr;
    const w = Math.max(0, (rr - 0.52) / 0.48); // near the rim the hairs follow the edge
    const ang = 0.12 + (h4 - 0.5) * 0.85 + w * (aa + Math.PI / 2 - 0.12);
    const len = rx * (0.05 + 0.14 * h3);
    const bow = (h4 - 0.5) * len * 0.55;
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len;
    ctx.strokeStyle =
      i % 3
        ? `rgba(70,42,18,${(0.16 + 0.22 * h3).toFixed(2)})`
        : `rgba(226,180,124,${(0.14 + 0.24 * h4).toFixed(2)})`;
    ctx.lineWidth = 0.7 + 1.1 * h3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      (x + ex) / 2 + Math.cos(ang + 1.57) * bow,
      (y + ey) / 2 + Math.sin(ang + 1.57) * bow,
      ex,
      ey,
    );
    ctx.stroke();
  }
  const eyes: [number, number, number][] = [
    [-0.16, -0.4, 0.115],
    [0.11, -0.42, 0.105],
    [-0.02, -0.16, 0.1],
  ];
  for (const [ex, ey, er] of eyes) {
    const px = cx + ex * rx;
    const py = cy + ey * ry;
    const eg = ctx.createRadialGradient(px, py, er * rx * 0.12, px, py, er * rx * 1.25);
    eg.addColorStop(0, "rgba(24,14,6,0.95)");
    eg.addColorStop(0.62, "rgba(40,24,10,0.80)");
    eg.addColorStop(1, "rgba(60,36,16,0)");
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.ellipse(px, py, er * rx, er * rx * 0.86, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  const lit = ctx.createRadialGradient(
    cx - rx * 0.32,
    cy - ry * 0.4,
    rx * 0.05,
    cx - rx * 0.18,
    cy - ry * 0.22,
    rx * 0.82,
  );
  lit.addColorStop(0, "rgba(255,236,200,0.34)");
  lit.addColorStop(1, "rgba(255,236,200,0)");
  ctx.fillStyle = lit;
  sil();
  ctx.fill();
  const vig = ctx.createRadialGradient(cx, cy, rx * 0.55, cx + rx * 0.06, cy + ry * 0.1, rx * 1.06);
  vig.addColorStop(0, "rgba(50,28,10,0)");
  vig.addColorStop(1, "rgba(44,24,8,0.46)");
  ctx.fillStyle = vig;
  sil();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(58,32,12,0.55)";
  ctx.lineWidth = 2;
  sil();
  ctx.stroke();
}
