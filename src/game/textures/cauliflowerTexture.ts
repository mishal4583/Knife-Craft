/**
 * CAULIFLOWER_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.cauliflower()` (source line 6540): deliberately the SAME
 * construction as `PAINT.broccoli()` (proof the floret machinery
 * genuinely reuses, not "broccoli recoloured white") — a wobbled radial
 * floret path, a dense hashed bud mat plus larger proud clumps, and a
 * directional crevice shade — just cream/pale tones instead of dark
 * green, and the crown-facing direction mirrored (`ix = -50 - L.dx`: the
 * crown sits to the LEFT here, opposite Broccoli's).
 */
import { scaleClusterLeaves, type ClusterLeaf } from "../ingredientShapes";
import { CAULIFLOWER_LEAVES } from "../definitions";

export function cauliflowerTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function cauliflowerLeavesAt(scale: number): ClusterLeaf[] {
  return scaleClusterLeaves(CAULIFLOWER_LEAVES, scale);
}

export function paintCauliflowerTexture(
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
    sg.addColorStop(0, "#E9F0C8");
    sg.addColorStop(0.48, "#CBDDA0");
    sg.addColorStop(1, "#A3BC78");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(0, 0, L.rx, L.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(140,164,104,0.34)"; // fibre, along the stalk
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

    // A floret is a WOBBLED radial path, never a circle — same three-
    // harmonic construction as Broccoli's own.
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
      `rgb(${Math.round(255 * dark)},${Math.round(253 * dark)},${Math.round(244 * dark)})`,
    );
    hg.addColorStop(
      0.6,
      `rgb(${Math.round(240 * dark)},${Math.round(234 * dark)},${Math.round(214 * dark)})`,
    );
    hg.addColorStop(
      1,
      `rgb(${Math.round(206 * dark)},${Math.round(196 * dark)},${Math.round(168 * dark)})`,
    );
    ctx.fillStyle = hg;
    ctx.fill(head);

    ctx.save();
    ctx.clip(head);
    for (let b = 0; b < 150; b++) {
      const h1 = ((b * 40503 + seed * 7919) % 1009) / 1009;
      const h2 = ((b * 29587 + seed * 6151) % 997) / 997;
      const a = h1 * Math.PI * 2;
      const r = Math.sqrt(h2);
      const bx = Math.cos(a) * L.rx * 0.96 * r;
      const by = Math.sin(a) * L.ry * 0.96 * r;
      const br = 1.2 + 1.5 * (((b * 104729 + seed) % 29) / 29);
      ctx.fillStyle = "rgba(140,128,98,0.30)";
      ctx.beginPath();
      ctx.arc(bx + br * 0.3, by + br * 0.3, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,253,244,0.42)";
      ctx.beginPath();
      ctx.arc(bx - br * 0.26, by - br * 0.3, br * 0.74, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let b = 0; b < 9; b++) {
      const a = (((b * 36067 + seed * 104729) % 1013) / 1013) * Math.PI * 2;
      const r = 0.3 + 0.52 * (((b * 7919 + seed * 13) % 17) / 17);
      const bx = Math.cos(a) * L.rx * r;
      const by = Math.sin(a) * L.ry * r;
      const br = L.rx * (0.17 + 0.1 * ((b % 5) / 5));
      const cg = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.35, br * 0.1, bx, by, br);
      cg.addColorStop(0, "rgba(255,252,240,0.30)");
      cg.addColorStop(0.7, "rgba(214,204,176,0.10)");
      cg.addColorStop(1, "rgba(126,114,86,0.22)"); // own shadow: the lump sits proud
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    // Crevice shade is DIRECTIONAL — the crown sits to the LEFT here,
    // opposite Broccoli's own rightward crown.
    const ix = -50 - L.dx;
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
    rim.addColorStop(0, "rgba(122,110,82,0)");
    rim.addColorStop(0.64, "rgba(122,110,82,0)");
    rim.addColorStop(1, "rgba(122,110,82,0.34)");
    ctx.fillStyle = rim;
    ctx.fill(head);
    ctx.restore();

    ctx.strokeStyle = "rgba(150,138,108,0.20)"; // whisper, not a coin edge
    ctx.lineWidth = 1.2;
    ctx.stroke(head);
    ctx.restore();
  }
}
