/**
 * GRAPES_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.grapes()` (source line 7204). Each berry (GRAPES_LEAVES,
 * definitions.ts) is its own radial-gradient ellipse (a green-gold tone
 * cycling across 4 variants) with a soft violet "bloom" highlight and a
 * dark outline, plus a two-stroke woody stem sprouting from between the
 * first two berries.
 */
import { scaleClusterLeaves, type ClusterLeaf } from "../ingredientShapes";
import { GRAPES_LEAVES } from "../definitions";

const TONES: readonly [string, string, string][] = [
  ["#E4EFA6", "#B9D45E", "#7C9C2E"],
  ["#DFEB9C", "#B0CD54", "#728F28"],
  ["#EAF3B2", "#C2DA6A", "#87A736"],
  ["#D8E694", "#A8C64C", "#6A8623"],
];

export function grapesTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function grapesLeavesAt(scale: number): ClusterLeaf[] {
  return scaleClusterLeaves(GRAPES_LEAVES, scale);
}

export function paintGrapesTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
  leaves: ClusterLeaf[],
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  for (let i = 0; i < leaves.length; i++) {
    const L = leaves[i]!;
    const t = TONES[i % TONES.length]!;
    const bx = cx + L.dx;
    const by = cy + L.dy;
    const bg = ctx.createRadialGradient(
      bx - L.rx * 0.32,
      by - L.ry * 0.36,
      L.rx * 0.1,
      bx,
      by,
      L.rx * 1.05,
    );
    bg.addColorStop(0, t[0]);
    bg.addColorStop(0.55, t[1]);
    bg.addColorStop(1, t[2]);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(bx, by, L.rx, L.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    const bloom = ctx.createRadialGradient(
      bx - L.rx * 0.3,
      by - L.ry * 0.34,
      1,
      bx - L.rx * 0.3,
      by - L.ry * 0.34,
      L.rx * 0.5,
    );
    bloom.addColorStop(0, "rgba(238,224,240,0.40)");
    bloom.addColorStop(1, "rgba(238,224,240,0)");
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.ellipse(bx, by, L.rx, L.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(40,14,50,0.30)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(bx, by, L.rx, L.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const L0 = leaves[0];
  const L1 = leaves[1];
  if (L0 && L1) {
    const topX = cx + (L0.dx + L1.dx) / 2;
    const topY = cy + Math.min(L0.dy, L1.dy) - 8;
    ctx.strokeStyle = "#6E5230";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(topX, topY + 6);
    ctx.quadraticCurveTo(topX - 4, topY - 18, topX + 10, topY - 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(topX + 2, topY + 2);
    ctx.quadraticCurveTo(topX + 14, topY - 14, topX + 8, topY - 28);
    ctx.stroke();
  }
}
