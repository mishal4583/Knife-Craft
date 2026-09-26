/**
 * LEMON_TEXTURE — ported from knifecraft.html's `PAINT.lemon()` (source
 * line 5603), then reworked for realism: the original's rind/pith/flesh
 * insets were fixed pixel offsets (11px/17px), which read as barely-there
 * hairline rings once rx grew past the reference's own small working
 * scale — a real lemon's white pith band is one of its most recognizable
 * features, and at 6px it had vanished. Every band below is a FRACTION of
 * rx/ry instead, so the rind/pith/flesh proportions stay correct at any
 * render size. Segments are now real filled wedges (own tone, membrane,
 * grain) rather than a flat flesh disc with thin lines drawn over it —
 * the "flat cartoon circle" look was mostly the membrane/vesicle lines
 * being too thin and too faint to survive board scale.
 */
export function lemonTextureSize(rx: number, ry: number, margin: number): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

const SEG = 10;
// Every wedge boundary and grain scatter below is keyed off this one
// per-segment hash — deterministic (no Math.random — see kiwiTexture.ts's
// own note on this project-wide rule), but different enough between
// segments and between lemon/lime (via the `salt` param) that the wedges
// don't look like a stamped-out copy of each other.
function hash(n: number, salt: number): number {
  const v = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

export function paintCitrusTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  pal: {
    rindStops: [number, string][];
    poreColor: string;
    pithColor: string;
    fleshStops: [number, string][];
    fleshAlt: string;
    membrane: string;
    vesicle: string;
    coreColor: string;
    highlight: string;
    rimStroke: string;
    salt: number;
  },
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const ell = (rrx: number, rry: number) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rrx, rry, 0, 0, Math.PI * 2);
  };
  const pt = (a: number, r: number, rrx: number, rry: number) => ({
    x: cx + Math.cos(a) * rrx * r,
    y: cy + Math.sin(a) * rry * r,
  });

  // ===== RIND — proportional band, not a fixed-px inset =====
  const rind = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.36, rx * 0.16, cx, cy, rx * 1.1);
  for (const [stop, col] of pal.rindStops) rind.addColorStop(stop, col);
  ctx.fillStyle = rind;
  ell(rx, ry);
  ctx.fill();

  ctx.save();
  ell(rx, ry);
  ctx.clip();
  ctx.fillStyle = pal.poreColor;
  for (let i = 0; i < 140; i++) {
    const a = i * 2.399963; // golden angle: even, deterministic scatter
    const r = 0.86 + 0.13 * hash(i, pal.salt);
    const rr = 1.1 + 1.1 * hash(i + 500, pal.salt);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const RIND_R = 0.9; // rind band = outer 10% of the radius
  const PITH_R = 0.78; // pith band = the next 12%
  ctx.fillStyle = pal.pithColor;
  ell(rx * RIND_R, ry * RIND_R);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.06)"; // a crisp seam at rind/pith so the ring reads at any scale
  ctx.lineWidth = 1.4;
  ell(rx * RIND_R, ry * RIND_R);
  ctx.stroke();

  // ===== FLESH — real wedges, not a flat disc with lines over it =====
  const fleshOuterRx = rx * PITH_R;
  const fleshOuterRy = ry * PITH_R;
  ctx.save();
  ell(fleshOuterRx, fleshOuterRy);
  ctx.clip();

  const fg = ctx.createRadialGradient(cx - rx * 0.2, cy - ry * 0.24, rx * 0.1, cx, cy, rx * PITH_R);
  for (const [stop, col] of pal.fleshStops) fg.addColorStop(stop, col);
  ctx.fillStyle = fg;
  ell(fleshOuterRx, fleshOuterRy);
  ctx.fill();

  const CORE_R = 0.1;
  for (let s = 0; s < SEG; s++) {
    const a0 = (s / SEG) * Math.PI * 2 + 0.22;
    const a1 = ((s + 1) / SEG) * Math.PI * 2 + 0.22;
    const bow = 0.02 + 0.01 * hash(s, pal.salt + 1); // segment walls bow outward slightly, never perfectly straight
    const mid = (a0 + a1) / 2;

    // the wedge itself — alternating tone so adjacent segments read as
    // distinct forms, the way a real cut citrus's segments never quite
    // match each other in shade
    const coreA0 = pt(a0, CORE_R, fleshOuterRx, fleshOuterRy);
    const coreA1 = pt(a1, CORE_R, fleshOuterRx, fleshOuterRy);
    const rimA0 = pt(a0, 1, fleshOuterRx, fleshOuterRy);
    const wedge = new Path2D();
    wedge.moveTo(coreA0.x, coreA0.y);
    wedge.quadraticCurveTo(
      cx + Math.cos(a0 + bow) * fleshOuterRx * 0.55,
      cy + Math.sin(a0 + bow) * fleshOuterRy * 0.55,
      rimA0.x,
      rimA0.y,
    );
    const arcSteps = 6;
    for (let k = 1; k <= arcSteps; k++) {
      const a = a0 + (a1 - a0) * (k / arcSteps);
      const p = pt(a, 1, fleshOuterRx, fleshOuterRy);
      wedge.lineTo(p.x, p.y);
    }
    wedge.quadraticCurveTo(
      cx + Math.cos(a1 - bow) * fleshOuterRx * 0.55,
      cy + Math.sin(a1 - bow) * fleshOuterRy * 0.55,
      coreA1.x,
      coreA1.y,
    );
    wedge.closePath();
    if (s % 2 === 1) {
      ctx.fillStyle = pal.fleshAlt;
      ctx.fill(wedge);
    }

    // juice-vesicle grain — a scatter of short outward-radiating strokes
    // clustered along the wedge's own centerline, not a handful of thin
    // uniform lines: real vesicles are granular, not ruled.
    ctx.save();
    ctx.clip(wedge);
    ctx.strokeStyle = pal.vesicle;
    for (let i = 0; i < 16; i++) {
      const h1 = hash(s * 31 + i, pal.salt + 2);
      const h2 = hash(s * 31 + i, pal.salt + 3);
      const r0 = CORE_R + (0.92 - CORE_R) * h1;
      const spread = (a1 - a0) * 0.34 * (h2 - 0.5);
      const a = mid + spread;
      const p0 = pt(a, r0, fleshOuterRx, fleshOuterRy);
      const p1 = pt(a, Math.min(0.95, r0 + 0.1), fleshOuterRx, fleshOuterRy);
      ctx.lineWidth = 1.1 + 0.6 * hash(i + 700, pal.salt);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();

    // membrane — a real filled sliver (tapered, curved), not a stroked line
    const mw0 = 0.05; // half-width near the core
    const mw1 = 0.018; // half-width near the rind (membranes taper OUTWARD-thin, not inward)
    const nx = -Math.sin(a0);
    const ny = Math.cos(a0);
    const mem = new Path2D();
    const cIn = pt(a0, CORE_R, fleshOuterRx, fleshOuterRy);
    const cOut = pt(a0 + bow * 0.6, 1, fleshOuterRx, fleshOuterRy);
    mem.moveTo(cIn.x + nx * fleshOuterRx * mw0, cIn.y + ny * fleshOuterRy * mw0);
    mem.quadraticCurveTo(
      cx + Math.cos(a0 + bow) * fleshOuterRx * 0.55 + nx * fleshOuterRx * mw0 * 0.5,
      cy + Math.sin(a0 + bow) * fleshOuterRy * 0.55 + ny * fleshOuterRy * mw0 * 0.5,
      cOut.x + nx * fleshOuterRx * mw1,
      cOut.y + ny * fleshOuterRy * mw1,
    );
    mem.lineTo(cOut.x - nx * fleshOuterRx * mw1, cOut.y - ny * fleshOuterRy * mw1);
    mem.quadraticCurveTo(
      cx + Math.cos(a0 + bow) * fleshOuterRx * 0.55 - nx * fleshOuterRx * mw0 * 0.5,
      cy + Math.sin(a0 + bow) * fleshOuterRy * 0.55 - ny * fleshOuterRy * mw0 * 0.5,
      cIn.x - nx * fleshOuterRx * mw0,
      cIn.y - ny * fleshOuterRy * mw0,
    );
    mem.closePath();
    ctx.fillStyle = pal.membrane;
    ctx.fill(mem);
  }

  ctx.fillStyle = pal.coreColor;
  ctx.beginPath();
  ctx.ellipse(cx, cy, fleshOuterRx * CORE_R * 1.4, fleshOuterRy * CORE_R * 1.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ===== glossy highlight, upper-left, same as the reference =====
  ctx.save();
  ctx.globalAlpha = 0.26;
  const hg = ctx.createRadialGradient(
    cx - rx * 0.34,
    cy - ry * 0.4,
    2,
    cx - rx * 0.34,
    cy - ry * 0.4,
    rx * 0.44,
  );
  hg.addColorStop(0, pal.highlight);
  hg.addColorStop(1, "rgba(255,253,240,0)");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.34, cy - ry * 0.4, rx * 0.4, ry * 0.28, -0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // a bright, wet-looking cut edge right at the rind — real citrus catches
  // light exactly at the knife edge
  ctx.strokeStyle = pal.rimStroke;
  ctx.lineWidth = Math.max(1.2, rx * 0.014);
  ell(rx - ctx.lineWidth * 0.5, ry - ctx.lineWidth * 0.5);
  ctx.stroke();
}

export function paintLemonTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
): void {
  paintCitrusTexture(ctx, rx, ry, margin, {
    rindStops: [
      [0, "#F9E066"],
      [0.58, "#EFC732"],
      [1, "#C99A1E"],
    ],
    poreColor: "rgba(150,112,16,0.20)",
    pithColor: "#FBF6DE",
    fleshStops: [
      [0, "#FDF3B4"],
      [0.7, "#F8E68C"],
      [1, "#EFD669"],
    ],
    fleshAlt: "rgba(239,214,105,0.30)",
    membrane: "rgba(252,248,222,0.95)",
    vesicle: "rgba(255,255,255,0.45)",
    coreColor: "#FCF8E2",
    highlight: "#FFFDF0",
    rimStroke: "rgba(255,250,220,0.55)",
    salt: 11,
  });
}
