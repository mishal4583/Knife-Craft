/**
 * SPRING_ONION_TEXTURE — ported from the KNIFECRAFT-NEW-INGREDIENTS
 * package's `PAINT_ADDITIONS.springonion()`. Seven stalks, each its own
 * cluster lobe (Asparagus's own bundle rule — SPRINGONION_LEAVES in
 * definitions.ts). Each stalk is one outline whose half-width is a
 * function of length: a swollen bulb over the first fifth (added to,
 * never max()'d over, the tube — a max clamps into a flat plateau with a
 * hard corner at the neck), a pinch, then a near-constant tube to a flat
 * cut tip, sampled with cosine spacing so the rounded caps resolve
 * (uniform sampling draws them as polygonal Vs). Colour runs root-white
 * -> bulb-white -> pale sheath green -> deep leaf green along that same
 * axis, plus sheath collars, a lit top ridge, the hollow cut tube at the
 * tip, and a splayed root fringe off the butt.
 */
import type { ClusterLeaf } from "../ingredientShapes";
import { scaleClusterLeaves } from "../ingredientShapes";
import { SPRINGONION_LEAVES } from "../definitions";

const TONES: readonly [string, string, string][] = [
  ["#EAF3C8", "#9ECB55", "#3F7A25"],
  ["#E6F0C0", "#96C44C", "#38701F"],
  ["#F0F7D4", "#A8D262", "#47842C"],
  ["#E2EDBA", "#8FBC44", "#33691C"],
];

export function springOnionTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function springOnionLeavesAt(scale: number): ClusterLeaf[] {
  return scaleClusterLeaves(SPRINGONION_LEAVES, scale);
}

export function paintSpringOnionTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  leaves: ClusterLeaf[],
  // Spring Onion is not peelable — this slot exists only so the call site
  // can share ClusterRenderer.paint's one (ctx,rx,ry,margin,leaves,
  // peeled,overhangGone) signature with every other cluster ingredient.
  _peeled?: boolean,
  // `overhangGone` — see PreparationScene.ts's ClusterRenderer.paint own
  // doc. True once `this.cuts.length > 0`; gates the root tuft below so
  // it actually sheds on the first cut (the prototype's declared overhang
  // for this ingredient).
  overhangGone = false,
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  let i = 0;
  for (const L of leaves) {
    const t = TONES[i++ % TONES.length]!;
    const lrx = L.rx;
    const lry = L.ry;
    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);

    // Half-width along the stalk, u=0 at the butt. Proportion (bulb ~1.6x
    // the shaft) is the whole game: much wider reads as a dart, equal
    // reads as a leek.
    const hw = (u: number): number => {
      const bulb = Math.exp(-Math.pow((u - 0.115) / 0.115, 2));
      const tube = 0.6 + 0.035 * Math.sin(u * 7.0); // the shaft, faintly uneven
      // Circular cap (not a cone) reaching zero, so the first sample isn't a square-cornered wall.
      const butt = u < 0.075 ? Math.sqrt(Math.max(0, 1 - Math.pow(1 - u / 0.075, 2))) : 1;
      // The cut tip: flat, but with just enough rounding (2% of length) to kill the right angle.
      const tip = u > 0.98 ? Math.sqrt(Math.max(0, (1 - u) / 0.02)) * 0.35 + 0.65 : 1;
      return lry * (tube + 0.42 * bulb) * butt * tip;
    };

    // Cosine sampling, not uniform — the caps occupy only a few percent
    // of the length, so clustering samples at both ends is what resolves
    // them into round caps instead of polygonal Vs.
    const N = 72;
    const uAt = (k: number) => 0.5 - 0.5 * Math.cos((Math.PI * k) / N);
    const stalk = new Path2D();
    for (let k = 0; k <= N; k++) {
      const u = uAt(k);
      const x = -lrx + 2 * lrx * u;
      const y = -hw(u);
      if (k) stalk.lineTo(x, y);
      else stalk.moveTo(x, y);
    }
    for (let k = N; k >= 0; k--) {
      const u = uAt(k);
      stalk.lineTo(-lrx + 2 * lrx * u, hw(u));
    }
    stalk.closePath();

    const bg = ctx.createLinearGradient(-lrx, 0, lrx, 0);
    bg.addColorStop(0.0, "#FCFCF4");
    bg.addColorStop(0.2, "#F7F8E8"); // bulb: white, barely warm
    bg.addColorStop(0.3, t[0]);
    bg.addColorStop(0.58, t[1]);
    bg.addColorStop(0.86, t[2]);
    bg.addColorStop(1.0, t[2]);
    ctx.fillStyle = bg;
    ctx.fill(stalk);

    ctx.save();
    ctx.clip(stalk);
    // Cross-section shading AND the contact shadow the stalk above casts
    // on this one, in one gradient — without the top shadow band the
    // overlapping white bulbs fuse into one slab.
    const shade = ctx.createLinearGradient(0, -lry, 0, lry);
    shade.addColorStop(0.0, "rgba(40,58,22,0.26)");
    shade.addColorStop(0.14, "rgba(255,255,236,0.14)");
    shade.addColorStop(0.3, "rgba(255,255,236,0.30)"); // the lit crown of the tube
    shade.addColorStop(0.56, "rgba(255,255,236,0)");
    shade.addColorStop(1.0, "rgba(26,48,14,0.32)");
    ctx.fillStyle = shade;
    ctx.fill(stalk);

    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,238,0.40)"; // lit ridge down the top of the tube
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-lrx * 0.66, -lry * 0.3);
    ctx.quadraticCurveTo(0, -lry * 0.34, lrx * 0.92, -lry * 0.26);
    ctx.stroke();

    ctx.strokeStyle = "rgba(52,86,30,0.13)"; // lengthwise leaf fibres, green half only
    ctx.lineWidth = 1.0;
    for (const fy of [-0.46, -0.1, 0.28, 0.56]) {
      ctx.beginPath();
      ctx.moveTo(-lrx * 0.05, lry * fy * 0.9);
      ctx.quadraticCurveTo(lrx * 0.5, lry * fy, lrx * 0.95, lry * fy * 0.8);
      ctx.stroke();
    }

    // Sheath collars sit where the sheaths actually part — the white/green transition.
    ctx.strokeStyle = "rgba(150,178,96,0.40)";
    ctx.lineWidth = 1.3;
    for (const u of [0.28, 0.32, 0.36]) {
      const x0 = -lrx + 2 * lrx * u;
      const hy = hw(u) * 0.86;
      ctx.beginPath();
      ctx.moveTo(x0, -hy);
      ctx.quadraticCurveTo(x0 + lrx * 0.03, 0, x0, hy);
      ctx.stroke();
    }
    ctx.restore();

    // The cut end: a squared face of leaf wall with the hollow as a long thin slit down it.
    ctx.fillStyle = "#2C5A1E";
    ctx.beginPath();
    ctx.ellipse(lrx * 0.955, 0, lry * 0.085, hw(0.955) * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#16380F";
    ctx.beginPath();
    ctx.ellipse(lrx * 0.955, 0, lry * 0.042, hw(0.955) * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();

    // Root tuft — splayed, not a comb: each hair gets its own length,
    // fan angle and bow, growing out of the bulb tip's point. Cosmetic
    // overhang — sheds on the first cut.
    if (!overhangGone) {
      ctx.lineCap = "round";
      for (let k = 0; k < 26; k++) {
        const r1 = ((k * 7919) % 101) / 101;
        const r2 = ((k * 104729) % 97) / 97;
        const r3 = ((k * 40503) % 89) / 89;
        const u0 = 0.006 + 0.055 * Math.abs((k / 25) * 2 - 1);
        const y0 = ((k / 25) * 2 - 1) * hw(u0) * 0.75;
        const ln = 5 + 10 * r1;
        const ang = (y0 / (lry || 1)) * 0.75 + (r2 - 0.5) * 0.9;
        const x0 = -lrx + 2 * lrx * u0;
        const ex = x0 - Math.cos(ang) * ln;
        const ey = y0 + Math.sin(ang) * ln;
        ctx.strokeStyle = r3 > 0.5 ? "rgba(232,224,192,0.88)" : "rgba(206,196,160,0.72)";
        ctx.lineWidth = 0.8 + 0.7 * r3;
        ctx.beginPath();
        ctx.moveTo(x0, y0 * 0.8);
        ctx.quadraticCurveTo(x0 - ln * 0.45, y0 + (r2 - 0.5) * 8, ex, ey);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = "rgba(44,74,26,0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke(stalk);
    ctx.restore();
  }
}
