/**
 * ASPARAGUS_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.asparagus()` (source line 6745). Nine spears, each a cluster
 * lobe of its own — separate entities, so nothing is painted outside the
 * lobes (an early source draft filled the whole silhouette first and
 * that dark-green slab showed between the spears). Each spear: a pale
 * butt fading into a deeper shaft, a lit ridge along the top and a
 * shadow ridge along the bottom, small leaf-scar ellipses up the shaft,
 * a bract-head tip built from 22 overlapping soft patches with its own
 * shading, and a pale cut face at the trimmed butt end.
 */
import { scaleClusterLeaves, type ClusterLeaf } from "../ingredientShapes";
import { ASPARAGUS_LEAVES } from "../definitions";

const TONES: readonly [string, string, string][] = [
  ["#B4D46A", "#86B540", "#4F7C29"],
  ["#A9CC5E", "#7CAC38", "#487423"],
  ["#BDDA76", "#8FBE49", "#56842F"],
  ["#A2C657", "#75A433", "#436E20"],
];

export function asparagusTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function asparagusLeavesAt(scale: number): ClusterLeaf[] {
  return scaleClusterLeaves(ASPARAGUS_LEAVES, scale);
}

export function paintAsparagusTexture(
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
    ctx.save();
    ctx.translate(cx + L.dx, cy + L.dy);
    ctx.rotate(L.rot ?? 0);

    const spear = new Path2D();
    spear.moveTo(-rx2, -ry2 * 0.9);
    spear.bezierCurveTo(-rx2 * 0.2, -ry2 * 0.84, rx2 * 0.44, -ry2 * 0.76, rx2 * 0.7, -ry2 * 0.88);
    spear.bezierCurveTo(rx2 * 0.88, -ry2 * 0.74, rx2 * 0.97, -ry2 * 0.34, rx2, 0);
    spear.bezierCurveTo(rx2 * 0.97, ry2 * 0.34, rx2 * 0.88, ry2 * 0.74, rx2 * 0.7, ry2 * 0.88);
    spear.bezierCurveTo(rx2 * 0.44, ry2 * 0.76, -rx2 * 0.2, ry2 * 0.84, -rx2, ry2 * 0.9);
    spear.closePath();
    const bg = ctx.createLinearGradient(0, -ry2, 0, ry2);
    bg.addColorStop(0, t[0]);
    bg.addColorStop(0.46, t[1]);
    bg.addColorStop(1, t[2]);
    ctx.fillStyle = bg;
    ctx.fill(spear);

    ctx.save();
    ctx.clip(spear);
    const pale = ctx.createLinearGradient(-rx2, 0, -rx2 * 0.1, 0); // the butt end is paler, as a real spear is
    pale.addColorStop(0, "rgba(238,246,206,0.85)");
    pale.addColorStop(0.55, "rgba(226,240,186,0.35)");
    pale.addColorStop(1, "rgba(226,240,186,0)");
    ctx.fillStyle = pale;
    ctx.fill(spear);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,230,0.34)"; // lit ridge along the top of the shaft
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-rx2 * 0.9, -ry2 * 0.42);
    ctx.quadraticCurveTo(0, -ry2 * 0.46, rx2 * 0.66, -ry2 * 0.4);
    ctx.stroke();
    ctx.strokeStyle = "rgba(34,56,18,0.30)"; // shadow ridge along the bottom
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-rx2 * 0.88, ry2 * 0.46);
    ctx.quadraticCurveTo(0, ry2 * 0.52, rx2 * 0.64, ry2 * 0.42);
    ctx.stroke();
    for (let s = 0; s < 5; s++) {
      // small leaf scars up the shaft
      const sx = -rx2 * 0.6 + s * rx2 * 0.28;
      const sy = (s % 2 ? -1 : 1) * ry2 * 0.52;
      ctx.fillStyle = "rgba(196,216,140,0.42)";
      ctx.beginPath();
      ctx.ellipse(sx, sy, ry2 * 0.42, ry2 * 0.2, s % 2 ? -0.5 : 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const tipX0 = rx2 * 0.52; // BRACT HEAD: soft overlapping patches
    for (let k = 0; k < 22; k++) {
      const h1 = ((k * 40503) % 1009) / 1009;
      const h2 = ((k * 29587) % 997) / 997;
      const frac = Math.pow(h1, 0.7);
      const x = tipX0 + (rx2 * 0.99 - tipX0) * frac;
      const rr = ry2 * (1 - frac * 0.62);
      const y = (h2 * 2 - 1) * rr * 0.86;
      const rad = ry2 * (0.34 + (0.2 * ((k * 104729) % 23)) / 23);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((((k * 6151) % 13) - 6) * 0.05);
      ctx.fillStyle = k % 2 ? "rgba(52,84,30,0.60)" : "rgba(68,100,40,0.52)";
      ctx.beginPath();
      ctx.ellipse(0, 0, rad * 1.35, rad * 0.86, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(214,232,158,0.20)";
      ctx.beginPath();
      ctx.ellipse(-rad * 0.32, -rad * 0.3, rad * 0.6, rad * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const tipShade = ctx.createLinearGradient(tipX0, 0, rx2, 0);
    tipShade.addColorStop(0, "rgba(22,40,12,0)");
    tipShade.addColorStop(1, "rgba(22,40,12,0.34)");
    ctx.fillStyle = tipShade;
    ctx.fill(spear);
    ctx.restore();

    const cut = ctx.createLinearGradient(-rx2, -ry2, -rx2 * 0.92, ry2); // the trimmed butt: a pale cut face
    cut.addColorStop(0, "#F2F7DC");
    cut.addColorStop(1, "#D6E4B0");
    ctx.fillStyle = cut;
    ctx.beginPath();
    ctx.ellipse(-rx2 * 0.985, 0, ry2 * 0.3, ry2 * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,148,80,0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = "rgba(38,62,22,0.50)";
    ctx.lineWidth = 1.5;
    ctx.stroke(spear);
    ctx.restore();
  });
}
