/**
 * KIWI_TEXTURE — ported directly from knifecraft.html's actual
 * `SKIN.kiwi()` (source line 7760, fuzzy brown skin) AND `PAINT.kiwi()`
 * (source line 6995, green flesh + structured seed ring). In the source
 * these are two full-body sprites composited with a time-based alpha
 * fade (`skinAlpha()`) that production's single-canvas-per-piece
 * architecture has no equivalent for — the fix used throughout this pass
 * (matching the pre-existing Cucumber/Avocado convention) is to bake both
 * into ONE canvas: skin drawn full first, then — ONLY once `hasCut` is
 * true — the real flesh painted again on top but clipped to an inset
 * disc, so the fuzzy brown rim survives at the true edge while a cut
 * through the middle opens onto the actual ported green flesh and seed
 * ring. `hasCut` defaulting to false is what keeps an UNCUT kiwi 100%
 * skin, wall to wall — matching `skinAlpha`'s `SKIN_KEEP` branch, which
 * never fades the shell, plus the source's own "a cut opens a flesh face
 * inside a skin rim" behavior; see PreparationScene's own doc on
 * `EllipseRenderer.paint` and `commitCut`'s first-cut repaint for how
 * `hasCut` gets from `this.cuts.length` to here.
 *
 * Every color, gradient stop, hash-jittered blotch/fuzz/ray/seed formula
 * below is copied verbatim from the source's own two functions — nothing
 * here is a from-scratch reinterpretation. Geometry is equally faithful:
 * KIWI_GEOMETRY's RX_FRAC/RY_FRAC (definitions.ts) is the source's own
 * authored `rx:118,ry:94` run through its actual REAL_CM/PX_PER_CM/
 * SIZE_REF_CM/SIZE_GAMMA real-world-size formula (knifecraft.html:3150-
 * 3191) — not a fabricated or re-guessed size (Phase 18B-0 audit traced
 * the exact arithmetic: k=0.7553, 118×k=89.13 to 4 significant figures).
 */
const SKIN_INSET = 16;

export function kiwiTextureSize(rx: number, ry: number, margin: number): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintKiwiTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  // Kiwi has no `EllipseModOpts`/peel state of its own (a plain ellipse,
  // not peelable) — these two slots exist only so the call site can share
  // EllipseRenderer.paint's one (ctx,rx,ry,margin,opts,peeled,hasCut)
  // signature with every other ellipse ingredient; always undefined in
  // practice.
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

  // --- SKIN.kiwi: the fuzzy brown jacket, full body — the source's own
  // exact colors (knifecraft.html:7761-7763). A prior pass shifted this
  // palette darker/more olive to fight a board-contrast problem; that
  // was a real readability issue but the wrong place to fix it — it
  // silently traded away source fidelity. Restored verbatim; see
  // kiwiTexture.ts's own header doc and the Phase 18B-0 audit for the
  // separate, still-open decision on how to address contrast (a bold
  // skin highlight, source-precedented by Tomato's own technique — see
  // §G/§8 — not a base-palette shift toward the board's own color).
  const skin = ctx.createLinearGradient(cx - rx * 0.5, cy - ry, cx + rx * 0.4, cy + ry);
  skin.addColorStop(0, "#B4854A");
  skin.addColorStop(0.38, "#9E6E3B");
  skin.addColorStop(0.74, "#845330");
  skin.addColorStop(1, "#5F3A20");
  ctx.fillStyle = skin;
  sil();
  ctx.fill();

  ctx.save();
  sil();
  ctx.clip();
  for (let i = 0; i < 34; i++) {
    // olive undertone blotches under the fuzz
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 6151) % 71) / 71);
    ctx.fillStyle = i % 3 ? "rgba(126,124,58,0.11)" : "rgba(158,104,48,0.16)";
    ctx.beginPath();
    ctx.ellipse(
      cx + Math.cos(a) * rx * 0.8 * r,
      cy + Math.sin(a) * ry * 0.8 * r,
      14 + 10 * (((i * 7919) % 23) / 23),
      9 + 7 * (((i * 104729) % 17) / 17),
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  for (let i = 0; i < 620; i++) {
    // the fuzz: short hairs, russet over dark
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 7919) % 97) / 97);
    const x = cx + Math.cos(a) * rx * 0.99 * r;
    const y = cy + Math.sin(a) * ry * 0.99 * r;
    const dir = a * 1.7 + 0.6 * Math.sin(i);
    ctx.strokeStyle = i % 3 ? "rgba(206,168,104,0.34)" : "rgba(70,50,22,0.26)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + Math.cos(dir) * (3 + 2.5 * (((i * 131) % 7) / 7)),
      y + Math.sin(dir) * (3 + 2.5 * (((i * 97) % 7) / 7)),
    );
    ctx.stroke();
  }
  const lift = ctx.createRadialGradient(
    cx - rx * 0.34,
    cy - ry * 0.4,
    rx * 0.04,
    cx - rx * 0.28,
    cy - ry * 0.32,
    rx * 0.92,
  );
  lift.addColorStop(0, "rgba(240,214,158,0.30)");
  lift.addColorStop(1, "rgba(240,214,158,0)");
  ctx.fillStyle = lift;
  sil();
  ctx.fill();
  const shade = ctx.createRadialGradient(
    cx,
    cy,
    rx * 0.55,
    cx + rx * 0.16,
    cy + ry * 0.22,
    rx * 1.05,
  );
  shade.addColorStop(0, "rgba(50,34,14,0)");
  shade.addColorStop(1, "rgba(48,32,14,0.42)");
  ctx.fillStyle = shade;
  sil();
  ctx.fill();
  const kx = cx - rx * 0.8; // the stem scar, one discrete feature
  const ky = cy + ry * 0.1;
  ctx.fillStyle = "rgba(84,58,26,0.72)";
  ctx.beginPath();
  ctx.ellipse(kx, ky, 9, 7, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(52,34,14,0.66)";
  ctx.beginPath();
  ctx.ellipse(kx, ky, 4.4, 3.2, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The source's own outline exactly (knifecraft.html:7794) — see the
  // skin-gradient comment above on why this was restored rather than
  // kept at the earlier pass's bolder, darker version.
  ctx.strokeStyle = "rgba(64,46,20,0.46)";
  ctx.lineWidth = 2;
  sil();
  ctx.stroke();

  if (!hasCut) return; // uncut: 100% fuzzy skin, wall to wall — no flesh anywhere yet

  // --- PAINT.kiwi: the real green flesh + structured seed ring, windowed
  // to an inset disc so the brown fuzzy rim survives around the edge ---
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - SKIN_INSET, ry - SKIN_INSET, 0, 0, Math.PI * 2);
  ctx.clip();

  const fg = ctx.createRadialGradient(cx, cy, rx * 0.08, cx, cy, rx * 1.0);
  fg.addColorStop(0, "#EEF7BC");
  fg.addColorStop(0.22, "#D8EC86");
  fg.addColorStop(0.46, "#B2D854");
  fg.addColorStop(0.72, "#95C63A");
  fg.addColorStop(0.9, "#A9D34E");
  fg.addColorStop(1, "#C8E378");
  ctx.fillStyle = fg;
  sil();
  ctx.fill();

  ctx.save();
  sil();
  ctx.clip();
  for (let i = 0; i < 44; i++) {
    // translucency: soft wet blotches, both ways
    const a = i * 2.399963;
    const r = Math.sqrt(((i * 6151) % 83) / 83);
    ctx.fillStyle = i % 2 ? "rgba(255,255,220,0.10)" : "rgba(108,158,34,0.09)";
    ctx.beginPath();
    ctx.ellipse(
      cx + Math.cos(a) * rx * 0.82 * r,
      cy + Math.sin(a) * ry * 0.82 * r,
      10 + 9 * (((i * 7919) % 19) / 19),
      7 + 6 * (((i * 104729) % 13) / 13),
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const RAY = 210; // the rays: dense, fine, faintly wavering
  for (let s = 0; s < RAY; s++) {
    const a = (s / RAY) * Math.PI * 2 + 0.07;
    const j = ((s * 7919) % 17) / 17;
    const k = ((s * 104729) % 11) / 11;
    const r0 = 0.15 + 0.05 * k;
    const r1 = 0.86 + 0.1 * j;
    const mid = (r0 + r1) / 2;
    const wob = (k - 0.5) * 0.055;
    ctx.strokeStyle =
      s % 4 === 0
        ? "rgba(255,255,238,0.34)"
        : s % 4 === 2
          ? "rgba(122,168,44,0.20)"
          : "rgba(244,251,208,0.44)";
    ctx.lineWidth = s % 4 === 0 ? 2.2 : 1.15;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rx * r0, cy + Math.sin(a) * ry * r0);
    ctx.quadraticCurveTo(
      cx + Math.cos(a + wob) * rx * mid,
      cy + Math.sin(a + wob) * ry * mid,
      cx + Math.cos(a) * rx * r1,
      cy + Math.sin(a) * ry * r1,
    );
    ctx.stroke();
  }
  const halo = ctx.createRadialGradient(cx, cy, rx * 0.7, cx, cy, rx * 1.0);
  halo.addColorStop(0, "rgba(226,244,166,0)");
  halo.addColorStop(1, "rgba(236,248,186,0.60)");
  ctx.fillStyle = halo;
  sil();
  ctx.fill(); // the paler ring just inside the rim
  ctx.strokeStyle = "rgba(248,252,214,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 7, ry - 7, 0, 0, Math.PI * 2);
  ctx.stroke(); // the thin bright line hugging the skin
  const core = new Path2D(); // lobed, not a plain ellipse: a real kiwi's placenta
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const lob = 1 + 0.16 * Math.cos(a * 5 + 0.7) + 0.07 * Math.cos(a * 9 - 0.4);
    const x = cx + Math.cos(a) * rx * 0.28 * lob;
    const y = cy + Math.sin(a) * ry * 0.17 * lob;
    if (i) core.lineTo(x, y);
    else core.moveTo(x, y);
  }
  core.closePath();
  const glow = ctx.createRadialGradient(cx, cy, rx * 0.12, cx, cy, rx * 0.46);
  glow.addColorStop(0, "rgba(250,252,208,0.55)");
  glow.addColorStop(1, "rgba(250,252,208,0)");
  ctx.fillStyle = glow;
  sil();
  ctx.fill();
  const cg = ctx.createRadialGradient(cx - rx * 0.04, cy - ry * 0.04, rx * 0.02, cx, cy, rx * 0.32);
  cg.addColorStop(0, "#FEFDEC");
  cg.addColorStop(0.62, "#F7F2CC");
  cg.addColorStop(1, "#E7DFA6");
  ctx.fillStyle = cg;
  ctx.fill(core);
  ctx.strokeStyle = "rgba(198,198,134,0.26)";
  ctx.lineWidth = 1;
  ctx.stroke(core);
  const rings = [
    { n: 17, r: 0.315, sz: 1.02, ph: 0.0 },
    { n: 14, r: 0.395, sz: 0.94, ph: 0.19 },
    { n: 10, r: 0.475, sz: 0.86, ph: 0.36 },
  ];
  for (const ring of rings) {
    // the seed band, three jittered radii
    for (let i = 0; i < ring.n; i++) {
      const j = ((i * 7919) % 13) / 13;
      const k = ((i * 104729) % 7) / 7;
      const a = (i / ring.n) * Math.PI * 2 + ring.ph + 0.1 * (j - 0.5);
      const rr = ring.r + 0.03 * (k - 0.5);
      const x = cx + Math.cos(a) * rx * rr;
      const y = cy + Math.sin(a) * ry * (rr * 1.3);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2 + 0.25 * (j - 0.5));
      ctx.fillStyle = "rgba(46,26,12,0.30)";
      ctx.beginPath();
      ctx.ellipse(0.6, 0.8, 4.6 * ring.sz, 2.6 * ring.sz, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = i % 3 ? "#231207" : "#3A1E0C";
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.9 * ring.sz, 2.1 * ring.sz, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,250,220,0.38)";
      ctx.beginPath();
      ctx.ellipse(-0.9, -0.5, 1.4 * ring.sz, 0.62 * ring.sz, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
  ctx.restore();
}
