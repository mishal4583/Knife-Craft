/**
 * POMEGRANATE_TEXTURE — ported directly from knifecraft.html's actual
 * `SKIN.pomegranate()` (source line 7699, taut scarlet skin + calyx) AND
 * `PAINT.pomegranate()` (source line 7068, the "opened" torn fruit — six
 * lobed chambers of glossy arils split by cream membrane strands). As
 * with Kiwi, the source composites these as two full-body sprites with a
 * time-based alpha fade production has no equivalent for; baked into one
 * canvas instead — skin drawn full, then — ONLY once `hasCut` is true —
 * the real aril interior painted on top clipped to an inset disc, so the
 * scarlet rind survives at the edge while a cut opens onto the actual
 * ported aril chambers. See kiwiTexture.ts's own doc for why `hasCut`
 * defaulting to false (an uncut whole stays 100% skin) matters and where
 * the flag comes from.
 */
const SKIN_INSET = 16;

export function pomegranateTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintPomegranateTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  // Pomegranate has no `EllipseModOpts`/peel state of its own — see
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

  // --- SKIN.pomegranate: taut scarlet skin, full body ---
  const skin = ctx.createRadialGradient(
    cx - rx * 0.28,
    cy - ry * 0.34,
    rx * 0.08,
    cx + rx * 0.06,
    cy + ry * 0.12,
    rx * 1.24,
  );
  skin.addColorStop(0, "#F4415A");
  skin.addColorStop(0.32, "#E51F3E");
  skin.addColorStop(0.68, "#C50F30");
  skin.addColorStop(0.88, "#A20A25");
  skin.addColorStop(1, "#7C0619");
  ctx.fillStyle = skin;
  sil();
  ctx.fill();

  ctx.save();
  sil();
  ctx.clip();
  for (let i = 0; i < 26; i++) {
    // faint vertical striations
    const fx = -0.94 + i * (1.88 / 25);
    const w = 5 + 7 * (((i * 7919) % 13) / 13);
    ctx.strokeStyle = i % 2 ? "rgba(255,150,160,0.10)" : "rgba(120,4,20,0.10)";
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(cx + fx * rx, cy - ry * 1.05);
    ctx.quadraticCurveTo(cx + fx * 1.04 * rx, cy, cx + fx * rx, cy + ry * 1.05);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(120,6,22,0.13)"; // fine pore stipple
  for (let i = 0; i < 220; i++) {
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 6151) % 97) / 97);
    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(a) * rx * 0.96 * r,
      cy + Math.sin(a) * ry * 0.96 * r,
      1.1 + 0.9 * (((i * 104729) % 11) / 11),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const bloom = ctx.createRadialGradient(
    cx - rx * 0.3,
    cy - ry * 0.3,
    rx * 0.02,
    cx - rx * 0.26,
    cy - ry * 0.26,
    rx * 0.62,
  );
  bloom.addColorStop(0, "rgba(255,208,208,0.60)");
  bloom.addColorStop(0.5, "rgba(255,190,192,0.18)");
  bloom.addColorStop(1, "rgba(255,190,192,0)");
  ctx.fillStyle = bloom;
  sil();
  ctx.fill(); // the broad specular

  ctx.save();
  ctx.translate(cx - rx * 0.36, cy - ry * 0.06);
  ctx.rotate(-0.24);
  const hard = ctx.createLinearGradient(0, -ry * 0.34, 0, ry * 0.34);
  hard.addColorStop(0, "rgba(255,236,236,0)");
  hard.addColorStop(0.5, "rgba(255,240,240,0.62)");
  hard.addColorStop(1, "rgba(255,236,236,0)");
  ctx.fillStyle = hard;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.085, ry * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(255,244,244,0.50)"; // the small second specular
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.34, cy - ry * 0.3, rx * 0.07, ry * 0.1, -0.4, 0, Math.PI * 2);
  ctx.fill();
  const base = ctx.createRadialGradient(cx, cy + ry * 0.3, rx * 0.3, cx, cy + ry * 0.44, rx * 1.05);
  base.addColorStop(0, "rgba(90,2,18,0)");
  base.addColorStop(1, "rgba(80,2,16,0.48)");
  ctx.fillStyle = base;
  sil();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(96,4,20,0.42)";
  ctx.lineWidth = 2;
  sil();
  ctx.stroke();

  const calyxY = cy - ry * 0.97; // the calyx: a short neck and five dried points
  // Painted regardless of hasCut — the dried calyx crown is part of the
  // permanent skin, visible on an uncut fruit too (see the reference
  // photo), not part of the "opened" flesh reveal below.
  const neck = ctx.createLinearGradient(cx, calyxY - 16, cx, calyxY + 10);
  neck.addColorStop(0, "#A8712E");
  neck.addColorStop(1, "#C21F38");
  ctx.fillStyle = neck;
  ctx.beginPath();
  ctx.ellipse(cx, calyxY + 2, rx * 0.17, ry * 0.075, 0, 0, Math.PI * 2);
  ctx.fill();
  const points: [number, number, number][] = [
    [-20, -0.62, 34],
    [-10, -0.28, 44],
    [1, 0.02, 50],
    [12, 0.3, 43],
    [21, 0.64, 33],
  ];
  for (const [dx, rot, len] of points) {
    ctx.save();
    ctx.translate(cx + dx, calyxY - 2);
    ctx.rotate(rot);
    const lg = ctx.createLinearGradient(0, 0, 0, -len);
    lg.addColorStop(0, "#8E5A24");
    lg.addColorStop(0.55, "#A5722F");
    lg.addColorStop(1, "#6B3E17");
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(-7, 6);
    ctx.quadraticCurveTo(-5, -len * 0.6, 0, -len);
    ctx.quadraticCurveTo(5, -len * 0.6, 7, 6);
    ctx.quadraticCurveTo(0, -len * 0.18, -7, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(70,38,12,0.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  if (!hasCut) return; // uncut: 100% taut scarlet skin — no arils showing yet

  // --- PAINT.pomegranate: the real opened aril chambers, windowed to an
  // inset disc so the scarlet rind survives around the edge ---
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - SKIN_INSET, ry - SKIN_INSET, 0, 0, Math.PI * 2);
  ctx.clip();

  const memb = ctx.createRadialGradient(cx, cy, rx * 0.05, cx, cy, rx * 1.0);
  memb.addColorStop(0, "#5E0418");
  memb.addColorStop(0.62, "#4A0212");
  memb.addColorStop(1, "#38010D");
  ctx.fillStyle = memb;
  sil();
  ctx.fill();
  const SEG = 6;
  for (let s2 = 0; s2 < SEG; s2++) {
    const a0 = (s2 / SEG) * Math.PI * 2 + 0.22;
    const a1 = ((s2 + 1) / SEG) * Math.PI * 2 + 0.22;
    const b0 = a0;
    const b1 = a1; // chambers touch: no cream shows between them
    const cham = new Path2D(); // a lobed chamber, not a pie slice
    cham.moveTo(cx, cy);
    const N = 22;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const a = b0 + (b1 - b0) * t;
      const lob = 0.94 + 0.05 * Math.sin(t * Math.PI * 3 + s2);
      cham.lineTo(cx + Math.cos(a) * rx * lob, cy + Math.sin(a) * ry * lob);
    }
    cham.closePath();
    ctx.save();
    ctx.clip(cham);
    const bed = ctx.createRadialGradient(cx, cy, rx * 0.05, cx, cy, rx * 0.98);
    bed.addColorStop(0, "#5E0418");
    bed.addColorStop(0.6, "#4A0212");
    bed.addColorStop(1, "#38010D");
    ctx.fillStyle = bed;
    ctx.fill(cham); // the dark bed the beads sit in
    for (let i = 0; i < 170; i++) {
      // the aril pack: shadow, body, specular
      const h1 = (((s2 * 911 + i) * 7919) % 997) / 997;
      const h2 = (((s2 * 577 + i) * 6151) % 991) / 991;
      const h3 = (((s2 * 331 + i) * 104729) % 983) / 983;
      const aa = b0 + (b1 - b0) * h1;
      const rr = 0.02 + 0.94 * Math.sqrt(h2);
      const jx = ((((s2 * 13 + i) * 7907) % 101) / 101 - 0.5) * rx * 0.1;
      const jy = ((((s2 * 29 + i) * 5843) % 103) / 103 - 0.5) * ry * 0.1;
      const x = cx + Math.cos(aa) * rx * 0.95 * rr + jx;
      const y = cy + Math.sin(aa) * ry * 0.95 * rr + jy;
      const br = 4.6 + 3.4 * h3 - 1.6 * rr;
      ctx.fillStyle = "rgba(24,0,6,0.55)";
      ctx.beginPath();
      ctx.arc(x + br * 0.22, y + br * 0.26, br * 0.98, 0, Math.PI * 2);
      ctx.fill();
      const tone = h3 < 0.3 ? "#8E0526" : h3 < 0.62 ? "#A80B2E" : h3 < 0.86 ? "#750219" : "#C4143A";
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.arc(x, y, br, 0, Math.PI * 2);
      ctx.fill();
      const lit = ctx.createRadialGradient(x - br * 0.34, y - br * 0.4, br * 0.05, x, y, br * 1.05);
      lit.addColorStop(0, "rgba(255,168,180,0.42)");
      lit.addColorStop(0.55, "rgba(220,60,90,0.10)");
      lit.addColorStop(1, "rgba(60,0,14,0.30)");
      ctx.fillStyle = lit;
      ctx.beginPath();
      ctx.arc(x, y, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,238,240,0.80)"; // the wet dot every aril carries
      ctx.beginPath();
      ctx.arc(x - br * 0.34, y - br * 0.42, br * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // Membranes: thin cream strands that wander ACROSS the face on offset
  // chords, splitting the bead mass into clumps. Nothing starts or ends
  // at the middle, so no star.
  ctx.save();
  sil();
  ctx.clip();
  ctx.lineCap = "round";
  const strands: [number, number, number][] = [
    [1.14, -0.07, 0.16],
    [2.02, 0.09, -0.13],
  ];
  for (let k = 0; k < strands.length; k++) {
    const [ang, off, cur] = strands[k]!;
    const nx = Math.cos(ang + Math.PI / 2);
    const ny = Math.sin(ang + Math.PI / 2);
    const half = Math.sqrt(Math.max(0.04, 1 - off * off)) * 0.94;
    const sx = cx + Math.cos(ang) * -half * rx + nx * off * rx;
    const sy = cy + Math.sin(ang) * -half * ry + ny * off * ry;
    const ex = cx + Math.cos(ang) * half * rx + nx * off * rx;
    const ey = cy + Math.sin(ang) * half * ry + ny * off * ry;
    ctx.strokeStyle = `rgba(250,242,224,${(0.62 + 0.08 * k).toFixed(2)})`;
    ctx.lineWidth = 2.6 + 0.6 * k;
    const STEPS = 16;
    let px = sx;
    let py = sy;
    for (let i = 1; i <= STEPS; i++) {
      const t = i / STEPS;
      const tp = (i - 1) / STEPS;
      const wob = ((i * 7919 + k * 104729) % 211) / 211 - 0.5;
      const env = Math.sin(t * Math.PI); // no wander at the two ends
      const bx =
        sx + (ex - sx) * t + nx * (cur * rx * Math.sin(tp * Math.PI) + wob * rx * 0.085 * env);
      const by =
        sy + (ey - sy) * t + ny * (cur * ry * Math.sin(tp * Math.PI) + wob * ry * 0.085 * env);
      ctx.lineWidth = (2.2 + 1.4 * Math.sin(t * Math.PI * 1.7 + k * 2)) * (0.75 + 0.5 * env);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(bx, by);
      ctx.stroke();
      px = bx;
      py = by;
    }
  }
  ctx.restore();
  const shadeIn = ctx.createRadialGradient(
    cx - rx * 0.3,
    cy - ry * 0.34,
    rx * 0.1,
    cx,
    cy,
    rx * 1.05,
  );
  shadeIn.addColorStop(0, "rgba(255,235,225,0.16)");
  shadeIn.addColorStop(0.6, "rgba(40,0,10,0)");
  shadeIn.addColorStop(1, "rgba(30,0,8,0.42)");
  ctx.fillStyle = shadeIn;
  sil();
  ctx.fill(); // one light direction over the whole mass
  ctx.restore();
}
