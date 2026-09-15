/**
 * PEACH_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.peach()` (source line 5922) against the real `ellipse` geometry.
 * A coral-orange skin over cream-peach flesh with a deep red-brown ridged
 * stone (small and only modestly darker — a big luminance drop reads as
 * a hole, not a stone), golden-angle grain blotches (never radial rays,
 * which converge into a sunflower), and the skin painted LAST through an
 * even-odd annulus (skin-ellipse minus flesh-ellipse) so the flesh can
 * never eat it — carrying the blush, mottling, and suture crease. A
 * cosmetic stem+leaf sheds off the crown before any cut.
 *
 * `hasCut` gates the flesh: the source's own annulus trick unconditionally
 * left the inset flesh ellipse showing through a skin RING (no whole/cut
 * distinction at all), which reads as an already-peeled fruit with a rim
 * of skin left around the edge — a real "half-peeled" bug on the WHOLE,
 * uncut peach. `hasCut` (this.cuts.length > 0 — Peach has no Peel
 * technique, so this is the same "a real cut reveals the flesh" reveal
 * every other cut-only SKIN_KEEP ellipse ingredient already uses, not the
 * Peel-driven `this.peeled`) keeps an uncut peach 100% skin, full ellipse,
 * exactly like Kiwi/etc. stayed 100% skin before their own first cut —
 * only once actually halved does the flesh/stone/grain appear.
 */
export function peachTextureSize(rx: number, ry: number, margin: number): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintPeachTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  // Peach has no `EllipseModOpts`/peel state of its own (a plain ellipse,
  // not peelable) — these two slots exist only so the call site can share
  // EllipseRenderer.paint's one (ctx,rx,ry,margin,opts,peeled,hasCut)
  // signature with every other ellipse ingredient; always undefined in
  // practice (matches kiwiTexture.ts's own `_opts`/`_peeled` convention).
  _opts?: unknown,
  _peeled?: boolean,
  hasCut = false,
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const ellipsePath = (rrx: number, rry: number): Path2D => {
    const p = new Path2D();
    p.ellipse(cx, cy, rrx, rry, 0, 0, Math.PI * 2);
    return p;
  };
  const sil = ellipsePath(rx, ry);

  // Stem + leaf off the crown — cosmetic overhang: no cut, span or piece
  // sees it, and it sheds on the first cut. Drawn first so the fruit's
  // edge covers the joint. Seated near dead-center-top (not off to one
  // side) and kept short, matching a real peach's stem sitting IN its
  // shallow crown dimple rather than floating off the shoulder — the
  // dimple shadow itself is painted later, on top of the finished skin.
  const stemX = cx + rx * 0.02;
  const stemTopY = cy - ry * 0.98;
  {
    ctx.strokeStyle = "#6E4326";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(stemX, cy - ry * 0.94);
    ctx.quadraticCurveTo(stemX + 3, stemTopY - 10, stemX + 1, stemTopY - 20);
    ctx.stroke();
    const lf = new Path2D();
    const bx = stemX + 1;
    const by = stemTopY - 17;
    lf.moveTo(bx, by);
    lf.bezierCurveTo(bx + 24, by - 20, bx + 52, by - 18, bx + 58, by - 4);
    lf.bezierCurveTo(bx + 42, by + 10, bx + 18, by + 11, bx, by);
    lf.closePath();
    const lg = ctx.createLinearGradient(bx, by - 16, bx + 58, by + 6);
    lg.addColorStop(0, "#7FBF56");
    lg.addColorStop(0.55, "#5FA83E");
    lg.addColorStop(1, "#3F8A2C");
    ctx.fillStyle = lg;
    ctx.fill(lf);
    ctx.strokeStyle = "rgba(46,96,32,0.55)";
    ctx.lineWidth = 1.4;
    ctx.stroke(lf);
    ctx.strokeStyle = "rgba(40,88,28,0.42)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx + 3, by - 1);
    ctx.quadraticCurveTo(bx + 32, by - 10, bx + 56, by - 6);
    ctx.stroke();
  }

  // BASE — a real peach reads as a warm diagonal gradient (deep red-crimson
  // on one shoulder fading through orange into golden-yellow on the
  // other), not a concentric "lit sphere" radial — a reference photo
  // comparison flagged the old radial `gold` fill as reading flat/uniform
  // next to that. Linear, corner to corner, carries that fade; a separate
  // radial `vignette` right after adds the actual roundness (soft dark
  // falloff at the rim) that the radial fill used to provide for free.
  const base = ctx.createLinearGradient(
    cx - rx * 0.75,
    cy - ry * 0.8,
    cx + rx * 0.8,
    cy + ry * 0.75,
  );
  base.addColorStop(0, "#C1382E");
  base.addColorStop(0.32, "#DD5A2E");
  base.addColorStop(0.62, "#EE8B3B");
  base.addColorStop(0.85, "#F4AE49");
  base.addColorStop(1, "#F7C868");
  ctx.fillStyle = base;
  ctx.fill(sil);
  const vignette = ctx.createRadialGradient(cx, cy, rx * 0.35, cx, cy, rx * 1.05);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(120,40,24,0.22)");
  ctx.fillStyle = vignette;
  ctx.fill(sil);

  ctx.save();
  ctx.clip(sil);
  // The inset "flesh" ellipse and everything painted onto it (grain,
  // stone, feathering) only exist once the peach is ACTUALLY cut — see
  // this file's own header doc on why an unconditional flesh reveal here
  // read as a peach that's already half-peeled even whole. `flesh`'s own
  // Path2D is still built unconditionally: the ring-clip math right below
  // needs it either way (a real cut-face ring once hasCut, or simply
  // unused when the skin covers the whole ellipse).
  const fleshRx = rx - 20;
  const fleshRy = ry - 20;
  const flesh = ellipsePath(fleshRx, fleshRy);
  if (hasCut) {
    const flg = ctx.createRadialGradient(
      cx - rx * 0.1,
      cy - ry * 0.08,
      rx * 0.05,
      cx,
      cy,
      rx * 0.94,
    );
    flg.addColorStop(0, "#FFEBD2");
    flg.addColorStop(0.46, "#FDDCB6");
    flg.addColorStop(1, "#F8C79A");
    ctx.fillStyle = flg;
    ctx.fill(flesh);

    ctx.save();
    ctx.clip(flesh);
    for (let i = 0; i < 30; i++) {
      // grain: golden-angle blotches, never radial (rays converging on the stone made a sunflower)
      const a = i * 2.399963;
      const r = Math.sqrt(((i * 7919) % 79) / 79);
      ctx.fillStyle = i % 2 ? "rgba(228,166,104,0.075)" : "rgba(255,238,196,0.085)";
      ctx.beginPath();
      ctx.ellipse(
        cx - rx * 0.06 + Math.cos(a) * rx * 0.68 * r,
        cy + Math.sin(a) * ry * 0.7 * r,
        4 + 4 * (((i * 104729) % 29) / 29),
        3 + 3 * (((i * 6151) % 19) / 19),
        a * 0.8,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    // STONE — small and only MODESTLY darker: present, not a void.
    const st = new Path2D();
    st.ellipse(cx, cy, rx * 0.25, ry * 0.3, 0.18, 0, Math.PI * 2);
    const stain = ctx.createRadialGradient(cx, cy, rx * 0.05, cx, cy, rx * 0.34);
    stain.addColorStop(0, "rgba(198,92,52,0.26)");
    stain.addColorStop(0.68, "rgba(212,120,66,0.10)");
    stain.addColorStop(1, "rgba(220,140,80,0)");
    ctx.fillStyle = stain;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.34, ry * 0.38, 0.18, 0, Math.PI * 2);
    ctx.fill();
    const sg = ctx.createLinearGradient(cx - rx * 0.2, cy - ry * 0.2, cx + rx * 0.2, cy + ry * 0.2);
    sg.addColorStop(0, "#A6462C");
    sg.addColorStop(0.5, "#8E3524");
    sg.addColorStop(1, "#73281B");
    ctx.fillStyle = sg;
    ctx.fill(st);
    ctx.strokeStyle = "rgba(52,18,12,0.34)"; // furrows: a one-sided fan, never a rosette
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) {
      const a = -1.0 + i * 0.32;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rx * 0.04, cy + Math.sin(a) * ry * 0.05);
      ctx.quadraticCurveTo(
        cx + Math.cos(a) * rx * 0.17,
        cy + Math.sin(a) * ry * 0.2,
        cx + Math.cos(a) * rx * 0.24,
        cy + Math.sin(a) * ry * 0.29,
      );
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(58,20,14,0.45)"; // hard vector rim on the stone
    ctx.lineWidth = 2;
    ctx.stroke(st);
    const feather = ctx.createRadialGradient(cx, cy, rx * 0.58, cx, cy, rx * 0.9);
    feather.addColorStop(0, "rgba(244,150,96,0)");
    feather.addColorStop(1, "rgba(244,150,96,0.30)");
    ctx.fillStyle = feather;
    ctx.fill(flesh); // warms the flesh INTO the skin: kills plateau 3
    ctx.restore();
  }

  // SKIN — painted last so a real cut's flesh can never eat it. Uncut:
  // clips to the WHOLE silhouette (nonzero) so blush/mottling/suture/fuzz
  // cover the entire peach, not just a rim. Cut: clips to the even-odd
  // annulus (skin-ellipse minus flesh-ellipse), exactly as before, so the
  // flesh exposed above shows through the middle.
  const ring = new Path2D();
  ring.addPath(sil);
  ring.addPath(flesh);
  ctx.save();
  if (hasCut) ctx.clip(ring, "evenodd");
  else ctx.clip(sil);
  // Reinforces (doesn't carry alone, now that `base` does) the same red
  // shoulder the linear base already darkens toward — toned down from the
  // original pass, which had this doing ALL of the directional work.
  const bx = cx - rx * 0.62; // focused ON the ring, not on the fruit centre
  const by = cy - ry * 0.52;
  const blush = ctx.createRadialGradient(bx, by, rx * 0.04, bx, by, rx * 1.3);
  blush.addColorStop(0, "rgba(196,58,40,0.55)");
  blush.addColorStop(0.34, "rgba(196,58,40,0.36)");
  blush.addColorStop(0.62, "rgba(200,80,48,0.18)");
  blush.addColorStop(0.86, "rgba(205,100,58,0.07)");
  blush.addColorStop(1, "rgba(210,120,68,0)");
  ctx.fillStyle = blush;
  ctx.fill(sil);
  for (let i = 0; i < 64; i++) {
    // mottling, densest where the blush fades out — a real peach's fuzz
    // reads as soft color noise, not distinct spots, so this is now a
    // much lower-contrast, smaller-radius scatter than the original pass.
    const a = i * 2.399963;
    const r = 0.7 + 0.3 * (((i * 7919) % 53) / 53);
    ctx.fillStyle = i % 2 ? "rgba(150,55,28,0.06)" : "rgba(255,214,158,0.07)";
    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(a) * rx * 0.94 * r,
      cy + Math.sin(a) * ry * 0.94 * r,
      1.3 + 1.7 * (((i * 6151) % 23) / 23),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const cx0 = cx - rx * 0.3; // suture: continuous across the whole ring — a
  // faint natural crease, not a bold seam, so both strokes are thinner and
  // softer than the original pass.
  ctx.strokeStyle = "rgba(186,74,36,0.30)";
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx0 + rx * 0.16, cy - ry * 1.02);
  ctx.quadraticCurveTo(cx0 - rx * 0.16, cy, cx0 + rx * 0.14, cy + ry * 1.02);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,214,168,0.26)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx0 + rx * 0.23, cy - ry * 1.0);
  ctx.quadraticCurveTo(cx0 - rx * 0.09, cy, cx0 + rx * 0.21, cy + ry * 1.0);
  ctx.stroke();
  // The crown dimple the stem actually sits IN — a real peach's stem
  // socket is a small shadowed notch, not a stem floating off a bare
  // shoulder. Painted on top of the skin (stem itself was drawn first,
  // underneath) so the shadow reads as a real indentation around it.
  const dimple = ctx.createRadialGradient(
    stemX,
    cy - ry * 0.93,
    1,
    stemX,
    cy - ry * 0.93,
    rx * 0.11,
  );
  dimple.addColorStop(0, "rgba(94,36,20,0.32)");
  dimple.addColorStop(0.7, "rgba(94,36,20,0.12)");
  dimple.addColorStop(1, "rgba(94,36,20,0)");
  ctx.fillStyle = dimple;
  ctx.beginPath();
  ctx.ellipse(stemX, cy - ry * 0.93, rx * 0.11, ry * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Warm, soft highlight — a fuzzy peach catches light matte, not glossy,
  // so this is tinted warmer and dimmer than a plain white sheen would be.
  const sheen = ctx.createRadialGradient(
    cx - rx * 0.44,
    cy - ry * 0.5,
    rx * 0.03,
    cx - rx * 0.38,
    cy - ry * 0.44,
    rx * 0.44,
  );
  sheen.addColorStop(0, "rgba(255,238,200,0.22)");
  sheen.addColorStop(1, "rgba(255,238,200,0)");
  ctx.fillStyle = sheen;
  ctx.fill(sil);
  ctx.restore();

  ctx.strokeStyle = "rgba(184,64,30,0.42)";
  ctx.lineWidth = 2.2;
  ctx.stroke(sil);
}
