/**
 * GREEN_BEAN_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.greenbean()` (source line 7157). Seven pods, each its own
 * cluster lobe: a gently bowed bezier pod outline (curved along its
 * length, not a straight capsule), faint seed-swelling radial bumps
 * under the skin, a wet sheen along the lit top edge, a shaded
 * underside, and a dried woody stem nub at the butt end.
 */
import { scaleClusterLeaves, type ClusterLeaf } from "../ingredientShapes";
import { GREENBEAN_LEAVES } from "../definitions";

const TONES: readonly [string, string, string][] = [
  ["#A9CE6C", "#77AF3F", "#3F6B24"],
  ["#9FC663", "#6DA637", "#39631F"],
  ["#B3D477", "#82B948", "#477329"],
  ["#96BE5A", "#659C31", "#34591B"],
];

export function greenBeanTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function greenBeanLeavesAt(scale: number): ClusterLeaf[] {
  return scaleClusterLeaves(GREENBEAN_LEAVES, scale);
}

export function paintGreenBeanTexture(
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
    const t = TONES[i % TONES.length]!;
    const rx2 = L.rx;
    const ry2 = L.ry;
    const bow = ry2 * 0.55; // the gentle curve of a fresh pod
    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);

    const pod = new Path2D();
    pod.moveTo(-rx2, -bow * 0.1);
    pod.bezierCurveTo(
      -rx2 * 0.99,
      -ry2 * 0.95,
      -rx2 * 0.9,
      -ry2 - bow * 0.55,
      -rx2 * 0.62,
      -ry2 * 0.94 - bow * 0.55,
    );
    pod.bezierCurveTo(
      -rx2 * 0.2,
      -ry2 * 0.86 - bow,
      rx2 * 0.3,
      -ry2 * 0.86 - bow * 0.6,
      rx2 * 0.66,
      -ry2 * 0.92,
    );
    pod.bezierCurveTo(rx2 * 0.92, -ry2 * 0.9, rx2, -ry2 * 0.55, rx2, 0);
    pod.bezierCurveTo(rx2, ry2 * 0.6, rx2 * 0.92, ry2 * 0.94, rx2 * 0.66, ry2 * 0.96);
    pod.bezierCurveTo(
      rx2 * 0.3,
      ry2 * 0.92 - bow * 0.6,
      -rx2 * 0.2,
      ry2 * 0.92 - bow,
      -rx2 * 0.62,
      ry2 * 0.98 - bow * 0.55,
    );
    pod.bezierCurveTo(-rx2 * 0.9, ry2 - bow * 0.55, -rx2 * 0.99, ry2 * 0.95, -rx2, -bow * 0.1);
    pod.closePath();
    const bg = ctx.createLinearGradient(0, -ry2 - bow, 0, ry2);
    bg.addColorStop(0, t[0]);
    bg.addColorStop(0.42, t[1]);
    bg.addColorStop(1, t[2]);
    ctx.fillStyle = bg;
    ctx.fill(pod);

    ctx.save();
    ctx.clip(pod);
    for (let s = 0; s < 6; s++) {
      // seed swellings under the skin
      const sx = -rx2 * 0.68 + s * rx2 * 0.26;
      const k = ((s * 7919 + i * 331) % 17) / 17;
      const sy = -bow * 0.55 * Math.cos((sx / rx2) * 1.2) + (k - 0.5) * ry2 * 0.16;
      const sw = ctx.createRadialGradient(sx, sy, ry2 * 0.05, sx, sy, ry2 * 0.85);
      sw.addColorStop(0, "rgba(214,236,158,0.34)");
      sw.addColorStop(1, "rgba(214,236,158,0)");
      ctx.fillStyle = sw;
      ctx.beginPath();
      ctx.ellipse(sx, sy, ry2 * 0.8, ry2 * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(240,252,206,0.42)"; // wet sheen along the lit edge
    ctx.lineWidth = ry2 * 0.2;
    ctx.beginPath();
    ctx.moveTo(-rx2 * 0.86, -ry2 * 0.44 - bow * 0.3);
    ctx.quadraticCurveTo(0, -ry2 * 0.52 - bow * 0.8, rx2 * 0.8, -ry2 * 0.4);
    ctx.stroke();
    ctx.strokeStyle = "rgba(28,48,16,0.26)"; // shaded underside
    ctx.lineWidth = ry2 * 0.15;
    ctx.beginPath();
    ctx.moveTo(-rx2 * 0.84, ry2 * 0.52 - bow * 0.3);
    ctx.quadraticCurveTo(0, ry2 * 0.6 - bow * 0.8, rx2 * 0.8, ry2 * 0.5);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = "rgba(30,54,18,0.44)";
    ctx.lineWidth = 1.4;
    ctx.stroke(pod);
    ctx.strokeStyle = "rgba(150,124,58,0.85)"; // dried stem nub at the butt end
    ctx.lineWidth = ry2 * 0.22;
    ctx.beginPath();
    ctx.moveTo(-rx2 * 0.99, -bow * 0.1);
    ctx.quadraticCurveTo(-rx2 * 1.05, -bow * 0.1 - ry2 * 0.3, -rx2 * 1.1, -bow * 0.1 - ry2 * 0.75);
    ctx.stroke();
    ctx.restore();
  });
}
