/**
 * SPINACH_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.spinach()` (source line 6619). A BUNCH, not a loose scatter:
 * long pale sagging petioles fanning out of a tied butt, each capped
 * with a pinkish-brown cut root nub, feeding a spade-shaped blade
 * (narrow at the petiole, belling out a third along, then a point — a
 * symmetric ellipse here reads as giant basil) with a bold tapering
 * midrib and two orders of herringbone side veins.
 */
import { scaleClusterLeaves, type ClusterLeaf } from "../ingredientShapes";
import { SPINACH_LEAVES } from "../definitions";

const TONES: readonly [string, string, string][] = [
  ["#5FA548", "#3E7A2C", "#245018"],
  ["#6DB254", "#4A8836", "#2A5A1E"],
  ["#549A3E", "#376E27", "#1F4714"],
  ["#77BC5C", "#52913B", "#2E6222"],
];

export function spinachTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function spinachLeavesAt(scale: number): ClusterLeaf[] {
  return scaleClusterLeaves(SPINACH_LEAVES, scale);
}

export function paintSpinachTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  leaves: ClusterLeaf[],
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  let si = 0;
  for (const L of leaves) {
    // petioles, behind the blades
    if (!L.stem) continue;
    const k = si++;
    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);
    const bow = L.ry * (1.5 + (k % 3) * 0.6); // sag: dead-straight rods read as skewers
    const rod = new Path2D(); // tapered: thicker at the cut butt
    rod.moveTo(-L.rx, -L.ry * 1.1);
    rod.quadraticCurveTo(0, bow - L.ry * 0.94, L.rx, -L.ry * 0.62);
    rod.lineTo(L.rx, L.ry * 0.62);
    rod.quadraticCurveTo(0, bow + L.ry * 0.94, -L.rx, L.ry * 1.1);
    rod.closePath();
    const sg = ctx.createLinearGradient(0, -L.ry * 1.1, 0, L.ry * 1.1 + bow);
    sg.addColorStop(0, "#D3E4A6");
    sg.addColorStop(0.42, "#A9CB76");
    sg.addColorStop(1, "#75A044");
    ctx.fillStyle = sg;
    ctx.fill(rod);
    ctx.strokeStyle = "rgba(88,122,52,0.34)";
    ctx.lineWidth = 1;
    ctx.stroke(rod);
    ctx.strokeStyle = "rgba(250,255,228,0.40)"; // lit groove down the petiole
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-L.rx * 0.86, -L.ry * 0.3);
    ctx.quadraticCurveTo(0, bow - L.ry * 0.26, L.rx * 0.88, -L.ry * 0.2);
    ctx.stroke();
    const nub = ctx.createRadialGradient(-L.rx, -L.ry * 0.4, 0.5, -L.rx, 0, L.ry * 1.7);
    nub.addColorStop(0, k % 2 ? "#E0B08A" : "#CE9970");
    nub.addColorStop(1, "#8A5C39");
    ctx.fillStyle = nub; // cut root end, pinkish-brown
    ctx.beginPath();
    ctx.ellipse(-L.rx * 0.99, 0, L.ry * 1.0, L.ry * 1.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(96,62,36,0.45)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  }

  let i = 0;
  for (const L of leaves) {
    if (L.stem) continue;
    const t = TONES[i++ % TONES.length]!;
    const rx2 = L.rx;
    const ry2 = L.ry;
    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);

    // Spade outline: narrow where it meets its petiole (left), belling
    // out to full width a third along, then running to a point.
    const blade = new Path2D();
    blade.moveTo(-rx2, 0);
    blade.bezierCurveTo(-rx2 * 0.86, -ry2 * 0.78, -rx2 * 0.3, -ry2 * 1.06, rx2 * 0.16, -ry2 * 0.8);
    blade.bezierCurveTo(rx2 * 0.58, -ry2 * 0.58, rx2 * 0.86, -ry2 * 0.26, rx2, 0);
    blade.bezierCurveTo(rx2 * 0.86, ry2 * 0.26, rx2 * 0.58, ry2 * 0.58, rx2 * 0.16, ry2 * 0.8);
    blade.bezierCurveTo(-rx2 * 0.3, ry2 * 1.06, -rx2 * 0.86, ry2 * 0.78, -rx2, 0);
    blade.closePath();
    const bg = ctx.createLinearGradient(-rx2 * 0.3, -ry2, rx2 * 0.4, ry2);
    bg.addColorStop(0, t[0]);
    bg.addColorStop(0.52, t[1]);
    bg.addColorStop(1, t[2]);
    ctx.fillStyle = bg;
    ctx.fill(blade);

    ctx.save();
    ctx.clip(blade);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(236,250,210,0.55)"; // midrib, bold and tapering
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(-rx2 * 0.92, 0);
    ctx.quadraticCurveTo(rx2 * 0.1, -ry2 * 0.04, rx2 * 0.94, 0);
    ctx.stroke();
    ctx.strokeStyle = "rgba(232,246,206,0.30)"; // herringbone side veins
    ctx.lineWidth = 1.5;
    for (let v = 0; v < 7; v++) {
      const f = -0.72 + v * 0.24;
      const bx = rx2 * f;
      const reach = 1 - Math.abs(f) * 0.55;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(bx, s * ry2 * 0.02);
        ctx.bezierCurveTo(
          bx + rx2 * 0.1,
          s * ry2 * 0.38 * reach,
          bx + rx2 * 0.2,
          s * ry2 * 0.66 * reach,
          bx + rx2 * 0.3,
          s * ry2 * 0.92 * reach,
        );
        ctx.stroke();
      }
    }
    ctx.strokeStyle = "rgba(228,244,200,0.14)"; // second order, finer
    ctx.lineWidth = 0.9;
    for (let v = 0; v < 5; v++) {
      const bx = rx2 * (-0.5 + v * 0.28);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(bx + rx2 * 0.06, s * ry2 * 0.3);
        ctx.quadraticCurveTo(bx + rx2 * 0.24, s * ry2 * 0.48, bx + rx2 * 0.3, s * ry2 * 0.74);
        ctx.stroke();
      }
    }
    const hl = ctx.createRadialGradient(
      -rx2 * 0.1,
      -ry2 * 0.34,
      2,
      -rx2 * 0.1,
      -ry2 * 0.34,
      rx2 * 0.72,
    );
    hl.addColorStop(0, "rgba(255,255,235,0.20)");
    hl.addColorStop(1, "rgba(255,255,235,0)");
    ctx.fillStyle = hl;
    ctx.fill(blade);
    ctx.restore();

    ctx.strokeStyle = "rgba(22,48,16,0.42)";
    ctx.lineWidth = 1.8;
    ctx.stroke(blade);
    ctx.restore();
  }
}
