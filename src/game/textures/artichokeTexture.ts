/**
 * ARTICHOKE_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.artichoke()` (source line 7289). A pale heart disc and a
 * gradient stem drawn first (seam filler kept small and dark so it never
 * shows past the bracts as a green disc), then 26 broad overlapping
 * bracts in 7 staggered rows (row tones ported verbatim — crown
 * slightly greyer-green, outer rows lighter and yellower): each bract
 * is a wide-based, blunt-pointed scale with a soft cast shadow onto the
 * scale behind it, a seated-base shade, rolled side edges, a pale
 * midrib, and a brown tip fleck.
 */
import { scaleClusterLeaves, type ClusterLeaf } from "../ingredientShapes";
import { ARTICHOKE_LEAVES } from "../definitions";

const TONES: readonly [string, string, string][] = [
  ["#3F5F22", "#5B8038", "#74964F"],
  ["#426425", "#5F853B", "#789A53"],
  ["#456828", "#638A3F", "#7C9E57"],
  ["#486C2B", "#678F43", "#80A25B"],
  ["#4B702E", "#6B9447", "#84A65F"],
  ["#4E7431", "#6F9A4B", "#88AA63"],
  ["#517833", "#739F4F", "#8CAE67"],
];
// Row boundaries (cumulative leaf counts per row, outer to inner) — matches ARTICHOKE_LEAVES' own 2/3/4/5/5/4/3 layout.
const ROW_BOUNDARIES = [2, 5, 9, 14, 19, 23, 26];

function rowOf(index: number): number {
  for (let r = 0; r < ROW_BOUNDARIES.length; r++) {
    if (index < ROW_BOUNDARIES[r]!) return r;
  }
  return ROW_BOUNDARIES.length - 1;
}

export function artichokeTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function artichokeLeavesAt(scale: number): ClusterLeaf[] {
  return scaleClusterLeaves(ARTICHOKE_LEAVES, scale);
}

export function paintArtichokeTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  leaves: ClusterLeaf[],
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  ctx.fillStyle = "#3C5A20"; // seam filler only, small and dark: it must never show past the bracts as a green disc
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.02, rx * 0.52, ry * 0.56, 0, 0, Math.PI * 2);
  ctx.fill();

  const stemTop = cy + ry * 0.78;
  const stem = new Path2D();
  stem.moveTo(cx - 38, stemTop);
  stem.lineTo(cx - 33, stemTop + 44);
  stem.quadraticCurveTo(cx, stemTop + 54, cx + 33, stemTop + 44);
  stem.lineTo(cx + 38, stemTop);
  stem.closePath();
  const sg = ctx.createLinearGradient(cx - 38, 0, cx + 38, 0);
  sg.addColorStop(0, "#5A7A32");
  sg.addColorStop(0.34, "#8FAC5E");
  sg.addColorStop(0.72, "#7A9848");
  sg.addColorStop(1, "#4E6C2A");
  ctx.fillStyle = sg;
  ctx.fill(stem);
  ctx.strokeStyle = "rgba(52,76,26,0.30)";
  ctx.lineWidth = 1.2;
  ctx.stroke(stem);
  ctx.strokeStyle = "rgba(240,248,210,0.30)";
  ctx.lineWidth = 1.4;
  for (const k of [-0.6, 0, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(cx + k * 28, stemTop + 4);
    ctx.lineTo(cx + k * 22, stemTop + 44);
    ctx.stroke();
  }

  const heart = new Path2D();
  heart.ellipse(cx, cy - ry * 0.1, 46, 50, 0, 0, Math.PI * 2);
  const hg = ctx.createRadialGradient(cx, cy - ry * 0.1, 4, cx, cy - ry * 0.1, 50);
  hg.addColorStop(0, "#F6F2CC");
  hg.addColorStop(0.68, "#E4E0A4");
  hg.addColorStop(1, "#CEC684");
  ctx.fillStyle = hg;
  ctx.fill(heart);

  leaves.forEach((L, i) => {
    const t = TONES[rowOf(i)]!;
    const rx2 = L.rx;
    const ry2 = L.ry;
    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);

    const br = new Path2D(); // broad scale: wide base, blunt point at +x
    br.moveTo(-rx2 * 0.92, -ry2 * 0.94);
    br.bezierCurveTo(-rx2 * 0.1, -ry2 * 1.0, rx2 * 0.66, -ry2 * 0.56, rx2 * 0.99, -ry2 * 0.05);
    br.quadraticCurveTo(rx2 * 1.05, 0, rx2 * 0.99, ry2 * 0.05);
    br.bezierCurveTo(rx2 * 0.66, ry2 * 0.56, -rx2 * 0.1, ry2 * 1.0, -rx2 * 0.92, ry2 * 0.94);
    br.quadraticCurveTo(-rx2 * 1.1, 0, -rx2 * 0.92, -ry2 * 0.94);
    br.closePath();
    ctx.fillStyle = "rgba(44,68,22,0.20)"; // soft cast shadow onto the scale behind
    ctx.save();
    ctx.translate(-4, 4);
    ctx.fill(br);
    ctx.restore();
    const bg = ctx.createLinearGradient(-rx2, 0, rx2, 0);
    bg.addColorStop(0, t[0]);
    bg.addColorStop(0.48, t[1]);
    bg.addColorStop(1, t[2]);
    ctx.fillStyle = bg;
    ctx.fill(br);

    ctx.save();
    ctx.clip(br);
    const seat = ctx.createLinearGradient(-rx2, 0, -rx2 * 0.15, 0);
    seat.addColorStop(0, "rgba(40,62,20,0.30)");
    seat.addColorStop(1, "rgba(40,62,20,0)");
    ctx.fillStyle = seat;
    ctx.fill(br);
    for (const s of [-1, 1]) {
      // the scale's rolled side edges
      const eg = ctx.createLinearGradient(0, s * ry2, 0, s * ry2 * 0.42);
      eg.addColorStop(0, "rgba(58,84,30,0.26)");
      eg.addColorStop(1, "rgba(58,84,30,0)");
      ctx.fillStyle = eg;
      ctx.fill(br);
    }
    ctx.strokeStyle = "rgba(244,250,214,0.40)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-rx2 * 0.78, 0);
    ctx.quadraticCurveTo(rx2 * 0.24, -ry2 * 0.03, rx2 * 0.9, 0);
    ctx.stroke();
    const tip = ctx.createRadialGradient(rx2 * 0.96, 0, 1, rx2 * 0.96, 0, rx2 * 0.3);
    tip.addColorStop(0, "rgba(146,104,44,0.50)");
    tip.addColorStop(1, "rgba(146,104,44,0)");
    ctx.fillStyle = tip;
    ctx.fill(br);
    ctx.restore();

    ctx.strokeStyle = "rgba(52,78,28,0.26)";
    ctx.lineWidth = 1.2;
    ctx.stroke(br);
    ctx.restore();
  });
}
