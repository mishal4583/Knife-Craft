/**
 * BROCCOLI_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.broccoli()` (source line 7486). BROCCOLI_LEAVES (definitions.ts)
 * is the source's own `geom.leaves` cluster list; the painted floret
 * itself is a WOBBLED radial path (three harmonics, per-floret phase —
 * never a plain circle), each floret then gets a dense mat of tiny bud
 * dots (hashed golden-angle-style placement, NOT a monotone-radius
 * sunflower spiral, which turns into a pinwheel at high count), a few
 * larger sub-floret clumps sitting proud with their own shadow, and a
 * directional crevice shade facing into the crown (never all the way
 * round, which reads as stacked coins instead of one dome).
 */
import { scaleClusterLeaves, type ClusterLeaf } from "../ingredientShapes";
import { BROCCOLI_LEAVES } from "../definitions";

export function broccoliTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function broccoliLeavesAt(scale: number): ClusterLeaf[] {
  return scaleClusterLeaves(BROCCOLI_LEAVES, scale);
}

export function paintBroccoliTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  leaves: ClusterLeaf[],
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  for (const L of leaves) {
    // stalk and branches, behind
    if (!L.stem) continue;
    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);
    const sg = ctx.createLinearGradient(0, -L.ry, 0, L.ry);
    sg.addColorStop(0, "#CFDDA0");
    sg.addColorStop(0.48, "#AFC57E");
    sg.addColorStop(1, "#87A25C");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(0, 0, L.rx, L.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,145,86,0.34)"; // fibre, along the stalk
    ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-L.rx * 0.82, L.ry * 0.28 * i);
      ctx.quadraticCurveTo(0, L.ry * 0.34 * i, L.rx * 0.84, L.ry * 0.24 * i);
      ctx.stroke();
    }
    ctx.restore();
  }

  let i = 0;
  for (const L of leaves) {
    if (L.stem) continue;
    const seed = (i * 7919) % 97;
    const dark = 0.86 + 0.2 * ((seed % 11) / 11);
    i++;
    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);

    // A floret is a WOBBLED radial path, never a circle: three harmonics
    // with a per-floret phase, so no two crowns share an outline.
    const head = new Path2D();
    const N = 46;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2;
      const w =
        1 +
        0.085 * Math.sin(3 * a + seed) +
        0.055 * Math.sin(5 * a + seed * 1.7) +
        0.035 * Math.sin(8 * a + seed * 0.6);
      const x = Math.cos(a) * L.rx * w;
      const y = Math.sin(a) * L.ry * w;
      if (k) head.lineTo(x, y);
      else head.moveTo(x, y);
    }
    head.closePath();
    const hg = ctx.createRadialGradient(-L.rx * 0.26, -L.ry * 0.34, L.rx * 0.12, 0, 0, L.rx * 1.06);
    hg.addColorStop(
      0,
      `rgb(${Math.round(96 * dark)},${Math.round(140 * dark)},${Math.round(66 * dark)})`,
    );
    hg.addColorStop(
      0.6,
      `rgb(${Math.round(62 * dark)},${Math.round(104 * dark)},${Math.round(44 * dark)})`,
    );
    hg.addColorStop(
      1,
      `rgb(${Math.round(34 * dark)},${Math.round(66 * dark)},${Math.round(26 * dark)})`,
    );
    ctx.fillStyle = hg;
    ctx.fill(head);

    ctx.save();
    ctx.clip(head);
    // Buds, in two grades: a dense mat of tiny beads (hashed angle, NOT a
    // golden-angle sunflower spiral — that turns into a pinwheel at this
    // count) plus a few larger clumps sitting proud of it.
    for (let b = 0; b < 150; b++) {
      const h1 = ((b * 40503 + seed * 7919) % 1009) / 1009;
      const h2 = ((b * 29587 + seed * 6151) % 997) / 997;
      const a = h1 * Math.PI * 2;
      const r = Math.sqrt(h2);
      const bx = Math.cos(a) * L.rx * 0.96 * r;
      const by = Math.sin(a) * L.ry * 0.96 * r;
      const br = 1.2 + 1.5 * (((b * 104729 + seed) % 29) / 29);
      ctx.fillStyle = "rgba(24,52,18,0.34)";
      ctx.beginPath();
      ctx.arc(bx + br * 0.3, by + br * 0.3, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(158,204,110,0.30)";
      ctx.beginPath();
      ctx.arc(bx - br * 0.26, by - br * 0.3, br * 0.74, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let b = 0; b < 9; b++) {
      // clumps: sub-floret lumps, own hash (or they trace the same arms)
      const a = (((b * 36067 + seed * 104729) % 1013) / 1013) * Math.PI * 2;
      const r = 0.3 + 0.52 * (((b * 7919 + seed * 13) % 17) / 17);
      const bx = Math.cos(a) * L.rx * r;
      const by = Math.sin(a) * L.ry * r;
      const br = L.rx * (0.17 + 0.1 * ((b % 5) / 5));
      const cg = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.35, br * 0.1, bx, by, br);
      cg.addColorStop(0, "rgba(146,192,98,0.26)");
      cg.addColorStop(0.7, "rgba(70,116,48,0.10)");
      cg.addColorStop(1, "rgba(18,40,14,0.22)"); // own shadow: the lump sits proud
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    // Crevice shade is DIRECTIONAL — only the arc facing into the crown.
    // Ringed all the way round, sixteen florets read as stacked coins
    // instead of one dome.
    const ix = 50 - L.dx;
    const iy = -L.dy;
    const im = Math.hypot(ix, iy) || 1;
    const rim = ctx.createRadialGradient(
      (-ix / im) * L.rx * 0.55,
      (-iy / im) * L.ry * 0.55,
      L.rx * 0.3,
      (-ix / im) * L.rx * 0.55,
      (-iy / im) * L.ry * 0.55,
      L.rx * 1.55,
    );
    rim.addColorStop(0, "rgba(14,32,10,0)");
    rim.addColorStop(0.64, "rgba(14,32,10,0)");
    rim.addColorStop(1, "rgba(14,32,10,0.36)");
    ctx.fillStyle = rim;
    ctx.fill(head);
    ctx.restore();

    ctx.strokeStyle = "rgba(20,42,14,0.15)"; // whisper, not a coin edge
    ctx.lineWidth = 1.2;
    ctx.stroke(head);
    ctx.restore();
  }
}
