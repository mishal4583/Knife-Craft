/**
 * FENNEL_TEXTURE — ported directly from knifecraft.html's actual
 * `SKIN.fennel()` (source line 8039, the swept-sheath bulb exterior) AND
 * `PAINT.fennel()` ("FENNEL, INTERIOR", source line 7258, the nested
 * white sheath rings only ever seen on a cut face). As with the other
 * SKIN_KEEP ingredients in this pass, the source composites these as two
 * full-body sprites with a time-based alpha fade production has no
 * equivalent for; baked into one canvas instead — bulb exterior drawn
 * full, then — ONLY once `hasCut` is true — the real nested-ring interior
 * painted on top clipped to an inset disc, so the swept sheath skin
 * survives at the edge while a cut opens onto the actual ported ring
 * interior. See kiwiTexture.ts's own doc for why `hasCut` defaulting to
 * false (an uncut whole stays 100% skin) matters and where the flag
 * comes from.
 *
 * The source's stalks + feathery fronds are drawn PAST the silhouette
 * (`neckY = cy - ry*0.90` and outward) — not ported, matching
 * cornTexture.ts's/turnipTexture.ts's own documented reason: production's
 * piece-rendering pipeline crops every piece, including the whole uncut
 * ingredient, to the collision silhouette's own rx/ry bounds, so that
 * geometry would be invisible regardless.
 */
const SKIN_INSET = 14;

export function fennelTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintFennelTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  // Fennel has no `EllipseModOpts`/peel state of its own — see
  // kiwiTexture.ts's identical placeholder-slot comment.
  _opts?: unknown,
  _peeled?: boolean,
  hasCut = false,
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const sil = () => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  };

  // --- SKIN.fennel: the swept-sheath bulb exterior, full body ---
  const skin = ctx.createLinearGradient(
    cx - rx * 0.75,
    cy - ry * 0.7,
    cx + rx * 0.8,
    cy + ry * 0.9,
  );
  skin.addColorStop(0, "#FFFFFA");
  skin.addColorStop(0.34, "#F8F8EE");
  skin.addColorStop(0.72, "#EAEADA");
  skin.addColorStop(1, "#CFCFBA");
  ctx.fillStyle = skin;
  sil();
  ctx.fill();

  ctx.save();
  sil();
  ctx.clip();
  const RIB = 78; // sheath grooves: tightly packed and swept, as in the photo
  for (let i = 0; i < RIB; i++) {
    const t = i / (RIB - 1);
    const sp = (t - 0.5) * 2;
    const w1 = ((i * 7919) % 23) / 23;
    const w2 = ((i * 6151) % 19) / 19;
    const lean = 0.2; // the whole set leans, so grooves read diagonal
    const topX = cx + sp * rx * 0.34 + rx * lean * 0.55;
    const botX = cx + sp * rx * 1.04 - rx * lean * 0.45 + (w1 - 0.5) * rx * 0.04;
    ctx.strokeStyle =
      i % 2
        ? `rgba(160,166,132,${(0.22 + 0.2 * w1).toFixed(2)})`
        : `rgba(255,255,250,${(0.52 + 0.28 * w2).toFixed(2)})`;
    ctx.lineWidth = 1.0 + 1.8 * w2;
    ctx.beginPath();
    ctx.moveTo(topX, cy - ry * 1.04);
    ctx.quadraticCurveTo(
      cx + sp * rx * 0.8 + rx * lean * 0.2,
      cy + ry * 0.12,
      botX,
      cy + ry * 1.06,
    );
    ctx.stroke();
  }
  for (let s = 0; s < 3; s++) {
    const yy = cy + ry * (-0.3 + s * 0.42);
    const amp = ry * (0.16 + 0.05 * s);
    ctx.strokeStyle = s % 2 ? "rgba(214,196,140,0.30)" : "rgba(255,255,248,0.55)";
    ctx.lineWidth = 2.2 + s * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.06, yy + amp * 0.7);
    ctx.quadraticCurveTo(cx, yy - amp, cx + rx * 1.06, yy + amp * 0.9);
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const sp = -0.72 + i * 0.36;
    const bandX = cx + sp * rx * 0.92;
    const bg = ctx.createLinearGradient(bandX - rx * 0.16, 0, bandX + rx * 0.16, 0);
    bg.addColorStop(0, "rgba(160,164,140,0.00)");
    bg.addColorStop(0.5, "rgba(160,164,140,0.13)");
    bg.addColorStop(1, "rgba(255,255,252,0.00)");
    ctx.fillStyle = bg;
    sil();
    ctx.fill();
  }
  const flush = ctx.createLinearGradient(cx, cy - ry * 1.04, cx, cy + ry * 0.1);
  flush.addColorStop(0, "rgba(168,206,96,0.78)");
  flush.addColorStop(0.42, "rgba(186,216,124,0.34)");
  flush.addColorStop(1, "rgba(196,220,140,0)");
  ctx.fillStyle = flush;
  sil();
  ctx.fill();
  for (const sgn of [-1, 1]) {
    const sh = ctx.createRadialGradient(
      cx + sgn * rx * 0.92,
      cy - ry * 0.52,
      rx * 0.06,
      cx + sgn * rx * 0.92,
      cy - ry * 0.4,
      rx * 0.62,
    );
    sh.addColorStop(0, "rgba(160,202,88,0.46)");
    sh.addColorStop(1, "rgba(160,202,88,0)");
    ctx.fillStyle = sh;
    sil();
    ctx.fill();
  }
  for (let i = 0; i < 12; i++) {
    const h1 = ((i * 7919) % 97) / 97;
    const h2 = ((i * 6151) % 89) / 89;
    const x = cx + (h1 - 0.5) * rx * 1.5;
    const y = cy + ry * (0.3 + 0.58 * h2);
    ctx.fillStyle = `rgba(198,158,72,${(0.16 + 0.2 * h2).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 2.0 + 2.4 * h1, 1.4 + 1.6 * h2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const base = ctx.createRadialGradient(cx, cy + ry * 0.86, rx * 0.06, cx, cy + ry * 0.9, rx * 0.7);
  base.addColorStop(0, "rgba(150,150,132,0.30)");
  base.addColorStop(1, "rgba(150,150,132,0)");
  ctx.fillStyle = base;
  sil();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(168,168,148,0.42)";
  ctx.lineWidth = 1.8;
  sil();
  ctx.stroke();

  if (!hasCut) return; // uncut: 100% swept-sheath exterior — no interior rings showing yet

  // --- PAINT.fennel ("FENNEL, INTERIOR"): the real nested sheath rings,
  // windowed to an inset disc so the swept skin survives around the edge ---
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - SKIN_INSET, ry - SKIN_INSET, 0, 0, Math.PI * 2);
  ctx.clip();

  const fg = ctx.createRadialGradient(cx - rx * 0.12, cy - ry * 0.14, rx * 0.05, cx, cy, rx * 1.0);
  fg.addColorStop(0, "#FFFFFB");
  fg.addColorStop(0.52, "#F7F7ED");
  fg.addColorStop(1, "#E0E2CE");
  ctx.fillStyle = fg;
  sil();
  ctx.fill();

  ctx.save();
  sil();
  ctx.clip();
  const coreX = cx + rx * 0.04;
  const coreY = cy - ry * 0.02;
  for (let r = 7; r >= 1; r--) {
    // nested sheath sections of a cut bulb
    const frac = r / 7.2;
    const seed = r * 2.399963 + 4;
    const ring = new Path2D();
    const NN = 44;
    for (let k = 0; k <= NN; k++) {
      const a = (k / NN) * Math.PI * 2;
      const w = 1 + 0.05 * Math.sin(4 * a + seed) + 0.03 * Math.sin(7 * a + seed * 1.5);
      const x = coreX + Math.cos(a) * rx * 0.92 * frac * w;
      const y = coreY + Math.sin(a) * ry * 0.92 * frac * w;
      if (k) ring.lineTo(x, y);
      else ring.moveTo(x, y);
    }
    ring.closePath();
    ctx.fillStyle = r % 2 ? "rgba(255,255,250,0.42)" : "rgba(206,214,180,0.26)";
    ctx.fill(ring);
    ctx.strokeStyle = "rgba(178,190,148,0.34)";
    ctx.lineWidth = 1.2;
    ctx.stroke(ring);
  }
  const tint = ctx.createRadialGradient(cx, cy, rx * 0.55, cx, cy, rx * 1.04);
  tint.addColorStop(0, "rgba(196,216,150,0)");
  tint.addColorStop(1, "rgba(178,204,128,0.34)");
  ctx.fillStyle = tint;
  sil();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}
