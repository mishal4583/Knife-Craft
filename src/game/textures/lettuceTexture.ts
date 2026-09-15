/**
 * LETTUCE_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.lettuce()` (source line 6385). Each leaf is a wobbled radial
 * path (heavier wobble toward the far margin, smooth where it meets the
 * hidden heart), a directional dish-shade, a pale wedge midrib thick at
 * the base, veins curving off it toward the frill, the frill's own
 * inset shadow-stroke, and a highlight. Outer leaves (`OUT` tones) vs.
 * the four young inner-heart leaves (`INN` tones, paler/yellower) are
 * flagged by index — LETTUCE_LEAVES' own trailing 4 entries, ported
 * verbatim from the source's `inner:1` flags (a paint-only distinction,
 * per lettuceTexture.ts's own established convention).
 */
import { scaleClusterLeaves, type ClusterLeaf } from "../ingredientShapes";
import { LETTUCE_LEAVES } from "../definitions";

const OUT: readonly [string, string, string, string][] = [
  ["#CFEA92", "#4FB120", "#1E7A12", "#84DA33"],
  ["#C6E585", "#43A518", "#166B0C", "#77D129"],
  ["#D7EE9E", "#5CBB2A", "#25871A", "#8FE23C"],
  ["#BFE07A", "#3A9A14", "#125E09", "#6BC722"],
];
const INN: readonly [string, string, string, string][] = [
  ["#E9F8BE", "#96D93E", "#5FBB22", "#BCEE60"],
  ["#F0FBD0", "#A8E353", "#71C733", "#CBF375"],
];
const INNER_START_INDEX = 9; // the four heart leaves, ported verbatim from the source's own `inner:1` flags

export function lettuceTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function lettuceLeavesAt(scale: number): ClusterLeaf[] {
  return scaleClusterLeaves(LETTUCE_LEAVES, scale);
}

export function paintLettuceTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  leaves: ClusterLeaf[],
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  leaves.forEach((L, i) => {
    const inner = i >= INNER_START_INDEX;
    const palette = inner ? INN : OUT;
    const t = palette[i % palette.length]!;
    const seed = i * 2.399963 + 1;
    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);

    const leaf = new Path2D();
    const N = 84;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2;
      const out = (1 + Math.cos(a)) / 2; // 1 at the far margin, 0 where it meets the heart
      const w =
        1 +
        (0.03 + 0.085 * out) * Math.sin(5 * a + seed) +
        0.045 * out * Math.sin(9 * a + seed * 1.7);
      const x = Math.cos(a) * L.rx * w;
      const y = Math.sin(a) * L.ry * w;
      if (k) leaf.lineTo(x, y);
      else leaf.moveTo(x, y);
    }
    leaf.closePath();
    const bg = ctx.createLinearGradient(-L.rx * 0.95, -L.ry * 0.35, L.rx * 1.02, L.ry * 0.3);
    bg.addColorStop(0, t[0]);
    bg.addColorStop(0.3, t[1]);
    bg.addColorStop(0.74, t[2]);
    bg.addColorStop(1, t[3]);
    ctx.fillStyle = bg;
    ctx.fill(leaf);

    ctx.save();
    ctx.clip(leaf);
    const shade = ctx.createLinearGradient(0, -L.ry, 0, L.ry); // the leaf dishes: darker along its lower half
    shade.addColorStop(0, "rgba(255,255,236,0.14)");
    shade.addColorStop(0.45, "rgba(255,255,236,0)");
    shade.addColorStop(1, "rgba(18,72,10,0.16)");
    ctx.fillStyle = shade;
    ctx.fill(leaf);
    ctx.lineCap = "round";
    const rib = new Path2D(); // midrib: a pale wedge, thick at the base
    const bw = L.ry * 0.11;
    rib.moveTo(-L.rx * 0.8, -bw);
    rib.quadraticCurveTo(0, -bw * 0.44, L.rx * 0.6, -1.0);
    rib.lineTo(L.rx * 0.6, 1.0);
    rib.quadraticCurveTo(0, bw * 0.44, -L.rx * 0.8, bw);
    rib.closePath();
    const rg = ctx.createLinearGradient(-L.rx * 0.8, 0, L.rx * 0.6, 0);
    rg.addColorStop(0, "rgba(244,251,216,0.62)");
    rg.addColorStop(0.55, "rgba(232,246,196,0.40)");
    rg.addColorStop(1, "rgba(226,244,190,0.06)");
    ctx.fillStyle = rg;
    ctx.fill(rib);
    ctx.strokeStyle = "rgba(90,132,52,0.16)";
    ctx.lineWidth = 1;
    ctx.stroke(rib);
    ctx.strokeStyle = "rgba(232,248,192,0.34)"; // veins: off the rib, curving to the frill
    ctx.lineWidth = 1.4;
    for (let v = 0; v < 6; v++) {
      const bx = -L.rx * 0.74 + v * (L.rx * 0.3);
      const reach = 0.72 + 0.3 * Math.sin(v * 1.3 + seed);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(bx, s * 1.5);
        ctx.quadraticCurveTo(
          bx + L.rx * 0.24,
          s * L.ry * 0.38 * reach,
          bx + L.rx * 0.44,
          s * L.ry * 0.92 * reach,
        );
        ctx.stroke();
      }
    }
    ctx.strokeStyle = "rgba(28,62,18,0.12)"; // the frill's own shadow, inside the margin
    ctx.lineWidth = 2.4;
    ctx.save();
    ctx.scale(0.92, 0.9);
    ctx.stroke(leaf);
    ctx.restore();
    const hl = ctx.createRadialGradient(
      L.rx * 0.34,
      -L.ry * 0.32,
      2,
      L.rx * 0.3,
      -L.ry * 0.28,
      L.rx * 0.86,
    );
    hl.addColorStop(0, "rgba(255,255,236,0.26)");
    hl.addColorStop(1, "rgba(255,255,236,0)");
    ctx.fillStyle = hl;
    ctx.fill(leaf);
    ctx.restore();

    ctx.strokeStyle = inner ? "rgba(70,132,32,0.40)" : "rgba(20,70,12,0.48)";
    ctx.lineWidth = 1.4;
    ctx.stroke(leaf);
    ctx.restore();
  });
}
